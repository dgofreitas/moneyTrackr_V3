# Plano Técnico - EP10: Eventos Corporativos

## 1. Visão Geral da Arquitetura

```
+------------------------------------------------------------------+
|              ARQUITETURA DE EVENTOS CORPORATIVOS                  |
+------------------------------------------------------------------+

  +-------------------+     +----------------------+     +-------------------+
  | CorporateEvent    |---->| CorporateEvent       |---->| CorporateEvent    |
  | Router            |     | Manager              |     | DAO               |
  +-------------------+     +----------------------+     +-------------------+
           |                         |                           |
           |                         |                           v
           |                         |                  +-------------------+
           |                         |                  | CorporateEvent    |
           |                         |                  | Model             |
           |                         |                  +-------------------+
           |                         |
           |                         +---> +----------------------+
           |                         |     | Event Detection       |
           |                         |     | Service               |
           |                         |     +----------------------+
           |                         |              |
           |                         |              v
           |                         |     +----------------------+
           |                         |     | Provider Factory      |
           |                         |     | (Strategy Pattern)    |
           |                         |     +----------------------+
           |                         |              |
           |                         |              +---> BrapiProvider
           |                         |              +---> YahooFinanceProvider
           |                         |              +---> ManualProvider
           |                         |
           |                         +---> +----------------------+
           |                         |     | Position Manager     |
           |                         |     +----------------------+
           |                         |              |
           |                         |              v
           |                         |     +----------------------+
           |                         |     | Position DAO          |
           |                         |     +----------------------+
           |                         |
           |                         +---> +----------------------+
           |                         |     | Audit Log Manager     |
           |                         |     | (EP25)                 |
           |                         |     +----------------------+
           |
           v
  +-------------------+
  | JWT Middleware    |
  +-------------------+
```

### Diagrama de Fluxo de Detecção de Eventos

```
+------------------------------------------------------------------+
|              FLUXO DE DETECÇÃO DE EVENTOS                          |
+------------------------------------------------------------------+

  [Transação Importada]
          |
          | 1. Trigger: Nova transação com data retroativa
          v
  +----------------------+
  | Transaction Manager  |
  +----------------------+
          |
          | 2. Disparar detecção assíncrona
          v
  +----------------------+
  | Event Detection      |
  | Service              |
  +----------------------+
          |
          | 3. Verificar cache Redis (TTL: 24h)
          |    - Se cache hit: retornar eventos
          |    - Se cache miss: continuar
          v
  +----------------------+
  | Provider Factory      |
  +----------------------+
          |
          | 4. Selecionar provider primário (BRAPI)
          v
  +----------------------+
  | BrapiProvider         |
  +----------------------+
          |
          | 5. Consultar API externa
          |    - Sucesso: retornar eventos
          |    - Falha: tentar fallback
          v
  +----------------------+
  | YahooFinanceProvider  |
  | (Fallback)            |
  +----------------------+
          |
          | 6. Normalizar eventos
          v
  +----------------------+
  | CorporateEvent DAO   |
  +----------------------+
          |
          | 7. Salvar eventos (status: PENDING)
          |    - Evitar duplicatas (índice único)
          v
  +----------------------+
  | Notificação ao       |
  | Usuário              |
  +----------------------+
```

### Diagrama de Fluxo de Aprovação

```
+------------------------------------------------------------------+
|              FLUXO DE APROVAÇÃO DE EVENTOS                         |
+------------------------------------------------------------------+

  [Usuário Autenticado]
          |
          | 1. Acessa página de eventos pendentes
          v
  +----------------------+
  | CorporateEvent Router|
  | GET /corporate-events|
  +----------------------+
          |
          | 2. Buscar eventos PENDING
          v
  +----------------------+
  | CorporateEvent Manager|
  +----------------------+
          |
          | 3. Para cada evento:
          |    - Calcular preview de impacto
          |    - Buscar posição atual
          |    - Aplicar fórmula do tipo de evento
          v
  +----------------------+
  | Response com Previews |
  +----------------------+
          |
          | 4. Usuário seleciona eventos
          v
  +----------------------+
  | PATCH /approve       |
  | PATCH /reject        |
  +----------------------+
          |
          | 5. Atualizar status
          v
  +----------------------+
  | CorporateEvent DAO   |
  | updateMany()         |
  +----------------------+
```

### Diagrama de Fluxo de Aplicação

```
+------------------------------------------------------------------+
|              FLUXO DE APLICAÇÃO DE EVENTOS                         |
+------------------------------------------------------------------+

  [Usuário Autenticado]
          |
          | 1. Clica em "Aplicar Eventos Aprovados"
          v
  +----------------------+
  | CorporateEvent Router|
  | POST /apply          |
  +----------------------+
          |
          | 2. Validar request
          v
  +----------------------+
  | CorporateEvent Manager|
  +----------------------+
          |
          | 3. Iniciar sessão MongoDB
          v
  +----------------------+
  | MongoDB Session       |
  | startTransaction()   |
  +----------------------+
          |
          | 4. Buscar eventos APPROVED
          |    - Ordenar por data ASC (crítico!)
          v
  +----------------------+
  | Lista de Eventos      |
  | Ordenada Cronologicamente|
  +----------------------+
          |
          | 5. Para cada evento (em ordem):
          |    a. Buscar posição atual
          |    b. Calcular nova quantidade e preço médio
          |    c. Atualizar posição
          |    d. Marcar evento como APPLIED
          |    e. Criar registro de auditoria
          |    f. Se MERGER: criar nova posição
          v
  +----------------------+
  | Validação de         |
  | Consistência          |
  +----------------------+
          |
          | 6. Se sucesso: commit()
          |    Se erro: abort()
          v
  +----------------------+
  | Response com Resultado|
  +----------------------+
```

---

## 2. Componentes Backend

### 2.1 Models (Mongoose Schemas)

#### corporate-event-model.js

```javascript
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const corporateEventSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    default: uuidv4,
  },
  domain: {
    type: String,
    required: true,
    index: true,
  },
  ticker: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    maxlength: 20,
  },
  type: {
    type: String,
    required: true,
    enum: ['SPLIT', 'BONUS', 'MERGER', 'REVERSE_SPLIT'],
  },
  ratio: {
    type: Number,
    required: true,
    min: 0.00000001,
    comment: 'Ex: 2 para split 1:2, 0.5 para grupamento 2:1, 0.1 para bonificação 10%',
  },
  date: {
    type: Date,
    required: true,
  },
  description: {
    type: String,
    maxlength: 500,
    default: '',
  },
  source: {
    type: String,
    enum: ['BRAPI', 'YAHOO_FINANCE', 'MANUAL'],
    required: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'APPLIED', 'REJECTED'],
    default: 'PENDING',
    index: true,
  },
  detectedAt: {
    type: Date,
    default: Date.now,
  },
  lastCheckedAt: {
    type: Date,
    default: null,
  },
  appliedAt: {
    type: Date,
    default: null,
  },
  appliedBy: {
    type: String,
    default: null,
    ref: 'user',
  },
  walletId: {
    type: String,
    required: false,
    default: null,
  },
  // Campos específicos para MERGER
  targetTicker: {
    type: String,
    default: null,
    comment: 'Ticker destino em caso de fusão (ex: VIVT3 -> VIVT4)',
  },
  // Metadados adicionais
  metadata: {
    type: Map,
    of: String,
    default: {},
  },
}, {
  versionKey: false,
  timestamps: true,
})

// Índices compostos
corporateEventSchema.index({ ticker: 1, date: 1, type: 1 }, { unique: true })
corporateEventSchema.index({ domain: 1, status: 1, createdAt: -1 })
corporateEventSchema.index({ domain: 1, ticker: 1, status: 1 })
corporateEventSchema.index({ walletId: 1, status: 1 })

module.exports = { corporateEventSchema }
```

#### event-application-audit-model.js

```javascript
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const eventApplicationAuditSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    default: uuidv4,
  },
  domain: {
    type: String,
    required: true,
    index: true,
  },
  eventId: {
    type: String,
    required: true,
    ref: 'corporate-event',
  },
  userId: {
    type: String,
    required: true,
    ref: 'user',
  },
  walletId: {
    type: String,
    required: true,
    ref: 'wallet',
  },
  ticker: {
    type: String,
    required: true,
    uppercase: true,
  },
  eventType: {
    type: String,
    required: true,
    enum: ['SPLIT', 'BONUS', 'MERGER', 'REVERSE_SPLIT'],
  },
  positionBefore: {
    quantity: { type: Number, required: true },
    averagePrice: { type: Number, required: true },
    totalInvested: { type: Number, required: true },
  },
  positionAfter: {
    quantity: { type: Number, required: true },
    averagePrice: { type: Number, required: true },
    totalInvested: { type: Number, required: true },
  },
  appliedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  versionKey: false,
  timestamps: true,
})

// Índices para auditoria
eventApplicationAuditSchema.index({ domain: 1, eventId: 1 })
eventApplicationAuditSchema.index({ domain: 1, userId: 1, appliedAt: -1 })
eventApplicationAuditSchema.index({ domain: 1, walletId: 1, ticker: 1 })

module.exports = { eventApplicationAuditSchema }
```

### 2.2 DAOs

#### corporate-event-dao.js

```javascript
const AppDAO = require('../app-dao')

class CorporateEventDAO extends AppDAO {
  constructor(db) {
    super(db)
  }

  initializeDBModel(db) {
    const { corporateEventSchema } = require('./corporate-event-model')
    return db.model('corporate-event', corporateEventSchema)
  }

  async findByTicker(ticker, options = {}) {
    const query = { ticker: ticker.toUpperCase(), isDeleted: false }
    
    if (options.status) {
      query.status = options.status
    }
    
    if (options.startDate || options.endDate) {
      query.date = {}
      if (options.startDate) query.date.$gte = new Date(options.startDate)
      if (options.endDate) query.date.$lte = new Date(options.endDate)
    }

    let queryBuilder = this.objectModel.find(query)
    
    if (options.sort) {
      queryBuilder = queryBuilder.sort(options.sort)
    } else {
      queryBuilder = queryBuilder.sort({ date: 1 })
    }
    
    if (options.limit) {
      queryBuilder = queryBuilder.limit(options.limit)
    }

    return await queryBuilder.lean().exec()
  }

  async findPendingByDomain(domain, options = {}) {
    const query = { 
      domain, 
      status: 'PENDING',
      isDeleted: false 
    }

    let queryBuilder = this.objectModel.find(query)
    
    if (options.sort) {
      queryBuilder = queryBuilder.sort(options.sort)
    } else {
      queryBuilder = queryBuilder.sort({ createdAt: -1 })
    }

    return await queryBuilder.lean().exec()
  }

  async findByIds(eventIds, options = {}) {
    const query = { _id: { $in: eventIds } }
    
    if (options.status) {
      query.status = options.status
    }

    return await this.objectModel
      .find(query)
      .sort({ date: 1 })
      .session(options.session || null)
      .lean()
      .exec()
  }

  async updateStatus(eventId, status, options = {}) {
    const updateData = { status }
    
    if (status === 'APPLIED') {
      updateData.appliedAt = new Date()
      if (options.appliedBy) {
        updateData.appliedBy = options.appliedBy
      }
    }

    return await this.objectModel
      .updateOne(
        { _id: eventId },
        { $set: updateData },
        { session: options.session || null }
      )
      .lean()
      .exec()
  }

  async bulkUpdateStatus(eventIds, status, options = {}) {
    const updateData = { status }
    
    if (status === 'APPLIED') {
      updateData.appliedAt = new Date()
      if (options.appliedBy) {
        updateData.appliedBy = options.appliedBy
      }
    }

    return await this.objectModel
      .updateMany(
        { _id: { $in: eventIds } },
        { $set: updateData },
        { session: options.session || null }
      )
      .lean()
      .exec()
  }

  async checkDuplicate(ticker, date, type) {
    const existing = await this.objectModel
      .findOne({
        ticker: ticker.toUpperCase(),
        date: new Date(date),
        type,
      })
      .lean()
      .exec()

    return existing !== null
  }

  async updateLastChecked(ticker, date) {
    return await this.objectModel
      .updateMany(
        { ticker: ticker.toUpperCase() },
        { $set: { lastCheckedAt: new Date() } }
      )
      .lean()
      .exec()
  }
}

module.exports = CorporateEventDAO
```

#### event-application-audit-dao.js

```javascript
const AppDAO = require('../app-dao')

class EventApplicationAuditDAO extends AppDAO {
  constructor(db) {
    super(db)
  }

  initializeDBModel(db) {
    const { eventApplicationAuditSchema } = require('./event-application-audit-model')
    return db.model('event-application-audit', eventApplicationAuditSchema)
  }

  async createAuditLog(auditData, options = {}) {
    const audit = new this.objectModel(auditData)
    return await audit.save({ session: options.session || null })
  }

  async findByEventId(eventId) {
    return await this.objectModel
      .findOne({ eventId })
      .lean()
      .exec()
  }

  async findByWallet(walletId, options = {}) {
    const query = { walletId }
    
    let queryBuilder = this.objectModel.find(query)
    
    if (options.sort) {
      queryBuilder = queryBuilder.sort(options.sort)
    } else {
      queryBuilder = queryBuilder.sort({ appliedAt: -1 })
    }

    if (options.limit) {
      queryBuilder = queryBuilder.limit(options.limit)
    }

    return await queryBuilder.lean().exec()
  }
}

module.exports = EventApplicationAuditDAO
```

### 2.3 Managers

#### corporate-event-manager.js

```javascript
const { JsonLog } = require('json-log-middleware')
const APP_CONSTANTS = require('../app-constants')
const CorporateEventDAO = require('./corporate-event-dao')
const EventApplicationAuditDAO = require('./event-application-audit-dao')
const EventDetectionService = require('./event-detection-service')
const PositionDAO = require('../position/position-dao')

class CorporateEventManager {
  constructor(appManager, appDB) {
    this.appDB = appDB
    this.logger = new JsonLog(APP_CONSTANTS.SERVICE_NAME)
    this.corporateEventDAO = new CorporateEventDAO(this.appDB.getDb())
    this.eventAuditDAO = new EventApplicationAuditDAO(this.appDB.getDb())
    this.positionDAO = new PositionDAO(this.appDB.getDb())
    this.eventDetectionService = new EventDetectionService(appManager)
  }

  /**
   * Detecta eventos corporativos para um ticker em um período
   */
  async detectEvents({ domain, ticker, startDate, endDate }) {
    try {
      this.logger.log('Iniciando detecção de eventos corporativos', {
        domain,
        internal: { 
          method: 'detectEvents', 
          filename: 'corporate-event-manager.js',
          ticker,
          startDate,
          endDate 
        },
      })

      // Verificar cache Redis
      const cacheKey = `events:${ticker}:${startDate}:${endDate}`
      const cachedEvents = await this._getFromCache(cacheKey)
      
      if (cachedEvents) {
        this.logger.log('Eventos recuperados do cache', {
          domain,
          internal: { method: 'detectEvents', filename: 'corporate-event-manager.js' },
        })
        return cachedEvents
      }

      // Detectar eventos via service
      const detectedEvents = await this.eventDetectionService.detect({
        ticker,
        startDate,
        endDate,
      })

      // Salvar eventos no banco (evitar duplicatas)
      const savedEvents = []
      for (const event of detectedEvents) {
        const isDuplicate = await this.corporateEventDAO.checkDuplicate(
          event.ticker,
          event.date,
          event.type
        )

        if (!isDuplicate) {
          const savedEvent = await this.corporateEventDAO.create({
            domain,
            ticker: event.ticker,
            type: event.type,
            ratio: event.ratio,
            date: event.date,
            description: event.description,
            source: event.source,
            status: 'PENDING',
            targetTicker: event.targetTicker || null,
          })
          savedEvents.push(savedEvent)
        }
      }

      // Atualizar lastCheckedAt
      await this.corporateEventDAO.updateLastChecked(ticker)

      // Salvar no cache Redis (TTL: 24h)
      await this._saveToCache(cacheKey, savedEvents, 86400)

      this.logger.log('Eventos detectados e salvos com sucesso', {
        domain,
        internal: { 
          method: 'detectEvents', 
          filename: 'corporate-event-manager.js',
          count: savedEvents.length 
        },
      })

      return savedEvents
    } catch (error) {
      this.logger.error('Erro ao detectar eventos corporativos', error, {
        domain,
        internal: { method: 'detectEvents', filename: 'corporate-event-manager.js' },
      })
      throw error
    }
  }

  /**
   * Busca eventos pendentes para um domínio
   */
  async getPendingEvents({ domain, ticker }) {
    try {
      const options = { sort: { createdAt: -1 } }
      
      if (ticker) {
        return await this.corporateEventDAO.findByTicker(ticker, {
          status: 'PENDING',
          ...options,
        })
      }

      return await this.corporateEventDAO.findPendingByDomain(domain, options)
    } catch (error) {
      this.logger.error('Erro ao buscar eventos pendentes', error, {
        domain,
        internal: { method: 'getPendingEvents', filename: 'corporate-event-manager.js' },
      })
      throw error
    }
  }

  /**
   * Calcula preview de impacto de um evento
   */
  async calculateEventPreview({ domain, eventId, walletId }) {
    try {
      const event = await this.corporateEventDAO.findOne({ _id: eventId })
      
      if (!event) {
        this.handleError(APP_CONSTANTS.ERRORS.EVENT_NOT_FOUND)
      }

      // Buscar posição atual
      const position = await this.positionDAO.findOne({
        walletId,
        ticker: event.ticker,
        status: 'ACTIVE',
      })

      if (!position) {
        return {
          event,
          before: null,
          after: null,
          message: 'Nenhuma posição encontrada para este ticker',
        }
      }

      // Calcular impacto
      const before = {
        quantity: position.quantity,
        averagePrice: position.averagePrice,
        totalInvested: position.totalInvested,
      }

      const after = this._calculateNewPosition(before, event)

      return {
        event,
        before,
        after,
      }
    } catch (error) {
      this.logger.error('Erro ao calcular preview de evento', error, {
        domain,
        internal: { method: 'calculateEventPreview', filename: 'corporate-event-manager.js' },
      })
      throw error
    }
  }

  /**
   * Aprova um evento individual
   */
  async approveEvent({ domain, eventId, userId }) {
    try {
      const event = await this.corporateEventDAO.findOne({ _id: eventId })
      
      if (!event) {
        this.handleError(APP_CONSTANTS.ERRORS.EVENT_NOT_FOUND)
      }

      if (event.status === 'APPLIED') {
        this.handleError(APP_CONSTANTS.ERRORS.EVENT_ALREADY_APPLIED)
      }

      await this.corporateEventDAO.updateStatus(eventId, 'APPROVED')

      this.logger.log('Evento aprovado com sucesso', {
        domain,
        internal: { 
          method: 'approveEvent', 
          filename: 'corporate-event-manager.js',
          eventId,
          userId 
        },
      })

      return await this.corporateEventDAO.findOne({ _id: eventId })
    } catch (error) {
      this.logger.error('Erro ao aprovar evento', error, {
        domain,
        internal: { method: 'approveEvent', filename: 'corporate-event-manager.js' },
      })
      throw error
    }
  }

  /**
   * Rejeita um evento individual
   */
  async rejectEvent({ domain, eventId, userId }) {
    try {
      const event = await this.corporateEventDAO.findOne({ _id: eventId })
      
      if (!event) {
        this.handleError(APP_CONSTANTS.ERRORS.EVENT_NOT_FOUND)
      }

      if (event.status === 'APPLIED') {
        this.handleError(APP_CONSTANTS.ERRORS.EVENT_ALREADY_APPLIED)
      }

      await this.corporateEventDAO.updateStatus(eventId, 'REJECTED')

      this.logger.log('Evento rejeitado com sucesso', {
        domain,
        internal: { 
          method: 'rejectEvent', 
          filename: 'corporate-event-manager.js',
          eventId,
          userId 
        },
      })

      return await this.corporateEventDAO.findOne({ _id: eventId })
    } catch (error) {
      this.logger.error('Erro ao rejeitar evento', error, {
        domain,
        internal: { method: 'rejectEvent', filename: 'corporate-event-manager.js' },
      })
      throw error
    }
  }

  /**
   * Aprova múltiplos eventos em lote
   */
  async bulkApproveEvents({ domain, eventIds, userId }) {
    try {
      // Validar que todos os eventos existem e podem ser aprovados
      const events = await this.corporateEventDAO.findByIds(eventIds)
      
      if (events.length !== eventIds.length) {
        this.handleError(APP_CONSTANTS.ERRORS.SOME_EVENTS_NOT_FOUND)
      }

      const appliedEvents = events.filter(e => e.status === 'APPLIED')
      if (appliedEvents.length > 0) {
        this.handleError(APP_CONSTANTS.ERRORS.SOME_EVENTS_ALREADY_APPLIED)
      }

      // Aprovar todos
      await this.corporateEventDAO.bulkUpdateStatus(eventIds, 'APPROVED')

      this.logger.log('Eventos aprovados em lote com sucesso', {
        domain,
        internal: { 
          method: 'bulkApproveEvents', 
          filename: 'corporate-event-manager.js',
          count: eventIds.length,
          userId 
        },
      })

      return { updatedCount: eventIds.length }
    } catch (error) {
      this.logger.error('Erro ao aprovar eventos em lote', error, {
        domain,
        internal: { method: 'bulkApproveEvents', filename: 'corporate-event-manager.js' },
      })
      throw error
    }
  }

  /**
   * Aplica eventos aprovados e recalcula posições
   * CRÍTICO: Operação atômica com rollback
   */
  async applyEvents({ domain, walletId, eventIds, userId }) {
    const session = await this.appDB.getDb().startSession()
    
    try {
      session.startTransaction()

      this.logger.log('Iniciando aplicação de eventos corporativos', {
        domain,
        internal: { 
          method: 'applyEvents', 
          filename: 'corporate-event-manager.js',
          eventIds,
          walletId 
        },
      })

      // 1. Buscar eventos aprovados e ordenar por data (CRÍTICO!)
      const events = await this.corporateEventDAO.findByIds(eventIds, {
        status: 'APPROVED',
        session,
      })

      if (events.length === 0) {
        this.handleError(APP_CONSTANTS.ERRORS.NO_APPROVED_EVENTS)
      }

      // Ordenar cronologicamente (essencial para consistência)
      events.sort((a, b) => new Date(a.date) - new Date(b.date))

      const appliedEvents = []

      // 2. Aplicar cada evento na ordem cronológica
      for (const event of events) {
        // Buscar posição atual
        let position = await this.positionDAO.findOne({
          walletId,
          ticker: event.ticker,
          status: 'ACTIVE',
        }, { session })

        if (!position) {
          // Se não há posição, pular evento (pode ter sido vendido)
          this.logger.log('Posição não encontrada para evento, pulando', {
            domain,
            internal: { 
              method: 'applyEvents', 
              filename: 'corporate-event-manager.js',
              eventId: event._id,
              ticker: event.ticker 
            },
          })
          continue
        }

        // Calcular nova posição
        const before = {
          quantity: position.quantity,
          averagePrice: position.averagePrice,
          totalInvested: position.totalInvested,
        }

        const after = this._calculateNewPosition(before, event)

        // Tratamento especial para MERGER
        if (event.type === 'MERGER' && event.targetTicker) {
          // Criar nova posição no ticker destino
          await this.positionDAO.create({
            walletId,
            userId: position.userId,
            ticker: event.targetTicker,
            assetType: position.assetType,
            quantity: after.quantity,
            averagePrice: after.averagePrice,
            totalInvested: after.totalInvested,
            totalFees: position.totalFees,
            currency: position.currency,
            status: 'ACTIVE',
            lastTransactionDate: position.lastTransactionDate,
            metadata: {
              mergedFrom: event.ticker,
              mergerEventId: event._id,
            },
          }, { session })

          // Zerar posição antiga
          await this.positionDAO.updateOne(
            { _id: position._id },
            { 
              $set: { 
                status: 'CLOSED',
                quantity: 0,
                averagePrice: 0,
                totalInvested: 0,
                metadata: {
                  mergedTo: event.targetTicker,
                  mergerEventId: event._id,
                },
              } 
            },
            { session }
          )
        } else {
          // Atualizar posição existente
          await this.positionDAO.updateOne(
            { _id: position._id },
            { 
              $set: { 
                quantity: after.quantity,
                averagePrice: after.averagePrice,
                totalInvested: after.totalInvested,
                lastCalculatedAt: new Date(),
              } 
            },
            { session }
          )
        }

        // Marcar evento como aplicado
        await this.corporateEventDAO.updateStatus(event._id, 'APPLIED', {
          appliedBy: userId,
          session,
        })

        // Criar registro de auditoria
        await this.eventAuditDAO.createAuditLog({
          domain,
          eventId: event._id,
          userId,
          walletId,
          ticker: event.ticker,
          eventType: event.type,
          positionBefore: before,
          positionAfter: after,
        }, { session })

        appliedEvents.push({
          eventId: event._id,
          ticker: event.ticker,
          type: event.type,
          before,
          after,
        })

        this.logger.log('Evento aplicado com sucesso', {
          domain,
          internal: { 
            method: 'applyEvents', 
            filename: 'corporate-event-manager.js',
            eventId: event._id,
            ticker: event.ticker,
            type: event.type 
          },
        })
      }

      // Commit da transação
      await session.commitTransaction()

      this.logger.log('Todos os eventos aplicados com sucesso', {
        domain,
        internal: { 
          method: 'applyEvents', 
          filename: 'corporate-event-manager.js',
          totalEventsApplied: appliedEvents.length 
        },
      })

      return {
        appliedEvents,
        totalEventsApplied: appliedEvents.length,
      }
    } catch (error) {
      // Rollback em caso de erro
      await session.abortTransaction()

      this.logger.error('Erro ao aplicar eventos, rollback executado', error, {
        domain,
        internal: { method: 'applyEvents', filename: 'corporate-event-manager.js' },
      })

      throw error
    } finally {
      session.endSession()
    }
  }

  /**
   * Calcula nova posição baseado no tipo de evento
   * @private
   */
  _calculateNewPosition(before, event) {
    let newQuantity = before.quantity
    let newAveragePrice = before.averagePrice
    let newTotalInvested = before.totalInvested

    switch (event.type) {
      case 'SPLIT':
        // Split 1:2 (ratio=2): quantidade dobra, preço médio cai pela metade
        newQuantity = before.quantity * event.ratio
        newAveragePrice = before.averagePrice / event.ratio
        newTotalInvested = before.totalInvested // Mantém total investido
        break

      case 'BONUS':
        // Bonificação 10% (ratio=0.1): quantidade aumenta 10%, preço médio cai proporcionalmente
        newQuantity = before.quantity * (1 + event.ratio)
        newAveragePrice = before.averagePrice / (1 + event.ratio)
        newTotalInvested = before.totalInvested // Mantém total investido
        break

      case 'MERGER':
        // Fusão VIVT3->VIVT4 (ratio=0.9): quantidade reduz 10%, preço médio ajusta
        newQuantity = before.quantity * event.ratio
        newAveragePrice = before.averagePrice / event.ratio
        newTotalInvested = before.totalInvested // Mantém total investido
        break

      case 'REVERSE_SPLIT':
        // Grupamento 4:1 (ratio=4): quantidade reduz 4x, preço médio aumenta 4x
        newQuantity = before.quantity / event.ratio
        newAveragePrice = before.averagePrice * event.ratio
        newTotalInvested = before.totalInvested // Mantém total investido
        break

      default:
        throw new Error(`Tipo de evento desconhecido: ${event.type}`)
    }

    // Arredondar para 8 casas decimais para precisão
    newQuantity = Math.round(newQuantity * 100000000) / 100000000
    newAveragePrice = Math.round(newAveragePrice * 100000000) / 100000000
    newTotalInvested = Math.round(newTotalInvested * 100) / 100

    return {
      quantity: newQuantity,
      averagePrice: newAveragePrice,
      totalInvested: newTotalInvested,
    }
  }

  /**
   * Busca do cache Redis
   * @private
   */
  async _getFromCache(key) {
    // Implementar com Redis client do appManager
    // Retornar null se não existir
    return null
  }

  /**
   * Salva no cache Redis
   * @private
   */
  async _saveToCache(key, data, ttl) {
    // Implementar com Redis client do appManager
  }

  handleError(errorObj) {
    const { Exception } = require('interact-utils')
    throw new Exception(errorObj.statusCode, errorObj.message)
  }
}

module.exports = CorporateEventManager
```

### 2.4 Services

#### event-detection-service.js

```javascript
const { JsonLog } = require('json-log-middleware')
const APP_CONSTANTS = require('../app-constants')
const ProviderFactory = require('./providers/provider-factory')

class EventDetectionService {
  constructor(appManager) {
    this.appManager = appManager
    this.logger = new JsonLog(APP_CONSTANTS.SERVICE_NAME)
    this.providerFactory = new ProviderFactory()
  }

  /**
   * Detecta eventos corporativos para um ticker
   */
  async detect({ ticker, startDate, endDate }) {
    try {
      this.logger.log('Iniciando detecção de eventos', {
        internal: { 
          method: 'detect', 
          filename: 'event-detection-service.js',
          ticker,
          startDate,
          endDate 
        },
      })

      // Obter provider primário (BRAPI para ativos B3)
      const provider = this.providerFactory.getProvider(ticker, 'CORPORATE_EVENTS')

      // Buscar eventos
      let events = []
      let source = 'BRAPI'

      try {
        events = await provider.getCorporateEvents(ticker, startDate, endDate)
      } catch (primaryError) {
        this.logger.error('Provider primário falhou, tentando fallback', primaryError, {
          internal: { 
            method: 'detect', 
            filename: 'event-detection-service.js',
            provider: provider.name 
          },
        })

        // Tentar fallback (Yahoo Finance)
        const fallbackProvider = this.providerFactory.getFallbackProvider('CORPORATE_EVENTS')
        
        try {
          events = await fallbackProvider.getCorporateEvents(ticker, startDate, endDate)
          source = 'YAHOO_FINANCE'
        } catch (fallbackError) {
          this.logger.error('Fallback também falhou', fallbackError, {
            internal: { 
              method: 'detect', 
              filename: 'event-detection-service.js',
              provider: fallbackProvider.name 
            },
          })
          
          // Retornar array vazio (não bloquear importação)
          return []
        }
      }

      // Normalizar eventos
      const normalizedEvents = events.map(event => ({
        ticker: event.ticker || ticker,
        type: this._normalizeEventType(event.type),
        ratio: event.ratio,
        date: event.date,
        description: event.description || '',
        source,
        targetTicker: event.targetTicker || null,
      }))

      this.logger.log('Eventos detectados com sucesso', {
        internal: { 
          method: 'detect', 
          filename: 'event-detection-service.js',
          count: normalizedEvents.length,
          source 
        },
      })

      return normalizedEvents
    } catch (error) {
      this.logger.error('Erro ao detectar eventos', error, {
        internal: { method: 'detect', filename: 'event-detection-service.js' },
      })
      throw error
    }
  }

  /**
   * Normaliza tipo de evento para o padrão do sistema
   * @private
   */
  _normalizeEventType(type) {
    const typeMap = {
      'split': 'SPLIT',
      'Split': 'SPLIT',
      'SPLIT': 'SPLIT',
      'bonus': 'BONUS',
      'Bonus': 'BONUS',
      'BONUS': 'BONUS',
      'stock_dividend': 'BONUS',
      'merger': 'MERGER',
      'Merger': 'MERGER',
      'MERGER': 'MERGER',
      'reverse_split': 'REVERSE_SPLIT',
      'Reverse Split': 'REVERSE_SPLIT',
      'REVERSE_SPLIT': 'REVERSE_SPLIT',
      'grupamento': 'REVERSE_SPLIT',
    }

    return typeMap[type] || type
  }
}

module.exports = EventDetectionService
```

### 2.5 Providers (Strategy Pattern)

#### providers/corporate-event-provider.js (Abstract)

```javascript
/**
 * @abstract
 * Interface comum para providers de eventos corporativos
 */
class CorporateEventProvider {
  constructor(config = {}) {
    this.name = this.constructor.name
    this.baseUrl = config.baseUrl
    this.apiKey = config.apiKey
    this.timeout = config.timeout || 5000
  }

  /**
   * @abstract
   * Busca eventos corporativos de um ticker
   * @param {string} ticker - Código do ativo
   * @param {string} startDate - Data inicial (ISO string)
   * @param {string} endDate - Data final (ISO string)
   * @returns {Promise<Array>} Lista de eventos corporativos
   */
  async getCorporateEvents(ticker, startDate, endDate) {
    throw new Error('Method not implemented')
  }

  /**
   * Verifica se o provider está disponível
   */
  async isAvailable() {
    throw new Error('Method not implemented')
  }
}

module.exports = CorporateEventProvider
```

#### providers/brapi-corporate-event-provider.js

```javascript
const CorporateEventProvider = require('./corporate-event-provider')
const axios = require('axios')
const { JsonLog } = require('json-log-middleware')
const APP_CONSTANTS = require('../../app-constants')

class BrapiCorporateEventProvider extends CorporateEventProvider {
  constructor(config = {}) {
    super({
      baseUrl: config.baseUrl || 'https://brapi.dev/api',
      apiKey: config.apiKey || process.env.BRAPI_API_KEY,
      timeout: config.timeout || 5000,
      ...config,
    })
    this.logger = new JsonLog(APP_CONSTANTS.SERVICE_NAME)
  }

  async getCorporateEvents(ticker, startDate, endDate) {
    try {
      this.logger.log('Buscando eventos corporativos via BRAPI', {
        internal: { 
          method: 'getCorporateEvents', 
          filename: 'brapi-corporate-event-provider.js',
          ticker 
        },
      })

      const response = await axios.get(`${this.baseUrl}/quote/${ticker}/events`, {
        params: {
          start: startDate,
          end: endDate,
          token: this.apiKey,
        },
        timeout: this.timeout,
      })

      // Normalizar resposta da BRAPI
      const events = response.data.events || []
      
      return events.map(event => ({
        ticker: ticker.toUpperCase(),
        type: event.type,
        ratio: event.ratio,
        date: event.date,
        description: event.description || `${event.type} de ${ticker}`,
        targetTicker: event.targetTicker || null,
      }))
    } catch (error) {
      this.logger.error('Erro ao buscar eventos via BRAPI', error, {
        internal: { 
          method: 'getCorporateEvents', 
          filename: 'brapi-corporate-event-provider.js',
          ticker 
        },
      })
      throw error
    }
  }

  async isAvailable() {
    try {
      const response = await axios.get(`${this.baseUrl}/ping`, {
        timeout: 2000,
      })
      return response.status === 200
    } catch (error) {
      return false
    }
  }
}

module.exports = BrapiCorporateEventProvider
```

#### providers/yahoo-finance-corporate-event-provider.js

```javascript
const CorporateEventProvider = require('./corporate-event-provider')
const axios = require('axios')
const { JsonLog } = require('json-log-middleware')
const APP_CONSTANTS = require('../../app-constants')

class YahooFinanceCorporateEventProvider extends CorporateEventProvider {
  constructor(config = {}) {
    super({
      baseUrl: config.baseUrl || 'https://query1.finance.yahoo.com/v8/finance',
      timeout: config.timeout || 5000,
      ...config,
    })
    this.logger = new JsonLog(APP_CONSTANTS.SERVICE_NAME)
  }

  async getCorporateEvents(ticker, startDate, endDate) {
    try {
      this.logger.log('Buscando eventos corporativos via Yahoo Finance', {
        internal: { 
          method: 'getCorporateEvents', 
          filename: 'yahoo-finance-corporate-event-provider.js',
          ticker 
        },
      })

      // Yahoo Finance usa símbolo com .SA para B3
      const symbol = ticker.endsWith('.SA') ? ticker : `${ticker}.SA`
      
      const response = await axios.get(`${this.baseUrl}/chart/${symbol}`, {
        params: {
          period1: Math.floor(new Date(startDate).getTime() / 1000),
          period2: Math.floor(new Date(endDate).getTime() / 1000),
          events: 'splits,dividends',
        },
        timeout: this.timeout,
      })

      // Normalizar resposta do Yahoo Finance
      const events = []
      const chartData = response.data.chart?.result?.[0] || {}
      
      // Processar splits
      if (chartData.events?.splits) {
        Object.values(chartData.events.splits).forEach(split => {
          events.push({
            ticker: ticker.toUpperCase(),
            type: split.splitRatio > 1 ? 'SPLIT' : 'REVERSE_SPLIT',
            ratio: Math.abs(split.splitRatio),
            date: new Date(split.date * 1000).toISOString(),
            description: `Split ${split.splitRatio}`,
            targetTicker: null,
          })
        })
      }

      return events
    } catch (error) {
      this.logger.error('Erro ao buscar eventos via Yahoo Finance', error, {
        internal: { 
          method: 'getCorporateEvents', 
          filename: 'yahoo-finance-corporate-event-provider.js',
          ticker 
        },
      })
      throw error
    }
  }

  async isAvailable() {
    try {
      const response = await axios.get(`${this.baseUrl}/chart/PETR4.SA`, {
        params: { period1: Date.now() / 1000 - 86400, period2: Date.now() / 1000 },
        timeout: 2000,
      })
      return response.status === 200
    } catch (error) {
      return false
    }
  }
}

module.exports = YahooFinanceCorporateEventProvider
```

#### providers/provider-factory.js

```javascript
const BrapiCorporateEventProvider = require('./brapi-corporate-event-provider')
const YahooFinanceCorporateEventProvider = require('./yahoo-finance-corporate-event-provider')

class ProviderFactory {
  constructor() {
    this.providers = {
      BRAPI: new BrapiCorporateEventProvider(),
      YAHOO_FINANCE: new YahooFinanceCorporateEventProvider(),
    }
  }

  /**
   * Retorna o provider adequado para o tipo de ativo
   */
  getProvider(ticker, dataType) {
    // Para ativos brasileiros (B3), BRAPI é o primário
    if (this._isBrazilianTicker(ticker)) {
      return this.providers.BRAPI
    }

    // Para ativos internacionais, Yahoo Finance
    return this.providers.YAHOO_FINANCE
  }

  /**
   * Retorna provider de fallback
   */
  getFallbackProvider(dataType) {
    return this.providers.YAHOO_FINANCE
  }

  /**
   * Verifica se é um ticker brasileiro (B3)
   * @private
   */
  _isBrazilianTicker(ticker) {
    // Tickers B3 terminam com número (PETR4, VALE3, etc.)
    return /\d$/.test(ticker) || ticker.endsWith('.SA')
  }
}

module.exports = ProviderFactory
```

### 2.6 Routers

#### corporate-event-router.js

```javascript
const express = require('express')
const { Authorizer, Permissions } = require('interact-utils')

class CorporateEventRouter {
  static handleError(exception, res) {
    res.status(exception.statusCode || 500).send(exception.message || 'Server Error')
  }

  static getPublicRoutes(appManager) {
    const router = express.Router()
    const manager = appManager.getCorporateEventManager()

    /**
     * GET /api/corporate-events/:ticker
     * Busca eventos corporativos de um ticker
     * Query params: ?startDate=2020-01-01&endDate=2026-03-27&status=PENDING
     */
    router.get('/corporate-events/:ticker', 
      Authorizer.getMiddleware(Permissions.SERVICES), 
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const { ticker } = req.params
          const { startDate, endDate, status } = req.query

          const events = await manager.getPendingEvents({ 
            domain, 
            ticker,
            startDate,
            endDate,
            status,
          })

          res.status(200).send({
            events,
            totalCount: events.length,
          })
        } catch (exception) {
          CorporateEventRouter.handleError(exception, res)
        }
      }
    )

    /**
     * POST /api/corporate-events/detect
     * Dispara detecção de eventos para um ticker
     */
    router.post('/corporate-events/detect', 
      Authorizer.getMiddleware(Permissions.SERVICES), 
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const { ticker, startDate, endDate } = req.body

          const events = await manager.detectEvents({ 
            domain, 
            ticker, 
            startDate, 
            endDate 
          })

          res.status(201).send({
            events,
            detectedCount: events.length,
          })
        } catch (exception) {
          CorporateEventRouter.handleError(exception, res)
        }
      }
    )

    /**
     * GET /api/corporate-events/:ticker/preview
     * Calcula preview de impacto de um evento
     */
    router.get('/corporate-events/:ticker/preview', 
      Authorizer.getMiddleware(Permissions.SERVICES), 
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const { ticker } = req.params
          const { eventId, walletId } = req.query

          const preview = await manager.calculateEventPreview({ 
            domain, 
            eventId, 
            walletId 
          })

          res.status(200).send(preview)
        } catch (exception) {
          CorporateEventRouter.handleError(exception, res)
        }
      }
    )

    /**
     * PATCH /api/corporate-events/:eventId/approve
     * Aprova um evento individual
     */
    router.patch('/corporate-events/:eventId/approve', 
      Authorizer.getMiddleware(Permissions.SERVICES), 
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const userId = req.credentials.userId
          const { eventId } = req.params

          const event = await manager.approveEvent({ 
            domain, 
            eventId, 
            userId 
          })

          res.status(200).send({ event })
        } catch (exception) {
          CorporateEventRouter.handleError(exception, res)
        }
      }
    )

    /**
     * PATCH /api/corporate-events/:eventId/reject
     * Rejeita um evento individual
     */
    router.patch('/corporate-events/:eventId/reject', 
      Authorizer.getMiddleware(Permissions.SERVICES), 
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const userId = req.credentials.userId
          const { eventId } = req.params

          const event = await manager.rejectEvent({ 
            domain, 
            eventId, 
            userId 
          })

          res.status(200).send({ event })
        } catch (exception) {
          CorporateEventRouter.handleError(exception, res)
        }
      }
    )

    /**
     * PATCH /api/corporate-events/bulk-approve
     * Aprova múltiplos eventos em lote
     */
    router.patch('/corporate-events/bulk-approve', 
      Authorizer.getMiddleware(Permissions.SERVICES), 
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const userId = req.credentials.userId
          const { eventIds } = req.body

          const result = await manager.bulkApproveEvents({ 
            domain, 
            eventIds, 
            userId 
          })

          res.status(200).send(result)
        } catch (exception) {
          CorporateEventRouter.handleError(exception, res)
        }
      }
    )

    /**
     * POST /api/corporate-events/apply
     * Aplica eventos aprovados e recalcula posições
     */
    router.post('/corporate-events/apply', 
      Authorizer.getMiddleware(Permissions.SERVICES), 
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const userId = req.credentials.userId
          const { eventIds, walletId } = req.body

          const result = await manager.applyEvents({ 
            domain, 
            walletId, 
            eventIds, 
            userId 
          })

          res.status(200).send(result)
        } catch (exception) {
          CorporateEventRouter.handleError(exception, res)
        }
      }
    )

    return router
  }
}

module.exports = CorporateEventRouter
```

---

## 3. Componentes Frontend

### 3.1 Pages

#### CorporateEventsPage.vue

```vue
<template>
  <div class="corporate-events-page">
    <header class="page-header">
      <h1>Eventos Corporativos</h1>
      <p class="subtitle">
        Revise e aplique eventos corporativos detectados automaticamente
      </p>
    </header>

    <div class="filters">
      <TickerSelector 
        v-model="selectedTicker"
        @change="loadEvents"
      />
      <StatusFilter 
        v-model="selectedStatus"
        :options="statusOptions"
      />
    </div>

    <div v-if="loading" class="loading-container">
      <LoadingSpinner />
      <p>Carregando eventos...</p>
    </div>

    <div v-else-if="events.length === 0" class="empty-state">
      <EmptyStateIcon />
      <p>Nenhum evento corporativo encontrado</p>
    </div>

    <div v-else class="events-container">
      <EventApprovalList
        :events="events"
        :wallet-id="currentWalletId"
        @approve="handleApprove"
        @reject="handleReject"
        @bulk-approve="handleBulkApprove"
      />

      <ApplyEventsButton
        :approved-count="approvedCount"
        :loading="applying"
        @click="handleApplyEvents"
      />
    </div>

    <EventApplicationResultModal
      v-if="showResultModal"
      :result="applicationResult"
      @close="showResultModal = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import CorporateEventService from '@/services/corporate-event-service'
import EventApprovalList from '@/components/corporate-events/EventApprovalList.vue'
import ApplyEventsButton from '@/components/corporate-events/ApplyEventsButton.vue'
import EventApplicationResultModal from '@/components/corporate-events/EventApplicationResultModal.vue'

const route = useRoute()
const toast = useToast()

const events = ref([])
const loading = ref(false)
const applying = ref(false)
const selectedTicker = ref('')
const selectedStatus = ref('PENDING')
const showResultModal = ref(false)
const applicationResult = ref(null)

const currentWalletId = computed(() => route.query.walletId || localStorage.getItem('currentWalletId'))

const approvedCount = computed(() => {
  return events.value.filter(e => e.status === 'APPROVED').length
})

const statusOptions = [
  { value: 'PENDING', label: 'Pendentes' },
  { value: 'APPROVED', label: 'Aprovados' },
  { value: 'APPLIED', label: 'Aplicados' },
  { value: 'REJECTED', label: 'Rejeitados' },
]

onMounted(() => {
  loadEvents()
})

async function loadEvents() {
  loading.value = true
  try {
    const response = await CorporateEventService.getEvents({
      ticker: selectedTicker.value,
      status: selectedStatus.value,
    })
    events.value = response.events
  } catch (error) {
    toast.error('Erro ao carregar eventos corporativos')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function handleApprove(eventId) {
  try {
    await CorporateEventService.approveEvent(eventId)
    toast.success('Evento aprovado com sucesso')
    await loadEvents()
  } catch (error) {
    toast.error('Erro ao aprovar evento')
    console.error(error)
  }
}

async function handleReject(eventId) {
  try {
    await CorporateEventService.rejectEvent(eventId)
    toast.success('Evento rejeitado')
    await loadEvents()
  } catch (error) {
    toast.error('Erro ao rejeitar evento')
    console.error(error)
  }
}

async function handleBulkApprove(eventIds) {
  try {
    await CorporateEventService.bulkApprove(eventIds)
    toast.success(`${eventIds.length} eventos aprovados`)
    await loadEvents()
  } catch (error) {
    toast.error('Erro ao aprovar eventos em lote')
    console.error(error)
  }
}

async function handleApplyEvents() {
  applying.value = true
  try {
    const approvedEventIds = events.value
      .filter(e => e.status === 'APPROVED')
      .map(e => e._id)

    const result = await CorporateEventService.applyEvents({
      eventIds: approvedEventIds,
      walletId: currentWalletId.value,
    })

    applicationResult.value = result
    showResultModal.value = true
    toast.success(`${result.totalEventsApplied} eventos aplicados com sucesso`)
    await loadEvents()
  } catch (error) {
    toast.error('Erro ao aplicar eventos')
    console.error(error)
  } finally {
    applying.value = false
  }
}
</script>

<style scoped>
.corporate-events-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 2rem;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #666;
  font-size: 1rem;
}

.filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.loading-container,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.events-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
</style>
```

### 3.2 Components

#### components/corporate-events/EventApprovalList.vue

```vue
<template>
  <div class="event-approval-list">
    <div class="list-header">
      <div class="select-all">
        <input 
          type="checkbox" 
          :checked="allSelected"
          @change="toggleSelectAll"
        />
        <label>Selecionar todos</label>
      </div>
      <button 
        v-if="selectedEvents.length > 0"
        class="bulk-approve-btn"
        @click="$emit('bulk-approve', selectedEvents)"
      >
        Aprovar Selecionados ({{ selectedEvents.length }})
      </button>
    </div>

    <div class="events-list">
      <EventCard
        v-for="event in events"
        :key="event._id"
        :event="event"
        :selected="selectedEvents.includes(event._id)"
        :preview="previews[event._id]"
        @toggle-select="toggleEventSelection"
        @approve="$emit('approve', event._id)"
        @reject="$emit('reject', event._id)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import CorporateEventService from '@/services/corporate-event-service'
import EventCard from './EventCard.vue'

const props = defineProps({
  events: {
    type: Array,
    required: true,
  },
  walletId: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['approve', 'reject', 'bulk-approve'])

const selectedEvents = ref([])
const previews = ref({})
const loadingPreviews = ref(false)

const allSelected = computed(() => {
  const pendingEvents = props.events.filter(e => e.status === 'PENDING')
  return pendingEvents.length > 0 && 
         pendingEvents.every(e => selectedEvents.value.includes(e._id))
})

function toggleSelectAll() {
  const pendingEvents = props.events.filter(e => e.status === 'PENDING')
  
  if (allSelected.value) {
    selectedEvents.value = []
  } else {
    selectedEvents.value = pendingEvents.map(e => e._id)
  }
}

function toggleEventSelection(eventId) {
  const index = selectedEvents.value.indexOf(eventId)
  
  if (index > -1) {
    selectedEvents.value.splice(index, 1)
  } else {
    selectedEvents.value.push(eventId)
  }
}

async function loadPreviews() {
  loadingPreviews.value = true
  try {
    for (const event of props.events) {
      if (event.status === 'PENDING' || event.status === 'APPROVED') {
        const preview = await CorporateEventService.getEventPreview({
          eventId: event._id,
          walletId: props.walletId,
        })
        previews.value[event._id] = preview
      }
    }
  } catch (error) {
    console.error('Erro ao carregar previews:', error)
  } finally {
    loadingPreviews.value = false
  }
}

watch(() => props.events, () => {
  loadPreviews()
}, { immediate: true })
</script>

<style scoped>
.event-approval-list {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
}

.select-all {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bulk-approve-btn {
  padding: 0.5rem 1rem;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.bulk-approve-btn:hover {
  background: #45a049;
}

.events-list {
  display: flex;
  flex-direction: column;
}
</style>
```

#### components/corporate-events/EventCard.vue

```vue
<template>
  <div class="event-card" :class="`status-${event.status.toLowerCase()}`">
    <div class="event-checkbox">
      <input 
        v-if="event.status === 'PENDING'"
        type="checkbox"
        :checked="selected"
        @change="$emit('toggle-select', event._id)"
      />
      <span v-else class="status-badge">{{ statusLabel }}</span>
    </div>

    <div class="event-info">
      <div class="event-header">
        <span class="ticker">{{ event.ticker }}</span>
        <span class="event-type">{{ eventTypeLabel }}</span>
        <span class="event-date">{{ formatDate(event.date) }}</span>
      </div>

      <div class="event-details">
        <div class="detail-item">
          <span class="label">Ratio:</span>
          <span class="value">{{ event.ratio }}</span>
        </div>
        <div class="detail-item">
          <span class="label">Fonte:</span>
          <span class="value">{{ event.source }}</span>
        </div>
        <div v-if="event.description" class="detail-item full-width">
          <span class="label">Descrição:</span>
          <span class="value">{{ event.description }}</span>
        </div>
      </div>

      <EventImpactPreview
        v-if="preview && preview.before"
        :preview="preview"
        :event-type="event.type"
      />
    </div>

    <div class="event-actions">
      <button
        v-if="event.status === 'PENDING'"
        class="approve-btn"
        @click="$emit('approve', event._id)"
      >
        Aprovar
      </button>
      <button
        v-if="event.status === 'PENDING'"
        class="reject-btn"
        @click="$emit('reject', event._id)"
      >
        Rejeitar
      </button>
      <span v-if="event.status === 'APPLIED'" class="applied-info">
        Aplicado em {{ formatDate(event.appliedAt) }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import EventImpactPreview from './EventImpactPreview.vue'

const props = defineProps({
  event: {
    type: Object,
    required: true,
  },
  selected: {
    type: Boolean,
    default: false,
  },
  preview: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['toggle-select', 'approve', 'reject'])

const eventTypeLabel = computed(() => {
  const labels = {
    SPLIT: 'Split',
    BONUS: 'Bonificação',
    MERGER: 'Fusão',
    REVERSE_SPLIT: 'Grupamento',
  }
  return labels[props.event.type] || props.event.type
})

const statusLabel = computed(() => {
  const labels = {
    PENDING: 'Pendente',
    APPROVED: 'Aprovado',
    APPLIED: 'Aplicado',
    REJECTED: 'Rejeitado',
  }
  return labels[props.event.status] || props.event.status
})

function formatDate(date) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('pt-BR')
}
</script>

<style scoped>
.event-card {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.5rem;
  border-bottom: 1px solid #e0e0e0;
  transition: background-color 0.2s;
}

.event-card:hover {
  background-color: #f8f9fa;
}

.event-card.status-applied {
  opacity: 0.7;
}

.event-checkbox {
  display: flex;
  align-items: center;
  min-width: 100px;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-pending .status-badge {
  background: #fff3cd;
  color: #856404;
}

.status-approved .status-badge {
  background: #d4edda;
  color: #155724;
}

.status-applied .status-badge {
  background: #d1ecf1;
  color: #0c5460;
}

.status-rejected .status-badge {
  background: #f8d7da;
  color: #721c24;
}

.event-info {
  flex: 1;
}

.event-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.ticker {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a1a;
}

.event-type {
  padding: 0.25rem 0.5rem;
  background: #e3f2fd;
  color: #1976d2;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
}

.event-date {
  color: #666;
  font-size: 0.875rem;
}

.event-details {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}

.detail-item {
  display: flex;
  gap: 0.5rem;
}

.detail-item.full-width {
  width: 100%;
}

.label {
  color: #666;
  font-size: 0.875rem;
}

.value {
  color: #1a1a1a;
  font-size: 0.875rem;
  font-weight: 500;
}

.event-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 100px;
}

.approve-btn,
.reject-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.875rem;
}

.approve-btn {
  background: #4caf50;
  color: white;
}

.approve-btn:hover {
  background: #45a049;
}

.reject-btn {
  background: #f44336;
  color: white;
}

.reject-btn:hover {
  background: #da190b;
}

.applied-info {
  font-size: 0.75rem;
  color: #666;
  text-align: center;
}
</style>
```

#### components/corporate-events/EventImpactPreview.vue

```vue
<template>
  <div class="event-impact-preview">
    <div class="preview-header">
      <span class="preview-title">Impacto na Posição</span>
      <span class="preview-badge">{{ eventTypeLabel }}</span>
    </div>

    <div class="preview-content">
      <div class="position-column before">
        <h4>Antes</h4>
        <div class="position-data">
          <div class="data-row">
            <span class="data-label">Quantidade:</span>
            <span class="data-value">{{ formatNumber(preview.before.quantity) }}</span>
          </div>
          <div class="data-row">
            <span class="data-label">Preço Médio:</span>
            <span class="data-value">{{ formatCurrency(preview.before.averagePrice) }}</span>
          </div>
          <div class="data-row">
            <span class="data-label">Total Investido:</span>
            <span class="data-value">{{ formatCurrency(preview.before.totalInvested) }}</span>
          </div>
        </div>
      </div>

      <div class="arrow-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M5 12h14M12 5l7 7-7 7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>

      <div class="position-column after">
        <h4>Depois</h4>
        <div class="position-data">
          <div class="data-row highlight">
            <span class="data-label">Quantidade:</span>
            <span class="data-value">{{ formatNumber(preview.after.quantity) }}</span>
          </div>
          <div class="data-row highlight">
            <span class="data-label">Preço Médio:</span>
            <span class="data-value">{{ formatCurrency(preview.after.averagePrice) }}</span>
          </div>
          <div class="data-row">
            <span class="data-label">Total Investido:</span>
            <span class="data-value">{{ formatCurrency(preview.after.totalInvested) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="preview-note">
      <span class="note-icon">ℹ️</span>
      <span class="note-text">{{ impactNote }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  preview: {
    type: Object,
    required: true,
  },
  eventType: {
    type: String,
    required: true,
  },
})

const eventTypeLabel = computed(() => {
  const labels = {
    SPLIT: 'Split',
    BONUS: 'Bonificação',
    MERGER: 'Fusão',
    REVERSE_SPLIT: 'Grupamento',
  }
  return labels[props.eventType] || props.eventType
})

const impactNote = computed(() => {
  const notes = {
    SPLIT: 'Quantidade aumenta, preço médio diminui proporcionalmente. Total investido permanece igual.',
    BONUS: 'Quantidade aumenta pela bonificação, preço médio ajustado. Total investido permanece igual.',
    MERGER: 'Ticker pode mudar. Quantidade e preço médio ajustados pela razão de conversão.',
    REVERSE_SPLIT: 'Quantidade diminui, preço médio aumenta proporcionalmente. Total investido permanece igual.',
  }
  return notes[props.eventType] || ''
})

function formatNumber(value) {
  if (!value && value !== 0) return '-'
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 8 })
}

function formatCurrency(value) {
  if (!value && value !== 0) return '-'
  return value.toLocaleString('pt-BR', { 
    style: 'currency', 
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
</script>

<style scoped>
.event-impact-preview {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.preview-title {
  font-weight: 600;
  color: #1a1a1a;
}

.preview-badge {
  padding: 0.25rem 0.5rem;
  background: #e3f2fd;
  color: #1976d2;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.preview-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.position-column {
  flex: 1;
}

.position-column h4 {
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.position-data {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.data-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.data-row.highlight .data-value {
  color: #1976d2;
  font-weight: 600;
}

.data-label {
  font-size: 0.875rem;
  color: #666;
}

.data-value {
  font-size: 0.875rem;
  color: #1a1a1a;
  font-weight: 500;
}

.arrow-icon {
  color: #4caf50;
}

.preview-note {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
}

.note-icon {
  font-size: 1rem;
}

.note-text {
  font-size: 0.75rem;
  color: #666;
  line-height: 1.4;
}
</style>
```

#### components/corporate-events/EventApplicationResultModal.vue

```vue
<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Eventos Aplicados com Sucesso</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body">
        <div class="summary">
          <div class="summary-item">
            <span class="summary-label">Total de eventos aplicados:</span>
            <span class="summary-value">{{ result.totalEventsApplied }}</span>
          </div>
        </div>

        <div class="applied-events-list">
          <h3>Detalhes das Alterações</h3>
          <div 
            v-for="event in result.appliedEvents" 
            :key="event.eventId"
            class="applied-event-item"
          >
            <div class="event-summary">
              <span class="ticker">{{ event.ticker }}</span>
              <span class="event-type">{{ getEventTypeLabel(event.type) }}</span>
            </div>

            <div class="position-changes">
              <div class="change-row">
                <span class="change-label">Quantidade:</span>
                <span class="change-value">
                  {{ formatNumber(event.before.quantity) }} → {{ formatNumber(event.after.quantity) }}
                </span>
              </div>
              <div class="change-row">
                <span class="change-label">Preço Médio:</span>
                <span class="change-value">
                  {{ formatCurrency(event.before.averagePrice) }} → {{ formatCurrency(event.after.averagePrice) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="primary-btn" @click="$emit('close')">
          Fechar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  result: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['close'])

function getEventTypeLabel(type) {
  const labels = {
    SPLIT: 'Split',
    BONUS: 'Bonificação',
    MERGER: 'Fusão',
    REVERSE_SPLIT: 'Grupamento',
  }
  return labels[type] || type
}

function formatNumber(value) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 8 })
}

function formatCurrency(value) {
  return value.toLocaleString('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  })
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h2 {
  font-size: 1.5rem;
  color: #1a1a1a;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #666;
}

.modal-body {
  padding: 1.5rem;
}

.summary {
  padding: 1rem;
  background: #e8f5e9;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.summary-item {
  display: flex;
  justify-content: space-between;
}

.summary-label {
  font-weight: 500;
  color: #1a1a1a;
}

.summary-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: #2e7d32;
}

.applied-events-list h3 {
  font-size: 1rem;
  color: #666;
  margin-bottom: 1rem;
}

.applied-event-item {
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.event-summary {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.ticker {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1a1a;
}

.event-type {
  padding: 0.25rem 0.5rem;
  background: #e3f2fd;
  color: #1976d2;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.position-changes {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.change-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.change-label {
  font-size: 0.875rem;
  color: #666;
}

.change-value {
  font-size: 0.875rem;
  color: #1a1a1a;
  font-weight: 500;
}

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: flex-end;
}

.primary-btn {
  padding: 0.75rem 2rem;
  background: #1976d2;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
}

.primary-btn:hover {
  background: #1565c0;
}
</style>
```

### 3.3 Services

#### services/corporate-event-service.js

```javascript
import axios from 'axios'

const API_BASE_URL = process.env.VUE_APP_API_URL || '/api'

class CorporateEventService {
  /**
   * Busca eventos corporativos
   */
  async getEvents({ ticker, status, startDate, endDate }) {
    const params = new URLSearchParams()
    
    if (ticker) params.append('ticker', ticker)
    if (status) params.append('status', status)
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)

    const response = await axios.get(`${API_BASE_URL}/corporate-events/${ticker}?${params}`)
    return response.data
  }

  /**
   * Dispara detecção de eventos
   */
  async detectEvents({ ticker, startDate, endDate }) {
    const response = await axios.post(`${API_BASE_URL}/corporate-events/detect`, {
      ticker,
      startDate,
      endDate,
    })
    return response.data
  }

  /**
   * Busca preview de impacto
   */
  async getEventPreview({ eventId, walletId }) {
    const params = new URLSearchParams()
    params.append('eventId', eventId)
    params.append('walletId', walletId)

    const response = await axios.get(
      `${API_BASE_URL}/corporate-events/preview?${params}`
    )
    return response.data
  }

  /**
   * Aprova evento individual
   */
  async approveEvent(eventId) {
    const response = await axios.patch(
      `${API_BASE_URL}/corporate-events/${eventId}/approve`
    )
    return response.data
  }

  /**
   * Rejeita evento individual
   */
  async rejectEvent(eventId) {
    const response = await axios.patch(
      `${API_BASE_URL}/corporate-events/${eventId}/reject`
    )
    return response.data
  }

  /**
   * Aprova eventos em lote
   */
  async bulkApprove(eventIds) {
    const response = await axios.patch(
      `${API_BASE_URL}/corporate-events/bulk-approve`,
      { eventIds }
    )
    return response.data
  }

  /**
   * Aplica eventos aprovados
   */
  async applyEvents({ eventIds, walletId }) {
    const response = await axios.post(
      `${API_BASE_URL}/corporate-events/apply`,
      { eventIds, walletId }
    )
    return response.data
  }
}

export default new CorporateEventService()
```

---

## 4. API Contracts

### 4.1 Endpoints

#### GET /api/corporate-events/:ticker

**Descrição**: Busca eventos corporativos de um ticker específico

**Query Parameters**:
- `startDate` (string, opcional): Data inicial no formato ISO (ex: 2020-01-01)
- `endDate` (string, opcional): Data final no formato ISO (ex: 2026-03-27)
- `status` (string, opcional): Filtrar por status (PENDING, APPROVED, APPLIED, REJECTED)

**Response 200**:
```json
{
  "events": [
    {
      "_id": "uuid-event-1",
      "ticker": "PETR4",
      "type": "SPLIT",
      "ratio": 2,
      "date": "2020-08-18T00:00:00.000Z",
      "description": "Split 1:2",
      "source": "BRAPI",
      "status": "PENDING",
      "detectedAt": "2026-03-27T10:30:00.000Z",
      "createdAt": "2026-03-27T10:30:00.000Z",
      "updatedAt": "2026-03-27T10:30:00.000Z"
    }
  ],
  "totalCount": 1
}
```

**Error Responses**:
- `401 Unauthorized`: Token inválido ou expirado
- `500 Internal Server Error`: Erro interno do servidor

---

#### POST /api/corporate-events/detect

**Descrição**: Dispara detecção de eventos corporativos para um ticker em um período

**Request Body**:
```json
{
  "ticker": "PETR4",
  "startDate": "2020-01-01",
  "endDate": "2026-03-27"
}
```

**Response 201**:
```json
{
  "events": [
    {
      "_id": "uuid-event-1",
      "ticker": "PETR4",
      "type": "SPLIT",
      "ratio": 2,
      "date": "2020-08-18T00:00:00.000Z",
      "description": "Split 1:2",
      "source": "BRAPI",
      "status": "PENDING",
      "detectedAt": "2026-03-27T10:30:00.000Z"
    }
  ],
  "detectedCount": 1
}
```

**Error Responses**:
- `400 Bad Request`: Parâmetros inválidos
- `401 Unauthorized`: Token inválido ou expirado
- `503 Service Unavailable`: APIs externas indisponíveis

---

#### GET /api/corporate-events/:ticker/preview

**Descrição**: Calcula preview de impacto de um evento na posição

**Query Parameters**:
- `eventId` (string, obrigatório): ID do evento
- `walletId` (string, obrigatório): ID da carteira

**Response 200**:
```json
{
  "event": {
    "_id": "uuid-event-1",
    "ticker": "PETR4",
    "type": "SPLIT",
    "ratio": 2,
    "date": "2020-08-18T00:00:00.000Z"
  },
  "before": {
    "quantity": 100,
    "averagePrice": 40.00,
    "totalInvested": 4000.00
  },
  "after": {
    "quantity": 200,
    "averagePrice": 20.00,
    "totalInvested": 4000.00
  }
}
```

**Error Responses**:
- `404 Not Found`: Evento ou posição não encontrados
- `401 Unauthorized`: Token inválido ou expirado

---

#### PATCH /api/corporate-events/:eventId/approve

**Descrição**: Aprova um evento individual

**Path Parameters**:
- `eventId` (string, obrigatório): ID do evento

**Response 200**:
```json
{
  "event": {
    "_id": "uuid-event-1",
    "ticker": "PETR4",
    "type": "SPLIT",
    "status": "APPROVED",
    "updatedAt": "2026-03-27T11:00:00.000Z"
  }
}
```

**Error Responses**:
- `404 Not Found`: Evento não encontrado
- `409 Conflict`: Evento já aplicado
- `401 Unauthorized`: Token inválido ou expirado

---

#### PATCH /api/corporate-events/:eventId/reject

**Descrição**: Rejeita um evento individual

**Path Parameters**:
- `eventId` (string, obrigatório): ID do evento

**Response 200**:
```json
{
  "event": {
    "_id": "uuid-event-1",
    "ticker": "PETR4",
    "type": "SPLIT",
    "status": "REJECTED",
    "updatedAt": "2026-03-27T11:00:00.000Z"
  }
}
```

**Error Responses**:
- `404 Not Found`: Evento não encontrado
- `409 Conflict`: Evento já aplicado
- `401 Unauthorized`: Token inválido ou expirado

---

#### PATCH /api/corporate-events/bulk-approve

**Descrição**: Aprova múltiplos eventos em lote

**Request Body**:
```json
{
  "eventIds": ["uuid-event-1", "uuid-event-2", "uuid-event-3"]
}
```

**Response 200**:
```json
{
  "updatedCount": 3
}
```

**Error Responses**:
- `400 Bad Request`: Lista de IDs vazia ou inválida
- `404 Not Found`: Um ou mais eventos não encontrados
- `409 Conflict`: Um ou mais eventos já aplicados
- `401 Unauthorized`: Token inválido ou expirado

---

#### POST /api/corporate-events/apply

**Descrição**: Aplica eventos aprovados e recalcula posições

**Request Body**:
```json
{
  "eventIds": ["uuid-event-1", "uuid-event-2"],
  "walletId": "uuid-wallet-1"
}
```

**Response 200**:
```json
{
  "appliedEvents": [
    {
      "eventId": "uuid-event-1",
      "ticker": "PETR4",
      "type": "SPLIT",
      "before": {
        "quantity": 100,
        "averagePrice": 40.00,
        "totalInvested": 4000.00
      },
      "after": {
        "quantity": 200,
        "averagePrice": 20.00,
        "totalInvested": 4000.00
      }
    },
    {
      "eventId": "uuid-event-2",
      "ticker": "ITUB4",
      "type": "BONUS",
      "before": {
        "quantity": 200,
        "averagePrice": 30.00,
        "totalInvested": 6000.00
      },
      "after": {
        "quantity": 220,
        "averagePrice": 27.27,
        "totalInvested": 6000.00
      }
    }
  ],
  "totalEventsApplied": 2
}
```

**Error Responses**:
- `400 Bad Request`: Parâmetros inválidos
- `404 Not Found`: Nenhum evento aprovado encontrado
- `409 Conflict`: Um ou mais eventos já aplicados
- `500 Internal Server Error`: Erro durante aplicação (rollback executado)
- `401 Unauthorized`: Token inválido ou expirado

---

## 5. Fluxos de Dados

### 5.1 Fluxo de Detecção de Eventos

```
1. Trigger: Importação de transação com data retroativa
   ↓
2. TransactionManager.afterImport()
   ↓
3. EventDetectionService.detect()
   ↓
4. Verificar cache Redis (TTL: 24h)
   - Cache HIT: Retornar eventos do cache
   - Cache MISS: Continuar
   ↓
5. ProviderFactory.getProvider(ticker)
   - Ticker B3 (termina com número): BrapiProvider
   - Ticker internacional: YahooFinanceProvider
   ↓
6. BrapiProvider.getCorporateEvents()
   - Sucesso: Retornar eventos
   - Falha: Tentar fallback
   ↓
7. YahooFinanceProvider.getCorporateEvents() (fallback)
   - Sucesso: Retornar eventos
   - Falha: Retornar array vazio
   ↓
8. Normalizar eventos (tipo, ratio, data)
   ↓
9. CorporateEventDAO.create() (evitar duplicatas)
   - Verificar índice único (ticker + date + type)
   - Salvar com status: PENDING
   ↓
10. Atualizar lastCheckedAt
   ↓
11. Salvar no cache Redis (TTL: 24h)
   ↓
12. Notificar usuário (WebSocket/Email)
```

### 5.2 Fluxo de Aprovação de Eventos

```
1. Usuário acessa página de eventos pendentes
   ↓
2. Frontend: GET /api/corporate-events/:ticker?status=PENDING
   ↓
3. CorporateEventManager.getPendingEvents()
   ↓
4. Para cada evento:
   a. GET /api/corporate-events/:ticker/preview?eventId=xxx&walletId=yyy
   b. CorporateEventManager.calculateEventPreview()
   c. Buscar posição atual (PositionDAO)
   d. Calcular impacto (fórmulas por tipo)
   e. Retornar preview (before/after)
   ↓
5. Usuário visualiza eventos com previews
   ↓
6. Usuário seleciona eventos para aprovar/rejeitar
   ↓
7. Frontend: PATCH /api/corporate-events/:eventId/approve
   ou PATCH /api/corporate-events/:eventId/reject
   ou PATCH /api/corporate-events/bulk-approve
   ↓
8. CorporateEventManager.approveEvent() / rejectEvent() / bulkApproveEvents()
   ↓
9. Validar status (não pode aprovar evento já aplicado)
   ↓
10. CorporateEventDAO.updateStatus() / bulkUpdateStatus()
   ↓
11. Retornar evento atualizado
```

### 5.3 Fluxo de Aplicação de Eventos

```
1. Usuário clica em "Aplicar Eventos Aprovados"
   ↓
2. Frontend: POST /api/corporate-events/apply
   Body: { eventIds: [...], walletId: "..." }
   ↓
3. CorporateEventManager.applyEvents()
   ↓
4. Iniciar sessão MongoDB (startSession)
   ↓
5. Iniciar transação (startTransaction)
   ↓
6. Buscar eventos com status APPROVED
   ↓
7. ORDENAR EVENTOS POR DATA (CRÍTICO!)
   - Eventos devem ser aplicados cronologicamente
   - Split + Bonus em ordem errada = resultado incorreto
   ↓
8. Para cada evento (em ordem cronológica):
   a. Buscar posição atual (PositionDAO)
   b. Calcular nova quantidade e preço médio
      - SPLIT: qty * ratio, price / ratio
      - BONUS: qty * (1 + ratio), price / (1 + ratio)
      - MERGER: qty * ratio, price / ratio (criar nova posição)
      - REVERSE_SPLIT: qty / ratio, price * ratio
   c. Atualizar posição (PositionDAO.updateOne)
   d. Se MERGER:
      - Criar nova posição no ticker destino
      - Zerar posição no ticker origem
   e. Marcar evento como APPLIED (CorporateEventDAO.updateStatus)
   f. Criar registro de auditoria (EventApplicationAuditDAO.createAuditLog)
   ↓
9. Validar consistência (opcional)
   ↓
10. Se sucesso: commit()
    Se erro: abort() (rollback completo)
    ↓
11. Encerrar sessão (endSession)
    ↓
12. Retornar resultado com detalhes de cada aplicação
```

---

## 6. Estrutura de Arquivos

### Backend

```
src/
├── app/
│   ├── corporate-event/
│   │   ├── corporate-event-model.js
│   │   ├── corporate-event-dao.js
│   │   ├── corporate-event-manager.js
│   │   ├── corporate-event-router.js
│   │   ├── event-detection-service.js
│   │   ├── event-application-audit-model.js
│   │   ├── event-application-audit-dao.js
│   │   └── providers/
│   │       ├── corporate-event-provider.js (abstract)
│   │       ├── brapi-corporate-event-provider.js
│   │       ├── yahoo-finance-corporate-event-provider.js
│   │       └── provider-factory.js
│   ├── position/
│   │   ├── position-model.js (atualizar)
│   │   ├── position-dao.js (atualizar)
│   │   └── position-manager.js (atualizar)
│   ├── transaction/
│   │   └── transaction-manager.js (atualizar - trigger detecção)
│   └── app-constants.js (atualizar - novos erros)
├── __tests__/
│   ├── corporate-event/
│   │   ├── corporate-event-manager.test.js
│   │   ├── event-detection-service.test.js
│   │   ├── brapi-provider.test.js
│   │   ├── yahoo-finance-provider.test.js
│   │   └── event-application.test.js
│   └── integration/
│       └── corporate-event-flow.test.js
└── docs/
    └── swagger/
        └── corporate-events.yaml
```

### Frontend

```
src/
├── pages/
│   └── corporate-events/
│       └── CorporateEventsPage.vue
├── components/
│   └── corporate-events/
│       ├── EventApprovalList.vue
│       ├── EventCard.vue
│       ├── EventImpactPreview.vue
│       ├── EventApplicationResultModal.vue
│       └── ApplyEventsButton.vue
├── services/
│   └── corporate-event-service.js
├── stores/
│   └── corporate-event-store.js (Pinia)
└── __tests__/
    └── corporate-events/
        ├── CorporateEventsPage.test.js
        ├── EventCard.test.js
        └── EventImpactPreview.test.js
```

---

## 7. Ordem de Implementação

### Fase 1: Backend - Detecção (EP10-001)

**Prioridade**: Must Have | **Estimativa**: 8 story points

1. **Model e DAO** (2 dias)
   - Criar `corporate-event-model.js`
   - Criar `event-application-audit-model.js`
   - Criar `corporate-event-dao.js`
   - Criar `event-application-audit-dao.js`
   - Atualizar `app-constants.js` com novos erros

2. **Providers** (3 dias)
   - Criar `corporate-event-provider.js` (abstract)
   - Criar `brapi-corporate-event-provider.js`
   - Criar `yahoo-finance-corporate-event-provider.js`
   - Criar `provider-factory.js`

3. **Service e Manager** (2 dias)
   - Criar `event-detection-service.js`
   - Criar `corporate-event-manager.js` (métodos de detecção)
   - Implementar cache Redis

4. **Router** (1 dia)
   - Criar `corporate-event-router.js`
   - Implementar GET /corporate-events/:ticker
   - Implementar POST /corporate-events/detect

5. **Testes** (2 dias)
   - Testes unitários para providers
   - Testes unitários para detection service
   - Testes de integração para detecção

**Total**: 10 dias úteis

---

### Fase 2: Backend - Aprovação (EP10-002)

**Prioridade**: Must Have | **Estimativa**: 5 story points

1. **Manager - Métodos de Aprovação** (2 dias)
   - Implementar `calculateEventPreview()`
   - Implementar `approveEvent()`
   - Implementar `rejectEvent()`
   - Implementar `bulkApproveEvents()`

2. **Router - Endpoints de Aprovação** (1 dia)
   - Implementar GET /corporate-events/:ticker/preview
   - Implementar PATCH /corporate-events/:eventId/approve
   - Implementar PATCH /corporate-events/:eventId/reject
   - Implementar PATCH /corporate-events/bulk-approve

3. **Testes** (2 dias)
   - Testes unitários para preview
   - Testes unitários para aprovação
   - Testes de integração para fluxo de aprovação

**Total**: 5 dias úteis

---

### Fase 3: Backend - Aplicação (EP10-003)

**Prioridade**: Must Have | **Estimativa**: 13 story points

1. **Manager - Método de Aplicação** (4 dias)
   - Implementar `applyEvents()` com transação atômica
   - Implementar cálculo de nova posição por tipo de evento
   - Implementar tratamento especial para MERGER
   - Implementar criação de registro de auditoria
   - Implementar rollback em caso de erro

2. **Router - Endpoint de Aplicação** (1 dia)
   - Implementar POST /corporate-events/apply

3. **Integração com Position** (2 dias)
   - Atualizar `position-dao.js` com métodos necessários
   - Atualizar `position-manager.js` se necessário

4. **Testes** (3 dias)
   - Testes unitários para cálculo de nova posição
   - Testes unitários para aplicação de eventos
   - Testes de rollback atômico
   - Testes de integração para fluxo completo
   - Testes de cenários complexos (múltiplos eventos, MERGER)

**Total**: 10 dias úteis

---

### Fase 4: Frontend (EP10-002 e EP10-003)

**Prioridade**: Must Have | **Estimativa**: 8 story points

1. **Service e Store** (1 dia)
   - Criar `corporate-event-service.js`
   - Criar `corporate-event-store.js` (Pinia)

2. **Componentes Base** (2 dias)
   - Criar `EventCard.vue`
   - Criar `EventImpactPreview.vue`
   - Criar `EventApprovalList.vue`

3. **Página Principal** (2 dias)
   - Criar `CorporateEventsPage.vue`
   - Integrar componentes
   - Implementar filtros e busca

4. **Modal de Resultado** (1 dia)
   - Criar `EventApplicationResultModal.vue`

5. **Testes** (2 dias)
   - Testes unitários para componentes
   - Testes de integração para página

**Total**: 8 dias úteis

---

### Fase 5: Integração e QA

**Prioridade**: Must Have | **Estimativa**: 5 story points

1. **Integração com Transaction Import** (2 dias)
   - Atualizar `transaction-manager.js` para disparar detecção
   - Implementar trigger assíncrono após importação

2. **Documentação** (1 dia)
   - Atualizar Swagger com novos endpoints
   - Criar documentação de usuário

3. **QA e Validação** (2 dias)
   - Testes manuais de fluxo completo
   - Validação de cenários de erro
   - Performance testing

**Total**: 5 dias úteis

---

## 8. Riscos Técnicos

### 8.1 Riscos Críticos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| **APIs externas não retornam todos os eventos** | Média | Alto | - Implementar múltiplas fontes (BRAPI + Yahoo Finance)<br>- Permitir cadastro manual de eventos<br>- Logar eventos não detectados para análise |
| **Eventos aplicados fora de ordem geram posição incorreta** | Baixa | Crítico | - Ordenação cronológica OBRIGATÓRIA antes da aplicação<br>- Validação de ordem no manager<br>- Testes extensivos para cenários de múltiplos eventos |
| **Falha parcial na aplicação de múltiplos eventos** | Média | Crítico | - Transação atômica com MongoDB sessions<br>- Rollback automático em caso de erro<br>- Testes de rollback |
| **Precisão de casas decimais em cálculos** | Média | Alto | - Usar arredondamento para 8 casas decimais internamente<br>- Exibir com 2 casas para usuário<br>- Testes com valores extremos |
| **MERGER com ticker que já possui posição** | Baixa | Alto | - Consolidar posições do mesmo ticker (soma ponderada)<br>- Validar antes de aplicar<br>- Logar warning para revisão manual |

### 8.2 Riscos Moderados

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| **Cache Redis expira antes da aplicação** | Baixa | Médio | - Revalidar eventos antes de aplicar<br>- TTL de 24h é suficiente para maioria dos casos |
| **Rate limit das APIs externas** | Média | Médio | - Implementar retry com backoff exponencial<br>- Respeitar rate limits configurados<br>- Usar cache para reduzir chamadas |
| **Usuário rejeita evento correto** | Média | Baixo | - Permitir reverter rejeição<br>- Logar rejeições para análise<br>- Não bloquear fluxo |
| **Performance de detecção para muitos tickers** | Baixa | Médio | - Processar em background (fila)<br>- Cache agressivo<br>- Batch processing |

### 8.3 Riscos Baixos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| **Mudança de schema das APIs externas** | Baixa | Médio | - Monitorar logs de erro<br>- Versionar providers<br>- Fallback para outras fontes |
| **Conflito de merge em posições** | Baixa | Baixo | - Usar transação atômica<br>- Validar consistência pós-aplicação |

---

## 9. Dependências

### 9.1 Dependências de Épicos

| Épico | Dependência | Status | Impacto |
|-------|------------|--------|---------|
| **EP01 - Arquitetura** | Redis para cache | ✅ Implementado | Crítico - Cache de eventos |
| **EP04 - Transações** | Modelo de transação | ✅ Implementado | Crítico - Trigger de detecção |
| **EP05 - Preço Médio** | Lógica de cálculo | ✅ Implementado | Crítico - Recálculo de posições |
| **EP13 - Fontes de Dados** | Providers de API | ⚠️ Em desenvolvimento | Crítico - Detecção de eventos |
| **EP25 - Auditoria** | Logs de auditoria | ⚠️ Planejado | Alto - Registro de aplicações |

### 9.2 Dependências de Bibliotecas

| Biblioteca | Versão | Propósito | Status |
|-----------|--------|-----------|--------|
| `mongoose` | ^6.0.0 | ODM MongoDB | ✅ Instalado |
| `axios` | ^1.0.0 | HTTP client | ✅ Instalado |
| `json-log-middleware` | ^1.0.0 | Logging estruturado | ✅ Instalado |
| `interact-utils` | ^1.0.0 | Utilitários (Exception, Authorizer) | ✅ Instalado |
| `uuid` | ^9.0.0 | Geração de UUIDs | ✅ Instalado |
| `redis` | ^4.0.0 | Cliente Redis | ✅ Instalado |

### 9.3 Dependências de Infraestrutura

| Componente | Requisito | Status |
|-----------|----------|--------|
| MongoDB | >= 4.0 (suporte a sessions) | ✅ Disponível |
| Redis | >= 6.0 | ✅ Disponível |
| Node.js | >= 16.0 | ✅ Disponível |

---

## 10. Checklist de Implementação

### 10.1 Backend - EP10-001 (Detecção)

#### Model e DAO
- [ ] Criar `corporate-event-model.js` com schema completo
- [ ] Criar índices compostos (ticker + date + type)
- [ ] Criar `event-application-audit-model.js`
- [ ] Criar `corporate-event-dao.js` com todos os métodos
- [ ] Criar `event-application-audit-dao.js`
- [ ] Atualizar `app-constants.js` com novos erros:
  - EVENT_NOT_FOUND
  - EVENT_ALREADY_APPLIED
  - NO_APPROVED_EVENTS
  - SOME_EVENTS_NOT_FOUND
  - SOME_EVENTS_ALREADY_APPLIED

#### Providers
- [ ] Criar `corporate-event-provider.js` (classe abstrata)
- [ ] Criar `brapi-corporate-event-provider.js`
  - [ ] Implementar `getCorporateEvents()`
  - [ ] Implementar `isAvailable()`
  - [ ] Normalizar resposta da BRAPI
- [ ] Criar `yahoo-finance-corporate-event-provider.js`
  - [ ] Implementar `getCorporateEvents()`
  - [ ] Implementar `isAvailable()`
  - [ ] Normalizar resposta do Yahoo Finance
  - [ ] Adicionar sufixo .SA para tickers B3
- [ ] Criar `provider-factory.js`
  - [ ] Implementar seleção de provider por tipo de ticker
  - [ ] Implementar fallback chain

#### Service e Manager
- [ ] Criar `event-detection-service.js`
  - [ ] Implementar `detect()`
  - [ ] Implementar normalização de tipos de evento
  - [ ] Implementar fallback automático
- [ ] Criar `corporate-event-manager.js`
  - [ ] Implementar `detectEvents()`
  - [ ] Implementar verificação de cache Redis
  - [ ] Implementar salvamento no cache
  - [ ] Implementar prevenção de duplicatas
- [ ] Implementar cache Redis (TTL: 24h)

#### Router
- [ ] Criar `corporate-event-router.js`
- [ ] Implementar GET /api/corporate-events/:ticker
- [ ] Implementar POST /api/corporate-events/detect
- [ ] Adicionar middleware de autenticação

#### Testes
- [ ] Testes unitários para `BrapiCorporateEventProvider`
- [ ] Testes unitários para `YahooFinanceCorporateEventProvider`
- [ ] Testes unitários para `EventDetectionService`
- [ ] Testes unitários para `CorporateEventManager.detectEvents()`
- [ ] Testes de integração para detecção via API mock
- [ ] Teste de cenário: API primária timeout → fallback
- [ ] Teste de cenário: Ambas APIs indisponíveis
- [ ] Teste de cenário: Evento duplicado não é criado
- [ ] Cobertura de testes >= 90%

---

### 10.2 Backend - EP10-002 (Aprovação)

#### Manager - Métodos de Aprovação
- [ ] Implementar `getPendingEvents()`
- [ ] Implementar `calculateEventPreview()`
  - [ ] Buscar posição atual
  - [ ] Calcular impacto por tipo de evento
  - [ ] Retornar before/after
- [ ] Implementar `approveEvent()`
  - [ ] Validar status do evento
  - [ ] Atualizar para APPROVED
- [ ] Implementar `rejectEvent()`
  - [ ] Validar status do evento
  - [ ] Atualizar para REJECTED
- [ ] Implementar `bulkApproveEvents()`
  - [ ] Validar todos os eventos
  - [ ] Atualizar em lote

#### Router - Endpoints de Aprovação
- [ ] Implementar GET /api/corporate-events/:ticker/preview
- [ ] Implementar PATCH /api/corporate-events/:eventId/approve
- [ ] Implementar PATCH /api/corporate-events/:eventId/reject
- [ ] Implementar PATCH /api/corporate-events/bulk-approve

#### Testes
- [ ] Testes unitários para `calculateEventPreview()`
  - [ ] Teste preview de SPLIT
  - [ ] Teste preview de BONUS
  - [ ] Teste preview de MERGER
  - [ ] Teste preview de REVERSE_SPLIT
- [ ] Testes unitários para `approveEvent()`
- [ ] Testes unitários para `rejectEvent()`
- [ ] Testes unitários para `bulkApproveEvents()`
- [ ] Teste de cenário: Aprovar evento já aplicado → erro 409
- [ ] Teste de cenário: Aprovação em lote com evento já aplicado → erro
- [ ] Cobertura de testes >= 90%

---

### 10.3 Backend - EP10-003 (Aplicação)

#### Manager - Método de Aplicação
- [ ] Implementar `applyEvents()`
  - [ ] Iniciar sessão MongoDB
  - [ ] Iniciar transação
  - [ ] Buscar eventos APPROVED
  - [ ] **ORDENAR POR DATA (CRÍTICO!)**
  - [ ] Para cada evento:
    - [ ] Buscar posição atual
    - [ ] Calcular nova quantidade e preço médio
    - [ ] Atualizar posição
    - [ ] Se MERGER: criar nova posição
    - [ ] Marcar evento como APPLIED
    - [ ] Criar registro de auditoria
  - [ ] Commit ou rollback
  - [ ] Encerrar sessão
- [ ] Implementar `_calculateNewPosition()`
  - [ ] Fórmula para SPLIT
  - [ ] Fórmula para BONUS
  - [ ] Fórmula para MERGER
  - [ ] Fórmula para REVERSE_SPLIT
  - [ ] Arredondamento para 8 casas decimais

#### Router - Endpoint de Aplicação
- [ ] Implementar POST /api/corporate-events/apply

#### Integração com Position
- [ ] Atualizar `position-dao.js` com métodos necessários
- [ ] Atualizar `position-manager.js` se necessário

#### Testes
- [ ] Testes unitários para `_calculateNewPosition()`
  - [ ] Teste SPLIT com ratio 2
  - [ ] Teste BONUS com ratio 0.1
  - [ ] Teste MERGER com ratio 0.9
  - [ ] Teste REVERSE_SPLIT com ratio 4
- [ ] Testes unitários para `applyEvents()`
  - [ ] Teste aplicação de evento único
  - [ ] Teste aplicação de múltiplos eventos em ordem
  - [ ] Teste aplicação de eventos fora de ordem (sistema reordena)
- [ ] Testes de rollback atômico
  - [ ] Teste falha no 2º evento de 3 → rollback completo
  - [ ] Teste nenhuma posição alterada após rollback
- [ ] Testes de MERGER
  - [ ] Teste criação de nova posição
  - [ ] Teste zerar posição antiga
  - [ ] Teste MERGER com ticker que já possui posição
- [ ] Testes de auditoria
  - [ ] Teste registro de auditoria criado
  - [ ] Teste snapshot antes/depois correto
- [ ] Teste de cenário: Aplicar evento já aplicado → erro 409
- [ ] Cobertura de testes >= 90%

---

### 10.4 Frontend

#### Service e Store
- [ ] Criar `corporate-event-service.js`
  - [ ] Implementar `getEvents()`
  - [ ] Implementar `detectEvents()`
  - [ ] Implementar `getEventPreview()`
  - [ ] Implementar `approveEvent()`
  - [ ] Implementar `rejectEvent()`
  - [ ] Implementar `bulkApprove()`
  - [ ] Implementar `applyEvents()`
- [ ] Criar `corporate-event-store.js` (Pinia)

#### Componentes
- [ ] Criar `EventCard.vue`
  - [ ] Exibir dados do evento
  - [ ] Exibir status com badge
  - [ ] Botões de aprovar/rejeitar
  - [ ] Checkbox para seleção
- [ ] Criar `EventImpactPreview.vue`
  - [ ] Exibir posição antes
  - [ ] Exibir posição depois
  - [ ] Exibir nota explicativa por tipo
  - [ ] Formatação de números e moedas
- [ ] Criar `EventApprovalList.vue`
  - [ ] Lista de eventos com checkbox
  - [ ] Selecionar todos
  - [ ] Aprovação em lote
  - [ ] Loading states
- [ ] Criar `EventApplicationResultModal.vue`
  - [ ] Exibir resumo de eventos aplicados
  - [ ] Exibir detalhes de cada alteração
  - [ ] Botão de fechar
- [ ] Criar `ApplyEventsButton.vue`
  - [ ] Contador de eventos aprovados
  - [ ] Loading state durante aplicação
  - [ ] Confirmação antes de aplicar

#### Página Principal
- [ ] Criar `CorporateEventsPage.vue`
  - [ ] Header com título e descrição
  - [ ] Filtros (ticker, status)
  - [ ] Lista de eventos
  - [ ] Botão de aplicar eventos
  - [ ] Modal de resultado
  - [ ] Empty state
  - [ ] Loading state

#### Testes
- [ ] Testes unitários para `EventCard.vue`
- [ ] Testes unitários para `EventImpactPreview.vue`
- [ ] Testes unitários para `EventApprovalList.vue`
- [ ] Testes unitários para `CorporateEventsPage.vue`
- [ ] Testes de integração para fluxo completo

---

### 10.5 Integração e QA

#### Integração com Transaction Import
- [ ] Atualizar `transaction-manager.js`
  - [ ] Adicionar trigger após importação de transação
  - [ ] Disparar detecção assíncrona
  - [ ] Passar data da transação como startDate
- [ ] Implementar fila de detecção (opcional)
- [ ] Testar detecção automática após importação

#### Documentação
- [ ] Atualizar Swagger com novos endpoints
  - [ ] GET /api/corporate-events/:ticker
  - [ ] POST /api/corporate-events/detect
  - [ ] GET /api/corporate-events/:ticker/preview
  - [ ] PATCH /api/corporate-events/:eventId/approve
  - [ ] PATCH /api/corporate-events/:eventId/reject
  - [ ] PATCH /api/corporate-events/bulk-approve
  - [ ] POST /api/corporate-events/apply
- [ ] Criar documentação de usuário
  - [ ] Como revisar eventos pendentes
  - [ ] Como aprovar/rejeitar eventos
  - [ ] Como aplicar eventos
  - [ ] O que acontece após aplicação

#### QA e Validação
- [ ] Teste manual: Detecção de eventos para PETR4
- [ ] Teste manual: Detecção de eventos para VALE3
- [ ] Teste manual: Aprovação individual
- [ ] Teste manual: Aprovação em lote
- [ ] Teste manual: Aplicação de evento único
- [ ] Teste manual: Aplicação de múltiplos eventos
- [ ] Teste manual: Rollback em caso de erro
- [ ] Teste manual: MERGER com criação de nova posição
- [ ] Validação de cenários de erro
- [ ] Performance testing (detecção de 100+ tickers)
- [ ] Validação de UX (frontend)

---

### 10.6 Code Review e Merge

- [ ] Code review por @code-reviewer
  - [ ] Backend: Model e DAO
  - [ ] Backend: Providers
  - [ ] Backend: Manager
  - [ ] Backend: Router
  - [ ] Frontend: Service
  - [ ] Frontend: Components
  - [ ] Frontend: Page
- [ ] Corrigir issues apontados no code review
- [ ] Criar PR por @merge-request
- [ ] Merge para branch de desenvolvimento
- [ ] Deploy em ambiente de staging
- [ ] Validação final em staging
- [ ] Merge para main
- [ ] Deploy em produção

---

## 11. Considerações Finais

### 11.1 Pontos Críticos de Atenção

1. **Ordenação Cronológica**: A aplicação de eventos DEVE ser feita em ordem cronológica. Um split seguido de uma bonificação gera resultado diferente se aplicados fora de ordem.

2. **Transação Atômica**: A aplicação de múltiplos eventos deve ser atômica. Se um evento falhar, nenhum deve ser persistido (rollback completo).

3. **Precisão Decimal**: Usar 8 casas decimais internamente para evitar erros de arredondamento, mas exibir 2 casas para o usuário.

4. **Tratamento de MERGER**: Fusões são o caso mais complexo, pois envolvem criação de nova posição e possível consolidação com posição existente.

5. **Cache Inteligente**: O cache Redis é essencial para performance, mas deve ter TTL adequado (24h) e ser invalidado quando necessário.

### 11.2 Melhorias Futuras

1. **Detecção Proativa**: Implementar scheduler que detecta eventos para todos os tickers em carteira periodicamente (não apenas após importação).

2. **Notificações**: Enviar notificação por email/push quando novos eventos forem detectados.

3. **Histórico Visual**: Criar timeline visual de eventos aplicados para cada ativo.

4. **Importação de Eventos**: Permitir que o usuário importe eventos de fontes externas (arquivo CSV).

5. **Machine Learning**: Usar ML para detectar anomalias em eventos (ex: ratio muito diferente do esperado).

### 11.3 Métricas de Sucesso

- **Detecção**: 100% dos eventos detectados para ativos da B3 nos últimos 5 anos
- **Precisão**: Recálculo de posição com precisão de 2 casas decimais
- **Performance**: Tempo de detecção < 5s por ticker
- **Disponibilidade**: Fallback automático garante disponibilidade mesmo com falha de APIs
- **Auditabilidade**: 100% das aplicações registradas em auditoria

---

**Documento criado por**: Architect Agent  
**Data**: 2026-03-27  
**Versão**: 1.0  
**Status**: Ready for Tech Lead

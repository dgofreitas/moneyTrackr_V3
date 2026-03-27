# Plano Técnico - EP06: Câmbio

> **Épico**: 06 - Câmbio: Conversão Cambial para Ativos Internacionais
> **Versão**: 1.0
> **Data**: 2026-03-27
> **Autor**: @architect

---

## 1. Visão Geral da Arquitetura

### 1.1 Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    FRONTEND (PWA)                                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────────────┐ │
│  │ CurrencyBadge   │  │ CurrencyToggle  │  │ ExchangeRateDisplay                 │ │
│  │ (Indicador USD)  │  │ (BRL/Original)  │  │ (Taxa atual + horário)              │ │
│  └────────┬────────┘  └────────┬────────┘  └──────────────────┬──────────────────┘ │
│           │                    │                               │                    │
│           └────────────────────┼───────────────────────────────┘                    │
│                                │                                                    │
│                    ┌───────────▼───────────┐                                       │
│                    │  useExchangeRate      │                                       │
│                    │  (Composable/Hook)    │                                       │
│                    └───────────┬───────────┘                                       │
│                                │                                                    │
│                    ┌───────────▼───────────┐                                       │
│                    │  Store (Pinia/Vuex)    │                                       │
│                    │  - currentRates        │                                       │
│                    │  - displayMode         │                                       │
│                    └───────────┬───────────┘                                       │
└────────────────────────────────┼────────────────────────────────────────────────────┘
                                 │ HTTP/REST
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    BACKEND (Node.js)                                │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                              ROUTER LAYER                                    │   │
│  │  ExchangeRateRouter                                                          │   │
│  │  - GET /v1/public/exchange-rates/current?from=USD&to=BRL                    │   │
│  │  - GET /v1/public/exchange-rates/history?from=USD&to=BRL&startDate=&endDate=│   │
│  └─────────────────────────────────────┬───────────────────────────────────────┘   │
│                                        │                                            │
│  ┌─────────────────────────────────────▼───────────────────────────────────────┐   │
│  │                              MANAGER LAYER                                   │   │
│  │  ExchangeRateManager                                                         │   │
│  │  - getCurrentRate(from, to)         → Cache-aside pattern                    │   │
│  │  - getHistoricalRates(from, to, dates)                                       │   │
│  │  - convertToBRL(amount, currency, date)                                      │   │
│  └──────────┬────────────────────────────────────────────────────────┬──────────┘   │
│             │                                                        │              │
│  ┌──────────▼──────────┐                    ┌────────────────────────▼──────────┐   │
│  │    DAO LAYER        │                    │         SERVICE LAYER              │   │
│  │  ExchangeRateDAO    │                    │    ExchangeRateService             │   │
│  │  - findByPairAndDate│                    │  - fetchCurrentRate()             │   │
│  │  - findByPairAndRange                   │  - fetchHistoricalRates()          │   │
│  │  - findLatestByPair │                    │  - fetchFromFallback()            │   │
│  │  - upsertRate       │                    │                                    │   │
│  └──────────┬──────────┘                    └────────────────┬──────────────────┘   │
│             │                                                │                      │
│             │                                                │                      │
│  ┌──────────▼──────────┐                    ┌─────────────────▼──────────────────┐   │
│  │    MODEL LAYER      │                    │         EXTERNAL APIs              │   │
│  │  ExchangeRate       │                    │  ┌─────────────────────────────┐   │   │
│  │  (Mongoose Schema)  │                    │  │ BCB PTAX (Primária)        │   │   │
│  │                     │                    │  │ - USD/BRL, EUR/BRL         │   │   │
│  └──────────┬──────────┘                    │  │ - Dados oficiais Brasil    │   │   │
│             │                               │  └─────────────────────────────┘   │   │
│             │                               │  ┌─────────────────────────────┐   │   │
│             │                               │  │ ExchangeRate-API (Fallback) │   │   │
│             │                               │  │ - Multi-moedas             │   │   │
│             │                               │  │ - 1500 req/mês (free)      │   │   │
│             │                               │  └─────────────────────────────┘   │   │
│             │                               └────────────────────────────────────┘   │
│             │                                                                        │
│  ┌──────────▼──────────────────────────────────────────────────────────────────┐   │
│  │                              CACHE LAYER                                     │   │
│  │  ExchangeRateCache (Redis)                                                   │   │
│  │  - Chave: exchange:current:{FROM}:{TO}                                       │   │
│  │  - TTL: 3600s (1 hora)                                                       │   │
│  │  - Valor: { rate, source, updatedAt }                                        │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                              SCHEDULER LAYER                                  │   │
│  │  ExchangeRateScheduler (node-cron)                                           │   │
│  │  - Cron: 0 18 * * 1-5 (18:00 BRT, dias úteis)                               │   │
│  │  - Busca PTAX de fechamento                                                   │   │
│  │  - Persiste no MongoDB + Invalida cache                                       │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    DATA LAYER                                       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────┐     ┌─────────────────────────────┐                 │
│  │        MongoDB              │     │          Redis              │                 │
│  │  Collection: exchangeRates  │     │  Keys: exchange:current:*   │                 │
│  │  - _id (UUID)               │     │  TTL: 3600s                 │                 │
│  │  - from, to (String)        │     └─────────────────────────────┘                 │
│  │  - rate (Number)            │                                                     │
│  │  - date (Date)              │                                                     │
│  │  - source (String)          │                                                     │
│  │  - createdAt (Date)         │                                                     │
│  │  Index: {from, to, date}    │                                                     │
│  └─────────────────────────────┘                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Fluxo de Dados - Cache-Aside Pattern

```
┌─────────┐     1. Request      ┌────────────────┐
│ Client  │ ──────────────────►│ ExchangeRate   │
│         │                     │ Manager        │
└─────────┘                     └───────┬────────┘
                                        │
                        2. Check Cache   │
                               ┌────────▼────────┐
                               │     Redis       │
                               │  Cache Hit?     │
                               └────────┬────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │ Cache HIT         │                   │ Cache MISS
                    ▼                   │                   ▼
           ┌────────────────┐           │          ┌────────────────┐
           │ Return cached │           │          │ Call External  │
           │ value (<50ms) │           │          │ API (BCB)       │
           └────────────────┘           │          └───────┬────────┘
                    │                   │                  │
                    │                   │         3. Store in Cache
                    │                   │                  │
                    │                   │          ┌───────▼────────┐
                    │                   │          │     Redis       │
                    │                   │          │ SETEX (TTL 1h)  │
                    │                   │          └───────┬────────┘
                    │                   │                  │
                    │                   │         4. Persist to MongoDB
                    │                   │                  │
                    │                   │          ┌───────▼────────┐
                    │                   │          │    MongoDB      │
                    │                   │          │ upsertRate()    │
                    │                   │          └───────┬────────┘
                    │                   │                  │
                    └───────────────────┼──────────────────┘
                                        │
                               5. Return to Client
                                        │
                               ┌────────▼────────┐
                               │     Client       │
                               │ Response <200ms │
                               └─────────────────┘
```

---

## 2. Componentes Backend

### 2.1 Models (Mongoose Schemas)

#### `src/app/exchange-rate/exchange-rate-model.js`

```javascript
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const exchangeRateSchema = new mongoose.Schema({
  _id: { 
    type: String, 
    required: true, 
    default: uuidv4 
  },
  from: { 
    type: String, 
    required: true, 
    uppercase: true, 
    trim: true 
  },
  to: { 
    type: String, 
    required: true, 
    uppercase: true, 
    trim: true 
  },
  rate: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  date: { 
    type: Date, 
    required: true 
  },
  source: { 
    type: String, 
    required: true,
    enum: ['BCB', 'EXCHANGE_RATE_API', 'OPEN_EXCHANGE_RATES', 'FALLBACK', 'MANUAL']
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
}, { 
  versionKey: false,
  timestamps: false 
})

// Index para consultas frequentes
exchangeRateSchema.index({ from: 1, to: 1, date: -1 })

// Index único para evitar duplicatas
exchangeRateSchema.index({ from: 1, to: 1, date: 1 }, { unique: true })

module.exports = { exchangeRateSchema }
```

### 2.2 DAOs

#### `src/app/exchange-rate/exchange-rate-dao.js`

```javascript
const AppDAO = require('../app-dao')
const { exchangeRateSchema } = require('./exchange-rate-model')

class ExchangeRateDAO extends AppDAO {
  constructor(db) {
    super(db)
  }

  initializeDBModel(db) {
    return db.model('exchangeRate', exchangeRateSchema)
  }

  /**
   * Busca taxa por par de moedas e data exata
   */
  async findByPairAndDate({ from, to, date }) {
    const normalizedDate = new Date(date)
    normalizedDate.setHours(0, 0, 0, 0)
    
    return await this.objectModel.findOne({
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      date: normalizedDate,
    }).lean().exec()
  }

  /**
   * Busca a taxa mais recente para um par de moedas
   */
  async findLatestByPair({ from, to }) {
    return await this.objectModel.findOne({
      from: from.toUpperCase(),
      to: to.toUpperCase(),
    })
    .sort({ date: -1 })
    .lean().exec()
  }

  /**
   * Busca histórico por range de datas (para gráficos)
   */
  async findByPairAndRange({ from, to, startDate, endDate }) {
    return await this.objectModel.find({
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    })
    .sort({ date: 1 })
    .lean().exec()
  }

  /**
   * Upsert: insere ou atualiza taxa do dia
   */
  async upsertRate({ from, to, rate, date, source }) {
    const normalizedDate = new Date(date)
    normalizedDate.setHours(0, 0, 0, 0)

    return await this.objectModel.findOneAndUpdate(
      {
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        date: normalizedDate,
      },
      {
        $set: {
          rate,
          source,
        },
        $setOnInsert: {
          _id: uuidv4(),
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    ).lean().exec()
  }

  /**
   * Bulk insert para carga histórica
   */
  async bulkUpsertRates(rates) {
    const bulkOps = rates.map((rate) => ({
      updateOne: {
        filter: {
          from: rate.from.toUpperCase(),
          to: rate.to.toUpperCase(),
          date: new Date(rate.date),
        },
        update: {
          $set: {
            rate: rate.rate,
            source: rate.source,
          },
          $setOnInsert: {
            _id: uuidv4(),
          },
        },
        upsert: true,
      },
    }))

    return await this.objectModel.bulkWrite(bulkOps, { ordered: false })
  }

  /**
   * Verifica se existe histórico para um par
   */
  async hasHistoryForPair({ from, to }) {
    const count = await this.objectModel.countDocuments({
      from: from.toUpperCase(),
      to: to.toUpperCase(),
    })
    return count > 0
  }
}

module.exports = ExchangeRateDAO
```

### 2.3 Managers

#### `src/app/exchange-rate/exchange-rate-manager.js`

```javascript
const ExchangeRateDAO = require('./exchange-rate-dao')
const ExchangeRateService = require('./exchange-rate-service')
const ExchangeRateCache = require('./exchange-rate-cache')
const APP_CONSTANTS = require('../app-constants')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app-constants')

const logger = new JsonLog(SERVICE_NAME)

class ExchangeRateManager {
  constructor(appManager, appDB) {
    this.appDB = appDB
    this.config = appManager.config
    this.handleError = appManager.handleError.bind(appManager)
    
    this.exchangeRateDAO = new ExchangeRateDAO(this.appDB.getDb())
    this.exchangeRateService = new ExchangeRateService(this.config)
    this.exchangeRateCache = new ExchangeRateCache(appManager.redisClient)
  }

  /**
   * Obtém taxa atual com padrão cache-aside
   */
  async getCurrentRate(from, to) {
    const normalizedFrom = from.toUpperCase()
    const normalizedTo = to.toUpperCase()

    // 1. Tenta cache Redis
    const cached = await this.exchangeRateCache.get(normalizedFrom, normalizedTo)
    if (cached) {
      logger.log('Cache hit for exchange rate', {
        internal: { method: 'getCurrentRate', filename: 'exchange-rate-manager.js' },
        metadata: { from: normalizedFrom, to: normalizedTo },
      })
      return cached
    }

    // 2. Cache miss - busca API externa
    logger.log('Cache miss, fetching from external API', {
      internal: { method: 'getCurrentRate', filename: 'exchange-rate-manager.js' },
      metadata: { from: normalizedFrom, to: normalizedTo },
    })

    const rateData = await this.exchangeRateService.fetchCurrentRate(normalizedFrom, normalizedTo)

    // 3. Armazena no cache
    await this.exchangeRateCache.set(normalizedFrom, normalizedTo, rateData)

    // 4. Persiste no MongoDB (async, não bloqueia resposta)
    this.exchangeRateDAO.upsertRate({
      from: normalizedFrom,
      to: normalizedTo,
      rate: rateData.rate,
      date: new Date(),
      source: rateData.source,
    }).catch((err) => {
      logger.error('Failed to persist rate to MongoDB', err, {
        internal: { method: 'getCurrentRate', filename: 'exchange-rate-manager.js' },
      })
    })

    return rateData
  }

  /**
   * Obtém histórico de taxas
   */
  async getHistoricalRates({ from, to, startDate, endDate }) {
    return await this.exchangeRateDAO.findByPairAndRange({
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      startDate,
      endDate,
    })
  }

  /**
   * Converte valor para BRL
   * Usado pelo EP04 (Transações) e EP05 (Preço Médio)
   */
  async convertToBRL(amount, fromCurrency, date = null) {
    if (fromCurrency.toUpperCase() === 'BRL') {
      return amount
    }

    let rateData
    if (date) {
      // Busca taxa histórica do MongoDB
      rateData = await this.exchangeRateDAO.findByPairAndDate({
        from: fromCurrency,
        to: 'BRL',
        date,
      })
    } else {
      // Busca taxa atual (com cache)
      rateData = await this.getCurrentRate(fromCurrency, 'BRL')
    }

    if (!rateData) {
      this.handleError(APP_CONSTANTS.ERRORS.EXCHANGE_RATE_NOT_FOUND)
    }

    return {
      originalAmount: amount,
      originalCurrency: fromCurrency,
      convertedAmount: amount * rateData.rate,
      rate: rateData.rate,
      source: rateData.source,
    }
  }

  /**
   * Força atualização da taxa (para job scheduler)
   */
  async forceUpdateRate(from, to) {
    const rateData = await this.exchangeRateService.fetchCurrentRate(from, to)
    
    // Atualiza MongoDB
    await this.exchangeRateDAO.upsertRate({
      from,
      to,
      rate: rateData.rate,
      date: new Date(),
      source: rateData.source,
    })

    // Invalida cache
    await this.exchangeRateCache.invalidate(from, to)

    // Atualiza cache com novo valor
    await this.exchangeRateCache.set(from, to, rateData)

    return rateData
  }
}

module.exports = ExchangeRateManager
```

#### `src/app/exchange-rate/exchange-rate-service.js`

```javascript
const axios = require('axios')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app-constants')

const logger = new JsonLog(SERVICE_NAME)

class ExchangeRateService {
  constructor(config) {
    this.bcbBaseUrl = 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata'
    this.fallbackUrl = 'https://api.exchangerate-api.com/v4/latest'
    this.openExchangeUrl = 'https://openexchangerates.org/api/latest.json'
    
    this.timeout = config.exchangeRate?.apiTimeout || 10000
    this.openExchangeAppId = config.exchangeRate?.openExchangeAppId
  }

  /**
   * Busca taxa atual com fallback automático
   */
  async fetchCurrentRate(from, to) {
    // Para pares com BRL, usar BCB como primário
    if (to === 'BRL' && from === 'USD') {
      try {
        return await this.fetchFromBCB('USD', 'BRL')
      } catch (error) {
        logger.error('BCB API failed, using fallback', error, {
          internal: { method: 'fetchCurrentRate', filename: 'exchange-rate-service.js' },
        })
        return await this.fetchFromFallback(from, to)
      }
    }

    if (to === 'BRL' && from === 'EUR') {
      try {
        return await this.fetchFromBCB('EUR', 'BRL')
      } catch (error) {
        logger.error('BCB API failed for EUR, using fallback', error, {
          internal: { method: 'fetchCurrentRate', filename: 'exchange-rate-service.js' },
        })
        return await this.fetchFromFallback(from, to)
      }
    }

    // Para outros pares, usar API de fallback
    return await this.fetchFromFallback(from, to)
  }

  /**
   * Busca da API BCB PTAX
   */
  async fetchFromBCB(from, to) {
    const today = new Date()
    const formatDate = (date) => 
      `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}`

    // Série 1 = USD/BRL, Série 21619 = EUR/BRL
    const serieNumber = from === 'USD' ? 1 : 21619

    const url = `${this.bcbBaseUrl}/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${formatDate(today)}'&$format=json`

    const response = await axios.get(url, { timeout: this.timeout })

    if (!response.data.value || response.data.value.length === 0) {
      throw new Error('No data returned from BCB')
    }

    const data = response.data.value[0]
    
    return {
      from,
      to,
      rate: data.cotacaoVenda, // Usa taxa de venda
      source: 'BCB',
      date: new Date(data.dataHoraCotacao),
    }
  }

  /**
   * Busca da API de fallback (exchangerate-api)
   */
  async fetchFromFallback(from, to) {
    try {
      const response = await axios.get(`${this.fallbackUrl}/${from}`, {
        timeout: this.timeout,
      })

      const rate = response.data.rates[to]
      if (!rate) {
        throw new Error(`Rate not found for ${from}/${to}`)
      }

      return {
        from,
        to,
        rate,
        source: 'EXCHANGE_RATE_API',
        date: new Date(),
      }
    } catch (error) {
      logger.error('Fallback API failed', error, {
        internal: { method: 'fetchFromFallback', filename: 'exchange-rate-service.js' },
      })

      // Tenta segundo fallback (Open Exchange Rates)
      if (this.openExchangeAppId) {
        return await this.fetchFromOpenExchange(from, to)
      }

      throw error
    }
  }

  /**
   * Busca da Open Exchange Rates (segundo fallback)
   */
  async fetchFromOpenExchange(from, to) {
    const response = await axios.get(this.openExchangeUrl, {
      params: {
        app_id: this.openExchangeAppId,
        base: from,
      },
      timeout: this.timeout,
    })

    const rate = response.data.rates[to]
    if (!rate) {
      throw new Error(`Rate not found for ${from}/${to}`)
    }

    return {
      from,
      to,
      rate,
      source: 'OPEN_EXCHANGE_RATES',
      date: new Date(),
    }
  }

  /**
   * Busca histórico BCB PTAX por range
   */
  async fetchHistoricalRates(from, to, startDate, endDate) {
    const formatBCBDate = (date) => {
      const d = new Date(date)
      return `${d.getMonth() + 1}-${d.getDate()}-${d.getFullYear()}`
    }

    const serieNumber = from === 'USD' ? 1 : 21619

    const url = `${this.bcbBaseUrl}/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinal=@dataFinal)?@dataInicial='${formatBCBDate(startDate)}'&@dataFinal='${formatBCBDate(endDate)}'&$format=json`

    const response = await axios.get(url, { timeout: this.timeout })

    if (!response.data.value) {
      return []
    }

    return response.data.value.map((item) => ({
      from,
      to,
      rate: item.cotacaoVenda,
      source: 'BCB',
      date: new Date(item.dataHoraCotacao),
    }))
  }
}

module.exports = ExchangeRateService
```

#### `src/app/exchange-rate/exchange-rate-cache.js`

```javascript
class ExchangeRateCache {
  constructor(redisClient) {
    this.redis = redisClient
    this.TTL = 3600 // 1 hora em segundos
    this.KEY_PREFIX = 'exchange:current'
  }

  /**
   * Gera chave padronizada
   */
  _buildKey(from, to) {
    return `${this.KEY_PREFIX}:${from.toUpperCase()}:${to.toUpperCase()}`
  }

  /**
   * Busca do cache
   */
  async get(from, to) {
    try {
      const key = this._buildKey(from, to)
      const cached = await this.redis.get(key)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      // Graceful degradation - retorna null se Redis falhar
      return null
    }
  }

  /**
   * Armazena no cache com TTL
   */
  async set(from, to, data) {
    try {
      const key = this._buildKey(from, to)
      const value = JSON.stringify({
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        rate: data.rate,
        source: data.source,
        updatedAt: new Date().toISOString(),
      })
      await this.redis.setex(key, this.TTL, value)
    } catch (error) {
      // Graceful degradation - ignora erro de escrita no cache
    }
  }

  /**
   * Invalida cache para um par
   */
  async invalidate(from, to) {
    try {
      const key = this._buildKey(from, to)
      await this.redis.del(key)
    } catch (error) {
      // Ignora erro de invalidação
    }
  }

  /**
   * Invalida todos os caches de câmbio
   */
  async invalidateAll() {
    try {
      const keys = await this.redis.keys(`${this.KEY_PREFIX}:*`)
      if (keys.length > 0) {
        await this.redis.del(keys)
      }
    } catch (error) {
      // Ignora erro
    }
  }
}

module.exports = ExchangeRateCache
```

#### `src/app/exchange-rate/exchange-rate-scheduler.js`

```javascript
const cron = require('node-cron')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app-constants')

const logger = new JsonLog(SERVICE_NAME)

class ExchangeRateScheduler {
  constructor(exchangeRateManager, config) {
    this.manager = exchangeRateManager
    this.isRunning = false
    this.maxRetries = config.exchangeRate?.maxRetries || 3
    this.retryDelayMs = config.exchangeRate?.retryDelay || 1800000 // 30 min
    this.timezone = config.exchangeRate?.timezone || 'America/Sao_Paulo'
    this.historyYears = config.exchangeRate?.historyYears || 5

    // Pares de moedas a serem monitorados
    this.currencyPairs = config.exchangeRate?.pairs || [
      { from: 'USD', to: 'BRL' },
      { from: 'EUR', to: 'BRL' },
    ]
  }

  /**
   * Inicia o scheduler
   */
  start() {
    const cronExpression = this.config?.exchangeRate?.scheduleCron || '0 18 * * 1-5'

    // Executa diariamente às 18:00 BRT (após fechamento PTAX)
    cron.schedule(cronExpression, () => this._execute(), {
      timezone: this.timezone,
    })

    logger.log('Exchange rate scheduler started', {
      internal: { method: 'start', filename: 'exchange-rate-scheduler.js' },
      metadata: { cron: cronExpression, timezone: this.timezone },
    })

    // Verifica na inicialização se precisa carga histórica
    this._checkAndLoadHistory()
  }

  /**
   * Execução principal do job
   */
  async _execute() {
    if (this.isRunning) {
      logger.log('Scheduler already running, skipping', {
        internal: { method: '_execute', filename: 'exchange-rate-scheduler.js' },
      })
      return
    }

    this.isRunning = true

    try {
      logger.log('Starting scheduled exchange rate update', {
        internal: { method: '_execute', filename: 'exchange-rate-scheduler.js' },
      })

      for (const pair of this.currencyPairs) {
        await this._fetchWithRetry(pair)
      }

      logger.log('Scheduled exchange rate update completed', {
        internal: { method: '_execute', filename: 'exchange-rate-scheduler.js' },
      })
    } catch (error) {
      logger.error('Scheduled exchange rate update failed', error, {
        internal: { method: '_execute', filename: 'exchange-rate-scheduler.js' },
      })
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Busca taxa com retentativas
   */
  async _fetchWithRetry(pair, attempt = 1) {
    try {
      const result = await this.manager.forceUpdateRate(pair.from, pair.to)
      logger.log(`Rate updated for ${pair.from}/${pair.to}`, {
        internal: { method: '_fetchWithRetry', filename: 'exchange-rate-scheduler.js' },
        metadata: { pair, rate: result.rate },
      })
    } catch (error) {
      if (attempt < this.maxRetries) {
        logger.log(`Retrying (${attempt}/${this.maxRetries}) for ${pair.from}/${pair.to}`, {
          internal: { method: '_fetchWithRetry', filename: 'exchange-rate-scheduler.js' },
        })
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs))
        return this._fetchWithRetry(pair, attempt + 1)
      }
      throw error
    }
  }

  /**
   * Verifica e executa carga histórica se necessário
   */
  async _checkAndLoadHistory() {
    for (const pair of this.currencyPairs) {
      const hasHistory = await this.manager.exchangeRateDAO.hasHistoryForPair(pair)
      
      if (!hasHistory) {
        logger.log(`Loading historical data for ${pair.from}/${pair.to}`, {
          internal: { method: '_checkAndLoadHistory', filename: 'exchange-rate-scheduler.js' },
          metadata: { years: this.historyYears },
        })
        
        await this._loadHistoricalData(pair)
      }
    }
  }

  /**
   * Carrega dados históricos
   */
  async _loadHistoricalData(pair) {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setFullYear(startDate.getFullYear() - this.historyYears)

    try {
      const historicalRates = await this.manager.exchangeRateService
        .fetchHistoricalRates(pair.from, pair.to, startDate, endDate)

      if (historicalRates.length > 0) {
        await this.manager.exchangeRateDAO.bulkUpsertRates(historicalRates)
        
        logger.log(`Historical data loaded for ${pair.from}/${pair.to}`, {
          internal: { method: '_loadHistoricalData', filename: 'exchange-rate-scheduler.js' },
          metadata: { count: historicalRates.length },
        })
      }
    } catch (error) {
      logger.error(`Failed to load historical data for ${pair.from}/${pair.to}`, error, {
        internal: { method: '_loadHistoricalData', filename: 'exchange-rate-scheduler.js' },
      })
    }
  }
}

module.exports = ExchangeRateScheduler
```

### 2.4 Routers

#### `src/app/exchange-rate/exchange-rate-router.js`

```javascript
const express = require('express')
const { Authorizer, Permissions } = require('interact-utils')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app-constants')

const logger = new JsonLog(SERVICE_NAME)

class ExchangeRateRouter {
  static handleError(exception, res) {
    logger.error('Exchange rate route error', exception, {
      internal: { method: 'handleError', filename: 'exchange-rate-router.js' },
    })
    res.status(exception.statusCode || 500).send({
      message: exception.message || 'Server Error',
      code: exception.code || 'INTERNAL_ERROR',
    })
  }

  static getPublicRoutes(appManager) {
    const router = express.Router()
    const manager = appManager.getExchangeRateManager()

    /**
     * GET /v1/public/exchange-rates/current
     * Obtém taxa de câmbio atual
     * Query params: from, to
     */
    router.get('/exchange-rates/current',
      Authorizer.getMiddleware(Permissions.SERVICES),
      async (req, res) => {
        try {
          const { from, to } = req.query

          if (!from || !to) {
            return res.status(400).send({
              message: 'Query params "from" and "to" are required',
              code: 'MISSING_PARAMS',
            })
          }

          const result = await manager.getCurrentRate(from, to)
          res.status(200).send(result)
        } catch (exception) {
          ExchangeRateRouter.handleError(exception, res)
        }
      })

    /**
     * GET /v1/public/exchange-rates/history
     * Obtém histórico de taxas
     * Query params: from, to, startDate, endDate
     */
    router.get('/exchange-rates/history',
      Authorizer.getMiddleware(Permissions.SERVICES),
      async (req, res) => {
        try {
          const { from, to, startDate, endDate } = req.query

          if (!from || !to || !startDate || !endDate) {
            return res.status(400).send({
              message: 'Query params "from", "to", "startDate", "endDate" are required',
              code: 'MISSING_PARAMS',
            })
          }

          const result = await manager.getHistoricalRates({
            from,
            to,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
          })

          res.status(200).send({
            from: from.toUpperCase(),
            to: to.toUpperCase(),
            startDate,
            endDate,
            rates: result,
            count: result.length,
          })
        } catch (exception) {
          ExchangeRateRouter.handleError(exception, res)
        }
      })

    /**
     * POST /v1/public/exchange-rates/convert
     * Converte valor para BRL
     * Body: { amount, fromCurrency, date? }
     */
    router.post('/exchange-rates/convert',
      Authorizer.getMiddleware(Permissions.SERVICES),
      async (req, res) => {
        try {
          const { amount, fromCurrency, date } = req.body

          if (!amount || !fromCurrency) {
            return res.status(400).send({
              message: 'Body fields "amount" and "fromCurrency" are required',
              code: 'MISSING_PARAMS',
            })
          }

          const result = await manager.convertToBRL(
            amount,
            fromCurrency,
            date ? new Date(date) : null
          )

          res.status(200).send(result)
        } catch (exception) {
          ExchangeRateRouter.handleError(exception, res)
        }
      })

    return router
  }
}

module.exports = ExchangeRateRouter
```

---

## 3. Componentes Frontend

### 3.1 Pages

#### `src/pages/exchange/ExchangeRatePage.vue` (Vue 3)

```vue
<template>
  <div class="exchange-rate-page">
    <header class="page-header">
      <h1>Taxas de Câmbio</h1>
      <ExchangeRateDisplay :rate="currentRate" :loading="loading" />
    </header>

    <div class="currency-toggle-container">
      <CurrencyToggle 
        v-model="displayMode" 
        @change="onToggleChange"
      />
    </div>

    <div class="rate-history">
      <h2>Histórico USD/BRL</h2>
      <ExchangeRateChart :rates="historicalRates" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useExchangeRateStore } from '@/stores/exchange-rate'
import ExchangeRateDisplay from '@/components/exchange/ExchangeRateDisplay.vue'
import CurrencyToggle from '@/components/exchange/CurrencyToggle.vue'
import ExchangeRateChart from '@/components/exchange/ExchangeRateChart.vue'

const store = useExchangeRateStore()
const loading = ref(false)

const currentRate = computed(() => store.currentRates['USD:BRL'])
const displayMode = computed({
  get: () => store.displayMode,
  set: (value) => store.setDisplayMode(value),
})
const historicalRates = computed(() => store.historicalRates)

const onToggleChange = (mode) => {
  store.setDisplayMode(mode)
}

onMounted(async () => {
  loading.value = true
  try {
    await store.fetchCurrentRate('USD', 'BRL')
    await store.fetchHistoricalRates('USD', 'BRL', '2025-01-01', new Date().toISOString())
  } finally {
    loading.value = false
  }
})
</script>
```

### 3.2 Components

#### `src/components/exchange/CurrencyBadge.vue`

```vue
<template>
  <span 
    v-if="currency !== 'BRL'" 
    class="currency-badge"
    :class="`currency-badge--${currency.toLowerCase()}`"
    :title="`${currency} - Clique para ver taxa`"
  >
    <span class="currency-badge__flag">{{ flagEmoji }}</span>
    <span class="currency-badge__code">{{ currency }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  currency: {
    type: String,
    required: true,
  },
})

const flagEmoji = computed(() => {
  const flags = {
    USD: '🇺🇸',
    EUR: '🇪🇺',
    GBP: '🇬🇧',
    JPY: '🇯🇵',
  }
  return flags[props.currency] || '🌍'
})
</script>

<style scoped>
.currency-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background-color: #f0f0f0;
}

.currency-badge--usd {
  background-color: #e8f4fd;
  color: #1a73e8;
}

.currency-badge--eur {
  background-color: #e8f5e9;
  color: #34a853;
}
</style>
```

#### `src/components/exchange/CurrencyToggle.vue`

```vue
<template>
  <div class="currency-toggle">
    <button 
      class="toggle-btn"
      :class="{ 'toggle-btn--active': modelValue === 'BRL' }"
      @click="$emit('update:modelValue', 'BRL')"
    >
      <span class="toggle-btn__flag">🇧🇷</span>
      <span class="toggle-btn__label">BRL</span>
    </button>
    
    <button 
      class="toggle-btn"
      :class="{ 'toggle-btn--active': modelValue === 'original' }"
      @click="$emit('update:modelValue', 'original')"
    >
      <span class="toggle-btn__flag">🌍</span>
      <span class="toggle-btn__label">Original</span>
    </button>
  </div>
</template>

<script setup>
defineProps({
  modelValue: {
    type: String,
    default: 'BRL',
    validator: (value) => ['BRL', 'original'].includes(value),
  },
})

defineEmits(['update:modelValue'])
</script>

<style scoped>
.currency-toggle {
  display: flex;
  gap: 8px;
  padding: 4px;
  background-color: #f5f5f5;
  border-radius: 8px;
}

.toggle-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-btn--active {
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
```

#### `src/components/exchange/ExchangeRateDisplay.vue`

```vue
<template>
  <div class="exchange-rate-display" :class="{ 'exchange-rate-display--stale': isStale }">
    <div v-if="loading" class="exchange-rate-display__loading">
      <span class="skeleton"></span>
    </div>
    
    <div v-else class="exchange-rate-display__content">
      <span class="rate-label">USD/BRL</span>
      <span class="rate-value">{{ formattedRate }}</span>
      <span class="rate-source" :title="`Fonte: ${rate?.source}`">
        {{ rate?.source === 'BCB' ? '🏛️' : '🌐' }}
      </span>
      <span class="rate-updated">
        {{ isStale ? '⚠️ Dados desatualizados' : `Atualizado: ${formattedTime}` }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const props = defineProps({
  rate: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const formattedRate = computed(() => {
  if (!props.rate?.rate) return '--'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(props.rate.rate)
})

const formattedTime = computed(() => {
  if (!props.rate?.updatedAt) return ''
  return formatDistanceToNow(new Date(props.rate.updatedAt), {
    addSuffix: true,
    locale: ptBR,
  })
})

const isStale = computed(() => {
  if (!props.rate?.updatedAt) return true
  const updated = new Date(props.rate.updatedAt)
  const now = new Date()
  const hoursDiff = (now - updated) / (1000 * 60 * 60)
  return hoursDiff > 2 // Considera stale se > 2 horas
})
</script>
```

### 3.3 Services

#### `src/services/exchange-rate.service.js`

```javascript
import axios from 'axios'

const API_BASE = '/v1/public'

export const exchangeRateService = {
  /**
   * Obtém taxa de câmbio atual
   */
  async getCurrentRate(from, to) {
    const response = await axios.get(`${API_BASE}/exchange-rates/current`, {
      params: { from, to },
    })
    return response.data
  },

  /**
   * Obtém histórico de taxas
   */
  async getHistoricalRates(from, to, startDate, endDate) {
    const response = await axios.get(`${API_BASE}/exchange-rates/history`, {
      params: { from, to, startDate, endDate },
    })
    return response.data
  },

  /**
   * Converte valor para BRL
   */
  async convertToBRL(amount, fromCurrency, date = null) {
    const response = await axios.post(`${API_BASE}/exchange-rates/convert`, {
      amount,
      fromCurrency,
      date,
    })
    return response.data
  },
}
```

### 3.4 Store/State

#### `src/stores/exchange-rate.js` (Pinia)

```javascript
import { defineStore } from 'pinia'
import { exchangeRateService } from '@/services/exchange-rate.service'

export const useExchangeRateStore = defineStore('exchangeRate', {
  state: () => ({
    currentRates: {}, // { 'USD:BRL': { rate, source, updatedAt } }
    historicalRates: [],
    displayMode: 'BRL', // 'BRL' | 'original'
    lastFetchedAt: null,
    isLoading: false,
    error: null,
  }),

  getters: {
    getRate: (state) => (from, to) => {
      return state.currentRates[`${from}:${to}`]
    },
    
    isStale: (state) => {
      if (!state.lastFetchedAt) return true
      const hoursDiff = (Date.now() - state.lastFetchedAt) / (1000 * 60 * 60)
      return hoursDiff > 1
    },
  },

  actions: {
    async fetchCurrentRate(from, to) {
      this.isLoading = true
      this.error = null
      
      try {
        const rate = await exchangeRateService.getCurrentRate(from, to)
        this.currentRates[`${from}:${to}`] = rate
        this.lastFetchedAt = Date.now()
        
        // Salva no localStorage para persistência
        this.saveToLocalStorage()
      } catch (error) {
        this.error = error.message
        // Tenta usar cache local
        this.loadFromLocalStorage()
      } finally {
        this.isLoading = false
      }
    },

    async fetchHistoricalRates(from, to, startDate, endDate) {
      try {
        const result = await exchangeRateService.getHistoricalRates(
          from, to, startDate, endDate
        )
        this.historicalRates = result.rates
      } catch (error) {
        this.error = error.message
      }
    },

    setDisplayMode(mode) {
      this.displayMode = mode
      localStorage.setItem('exchangeDisplayMode', mode)
    },

    convertToBRL(amount, currency) {
      if (currency === 'BRL') return amount
      
      const rate = this.currentRates[`${currency}:BRL`]
      if (!rate) return null
      
      return amount * rate.rate
    },

    saveToLocalStorage() {
      localStorage.setItem('exchangeRates', JSON.stringify(this.currentRates))
      localStorage.setItem('exchangeRatesFetchedAt', this.lastFetchedAt)
    },

    loadFromLocalStorage() {
      const saved = localStorage.getItem('exchangeRates')
      const fetchedAt = localStorage.getItem('exchangeRatesFetchedAt')
      
      if (saved) {
        this.currentRates = JSON.parse(saved)
      }
      if (fetchedAt) {
        this.lastFetchedAt = parseInt(fetchedAt, 10)
      }
    },

    initialize() {
      this.loadFromLocalStorage()
      const savedMode = localStorage.getItem('exchangeDisplayMode')
      if (savedMode) {
        this.displayMode = savedMode
      }
    },
  },
})
```

---

## 4. API Contracts

### 4.1 GET /v1/public/exchange-rates/current

**Descrição**: Obtém taxa de câmbio atual

**Query Parameters**:
| Nome | Tipo | Obrigatório | Descrição |
|------|------|--------------|-----------|
| from | string | Sim | Moeda de origem (ex: USD, EUR) |
| to | string | Sim | Moeda de destino (ex: BRL) |

**Response 200**:
```json
{
  "from": "USD",
  "to": "BRL",
  "rate": 5.4523,
  "source": "BCB",
  "updatedAt": "2026-03-27T18:30:00.000Z"
}
```

**Response 400**:
```json
{
  "message": "Query params \"from\" and \"to\" are required",
  "code": "MISSING_PARAMS"
}
```

### 4.2 GET /v1/public/exchange-rates/history

**Descrição**: Obtém histórico de taxas de câmbio

**Query Parameters**:
| Nome | Tipo | Obrigatório | Descrição |
|------|------|--------------|-----------|
| from | string | Sim | Moeda de origem |
| to | string | Sim | Moeda de destino |
| startDate | string | Sim | Data inicial (ISO 8601) |
| endDate | string | Sim | Data final (ISO 8601) |

**Response 200**:
```json
{
  "from": "USD",
  "to": "BRL",
  "startDate": "2025-01-01",
  "endDate": "2026-03-27",
  "count": 320,
  "rates": [
    { "date": "2025-01-02T00:00:00.000Z", "rate": 4.97, "source": "BCB" },
    { "date": "2025-01-03T00:00:00.000Z", "rate": 4.98, "source": "BCB" }
  ]
}
```

### 4.3 POST /v1/public/exchange-rates/convert

**Descrição**: Converte valor para BRL

**Request Body**:
```json
{
  "amount": 1000,
  "fromCurrency": "USD",
  "date": "2026-03-15"
}
```

**Response 200**:
```json
{
  "originalAmount": 1000,
  "originalCurrency": "USD",
  "convertedAmount": 5452.30,
  "rate": 5.4523,
  "source": "BCB"
}
```

---

## 5. Fluxos de Dados

### 5.1 Diagrama de Sequência - Obter Taxa Atual

```
┌─────────┐          ┌─────────┐          ┌─────────┐          ┌─────────┐          ┌─────────┐
│ Frontend│          │ Router  │          │ Manager │          │  Redis  │          │   BCB   │
└────┬────┘          └────┬────┘          └────┬────┘          └────┬────┘          └────┬────┘
     │                    │                    │                    │                    │
     │ GET /current       │                    │                    │                    │
     │ from=USD,to=BRL    │                    │                    │                    │
     │───────────────────►│                    │                    │                    │
     │                    │                    │                    │                    │
     │                    │ getCurrentRate()   │                    │                    │
     │                    │───────────────────►│                    │                    │
     │                    │                    │                    │                    │
     │                    │                    │ get(USD, BRL)      │                    │
     │                    │                    │───────────────────►│                    │
     │                    │                    │                    │                    │
     │                    │                    │ null (cache miss)  │                    │
     │                    │                    │◄───────────────────│                    │
     │                    │                    │                    │                    │
     │                    │                    │ fetchFromBCB()     │                    │
     │                    │                    │────────────────────────────────────────►│
     │                    │                    │                    │                    │
     │                    │                    │ { rate: 5.45 }     │                    │
     │                    │                    │◄─────────────────────────────────────────│
     │                    │                    │                    │                    │
     │                    │                    │ set(USD, BRL, rate)│                    │
     │                    │                    │───────────────────►│                    │
     │                    │                    │                    │                    │
     │                    │                    │ upsertRate() async │                    │
     │                    │                    │─────────────────────────────────────────►│
     │                    │                    │                    │     (MongoDB)       │
     │                    │                    │ { rate, source }   │                    │
     │                    │◄───────────────────│                    │                    │
     │                    │                    │                    │                    │
     │ { from, to, rate } │                    │                    │                    │
     │◄───────────────────│                    │                    │                    │
     │                    │                    │                    │                    │
```

### 5.2 Diagrama de Sequência - Job Diário

```
┌────────────┐     ┌────────────┐     ┌────────────┐     ┌────────────┐     ┌────────────┐
│  Scheduler │     │  Manager   │     │  Service   │     │    BCB     │     │   Redis    │
└─────┬──────┘     └─────┬──────┘     └─────┬──────┘     └─────┬──────┘     └─────┬──────┘
      │                  │                  │                  │                  │
      │ Cron: 18:00 BRT  │                  │                  │                  │
      │ (dias úteis)     │                  │                  │                  │
      │                  │                  │                  │                  │
      │ forceUpdateRate()│                  │                  │                  │
      │─────────────────►│                  │                  │                  │
      │                  │                  │                  │                  │
      │                  │ fetchCurrentRate()│                 │                  │
      │                  │─────────────────►│                  │                  │
      │                  │                  │                  │                  │
      │                  │                  │ GET PTAX         │                  │
      │                  │                  │─────────────────►│                  │
      │                  │                  │                  │                  │
      │                  │                  │ cotacaoVenda     │                  │
      │                  │                  │◄─────────────────│                  │
      │                  │                  │                  │                  │
      │                  │◄─────────────────│                  │                  │
      │                  │                  │                  │                  │
      │                  │ upsertRate()     │                  │                  │
      │                  │─────────────────────────────────────────────────────►│
      │                  │                  │                  │     (MongoDB)    │
      │                  │                  │                  │                  │
      │                  │ invalidate()     │                  │                  │
      │                  │─────────────────────────────────────────────────────►│
      │                  │                  │                  │                  │
      │                  │ set(new rate)    │                  │                  │
      │                  │─────────────────────────────────────────────────────►│
      │                  │                  │                  │                  │
      │◄─────────────────│                  │                  │                  │
      │                  │                  │                  │                  │
```

---

## 6. Estrutura de Arquivos

```
src/
├── app/
│   ├── exchange-rate/
│   │   ├── exchange-rate-model.js        # Schema Mongoose
│   │   ├── exchange-rate-dao.js          # Data Access Layer
│   │   ├── exchange-rate-service.js      # Integração APIs externas
│   │   ├── exchange-rate-cache.js        # Cache Redis
│   │   ├── exchange-rate-scheduler.js    # Job agendado (cron)
│   │   ├── exchange-rate-manager.js      # Business logic
│   │   └── exchange-rate-router.js       # Rotas HTTP
│   │
│   ├── app-constants.js                  # + ERRORS de exchange-rate
│   ├── app-manager.js                    # + ExchangeRateManager
│   └── app-service.js                    # + ExchangeRateRouter
│
├── __tests__/
│   ├── exchange-rate.test.js             # Testes de integração
│   ├── exchange-rate-dao.test.js         # Testes unitários DAO
│   ├── exchange-rate-service.test.js     # Testes unitários Service
│   └── exchange-rate-cache.test.js       # Testes unitários Cache
│
├── __mocks__/
│   └── mock-exchange-rate-api.js         # Mock das APIs externas
│
├── config/
│   └── app.json                          # + bloco "exchangeRate"
│
└── docs/
    └── openapi.yml                       # + endpoints /exchange-rates/*

frontend/
└── src/
    ├── components/exchange/
    │   ├── CurrencyBadge.vue
    │   ├── CurrencyToggle.vue
    │   ├── ExchangeRateDisplay.vue
    │   └── ExchangeRateChart.vue
    │
    ├── composables/
    │   └── useExchangeRate.js
    │
    ├── stores/
    │   └── exchange-rate.js
    │
    └── services/
        └── exchange-rate.service.js
```

---

## 7. Ordem de Implementação

### Fase 1: Infraestrutura Backend (Sprint N)
| Ordem | Story | Componente | Estimativa | Dependências |
|-------|-------|------------|------------|-------------|
| 1 | EP06-S01 | Model + DAO | 3 pts | EP01 (MongoDB) |
| 2 | EP06-S02 | Service + Manager | 8 pts | EP06-S01 |
| 3 | EP06-S03 | Cache Redis | 5 pts | EP06-S02, EP01 (Redis) |

### Fase 2: API e Scheduler (Sprint N+1)
| Ordem | Story | Componente | Estimativa | Dependências |
|-------|-------|------------|------------|-------------|
| 4 | EP06-S04 | Scheduler | 5 pts | EP06-S02, EP06-S03 |
| 5 | EP06-S05 | Router + Endpoints | 5 pts | EP06-S02, EP06-S03 |

### Fase 3: Frontend (Sprint N+2)
| Ordem | Story | Componente | Estimativa | Dependências |
|-------|-------|------------|------------|-------------|
| 6 | EP06-S06 | Components + Store | 8 pts | EP06-S05, EP16, EP17 |

**Total**: 34 story points

---

## 8. Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|--------|-----------|
| API BCB fora do ar | Média | Alto | Fallback para exchangerate-api + cache agressivo (24h) |
| Rate limiting nas APIs free | Média | Médio | Cache Redis 1h + job diário (poucas chamadas/dia) |
| Taxa de câmbio desatualizada | Baixa | Médio | TTL 1h + indicador visual de "última atualização" |
| Carga histórica pesada | Alta | Baixo | Bulk insert com batch de 100 registros, execução assíncrona |
| Redis indisponível | Baixa | Médio | Degraduação graciosa - busca direto da API/MongoDB |
| Fuso horário incorreto no job | Média | Alto | Usar `America/Sao_Paulo` explícito no cron + testes com mock de data |
| Moedas não suportadas pelo BCB | Baixa | Baixo | Fallback automático para API multi-moedas |
| ReDoS em regex de template | Baixa | Alto | Validar regex antes de salvar, usar timeout |

---

## 9. Dependências

### Dependências Externas (NPM)
```json
{
  "dependencies": {
    "node-cron": "^3.0.0",
    "axios": "^1.6.0"
  }
}
```

### Dependências de Épicos
| Épico | Dependência | Tipo |
|-------|-------------|------|
| EP01 | MongoDB container | Bloqueante |
| EP01 | Redis container | Bloqueante |
| EP04 | Transações (para conversão) | Integração |
| EP05 | Preço Médio (para conversão) | Integração |
| EP13 | Fontes de Dados / APIs | Relacionado |
| EP16 | Layout Base Frontend | Bloqueante (S06) |
| EP17 | Navegação Frontend | Bloqueante (S06) |

---

## 10. Checklist de Implementação

### Backend
- [ ] Criar `exchange-rate-model.js` com schema e índices
- [ ] Implementar `ExchangeRateDAO` com todos os métodos
- [ ] Implementar `ExchangeRateService` com fallback
- [ ] Implementar `ExchangeRateCache` com Redis
- [ ] Implementar `ExchangeRateManager` com cache-aside
- [ ] Implementar `ExchangeRateScheduler` com node-cron
- [ ] Criar `ExchangeRateRouter` com endpoints
- [ ] Adicionar constantes de erro em `app-constants.js`
- [ ] Registrar Manager e Router no app principal
- [ ] Criar testes unitários (DAO, Service, Cache)
- [ ] Criar testes de integração (API)
- [ ] Criar mocks das APIs externas
- [ ] Atualizar OpenAPI spec

### Frontend
- [ ] Criar `CurrencyBadge.vue`
- [ ] Criar `CurrencyToggle.vue`
- [ ] Criar `ExchangeRateDisplay.vue`
- [ ] Criar `ExchangeRateChart.vue`
- [ ] Criar `useExchangeRate.js` composable
- [ ] Criar `exchange-rate.js` store (Pinia)
- [ ] Criar `exchange-rate.service.js`
- [ ] Integrar com páginas de carteira e transações
- [ ] Testes unitários de componentes
- [ ] Testes E2E do fluxo de toggle

### DevOps
- [ ] Configurar variáveis de ambiente
- [ ] Verificar conectividade Redis
- [ ] Verificar conectividade MongoDB
- [ ] Configurar timezone no container
- [ ] Monitorar job scheduler (logs/alertas)

---

## 11. Configuração

### config/app.json
```json
{
  "exchangeRate": {
    "scheduleCron": "0 18 * * 1-5",
    "timezone": "America/Sao_Paulo",
    "cacheTTL": 3600,
    "apiTimeout": 10000,
    "maxRetries": 3,
    "retryDelay": 1800000,
    "historyYears": 5,
    "pairs": [
      { "from": "USD", "to": "BRL" },
      { "from": "EUR", "to": "BRL" }
    ],
    "openExchangeAppId": "${OPEN_EXCHANGE_APP_ID}"
  }
}
```

### Variáveis de Ambiente
```bash
# Redis
REDIS_URL=redis://localhost:6379

# MongoDB
DATABASE_URL_DIALER=mongodb://localhost:27017
DATABASE_NAME_PREFIX=moneytrackr

# APIs de Câmbio (opcional)
OPEN_EXCHANGE_APP_ID=your_app_id_here
```

---

**Status**: Pronto para implementação
**Próximos passos**: Delegar para @tech-lead iniciar implementação do EP06-S01

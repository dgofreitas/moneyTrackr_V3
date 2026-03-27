# Plano Técnico - EP07: Renda Fixa

> **Épico**: 07 — Renda Fixa
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
│  ┌─────────────────────────────────────────────────────────────────────────────────┐│
│  │                         FixedIncomePage                                         ││
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌─────────────────┐  ││
│  │  │ FixedIncome   │  │ FixedIncome   │  │ FixedIncome   │  │ FixedIncome     │  ││
│  │  │ List          │  │ Form          │  │ Summary       │  │ Card (mobile)   │  ││
│  │  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └────────┬────────┘  ││
│  │          │                  │                  │                    │           ││
│  │          └──────────────────┼──────────────────┼────────────────────┘           ││
│  │                             │                  │                                ││
│  │                   ┌─────────▼─────────┐        │                                ││
│  │                   │ fixed-income.     │        │                                ││
│  │                   │ service.js        │        │                                ││
│  │                   └─────────┬─────────┘        │                                ││
│  └─────────────────────────────┼──────────────────┼────────────────────────────────┘│
│                                │                  │                                 │
│                    ┌───────────▼───────────┐      │                                 │
│                    │  Store (Pinia/Vuex)   │      │                                 │
│                    │  - investments        │      │                                 │
│                    │  - summary            │      │                                 │
│                    └──────────────────────┘      │                                 │
└───────────────────────────────────────────────────┼─────────────────────────────────┘
                                                    │
                                                    │ HTTP/REST
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    BACKEND (Node.js)                                │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                              ROUTER LAYER                                    │   │
│  │  FixedIncomeRouter                                                           │   │
│  │  - GET    /v1/public/fixed-income?walletId=xxx                              │   │
│  │  - POST   /v1/public/fixed-income                                            │   │
│  │  - PUT    /v1/public/fixed-income/:id                                        │   │
│  │  - DELETE /v1/public/fixed-income/:id                                        │   │
│  └─────────────────────────────────────┬───────────────────────────────────────┘   │
│                                        │                                            │
│  ┌─────────────────────────────────────▼───────────────────────────────────────┐   │
│  │                              MANAGER LAYER                                   │   │
│  │  FixedIncomeManager                                                          │   │
│  │  - create() / update() / delete() / list()                                  │   │
│  │  - calculateInvestment() → orquestra cálculos                               │   │
│  │  - getSummary() → resumo da carteira                                         │   │
│  └──────────┬────────────────────────────────────────────────────────┬──────────┘   │
│             │                                                        │              │
│  ┌──────────▼──────────┐                    ┌────────────────────────▼──────────┐   │
│  │    DAO LAYER        │                    │         CALCULATOR LAYER           │   │
│  │  FixedIncomeDAO     │                    │    FixedIncomeCalculator          │   │
│  │  - create           │                    │  - calculateCDI()                │   │
│  │  - update           │                    │  - calculateIPCA()               │   │
│  │  - softDelete       │                    │  - calculatePrefixado()           │   │
│  │  - findByWallet     │                    │  - countBusinessDays()            │   │
│  └──────────┬──────────┘                    └────────────────┬──────────────────┘   │
│             │                                                │                      │
│  ┌──────────▼──────────┐                    ┌─────────────────▼──────────────────┐   │
│  │    MODEL LAYER      │                    │    ECONOMIC INDEX SERVICE          │   │
│  │  FixedIncome        │                    │  EconomicIndexManager              │   │
│  │  (Mongoose Schema)  │                    │  - getAccumulatedIndex()           │   │
│  │                     │                    │  - getDailyRates()                 │   │
│  └─────────────────────┘                    └────────────────┬──────────────────┘   │
│                                                                │                      │
│                                           ┌────────────────────▼──────────────────┐   │
│                                           │         EXTERNAL APIs                 │   │
│                                           │  ┌─────────────────────────────────┐  │   │
│                                           │  │ BACEN SGS (Primária)            │  │   │
│                                           │  │ - CDI (série 12)                 │  │   │
│                                           │  │ - SELIC (série 11)              │  │   │
│                                           │  │ - IPCA (série 433)              │  │   │
│                                           │  └─────────────────────────────────┘  │   │
│                                           │  ┌─────────────────────────────────┐  │   │
│                                           │  │ BRAPI (Fallback)                │  │   │
│                                           │  │ - CDI, SELIC                    │  │   │
│                                           │  └─────────────────────────────────┘  │   │
│                                           └────────────────────────────────────────┘   │
│                                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                              SCHEDULER LAYER                                  │   │
│  │  EconomicIndexJob (node-cron)                                                │   │
│  │  - Cron: 0 8 * * 1-5 (08:00 BRT, dias úteis)                                 │   │
│  │  - Busca CDI, IPCA, SELIC do dia anterior                                    │   │
│  │  - Persiste no MongoDB + Atualiza cache Redis                                 │   │
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
│  │  Collection: fixedIncomes   │     │  Keys: economic-index:*     │                 │
│  │  Collection: economicIndexes│     │  TTL: 24h                   │                 │
│  └─────────────────────────────┘     └─────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Fluxo de Cálculo - CDI

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           CÁLCULO CDI (Dia a Dia)                                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│   Input: principal=10000, indexerPercentage=110, startDate=2025-01-02              │
│                                                                                     │
│   ┌─────────────────────────────────────────────────────────────────────────────┐  │
│   │ 1. Buscar taxas CDI diárias do período                                       │  │
│   │    GET /economic-index?type=CDI&start=2025-01-02&end=2026-03-27              │  │
│   │    → [0.000407, 0.000412, 0.000398, ...] (taxas diárias)                    │  │
│   └─────────────────────────────────────────────────────────────────────────────┘  │
│                                        │                                            │
│                                        ▼                                            │
│   ┌─────────────────────────────────────────────────────────────────────────────┐  │
│   │ 2. Aplicar percentual do indexador                                          │  │
│   │    percentage = 110 / 100 = 1.10                                             │  │
│   │    dailyFactor = (1 + CDI_diario × percentage)                              │  │
│   └─────────────────────────────────────────────────────────────────────────────┘  │
│                                        │                                            │
│                                        ▼                                            │
│   ┌─────────────────────────────────────────────────────────────────────────────┐  │
│   │ 3. Calcular fator acumulado (multiplicação dia a dia)                       │  │
│   │    fatorAcumulado = Π (1 + CDI_i × 1.10) para cada dia útil i              │  │
│   │    fatorAcumulado = 1.118371 (exemplo após 294 dias úteis)                  │  │
│   └─────────────────────────────────────────────────────────────────────────────┘  │
│                                        │                                            │
│                                        ▼                                            │
│   ┌─────────────────────────────────────────────────────────────────────────────┐  │
│   │ 4. Calcular valor atual                                                      │  │
│   │    valorAtual = principal × fatorAcumulado                                   │  │
│   │    valorAtual = 10000 × 1.118371 = R$ 11.183,71                             │  │
│   └─────────────────────────────────────────────────────────────────────────────┘  │
│                                        │                                            │
│                                        ▼                                            │
│   Output: {                                                                        │
│     currentValue: 11183.71,                                                        │
│     yieldPercentage: 11.84,                                                        │
│     yieldAbsolute: 1183.71,                                                        │
│     businessDays: 294,                                                             │
│     status: 'ATIVO'                                                                │
│   }                                                                                │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Fluxo de Cálculo - IPCA+

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           CÁLCULO IPCA+ (Mês a Mês + Spread)                        │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│   Input: principal=10000, rate=0.06 (6% a.a.), startDate=2025-01-02                │
│                                                                                     │
│   ┌─────────────────────────────────────────────────────────────────────────────┐  │
│   │ 1. Buscar IPCA mensal do período                                             │  │
│   │    GET /economic-index?type=IPCA&start=2025-01&end=2026-03                   │  │
│   │    → [0.0044, 0.0050, 0.0038, ...] (variações mensais)                      │  │
│   └─────────────────────────────────────────────────────────────────────────────┘  │
│                                        │                                            │
│                                        ▼                                            │
│   ┌─────────────────────────────────────────────────────────────────────────────┐  │
│   │ 2. Calcular fator IPCA acumulado                                            │  │
│   │    fatorIPCA = Π (1 + IPCA_mensal_i) para cada mês i                         │  │
│   │    Para meses parciais: pro-rata = (1 + IPCA)^(dias/total_dias)             │  │
│   │    fatorIPCA = 1.0523 (exemplo)                                              │  │
│   └─────────────────────────────────────────────────────────────────────────────┘  │
│                                        │                                            │
│                                        ▼                                            │
│   ┌─────────────────────────────────────────────────────────────────────────────┐  │
│   │ 3. Calcular fator spread (taxa fixa)                                        │  │
│   │    diasUteis = 294                                                           │  │
│   │    fatorSpread = (1 + 0.06)^(294/252) = 1.0698                              │  │
│   └─────────────────────────────────────────────────────────────────────────────┘  │
│                                        │                                            │
│                                        ▼                                            │
│   ┌─────────────────────────────────────────────────────────────────────────────┐  │
│   │ 4. Calcular valor atual                                                      │  │
│   │    valorAtual = principal × fatorIPCA × fatorSpread                         │  │
│   │    valorAtual = 10000 × 1.0523 × 1.0698 = R$ 11.257,56                      │  │
│   └─────────────────────────────────────────────────────────────────────────────┘  │
│                                        │                                            │
│                                        ▼                                            │
│   Output: {                                                                        │
│     currentValue: 11257.56,                                                        │
│     yieldPercentage: 12.58,                                                        │
│     ipcaComponent: 5.23,        // % apenas da inflação                           │
│     spreadComponent: 6.98,       // % apenas do spread                            │
│     businessDays: 294,                                                             │
│     status: 'ATIVO'                                                                │
│   }                                                                                │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Componentes Backend

### 2.1 Models (Mongoose Schemas)

#### `src/app/fixed-income/fixed-income-model.js`

```javascript
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const fixedIncomeSchema = new mongoose.Schema({
  _id: { 
    type: String, 
    required: true, 
    default: uuidv4 
  },
  walletId: { 
    type: String, 
    required: true, 
    ref: 'wallet',
    index: true,
  },
  userId: { 
    type: String, 
    required: true,
    index: true,
  },
  name: { 
    type: String, 
    required: true, 
    trim: true, 
    maxlength: 100 
  },
  type: {
    type: String,
    required: true,
    enum: ['CDI', 'IPCA', 'PREFIXADO'],
    uppercase: true,
  },
  principal: { 
    type: Number, 
    required: true, 
    min: 0.01 
  },
  rate: { 
    type: Number, 
    required: true, 
    default: 0,
    min: 0,
  },
  indexerPercentage: { 
    type: Number, 
    required: true, 
    default: 100,
    min: 0,
  },
  startDate: { 
    type: Date, 
    required: true 
  },
  maturityDate: { 
    type: Date, 
    required: true 
  },
  institution: { 
    type: String, 
    required: true, 
    trim: true, 
    maxlength: 100 
  },
  isDeleted: { 
    type: Boolean, 
    default: false 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
}, { 
  versionKey: false,
  timestamps: false,
})

// Índices para consultas frequentes
fixedIncomeSchema.index({ userId: 1, walletId: 1, isDeleted: 1 })
fixedIncomeSchema.index({ walletId: 1, type: 1 })
fixedIncomeSchema.index({ maturityDate: 1 })

module.exports = { fixedIncomeSchema }
```

#### `src/app/economic-index/economic-index-model.js`

```javascript
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const economicIndexSchema = new mongoose.Schema({
  _id: { 
    type: String, 
    required: true, 
    default: uuidv4 
  },
  indexType: {
    type: String,
    required: true,
    enum: ['CDI', 'IPCA', 'SELIC'],
    uppercase: true,
  },
  value: { 
    type: Number, 
    required: true,
  },
  date: { 
    type: Date, 
    required: true 
  },
  source: { 
    type: String, 
    required: true,
    enum: ['BACEN', 'BRAPI', 'MANUAL'],
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
}, { 
  versionKey: false 
})

// Índice único para evitar duplicatas
economicIndexSchema.index({ indexType: 1, date: 1 }, { unique: true })
economicIndexSchema.index({ date: 1 })

module.exports = { economicIndexSchema }
```

### 2.2 DAOs

#### `src/app/fixed-income/fixed-income-dao.js`

```javascript
const AppDAO = require('../app-dao')
const { fixedIncomeSchema } = require('./fixed-income-model')

class FixedIncomeDAO extends AppDAO {
  constructor(db) {
    super(db)
  }

  initializeDBModel(db) {
    return db.model('fixedIncome', fixedIncomeSchema)
  }

  /**
   * Cria novo investimento
   */
  async create(data) {
    const investment = new this.objectModel(data)
    return await investment.save().then((doc) => doc.toObject())
  }

  /**
   * Atualiza investimento existente
   */
  async update(id, userId, data) {
    return await this.objectModel.findOneAndUpdate(
      { _id: id, userId, isDeleted: false },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean().exec()
  }

  /**
   * Soft delete
   */
  async softDelete(id, userId) {
    return await this.objectModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: { isDeleted: true, updatedAt: new Date() } },
      { new: true }
    ).lean().exec()
  }

  /**
   * Busca por ID
   */
  async findById(id, userId) {
    return await this.objectModel.findOne({
      _id: id,
      userId,
      isDeleted: false,
    }).lean().exec()
  }

  /**
   * Lista investimentos por carteira
   */
  async findByWallet(walletId, userId) {
    return await this.objectModel.find({
      walletId,
      userId,
      isDeleted: false,
    })
    .sort({ createdAt: -1 })
    .lean().exec()
  }

  /**
   * Lista investimentos próximos ao vencimento
   */
  async findNearMaturity(walletId, userId, daysThreshold = 30) {
    const thresholdDate = new Date()
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold)

    return await this.objectModel.find({
      walletId,
      userId,
      isDeleted: false,
      maturityDate: { $lte: thresholdDate, $gte: new Date() },
    })
    .sort({ maturityDate: 1 })
    .lean().exec()
  }

  /**
   * Verifica se carteira pertence ao usuário
   */
  async verifyWalletOwnership(walletId, userId) {
    const count = await this.objectModel.countDocuments({
      walletId,
      userId,
    })
    return count > 0
  }
}

module.exports = FixedIncomeDAO
```

#### `src/app/economic-index/economic-index-dao.js`

```javascript
const AppDAO = require('../app-dao')
const { economicIndexSchema } = require('./economic-index-model')

class EconomicIndexDAO extends AppDAO {
  constructor(db) {
    super(db)
  }

  initializeDBModel(db) {
    return db.model('economicIndex', economicIndexSchema)
  }

  /**
   * Busca taxas diárias por período
   */
  async findDailyRates(indexType, startDate, endDate) {
    return await this.objectModel.find({
      indexType: indexType.toUpperCase(),
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    })
    .sort({ date: 1 })
    .lean().exec()
  }

  /**
   * Busca última taxa disponível
   */
  async findLatest(indexType) {
    return await this.objectModel.findOne({
      indexType: indexType.toUpperCase(),
    })
    .sort({ date: -1 })
    .lean().exec()
  }

  /**
   * Upsert de taxa
   */
  async upsertRate(indexType, value, date, source) {
    return await this.objectModel.findOneAndUpdate(
      {
        indexType: indexType.toUpperCase(),
        date: new Date(date),
      },
      {
        $set: { value, source },
        $setOnInsert: { _id: uuidv4() },
      },
      { upsert: true, new: true }
    ).lean().exec()
  }

  /**
   * Bulk insert para carga histórica
   */
  async bulkUpsert(rates) {
    const bulkOps = rates.map((rate) => ({
      updateOne: {
        filter: {
          indexType: rate.indexType.toUpperCase(),
          date: new Date(rate.date),
        },
        update: {
          $set: { value: rate.value, source: rate.source },
          $setOnInsert: { _id: uuidv4() },
        },
        upsert: true,
      },
    }))

    return await this.objectModel.bulkWrite(bulkOps, { ordered: false })
  }

  /**
   * Verifica se existe histórico
   */
  async hasHistory(indexType) {
    const count = await this.objectModel.countDocuments({
      indexType: indexType.toUpperCase(),
    })
    return count > 0
  }
}

module.exports = EconomicIndexDAO
```

### 2.3 Managers

#### `src/app/fixed-income/fixed-income-manager.js`

```javascript
const FixedIncomeDAO = require('./fixed-income-dao')
const FixedIncomeCalculator = require('./fixed-income-calculator')
const APP_CONSTANTS = require('../app-constants')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app-constants')

const logger = new JsonLog(SERVICE_NAME)

class FixedIncomeManager {
  constructor(appManager, appDB) {
    this.appDB = appDB
    this.config = appManager.config
    this.handleError = appManager.handleError.bind(appManager)
    
    this.fixedIncomeDAO = new FixedIncomeDAO(this.appDB.getDb())
    this.calculator = new FixedIncomeCalculator(appManager.getEconomicIndexManager())
  }

  /**
   * Cria novo investimento
   */
  async create({ domain, data }) {
    // Validações
    this._validateInvestment(data)

    const investment = await this.fixedIncomeDAO.create({
      ...data,
      userId: domain,
      isDeleted: false,
    })

    logger.log('Fixed income investment created', {
      domain,
      internal: { method: 'create', filename: 'fixed-income-manager.js' },
      metadata: { investmentId: investment._id, type: investment.type },
    })

    // Retorna com cálculos
    return await this._enrichWithCalculations(investment)
  }

  /**
   * Atualiza investimento
   */
  async update({ domain, id, data }) {
    const existing = await this.fixedIncomeDAO.findById(id, domain)
    
    if (!existing) {
      this.handleError(APP_CONSTANTS.ERRORS.FIXED_INCOME_NOT_FOUND)
    }

    // Validações
    this._validateInvestment({ ...existing, ...data })

    const updated = await this.fixedIncomeDAO.update(id, domain, data)

    logger.log('Fixed income investment updated', {
      domain,
      internal: { method: 'update', filename: 'fixed-income-manager.js' },
      metadata: { investmentId: id },
    })

    return await this._enrichWithCalculations(updated)
  }

  /**
   * Soft delete
   */
  async delete({ domain, id }) {
    const existing = await this.fixedIncomeDAO.findById(id, domain)
    
    if (!existing) {
      this.handleError(APP_CONSTANTS.ERRORS.FIXED_INCOME_NOT_FOUND)
    }

    await this.fixedIncomeDAO.softDelete(id, domain)

    logger.log('Fixed income investment deleted', {
      domain,
      internal: { method: 'delete', filename: 'fixed-income-manager.js' },
      metadata: { investmentId: id },
    })

    return { message: 'Investimento removido com sucesso' }
  }

  /**
   * Lista investimentos da carteira
   */
  async list({ domain, walletId }) {
    const investments = await this.fixedIncomeDAO.findByWallet(walletId, domain)

    // Enriquece com cálculos
    const enriched = await Promise.all(
      investments.map((inv) => this._enrichWithCalculations(inv))
    )

    return enriched
  }

  /**
   * Obtém resumo da carteira
   */
  async getSummary({ domain, walletId }) {
    const investments = await this.fixedIncomeDAO.findByWallet(walletId, domain)

    const enriched = await Promise.all(
      investments.map((inv) => this._enrichWithCalculations(inv))
    )

    const totalPrincipal = enriched.reduce((sum, inv) => sum + inv.principal, 0)
    const totalCurrent = enriched.reduce((sum, inv) => sum + (inv.calculated?.currentValue || inv.principal), 0)
    const totalYield = totalCurrent - totalPrincipal
    const avgYieldPercentage = totalPrincipal > 0 
      ? (totalYield / totalPrincipal) * 100 
      : 0

    return {
      totalPrincipal,
      totalCurrent,
      totalYield,
      avgYieldPercentage,
      count: enriched.length,
      byType: this._groupByType(enriched),
      nearMaturity: enriched.filter((inv) => inv.isNearMaturity).length,
    }
  }

  /**
   * Valida dados do investimento
   */
  _validateInvestment(data) {
    const validTypes = ['CDI', 'IPCA', 'PREFIXADO']
    
    if (!validTypes.includes(data.type?.toUpperCase())) {
      this.handleError(APP_CONSTANTS.ERRORS.FIXED_INCOME_INVALID_TYPE)
    }

    if (data.principal <= 0) {
      this.handleError(APP_CONSTANTS.ERRORS.FIXED_INCOME_INVALID_PRINCIPAL)
    }

    if (new Date(data.startDate) > new Date(data.maturityDate)) {
      this.handleError(APP_CONSTANTS.ERRORS.FIXED_INCOME_INVALID_DATES)
    }

    // Validações específicas por tipo
    if (data.type === 'PREFIXADO' && (!data.rate || data.rate <= 0)) {
      this.handleError(APP_CONSTANTS.ERRORS.FIXED_INCOME_INVALID_RATE)
    }

    if (data.type === 'CDI' && (!data.indexerPercentage || data.indexerPercentage <= 0)) {
      this.handleError(APP_CONSTANTS.ERRORS.FIXED_INCOME_INVALID_INDEXER)
    }

    if (data.type === 'IPCA' && (!data.rate || data.rate <= 0)) {
      this.handleError(APP_CONSTANTS.ERRORS.FIXED_INCOME_INVALID_RATE)
    }
  }

  /**
   * Enriquece investimento com cálculos
   */
  async _enrichWithCalculations(investment) {
    try {
      let calculated

      switch (investment.type) {
        case 'CDI':
          calculated = await this.calculator.calculateCDI(investment)
          break
        case 'IPCA':
          calculated = await this.calculator.calculateIPCA(investment)
          break
        case 'PREFIXADO':
          calculated = await this.calculator.calculatePrefixado(investment)
          break
        default:
          calculated = null
      }

      // Verifica se está próximo ao vencimento
      const daysToMaturity = Math.ceil(
        (new Date(investment.maturityDate) - new Date()) / (1000 * 60 * 60 * 24)
      )

      return {
        ...investment,
        calculated,
        isNearMaturity: daysToMaturity > 0 && daysToMaturity <= 30,
        daysToMaturity,
      }
    } catch (error) {
      logger.error('Error calculating investment', error, {
        internal: { method: '_enrichWithCalculations', filename: 'fixed-income-manager.js' },
        metadata: { investmentId: investment._id },
      })
      
      return {
        ...investment,
        calculated: null,
        calculationError: error.message,
      }
    }
  }

  /**
   * Agrupa por tipo
   */
  _groupByType(investments) {
    return investments.reduce((acc, inv) => {
      const type = inv.type
      if (!acc[type]) {
        acc[type] = { count: 0, total: 0 }
      }
      acc[type].count++
      acc[type].total += inv.calculated?.currentValue || inv.principal
      return acc
    }, {})
  }
}

module.exports = FixedIncomeManager
```

#### `src/app/fixed-income/fixed-income-calculator.js`

```javascript
const { countBusinessDays } = require('../../utils/business-days')

class FixedIncomeCalculator {
  constructor(economicIndexManager) {
    this.economicIndexManager = economicIndexManager
  }

  /**
   * Cálculo CDI (dia a dia)
   */
  async calculateCDI({ principal, indexerPercentage, startDate, maturityDate }) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const endDate = new Date(Math.min(new Date(maturityDate), today))
    const percentage = indexerPercentage / 100

    // Busca taxas CDI diárias
    const cdiRates = await this.economicIndexManager.getDailyRates('CDI', startDate, endDate)

    if (!cdiRates || cdiRates.length === 0) {
      throw new Error('Dados de CDI não disponíveis para o período')
    }

    // Calcula fator acumulado
    let accumulatedFactor = 1
    for (const rate of cdiRates) {
      accumulatedFactor *= (1 + rate.value * percentage)
    }

    const currentValue = this._round(principal * accumulatedFactor, 2)
    const yieldPercentage = this._round((accumulatedFactor - 1) * 100, 4)
    const yieldAbsolute = this._round(currentValue - principal, 2)

    return {
      currentValue,
      yieldPercentage,
      yieldAbsolute,
      lastUpdateDate: cdiRates[cdiRates.length - 1]?.date,
      status: new Date(maturityDate) <= today ? 'VENCIDO' : 'ATIVO',
      businessDays: cdiRates.length,
      accumulatedFactor: this._round(accumulatedFactor, 8),
    }
  }

  /**
   * Cálculo IPCA+ (mês a mês + spread)
   */
  async calculateIPCA({ principal, rate, startDate, maturityDate }) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const endDate = new Date(Math.min(new Date(maturityDate), today))
    const businessDays = countBusinessDays(startDate, endDate)

    // Fator IPCA acumulado
    const ipcaAccumulated = await this.economicIndexManager.getAccumulatedIndex('IPCA', startDate, endDate)

    if (!ipcaAccumulated || ipcaAccumulated === 1) {
      throw new Error('Dados de IPCA não disponíveis para o período')
    }

    // Fator spread (taxa fixa composta em dias úteis)
    const spreadFactor = Math.pow(1 + rate, businessDays / 252)

    const currentValue = this._round(principal * ipcaAccumulated * spreadFactor, 2)
    const totalFactor = ipcaAccumulated * spreadFactor
    const yieldPercentage = this._round((totalFactor - 1) * 100, 4)
    const yieldAbsolute = this._round(currentValue - principal, 2)

    return {
      currentValue,
      yieldPercentage,
      yieldAbsolute,
      ipcaComponent: this._round((ipcaAccumulated - 1) * 100, 4),
      spreadComponent: this._round((spreadFactor - 1) * 100, 4),
      lastUpdateDate: endDate,
      status: new Date(maturityDate) <= today ? 'VENCIDO' : 'ATIVO',
      businessDays,
      ipcaFactor: this._round(ipcaAccumulated, 8),
      spreadFactor: this._round(spreadFactor, 8),
    }
  }

  /**
   * Cálculo Prefixado (taxa fixa)
   */
  async calculatePrefixado({ principal, rate, startDate, maturityDate }) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const endDate = new Date(Math.min(new Date(maturityDate), today))
    const businessDays = countBusinessDays(startDate, endDate)

    // Fator de juros compostos
    const factor = Math.pow(1 + rate, businessDays / 252)

    const currentValue = this._round(principal * factor, 2)
    const yieldPercentage = this._round((factor - 1) * 100, 4)
    const yieldAbsolute = this._round(currentValue - principal, 2)

    return {
      currentValue,
      yieldPercentage,
      yieldAbsolute,
      annualRate: this._round(rate * 100, 2),
      lastUpdateDate: endDate,
      status: new Date(maturityDate) <= today ? 'VENCIDO' : 'ATIVO',
      businessDays,
      factor: this._round(factor, 8),
    }
  }

  /**
   * Arredondamento
   */
  _round(value, decimals) {
    const factor = Math.pow(10, decimals)
    return Math.round(value * factor) / factor
  }
}

module.exports = FixedIncomeCalculator
```

#### `src/app/economic-index/economic-index-manager.js`

```javascript
const EconomicIndexDAO = require('./economic-index-dao')
const EconomicIndexCache = require('./economic-index-cache')
const EconomicIndexService = require('./economic-index-service')
const APP_CONSTANTS = require('../app-constants')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app-constants')

const logger = new JsonLog(SERVICE_NAME)

class EconomicIndexManager {
  constructor(appManager, appDB) {
    this.appDB = appDB
    this.config = appManager.config
    this.handleError = appManager.handleError.bind(appManager)
    
    this.economicIndexDAO = new EconomicIndexDAO(this.appDB.getDb())
    this.cache = new EconomicIndexCache(appManager.redisClient)
    this.service = new EconomicIndexService(this.config)
  }

  /**
   * Obtém taxas diárias
   */
  async getDailyRates(indexType, startDate, endDate) {
    // Tenta cache primeiro
    const cacheKey = `${indexType}:${startDate}:${endDate}`
    const cached = await this.cache.getAccumulated(cacheKey)
    
    if (cached) {
      return cached
    }

    // Busca do MongoDB
    const rates = await this.economicIndexDAO.findDailyRates(indexType, startDate, endDate)

    // Se não tem dados suficientes, busca da API
    if (rates.length === 0) {
      logger.log('No rates found in DB, fetching from API', {
        internal: { method: 'getDailyRates', filename: 'economic-index-manager.js' },
        metadata: { indexType, startDate, endDate },
      })
      
      // Busca da API e armazena
      const apiRates = await this.service.fetchRates(indexType, startDate, endDate)
      
      if (apiRates.length > 0) {
        await this.economicIndexDAO.bulkUpsert(apiRates)
        return apiRates
      }
    }

    // Armazena no cache
    await this.cache.setAccumulated(cacheKey, rates)

    return rates
  }

  /**
   * Obtém índice acumulado
   */
  async getAccumulatedIndex(indexType, startDate, endDate) {
    // Tenta cache
    const cacheKey = `accumulated:${indexType}:${startDate}:${endDate}`
    const cached = await this.cache.getAccumulated(cacheKey)
    
    if (cached !== null) {
      return cached
    }

    const rates = await this.getDailyRates(indexType, startDate, endDate)

    if (!rates || rates.length === 0) {
      this.handleError(APP_CONSTANTS.ERRORS.ECONOMIC_INDEX_NOT_FOUND)
    }

    // Calcula fator acumulado
    let accumulatedFactor = 1

    if (indexType === 'CDI' || indexType === 'SELIC') {
      // Dia a dia
      for (const rate of rates) {
        accumulatedFactor *= (1 + rate.value)
      }
    } else if (indexType === 'IPCA') {
      // Mês a mês
      for (const rate of rates) {
        accumulatedFactor *= (1 + rate.value)
      }
    }

    // Armazena no cache
    await this.cache.setAccumulated(cacheKey, accumulatedFactor)

    return accumulatedFactor
  }

  /**
   * Atualiza índices (chamado pelo job)
   */
  async updateDailyIndexes() {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const indexTypes = ['CDI', 'IPCA', 'SELIC']

    for (const indexType of indexTypes) {
      try {
        const rates = await this.service.fetchLatestRate(indexType, yesterday)
        
        if (rates) {
          await this.economicIndexDAO.upsertRate(
            indexType,
            rates.value,
            rates.date,
            rates.source
          )

          // Invalida cache
          await this.cache.invalidate(indexType)

          logger.log(`Index ${indexType} updated`, {
            internal: { method: 'updateDailyIndexes', filename: 'economic-index-manager.js' },
            metadata: { value: rates.value, date: rates.date },
          })
        }
      } catch (error) {
        logger.error(`Failed to update ${indexType}`, error, {
          internal: { method: 'updateDailyIndexes', filename: 'economic-index-manager.js' },
        })
      }
    }
  }
}

module.exports = EconomicIndexManager
```

### 2.4 Routers

#### `src/app/fixed-income/fixed-income-router.js`

```javascript
const express = require('express')
const { Authorizer, Permissions } = require('interact-utils')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app-constants')

const logger = new JsonLog(SERVICE_NAME)

class FixedIncomeRouter {
  static handleError(exception, res) {
    logger.error('Fixed income route error', exception, {
      internal: { method: 'handleError', filename: 'fixed-income-router.js' },
    })
    res.status(exception.statusCode || 500).send({
      message: exception.message || 'Server Error',
      code: exception.code || 'INTERNAL_ERROR',
    })
  }

  static getPublicRoutes(appManager) {
    const router = express.Router()
    const manager = appManager.getFixedIncomeManager()

    /**
     * GET /v1/public/fixed-income
     * Lista investimentos da carteira
     */
    router.get('/fixed-income',
      Authorizer.getMiddleware(Permissions.SERVICES),
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const { walletId } = req.query

          if (!walletId) {
            return res.status(400).send({
              message: 'Query param "walletId" is required',
              code: 'MISSING_WALLET_ID',
            })
          }

          const result = await manager.list({ domain, walletId })
          res.status(200).send(result)
        } catch (exception) {
          FixedIncomeRouter.handleError(exception, res)
        }
      })

    /**
     * POST /v1/public/fixed-income
     * Cria novo investimento
     */
    router.post('/fixed-income',
      Authorizer.getMiddleware(Permissions.SERVICES),
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const result = await manager.create({ domain, data: req.body })
          res.status(201).send(result)
        } catch (exception) {
          FixedIncomeRouter.handleError(exception, res)
        }
      })

    /**
     * PUT /v1/public/fixed-income/:id
     * Atualiza investimento
     */
    router.put('/fixed-income/:id',
      Authorizer.getMiddleware(Permissions.SERVICES),
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const { id } = req.params
          const result = await manager.update({ domain, id, data: req.body })
          res.status(200).send(result)
        } catch (exception) {
          FixedIncomeRouter.handleError(exception, res)
        }
      })

    /**
     * DELETE /v1/public/fixed-income/:id
     * Remove investimento (soft delete)
     */
    router.delete('/fixed-income/:id',
      Authorizer.getMiddleware(Permissions.SERVICES),
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const { id } = req.params
          const result = await manager.delete({ domain, id })
          res.status(200).send(result)
        } catch (exception) {
          FixedIncomeRouter.handleError(exception, res)
        }
      })

    /**
     * GET /v1/public/fixed-income/summary
     * Resumo da carteira
     */
    router.get('/fixed-income/summary',
      Authorizer.getMiddleware(Permissions.SERVICES),
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const { walletId } = req.query

          if (!walletId) {
            return res.status(400).send({
              message: 'Query param "walletId" is required',
              code: 'MISSING_WALLET_ID',
            })
          }

          const result = await manager.getSummary({ domain, walletId })
          res.status(200).send(result)
        } catch (exception) {
          FixedIncomeRouter.handleError(exception, res)
        }
      })

    return router
  }
}

module.exports = FixedIncomeRouter
```

---

## 3. Componentes Frontend

### 3.1 Pages

#### `src/pages/fixed-income/FixedIncomePage.vue`

```vue
<template>
  <div class="fixed-income-page">
    <header class="page-header">
      <h1>Renda Fixa</h1>
      <button class="btn-primary" @click="showForm = true">
        + Novo Investimento
      </button>
    </header>

    <FixedIncomeSummary 
      v-if="summary"
      :summary="summary" 
      :loading="loadingSummary"
    />

    <FixedIncomeList
      :investments="investments"
      :loading="loading"
      @edit="onEdit"
      @delete="onDelete"
    />

    <FixedIncomeForm
      v-if="showForm"
      :investment="selectedInvestment"
      :wallet-id="activeWalletId"
      @close="onCloseForm"
      @save="onSave"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useFixedIncomeStore } from '@/stores/fixed-income'
import { useWalletStore } from '@/stores/wallet'
import FixedIncomeList from './FixedIncomeList.vue'
import FixedIncomeForm from './FixedIncomeForm.vue'
import FixedIncomeSummary from './FixedIncomeSummary.vue'

const fixedIncomeStore = useFixedIncomeStore()
const walletStore = useWalletStore()

const showForm = ref(false)
const selectedInvestment = ref(null)

const activeWalletId = computed(() => walletStore.activeWallet?._id)
const investments = computed(() => fixedIncomeStore.investments)
const summary = computed(() => fixedIncomeStore.summary)
const loading = computed(() => fixedIncomeStore.loading)
const loadingSummary = computed(() => fixedIncomeStore.loadingSummary)

const onEdit = (investment) => {
  selectedInvestment.value = investment
  showForm.value = true
}

const onDelete = async (id) => {
  if (confirm('Deseja realmente excluir este investimento?')) {
    await fixedIncomeStore.deleteInvestment(id)
  }
}

const onCloseForm = () => {
  showForm.value = false
  selectedInvestment.value = null
}

const onSave = async (data) => {
  if (selectedInvestment.value) {
    await fixedIncomeStore.updateInvestment(selectedInvestment.value._id, data)
  } else {
    await fixedIncomeStore.createInvestment(data)
  }
  onCloseForm()
}

onMounted(async () => {
  if (activeWalletId.value) {
    await fixedIncomeStore.fetchInvestments(activeWalletId.value)
    await fixedIncomeStore.fetchSummary(activeWalletId.value)
  }
})
</script>
```

### 3.2 Components

#### `src/pages/fixed-income/FixedIncomeList.vue`

```vue
<template>
  <div class="fixed-income-list">
    <div v-if="loading" class="loading-state">
      <span class="skeleton" v-for="i in 3" :key="i"></span>
    </div>

    <div v-else-if="investments.length === 0" class="empty-state">
      <p>Nenhum investimento de renda fixa cadastrado</p>
    </div>

    <!-- Desktop: Tabela -->
    <table v-else class="fixed-income-table desktop-only">
      <thead>
        <tr>
          <th>Nome</th>
          <th>Tipo</th>
          <th>Instituição</th>
          <th>Valor Aplicado</th>
          <th>Valor Atual</th>
          <th>Rendimento</th>
          <th>Vencimento</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="inv in investments" :key="inv._id">
          <td>{{ inv.name }}</td>
          <td>
            <TypeBadge :type="inv.type" />
          </td>
          <td>{{ inv.institution }}</td>
          <td>{{ formatCurrency(inv.principal) }}</td>
          <td>
            <span v-if="inv.calculated">{{ formatCurrency(inv.calculated.currentValue) }}</span>
            <span v-else class="error">Erro no cálculo</span>
          </td>
          <td>
            <YieldDisplay 
              v-if="inv.calculated"
              :percentage="inv.calculated.yieldPercentage"
              :absolute="inv.calculated.yieldAbsolute"
            />
          </td>
          <td>
            <MaturityBadge 
              :date="inv.maturityDate"
              :days-to-maturity="inv.daysToMaturity"
            />
          </td>
          <td>
            <button @click="$emit('edit', inv)" class="btn-icon">✏️</button>
            <button @click="$emit('delete', inv._id)" class="btn-icon">🗑️</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Mobile: Cards -->
    <div class="fixed-income-cards mobile-only">
      <FixedIncomeCard
        v-for="inv in investments"
        :key="inv._id"
        :investment="inv"
        @edit="$emit('edit', inv)"
        @delete="$emit('delete', inv._id)"
      />
    </div>
  </div>
</template>

<script setup>
import TypeBadge from '@/components/fixed-income/TypeBadge.vue'
import YieldDisplay from '@/components/fixed-income/YieldDisplay.vue'
import MaturityBadge from '@/components/fixed-income/MaturityBadge.vue'
import FixedIncomeCard from './FixedIncomeCard.vue'

defineProps({
  investments: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

defineEmits(['edit', 'delete'])

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}
</script>
```

#### `src/pages/fixed-income/FixedIncomeForm.vue`

```vue
<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <header class="modal-header">
        <h2>{{ isEditing ? 'Editar' : 'Novo' }} Investimento</h2>
        <button class="btn-close" @click="$emit('close')">×</button>
      </header>

      <form @submit.prevent="onSubmit" class="fixed-income-form">
        <div class="form-group">
          <label for="name">Nome *</label>
          <input 
            id="name" 
            v-model="form.name" 
            type="text" 
            required
            maxlength="100"
          />
          <span v-if="errors.name" class="error">{{ errors.name }}</span>
        </div>

        <div class="form-group">
          <label for="type">Tipo *</label>
          <select id="type" v-model="form.type" required @change="onTypeChange">
            <option value="">Selecione...</option>
            <option value="CDI">CDI</option>
            <option value="IPCA">IPCA+</option>
            <option value="PREFIXADO">Prefixado</option>
          </select>
        </div>

        <div class="form-group">
          <label for="principal">Valor Aplicado *</label>
          <input 
            id="principal" 
            v-model.number="form.principal" 
            type="number"
            step="0.01"
            min="0.01"
            required
          />
        </div>

        <!-- Campo dinâmico: % do CDI -->
        <div v-if="form.type === 'CDI'" class="form-group">
          <label for="indexerPercentage">% do CDI *</label>
          <input 
            id="indexerPercentage" 
            v-model.number="form.indexerPercentage" 
            type="number"
            step="0.01"
            min="0.01"
            required
          />
          <span class="hint">Ex: 110 para 110% do CDI</span>
        </div>

        <!-- Campo dinâmico: Taxa fixa -->
        <div v-if="form.type === 'IPCA' || form.type === 'PREFIXADO'" class="form-group">
          <label for="rate">Taxa Fixa Anual (%) *</label>
          <input 
            id="rate" 
            v-model.number="form.rate" 
            type="number"
            step="0.01"
            min="0.01"
            required
          />
          <span class="hint">Ex: 6 para 6% ao ano</span>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="startDate">Data Início *</label>
            <input 
              id="startDate" 
              v-model="form.startDate" 
              type="date"
              required
            />
          </div>

          <div class="form-group">
            <label for="maturityDate">Data Vencimento *</label>
            <input 
              id="maturityDate" 
              v-model="form.maturityDate" 
              type="date"
              required
            />
          </div>
        </div>

        <div class="form-group">
          <label for="institution">Instituição *</label>
          <input 
            id="institution" 
            v-model="form.institution" 
            type="text"
            required
            maxlength="100"
          />
        </div>

        <div class="form-actions">
          <button type="button" class="btn-secondary" @click="$emit('close')">
            Cancelar
          </button>
          <button type="submit" class="btn-primary" :disabled="!isFormValid">
            {{ isEditing ? 'Salvar' : 'Criar' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  investment: { type: Object, default: null },
  walletId: { type: String, required: true },
})

const emit = defineEmits(['close', 'save'])

const isEditing = computed(() => !!props.investment)

const form = ref({
  name: '',
  type: '',
  principal: null,
  rate: null,
  indexerPercentage: 100,
  startDate: '',
  maturityDate: '',
  institution: '',
  walletId: props.walletId,
})

const errors = ref({})

// Preenche formulário se estiver editando
watch(() => props.investment, (inv) => {
  if (inv) {
    form.value = {
      ...inv,
      startDate: inv.startDate?.split('T')[0] || '',
      maturityDate: inv.maturityDate?.split('T')[0] || '',
    }
  }
}, { immediate: true })

const isFormValid = computed(() => {
  return form.value.name &&
    form.value.type &&
    form.value.principal > 0 &&
    form.value.startDate &&
    form.value.maturityDate &&
    form.value.institution &&
    form.value.startDate <= form.value.maturityDate
})

const onTypeChange = () => {
  // Reseta campos específicos ao mudar tipo
  if (form.value.type === 'CDI') {
    form.value.rate = 0
    form.value.indexerPercentage = 100
  } else {
    form.value.indexerPercentage = 100
  }
}

const onSubmit = () => {
  const data = {
    ...form.value,
    walletId: props.walletId,
  }
  emit('save', data)
}
</script>
```

### 3.3 Services

#### `src/services/fixed-income.service.js`

```javascript
import axios from 'axios'

const API_BASE = '/v1/public'

export const fixedIncomeService = {
  /**
   * Lista investimentos da carteira
   */
  async list(walletId) {
    const response = await axios.get(`${API_BASE}/fixed-income`, {
      params: { walletId },
    })
    return response.data
  },

  /**
   * Obtém resumo
   */
  async getSummary(walletId) {
    const response = await axios.get(`${API_BASE}/fixed-income/summary`, {
      params: { walletId },
    })
    return response.data
  },

  /**
   * Cria investimento
   */
  async create(data) {
    const response = await axios.post(`${API_BASE}/fixed-income`, data)
    return response.data
  },

  /**
   * Atualiza investimento
   */
  async update(id, data) {
    const response = await axios.put(`${API_BASE}/fixed-income/${id}`, data)
    return response.data
  },

  /**
   * Remove investimento
   */
  async delete(id) {
    const response = await axios.delete(`${API_BASE}/fixed-income/${id}`)
    return response.data
  },
}
```

### 3.4 Store/State

#### `src/stores/fixed-income.js` (Pinia)

```javascript
import { defineStore } from 'pinia'
import { fixedIncomeService } from '@/services/fixed-income.service'

export const useFixedIncomeStore = defineStore('fixedIncome', {
  state: () => ({
    investments: [],
    summary: null,
    loading: false,
    loadingSummary: false,
    error: null,
  }),

  actions: {
    async fetchInvestments(walletId) {
      this.loading = true
      this.error = null
      
      try {
        this.investments = await fixedIncomeService.list(walletId)
      } catch (error) {
        this.error = error.message
      } finally {
        this.loading = false
      }
    },

    async fetchSummary(walletId) {
      this.loadingSummary = true
      
      try {
        this.summary = await fixedIncomeService.getSummary(walletId)
      } catch (error) {
        console.error('Error fetching summary:', error)
      } finally {
        this.loadingSummary = false
      }
    },

    async createInvestment(data) {
      this.loading = true
      
      try {
        const newInvestment = await fixedIncomeService.create(data)
        this.investments.unshift(newInvestment)
        return newInvestment
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    async updateInvestment(id, data) {
      this.loading = true
      
      try {
        const updated = await fixedIncomeService.update(id, data)
        const index = this.investments.findIndex((inv) => inv._id === id)
        if (index !== -1) {
          this.investments[index] = updated
        }
        return updated
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    async deleteInvestment(id) {
      this.loading = true
      
      try {
        await fixedIncomeService.delete(id)
        this.investments = this.investments.filter((inv) => inv._id !== id)
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },
  },
})
```

---

## 4. API Contracts

### 4.1 GET /v1/public/fixed-income

**Descrição**: Lista investimentos de renda fixa da carteira

**Query Parameters**:
| Nome | Tipo | Obrigatório | Descrição |
|------|------|--------------|-----------|
| walletId | string | Sim | ID da carteira |

**Response 200**:
```json
[
  {
    "_id": "uuid",
    "walletId": "uuid",
    "userId": "uuid",
    "name": "CDB Banco XYZ",
    "type": "CDI",
    "principal": 10000,
    "rate": 0,
    "indexerPercentage": 110,
    "startDate": "2025-01-15T00:00:00.000Z",
    "maturityDate": "2027-01-15T00:00:00.000Z",
    "institution": "Banco XYZ",
    "isDeleted": false,
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z",
    "calculated": {
      "currentValue": 11183.71,
      "yieldPercentage": 11.84,
      "yieldAbsolute": 1183.71,
      "lastUpdateDate": "2026-03-26T00:00:00.000Z",
      "status": "ATIVO",
      "businessDays": 294
    },
    "isNearMaturity": false,
    "daysToMaturity": 664
  }
]
```

### 4.2 POST /v1/public/fixed-income

**Request Body**:
```json
{
  "walletId": "uuid",
  "name": "CDB Banco XYZ",
  "type": "CDI",
  "principal": 10000,
  "indexerPercentage": 110,
  "startDate": "2025-01-15",
  "maturityDate": "2027-01-15",
  "institution": "Banco XYZ"
}
```

**Response 201**: Retorna objeto do investimento criado com cálculos

### 4.3 GET /v1/public/fixed-income/summary

**Response 200**:
```json
{
  "totalPrincipal": 50000,
  "totalCurrent": 56250.50,
  "totalYield": 6250.50,
  "avgYieldPercentage": 12.50,
  "count": 5,
  "byType": {
    "CDI": { "count": 2, "total": 25000 },
    "IPCA": { "count": 2, "total": 20000 },
    "PREFIXADO": { "count": 1, "total": 11250.50 }
  },
  "nearMaturity": 1
}
```

---

## 5. Fluxos de Dados

### 5.1 Diagrama de Sequência - Criar Investimento

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────────┐     ┌─────────────┐
│ Frontend│     │ Router  │     │ Manager │     │ Calculator  │     │ EconomicIdx │
└────┬────┘     └────┬────┘     └────┬────┘     └──────┬──────┘     └──────┬──────┘
     │               │               │                 │                    │
     │ POST /fixed-income            │                 │                    │
     │ { type: CDI, ... }            │                 │                    │
     │──────────────►│               │                 │                    │
     │               │               │                 │                    │
     │               │ create()      │                 │                    │
     │               │──────────────►│                 │                    │
     │               │               │                 │                    │
     │               │               │ _validate()    │                    │
     │               │               │─────────────────────────────────────│
     │               │               │                 │                    │
     │               │               │ DAO.create()   │                    │
     │               │               │─────────────────────────────────────│
     │               │               │     (MongoDB)  │                    │
     │               │               │                 │                    │
     │               │               │ _enrichWithCalculations()            │
     │               │               │────────────────►│                    │
     │               │               │                 │                    │
     │               │               │                 │ calculateCDI()     │
     │               │               │                 │───────────────────►│
     │               │               │                 │                    │
     │               │               │                 │ getDailyRates()    │
     │               │               │                 │───────────────────►│
     │               │               │                 │                    │
     │               │               │                 │ [CDI rates]        │
     │               │               │                 │◄───────────────────│
     │               │               │                 │                    │
     │               │               │                 │ { currentValue,    │
     │               │               │                 │   yieldPercentage }│
     │               │               │◄────────────────│                    │
     │               │               │                 │                    │
     │               │ { investment + calculated }    │                    │
     │◄──────────────│               │                 │                    │
     │               │               │                 │                    │
```

---

## 6. Estrutura de Arquivos

```
src/
├── app/
│   ├── fixed-income/
│   │   ├── fixed-income-router.js
│   │   ├── fixed-income-manager.js
│   │   ├── fixed-income-dao.js
│   │   ├── fixed-income-model.js
│   │   └── fixed-income-calculator.js
│   │
│   ├── economic-index/
│   │   ├── economic-index-router.js
│   │   ├── economic-index-manager.js
│   │   ├── economic-index-dao.js
│   │   ├── economic-index-model.js
│   │   ├── economic-index-cache.js
│   │   ├── economic-index-service.js
│   │   └── economic-index-job.js
│   │
│   ├── app-constants.js
│   ├── app-manager.js
│   └── app-service.js
│
├── utils/
│   └── business-days.js
│
├── __tests__/
│   ├── fixed-income.test.js
│   ├── fixed-income-calculator.test.js
│   └── economic-index.test.js
│
└── frontend/
    └── src/
        ├── pages/fixed-income/
        │   ├── FixedIncomePage.vue
        │   ├── FixedIncomeList.vue
        │   ├── FixedIncomeForm.vue
        │   ├── FixedIncomeCard.vue
        │   └── FixedIncomeSummary.vue
        │
        ├── components/fixed-income/
        │   ├── TypeBadge.vue
        │   ├── YieldDisplay.vue
        │   └── MaturityBadge.vue
        │
        ├── stores/
        │   └── fixed-income.js
        │
        └── services/
            └── fixed-income.service.js
```

---

## 7. Ordem de Implementação

### Fase 1: Infraestrutura (Sprint N)
| Ordem | Story | Componente | Estimativa | Dependências |
|-------|-------|------------|------------|-------------|
| 1 | EP07-S01 | Model + DAO + Router | 8 pts | EP02, EP03 |
| 2 | EP07-S02 | Economic Index (Model + DAO + Service) | 13 pts | EP13, EP14 |

### Fase 2: Cálculos (Sprint N+1)
| Ordem | Story | Componente | Estimativa | Dependências |
|-------|-------|------------|------------|-------------|
| 3 | EP07-S05 | Calculator Prefixado | 3 pts | EP07-S01 |
| 4 | EP07-S03 | Calculator CDI | 5 pts | EP07-S01, EP07-S02 |
| 5 | EP07-S04 | Calculator IPCA+ | 8 pts | EP07-S01, EP07-S02 |

### Fase 3: Frontend (Sprint N+2)
| Ordem | Story | Componente | Estimativa | Dependências |
|-------|-------|------------|------------|-------------|
| 6 | EP07-S06 | Frontend completo | 13 pts | EP07-S01 a S05, EP16, EP28 |

**Total**: 50 story points

---

## 8. Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|--------|-----------|
| API BACEN fora do ar | Média | Alto | Fallback BRAPI + dados armazenados (tolerância 3 dias) |
| IPCA publicado com atraso | Alta | Médio | Nunca projetar IPCA. Calcular apenas com dados oficiais |
| Imprecisão por arredondamento | Baixa | Alto | Aritmética de ponto flutuante, round() apenas no final |
| Calendário de feriados desatualizado | Média | Médio | Biblioteca `@brazilian-utils/brazilian-utils` ou tabela interna |
| Volume de índices cresce | Baixa | Baixo | ~1500 registros/tipo desde 2020, crescimento linear gerenciável |

---

## 9. Dependências

### Dependências Externas (NPM)
```json
{
  "dependencies": {
    "node-cron": "^3.0.0",
    "axios": "^1.6.0",
    "@brazilian-utils/brazilian-utils": "^1.0.0"
  }
}
```

### Dependências de Épicos
| Épico | Dependência | Tipo |
|-------|-------------|------|
| EP02 | Autenticação JWT | Bloqueante |
| EP03 | Carteiras | Bloqueante |
| EP13 | Fontes de Dados | Relacionado |
| EP14 | Job Scheduling | Relacionado |
| EP16 | Layout Base | Bloqueante (S06) |
| EP28 | Responsividade | Bloqueante (S06) |

---

## 10. Checklist de Implementação

### Backend
- [ ] Criar `fixed-income-model.js` com schema e índices
- [ ] Criar `economic-index-model.js` com schema e índices
- [ ] Implementar `FixedIncomeDAO` com CRUD
- [ ] Implementar `EconomicIndexDAO` com queries
- [ ] Implementar `FixedIncomeCalculator` com 3 tipos
- [ ] Implementar `EconomicIndexManager` com cache
- [ ] Implementar `EconomicIndexService` com fallback
- [ ] Implementar `EconomicIndexJob` (scheduler)
- [ ] Criar `FixedIncomeRouter` com endpoints
- [ ] Criar `FixedIncomeManager` com validações
- [ ] Criar utilitário `business-days.js`
- [ ] Adicionar constantes de erro
- [ ] Testes unitários (Calculator, DAO)
- [ ] Testes de integração (API)

### Frontend
- [ ] Criar `FixedIncomePage.vue`
- [ ] Criar `FixedIncomeList.vue`
- [ ] Criar `FixedIncomeForm.vue`
- [ ] Criar `FixedIncomeCard.vue`
- [ ] Criar `FixedIncomeSummary.vue`
- [ ] Criar componentes auxiliares (TypeBadge, YieldDisplay, MaturityBadge)
- [ ] Criar store Pinia
- [ ] Criar service
- [ ] Testes unitários
- [ ] Testes E2E

---

**Status**: Pronto para implementação
**Próximos passos**: Delegar para @tech-lead iniciar EP07-S01 e EP07-S02 em paralelo

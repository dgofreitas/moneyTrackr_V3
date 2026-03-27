# Plano Tecnico - EP14: Atualizacao de Dados de Mercado

## 1. Visao Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    FRONTEND (Vue 3 PWA)                                     │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ LiveIndicator    │  │ LastUpdateBadge  │  │ MarketStatusBadge│  │ StaleDataWarning  │   │
│  │ "AO VIVO" / "24/7"│  │ "Atualizado ha X"│  │ "Mercado Aberto" │  │ "Dados desatual." │   │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘   │
│           │                     │                     │                     │             │
│           └─────────────────────┼─────────────────────┼─────────────────────┘             │
│                                 │                     │                                   │
│                    ┌────────────▼────────────┐  ┌─────▼─────────────┐                     │
│                    │   useRealtimeUpdates.js │  │ useMarketStatus.js│                     │
│                    │   - WebSocket client    │  │ - GET /market/status│                    │
│                    │   - Auto-reconnect      │  │ - Polling 60s      │                     │
│                    │   - Channel subscribe   │  └────────────────────┘                     │
│                    └────────────┬────────────┘                                              │
└─────────────────────────────────┼───────────────────────────────────────────────────────────┘
                                  │ WebSocket/SSE
                                  │ ws://api/realtime/ws
┌─────────────────────────────────┼───────────────────────────────────────────────────────────┐
│                           BACKEND (Node.js/Express)                                         │
├─────────────────────────────────┼───────────────────────────────────────────────────────────┤
│                                 │                                                           │
│  ┌──────────────────────────────┼──────────────────────────────────────────────────────┐   │
│  │                         REALTIME SERVICE                                            │   │
│  │  ┌───────────────────┐  ┌────▼────────────┐  ┌────────────────────┐                │   │
│  │  │ realtime-service.js│  │ websocket-     │  │ sse-handler.js     │                │   │
│  │  │ - Redis subscribe  │  │   handler.js   │  │ - SSE endpoint     │                │   │
│  │  │ - Broadcast msgs   │  │ - WS server    │  │ - Fallback         │                │   │
│  │  └─────────────────────┘  └────────────────┘  └────────────────────┘                │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                 ▲                                                           │
│                                 │ publish                                                   │
│  ┌──────────────────────────────┼──────────────────────────────────────────────────────┐   │
│  │                         SCHEDULER SERVICE                                           │   │
│  │  ┌───────────────────────────┼────────────────────────────────────────────────┐    │   │
│  │  │                    scheduler-service.js                                      │    │   │
│  │  │  - node-cron jobs                                                           │    │   │
│  │  │  - Config persistence (Redis)                                               │    │   │
│  │  │  - Job status tracking                                                      │    │   │
│  │  └───────────────────────────┬────────────────────────────────────────────────┘    │   │
│  │                              │                                                      │   │
│  │    ┌─────────────────────────┼─────────────────────────┐                           │   │
│  │    │                         │                         │                           │   │
│  │  ┌─▼──────────────┐  ┌───────▼──────────┐  ┌──────────▼─────────┐                   │   │
│  │  │ stock-update-  │  │ fixed-income-    │  │ crypto-update-     │                   │   │
│  │  │   job.js       │  │   job.js         │  │   job.js           │                   │   │
│  │  │ */15 10-17     │  │ 0 9 * * 1-5      │  │ */1 * * * *        │                   │   │
│  │  │ (market hours) │  │ (daily BCB)      │  │ (24/7)             │                   │   │
│  │  └───────┬────────┘  └────────┬─────────┘  └──────────┬─────────┘                   │   │
│  │          │                    │                       │                             │   │
│  │  ┌───────▼────────────────────▼───────────────────────▼────────┐                   │   │
│  │  │                    market-hours.js                          │                   │   │
│  │  │  - B3 hours detection (10h-17h)                              │                   │   │
│  │  │  - Holiday calendar                                          │                   │   │
│  │  │  - Special sessions (Natal, Ano Novo)                        │                   │   │
│  │  └──────────────────────────────────────────────────────────────┘                   │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                 │                                                           │
│  ┌──────────────────────────────┼──────────────────────────────────────────────────────┐   │
│  │                         UPDATE QUEUE (Bull/Redis)                                   │   │
│  │  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐               │   │
│  │  │ stock-updates     │  │ fixed-income-     │  │ crypto-updates    │               │   │
│  │  │ Queue             │  │ updates Queue     │  │ Queue             │               │   │
│  │  │ concurrency: 1    │  │ concurrency: 1    │  │ concurrency: 3    │               │   │
│  │  └─────────┬─────────┘  └─────────┬─────────┘  └─────────┬─────────┘               │   │
│  │            │                      │                      │                           │   │
│  │  ┌─────────▼──────────────────────▼──────────────────────▼────────┐               │   │
│  │  │                    queue-manager.js                            │               │   │
│  │  │  - Bull queues                                                 │               │   │
│  │  │  - Job scheduling                                              │               │   │
│  │  │  - Retry with exponential backoff                              │               │   │
│  │  └─────────────────────────────────────────────────────────────────┘               │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                 │                                                           │
│  ┌──────────────────────────────┼──────────────────────────────────────────────────────┐   │
│  │                         RATE LIMITER & CIRCUIT BREAKER                              │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────────┐  │   │
│  │  │  rate-limiter.js                    │  circuit-breaker.js                      │  │   │
│  │  │  - Brapi: 3 req/min (free)         │  - Failure threshold: 5                 │  │   │
│  │  │  - CoinGecko: 10 req/min (free)    │  - Reset timeout: 60s                   │  │   │
│  │  │  - BCB: 60 req/min                 │  - States: CLOSED, OPEN, HALF_OPEN      │  │   │
│  │  └───────────────────────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                 │                                                           │
│  ┌──────────────────────────────┼──────────────────────────────────────────────────────┐   │
│  │                         DATA PROVIDERS (EP13)                                       │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐  │   │
│  │  │ BrapiProvider   │  │ YahooFinance    │  │ CoinGecko       │  │ BCBProvider   │  │   │
│  │  │ (B3 stocks)     │  │ (Internacionais)│  │ (Crypto)        │  │ (Indices)     │  │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  └───────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
           │                     │                     │                     │
     ┌─────▼─────┐         ┌─────▼─────┐         ┌─────▼─────┐          ┌─────▼─────┐
     │   Redis   │         │  MongoDB  │         │ APIs Ext. │          │  Redis    │
     │  Pub/Sub  │         │ Positions │         │ Brapi     │          │  Cache    │
     │  Channels │         │ Prices    │         │ CoinGecko │          │  TTL 60s  │
     └───────────┘         └───────────┘         │ BCB       │          └───────────┘
                                                 └───────────┘
```

### Diagrama de Fluxo de Atualizacao

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                         FLUXO DE ATUALIZACAO DE PRECOS                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

  Scheduler Service                    Queue System                    Data Layer
  ─────────────────                    ────────────                    ──────────

  ┌─────────────────┐
  │ node-cron       │
  │ */15 10-17 * *  │
  │ 1-5 (STOCK)     │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐     ┌─────────────────┐
  │ Market Hours    │────▶│ Is Market Open? │
  │ Detection       │     └────────┬────────┘
  └─────────────────┘              │
                          ┌───────┴───────┐
                          │               │
                     YES  │               │ NO
                          ▼               ▼
                   ┌──────────────┐ ┌──────────────┐
                   │ Get Active   │ │ Skip Update  │
                   │ Tickers      │ │ Log & Return │
                   └──────┬───────┘ └──────────────┘
                          │
                          ▼
           ┌──────────────────────────────┐
           │ QueueManager.addJob(STOCK,   │
           │   { tickers: [...] })        │
           └──────────────┬───────────────┘
                          │
                          ▼
  ┌─────────────────────────────────────────────────────────────────────────────────────────┐
  │                              BULL QUEUE (stock-updates)                                 │
  │                                                                                         │
  │  Job { id, data: { tickers }, attempts: 0, maxAttempts: 5 }                            │
  │                                                                                         │
  │  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
  │  │                           PROCESSOR (concurrency: 1)                            │   │
  │  │                                                                                  │   │
  │  │  1. BatchHandler.createBatches(tickers, batchSize: 50)                          │   │
  │  │                                                                                  │   │
  │  │  FOR EACH batch:                                                                 │   │
  │  │    ┌─────────────────────────────────────────────────────────────────────────┐   │   │
  │  │    │ 2. RateLimiter.waitForSlot()                                             │   │   │
  │  │    │    - Check requests in window (3 req/min Brapi)                          │   │   │
  │  │    │    - Wait if limit reached                                                │   │   │
  │  │    └─────────────────────────────────────────────────────────────────────────┘   │   │
  │  │             │                                                                     │   │
  │  │             ▼                                                                     │   │
  │  │    ┌─────────────────────────────────────────────────────────────────────────┐   │   │
  │  │    │ 3. CircuitBreaker.execute(async () => {                                   │   │   │
  │  │    │      return BrapiProvider.getBatchPrices(batch)                          │   │   │
  │  │    │    })                                                                     │   │   │
  │  │    │    - If 5 consecutive failures: OPEN circuit (60s)                       │   │   │
  │  │    │    - Try fallback provider (YahooFinance)                                │   │   │
  │  │    └─────────────────────────────────────────────────────────────────────────┘   │   │
  │  │             │                                                                     │   │
  │  │             ▼                                                                     │   │
  │  │    ┌─────────────────────────────────────────────────────────────────────────┐   │   │
  │  │    │ 4. Save Prices                                                           │   │   │
  │  │    │    - Redis: SET stock:price:{ticker} (TTL 60s)                           │   │   │
  │  │    │    - MongoDB: INSERT price_history                                       │   │   │
  │  │    └─────────────────────────────────────────────────────────────────────────┘   │   │
  │  │             │                                                                     │   │
  │  │             ▼                                                                     │   │
  │  │    ┌─────────────────────────────────────────────────────────────────────────┐   │   │
  │  │    │ 5. Delay between batches (20s)                                          │   │   │
  │  │    └─────────────────────────────────────────────────────────────────────────┘   │   │
  │  │                                                                                  │   │
  │  └──────────────────────────────────────────────────────────────────────────────────┘   │
  │             │                                                                           │
  │             ▼                                                                           │
  │  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
  │  │ 6. Publish Update Event                                                         │   │
  │  │    RedisClient.publish('stock:updates', {                                       │   │
  │  │      type: 'STOCK_PRICES_UPDATED',                                              │   │
  │  │      tickers: [...],                                                            │   │
  │  │      timestamp: ISO                                                             │   │
  │  │    })                                                                           │   │
  │  └─────────────────────────────────────────────────────────────────────────────────┘   │
  │                                                                                         │
  └─────────────────────────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
  ┌─────────────────────────────────────────────────────────────────────────────────────────┐
  │                         REALTIME SERVICE (WebSocket/SSE)                                 │
  │                                                                                         │
  │  RedisClient.subscribe('stock:updates', (message) => {                                 │
  │    broadcast('stock:updates', message)                                                  │
  │  })                                                                                     │
  │                                                                                         │
  │  Connected Clients:                                                                     │
  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                                     │
  │  │ Client 1    │  │ Client 2    │  │ Client N    │                                     │
  │  │ WS/SSE      │  │ WS/SSE      │  │ WS/SSE      │                                     │
  │  │ subscribed: │  │ subscribed: │  │ subscribed: │                                     │
  │  │ stock:updates│ │ stock:updates│ │ crypto:updates│                                   │
  │  └─────────────┘  └─────────────┘  └─────────────┘                                     │
  │                                                                                         │
  └─────────────────────────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
  ┌─────────────────────────────────────────────────────────────────────────────────────────┐
  │                              FRONTEND                                                   │
  │                                                                                         │
  │  useRealtimeUpdates(['stock:updates'])                                                 │
  │    .onMessage((msg) => {                                                               │
  │      updatePrices(msg.tickers)                                                          │
  │      updateLastUpdateIndicator(msg.timestamp)                                           │
  │    })                                                                                   │
  │                                                                                         │
  │  UI Updates:                                                                            │
  │  - Price values animate (fade-in)                                                       │
  │  - "Ultima atualizacao: ha X segundos" resets                                           │
  │  - LiveIndicator pulses green                                                           │
  │                                                                                         │
  └─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Componentes Backend

### 2.1 Scheduler Service

**Arquivo:** `src/app/scheduler/scheduler-service.js`

```javascript
const cron = require('node-cron')
const cronParser = require('cron-parser')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app-constants')
const logger = new JsonLog(SERVICE_NAME)

class SchedulerService {
  constructor(appManager, redisClient) {
    this.appManager = appManager
    this.redisClient = redisClient
    this.jobs = new Map()
    this.defaultConfigs = {
      STOCK: {
        cron: '*/15 10-17 * * 1-5',
        enabled: true,
        description: 'Acoes B3 - a cada 15 min em horario de mercado',
      },
      FIXED_INCOME: {
        cron: '0 9 * * 1-5',
        enabled: true,
        description: 'Renda Fixa - diario 9h apos divulgacao BCB',
      },
      CRYPTO: {
        cron: '*/1 * * * *',
        enabled: true,
        description: 'Criptomoedas - a cada 1 min, 24/7',
      },
    }
  }

  async initialize() {
    logger.log('Scheduler Service initializing', {
      internal: { method: 'initialize', filename: 'scheduler-service.js' },
    })

    // Carregar configuracoes do Redis ou usar defaults
    const configs = await this.loadConfigs()

    // Registrar jobs
    for (const [assetType, config] of Object.entries(configs)) {
      if (config.enabled) {
        await this.registerJob(assetType, config.cron)
      }
    }

    logger.log('Scheduler Service initialized', {
      internal: { method: 'initialize', filename: 'scheduler-service.js' },
      jobs: Array.from(this.jobs.keys()),
    })
  }

  async registerJob(assetType, cronExpression) {
    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`)
    }

    const jobHandler = this.getJobHandler(assetType)
    const task = cron.schedule(cronExpression, async () => {
      await this.executeJob(assetType, jobHandler)
    }, {
      scheduled: true,
      timezone: 'America/Sao_Paulo',
    })

    this.jobs.set(assetType, {
      task,
      cronExpression,
      lastRun: null,
      nextRun: this.getNextRun(cronExpression),
      successCount: 0,
      errorCount: 0,
      lastError: null,
    })

    logger.log(`Job ${assetType} registered`, {
      internal: { method: 'registerJob', filename: 'scheduler-service.js' },
      assetType,
      cronExpression,
    })
  }

  getJobHandler(assetType) {
    const handlers = {
      STOCK: new (require('./jobs/stock-update-job'))(this.appManager),
      FIXED_INCOME: new (require('./jobs/fixed-income-job'))(this.appManager),
      CRYPTO: new (require('./jobs/crypto-update-job'))(this.appManager),
    }
    return handlers[assetType]
  }

  async executeJob(assetType, jobHandler) {
    const job = this.jobs.get(assetType)
    const startTime = Date.now()

    try {
      logger.log(`Job ${assetType} started`, {
        internal: { method: 'executeJob', filename: 'scheduler-service.js' },
        assetType,
      })

      const result = await jobHandler.execute()

      job.lastRun = new Date()
      job.nextRun = this.getNextRun(job.cronExpression)
      job.successCount++
      job.lastResult = result

      // Persistir execucao no MongoDB
      await this.recordExecution(assetType, 'SUCCESS', result, Date.now() - startTime)

      logger.log(`Job ${assetType} completed`, {
        internal: { method: 'executeJob', filename: 'scheduler-service.js' },
        assetType,
        duration: Date.now() - startTime,
        tickersUpdated: result.tickersUpdated || 0,
      })
    } catch (error) {
      job.errorCount++
      job.lastError = error.message

      await this.recordExecution(assetType, 'ERROR', { error: error.message }, Date.now() - startTime)

      logger.error(`Job ${assetType} failed`, error, {
        internal: { method: 'executeJob', filename: 'scheduler-service.js' },
        assetType,
      })
    }
  }

  getNextRun(cronExpression) {
    try {
      const interval = cronParser.parseExpression(cronExpression, {
        timezone: 'America/Sao_Paulo',
      })
      return interval.next().toDate()
    } catch (error) {
      return null
    }
  }

  async loadConfigs() {
    try {
      const saved = await this.redisClient.get('scheduler:configs')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (error) {
      logger.error('Error loading configs from Redis', error, {
        internal: { method: 'loadConfigs', filename: 'scheduler-service.js' },
      })
    }
    return this.defaultConfigs
  }

  async saveConfigs(configs) {
    await this.redisClient.set('scheduler:configs', JSON.stringify(configs))
  }

  async updateConfig(assetType, config) {
    const configs = await this.loadConfigs()
    configs[assetType] = { ...configs[assetType], ...config }
    await this.saveConfigs(configs)

    // Re-registrar job se estiver rodando
    if (this.jobs.has(assetType)) {
      this.jobs.get(assetType).task.stop()
      this.jobs.delete(assetType)
    }

    if (config.enabled !== false) {
      await this.registerJob(assetType, config.cron || configs[assetType].cron)
    }

    logger.log(`Job ${assetType} config updated`, {
      internal: { method: 'updateConfig', filename: 'scheduler-service.js' },
      assetType,
      config,
    })
  }

  getStatus() {
    const status = {}
    for (const [assetType, job] of this.jobs) {
      status[assetType] = {
        running: true,
        cronExpression: job.cronExpression,
        lastRun: job.lastRun,
        nextRun: job.nextRun,
        successCount: job.successCount,
        errorCount: job.errorCount,
        lastError: job.lastError,
      }
    }
    return status
  }

  async recordExecution(assetType, status, result, durationMs) {
    const JobExecutionDAO = require('./job-execution-dao')
    const jobExecutionDAO = new JobExecutionDAO(this.appManager.getDb())

    await jobExecutionDAO.create({
      assetType,
      status,
      startTime: new Date(Date.now() - durationMs),
      endTime: new Date(),
      durationMs,
      tickersUpdated: result.tickersUpdated || 0,
      tickersFailed: result.tickersFailed || 0,
      metadata: result,
    })
  }

  async shutdown() {
    for (const [assetType, job] of this.jobs) {
      job.task.stop()
      logger.log(`Job ${assetType} stopped`, {
        internal: { method: 'shutdown', filename: 'scheduler-service.js' },
      })
    }
    this.jobs.clear()
  }
}

module.exports = SchedulerService
```

### 2.2 Jobs por Tipo de Ativo

**Arquivo:** `src/app/scheduler/jobs/base-job.js`

```javascript
class BaseJob {
  constructor(appManager) {
    this.appManager = appManager
  }

  async execute() {
    throw new Error('execute() must be implemented by subclass')
  }

  async getActiveTickers(assetType) {
    const PositionDAO = require('../../position/position-dao')
    const positionDAO = new PositionDAO(this.appManager.getDb())
    return await positionDAO.findDistinctTickersByAssetType(assetType)
  }
}

module.exports = BaseJob
```

**Arquivo:** `src/app/scheduler/jobs/stock-update-job.js`

```javascript
const BaseJob = require('./base-job')
const MarketHours = require('../utils/market-hours')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../../app-constants')
const logger = new JsonLog(SERVICE_NAME)

class StockUpdateJob extends BaseJob {
  constructor(appManager) {
    super(appManager)
    this.marketHours = new MarketHours()
  }

  async execute() {
    // Verificar horario de mercado
    if (!this.marketHours.isInMarketHours()) {
      logger.log('Skipping stock update - outside market hours', {
        internal: { method: 'execute', filename: 'stock-update-job.js' },
        marketStatus: this.marketHours.getMarketStatus(),
      })
      return { skipped: true, reason: 'OUTSIDE_MARKET_HOURS' }
    }

    // Buscar tickers ativos
    const tickers = await this.getActiveTickers('STOCK')

    if (tickers.length === 0) {
      logger.log('No active stock tickers to update', {
        internal: { method: 'execute', filename: 'stock-update-job.js' },
      })
      return { skipped: true, reason: 'NO_TICKERS' }
    }

    // Adicionar job na fila
    const QueueManager = require('../../queue/queue-manager')
    const queueManager = this.appManager.getQueueManager()

    await queueManager.addJob('STOCK', { tickers })

    return {
      tickersQueued: tickers.length,
      tickers: tickers.slice(0, 10), // Primeiros 10 para log
    }
  }
}

module.exports = StockUpdateJob
```

**Arquivo:** `src/app/scheduler/jobs/fixed-income-job.js`

```javascript
const BaseJob = require('./base-job')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../../app-constants')
const logger = new JsonLog(SERVICE_NAME)

class FixedIncomeJob extends BaseJob {
  constructor(appManager) {
    super(appManager)
  }

  async execute() {
    // Buscar indices economicos do BCB
    const QueueManager = require('../../queue/queue-manager')
    const queueManager = this.appManager.getQueueManager()

    // Job para atualizar CDI, IPCA, SELIC
    await queueManager.addJob('FIXED_INCOME', {
      indices: ['CDI', 'IPCA', 'SELIC', 'IPCA_12M'],
    })

    logger.log('Fixed income update job queued', {
      internal: { method: 'execute', filename: 'fixed-income-job.js' },
    })

    return { indicesQueued: 4 }
  }
}

module.exports = FixedIncomeJob
```

**Arquivo:** `src/app/scheduler/jobs/crypto-update-job.js`

```javascript
const BaseJob = require('./base-job')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../../app-constants')
const logger = new JsonLog(SERVICE_NAME)

class CryptoUpdateJob extends BaseJob {
  constructor(appManager) {
    super(appManager)
  }

  async execute() {
    // Cripto atualiza 24/7, sem verificacao de horario
    const tickers = await this.getActiveTickers('CRYPTO')

    if (tickers.length === 0) {
      return { skipped: true, reason: 'NO_TICKERS' }
    }

    const QueueManager = require('../../queue/queue-manager')
    const queueManager = this.appManager.getQueueManager()

    await queueManager.addJob('CRYPTO', { tickers })

    return { tickersQueued: tickers.length }
  }
}

module.exports = CryptoUpdateJob
```

### 2.3 Update Queue (Bull)

**Arquivo:** `src/app/queue/queue-manager.js`

```javascript
const Queue = require('bull')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app-constants')
const logger = new JsonLog(SERVICE_NAME)

class QueueManager {
  constructor(redisConfig) {
    this.redisConfig = redisConfig || {
      host: process.env.REDIS_HOST || 'redis',
      port: process.env.REDIS_PORT || 6379,
    }
    this.queues = {}
  }

  async initialize() {
    // Criar filas por tipo de ativo
    this.queues.STOCK = new Queue('stock-updates', {
      redis: this.redisConfig,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 50,
        timeout: 120000, // 2 min max
      },
    })

    this.queues.FIXED_INCOME = new Queue('fixed-income-updates', {
      redis: this.redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    })

    this.queues.CRYPTO = new Queue('crypto-updates', {
      redis: this.redisConfig,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 500 },
        removeOnComplete: 200,
        removeOnFail: 100,
        timeout: 30000, // 30s max (alta frequencia)
      },
    })

    // Registrar processadores
    this.registerProcessors()

    logger.log('Queues initialized', {
      internal: { method: 'initialize', filename: 'queue-manager.js' },
      queues: Object.keys(this.queues),
    })
  }

  registerProcessors() {
    const StockProcessor = require('./processors/stock-processor')
    const FixedIncomeProcessor = require('./processors/fixed-income-processor')
    const CryptoProcessor = require('./processors/crypto-processor')

    // Acoes: processamento sequencial com rate limit
    this.queues.STOCK.process(1, (job) => new StockProcessor(this.redisConfig).process(job))

    // Renda Fixa: processamento simples
    this.queues.FIXED_INCOME.process(1, (job) => new FixedIncomeProcessor(this.redisConfig).process(job))

    // Cripto: processamento paralelo (alta frequencia)
    this.queues.CRYPTO.process(3, (job) => new CryptoProcessor(this.redisConfig).process(job))
  }

  async addJob(assetType, data, options = {}) {
    const queue = this.queues[assetType]
    if (!queue) {
      throw new Error(`No queue for asset type: ${assetType}`)
    }

    const job = await queue.add(data, {
      ...options,
      timestamp: Date.now(),
    })

    logger.log('Job added to queue', {
      internal: { method: 'addJob', filename: 'queue-manager.js' },
      assetType,
      jobId: job.id,
    })

    return job
  }

  async getQueueStats(assetType) {
    const queue = this.queues[assetType]
    if (!queue) return null

    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ])

    return { waiting, active, completed, failed }
  }

  async getAllStats() {
    const stats = {}
    for (const assetType of Object.keys(this.queues)) {
      stats[assetType] = await this.getQueueStats(assetType)
    }
    return stats
  }

  async shutdown() {
    for (const [name, queue] of Object.entries(this.queues)) {
      await queue.close()
      logger.log(`Queue ${name} closed`, {
        internal: { method: 'shutdown', filename: 'queue-manager.js' },
      })
    }
  }
}

module.exports = QueueManager
```

**Arquivo:** `src/app/queue/processors/stock-processor.js`

```javascript
const RateLimiter = require('../rate-limiter')
const BatchHandler = require('../batch-handler')
const CircuitBreaker = require('../circuit-breaker')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../../app-constants')
const logger = new JsonLog(SERVICE_NAME)

class StockProcessor {
  constructor(redisConfig) {
    this.redisConfig = redisConfig
    this.rateLimiter = new RateLimiter({
      provider: 'BRAPI',
      maxRequests: 3,
      perMilliseconds: 60000, // 3 req/min para Brapi free
    })
    this.batchHandler = new BatchHandler({
      batchSize: 50,
      delayBetweenBatches: 20000, // 20s entre batches
    })
    this.circuitBreaker = new CircuitBreaker({
      provider: 'BRAPI',
      failureThreshold: 5,
      resetTimeout: 60000,
    })
  }

  async process(job) {
    const { tickers } = job.data

    logger.log('Processing stock batch', {
      internal: { method: 'process', filename: 'stock-processor.js' },
      tickersCount: tickers.length,
      jobId: job.id,
    })

    const results = {
      success: [],
      failed: [],
      tickersUpdated: 0,
      tickersFailed: 0,
    }

    // Dividir em batches
    const batches = this.batchHandler.createBatches(tickers)

    for (const [index, batch] of batches.entries()) {
      try {
        // Aguardar rate limit
        await this.rateLimiter.waitForSlot()

        // Executar com circuit breaker
        const prices = await this.circuitBreaker.execute(async () => {
          const ProviderFactory = require('../../market-data/providers/provider-factory')
          const factory = new ProviderFactory()
          const result = await factory.fetchBatchWithFallback(batch, 'STOCK_BR')
          return result.data
        })

        // Salvar precos
        await this.savePrices(prices)

        results.success.push(...batch.map(t => ({ ticker: t, updated: true })))
        results.tickersUpdated += batch.length

        logger.log(`Batch ${index + 1}/${batches.length} completed`, {
          internal: { method: 'process', filename: 'stock-processor.js' },
          batchSize: batch.length,
        })

        // Delay entre batches
        if (index < batches.length - 1) {
          await this.batchHandler.delay()
        }
      } catch (error) {
        results.failed.push(...batch.map(t => ({ ticker: t, error: error.message })))
        results.tickersFailed += batch.length

        logger.error(`Batch ${index + 1} failed`, error, {
          internal: { method: 'process', filename: 'stock-processor.js' },
          batch: batch.slice(0, 5),
        })
      }
    }

    // Publicar evento de atualizacao
    await this.publishUpdate(results)

    return results
  }

  async savePrices(prices) {
    // Implementar salvamento no Redis e MongoDB
    // Similar ao crypto-processor
  }

  async publishUpdate(results) {
    // Publicar no Redis pub/sub
    const redis = require('redis')
    const client = redis.createClient(this.redisConfig)

    const event = {
      type: 'STOCK_PRICES_UPDATED',
      timestamp: new Date().toISOString(),
      data: {
        tickersUpdated: results.tickersUpdated,
        tickersFailed: results.tickersFailed,
      },
    }

    await client.publish('stock:updates', JSON.stringify(event))
  }
}

module.exports = StockProcessor
```

### 2.4 Rate Limiter

**Arquivo:** `src/app/queue/rate-limiter.js`

```javascript
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app-constants')
const logger = new JsonLog(SERVICE_NAME)

class RateLimiter {
  constructor(options) {
    this.provider = options.provider
    this.maxRequests = options.maxRequests
    this.perMilliseconds = options.perMilliseconds
    this.requests = []
    this.warningThreshold = options.warningThreshold || 0.8
  }

  async waitForSlot() {
    const now = Date.now()

    // Remover requisicoes antigas
    this.requests = this.requests.filter(
      (time) => now - time < this.perMilliseconds
    )

    const usage = this.requests.length / this.maxRequests

    // Log warning se proximo do limite
    if (usage >= this.warningThreshold) {
      logger.log('Rate limit warning', {
        internal: { method: 'waitForSlot', filename: 'rate-limiter.js' },
        provider: this.provider,
        usage: `${Math.round(usage * 100)}%`,
        requestsInWindow: this.requests.length,
        maxRequests: this.maxRequests,
      })
    }

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0]
      const waitTime = this.perMilliseconds - (now - oldestRequest)

      logger.log('Rate limit reached, waiting', {
        internal: { method: 'waitForSlot', filename: 'rate-limiter.js' },
        provider: this.provider,
        waitTimeMs: waitTime,
      })

      await new Promise((resolve) => setTimeout(resolve, waitTime))
      return this.waitForSlot()
    }

    this.requests.push(now)
  }

  getStats() {
    const now = Date.now()
    this.requests = this.requests.filter(
      (time) => now - time < this.perMilliseconds
    )

    return {
      provider: this.provider,
      requestsInWindow: this.requests.length,
      maxRequests: this.maxRequests,
      usage: Math.round((this.requests.length / this.maxRequests) * 100),
      windowMs: this.perMilliseconds,
      oldestRequest: this.requests[0] || null,
    }
  }
}

module.exports = RateLimiter
```

### 2.5 Circuit Breaker

**Arquivo:** `src/app/queue/circuit-breaker.js`

```javascript
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app-constants')
const logger = new JsonLog(SERVICE_NAME)

class CircuitBreaker {
  constructor(options) {
    this.provider = options.provider
    this.failureThreshold = options.failureThreshold || 5
    this.resetTimeout = options.resetTimeout || 60000 // 1 min
    this.failures = 0
    this.state = 'CLOSED' // CLOSED, OPEN, HALF_OPEN
    this.lastFailure = null
    this.nextAttempt = null
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker OPEN for ${this.provider}`)
      }
      this.state = 'HALF_OPEN'
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  onSuccess() {
    this.failures = 0
    this.state = 'CLOSED'

    logger.log('Circuit breaker closed', {
      internal: { method: 'onSuccess', filename: 'circuit-breaker.js' },
      provider: this.provider,
    })
  }

  onFailure() {
    this.failures++
    this.lastFailure = new Date()

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN'
      this.nextAttempt = Date.now() + this.resetTimeout

      logger.error('Circuit breaker opened', new Error('Too many failures'), {
        internal: { method: 'onFailure', filename: 'circuit-breaker.js' },
        provider: this.provider,
        failures: this.failures,
        nextAttempt: new Date(this.nextAttempt).toISOString(),
      })
    }
  }

  getStatus() {
    return {
      provider: this.provider,
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailure,
      nextAttempt: this.state === 'OPEN' ? new Date(this.nextAttempt) : null,
    }
  }
}

module.exports = CircuitBreaker
```

### 2.6 Market Hours Detection

**Arquivo:** `src/app/scheduler/utils/market-hours.js`

```javascript
const HolidayCalendar = require('./holiday-calendar')

class MarketHours {
  constructor() {
    this.holidayCalendar = new HolidayCalendar()
    this.marketOpen = 10 // 10:00
    this.marketClose = 17 // 17:00
    this.timezone = 'America/Sao_Paulo'
  }

  isInMarketHours(date = new Date()) {
    // Verificar dia da semana (0 = domingo, 6 = sabado)
    const dayOfWeek = date.getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false
    }

    // Verificar feriado
    if (this.holidayCalendar.isHoliday(date)) {
      return false
    }

    // Verificar pregao especial
    const specialSession = this.holidayCalendar.getSpecialSession(date)
    if (specialSession) {
      const hour = date.getHours()
      return hour >= specialSession.open && hour < specialSession.close
    }

    // Verificar horario normal
    const hour = date.getHours()
    const minute = date.getMinutes()
    const timeInMinutes = hour * 60 + minute
    const openInMinutes = this.marketOpen * 60
    const closeInMinutes = this.marketClose * 60

    return timeInMinutes >= openInMinutes && timeInMinutes < closeInMinutes
  }

  getNextMarketOpen(date = new Date()) {
    let nextDate = new Date(date)

    while (!this.isInMarketHours(nextDate)) {
      nextDate = new Date(nextDate.getTime() + 60 * 60 * 1000) // +1h
      nextDate.setMinutes(0)
      nextDate.setSeconds(0)

      // Se passou do horario de fechamento, ir para proximo dia
      if (nextDate.getHours() >= this.marketClose) {
        nextDate.setDate(nextDate.getDate() + 1)
        nextDate.setHours(this.marketOpen, 0, 0, 0)
      }
    }

    return nextDate
  }

  getMarketStatus() {
    const now = new Date()
    const inMarket = this.isInMarketHours(now)

    return {
      isOpen: inMarket,
      currentTime: now.toISOString(),
      nextOpen: inMarket ? null : this.getNextMarketOpen(now).toISOString(),
      timezone: this.timezone,
      marketOpen: `${this.marketOpen}:00`,
      marketClose: `${this.marketClose}:00`,
    }
  }
}

module.exports = MarketHours
```

**Arquivo:** `src/app/scheduler/utils/holiday-calendar.js`

```javascript
class HolidayCalendar {
  constructor() {
    this.holidays = this.loadHolidays()
    this.specialSessions = this.loadSpecialSessions()
    this.currentYear = new Date().getFullYear()
  }

  loadHolidays() {
    // Feriados nacionais fixos
    const fixedHolidays = {
      '01-01': 'Confraternizacao Universal',
      '04-21': 'Tiradentes',
      '05-01': 'Dia do Trabalho',
      '09-07': 'Independencia do Brasil',
      '10-12': 'Nossa Senhora Aparecida',
      '11-02': 'Finados',
      '11-15': 'Proclamacao da Republica',
      '12-25': 'Natal',
    }

    // Feriados moveis (calculados anualmente)
    const year = new Date().getFullYear()
    const movableHolidays = this.calculateMovableHolidays(year)

    return { ...fixedHolidays, ...movableHolidays }
  }

  calculateMovableHolidays(year) {
    const easter = this.calculateEaster(year)

    const carnaval = new Date(easter)
    carnaval.setDate(carnaval.getDate() - 47)

    const goodFriday = new Date(easter)
    goodFriday.setDate(goodFriday.getDate() - 2)

    const corpusChristi = new Date(easter)
    corpusChristi.setDate(corpusChristi.getDate() + 60)

    return {
      [this.formatDate(carnaval)]: 'Carnaval',
      [this.formatDate(goodFriday)]: 'Sexta-feira Santa',
      [this.formatDate(corpusChristi)]: 'Corpus Christi',
    }
  }

  calculateEaster(year) {
    // Algoritmo de Gauss para calcular a Pascoa
    const a = year % 19
    const b = Math.floor(year / 100)
    const c = year % 100
    const d = Math.floor(b / 4)
    const e = b % 4
    const f = Math.floor((b + 8) / 25)
    const g = Math.floor((b - f + 1) / 3)
    const h = (19 * a + b - d - g + 15) % 30
    const i = Math.floor(c / 4)
    const k = c % 4
    const l = (32 + 2 * e + 2 * i - h - k) % 7
    const m = Math.floor((a + 11 * h + 22 * l) / 451)
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
    const day = ((h + l - 7 * m + 114) % 31) + 1

    return new Date(year, month, day)
  }

  formatDate(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${month}-${day}`
  }

  loadSpecialSessions() {
    // Pregoes especiais com horario reduzido
    return {
      '12-24': { open: 10, close: 13, name: 'Vespera de Natal' },
      '12-31': { open: 10, close: 13, name: 'Vespera de Ano Novo' },
    }
  }

  isHoliday(date) {
    const key = this.formatDate(date)
    return key in this.holidays
  }

  getHolidayName(date) {
    const key = this.formatDate(date)
    return this.holidays[key] || null
  }

  getSpecialSession(date) {
    const key = this.formatDate(date)
    return this.specialSessions[key] || null
  }

  getHolidaysForYear(year) {
    if (year !== this.currentYear) {
      this.holidays = this.loadHolidays()
      this.currentYear = year
    }
    return Object.entries(this.holidays).map(([date, name]) => ({
      date: `${year}-${date}`,
      name,
    }))
  }
}

module.exports = HolidayCalendar
```

### 2.7 Realtime Service (WebSocket/SSE)

**Arquivo:** `src/app/realtime/realtime-service.js`

```javascript
const WebSocket = require('ws')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app-constants')
const logger = new JsonLog(SERVICE_NAME)

class RealtimeService {
  constructor(redisClient, server) {
    this.redisClient = redisClient
    this.server = server
    this.subscribers = new Map() // clientId -> { channels, socket }
    this.channels = {
      STOCK: 'stock:updates',
      FIXED_INCOME: 'fixed-income:updates',
      CRYPTO: 'crypto:updates',
    }
    this.wss = null
  }

  async initialize() {
    // Inscrever nos canais do Redis
    for (const channel of Object.values(this.channels)) {
      await this.redisClient.subscribe(channel, (message) => {
        this.broadcast(channel, message)
      })
    }

    // Iniciar WebSocket server
    this.setupWebSocket()

    logger.log('Realtime service initialized', {
      internal: { method: 'initialize', filename: 'realtime-service.js' },
      channels: Object.keys(this.channels),
    })
  }

  setupWebSocket() {
    this.wss = new WebSocket.Server({ server: this.server })

    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId()

      ws.clientId = clientId
      ws.isAlive = true

      this.subscribers.set(clientId, {
        channels: new Set(),
        socket: ws,
      })

      ws.on('message', (data) => {
        this.handleMessage(clientId, data)
      })

      ws.on('close', () => {
        this.subscribers.delete(clientId)
        logger.log('Client disconnected', {
          internal: { method: 'setupWebSocket', filename: 'realtime-service.js' },
          clientId,
        })
      })

      ws.on('pong', () => {
        ws.isAlive = true
      })

      // Enviar confirmacao de conexao
      ws.send(JSON.stringify({
        type: 'CONNECTED',
        clientId,
        timestamp: new Date().toISOString(),
      }))

      logger.log('Client connected', {
        internal: { method: 'setupWebSocket', filename: 'realtime-service.js' },
        clientId,
      })
    })

    // Heartbeat para detectar conexoes mortas
    this.startHeartbeat()
  }

  handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data)
      const subscriber = this.subscribers.get(clientId)

      if (!subscriber) return

      switch (message.type) {
        case 'SUBSCRIBE':
          subscriber.channels.add(message.channel)
          logger.log('Client subscribed', {
            internal: { method: 'handleMessage', filename: 'realtime-service.js' },
            clientId,
            channel: message.channel,
          })
          break
        case 'UNSUBSCRIBE':
          subscriber.channels.delete(message.channel)
          break
        case 'PING':
          subscriber.socket.send(JSON.stringify({ type: 'PONG' }))
          break
      }
    } catch (error) {
      logger.error('Error handling message', error, {
        internal: { method: 'handleMessage', filename: 'realtime-service.js' },
        clientId,
      })
    }
  }

  broadcast(channel, message) {
    const parsedMessage = JSON.parse(message)

    for (const [clientId, subscriber] of this.subscribers) {
      if (subscriber.channels.has(channel)) {
        try {
          subscriber.socket.send(message)
        } catch (error) {
          logger.error('Error sending to client', error, {
            internal: { method: 'broadcast', filename: 'realtime-service.js' },
            clientId,
          })
        }
      }
    }
  }

  async publishUpdate(assetType, data) {
    const channel = this.channels[assetType]
    const message = JSON.stringify({
      type: 'PRICE_UPDATE',
      assetType,
      data,
      timestamp: new Date().toISOString(),
    })

    await this.redisClient.publish(channel, message)

    logger.log('Update published', {
      internal: { method: 'publishUpdate', filename: 'realtime-service.js' },
      assetType,
      channel,
    })
  }

  startHeartbeat() {
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
          return ws.terminate()
        }
        ws.isAlive = false
        ws.ping()
      })
    }, 30000) // 30 segundos
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  getStats() {
    return {
      connectedClients: this.subscribers.size,
      channels: Object.keys(this.channels),
    }
  }
}

module.exports = RealtimeService
```

### 2.8 Models

**Arquivo:** `src/app/scheduler/models/job-execution-model.js`

```javascript
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const schema = new mongoose.Schema({
  _id: { type: String, required: true, default: uuidv4 },
  assetType: {
    type: String,
    enum: ['STOCK', 'FIXED_INCOME', 'CRYPTO'],
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['SUCCESS', 'ERROR', 'PARTIAL', 'SKIPPED'],
    required: true,
  },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  durationMs: { type: Number, required: true },
  tickersUpdated: { type: Number, default: 0 },
  tickersFailed: { type: Number, default: 0 },
  error: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, {
  versionKey: false,
  timestamps: true,
})

// Indice para queries de historico
schema.index({ assetType: 1, startTime: -1 })

module.exports = { schema }
```

**Arquivo:** `src/app/scheduler/models/job-config-model.js`

```javascript
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const schema = new mongoose.Schema({
  _id: { type: String, required: true, default: uuidv4 },
  assetType: {
    type: String,
    enum: ['STOCK', 'FIXED_INCOME', 'CRYPTO'],
    required: true,
    unique: true,
  },
  cronExpression: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  description: { type: String },
  lastModifiedBy: { type: String },
}, {
  versionKey: false,
  timestamps: true,
})

module.exports = { schema }
```

### 2.9 Routers

**Arquivo:** `src/app/scheduler/scheduler-router.js`

```javascript
const express = require('express')
const cron = require('node-cron')
const { Authorizer } = require('interact-utils')
const { Permissions } = require('../app-constants')

class SchedulerRouter {
  static handleError(exception, res) {
    res.status(exception.statusCode || 500).send(exception.message || 'Server Error')
  }

  static getRoutes(appManager) {
    const router = express.Router()
    const schedulerService = appManager.getSchedulerService()

    // GET /api/scheduler/status
    router.get('/status', Authorizer.getMiddleware(Permissions.ADMIN), async (req, res) => {
      try {
        const status = schedulerService.getStatus()
        res.status(200).json(status)
      } catch (exception) {
        SchedulerRouter.handleError(exception, res)
      }
    })

    // PUT /api/scheduler/config
    router.put('/config', Authorizer.getMiddleware(Permissions.ADMIN), async (req, res) => {
      try {
        const { assetType, cronExpression, enabled } = req.body

        if (!['STOCK', 'FIXED_INCOME', 'CRYPTO'].includes(assetType)) {
          return res.status(400).json({ error: 'Invalid assetType' })
        }

        if (cronExpression && !cron.validate(cronExpression)) {
          return res.status(400).json({ error: 'Invalid cron expression' })
        }

        await schedulerService.updateConfig(assetType, { cronExpression, enabled })
        res.status(200).json({ message: 'Configuration updated', assetType })
      } catch (exception) {
        SchedulerRouter.handleError(exception, res)
      }
    })

    // POST /api/scheduler/trigger (manual trigger para testes)
    router.post('/trigger', Authorizer.getMiddleware(Permissions.ADMIN), async (req, res) => {
      try {
        const { assetType } = req.body
        const jobHandler = schedulerService.getJobHandler(assetType)
        const result = await jobHandler.execute()
        res.status(200).json({ message: 'Job triggered', result })
      } catch (exception) {
        SchedulerRouter.handleError(exception, res)
      }
    })

    return router
  }
}

module.exports = SchedulerRouter
```

**Arquivo:** `src/app/realtime/realtime-router.js`

```javascript
const express = require('express')
const { Authorizer } = require('interact-utils')
const { Permissions } = require('../app-constants')
const SSEHandler = require('./sse-handler')

class RealtimeRouter {
  static handleError(exception, res) {
    res.status(exception.statusCode || 500).send(exception.message || 'Server Error')
  }

  static getRoutes(appManager) {
    const router = express.Router()
    const realtimeService = appManager.getRealtimeService()
    const redisClient = appManager.getRedisClient()

    // GET /api/realtime/stream (SSE)
    router.get('/stream', Authorizer.getMiddleware(Permissions.USER), async (req, res) => {
      const sseHandler = new SSEHandler(redisClient)
      sseHandler.handleConnection(req, res)
    })

    // GET /api/realtime/stats
    router.get('/stats', Authorizer.getMiddleware(Permissions.ADMIN), async (req, res) => {
      try {
        const stats = realtimeService.getStats()
        res.status(200).json(stats)
      } catch (exception) {
        RealtimeRouter.handleError(exception, res)
      }
    })

    // GET /api/market/status
    router.get('/market/status', async (req, res) => {
      try {
        const MarketHours = require('../scheduler/utils/market-hours')
        const marketHours = new MarketHours()
        const status = marketHours.getMarketStatus()
        res.status(200).json(status)
      } catch (exception) {
        RealtimeRouter.handleError(exception, res)
      }
    })

    return router
  }
}

module.exports = RealtimeRouter
```

---

## 3. Componentes Frontend

### 3.1 Services

**Arquivo:** `src/services/websocketService.js`

```javascript
class WebSocketService {
  constructor() {
    this.ws = null
    this.connected = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 10
    this.listeners = new Map()
    this.channels = new Set()
  }

  connect(url = `${WS_URL}/api/realtime/ws`) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        this.connected = true
        this.reconnectAttempts = 0

        // Re-subscribe to channels
        this.channels.forEach((channel) => {
          this.subscribe(channel)
        })

        resolve()
      }

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          this.handleMessage(message)
        } catch (error) {
          console.error('Error parsing message:', error)
        }
      }

      this.ws.onerror = (error) => {
        reject(error)
      }

      this.ws.onclose = () => {
        this.connected = false
        this.scheduleReconnect()
      }
    })
  }

  handleMessage(message) {
    const listeners = this.listeners.get(message.type) || []
    listeners.forEach((callback) => callback(message))

    // Also call channel-specific listeners
    if (message.assetType) {
      const channelListeners = this.listeners.get(`channel:${message.assetType}`) || []
      channelListeners.forEach((callback) => callback(message))
    }
  }

  subscribe(channel) {
    this.channels.add(channel)
    if (this.connected) {
      this.ws.send(JSON.stringify({ type: 'SUBSCRIBE', channel }))
    }
  }

  unsubscribe(channel) {
    this.channels.delete(channel)
    if (this.connected) {
      this.ws.send(JSON.stringify({ type: 'UNSUBSCRIBE', channel }))
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(callback)
  }

  off(event, callback) {
    const listeners = this.listeners.get(event) || []
    const index = listeners.indexOf(callback)
    if (index > -1) {
      listeners.splice(index, 1)
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached')
      return
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    this.reconnectAttempts++

    setTimeout(() => {
      this.connect()
    }, delay)
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
    }
  }
}

export default new WebSocketService()
```

### 3.2 Composables (Vue 3)

**Arquivo:** `src/composables/useRealtimeUpdates.js`

```javascript
import { ref, onMounted, onUnmounted } from 'vue'
import websocketService from '../services/websocketService'

export function useRealtimeUpdates(channels = []) {
  const connected = ref(false)
  const lastUpdate = ref(null)
  const error = ref(null)

  const handleMessage = (message) => {
    if (message.type === 'PRICE_UPDATE') {
      lastUpdate.value = new Date(message.timestamp)
    }
  }

  onMounted(async () => {
    try {
      await websocketService.connect()
      connected.value = true

      channels.forEach((channel) => {
        websocketService.subscribe(channel)
      })

      websocketService.on('PRICE_UPDATE', handleMessage)
      websocketService.on('CONNECTED', () => {
        connected.value = true
        error.value = null
      })
    } catch (err) {
      error.value = err.message
    }
  })

  onUnmounted(() => {
    channels.forEach((channel) => {
      websocketService.unsubscribe(channel)
    })
    websocketService.off('PRICE_UPDATE', handleMessage)
  })

  return {
    connected,
    lastUpdate,
    error,
  }
}
```

**Arquivo:** `src/composables/useMarketStatus.js`

```javascript
import { ref, onMounted, onUnmounted } from 'vue'
import api from '../services/api'

export function useMarketStatus() {
  const marketStatus = ref(null)
  const loading = ref(true)
  const error = ref(null)

  let interval = null

  const fetchStatus = async () => {
    try {
      const response = await api.get('/market/status')
      marketStatus.value = response.data
      error.value = null
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    fetchStatus()
    interval = setInterval(fetchStatus, 60000) // Atualizar a cada 1 min
  })

  onUnmounted(() => {
    if (interval) {
      clearInterval(interval)
    }
  })

  return {
    marketStatus,
    loading,
    error,
    refetch: fetchStatus,
  }
}
```

### 3.3 Components

**Arquivo:** `src/components/realtime/LiveIndicator.vue`

```vue
<template>
  <span :class="['live-indicator', variant]">
    <span v-if="showDot && variant !== 'closed'" class="pulse-dot"></span>
    {{ label }}
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'live',
    validator: (v) => ['live', '247', 'closed'].includes(v),
  },
  showDot: {
    type: Boolean,
    default: true,
  },
})

const labels = {
  live: 'AO VIVO',
  '247': '24/7',
  closed: 'MERCADO FECHADO',
}

const label = computed(() => labels[props.variant])
</script>

<style scoped>
.live-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.live-indicator.live {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.live-indicator.\3247 {
  background: rgba(168, 85, 247, 0.1);
  color: #a855f7;
  border: 1px solid rgba(168, 85, 247, 0.3);
}

.live-indicator.closed {
  background: rgba(107, 114, 128, 0.1);
  color: #6b7280;
  border: 1px solid rgba(107, 114, 128, 0.3);
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
```

**Arquivo:** `src/components/realtime/LastUpdateIndicator.vue`

```vue
<template>
  <div :class="['last-update', { stale }]">
    <span>Ultima atualizacao:</span>
    <strong>{{ timeAgo }}</strong>
    <span v-if="stale" class="warning-icon">!</span>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  lastUpdate: {
    type: [Date, String],
    required: true,
  },
  stale: {
    type: Boolean,
    default: false,
  },
})

const timeAgo = ref('')
let interval = null

const formatTimeAgo = (date) => {
  const now = new Date()
  const diff = Math.floor((now - new Date(date)) / 1000)

  if (diff < 60) return 'ha poucos segundos'
  if (diff < 3600) return `ha ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `ha ${Math.floor(diff / 3600)}h`
  return `ha ${Math.floor(diff / 86400)} dias`
}

const updateTime = () => {
  timeAgo.value = formatTimeAgo(props.lastUpdate)
}

onMounted(() => {
  updateTime()
  interval = setInterval(updateTime, 10000)
})

onUnmounted(() => {
  if (interval) clearInterval(interval)
})

watch(() => props.lastUpdate, updateTime)
</script>

<style scoped>
.last-update {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #6b7280;
}

.last-update.stale {
  color: #ef4444;
}

.warning-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ef4444;
  color: white;
  font-size: 10px;
  font-weight: bold;
}
</style>
```

**Arquivo:** `src/components/realtime/MarketStatusBadge.vue`

```vue
<template>
  <div class="market-status-badge">
    <LiveIndicator v-if="assetType === 'CRYPTO'" variant="247" />
    <template v-else>
      <LiveIndicator v-if="marketStatus?.isOpen" variant="live" />
      <div v-else class="closed-status">
        <LiveIndicator variant="closed" />
        <span v-if="marketStatus?.nextOpen" class="next-open">
          Abre {{ formatNextOpen(marketStatus.nextOpen) }}
        </span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import LiveIndicator from './LiveIndicator.vue'
import { useMarketStatus } from '../../composables/useMarketStatus'

const props = defineProps({
  assetType: {
    type: String,
    required: true,
  },
})

const { marketStatus } = useMarketStatus()

const formatNextOpen = (dateStr) => {
  const date = new Date(dateStr)
  return date.toLocaleString('pt-BR', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<style scoped>
.market-status-badge {
  display: flex;
  align-items: center;
}

.closed-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.next-open {
  font-size: 12px;
  color: #6b7280;
}
</style>
```

**Arquivo:** `src/components/realtime/StaleDataWarning.vue`

```vue
<template>
  <div v-if="show" class="stale-data-warning">
    <span class="warning-icon">!</span>
    <span class="message">Dados desatualizados</span>
    <span class="last-valid">Ultimo dado valido: {{ formatTime(lastValidUpdate) }}</span>
  </div>
</template>

<script setup>
const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  lastValidUpdate: {
    type: [Date, String],
    default: null,
  },
})

const formatTime = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<style scoped>
.stale-data-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  font-size: 12px;
  color: #ef4444;
}

.warning-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ef4444;
  color: white;
  font-weight: bold;
}

.message {
  font-weight: 600;
}

.last-valid {
  color: #6b7280;
}
</style>
```

---

## 4. API Contracts

### 4.1 GET /api/scheduler/status

**Descricao:** Retorna status de todos os jobs do scheduler

**Response (200):**
```json
{
  "STOCK": {
    "running": true,
    "cronExpression": "*/15 10-17 * * 1-5",
    "lastRun": "2026-03-27T10:15:00.000Z",
    "nextRun": "2026-03-27T10:30:00.000Z",
    "successCount": 42,
    "errorCount": 2,
    "lastError": null
  },
  "FIXED_INCOME": {
    "running": true,
    "cronExpression": "0 9 * * 1-5",
    "lastRun": "2026-03-27T09:00:00.000Z",
    "nextRun": "2026-03-28T09:00:00.000Z",
    "successCount": 5,
    "errorCount": 0,
    "lastError": null
  },
  "CRYPTO": {
    "running": true,
    "cronExpression": "*/1 * * * *",
    "lastRun": "2026-03-27T10:23:00.000Z",
    "nextRun": "2026-03-27T10:24:00.000Z",
    "successCount": 1440,
    "errorCount": 12,
    "lastError": null
  }
}
```

### 4.2 PUT /api/scheduler/config

**Descricao:** Atualiza configuracao de um job

**Request Body:**
```json
{
  "assetType": "STOCK",
  "cronExpression": "*/30 10-17 * * 1-5",
  "enabled": true
}
```

**Response (200):**
```json
{
  "message": "Configuration updated",
  "assetType": "STOCK"
}
```

### 4.3 GET /api/market/status

**Descricao:** Retorna status atual do mercado B3

**Response (200):**
```json
{
  "isOpen": true,
  "currentTime": "2026-03-27T10:30:00.000Z",
  "nextOpen": null,
  "timezone": "America/Sao_Paulo",
  "marketOpen": "10:00",
  "marketClose": "17:00"
}
```

### 4.4 GET /api/realtime/stream (SSE)

**Descricao:** Endpoint SSE para atualizacoes em tempo real

**Query Parameters:**
- `channels`: Lista de canais separados por virgula (ex: `stock:updates,crypto:updates`)

**Event Types:**
```
event: message
data: {"type":"STOCK_PRICES_UPDATED","timestamp":"2026-03-27T10:15:00.000Z","data":{...}}

event: message
data: {"type":"PRICE_UPDATE","assetType":"CRYPTO","data":{...},"timestamp":"..."}
```

### 4.5 WebSocket Messages

**Client -> Server:**
```json
// Subscribe to channel
{"type": "SUBSCRIBE", "channel": "stock:updates"}

// Unsubscribe from channel
{"type": "UNSUBSCRIBE", "channel": "stock:updates"}

// Ping
{"type": "PING"}
```

**Server -> Client:**
```json
// Connection confirmation
{"type": "CONNECTED", "clientId": "client_123", "timestamp": "2026-03-27T10:00:00.000Z"}

// Price update
{"type": "PRICE_UPDATE", "assetType": "STOCK", "data": {...}, "timestamp": "..."}

// Pong
{"type": "PONG"}
```

---

## 5. Fluxos de Dados

### 5.1 Fluxo de Atualizacao Agendada

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                         SEQUENCIA: ATUALIZACAO AGENDADA                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

  Time    Scheduler              Queue               Processor            Redis           MongoDB
  ────    ─────────              ─────               ─────────            ────           ───────

  10:00   initialize()
          │
          ├─ loadConfigs()──────────────────────────────────────────────────────────────▶
          │◀──────────────────────────────────────────────────────────────── configs       │
          │
          ├─ registerJob(STOCK, '*/15 10-17...')
          │
          └─ registerJob(CRYPTO, '*/1 * * * *')

  10:15   cron tick (STOCK)
          │
          ├─ executeJob(STOCK)
          │   │
          │   ├─ MarketHours.isInMarketHours() ─────────────────────────────────────────▶
          │   │◀────────────────────────────────────────────────────────────── true        │
          │   │
          │   ├─ getActiveTickers('STOCK') ──────────────────────────────────────────────▶
          │   │◀────────────────────────────────────────────────────────────── [tickers]   │
          │   │
          │   └─ QueueManager.addJob('STOCK', { tickers })
          │       │
          │       └──────────────────────────────────────────────────────────────────────▶
          │                                       Job added to queue

  10:15:01                        process(job)
                                  │
                                  ├─ BatchHandler.createBatches(tickers, 50)
                                  │
                                  ├─ FOR EACH batch:
                                  │   │
                                  │   ├─ RateLimiter.waitForSlot() ─────────────────────▶
                                  │   │◀──────────────────────────────────── slot ready   │
                                  │   │
                                  │   ├─ CircuitBreaker.execute(
                                  │   │    BrapiProvider.getBatchPrices(batch)
                                  │   │  ) ─────────────────────────────────────────────▶
                                  │   │◀────────────────────────────────────── prices[]   │
                                  │   │
                                  │   ├─ Redis.SET stock:price:{ticker} ──────────────▶
                                  │   │
                                  │   ├─ MongoDB.INSERT price_history ─────────────────▶
                                  │   │
                                  │   └─ delay(20s)
                                  │
                                  └─ Redis.publish('stock:updates', event) ───────────▶

  10:15:45                                                                RealtimeService
                                                                          │
                                                                          ├─ broadcast('stock:updates', msg)
                                                                          │
                                                                          └─ WebSocket.send() to all subscribers
```

### 5.2 Fluxo de Notificacao em Tempo Real

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                         SEQUENCIA: NOTIFICACAO EM TEMPO REAL                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

  Frontend                WebSocket              Redis Pub/Sub           Backend Processor
  ────────                ─────────              ────────────           ─────────────────

  1. Conexao
     │
     ├─ new WebSocket(WS_URL)
     │
     ├─ ws.onopen
     │   │
     │   └─ ws.send({ type: 'SUBSCRIBE', channel: 'stock:updates' })
     │
     └─ ws.onmessage = handler

  2. Atualizacao de Preco
     │
     │                                              Processor completa atualizacao
     │                                              │
     │                                              └─ redis.publish('stock:updates', {
     │                                                    type: 'STOCK_PRICES_UPDATED',
     │                                                    tickers: ['PETR4', 'VALE3'],
     │                                                    timestamp: '...'
     │                                                  })
     │
     │                                              Redis Pub/Sub
     │                                              │
     │                                              └─ broadcast to all subscribers
     │
     │◀─────────────────────────────────────────────
     │  ws message: { type: 'PRICE_UPDATE', ... }
     │
     ├─ handler(message)
     │   │
     │   ├─ updatePrices(message.data.tickers)
     │   │
     │   ├─ updateLastUpdateIndicator(message.timestamp)
     │   │
     │   └─ animatePriceChanges()

  3. Reconexao (se conexao cair)
     │
     ├─ ws.onclose
     │   │
     │   └─ scheduleReconnect()
     │       │
     │       └─ setTimeout(() => connect(), exponentialBackoff)
     │
     └─ ws.onopen
         │
         └─ re-subscribe to channels
```

---

## 6. Estrutura de Arquivos

```
src/
├── app/
│   ├── scheduler/
│   │   ├── scheduler-service.js           # Orquestrador principal
│   │   ├── scheduler-router.js             # Rotas HTTP
│   │   ├── scheduler-manager.js            # Logica de negocio
│   │   ├── jobs/
│   │   │   ├── base-job.js                 # Classe base para jobs
│   │   │   ├── stock-update-job.js         # Job de acoes
│   │   │   ├── fixed-income-job.js         # Job de renda fixa
│   │   │   └── crypto-update-job.js        # Job de cripto
│   │   ├── models/
│   │   │   ├── job-config-model.js        # Schema de configuracao
│   │   │   └── job-execution-model.js      # Schema de historico
│   │   ├── utils/
│   │   │   ├── market-hours.js             # Deteccao de horario B3
│   │   │   └── holiday-calendar.js         # Calendario de feriados
│   │   └── job-execution-dao.js            # DAO para execucoes
│   │
│   ├── queue/
│   │   ├── queue-manager.js               # Gerenciador de filas Bull
│   │   ├── rate-limiter.js                 # Rate limiter para APIs
│   │   ├── circuit-breaker.js              # Circuit breaker
│   │   ├── batch-handler.js                # Utilitario de batch
│   │   └── processors/
│   │       ├── stock-processor.js          # Processador de acoes
│   │       ├── fixed-income-processor.js   # Processador de renda fixa
│   │       └── crypto-processor.js          # Processador de cripto
│   │
│   ├── realtime/
│   │   ├── realtime-service.js            # Gerenciador de pub/sub
│   │   ├── realtime-router.js              # Rotas HTTP
│   │   ├── websocket-handler.js            # Handler de WebSocket
│   │   └── sse-handler.js                  # Handler de SSE
│   │
│   └── market-data/                        # (EP13 - Providers)
│       └── providers/
│           ├── provider-factory.js
│           ├── brapi-provider.js
│           ├── coingecko-provider.js
│           └── bcb-provider.js
│
├── components/
│   └── realtime/
│       ├── LiveIndicator.vue               # Badge "AO VIVO" / "24/7"
│       ├── LastUpdateIndicator.vue         # "Atualizado ha X"
│       ├── MarketStatusBadge.vue           # "Mercado Aberto/Fechado"
│       ├── StaleDataWarning.vue            # Alerta de dados desatualizados
│       └── PriceUpdateAnimation.vue        # Animacao de atualizacao
│
├── composables/
│   ├── useRealtimeUpdates.js               # Hook de WebSocket
│   ├── useMarketStatus.js                  # Hook de status de mercado
│   └── useConnectionStatus.js              # Hook de status de conexao
│
└── services/
    └── websocketService.js                 # Cliente WebSocket
```

---

## 7. Ordem de Implementacao

| Fase | Story | Descricao | Estimativa | Dependencias |
|------|-------|-----------|------------|--------------|
| 1 | EP14-001 | Scheduler Service com node-cron | 13 SP | EP01, EP13 |
| 2 | EP14-002 | Filas de Atualizacao por Tipo de Ativo | 8 SP | EP14-001 |
| 3 | EP14-003 | Deteccao de Horario de Mercado e Feriados | 5 SP | EP14-001 |
| 4 | EP14-006 | Rate Limiting e Protecao de APIs | 5 SP | EP14-002 |
| 5 | EP14-004 | Notificacoes em Tempo Real via Redis Pub/Sub | 8 SP | EP14-002 |
| 6 | EP14-005 | Indicadores de Atualizacao no Frontend | 5 SP | EP14-004 |

### Detalhamento por Fase:

**Fase 1 - EP14-001 (13 story points)**
1. Criar `scheduler-service.js` com node-cron
2. Implementar jobs para STOCK, FIXED_INCOME, CRYPTO
3. Criar `scheduler-router.js` com endpoints de status/config
4. Implementar persistencia de configuracoes no Redis
5. Implementar `job-execution-model.js` e DAO
6. Testes unitarios e de integracao

**Fase 2 - EP14-002 (8 story points)**
1. Criar `queue-manager.js` com Bull
2. Implementar filas por tipo de ativo
3. Criar `batch-handler.js` para divisao em batches
4. Implementar processadores com retry e backoff
5. Testes de carga (500 tickers em < 5 min)

**Fase 3 - EP14-003 (5 story points)**
1. Criar `market-hours.js` com deteccao B3
2. Criar `holiday-calendar.js` com feriados nacionais
3. Implementar calculo de feriados moveis (Pascoa)
4. Adicionar suporte a pregoes especiais
5. Endpoint GET /api/market/status

**Fase 4 - EP14-006 (5 story points)**
1. Criar `rate-limiter.js` avancado
2. Criar `circuit-breaker.js`
3. Integrar com providers do EP13
4. Endpoint GET /api/scheduler/rate-limits/status
5. Testes de rate limit e circuit breaker

**Fase 5 - EP14-004 (8 story points)**
1. Criar `realtime-service.js` com WebSocket
2. Criar `sse-handler.js` como alternativa
3. Implementar Redis pub/sub para broadcast
4. Criar `realtime-router.js`
5. Teste de carga (1000 clientes conectados)

**Fase 6 - EP14-005 (5 story points)**
1. Criar `websocketService.js` no frontend
2. Criar `useRealtimeUpdates.js` composable
3. Criar componentes: LiveIndicator, LastUpdateIndicator, etc.
4. Integrar com paginas de acoes e cripto
5. Testes de responsividade

---

## 8. Riscos Tecnicos

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|:-------------:|:------:|-----------|
| Rate limit excedido causando bloqueio de API | Alta | Critico | Rate limiter por provider + circuit breaker + fallback providers |
| Sobrecarga de Redis com muitas conexoes WebSocket | Media | Alto | Limitar conexoes por usuario + heartbeat + cleanup de conexoes mortas |
| Feriados nao detectados causando atualizacoes desnecessarias | Media | Baixo | Calendario de feriados atualizado anualmente + verificacao de pregao |
| Clock drift entre servidores causando jobs duplicados | Baixa | Medio | Redis distributed lock para jobs + idempotencia |
| Memory leak em scheduler de longa duracao | Media | Alto | Monitoramento de memoria + restart periodico + testes de carga |
| API de mercado muda ou e descontinuada | Baixa | Critico | Padrao Strategy permite trocar providers + testes de integracao |
| Exponential backoff muito longo em falhas prolongadas | Media | Medio | Limite maximo de backoff (5 min) + alerta para intervencao manual |
| WebSocket desconectado sem deteccao | Alta | Medio | Heartbeat a cada 30s + reconexao automatica + estado de conexao visivel |
| Alta latencia em atualizacoes de cripto (1 min pode ser lento) | Media | Medio | Avaliar reducao para 30s com rate limit adequado |
| Batch muito grande causando timeout | Media | Alto | Batch size configuravel + timeout por batch + retry parcial |

---

## 9. Dependencias

### Dependencias de Epicos Anteriores:
- **EP01 (Arquitetura)**: Redis, MongoDB, Docker
- **EP03 (Carteiras)**: Posicoes para determinar ativos a atualizar
- **EP04 (Transacoes)**: Tickers nas transacoes
- **EP07 (Renda Fixa)**: Taxas CDI/IPCA/SELIC
- **EP12 (Criptomoedas)**: Scheduler de alta frequencia
- **EP13 (Fontes de Dados)**: Providers de mercado (Brapi, CoinGecko, BCB)

### Dependencias de Pacotes npm:

```json
{
  "dependencies": {
    "node-cron": "^3.0.3",
    "cron-parser": "^4.9.0",
    "bull": "^4.12.0",
    "ws": "^8.16.0"
  }
}
```

### Variaveis de Ambiente:

```
# Scheduler
SCHEDULER_ENABLED=true
SCHEDULER_STOCK_CRON=*/15 10-17 * * 1-5
SCHEDULER_FIXED_INCOME_CRON=0 9 * * 1-5
SCHEDULER_CRYPTO_CRON=*/1 * * * *
SCHEDULER_TIMEZONE=America/Sao_Paulo

# Rate Limits
RATE_LIMIT_BRAPI=3
RATE_LIMIT_COINGECKO=10
RATE_LIMIT_BCB=60

# Circuit Breaker
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_RESET_TIMEOUT=60000

# Queue
QUEUE_STOCK_BATCH_SIZE=50
QUEUE_STOCK_BATCH_DELAY=20000
QUEUE_CRYPTO_CONCURRENCY=3

# WebSocket
WS_HEARTBEAT_INTERVAL=30000
WS_MAX_CLIENTS=1000
```

---

## 10. Checklist de Implementacao

### Backend - Scheduler
- [ ] `scheduler-service.js` com node-cron
- [ ] Jobs por tipo de ativo (STOCK, FIXED_INCOME, CRYPTO)
- [ ] Persistencia de configuracoes no Redis
- [ ] `scheduler-router.js` com endpoints
- [ ] `job-execution-model.js` e DAO
- [ ] Testes unitarios >= 90%

### Backend - Queue
- [ ] `queue-manager.js` com Bull
- [ ] Filas por tipo de ativo
- [ ] `batch-handler.js`
- [ ] Processadores com retry e backoff
- [ ] Teste de carga (500 tickers < 5 min)

### Backend - Rate Limiting
- [ ] `rate-limiter.js` avancado
- [ ] `circuit-breaker.js`
- [ ] Integracao com providers EP13
- [ ] Endpoints de status

### Backend - Market Hours
- [ ] `market-hours.js`
- [ ] `holiday-calendar.js`
- [ ] Feriados moveis (Pascoa)
- [ ] Pregoes especiais
- [ ] Endpoint GET /market/status

### Backend - Realtime
- [ ] `realtime-service.js` com WebSocket
- [ ] `sse-handler.js` como alternativa
- [ ] Redis pub/sub para broadcast
- [ ] Heartbeat para conexoes
- [ ] Teste de carga (1000 clientes)

### Frontend
- [ ] `websocketService.js`
- [ ] `useRealtimeUpdates.js` composable
- [ ] `useMarketStatus.js` composable
- [ ] `LiveIndicator.vue`
- [ ] `LastUpdateIndicator.vue`
- [ ] `MarketStatusBadge.vue`
- [ ] `StaleDataWarning.vue`
- [ ] Animacao de atualizacao de preco
- [ ] Testes de responsividade

### QA
- [ ] Validar scheduler inicia com 3 jobs
- [ ] Validar job de acoes fora do horario (nao executa)
- [ ] Validar job de acoes dentro do horario (executa)
- [ ] Validar feriados (nao executa)
- [ ] Validar rate limit (aguarda)
- [ ] Validar circuit breaker (abre apos 5 falhas)
- [ ] Validar WebSocket conecta e recebe mensagens
- [ ] Validar reconexao automatica
- [ ] Validar indicadores visuais no frontend
- [ ] Validar latencia < 2s

### DevOps
- [ ] Variaveis de ambiente documentadas
- [ ] Health check do scheduler
- [ ] Metricas Prometheus
- [ ] Alertas para falhas consecutivas
- [ ] Logs estruturados (JSON)
- [ ] Monitoramento de rate limits

---

## 11. Proximos Passos

Apos conclusao do EP14, os seguintes epicos podem ser iniciados ou integrados:

1. **EP12 (Criptomoedas)**: Integrar scheduler de alta frequencia
2. **EP07 (Renda Fixa)**: Integrar atualizacao de indices BCB
3. **EP19 (Dashboard)**: Exibir indicadores de atualizacao em tempo real
4. **EP23-28 (Qualidade)**: Monitoramento e alertas para falhas de atualizacao

---

*Documento criado pelo Architect - MoneyTrackr V3*

# EP14 — Atualização de Dados de Mercado

> **Épico**: 14 — Atualização de Dados
> **Versão**: 1.0
> **Data**: 2026-03-27
> **Status**: Ready for Architect

---

## Visão Geral

A atualização de dados de mercado é o coração do MoneyTrackr. Diferentes classes de ativos exigem frequências de atualização distintas: ações durante horário de mercado (B3: 10h-17h), renda fixa após divulgação de taxas pelo BCB, e criptomoedas em alta frequência 24/7. Este épico implementa um Scheduler Service robusto com node-cron, filas de atualização por tipo de ativo, rate limiting para respeitar cotas de APIs, e notificações em tempo real para o frontend via Redis pub/sub e WebSocket/SSE.

**Impacto no Negócio**: Dados desatualizados tornam o sistema inútil para tomada de decisão. Atualizações em tempo real durante horário de mercado são diferencial competitivo frente a apps que atualizam apenas 1x/dia. A frequência adequada por tipo de ativo otimiza custos de API e recursos computacionais.

**Métricas-alvo**:
- Ações: atualização a cada 15 min durante horário B3 (10h-17h)
- Renda Fixa: atualização diária após divulgação BCB (CDI/IPCA/SELIC)
- Cripto: atualização a cada 1-5 min, 24/7
- Latência de notificação frontend < 2s após atualização
- Taxa de sucesso de atualização > 99% (com retry)
- Rate limit de APIs respeitado 100% do tempo

**Dependências de Épicos**:
- Épico 1 (Arquitetura) — infraestrutura Redis, MongoDB, Docker
- Épico 3 (Carteiras) — posições para determinar ativos a atualizar
- Épico 4 (Transações) — tickers nas transações
- Épico 7 (Renda Fixa) — taxas CDI/IPCA/SELIC
- Épico 12 (Criptomoedas) — scheduler de alta frequência
- Épico 13 (Fontes de Dados) — providers de mercado (Brapi, CoinGecko, BCB)

---

## Stories

---

### EP14-001 Scheduler Service com node-cron

**Como** sistema de atualização de dados
**Eu quero** um scheduler service configurável com node-cron que execute jobs em frequências diferentes por tipo de ativo
**Para que** cada classe de ativo seja atualizada na frequência adequada, otimizando recursos e respeitando rate limits das APIs

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 13 story points (XL)

**Contexto**:
O Scheduler Service é o orquestrador central de todas as atualizações de dados de mercado. Utiliza node-cron para agendar jobs com expressões cron configuráveis. Cada tipo de ativo possui seu próprio job: (1) Ações — `*/15 10-17 * * 1-5` (a cada 15 min, 10h-17h, seg-sex); (2) Renda Fixa — `0 9 * * 1-5` (9h diário, seg-sex, após divulgação BCB); (3) Cripto — `*/1 * * * *` (a cada 1 min, 24/7). O scheduler deve ser resiliente a falhas, suportar configuração dinâmica via API, e persistir estado em Redis.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o scheduler service está iniciando
      QUANDO a inicialização completa
      ENTÃO três jobs cron devem estar registrados: ações (15 min em horário B3), renda fixa (diário 9h), cripto (1 min 24/7)

- [ ] DADO que o job de ações está configurado para horário B3 (10h-17h)
      QUANDO são 09:45 em um dia de semana
      ENTÃO o job NÃO deve executar (fora do horário)
      QUANDO são 10:15 no mesmo dia
      ENTÃO o job DEVE executar (dentro do horário)

- [ ] DADO que o scheduler está em execução
      QUANDO uma requisição GET /scheduler/status é feita
      ENTÃO deve retornar status de cada job (running/stopped, lastRun, nextRun, successCount, errorCount)

- [ ] DADO que o administrador quer alterar a frequência de atualização de ações
      QUANDO uma requisição PUT /scheduler/config é feita com `{ "assetType": "STOCK", "cronExpression": "*/30 10-17 * * 1-5" }`
      ENTÃO o job de ações deve ser reconfigurado para executar a cada 30 min
      E a configuração deve ser persistida no Redis

- [ ] DADO que o scheduler service reinicia (ex: deploy)
      QUANDO a inicialização ocorre
      ENTÃO as configurações de cron devem ser carregadas do Redis (se existirem) ou usar defaults

- [ ] DADO que é feriado nacional (ex: Natal, Ano Novo)
      QUANDO o job de ações tenta executar
      ENTÃO deve verificar calendário de feriados e NÃO executar em dias de feriado

**Dependências**:
- Bloqueada por: EP01 (Arquitetura), EP13 (Fontes de Dados)
- Bloqueia: EP14-002, EP14-003, EP14-004

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura >= 90%
- [ ] Testes de integração passando (scheduler com mocks)
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação da API atualizada (Swagger)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

**Estrutura de Arquivos** (`src/app/scheduler/`):
```
src/app/scheduler/
  scheduler-service.js           // orquestrador principal
  scheduler-router.js            // rotas HTTP
  scheduler-manager.js           // lógica de negócio
  jobs/
    stock-update-job.js          // job de ações
    fixed-income-job.js          // job de renda fixa
    crypto-update-job.js         // job de cripto
    base-job.js                  // classe base para jobs
  models/
    job-config-model.js          // schema de configuração
    job-execution-model.js       // schema de histórico de execuções
  utils/
    market-hours.js              // detecção de horário de mercado
    holiday-calendar.js          // calendário de feriados B3
```

**Scheduler Service** (`src/app/scheduler/scheduler-service.js`):
```javascript
const cron = require('node-cron')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app-constants')
const logger = new JsonLog(SERVICE_NAME)

class SchedulerService {
  constructor(appManager, redisClient) {
    this.appManager = appManager
    this.redisClient = redisClient
    this.jobs = new Map()
    this.defaultConfigs = {
      STOCK: { cron: '*/15 10-17 * * 1-5', enabled: true },
      FIXED_INCOME: { cron: '0 9 * * 1-5', enabled: true },
      CRYPTO: { cron: '*/1 * * * *', enabled: true },
    }
  }

  async initialize() {
    // Carregar configurações do Redis ou usar defaults
    const configs = await this.loadConfigs()
    
    // Registrar jobs
    for (const [assetType, config] of Object.entries(configs)) {
      if (config.enabled) {
        await this.registerJob(assetType, config.cron)
      }
    }
    
    logger.log('Scheduler initialized', { 
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
    })
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

      // Persistir execução no MongoDB
      await this.recordExecution(assetType, 'SUCCESS', result, Date.now() - startTime)

      logger.log(`Job ${assetType} completed`, {
        internal: { method: 'executeJob', filename: 'scheduler-service.js' },
        assetType,
        duration: Date.now() - startTime,
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

  getJobHandler(assetType) {
    const handlers = {
      STOCK: new (require('./jobs/stock-update-job'))(this.appManager),
      FIXED_INCOME: new (require('./jobs/fixed-income-job'))(this.appManager),
      CRYPTO: new (require('./jobs/crypto-update-job'))(this.appManager),
    }
    return handlers[assetType]
  }

  getNextRun(cronExpression) {
    // Usar biblioteca cron-parser para calcular próxima execução
    const parser = require('cron-parser')
    const interval = parser.parseExpression(cronExpression, {
      timezone: 'America/Sao_Paulo',
    })
    return interval.next().toDate()
  }

  async loadConfigs() {
    const saved = await this.redisClient.get('scheduler:configs')
    if (saved) {
      return JSON.parse(saved)
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

**Base Job** (`src/app/scheduler/jobs/base-job.js`):
```javascript
class BaseJob {
  constructor(appManager) {
    this.appManager = appManager
  }

  async execute() {
    throw new Error('execute() must be implemented by subclass')
  }

  async getActiveTickers() {
    // Buscar tickers únicos de posições ativas
    const PositionDAO = require('../../position/position-dao')
    const positionDAO = new PositionDAO(this.appManager.getDb())
    return await positionDAO.findDistinctTickers()
  }
}

module.exports = BaseJob
```

**Rotas** (`src/app/scheduler/scheduler-router.js`):
```javascript
const express = require('express')
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

**Model de Execução** (`src/app/scheduler/models/job-execution-model.js`):
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
    enum: ['SUCCESS', 'ERROR', 'PARTIAL'],
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

// Índice para queries de histórico
schema.index({ assetType: 1, startTime: -1 })

module.exports = { schema }
```

**Variáveis de Ambiente**:
```
SCHEDULER_ENABLED=true
SCHEDULER_STOCK_CRON=*/15 10-17 * * 1-5
SCHEDULER_FIXED_INCOME_CRON=0 9 * * 1-5
SCHEDULER_CRYPTO_CRON=*/1 * * * *
SCHEDULER_TIMEZONE=America/Sao_Paulo
```

**Cenários de Teste**:
- Cenário 1: Inicialização do scheduler → 3 jobs registrados com crons corretos
- Cenário 2: Job de ações fora do horário (09:45) → não executa
- Cenário 3: Job de ações dentro do horário (10:15) → executa
- Cenário 4: GET /scheduler/status → retorna status de todos os jobs
- Cenário 5: PUT /scheduler/config com cron válido → job reconfigurado
- Cenário 6: PUT /scheduler/config com cron inválido → erro 400
- Cenário 7: Scheduler reinicia → configurações carregadas do Redis
- Cenário 8: Feriado nacional → job de ações não executa
- Cenário 9: Fim de semana → job de ações não executa
- Cenário 10: Job de cripto executa 24/7 → executa mesmo de madrugada

---

### EP14-002 Filas de Atualização por Tipo de Ativo

**Como** sistema de atualização de dados
**Eu quero** filas de processamento separadas por tipo de ativo com batch processing
**Para que** as atualizações sejam processadas de forma eficiente, respeitando rate limits das APIs e permitindo processamento paralelo

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points (L)

**Contexto**:
Cada tipo de ativo possui características distintas de atualização. Ações precisam de batch processing para respeitar rate limits da Brapi (ex: 3 req/min). Cripto precisa de alta frequência mas com fallback entre providers. Renda fixa é menos frequente mas precisa de dados do BCB. As filas utilizam Bull (Redis-based queue) para gerenciar jobs, com priorização, retry com exponential backoff, e processamento concorrente.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que existem 100 tickers de ações para atualizar
      QUANDO o job de ações executa
      ENTÃO os tickers devem ser divididos em batches de 50 (configurável)
      E cada batch deve ser processado sequencialmente com delay de 20s entre batches

- [ ] DADO que um batch de atualização falha (API retorna 500)
      QUANDO o erro é detectado
      ENTÃO o batch deve ser reenfileirado com exponential backoff (1s, 2s, 4s, 8s, 16s)
      E após 5 tentativas, marcar como falho e continuar

- [ ] DADO que a fila de cripto está processando
      QUANDO um novo job é adicionado
      ENTÃO deve ser processado em paralelo (concurrency: 3) sem bloquear outros jobs

- [ ] DADO que o rate limit da Brapi é de 3 req/min
      QUANDO o processador de ações tenta fazer a 4ª requisição em 1 min
      ENTÃO deve aguardar até que o limite seja liberado (rate limiter)

- [ ] DADO que existem jobs pendentes na fila
      QUANDO o serviço reinicia
      ENTÃO os jobs pendentes devem ser recuperados e processados

- [ ] DADO que o processamento de um batch completa
      QUANDO todos os preços são atualizados
      ENTÃO deve publicar evento no Redis pub/sub para notificar frontend

**Dependências**:
- Bloqueada por: EP14-001 (Scheduler Service)
- Bloqueia: EP14-003, EP14-004

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] Teste de carga: 500 tickers processados em < 5 min
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação atualizada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

**Estrutura de Arquivos** (`src/app/queue/`):
```
src/app/queue/
  queue-manager.js               // gerenciador de filas Bull
  processors/
    stock-processor.js           // processador de ações
    fixed-income-processor.js    // processador de renda fixa
    crypto-processor.js          // processador de cripto
  rate-limiter.js                // rate limiter para APIs
  batch-handler.js               // utilitário de batch
```

**Queue Manager** (`src/app/queue/queue-manager.js`):
```javascript
const Queue = require('bull')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app-constants')
const logger = new JsonLog(SERVICE_NAME)

class QueueManager {
  constructor(redisClient) {
    this.redisClient = redisClient
    this.queues = {}
    this.processors = {}
    
    this.redisConfig = {
      host: process.env.REDIS_HOST || 'redis',
      port: process.env.REDIS_PORT || 6379,
    }
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
      },
    })

    this.queues.FIXED_INCOME = new Queue('fixed-income-updates', {
      redis: this.redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    })

    this.queues.CRYPTO = new Queue('crypto-updates', {
      redis: this.redisConfig,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 500 },
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

    // Ações: processamento sequencial com rate limit
    this.queues.STOCK.process(1, new StockProcessor().process)

    // Renda Fixa: processamento simples
    this.queues.FIXED_INCOME.process(1, new FixedIncomeProcessor().process)

    // Cripto: processamento paralelo (alta frequência)
    this.queues.CRYPTO.process(3, new CryptoProcessor().process)
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

**Stock Processor** (`src/app/queue/processors/stock-processor.js`):
```javascript
const RateLimiter = require('../rate-limiter')
const BatchHandler = require('../batch-handler')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../../app-constants')
const logger = new JsonLog(SERVICE_NAME)

class StockProcessor {
  constructor() {
    this.rateLimiter = new RateLimiter({
      maxRequests: 3,
      perMilliseconds: 60000, // 3 req/min para Brapi
    })
    this.batchHandler = new BatchHandler({
      batchSize: 50,
      delayBetweenBatches: 20000, // 20s entre batches
    })
  }

  async process(job) {
    const { tickers, provider } = job.data
    
    logger.log('Processing stock batch', {
      internal: { method: 'process', filename: 'stock-processor.js' },
      tickersCount: tickers.length,
      jobId: job.id,
    })

    const results = {
      success: [],
      failed: [],
    }

    // Dividir em batches
    const batches = this.batchHandler.createBatches(tickers)

    for (const [index, batch] of batches.entries()) {
      // Aguardar rate limit
      await this.rateLimiter.waitForSlot()

      try {
        const prices = await provider.getBatchPrices(batch)
        
        // Salvar preços no Redis e MongoDB
        await this.savePrices(prices)
        
        results.success.push(...batch)
        
        logger.log(`Batch ${index + 1}/${batches.length} completed`, {
          internal: { method: 'process', filename: 'stock-processor.js' },
          batchSize: batch.length,
        })

        // Delay entre batches
        if (index < batches.length - 1) {
          await this.batchHandler.delay()
        }
      } catch (error) {
        results.failed.push(...batch)
        logger.error(`Batch ${index + 1} failed`, error, {
          internal: { method: 'process', filename: 'stock-processor.js' },
        })
        // Retry será feito pelo Bull (exponential backoff)
        throw error
      }
    }

    // Publicar evento de atualização
    await this.publishUpdate(results)

    return results
  }

  async savePrices(prices) {
    // Salvar no Redis (cache quente)
    const pipeline = this.redisClient.pipeline()
    for (const price of prices) {
      const key = `stock:price:${price.ticker}`
      pipeline.set(key, JSON.stringify(price), 'EX', 3600) // TTL 1h
    }
    await pipeline.exec()

    // Salvar no MongoDB (histórico)
    const PriceHistoryDAO = require('../../price/price-history-dao')
    const priceHistoryDAO = new PriceHistoryDAO(this.db)
    await priceHistoryDAO.insertMany(prices)
  }

  async publishUpdate(results) {
    const event = {
      type: 'STOCK_PRICES_UPDATED',
      timestamp: new Date().toISOString(),
      data: results,
    }
    await this.redisClient.publish('price-updates', JSON.stringify(event))
  }
}

module.exports = StockProcessor
```

**Rate Limiter** (`src/app/queue/rate-limiter.js`):
```javascript
class RateLimiter {
  constructor(options) {
    this.maxRequests = options.maxRequests
    this.perMilliseconds = options.perMilliseconds
    this.requests = []
  }

  async waitForSlot() {
    const now = Date.now()
    
    // Remover requisições antigas
    this.requests = this.requests.filter(
      (time) => now - time < this.perMilliseconds
    )

    if (this.requests.length >= this.maxRequests) {
      // Calcular tempo de espera
      const oldestRequest = this.requests[0]
      const waitTime = this.perMilliseconds - (now - oldestRequest)
      
      await new Promise((resolve) => setTimeout(resolve, waitTime))
      
      // Recursão para verificar novamente
      return this.waitForSlot()
    }

    this.requests.push(now)
  }
}

module.exports = RateLimiter
```

**Batch Handler** (`src/app/queue/batch-handler.js`):
```javascript
class BatchHandler {
  constructor(options) {
    this.batchSize = options.batchSize || 50
    this.delayBetweenBatches = options.delayBetweenBatches || 20000
  }

  createBatches(items) {
    const batches = []
    for (let i = 0; i < items.length; i += this.batchSize) {
      batches.push(items.slice(i, i + this.batchSize))
    }
    return batches
  }

  async delay() {
    return new Promise((resolve) => {
      setTimeout(resolve, this.delayBetweenBatches)
    })
  }
}

module.exports = BatchHandler
```

**Exponential Backoff (configurado no Bull)**:
```javascript
// Configuração no QueueManager
defaultJobOptions: {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 1000, // 1s, 2s, 4s, 8s, 16s
  },
}
```

**Cenários de Teste**:
- Cenário 1: 100 tickers de ações → divididos em 2 batches de 50
- Cenário 2: Batch falha → retry com exponential backoff
- Cenário 3: Rate limit atingido → aguarda liberação
- Cenário 4: Serviço reinicia → jobs pendentes recuperados
- Cenário 5: Processamento completo → evento publicado no Redis
- Cenário 6: Fila de cripto → processamento paralelo (3 workers)
- Cenário 7: 5 tentativas falham → job marcado como failed
- Cenário 8: Delay entre batches → 20s respeitado

---

### EP14-003 Detecção de Horário de Mercado e Feriados

**Como** sistema de atualização de dados
**Eu quero** detectar automaticamente horário de mercado B3 e feriados nacionais
**Para que** as atualizações de ações ocorram apenas em dias e horários válidos, economizando recursos e evitando dados desatualizados

**Tipo**: Feature
**Prioridade**: Should Have
**Estimativa**: 5 story points (M)

**Contexto**:
A B3 opera de segunda a sexta, das 10h às 17h (horário de Brasília), exceto em feriados nacionais. O sistema deve detectar automaticamente se está em horário de mercado antes de executar atualizações de ações. Feriados devem ser carregados de uma fonte confiável (API ou arquivo estático) e atualizados anualmente. O sistema também deve considerar pregões especiais (ex: véspera de Natal com horário reduzido).

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que são 10:30 em uma terça-feira comum
      QUANDO o sistema verifica se está em horário de mercado
      ENTÃO deve retornar `true` (dentro do horário B3)

- [ ] DADO que são 18:00 em uma terça-feira comum
      QUANDO o sistema verifica se está em horário de mercado
      ENTÃO deve retornar `false` (fora do horário B3)

- [ ] DADO que é um feriado nacional (ex: 07/09 - Independência)
      QUANDO o sistema verifica se está em horário de mercado
      ENTÃO deve retornar `false` (feriado, sem pregão)

- [ ] DADO que é sábado às 11:00
      QUANDO o sistema verifica se está em horário de mercado
      ENTÃO deve retornar `false` (fim de semana)

- [ ] DADO que é véspera de Natal (24/12) às 13:00
      QUANDO o sistema verifica se está em horário de mercado
      ENTÃO deve retornar `false` (pregão especial encerra às 13h)

- [ ] DADO que o ano está mudando (2026 → 2027)
      QUANDO o sistema detecta mudança de ano
      ENTÃO deve recarregar calendário de feriados do novo ano

**Dependências**:
- Bloqueada por: EP14-001 (Scheduler Service)
- Bloqueia: Nenhuma

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura >= 90%
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação atualizada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

**Market Hours Utility** (`src/app/scheduler/utils/market-hours.js`):
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
    // Verificar dia da semana (0 = domingo, 6 = sábado)
    const dayOfWeek = date.getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false
    }

    // Verificar feriado
    if (this.holidayCalendar.isHoliday(date)) {
      return false
    }

    // Verificar pregão especial
    const specialSession = this.holidayCalendar.getSpecialSession(date)
    if (specialSession) {
      const hour = date.getHours()
      return hour >= specialSession.open && hour < specialSession.close
    }

    // Verificar horário normal
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
      
      // Se passou do horário de fechamento, ir para próximo dia
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
    }
  }
}

module.exports = MarketHours
```

**Holiday Calendar** (`src/app/scheduler/utils/holiday-calendar.js`):
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
      '01-01': 'Confraternização Universal',
      '04-21': 'Tiradentes',
      '05-01': 'Dia do Trabalho',
      '09-07': 'Independência do Brasil',
      '10-12': 'Nossa Senhora Aparecida',
      '11-02': 'Finados',
      '11-15': 'Proclamação da República',
      '12-25': 'Natal',
    }

    // Feriados móveis (calculados anualmente)
    const year = new Date().getFullYear()
    const movableHolidays = this.calculateMovableHolidays(year)

    return { ...fixedHolidays, ...movableHolidays }
  }

  calculateMovableHolidays(year) {
    // Carnaval: 47 dias antes da Páscoa
    // Sexta-feira Santa: 2 dias antes da Páscoa
    // Corpus Christi: 60 dias após a Páscoa
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
    // Algoritmo de Gauss para calcular a Páscoa
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
    // Pregões especiais com horário reduzido
    return {
      '12-24': { open: 10, close: 13, name: 'Véspera de Natal' },
      '12-31': { open: 10, close: 13, name: 'Véspera de Ano Novo' },
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

**Integração com Stock Job**:
```javascript
// Em stock-update-job.js
async execute() {
  const marketHours = new MarketHours()
  
  if (!marketHours.isInMarketHours()) {
    logger.log('Skipping stock update - outside market hours', {
      internal: { method: 'execute', filename: 'stock-update-job.js' },
      marketStatus: marketHours.getMarketStatus(),
    })
    return { skipped: true, reason: 'OUTSIDE_MARKET_HOURS' }
  }

  // Prosseguir com atualização...
}
```

**Endpoint de Status de Mercado**:
```javascript
// GET /api/market/status
router.get('/market/status', async (req, res) => {
  const marketHours = new MarketHours()
  const status = marketHours.getMarketStatus()
  res.json(status)
})
```

**Cenários de Teste**:
- Cenário 1: Terça-feira 10:30 → em horário de mercado
- Cenário 2: Terça-feira 18:00 → fora do horário
- Cenário 3: Feriado nacional → fora do horário
- Cenário 4: Sábado → fora do horário
- Cenário 5: Véspera de Natal 13:00 → fora do horário (pregão especial)
- Cenário 6: Véspera de Natal 11:00 → em horário de mercado
- Cenário 7: Mudança de ano → feriados recarregados
- Cenário 8: Carnaval (data móvel) → feriado reconhecido

---

### EP14-004 Notificações em Tempo Real via Redis Pub/Sub

**Como** frontend do MoneyTrackr
**Eu quero** receber notificações em tempo real quando preços são atualizados
**Para que** a interface seja atualizada automaticamente sem necessidade de polling manual

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points (L)

**Contexto**:
O backend publica eventos de atualização de preços em canais Redis pub/sub. O frontend se conecta via WebSocket ou Server-Sent Events (SSE) para receber essas notificações em tempo real. Cada tipo de ativo possui seu canal: `stock:updates`, `fixed-income:updates`, `crypto:updates`. O sistema deve suportar múltiplos clientes conectados simultaneamente e garantir entrega de mensagens.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o frontend está conectado via WebSocket
      QUANDO o backend atualiza preços de ações
      ENTÃO o frontend deve receber notificação em menos de 2 segundos
      E a notificação deve conter: tipo de ativo, tickers atualizados, timestamp

- [ ] DADO que múltiplos usuários estão conectados simultaneamente
      QUANDO uma atualização de preço é publicada
      ENTÃO todos os usuários devem receber a notificação

- [ ] DADO que o usuário possui apenas BTC e ETH em carteira
      QUANDO uma atualização de SOL é publicada
      ENTÃO o frontend deve filtrar e não atualizar SOL (otimização)

- [ ] DADO que a conexão WebSocket cai
      QUANDO a reconexão ocorre
      ENTÃO o sistema deve reconectar automaticamente com exponential backoff
      E solicitar estado atualizado após reconexão

- [ ] DADO que o usuário está na página de Criptomoedas
      QUANDO preços de cripto são atualizados
      ENTÃO apenas o canal de cripto deve estar ativo (economia de recursos)

- [ ] DADO que o backend publica evento de erro
      QUANDO o frontend recebe a notificação
      ENTÃO deve exibir indicador de "dados desatualizados" com timestamp do último dado válido

**Dependências**:
- Bloqueada por: EP14-002 (Filas de Atualização)
- Bloqueia: EP14-005

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] Teste de carga: 1000 clientes conectados
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação atualizada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

**Estrutura de Arquivos** (`src/app/realtime/`):
```
src/app/realtime/
  realtime-service.js            // gerenciador de pub/sub
  websocket-handler.js           // handler de WebSocket
  sse-handler.js                 // handler de Server-Sent Events
  channel-manager.js             // gerenciador de canais
```

**Realtime Service** (`src/app/realtime/realtime-service.js`):
```javascript
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
    const WebSocket = require('ws')
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

      // Enviar confirmação de conexão
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

    // Heartbeat para detectar conexões mortas
    this.startHeartbeat()
  }

  handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data)
      const subscriber = this.subscribers.get(clientId)

      switch (message.type) {
        case 'SUBSCRIBE':
          subscriber.channels.add(message.channel)
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

**SSE Handler** (`src/app/realtime/sse-handler.js`):
```javascript
class SSEHandler {
  constructor(redisClient) {
    this.redisClient = redisClient
    this.clients = new Map()
  }

  handleConnection(req, res) {
    const clientId = this.generateClientId()
    
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Desabilitar buffering do Nginx
    })

    // Enviar evento inicial
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', clientId })}\n\n`)

    // Inscrever nos canais solicitados
    const channels = req.query.channels?.split(',') || []
    
    const client = {
      res,
      channels: new Set(channels),
    }
    
    this.clients.set(clientId, client)

    // Inscrever no Redis
    channels.forEach((channel) => {
      this.redisClient.subscribe(channel, (message) => {
        res.write(`data: ${message}\n\n`)
      })
    })

    // Heartbeat
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n')
    }, 15000)

    req.on('close', () => {
      clearInterval(heartbeat)
      this.clients.delete(clientId)
    })
  }

  generateClientId() {
    return `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

module.exports = SSEHandler
```

**Rotas de Realtime**:
```javascript
// GET /api/realtime/stream (SSE)
router.get('/realtime/stream', async (req, res) => {
  const sseHandler = new SSEHandler(appManager.getRedisClient())
  sseHandler.handleConnection(req, res)
})

// GET /api/realtime/stats
router.get('/realtime/stats', async (req, res) => {
  const realtimeService = appManager.getRealtimeService()
  res.json(realtimeService.getStats())
})
```

**Frontend WebSocket Hook**:
```javascript
// src/hooks/useRealtimeUpdates.js
const useRealtimeUpdates = (channels, onMessage) => {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState(null)
  const wsRef = useRef(null)
  const reconnectAttempts = useRef(0)

  const connect = useCallback(() => {
    const ws = new WebSocket(`${WS_URL}/api/realtime/ws`)
    
    ws.onopen = () => {
      setConnected(true)
      setError(null)
      reconnectAttempts.current = 0
      
      // Inscrever nos canais
      channels.forEach((channel) => {
        ws.send(JSON.stringify({ type: 'SUBSCRIBE', channel }))
      })
    }

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      onMessage(message)
    }

    ws.onerror = (err) => {
      setError('Connection error')
    }

    ws.onclose = () => {
      setConnected(false)
      
      // Exponential backoff para reconexão
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
      reconnectAttempts.current++
      
      setTimeout(connect, delay)
    }

    wsRef.current = ws
  }, [channels, onMessage])

  useEffect(() => {
    connect()
    
    return () => {
      wsRef.current?.close()
    }
  }, [connect])

  return { connected, error }
}
```

**Cenários de Teste**:
- Cenário 1: Frontend conecta via WebSocket → recebe confirmação
- Cenário 2: Backend atualiza preços → frontend recebe em < 2s
- Cenário 3: Múltiplos usuários → todos recebem notificação
- Cenário 4: Conexão cai → reconexão automática com backoff
- Cenário 5: Usuário sem SOL → não recebe update de SOL
- Cenário 6: SSE como alternativa → funciona igual WebSocket
- Cenário 7: 1000 clientes conectados → todos recebem mensagens
- Cenário 8: Heartbeat funciona → conexões mortas detectadas

---

### EP14-005 Indicadores de Atualização no Frontend

**Como** usuário do MoneyTrackr
**Eu quero** ver indicadores visuais de quando os dados foram atualizados pela última vez e se estão "ao vivo"
**Para que** eu saiba se os dados exibidos são atuais e possa confiar nas informações para tomada de decisão

**Tipo**: Feature
**Prioridade**: Should Have
**Estimativa**: 5 story points (M)

**Contexto**:
O frontend deve exibir indicadores claros de atualização: (1) "Última atualização: há X segundos/minutos" em cada seção; (2) Badge "AO VIVO" durante horário de mercado para ações; (3) Badge "24/7" para cripto; (4) Indicador de "dados desatualizados" quando atualização falha; (5) Animação suave quando valores mudam. Esses indicadores aumentam a confiança do usuário nos dados.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário está na página de Ações durante horário de mercado (10h-17h)
      QUANDO a página carrega
      ENTÃO deve exibir badge "AO VIVO" com indicador verde pulsante
      E mostrar "Última atualização: há X segundos"

- [ ] DADO que o preço de uma ação foi atualizado
      QUANDO o frontend recebe a notificação
      ENTÃO o valor deve ser atualizado com animação de fade-in
      E o contador de "última atualização" deve resetar

- [ ] DADO que a atualização falhou (API indisponível)
      QUANDO passam mais de 5 minutos desde a última atualização bem-sucedida
      ENTÃO deve exibir indicador de alerta "Dados desatualizados"
      E mostrar timestamp da última atualização válida

- [ ] DADO que o usuário está na página de Criptomoedas
      QUANDO a página carrega
      ENTÃO deve exibir badge "24/7" indicando atualização contínua
      E mostrar "Última atualização: há X segundos"

- [ ] DADO que são 18:00 (fora do horário B3)
      QUANDO o usuário acessa a página de Ações
      ENTÃO deve exibir "Mercado fechado" com horário da próxima abertura
      E mostrar "Última atualização: X horas atrás (fechamento)"

- [ ] DADO que o usuário está offline
      QUANDO tenta acessar dados
      ENTÃO deve exibir indicador "Offline" e mostrar dados em cache
      E tentar reconectar automaticamente

**Dependências**:
- Bloqueada por: EP14-004 (Notificações em Tempo Real)
- Bloqueia: Nenhuma

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura >= 90%
- [ ] Testes de responsividade (mobile e desktop)
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação atualizada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

**Estrutura de Arquivos** (`src/components/realtime/`):
```
src/components/realtime/
  LiveIndicator.jsx              // badge "AO VIVO"
  LastUpdateIndicator.jsx        // "Última atualização: há X"
  MarketStatusBadge.jsx         // "Mercado aberto/fechado"
  StaleDataWarning.jsx          // alerta de dados desatualizados
  OfflineIndicator.jsx          // indicador de offline
  PriceUpdateAnimation.jsx      // animação de atualização
```

**Live Indicator** (`src/components/realtime/LiveIndicator.jsx`):
```jsx
import React, { useState, useEffect } from 'react'
import styled, { keyframes } from 'styled-components'

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  
  ${({ variant }) => {
    switch (variant) {
      case 'live':
        return `
          background: rgba(34, 197, 94, 0.1);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.3);
        `
      case '247':
        return `
          background: rgba(168, 85, 247, 0.1);
          color: #a855f7;
          border: 1px solid rgba(168, 85, 247, 0.3);
        `
      case 'closed':
        return `
          background: rgba(107, 114, 128, 0.1);
          color: #6b7280;
          border: 1px solid rgba(107, 114, 128, 0.3);
        `
    }
  }}
`

const Dot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: ${pulse} 2s ease-in-out infinite;
`

const LiveIndicator = ({ variant = 'live', showDot = true }) => {
  const labels = {
    live: 'AO VIVO',
    '247': '24/7',
    closed: 'MERCADO FECHADO',
  }

  return (
    <Badge variant={variant}>
      {showDot && variant !== 'closed' && <Dot />}
      {labels[variant]}
    </Badge>
  )
}

export default LiveIndicator
```

**Last Update Indicator** (`src/components/realtime/LastUpdateIndicator.jsx`):
```jsx
import React, { useState, useEffect } from 'react'
import styled from 'styled-components'

const Container = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: ${({ stale }) => (stale ? '#ef4444' : '#6b7280')};
`

const formatTimeAgo = (date) => {
  const now = new Date()
  const diff = Math.floor((now - new Date(date)) / 1000)

  if (diff < 60) return 'há poucos segundos'
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`
  return `há ${Math.floor(diff / 86400)} dias`
}

const LastUpdateIndicator = ({ lastUpdate, stale = false }) => {
  const [timeAgo, setTimeAgo] = useState(() => formatTimeAgo(lastUpdate))

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeAgo(formatTimeAgo(lastUpdate))
    }, 10000) // Atualizar a cada 10s

    return () => clearInterval(interval)
  }, [lastUpdate])

  return (
    <Container stale={stale}>
      <span>Última atualização:</span>
      <strong>{timeAgo}</strong>
      {stale && <span>⚠️</span>}
    </Container>
  )
}

export default LastUpdateIndicator
```

**Market Status Badge** (`src/components/realtime/MarketStatusBadge.jsx`):
```jsx
import React, { useState, useEffect } from 'react'
import styled from 'styled-components'
import LiveIndicator from './LiveIndicator'

const Container = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const NextOpen = styled.span`
  font-size: 12px;
  color: #6b7280;
`

const MarketStatusBadge = ({ assetType }) => {
  const [marketStatus, setMarketStatus] = useState(null)

  useEffect(() => {
    const fetchStatus = async () => {
      const response = await fetch('/api/market/status')
      const data = await response.json()
      setMarketStatus(data)
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 60000) // Atualizar a cada min
    return () => clearInterval(interval)
  }, [])

  if (assetType === 'CRYPTO') {
    return <LiveIndicator variant="247" />
  }

  if (!marketStatus) return null

  if (marketStatus.isOpen) {
    return <LiveIndicator variant="live" />
  }

  return (
    <Container>
      <LiveIndicator variant="closed" />
      <NextOpen>
        Abre {new Date(marketStatus.nextOpen).toLocaleString('pt-BR', {
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </NextOpen>
    </Container>
  )
}

export default MarketStatusBadge
```

**Price Update Animation** (`src/components/realtime/PriceUpdateAnimation.jsx`):
```jsx
import React, { useState, useEffect, useRef } from 'react'
import styled, { keyframes } from 'styled-components'

const fadeIn = keyframes`
  0% { opacity: 0; transform: translateY(-4px); }
  100% { opacity: 1; transform: translateY(0); }
`

const AnimatedValue = styled.span`
  display: inline-block;
  animation: ${({ animate }) => animate ? fadeIn : 'none'} 0.3s ease-out;
`

const PriceUpdateAnimation = ({ value, formatter }) => {
  const [displayValue, setDisplayValue] = useState(value)
  const [animate, setAnimate] = useState(false)
  const prevValue = useRef(value)

  useEffect(() => {
    if (prevValue.current !== value) {
      setAnimate(true)
      setDisplayValue(value)
      prevValue.current = value
      
      const timer = setTimeout(() => setAnimate(false), 300)
      return () => clearTimeout(timer)
    }
  }, [value])

  return (
    <AnimatedValue animate={animate}>
      {formatter ? formatter(displayValue) : displayValue}
    </AnimatedValue>
  )
}

export default PriceUpdateAnimation
```

**Hook de Status de Conexão**:
```javascript
// src/hooks/useConnectionStatus.js
const useConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
```

**Cenários de Teste**:
- Cenário 1: Horário de mercado → badge "AO VIVO" verde pulsante
- Cenário 2: Preço atualizado → animação de fade-in
- Cenário 3: Atualização falha → alerta de dados desatualizados
- Cenário 4: Página de cripto → badge "24/7" roxo
- Cenário 5: Fora do horário → "Mercado fechado" com próxima abertura
- Cenário 6: Usuário offline → indicador de offline
- Cenário 7: Contador de tempo → atualiza a cada 10s
- Cenário 8: Responsividade mobile → badges adaptados

---

### EP14-006 Rate Limiting e Proteção de APIs

**Como** sistema de atualização de dados
**Eu quero** implementar rate limiting robusto para proteger APIs de mercado de sobrecarga
**Para que** o sistema respeite os limites de cada provider e evite bloqueios ou custos excessivos

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points (M)

**Contexto**:
Cada provider de dados de mercado possui limites de requisição: Brapi (3 req/min gratuito, 30 req/min premium), CoinGecko (10-50 req/min), BCB (sem limite oficial, mas bom senso). O sistema deve implementar rate limiting por provider, com configuração dinâmica, monitoramento de uso, e alertas quando próximo do limite. Deve também implementar circuit breaker para falhas consecutivas.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o rate limit da Brapi é de 3 req/min
      QUANDO o sistema faz 3 requisições em 1 minuto
      ENTÃO a 4ª requisição deve aguardar até o limite ser liberado
      E o tempo de espera deve ser logado

- [ ] DADO que o sistema está próximo do rate limit (80%)
      QUANDO uma nova requisição é feita
      ENTÃO deve logar warning com uso atual e tempo até liberação

- [ ] DADO que um provider falha 5 vezes consecutivas
      QUANDO o circuit breaker detecta o padrão
      ENTÃO deve abrir o circuito e parar de tentar por 1 minuto
      E usar provider de fallback

- [ ] DADO que o circuito está aberto há 1 minuto
      QUANDO o tempo expira
      ENTÃO deve tentar uma requisição de teste (half-open)
      E fechar o circuito se sucesso, ou manter aberto se falha

- [ ] DADO que o administrador quer ajustar rate limits
      QUANDO uma requisição PUT /scheduler/rate-limits é feita
      ENTÃO os novos limites devem ser aplicados sem reiniciar o serviço

- [ ] DADO que o sistema está operando
      QUANDO uma requisição GET /scheduler/rate-limits/status é feita
      ENTÃO deve retornar uso atual de cada provider, limite, e tempo até reset

**Dependências**:
- Bloqueada por: EP14-002 (Filas de Atualização)
- Bloqueia: Nenhuma

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação atualizada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

**Rate Limiter Avançado** (`src/app/queue/advanced-rate-limiter.js`):
```javascript
class AdvancedRateLimiter {
  constructor(options) {
    this.provider = options.provider
    this.maxRequests = options.maxRequests
    this.perMilliseconds = options.perMilliseconds
    this.requests = []
    this.warningThreshold = options.warningThreshold || 0.8
  }

  async waitForSlot() {
    const now = Date.now()
    
    // Remover requisições antigas
    this.requests = this.requests.filter(
      (time) => now - time < this.perMilliseconds
    )

    const usage = this.requests.length / this.maxRequests

    // Log warning se próximo do limite
    if (usage >= this.warningThreshold) {
      logger.log('Rate limit warning', {
        internal: { method: 'waitForSlot', filename: 'advanced-rate-limiter.js' },
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
        internal: { method: 'waitForSlot', filename: 'advanced-rate-limiter.js' },
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

module.exports = AdvancedRateLimiter
```

**Circuit Breaker** (`src/app/queue/circuit-breaker.js`):
```javascript
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

**Provider com Rate Limit e Circuit Breaker**:
```javascript
class ProtectedProvider {
  constructor(provider, rateLimiter, circuitBreaker) {
    this.provider = provider
    this.rateLimiter = rateLimiter
    this.circuitBreaker = circuitBreaker
  }

  async getPrices(tickers) {
    await this.rateLimiter.waitForSlot()
    
    return this.circuitBreaker.execute(async () => {
      return this.provider.getPrices(tickers)
    })
  }
}
```

**Rotas de Rate Limit**:
```javascript
// GET /api/scheduler/rate-limits/status
router.get('/rate-limits/status', async (req, res) => {
  const status = {
    brapi: rateLimiterBrapi.getStats(),
    coingecko: rateLimiterCoingecko.getStats(),
    circuitBreakers: {
      brapi: circuitBreakerBrapi.getStatus(),
      coingecko: circuitBreakerCoingecko.getStatus(),
    },
  }
  res.json(status)
})

// PUT /api/scheduler/rate-limits
router.put('/rate-limits', async (req, res) => {
  const { provider, maxRequests, perMilliseconds } = req.body
  
  // Atualizar configuração do rate limiter
  // ...
  
  res.json({ message: 'Rate limit updated', provider })
})
```

**Configuração de Providers**:
```javascript
const PROVIDER_CONFIGS = {
  BRAPI: {
    free: { maxRequests: 3, perMilliseconds: 60000 },
    premium: { maxRequests: 30, perMilliseconds: 60000 },
  },
  COINGECKO: {
    free: { maxRequests: 10, perMilliseconds: 60000 },
    pro: { maxRequests: 50, perMilliseconds: 60000 },
  },
  BCB: {
    default: { maxRequests: 60, perMilliseconds: 60000 }, // 1 req/s
  },
}
```

**Cenários de Teste**:
- Cenário 1: 3 req/min Brapi → 4ª aguarda
- Cenário 2: 80% do limite → warning logado
- Cenário 3: 5 falhas consecutivas → circuito abre
- Cenário 4: Circuito aberto há 1 min → half-open
- Cenário 5: Half-open sucesso → circuito fecha
- Cenário 6: Half-open falha → circuito mantém aberto
- Cenário 7: PUT rate-limits → configuração atualizada
- Cenário 8: GET status → retorna uso de todos providers

---

## Mapa de Dependências

```
EP01 (Arquitetura) ─────┐
EP13 (Fontes de Dados) ─┤
                        ▼
                EP14-001 (Scheduler Service)
                        │
                        ▼
                EP14-002 (Filas de Atualização)
                        │
            ┌───────────┼───────────┐
            ▼           ▼           ▼
    EP14-003      EP14-004    EP14-006
    (Horário)     (Pub/Sub)   (Rate Limit)
            │           │           │
            └───────────┼───────────┘
                        ▼
                EP14-005 (Indicadores Frontend)
                        │
                        ▼
                EP12 (Cripto) — integração
                EP07 (Renda Fixa) — integração
                EP19 (Dashboard) — indicadores
```

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Rate limit excedido causando bloqueio de API | Alta | Crítico | Rate limiter por provider + circuit breaker + fallback providers |
| Sobrecarga de Redis com muitas conexões WebSocket | Média | Alto | Limitar conexões por usuário + heartbeat + cleanup de conexões mortas |
| Feriados não detectados causando atualizações desnecessárias | Média | Baixo | Calendário de feriados atualizado anualmente + verificação de pregão |
| Clock drift entre servidores causando jobs duplicados | Baixa | Médio | Redis distributed lock para jobs + idempotência |
| Memory leak em scheduler de longa duração | Média | Alto | Monitoramento de memória + restart periódico + testes de carga |
| API de mercado muda ou é descontinuada | Baixa | Crítico | Padrão Strategy permite trocar providers + testes de integração |
| Exponential backoff muito longo em falhas prolongadas | Média | Médio | Limite máximo de backoff (5 min) + alerta para intervenção manual |
| WebSocket desconectado sem detecção | Alta | Médio | Heartbeat a cada 30s + reconexão automática + estado de conexão visível |

---

## Checklist de Implementação

### Backend
- [ ] Scheduler Service com node-cron
- [ ] Jobs por tipo de ativo (STOCK, FIXED_INCOME, CRYPTO)
- [ ] Filas Bull com Redis
- [ ] Processadores com batch handling
- [ ] Rate limiter por provider
- [ ] Circuit breaker para falhas
- [ ] Exponential backoff para retries
- [ ] Detecção de horário de mercado B3
- [ ] Calendário de feriados nacionais
- [ ] Redis pub/sub para notificações
- [ ] WebSocket server para frontend
- [ ] SSE como alternativa
- [ ] Rotas de status e configuração
- [ ] Persistência de execuções no MongoDB

### Frontend
- [ ] Hook de WebSocket com reconexão
- [ ] Componente LiveIndicator
- [ ] Componente LastUpdateIndicator
- [ ] Componente MarketStatusBadge
- [ ] Componente StaleDataWarning
- [ ] Componente OfflineIndicator
- [ ] Animação de atualização de preço
- [ ] Hook de status de conexão
- [ ] Filtro de notificações por ativos do usuário

### DevOps
- [ ] Variáveis de ambiente documentadas
- [ ] Health check do scheduler
- [ ] Métricas de execução (Prometheus)
- [ ] Alertas para falhas consecutivas
- [ ] Logs estruturados (JSON)
- [ ] Monitoramento de rate limits

---

## Métricas de Sucesso

| Métrica | Meta | Como Medir |
|---------|------|------------|
| Latência de atualização frontend | < 2s | Timestamp pub/sub vs recebimento WebSocket |
| Taxa de sucesso de atualizações | > 99% | Jobs SUCCESS / Jobs TOTAL |
| Rate limit violations | 0 | Contador de 429 responses |
| Tempo de reconexão WebSocket | < 5s | Tempo entre disconnect e reconnect |
| Uso de memória do scheduler | < 512MB | Monitoramento de processo |
| Cobertura de testes | >= 90% | Jest coverage report |
| Disponibilidade do serviço | 99.9% | Uptime monitoring |

---

## Notas Adicionais

1. **Escalabilidade**: O scheduler pode ser executado em múltiplas instâncias com Redis distributed lock para evitar jobs duplicados.

2. **Observabilidade**: Todos os jobs devem logar início, fim, duração e resultado para troubleshooting.

3. **Configurabilidade**: Frequências de atualização devem ser configuráveis via API sem necessidade de redeploy.

4. **Fallback**: Cada tipo de ativo deve ter pelo menos 2 providers (primário e fallback) para garantir disponibilidade.

5. **Idempotência**: Jobs devem ser idempotentes - executar múltiplas vezes não deve causar efeitos colaterais.

6. **Graceful Shutdown**: O scheduler deve completar jobs em execução antes de encerrar.

7. **Timezone**: Todos os horários devem usar `America/Sao_Paulo` (BRT) para consistência com B3.

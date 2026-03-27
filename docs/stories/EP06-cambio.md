# EP06 - Cambio: Conversao Cambial para Ativos Internacionais

**Epico**: 06 - Cambio
**Autor**: @product-manager | **Data**: 2026-03-27
**Status**: Pronto para @architect

---

## Visao Geral do Epico

O MoneyTrackr precisa suportar ativos internacionais (acoes, ETFs, REITs) denominados em moedas estrangeiras (USD, EUR, etc.). Para que o usuario visualize seu patrimonio consolidado em BRL, o sistema deve converter valores utilizando taxas de cambio atuais e historicas. Este epico cobre a infraestrutura de cambio end-to-end: modelo de dados, servico de integracao com APIs externas, cache Redis, job agendado e interface frontend.

**Personas impactadas**:
- Investidor com carteira internacional (persona primaria)
- Investidor com carteira domestica que quer comparar benchmarks internacionais (persona secundaria)

**KPIs de Sucesso**:
- 100% dos ativos internacionais exibidos com valor convertido em BRL
- Tempo de resposta da conversao < 200ms (cache hit)
- Taxa de cache hit > 95% para cotacoes do dia
- Historico de cambio disponivel para pelo menos 5 anos retroativos

---

## Grafo de Dependencias

```
EP06-S01 (Model ExchangeRate)
    |
    v
EP06-S02 (DAO + Service Externo) ---> EP13 (Fontes de Dados / APIs)
    |
    v
EP06-S03 (Cache Redis) ---> EP01 (Arquitetura - Redis container)
    |
    v
EP06-S04 (Job Agendado)
    |
    v
EP06-S05 (Rotas API REST)
    |
    v
EP06-S06 (Frontend - Indicador + Toggle) ---> EP04 (Transacoes), EP05 (Preco Medio)
```

---

## EP06-S01: Modelo de Dados ExchangeRate

### [EP06-S01] Criar modelo de persistencia para taxas de cambio

**Como** sistema backend
**Eu quero** persistir taxas de cambio diarias no MongoDB
**Para que** o historico de conversao esteja disponivel para calculos retroativos e graficos

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 3 story points (S)

**Contexto**:
O modelo `ExchangeRate` armazena uma taxa de cambio por par de moedas por dia. Cada registro representa a taxa de fechamento do dia (ou a ultima taxa obtida para o dia corrente). O modelo segue o padrao do projeto: UUID como `_id`, `versionKey: false`, indexes para consultas frequentes. O campo `source` registra a origem da taxa para auditoria e fallback.

**Criterios de Aceite (Verificaveis)**:

- [ ] DADO que o schema ExchangeRate esta definido
      QUANDO o sistema inicializa o modelo no MongoDB
      ENTAO o modelo deve conter os campos: `_id` (String, UUID), `from` (String, required, ex: "USD"), `to` (String, required, ex: "BRL"), `rate` (Number, required), `date` (Date, required), `source` (String, required, ex: "BCB", "exchangerate-api"), `createdAt` (Date, default: Date.now)

- [ ] DADO que o schema possui indexes definidos
      QUANDO uma consulta por par de moedas e data e executada
      ENTAO deve utilizar o index composto `{ from: 1, to: 1, date: -1 }` para performance otimizada

- [ ] DADO que existe um index unique no schema
      QUANDO o sistema tenta inserir uma taxa duplicada (mesmo `from`, `to` e `date`)
      ENTAO o MongoDB deve rejeitar a insercao com erro de duplicidade

- [ ] DADO que o modelo exporta apenas o schema
      QUANDO importado por um DAO
      ENTAO deve seguir o padrao `module.exports = { exchangeRateSchema }` (schema, nao model)

**Dependencias**:
- Bloqueada por: EP01-Arquitetura (MongoDB container operacional)
- Bloqueia: EP06-S02, EP06-S03, EP06-S04, EP06-S05

**Definicao de Pronto (DoD)**:
- [ ] Codigo revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integracao passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentacao atualizada
- [ ] PR criado por @merge-request

**Notas Tecnicas**:

```
Arquivo: src/app/exchange-rate/exchange-rate-model.js
```

```javascript
// Estrutura esperada do schema
const exchangeRateSchema = new mongoose.Schema({
  _id: { type: String, required: true, default: uuidv4 },
  from: { type: String, required: true, uppercase: true, trim: true },  // "USD", "EUR"
  to: { type: String, required: true, uppercase: true, trim: true },    // "BRL"
  rate: { type: Number, required: true, min: 0 },
  date: { type: Date, required: true },
  source: { type: String, required: true },  // "BCB", "exchangerate-api", "fallback"
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false })

// Indexes
exchangeRateSchema.index({ from: 1, to: 1, date: -1 })
exchangeRateSchema.index({ from: 1, to: 1, date: 1 }, { unique: true })
```

**Cenarios de Teste**:
- Cenario 1: Criar registro com todos os campos obrigatorios - deve persistir com sucesso
- Cenario 2: Criar registro sem campo `rate` - deve falhar com erro de validacao
- Cenario 3: Criar registro duplicado (mesmo from/to/date) - deve falhar com erro de unique constraint
- Cenario 4: Consultar por par de moedas e range de datas - deve retornar resultados ordenados por data desc
- Cenario 5: Verificar que `from` e `to` sao armazenados em uppercase independente do input

---

## EP06-S02: Exchange Rate DAO e Servico de Integracao Externa

### [EP06-S02] Implementar DAO e servico de busca de taxas de cambio

**Como** sistema backend
**Eu quero** buscar taxas de cambio de APIs externas e persisti-las no MongoDB
**Para que** o sistema tenha dados de cambio atualizados e historicos confiaveis

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points (L)

**Contexto**:
O sistema precisa de duas camadas: (1) `ExchangeRateDAO` para operacoes de banco de dados seguindo o padrao `AppDAO`, e (2) `ExchangeRateService` para integrar com APIs externas. A fonte primaria sera a API do Banco Central do Brasil (BCB/PTAX) para pares envolvendo BRL. Como fallback, sera utilizada a exchangerate-api ou Open Exchange Rates. O servico deve implementar estrategia de fallback automatico conforme definido no EP13.

**APIs externas candidatas**:
| API | Endpoint | Uso | Limite |
|---|---|---|---|
| BCB PTAX (primaria) | `https://olinda.bcb.gov.br/olinda/servico/PTAX/...` | USD/BRL, EUR/BRL | Sem limite, dados oficiais |
| exchangerate-api (fallback) | `https://api.exchangerate-api.com/v4/latest/USD` | Multi-moedas | 1500 req/mes (free) |
| Open Exchange Rates (fallback 2) | `https://openexchangerates.org/api/latest.json` | Multi-moedas | 1000 req/mes (free) |

**Criterios de Aceite (Verificaveis)**:

- [ ] DADO que o `ExchangeRateDAO` esta implementado
      QUANDO chamado `findByPairAndDate({ from: 'USD', to: 'BRL', date: '2026-03-27' })`
      ENTAO deve retornar a taxa de cambio correspondente do MongoDB usando `.lean().exec()`

- [ ] DADO que o `ExchangeRateDAO` esta implementado
      QUANDO chamado `findByPairAndRange({ from: 'USD', to: 'BRL', startDate, endDate })`
      ENTAO deve retornar array de taxas ordenadas por data crescente para uso em graficos historicos

- [ ] DADO que o `ExchangeRateService` esta configurado com API primaria (BCB)
      QUANDO solicitada a taxa USD/BRL do dia
      ENTAO deve buscar da API BCB PTAX e retornar o valor de venda (cotacaoVenda)

- [ ] DADO que a API primaria (BCB) esta indisponivel ou retorna erro
      QUANDO solicitada uma taxa de cambio
      ENTAO o servico deve automaticamente tentar a API de fallback (exchangerate-api)
      E registrar um log de warning com `logger.error()` indicando fallback ativado

- [ ] DADO que o servico obteve uma taxa de cambio com sucesso
      QUANDO persiste no MongoDB via DAO
      ENTAO deve usar `findOneAndUpdate` com `upsert: true` para evitar duplicatas e atualizar taxa caso ja exista registro para o mesmo dia

**Dependencias**:
- Bloqueada por: EP06-S01 (Model ExchangeRate)
- Bloqueia: EP06-S04 (Job Agendado), EP06-S05 (Rotas API)
- Relacionada com: EP13 (Fontes de Dados de Mercado)

**Definicao de Pronto (DoD)**:
- [ ] Codigo revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integracao passando (com mocks das APIs externas)
- [ ] QA aprovado por @qa-analyst
- [ ] Documentacao atualizada
- [ ] PR criado por @merge-request

**Notas Tecnicas**:

```
Arquivos:
  src/app/exchange-rate/exchange-rate-dao.js
  src/app/exchange-rate/exchange-rate-service.js
  src/dispatchers/exchange-rate-dispatcher.js (opcional, se seguir padrao dispatcher)
```

**DAO - Metodos necessarios:**
```javascript
class ExchangeRateDAO extends AppDAO {
  initializeDBModel(db) {
    return db.model('exchangeRate', exchangeRateSchema)
  }

  // Busca taxa por par e data exata
  async findByPairAndDate({ from, to, date }) { ... }

  // Busca taxa mais recente para um par (usado quando nao ha taxa do dia)
  async findLatestByPair({ from, to }) { ... }

  // Busca historico por range de datas (para graficos)
  async findByPairAndRange({ from, to, startDate, endDate }) { ... }

  // Upsert: insere ou atualiza taxa do dia
  async upsertRate({ from, to, rate, date, source }) { ... }

  // Bulk insert para carga historica
  async bulkUpsertRates(rates) { ... }
}
```

**Service - Estrategia de fallback:**
```javascript
class ExchangeRateService {
  constructor(config) {
    this.bcbBaseUrl = 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata'
    this.fallbackUrl = 'https://api.exchangerate-api.com/v4/latest'
    this.timeout = config.exchangeRate?.timeout || 10000
  }

  // Busca taxa atual com fallback automatico
  async fetchCurrentRate(from, to) { ... }

  // Busca historico BCB PTAX por range
  async fetchHistoricalRates(from, to, startDate, endDate) { ... }

  // Fallback generico
  async fetchFromFallback(from, to) { ... }
}
```

**Cenarios de Teste**:
- Cenario 1: DAO - findByPairAndDate retorna taxa existente corretamente
- Cenario 2: DAO - findByPairAndDate retorna null para data sem registro
- Cenario 3: DAO - findByPairAndRange retorna array ordenado por data asc
- Cenario 4: DAO - upsertRate insere novo registro quando nao existe
- Cenario 5: DAO - upsertRate atualiza registro existente sem duplicar
- Cenario 6: Service - fetchCurrentRate retorna taxa da API BCB com sucesso
- Cenario 7: Service - fetchCurrentRate ativa fallback quando BCB retorna erro 500
- Cenario 8: Service - fetchCurrentRate ativa fallback quando BCB timeout (> 10s)
- Cenario 9: Service - fetchCurrentRate lanca excecao quando ambas APIs falham
- Cenario 10: Service - fetchHistoricalRates retorna array com taxas do periodo

---

## EP06-S03: Cache Redis para Taxas de Cambio Atuais

### [EP06-S03] Implementar cache Redis para cotacoes de cambio do dia

**Como** sistema backend
**Eu quero** cachear taxas de cambio atuais no Redis com TTL de 1 hora
**Para que** requisicoes repetidas nao sobrecarreguem APIs externas e a resposta seja < 200ms

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points (M)

**Contexto**:
Cada vez que o usuario visualiza sua carteira, o sistema precisa converter ativos internacionais para BRL. Sem cache, cada visualizacao geraria chamadas a APIs externas, causando latencia e risco de rate limiting. O cache Redis armazena a taxa atual por par de moedas com TTL de 1 hora, garantindo que o sistema use dados recentes sem chamadas excessivas. O padrao cache-aside (lazy loading) sera utilizado: verificar cache primeiro, buscar da API se miss, armazenar no cache.

**Criterios de Aceite (Verificaveis)**:

- [ ] DADO que a taxa USD/BRL esta armazenada no Redis
      QUANDO o sistema solicita a taxa USD/BRL atual
      ENTAO deve retornar o valor do cache em < 50ms sem chamar API externa

- [ ] DADO que a taxa USD/BRL NAO esta no Redis (cache miss)
      QUANDO o sistema solicita a taxa USD/BRL atual
      ENTAO deve buscar da API externa, armazenar no Redis com TTL de 3600 segundos (1 hora) e retornar o valor

- [ ] DADO que uma taxa foi armazenada no Redis ha mais de 1 hora
      QUANDO o sistema solicita essa taxa
      ENTAO a chave deve ter expirado automaticamente (TTL) e o sistema deve buscar novamente da API externa

- [ ] DADO que o Redis esta indisponivel
      QUANDO o sistema solicita uma taxa de cambio
      ENTAO deve buscar diretamente da API externa (degradacao graciosa) e registrar warning no log

- [ ] DADO que o formato da chave Redis esta padronizado
      QUANDO armazenada uma taxa
      ENTAO a chave deve seguir o padrao `exchange:current:{FROM}:{TO}` (ex: `exchange:current:USD:BRL`) e o valor deve ser JSON `{ rate, source, updatedAt }`

**Dependencias**:
- Bloqueada por: EP06-S02 (Service de busca), EP01-Arquitetura (Redis container)
- Bloqueia: EP06-S05 (Rotas API)

**Definicao de Pronto (DoD)**:
- [ ] Codigo revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integracao passando (com redis-mock)
- [ ] QA aprovado por @qa-analyst
- [ ] Documentacao atualizada
- [ ] PR criado por @merge-request

**Notas Tecnicas**:

```
Arquivo: src/app/exchange-rate/exchange-rate-cache.js
```

**Estrutura do cache:**
```javascript
class ExchangeRateCache {
  constructor(redisClient) {
    this.redis = redisClient
    this.TTL = 3600  // 1 hora em segundos
    this.KEY_PREFIX = 'exchange:current'
  }

  // Gera chave padronizada
  _buildKey(from, to) {
    return `${this.KEY_PREFIX}:${from.toUpperCase()}:${to.toUpperCase()}`
  }

  // Busca do cache
  async get(from, to) {
    const key = this._buildKey(from, to)
    const cached = await this.redis.get(key)
    return cached ? JSON.parse(cached) : null
  }

  // Armazena no cache com TTL
  async set(from, to, data) {
    const key = this._buildKey(from, to)
    const value = JSON.stringify({
      rate: data.rate,
      source: data.source,
      updatedAt: new Date().toISOString(),
    })
    await this.redis.setex(key, this.TTL, value)
  }

  // Invalida cache para um par
  async invalidate(from, to) {
    const key = this._buildKey(from, to)
    await this.redis.del(key)
  }
}
```

**Padrao cache-aside no Manager:**
```javascript
async getCurrentRate(from, to) {
  // 1. Tenta cache
  const cached = await this.exchangeRateCache.get(from, to)
  if (cached) return cached

  // 2. Cache miss - busca API externa
  const rate = await this.exchangeRateService.fetchCurrentRate(from, to)

  // 3. Armazena no cache
  await this.exchangeRateCache.set(from, to, rate)

  // 4. Persiste no MongoDB (async, nao bloqueia resposta)
  this.exchangeRateDAO.upsertRate({ from, to, ...rate, date: new Date() })
    .catch((err) => logger.error('Failed to persist rate', err, { ... }))

  return rate
}
```

**Cenarios de Teste**:
- Cenario 1: Cache hit - retorna valor do Redis sem chamar API externa
- Cenario 2: Cache miss - busca API, armazena no Redis, retorna valor
- Cenario 3: TTL expirado - trata como cache miss e renova
- Cenario 4: Redis indisponivel - busca diretamente da API (graceful degradation)
- Cenario 5: Formato da chave Redis segue padrao `exchange:current:USD:BRL`
- Cenario 6: Valor armazenado no Redis contem rate, source e updatedAt em JSON

---

## EP06-S04: Job Agendado para Atualizacao Diaria de Taxas

### [EP06-S04] Implementar job agendado para buscar e persistir taxas diariamente

**Como** sistema backend
**Eu quero** executar um job diario que busca e armazena taxas de cambio
**Para que** o historico de taxas esteja completo para graficos e calculos retroativos

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points (M)

**Contexto**:
O cache Redis garante performance para consultas em tempo real, mas os dados expiram apos 1 hora. Para graficos historicos e calculos retroativos, e necessario armazenar a taxa de fechamento de cada dia no MongoDB. Um job agendado (cron-like) deve executar diariamente apos o fechamento do mercado de cambio brasileiro (apos 17:30 BRT) para capturar a taxa PTAX de fechamento. Adicionalmente, na primeira execucao, o job deve fazer uma carga historica retroativa.

**Criterios de Aceite (Verificaveis)**:

- [ ] DADO que o job esta configurado
      QUANDO o relogio do sistema atinge 18:00 (America/Sao_Paulo) em um dia util
      ENTAO o job deve executar automaticamente e buscar a taxa PTAX de fechamento do dia

- [ ] DADO que o job executou com sucesso
      QUANDO a taxa e obtida da API BCB
      ENTAO deve persistir no MongoDB via `upsertRate` e invalidar o cache Redis do par atualizado

- [ ] DADO que o job falha ao buscar a taxa (API indisponivel)
      QUANDO a execucao falha
      ENTAO deve registrar erro no log, tentar novamente em 30 minutos (max 3 retentativas) e usar fallback se todas falharem

- [ ] DADO que o sistema inicia pela primeira vez sem historico
      QUANDO detecta que nao ha registros no MongoDB para USD/BRL
      ENTAO deve executar carga historica retroativa de pelo menos 5 anos via API BCB PTAX

- [ ] DADO que o job esta em execucao
      QUANDO tenta executar novamente (overlap)
      ENTAO a segunda execucao deve ser ignorada (mecanismo de lock)

**Dependencias**:
- Bloqueada por: EP06-S02 (Service + DAO), EP06-S03 (Cache)
- Bloqueia: EP06-S05 (Rotas API - historico)

**Definicao de Pronto (DoD)**:
- [ ] Codigo revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integracao passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentacao atualizada
- [ ] PR criado por @merge-request

**Notas Tecnicas**:

```
Arquivo: src/app/exchange-rate/exchange-rate-scheduler.js
Dependencia sugerida: node-cron ou node-schedule
```

```javascript
const cron = require('node-cron')

class ExchangeRateScheduler {
  constructor(exchangeRateManager, config) {
    this.manager = exchangeRateManager
    this.isRunning = false
    this.maxRetries = 3
    this.retryDelayMs = 30 * 60 * 1000  // 30 minutos
    this.timezone = config.timezone || 'America/Sao_Paulo'

    // Pares de moedas a serem monitorados
    this.currencyPairs = [
      { from: 'USD', to: 'BRL' },
      { from: 'EUR', to: 'BRL' },
    ]
  }

  start() {
    // Executa diariamente as 18:00 BRT (apos fechamento PTAX)
    cron.schedule('0 18 * * 1-5', () => this._execute(), {
      timezone: this.timezone,
    })

    // Verifica na inicializacao se precisa carga historica
    this._checkAndLoadHistory()
  }

  async _execute() {
    if (this.isRunning) {
      logger.log('Scheduler already running, skipping', { ... })
      return
    }
    this.isRunning = true
    try {
      for (const pair of this.currencyPairs) {
        await this._fetchWithRetry(pair)
      }
    } finally {
      this.isRunning = false
    }
  }

  async _fetchWithRetry(pair, attempt = 1) { ... }
  async _checkAndLoadHistory() { ... }
}
```

**Configuracao sugerida (config/app.json):**
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
    ]
  }
}
```

**Cenarios de Teste**:
- Cenario 1: Job executa no horario agendado e persiste taxa com sucesso
- Cenario 2: Job falha na primeira tentativa, retenta e consegue na segunda
- Cenario 3: Job falha em todas as retentativas, usa fallback e registra erro
- Cenario 4: Job detecta overlap e ignora segunda execucao (lock)
- Cenario 5: Primeira inicializacao detecta banco vazio e executa carga historica
- Cenario 6: Carga historica insere registros para pelo menos 5 anos retroativos
- Cenario 7: Job nao executa em finais de semana (cron 1-5)

---

## EP06-S05: Rotas API REST para Taxas de Cambio

### [EP06-S05] Criar endpoints REST para consulta de taxas de cambio

**Como** frontend ou servico externo
**Eu quero** endpoints para consultar taxas de cambio atuais e historicas
**Para que** a interface possa exibir conversoes e graficos com dados do backend

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points (M)

**Contexto**:
O frontend precisa de dois endpoints principais: (1) taxa atual para converter valores em tempo real na tela de carteira, e (2) historico de taxas para montar graficos de evolucao patrimonial com conversao cambial correta por periodo. As rotas seguem o padrao de rotas publicas autenticadas do projeto. O endpoint de taxa atual usa o cache Redis (via Manager) para performance. O endpoint de historico consulta diretamente o MongoDB.

**Criterios de Aceite (Verificaveis)**:

- [ ] DADO que o usuario esta autenticado
      QUANDO faz `GET /v1/public/exchange-rates/current?from=USD&to=BRL`
      ENTAO deve retornar status 200 com JSON `{ from: "USD", to: "BRL", rate: 5.45, source: "BCB", updatedAt: "2026-03-27T..." }`

- [ ] DADO que o usuario esta autenticado
      QUANDO faz `GET /v1/public/exchange-rates/current` sem parametro `from`
      ENTAO deve retornar status 400 com mensagem de erro clara indicando parametros obrigatorios

- [ ] DADO que o usuario esta autenticado
      QUANDO faz `GET /v1/public/exchange-rates/history?from=USD&to=BRL&startDate=2025-01-01&endDate=2026-03-27`
      ENTAO deve retornar status 200 com array de objetos `[{ date, rate, source }]` ordenados por data crescente

- [ ] DADO que o usuario solicita historico de um periodo sem dados
      QUANDO faz `GET /v1/public/exchange-rates/history?from=XYZ&to=BRL&startDate=...&endDate=...`
      ENTAO deve retornar status 200 com array vazio `[]`

- [ ] DADO que o endpoint current e chamado multiplas vezes no mesmo minuto
      QUANDO o cache Redis tem a taxa armazenada
      ENTAO todas as chamadas devem retornar do cache sem chamar API externa (verificavel via metricas/log)

**Dependencias**:
- Bloqueada por: EP06-S02, EP06-S03, EP06-S04
- Bloqueia: EP06-S06 (Frontend)

**Definicao de Pronto (DoD)**:
- [ ] Codigo revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integracao passando
- [ ] QA aprovado por @qa-analyst
- [ ] Endpoints documentados no OpenAPI spec (`docs/openapi.yml`)
- [ ] Documentacao atualizada
- [ ] PR criado por @merge-request

**Notas Tecnicas**:

```
Arquivos:
  src/app/exchange-rate/exchange-rate-router.js
  src/app/exchange-rate/exchange-rate-manager.js
  docs/openapi.yml (atualizar com novos endpoints)
```

**Router:**
```javascript
class ExchangeRateRouter {
  static handleError(exception, res) {
    logger.error(exception, { statusCode: exception.statusCode })
    res.status(exception.statusCode || 500).send(exception.message || 'Server Error')
  }

  static getPublicRoutes(appManager) {
    const router = express.Router()
    const manager = appManager.getExchangeRateManager()

    // GET /exchange-rates/current?from=USD&to=BRL
    router.get('/exchange-rates/current',
      Authorizer.getMiddleware(Permissions.SERVICES),
      async (req, res) => {
        try {
          const { from, to } = req.query
          if (!from || !to) {
            return res.status(400).send({
              message: 'Query params "from" and "to" are required',
            })
          }
          const result = await manager.getCurrentRate(from, to)
          res.status(200).send(result)
        } catch (exception) {
          ExchangeRateRouter.handleError(exception, res)
        }
      })

    // GET /exchange-rates/history?from=USD&to=BRL&startDate=...&endDate=...
    router.get('/exchange-rates/history',
      Authorizer.getMiddleware(Permissions.SERVICES),
      async (req, res) => {
        try {
          const { from, to, startDate, endDate } = req.query
          if (!from || !to || !startDate || !endDate) {
            return res.status(400).send({
              message: 'Query params "from", "to", "startDate", "endDate" are required',
            })
          }
          const result = await manager.getHistoricalRates({
            from, to,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
          })
          res.status(200).send(result)
        } catch (exception) {
          ExchangeRateRouter.handleError(exception, res)
        }
      })

    return router
  }
}
```

**Registrar no app-service.js:**
```javascript
app.use('/v1/public', authMiddleware, ExchangeRateRouter.getPublicRoutes(this.appManager))
```

**Manager - orquestra cache + DAO + service:**
```javascript
class ExchangeRateManager {
  constructor(appManager, appDB) {
    this.appDB = appDB
    this.exchangeRateDAO = new ExchangeRateDAO(this.appDB.getDb())
    this.exchangeRateService = new ExchangeRateService(appManager.config)
    this.exchangeRateCache = new ExchangeRateCache(appManager.redisClient)
    this.handleError = appManager.handleError
  }

  async getCurrentRate(from, to) {
    // cache-aside pattern (ver EP06-S03)
  }

  async getHistoricalRates({ from, to, startDate, endDate }) {
    return await this.exchangeRateDAO.findByPairAndRange({ from, to, startDate, endDate })
  }

  // Usado pelo EP05 (Preco Medio) e EP04 (Transacoes) para converter valores
  async convertToBRL(amount, fromCurrency, date) {
    if (fromCurrency === 'BRL') return amount
    const rateData = date
      ? await this.exchangeRateDAO.findByPairAndDate({ from: fromCurrency, to: 'BRL', date })
      : await this.getCurrentRate(fromCurrency, 'BRL')
    if (!rateData) {
      this.handleError(APP_CONSTANTS.ERRORS.EXCHANGE_RATE_NOT_FOUND)
    }
    return amount * rateData.rate
  }
}
```

**Constantes a adicionar em app-constants.js:**
```javascript
EXCHANGE_RATE_NOT_FOUND: {
  statusCode: 404,
  message: 'Exchange rate not found for the given currency pair and date',
},
EXCHANGE_RATE_FETCH_FAILED: {
  statusCode: 502,
  message: 'Failed to fetch exchange rate from external APIs',
},
EXCHANGE_RATE_INVALID_PARAMS: {
  statusCode: 400,
  message: 'Invalid parameters for exchange rate query',
},
```

**Cenarios de Teste**:
- Cenario 1: GET /current com from=USD&to=BRL retorna 200 com taxa valida
- Cenario 2: GET /current sem parametro `from` retorna 400
- Cenario 3: GET /current sem parametro `to` retorna 400
- Cenario 4: GET /current retorna do cache quando disponivel (verifica que API externa nao e chamada)
- Cenario 5: GET /history com range valido retorna array ordenado por data
- Cenario 6: GET /history com periodo sem dados retorna array vazio 200
- Cenario 7: GET /history sem startDate retorna 400
- Cenario 8: GET /history sem autenticacao retorna 401
- Cenario 9: convertToBRL com moeda BRL retorna valor original sem buscar taxa
- Cenario 10: convertToBRL com data historica busca do MongoDB, nao do cache

---

## EP06-S06: Interface Frontend - Indicador de Moeda e Toggle de Conversao

### [EP06-S06] Implementar indicador de moeda e toggle BRL/moeda original no frontend

**Como** investidor com ativos internacionais
**Eu quero** ver claramente quais ativos sao internacionais e alternar a exibicao entre moeda original e BRL
**Para que** eu possa acompanhar meu patrimonio tanto na moeda de origem quanto consolidado em Real

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points (L)

**Contexto**:
O frontend precisa indicar visualmente quais ativos sao denominados em moedas estrangeiras. Um badge ou icone com a bandeira/sigla da moeda deve aparecer ao lado do nome do ativo. Um toggle global (ou por ativo) deve permitir alternar entre exibicao na moeda original e em BRL. Quando em modo BRL, os valores devem usar a taxa de cambio obtida do endpoint `GET /exchange-rates/current`. A taxa de cambio atual deve ser exibida em algum local visivel (header, sidebar ou tooltip).

**Criterios de Aceite (Verificaveis)**:

- [ ] DADO que o usuario visualiza a lista de ativos da carteira
      QUANDO um ativo e denominado em moeda estrangeira (ex: AAPL em USD)
      ENTAO deve exibir um indicador visual (badge com sigla da moeda, ex: "USD" ou bandeira dos EUA) ao lado do nome do ativo

- [ ] DADO que o usuario esta na visao padrao (BRL)
      QUANDO visualiza um ativo internacional
      ENTAO o valor deve ser exibido convertido em BRL com a taxa de cambio do dia, e um tooltip/subtexto deve mostrar o valor original na moeda de origem

- [ ] DADO que o usuario clica no toggle de moeda
      QUANDO alterna para "moeda original"
      ENTAO todos os ativos internacionais devem exibir valores na moeda de origem (USD, EUR, etc.) e o total da carteira deve continuar em BRL com indicacao de "valor aproximado"

- [ ] DADO que a taxa de cambio atual esta disponivel
      QUANDO o usuario visualiza a area de cambio
      ENTAO deve exibir a taxa atual (ex: "USD/BRL: R$ 5,45") com horario da ultima atualizacao

- [ ] DADO que a API de cambio esta indisponivel
      QUANDO o frontend tenta obter a taxa atual
      ENTAO deve exibir a ultima taxa conhecida (armazenada localmente) com indicacao visual de que esta desatualizada (ex: icone de warning, texto "taxa de XX/XX/XXXX")

**Dependencias**:
- Bloqueada por: EP06-S05 (Rotas API), EP16 (Layout Base), EP17 (Navegacao)
- Bloqueia: EP20 (Graficos - conversao cambial em graficos historicos)
- Relacionada com: EP19 (Dashboard - widget de cambio)

**Definicao de Pronto (DoD)**:
- [ ] Codigo revisado por @code-reviewer
- [ ] Testes com cobertura >= 90% (unit tests dos componentes)
- [ ] Testes de integracao passando
- [ ] Testes E2E para toggle de moeda
- [ ] QA aprovado por @qa-analyst
- [ ] Responsivo (mobile e desktop)
- [ ] Acessibilidade basica (aria-labels, contraste)
- [ ] Documentacao atualizada
- [ ] PR criado por @merge-request

**Notas Tecnicas**:

```
Arquivos sugeridos (frontend):
  src/components/exchange/CurrencyBadge.vue (ou .jsx/.tsx)
  src/components/exchange/CurrencyToggle.vue
  src/components/exchange/ExchangeRateDisplay.vue
  src/composables/useExchangeRate.js (hook/composable para buscar e cachear taxa)
  src/store/exchange-rate.js (state management - Pinia/Vuex ou Context/Redux)
```

**Componentes:**

| Componente | Responsabilidade |
|---|---|
| `CurrencyBadge` | Exibe sigla da moeda (USD, EUR) com icone/bandeira ao lado do nome do ativo |
| `CurrencyToggle` | Switch/botao que alterna entre modo BRL e modo moeda original |
| `ExchangeRateDisplay` | Exibe a taxa de cambio atual com horario de atualizacao |
| `useExchangeRate` | Composable/hook que busca taxa do backend, cacheia localmente, atualiza periodicamente |

**State management:**
```javascript
// store/exchange-rate.js
{
  state: {
    currentRates: {},        // { 'USD:BRL': { rate, source, updatedAt } }
    displayMode: 'BRL',      // 'BRL' | 'original'
    lastFetchedAt: null,
    isLoading: false,
    error: null,
  },
  actions: {
    fetchCurrentRate(from, to),
    toggleDisplayMode(),
    convertToBRL(amount, currency),
  }
}
```

**Formatacao de valores:**
```javascript
// BRL: R$ 1.234,56
new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

// USD: US$ 234.56
new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' })

// EUR: EUR 234,56
new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'EUR' })
```

**Cenarios de Teste**:
- Cenario 1: CurrencyBadge exibe "USD" para ativo americano
- Cenario 2: CurrencyBadge nao exibe badge para ativo brasileiro (BRL)
- Cenario 3: Toggle alterna entre BRL e moeda original corretamente
- Cenario 4: Valores sao recalculados ao alternar toggle
- Cenario 5: ExchangeRateDisplay exibe taxa formatada e horario de atualizacao
- Cenario 6: Com API indisponivel, exibe ultima taxa com indicador de desatualizado
- Cenario 7: Formatacao de valores segue padrao pt-BR para cada moeda
- Cenario 8: Componentes renderizam corretamente em mobile (responsivo)
- Cenario 9: Total da carteira em BRL permanece correto ao alternar toggle
- Cenario 10: Tooltip mostra valor na moeda alternativa ao hover

---

## Estrutura de Arquivos Completa do Epico

```
src/
  app/
    exchange-rate/
      exchange-rate-model.js        # EP06-S01: Schema Mongoose
      exchange-rate-dao.js          # EP06-S02: Data Access Layer
      exchange-rate-service.js      # EP06-S02: Integracao APIs externas (BCB, fallback)
      exchange-rate-cache.js        # EP06-S03: Cache Redis
      exchange-rate-scheduler.js    # EP06-S04: Job agendado (cron)
      exchange-rate-manager.js      # EP06-S05: Business logic (orquestra tudo)
      exchange-rate-router.js       # EP06-S05: Rotas HTTP
    app-constants.js                # Adicionar ERRORS de exchange-rate
    app-manager.js                  # Registrar ExchangeRateManager
    app-service.js                  # Registrar ExchangeRateRouter
  __tests__/
    exchange-rate.test.js           # Testes de integracao
  __mocks__/
    mock-exchange-rate-api.js       # Mock das APIs externas (BCB, exchangerate-api)
config/
  app.json                          # Adicionar bloco "exchangeRate" com config
docs/
  openapi.yml                       # Adicionar endpoints /exchange-rates/*
frontend/  (ou equivalente)
  src/
    components/exchange/
      CurrencyBadge.vue
      CurrencyToggle.vue
      ExchangeRateDisplay.vue
    composables/
      useExchangeRate.js
    store/
      exchange-rate.js
```

---

## Analise de Riscos

| Risco | Probabilidade | Impacto | Mitigacao |
|---|---|---|---|
| API BCB fora do ar | Media | Alto | Fallback para exchangerate-api + cache agressivo |
| Rate limiting nas APIs free | Media | Medio | Cache Redis 1h + job diario (poucas chamadas/dia) |
| Taxa de cambio desatualizada | Baixa | Medio | TTL 1h + indicator visual de "ultima atualizacao" |
| Carga historica pesada na primeira execucao | Alta | Baixo | Bulk insert com batch de 100 registros, execucao assincrona |
| Redis indisponivel | Baixa | Medio | Degradacao graciosa - busca direto da API/MongoDB |
| Fuso horario incorreto no job | Media | Alto | Usar `America/Sao_Paulo` explicito no cron + testes com mock de data |
| Moedas nao suportadas pelo BCB | Baixa | Baixo | Fallback automatico para API multi-moedas |

---

## Cronograma Sugerido de Implementacao

| Sprint | Story | Estimativa | Prioridade |
|---|---|---|---|
| Sprint N | EP06-S01 (Model) | 3 pts | Must Have |
| Sprint N | EP06-S02 (DAO + Service) | 8 pts | Must Have |
| Sprint N+1 | EP06-S03 (Cache Redis) | 5 pts | Must Have |
| Sprint N+1 | EP06-S04 (Job Agendado) | 5 pts | Must Have |
| Sprint N+2 | EP06-S05 (Rotas API) | 5 pts | Must Have |
| Sprint N+2 | EP06-S06 (Frontend) | 8 pts | Must Have |
| **Total** | **6 stories** | **34 pts** | |

---

## Glossario

| Termo | Definicao |
|---|---|
| PTAX | Taxa de cambio oficial publicada pelo Banco Central do Brasil |
| BCB | Banco Central do Brasil |
| TTL | Time To Live - tempo de expiracao de um dado no cache |
| Cache-aside | Padrao onde o aplicativo gerencia o cache manualmente (read-through + write-through) |
| Upsert | Operacao que insere se nao existe ou atualiza se ja existe |
| BRT | Brasilia Time (UTC-3) |
| Rate limiting | Restricao de numero de requisicoes por periodo imposta por APIs |
| Graceful degradation | Sistema continua funcionando com capacidade reduzida quando um componente falha |

---

**Status**: Pronto para planejamento tecnico pelo @architect
**Proximos passos**: @architect deve detalhar a implementacao, definir contratos de API (OpenAPI) e criar tasks tecnicas.

# EP13 — Fontes de Dados de Mercado

> **Épico**: 13 — Fontes de Dados de Mercado (APIs)
> **Versão**: 1.0
> **Data**: 2026-03-27
> **Status**: Ready for Architect

---

## Visão Geral

O MoneyTrackr precisa integrar múltiplas fontes de dados de mercado para fornecer cotações atualizadas, proventos, eventos corporativos e índices econômicos. Este épico estabelece a infraestrutura de coleta de dados externos com estratégia de fallback automática, caching inteligente e arquitetura extensível baseada no padrão Strategy. O sistema deve suportar ativos brasileiros (B3), internacionais, criptomoedas e índices econômicos brasileiros (CDI, IPCA, SELIC).

**Impacto no Negócio**: Sem dados de mercado atualizados, o MoneyTrackr não consegue calcular valorização em tempo real, exibir gráficos de performance ou alertar sobre eventos corporativos. A confiabilidade dos dados é crítica — uma cotação incorreta pode levar a decisões de investimento erradas. A estratégia de fallback garante disponibilidade mesmo quando APIs individuais falham.

**Métricas-alvo**:
- Disponibilidade de dados ≥ 99,5% (com fallback)
- Latência de consulta < 500ms (com cache)
- Cache hit ratio ≥ 80%
- Suporte a pelo menos 500 tickers brasileiros + 200 internacionais
- Atualização de índices econômicos diária sem falhas

**Dependências de Épicos**:
- Épico 1 (Arquitetura) — Redis para caching
- Épico 4 (Transações) — tickers a atualizar
- Épico 5 (Preço Médio) — preço atual para valorização
- Épico 6 (Câmbio) — taxa USD/BRL para ativos internacionais
- Épico 7 (Renda Fixa) — índices CDI/IPCA
- Épico 10 (Eventos Corporativos) — fonte de eventos
- Épico 11 (Proventos) — fonte de dividendos
- Épico 12 (Criptomoedas) — CoinGecko e Binance
- Épico 14 (Atualização de Dados) — scheduler de atualização

---

## Stories

---

### EP13-001 Arquitetura de Providers e Factory Pattern

**Como** desenvolvedor do MoneyTrackr
**Eu quero** uma arquitetura extensível de providers de dados de mercado com factory pattern e fallback chain
**Para que** o sistema possa integrar múltiplas APIs externas de forma desacoplada, com troca de fonte transparente em caso de falha

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 13 story points (XL)

**Contexto**:
O sistema precisa consultar dados de múltiplas fontes externas (BRAPI, Yahoo Finance, CoinGecko, Binance, BCB). Cada fonte tem sua própria API, formato de resposta, rate limits e características. A arquitetura deve usar o padrão Strategy com uma classe abstrata `MarketDataProvider` que define a interface comum, e implementações concretas para cada fonte. Um `ProviderFactory` gerencia a cadeia de fallback e seleciona o provider adequado baseado no tipo de ativo e disponibilidade.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o sistema precisa buscar preço de PETR4
      QUANDO o MarketDataManager solicita o dado
      ENTÃO o ProviderFactory deve retornar BrapiProvider como provider primário para ativos B3

- [ ] DADO que BrapiProvider falha ao buscar preço de PETR4 (timeout ou HTTP 5xx)
      QUANDO o fallback é acionado
      ENTÃO o sistema deve automaticamente tentar YahooFinanceProvider e registrar o evento no log

- [ ] DADO que o sistema precisa buscar preço de AAPL (ativo internacional)
      QUANDO o MarketDataManager solicita o dado
      ENTÃO o ProviderFactory deve retornar YahooFinanceProvider como provider (único para internacionais)

- [ ] DADO que todos os providers da cadeia de fallback falham
      QUANDO a requisição é processada
      ENTÃO o sistema deve retornar erro apropriado com código 503 e mensagem "Fontes de dados indisponíveis"

- [ ] DADO que um novo provider precisa ser adicionado (ex: Alpha Vantage)
      QUANDO o desenvolvedor cria uma nova classe implementando MarketDataProvider
      ENTÃO deve ser possível integrá-lo sem modificar código existente (Open/Closed Principle)

**Dependências**:
- Bloqueada por: EP01 (Arquitetura — Redis)
- Bloqueia: EP13-002, EP13-003, EP13-004, EP13-005, EP13-006, EP13-007

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação da API atualizada (Swagger)
- [ ] Diagrama de arquitetura atualizado
- [ ] PR criado por @merge-request

**Notas Técnicas**:

**Estrutura de Diretórios** (`src/app/market-data/`):
```
src/app/market-data/
  market-data-router.js           # Rotas HTTP
  market-data-manager.js          # Orquestração e cache
  market-data-dao.js              # Persistência MongoDB
  market-data-model.js            # Schema Mongoose
  providers/
    market-data-provider.js       # Classe abstrata (interface)
    brapi-provider.js             # Implementação BRAPI
    yahoo-finance-provider.js     # Implementação Yahoo Finance
    coingecko-provider.js         # Implementação CoinGecko
    binance-provider.js           # Implementação Binance
    bcb-provider.js               # Implementação Banco Central
    provider-factory.js           # Factory com fallback chain
  constants/
    provider-constants.js         # Configurações de providers
    asset-type-constants.js       # Tipos de ativo
```

**Classe Abstrata MarketDataProvider** (`src/app/market-data/providers/market-data-provider.js`):
```javascript
/**
 * @abstract
 * Interface comum para todos os providers de dados de mercado
 */
class MarketDataProvider {
  constructor(config = {}) {
    this.name = this.constructor.name
    this.baseUrl = config.baseUrl
    this.apiKey = config.apiKey
    this.timeout = config.timeout || 5000
    this.rateLimitPerMinute = config.rateLimitPerMinute || 60
    this.requestCount = 0
    this.lastRequestTime = null
  }

  /**
   * @abstract
   * Busca preço atual de um ativo
   * @param {string} ticker - Código do ativo
   * @param {string} assetType - STOCK, ETF, FII, CRYPTO, etc.
   * @returns {Promise<MarketData>} Dados de mercado normalizados
   */
  async getPrice(ticker, assetType) {
    throw new Error('Method not implemented')
  }

  /**
   * @abstract
   * Busca preços em batch (múltiplos tickers)
   * @param {string[]} tickers - Lista de tickers
   * @param {string} assetType - Tipo dos ativos
   * @returns {Promise<MarketData[]>} Lista de dados normalizados
   */
  async getBatchPrices(tickers, assetType) {
    throw new Error('Method not implemented')
  }

  /**
   * @abstract
   * Verifica se o provider suporta o tipo de ativo
   * @param {string} assetType - Tipo do ativo
   * @returns {boolean}
   */
  supportsAssetType(assetType) {
    throw new Error('Method not implemented')
  }

  /**
   * @abstract
   * Retorna a prioridade do provider para o tipo de ativo
   * @param {string} assetType - Tipo do ativo
   * @returns {number} Menor = maior prioridade
   */
  getPriority(assetType) {
    throw new Error('Method not implemented')
  }

  /**
   * Verifica rate limit antes de fazer requisição
   * @returns {Promise<void>}
   */
  async checkRateLimit() {
    const now = Date.now()
    if (this.lastRequestTime && now - this.lastRequestTime < 60000) {
      if (this.requestCount >= this.rateLimitPerMinute) {
        const waitTime = 60000 - (now - this.lastRequestTime)
        await new Promise((resolve) => setTimeout(resolve, waitTime))
        this.requestCount = 0
      }
    } else {
      this.requestCount = 0
    }
    this.lastRequestTime = now
    this.requestCount++
  }

  /**
   * Normaliza resposta para formato padrão
   * @param {object} rawData - Resposta bruta da API
   * @returns {MarketData}
   */
  normalizeResponse(rawData) {
    return {
      ticker: rawData.ticker || rawData.symbol,
      price: rawData.price || rawData.regularMarketPrice,
      change: rawData.change || rawData.regularMarketChange,
      changePercent: rawData.changePercent || rawData.regularMarketChangePercent,
      volume: rawData.volume || rawData.regularMarketVolume,
      date: rawData.date || new Date(),
      source: this.name,
      assetType: rawData.assetType,
    }
  }

  /**
   * Trata erros de forma padronizada
   * @param {Error} error - Erro original
   * @param {string} ticker - Ticker que falhou
   * @returns {ProviderError}
   */
  handleError(error, ticker) {
    const { ProviderError } = require('../constants/provider-constants')
    return new ProviderError(
      this.name,
      ticker,
      error.message,
      error.response?.status || 500,
    )
  }
}

module.exports = MarketDataProvider
```

**Provider Factory** (`src/app/market-data/providers/provider-factory.js`):
```javascript
const BrapiProvider = require('./brapi-provider')
const YahooFinanceProvider = require('./yahoo-finance-provider')
const CoinGeckoProvider = require('./coingecko-provider')
const BinanceProvider = require('./binance-provider')
const BCBProvider = require('./bcb-provider')
const { ASSET_TYPES, PROVIDER_PRIORITIES } = require('../constants/provider-constants')

class ProviderFactory {
  constructor(config = {}) {
    this.providers = [
      new BrapiProvider(config.brapi),
      new YahooFinanceProvider(config.yahoo),
      new CoinGeckoProvider(config.coingecko),
      new BinanceProvider(config.binance),
      new BCBProvider(config.bcb),
    ]
    
    // Cache de cadeias de fallback por tipo de ativo
    this.fallbackChains = this.buildFallbackChains()
  }

  /**
   * Constrói cadeias de fallback baseadas em prioridade
   */
  buildFallbackChains() {
    const chains = {}
    
    for (const assetType of Object.values(ASSET_TYPES)) {
      chains[assetType] = this.providers
        .filter((p) => p.supportsAssetType(assetType))
        .sort((a, b) => a.getPriority(assetType) - b.getPriority(assetType))
    }
    
    return chains
  }

  /**
   * Obtém a cadeia de providers para um tipo de ativo
   * @param {string} assetType - Tipo do ativo
   * @returns {MarketDataProvider[]}
   */
  getProviderChain(assetType) {
    return this.fallbackChains[assetType] || []
  }

  /**
   * Busca dado com fallback automático
   * @param {string} ticker - Código do ativo
   * @param {string} assetType - Tipo do ativo
   * @returns {Promise<{data: MarketData, provider: string}>}
   */
  async fetchWithFallback(ticker, assetType) {
    const chain = this.getProviderChain(assetType)
    const errors = []

    for (const provider of chain) {
      try {
        await provider.checkRateLimit()
        const data = await provider.getPrice(ticker, assetType)
        return { data, provider: provider.name }
      } catch (error) {
        errors.push({
          provider: provider.name,
          error: error.message,
        })
        logger.warn(`Provider ${provider.name} failed for ${ticker}`, {
          internal: { method: 'fetchWithFallback', filename: 'provider-factory.js' },
          error: error.message,
        })
        continue
      }
    }

    // Todos falharam
    throw new Exception(
      503,
      `Todas as fontes de dados falharam para ${ticker}`,
      { errors },
    )
  }

  /**
   * Busca dados em batch com fallback
   * @param {string[]} tickers - Lista de tickers
   * @param {string} assetType - Tipo dos ativos
   * @returns {Promise<{data: MarketData[], provider: string}>}
   */
  async fetchBatchWithFallback(tickers, assetType) {
    const chain = this.getProviderChain(assetType)
    const errors = []

    for (const provider of chain) {
      try {
        await provider.checkRateLimit()
        const data = await provider.getBatchPrices(tickers, assetType)
        return { data, provider: provider.name }
      } catch (error) {
        errors.push({
          provider: provider.name,
          error: error.message,
        })
        continue
      }
    }

    throw new Exception(
      503,
      `Todas as fontes de dados falharam para batch de ${tickers.length} tickers`,
      { errors },
    )
  }
}

module.exports = ProviderFactory
```

**Constantes de Providers** (`src/app/market-data/constants/provider-constants.js`):
```javascript
const ASSET_TYPES = {
  STOCK_BR: 'STOCK_BR',       // Ações brasileiras
  STOCK_US: 'STOCK_US',       // Ações internacionais
  ETF_BR: 'ETF_BR',           // ETFs brasileiros
  ETF_US: 'ETF_US',           // ETFs internacionais
  FII: 'FII',                 // Fundos imobiliários
  BDR: 'BDR',                 // BDRs
  CRYPTO: 'CRYPTO',           // Criptomoedas
  INDEX: 'INDEX',             // Índices econômicos
}

const PROVIDER_NAMES = {
  BRAPI: 'BrapiProvider',
  YAHOO: 'YahooFinanceProvider',
  COINGECKO: 'CoinGeckoProvider',
  BINANCE: 'BinanceProvider',
  BCB: 'BCBProvider',
}

// Prioridades: menor número = maior prioridade
const PROVIDER_PRIORITIES = {
  [ASSET_TYPES.STOCK_BR]: {
    [PROVIDER_NAMES.BRAPI]: 1,
    [PROVIDER_NAMES.YAHOO]: 2,
  },
  [ASSET_TYPES.STOCK_US]: {
    [PROVIDER_NAMES.YAHOO]: 1,
  },
  [ASSET_TYPES.ETF_BR]: {
    [PROVIDER_NAMES.BRAPI]: 1,
    [PROVIDER_NAMES.YAHOO]: 2,
  },
  [ASSET_TYPES.ETF_US]: {
    [PROVIDER_NAMES.YAHOO]: 1,
  },
  [ASSET_TYPES.FII]: {
    [PROVIDER_NAMES.BRAPI]: 1,
    [PROVIDER_NAMES.YAHOO]: 2,
  },
  [ASSET_TYPES.BDR]: {
    [PROVIDER_NAMES.BRAPI]: 1,
    [PROVIDER_NAMES.YAHOO]: 2,
  },
  [ASSET_TYPES.CRYPTO]: {
    [PROVIDER_NAMES.COINGECKO]: 1,
    [PROVIDER_NAMES.BINANCE]: 2,
  },
  [ASSET_TYPES.INDEX]: {
    [PROVIDER_NAMES.BCB]: 1,
  },
}

// Rate limits por provider (requests/min)
const RATE_LIMITS = {
  [PROVIDER_NAMES.BRAPI]: 60,        // Free tier
  [PROVIDER_NAMES.YAHOO]: 2000,      // Sem limitação oficial
  [PROVIDER_NAMES.COINGECKO]: 30,    // Free tier
  [PROVIDER_NAMES.BINANCE]: 1200,    // Alta capacidade
  [PROVIDER_NAMES.BCB]: 60,          // Conservador
}

// Timeouts em ms
const TIMEOUTS = {
  [PROVIDER_NAMES.BRAPI]: 5000,
  [PROVIDER_NAMES.YAHOO]: 8000,
  [PROVIDER_NAMES.COINGECKO]: 10000,
  [PROVIDER_NAMES.BINANCE]: 5000,
  [PROVIDER_NAMES.BCB]: 10000,
}

class ProviderError extends Error {
  constructor(provider, ticker, message, statusCode) {
    super(message)
    this.name = 'ProviderError'
    this.provider = provider
    this.ticker = ticker
    this.statusCode = statusCode
  }
}

module.exports = {
  ASSET_TYPES,
  PROVIDER_NAMES,
  PROVIDER_PRIORITIES,
  RATE_LIMITS,
  TIMEOUTS,
  ProviderError,
}
```

**Cenários de Teste**:
- Cenário 1: Buscar preço de PETR4 → BrapiProvider usado como primário
- Cenário 2: BrapiProvider falha → YahooFinanceProvider usado como fallback
- Cenário 3: Buscar preço de AAPL → YahooFinanceProvider usado (único para US)
- Cenário 4: Todos providers falham → erro 503 retornado
- Cenário 5: Adicionar novo provider → integração sem modificar factory
- Cenário 6: Rate limit atingido → espera automática antes de nova requisição
- Cenário 7: Batch request de 50 tickers → providers recebem lista completa
- Cenário 8: Provider não suporta assetType → não incluído na cadeia

---

### EP13-002 Provider BRAPI para Dados B3

**Como** sistema de dados de mercado
**Eu quero** buscar cotações de ações brasileiras via API BRAPI
**Para que** o sistema tenha dados atualizados de ativos da B3 com alta disponibilidade

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points (L)

**Contexto**:
A BRAPI (https://brapi.dev/) é uma API brasileira gratuita que fornece cotações de ações, FIIs, ETFs e BDRs negociados na B3. É a fonte primária para ativos brasileiros devido à sua simplicidade, documentação em português e foco no mercado local. A API retorna dados como preço atual, variação, volume, P/L, dividend yield e mais. O provider deve normalizar esses dados para o formato padrão do sistema.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o BrapiProvider busca preço de PETR4
      QUANDO a requisição é feita com sucesso
      ENTÃO deve retornar dados normalizados: { ticker: 'PETR4', price: 38.50, change: 0.50, changePercent: 1.32, volume: 45000000, source: 'BrapiProvider' }

- [ ] DADO que o BrapiProvider busca batch de tickers ['PETR4', 'VALE3', 'ITUB4']
      QUANDO a requisição é feita
      ENTÃO deve retornar array com dados de todos os tickers em uma única chamada

- [ ] DADO que a API BRAPI retorna HTTP 429 (rate limit)
      QUANDO o provider processa a resposta
      ENTÃO deve lançar ProviderError com statusCode 429 para acionar fallback

- [ ] DADO que a API BRAPI retorna HTTP 404 para ticker inexistente
      QUANDO o provider processa a resposta
      ENTÃO deve lançar ProviderError com statusCode 404 e mensagem "Ticker não encontrado"

- [ ] DADO que o BrapiProvider verifica suporte para assetType STOCK_BR
      QUANDO o método supportsAssetType é chamado
      ENTÃO deve retornar true (suporta ações brasileiras, FIIs, ETFs, BDRs)

**Dependências**:
- Bloqueada por: EP13-001
- Bloqueia: EP13-007

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura >= 90%
- [ ] Testes de integração passando (com mock da API)
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação da API atualizada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

**BrapiProvider** (`src/app/market-data/providers/brapi-provider.js`):
```javascript
const axios = require('axios')
const MarketDataProvider = require('./market-data-provider')
const { PROVIDER_NAMES, ASSET_TYPES, PROVIDER_PRIORITIES, RATE_LIMITS, TIMEOUTS, ProviderError } = require('../constants/provider-constants')

class BrapiProvider extends MarketDataProvider {
  constructor(config = {}) {
    super({
      baseUrl: config.baseUrl || 'https://brapi.dev/api',
      apiKey: config.apiKey || process.env.BRAPI_API_KEY,
      timeout: config.timeout || TIMEOUTS[PROVIDER_NAMES.BRAPI],
      rateLimitPerMinute: config.rateLimitPerMinute || RATE_LIMITS[PROVIDER_NAMES.BRAPI],
    })
    this.supportedTypes = [
      ASSET_TYPES.STOCK_BR,
      ASSET_TYPES.ETF_BR,
      ASSET_TYPES.FII,
      ASSET_TYPES.BDR,
    ]
  }

  supportsAssetType(assetType) {
    return this.supportedTypes.includes(assetType)
  }

  getPriority(assetType) {
    return PROVIDER_PRIORITIES[assetType]?.[PROVIDER_NAMES.BRAPI] || 999
  }

  async getPrice(ticker, assetType) {
    await this.checkRateLimit()
    
    try {
      const response = await axios.get(`${this.baseUrl}/quote/${ticker}`, {
        params: {
          token: this.apiKey,
          fundamental: false,
          modules: 'default',
        },
        timeout: this.timeout,
      })

      const result = response.data.results?.[0]
      if (!result) {
        throw new ProviderError(this.name, ticker, 'Ticker não encontrado', 404)
      }

      return this.normalizeResponse({
        ticker: result.symbol,
        price: result.regularMarketPrice,
        change: result.regularMarketChange,
        changePercent: result.regularMarketChangePercent,
        volume: result.regularMarketVolume,
        date: new Date(result.regularMarketTime),
        assetType,
      })
    } catch (error) {
      if (error instanceof ProviderError) throw error
      
      const status = error.response?.status || 500
      throw new ProviderError(
        this.name,
        ticker,
        error.message,
        status,
      )
    }
  }

  async getBatchPrices(tickers, assetType) {
    await this.checkRateLimit()
    
    try {
      // BRAPI suporta múltiplos tickers separados por vírgula
      const tickersParam = tickers.join(',')
      
      const response = await axios.get(`${this.baseUrl}/quote/${tickersParam}`, {
        params: {
          token: this.apiKey,
          fundamental: false,
          modules: 'default',
        },
        timeout: this.timeout,
      })

      const results = response.data.results || []
      
      return results.map((result) => this.normalizeResponse({
        ticker: result.symbol,
        price: result.regularMarketPrice,
        change: result.regularMarketChange,
        changePercent: result.regularMarketChangePercent,
        volume: result.regularMarketVolume,
        date: new Date(result.regularMarketTime),
        assetType,
      }))
    } catch (error) {
      const status = error.response?.status || 500
      throw new ProviderError(
        this.name,
        tickers.join(','),
        error.message,
        status,
      )
    }
  }
}

module.exports = BrapiProvider
```

**Endpoints BRAPI Utilizados**:
```
GET /api/quote/{ticker}
  - Preço atual, variação, volume
  - Rate limit: ~60 req/min (free tier)
  - Suporta múltiplos tickers: /api/quote/PETR4,VALE3,ITUB4

GET /api/quote/{ticker}?fundamental=true
  - Dados fundamentalistas (P/L, P/VP, Dividend Yield)
  - Usado para dados de proventos (EP13-004)
```

**Variáveis de Ambiente**:
```
BRAPI_API_KEY=xxx                    # Token de acesso
BRAPI_BASE_URL=https://brapi.dev/api # URL base (override para testes)
BRAPI_TIMEOUT=5000                   # Timeout em ms
```

**Cenários de Teste**:
- Cenário 1: Buscar PETR4 → dados retornados corretamente
- Cenário 2: Buscar batch [PETR4, VALE3] → array com 2 itens
- Cenário 3: Ticker inexistente → erro 404
- Cenário 4: Rate limit (429) → erro para acionar fallback
- Cenário 5: Timeout → erro para acionar fallback
- Cenário 6: Verificar suporte STOCK_BR → true
- Cenário 7: Verificar suporte CRYPTO → false
- Cenário 8: Resposta com dados nulos → tratamento adequado

---

### EP13-003 Provider Yahoo Finance para Dados Internacionais

**Como** sistema de dados de mercado
**Eu quero** buscar cotações de ativos internacionais via Yahoo Finance API
**Para que** o sistema tenha dados de ações americanas, ETFs internacionais e sirva como fallback para ativos brasileiros

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points (L)

**Contexto**:
O Yahoo Finance é a principal fonte de dados para ativos internacionais (ações dos EUA, ETFs americanos) e serve como fallback para ativos brasileiros. A API não é oficialmente documentada, mas existem bibliotecas estáveis como `yahoo-finance2` que encapsulam as chamadas. O provider deve usar essa biblioteca para maior estabilidade e tratamento de erros.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o YahooFinanceProvider busca preço de AAPL
      QUANDO a requisição é feita com sucesso
      ENTÃO deve retornar dados normalizados: { ticker: 'AAPL', price: 178.50, change: 2.30, changePercent: 1.31, volume: 52000000, source: 'YahooFinanceProvider' }

- [ ] DADO que o YahooFinanceProvider busca preço de PETR4.SA (formato Yahoo para B3)
      QUANDO a requisição é feita
      ENTÃO deve retornar dados do ativo brasileiro corretamente

- [ ] DADO que o YahooFinanceProvider busca batch de tickers ['AAPL', 'MSFT', 'GOOGL']
      QUANDO a requisição é feita
      ENTÃO deve retornar array com dados de todos os tickers

- [ ] DADO que o YahooFinanceProvider verifica suporte para assetType STOCK_US
      QUANDO o método supportsAssetType é chamado
      ENTÃO deve retornar true (é provider primário para internacionais)

- [ ] DADO que o YahooFinanceProvider verifica suporte para assetType STOCK_BR
      QUANDO o método supportsAssetType é chamado
      ENTÃO deve retornar true (serve como fallback para brasileiros)

**Dependências**:
- Bloqueada por: EP13-001
- Bloqueia: EP13-007

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação da API atualizada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

**YahooFinanceProvider** (`src/app/market-data/providers/yahoo-finance-provider.js`):
```javascript
const yahooFinance = require('yahoo-finance2').default
const MarketDataProvider = require('./market-data-provider')
const { PROVIDER_NAMES, ASSET_TYPES, PROVIDER_PRIORITIES, RATE_LIMITS, TIMEOUTS, ProviderError } = require('../constants/provider-constants')

class YahooFinanceProvider extends MarketDataProvider {
  constructor(config = {}) {
    super({
      baseUrl: config.baseUrl || 'https://query1.finance.yahoo.com',
      timeout: config.timeout || TIMEOUTS[PROVIDER_NAMES.YAHOO],
      rateLimitPerMinute: config.rateLimitPerMinute || RATE_LIMITS[PROVIDER_NAMES.YAHOO],
    })
    this.supportedTypes = [
      ASSET_TYPES.STOCK_BR,  // Fallback
      ASSET_TYPES.STOCK_US,  // Primário
      ASSET_TYPES.ETF_BR,    // Fallback
      ASSET_TYPES.ETF_US,    // Primário
      ASSET_TYPES.FII,       // Fallback
      ASSET_TYPES.BDR,       // Fallback
    ]
    
    // Mapeamento de tickers brasileiros para formato Yahoo
    this.tickerSuffixMap = {
      [ASSET_TYPES.STOCK_BR]: '.SA',
      [ASSET_TYPES.ETF_BR]: '.SA',
      [ASSET_TYPES.FII]: '.SA',
      [ASSET_TYPES.BDR]: '.SA',
    }
  }

  supportsAssetType(assetType) {
    return this.supportedTypes.includes(assetType)
  }

  getPriority(assetType) {
    return PROVIDER_PRIORITIES[assetType]?.[PROVIDER_NAMES.YAHOO] || 999
  }

  /**
   * Converte ticker para formato Yahoo Finance
   * Ex: PETR4 → PETR4.SA
   */
  normalizeTicker(ticker, assetType) {
    const suffix = this.tickerSuffixMap[assetType]
    if (suffix && !ticker.endsWith(suffix)) {
      return `${ticker}${suffix}`
    }
    return ticker
  }

  /**
   * Remove sufixo do ticker para formato padrão
   * Ex: PETR4.SA → PETR4
   */
  denormalizeTicker(ticker) {
    return ticker.replace(/\.SA$/, '').replace(/\.US$/, '')
  }

  async getPrice(ticker, assetType) {
    await this.checkRateLimit()
    
    const yahooTicker = this.normalizeTicker(ticker, assetType)
    
    try {
      const quote = await yahooFinance.quote(yahooTicker)
      
      if (!quote || quote.quoteType === 'NONE') {
        throw new ProviderError(this.name, ticker, 'Ticker não encontrado', 404)
      }

      return this.normalizeResponse({
        ticker: this.denormalizeTicker(quote.symbol),
        price: quote.regularMarketPrice,
        change: quote.regularMarketChange,
        changePercent: quote.regularMarketChangePercent,
        volume: quote.regularMarketVolume,
        date: new Date(quote.regularMarketTime),
        assetType,
      })
    } catch (error) {
      if (error instanceof ProviderError) throw error
      
      throw new ProviderError(
        this.name,
        ticker,
        error.message,
        error.response?.status || 500,
      )
    }
  }

  async getBatchPrices(tickers, assetType) {
    await this.checkRateLimit()
    
    const yahooTickers = tickers.map((t) => this.normalizeTicker(t, assetType))
    
    try {
      const quotes = await yahooFinance.quote(yahooTickers)
      
      return quotes
        .filter((q) => q && q.quoteType !== 'NONE')
        .map((quote) => this.normalizeResponse({
          ticker: this.denormalizeTicker(quote.symbol),
          price: quote.regularMarketPrice,
          change: quote.regularMarketChange,
          changePercent: quote.regularMarketChangePercent,
          volume: quote.regularMarketVolume,
          date: new Date(quote.regularMarketTime),
          assetType,
        }))
    } catch (error) {
      throw new ProviderError(
        this.name,
        tickers.join(','),
        error.message,
        error.response?.status || 500,
      )
    }
  }
}

module.exports = YahooFinanceProvider
```

**Dependência npm**:
```json
{
  "dependencies": {
    "yahoo-finance2": "^2.11.0"
  }
}
```

**Mapeamento de Tickers**:
```
B3 → Yahoo Finance
PETR4 → PETR4.SA
VALE3 → VALE3.SA
ITUB4 → ITUB4.SA
BOVA11 → BOVA11.SA

Internacionais (sem alteração)
AAPL → AAPL
MSFT → MSFT
GOOGL → GOOGL
```

**Cenários de Teste**:
- Cenário 1: Buscar AAPL → dados retornados corretamente
- Cenário 2: Buscar PETR4 (STOCK_BR) → convertido para PETR4.SA
- Cenário 3: Buscar batch [AAPL, MSFT] → array com 2 itens
- Cenário 4: Ticker inexistente → erro 404
- Cenário 5: Verificar suporte STOCK_US → true (primário)
- Cenário 6: Verificar suporte STOCK_BR → true (fallback)
- Cenário 7: Verificar prioridade STOCK_US → 1 (primário)
- Cenário 8: Verificar prioridade STOCK_BR → 2 (fallback)

---

### EP13-004 Provider BRAPI/Yahoo para Proventos

**Como** sistema de dados de mercado
**Eu quero** buscar dados de proventos (dividendos, JCP) de ativos via BRAPI e Yahoo Finance
**Para que** o sistema possa exibir histórico de proventos e calcular rendimento por dividendos

**Tipo**: Feature
**Prioridade**: Should Have
**Estimativa**: 8 story points (L)

**Contexto**:
Proventos são pagamentos feitos por empresas aos acionistas (dividendos, JCP - Juros sobre Capital Próprio). O sistema precisa buscar o histórico de proventos de cada ativo para: (1) exibir calendário de proventos futuros; (2) calcular rendimento por dividendos; (3) integrar com o Épico 11 (Proventos). A BRAPI fornece dados de proventos com foco no mercado brasileiro, enquanto Yahoo Finance tem dados mais completos para internacionais.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o sistema busca proventos de PETR4
      QUANDO a requisição é feita via BrapiProvider
      ENTÃO deve retornar lista de proventos: [{ type: 'DIVIDEND', value: 1.80, date: '2026-03-15', ticker: 'PETR4' }]

- [ ] DADO que o sistema busca proventos de AAPL
      QUANDO a requisição é feita via YahooFinanceProvider
      ENTÃO deve retornar lista de proventos em USD com data ex-dividend

- [ ] DADO que o sistema busca proventos de um ativo que nunca pagou dividendos
      QUANDO a requisição é processada
      ENTÃO deve retornar array vazio (não erro)

- [ ] DADO que o sistema busca proventos futuros (calendário)
      QUANDO a requisição é feita
      ENTÃO deve retornar apenas proventos com data de pagamento futura

- [ ] DADO que o sistema busca proventos históricos
      QUANDO a requisição é feita com período especificado
      ENTÃO deve retornar proventos pagos no período

**Dependências**:
- Bloqueada por: EP13-002, EP13-003
- Bloqueia: EP11 (Proventos)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação da API atualizada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

**Extensão do BrapiProvider para Proventos**:
```javascript
// Adicionar ao BrapiProvider:

/**
 * Busca histórico de proventos de um ativo
 * @param {string} ticker - Código do ativo
 * @param {object} options - Opções de filtro
 * @returns {Promise<Provent[]>}
 */
async getDividends(ticker, options = {}) {
  await this.checkRateLimit()
  
  const { startDate, endDate, includeFuture = true } = options
  
  try {
    const response = await axios.get(`${this.baseUrl}/quote/${ticker}`, {
      params: {
        token: this.apiKey,
        fundamental: true,
        modules: 'dividends',
      },
      timeout: this.timeout,
    })

    const dividends = response.data.results?.[0]?.dividendsData?.cashDividends || []
    
    let filtered = dividends.map((d) => ({
      ticker,
      type: this.mapDividendType(d.label),
      value: d.rate,
      currency: 'BRL',
      exDate: new Date(d.exDividendDate),
      paymentDate: new Date(d.paymentDate),
      source: this.name,
    }))

    // Filtrar por período se especificado
    if (startDate || endDate) {
      filtered = filtered.filter((d) => {
        const date = d.paymentDate
        if (startDate && date < new Date(startDate)) return false
        if (endDate && date > new Date(endDate)) return false
        return true
      })
    }

    // Filtrar futuros se não desejado
    if (!includeFuture) {
      const now = new Date()
      filtered = filtered.filter((d) => d.paymentDate <= now)
    }

    return filtered
  } catch (error) {
    throw new ProviderError(
      this.name,
      ticker,
      error.message,
      error.response?.status || 500,
    )
  }
}

/**
 * Mapeia tipo de provento da BRAPI para padrão interno
 */
mapDividendType(label) {
  const typeMap = {
    'DIVIDENDO': 'DIVIDEND',
    'JRS CAP PROPRIO': 'JCP',
    'RENDIMENTO': 'INCOME',
    'REST CAP SOCIAL': 'CAPITAL_RETURN',
  }
  return typeMap[label?.toUpperCase()] || 'DIVIDEND'
}
```

**Extensão do YahooFinanceProvider para Proventos**:
```javascript
// Adicionar ao YahooFinanceProvider:

async getDividends(ticker, options = {}) {
  await this.checkRateLimit()
  
  const { startDate, endDate, includeFuture = true } = options
  const yahooTicker = this.normalizeTicker(ticker, ASSET_TYPES.STOCK_BR)
  
  try {
    const queryOptions = {
      period1: startDate ? new Date(startDate) : new Date('1900-01-01'),
      period2: endDate ? new Date(endDate) : new Date('2100-01-01'),
    }
    
    const result = await yahooFinance.historical(yahooTicker, queryOptions)
    
    // Yahoo retorna dividendos como parte do histórico
    const dividends = result
      .filter((item) => item.dividends && item.dividends > 0)
      .map((item) => ({
        ticker,
        type: 'DIVIDEND',
        value: item.dividends,
        currency: 'USD',
        exDate: item.date,
        paymentDate: item.date, // Yahoo não separa ex/payment date
        source: this.name,
      }))

    if (!includeFuture) {
      const now = new Date()
      return dividends.filter((d) => d.paymentDate <= now)
    }

    return dividends
  } catch (error) {
    throw new ProviderError(
      this.name,
      ticker,
      error.message,
      error.response?.status || 500,
    )
  }
}
```

**Modelo de Provento** (`src/app/provent/provent-model.js`):
```javascript
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const schema = new mongoose.Schema({
  _id: { type: String, required: true, default: uuidv4 },
  ticker: { type: String, required: true, index: true },
  type: { 
    type: String, 
    enum: ['DIVIDEND', 'JCP', 'INCOME', 'CAPITAL_RETURN'],
    required: true,
  },
  value: { type: Number, required: true },
  currency: { type: String, default: 'BRL' },
  valueBRL: { type: Number }, // Convertido para BRL
  exDate: { type: Date, required: true },
  paymentDate: { type: Date },
  source: { type: String, required: true },
  domain: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { versionKey: false })

// Índice composto para evitar duplicatas
schema.index({ ticker: 1, exDate: 1, type: 1 }, { unique: true })

module.exports = { schema }
```

**Endpoint de Proventos**:
```
GET /api/market-data/:ticker/dividends
  Query: ?startDate=2025-01-01&endDate=2026-12-31&includeFuture=true
  Response: {
    ticker: 'PETR4',
    dividends: [
      { type: 'DIVIDEND', value: 1.80, exDate: '2026-03-15', paymentDate: '2026-03-20' },
      ...
    ],
    totalReceived: 5.40,
    dividendYield: 4.2,
  }
```

**Cenários de Teste**:
- Cenário 1: Buscar proventos de PETR4 → lista de dividendos retornada
- Cenário 2: Buscar proventos de AAPL → lista em USD retornada
- Cenário 3: Ativo sem dividendos → array vazio
- Cenário 4: Filtrar por período → apenas proventos no período
- Cenário 5: Excluir futuros → apenas proventos já pagos
- Cenário 6: Mapear tipo JCP → tipo correto retornado
- Cenário 7: BRAPI falha → fallback para Yahoo
- Cenário 8: Calcular dividend yield → percentual correto

---

### EP13-005 Provider BCB para Índices Econômicos

**Como** sistema de dados de mercado
**Eu quero** buscar índices econômicos brasileiros (CDI, IPCA, SELIC) via API do Banco Central
**Para que** o sistema possa calcular rentabilidade de renda fixa e comparar performance com benchmarks

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points (M)

**Contexto**:
O Banco Central do Brasil disponibiliza uma API pública (SGS - Sistema Gerenciador de Séries Temporais) com dados de índices econômicos. O sistema precisa buscar: (1) CDI (taxa Selic over) para cálculo de CDBs e LCIs; (2) IPCA (inflação) para títulos indexados; (3) Taxa Selic (meta) para referência. Esses dados são essenciais para o Épico 7 (Renda Fixa) e para comparação de performance no Dashboard.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o sistema busca CDI diário
      QUANDO a requisição é feita via BCBProvider
      ENTÃO deve retornar série histórica: [{ date: '2026-03-27', value: 0.0145 }, ...] (taxa diária)

- [ ] DADO que o sistema busca IPCA acumulado dos últimos 12 meses
      QUANDO a requisição é feita
      ENTÃO deve retornar valor acumulado: 4.62 (percentual anual)

- [ ] DADO que o sistema busca taxa SELIC meta
      QUANDO a requisição é feita
      ENTÃO deve retornar taxa atual: 13.75 (percentual anual)

- [ ] DADO que o sistema busca índice em uma data específica
      QUANDO a requisição é feita com parâmetro de data
      ENTÃO deve retornar valor do índice naquela data

- [ ] DADO que o BCBProvider verifica suporte para assetType INDEX
      QUANDO o método supportsAssetType é chamado
      ENTÃO deve retornar true (único provider para índices econômicos)

**Dependências**:
- Bloqueada por: EP13-001
- Bloqueia: EP07 (Renda Fixa), EP14 (Atualização de Dados)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação da API atualizada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

**BCBProvider** (`src/app/market-data/providers/bcb-provider.js`):
```javascript
const axios = require('axios')
const MarketDataProvider = require('./market-data-provider')
const { PROVIDER_NAMES, ASSET_TYPES, PROVIDER_PRIORITIES, RATE_LIMITS, TIMEOUTS, ProviderError } = require('../constants/provider-constants')

// Códigos das séries no SGS do BCB
const BCB_SERIES = {
  CDI: 12,           // Taxa de juros - CDI
  SELIC: 11,         // Taxa de juros - Selic
  SELIC_META: 432,   // Meta Selic
  IPCA: 433,         // IPCA - INPC
  IPCA_12M: 13522,   // IPCA acumulado 12 meses
  IGPM: 189,         // IGP-M
  TR: 226,           // Taxa Referencial
  POUPANCA: 195,     // Taxa Poupança
}

class BCBProvider extends MarketDataProvider {
  constructor(config = {}) {
    super({
      baseUrl: config.baseUrl || 'https://api.bcb.gov.br/dados/serie/bcdata.sgs',
      timeout: config.timeout || TIMEOUTS[PROVIDER_NAMES.BCB],
      rateLimitPerMinute: config.rateLimitPerMinute || RATE_LIMITS[PROVIDER_NAMES.BCB],
    })
    this.supportedTypes = [ASSET_TYPES.INDEX]
    this.seriesCodes = BCB_SERIES
  }

  supportsAssetType(assetType) {
    return this.supportedTypes.includes(assetType)
  }

  getPriority(assetType) {
    return PROVIDER_PRIORITIES[assetType]?.[PROVIDER_NAMES.BCB] || 999
  }

  /**
   * Busca série histórica de um índice
   * @param {string} indexName - Nome do índice (CDI, IPCA, SELIC, etc.)
   * @param {object} options - Opções de período
   * @returns {Promise<IndexData[]>}
   */
  async getIndexHistory(indexName, options = {}) {
    await this.checkRateLimit()
    
    const seriesCode = this.seriesCodes[indexName.toUpperCase()]
    if (!seriesCode) {
      throw new ProviderError(
        this.name,
        indexName,
        `Índice ${indexName} não suportado`,
        400,
      )
    }

    const { startDate, endDate } = options
    const start = startDate || this.getDefaultStartDate(indexName)
    const end = endDate || new Date().toISOString().split('T')[0]

    try {
      const response = await axios.get(
        `${this.baseUrl}.${seriesCode}/dados`,
        {
          params: {
            dataInicial: this.formatDate(start),
            dataFinal: this.formatDate(end),
          },
          timeout: this.timeout,
        }
      )

      const data = response.data || []
      
      return data.map((item) => ({
        date: this.parseDate(item.data),
        value: parseFloat(item.valor),
        indexName,
        source: this.name,
      }))
    } catch (error) {
      throw new ProviderError(
        this.name,
        indexName,
        error.message,
        error.response?.status || 500,
      )
    }
  }

  /**
   * Busca último valor de um índice
   * @param {string} indexName - Nome do índice
   * @returns {Promise<IndexData>}
   */
  async getLatestIndex(indexName) {
    await this.checkRateLimit()
    
    const seriesCode = this.seriesCodes[indexName.toUpperCase()]
    if (!seriesCode) {
      throw new ProviderError(
        this.name,
        indexName,
        `Índice ${indexName} não suportado`,
        400,
      )
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}.${seriesCode}/dados/ultimos/1`,
        { timeout: this.timeout }
      )

      const item = response.data?.[0]
      if (!item) {
        throw new ProviderError(
          this.name,
          indexName,
          'Dados não disponíveis',
          404,
        )
      }

      return {
        date: this.parseDate(item.data),
        value: parseFloat(item.valor),
        indexName,
        source: this.name,
      }
    } catch (error) {
      if (error instanceof ProviderError) throw error
      
      throw new ProviderError(
        this.name,
        indexName,
        error.message,
        error.response?.status || 500,
      )
    }
  }

  /**
   * Calcula CDI acumulado no período
   * @param {Date} startDate - Data inicial
   * @param {Date} endDate - Data final
   * @returns {Promise<number>} Taxa acumulada
   */
  async getAccumulatedCDI(startDate, endDate) {
    const history = await this.getIndexHistory('CDI', { startDate, endDate })
    
    // CDI diário é taxa percentual, converter para fator
    const factor = history.reduce((acc, item) => {
      const dailyRate = item.value / 100
      return acc * (1 + dailyRate)
    }, 1)

    return (factor - 1) * 100 // Retornar como percentual
  }

  /**
   * Busca IPCA acumulado 12 meses
   * @returns {Promise<number>}
   */
  async getIPCA12M() {
    const latest = await this.getLatestIndex('IPCA_12M')
    return latest.value
  }

  /**
   * Formata data para API BCB (DD/MM/YYYY)
   */
  formatDate(date) {
    const d = new Date(date)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  }

  /**
   * Converte data do BCB (DD/MM/YYYY) para Date
   */
  parseDate(dateStr) {
    const [day, month, year] = dateStr.split('/')
    return new Date(`${year}-${month}-${day}`)
  }

  /**
   * Data padrão baseada no índice
   */
  getDefaultStartDate(indexName) {
    const now = new Date()
    switch (indexName.toUpperCase()) {
      case 'CDI':
      case 'SELIC':
        return new Date(now.setFullYear(now.getFullYear() - 5)) // 5 anos
      case 'IPCA':
        return new Date(now.setFullYear(now.getFullYear() - 10)) // 10 anos
      default:
        return new Date(now.setFullYear(now.getFullYear() - 1))
    }
  }
}

module.exports = { BCBProvider, BCB_SERIES }
```

**Endpoints BCB Utilizados**:
```
GET /dados/serie/bcdata.sgs.{codigo}/dados
  - Série histórica completa
  - Parâmetros: dataInicial, dataFinal (DD/MM/YYYY)

GET /dados/serie/bcdata.sgs.{codigo}/dados/ultimos/{N}
  - Últimos N valores

Códigos SGS:
- 12: CDI diário
- 11: Selic diária
- 432: Meta Selic
- 433: IPCA mensal
- 13522: IPCA acumulado 12 meses
```

**Modelo de Índice Econômico** (`src/app/market-data/index-data-model.js`):
```javascript
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const schema = new mongoose.Schema({
  _id: { type: String, required: true, default: uuidv4 },
  indexName: { 
    type: String, 
    enum: ['CDI', 'SELIC', 'SELIC_META', 'IPCA', 'IPCA_12M', 'IGPM', 'TR', 'POUPANCA'],
    required: true,
    index: true,
  },
  date: { type: Date, required: true, index: true },
  value: { type: Number, required: true },
  source: { type: String, required: true },
  domain: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false })

// Índice único para evitar duplicatas
schema.index({ indexName: 1, date: 1 }, { unique: true })

module.exports = { schema }
```

**Endpoints de Índices**:
```
GET /api/market-data/indices/:indexName
  Query: ?startDate=2025-01-01&endDate=2026-12-31
  Response: {
    indexName: 'CDI',
    data: [
      { date: '2026-03-27', value: 0.0145 },
      ...
    ],
    accumulated: 14.25, // Acumulado no período
  }

GET /api/market-data/indices/:indexName/latest
  Response: {
    indexName: 'CDI',
    date: '2026-03-27',
    value: 0.0145,
    annualized: 13.75,
  }
```

**Cenários de Teste**:
- Cenário 1: Buscar CDI diário → série histórica retornada
- Cenário 2: Buscar IPCA 12M → valor acumulado retornado
- Cenário 3: Buscar SELIC meta → taxa atual retornada
- Cenário 4: Buscar índice inexistente → erro 400
- Cenário 5: Calcular CDI acumulado → fator correto
- Cenário 6: Filtrar por período → apenas datas no período
- Cenário 7: Verificar suporte INDEX → true
- Cenário 8: Verificar suporte STOCK_BR → false

---

### EP13-006 Providers CoinGecko e Binance para Criptomoedas

**Como** sistema de dados de mercado
**Eu quero** buscar cotações de criptomoedas via CoinGecko (primário) e Binance (fallback)
**Para que** o sistema tenha dados de cripto atualizados em alta frequência

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points (L)

**Contexto**:
Criptomoedas exigem atualização em alta frequência (30 segundos) devido à volatilidade. O CoinGecko é a fonte primária por ter dados de mercado consolidados e ampla cobertura de criptos. A Binance serve como fallback e também fornece dados em tempo real para criptos negociadas na exchange. Este provider é usado pelo Épico 12 (Criptomoedas) e pelo scheduler de alta frequência.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o CoinGeckoProvider busca preço de BTC
      QUANDO a requisição é feita com sucesso
      ENTÃO deve retornar dados normalizados: { ticker: 'BTC', priceUSD: 97500, priceBRL: 502125, change24h: -2.3, source: 'CoinGeckoProvider' }

- [ ] DADO que o CoinGeckoProvider busca batch de criptos ['BTC', 'ETH', 'SOL']
      QUANDO a requisição é feita
      ENTÃO deve retornar array com dados de todas as criptos em uma única chamada

- [ ] DADO que o CoinGeckoProvider falha (rate limit 429)
      QUANDO o fallback é acionado
      ENTÃO o BinanceProvider deve ser usado automaticamente

- [ ] DADO que o BinanceProvider busca preço de BTC
      QUANDO a requisição é feita
      ENTÃO deve retornar preço em USDT e converter para BRL usando taxa de câmbio

- [ ] DADO que o CoinGeckoProvider verifica suporte para assetType CRYPTO
      QUANDO o método supportsAssetType é chamado
      ENTÃO deve retornar true (é provider primário para cripto)

**Dependências**:
- Bloqueada por: EP13-001, EP06 (Câmbio)
- Bloqueia: EP12 (Criptomoedas)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação da API atualizada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

**CoinGeckoProvider** (`src/app/market-data/providers/coingecko-provider.js`):
```javascript
const axios = require('axios')
const MarketDataProvider = require('./market-data-provider')
const { PROVIDER_NAMES, ASSET_TYPES, PROVIDER_PRIORITIES, RATE_LIMITS, TIMEOUTS, ProviderError } = require('../constants/provider-constants')

// Mapeamento de tickers para IDs do CoinGecko
const COINGECKO_ID_MAP = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  SHIB: 'shiba-inu',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  UNI: 'uniswap',
  ATOM: 'cosmos',
  LTC: 'litecoin',
}

class CoinGeckoProvider extends MarketDataProvider {
  constructor(config = {}) {
    super({
      baseUrl: config.baseUrl || 'https://api.coingecko.com/api/v3',
      apiKey: config.apiKey || process.env.COINGECKO_API_KEY,
      timeout: config.timeout || TIMEOUTS[PROVIDER_NAMES.COINGECKO],
      rateLimitPerMinute: config.rateLimitPerMinute || RATE_LIMITS[PROVIDER_NAMES.COINGECKO],
    })
    this.supportedTypes = [ASSET_TYPES.CRYPTO]
    this.idMap = COINGECKO_ID_MAP
    this.reverseIdMap = Object.fromEntries(
      Object.entries(COINGECKO_ID_MAP).map(([k, v]) => [v, k])
    )
  }

  supportsAssetType(assetType) {
    return this.supportedTypes.includes(assetType)
  }

  getPriority(assetType) {
    return PROVIDER_PRIORITIES[assetType]?.[PROVIDER_NAMES.COINGECKO] || 999
  }

  /**
   * Converte ticker para ID do CoinGecko
   */
  tickerToId(ticker) {
    return this.idMap[ticker.toUpperCase()] || ticker.toLowerCase()
  }

  /**
   * Converte ID do CoinGecko para ticker
   */
  idToTicker(id) {
    return this.reverseIdMap[id] || id.toUpperCase()
  }

  async getPrice(ticker, assetType) {
    await this.checkRateLimit()
    
    const coinId = this.tickerToId(ticker)
    
    try {
      const response = await axios.get(`${this.baseUrl}/simple/price`, {
        params: {
          ids: coinId,
          vs_currencies: 'usd,brl',
          include_24hr_change: true,
          include_24hr_vol: true,
          include_last_updated_at: true,
          x_cg_demo_api_key: this.apiKey,
        },
        timeout: this.timeout,
      })

      const data = response.data[coinId]
      if (!data) {
        throw new ProviderError(this.name, ticker, 'Criptomoeda não encontrada', 404)
      }

      return this.normalizeResponse({
        ticker: ticker.toUpperCase(),
        price: data.brl,
        priceUSD: data.usd,
        change: data.usd_24h_change || 0,
        changePercent: data.usd_24h_change || 0,
        volume: data.usd_24h_vol || 0,
        date: new Date(data.last_updated_at * 1000),
        assetType,
      })
    } catch (error) {
      if (error instanceof ProviderError) throw error
      
      throw new ProviderError(
        this.name,
        ticker,
        error.message,
        error.response?.status || 500,
      )
    }
  }

  async getBatchPrices(tickers, assetType) {
    await this.checkRateLimit()
    
    const coinIds = tickers.map((t) => this.tickerToId(t)).join(',')
    
    try {
      const response = await axios.get(`${this.baseUrl}/simple/price`, {
        params: {
          ids: coinIds,
          vs_currencies: 'usd,brl',
          include_24hr_change: true,
          include_24hr_vol: true,
          include_last_updated_at: true,
          x_cg_demo_api_key: this.apiKey,
        },
        timeout: this.timeout,
      })

      const results = []
      for (const [coinId, data] of Object.entries(response.data)) {
        const ticker = this.idToTicker(coinId)
        results.push(this.normalizeResponse({
          ticker,
          price: data.brl,
          priceUSD: data.usd,
          change: data.usd_24h_change || 0,
          changePercent: data.usd_24h_change || 0,
          volume: data.usd_24h_vol || 0,
          date: new Date(data.last_updated_at * 1000),
          assetType,
        }))
      }

      return results
    } catch (error) {
      throw new ProviderError(
        this.name,
        tickers.join(','),
        error.message,
        error.response?.status || 500,
      )
    }
  }

  /**
   * Busca lista de criptomoedas por market cap
   * @param {number} limit - Quantidade máxima
   * @returns {Promise<CryptoList[]>}
   */
  async getTopByMarketCap(limit = 100) {
    await this.checkRateLimit()
    
    try {
      const response = await axios.get(`${this.baseUrl}/coins/markets`, {
        params: {
          vs_currency: 'brl',
          order: 'market_cap_desc',
          per_page: limit,
          page: 1,
          sparkline: false,
          x_cg_demo_api_key: this.apiKey,
        },
        timeout: this.timeout,
      })

      return response.data.map((coin) => ({
        ticker: this.idToTicker(coin.id),
        name: coin.name,
        priceBRL: coin.current_price,
        priceUSD: coin.current_price / coin.current_price, // Precisa buscar USD separadamente
        marketCap: coin.market_cap,
        marketCapRank: coin.market_cap_rank,
        change24h: coin.price_change_percentage_24h,
        volume24h: coin.total_volume,
        image: coin.image,
      }))
    } catch (error) {
      throw new ProviderError(
        this.name,
        'TOP_CRYPTO',
        error.message,
        error.response?.status || 500,
      )
    }
  }
}

module.exports = CoinGeckoProvider
```

**BinanceProvider** (`src/app/market-data/providers/binance-provider.js`):
```javascript
const axios = require('axios')
const MarketDataProvider = require('./market-data-provider')
const { PROVIDER_NAMES, ASSET_TYPES, PROVIDER_PRIORITIES, RATE_LIMITS, TIMEOUTS, ProviderError } = require('../constants/provider-constants')

class BinanceProvider extends MarketDataProvider {
  constructor(config = {}) {
    super({
      baseUrl: config.baseUrl || 'https://api.binance.com/api/v3',
      timeout: config.timeout || TIMEOUTS[PROVIDER_NAMES.BINANCE],
      rateLimitPerMinute: config.rateLimitPerMinute || RATE_LIMITS[PROVIDER_NAMES.BINANCE],
    })
    this.supportedTypes = [ASSET_TYPES.CRYPTO]
    this.exchangeRateService = null // Injetado via setter
  }

  supportsAssetType(assetType) {
    return this.supportedTypes.includes(assetType)
  }

  getPriority(assetType) {
    return PROVIDER_PRIORITIES[assetType]?.[PROVIDER_NAMES.BINANCE] || 999
  }

  setExchangeRateService(service) {
    this.exchangeRateService = service
  }

  /**
   * Converte ticker para símbolo da Binance
   * BTC → BTCUSDT
   */
  tickerToSymbol(ticker) {
    return `${ticker.toUpperCase()}USDT`
  }

  /**
   * Converte símbolo da Binance para ticker
   * BTCUSDT → BTC
   */
  symbolToTicker(symbol) {
    return symbol.replace('USDT', '').replace('BRL', '')
  }

  async getPrice(ticker, assetType) {
    await this.checkRateLimit()
    
    const symbol = this.tickerToSymbol(ticker)
    
    try {
      const [tickerResponse, usdbrlRate] = await Promise.all([
        axios.get(`${this.baseUrl}/ticker/24hr`, {
          params: { symbol },
          timeout: this.timeout,
        }),
        this.getUSDBRLRate(),
      ])

      const data = tickerResponse.data
      const priceUSD = parseFloat(data.lastPrice)
      const priceBRL = priceUSD * usdbrlRate

      return this.normalizeResponse({
        ticker: ticker.toUpperCase(),
        price: priceBRL,
        priceUSD,
        change: parseFloat(data.priceChange),
        changePercent: parseFloat(data.priceChangePercent),
        volume: parseFloat(data.volume) * priceUSD, // Volume em USD
        date: new Date(),
        assetType,
      })
    } catch (error) {
      if (error instanceof ProviderError) throw error
      
      throw new ProviderError(
        this.name,
        ticker,
        error.message,
        error.response?.status || 500,
      )
    }
  }

  async getBatchPrices(tickers, assetType) {
    await this.checkRateLimit()
    
    const symbols = tickers.map((t) => `"${this.tickerToSymbol(t)}"`).join(',')
    
    try {
      const [tickerResponse, usdbrlRate] = await Promise.all([
        axios.get(`${this.baseUrl}/ticker/24hr`, {
          params: { symbols: `[${symbols}]` },
          timeout: this.timeout,
        }),
        this.getUSDBRLRate(),
      ])

      return tickerResponse.data.map((data) => {
        const ticker = this.symbolToTicker(data.symbol)
        const priceUSD = parseFloat(data.lastPrice)
        const priceBRL = priceUSD * usdbrlRate

        return this.normalizeResponse({
          ticker,
          price: priceBRL,
          priceUSD,
          change: parseFloat(data.priceChange),
          changePercent: parseFloat(data.priceChangePercent),
          volume: parseFloat(data.volume) * priceUSD,
          date: new Date(),
          assetType,
        })
      })
    } catch (error) {
      throw new ProviderError(
        this.name,
        tickers.join(','),
        error.message,
        error.response?.status || 500,
      )
    }
  }

  /**
   * Obtém taxa USD/BRL
   * @returns {Promise<number>}
   */
  async getUSDBRLRate() {
    // Se tiver serviço de câmbio injetado, usar
    if (this.exchangeRateService) {
      return await this.exchangeRateService.getUSDBRLRate()
    }

    // Fallback: buscar da Binance (USDTBRL pair)
    try {
      const response = await axios.get(`${this.baseUrl}/ticker/price`, {
        params: { symbol: 'USDTBRL' },
        timeout: this.timeout,
      })
      return parseFloat(response.data.price)
    } catch (error) {
      // Último fallback: valor fixo (não recomendado para produção)
      logger.warn('Could not fetch USD/BRL rate, using fallback', {
        internal: { method: 'getUSDBRLRate', filename: 'binance-provider.js' },
      })
      return 5.15 // Valor aproximado
    }
  }
}

module.exports = BinanceProvider
```

**Variáveis de Ambiente**:
```
COINGECKO_API_KEY=xxx                 # API Key (opcional para free tier)
BINANCE_API_KEY=xxx                    # API Key (opcional)
BINANCE_API_SECRET=xxx                 # API Secret (opcional)
```

**Cenários de Teste**:
- Cenário 1: Buscar BTC via CoinGecko → dados em BRL e USD
- Cenário 2: Buscar batch [BTC, ETH] via CoinGecko → array com 2 itens
- Cenário 3: CoinGecko falha → Binance usado como fallback
- Cenário 4: Buscar BTC via Binance → preço convertido para BRL
- Cenário 5: Cripto inexistente → erro 404
- Cenário 6: Rate limit CoinGecko → erro para acionar fallback
- Cenário 7: Verificar suporte CRYPTO → true
- Cenário 8: getTopByMarketCap → lista ordenada por market cap

---

### EP13-007 Market Data Manager com Cache Redis

**Como** sistema de dados de mercado
**Eu quero** um Manager que orquestra providers, gerencia cache Redis e expõe endpoints de dados de mercado
**Para que** o sistema tenha dados atualizados com baixa latência e alta disponibilidade

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 13 story points (XL)

**Contexto**:
O MarketDataManager é a camada de orquestração que: (1) recebe requisições de dados de mercado; (2) verifica cache Redis antes de consultar APIs externas; (3) usa o ProviderFactory para buscar dados com fallback; (4) armazena resultados no cache com TTL apropriado; (5) persiste dados históricos no MongoDB; (6) expõe endpoints REST para o frontend. O cache Redis é crítico para reduzir latência e respeitar rate limits das APIs.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o sistema busca preço de PETR4 pela primeira vez
      QUANDO a requisição é processada
      ENTÃO deve buscar da API externa, salvar no Redis com TTL de 5 minutos e retornar o dado

- [ ] DADO que o preço de PETR4 está no cache Redis (TTL não expirado)
      QUANDO uma nova requisição é feita
      ENTÃO deve retornar o dado do cache sem consultar API externa (cache hit)

- [ ] DADO que o cache Redis está indisponível
      QUANDO uma requisição é feita
      ENTÃO deve buscar da API externa diretamente e logar o erro de cache

- [ ] DADO que o sistema busca dados de múltiplos tickers
      QUANDO a requisição é processada
      ENTÃO deve usar batch request para otimizar chamadas e armazenar cada ticker individualmente no cache

- [ ] DADO que o sistema busca dados de criptomoedas
      QUANDO o dado é armazenado no cache
      ENTÃO deve usar TTL de 30 segundos (alta frequência) diferente de ações (5 minutos)

**Dependências**:
- Bloqueada por: EP13-001, EP13-002, EP13-003, EP13-005, EP13-006, EP01 (Redis)
- Bloqueia: EP14 (Atualização de Dados), EP19 (Dashboard)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] Teste de carga: 100 requisições simultâneas
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação da API atualizada (Swagger)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

**MarketDataManager** (`src/app/market-data/market-data-manager.js`):
```javascript
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app-constants')
const ProviderFactory = require('./providers/provider-factory')
const MarketDataDAO = require('./market-data-dao')
const { ASSET_TYPES } = require('./constants/provider-constants')

const logger = new JsonLog(SERVICE_NAME)

// TTLs por tipo de ativo (em segundos)
const CACHE_TTL = {
  [ASSET_TYPES.STOCK_BR]: 300,    // 5 minutos
  [ASSET_TYPES.STOCK_US]: 300,    // 5 minutos
  [ASSET_TYPES.ETF_BR]: 300,      // 5 minutos
  [ASSET_TYPES.ETF_US]: 300,      // 5 minutos
  [ASSET_TYPES.FII]: 300,         // 5 minutos
  [ASSET_TYPES.BDR]: 300,         // 5 minutos
  [ASSET_TYPES.CRYPTO]: 30,       // 30 segundos
  [ASSET_TYPES.INDEX]: 86400,     // 24 horas (atualizado diariamente)
}

class MarketDataManager {
  constructor(appManager, appDB, redisClient) {
    this.appDB = appDB
    this.redisClient = redisClient
    this.marketDataDAO = new MarketDataDAO(appDB.getDb())
    
    this.providerFactory = new ProviderFactory({
      brapi: { apiKey: process.env.BRAPI_API_KEY },
      yahoo: {},
      coingecko: { apiKey: process.env.COINGECKO_API_KEY },
      binance: {},
      bcb: {},
    })
  }

  /**
   * Busca preço de um ativo
   * @param {object} params
   * @param {string} params.ticker - Código do ativo
   * @param {string} params.assetType - Tipo do ativo
   * @param {string} params.domain - Domínio do usuário
   * @returns {Promise<MarketData>}
   */
  async getPrice({ ticker, assetType, domain }) {
    const cacheKey = this.getCacheKey(ticker, assetType)
    
    // 1. Tentar buscar do cache
    try {
      const cached = await this.redisClient.get(cacheKey)
      if (cached) {
        logger.log('Cache hit', {
          domain,
          internal: { method: 'getPrice', filename: 'market-data-manager.js' },
          ticker,
          assetType,
        })
        return JSON.parse(cached)
      }
    } catch (cacheError) {
      logger.error('Redis error, proceeding without cache', cacheError, {
        domain,
        internal: { method: 'getPrice', filename: 'market-data-manager.js' },
      })
    }

    // 2. Buscar da API externa com fallback
    logger.log('Cache miss, fetching from provider', {
      domain,
      internal: { method: 'getPrice', filename: 'market-data-manager.js' },
      ticker,
      assetType,
    })

    const { data, provider } = await this.providerFactory.fetchWithFallback(ticker, assetType)
    
    // 3. Salvar no cache
    const ttl = CACHE_TTL[assetType] || 300
    try {
      await this.redisClient.setex(
        cacheKey,
        ttl,
        JSON.stringify({ ...data, provider }),
      )
    } catch (cacheError) {
      logger.error('Failed to save to cache', cacheError, {
        domain,
        internal: { method: 'getPrice', filename: 'market-data-manager.js' },
      })
    }

    // 4. Persistir no MongoDB (histórico)
    await this.saveToHistory(data, domain)

    return { ...data, provider }
  }

  /**
   * Busca preços de múltiplos ativos
   * @param {object} params
   * @param {string[]} params.tickers - Lista de tickers
   * @param {string} params.assetType - Tipo dos ativos
   * @param {string} params.domain - Domínio do usuário
   * @returns {Promise<MarketData[]>}
   */
  async getBatchPrices({ tickers, assetType, domain }) {
    const results = []
    const tickersToFetch = []
    
    // 1. Verificar cache para cada ticker
    for (const ticker of tickers) {
      const cacheKey = this.getCacheKey(ticker, assetType)
      try {
        const cached = await this.redisClient.get(cacheKey)
        if (cached) {
          results.push(JSON.parse(cached))
          continue
        }
      } catch (cacheError) {
        // Ignorar erro de cache
      }
      tickersToFetch.push(ticker)
    }

    // 2. Buscar tickers não encontrados no cache
    if (tickersToFetch.length > 0) {
      const { data, provider } = await this.providerFactory.fetchBatchWithFallback(
        tickersToFetch,
        assetType,
      )

      const ttl = CACHE_TTL[assetType] || 300
      
      // 3. Salvar cada um no cache
      for (const item of data) {
        const cacheKey = this.getCacheKey(item.ticker, assetType)
        try {
          await this.redisClient.setex(
            cacheKey,
            ttl,
            JSON.stringify({ ...item, provider }),
          )
        } catch (cacheError) {
          // Ignorar erro de cache
        }

        // 4. Persistir no MongoDB
        await this.saveToHistory(item, domain)
      }

      results.push(...data.map((d) => ({ ...d, provider })))
    }

    return results
  }

  /**
   * Busca índice econômico
   * @param {object} params
   * @param {string} params.indexName - Nome do índice (CDI, IPCA, etc.)
   * @param {string} params.domain - Domínio do usuário
   * @returns {Promise<IndexData>}
   */
  async getIndex({ indexName, domain }) {
    const cacheKey = `index:${indexName}`
    
    // Verificar cache
    try {
      const cached = await this.redisClient.get(cacheKey)
      if (cached) {
        return JSON.parse(cached)
      }
    } catch (cacheError) {
      // Ignorar
    }

    // Buscar do BCB
    const bcbProvider = this.providerFactory.providers.find(
      (p) => p.name === 'BCBProvider',
    )
    
    const data = await bcbProvider.getLatestIndex(indexName)
    
    // Salvar no cache (24h TTL)
    try {
      await this.redisClient.setex(
        cacheKey,
        86400,
        JSON.stringify(data),
      )
    } catch (cacheError) {
      // Ignorar
    }

    return data
  }

  /**
   * Busca histórico de índice econômico
   * @param {object} params
   * @param {string} params.indexName - Nome do índice
   * @param {Date} params.startDate - Data inicial
   * @param {Date} params.endDate - Data final
   * @param {string} params.domain - Domínio do usuário
   * @returns {Promise<IndexData[]>}
   */
  async getIndexHistory({ indexName, startDate, endDate, domain }) {
    const bcbProvider = this.providerFactory.providers.find(
      (p) => p.name === 'BCBProvider',
    )
    
    return await bcbProvider.getIndexHistory(indexName, { startDate, endDate })
  }

  /**
   * Invalida cache de um ticker
   * @param {string} ticker - Código do ativo
   * @param {string} assetType - Tipo do ativo
   */
  async invalidateCache(ticker, assetType) {
    const cacheKey = this.getCacheKey(ticker, assetType)
    try {
      await this.redisClient.del(cacheKey)
      logger.log('Cache invalidated', {
        internal: { method: 'invalidateCache', filename: 'market-data-manager.js' },
        ticker,
        assetType,
      })
    } catch (error) {
      logger.error('Failed to invalidate cache', error, {
        internal: { method: 'invalidateCache', filename: 'market-data-manager.js' },
      })
    }
  }

  /**
   * Gera chave de cache
   */
  getCacheKey(ticker, assetType) {
    return `market-data:${assetType}:${ticker.toUpperCase()}`
  }

  /**
   * Salva dado no histórico (MongoDB)
   */
  async saveToHistory(data, domain) {
    try {
      await this.marketDataDAO.create({
        ...data,
        domain,
      })
    } catch (error) {
      // Ignorar erro de duplicata (índice único)
      if (!error.message?.includes('duplicate')) {
        logger.error('Failed to save to history', error, {
          domain,
          internal: { method: 'saveToHistory', filename: 'market-data-manager.js' },
        })
      }
    }
  }

  /**
   * Busca dados de proventos
   * @param {object} params
   * @param {string} params.ticker - Código do ativo
   * @param {string} params.assetType - Tipo do ativo
   * @param {object} params.options - Opções de filtro
   * @returns {Promise<Provent[]>}
   */
  async getDividends({ ticker, assetType, options = {} }) {
    const provider = this.getProviderForAssetType(assetType)
    
    if (!provider || typeof provider.getDividends !== 'function') {
      return []
    }

    return await provider.getDividends(ticker, options)
  }

  /**
   * Obtém provider apropriado para o tipo de ativo
   */
  getProviderForAssetType(assetType) {
    const chain = this.providerFactory.getProviderChain(assetType)
    return chain[0] // Retornar primário
  }
}

module.exports = MarketDataManager
```

**MarketDataDAO** (`src/app/market-data/market-data-dao.js`):
```javascript
const AppDAO = require('../app-dao')
const { schema: marketDataSchema } = require('./market-data-model')

class MarketDataDAO extends AppDAO {
  constructor(db) {
    super(db)
  }

  initializeDBModel(db) {
    return db.model('MarketData', marketDataSchema)
  }

  async create(data) {
    const doc = new this.objectModel(data)
    return await doc.save()
  }

  async findByTicker(ticker, options = {}) {
    const { limit = 100, sort = { date: -1 } } = options
    return await this.objectModel
      .find({ ticker: ticker.toUpperCase() })
      .sort(sort)
      .limit(limit)
      .lean()
      .exec()
  }

  async findByTickerAndDateRange(ticker, startDate, endDate) {
    return await this.objectModel
      .find({
        ticker: ticker.toUpperCase(),
        date: { $gte: startDate, $lte: endDate },
      })
      .sort({ date: 1 })
      .lean()
      .exec()
  }

  async findLatestByTicker(ticker) {
    return await this.objectModel
      .findOne({ ticker: ticker.toUpperCase() })
      .sort({ date: -1 })
      .lean()
      .exec()
  }

  async deleteOldData(daysToKeep = 365) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    
    return await this.objectModel
      .deleteMany({ date: { $lt: cutoffDate } })
      .exec()
  }
}

module.exports = MarketDataDAO
```

**MarketDataModel** (`src/app/market-data/market-data-model.js`):
```javascript
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const schema = new mongoose.Schema({
  _id: { type: String, required: true, default: uuidv4 },
  ticker: { type: String, required: true, uppercase: true, index: true },
  price: { type: Number, required: true },
  priceUSD: { type: Number },
  change: { type: Number },
  changePercent: { type: Number },
  volume: { type: Number },
  date: { type: Date, required: true, index: true },
  source: { type: String, required: true },
  assetType: { 
    type: String, 
    enum: ['STOCK_BR', 'STOCK_US', 'ETF_BR', 'ETF_US', 'FII', 'BDR', 'CRYPTO', 'INDEX'],
    required: true,
    index: true,
  },
  domain: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false })

// Índice composto para consultas eficientes
schema.index({ ticker: 1, date: -1 })
schema.index({ domain: 1, assetType: 1 })

module.exports = { schema }
```

**MarketDataRouter** (`src/app/market-data/market-data-router.js`):
```javascript
const express = require('express')
const { Authorizer, Permissions } = require('interact-utils')
const { Exception } = require('interact-utils')
const APP_CONSTANTS = require('../app-constants')

class MarketDataRouter {
  static handleError(exception, res) {
    res.status(exception.statusCode || 500).send(exception.message || 'Server Error')
  }

  static getPublicRoutes(appManager) {
    const router = express.Router()
    const manager = appManager.getMarketDataManager()

    /**
     * Busca preço de um ativo
     * GET /api/market-data/:ticker
     */
    router.get(
      '/:ticker',
      Authorizer.getMiddleware(Permissions.SERVICES),
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const { ticker } = req.params
          const { assetType = 'STOCK_BR' } = req.query

          const data = await manager.getPrice({
            ticker,
            assetType,
            domain,
          })

          res.status(200).send(data)
        } catch (exception) {
          MarketDataRouter.handleError(exception, res)
        }
      },
    )

    /**
     * Busca preços de múltiplos ativos
     * GET /api/market-data/search
     * Query: ?tickers=PETR4,VALE3&assetType=STOCK_BR
     */
    router.get(
      '/search',
      Authorizer.getMiddleware(Permissions.SERVICES),
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const { tickers, assetType = 'STOCK_BR' } = req.query

          if (!tickers) {
            throw new Exception(400, 'Parâmetro tickers é obrigatório')
          }

          const tickerList = tickers.split(',').map((t) => t.trim())

          const data = await manager.getBatchPrices({
            tickers: tickerList,
            assetType,
            domain,
          })

          res.status(200).send({ prices: data })
        } catch (exception) {
          MarketDataRouter.handleError(exception, res)
        }
      },
    )

    /**
     * Busca índice econômico
     * GET /api/market-data/indices/:indexName
     */
    router.get(
      '/indices/:indexName',
      Authorizer.getMiddleware(Permissions.SERVICES),
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const { indexName } = req.params
          const { startDate, endDate } = req.query

          if (startDate && endDate) {
            const data = await manager.getIndexHistory({
              indexName,
              startDate,
              endDate,
              domain,
            })
            res.status(200).send({ indexName, data })
          } else {
            const data = await manager.getIndex({ indexName, domain })
            res.status(200).send(data)
          }
        } catch (exception) {
          MarketDataRouter.handleError(exception, res)
        }
      },
    )

    /**
     * Busca proventos de um ativo
     * GET /api/market-data/:ticker/dividends
     */
    router.get(
      '/:ticker/dividends',
      Authorizer.getMiddleware(Permissions.SERVICES),
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const { ticker } = req.params
          const { assetType = 'STOCK_BR', startDate, endDate, includeFuture } = req.query

          const data = await manager.getDividends({
            ticker,
            assetType,
            options: { startDate, endDate, includeFuture: includeFuture !== 'false' },
          })

          res.status(200).send({ ticker, dividends: data })
        } catch (exception) {
          MarketDataRouter.handleError(exception, res)
        }
      },
    )

    /**
     * Invalida cache de um ticker (admin)
     * DELETE /api/market-data/:ticker/cache
     */
    router.delete(
      '/:ticker/cache',
      Authorizer.getMiddleware(Permissions.ADMIN),
      async (req, res) => {
        try {
          const { ticker } = req.params
          const { assetType = 'STOCK_BR' } = req.query

          await manager.invalidateCache(ticker, assetType)

          res.status(204).send()
        } catch (exception) {
          MarketDataRouter.handleError(exception, res)
        }
      },
    )

    return router
  }
}

module.exports = MarketDataRouter
```

**TTLs por Tipo de Ativo**:
```javascript
const CACHE_TTL = {
  STOCK_BR: 300,    // 5 minutos
  STOCK_US: 300,    // 5 minutos
  ETF_BR: 300,      // 5 minutos
  ETF_US: 300,      // 5 minutos
  FII: 300,         // 5 minutos
  BDR: 300,         // 5 minutos
  CRYPTO: 30,       // 30 segundos (alta frequência)
  INDEX: 86400,     // 24 horas (atualizado diariamente)
}
```

**Endpoints REST**:
```
GET /api/market-data/:ticker
  Query: ?assetType=STOCK_BR
  Response: {
    ticker: 'PETR4',
    price: 38.50,
    change: 0.50,
    changePercent: 1.32,
    volume: 45000000,
    date: '2026-03-27T10:30:00Z',
    source: 'BrapiProvider',
    provider: 'BrapiProvider',
  }

GET /api/market-data/search
  Query: ?tickers=PETR4,VALE3,ITUB4&assetType=STOCK_BR
  Response: {
    prices: [
      { ticker: 'PETR4', price: 38.50, ... },
      { ticker: 'VALE3', price: 65.20, ... },
      { ticker: 'ITUB4', price: 32.10, ... },
    ],
  }

GET /api/market-data/indices/:indexName
  Query: ?startDate=2025-01-01&endDate=2026-12-31
  Response: {
    indexName: 'CDI',
    data: [
      { date: '2026-03-27', value: 0.0145 },
      ...
    ],
  }

GET /api/market-data/:ticker/dividends
  Query: ?startDate=2025-01-01&endDate=2026-12-31&includeFuture=true
  Response: {
    ticker: 'PETR4',
    dividends: [
      { type: 'DIVIDEND', value: 1.80, exDate: '2026-03-15', paymentDate: '2026-03-20' },
    ],
  }

DELETE /api/market-data/:ticker/cache
  Query: ?assetType=STOCK_BR
  Response: 204 No Content
```

**Cenários de Teste**:
- Cenário 1: Buscar preço pela primeira vez → API consultada, cache salvo
- Cenário 2: Buscar preço com cache válido → cache hit, sem chamada de API
- Cenário 3: Cache expirado → nova consulta à API
- Cenário 4: Redis indisponível → API consultada diretamente
- Cenário 5: Batch request → otimização com cache parcial
- Cenário 6: Cripto com TTL 30s → cache expira rapidamente
- Cenário 7: Índice econômico → TTL 24h
- Cenário 8: Invalidar cache → próxima requisição busca da API
- Cenário 9: Histórico salvo no MongoDB → dados persistidos
- Cenário 10: Fallback acionado → provider alternativo usado

---

## Mapa de Dependências

```
EP01 (Arquitetura/Redis) ─────────────────────────────────────────┐
                                                                  │
EP13-001 (Arquitetura Providers) ─────────────────────────────────┤
        │                                                         │
        ├──► EP13-002 (BRAPI) ────────────────────────────────────┤
        │                                                         │
        ├──► EP13-003 (Yahoo Finance) ────────────────────────────┤
        │           │                                             │
        │           └──► EP13-004 (Proventos) ──────► EP11 ───────┤
        │                                                         │
        ├──► EP13-005 (BCB) ────────────────────────► EP07 ───────┤
        │                                                         │
        └──► EP13-006 (CoinGecko/Binance) ──────────► EP12 ───────┤
                                                                  │
        EP13-007 (Manager + Cache) ◄──────────────────────────────┘
                │
                ├──► EP14 (Atualização de Dados)
                │
                └──► EP19 (Dashboard)
```

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Rate limit das APIs (BRAPI: 60/min, CoinGecko: 30/min) | Alta | Alto | Cache Redis + batch requests + fallback chain |
| APIs externas indisponíveis ou deprecadas | Média | Crítico | Fallback automático + múltiplos providers |
| Dados inconsistentes entre providers | Média | Alto | Normalização padronizada + validação de dados |
| Latência alta em consultas sequenciais | Média | Médio | Cache Redis + batch requests + paralelismo |
| Custo de APIs pagas (se necessário escalar) | Baixa | Médio | Começar com free tiers + monitorar uso |
| Tickers com formatos diferentes entre APIs | Alta | Médio | Mapeamento centralizado de tickers |
| Cache Redis indisponível | Baixa | Médio | Degeneração graceful (buscar da API) |
| Dados históricos consumindo muito espaço | Média | Baixo | TTL para dados antigos + compressão |
| Rate limit do BCB (API pública) | Baixa | Baixo | Cache 24h + atualização diária |
| Yahoo Finance API não oficial | Média | Alto | Biblioteca yahoo-finance2 + fallback BRAPI |

---

## Checklist de Implementação

### Fase 1: Infraestrutura (EP13-001)
- [ ] Criar estrutura de diretórios
- [ ] Implementar classe abstrata MarketDataProvider
- [ ] Implementar ProviderFactory com fallback chain
- [ ] Criar constantes de providers e asset types
- [ ] Testes unitários da factory

### Fase 2: Providers (EP13-002 a EP13-006)
- [ ] Implementar BrapiProvider
- [ ] Implementar YahooFinanceProvider
- [ ] Implementar BCBProvider
- [ ] Implementar CoinGeckoProvider
- [ ] Implementar BinanceProvider
- [ ] Testes de integração com mocks

### Fase 3: Manager e Cache (EP13-007)
- [ ] Implementar MarketDataManager
- [ ] Implementar MarketDataDAO
- [ ] Criar MarketDataModel
- [ ] Implementar MarketDataRouter
- [ ] Configurar TTLs por asset type
- [ ] Testes de cache e fallback

### Fase 4: Integração
- [ ] Integrar com AppManager
- [ ] Configurar variáveis de ambiente
- [ ] Documentar endpoints no Swagger
- [ ] Testes end-to-end
- [ ] Deploy e monitoramento

---

## Variáveis de Ambiente

```bash
# BRAPI
BRAPI_API_KEY=xxx
BRAPI_BASE_URL=https://brapi.dev/api
BRAPI_TIMEOUT=5000

# Yahoo Finance (sem API key necessária)
YAHOO_FINANCE_TIMEOUT=8000

# CoinGecko
COINGECKO_API_KEY=xxx
COINGECKO_TIMEOUT=10000

# Binance
BINANCE_API_KEY=xxx
BINANCE_API_SECRET=xxx
BINANCE_TIMEOUT=5000

# BCB (sem API key)
BCB_TIMEOUT=10000

# Cache
MARKET_DATA_CACHE_ENABLED=true
MARKET_DATA_CACHE_DEFAULT_TTL=300

# Rate Limits
RATE_LIMIT_BRAPI=60
RATE_LIMIT_YAHOO=2000
RATE_LIMIT_COINGECKO=30
RATE_LIMIT_BINANCE=1200
RATE_LIMIT_BCB=60
```

---

## Métricas de Sucesso

| Métrica | Meta | Como Medir |
|---------|------|------------|
| Disponibilidade de dados | ≥ 99,5% | Logs de erro + monitoramento |
| Latência média | < 500ms | Logs de tempo de resposta |
| Cache hit ratio | ≥ 80% | Métricas Redis |
| Fallback acionado | < 5% das requisições | Logs de provider usado |
| Cobertura de tickers | 500+ BR, 200+ US | Contagem de tickers suportados |
| Erros de rate limit | < 1% | Logs de erro 429 |

# Plano Técnico - EP13: Fontes de Dados de Mercado

> **Épico**: 13 - Fontes de Dados de Mercado (APIs)
> **Versão**: 1.0
> **Data**: 2026-03-27
> **Autor**: @architect

---

## 1. Visão Geral da Arquitetura

### 1.1 Diagrama de Componentes - Provider Factory Pattern

```
+-----------------------------------------------------------------------------------+
|                                    FRONTEND (PWA)                                 |
+-----------------------------------------------------------------------------------+
|  +----------------+  +----------------+  +----------------+  +----------------+   |
|  | TickerSearch   |  | QuoteCard      |  | DividendList   |  | IndexDisplay   |   |
|  | (Busca ativos) |  | (Preço atual)  |  | (Proventos)    |  | (CDI/IPCA)     |   |
|  +-------+--------+  +-------+--------+  +-------+--------+  +-------+--------+   |
|          |                 |                   |                   |              |
|          +-----------------+-------------------+-------------------+              |
|                            |                                                   |
|                 +----------v----------+                                        |
|                 |  useMarketData      |                                        |
|                 |  (Composable)       |                                        |
|                 +----------+----------+                                        |
|                            |                                                   |
|                 +----------v----------+                                        |
|                 |  Store (Pinia)      |                                        |
|                 |  - quotes           |                                        |
|                 |  - dividends        |                                        |
|                 |  - indices          |                                        |
|                 +----------+----------+                                        |
+----------------------------+---------------------------------------------------+
                             | HTTP/REST
                             v
+-----------------------------------------------------------------------------------+
|                                    BACKEND (Node.js)                              |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  +-----------------------------------------------------------------------------+ |
|  |                              ROUTER LAYER                                   | |
|  |  MarketDataRouter                                                           | |
|  |  - GET  /v1/market-data/:ticker                                            | |
|  |  - GET  /v1/market-data/search?tickers=...                                 | |
|  |  - GET  /v1/market-data/:ticker/dividends                                  | |
|  |  - GET  /v1/market-data/indices/:indexName                                 | |
|  |  - DEL  /v1/market-data/:ticker/cache                                      | |
|  +-------------------------------------+---------------------------------------+ |
|                                        |                                          |
|  +-------------------------------------v---------------------------------------+ |
|  |                              MANAGER LAYER                                  | |
|  |  MarketDataManager                                                          | |
|  |  - getPrice(ticker, assetType)         -> Cache-aside pattern              | |
|  |  - getBatchPrices(tickers, assetType) -> Batch optimization               | |
|  |  - getDividends(ticker, options)      -> Provider delegation              | |
|  |  - getIndex(indexName)                -> BCB specific                      | |
|  +--------------------------+---------------------------+--------------------+ |
|                             |                           |                       |
|  +--------------------------v--------------------------+v--------------------+ |
|  |                         CACHE LAYER                                    | |
|  |  Redis (market-data:{assetType}:{ticker})                             | |
|  |  TTLs: STOCK=5min, CRYPTO=30s, INDEX=24h                               | |
|  +--------------------------+---------------------------+--------------------+ |
|                             |                           |                       |
|  +--------------------------v---------------------------+--------------------+ |
|  |                      PROVIDER FACTORY                                  | |
|  |  ProviderFactory                                                        | |
|  |  - fetchWithFallback(ticker, assetType)                               | |
|  |  - fetchBatchWithFallback(tickers, assetType)                         | |
|  |  - getProviderChain(assetType) -> [Provider1, Provider2, ...]         | |
|  +--------------------------+---------------------------+--------------------+ |
|                             |                           |                       |
|     +-----------------------+-----+-----+-----+-----+---+-----+               |
|     |                       |     |     |     |   |         |               |
|  +--v---+  +--v---+  +--v---+  +--v---+  +--v---+  +--v---+  +--v---+       |
|  | BRAPI|  | YAHOO|  |COINGECKO| |BINANCE|  | BCB |  |FUTURE|       |
|  |      |  |FINANCE|  |        | |       |  |     |  |PROVID|       |
|  +--+---+  +--+---+  +--+-----+  +--+----+  +--+--+  +--+---+       |
|     |         |         |           |          |         |            |
|  +--v---+  +--v---+  +--v-----+  +-v-----+  +-v-----+  +-v-----+     |
|  | API  |  | API  |  |  API   |  | API   |  | API   |  | API   |     |
|  |BRAPI |  | YAHOO|  |COINGECKO| |BINANCE|  |  BCB  |  | ALPHA |     |
|  +------+  +------+  +--------+  +-------+  +-------+  +-------+     |
|                                                                       |
+-----------------------------------------------------------------------+
                             |
                             v
+-----------------------------------------------------------------------------------+
|                                    DATA LAYER                                     |
+-----------------------------------------------------------------------------------+
|  +-----------------------------+     +-----------------------------------------+   |
|  |        MongoDB              |     |          Redis                          |   |
|  |  Collection: marketData     |     |  Keys: market-data:{type}:{ticker}      |   |
|  |  - _id (UUID)               |     |  TTL: 30s - 24h (por tipo)              |   |
|  |  - ticker, price, change    |     +-----------------------------------------+   |
|  |  - volume, date, source     |                                                 |
|  |  - assetType, domain        |                                                 |
|  |  Index: {ticker, date}      |                                                 |
|  +-----------------------------+                                                 |
+-----------------------------------------------------------------------------------+
```

### 1.2 Fluxo de Dados - Fallback Chain Pattern

```
+---------+     1. Request      +------------------+
| Client  | -------------------->| MarketData       |
|         |     GET /ticker     | Manager          |
+---------+                      +--------+--------+
                                          |
                          2. Check Cache   |
                                 +----------v----------+
                                 |      Redis          |
                                 |  Cache Hit?         |
                                 +----------+----------+
                                          |
                      +-------------------+-------------------+
                      | Cache HIT         |                   | Cache MISS
                      v                   |                   v
             +----------------+            |          +----------------+
             | Return cached |            |          | ProviderFactory|
             | value (<50ms) |            |          | .fetchWithFall |
             +----------------+            |          | back()         |
                      |                   |          +--------+-------+
                      |                   |                   |
                      |                   |          +--------v-------+
                      |                   |          | Provider Chain |
                      |                   |          | [BRAPI, YAHOO] |
                      |                   |          +--------+-------+
                      |                   |                   |
                      |                   |          +--------v-------+
                      |                   |          | Try BRAPI     |
                      |                   |          | (Primary)     |
                      |                   |          +--------+-------+
                      |                   |                   |
                      |                   |          +--------v-------+
                      |                   |          | Success?      |
                      |                   |          +--+----+---+---+
                      |                   |             |    |   |
                      |                   |        YES  |    |   | NO (Error/Timeout)
                      |                   |             |    |   |
                      |                   |      +------v    |   v
                      |                   |      |           | +--------+
                      |                   |      |           | | Try    |
                      |                   |      |           | | YAHOO  |
                      |                   |      |           | |(Fallback)|
                      |                   |      |           | +----+---+
                      |                   |      |           |      |
                      |                   |      |           |  +---v---+
                      |                   |      |           |  |Success?|
                      |                   |      |           |  +---+---+
                      |                   |      |           |      |
                      |                   |      |           |  YES |   NO
                      |                   |      |           |      |   |
                      |                   |      +-----------+      |   v
                      |                   |      |                  | +--------+
                      |                   |      |                  | | Error  |
                      |                   |      |                  | | 503    |
                      |                   |      |                  | +--------+
                      |                   |      |                  |
                      |                   |      v                  v
                      |                   |  +--------------------------+
                      |                   |  | Normalize Response       |
                      |                   |  | - ticker, price, change  |
                      |                   |  | - volume, date, source   |
                      |                   |  +------------+-------------+
                      |                   |               |
                      |                   |      +--------v--------+
                      |                   |      | Save to Cache   |
                      |                   |      | (TTL by type)   |
                      |                   |      +--------+--------+
                      |                   |               |
                      |                   |      +--------v--------+
                      |                   |      | Save to MongoDB |
                      |                   |      | (History)       |
                      |                   |      +--------+--------+
                      |                   |               |
                      +-------------------+---------------+
                                          |
                                 5. Return to Client
                                          |
                                 +--------v--------+
                                 |     Client      |
                                 | Response <200ms |
                                 +-----------------+
```

### 1.3 Provider Priority Matrix

```
+------------------+-------------------+-------------------+-------------------+
|    Asset Type    |   Primary (P1)    |   Fallback (P2)   |   Fallback (P3)   |
+------------------+-------------------+-------------------+-------------------+
| STOCK_BR         | BRAPI             | YAHOO FINANCE     | -                 |
| STOCK_US         | YAHOO FINANCE     | -                 | -                 |
| ETF_BR           | BRAPI             | YAHOO FINANCE     | -                 |
| ETF_US           | YAHOO FINANCE     | -                 | -                 |
| FII              | BRAPI             | YAHOO FINANCE     | -                 |
| BDR              | BRAPI             | YAHOO FINANCE     | -                 |
| CRYPTO           | COINGECKO         | BINANCE           | -                 |
| INDEX (CDI,etc)  | BCB               | -                 | -                 |
+------------------+-------------------+-------------------+-------------------+
```

---

## 2. Componentes Backend

### 2.1 Provider Interface (Abstract Class)

#### `src/app/market-data/providers/market-data-provider.js`

```javascript
/**
 * @abstract
 * Interface comum para todos os providers de dados de mercado
 * Implementa o padrão Strategy para permitir troca de fontes
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
   * Implementa throttling para respeitar limites da API
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
   * Cada provider pode sobrescrever para adaptar sua resposta
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

### 2.2 Concrete Providers

#### `src/app/market-data/providers/brapi-provider.js`

```javascript
const axios = require('axios')
const MarketDataProvider = require('./market-data-provider')
const { 
  PROVIDER_NAMES, 
  ASSET_TYPES, 
  PROVIDER_PRIORITIES, 
  RATE_LIMITS, 
  TIMEOUTS, 
  ProviderError 
} = require('../constants/provider-constants')

/**
 * Provider para API BRAPI (https://brapi.dev)
 * Fonte primária para ativos brasileiros (B3)
 * Suporta: ações, FIIs, ETFs, BDRs
 */
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

#### `src/app/market-data/providers/yahoo-finance-provider.js`

```javascript
const yahooFinance = require('yahoo-finance2').default
const MarketDataProvider = require('./market-data-provider')
const { 
  PROVIDER_NAMES, 
  ASSET_TYPES, 
  PROVIDER_PRIORITIES, 
  RATE_LIMITS, 
  TIMEOUTS, 
  ProviderError 
} = require('../constants/provider-constants')

/**
 * Provider para Yahoo Finance API
 * Fonte primária para ativos internacionais
 * Fallback para ativos brasileiros
 */
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
   * Ex: PETR4 -> PETR4.SA
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
   * Ex: PETR4.SA -> PETR4
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

#### `src/app/market-data/providers/coingecko-provider.js`

```javascript
const axios = require('axios')
const MarketDataProvider = require('./market-data-provider')
const { 
  PROVIDER_NAMES, 
  ASSET_TYPES, 
  PROVIDER_PRIORITIES, 
  RATE_LIMITS, 
  TIMEOUTS, 
  ProviderError 
} = require('../constants/provider-constants')

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

/**
 * Provider para CoinGecko API
 * Fonte primária para criptomoedas
 */
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
  }

  supportsAssetType(assetType) {
    return this.supportedTypes.includes(assetType)
  }

  getPriority(assetType) {
    return PROVIDER_PRIORITIES[assetType]?.[PROVIDER_NAMES.COINGECKO] || 999
  }

  tickerToId(ticker) {
    return this.idMap[ticker.toUpperCase()] || ticker.toLowerCase()
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
      throw new ProviderError(this.name, ticker, error.message, error.response?.status || 500)
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
        const ticker = Object.keys(this.idMap).find(k => this.idMap[k] === coinId) || coinId.toUpperCase()
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
      throw new ProviderError(this.name, tickers.join(','), error.message, error.response?.status || 500)
    }
  }
}

module.exports = CoinGeckoProvider
```

#### `src/app/market-data/providers/binance-provider.js`

```javascript
const axios = require('axios')
const MarketDataProvider = require('./market-data-provider')
const { 
  PROVIDER_NAMES, 
  ASSET_TYPES, 
  PROVIDER_PRIORITIES, 
  RATE_LIMITS, 
  TIMEOUTS, 
  ProviderError 
} = require('../constants/provider-constants')

/**
 * Provider para Binance API
 * Fallback para criptomoedas
 */
class BinanceProvider extends MarketDataProvider {
  constructor(config = {}) {
    super({
      baseUrl: config.baseUrl || 'https://api.binance.com/api/v3',
      timeout: config.timeout || TIMEOUTS[PROVIDER_NAMES.BINANCE],
      rateLimitPerMinute: config.rateLimitPerMinute || RATE_LIMITS[PROVIDER_NAMES.BINANCE],
    })
    this.supportedTypes = [ASSET_TYPES.CRYPTO]
  }

  supportsAssetType(assetType) {
    return this.supportedTypes.includes(assetType)
  }

  getPriority(assetType) {
    return PROVIDER_PRIORITIES[assetType]?.[PROVIDER_NAMES.BINANCE] || 999
  }

  tickerToSymbol(ticker) {
    return `${ticker.toUpperCase()}USDT`
  }

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
        volume: parseFloat(data.volume) * priceUSD,
        date: new Date(),
        assetType,
      })
    } catch (error) {
      if (error instanceof ProviderError) throw error
      throw new ProviderError(this.name, ticker, error.message, error.response?.status || 500)
    }
  }

  async getUSDBRLRate() {
    try {
      const response = await axios.get(`${this.baseUrl}/ticker/price`, {
        params: { symbol: 'USDTBRL' },
        timeout: this.timeout,
      })
      return parseFloat(response.data.price)
    } catch (error) {
      return 5.15 // Fallback aproximado
    }
  }
}

module.exports = BinanceProvider
```

#### `src/app/market-data/providers/bcb-provider.js`

```javascript
const axios = require('axios')
const MarketDataProvider = require('./market-data-provider')
const { 
  PROVIDER_NAMES, 
  ASSET_TYPES, 
  PROVIDER_PRIORITIES, 
  RATE_LIMITS, 
  TIMEOUTS, 
  ProviderError 
} = require('../constants/provider-constants')

// Códigos das séries no SGS do BCB
const BCB_SERIES = {
  CDI: 12,
  SELIC: 11,
  SELIC_META: 432,
  IPCA: 433,
  IPCA_12M: 13522,
  IGPM: 189,
  TR: 226,
  POUPANCA: 195,
}

/**
 * Provider para API do Banco Central do Brasil
 * Fonte única para índices econômicos
 */
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

  async getIndexHistory(indexName, options = {}) {
    await this.checkRateLimit()
    
    const seriesCode = this.seriesCodes[indexName.toUpperCase()]
    if (!seriesCode) {
      throw new ProviderError(this.name, indexName, `Índice ${indexName} não suportado`, 400)
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
      throw new ProviderError(this.name, indexName, error.message, error.response?.status || 500)
    }
  }

  async getLatestIndex(indexName) {
    await this.checkRateLimit()
    
    const seriesCode = this.seriesCodes[indexName.toUpperCase()]
    if (!seriesCode) {
      throw new ProviderError(this.name, indexName, `Índice ${indexName} não suportado`, 400)
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}.${seriesCode}/dados/ultimos/1`,
        { timeout: this.timeout }
      )

      const item = response.data?.[0]
      if (!item) {
        throw new ProviderError(this.name, indexName, 'Dados não disponíveis', 404)
      }

      return {
        date: this.parseDate(item.data),
        value: parseFloat(item.valor),
        indexName,
        source: this.name,
      }
    } catch (error) {
      if (error instanceof ProviderError) throw error
      throw new ProviderError(this.name, indexName, error.message, error.response?.status || 500)
    }
  }

  formatDate(date) {
    const d = new Date(date)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  }

  parseDate(dateStr) {
    const [day, month, year] = dateStr.split('/')
    return new Date(`${year}-${month}-${day}`)
  }

  getDefaultStartDate(indexName) {
    const now = new Date()
    switch (indexName.toUpperCase()) {
      case 'CDI':
      case 'SELIC':
        return new Date(now.setFullYear(now.getFullYear() - 5))
      case 'IPCA':
        return new Date(now.setFullYear(now.getFullYear() - 10))
      default:
        return new Date(now.setFullYear(now.getFullYear() - 1))
    }
  }
}

module.exports = { BCBProvider, BCB_SERIES }
```

### 2.3 Provider Factory

#### `src/app/market-data/providers/provider-factory.js`

```javascript
const BrapiProvider = require('./brapi-provider')
const YahooFinanceProvider = require('./yahoo-finance-provider')
const CoinGeckoProvider = require('./coingecko-provider')
const BinanceProvider = require('./binance-provider')
const { BCBProvider } = require('./bcb-provider')
const { ASSET_TYPES, PROVIDER_PRIORITIES } = require('../constants/provider-constants')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../../app-constants')
const { Exception } = require('interact-utils')

const logger = new JsonLog(SERVICE_NAME)

/**
 * Factory para criação e gerenciamento de providers
 * Implementa o padrão Factory Method com Fallback Chain
 */
class ProviderFactory {
  constructor(config = {}) {
    this.providers = [
      new BrapiProvider(config.brapi),
      new YahooFinanceProvider(config.yahoo),
      new CoinGeckoProvider(config.coingecko),
      new BinanceProvider(config.binance),
      new BCBProvider(config.bcb),
    ]
    
    this.fallbackChains = this.buildFallbackChains()
  }

  buildFallbackChains() {
    const chains = {}
    for (const assetType of Object.values(ASSET_TYPES)) {
      chains[assetType] = this.providers
        .filter((p) => p.supportsAssetType(assetType))
        .sort((a, b) => a.getPriority(assetType) - b.getPriority(assetType))
    }
    return chains
  }

  getProviderChain(assetType) {
    return this.fallbackChains[assetType] || []
  }

  async fetchWithFallback(ticker, assetType) {
    const chain = this.getProviderChain(assetType)
    const errors = []

    if (chain.length === 0) {
      throw new Exception(400, `Nenhum provider disponível para tipo: ${assetType}`)
    }

    for (const provider of chain) {
      try {
        await provider.checkRateLimit()
        const data = await provider.getPrice(ticker, assetType)
        
        logger.log('Provider success', {
          internal: { method: 'fetchWithFallback', filename: 'provider-factory.js' },
          ticker, assetType, provider: provider.name,
        })
        
        return { data, provider: provider.name }
      } catch (error) {
        errors.push({ provider: provider.name, error: error.message })
        logger.warn(`Provider ${provider.name} failed for ${ticker}`, {
          internal: { method: 'fetchWithFallback', filename: 'provider-factory.js' },
          error: error.message, ticker, assetType,
        })
        continue
      }
    }

    throw new Exception(503, `Todas as fontes de dados falharam para ${ticker}`, { errors })
  }

  async fetchBatchWithFallback(tickers, assetType) {
    const chain = this.getProviderChain(assetType)
    const errors = []

    for (const provider of chain) {
      try {
        await provider.checkRateLimit()
        const data = await provider.getBatchPrices(tickers, assetType)
        return { data, provider: provider.name }
      } catch (error) {
        errors.push({ provider: provider.name, error: error.message })
        continue
      }
    }

    throw new Exception(503, `Todas as fontes falharam para batch de ${tickers.length} tickers`, { errors })
  }

  getProviderByName(providerName) {
    return this.providers.find((p) => p.name === providerName) || null
  }
}

module.exports = ProviderFactory
```

### 2.4 Constants

#### `src/app/market-data/constants/provider-constants.js`

```javascript
const ASSET_TYPES = {
  STOCK_BR: 'STOCK_BR',
  STOCK_US: 'STOCK_US',
  ETF_BR: 'ETF_BR',
  ETF_US: 'ETF_US',
  FII: 'FII',
  BDR: 'BDR',
  CRYPTO: 'CRYPTO',
  INDEX: 'INDEX',
}

const PROVIDER_NAMES = {
  BRAPI: 'BrapiProvider',
  YAHOO: 'YahooFinanceProvider',
  COINGECKO: 'CoinGeckoProvider',
  BINANCE: 'BinanceProvider',
  BCB: 'BCBProvider',
}

const PROVIDER_PRIORITIES = {
  [ASSET_TYPES.STOCK_BR]: { [PROVIDER_NAMES.BRAPI]: 1, [PROVIDER_NAMES.YAHOO]: 2 },
  [ASSET_TYPES.STOCK_US]: { [PROVIDER_NAMES.YAHOO]: 1 },
  [ASSET_TYPES.ETF_BR]: { [PROVIDER_NAMES.BRAPI]: 1, [PROVIDER_NAMES.YAHOO]: 2 },
  [ASSET_TYPES.ETF_US]: { [PROVIDER_NAMES.YAHOO]: 1 },
  [ASSET_TYPES.FII]: { [PROVIDER_NAMES.BRAPI]: 1, [PROVIDER_NAMES.YAHOO]: 2 },
  [ASSET_TYPES.BDR]: { [PROVIDER_NAMES.BRAPI]: 1, [PROVIDER_NAMES.YAHOO]: 2 },
  [ASSET_TYPES.CRYPTO]: { [PROVIDER_NAMES.COINGECKO]: 1, [PROVIDER_NAMES.BINANCE]: 2 },
  [ASSET_TYPES.INDEX]: { [PROVIDER_NAMES.BCB]: 1 },
}

const RATE_LIMITS = {
  [PROVIDER_NAMES.BRAPI]: 60,
  [PROVIDER_NAMES.YAHOO]: 2000,
  [PROVIDER_NAMES.COINGECKO]: 30,
  [PROVIDER_NAMES.BINANCE]: 1200,
  [PROVIDER_NAMES.BCB]: 60,
}

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

### 2.5 Models

#### `src/app/market-data/market-data-model.js`

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

schema.index({ ticker: 1, date: -1 })
schema.index({ domain: 1, assetType: 1 })
schema.index({ ticker: 1, date: 1, source: 1 }, { unique: true })

module.exports = { schema }
```

### 2.6 DAOs

#### `src/app/market-data/market-data-dao.js`

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
    return await this.objectModel.deleteMany({ date: { $lt: cutoffDate } }).exec()
  }
}

module.exports = MarketDataDAO
```

### 2.7 Manager

#### `src/app/market-data/market-data-manager.js`

```javascript
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app-constants')
const ProviderFactory = require('./providers/provider-factory')
const MarketDataDAO = require('./market-data-dao')
const { ASSET_TYPES } = require('./constants/provider-constants')

const logger = new JsonLog(SERVICE_NAME)

// TTLs por tipo de ativo (segundos)
const CACHE_TTL = {
  [ASSET_TYPES.STOCK_BR]: 300,
  [ASSET_TYPES.STOCK_US]: 300,
  [ASSET_TYPES.ETF_BR]: 300,
  [ASSET_TYPES.ETF_US]: 300,
  [ASSET_TYPES.FII]: 300,
  [ASSET_TYPES.BDR]: 300,
  [ASSET_TYPES.CRYPTO]: 30,
  [ASSET_TYPES.INDEX]: 86400,
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

  async getPrice({ ticker, assetType, domain }) {
    const cacheKey = this.getCacheKey(ticker, assetType)
    
    // 1. Tentar cache
    try {
      const cached = await this.redisClient.get(cacheKey)
      if (cached) {
        logger.log('Cache hit', { domain, internal: { method: 'getPrice' }, ticker, assetType })
        return JSON.parse(cached)
      }
    } catch (cacheError) {
      logger.error('Redis error', cacheError, { domain, internal: { method: 'getPrice' } })
    }

    // 2. Buscar da API
    const { data, provider } = await this.providerFactory.fetchWithFallback(ticker, assetType)
    
    // 3. Salvar no cache
    const ttl = CACHE_TTL[assetType] || 300
    try {
      await this.redisClient.setex(cacheKey, ttl, JSON.stringify({ ...data, provider }))
    } catch (cacheError) {
      logger.error('Failed to save cache', cacheError, { domain, internal: { method: 'getPrice' } })
    }

    // 4. Persistir histórico (async)
    this.saveToHistory(data, domain).catch(() => {})

    return { ...data, provider }
  }

  async getBatchPrices({ tickers, assetType, domain }) {
    const results = []
    const tickersToFetch = []
    
    // Verificar cache
    for (const ticker of tickers) {
      const cacheKey = this.getCacheKey(ticker, assetType)
      try {
        const cached = await this.redisClient.get(cacheKey)
        if (cached) {
          results.push(JSON.parse(cached))
          continue
        }
      } catch (cacheError) {}
      tickersToFetch.push(ticker)
    }

    // Buscar não encontrados
    if (tickersToFetch.length > 0) {
      const { data, provider } = await this.providerFactory.fetchBatchWithFallback(tickersToFetch, assetType)
      const ttl = CACHE_TTL[assetType] || 300
      
      for (const item of data) {
        const cacheKey = this.getCacheKey(item.ticker, assetType)
        try {
          await this.redisClient.setex(cacheKey, ttl, JSON.stringify({ ...item, provider }))
        } catch (cacheError) {}
        this.saveToHistory(item, domain).catch(() => {})
      }
      results.push(...data.map((d) => ({ ...d, provider })))
    }

    return results
  }

  async getIndex({ indexName, domain }) {
    const cacheKey = `index:${indexName}`
    
    try {
      const cached = await this.redisClient.get(cacheKey)
      if (cached) return JSON.parse(cached)
    } catch (cacheError) {}

    const bcbProvider = this.providerFactory.getProviderByName('BCBProvider')
    const data = await bcbProvider.getLatestIndex(indexName)
    
    try {
      await this.redisClient.setex(cacheKey, 86400, JSON.stringify(data))
    } catch (cacheError) {}

    return data
  }

  async invalidateCache(ticker, assetType) {
    const cacheKey = this.getCacheKey(ticker, assetType)
    try {
      await this.redisClient.del(cacheKey)
    } catch (error) {}
  }

  getCacheKey(ticker, assetType) {
    return `market-data:${assetType}:${ticker.toUpperCase()}`
  }

  async saveToHistory(data, domain) {
    try {
      await this.marketDataDAO.create({ ...data, domain })
    } catch (error) {
      if (!error.message?.includes('duplicate')) throw error
    }
  }
}

module.exports = MarketDataManager
```

### 2.8 Router

#### `src/app/market-data/market-data-router.js`

```javascript
const express = require('express')
const { Authorizer, Permissions } = require('interact-utils')
const { Exception } = require('interact-utils')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app-constants')

const logger = new JsonLog(SERVICE_NAME)

class MarketDataRouter {
  static handleError(exception, res) {
    logger.error('Market data route error', exception, {
      internal: { method: 'handleError', filename: 'market-data-router.js' },
    })
    res.status(exception.statusCode || 500).send({
      message: exception.message || 'Server Error',
      code: exception.code || 'INTERNAL_ERROR',
    })
  }

  static getPublicRoutes(appManager) {
    const router = express.Router()
    const manager = appManager.getMarketDataManager()

    // GET /v1/market-data/:ticker
    router.get('/:ticker', Authorizer.getMiddleware(Permissions.SERVICES), async (req, res) => {
      try {
        const domain = req.credentials.domain
        const { ticker } = req.params
        const { assetType = 'STOCK_BR' } = req.query
        const data = await manager.getPrice({ ticker, assetType, domain })
        res.status(200).send(data)
      } catch (exception) {
        MarketDataRouter.handleError(exception, res)
      }
    })

    // GET /v1/market-data/search
    router.get('/search', Authorizer.getMiddleware(Permissions.SERVICES), async (req, res) => {
      try {
        const domain = req.credentials.domain
        const { tickers, assetType = 'STOCK_BR' } = req.query
        if (!tickers) throw new Exception(400, 'Parâmetro tickers é obrigatório')
        const tickerList = tickers.split(',').map((t) => t.trim())
        const data = await manager.getBatchPrices({ tickers: tickerList, assetType, domain })
        res.status(200).send({ prices: data })
      } catch (exception) {
        MarketDataRouter.handleError(exception, res)
      }
    })

    // GET /v1/market-data/indices/:indexName
    router.get('/indices/:indexName', Authorizer.getMiddleware(Permissions.SERVICES), async (req, res) => {
      try {
        const domain = req.credentials.domain
        const { indexName } = req.params
        const { startDate, endDate } = req.query
        if (startDate && endDate) {
          const bcbProvider = manager.providerFactory.getProviderByName('BCBProvider')
          const data = await bcbProvider.getIndexHistory(indexName, { startDate, endDate })
          res.status(200).send({ indexName, data })
        } else {
          const data = await manager.getIndex({ indexName, domain })
          res.status(200).send(data)
        }
      } catch (exception) {
        MarketDataRouter.handleError(exception, res)
      }
    })

    // DELETE /v1/market-data/:ticker/cache (admin)
    router.delete('/:ticker/cache', Authorizer.getMiddleware(Permissions.ADMIN), async (req, res) => {
      try {
        const { ticker } = req.params
        const { assetType = 'STOCK_BR' } = req.query
        await manager.invalidateCache(ticker, assetType)
        res.status(204).send()
      } catch (exception) {
        MarketDataRouter.handleError(exception, res)
      }
    })

    return router
  }
}

module.exports = MarketDataRouter
```

---

## 3. Estratégia de Cache

### 3.1 TTLs por Tipo de Ativo

| Tipo de Ativo | TTL Cache | Justificativa |
|---------------|-----------|---------------|
| STOCK_BR | 5 min (300s) | Mercado B3 atualiza em tempo real |
| STOCK_US | 5 min (300s) | Mercado americano alta liquidez |
| ETF_BR | 5 min (300s) | Seguem mercado de ações |
| ETF_US | 5 min (300s) | Seguem mercado internacional |
| FII | 5 min (300s) | Menos voláteis que ações |
| BDR | 5 min (300s) | Dependem do ativo original |
| CRYPTO | 30s | Alta volatilidade, atualização frequente |
| INDEX | 24h (86400s) | Índices econômicos atualizados diariamente |

### 3.2 Estrutura de Chaves Redis

```
market-data:{assetType}:{ticker}
  Ex: market-data:STOCK_BR:PETR4
  Ex: market-data:CRYPTO:BTC
  Ex: market-data:INDEX:CDI

index:{indexName}
  Ex: index:CDI
  Ex: index:IPCA
```

### 3.3 Cache Invalidation

- **Manual**: Endpoint DELETE /:ticker/cache (admin)
- **TTL-based**: Expiração automática por TTL
- **Event-based**: Invalidação após eventos corporativos (EP10)

---

## 4. API Contracts

### 4.1 GET /v1/market-data/:ticker

**Descrição**: Busca preço atual de um ativo

**Query Parameters**:
| Nome | Tipo | Obrigatório | Default | Descrição |
|------|------|-------------|---------|-----------|
| assetType | string | Não | STOCK_BR | Tipo do ativo |

**Response 200**:
```json
{
  "ticker": "PETR4",
  "price": 38.50,
  "change": 0.50,
  "changePercent": 1.32,
  "volume": 45000000,
  "date": "2026-03-27T10:30:00.000Z",
  "source": "BrapiProvider",
  "provider": "BrapiProvider",
  "assetType": "STOCK_BR"
}
```

**Response 503**:
```json
{
  "message": "Todas as fontes de dados falharam para PETR4",
  "code": "INTERNAL_ERROR"
}
```

### 4.2 GET /v1/market-data/search

**Descrição**: Busca preços de múltiplos ativos em batch

**Query Parameters**:
| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| tickers | string | Sim | Lista de tickers separados por vírgula |
| assetType | string | Não | Tipo dos ativos (default: STOCK_BR) |

**Response 200**:
```json
{
  "prices": [
    {
      "ticker": "PETR4",
      "price": 38.50,
      "change": 0.50,
      "changePercent": 1.32,
      "volume": 45000000,
      "date": "2026-03-27T10:30:00.000Z",
      "source": "BrapiProvider",
      "provider": "BrapiProvider"
    },
    {
      "ticker": "VALE3",
      "price": 65.20,
      "change": -0.30,
      "changePercent": -0.46,
      "volume": 32000000,
      "date": "2026-03-27T10:30:00.000Z",
      "source": "BrapiProvider",
      "provider": "BrapiProvider"
    }
  ]
}
```

### 4.3 GET /v1/market-data/indices/:indexName

**Descrição**: Busca índice econômico atual ou histórico

**Query Parameters**:
| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| startDate | string | Não | Data inicial (ISO 8601) |
| endDate | string | Não | Data final (ISO 8601) |

**Response 200 (atual)**:
```json
{
  "date": "2026-03-27T00:00:00.000Z",
  "value": 0.0145,
  "indexName": "CDI",
  "source": "BCBProvider"
}
```

**Response 200 (histórico)**:
```json
{
  "indexName": "CDI",
  "data": [
    { "date": "2026-03-25T00:00:00.000Z", "value": 0.0144, "source": "BCBProvider" },
    { "date": "2026-03-26T00:00:00.000Z", "value": 0.0145, "source": "BCBProvider" },
    { "date": "2026-03-27T00:00:00.000Z", "value": 0.0145, "source": "BCBProvider" }
  ]
}
```

### 4.4 DELETE /v1/market-data/:ticker/cache

**Descrição**: Invalida cache de um ticker (admin)

**Query Parameters**:
| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| assetType | string | Não | Tipo do ativo (default: STOCK_BR) |

**Response 204**: No Content

---

## 5. Estrutura de Arquivos

```
investment-service/src/app/market-data/
├── market-data-router.js           # Rotas HTTP
├── market-data-manager.js          # Orquestração e cache
├── market-data-dao.js              # Persistência MongoDB
├── market-data-model.js            # Schema Mongoose
├── index-data-model.js             # Schema índices econômicos
├── providers/
│   ├── market-data-provider.js     # Classe abstrata (interface)
│   ├── brapi-provider.js           # Implementação BRAPI
│   ├── yahoo-finance-provider.js   # Implementação Yahoo Finance
│   ├── coingecko-provider.js       # Implementação CoinGecko
│   ├── binance-provider.js         # Implementação Binance
│   ├── bcb-provider.js             # Implementação Banco Central
│   └── provider-factory.js         # Factory com fallback chain
└── constants/
    ├── provider-constants.js       # Configurações de providers
    └── asset-type-constants.js     # Tipos de ativo
```

---

## 6. Ordem de Implementação

### Fase 1: Infraestrutura Base (EP13-001)

1. Criar estrutura de diretórios `src/app/market-data/`
2. Implementar `provider-constants.js` com tipos e prioridades
3. Implementar `market-data-provider.js` (classe abstrata)
4. Implementar `provider-factory.js` com fallback chain
5. Criar testes unitários da factory

### Fase 2: Providers (EP13-002 a EP13-006)

1. Implementar `BrapiProvider` (ativos B3)
2. Implementar `YahooFinanceProvider` (internacionais + fallback)
3. Implementar `BCBProvider` (índices econômicos)
4. Implementar `CoinGeckoProvider` (cripto primário)
5. Implementar `BinanceProvider` (cripto fallback)
6. Criar testes de integração com mocks

### Fase 3: Manager e Cache (EP13-007)

1. Implementar `MarketDataModel` e `IndexDataModel`
2. Implementar `MarketDataDAO`
3. Implementar `MarketDataManager` com cache-aside
4. Implementar `MarketDataRouter`
5. Configurar TTLs por asset type
6. Criar testes de cache e fallback

### Fase 4: Integração

1. Integrar com `AppManager`
2. Configurar variáveis de ambiente
3. Documentar endpoints no Swagger
4. Testes end-to-end
5. Deploy e monitoramento

---

## 7. Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|:-------------:|:------:|-----------|
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

## 8. Dependências

### Backend (package.json)

```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "yahoo-finance2": "^2.11.0"
  }
}
```

### Variáveis de Ambiente

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
```

### Dependências de Épicos

| Épico | Dependência |
|-------|-------------|
| EP01 (Arquitetura) | Redis para caching |
| EP04 (Transações) | Tickers a atualizar |
| EP05 (Preço Médio) | Preço atual para valorização |
| EP06 (Câmbio) | Taxa USD/BRL para ativos internacionais |
| EP07 (Renda Fixa) | Índices CDI/IPCA |
| EP10 (Eventos Corporativos) | Fonte de eventos |
| EP11 (Proventos) | Fonte de dividendos |
| EP12 (Criptomoedas) | CoinGecko e Binance |
| EP14 (Atualização de Dados) | Scheduler de atualização |

---

## 9. Checklist de Implementação

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

## 10. Métricas de Sucesso

| Métrica | Meta | Como Medir |
|---------|------|------------|
| Disponibilidade de dados | ≥ 99,5% | Logs de erro + monitoramento |
| Latência média | < 500ms | Logs de tempo de resposta |
| Cache hit ratio | ≥ 80% | Métricas Redis |
| Fallback acionado | < 5% das requisições | Logs de provider usado |
| Cobertura de tickers | 500+ BR, 200+ US | Contagem de tickers suportados |
| Erros de rate limit | < 1% | Logs de erro 429 |

---

*Documento criado pelo Architect - MoneyTrackr V3*

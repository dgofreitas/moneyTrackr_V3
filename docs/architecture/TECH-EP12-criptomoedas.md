# Plano Técnico - EP12 Criptomoedas

## 1. Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React/Vue PWA)                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                 │
│  │ CryptoPage       │  │ CryptoAssetCard │  │ CryptoSparkline │                 │
│  │ - Resumo        │  │ - Preço atual   │  │ - Mini gráfico  │                 │
│  │ - Tabela        │  │ - Variação 24h  │  │ - 7 dias        │                 │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘                 │
│           │                    │                    │                           │
│           └────────────────────┼────────────────────┘                           │
│                                │                                                │
│                    ┌───────────▼───────────┐                                    │
│                    │  useCryptoPrices.js   │                                    │
│                    │  - Polling 30s        │                                    │
│                    │  - WebSocket/SSE      │                                    │
│                    └───────────┬───────────┘                                    │
└────────────────────────────────┼────────────────────────────────────────────────┘
                                 │ HTTP/WebSocket
┌────────────────────────────────┼────────────────────────────────────────────────┐
│                         BACKEND (Node.js/Express)                               │
├────────────────────────────────┼────────────────────────────────────────────────┤
│                    ┌───────────▼───────────┐                                    │
│                    │  crypto-router.js      │                                    │
│                    │  GET /crypto/prices   │                                    │
│                    │  GET /crypto/sparkline │                                    │
│                    │  GET /positions/crypto/valuation                                          │
│                    └───────────┬───────────┘                                    │
│                                │                                                │
│         ┌──────────────────────┼──────────────────────┐                         │
│         │                      │                      │                         │
│  ┌──────▼──────────┐  ┌───────▼────────┐  ┌─────────▼─────────┐                 │
│  │ crypto-price-   │  │ transaction-   │  │ position-manager  │                 │
│  │   scheduler.js  │  │   manager.js   │  │   (extendido)     │                 │
│  │                 │  │ (extendido)    │  │                   │                 │
│  │ 30s interval    │  │ assetType:     │  │ assetType:        │                 │
│  │ CoinGecko/Binance│  │   CRYPTO       │  │   CRYPTO          │                 │
│  └──────┬──────────┘  └───────┬────────┘  └─────────┬─────────┘                 │
│         │                     │                     │                          │
│  ┌──────▼──────────┐          │                     │                          │
│  │ providers/      │          │                     │                          │
│  │ - coingecko    │          │                     │                          │
│  │ - binance      │          │                     │                          │
│  └──────┬──────────┘          │                     │                          │
│         │                     │                     │                          │
└─────────┼─────────────────────┼─────────────────────┼──────────────────────────┘
          │                     │                     │
    ┌─────▼─────┐         ┌─────▼─────┐          ┌─────▼─────┐
    │   Redis   │         │  MongoDB  │          │ APIs Ext. │
    │  Cache    │         │ Position  │          │ CoinGecko │
    │  TTL 60s  │         │ Transaction│         │ Binance   │
    └───────────┘         └───────────┘          └───────────┘
```

## 2. Componentes Backend

### 2.1 Models (Mongoose Schemas)

**Extensão do Transaction Model** (`src/app/transaction/transaction-model.js`)

```javascript
// Adicionar ao schema existente:
const cryptoExtensions = {
  assetType: {
    type: String,
    enum: ['STOCK', 'FII', 'ETF', 'BDR', 'FIXED_INCOME', 'CRYPTO'],
    default: 'STOCK',
    index: true,
  },
  // Para cripto, campos adicionais:
  feeAsset: { type: String },          // moeda da taxa (ex: 'BTC', 'ETH', 'BRL')
  feeInAsset: { type: Number },        // valor da taxa na moeda do ativo
  feeExchangeRate: { type: Number },   // taxa de câmbio usada para converter fee
}

// Índice adicional
schema.index({ walletId: 1, assetType: 1, date: -1 })
```

**Extensão do Position Model** (`src/app/position/position-model.js`)

```javascript
// Adicionar ao schema existente:
const cryptoExtensions = {
  assetType: {
    type: String,
    enum: ['STOCK', 'FII', 'ETF', 'BDR', 'FIXED_INCOME', 'CRYPTO'],
    default: 'STOCK',
    index: true,
  },
  decimalPrecision: { type: Number, default: 2 },  // 8 para cripto, 2 para ações
}

// Índice adicional
schema.index({ walletId: 1, assetType: 1 })
```

**Crypto Price Cache Model** (`src/app/crypto/crypto-price-model.js`)

```javascript
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const schema = new mongoose.Schema({
  _id: { type: String, required: true, default: uuidv4 },
  ticker: { type: String, required: true, index: true },
  priceUSD: { type: Number, required: true },
  priceBRL: { type: Number, required: true },
  change24h: { type: Number, default: 0 },
  volume24h: { type: Number, default: 0 },
  marketCap: { type: Number },
  source: { type: String, required: true },
  updatedAt: { type: Date, required: true, default: Date.now },
}, { versionKey: false })

// Índice para busca rápida
schema.index({ ticker: 1, updatedAt: -1 })

module.exports = { schema }
```

### 2.2 DAOs

**Crypto Price DAO** (`src/app/crypto/crypto-price-dao.js`)

```javascript
const AppDAO = require('../app-dao')
const { schema } = require('./crypto-price-model')

class CryptoPriceDAO extends AppDAO {
  constructor(db) {
    super(db)
  }

  initializeDBModel(db) {
    return db.model('cryptoPrice', schema)
  }

  async upsertPrice(ticker, priceData) {
    return await this.objectModel.findOneAndUpdate(
      { ticker },
      { ...priceData, ticker, updatedAt: new Date() },
      { upsert: true, new: true }
    ).lean().exec()
  }

  async getLatestPrice(ticker) {
    return await this.objectModel.findOne({ ticker })
      .sort({ updatedAt: -1 })
      .lean()
      .exec()
  }

  async getLatestPrices(tickers) {
    return await this.objectModel.find({ ticker: { $in: tickers } })
      .sort({ ticker: 1, updatedAt: -1 })
      .lean()
      .exec()
  }

  async getSparklineData(ticker, days = 7) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    return await this.objectModel.find({
      ticker,
      updatedAt: { $gte: startDate },
    })
      .sort({ updatedAt: 1 })
      .lean()
      .exec()
  }
}

module.exports = CryptoPriceDAO
```

### 2.3 Managers

**Crypto Price Scheduler** (`src/app/crypto/crypto-price-scheduler.js`)

```javascript
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app-constants')
const CoinGeckoProvider = require('./providers/coingecko-provider')
const BinanceProvider = require('./providers/binance-provider')

const logger = new JsonLog(SERVICE_NAME)

class CryptoPriceScheduler {
  constructor(appManager, redisClient) {
    this.appManager = appManager
    this.redisClient = redisClient
    this.interval = parseInt(process.env.CRYPTO_UPDATE_INTERVAL) || 30000 // 30s
    this.providers = [
      new CoinGeckoProvider(),
      new BinanceProvider(),
    ]
    this.timer = null
  }

  async start() {
    logger.log('Crypto price scheduler starting', {
      internal: { method: 'start', filename: 'crypto-price-scheduler.js' },
      interval: this.interval,
    })

    // Executar imediatamente
    await this.updatePrices()

    // Agendar execuções
    this.timer = setInterval(() => this.updatePrices(), this.interval)
  }

  async updatePrices() {
    const tickers = await this.getActiveCryptoTickers()
    
    if (tickers.length === 0) {
      logger.log('No active crypto tickers to update', {
        internal: { method: 'updatePrices', filename: 'crypto-price-scheduler.js' },
      })
      return
    }

    logger.log('Updating crypto prices', {
      internal: { method: 'updatePrices', filename: 'crypto-price-scheduler.js' },
      tickersCount: tickers.length,
    })

    for (const provider of this.providers) {
      try {
        const prices = await provider.getBatchPrices(tickers)
        await this.storePrices(prices)
        await this.publishUpdate(prices)
        return // Sucesso, não tentar próximo provider
      } catch (error) {
        logger.error(`Provider ${provider.name} failed`, error, {
          internal: { method: 'updatePrices', filename: 'crypto-price-scheduler.js' },
          provider: provider.name,
        })
        continue // Tentar fallback
      }
    }

    logger.error('All crypto providers failed', new Error('All providers failed'), {
      internal: { method: 'updatePrices', filename: 'crypto-price-scheduler.js' },
    })
  }

  async getActiveCryptoTickers() {
    const PositionDAO = require('../position/position-dao')
    const positionDAO = new PositionDAO(this.appManager.getDb())
    
    const positions = await positionDAO.findByAssetType('CRYPTO')
    return [...new Set(positions.map(p => p.ticker))]
  }

  async storePrices(prices) {
    const pipeline = this.redisClient.pipeline()
    
    for (const { ticker, priceUSD, priceBRL, change24h, volume24h } of prices) {
      const data = JSON.stringify({
        ticker,
        priceUSD,
        priceBRL,
        change24h,
        volume24h,
        updatedAt: new Date().toISOString(),
      })
      pipeline.set(`crypto:price:${ticker}`, data, 'EX', 60)
    }
    
    await pipeline.exec()

    // Persistir no MongoDB para histórico
    const CryptoPriceDAO = require('./crypto-price-dao')
    const cryptoPriceDAO = new CryptoPriceDAO(this.appManager.getDb())
    
    for (const price of prices) {
      await cryptoPriceDAO.upsertPrice(price.ticker, price)
    }
  }

  async publishUpdate(prices) {
    const event = {
      type: 'CRYPTO_PRICES_UPDATED',
      timestamp: new Date().toISOString(),
      data: prices,
    }
    await this.redisClient.publish('crypto:updates', JSON.stringify(event))
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
      logger.log('Crypto price scheduler stopped', {
        internal: { method: 'stop', filename: 'crypto-price-scheduler.js' },
      })
    }
  }
}

module.exports = CryptoPriceScheduler
```

**Crypto Manager** (`src/app/crypto/crypto-manager.js`)

```javascript
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app-constants')
const CryptoPriceDAO = require('./crypto-price-dao')

const logger = new JsonLog(SERVICE_NAME)

class CryptoManager {
  constructor(appManager, appDB, redisClient) {
    this.appManager = appManager
    this.appDB = appDB
    this.redisClient = redisClient
    this.cryptoPriceDAO = new CryptoPriceDAO(this.appDB.getDb())
  }

  async getPrices(tickers) {
    const prices = []
    
    for (const ticker of tickers) {
      // Tentar cache Redis primeiro
      const cached = await this.redisClient.get(`crypto:price:${ticker}`)
      
      if (cached) {
        prices.push(JSON.parse(cached))
      } else {
        // Fallback para MongoDB
        const dbPrice = await this.cryptoPriceDAO.getLatestPrice(ticker)
        if (dbPrice) {
          prices.push(dbPrice)
        }
      }
    }
    
    return prices
  }

  async getSparklineData(ticker, days = 7) {
    return await this.cryptoPriceDAO.getSparklineData(ticker, days)
  }

  async getCryptoValuation(walletId) {
    const PositionDAO = require('../position/position-dao')
    const positionDAO = new PositionDAO(this.appDB.getDb())
    
    const positions = await positionDAO.findByWalletAndAssetType(walletId, 'CRYPTO')
    
    if (positions.length === 0) {
      return {
        totalValueBRL: 0,
        totalCostBRL: 0,
        totalGainBRL: 0,
        totalGainPercent: 0,
        positions: [],
      }
    }

    // Buscar preços atuais
    const tickers = positions.map(p => p.ticker)
    const prices = await this.getPrices(tickers)
    const priceMap = new Map(prices.map(p => [p.ticker, p]))

    let totalValueBRL = 0
    let totalCostBRL = 0

    const positionsWithValuation = await Promise.all(positions.map(async (pos) => {
      const price = priceMap.get(pos.ticker) || { priceBRL: 0, change24h: 0 }
      const currentValue = pos.quantity * price.priceBRL
      const cost = pos.quantity * pos.avgPrice
      const gainBRL = currentValue - cost
      const gainPercent = cost > 0 ? ((currentValue - cost) / cost) * 100 : 0

      totalValueBRL += currentValue
      totalCostBRL += cost

      // Buscar sparkline data
      const sparklineData = await this.getSparklineData(pos.ticker, 7)

      return {
        ticker: pos.ticker,
        quantity: pos.quantity,
        avgPrice: pos.avgPrice,
        currentPrice: price.priceBRL,
        currentValue,
        cost,
        gainBRL,
        gainPercent,
        change24h: price.change24h || 0,
        sparklineData: sparklineData.map(s => s.priceBRL),
      }
    }))

    return {
      totalValueBRL,
      totalCostBRL,
      totalGainBRL: totalValueBRL - totalCostBRL,
      totalGainPercent: totalCostBRL > 0 
        ? ((totalValueBRL - totalCostBRL) / totalCostBRL) * 100 
        : 0,
      positions: positionsWithValuation,
    }
  }
}

module.exports = CryptoManager
```

### 2.4 Providers

**Base Provider** (`src/app/crypto/providers/base-provider.js`)

```javascript
class BaseCryptoProvider {
  constructor(config = {}) {
    this.name = this.constructor.name
    this.baseUrl = config.baseUrl
    this.apiKey = config.apiKey
    this.timeout = config.timeout || 10000
  }

  async getPrice(ticker) {
    throw new Error('Method not implemented')
  }

  async getBatchPrices(tickers) {
    throw new Error('Method not implemented')
  }

  normalizeResponse(data) {
    return {
      ticker: data.ticker || data.symbol,
      priceUSD: data.priceUSD || data.usd,
      priceBRL: data.priceBRL || data.brl,
      change24h: data.change24h || data.usd_24h_change || 0,
      volume24h: data.volume24h || data.usd_24h_vol || 0,
      source: this.name,
    }
  }
}

module.exports = BaseCryptoProvider
```

**CoinGecko Provider** (`src/app/crypto/providers/coingecko-provider.js`)

```javascript
const axios = require('axios')
const BaseCryptoProvider = require('./base-provider')

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
  USDT: 'tether',
  USDC: 'usd-coin',
}

class CoinGeckoProvider extends BaseCryptoProvider {
  constructor(config = {}) {
    super({
      baseUrl: config.baseUrl || 'https://api.coingecko.com/api/v3',
      apiKey: config.apiKey || process.env.COINGECKO_API_KEY,
      ...config,
    })
    this.idMap = COINGECKO_ID_MAP
    this.reverseIdMap = Object.fromEntries(
      Object.entries(COINGECKO_ID_MAP).map(([k, v]) => [v, k])
    )
  }

  tickerToId(ticker) {
    return this.idMap[ticker.toUpperCase()] || ticker.toLowerCase()
  }

  idToTicker(id) {
    return this.reverseIdMap[id] || id.toUpperCase()
  }

  async getPrice(ticker) {
    const coinId = this.tickerToId(ticker)
    
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
      throw new Error(`Crypto ${ticker} not found`)
    }

    return this.normalizeResponse({
      ticker: ticker.toUpperCase(),
      priceUSD: data.usd,
      priceBRL: data.brl,
      change24h: data.usd_24h_change,
      volume24h: data.usd_24h_vol,
    })
  }

  async getBatchPrices(tickers) {
    const coinIds = tickers.map(t => this.tickerToId(t)).join(',')
    
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
    for (const ticker of tickers) {
      const coinId = this.tickerToId(ticker)
      const data = response.data[coinId]
      
      if (data) {
        results.push(this.normalizeResponse({
          ticker: ticker.toUpperCase(),
          priceUSD: data.usd,
          priceBRL: data.brl,
          change24h: data.usd_24h_change,
          volume24h: data.usd_24h_vol,
        }))
      }
    }

    return results
  }
}

module.exports = CoinGeckoProvider
```

**Binance Provider** (`src/app/crypto/providers/binance-provider.js`)

```javascript
const axios = require('axios')
const BaseCryptoProvider = require('./base-provider')

const BINANCE_SYMBOL_MAP = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  SOL: 'SOLUSDT',
  BNB: 'BNBUSDT',
  XRP: 'XRPUSDT',
  ADA: 'ADAUSDT',
  DOGE: 'DOGEUSDT',
  DOT: 'DOTUSDT',
  MATIC: 'MATICUSDT',
  SHIB: 'SHIBUSDT',
  AVAX: 'AVAXUSDT',
  LINK: 'LINKUSDT',
  UNI: 'UNIUSDT',
  ATOM: 'ATOMUSDT',
  LTC: 'LTCUSDT',
}

class BinanceProvider extends BaseCryptoProvider {
  constructor(config = {}) {
    super({
      baseUrl: config.baseUrl || 'https://api.binance.com/api/v3',
      ...config,
    })
    this.symbolMap = BINANCE_SYMBOL_MAP
  }

  tickerToSymbol(ticker) {
    return this.symbolMap[ticker.toUpperCase()] || `${ticker.toUpperCase()}USDT`
  }

  async getPrice(ticker) {
    const symbol = this.tickerToSymbol(ticker)
    
    const [priceResponse, tickerResponse] = await Promise.all([
      axios.get(`${this.baseUrl}/ticker/price`, {
        params: { symbol },
        timeout: this.timeout,
      }),
      axios.get(`${this.baseUrl}/ticker/24hr`, {
        params: { symbol },
        timeout: this.timeout,
      }),
    ])

    const priceUSD = parseFloat(priceResponse.data.price)
    const change24h = parseFloat(tickerResponse.data.priceChangePercent)

    // Converter para BRL usando taxa de câmbio
    const exchangeRate = await this.getUSDBRLRate()
    const priceBRL = priceUSD * exchangeRate

    return this.normalizeResponse({
      ticker: ticker.toUpperCase(),
      priceUSD,
      priceBRL,
      change24h,
      volume24h: parseFloat(tickerResponse.data.volume),
    })
  }

  async getBatchPrices(tickers) {
    const symbols = tickers.map(t => `"${this.tickerToSymbol(t)}"`).join(',')
    
    const response = await axios.get(`${this.baseUrl}/ticker/price`, {
      params: { symbols: `[${symbols}]` },
      timeout: this.timeout,
    })

    const exchangeRate = await this.getUSDBRLRate()
    
    return response.data.map(item => {
      const symbol = item.symbol
      const ticker = symbol.replace('USDT', '')
      const priceUSD = parseFloat(item.price)
      
      return this.normalizeResponse({
        ticker,
        priceUSD,
        priceBRL: priceUSD * exchangeRate,
        change24h: 0, // Binance batch não retorna variação
        volume24h: 0,
      })
    })
  }

  async getUSDBRLRate() {
    // Buscar taxa USD/BRL do cache ou API
    const cached = await this.getCachedExchangeRate()
    if (cached) return cached

    // Fallback: buscar de API de câmbio
    const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD')
    return response.data.rates.BRL
  }

  async getCachedExchangeRate() {
    // Implementar cache Redis
    return null
  }
}

module.exports = BinanceProvider
```

### 2.5 Routers

**Arquivo:** `src/app/crypto/crypto-router.js`

```javascript
const express = require('express')
const { Authorizer } = require('interact-utils')
const { Permissions } = require('../app-constants')

class CryptoRouter {
  static handleError(exception, res) {
    res.status(exception.statusCode || 500).send(exception.message || 'Server Error')
  }

  static getRoutes(appManager) {
    const router = express.Router()
    const manager = appManager.getCryptoManager()

    // GET /api/crypto/prices - Preços atuais
    router.get('/crypto/prices', Authorizer.getMiddleware(Permissions.USER), async (req, res) => {
      try {
        const { tickers } = req.query
        const tickerList = tickers ? tickers.split(',') : []
        
        const prices = await manager.getPrices(tickerList)
        
        res.status(200).json({
          prices,
          source: 'CACHE',
          cachedAt: new Date().toISOString(),
        })
      } catch (exception) {
        CryptoRouter.handleError(exception, res)
      }
    })

    // GET /api/crypto/sparkline/:ticker - Dados para sparkline
    router.get('/crypto/sparkline/:ticker', Authorizer.getMiddleware(Permissions.USER), async (req, res) => {
      try {
        const { ticker } = req.params
        const { days = 7 } = req.query
        
        const data = await manager.getSparklineData(ticker.toUpperCase(), parseInt(days))
        
        res.status(200).json({
          ticker: ticker.toUpperCase(),
          prices: data.map(d => ({
            date: d.updatedAt,
            price: d.priceBRL,
          })),
        })
      } catch (exception) {
        CryptoRouter.handleError(exception, res)
      }
    })

    // GET /api/positions/crypto/valuation - Valorização de cripto
    router.get('/positions/crypto/valuation', Authorizer.getMiddleware(Permissions.USER), async (req, res) => {
      try {
        const { walletId } = req.query
        
        const valuation = await manager.getCryptoValuation(walletId)
        
        res.status(200).json(valuation)
      } catch (exception) {
        CryptoRouter.handleError(exception, res)
      }
    })

    return router
  }
}

module.exports = CryptoRouter
```

## 3. Componentes Frontend

### 3.1 Pages

**Arquivo:** `src/pages/crypto/CryptoPage.jsx`

```jsx
import React, { useState, useEffect } from 'react'
import styled from 'styled-components'
import CryptoPortfolioSummary from '../components/CryptoPortfolioSummary'
import CryptoAssetCard from '../components/CryptoAssetCard'
import CryptoAssetTable from '../components/CryptoAssetTable'
import { useCryptoPrices } from '../hooks/useCryptoPrices'
import { useCryptoValuation } from '../hooks/useCryptoValuation'

const Container = styled.div`
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
`

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`

const Title = styled.h1`
  font-size: 28px;
  font-weight: 600;
  color: #1f2937;
`

const LiveIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(168, 85, 247, 0.1);
  border-radius: 20px;
  color: #a855f7;
  font-size: 14px;
  font-weight: 600;
`

const PulseDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #a855f7;
  animation: pulse 2s ease-in-out infinite;

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`

const CardsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`

const CryptoPage = ({ walletId }) => {
  const { valuation, loading: valuationLoading } = useCryptoValuation(walletId)
  const tickers = valuation?.positions?.map(p => p.ticker) || []
  const { prices, loading: pricesLoading } = useCryptoPrices(tickers)

  return (
    <Container>
      <Header>
        <Title>Criptomoedas</Title>
        <LiveIndicator>
          <PulseDot />
          24/7
        </LiveIndicator>
      </Header>

      <CryptoPortfolioSummary
        valuation={valuation}
        loading={valuationLoading}
      />

      <CardsGrid>
        {valuation?.positions?.map(position => (
          <CryptoAssetCard
            key={position.ticker}
            position={position}
            price={prices.find(p => p.ticker === position.ticker)}
            loading={pricesLoading}
          />
        ))}
      </CardsGrid>

      <CryptoAssetTable
        positions={valuation?.positions || []}
        prices={prices}
        loading={valuationLoading || pricesLoading}
      />
    </Container>
  )
}

export default CryptoPage
```

### 3.2 Components

**Arquivo:** `src/pages/crypto/components/CryptoAssetCard.jsx`

```jsx
import React from 'react'
import styled from 'styled-components'
import CryptoSparkline from './CryptoSparkline'
import CryptoPriceIndicator from './CryptoPriceIndicator'

const Card = styled.div`
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  }
`

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
`

const Ticker = styled.div`
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
`

const PriceIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  
  ${({ positive }) => positive ? `
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  ` : `
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  `}
`

const PriceRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
`

const Label = styled.span`
  font-size: 12px;
  color: #6b7280;
`

const Value = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
`

const formatCurrency = (value, decimals = 2) => {
  if (value < 0.01 && value > 0) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 6,
      maximumFractionDigits: 8,
    }).format(value)
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value || 0)
}

const formatQuantity = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(value || 0)
}

const CryptoAssetCard = ({ position, price, loading }) => {
  if (loading) {
    return (
      <Card>
        <div style={{ height: 200 }}>Carregando...</div>
      </Card>
    )
  }

  const gainPercent = position.gainPercent || 0
  const change24h = position.change24h || 0

  return (
    <Card>
      <CardHeader>
        <Ticker>{position.ticker}</Ticker>
        <PriceIndicator positive={change24h >= 0}>
          {change24h >= 0 ? '↑' : '↓'} {Math.abs(change24h).toFixed(2)}%
        </PriceIndicator>
      </CardHeader>

      <CryptoSparkline
        data={position.sparklineData || []}
        positive={gainPercent >= 0}
      />

      <PriceRow>
        <Label>Preço Atual</Label>
        <Value>{formatCurrency(position.currentPrice)}</Value>
      </PriceRow>

      <PriceRow>
        <Label>Quantidade</Label>
        <Value>{formatQuantity(position.quantity)}</Value>
      </PriceRow>

      <PriceRow>
        <Label>Valor Total</Label>
        <Value>{formatCurrency(position.currentValue)}</Value>
      </PriceRow>

      <PriceRow>
        <Label>Ganho/Perda</Label>
        <Value style={{ color: gainPercent >= 0 ? '#22c55e' : '#ef4444' }}>
          {gainPercent >= 0 ? '+' : ''}{formatCurrency(position.gainBRL)} ({gainPercent.toFixed(2)}%)
        </Value>
      </PriceRow>
    </Card>
  )
}

export default CryptoAssetCard
```

**Arquivo:** `src/pages/crypto/components/CryptoSparkline.jsx`

```jsx
import React from 'react'
import styled from 'styled-components'

const SparklineContainer = styled.div`
  width: 100%;
  height: 40px;
  margin: 12px 0;
`

const SparklineSVG = styled.svg`
  width: 100%;
  height: 100%;
`

const SparklinePath = styled.path`
  fill: none;
  stroke: ${({ positive }) => positive ? '#22c55e' : '#ef4444'};
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
`

const SparklineArea = styled.path`
  fill: ${({ positive }) => positive 
    ? 'rgba(34, 197, 94, 0.1)' 
    : 'rgba(239, 68, 68, 0.1)'};
`

const CryptoSparkline = ({ data, positive = true }) => {
  if (!data || data.length < 2) {
    return <SparklineContainer />
  }

  const width = 200
  const height = 40
  const padding = 2

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - 2 * padding)
    const y = height - padding - ((value - min) / range) * (height - 2 * padding)
    return `${x},${y}`
  })

  const pathD = `M ${points.join(' L ')}`
  const areaD = `${pathD} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`

  return (
    <SparklineContainer>
      <SparklineSVG viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <SparklineArea d={areaD} positive={positive} />
        <SparklinePath d={pathD} positive={positive} />
      </SparklineSVG>
    </SparklineContainer>
  )
}

export default CryptoSparkline
```

### 3.3 Hooks

**Arquivo:** `src/pages/crypto/hooks/useCryptoPrices.js`

```javascript
import { useState, useEffect, useRef } from 'react'
import cryptoService from '../services/cryptoService'

const useCryptoPrices = (tickers, interval = 30000) => {
  const [prices, setPrices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const timerRef = useRef(null)

  const fetchPrices = async () => {
    if (!tickers || tickers.length === 0) {
      setPrices([])
      setLoading(false)
      return
    }

    try {
      const response = await cryptoService.getPrices(tickers)
      setPrices(response.prices)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPrices()

    if (interval > 0) {
      timerRef.current = setInterval(fetchPrices, interval)
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [tickers.join(','), interval])

  return { prices, loading, error, refetch: fetchPrices }
}

export default useCryptoPrices
```

**Arquivo:** `src/pages/crypto/hooks/useCryptoValuation.js`

```javascript
import { useQuery } from 'react-query'
import cryptoService from '../services/cryptoService'

const useCryptoValuation = (walletId) => {
  const { data, isLoading, error, refetch } = useQuery(
    ['cryptoValuation', walletId],
    () => cryptoService.getValuation(walletId),
    {
      staleTime: 30000,
      refetchInterval: 60000, // Atualizar a cada 1 min
    }
  )

  return {
    valuation: data,
    loading: isLoading,
    error,
    refetch,
  }
}

export default useCryptoValuation
```

### 3.4 Services

**Arquivo:** `src/pages/crypto/services/cryptoService.js`

```javascript
import api from '../../services/api'

const cryptoService = {
  async getPrices(tickers) {
    const response = await api.get('/crypto/prices', {
      params: { tickers: tickers.join(',') },
    })
    return response.data
  },

  async getSparkline(ticker, days = 7) {
    const response = await api.get(`/crypto/sparkline/${ticker}`, {
      params: { days },
    })
    return response.data
  },

  async getValuation(walletId) {
    const response = await api.get('/positions/crypto/valuation', {
      params: { walletId },
    })
    return response.data
  },
}

export default cryptoService
```

## 4. API Contracts

### 4.1 GET /api/crypto/prices

**Descrição:** Retorna preços atuais de criptomoedas

**Query Parameters:**
- `tickers` (required): Lista de tickers separados por vírgula (ex: BTC,ETH,SOL)

**Response (200):**
```json
{
  "prices": [
    {
      "ticker": "BTC",
      "priceUSD": 97500.00,
      "priceBRL": 502125.00,
      "change24h": -2.3,
      "volume24h": 45000000000,
      "updatedAt": "2026-03-27T10:00:00.000Z"
    },
    {
      "ticker": "ETH",
      "priceUSD": 3500.00,
      "priceBRL": 18025.00,
      "change24h": 1.5,
      "volume24h": 15000000000,
      "updatedAt": "2026-03-27T10:00:00.000Z"
    }
  ],
  "source": "CACHE",
  "cachedAt": "2026-03-27T10:00:00.000Z"
}
```

### 4.2 GET /api/crypto/sparkline/:ticker

**Descrição:** Retorna dados históricos para sparkline

**Path Parameters:**
- `ticker`: Ticker da criptomoeda (ex: BTC)

**Query Parameters:**
- `days` (optional): Número de dias (default: 7)

**Response (200):**
```json
{
  "ticker": "BTC",
  "prices": [
    { "date": "2026-03-21T00:00:00.000Z", "price": 495000 },
    { "date": "2026-03-22T00:00:00.000Z", "price": 498000 },
    { "date": "2026-03-23T00:00:00.000Z", "price": 510000 },
    { "date": "2026-03-24T00:00:00.000Z", "price": 505000 },
    { "date": "2026-03-25T00:00:00.000Z", "price": 515000 },
    { "date": "2026-03-26T00:00:00.000Z", "price": 518000 },
    { "date": "2026-03-27T00:00:00.000Z", "price": 520000 }
  ]
}
```

### 4.3 GET /api/positions/crypto/valuation

**Descrição:** Retorna valorização completa das posições de cripto

**Query Parameters:**
- `walletId` (required): ID da carteira

**Response (200):**
```json
{
  "totalValueBRL": 350000.00,
  "totalCostBRL": 320000.00,
  "totalGainBRL": 30000.00,
  "totalGainPercent": 9.375,
  "positions": [
    {
      "ticker": "BTC",
      "quantity": 0.5,
      "avgPrice": 500000.00,
      "currentPrice": 520000.00,
      "currentValue": 260000.00,
      "cost": 250000.00,
      "gainBRL": 10000.00,
      "gainPercent": 4.00,
      "change24h": -2.3,
      "sparklineData": [495000, 498000, 510000, 505000, 515000, 518000, 520000]
    },
    {
      "ticker": "ETH",
      "quantity": 2.0,
      "avgPrice": 17500.00,
      "currentPrice": 18000.00,
      "currentValue": 36000.00,
      "cost": 35000.00,
      "gainBRL": 1000.00,
      "gainPercent": 2.86,
      "change24h": 1.5,
      "sparklineData": [17200, 17400, 17600, 17500, 17800, 17900, 18000]
    }
  ]
}
```

## 5. Fluxos de Dados

### 5.1 Atualização de Preços (Scheduler)

```
┌──────────────────┐     ┌─────────────────┐     ┌──────────────┐
│ crypto-price-    │     │ providers/      │     │ APIs Ext.    │
│   scheduler.js   │     │ coingecko       │     │ CoinGecko    │
│                  │     │ binance         │     │ Binance      │
└────────┬─────────┘     └────────┬────────┘     └──────┬───────┘
         │                        │                     │
         │ setInterval(30s)       │                     │
         │                        │                     │
         │ getActiveCryptoTickers()                     │
         │────────────────────────┐                     │
         │                        │                     │
         │ getBatchPrices(tickers)│                     │
         │───────────────────────>│                     │
         │                        │                     │
         │                        │ GET /simple/price   │
         │                        │────────────────────>│
         │                        │                     │
         │                        │<────────────────────│
         │                        │ { prices }          │
         │                        │                     │
         │<───────────────────────│                     │
         │ prices[]               │                     │
         │                        │                     │
         │ storePrices(prices)    │                     │
         │────────────────────────┼────────────────────>│ Redis
         │                        │                     │
         │ publishUpdate(prices)  │                     │
         │────────────────────────┼────────────────────>│ Redis Pub/Sub
         │                        │                     │
```

### 5.2 Fluxo de Compra de Cripto

```
┌─────────┐  ┌────────────────┐  ┌─────────────────┐  ┌──────────────┐
│ Frontend│  │ transaction-   │  │ position-       │  │ MongoDB       │
│         │  │   router       │  │   manager       │  │              │
└────┬────┘  └───────┬────────┘  └────────┬────────┘  └──────┬───────┘
     │               │                     │                  │
     │ POST /transactions                   │                  │
     │ { assetType: 'CRYPTO' }              │                  │
     │──────────────>│                     │                  │
     │               │                     │                  │
     │               │ createTransaction() │                  │
     │               │────────────────────>│                  │
     │               │                     │                  │
     │               │                     │ Validar precisão │
     │               │                     │ decimal (8 casas)│
     │               │                     │                  │
     │               │                     │ Converter fee    │
     │               │                     │ se em cripto    │
     │               │                     │                  │
     │               │                     │ Calcular preço   │
     │               │                     │ médio            │
     │               │                     │                  │
     │               │                     │ save()──────────>│
     │               │                     │                  │
     │               │<────────────────────│                  │
     │               │                     │                  │
     │<──────────────│ 201 { transaction, position }          │
     │               │                     │                  │
```

## 6. Estrutura de Arquivos

```
src/
├── app/
│   ├── crypto/
│   │   ├── crypto-model.js              # Schema de preços
│   │   ├── crypto-dao.js                # Data Access Object
│   │   ├── crypto-manager.js            # Business Logic
│   │   ├── crypto-router.js              # HTTP Routes
│   │   ├── crypto-price-scheduler.js     # Scheduler 30s
│   │   └── providers/
│   │       ├── base-provider.js          # Classe abstrata
│   │       ├── coingecko-provider.js     # CoinGecko API
│   │       └── binance-provider.js       # Binance API
│   │
│   ├── transaction/
│   │   └── transaction-model.js          # Estendido com assetType: CRYPTO
│   │
│   └── position/
│       └── position-model.js             # Estendido com assetType: CRYPTO
│
├── pages/
│   └── crypto/
│       ├── CryptoPage.jsx                # Página principal
│       ├── components/
│       │   ├── CryptoPortfolioSummary.jsx # Cards de resumo
│       │   ├── CryptoAssetCard.jsx       # Card individual
│       │   ├── CryptoAssetTable.jsx      # Tabela detalhada
│       │   ├── CryptoSparkline.jsx       # Mini gráfico
│       │   └── CryptoPriceIndicator.jsx  # Indicador verde/vermelho
│       ├── hooks/
│       │   ├── useCryptoPrices.js        # Polling 30s
│       │   └── useCryptoValuation.js     # Valuation
│       └── services/
│           └── cryptoService.js          # API client
```

## 7. Ordem de Implementação

| Fase | Story | Descrição | Dependências |
|------|-------|-----------|--------------|
| 1 | EP12-001 | Registrar Compra e Venda de Criptomoedas | EP04, EP05, EP06 |
| 2 | EP12-002 | Atualização de Preços em Alta Frequência | EP12-001, EP13, EP14 |
| 3 | EP12-003 | Exibir Valorização e Seção Cripto no Frontend | EP12-001, EP12-002 |

### Detalhamento por Fase:

**Fase 1 - EP12-001 (8 story points)**
1. Estender `transaction-model.js` com `assetType: 'CRYPTO'`
2. Estender `position-model.js` com `assetType: 'CRYPTO'`
3. Adicionar campos `feeAsset`, `feeInAsset`, `feeExchangeRate`
4. Implementar validação de precisão decimal (8 casas)
5. Implementar conversão de taxa em cripto para BRL
6. Atualizar `transaction-manager.js` para suportar cripto
7. Testes unitários e de integração

**Fase 2 - EP12-002 (8 story points)**
1. Criar `crypto-price-model.js`
2. Criar `crypto-price-dao.js`
3. Criar providers (`coingecko-provider.js`, `binance-provider.js`)
4. Criar `crypto-price-scheduler.js` com intervalo de 30s
5. Implementar cache Redis com TTL de 60s
6. Implementar fallback entre providers
7. Implementar publicação de eventos no Redis pub/sub
8. Testes de carga (50 tickers em < 10s)

**Fase 3 - EP12-003 (8 story points)**
1. Criar `crypto-manager.js` com método `getCryptoValuation()`
2. Criar `crypto-router.js` com endpoints
3. Criar `CryptoPage.jsx`
4. Criar componentes (`CryptoAssetCard`, `CryptoSparkline`, etc.)
5. Criar hooks (`useCryptoPrices`, `useCryptoValuation`)
6. Implementar polling no frontend (30s)
7. Testes de responsividade

## 8. Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Rate limit das APIs de preço (CoinGecko free: 10-30 req/min) | Alta | Alto | Batch requests + cache Redis + fallback Binance |
| Precisão de 8 casas decimais com JavaScript floating point | Alta | Crítico | Usar aritmética de inteiros (multiplicar por 10^8) ou library `decimal.js` |
| Volatilidade extrema gerando UX confusa | Média | Médio | Animação suave de transição + limitar frequência visual a 30s |
| CoinGecko deprecia ou muda API | Baixa | Alto | Padrão Strategy permite adicionar novos providers facilmente |
| Gas fees em cripto não-BRL | Média | Médio | Conversão automática usando cotação do momento |
| Mapeamento de tickers incorreto entre exchanges | Média | Alto | Tabela de mapeamento centralizada com testes de validação |
| Alto consumo de recursos com muitos tickers | Média | Médio | Atualizar apenas tickers de posições ativas + batch requests |
| Stablecoins com variação mínima consumindo recursos | Baixa | Baixo | Frequência reduzida para stablecoins (5 min ao invés de 30s) |

## 9. Dependências

### Dependências de Épicos Anteriores:
- **EP04 (Transações)**: Reuso do modelo de transações
- **EP05 (Preço Médio)**: Cálculo de preço médio com taxas
- **EP06 (Câmbio)**: Conversão USD/BRL para criptos cotadas em dólar
- **EP13 (Fontes de Dados)**: CoinGecko e Binance como fontes
- **EP14 (Atualização de Dados)**: Scheduler de alta frequência

### Dependências de Pacotes npm:
- `mongoose`: ODM para MongoDB
- `axios`: Requisições HTTP para APIs externas
- `decimal.js`: Aritmética de precisão arbitrária (opcional)
- `json-log-middleware`: Logging estruturado

### Dependências de Infraestrutura:
- MongoDB (coleções `transactions`, `positions`, `cryptoPrices`)
- Redis (cache de preços com TTL 60s, pub/sub)

### Variáveis de Ambiente:
```
CRYPTO_UPDATE_INTERVAL=30000
COINGECKO_API_KEY=
BINANCE_API_KEY=
CRYPTO_PRICE_CACHE_TTL=60
```

## 10. Checklist de Implementação

### Backend
- [ ] Estender `transaction-model.js` com `assetType: 'CRYPTO'`
- [ ] Estender `position-model.js` com `assetType: 'CRYPTO'`
- [ ] Adicionar campos de fee em cripto
- [ ] Implementar validação de precisão decimal (8 casas)
- [ ] Implementar conversão de taxa em cripto para BRL
- [ ] Criar `crypto-price-model.js`
- [ ] Criar `crypto-price-dao.js`
- [ ] Criar `base-provider.js`
- [ ] Criar `coingecko-provider.js`
- [ ] Criar `binance-provider.js`
- [ ] Criar `crypto-price-scheduler.js`
- [ ] Implementar cache Redis
- [ ] Implementar fallback entre providers
- [ ] Criar `crypto-manager.js`
- [ ] Criar `crypto-router.js`
- [ ] Adicionar documentação Swagger
- [ ] Testes unitários com cobertura >= 90%
- [ ] Testes de integração
- [ ] Teste de carga (50 tickers em < 10s)

### Frontend
- [ ] Criar `CryptoPage.jsx`
- [ ] Criar `CryptoPortfolioSummary.jsx`
- [ ] Criar `CryptoAssetCard.jsx`
- [ ] Criar `CryptoAssetTable.jsx`
- [ ] Criar `CryptoSparkline.jsx`
- [ ] Criar `CryptoPriceIndicator.jsx`
- [ ] Criar `useCryptoPrices.js` hook
- [ ] Criar `useCryptoValuation.js` hook
- [ ] Criar `cryptoService.js`
- [ ] Implementar polling 30s
- [ ] Implementar animações de transição
- [ ] Testes de responsividade

### QA
- [ ] Validar compra de cripto com taxa em BRL
- [ ] Validar compra de cripto com taxa em cripto (gas fee)
- [ ] Validar precisão decimal (8 casas)
- [ ] Validar cálculo de preço médio
- [ ] Validar atualização de preços a cada 30s
- [ ] Validar fallback CoinGecko → Binance
- [ ] Validar cache Redis
- [ ] Validar sparkline com 7 dias
- [ ] Validar indicadores de ganho/perda
- [ ] Validar responsividade mobile

### Code Review
- [ ] Verificar precisão decimal em todos os cálculos
- [ ] Verificar tratamento de rate limits
- [ ] Verificar fallback entre providers
- [ ] Verificar cache Redis
- [ ] Verificar logging adequado

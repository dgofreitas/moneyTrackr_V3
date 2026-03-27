# Plano Técnico - EP11 Proventos

## 1. Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React/Vue PWA)                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                 │
│  │ DividendsPage    │  │ DividendTable   │  │ DividendSummary │                 │
│  │ - Filtros       │  │ - Paginação     │  │ - Cards         │                 │
│  │ - Períodos      │  │ - Ordenação     │  │ - Yield on Cost │                 │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘                 │
│           │                    │                    │                           │
│           └────────────────────┼────────────────────┘                           │
│                                │                                                │
│                    ┌───────────▼───────────┐                                    │
│                    │  dividendService.js    │                                    │
│                    │  - API calls          │                                    │
│                    │  - Cache local        │                                    │
│                    └───────────┬───────────┘                                    │
└────────────────────────────────┼────────────────────────────────────────────────┘
                                 │ HTTP/REST
┌────────────────────────────────┼────────────────────────────────────────────────┐
│                         BACKEND (Node.js/Express)                               │
├────────────────────────────────┼────────────────────────────────────────────────┤
│                    ┌───────────▼───────────┐                                    │
│                    │  dividend-router.js   │                                    │
│                    │  POST /dividends      │                                    │
│                    │  POST /dividends/import                                                   │
│                    │  GET  /dividends      │                                    │
│                    │  GET  /dividends/summary                                                  │
│                    │  DELETE /dividends/:id                                                    │
│                    └───────────┬───────────┘                                    │
│                                │                                                │
│                    ┌───────────▼───────────┐                                    │
│                    │  dividend-manager.js  │                                    │
│                    │  - Validações         │                                    │
│                    │  - Cálculos           │                                    │
│                    │  - Orquestração       │                                    │
│                    └───────────┬───────────┘                                    │
│                                │                                                │
│         ┌──────────────────────┼──────────────────────┐                         │
│         │                      │                      │                         │
│  ┌──────▼──────┐      ┌────────▼────────┐   ┌───────▼───────┐                   │
│  │ dividend-dao│      │dividend-import  │   │ position-dao  │                   │
│  │             │      │   -service.js   │   │ (READ ONLY)   │                   │
│  │ CRUD        │      │                 │   │               │                   │
│  │ Aggregations│      │ BRAPI/Yahoo     │   │ Yield on Cost │                   │
│  └──────┬──────┘      └────────┬────────┘   └───────┬───────┘                   │
│         │                      │                      │                         │
└─────────┼──────────────────────┼──────────────────────┼─────────────────────────┘
          │                      │                      │
    ┌─────▼─────┐          ┌─────▼─────┐          ┌─────▼─────┐
    │  MongoDB  │          │   Redis   │          │ APIs Ext. │
    │ Dividend  │          │  Cache    │          │ BRAPI     │
    │ Model     │          │ Summary   │          │ Yahoo     │
    └───────────┘          └───────────┘          └───────────┘
```

## 2. Componentes Backend

### 2.1 Models (Mongoose Schemas)

**Arquivo:** `src/app/dividend/dividend-model.js`

```javascript
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const schema = new mongoose.Schema({
  _id: { type: String, required: true, default: uuidv4 },
  domain: { type: String, required: true },
  walletId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  ticker: { type: String, required: true, index: true },
  type: {
    type: String,
    required: true,
    enum: ['DIVIDEND', 'JCP', 'RENDIMENTO'],
  },
  amountPerShare: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  quantity: { type: Number, required: true },
  date: { type: Date, required: true },
  paymentDate: { type: Date, required: true },
  taxExempt: { type: Boolean, default: false },
  withholdingTax: { type: Number, default: 0 },
  source: {
    type: String,
    enum: ['MANUAL', 'BRAPI', 'YAHOO_FINANCE'],
    default: 'MANUAL',
  },
  status: {
    type: String,
    enum: ['CONFIRMED', 'IMPORTED', 'DELETED'],
    default: 'CONFIRMED',
  },
}, { versionKey: false, timestamps: true })

// Índice único composto para evitar duplicatas
schema.index({ walletId: 1, ticker: 1, date: 1, type: 1 }, { unique: true })

// Índices para queries frequentes
schema.index({ walletId: 1, paymentDate: -1 })
schema.index({ walletId: 1, ticker: 1, paymentDate: -1 })

module.exports = { schema }
```

### 2.2 DAOs

**Arquivo:** `src/app/dividend/dividend-dao.js`

```javascript
const AppDAO = require('../app-dao')
const { schema } = require('./dividend-model')

class DividendDAO extends AppDAO {
  constructor(db) {
    super(db)
  }

  initializeDBModel(db) {
    return db.model('dividend', schema)
  }

  async create(dividendData) {
    const dividend = new this.objectModel(dividendData)
    return await dividend.save()
  }

  async findById(dividendId) {
    return await this.objectModel.findOne({ 
      _id: dividendId, 
      status: { $ne: 'DELETED' } 
    }).lean().exec()
  }

  async findByWallet(walletId, options = {}) {
    const { ticker, type, startDate, endDate, page = 1, limit = 50 } = options
    const query = { walletId, status: { $ne: 'DELETED' } }
    
    if (ticker) query.ticker = ticker
    if (type) query.type = type
    if (startDate || endDate) {
      query.paymentDate = {}
      if (startDate) query.paymentDate.$gte = new Date(startDate)
      if (endDate) query.paymentDate.$lte = new Date(endDate)
    }

    const skip = (page - 1) * limit
    
    const [dividends, totalCount] = await Promise.all([
      this.objectModel.find(query)
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.objectModel.countDocuments(query),
    ])

    return { dividends, totalCount, page, limit }
  }

  async softDelete(dividendId) {
    return await this.objectModel.findByIdAndUpdate(
      dividendId,
      { status: 'DELETED' },
      { new: true }
    ).lean().exec()
  }

  async getSummary(walletId, startDate, endDate) {
    return this.objectModel.aggregate([
      { $match: {
        walletId,
        status: { $ne: 'DELETED' },
        paymentDate: { $gte: new Date(startDate), $lte: new Date(endDate) },
      }},
      { $group: {
        _id: null,
        totalReceived: { $sum: '$totalAmount' },
        totalWithholdingTax: { $sum: '$withholdingTax' },
        count: { $sum: 1 },
      }},
    ])
  }

  async getSummaryByTicker(walletId, startDate, endDate) {
    return this.objectModel.aggregate([
      { $match: {
        walletId,
        status: { $ne: 'DELETED' },
        paymentDate: { $gte: new Date(startDate), $lte: new Date(endDate) },
      }},
      { $group: {
        _id: '$ticker',
        total: { $sum: '$totalAmount' },
        count: { $sum: 1 },
      }},
      { $sort: { total: -1 } },
    ])
  }

  async getSummaryByType(walletId, startDate, endDate) {
    return this.objectModel.aggregate([
      { $match: {
        walletId,
        status: { $ne: 'DELETED' },
        paymentDate: { $gte: new Date(startDate), $lte: new Date(endDate) },
      }},
      { $group: {
        _id: '$type',
        total: { $sum: '$totalAmount' },
        count: { $sum: 1 },
      }},
      { $sort: { total: -1 } },
    ])
  }

  async getSummaryByMonth(walletId, startDate, endDate) {
    return this.objectModel.aggregate([
      { $match: {
        walletId,
        status: { $ne: 'DELETED' },
        paymentDate: { $gte: new Date(startDate), $lte: new Date(endDate) },
      }},
      { $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$paymentDate' } },
        total: { $sum: '$totalAmount' },
      }},
      { $sort: { _id: 1 } },
    ])
  }

  async findDuplicate(walletId, ticker, date, type) {
    return await this.objectModel.findOne({
      walletId,
      ticker,
      date: new Date(date),
      type,
      status: { $ne: 'DELETED' },
    }).lean().exec()
  }
}

module.exports = DividendDAO
```

### 2.3 Managers

**Arquivo:** `src/app/dividend/dividend-manager.js`

```javascript
const { Exception } = require('interact-utils')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME, ERRORS } = require('../app-constants')
const DividendDAO = require('./dividend-dao')
const DividendImportService = require('./dividend-import-service')

const logger = new JsonLog(SERVICE_NAME)

class DividendManager {
  constructor(appManager, appDB, redisClient) {
    this.appDB = appDB
    this.redisClient = redisClient
    this.dividendDAO = new DividendDAO(this.appDB.getDb())
    this.importService = new DividendImportService(appManager)
  }

  async createDividend({ domain, userId, walletId, ticker, type, amountPerShare, quantity, date, paymentDate }) {
    // Validações
    if (!walletId || !ticker || !type || !amountPerShare || !quantity || !date || !paymentDate) {
      throw new Exception(400, 'Campos obrigatórios não informados')
    }

    // Verificar duplicata
    const duplicate = await this.dividendDAO.findDuplicate(walletId, ticker, date, type)
    if (duplicate) {
      throw new Exception(409, 'Provento já existe para este ticker, data e tipo')
    }

    // Calcular valor total
    const totalAmount = amountPerShare * quantity

    // Calcular IR retido na fonte para JCP (15%)
    let withholdingTax = 0
    let taxExempt = false

    if (type === 'JCP') {
      withholdingTax = totalAmount * 0.15
    }

    // Rendimentos de FII são isentos
    if (type === 'RENDIMENTO') {
      taxExempt = true
    }

    const dividend = await this.dividendDAO.create({
      domain,
      userId,
      walletId,
      ticker: ticker.toUpperCase(),
      type,
      amountPerShare,
      totalAmount,
      quantity,
      date: new Date(date),
      paymentDate: new Date(paymentDate),
      taxExempt,
      withholdingTax,
      source: 'MANUAL',
      status: 'CONFIRMED',
    })

    // Invalidar cache de summary
    await this.invalidateSummaryCache(walletId)

    logger.log('Dividend created', {
      domain,
      internal: { method: 'createDividend', filename: 'dividend-manager.js' },
      dividendId: dividend._id,
    })

    return dividend
  }

  async importDividends({ domain, userId, walletId, tickers, startDate, endDate }) {
    const result = await this.importService.import({
      domain,
      userId,
      walletId,
      tickers,
      startDate,
      endDate,
    })

    // Invalidar cache de summary
    await this.invalidateSummaryCache(walletId)

    logger.log('Dividends imported', {
      domain,
      internal: { method: 'importDividends', filename: 'dividend-manager.js' },
      imported: result.imported,
      duplicatesSkipped: result.duplicatesSkipped,
    })

    return result
  }

  async getDividends({ domain, walletId, ticker, type, startDate, endDate, page, limit }) {
    return await this.dividendDAO.findByWallet(walletId, {
      ticker,
      type,
      startDate,
      endDate,
      page,
      limit,
    })
  }

  async getSummary({ domain, walletId, period, year, month, ticker }) {
    const { startDate, endDate, periodLabel } = this.calculatePeriodRange(period, year, month)
    
    // Verificar cache
    const cacheKey = `dividends:summary:${walletId}:${period}:${year || 'all'}:${month || 'all'}:${ticker || 'all'}`
    const cached = await this.redisClient.get(cacheKey)
    
    if (cached) {
      return JSON.parse(cached)
    }

    // Buscar dados
    const [summary, byTicker, byType, byMonth] = await Promise.all([
      this.dividendDAO.getSummary(walletId, startDate, endDate),
      ticker ? [] : this.dividendDAO.getSummaryByTicker(walletId, startDate, endDate),
      this.dividendDAO.getSummaryByType(walletId, startDate, endDate),
      this.dividendDAO.getSummaryByMonth(walletId, startDate, endDate),
    ])

    // Calcular yield on cost (requer position-dao)
    const totalInvested = await this.getTotalInvested(walletId)
    const totalReceived = summary[0]?.totalReceived || 0
    const yieldOnCost = totalInvested > 0 ? (totalReceived / totalInvested) * 100 : 0

    // Projeção 12 meses (baseado nos últimos 12 meses)
    const last12Months = await this.getLast12MonthsTotal(walletId)
    const projection12Months = last12Months

    const result = {
      period,
      periodLabel,
      totalReceived,
      totalReceivedGross: totalReceived + (summary[0]?.totalWithholdingTax || 0),
      totalWithholdingTax: summary[0]?.totalWithholdingTax || 0,
      yieldOnCost,
      totalInvested,
      projection12Months,
      byTicker: byTicker.map(item => ({ ticker: item._id, total: item.total, count: item.count })),
      byType: byType.map(item => ({ type: item._id, total: item.total, count: item.count })),
      byMonth: byMonth.map(item => ({ month: item._id, total: item.total })),
    }

    // Cachear por 1 hora
    await this.redisClient.set(cacheKey, JSON.stringify(result), 'EX', 3600)

    return result
  }

  async deleteDividend({ domain, dividendId }) {
    const dividend = await this.dividendDAO.findById(dividendId)
    
    if (!dividend) {
      throw new Exception(404, 'Provento não encontrado')
    }

    const updated = await this.dividendDAO.softDelete(dividendId)

    // Invalidar cache
    await this.invalidateSummaryCache(dividend.walletId)

    logger.log('Dividend deleted', {
      domain,
      internal: { method: 'deleteDividend', filename: 'dividend-manager.js' },
      dividendId,
    })

    return updated
  }

  calculatePeriodRange(period, year, month) {
    const now = new Date()
    let startDate, endDate, periodLabel

    switch (period) {
      case 'MONTHLY':
        startDate = new Date(year || now.getFullYear(), (month || now.getMonth() + 1) - 1, 1)
        endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0)
        periodLabel = `${startDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`
        break

      case 'SEMI_ANNUAL':
        const semester = month <= 6 ? 1 : 2
        startDate = new Date(year || now.getFullYear(), semester === 1 ? 0 : 6, 1)
        endDate = new Date(year || now.getFullYear(), semester === 1 ? 6 : 12, 0)
        periodLabel = `${semester}º Semestre ${year || now.getFullYear()}`
        break

      case 'ANNUAL':
        startDate = new Date(year || now.getFullYear(), 0, 1)
        endDate = new Date(year || now.getFullYear(), 11, 31)
        periodLabel = `${year || now.getFullYear()}`
        break

      case 'TOTAL':
      default:
        startDate = new Date(2000, 0, 1)
        endDate = new Date(2100, 11, 31)
        periodLabel = 'Todo o período'
        break
    }

    return { startDate, endDate, periodLabel }
  }

  async getTotalInvested(walletId) {
    // Usar position-dao para calcular custo total
    const PositionDAO = require('../position/position-dao')
    const positionDAO = new PositionDAO(this.appDB.getDb())
    
    const positions = await positionDAO.findByWallet(walletId)
    return positions.reduce((sum, pos) => sum + (pos.quantity * pos.avgPrice), 0)
  }

  async getLast12MonthsTotal(walletId) {
    const now = new Date()
    const startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    const endDate = now

    const summary = await this.dividendDAO.getSummary(walletId, startDate, endDate)
    return summary[0]?.totalReceived || 0
  }

  async invalidateSummaryCache(walletId) {
    const pattern = `dividends:summary:${walletId}:*`
    const keys = await this.redisClient.keys(pattern)
    if (keys.length > 0) {
      await this.redisClient.del(...keys)
    }
  }
}

module.exports = DividendManager
```

### 2.4 Routers

**Arquivo:** `src/app/dividend/dividend-router.js`

```javascript
const express = require('express')
const { Authorizer } = require('interact-utils')
const { Permissions } = require('../app-constants')

class DividendRouter {
  static handleError(exception, res) {
    res.status(exception.statusCode || 500).send(exception.message || 'Server Error')
  }

  static getRoutes(appManager) {
    const router = express.Router()
    const manager = appManager.getDividendManager()

    // POST /api/dividends - Criar provento manual
    router.post('/dividends', Authorizer.getMiddleware(Permissions.USER), async (req, res) => {
      try {
        const domain = req.credentials.domain
        const userId = req.credentials.userId
        const { walletId, ticker, type, amountPerShare, quantity, date, paymentDate } = req.body

        const dividend = await manager.createDividend({
          domain,
          userId,
          walletId,
          ticker,
          type,
          amountPerShare,
          quantity,
          date,
          paymentDate,
        })

        res.status(201).json({ dividend })
      } catch (exception) {
        DividendRouter.handleError(exception, res)
      }
    })

    // POST /api/dividends/import - Importar proventos
    router.post('/dividends/import', Authorizer.getMiddleware(Permissions.USER), async (req, res) => {
      try {
        const domain = req.credentials.domain
        const userId = req.credentials.userId
        const { walletId, tickers, startDate, endDate } = req.body

        const result = await manager.importDividends({
          domain,
          userId,
          walletId,
          tickers,
          startDate,
          endDate,
        })

        res.status(200).json(result)
      } catch (exception) {
        DividendRouter.handleError(exception, res)
      }
    })

    // GET /api/dividends - Listar proventos
    router.get('/dividends', Authorizer.getMiddleware(Permissions.USER), async (req, res) => {
      try {
        const domain = req.credentials.domain
        const { walletId, ticker, type, startDate, endDate, page, limit } = req.query

        const result = await manager.getDividends({
          domain,
          walletId,
          ticker,
          type,
          startDate,
          endDate,
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 50,
        })

        res.status(200).json(result)
      } catch (exception) {
        DividendRouter.handleError(exception, res)
      }
    })

    // GET /api/dividends/summary - Resumo de proventos
    router.get('/dividends/summary', Authorizer.getMiddleware(Permissions.USER), async (req, res) => {
      try {
        const domain = req.credentials.domain
        const { walletId, period, year, month, ticker } = req.query

        const summary = await manager.getSummary({
          domain,
          walletId,
          period: period || 'TOTAL',
          year: year ? parseInt(year) : null,
          month: month ? parseInt(month) : null,
          ticker,
        })

        res.status(200).json(summary)
      } catch (exception) {
        DividendRouter.handleError(exception, res)
      }
    })

    // DELETE /api/dividends/:dividendId - Soft delete
    router.delete('/dividends/:dividendId', Authorizer.getMiddleware(Permissions.USER), async (req, res) => {
      try {
        const domain = req.credentials.domain
        const { dividendId } = req.params

        const dividend = await manager.deleteDividend({ domain, dividendId })

        res.status(200).json({ dividend })
      } catch (exception) {
        DividendRouter.handleError(exception, res)
      }
    })

    return router
  }
}

module.exports = DividendRouter
```

## 3. Componentes Frontend

### 3.1 Pages

**Arquivo:** `src/pages/dividends/DividendsPage.jsx`

```jsx
import React, { useState, useEffect } from 'react'
import { useQuery } from 'react-query'
import styled from 'styled-components'
import DividendTable from '../components/DividendTable'
import DividendSummaryCards from '../components/DividendSummaryCards'
import DividendChart from '../components/DividendChart'
import DividendFilters from '../components/DividendFilters'
import dividendService from '../services/dividendService'

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

const AddButton = styled.button`
  padding: 12px 24px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  
  &:hover {
    background: #2563eb;
  }
`

const DividendsPage = ({ walletId }) => {
  const [filters, setFilters] = useState({
    period: 'MONTHLY',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    ticker: null,
    type: null,
  })

  const [page, setPage] = useState(1)

  const { data: summary, isLoading: summaryLoading } = useQuery(
    ['dividendSummary', walletId, filters],
    () => dividendService.getSummary(walletId, filters),
    { staleTime: 60000 }
  )

  const { data: dividends, isLoading: dividendsLoading } = useQuery(
    ['dividends', walletId, filters, page],
    () => dividendService.getDividends(walletId, { ...filters, page }),
    { staleTime: 30000 }
  )

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    setPage(1)
  }

  return (
    <Container>
      <Header>
        <Title>Proventos</Title>
        <AddButton onClick={() => {/* abrir modal */}}>
          + Adicionar Provento
        </AddButton>
      </Header>

      <DividendFilters
        filters={filters}
        onChange={handleFilterChange}
      />

      <DividendSummaryCards
        summary={summary}
        loading={summaryLoading}
      />

      <DividendChart
        data={summary?.byMonth || []}
        loading={summaryLoading}
      />

      <DividendTable
        dividends={dividends?.dividends || []}
        totalCount={dividends?.totalCount || 0}
        page={page}
        limit={50}
        loading={dividendsLoading}
        onPageChange={setPage}
      />
    </Container>
  )
}

export default DividendsPage
```

### 3.2 Components

**Arquivo:** `src/pages/dividends/components/DividendSummaryCards.jsx`

```jsx
import React from 'react'
import styled from 'styled-components'
import Skeleton from 'react-loading-skeleton'

const CardsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`

const Card = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`

const CardTitle = styled.p`
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 8px;
`

const CardValue = styled.p`
  font-size: 24px;
  font-weight: 600;
  color: #1f2937;
`

const CardSubtext = styled.p`
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
`

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0)
}

const DividendSummaryCards = ({ summary, loading }) => {
  if (loading) {
    return (
      <CardsContainer>
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <Skeleton height={14} width={100} />
            <Skeleton height={28} width={150} style={{ marginTop: 8 }} />
          </Card>
        ))}
      </CardsContainer>
    )
  }

  return (
    <CardsContainer>
      <Card>
        <CardTitle>Total Recebido</CardTitle>
        <CardValue>{formatCurrency(summary?.totalReceived)}</CardValue>
        <CardSubtext>{summary?.periodLabel}</CardSubtext>
      </Card>

      <Card>
        <CardTitle>Yield on Cost</CardTitle>
        <CardValue>{(summary?.yieldOnCost || 0).toFixed(2)}%</CardValue>
        <CardSubtext>Últimos 12 meses</CardSubtext>
      </Card>

      <Card>
        <CardTitle>Projeção 12M</CardTitle>
        <CardValue>{formatCurrency(summary?.projection12Months)}</CardValue>
        <CardSubtext>Baseado no histórico</CardSubtext>
      </Card>

      <Card>
        <CardTitle>IR Retido</CardTitle>
        <CardValue>{formatCurrency(summary?.totalWithholdingTax)}</CardSubtext>
        <CardSubtext>JCP (15%)</CardSubtext>
      </Card>
    </CardsContainer>
  )
}

export default DividendSummaryCards
```

### 3.3 Services

**Arquivo:** `src/services/dividendService.js`

```javascript
import api from './api'

const dividendService = {
  async getDividends(walletId, params) {
    const response = await api.get('/dividends', {
      params: {
        walletId,
        ...params,
      },
    })
    return response.data
  },

  async getSummary(walletId, filters) {
    const response = await api.get('/dividends/summary', {
      params: {
        walletId,
        period: filters.period,
        year: filters.year,
        month: filters.month,
        ticker: filters.ticker,
      },
    })
    return response.data
  },

  async createDividend(data) {
    const response = await api.post('/dividends', data)
    return response.data
  },

  async importDividends(walletId, tickers, startDate, endDate) {
    const response = await api.post('/dividends/import', {
      walletId,
      tickers,
      startDate,
      endDate,
    })
    return response.data
  },

  async deleteDividend(dividendId) {
    const response = await api.delete(`/dividends/${dividendId}`)
    return response.data
  },
}

export default dividendService
```

## 4. API Contracts

### 4.1 POST /api/dividends

**Descrição:** Cria um novo provento manualmente

**Request Body:**
```json
{
  "walletId": "uuid",
  "ticker": "PETR4",
  "type": "DIVIDEND",
  "amountPerShare": 1.50,
  "quantity": 100,
  "date": "2026-03-15",
  "paymentDate": "2026-03-30"
}
```

**Response (201):**
```json
{
  "dividend": {
    "_id": "uuid",
    "walletId": "uuid",
    "ticker": "PETR4",
    "type": "DIVIDEND",
    "amountPerShare": 1.50,
    "totalAmount": 150.00,
    "quantity": 100,
    "date": "2026-03-15T00:00:00.000Z",
    "paymentDate": "2026-03-30T00:00:00.000Z",
    "taxExempt": false,
    "withholdingTax": 0,
    "source": "MANUAL",
    "status": "CONFIRMED",
    "createdAt": "2026-03-27T10:00:00.000Z",
    "updatedAt": "2026-03-27T10:00:00.000Z"
  }
}
```

### 4.2 POST /api/dividends/import

**Descrição:** Importa proventos de APIs externas

**Request Body:**
```json
{
  "walletId": "uuid",
  "tickers": ["PETR4", "VALE3", "ITUB4"],
  "startDate": "2025-01-01",
  "endDate": "2026-12-31"
}
```

**Response (200):**
```json
{
  "imported": 15,
  "duplicatesSkipped": 3,
  "errors": [],
  "dividends": [
    { "ticker": "PETR4", "type": "DIVIDEND", "totalAmount": 150.00 },
    { "ticker": "VALE3", "type": "DIVIDEND", "totalAmount": 200.00 }
  ]
}
```

### 4.3 GET /api/dividends

**Descrição:** Lista proventos com filtros e paginação

**Query Parameters:**
- `walletId` (required): ID da carteira
- `ticker` (optional): Filtrar por ticker
- `type` (optional): DIVIDEND | JCP | RENDIMENTO
- `startDate` (optional): Data início
- `endDate` (optional): Data fim
- `page` (optional): Página (default: 1)
- `limit` (optional): Itens por página (default: 50)

**Response (200):**
```json
{
  "dividends": [
    {
      "_id": "uuid",
      "ticker": "PETR4",
      "type": "DIVIDEND",
      "amountPerShare": 1.50,
      "totalAmount": 150.00,
      "quantity": 100,
      "date": "2026-03-15T00:00:00.000Z",
      "paymentDate": "2026-03-30T00:00:00.000Z"
    }
  ],
  "totalCount": 45,
  "page": 1,
  "limit": 50
}
```

### 4.4 GET /api/dividends/summary

**Descrição:** Retorna resumo consolidado de proventos

**Query Parameters:**
- `walletId` (required): ID da carteira
- `period` (optional): MONTHLY | SEMI_ANNUAL | ANNUAL | TOTAL
- `year` (optional): Ano
- `month` (optional): Mês (1-12)
- `ticker` (optional): Filtrar por ticker

**Response (200):**
```json
{
  "period": "MONTHLY",
  "periodLabel": "Março/2026",
  "totalReceived": 1500.00,
  "totalReceivedGross": 1700.00,
  "totalWithholdingTax": 200.00,
  "yieldOnCost": 8.00,
  "totalInvested": 100000.00,
  "projection12Months": 18000.00,
  "byTicker": [
    { "ticker": "PETR4", "total": 800.00, "count": 4 },
    { "ticker": "ITUB4", "total": 700.00, "count": 3 }
  ],
  "byType": [
    { "type": "DIVIDEND", "total": 1000.00, "count": 5 },
    { "type": "JCP", "total": 300.00, "count": 1 },
    { "type": "RENDIMENTO", "total": 200.00, "count": 1 }
  ],
  "byMonth": [
    { "month": "2026-01", "total": 500.00 },
    { "month": "2026-02", "total": 450.00 },
    { "month": "2026-03", "total": 550.00 }
  ]
}
```

### 4.5 DELETE /api/dividends/:dividendId

**Descrição:** Realiza soft delete de um provento

**Response (200):**
```json
{
  "dividend": {
    "_id": "uuid",
    "status": "DELETED",
    "updatedAt": "2026-03-27T10:00:00.000Z"
  }
}
```

## 5. Fluxos de Dados

### 5.1 Criação de Provento Manual

```
┌─────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────┐
│ Frontend│     │ dividend-    │     │ dividend-       │     │ MongoDB  │
│         │     │   router     │     │   manager       │     │          │
└────┬────┘     └──────┬───────┘     └────────┬────────┘     └────┬─────┘
     │                 │                       │                   │
     │ POST /dividends │                       │                   │
     │────────────────>│                       │                   │
     │                 │                       │                   │
     │                 │ createDividend()      │                   │
     │                 │──────────────────────>│                   │
     │                 │                       │                   │
     │                 │                       │ Validações        │
     │                 │                       │ Cálculo total     │
     │                 │                       │ Cálculo IR (JCP)  │
     │                 │                       │                   │
     │                 │                       │ create()          │
     │                 │                       │──────────────────>│
     │                 │                       │                   │
     │                 │                       │<──────────────────│
     │                 │                       │                   │
     │                 │                       │ invalidateCache() │
     │                 │                       │──────────────────>│ Redis
     │                 │                       │                   │
     │                 │<──────────────────────│                   │
     │                 │                       │                   │
     │<────────────────│ 201 { dividend }      │                   │
     │                 │                       │                   │
```

### 5.2 Importação de Proventos

```
┌─────────┐  ┌──────────────┐  ┌─────────────────┐  ┌────────────────┐  ┌──────────┐
│ Frontend│  │ dividend-    │  │ dividend-       │  │ dividend-import│  │ APIs Ext.│
│         │  │   router     │  │   manager       │  │   -service     │  │ BRAPI    │
└────┬────┘  └──────┬───────┘  └────────┬────────┘  └───────┬────────┘  └────┬─────┘
     │              │                   │                   │                │
     │ POST /import │                   │                   │                │
     │─────────────>│                   │                   │                │
     │              │                   │                   │                │
     │              │ importDividends() │                   │                │
     │              │──────────────────>│                   │                │
     │              │                   │                   │                │
     │              │                   │ import()          │                │
     │              │                   │──────────────────>│                │
     │              │                   │                   │                │
     │              │                   │                   │ GET dividends │
     │              │                   │                   │───────────────>│
     │              │                   │                   │                │
     │              │                   │                   │<───────────────│
     │              │                   │                   │                │
     │              │                   │                   │ Normalizar     │
     │              │                   │                   │ Deduplicar     │
     │              │                   │                   │                │
     │              │                   │<──────────────────│                │
     │              │                   │                   │                │
     │              │<──────────────────│                   │                │
     │              │                   │                   │                │
     │<─────────────│ 200 { result }    │                   │                │
     │              │                   │                   │                │
```

## 6. Estrutura de Arquivos

```
src/
├── app/
│   └── dividend/
│       ├── dividend-model.js           # Schema Mongoose
│       ├── dividend-dao.js             # Data Access Object
│       ├── dividend-manager.js         # Business Logic
│       ├── dividend-router.js          # HTTP Routes
│       └── dividend-import-service.js  # Importação de APIs
│
├── pages/
│   └── dividends/
│       ├── DividendsPage.jsx           # Página principal
│       ├── components/
│       │   ├── DividendTable.jsx       # Tabela de proventos
│       │   ├── DividendSummaryCards.jsx # Cards de resumo
│       │   ├── DividendChart.jsx       # Gráfico mensal
│       │   ├── DividendFilters.jsx     # Filtros
│       │   └── AddDividendModal.jsx    # Modal de criação
│       └── hooks/
│           └── useDividends.js         # Hook de dados
│
└── services/
    └── dividendService.js              # API client
```

## 7. Ordem de Implementação

| Fase | Story | Descrição | Dependências |
|------|-------|-----------|--------------|
| 1 | EP11-001 | Registrar Proventos (Manual e Importação) | EP03, EP04, EP13 |
| 2 | EP11-002 | Proventos Não Alteram Posição | EP11-001, EP05 |
| 3 | EP11-003 | Visualização com Métricas | EP11-001, EP05 |

### Detalhamento por Fase:

**Fase 1 - EP11-001 (8 story points)**
1. Criar `dividend-model.js` com schema e índices
2. Criar `dividend-dao.js` com CRUD e agregações
3. Criar `dividend-import-service.js` para integração com APIs
4. Criar `dividend-manager.js` com lógica de negócio
5. Criar `dividend-router.js` com endpoints REST
6. Testes unitários e de integração

**Fase 2 - EP11-002 (3 story points)**
1. Criar testes de regressão para garantir isolamento
2. Documentar regra arquitetural de separação
3. Adicionar verificação no code review checklist

**Fase 3 - EP11-003 (8 story points)**
1. Implementar agregações MongoDB para summary
2. Implementar cache Redis para summary
3. Criar componentes frontend (DividendsPage, Cards, Table, Chart)
4. Criar hooks e services frontend
5. Testes de performance (< 2s para 5 anos de dados)

## 8. Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| API não retorna todos os proventos históricos | Alta | Médio | Permitir cadastro manual como complemento |
| Duplicatas de proventos na importação | Média | Médio | Índice único composto + deduplicação na importação |
| Valores de JCP com IR retido inconsistentes entre fontes | Média | Alto | Usar sempre valor bruto + calcular IR (15%) no sistema |
| Performance de agregação com grande volume | Baixa | Médio | Índices compostos + cache Redis por período |
| Proventos de ativos internacionais em moeda estrangeira | Média | Médio | Armazenar em moeda original + converter via câmbio do dia |
| Futuro PR acidentalmente acoplando proventos a posições | Baixa | Crítico | Teste de regressão automatizado + code review checklist |

## 9. Dependências

### Dependências de Épicos Anteriores:
- **EP03 (Carteiras)**: Proventos são vinculados a carteiras
- **EP04 (Transações)**: Posições existentes para cálculo de yield on cost
- **EP05 (Preço Médio)**: Preço médio usado no cálculo de yield on cost
- **EP13 (Fontes de Dados)**: APIs para importação de proventos

### Dependências de Pacotes npm:
- `mongoose`: ODM para MongoDB
- `uuid`: Geração de IDs únicos
- `axios`: Requisições HTTP para APIs externas
- `json-log-middleware`: Logging estruturado
- `interact-utils`: Exception handling e Authorizer

### Dependências de Infraestrutura:
- MongoDB (coleção `dividends`)
- Redis (cache de summary)

## 10. Checklist de Implementação

### Backend
- [ ] Criar `dividend-model.js` com schema completo
- [ ] Criar índices únicos e de performance
- [ ] Implementar `dividend-dao.js` com CRUD
- [ ] Implementar agregações MongoDB (summary, byTicker, byType, byMonth)
- [ ] Implementar `dividend-import-service.js`
- [ ] Implementar `dividend-manager.js` com validações
- [ ] Implementar cálculo de IR para JCP (15%)
- [ ] Implementar detecção de isenção para FII
- [ ] Implementar cache Redis para summary
- [ ] Implementar invalidação de cache
- [ ] Criar `dividend-router.js` com todos os endpoints
- [ ] Adicionar documentação Swagger
- [ ] Testes unitários com cobertura >= 90%
- [ ] Testes de integração

### Frontend
- [ ] Criar `DividendsPage.jsx`
- [ ] Criar `DividendTable.jsx` com paginação
- [ ] Criar `DividendSummaryCards.jsx`
- [ ] Criar `DividendChart.jsx` (gráfico de barras)
- [ ] Criar `DividendFilters.jsx`
- [ ] Criar `AddDividendModal.jsx`
- [ ] Criar `dividendService.js`
- [ ] Criar hooks customizados
- [ ] Implementar skeleton loading
- [ ] Testes de responsividade

### QA
- [ ] Validar criação manual de proventos
- [ ] Validar importação de proventos
- [ ] Validar detecção de duplicatas
- [ ] Validar cálculo de IR para JCP
- [ ] Validar isenção para FII
- [ ] Validar yield on cost
- [ ] Validar performance (< 2s para 5 anos)
- [ ] Validar cache Redis
- [ ] Validar que proventos não alteram posições

### Code Review
- [ ] Verificar separação arquitetural (dividend-manager não importa position-dao para escrita)
- [ ] Verificar índices MongoDB
- [ ] Verificar tratamento de erros
- [ ] Verificar logging adequado
- [ ] Verificar testes de regressão

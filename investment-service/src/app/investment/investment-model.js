const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const transactionSchema = new mongoose.Schema({
  type: { type: String, enum: ['BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'SPLIT', 'OTHER'], required: true },
  date: { type: Date, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  fees: { type: Number, default: 0 },
  notes: { type: String },
}, { versionKey: false, _id: false })

const investmentModelSchema = new mongoose.Schema({
  _id: { type: String, required: true, default: uuidv4 },
  domain: { type: String, required: true },
  portfolioId: { type: String, required: true },
  symbol: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['STOCK', 'BOND', 'FUND', 'ETF', 'CRYPTO', 'REAL_ESTATE', 'FIXED_INCOME', 'OTHER'], required: true },
  status: { type: String, enum: ['ACTIVE', 'SOLD', 'MATURED', 'CANCELLED'], default: 'ACTIVE' },
  currency: { type: String, default: 'BRL' },
  quantity: { type: Number, default: 0 },
  averagePrice: { type: Number, default: 0 },
  currentPrice: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
  currentValue: { type: Number, default: 0 },
  profitLoss: { type: Number, default: 0 },
  profitLossPercent: { type: Number, default: 0 },
  transactions: [transactionSchema],
  purchaseDate: { type: Date },
  saleDate: { type: Date },
  maturityDate: { type: Date },
  interestRate: { type: Number },
  broker: { type: String },
  notes: { type: String },
  tags: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
}, { versionKey: false })

investmentModelSchema.index({ 'domain': 1, 'portfolioId': 1 })
investmentModelSchema.index({ 'domain': 1, 'symbol': 1 })

module.exports = { investmentModelSchema }

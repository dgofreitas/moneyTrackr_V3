const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const positionSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    default: uuidv4,
  },
  walletId: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  ticker: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  },
  quantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  averagePrice: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalInvested: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalFees: {
    type: Number,
    default: 0,
    min: 0,
  },
  currency: {
    type: String,
    default: 'BRL',
    enum: ['BRL', 'USD', 'EUR'],
  },
  status: {
    type: String,
    default: 'ACTIVE',
    enum: ['ACTIVE', 'CLOSED'],
  },
  lastTransactionDate: {
    type: Date,
    default: null,
  },
}, {
  versionKey: false,
  timestamps: true,
})

// Unique index: one asset per wallet per user
positionSchema.index({ walletId: 1, userId: 1, ticker: 1 }, { unique: true })
positionSchema.index({ walletId: 1, userId: 1, status: 1 })

module.exports = { positionSchema }

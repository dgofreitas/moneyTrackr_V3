const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const transactionSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    default: uuidv4,
  },
  walletId: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  ticker: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    maxlength: 20,
  },
  type: {
    type: String,
    required: true,
    enum: ['BUY', 'SELL'],
  },
  quantity: {
    type: Number,
    required: true,
    min: 0.00000001,
  },
  price: {
    type: Number,
    required: true,
    min: 0.00000001,
  },
  fees: {
    type: Number,
    default: 0,
    min: 0,
  },
  date: {
    type: Date,
    required: true,
  },
  currency: {
    type: String,
    default: 'BRL',
    enum: ['BRL', 'USD', 'EUR'],
  },
  notes: {
    type: String,
    maxlength: 500,
    default: '',
  },
  realizedPnL: {
    type: Number,
    default: null,
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
}, {
  versionKey: false,
  timestamps: true,
})

// Compound indexes for frequent queries
transactionSchema.index({ walletId: 1, userId: 1, isDeleted: 1, date: -1 })
transactionSchema.index({ walletId: 1, userId: 1, ticker: 1, isDeleted: 1, date: 1 })
transactionSchema.index({ walletId: 1, userId: 1, type: 1, isDeleted: 1 })

module.exports = { transactionSchema }

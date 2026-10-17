const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const walletSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    default: uuidv4,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
  },
  currency: {
    type: String,
    enum: ['BRL', 'USD', 'EUR'],
    default: 'BRL',
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  versionKey: false,
})

// Indexes
walletSchema.index(
  { userId: 1, name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
)
walletSchema.index({ userId: 1, isActive: 1 })
walletSchema.index({ userId: 1, isDeleted: 1 })

module.exports = { walletSchema }

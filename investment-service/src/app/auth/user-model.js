const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const userSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    default: uuidv4,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100,
  },
  password: {
    type: String,
    default: null,
  },
  googleId: {
    type: String,
    default: null,
    sparse: true,
    unique: true,
  },
  avatar: {
    type: String,
    default: null,
  },
  provider: {
    type: String,
    enum: ['local', 'google', 'both'],
    default: 'local',
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'blocked'],
    default: 'active',
  },
  lastLoginAt: {
    type: Date,
    default: null,
  },
  loginAttempts: {
    type: Number,
    default: 0,
  },
  lockedUntil: {
    type: Date,
    default: null,
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
  timestamps: true,
})

// Indices
userSchema.index({ email: 1 }, { unique: true })
userSchema.index({ googleId: 1 }, { sparse: true, unique: true })
userSchema.index({ status: 1 })

module.exports = { userSchema }

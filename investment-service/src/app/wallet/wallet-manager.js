const WalletDAO = require('./wallet-dao')
const APP_CONSTANTS = require('../app-constants')
const { JsonLog } = require('json-log-middleware')
const logger = new JsonLog(APP_CONSTANTS.SERVICE_NAME)

class WalletManager {

  constructor(appManager, appDB) {
    this.appDB = appDB
    this.walletDAO = new WalletDAO(this.appDB.getDb())
    this.appManager = appManager
    this.handleError = appManager.handleError.bind(appManager)
    this.redisClient = appManager.getRedisClient()
  }

  inicialize(_appManager) {
    logger.log('WalletManager inicializado', { internal: { method: 'inicialize', filename: 'wallet-manager.js' } })
  }

  // ==================== CRIAR CARTEIRA ====================

  async create({ userId, name, currency = 'BRL' }) {
    logger.log('Criando carteira', { userId, name, currency, internal: { method: 'create', filename: 'wallet-manager.js' } })

    // Validar nome
    this._validateName(name)

    // Verificar nome unico (case-insensitive)
    const existingWallet = await this.walletDAO.findByUserIdAndName(userId, name)
    if (existingWallet) {
      this.handleError(APP_CONSTANTS.ERRORS.WALLET_ALREADY_EXISTS)
    }

    // Verificar se e a primeira carteira
    const walletCount = await this.walletDAO.countByUserId(userId)
    const isFirstWallet = walletCount === 0

    // Criar carteira
    const wallet = await this.walletDAO.create({
      userId,
      name: name.trim(),
      currency,
      isActive: isFirstWallet, // Primeira carteira e ativa por padrao
      isDeleted: false,
    })

    // Invalidar cache
    await this._invalidateUserCache(userId)

    return wallet
  }

  // ==================== LISTAR CARTEIRAS ====================

  async listByUser({ userId }) {
    logger.log('Listando carteiras', { userId, internal: { method: 'listByUser', filename: 'wallet-manager.js' } })
    return await this.walletDAO.findByUserId(userId)
  }

  // ==================== OBTER CARTEIRA POR ID ====================

  async getById({ userId, walletId }) {
    logger.log('Buscando carteira por ID', { userId, walletId, internal: { method: 'getById', filename: 'wallet-manager.js' } })

    const wallet = await this.walletDAO.findById(walletId)
    if (!wallet || wallet.userId !== userId || wallet.isDeleted) {
      this.handleError(APP_CONSTANTS.ERRORS.WALLET_NOT_FOUND)
    }
    return wallet
  }

  // ==================== ATIVAR CARTEIRA ====================

  async activate({ userId, walletId }) {
    logger.log('Ativando carteira', { userId, walletId, internal: { method: 'activate', filename: 'wallet-manager.js' } })

    // Verificar se a carteira existe e pertence ao usuario
    const wallet = await this.walletDAO.findById(walletId)
    if (!wallet || wallet.userId !== userId || wallet.isDeleted) {
      this.handleError(APP_CONSTANTS.ERRORS.WALLET_NOT_FOUND)
    }

    // Desativar todas as carteiras do usuario
    await this.walletDAO.deactivateAll(userId)

    // Ativar a carteira selecionada
    const activatedWallet = await this.walletDAO.activate(walletId, userId)

    // Atualizar cache Redis
    await this._setActiveWalletCache(userId, walletId)

    // Invalidar cache de lista
    await this._invalidateUserCache(userId)

    return activatedWallet
  }

  // ==================== EDITAR CARTEIRA ====================

  async update({ userId, walletId, name, currency }) {
    logger.log('Editando carteira', { userId, walletId, name, currency, internal: { method: 'update', filename: 'wallet-manager.js' } })

    // Verificar se a carteira existe
    const wallet = await this._getWalletForUser(walletId, userId)

    const updateData = {}

    // Validar e atualizar nome
    if (name && name !== wallet.name) {
      await this._validateAndUpdateName(userId, walletId, name, updateData)
    }

    // Validar e atualizar moeda
    if (currency && currency !== wallet.currency) {
      await this._validateAndUpdateCurrency(walletId, currency, updateData)
    }

    // Atualizar carteira
    const updatedWallet = await this.walletDAO.update(walletId, userId, updateData)

    // Invalidar cache
    await this._invalidateUserCache(userId)

    return updatedWallet
  }

  async _getWalletForUser(walletId, userId) {
    const wallet = await this.walletDAO.findById(walletId)
    if (!wallet || wallet.userId !== userId || wallet.isDeleted) {
      this.handleError(APP_CONSTANTS.ERRORS.WALLET_NOT_FOUND)
    }
    return wallet
  }

  async _validateAndUpdateName(userId, walletId, name, updateData) {
    this._validateName(name)

    // Verificar nome unico
    const existingWallet = await this.walletDAO.findByUserIdAndName(userId, name)
    if (existingWallet && existingWallet._id !== walletId) {
      this.handleError(APP_CONSTANTS.ERRORS.WALLET_ALREADY_EXISTS)
    }

    updateData.name = name.trim()
  }

  async _validateAndUpdateCurrency(walletId, currency, updateData) {
    // Verificar se ha transacoes na carteira
    const hasTransactions = await this._hasTransactions(walletId)
    if (hasTransactions) {
      this.handleError(APP_CONSTANTS.ERRORS.WALLET_CANNOT_CHANGE_CURRENCY)
    }
    updateData.currency = currency
  }

  // ==================== EXCLUIR CARTEIRA ====================

  async delete({ userId, walletId }) {
    logger.log('Excluindo carteira', { userId, walletId, internal: { method: 'delete', filename: 'wallet-manager.js' } })

    // Verificar se a carteira existe
    const wallet = await this.walletDAO.findById(walletId)
    if (!wallet || wallet.userId !== userId || wallet.isDeleted) {
      this.handleError(APP_CONSTANTS.ERRORS.WALLET_NOT_FOUND)
    }

    // Verificar se e a unica carteira
    const walletCount = await this.walletDAO.countByUserId(userId)
    if (walletCount <= 1) {
      this.handleError(APP_CONSTANTS.ERRORS.WALLET_CANNOT_DELETE_ONLY)
    }

    // Soft delete
    const deletedWallet = await this.walletDAO.softDelete(walletId, userId)

    // Se a carteira era ativa, ativar outra
    let activatedWallet = null
    if (wallet.isActive) {
      const oldestWallet = await this.walletDAO.findOldestActive(userId)
      if (oldestWallet) {
        activatedWallet = await this.walletDAO.activate(oldestWallet._id, userId)
        await this._setActiveWalletCache(userId, oldestWallet._id)
      }
    }

    // Invalidar cache
    await this._invalidateUserCache(userId)

    return {
      deleted: deletedWallet,
      activated: activatedWallet,
    }
  }

  // ==================== VISAO CONSOLIDADA ====================

  async getConsolidated({ userId }) {
    logger.log('Obtendo visao consolidada', { userId, internal: { method: 'getConsolidated', filename: 'wallet-manager.js' } })

    // Buscar todas as carteiras do usuario
    const wallets = await this.walletDAO.findByUserId(userId)

    // Para cada carteira, calcular subtotal
    const consolidatedWallets = []
    let totalBRL = 0

    for (const wallet of wallets) {
      const subtotal = await this._calculateWalletSubtotal(wallet)

      // Converter para BRL se necessario
      let subtotalBRL = subtotal
      let exchangeRate = null

      if (wallet.currency !== 'BRL') {
        // TODO: Integrar com EP06 (Cambio) para conversao
        // Por enquanto, retorna null indicando conversao indisponivel
        subtotalBRL = null
      }

      consolidatedWallets.push({
        _id: wallet._id,
        name: wallet.name,
        currency: wallet.currency,
        subtotalOriginal: subtotal,
        subtotalBRL,
        exchangeRate,
      })

      if (subtotalBRL !== null) {
        totalBRL += subtotalBRL
      }
    }

    return {
      totalBRL,
      exchangeRateDate: new Date().toISOString().split('T')[0],
      exchangeAvailable: true, // TODO: Verificar disponibilidade do servico de cambio
      wallets: consolidatedWallets,
    }
  }

  // ==================== HELPERS ====================

  _validateName(name) {
    if (!name || name.trim().length === 0) {
      this.handleError(APP_CONSTANTS.ERRORS.WALLET_NAME_REQUIRED)
    }
    if (name.trim().length > 50) {
      this.handleError(APP_CONSTANTS.ERRORS.WALLET_NAME_TOO_LONG)
    }
  }

  async _hasTransactions(_walletId) {
    // TODO: Integrar com TransactionDAO do EP04
    // Por enquanto, retorna false
    return false
  }

  async _calculateWalletSubtotal(_wallet) {
    // TODO: Integrar com PositionManager do EP05
    // Por enquanto, retorna 0
    return 0
  }

  async _setActiveWalletCache(userId, walletId) {
    try {
      const key = `activeWallet:${userId}`
      await this.redisClient.set(key, walletId, { EX: 86400 }) // 24 horas
    } catch (_) {
      // Ignore cache errors in test environment
    }
  }

  async _invalidateUserCache(userId) {
    try {
      const pattern = `wallets:${userId}:*`
      const keys = await this.redisClient.keys(pattern)
      if (keys && keys.length > 0) {
        await this.redisClient.del(keys)
      }
    } catch (_) {
      // Ignore cache errors in test environment
    }
  }
}

module.exports = WalletManager

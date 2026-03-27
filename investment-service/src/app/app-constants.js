const APP_CONSTANTS = {
  SERVICE_NAME: 'investment-service',
  VERSION: '1.0.0',
  ERRORS: {
    SERVER_ERROR: {
      statusCode: 500,
      code: 'SERVER_ERROR',
      message: 'Server error',
    },
    NOT_FOUND: {
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Resource not found',
    },
    VALIDATION_ERROR: {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid data',
    },
    INVESTMENT_EXIST: {
      statusCode: 400,
      code: 'INVESTMENT_EXIST',
      message: 'Investment already exists',
    },
    INVALID_DATA: {
      statusCode: 400,
      code: 'INVALID_DATA',
      message: 'Invalid data',
    },
    INVALID_PERMISSIONS: {
      statusCode: 403,
      code: 'INVALID_PERMISSIONS',
      message: 'Invalid permissions',
    },
    INACTIVE_DOMAIN: {
      statusCode: 403,
      code: 'INACTIVE_DOMAIN',
      message: 'Inactive domain',
    },
    DOMAIN_BLOCKED: {
      statusCode: 403,
      code: 'DOMAIN_BLOCKED',
      message: 'Domain blocked',
    },
    INVESTMENT_NOT_FOUND: {
      statusCode: 404,
      code: 'INVESTMENT_NOT_FOUND',
      message: 'Investment not found',
    },
    PORTFOLIO_NOT_FOUND: {
      statusCode: 404,
      code: 'PORTFOLIO_NOT_FOUND',
      message: 'Portfolio not found',
    },
    DOMAIN_NOT_FOUND: {
      statusCode: 404,
      code: 'DOMAIN_NOT_FOUND',
      message: 'Domain not found',
    },
    INVESTMENT_CREATE_ERROR: {
      statusCode: 500,
      code: 'INVESTMENT_CREATE_ERROR',
      message: 'Investment create error',
    },
    INVESTMENT_UPDATE_ERROR: {
      statusCode: 500,
      code: 'INVESTMENT_UPDATE_ERROR',
      message: 'Investment update error',
    },
    INVESTMENT_DELETE_ERROR: {
      statusCode: 500,
      code: 'INVESTMENT_DELETE_ERROR',
      message: 'Investment delete error',
    },
    INVESTMENT_FETCH_ERROR: {
      statusCode: 500,
      code: 'INVESTMENT_FETCH_ERROR',
      message: 'Investment fetch error',
    },
    // Wallet errors
    WALLET_NAME_REQUIRED: {
      statusCode: 400,
      code: 'WALLET_NAME_REQUIRED',
      message: 'Nome da carteira é obrigatório',
    },
    WALLET_NAME_TOO_LONG: {
      statusCode: 400,
      code: 'WALLET_NAME_TOO_LONG',
      message: 'Nome da carteira deve ter no máximo 50 caracteres',
    },
    WALLET_ALREADY_EXISTS: {
      statusCode: 409,
      code: 'WALLET_ALREADY_EXISTS',
      message: 'Já existe uma carteira com este nome',
    },
    WALLET_NOT_FOUND: {
      statusCode: 404,
      code: 'WALLET_NOT_FOUND',
      message: 'Carteira não encontrada',
    },
    WALLET_CANNOT_DELETE_ONLY: {
      statusCode: 422,
      code: 'WALLET_CANNOT_DELETE_ONLY',
      message: 'Não é possível excluir a única carteira',
    },
    WALLET_CANNOT_CHANGE_CURRENCY: {
      statusCode: 422,
      code: 'WALLET_CANNOT_CHANGE_CURRENCY',
      message: 'Não é possível alterar a moeda de uma carteira com transações',
    },
  },
  INVESTMENT_TYPES: {
    STOCK: 'STOCK',
    BOND: 'BOND',
    FUND: 'FUND',
    ETF: 'ETF',
    CRYPTO: 'CRYPTO',
    REAL_ESTATE: 'REAL_ESTATE',
    FIXED_INCOME: 'FIXED_INCOME',
    OTHER: 'OTHER',
  },
  INVESTMENT_STATUS: {
    ACTIVE: 'ACTIVE',
    SOLD: 'SOLD',
    MATURED: 'MATURED',
    CANCELLED: 'CANCELLED',
  },
}

module.exports = Object.freeze(APP_CONSTANTS)

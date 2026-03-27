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
    // Auth errors
    INVALID_CREDENTIALS: {
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Email ou senha incorretos',
    },
    TOKEN_NOT_PROVIDED: {
      statusCode: 401,
      code: 'TOKEN_NOT_PROVIDED',
      message: 'Token nao fornecido',
    },
    TOKEN_EXPIRED: {
      statusCode: 401,
      code: 'TOKEN_EXPIRED',
      message: 'Token expirado',
    },
    TOKEN_INVALID: {
      statusCode: 401,
      code: 'TOKEN_INVALID',
      message: 'Token invalido',
    },
    SESSION_INVALID: {
      statusCode: 401,
      code: 'SESSION_INVALID',
      message: 'Sessao invalida',
    },
    EMAIL_ALREADY_EXISTS: {
      statusCode: 409,
      code: 'EMAIL_ALREADY_EXISTS',
      message: 'Este email ja esta cadastrado',
    },
    ACCOUNT_LOCKED: {
      statusCode: 429,
      code: 'ACCOUNT_LOCKED',
      message: 'Muitas tentativas. Tente novamente em 15 minutos.',
    },
    INVALID_RESET_TOKEN: {
      statusCode: 400,
      code: 'INVALID_RESET_TOKEN',
      message: 'Link invalido ou ja utilizado',
    },
    RESET_TOKEN_EXPIRED: {
      statusCode: 400,
      code: 'RESET_TOKEN_EXPIRED',
      message: 'Link expirado. Solicite um novo link.',
    },
    INVALID_PASSWORD_FORMAT: {
      statusCode: 400,
      code: 'INVALID_PASSWORD_FORMAT',
      message: 'Senha nao atende aos requisitos minimos',
    },
    USER_NOT_FOUND: {
      statusCode: 404,
      code: 'USER_NOT_FOUND',
      message: 'Usuario nao encontrado',
    },
    GOOGLE_AUTH_FAILED: {
      statusCode: 401,
      code: 'GOOGLE_AUTH_FAILED',
      message: 'Falha na autenticacao com Google',
    },
    NAME_REQUIRED: {
      statusCode: 400,
      code: 'NAME_REQUIRED',
      message: 'Nome e obrigatorio',
    },
    NAME_TOO_SHORT: {
      statusCode: 400,
      code: 'NAME_TOO_SHORT',
      message: 'Nome deve ter no minimo 2 caracteres',
    },
    INVALID_EMAIL: {
      statusCode: 400,
      code: 'INVALID_EMAIL',
      message: 'Email invalido',
    },
    EMAIL_REQUIRED: {
      statusCode: 400,
      code: 'EMAIL_REQUIRED',
      message: 'Email e obrigatorio',
    },
    PASSWORD_TOO_SHORT: {
      statusCode: 400,
      code: 'PASSWORD_TOO_SHORT',
      message: 'Senha deve ter no minimo 8 caracteres',
    },
    PASSWORD_REQUIRED: {
      statusCode: 400,
      code: 'PASSWORD_REQUIRED',
      message: 'Senha e obrigatoria',
    },
    PASSWORDS_DONT_MATCH: {
      statusCode: 400,
      code: 'PASSWORDS_DONT_MATCH',
      message: 'As senhas nao conferem',
    },
    AUTH_ERROR: {
      statusCode: 500,
      code: 'AUTH_ERROR',
      message: 'Erro na autenticacao',
    },
    RATE_LIMIT_EXCEEDED: {
      statusCode: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Muitas solicitacoes. Tente novamente mais tarde.',
    },
    JWT_SECRET_NOT_CONFIGURED: {
      statusCode: 500,
      code: 'JWT_SECRET_NOT_CONFIGURED',
      message: 'JWT_SECRET nao configurado',
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

/*eslint-env jest*/

// Set JWT_SECRET before any modules are loaded
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-purposes'

// Mock interact-utils before any module imports it
jest.mock('interact-utils', () => {
  const Permissions = {
    AGENT_MODULE: 'NEO_AGENT_MODULE',
    AGENT_SETTINGS: 'NEO_AGENT_SETTINGS',
    SERVICES: 'NEO_SERVICES',
    DASHBOARD: 'NEO_DASHBOARD',
    SUBMEDIAS: 'NEO_SUBMEDIAS',
    REPORTS: 'NEO_REPORTS',
    GENERAL_SETTINGS: 'NEO_GENERAL_SETTINGS',
    SYSTEM_SETTINGS: 'NEO_SYSTEM_SETTINGS',
    PARTNER_SETTINGS: 'NEO_PARTNER_SETTINGS',
  }

  class Authorizer {
    static getMiddleware(_permission) {
      return (req, res, next) => {
        req.credentials = {
          domain: 'test',
          login: 'testuser',
          permissions: ['NEO_SERVICES'],
        }
        next()
      }
    }
  }

  return {
    Permissions,
    Authorizer,
  }
})

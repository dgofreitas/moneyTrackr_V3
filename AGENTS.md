# AGENTS.md - Coding Agent Guidelines

This document provides guidelines for AI coding agents working in this repository.

## Project Overview

This is a Node.js microservice repository containing `dialer-service`, a call center dialer application built with Express.js, MongoDB (Mongoose), and Redis.

## Build, Lint, and Test Commands

### Running Tests
```bash
# Run all tests
yarn test

# Run tests silently (no console output)
yarn testSilent

# Run a single test file
yarn jest --testPathPattern=mailing.test.js

# Run a specific test by name pattern
yarn jest --testNamePattern="should create mailing"
```

### Linting
```bash
# Run ESLint on entire project
yarn lint

# Run ESLint on specific file
yarn eslint src/app/mailing/mailing-manager.js
```

### Running the Service
```bash
# Production mode
yarn start

# Development mode (enables Swagger docs at /docs)
yarn dev
```

## Code Style Guidelines

### General Rules (from .eslintrc.js)

- **No semicolons** - Do not use `;` at end of statements
- **Single quotes** - Use `'single quotes'` not `"double quotes"`
- **2-space indentation** - Use 2 spaces for all indentation
- **No `var`** - Always use `const` or `let`
- **camelCase** - Variables and functions must use camelCase
- **Arrow functions** - Always use parentheses: `(x) => x` not `x => x`
- **Trailing commas** - Required in multiline objects/arrays
- **Unix line breaks** - LF only, no CRLF
- **Strict mode** - Code should run in strict mode

### Complexity Limits
- Max cyclomatic complexity: 10
- Max nesting depth: 4
- Max nested callbacks: 3
- Max 1 statement per line

### Spacing Rules
- Space before blocks: `if () {`
- Space before function parens (anonymous): `function () {`
- No space in function call: `func()`
- Space after keywords: `if ()`, `while ()`
- Space around operators: `a + b`
- Space after colons: `key: value`
- No trailing spaces

### Import Style
```javascript
// Node built-ins first
const path = require('path')
const fs = require('fs')

// External packages second
const express = require('express')
const mongoose = require('mongoose')

// Internal modules last
const APP_CONSTANTS = require('../app-constants')
const MailingDAO = require('./mailing-dao')
```

## Architecture Patterns

### Layered Architecture
The codebase follows a layered architecture pattern:

1. **Router** (`*-router.js`) - HTTP route handlers, request validation
2. **Manager** (`*-manager.js`) - Business logic, orchestrates DAOs
3. **DAO** (`*-dao.js`) - Data access, database operations
4. **Model** (`*-model.js`) - Mongoose schemas and models

### File Naming
- Files use kebab-case: `mailing-manager.js`, `contact-dao.js`
- Classes use PascalCase: `MailingManager`, `ContactDAO`
- Constants files: `app-constants.js`

### Class Structure
```javascript
class ExampleManager {
  constructor(appManager, appDB) {
    this.appDB = appDB
    this.exampleDAO = new ExampleDAO(this.appDB.getDb())
  }

  async doSomething({ domain, data }) {
    // Business logic here
  }
}

module.exports = ExampleManager
```

### Error Handling
Use the `Exception` class from `interact-utils` and predefined error constants:

```javascript
const { Exception } = require('interact-utils')
const APP_CONSTANTS = require('../app-constants')

// Throwing errors
throw new Exception(
  APP_CONSTANTS.ERRORS.MAILING_NOT_FOUND.statusCode,
  APP_CONSTANTS.ERRORS.MAILING_NOT_FOUND.message
)

// In managers, use handleError
this.handleError(APP_CONSTANTS.ERRORS.CONTACT_NOT_FOUND)
```

### Constants
All constants are defined in `src/app/app-constants.js`:

```javascript
const APP_CONSTANTS = require('./app-constants')
const { SERVICE_NAME, ERRORS } = APP_CONSTANTS
```

## Testing Guidelines

### Test File Location
Tests are in `src/__tests__/` directory with `.test.js` extension.

### Test Structure
```javascript
/*eslint-env jest*/
jest.setTimeout(60000)

const AppTest = require('../__mocks__/app-base-test.js')

describe('Feature Name', () => {
  let appTest, loggedAgent

  beforeAll(async () => {
    appTest = await AppTest.createApp(config)
    loggedAgent = await AppTest.createAgent(appTest, credentials)
  })

  beforeEach(async () => {
    await AppTest.clearMocks(appTest)
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    await AppTest.flushPromises()
  })

  afterAll(async () => {
    await AppTest.clearApp(appTest)
  })

  it('should do something', async () => {
    const response = await loggedAgent.post('/api/endpoint').send(data)
    expect(response.status).toBe(201)
  })
})
```

### Test Utilities
- Use `supertest` via `loggedAgent` for API testing
- Use `AppTest.flushPromises(ms)` to wait for async operations
- Mock external services with files in `src/__mocks__/`

## Logging

Use `json-log-middleware` for structured logging:

```javascript
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app-constants')
const logger = new JsonLog(SERVICE_NAME)

// Info log
logger.log('Operation message', { domain, internal: { method: 'methodName', filename: 'file.js' } })

// Error log
logger.error('Error message', error, { domain, internal: { method: 'methodName', filename: 'file.js' } })
```

## Database (MongoDB/Mongoose)

### Schema Definition
```javascript
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const schema = new mongoose.Schema({
  _id: { type: String, required: true, default: uuidv4 },
  domain: { type: String, required: true },
  status: { type: String, default: 'CREATED' },
}, { versionKey: false })

module.exports = { schema }
```

### DAO Pattern
```javascript
class ExampleDAO extends AppDAO {
  constructor(db) {
    super(db)
  }

  initializeDBModel(db) {
    return db.model('example', exampleSchema)
  }

  async findOne(query) {
    return await this.objectModel.findOne(query).lean().exec()
  }
}
```

## Express Router Pattern

```javascript
class ExampleRouter {
  static handleError(exception, res) {
    res.status(exception.statusCode || 500).send(exception.message || 'Server Error')
  }

  static getPublicRoutes(appManager) {
    const router = express.Router()
    const manager = appManager.getExampleManager()

    router.post('/example', Authorizer.getMiddleware(Permissions.SERVICES), async (req, res) => {
      try {
        const domain = req.credentials.domain
        const result = await manager.doSomething({ domain, data: req.body })
        res.status(201).send(result)
      } catch (exception) {
        ExampleRouter.handleError(exception, res)
      }
    })

    return router
  }
}

module.exports = ExampleRouter
```

## Environment Variables

Key environment variables:
- `NODE_ENV` - Environment mode (`dev`, `test`, `production`)
- `DATABASE_URL_DIALER` - MongoDB connection URL
- `DATABASE_NAME_PREFIX` - Database name prefix
- `DIALER_ID` - Dialer instance identifier
- `LOCAL_STORAGE_PATH` - Local file storage path

## Notes

- Always run `yarn lint` after making changes
- Tests use `@shelf/jest-mongodb` for in-memory MongoDB
- The service uses Redis pub/sub for inter-service communication
- Authorization is handled via `interact-utils` `Authorizer` middleware

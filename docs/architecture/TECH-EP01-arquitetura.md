# Plano Tecnico - EP01: Arquitetura e Infraestrutura Base

## 1. Visao Geral da Arquitetura

```
+------------------------------------------------------------------+
|                        DOCKER HOST                                |
+------------------------------------------------------------------+
|                                                                   |
|  +-------------+     +----------------------------------------+  |
|  |   NGINX     |     |         moneytrackr-network             |  |
|  |   :80       |     |  (bridge network)                       |  |
|  +------+------+     +----------------------------------------+  |
|         |                        |                              |
|         | /api/*                 | /*                           |
|         v                        v                              |
|  +-------------+          +-------------+                      |
|  | investment- |          | investment- |                      |
|  | service      |<-------->| app         |                      |
|  | (Backend)    |          | (Frontend)  |                      |
|  | Node.js:80   |          | Nginx:80    |                      |
|  +------+------+          +-------------+                       |
|         |                                                        |
|         |                                                        |
|         +----------------+----------------+                      |
|         |                |                |                      |
|         v                v                v                      |
|  +-------------+  +-------------+  +-------------+               |
|  |  MongoDB    |  |   Redis     |  |  Volume     |               |
|  |  :27017     |  |   :6379     |  |  (persist)  |               |
|  +-------------+  +-------------+  +-------------+               |
|                                                                   |
+------------------------------------------------------------------+
```

### Diagrama de Fluxo de Requisicao

```
Usuario (Browser)
       |
       | HTTP Request :80
       v
+-------------+
|    NGINX    |  (Proxy Reverso)
+-------------+
       |
       +-- /api/* --> Backend (investment-service:80)
       |                    |
       |                    +-- MongoDB (persistencia)
       |                    +-- Redis (cache/sessao)
       |
       +-- /* -----> Frontend (investment-app:80)
                            |
                            +-- SPA (Vue/React)
                            +-- PWA (manifest + SW)
```

---

## 2. Componentes Backend

### 2.1 Models (Mongoose Schemas)

#### app-constants.js

```javascript
const APP_CONSTANTS = {
  SERVICE_NAME: 'investment-service',
  VERSION: '1.0.0',
  ERRORS: {
    SERVER_ERROR: {
      statusCode: 500,
      code: 'SERVER_ERROR',
      message: 'Erro interno do servidor',
    },
    NOT_FOUND: {
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Recurso nao encontrado',
    },
    VALIDATION_ERROR: {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Dados invalidos',
    },
  },
}

module.exports = Object.freeze(APP_CONSTANTS)
```

### 2.2 DAOs

#### app-dao.js (Base DAO)

```javascript
class AppDAO {
  constructor(db) {
    this.db = db
  }

  initializeDBModel(db) {
    throw new Error('initializeDBModel deve ser implementado pela subclasse')
  }

  async findOne(query) {
    return await this.objectModel.findOne(query).lean().exec()
  }

  async findMany(query, options = {}) {
    let queryBuilder = this.objectModel.find(query)
    if (options.sort) queryBuilder = queryBuilder.sort(options.sort)
    if (options.limit) queryBuilder = queryBuilder.limit(options.limit)
    if (options.skip) queryBuilder = queryBuilder.skip(options.skip)
    return await queryBuilder.lean().exec()
  }

  async create(data) {
    const doc = new this.objectModel(data)
    return await doc.save()
  }

  async updateOne(query, updateData) {
    return await this.objectModel
      .updateOne(query, { $set: updateData })
      .lean()
      .exec()
  }

  async deleteOne(query) {
    return await this.objectModel.deleteOne(query).lean().exec()
  }
}

module.exports = AppDAO
```

### 2.3 Managers

#### app-manager.js

```javascript
const { JsonLog } = require('json-log-middleware')
const APP_CONSTANTS = require('./app-constants')
const AppDB = require('./app-db')

class AppManager {
  constructor() {
    this.logger = new JsonLog(APP_CONSTANTS.SERVICE_NAME)
  }

  async initialize(config) {
    this.config = config

    // Inicializar conexao MongoDB
    this.appDB = new AppDB(config.db)
    await this.appDB.initialize()

    // Inicializar conexao Redis
    this.redisClient = this._createRedisClient(config.redis)

    this.logger.log('Servico inicializado com sucesso', {
      internal: { method: 'initialize', filename: 'app-manager.js' },
    })
  }

  _createRedisClient(redisConfig) {
    const redis = require('redis')
    const client = redis.createClient({
      host: redisConfig.host,
      port: redisConfig.port,
    })
    client.on('error', (err) => {
      this.logger.error('Erro Redis', err, {
        internal: { method: '_createRedisClient', filename: 'app-manager.js' },
      })
    })
    return client
  }

  handleError(errorObj) {
    const { Exception } = require('interact-utils')
    throw new Exception(errorObj.statusCode, errorObj.message)
  }

  getDb() {
    return this.appDB.getDb()
  }

  getRedisClient() {
    return this.redisClient
  }
}

module.exports = AppManager
```

#### app-db.js

```javascript
const mongoose = require('mongoose')

class AppDB {
  constructor(dbConfig) {
    this.config = dbConfig
    this.db = null
  }

  async initialize() {
    const connectionString = this.config.url + this.config.name

    await mongoose.connect(connectionString, {
      serverSelectionTimeoutMS: 5000,
    })

    this.db = mongoose.connection

    this.db.on('error', (err) => {
      console.error('Erro de conexao MongoDB:', err)
    })

    this.db.once('open', () => {
      console.log('Conexao MongoDB estabelecida com sucesso')
    })
  }

  getDb() {
    return this.db
  }

  async disconnect() {
    await mongoose.disconnect()
  }
}

module.exports = AppDB
```

### 2.4 Routers

#### app-router.js

```javascript
const express = require('express')

class AppRouter {
  static getPublicRoutes(appManager) {
    const router = express.Router()

    // Health check endpoint
    router.get('/v1/healthy', (req, res) => {
      res.sendStatus(200)
    })

    return router
  }
}

module.exports = AppRouter
```

#### app-service.js

```javascript
const express = require('express')
const helmet = require('helmet')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const cors = require('cors')
const AppRouter = require('./app-router')
const AppManager = require('./app-manager')

class AppService {
  constructor() {
    this.app = express()
    this.appManager = new AppManager()
  }

  async initialize(config) {
    await this.appManager.initialize(config)
    this._setupMiddlewares()
    this._setupRoutes()
  }

  _setupMiddlewares() {
    this.app.use(helmet())
    this.app.use(cors())
    this.app.use(cookieParser())
    this.app.use(bodyParser.json())
    this.app.use(bodyParser.urlencoded({ extended: false }))
  }

  _setupRoutes() {
    this.app.use('/api', AppRouter.getPublicRoutes(this.appManager))
  }

  getApp() {
    return this.app
  }

  getAppManager() {
    return this.appManager
  }
}

module.exports = AppService
```

---

## 3. Componentes Frontend

### 3.1 Pages

| Pagina | Arquivo | Descricao |
|--------|---------|-----------|
| HomePage | `src/pages/HomePage.vue` | Pagina inicial com welcome message |
| NotFoundPage | `src/pages/NotFoundPage.vue` | Pagina 404 para rotas inexistentes |

### 3.2 Components

#### UI Components

| Componente | Arquivo | Descricao |
|------------|---------|-----------|
| Button | `src/components/ui/Button.vue` | Botao reutilizavel com variantes |
| Card | `src/components/ui/Card.vue` | Container com sombra e bordas |
| Input | `src/components/ui/Input.vue` | Campo de entrada com validacao |
| Loading | `src/components/ui/Loading.vue` | Spinner de carregamento |

#### Layout Components

| Componente | Arquivo | Descricao |
|------------|---------|-----------|
| MainLayout | `src/components/layout/MainLayout.vue` | Layout principal com header e content |
| Header | `src/components/layout/Header.vue` | Cabecalho com logo e navegacao |
| Footer | `src/components/layout/Footer.vue` | Rodape com informacoes |

### 3.3 Services

#### api.js

```javascript
const API_BASE_URL = '/api'

async function request(method, path, data = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  }

  if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
    options.body = JSON.stringify(data)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, options)

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

export default {
  get: (path) => request('GET', path),
  post: (path, data) => request('POST', path, data),
  put: (path, data) => request('PUT', path, data),
  patch: (path, data) => request('PATCH', path, data),
  delete: (path) => request('DELETE', path),
}
```

### 3.4 Store/State

#### app-store.js (Pinia)

```javascript
import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    isLoading: false,
    error: null,
    user: null,
  }),

  actions: {
    setLoading(status) {
      this.isLoading = status
    },

    setError(error) {
      this.error = error
    },

    clearError() {
      this.error = null
    },
  },
})
```

---

## 4. API Contracts

### OpenAPI Specification

```yaml
openapi: 3.0.0
info:
  title: MoneyTrackr API
  version: 1.0.0
  description: API do sistema de gestao de investimentos MoneyTrackr

servers:
  - url: /api
    description: API via Nginx proxy

paths:
  /v1/healthy:
    get:
      summary: Health check do servico
      description: Verifica se o servico esta operacional
      operationId: healthCheck
      responses:
        '200':
          description: Servico saudavel
          content:
            text/plain:
              schema:
                type: string
                example: OK

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

security:
  - bearerAuth: []
```

---

## 5. Fluxos de Dados

### Sequencia: Startup do Servico

```
+--------+    +------------+    +----------+    +-------+
| main.js|    | AppService |    | AppManager|   | MongoDB|
+--------+    +------------+    +----------+    +-------+
    |              |                 |              |
    | initialize() |                 |              |
    |------------->|                 |              |
    |              | initialize()    |              |
    |              |---------------->|              |
    |              |                 | connect()    |
    |              |                 |------------->|
    |              |                 |<-------------|
    |              |                 |   connection |
    |              |<----------------|              |
    |              |   ready         |              |
    |<-------------|                 |              |
    |   app ready  |                 |              |
    |              |                 |              |
    | listen(port) |                 |              |
    |------------->|                 |              |
    |              |                 |              |
```

### Sequencia: Health Check Request

```
+--------+    +-------+    +------------+    +----------+
| Client |    | Nginx |    | AppService |    | AppRouter|
+--------+    +-------+    +------------+    +----------+
    |              |              |               |
    | GET /api/v1/healthy         |               |
    |------------->|              |               |
    |              | proxy_pass   |               |
    |              |------------->|               |
    |              |              | route handler |
    |              |              |-------------->|
    |              |              |               |
    |              |              |   200 OK      |
    |              |              |<--------------|
    |              |  200 OK      |               |
    |              |<-------------|               |
    |  200 OK      |              |               |
    |<-------------|              |               |
```

---

## 6. Estrutura de Arquivos

```
moneyTrackr_V3/
|
|-- docker-compose.yml
|-- nginx/
|   |-- nginx.conf
|
|-- investment-service/
|   |-- Dockerfile
|   |-- .dockerignore
|   |-- .eslintrc.js
|   |-- .eslintignore
|   |-- .gitignore
|   |-- package.json
|   |-- yarn.lock
|   |-- config/
|   |   |-- app.json
|   |-- docs/
|   |   |-- openapi.yml
|   |-- src/
|   |   |-- main.js
|   |   |-- app/
|   |   |   |-- app-constants.js
|   |   |   |-- app-manager.js
|   |   |   |-- app-service.js
|   |   |   |-- app-router.js
|   |   |   |-- app-db.js
|   |   |   |-- app-dao.js
|   |   |-- __tests__/
|   |   |   |-- health.test.js
|   |   |-- __mocks__/
|   |       |-- app-base-test.js
|   |       |-- app.config.js
|
|-- investment-app/
|   |-- Dockerfile
|   |-- nginx.conf
|   |-- .gitignore
|   |-- package.json
|   |-- vite.config.js
|   |-- index.html
|   |-- public/
|   |   |-- manifest.json
|   |   |-- favicon.ico
|   |   |-- icons/
|   |       |-- icon-192.png
|   |       |-- icon-512.png
|   |-- src/
|   |   |-- main.js
|   |   |-- App.vue
|   |   |-- assets/
|   |   |   |-- styles/
|   |   |       |-- main.css
|   |   |-- components/
|   |   |   |-- ui/
|   |   |   |   |-- Button.vue
|   |   |   |   |-- Card.vue
|   |   |   |   |-- Input.vue
|   |   |   |   |-- Loading.vue
|   |   |   |-- layout/
|   |   |       |-- MainLayout.vue
|   |   |       |-- Header.vue
|   |   |       |-- Footer.vue
|   |   |-- pages/
|   |   |   |-- HomePage.vue
|   |   |   |-- NotFoundPage.vue
|   |   |-- router/
|   |   |   |-- index.js
|   |   |-- services/
|   |   |   |-- api.js
|   |   |-- store/
|   |   |   |-- app-store.js
|   |   |-- utils/
|   |       |-- helpers.js
|
|-- docs/
    |-- stories/
    |-- architecture/
```

---

## 7. Ordem de Implementacao

### Fase 1: Infraestrutura Docker (Prioridade: Alta)

1. Criar `docker-compose.yml` com todos os servicos
2. Configurar `nginx/nginx.conf` para proxy reverso
3. Criar network bridge `moneytrackr-network`
4. Configurar volumes para persistencia MongoDB

### Fase 2: Backend Base (Prioridade: Alta)

1. Criar estrutura de pastas do `investment-service`
2. Implementar `app-constants.js`
3. Implementar `app-db.js` (conexao MongoDB)
4. Implementar `app-dao.js` (classe base)
5. Implementar `app-manager.js`
6. Implementar `app-router.js` (health check)
7. Implementar `app-service.js` (Express setup)
8. Implementar `main.js` (entry point)
9. Criar `Dockerfile` do backend
10. Configurar ESLint

### Fase 3: Frontend Base (Prioridade: Alta)

1. Criar projeto Vue 3 com Vite
2. Configurar `vite.config.js`
3. Criar estrutura de pastas
4. Implementar componentes UI base
5. Implementar componentes de layout
6. Configurar Vue Router
7. Configurar Pinia store
8. Implementar servico API
9. Criar `manifest.json` (PWA)
10. Criar `Dockerfile` multi-stage

### Fase 4: Testes e Validacao (Prioridade: Alta)

1. Criar `__mocks__/app-base-test.js`
2. Criar `__tests__/health.test.js`
3. Configurar Jest com `@shelf/jest-mongodb`
4. Validar `docker-compose up --build`
5. Validar health check via Nginx
6. Validar frontend carregando
7. Validar persistencia MongoDB

---

## 8. Riscos Tecnicos

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|:-------------:|:------:|-----------|
| Containers nao comunicam entre si | Media | Alto | Usar network bridge nomeada; usar nomes de container como hostnames |
| Volume MongoDB corrompido | Baixa | Alto | Backup periodico; documentar procedimento de restore |
| Nginx nao roteia corretamente | Media | Alto | Testar rotas com curl; logs detalhados do Nginx |
| ESLint muito restritivo | Baixa | Medio | Documentar regras; manter config identica ao dialer-service |
| Frontend nao carrega via Nginx | Media | Alto | Verificar SPA fallback no nginx.conf do frontend |
| Redis desconecta frequentemente | Baixa | Medio | Implementar reconnection logic no app-manager |
| Build lento do Docker | Media | Baixo | Usar multi-stage builds; cache de layers |

---

## 9. Dependencias

### Backend (package.json)

```json
{
  "name": "investment-service",
  "version": "1.0.0",
  "main": "src/main.js",
  "scripts": {
    "start": "node src/main.js",
    "dev": "NODE_ENV=dev node src/main.js",
    "test": "NODE_ENV=test jest --runInBand --forceExit --verbose --detectOpenHandles",
    "testSilent": "CONSOLE_LOG_DISABLE=true NODE_ENV=test jest --runInBand --forceExit --detectOpenHandles",
    "lint": "eslint src/"
  },
  "dependencies": {
    "body-parser": "^1.20.2",
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "helmet": "^7.1.0",
    "mongoose": "^8.7.0",
    "redis": "^4.6.13",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@shelf/jest-mongodb": "^4.3.2",
    "eslint": "^8.57.0",
    "jest": "^29.7.0",
    "mongodb-memory-server": "^10.1.3",
    "redis-mock": "^0.56.3",
    "supertest": "^6.3.4",
    "swagger-ui-express": "^5.0.0",
    "yamljs": "^0.3.0"
  }
}
```

### Frontend (package.json)

```json
{
  "name": "investment-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src/"
  },
  "dependencies": {
    "vue": "^3.4.21",
    "vue-router": "^4.3.0",
    "pinia": "^2.1.7"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.4",
    "vite": "^5.2.0",
    "vite-plugin-pwa": "^0.19.0",
    "eslint": "^8.57.0",
    "eslint-plugin-vue": "^9.23.0"
  }
}
```

---

## 10. Checklist de Implementacao

### Infraestrutura Docker
- [ ] `docker-compose.yml` criado com 5 servicos
- [ ] Network bridge `moneytrackr-network` configurada
- [ ] Volume MongoDB mapeado para persistencia
- [ ] Nginx configurado como proxy reverso
- [ ] Todos containers sobem sem erros

### Backend
- [ ] Estrutura de pastas criada
- [ ] `app-constants.js` implementado
- [ ] `app-db.js` com conexao MongoDB
- [ ] `app-dao.js` classe base implementada
- [ ] `app-manager.js` com inicializacao Redis
- [ ] `app-router.js` com health check
- [ ] `app-service.js` com middlewares Express
- [ ] `main.js` entry point funcional
- [ ] ESLint configurado sem erros
- [ ] Dockerfile criado e funcional

### Frontend
- [ ] Projeto Vue 3 + Vite criado
- [ ] Estrutura de pastas organizada
- [ ] Componentes UI base implementados
- [ ] Componentes layout implementados
- [ ] Vue Router configurado
- [ ] Pinia store configurada
- [ ] Servico API implementado
- [ ] PWA manifest.json criado
- [ ] Dockerfile multi-stage criado

### Testes
- [ ] Jest configurado com MongoDB em memoria
- [ ] Teste de health check passando
- [ ] Cobertura de codigo >= 90%
- [ ] Mocks de Redis funcionais

### Validacao Final
- [ ] `docker-compose up --build` executa sem erros
- [ ] Health check retorna 200 via Nginx
- [ ] Frontend carrega em `http://localhost/`
- [ ] MongoDB persiste dados apos restart
- [ ] Redis conecta corretamente
- [ ] Swagger UI acessivel em modo dev

---

## 11. Configuracoes Docker

### docker-compose.yml

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    container_name: moneytrackr-nginx
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - investment-app
      - investment-service
    networks:
      - moneytrackr-network
    restart: unless-stopped

  investment-app:
    build:
      context: ./investment-app
      dockerfile: Dockerfile
    container_name: moneytrackr-frontend
    networks:
      - moneytrackr-network
    restart: unless-stopped

  investment-service:
    build:
      context: ./investment-service
      dockerfile: Dockerfile
    container_name: moneytrackr-backend
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mongodb://mongodb:27017/
    depends_on:
      - mongodb
      - redis
    networks:
      - moneytrackr-network
    restart: unless-stopped

  mongodb:
    image: mongo:7
    container_name: moneytrackr-mongodb
    volumes:
      - mongodb-data:/data/db
    networks:
      - moneytrackr-network
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: moneytrackr-redis
    networks:
      - moneytrackr-network
    restart: unless-stopped

volumes:
  mongodb-data:
    driver: local

networks:
  moneytrackr-network:
    driver: bridge
```

### nginx/nginx.conf

```nginx
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server investment-app:80;
    }

    upstream backend {
        server investment-service:80;
    }

    server {
        listen 80;
        server_name localhost;

        # Rotas de API -> Backend
        location /api/ {
            proxy_pass http://backend/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Todas as demais rotas -> Frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

---

## 12. Proximos Passos

Apos conclusao do EP01, os seguintes epicos podem ser iniciados:

1. **EP02 - Autenticacao**: Implementar JWT, OAuth Google, sessoes Redis
2. **EP03 - Carteiras**: CRUD de carteiras com isolamento por usuario
3. **EP04 - Transacoes**: Registro de compras/vendas com calculo de posicao
4. **EP05 - Preco Medio**: Calculo automatico de preco medio ponderado

---

*Documento criado pelo Architect - MoneyTrackr V3*

# Story EP01 - Arquitetura e Infraestrutura Base do MoneyTrackr

## Informacoes

| Campo | Valor |
|-------|-------|
| Epico | EP01 - Arquitetura e Infraestrutura |
| Prioridade | Alta (Must Have) |
| Estimativa | 21 story points (XL) |
| Dependencias | Nenhuma - Esta e a story fundacional do projeto |

---

## Contexto e Objetivo

**Como** desenvolvedor do MoneyTrackr
**Eu quero** uma infraestrutura completa com backend (Node.js/Express), frontend (SPA/PWA) e orquestracao Docker
**Para que** todas as demais funcionalidades do sistema de gestao de investimentos possam ser desenvolvidas sobre uma base solida, padronizada e reproduzivel em qualquer ambiente.

O MoneyTrackr e um sistema de gestao de carteiras de investimentos. Esta story estabelece o alicerce tecnico completo: um microservico backend seguindo os padroes comprovados do `dialer-service` (arquitetura em camadas Router > Manager > DAO > Model), um frontend SPA moderno com suporte PWA, e toda a infraestrutura Docker/Nginx necessaria para orquestrar os servicos.

**Metricas de sucesso:**
- `docker-compose up` sobe todos os 5 containers (nginx, frontend, backend, mongodb, redis) sem erros
- Health check do backend responde HTTP 200 em `/api/v1/healthy`
- Frontend carrega no navegador via `http://localhost`
- Nginx roteia corretamente `/api/*` para o backend e `/*` para o frontend
- Todos os testes passam com cobertura >= 90%
- ESLint nao reporta erros no backend

---

## Criterios de Aceite (BDD/Gherkin)

### Cenario 1: Orquestracao Docker Compose

```gherkin
DADO que o repositorio moneyTrackr_V3 contem o docker-compose.yml configurado
QUANDO o desenvolvedor executa "docker-compose up --build"
ENTAO os 5 containers devem subir com sucesso: nginx, investment-app, investment-service, mongodb e redis
  E todos os containers devem estar na mesma rede Docker "moneytrackr-network"
  E o container mongodb deve persistir dados via volume mapeado
  E nenhum container deve apresentar status "exited" ou "restarting"
```

### Cenario 2: Nginx como Proxy Reverso

```gherkin
DADO que todos os containers estao em execucao
QUANDO uma requisicao HTTP e feita para "http://localhost/api/v1/healthy"
ENTAO o Nginx deve encaminhar a requisicao para o container investment-service
  E a resposta deve ser HTTP 200

DADO que todos os containers estao em execucao
QUANDO uma requisicao HTTP e feita para "http://localhost/"
ENTAO o Nginx deve encaminhar a requisicao para o container investment-app
  E a pagina HTML do frontend deve ser retornada com HTTP 200
```

### Cenario 3: Health Check do Backend

```gherkin
DADO que o investment-service esta em execucao e conectado ao MongoDB e Redis
QUANDO uma requisicao GET e feita para "/api/v1/healthy"
ENTAO a resposta deve ser HTTP 200
  E o servico deve ter inicializado sem erros no log
```

### Cenario 4: Conexao com MongoDB

```gherkin
DADO que o investment-service esta em execucao
QUANDO o servico tenta se conectar ao MongoDB
ENTAO a conexao deve ser estabelecida sem autenticacao (sem usuario/senha)
  E o banco de dados "moneytrackr" deve estar acessivel
  E o Mongoose deve estar configurado e operacional
```

### Cenario 5: Conexao com Redis

```gherkin
DADO que o investment-service esta em execucao
QUANDO o servico tenta se conectar ao Redis
ENTAO a conexao deve ser estabelecida com sucesso
  E o cliente Redis deve estar pronto para operacoes de cache e pub/sub
```

### Cenario 6: Documentacao Swagger/OpenAPI

```gherkin
DADO que o investment-service esta em execucao em modo de desenvolvimento (NODE_ENV=dev)
QUANDO uma requisicao GET e feita para "/api/docs"
ENTAO a pagina do Swagger UI deve ser retornada
  E a especificacao OpenAPI do servico deve estar visivel
```

### Cenario 7: ESLint sem Erros

```gherkin
DADO que o codigo-fonte do investment-service existe
QUANDO o desenvolvedor executa "yarn lint"
ENTAO nenhum erro de linting deve ser reportado
  E as regras devem incluir: sem ponto-e-virgula, aspas simples, indentacao 2 espacos, camelCase
```

### Cenario 8: Infraestrutura de Testes

```gherkin
DADO que o investment-service possui a configuracao de testes com Jest
QUANDO o desenvolvedor executa "yarn test"
ENTAO o Jest deve executar com sucesso usando MongoDB em memoria (@shelf/jest-mongodb)
  E os testes devem validar o health check via supertest
  E a cobertura de codigo deve ser coletada automaticamente
```

### Cenario 9: Frontend SPA Carregando

```gherkin
DADO que o container investment-app esta em execucao
QUANDO o usuario acessa "http://localhost/" no navegador
ENTAO a aplicacao SPA deve carregar com uma pagina inicial funcional
  E o build deve ter sido gerado pelo Vite
  E a aplicacao deve estar configurada como PWA (manifest.json e service worker)
```

### Cenario 10: Persistencia de Dados MongoDB

```gherkin
DADO que o sistema esta em execucao e dados foram inseridos no MongoDB
QUANDO os containers sao parados com "docker-compose down"
  E reiniciados com "docker-compose up"
ENTAO os dados previamente inseridos devem continuar acessiveis
  E o volume Docker deve garantir a persistencia
```

---

## Detalhamento Tecnico

### Backend (investment-service)

#### Arquitetura em Camadas (Padrao dialer-service)

O backend segue fielmente o padrao do `dialer-service`, com 4 camadas bem definidas:

| Camada | Responsabilidade | Padrao de Nomenclatura |
|--------|-----------------|----------------------|
| **Router** | Recebe requisicoes HTTP, valida entrada, chama Manager | `*-router.js` |
| **Manager** | Logica de negocio, orquestra DAOs | `*-manager.js` |
| **DAO** | Acesso a dados, operacoes no banco | `*-dao.js` |
| **Model** | Schemas Mongoose, definicao de modelos | `*-model.js` |

#### Configuracao do Express (app-service.js)

Baseado no padrao `dialer-service/src/app/app-service.js`:

```javascript
// Middlewares obrigatorios (mesma ordem do dialer-service)
const express = require('express')
const helmet = require('helmet')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const cors = require('cors')

// Configuracao
app.use(helmet())
app.use(cors())
app.use(cookieParser())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

// Health check (padrao do dialer-service)
router.get('/v1/healthy', (req, res) => res.sendStatus(200))

// Swagger (apenas em dev)
if (process.env.NODE_ENV === 'dev') {
  const swaggerUi = require('swagger-ui-express')
  const YAML = require('yamljs')
  const swaggerDocument = YAML.load('./docs/openapi.yml')
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))
}
```

#### Gerenciador Central (app-manager.js)

Baseado no padrao `dialer-service/src/app/app-manager.js`:

```javascript
class AppManager {
  async initialize(config) {
    this.config = config
    // Conexao MongoDB via Mongoose (sem auth)
    this.appDB = new AppDB(config.db)
    await this.appDB.initialize()
    // Conexao Redis
    this.redisClient = redis.createClient({
      host: config.redis.host,
      port: config.redis.port,
    })
  }

  handleError(obj) {
    throw new Exception(obj.statusCode, obj.message, obj.statusCode)
  }
}
```

#### Constantes (app-constants.js)

Baseado no padrao `dialer-service/src/app/app-constants.js`:

```javascript
const APP_CONSTANTS = {
  SERVICE_NAME: 'investment-service',
  ERRORS: {
    SERVER_ERROR: {
      statusCode: 500,
      code: 'SERVER_ERROR',
      message: 'Server error',
    },
    // ... demais erros serao adicionados conforme stories futuras
  },
}

module.exports = Object.freeze(APP_CONSTANTS)
```

#### Configuracao (config/app.json)

```json
{
  "port": 80,
  "db": {
    "name": "moneytrackr",
    "url": "mongodb://mongodb:27017/"
  },
  "redis": {
    "host": "redis",
    "port": 6379
  },
  "timezone": "America/Sao_Paulo"
}
```

#### Entry Point (main.js)

Baseado no padrao `dialer-service/src/main.js`:

```javascript
const AppService = require('./app/app-service')
const appService = new AppService()
const APP_CONSTANTS = require('./app/app-constants')

process.title = 'investment-service'

const loadConfig = function () {
  const config = require('../config/app.json')
  config.db.url = process.env.DATABASE_URL || config.db.url
  config.db.name = process.env.DATABASE_NAME_PREFIX
    ? process.env.DATABASE_NAME_PREFIX + config.db.name
    : config.db.name
  return config
}

const start = async () => {
  const config = loadConfig()
  appService.initialize(config)
    .then(() => {
      if (process.env.NODE_ENV === 'dev') {
        const swaggerUi = require('swagger-ui-express')
        const YAML = require('yamljs')
        const swaggerDocument = YAML.load('./docs/openapi.yml')
        appService.getApp().use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))
      }
      appService.getApp().listen(config.port, () => {
        console.log(`Servico iniciado na porta ${config.port}`)
      })
    })
    .catch((error) => {
      console.error('Erro ao iniciar servico', error)
    })
}

start()
```

#### ESLint (.eslintrc.js)

Replicar identicamente o arquivo `dialer-service/.eslintrc.js` com todas as 30+ regras configuradas. Regras-chave:
- `semi: [2, 'never']` - sem ponto-e-virgula
- `quotes: [2, 'single', 'avoid-escape']` - aspas simples
- `indent: [2, 2, { 'SwitchCase': 1 }]` - 2 espacos
- `camelcase: ['error', { properties: 'never' }]` - camelCase
- `complexity: ['error', { max: 10 }]` - complexidade maxima 10
- `max-depth: ['error', { max: 4 }]` - profundidade maxima 4
- `no-var: 'error'` - proibe var, usar const/let

#### Dependencias do Backend (package.json)

```json
{
  "dependencies": {
    "body-parser": "^1.19.0",
    "cookie-parser": "^1.4.5",
    "cors": "^2.8.5",
    "express": "^4.17.1",
    "helmet": "^8.0.0",
    "mongoose": "^8.7.0",
    "redis": "^3.1.1",
    "uuid": "^11.0.5"
  },
  "devDependencies": {
    "@shelf/jest-mongodb": "^4.3.2",
    "eslint": "^8.57.0",
    "jest": "^29.7.0",
    "mongodb-memory-server": "^10.1.3",
    "redis-mock": "^0.56.3",
    "supertest": "^7.0.0",
    "swagger-ui-express": "^4.0.1",
    "yamljs": "^0.3.0"
  }
}
```

#### Infraestrutura de Testes

Baseado nos padroes `dialer-service/src/__tests__/` e `dialer-service/src/__mocks__/`:

- **Jest** como framework de testes
- **supertest** para testes de API HTTP
- **@shelf/jest-mongodb** para MongoDB em memoria nos testes
- **redis-mock** para mock do Redis
- Configuracao Jest no `package.json`:

```json
{
  "jest": {
    "verbose": true,
    "collectCoverage": true,
    "collectCoverageFrom": [
      "src/**/*.js",
      "!src/main.js"
    ],
    "preset": "@shelf/jest-mongodb"
  }
}
```

- Scripts de teste:

```json
{
  "scripts": {
    "test": "NODE_ENV=test jest --runInBand --forceExit --verbose --detectOpenHandles",
    "testSilent": "CONSOLE_LOG_DISABLE=true NODE_ENV=test jest --runInBand --forceExit --detectOpenHandles"
  }
}
```

- Teste inicial obrigatorio: health check endpoint retornando 200.

---

### Frontend (investment-app)

#### Framework e Tooling

| Tecnologia | Versao | Justificativa |
|-----------|--------|---------------|
| **Vue 3** ou **React 18** | Ultima estavel | Framework SPA moderno (decidir na implementacao) |
| **Vite** | >= 5.x | Build tool rapido com HMR |
| **PWA Plugin** | vite-plugin-pwa | Configuracao PWA (manifest + service worker) |

#### Estrutura de Pastas do Frontend

```
investment-app/
  src/
    assets/           # Imagens, fontes, CSS global
    components/       # Componentes reutilizaveis
      ui/             # Componentes de UI base (Button, Input, Card, etc.)
      layout/         # Header, Sidebar, Footer, MainLayout
    pages/            # Paginas/views do app (1 arquivo por rota)
    router/           # Configuracao de rotas (vue-router ou react-router)
    services/         # Chamadas HTTP ao backend (axios/fetch wrappers)
      api.js          # Instancia base do HTTP client
    store/            # Gerenciamento de estado (Pinia/Vuex ou Zustand/Redux)
    utils/            # Funcoes utilitarias
    App.vue           # (ou App.jsx) Componente raiz
    main.js           # Entry point
  public/
    manifest.json     # PWA manifest
    favicon.ico
  index.html
  vite.config.js
  package.json
```

#### Configuracao PWA (manifest.json)

```json
{
  "name": "MoneyTrackr",
  "short_name": "MoneyTrackr",
  "description": "Gestor de Investimentos",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1a1a2e",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

#### Servico HTTP Base (services/api.js)

```javascript
// Configurar base URL relativa para funcionar com Nginx proxy
const API_BASE_URL = '/api'

// Wrapper para chamadas ao backend
async function request(method, path, data) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  return response.json()
}
```

---

### Infraestrutura (Docker & Nginx)

#### docker-compose.yml

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

#### Nginx Configuracao (nginx/nginx.conf)

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

**Regra de roteamento:**
- `http://localhost/api/*` -> reescrito para `http://investment-service:80/*` (remove o prefixo `/api`)
- `http://localhost/*` -> proxy para `http://investment-app:80/*`

#### Dockerfile do Backend (investment-service/Dockerfile)

Baseado no `dialer-service/Dockerfile`:

```dockerfile
FROM node:18-alpine
LABEL maintainer="moneytrackr"

WORKDIR /home/app

COPY package.json yarn.lock ./
RUN yarn install --production && yarn cache clean

COPY . .

EXPOSE 80
CMD ["yarn", "start"]
```

#### Dockerfile do Frontend (investment-app/Dockerfile)

```dockerfile
# Build stage
FROM node:18-alpine AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install
COPY . .
RUN yarn build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Nginx do Frontend (investment-app/nginx.conf)

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback - todas as rotas retornam index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Estrutura de Arquivos

```
moneyTrackr_V3/
|
|-- docker-compose.yml
|-- nginx/
|   |-- nginx.conf                          # Configuracao do proxy reverso
|
|-- investment-service/                     # Backend (microservico Node.js)
|   |-- Dockerfile
|   |-- .dockerignore
|   |-- .eslintrc.js                        # Copia fiel do dialer-service
|   |-- .eslintignore
|   |-- .gitignore
|   |-- package.json
|   |-- yarn.lock
|   |-- config/
|   |   |-- app.json                        # Configuracoes: porta, db, redis
|   |-- docs/
|   |   |-- openapi.yml                     # Especificacao Swagger/OpenAPI
|   |-- src/
|   |   |-- main.js                         # Entry point do servico
|   |   |-- app/
|   |   |   |-- app-constants.js            # Constantes globais
|   |   |   |-- app-manager.js              # Gerenciador central (inicializa DB, Redis)
|   |   |   |-- app-service.js              # Configuracao Express (middlewares, rotas)
|   |   |   |-- app-router.js               # Rotas base (health check)
|   |   |-- __tests__/
|   |   |   |-- health.test.js              # Teste do health check
|   |   |-- __mocks__/
|   |       |-- app-base-test.js            # Utilitario de teste (cria app, agente, limpa)
|   |       |-- app.config.js               # Configuracao de teste
|
|-- investment-app/                         # Frontend (SPA/PWA)
|   |-- Dockerfile
|   |-- nginx.conf                          # Nginx config para servir SPA
|   |-- .gitignore
|   |-- package.json
|   |-- vite.config.js
|   |-- index.html
|   |-- public/
|   |   |-- manifest.json                   # PWA manifest
|   |   |-- favicon.ico
|   |-- src/
|   |   |-- main.js                         # Entry point
|   |   |-- App.vue (ou App.jsx)            # Componente raiz
|   |   |-- assets/                         # Recursos estaticos
|   |   |-- components/
|   |   |   |-- ui/                         # Componentes UI base
|   |   |   |-- layout/                     # Componentes de layout
|   |   |-- pages/                          # Paginas/views
|   |   |-- router/                         # Configuracao de rotas
|   |   |   |-- index.js
|   |   |-- services/                       # Chamadas HTTP
|   |   |   |-- api.js                      # Client HTTP base
|   |   |-- store/                          # Gerenciamento de estado
|   |   |-- utils/                          # Utilitarios
|
|-- docs/
    |-- PO-epicos.md                        # (ja existe) Definicao dos epicos
    |-- stories/
        |-- EP01-arquitetura-infraestrutura.md  # (este arquivo)
```

---

## Definicao de Pronto (DoD)

- [ ] `docker-compose up --build` sobe os 5 containers sem erros (nginx, frontend, backend, mongodb, redis)
- [ ] Health check GET `/api/v1/healthy` retorna HTTP 200 via Nginx
- [ ] Frontend carrega no navegador em `http://localhost/`
- [ ] Nginx roteia `/api/*` para backend e `/*` para frontend corretamente
- [ ] MongoDB aceita conexoes sem autenticacao e persiste dados via volume
- [ ] Redis aceita conexoes do backend
- [ ] ESLint configurado e `yarn lint` passa sem erros no backend
- [ ] Jest + supertest configurados, teste de health check passando
- [ ] Cobertura de codigo coletada automaticamente (>= 90%)
- [ ] Swagger UI acessivel em `/api/docs` quando NODE_ENV=dev
- [ ] Frontend configurado como PWA (manifest.json + service worker)
- [ ] Vite configurado como build tool do frontend
- [ ] Estrutura de pastas do frontend criada (pages, components, services, store, router)
- [ ] Codigo revisado por @code-reviewer
- [ ] Testes de integracao passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentacao atualizada
- [ ] PR criado por @merge-request

---

## Cenarios de Teste

### Teste 1: Subida completa do Docker Compose
Executar `docker-compose up --build` e verificar que todos os 5 containers sobem com `docker ps` mostrando status "Up".

### Teste 2: Health check via Nginx
`curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/healthy` deve retornar `200`.

### Teste 3: Frontend via Nginx
`curl -s -o /dev/null -w "%{http_code}" http://localhost/` deve retornar `200` com conteudo HTML.

### Teste 4: Roteamento Nginx - API
Requisicoes para `http://localhost/api/v1/healthy` devem chegar ao backend. Verificar nos logs do container backend.

### Teste 5: Roteamento Nginx - Frontend
Requisicoes para `http://localhost/qualquer-rota` devem retornar o `index.html` do frontend (SPA fallback).

### Teste 6: Persistencia MongoDB
1. Inserir dados via API
2. `docker-compose down`
3. `docker-compose up`
4. Verificar que os dados persistem

### Teste 7: ESLint
Executar `yarn lint` no diretorio `investment-service/` - zero erros.

### Teste 8: Jest/Supertest
Executar `yarn test` no diretorio `investment-service/` - teste de health check passa, cobertura coletada.

### Teste 9: PWA Manifest
Acessar `http://localhost/manifest.json` e verificar que retorna JSON valido com campos `name`, `start_url`, `display`.

### Teste 10: Swagger em Dev
Subir backend com `NODE_ENV=dev` e acessar `/api/docs` - Swagger UI deve carregar.

---

## Notas Tecnicas

### Decisoes Arquiteturais

1. **Backend baseado no dialer-service**: Replicar os padroes de `app-service.js`, `app-manager.js`, `app-constants.js`, `app-router.js` adaptados para o dominio de investimentos. Nao usar `interact-utils` (dependencia interna da Digitro), implementar AppDB e AppDAO diretamente com Mongoose.

2. **MongoDB sem autenticacao**: Conforme requisito do PO-epicos.md ("sem necessidade de senhas"). Simplifica o setup de desenvolvimento.

3. **Nginx como gateway unico**: Todas as requisicoes passam pelo Nginx (porta 80). O frontend e backend nao expoe portas diretamente para o host. Isso garante o cenario do Epico 1: "todas devem passar pelo NGINX".

4. **Prefixo `/api` no Nginx**: O Nginx remove o prefixo `/api` ao encaminhar para o backend. Assim, o backend mantem rotas internas como `/v1/healthy` e o frontend chama `/api/v1/healthy`.

5. **Frontend framework**: A escolha entre Vue 3 e React 18 sera feita na implementacao. Ambos sao compativeis com a estrutura proposta. Recomendacao: Vue 3 com Composition API pela curva de aprendizado e ecossistema (Pinia, Vue Router).

6. **PWA**: Configuracao inicial com manifest.json e service worker basico para instalacao na tela inicial. Offline completo sera abordado no Epico 15.

### Riscos e Mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|-----------|
| Incompatibilidade de versoes entre containers | Baixa | Alto | Fixar versoes no Dockerfile (node:18-alpine, mongo:7, redis:7-alpine) |
| Problemas de rede entre containers Docker | Baixa | Alto | Usar rede bridge nomeada, testar conectividade com ping entre containers |
| ESLint muito restritivo para novos devs | Media | Baixo | Documentar as regras e manter `.eslintrc.js` identico ao dialer-service |
| Volume MongoDB corrompido | Baixa | Alto | Documentar procedimento de backup e restore do volume |

### Dependencias Externas

- **Docker Engine** >= 20.x
- **Docker Compose** >= 2.x
- **Node.js** 18.x (LTS) nos containers
- **MongoDB** 7.x
- **Redis** 7.x
- **Nginx** Alpine (ultima)

---

## Relacionamento com Outros Epicos

| Epico | Relacao | Impacto |
|-------|---------|---------|
| EP02 - Autenticacao | **Bloqueado por EP01** | Precisa do backend e frontend funcionando |
| EP03 - Carteiras | **Bloqueado por EP01** | Precisa da camada DAO/Model para persistencia |
| EP04 - Transacoes | **Bloqueado por EP01** | Precisa da arquitetura Router > Manager > DAO > Model |
| EP13 - APIs de Mercado | **Bloqueado por EP01** | Precisa do Redis para cache |
| EP14 - Atualizacao de Dados | **Bloqueado por EP01** | Precisa do Redis para pub/sub |
| EP15 - PWA | **Parcialmente resolvido por EP01** | Manifest e service worker basico ja configurados |
| EP16 - Layout Base | **Bloqueado por EP01** | Precisa do frontend configurado |
| EP26 - Performance | **Bloqueado por EP01** | Precisa do Redis para cache |

> **Esta story e fundacional.** Todos os demais epicos dependem direta ou indiretamente da infraestrutura estabelecida aqui. Nenhuma outra story deve ser iniciada antes de EP01 estar concluida e validada.

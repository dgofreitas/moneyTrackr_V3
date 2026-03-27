# Plano de Testes - EP01: Arquitetura e Infraestrutura Base do MoneyTrackr

## Informacoes do Documento

| Campo | Valor |
|-------|-------|
| Story | EP01 - Arquitetura e Infraestrutura Base |
| Versao | 1.0 |
| Data de Criacao | 2026-03-27 |
| Autor | Test Engineer |
| Status | Rascunho |

---

## 1. Estrategia de Testes

### 1.1 Visao Geral

Este plano de testes cobre a story fundacional EP01, que estabelece toda a infraestrutura base do MoneyTrackr. A estrategia prioriza testes de infraestrutura e integracao, dado que esta story nao envolve logica de negocio complexa, mas sim a configuracao e funcionamento de componentes de sistema.

### 1.2 Niveis de Teste

| Nivel | Foco | Ferramentas | Cobertura Alvo |
|-------|------|-------------|----------------|
| **Infraestrutura** | Docker Compose, containers, redes, volumes | Docker CLI, scripts shell | 100% dos cenarios de infra |
| **Integracao** | Comunicacao entre containers, APIs, banco de dados | curl, supertest, Jest | 100% dos endpoints |
| **Unitario** | Componentes individuais do backend | Jest, @shelf/jest-mongodb | >= 90% de cobertura |
| **E2E** | Fluxos completos via Nginx | supertest, navegador | Cenarios criticos |

### 1.3 Priorizacao de Testes

| Prioridade | Criterio | Exemplos |
|------------|----------|----------|
| **Alta (P1)** | Funcionalidades criticas que bloqueiam outras stories | Docker Compose, Nginx routing, MongoDB, Redis |
| **Media (P2)** | Funcionalidades importantes mas com workarounds | Swagger, ESLint, PWA manifest |
| **Baixa (P3)** | Funcionalidades de suporte ou nice-to-have | Logs, metricas secundarias |

### 1.4 Abordagem de Automacao

| Tipo | Automatizavel | Justificativa |
|------|---------------|---------------|
| Health Check | Sim | Endpoint simples, retorno previsivel |
| Docker Compose | Parcial | Validacao de containers pode ser scriptada |
| Nginx Routing | Sim | Requisicoes HTTP podem ser automatizadas |
| MongoDB Connection | Sim | Testes de conexao com mocks |
| Redis Connection | Sim | Testes de conexao com mocks |
| Swagger UI | Parcial | Verificacao de disponibilidade automatizada |
| ESLint | Sim | CLI com retorno de codigo |
| Jest Coverage | Sim | CLI com relatorio de cobertura |
| Frontend SPA | Parcial | Verificacao de HTML pode ser automatizada |
| PWA Manifest | Sim | Validacao de JSON |
| Data Persistence | Sim | Script de insercao/verificacao |

---

## 2. Casos de Teste

### 2.1 Cenario 1: Orquestracao Docker Compose

#### TC-EP01-001: Subida de Todos os Containers

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-001 |
| **Nome** | Subida de Todos os Containers |
| **Prioridade** | Alta (P1) |
| **Tipo** | Infraestrutura |
| **Automatizavel** | Parcial |

**Pre-condicoes:**
- Docker Engine >= 20.x instalado
- Docker Compose >= 2.x instalado
- Porta 80 disponivel no host
- Arquivo docker-compose.yml presente no diretorio

**Passos de Teste:**
1. Navegar para o diretorio raiz do projeto
2. Executar `docker-compose up --build -d`
3. Aguardar 60 segundos para inicializacao completa
4. Executar `docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Networks}}"`

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- 5 containers em execucao: moneytrackr-nginx, moneytrackr-frontend, moneytrackr-backend, moneytrackr-mongodb, moneytrackr-redis
- Todos com status "Up" (nao "Exited" ou "Restarting")
- Todos na rede "moneytrackr-network"

**Pos-condicoes:**
- Containers permanecem em execucao para testes subsequentes

---

#### TC-EP01-002: Rede Docker Compartilhada

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-002 |
| **Nome** | Rede Docker Compartilhada |
| **Prioridade** | Alta (P1) |
| **Tipo** | Infraestrutura |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Containers em execucao (TC-EP01-001 executado)

**Passos de Teste:**
1. Executar `docker network inspect moneytrackr-network`
2. Verificar lista de containers conectados
3. Executar `docker exec moneytrackr-backend ping -c 1 mongodb`
4. Executar `docker exec moneytrackr-backend ping -c 1 redis`
5. Executar `docker exec moneytrackr-backend ping -c 1 investment-app`

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- Rede "moneytrackr-network" existe e e do tipo "bridge"
- Todos os 5 containers estao conectados a rede
- Comandos ping retornam sucesso (containers se comunicam)

**Pos-condicoes:**
- N/A

---

#### TC-EP01-003: Volume MongoDB Configurado

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-003 |
| **Nome** | Volume MongoDB Configurado |
| **Prioridade** | Alta (P1) |
| **Tipo** | Infraestrutura |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Containers em execucao

**Passos de Teste:**
1. Executar `docker volume ls | grep mongodb`
2. Executar `docker inspect moneytrackr-mongodb --format '{{json .Mounts}}'`
3. Verificar que existe volume mapeado para `/data/db`

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- Volume "mongodb-data" existe
- Container mongodb tem volume mapeado para `/data/db`
- Driver do volume e "local"

**Pos-condicoes:**
- N/A

---

#### TC-EP01-004: Nenhum Container com Status de Erro

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-004 |
| **Nome** | Nenhum Container com Status de Erro |
| **Prioridade** | Alta (P1) |
| **Tipo** | Infraestrutura |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Containers em execucao por pelo menos 2 minutos

**Passos de Teste:**
1. Executar `docker ps -a --filter "name=moneytrackr" --format "{{.Names}}: {{.Status}}"`
2. Verificar logs de cada container: `docker logs moneytrackr-backend --tail 50`
3. Verificar se ha mensagens de erro ou restart

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- Nenhum container com status "Exited" ou "Restarting"
- Logs do backend nao contem "Error" ou "Exception" critica
- Logs do frontend nao contem erros de build

**Pos-condicoes:**
- N/A

---

### 2.2 Cenario 2: Nginx como Proxy Reverso

#### TC-EP01-005: Roteamento API para Backend

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-005 |
| **Nome** | Roteamento API para Backend |
| **Prioridade** | Alta (P1) |
| **Tipo** | Integracao |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Todos os containers em execucao
- Backend respondendo na porta interna

**Passos de Teste:**
1. Executar `curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/healthy`
2. Executar `curl -s http://localhost/api/v1/healthy`
3. Verificar logs do Nginx: `docker logs moneytrackr-nginx --tail 10`
4. Verificar logs do Backend: `docker logs moneytrackr-backend --tail 10`

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- HTTP status code 200 retornado
- Requisicao registrada nos logs do Nginx
- Requisicao chegou ao container backend (visivel nos logs)

**Pos-condicoes:**
- N/A

---

#### TC-EP01-006: Roteamento Raiz para Frontend

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-006 |
| **Nome** | Roteamento Raiz para Frontend |
| **Prioridade** | Alta (P1) |
| **Tipo** | Integracao |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Todos os containers em execucao
- Frontend buildado e servindo arquivos

**Passos de Teste:**
1. Executar `curl -s -o /dev/null -w "%{http_code}" http://localhost/`
2. Executar `curl -s http://localhost/ | head -20`
3. Verificar se HTML contem tags do Vite/SPA

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- HTTP status code 200 retornado
- HTML retornado contem `<div id="app">` ou elemento raiz do framework
- HTML referencia arquivos JS/CSS gerados pelo Vite

**Pos-condicoes:**
- N/A

---

#### TC-EP01-007: SPA Fallback para Rotas Nao-Existentes

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-007 |
| **Nome** | SPA Fallback para Rotas Nao-Existentes |
| **Prioridade** | Media (P2) |
| **Tipo** | Integracao |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Todos os containers em execucao

**Passos de Teste:**
1. Executar `curl -s -o /dev/null -w "%{http_code}" http://localhost/dashboard`
2. Executar `curl -s -o /dev/null -w "%{http_code}" http://localhost/portfolio/123`
3. Executar `curl -s -o /dev/null -w "%{http_code}" http://localhost/qualquer-rota-inexistente`
4. Verificar que todas retornam HTML do frontend (nao 404)

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- Todas as rotas retornam HTTP 200
- Conteudo retornado e o index.html do frontend
- Nginx aplica `try_files $uri $uri/ /index.html`

**Pos-condicoes:**
- N/A

---

#### TC-EP01-008: Headers de Proxy Corretos

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-008 |
| **Nome** | Headers de Proxy Corretos |
| **Prioridade** | Media (P2) |
| **Tipo** | Integracao |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Containers em execucao
- Endpoint que retorna headers recebidos (pode ser criado para teste)

**Passos de Teste:**
1. Executar requisicao com headers customizados
2. Verificar que X-Real-IP, X-Forwarded-For sao passados
3. Verificar que Host header e preservado

**Dados de Teste:**
```bash
curl -H "X-Test-Header: test-value" http://localhost/api/v1/healthy
```

**Resultados Esperados:**
- Headers de proxy configurados no Nginx sao passados
- Backend recebe informacoes corretas do cliente original

**Pos-condicoes:**
- N/A

---

### 2.3 Cenario 3: Health Check do Backend

#### TC-EP01-009: Health Check Retorna 200

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-009 |
| **Nome** | Health Check Retorna 200 |
| **Prioridade** | Alta (P1) |
| **Tipo** | Integracao |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Backend em execucao
- MongoDB e Redis conectados

**Passos de Teste:**
1. Executar `curl -X GET http://localhost/api/v1/healthy`
2. Verificar HTTP status code
3. Verificar corpo da resposta

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- HTTP status code 200
- Corpo vazio ou mensagem de sucesso
- Tempo de resposta < 100ms

**Pos-condicoes:**
- N/A

---

#### TC-EP01-010: Health Check Direto no Backend

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-010 |
| **Nome** | Health Check Direto no Backend |
| **Prioridade** | Alta (P1) |
| **Tipo** | Integracao |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Backend em execucao

**Passos de Teste:**
1. Executar `docker exec moneytrackr-backend curl -s http://localhost:80/v1/healthy`
2. Verificar retorno

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- HTTP 200 retornado diretamente pelo backend
- Endpoint `/v1/healthy` funcional (sem prefixo /api)

**Pos-condicoes:**
- N/A

---

#### TC-EP01-011: Health Check Unit Test

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-011 |
| **Nome** | Health Check Unit Test |
| **Prioridade** | Alta (P1) |
| **Tipo** | Unitario |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Jest configurado
- @shelf/jest-mongodb instalado
- Arquivo de teste health.test.js existe

**Passos de Teste:**
1. Navegar para `investment-service/`
2. Executar `yarn test --testPathPattern=health.test.js`
3. Verificar resultado do teste

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- Teste passa com sucesso
- Cobertura do arquivo testado >= 90%
- Jest usa MongoDB em memoria

**Pos-condicoes:**
- N/A

---

#### TC-EP01-012: Backend Inicializa sem Erros

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-012 |
| **Nome** | Backend Inicializa sem Erros |
| **Prioridade** | Alta (P1) |
| **Tipo** | Integracao |
| **Automatizavel** | Parcial |

**Pre-condicoes:**
- Containers iniciando

**Passos de Teste:**
1. Executar `docker logs moneytrackr-backend 2>&1 | grep -i "error\|exception\|fail"`
2. Verificar mensagem de inicializacao bem-sucedida
3. Verificar que servico esta ouvindo na porta 80

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- Nenhum erro critico nos logs
- Mensagem "Servico iniciado" ou similar presente
- Servico ouvindo na porta configurada

**Pos-condicoes:**
- N/A

---

### 2.4 Cenario 4: Conexao com MongoDB

#### TC-EP01-013: Conexao MongoDB sem Autenticacao

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-013 |
| **Nome** | Conexao MongoDB sem Autenticacao |
| **Prioridade** | Alta (P1) |
| **Tipo** | Integracao |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- MongoDB container em execucao
- Backend configurado para conectar

**Passos de Teste:**
1. Executar `docker exec -it moneytrackr-mongodb mongosh`
2. Executar `show dbs`
3. Verificar que banco "moneytrackr" existe ou pode ser criado
4. Verificar logs do backend para mensagem de conexao

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- MongoDB aceita conexao sem usuario/senha
- Banco "moneytrackr" acessivel
- Backend loga "Connected to MongoDB" ou similar

**Pos-condicoes:**
- N/A

---

#### TC-EP01-014: Mongoose Configurado e Operacional

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-014 |
| **Nome** | Mongoose Configurado e Operacional |
| **Prioridade** | Alta (P1) |
| **Tipo** | Integracao |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Backend conectado ao MongoDB

**Passos de Teste:**
1. Verificar que Mongoose esta carregado no backend
2. Executar teste de insercao simples
3. Verificar que documento e persistido

**Dados de Teste:**
```javascript
// Teste via endpoint ou script
{ testField: "testValue", createdAt: new Date() }
```

**Resultados Esperados:**
- Mongoose conectado com sucesso
- Operacoes CRUD funcionais
- Schemas podem ser definidos

**Pos-condicoes:**
- Documento de teste removido

---

#### TC-EP01-015: MongoDB Unit Test com Mock

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-015 |
| **Nome** | MongoDB Unit Test com Mock |
| **Prioridade** | Alta (P1) |
| **Tipo** | Unitario |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Jest configurado com @shelf/jest-mongodb
- Testes DAO existentes

**Passos de Teste:**
1. Executar `yarn test --coverage`
2. Verificar que MongoDB em memoria e usado
3. Verificar cobertura de codigo DAO

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- Testes usam MongoDB em memoria (nao container)
- Testes DAO passam
- Cobertura >= 90%

**Pos-condicoes:**
- N/A

---

### 2.5 Cenario 5: Conexao com Redis

#### TC-EP01-016: Conexao Redis Estabelecida

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-016 |
| **Nome** | Conexao Redis Estabelecida |
| **Prioridade** | Alta (P1) |
| **Tipo** | Integracao |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Redis container em execucao
- Backend configurado para conectar

**Passos de Teste:**
1. Executar `docker exec -it moneytrackr-redis redis-cli ping`
2. Verificar resposta "PONG"
3. Verificar logs do backend para conexao Redis

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- Redis responde "PONG" ao ping
- Backend loga conexao Redis bem-sucedida
- Cliente Redis pronto para operacoes

**Pos-condicoes:**
- N/A

---

#### TC-EP01-017: Redis Operacoes de Cache

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-017 |
| **Nome** | Redis Operacoes de Cache |
| **Prioridade** | Media (P2) |
| **Tipo** | Integracao |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Redis conectado
- Backend com funcoes de cache

**Passos de Teste:**
1. Executar `docker exec -it moneytrackr-redis redis-cli SET test_key "test_value"`
2. Executar `docker exec -it moneytrackr-redis redis-cli GET test_key`
3. Executar `docker exec -it moneytrackr-redis redis-cli DEL test_key`

**Dados de Teste:**
- Chave: test_key
- Valor: test_value

**Resultados Esperados:**
- Operacao SET retorna OK
- Operacao GET retorna "test_value"
- Operacao DEL remove a chave

**Pos-condicoes:**
- Chave de teste removida

---

#### TC-EP01-018: Redis Pub/Sub Funcional

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-018 |
| **Nome** | Redis Pub/Sub Funcional |
| **Prioridade** | Media (P2) |
| **Tipo** | Integracao |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Redis conectado
- Backend com suporte a pub/sub

**Passos de Teste:**
1. Abrir dois terminais com redis-cli
2. Terminal 1: `SUBSCRIBE test_channel`
3. Terminal 2: `PUBLISH test_channel "test_message"`
4. Verificar mensagem recebida no Terminal 1

**Dados de Teste:**
- Canal: test_channel
- Mensagem: test_message

**Resultados Esperados:**
- Mensagem publicada e recebida
- Pub/Sub funcional para comunicacao entre servicos

**Pos-condicoes:**
- Canal de teste removido

---

#### TC-EP01-019: Redis Unit Test com Mock

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-019 |
| **Nome** | Redis Unit Test com Mock |
| **Prioridade** | Alta (P1) |
| **Tipo** | Unitario |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Jest configurado
- redis-mock instalado
- Testes com Redis mock existentes

**Passos de Teste:**
1. Executar `yarn test --coverage`
2. Verificar que redis-mock e usado nos testes
3. Verificar cobertura de codigo Redis

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- Testes usam redis-mock (nao container real)
- Operacoes SET/GET/PUBLISH testadas
- Cobertura >= 90%

**Pos-condicoes:**
- N/A

---

### 2.6 Cenario 6: Documentacao Swagger/OpenAPI

#### TC-EP01-020: Swagger UI Disponivel em Dev

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-020 |
| **Nome** | Swagger UI Disponivel em Dev |
| **Prioridade** | Media (P2) |
| **Tipo** | Integracao |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Backend em execucao com NODE_ENV=dev
- swagger-ui-express instalado
- openapi.yml configurado

**Passos de Teste:**
1. Executar `curl -s -o /dev/null -w "%{http_code}" http://localhost/api/docs`
2. Executar `curl -s http://localhost/api/docs | grep -i "swagger"`
3. Verificar que Swagger UI carrega

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- HTTP 200 retornado
- HTML contem referencias ao Swagger UI
- Interface grafica acessivel via navegador

**Pos-condicoes:**
- N/A

---

#### TC-EP01-021: Swagger Nao Disponivel em Producao

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-021 |
| **Nome** | Swagger Nao Disponivel em Producao |
| **Prioridade** | Media (P2) |
| **Tipo** | Integracao |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Backend em execucao com NODE_ENV=production

**Passos de Teste:**
1. Executar `curl -s -o /dev/null -w "%{http_code}" http://localhost/api/docs`
2. Verificar que retorna 404 ou nao esta disponivel

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- HTTP 404 retornado
- Swagger UI nao exposto em producao

**Pos-condicoes:**
- N/A

---

#### TC-EP01-022: OpenAPI Spec Valida

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-022 |
| **Nome** | OpenAPI Spec Valida |
| **Prioridade** | Media (P2) |
| **Tipo** | Unitario |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Arquivo openapi.yml existe
- Validador de OpenAPI instalado

**Passos de Teste:**
1. Executar validador de OpenAPI spec
2. Verificar que spec e valida
3. Verificar que documenta endpoint /v1/healthy

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- Spec OpenAPI valida sem erros
- Endpoint health check documentado
- Versao da API especificada

**Pos-condicoes:**
- N/A

---

### 2.7 Cenario 7: ESLint sem Erros

#### TC-EP01-023: ESLint Passa sem Erros

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-023 |
| **Nome** | ESLint Passa sem Erros |
| **Prioridade** | Alta (P1) |
| **Tipo** | Unitario |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- ESLint instalado
- .eslintrc.js configurado
- Codigo-fonte do backend existe

**Passos de Teste:**
1. Navegar para `investment-service/`
2. Executar `yarn lint`
3. Verificar codigo de saida

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- Exit code 0 (sucesso)
- Nenhum erro de linting reportado
- Apenas warnings permitidos (se houver)

**Pos-condicoes:**
- N/A

---

#### TC-EP01-024: Regras ESLint Configuradas

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-024 |
| **Nome** | Regras ESLint Configuradas |
| **Prioridade** | Media (P2) |
| **Tipo** | Unitario |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- .eslintrc.js existe

**Passos de Teste:**
1. Ler arquivo .eslintrc.js
2. Verificar regras obrigatorias:
   - `semi: [2, 'never']`
   - `quotes: [2, 'single', 'avoid-escape']`
   - `indent: [2, 2, { 'SwitchCase': 1 }]`
   - `camelcase: ['error', { properties: 'never' }]`
   - `no-var: 'error'`

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- Todas as regras obrigatorias presentes
- Configuracao identica ao dialer-service

**Pos-condicoes:**
- N/A

---

#### TC-EP01-025: Codigo Segue Padroes ESLint

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-025 |
| **Nome** | Codigo Segue Padroes ESLint |
| **Prioridade** | Media (P2) |
| **Tipo** | Unitario |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Codigo-fonte existe

**Passos de Teste:**
1. Verificar que arquivos .js nao tem ponto-e-virgula
2. Verificar uso de aspas simples
3. Verificar indentacao de 2 espacos
4. Verificar uso de camelCase

**Dados de Teste:**
- Amostra de arquivos: app-service.js, app-manager.js, app-router.js

**Resultados Esperados:**
- Codigo segue todas as regras configuradas
- Nenhum arquivo viola padroes

**Pos-condicoes:**
- N/A

---

### 2.8 Cenario 8: Infraestrutura de Testes

#### TC-EP01-026: Jest Executa com Sucesso

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-026 |
| **Nome** | Jest Executa com Sucesso |
| **Prioridade** | Alta (P1) |
| **Tipo** | Unitario |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Jest instalado
- Testes existem em src/__tests__/

**Passos de Teste:**
1. Navegar para `investment-service/`
2. Executar `yarn test`
3. Verificar que todos os testes passam

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- Exit code 0
- Todos os testes passam
- Nenhum teste skipped ou failed

**Pos-condicoes:**
- N/A

---

#### TC-EP01-027: MongoDB em Memoria nos Testes

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-027 |
| **Nome** | MongoDB em Memoria nos Testes |
| **Prioridade** | Alta (P1) |
| **Tipo** | Unitario |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- @shelf/jest-mongodb instalado
- Jest preset configurado

**Passos de Teste:**
1. Verificar configuracao Jest em package.json
2. Executar testes e verificar logs
3. Confirmar que MongoDB em memoria e usado

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- Jest preset: "@shelf/jest-mongodb"
- Testes nao conectam ao MongoDB container
- MongoDB em memoria criado automaticamente

**Pos-condicoes:**
- N/A

---

#### TC-EP01-028: Supertest para API Testing

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-028 |
| **Nome** | Supertest para API Testing |
| **Prioridade** | Alta (P1) |
| **Tipo** | Integracao |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- supertest instalado
- Testes de API existem

**Passos de Teste:**
1. Verificar que health.test.js usa supertest
2. Executar teste e verificar requisicao HTTP
3. Verificar que teste valida status code

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- supertest importado nos testes
- Requisicoes HTTP simuladas corretamente
- Assertions validam respostas

**Pos-condicoes:**
- N/A

---

#### TC-EP01-029: Cobertura de Codigo >= 90%

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-029 |
| **Nome** | Cobertura de Codigo >= 90% |
| **Prioridade** | Alta (P1) |
| **Tipo** | Unitario |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Jest com collectCoverage: true
- Testes executados

**Passos de Teste:**
1. Executar `yarn test --coverage`
2. Verificar relatorio de cobertura
3. Verificar que cobertura >= 90% para:
   - Statements
   - Functions
   - Lines
   - Branches >= 85%

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- Cobertura total >= 90%
- Branch coverage >= 85%
- Relatorio gerado em coverage/

**Pos-condicoes:**
- N/A

---

#### TC-EP01-030: Estrutura de Testes Padronizada

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-030 |
| **Nome** | Estrutura de Testes Padronizada |
| **Prioridade** | Media (P2) |
| **Tipo** | Unitario |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Diretorio src/__tests__/ existe
- Diretorio src/__mocks__/ existe

**Passos de Teste:**
1. Verificar estrutura de pastas de testes
2. Verificar que app-base-test.js existe em __mocks__/
3. Verificar padrao de nomenclatura *.test.js

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- src/__tests__/ com arquivos .test.js
- src/__mocks__/ com utilitarios de teste
- Padrao segue dialer-service

**Pos-condicoes:**
- N/A

---

### 2.9 Cenario 9: Frontend SPA Carregando

#### TC-EP01-031: Frontend Carrega no Navegador

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-031 |
| **Nome** | Frontend Carrega no Navegador |
| **Prioridade** | Alta (P1) |
| **Tipo** | E2E |
| **Automatizavel** | Parcial |

**Pre-condicoes:**
- Todos os containers em execucao
- Navegador disponivel

**Passos de Teste:**
1. Abrir navegador
2. Acessar http://localhost/
3. Verificar que pagina carrega sem erros
4. Abrir DevTools Console
5. Verificar que nao ha erros JavaScript

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- Pagina carrega completamente
- Interface visivel e funcional
- Console sem erros criticos

**Pos-condicoes:**
- N/A

---

#### TC-EP01-032: Build Gerado pelo Vite

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-032 |
| **Nome** | Build Gerado pelo Vite |
| **Prioridade** | Alta (P1) |
| **Tipo** | Integracao |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Frontend buildado
- Container investment-app em execucao

**Passos de Teste:**
1. Verificar que dist/ existe no build do container
2. Executar `curl -s http://localhost/ | grep -E "script.*src|link.*href"`
3. Verificar que assets sao servidos corretamente

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- HTML referencia arquivos JS/CSS do Vite
- Assets carregam com HTTP 200
- Nomes de arquivos contem hash (cache busting)

**Pos-condicoes:**
- N/A

---

#### TC-EP01-033: PWA Manifest Configurado

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-033 |
| **Nome** | PWA Manifest Configurado |
| **Prioridade** | Media (P2) |
| **Tipo** | Integracao |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- manifest.json existe em public/
- Frontend servindo arquivos

**Passos de Teste:**
1. Executar `curl -s http://localhost/manifest.json`
2. Verificar campos obrigatorios:
   - name
   - short_name
   - start_url
   - display
   - icons

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- JSON valido retornado
- Todos os campos obrigatorios presentes
- Icons referenciados existem

**Pos-condicoes:**
- N/A

---

#### TC-EP01-034: Service Worker Registrado

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-034 |
| **Nome** | Service Worker Registrado |
| **Prioridade** | Media (P2) |
| **Tipo** | E2E |
| **Automatizavel** | Parcial |

**Pre-condicoes:**
- Frontend carregado no navegador
- Service worker configurado

**Passos de Teste:**
1. Abrir navegador em http://localhost/
2. Abrir DevTools > Application > Service Workers
3. Verificar que service worker esta registrado
4. Verificar status "activated" ou "running"

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- Service worker registrado
- Status ativo
- Arquivo sw.js ou similar existe

**Pos-condicoes:**
- N/A

---

#### TC-EP01-035: Estrutura de Pastas Frontend

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-035 |
| **Nome** | Estrutura de Pastas Frontend |
| **Prioridade** | Media (P2) |
| **Tipo** | Infraestrutura |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Frontend codebase existe

**Passos de Teste:**
1. Verificar que diretorios existem:
   - src/components/
   - src/pages/
   - src/services/
   - src/router/
   - src/store/
   - src/utils/
   - src/assets/
2. Verificar arquivos principais:
   - src/main.js
   - src/App.vue ou App.jsx
   - vite.config.js

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- Todos os diretorios existem
- Arquivos principais presentes
- Estrutura segue especificacao

**Pos-condicoes:**
- N/A

---

#### TC-EP01-036: HTTP Client Configurado

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-036 |
| **Nome** | HTTP Client Configurado |
| **Prioridade** | Media (P2) |
| **Tipo** | Unitario |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- src/services/api.js existe

**Passos de Teste:**
1. Verificar que api.js existe
2. Verificar que base URL e '/api'
3. Verificar que funcoes de request existem

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- API_BASE_URL = '/api'
- Funcoes GET, POST, PUT, DELETE disponiveis
- Headers configurados corretamente

**Pos-condicoes:**
- N/A

---

### 2.10 Cenario 10: Persistencia de Dados MongoDB

#### TC-EP01-037: Dados Persistem Apos Restart

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-037 |
| **Nome** | Dados Persistem Apos Restart |
| **Prioridade** | Alta (P1) |
| **Tipo** | Integracao |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Containers em execucao
- Volume MongoDB configurado

**Passos de Teste:**
1. Inserir documento de teste no MongoDB:
   ```bash
   docker exec moneytrackr-mongodb mongosh moneytrackr --eval 'db.testcollection.insertOne({testId: "persist-test-001", timestamp: new Date()})'
   ```
2. Verificar insercao:
   ```bash
   docker exec moneytrackr-mongodb mongosh moneytrackr --eval 'db.testcollection.find({testId: "persist-test-001"})'
   ```
3. Parar containers: `docker-compose down`
4. Iniciar containers: `docker-compose up -d`
5. Verificar dados:
   ```bash
   docker exec moneytrackr-mongodb mongosh moneytrackr --eval 'db.testcollection.find({testId: "persist-test-001"})'
   ```

**Dados de Teste:**
```javascript
{ testId: "persist-test-001", timestamp: new Date() }
```

**Resultados Esperados:**
- Documento inserido com sucesso
- Apos restart, documento ainda existe
- Volume Docker preserva dados

**Pos-condicoes:**
- Documento de teste removido

---

#### TC-EP01-038: Volume Docker Existe

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-038 |
| **Nome** | Volume Docker Existe |
| **Prioridade** | Alta (P1) |
| **Tipo** | Infraestrutura |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Docker Compose executado pelo menos uma vez

**Passos de Teste:**
1. Executar `docker volume ls`
2. Verificar que volume mongodb-data existe
3. Executar `docker volume inspect mongodb-data`

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- Volume "mongodb-data" listado
- Driver: local
- Mountpoint existe no filesystem

**Pos-condicoes:**
- N/A

---

#### TC-EP01-039: Dados Nao Persistem sem Volume

| Campo | Valor |
|-------|-------|
| **ID** | TC-EP01-039 |
| **Nome** | Dados Nao Persistem sem Volume (Teste Negativo) |
| **Prioridade** | Baixa (P3) |
| **Tipo** | Integracao |
| **Automatizavel** | Sim |

**Pre-condicoes:**
- Compreensao de como volumes funcionam

**Passos de Teste:**
1. Remover volume: `docker volume rm mongodb-data` (apos docker-compose down)
2. Iniciar containers: `docker-compose up -d`
3. Verificar que banco esta vazio
4. Este teste valida que volume e necessario

**Dados de Teste:**
- N/A

**Resultados Esperados:**
- Sem volume, dados sao perdidos
- Confirma importancia do volume configurado

**Pos-condicoes:**
- Recriar volume para testes subsequentes

---

---

## 3. Testes Automatizados

### 3.1 Testes Unitarios (Jest)

| ID | Nome | Arquivo | Prioridade |
|----|------|---------|------------|
| TC-EP01-011 | Health Check Unit Test | health.test.js | P1 |
| TC-EP01-015 | MongoDB Unit Test com Mock | dao.test.js | P1 |
| TC-EP01-019 | Redis Unit Test com Mock | redis.test.js | P1 |
| TC-EP01-022 | OpenAPI Spec Valida | openapi.test.js | P2 |
| TC-EP01-023 | ESLint Passa sem Erros | (CLI) | P1 |
| TC-EP01-024 | Regras ESLint Configuradas | (validacao arquivo) | P2 |
| TC-EP01-026 | Jest Executa com Sucesso | (CLI) | P1 |
| TC-EP01-027 | MongoDB em Memoria nos Testes | (configuracao) | P1 |
| TC-EP01-028 | Supertest para API Testing | health.test.js | P1 |
| TC-EP01-029 | Cobertura de Codigo >= 90% | (CLI coverage) | P1 |
| TC-EP01-030 | Estrutura de Testes Padronizada | (validacao pastas) | P2 |
| TC-EP01-036 | HTTP Client Configurado | api.test.js | P2 |

### 3.2 Testes de Integracao (supertest)

| ID | Nome | Endpoint | Prioridade |
|----|------|----------|------------|
| TC-EP01-005 | Roteamento API para Backend | /api/v1/healthy | P1 |
| TC-EP01-006 | Roteamento Raiz para Frontend | / | P1 |
| TC-EP01-007 | SPA Fallback para Rotas | /* | P2 |
| TC-EP01-008 | Headers de Proxy Corretos | /api/v1/healthy | P2 |
| TC-EP01-009 | Health Check Retorna 200 | /api/v1/healthy | P1 |
| TC-EP01-010 | Health Check Direto no Backend | /v1/healthy | P1 |
| TC-EP01-013 | Conexao MongoDB sem Autenticacao | (conexao) | P1 |
| TC-EP01-014 | Mongoose Configurado e Operacional | (conexao) | P1 |
| TC-EP01-016 | Conexao Redis Estabelecida | (conexao) | P1 |
| TC-EP01-017 | Redis Operacoes de Cache | (redis-cli) | P2 |
| TC-EP01-018 | Redis Pub/Sub Funcional | (redis-cli) | P2 |
| TC-EP01-020 | Swagger UI Disponivel em Dev | /api/docs | P2 |
| TC-EP01-021 | Swagger Nao Disponivel em Prod | /api/docs | P2 |
| TC-EP01-032 | Build Gerado pelo Vite | / | P1 |
| TC-EP01-033 | PWA Manifest Configurado | /manifest.json | P2 |
| TC-EP01-037 | Dados Persistem Apos Restart | (mongodb) | P1 |

### 3.3 Testes de Infraestrutura (Docker)

| ID | Nome | Comando | Prioridade |
|----|------|---------|------------|
| TC-EP01-001 | Subida de Todos os Containers | docker-compose up | P1 |
| TC-EP01-002 | Rede Docker Compartilhada | docker network inspect | P1 |
| TC-EP01-003 | Volume MongoDB Configurado | docker volume ls | P1 |
| TC-EP01-004 | Nenhum Container com Status de Erro | docker ps | P1 |
| TC-EP01-038 | Volume Docker Existe | docker volume ls | P1 |
| TC-EP01-035 | Estrutura de Pastas Frontend | ls -la | P2 |

---

## 4. Testes Manuais

### 4.1 Testes que Requerem Verificacao Visual

| ID | Nome | Justificativa | Prioridade |
|----|------|---------------|------------|
| TC-EP01-031 | Frontend Carrega no Navegador | Verificacao visual da interface | P1 |
| TC-EP01-034 | Service Worker Registrado | DevTools Application tab | P2 |
| TC-EP01-012 | Backend Inicializa sem Erros | Analise de logs | P1 |

### 4.2 Procedimentos de Teste Manual

#### Procedimento 1: Verificacao Visual do Frontend

1. Abrir navegador Chrome/Firefox
2. Acessar http://localhost/
3. Verificar:
   - [ ] Pagina carrega sem erros visuais
   - [ ] Console do navegador sem erros vermelhos
   - [ ] Network tab mostra assets carregando
   - [ ] Aplicacao responsiva (redimensionar janela)

#### Procedimento 2: Verificacao de Service Worker

1. Abrir Chrome DevTools (F12)
2. Navegar para Application > Service Workers
3. Verificar:
   - [ ] Service worker listado
   - [ ] Status: "activated and is running"
   - [ ] Arquivo sw.js ou similar

#### Procedimento 3: Verificacao de Logs

1. Executar `docker logs moneytrackr-backend --tail 100`
2. Verificar:
   - [ ] Mensagem de conexao MongoDB
   - [ ] Mensagem de conexao Redis
   - [ ] Mensagem de servico iniciado
   - [ ] Ausencia de erros criticos

---

## 5. Ambiente de Testes

### 5.1 Requisitos de Hardware

| Recurso | Minimo | Recomendado |
|---------|--------|-------------|
| CPU | 2 cores | 4 cores |
| Memoria RAM | 4 GB | 8 GB |
| Disco | 10 GB | 20 GB |
| Rede | Localhost | Localhost |

### 5.2 Requisitos de Software

| Software | Versao Minima | Versao Testada |
|----------|---------------|----------------|
| Docker Engine | 20.x | 24.x |
| Docker Compose | 2.x | 2.20.x |
| Node.js | 18.x LTS | 18.x LTS |
| Navegador | Chrome 100+ | Chrome 120+ |

### 5.3 Variaveis de Ambiente

```bash
# Backend
NODE_ENV=dev          # Para testes com Swagger
DATABASE_URL=mongodb://mongodb:27017/
DATABASE_NAME_PREFIX=

# Testes
NODE_ENV=test
```

### 5.4 Configuracao de Rede

- Porta 80: Nginx (gateway)
- Portas internas: nao expostas para host
- Rede Docker: moneytrackr-network (bridge)

---

## 6. Dados de Teste

### 6.1 Dados de Teste MongoDB

```javascript
// Documento de teste para persistencia
{
  testId: "persist-test-001",
  testName: "Teste de Persistencia",
  timestamp: new Date(),
  metadata: {
    environment: "test",
    version: "1.0.0"
  }
}
```

### 6.2 Dados de Teste Redis

```bash
# Chaves de teste
SET test:cache:key1 "value1"
SET test:cache:key2 "value2"
EXPIRE test:cache:key1 3600
```

### 6.3 Dados de Teste API

```json
// Headers de teste
{
  "Content-Type": "application/json",
  "X-Test-Header": "test-value",
  "X-Request-ID": "test-123"
}
```

---

## 7. Diretrizes de Severidade de Defeitos

### 7.1 Classificacao de Severidade

| Severidade | Definicao | Exemplos | SLA |
|------------|-----------|----------|-----|
| **Critico (S1)** | Impede funcionamento basico do sistema | Docker Compose nao sobe, Backend nao inicia, MongoDB nao conecta | 4 horas |
| **Alto (S2)** | Funcionalidade principal nao funciona | Health check retorna 500, Nginx nao roteia, Redis nao conecta | 8 horas |
| **Medio (S3)** | Funcionalidade parcialmente afetada | Swagger nao carrega, ESLint com erros, PWA manifest invalido | 24 horas |
| **Baixo (S4)** | Problema cosmético ou de documentacao | Logs com warnings, comentarios desatualizados | 72 horas |

### 7.2 Classificacao de Prioridade

| Prioridade | Criterio |
|------------|----------|
| **P1** | Bloqueia outras stories ou funcionalidades criticas |
| **P2** | Importante mas com workaround disponivel |
| **P3** | Nice-to-have, nao bloqueia releases |

### 7.3 Matriz de Decisao

| Severidade \ Prioridade | P1 | P2 | P3 |
|-------------------------|----|----|----|
| **S1 Critico** | Corrigir imediatamente | Corrigir imediatamente | Corrigir no sprint |
| **S2 Alto** | Corrigir no sprint | Corrigir no sprint | Agendar |
| **S3 Medio** | Corrigir no sprint | Agendar | Backlog |
| **S4 Baixo** | Agendar | Backlog | Backlog |

---

## 8. Criterios de Entrada e Saida

### 8.1 Criterios de Entrada

- [ ] Codigo-fonte disponivel no repositorio
- [ ] Docker e Docker Compose instalados
- [ ] Node.js 18.x instalado
- [ ] Porta 80 disponivel
- [ ] Documentacao da story revisada

### 8.2 Criterios de Saida

- [ ] Todos os 39 casos de teste executados
- [ ] 100% dos testes P1 passando
- [ ] 100% dos testes P2 passando
- [ ] >= 95% dos testes P3 passando
- [ ] Cobertura de codigo >= 90%
- [ ] Zero defeitos S1 ou S2 abertos
- [ ] Relatorio de testes gerado
- [ ] Aprovacao do QA Analyst

### 8.3 Criterios de Suspensao

- Docker Compose falha ao iniciar containers
- Backend nao consegue conectar ao MongoDB ou Redis
- Mais de 3 defeitos S1 encontrados
- Ambiente de testes indisponivel

### 8.4 Criterios de Retomada

- Problema de infraestrutura resolvido
- Defeitos criticos corrigidos
- Ambiente reestabelecido

---

## 9. Resumo do Plano de Testes

### 9.1 Estatisticas de Casos de Teste

| Metrica | Quantidade |
|---------|------------|
| **Total de Casos de Teste** | 39 |
| Testes de Infraestrutura | 8 |
| Testes de Integracao | 18 |
| Testes Unitarios | 10 |
| Testes E2E | 3 |

### 9.2 Distribuicao por Prioridade

| Prioridade | Quantidade | Percentual |
|------------|------------|------------|
| **Alta (P1)** | 22 | 56.4% |
| **Media (P2)** | 14 | 35.9% |
| **Baixa (P3)** | 3 | 7.7% |

### 9.3 Distribuicao por Automacao

| Tipo | Quantidade | Percentual |
|------|------------|------------|
| **Totalmente Automatizavel** | 28 | 71.8% |
| **Parcialmente Automatizavel** | 8 | 20.5% |
| **Manual** | 3 | 7.7% |

### 9.4 Cobertura por Cenario de Aceite

| Cenario | Casos de Teste | Prioridade |
|---------|----------------|------------|
| 1. Docker Compose Orquestracao | 4 | P1 |
| 2. Nginx como Proxy Reverso | 4 | P1/P2 |
| 3. Health Check do Backend | 4 | P1 |
| 4. Conexao com MongoDB | 3 | P1 |
| 5. Conexao com Redis | 4 | P1/P2 |
| 6. Documentacao Swagger/OpenAPI | 3 | P2 |
| 7. ESLint sem Erros | 3 | P1/P2 |
| 8. Infraestrutura de Testes | 5 | P1/P2 |
| 9. Frontend SPA Carregando | 6 | P1/P2 |
| 10. Persistencia de Dados MongoDB | 3 | P1/P3 |

---

## 10. Riscos e Mitigacoes

### 10.1 Riscos de Teste

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|---------------|--------|-----------|
| Containers nao iniciam em ambiente de teste | Media | Alto | Documentar requisitos minimos de hardware |
| Testes de integracao flaky devido a timing | Media | Medio | Adicionar retries e waits apropriados |
| Volume MongoDB corrompido durante testes | Baixa | Alto | Script de cleanup antes de cada suite |
| Redis nao disponivel em testes unitarios | Baixa | Medio | Usar redis-mock consistentemente |

### 10.2 Dependencias de Teste

| Dependencia | Status | Acao se Indisponivel |
|-------------|--------|---------------------|
| Docker Engine | Obrigatorio | Suspender testes de infraestrutura |
| MongoDB Container | Obrigatorio | Suspender testes de integracao |
| Redis Container | Obrigatorio | Suspender testes de integracao |
| Navegador Chrome | Recomendado | Usar curl para testes basicos |

---

## 11. Cronograma de Execucao

### 11.1 Fases de Teste

| Fase | Duracao Estimada | Atividades |
|------|------------------|------------|
| **Setup** | 1 hora | Preparar ambiente, revisar documentacao |
| **Testes de Infraestrutura** | 2 horas | TC-EP01-001 a TC-EP01-004, TC-EP01-038 |
| **Testes de Integracao** | 3 horas | TC-EP01-005 a TC-EP01-022, TC-EP01-032, TC-EP01-033, TC-EP01-037 |
| **Testes Unitarios** | 2 horas | TC-EP01-011, TC-EP01-015, TC-EP01-019, TC-EP01-023 a TC-EP01-030 |
| **Testes E2E/Manuais** | 1 hora | TC-EP01-031, TC-EP01-034 |
| **Relatorio** | 1 hora | Documentar resultados, defeitos |
| **Total** | **10 horas** | |

### 11.2 Ordem de Execucao Recomendada

1. Testes de Infraestrutura (validam base)
2. Testes de Integracao (dependem de infraestrutura)
3. Testes Unitarios (podem rodar em paralelo)
4. Testes E2E/Manuais (validam experiencia final)

---

## 12. Aprovacoes

| Papel | Nome | Data | Assinatura |
|-------|------|------|------------|
| Test Engineer | | | |
| QA Analyst | | | |
| Tech Lead | | | |

---

## Anexo A: Scripts de Teste Automatizados

### A.1 Script de Validacao Docker Compose

```bash
#!/bin/bash
# validate-docker-compose.sh

echo "=== Validando Docker Compose ==="

# Verificar se containers estao rodando
CONTAINERS=("moneytrackr-nginx" "moneytrackr-frontend" "moneytrackr-backend" "moneytrackr-mongodb" "moneytrackr-redis")
ALL_UP=true

for container in "${CONTAINERS[@]}"; do
  STATUS=$(docker inspect -f '{{.State.Status}}' $container 2>/dev/null)
  if [ "$STATUS" != "running" ]; then
    echo "FAIL: $container nao esta rodando (status: $STATUS)"
    ALL_UP=false
  else
    echo "PASS: $container esta rodando"
  fi
done

# Verificar rede
NETWORK=$(docker network inspect moneytrackr-network --format '{{.Name}}' 2>/dev/null)
if [ "$NETWORK" == "moneytrackr-network" ]; then
  echo "PASS: Rede moneytrackr-network existe"
else
  echo "FAIL: Rede moneytrackr-network nao encontrada"
  ALL_UP=false
fi

# Verificar volume
VOLUME=$(docker volume inspect mongodb-data --format '{{.Name}}' 2>/dev/null)
if [ "$VOLUME" == "mongodb-data" ]; then
  echo "PASS: Volume mongodb-data existe"
else
  echo "FAIL: Volume mongodb-data nao encontrado"
  ALL_UP=false
fi

if [ "$ALL_UP" = true ]; then
  echo "=== Todos os testes de infraestrutura passaram ==="
  exit 0
else
  echo "=== Alguns testes falharam ==="
  exit 1
fi
```

### A.2 Script de Validacao de Endpoints

```bash
#!/bin/bash
# validate-endpoints.sh

echo "=== Validando Endpoints ==="

# Health check via Nginx
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/healthy)
if [ "$HTTP_CODE" == "200" ]; then
  echo "PASS: Health check retorna 200"
else
  echo "FAIL: Health check retornou $HTTP_CODE"
fi

# Frontend via Nginx
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/)
if [ "$HTTP_CODE" == "200" ]; then
  echo "PASS: Frontend retorna 200"
else
  echo "FAIL: Frontend retornou $HTTP_CODE"
fi

# SPA fallback
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/rota-inexistente)
if [ "$HTTP_CODE" == "200" ]; then
  echo "PASS: SPA fallback funciona"
else
  echo "FAIL: SPA fallback retornou $HTTP_CODE"
fi

# Manifest PWA
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/manifest.json)
if [ "$HTTP_CODE" == "200" ]; then
  echo "PASS: Manifest.json acessivel"
else
  echo "FAIL: Manifest.json retornou $HTTP_CODE"
fi

echo "=== Validacao de endpoints concluida ==="
```

### A.3 Script de Teste de Persistencia

```bash
#!/bin/bash
# test-persistence.sh

echo "=== Testando Persistencia MongoDB ==="

# Inserir documento de teste
docker exec moneytrackr-mongodb mongosh moneytrackr --quiet --eval 'db.testcollection.insertOne({testId: "persist-test-001", timestamp: new Date()})'

# Verificar insercao
COUNT=$(docker exec moneytrackr-mongodb mongosh moneytrackr --quiet --eval 'db.testcollection.countDocuments({testId: "persist-test-001"})')
if [ "$COUNT" == "1" ]; then
  echo "PASS: Documento inserido"
else
  echo "FAIL: Documento nao inserido"
  exit 1
fi

# Restart containers
echo "Reiniciando containers..."
docker-compose down
docker-compose up -d
sleep 10

# Verificar persistencia
COUNT=$(docker exec moneytrackr-mongodb mongosh moneytrackr --quiet --eval 'db.testcollection.countDocuments({testId: "persist-test-001"})')
if [ "$COUNT" == "1" ]; then
  echo "PASS: Dados persistiram apos restart"
else
  echo "FAIL: Dados foram perdidos apos restart"
  exit 1
fi

# Cleanup
docker exec moneytrackr-mongodb mongosh moneytrackr --quiet --eval 'db.testcollection.deleteMany({testId: "persist-test-001"})'

echo "=== Teste de persistencia concluido com sucesso ==="
```

---

## Anexo B: Checklist de Validacao

### B.1 Checklist Pre-Teste

- [ ] Docker Engine instalado e rodando
- [ ] Docker Compose instalado
- [ ] Node.js 18.x instalado
- [ ] Porta 80 disponivel
- [ ] Repositorio clonado
- [ ] Variaveis de ambiente configuradas

### B.2 Checklist de Execucao

- [ ] TC-EP01-001: Containers sobem
- [ ] TC-EP01-002: Rede compartilhada
- [ ] TC-EP01-003: Volume MongoDB
- [ ] TC-EP01-005: Roteamento API
- [ ] TC-EP01-006: Roteamento Frontend
- [ ] TC-EP01-009: Health check 200
- [ ] TC-EP01-013: MongoDB conecta
- [ ] TC-EP01-016: Redis conecta
- [ ] TC-EP01-023: ESLint passa
- [ ] TC-EP01-026: Jest passa
- [ ] TC-EP01-029: Cobertura >= 90%
- [ ] TC-EP01-031: Frontend carrega
- [ ] TC-EP01-037: Dados persistem

### B.3 Checklist Pos-Teste

- [ ] Todos os testes P1 passaram
- [ ] Defeitos documentados
- [ ] Relatorio gerado
- [ ] Ambiente limpo (containers parados)
- [ ] Dados de teste removidos

---

**Fim do Documento**

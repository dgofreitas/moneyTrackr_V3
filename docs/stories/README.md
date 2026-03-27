# MoneyTrackr V3 - Product Stories

Este diretório contém todas as Product Stories do sistema MoneyTrackr, organizadas por épicos.

## Visão Geral

**MoneyTrackr** é um sistema de gestão de investimentos que permite aos usuários:
- Gerenciar múltiplas carteiras de investimentos
- Registrar transações de compra e venda
- Calcular preço médio automaticamente
- Acompanhar rendimentos e comparar com benchmarks
- Importar dados via CSV e PDF
- Visualizar dashboard customizável

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                         NGINX                                │
│              (Reverse Proxy + SSL)                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌───────────────┐           ┌───────────────┐
│   FRONTEND    │           │   BACKEND     │
│  (React/Vue)  │           │ (Express.js)  │
│     PWA       │           │               │
└───────────────┘           └───────┬───────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌───────────┐   ┌───────────┐   ┌───────────┐
            │  MongoDB  │   │   Redis   │   │ APIs Ext. │
            │  (Dados)  │   │  (Cache)  │   │ (Mercado) │
            └───────────┘   └───────────┘   └───────────┘
```

## Índice de Stories

### Infraestrutura e Backend

| Arquivo | Épico | Descrição | Prioridade | SP |
|---------|-------|-----------|:----------:|:--:|
| [EP01-arquitetura-infraestrutura.md](./EP01-arquitetura-infraestrutura.md) | Arquitetura | Docker, Nginx, Backend, Frontend setup | Alta | ~30 |
| [EP02-autenticacao.md](./EP02-autenticacao.md) | Autenticação | Google OAuth, Email/Senha, Recuperação | Alta | 21 |
| [EP03-carteiras.md](./EP03-carteiras.md) | Carteiras | CRUD, Alternância, Visão Consolidada | Alta | 29 |
| [EP04-transacoes.md](./EP04-transacoes.md) | Transações | Compra, Venda, Validações, CRUD | Alta | 47 |
| [EP05-preco-medio.md](./EP05-preco-medio.md) | Preço Médio | Cálculo, Regras de Venda, Recálculo | Alta | 47 |
| [EP06-cambio.md](./EP06-cambio.md) | Câmbio | Conversão BRL, Histórico de Taxas | Média | 34 |
| [EP07-renda-fixa.md](./EP07-renda-fixa.md) | Renda Fixa | CDI, IPCA, Prefixado | Média | 50 |
| [EP08-importacao-csv.md](./EP08-importacao-csv.md) | Importação CSV | Upload, Parsing, Duplicidades | Média | 23 |
| [EP09-importacao-pdf.md](./EP09-importacao-pdf.md) | Importação PDF | Templates, Extração, Validação | Média | 37 |
| [EP10-eventos-corporativos.md](./EP10-eventos-corporativos.md) | Eventos Corp. | Splits, Bonificações, Fusões | Média | 26 |
| [EP11-proventos.md](./EP11-proventos.md) | Proventos | Dividendos, JCP, Visualização | Média | 19 |
| [EP12-criptomoedas.md](./EP12-criptomoedas.md) | Criptomoedas | Registro, Preços, Valorização | Média | 24 |
| [EP13-fontes-dados-mercado.md](./EP13-fontes-dados-mercado.md) | APIs Mercado | BRAPI, Yahoo, CoinGecko, BCB | Alta | 63 |
| [EP14-atualizacao-dados.md](./EP14-atualizacao-dados.md) | Atualização | Scheduler, Filas, Real-time | Média | 44 |

### Frontend UI/UX

| Arquivo | Épicos | Descrição | Prioridade | SP |
|---------|--------|-----------|:----------:|:--:|
| [EP15-22-frontend-ui.md](./EP15-22-frontend-ui.md) | 15-22 | PWA, Layout, Navegação, Sidebar, Dashboard, Gráficos, Transações UI, Formulários | Alta | 124 |

### Qualidade e Segurança

| Arquivo | Épicos | Descrição | Prioridade | SP |
|---------|--------|-----------|:----------:|:--:|
| [EP23-28-qualidade-seguranca.md](./EP23-28-qualidade-seguranca.md) | 23-28 | Feedback UX, Editor Gráficos, Auditoria, Performance, Segurança, Responsividade | Alta | 111 |

## Resumo de Estimativas

| Categoria | Story Points |
|-----------|:------------:|
| **Infraestrutura e Backend** | ~494 SP |
| **Frontend UI/UX** | ~124 SP |
| **Qualidade e Segurança** | ~111 SP |
| **TOTAL** | **~729 SP** |

## Dependências entre Épicos

```
EP01 (Arquitetura)
  │
  ├──► EP02 (Autenticação)
  │      │
  │      └──► EP03 (Carteiras)
  │             │
  │             └──► EP04 (Transações)
  │                    │
  │                    ├──► EP05 (Preço Médio)
  │                    │
  │                    ├──► EP06 (Câmbio)
  │                    │
  │                    ├──► EP10 (Eventos Corp.)
  │                    │
  │                    └──► EP11 (Proventos)
  │
  ├──► EP13 (Fontes de Dados)
  │      │
  │      └──► EP14 (Atualização)
  │
  └──► EP15-22 (Frontend UI)
         │
         └──► EP23-28 (Qualidade)

EP07 (Renda Fixa) ──► EP13 (Fontes de Dados)
EP08-09 (Importação) ──► EP04 (Transações)
EP12 (Cripto) ──► EP13 (Fontes de Dados)
```

## Ordem Sugerida de Implementação

### Sprint 1 - Fundação
1. EP01 - Arquitetura e Infraestrutura
2. EP02 - Autenticação
3. EP03 - Carteiras

### Sprint 2 - Core Business
4. EP04 - Transações
5. EP05 - Preço Médio
6. EP13 - Fontes de Dados de Mercado

### Sprint 3 - Funcionalidades Essenciais
7. EP14 - Atualização de Dados
8. EP06 - Câmbio
9. EP07 - Renda Fixa

### Sprint 4 - Frontend Base
10. EP15-22 - Frontend UI (PWA, Layout, Dashboard, Gráficos)

### Sprint 5 - Importação
11. EP08 - Importação CSV
12. EP09 - Importação PDF

### Sprint 6 - Funcionalidades Avançadas
13. EP10 - Eventos Corporativos
14. EP11 - Proventos
15. EP12 - Criptomoedas

### Sprint 7 - Qualidade
16. EP23-28 - Auditoria, Performance, Segurança, Responsividade

## Stack Tecnológica

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **ORM**: Mongoose (MongoDB)
- **Cache**: Redis
- **Testes**: Jest + Supertest + @shelf/jest-mongodb
- **Lint**: ESLint (no semicolons, single quotes, 2-space indent)

### Frontend
- **Framework**: React 18 ou Vue 3
- **Build**: Vite
- **PWA**: Vite PWA Plugin
- **Gráficos**: Chart.js ou Apache ECharts
- **UI**: Headless UI + Tailwind CSS
- **Ícones**: Lucide

### Infraestrutura
- **Container**: Docker + Docker Compose
- **Proxy**: Nginx
- **Banco**: MongoDB 6+
- **Cache**: Redis 7+

## Como Usar Estas Stories

1. **Leia a story completa** antes de iniciar a implementação
2. **Verifique as dependências** - stories bloqueadas devem ser implementadas primeiro
3. **Siga os critérios de aceite** - cada cenário Gherkin é um teste verificável
4. **Consulte o Detalhamento Técnico** - contém modelos, rotas e código de referência
5. **Use o DoD** - Definition of Done garante qualidade mínima

## Contato

Product Owner: [Definir]
Tech Lead: [Definir]

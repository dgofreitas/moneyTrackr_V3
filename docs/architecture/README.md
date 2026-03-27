# MoneyTrackr V3 - Planos Técnicos de Arquitetura

Este diretório contém todos os planos técnicos de arquitetura do sistema MoneyTrackr, derivados das Product Stories.

## Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              NGINX (Reverse Proxy)                       │
│                         SSL Termination + Routing                        │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
              ┌─────────────────────┴─────────────────────┐
              │                                           │
              ▼                                           ▼
┌─────────────────────────────┐         ┌─────────────────────────────────┐
│        FRONTEND             │         │           BACKEND               │
│   (Vue 3 + Vite + PWA)      │         │   (Node.js + Express.js)       │
│                             │         │                                 │
│  ┌───────────────────────┐ │         │  ┌───────────────────────────┐ │
│  │ Pages                  │ │         │  │ Routers (Express Routes)  │ │
│  │ Components             │ │         │  └─────────────┬─────────────┘ │
│  │ Services (API Client)  │ │         │                │               │
│  │ Stores (Pinia)         │ │         │  ┌─────────────▼─────────────┐ │
│  │ Composables            │ │         │  │ Managers (Business Logic) │ │
│  └───────────────────────┘ │         │  └─────────────┬─────────────┘ │
│                             │         │                │               │
│  ┌───────────────────────┐ │         │  ┌─────────────▼─────────────┐ │
│  │ PWA Service Worker    │ │         │  │ DAOs (Data Access)        │ │
│  │ Offline Cache         │ │         │  └─────────────┬─────────────┘ │
│  └───────────────────────┘ │         │                │               │
│                             │         │  ┌─────────────▼─────────────┐ │
│                             │         │  │ Models (Mongoose Schemas) │ │
│                             │         │  └───────────────────────────┘ │
└─────────────────────────────┘         └─────────────────────────────────┘
                                                    │
                    ┌───────────────────────────────┼───────────────────────────────┐
                    │                               │                               │
                    ▼                               ▼                               ▼
          ┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
          │    MongoDB      │             │     Redis       │             │  External APIs  │
          │   (Persistência) │             │    (Cache)     │             │ (BRAPI, Yahoo,  │
          │                 │             │                 │             │  CoinGecko, BCB)│
          └─────────────────┘             └─────────────────┘             └─────────────────┘
```

## Índice de Planos Técnicos

### Infraestrutura e Backend Core

| Arquivo | Épico | Descrição | Linhas |
|---------|-------|-----------|:------:|
| [TECH-EP01-arquitetura.md](./TECH-EP01-arquitetura.md) | 1 | Docker, Nginx, Backend/Frontend setup | 894 |
| [TECH-EP02-autenticacao.md](./TECH-EP02-autenticacao.md) | 2 | JWT, OAuth Google, Redis sessions | 1646 |
| [TECH-EP03-carteiras.md](./TECH-EP03-carteiras.md) | 3 | CRUD carteiras, ativação, consolidação | 1556 |
| [TECH-EP04-transacoes.md](./TECH-EP04-transacoes.md) | 4 | Compra/venda, validações, P/L | 2262 |
| [TECH-EP05-preco-medio.md](./TECH-EP05-preco-medio.md) | 5 | Cálculo preço médio, recálculo | 1573 |

### Funcionalidades de Negócio

| Arquivo | Épico | Descrição | Linhas |
|---------|-------|-----------|:------:|
| [TECH-EP06-cambio.md](./TECH-EP06-cambio.md) | 6 | Conversão BRL, histórico de taxas | 1793 |
| [TECH-EP07-renda-fixa.md](./TECH-EP07-renda-fixa.md) | 7 | CDI, IPCA, Prefixado | 1992 |
| [TECH-EP08-importacao-csv.md](./TECH-EP08-importacao-csv.md) | 8 | Upload CSV, parsing, duplicidades | 1752 |
| [TECH-EP09-importacao-pdf.md](./TECH-EP09-importacao-pdf.md) | 9 | Templates PDF, extração | 1865 |
| [TECH-EP10-eventos-corporativos.md](./TECH-EP10-eventos-corporativos.md) | 10 | Splits, bonificações, fusões | 3902 |
| [TECH-EP11-proventos.md](./TECH-EP11-proventos.md) | 11 | Dividendos, JCP, visualização | 1259 |
| [TECH-EP12-criptomoedas.md](./TECH-EP12-criptomoedas.md) | 12 | Registro cripto, preços | 1542 |

### Integração e Dados

| Arquivo | Épico | Descrição | Linhas |
|---------|-------|-----------|:------:|
| [TECH-EP13-fontes-dados-mercado.md](./TECH-EP13-fontes-dados-mercado.md) | 13 | Provider pattern, BRAPI, Yahoo, CoinGecko, BCB | 1818 |
| [TECH-EP14-atualizacao-dados.md](./TECH-EP14-atualizacao-dados.md) | 14 | Scheduler, filas, real-time updates | 2604 |

### Frontend e Qualidade

| Arquivo | Épicos | Descrição | Linhas |
|---------|--------|-----------|:------:|
| [TECH-EP15-22-frontend-ui.md](./TECH-EP15-22-frontend-ui.md) | 15-22 | PWA, Layout, Dashboard, Gráficos, Formulários | 2193 |
| [TECH-EP23-28-qualidade-seguranca.md](./TECH-EP23-28-qualidade-seguranca.md) | 23-28 | Auditoria, Performance, Segurança, Responsividade | 2255 |

## Resumo

| Categoria | Documentos | Linhas |
|-----------|:----------:|:------:|
| **Infraestrutura e Backend Core** | 5 | 7.931 |
| **Funcionalidades de Negócio** | 7 | 12.305 |
| **Integração e Dados** | 2 | 4.422 |
| **Frontend e Qualidade** | 2 | 4.448 |
| **TOTAL** | **16** | **~31.000** |

## Estrutura de Cada Plano

Cada plano técnico contém:

1. **Visão Geral da Arquitetura** - Diagramas ASCII dos componentes
2. **Componentes Backend** - Models, DAOs, Managers, Routers
3. **Componentes Frontend** - Pages, Components, Services, Store
4. **API Contracts** - Especificações OpenAPI/Swagger
5. **Fluxos de Dados** - Diagramas de sequência
6. **Estrutura de Arquivos** - Árvore de diretórios
7. **Ordem de Implementação** - Fases priorizadas
8. **Riscos Técnicos** - Tabela com mitigações
9. **Dependências** - Pacotes NPM e épicos relacionados
10. **Checklist de Implementação** - Itens verificáveis

## Stack Tecnológica

### Backend
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| Node.js | 18+ | Runtime |
| Express.js | 4.x | Framework Web |
| Mongoose | 7.x | ODM MongoDB |
| Redis | 7.x | Cache + Pub/Sub |
| Jest | 29.x | Testes |
| node-cron | 3.x | Scheduler |
| Bull | 4.x | Filas |
| ws | 8.x | WebSocket |

### Frontend
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| Vue | 3.x | Framework UI |
| Vite | 5.x | Build Tool |
| Pinia | 2.x | State Management |
| Vue Router | 4.x | Roteamento |
| Chart.js | 4.x | Gráficos |
| Tailwind CSS | 3.x | Styling |

### Infraestrutura
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| Docker | 24.x | Containerização |
| Docker Compose | 2.x | Orquestração |
| Nginx | 1.25 | Reverse Proxy |
| MongoDB | 6.x | Banco de Dados |

## Ordem de Implementação Recomendada

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SPRINT 1: FUNDAÇÃO                                                      │
├─────────────────────────────────────────────────────────────────────────┤
│ EP01 → Arquitetura e Infraestrutura                                     │
│ EP02 → Autenticação                                                     │
│ EP03 → Carteiras                                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ SPRINT 2: CORE BUSINESS                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│ EP04 → Transações                                                       │
│ EP05 → Preço Médio                                                      │
│ EP13 → Fontes de Dados de Mercado                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ SPRINT 3: INTEGRAÇÃO                                                    │
├─────────────────────────────────────────────────────────────────────────┤
│ EP14 → Atualização de Dados                                             │
│ EP06 → Câmbio                                                           │
│ EP07 → Renda Fixa                                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ SPRINT 4: FRONTEND BASE                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│ EP15-22 → PWA, Layout, Dashboard, Gráficos, Transações UI, Formulários  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ SPRINT 5: IMPORTAÇÃO                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│ EP08 → Importação CSV                                                   │
│ EP09 → Importação PDF                                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ SPRINT 6: AVANÇADO                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│ EP10 → Eventos Corporativos                                             │
│ EP11 → Proventos                                                        │
│ EP12 → Criptomoedas                                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ SPRINT 7: QUALIDADE                                                      │
├─────────────────────────────────────────────────────────────────────────┤
│ EP23-28 → Auditoria, Performance, Segurança, Responsividade             │
└─────────────────────────────────────────────────────────────────────────┘
```

## Como Usar Estes Planos

1. **Leia o plano técnico completo** antes de iniciar a implementação
2. **Verifique as dependências** - épicos bloqueantes devem ser implementados primeiro
3. **Siga a estrutura de arquivos** - mantenha a arquitetura em camadas
4. **Use os API Contracts** - siga as especificações OpenAPI
5. **Consulte os diagramas de sequência** - entenda o fluxo de dados
6. **Verifique o checklist** - garanta que todos os itens foram implementados

## Relação com Product Stories

Cada plano técnico (`TECH-EP*.md`) é derivado de uma Product Story (`EP*.md`):

| Product Story | Plano Técnico |
|---------------|---------------|
| `stories/EP01-arquitetura-infraestrutura.md` | `architecture/TECH-EP01-arquitetura.md` |
| `stories/EP02-autenticacao.md` | `architecture/TECH-EP02-autenticacao.md` |
| ... | ... |

## Contato

Tech Lead: [Definir]
Arquiteto: [Definir]

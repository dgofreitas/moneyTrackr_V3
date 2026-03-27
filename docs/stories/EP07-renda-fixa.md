# EP07 — Renda Fixa

**Épico**: 7 — Renda Fixa
**Autor**: @product-owner | **Data**: 2026-03-27
**Status**: Pronta para @architect

---

## Visão Geral do Épico

O módulo de Renda Fixa permite ao investidor registrar, acompanhar e calcular o rendimento de investimentos de renda fixa nas três modalidades mais comuns do mercado brasileiro: **CDI**, **IPCA+** e **Prefixado**. O sistema deve buscar automaticamente os índices econômicos (CDI, IPCA, SELIC) e calcular o valor atualizado de cada investimento com base nas fórmulas financeiras corretas, utilizando dias úteis (base 252) para cálculos de juros compostos.

### Personas

| Persona | Descrição |
|---------|-----------|
| **Investidor** | Usuário autenticado que possui carteira(s) de investimento e deseja registrar e acompanhar investimentos de renda fixa |
| **Sistema** | Serviço backend que executa jobs automáticos de atualização de índices econômicos |

### Métricas de Sucesso (KPIs)

- Precisão de cálculo: diferença ≤ 0,01% em relação a calculadoras oficiais (ex: Calculadora do Cidadão - BACEN)
- Tempo de resposta da API de listagem: ≤ 500ms (p95)
- Atualização diária dos índices: 100% dos dias úteis com dados atualizados até 10h (BRT)
- Cobertura de testes: ≥ 90%

---

## Grafo de Dependências

```
EP02 (Autenticação) ──┐
                      ├──→ EP07-S01 (CRUD Renda Fixa) ──→ EP07-S03 (Cálculo CDI)
EP03 (Carteiras) ─────┘                                 ──→ EP07-S04 (Cálculo IPCA+)
                                                         ──→ EP07-S05 (Cálculo Prefixado)
                      ┌──→ EP07-S03
EP07-S02 (Índices) ───┤
                      └──→ EP07-S04

EP13 (Fontes de Dados) ──→ EP07-S02 (API de Índices Econômicos)
EP14 (Atualização) ──→ EP07-S02 (Job Diário)

EP07-S06 (Frontend) ──→ EP07-S01, EP07-S03, EP07-S04, EP07-S05
```

---

## EP07-S01 — CRUD de Investimentos de Renda Fixa

### [EP07-S01] Cadastro e Gestão de Investimentos de Renda Fixa

**Como** investidor
**Eu quero** cadastrar, consultar, editar e remover investimentos de renda fixa
**Para que** eu possa organizar e acompanhar meus investimentos de renda fixa dentro da minha carteira

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points

**Contexto**:
O investidor precisa de um CRUD completo para registrar investimentos de renda fixa vinculados a uma carteira. Cada investimento possui um tipo (CDI, IPCA+ ou Prefixado), valor principal aplicado, taxa/percentual do indexador, data de início, data de vencimento e instituição financeira. A remoção utiliza soft delete (campo `isDeleted`) para manter o histórico de auditoria, conforme definido no Épico 25.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o investidor está autenticado e possui uma carteira ativa
      QUANDO ele envia POST `/v1/public/fixed-income` com dados válidos `{ walletId, name, type: "CDI", principal: 10000, rate: 0, indexerPercentage: 110, startDate: "2025-01-15", maturityDate: "2027-01-15", institution: "Banco XYZ" }`
      ENTÃO o sistema deve criar o investimento com status 201 e retornar o objeto criado com `_id` gerado (UUID v4), `userId` extraído do token JWT, `isDeleted: false`, e timestamps `createdAt` e `updatedAt`

- [ ] DADO que o investidor possui investimentos de renda fixa cadastrados na carteira ativa
      QUANDO ele envia GET `/v1/public/fixed-income?walletId={walletId}`
      ENTÃO o sistema deve retornar status 200 com a lista de investimentos onde `isDeleted: false`, ordenados por `createdAt` descendente, incluindo todos os campos do model

- [ ] DADO que o investidor possui um investimento de renda fixa cadastrado
      QUANDO ele envia PUT `/v1/public/fixed-income/{id}` com campos atualizados `{ name: "CDB Novo Nome", institution: "Outro Banco" }`
      ENTÃO o sistema deve atualizar apenas os campos enviados, atualizar o campo `updatedAt`, e retornar status 200 com o objeto atualizado

- [ ] DADO que o investidor possui um investimento de renda fixa cadastrado
      QUANDO ele envia DELETE `/v1/public/fixed-income/{id}`
      ENTÃO o sistema deve realizar soft delete (`isDeleted: true`), atualizar `updatedAt`, e retornar status 200. O investimento não deve mais aparecer nas listagens

- [ ] DADO que o investidor envia POST `/v1/public/fixed-income` com dados inválidos (ex: `type: "INVALIDO"`, `principal: -100`, `startDate` posterior a `maturityDate`)
      QUANDO a requisição é processada
      ENTÃO o sistema deve retornar status 400 com mensagem de erro descritiva indicando o campo inválido

- [ ] DADO que o investidor tenta acessar um investimento que pertence a outro usuário
      QUANDO ele envia GET, PUT ou DELETE com o `id` do investimento de outro usuário
      ENTÃO o sistema deve retornar status 404 (não revelando a existência do recurso)

**Dependências**:
- Bloqueada por: EP02 (Autenticação — JWT), EP03 (Carteiras — walletId)
- Bloqueia: EP07-S03, EP07-S04, EP07-S05, EP07-S06

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários e de integração com cobertura ≥ 90%
- [ ] Testes de integração passando (CRUD completo + validações + segurança)
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação OpenAPI (openapi.yml) atualizada com as 4 rotas
- [ ] PR criado por @merge-request

**Notas Técnicas**:

#### Estrutura de Arquivos

```
src/app/fixed-income/
├── fixed-income-router.js      # Rotas HTTP (GET/POST/PUT/DELETE)
├── fixed-income-manager.js     # Lógica de negócio, validações
├── fixed-income-dao.js         # Acesso a dados MongoDB
└── fixed-income-model.js       # Schema Mongoose
```

#### Model — `fixed-income-model.js`

```javascript
const fixedIncomeModelSchema = new mongoose.Schema({
  _id: { type: String, required: true, default: uuidv4 },
  walletId: { type: String, required: true, ref: 'wallet' },
  userId: { type: String, required: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  type: {
    type: String,
    required: true,
    enum: ['CDI', 'IPCA', 'PREFIXADO'],
  },
  principal: { type: Number, required: true, min: 0.01 },
  rate: { type: Number, required: true, default: 0 },          // Taxa fixa anual (ex: 0.05 = 5% a.a.)
  indexerPercentage: { type: Number, required: true, default: 100 }, // Percentual do indexador (ex: 110 = 110% do CDI)
  startDate: { type: Date, required: true },
  maturityDate: { type: Date, required: true },
  institution: { type: String, required: true, trim: true, maxlength: 100 },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { versionKey: false })

fixedIncomeModelSchema.index({ userId: 1, walletId: 1, isDeleted: 1 })
fixedIncomeModelSchema.index({ walletId: 1, type: 1 })
```

#### Validações no Manager

| Campo | Regra |
|-------|-------|
| `type` | Deve ser `CDI`, `IPCA` ou `PREFIXADO` |
| `principal` | Deve ser > 0 |
| `startDate` | Deve ser ≤ `maturityDate` |
| `maturityDate` | Deve ser data futura ou passada (investimentos já vencidos são permitidos) |
| `rate` | Para `PREFIXADO`: obrigatório > 0. Para `CDI`: pode ser 0. Para `IPCA`: obrigatório > 0 (spread) |
| `indexerPercentage` | Para `CDI`: obrigatório > 0 (ex: 100, 110). Para `IPCA`/`PREFIXADO`: ignorado, default 100 |
| `walletId` | Deve pertencer ao `userId` do token |

#### Constantes de Erro (app-constants.js)

```javascript
FIXED_INCOME_NOT_FOUND: {
  statusCode: 404,
  code: 'FIXED_INCOME_NOT_FOUND',
  message: 'Investimento de renda fixa não encontrado',
},
FIXED_INCOME_CREATE_ERROR: {
  statusCode: 500,
  code: 'FIXED_INCOME_CREATE_ERROR',
  message: 'Erro ao criar investimento de renda fixa',
},
FIXED_INCOME_INVALID_TYPE: {
  statusCode: 400,
  code: 'FIXED_INCOME_INVALID_TYPE',
  message: 'Tipo de investimento inválido. Valores permitidos: CDI, IPCA, PREFIXADO',
},
FIXED_INCOME_INVALID_DATES: {
  statusCode: 400,
  code: 'FIXED_INCOME_INVALID_DATES',
  message: 'Data de início deve ser anterior ou igual à data de vencimento',
},
FIXED_INCOME_INVALID_PRINCIPAL: {
  statusCode: 400,
  code: 'FIXED_INCOME_INVALID_PRINCIPAL',
  message: 'Valor principal deve ser maior que zero',
},
```

**Cenários de Teste**:
- Cenário 1: Criar investimento CDI com todos os campos válidos → 201
- Cenário 2: Criar investimento IPCA+ com taxa spread + indexerPercentage → 201
- Cenário 3: Criar investimento Prefixado com rate obrigatório → 201
- Cenário 4: Criar investimento com tipo inválido → 400
- Cenário 5: Criar investimento com principal negativo → 400
- Cenário 6: Criar investimento com startDate > maturityDate → 400
- Cenário 7: Listar investimentos filtrando por walletId (exclui isDeleted) → 200
- Cenário 8: Atualizar nome e instituição de investimento existente → 200
- Cenário 9: Soft delete de investimento → 200, não aparece mais na listagem
- Cenário 10: Tentativa de acessar investimento de outro usuário → 404
- Cenário 11: Criar investimento sem autenticação → 401

---

## EP07-S02 — Índices Econômicos (CDI, IPCA, SELIC)

### [EP07-S02] Serviço de Índices Econômicos

**Como** sistema
**Eu quero** buscar, armazenar e disponibilizar índices econômicos diários (CDI, IPCA, SELIC)
**Para que** os cálculos de rentabilidade de renda fixa utilizem dados oficiais e atualizados

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 13 story points

**Contexto**:
O cálculo correto de investimentos de renda fixa depende dos índices econômicos oficiais. O CDI é publicado diariamente pelo CETIP/B3 e utiliza taxa diária. O IPCA é publicado mensalmente pelo IBGE. A SELIC é publicada diariamente pelo BACEN. O sistema deve possuir um job diário que busca esses índices de APIs externas (BACEN API, BRAPI) e os armazena no MongoDB. Deve haver um mecanismo de fallback caso a API primária esteja indisponível. O cache Redis deve ser utilizado para evitar chamadas excessivas (conforme Épico 1 — Cache).

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o job diário de atualização é executado às 08:00 (BRT) em dia útil
      QUANDO a API do BACEN está disponível
      ENTÃO o sistema deve buscar os valores de CDI, IPCA e SELIC do dia anterior, salvá-los no collection `economic-indexes` e atualizar o cache Redis com TTL de 24h

- [ ] DADO que a API primária (BACEN) está indisponível
      QUANDO o job diário tenta buscar os índices
      ENTÃO o sistema deve utilizar a API de fallback (BRAPI), logar um warning, e persistir os dados normalmente

- [ ] DADO que ambas as APIs (primária e fallback) estão indisponíveis
      QUANDO o job diário tenta buscar os índices
      ENTÃO o sistema deve logar um erro crítico, manter os dados existentes inalterados, e agendar uma nova tentativa em 30 minutos (máximo 5 retentativas)

- [ ] DADO que o serviço de cálculo precisa do CDI acumulado entre duas datas
      QUANDO ele chama `getAccumulatedIndex('CDI', startDate, endDate)`
      ENTÃO o sistema deve retornar o fator acumulado multiplicando `(1 + taxaDiaria)` de cada dia útil no intervalo, utilizando cache Redis quando disponível

- [ ] DADO que o serviço de cálculo precisa do IPCA acumulado entre duas datas
      QUANDO ele chama `getAccumulatedIndex('IPCA', startDate, endDate)`
      ENTÃO o sistema deve retornar o fator acumulado considerando a variação mensal do IPCA, pro-rata para meses parciais

- [ ] DADO que não existem dados de índice para o período solicitado
      QUANDO o cálculo é requisitado
      ENTÃO o sistema deve retornar erro 422 com mensagem `Dados de índice econômico indisponíveis para o período solicitado`

**Dependências**:
- Bloqueada por: EP13 (Fontes de Dados — APIs de índices econômicos), EP14 (Atualização — job scheduling)
- Bloqueia: EP07-S03 (Cálculo CDI), EP07-S04 (Cálculo IPCA+)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários e de integração com cobertura ≥ 90%
- [ ] Testes de integração passando (fetch, fallback, cache, acumulado)
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação atualizada (APIs utilizadas, formato dos dados)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

#### Estrutura de Arquivos

```
src/app/economic-index/
├── economic-index-router.js      # Rota interna (GET /v1/private/economic-index)
├── economic-index-manager.js     # Lógica de busca, acumulação, cache
├── economic-index-dao.js         # Acesso ao MongoDB
├── economic-index-model.js       # Schema Mongoose
└── economic-index-job.js         # Job diário de atualização (cron)

src/dispatchers/
└── bacen-dispatcher.js           # Cliente HTTP para API BACEN + BRAPI fallback
```

#### Model — `economic-index-model.js`

```javascript
const economicIndexModelSchema = new mongoose.Schema({
  _id: { type: String, required: true, default: uuidv4 },
  indexType: {
    type: String,
    required: true,
    enum: ['CDI', 'IPCA', 'SELIC'],
  },
  value: { type: Number, required: true },   // Taxa diária (CDI/SELIC) ou mensal (IPCA) como decimal
  date: { type: Date, required: true },
  source: { type: String, required: true },  // 'BACEN' ou 'BRAPI'
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false })

economicIndexModelSchema.index({ indexType: 1, date: 1 }, { unique: true })
economicIndexModelSchema.index({ date: 1 })
```

#### APIs Externas

| API | Endpoint | Dados | Prioridade |
|-----|----------|-------|------------|
| BACEN (SGS) | `https://api.bcb.gov.br/dados/serie/bcdata.sgs.{serie}/dados?formato=json` | CDI (série 12), SELIC (série 11), IPCA (série 433) | Primária |
| BRAPI | `https://brapi.dev/api/v2/prime-rate?country=brazil` | CDI, SELIC | Fallback |

#### Cache Redis

| Chave | Valor | TTL |
|-------|-------|-----|
| `economic-index:CDI:latest` | Última taxa CDI diária | 24h |
| `economic-index:IPCA:latest` | Última taxa IPCA mensal | 24h |
| `economic-index:CDI:accumulated:{startDate}:{endDate}` | Fator acumulado calculado | 1h |
| `economic-index:IPCA:accumulated:{startDate}:{endDate}` | Fator acumulado calculado | 1h |

#### Fórmulas de Acumulação

**CDI Acumulado (dia a dia)**:
```
fatorAcumulado = Π (1 + CDI_diario_i) para cada dia útil i no intervalo
```

**IPCA Acumulado (mês a mês)**:
```
fatorAcumulado = Π (1 + IPCA_mensal_i) para cada mês i no intervalo
// Para meses parciais: pro-rata = (1 + IPCA_mensal)^(dias_no_mes / total_dias_mes)
```

**Cenários de Teste**:
- Cenário 1: Job diário busca CDI do BACEN e persiste no MongoDB → sucesso
- Cenário 2: API BACEN indisponível, fallback para BRAPI → sucesso com log warning
- Cenário 3: Ambas APIs indisponíveis → erro logado, retentativa agendada
- Cenário 4: Cálculo de CDI acumulado entre 2025-01-02 e 2025-06-30 → fator correto
- Cenário 5: Cálculo de IPCA acumulado com mês parcial → pro-rata correto
- Cenário 6: Cache hit para acumulado já calculado → retorno via Redis sem query MongoDB
- Cenário 7: Tentativa de buscar índice para período sem dados → erro 422
- Cenário 8: Índice duplicado (mesma data e tipo) não cria registro duplicado → upsert

---

## EP07-S03 — Cálculo de Investimento CDI

### [EP07-S03] Cálculo de Rentabilidade CDI

**Como** investidor
**Eu quero** que o sistema calcule automaticamente o valor atualizado dos meus investimentos atrelados ao CDI
**Para que** eu saiba quanto meu investimento rendeu sem precisar calcular manualmente

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points

**Contexto**:
Investimentos atrelados ao CDI (como CDBs, LCIs, LCAs) são remunerados com base em um percentual do CDI acumulado. Por exemplo, um CDB que paga 110% do CDI rende 10% a mais que a taxa CDI de referência. O cálculo é feito dia a dia útil, utilizando a taxa CDI diária acumulada desde a data de aplicação. A base de cálculo no Brasil é de 252 dias úteis por ano.

**Fórmula**:
```
valorAtual = principal × Π(1 + CDI_diario_i × percentual/100) para cada dia útil i
```

Onde:
- `CDI_diario_i` = taxa CDI do dia i (ex: 0.000407 para CDI anual de ~10,75%)
- `percentual` = indexerPercentage do investimento (ex: 110 para 110% do CDI)

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO um investimento CDI com `principal: 10000`, `indexerPercentage: 100`, `startDate: 2025-01-02`
      QUANDO o cálculo é executado para a data atual
      ENTÃO o valor atual deve ser `principal × fatorCDIacumulado` com precisão de 2 casas decimais, e o rendimento percentual deve ser `((valorAtual / principal) - 1) × 100`

- [ ] DADO um investimento CDI com `indexerPercentage: 110` (110% do CDI)
      QUANDO o cálculo é executado
      ENTÃO cada fator diário deve ser `(1 + CDI_diario × 1.10)` e o valor final deve refletir o rendimento 10% acima do CDI

- [ ] DADO um investimento CDI com `indexerPercentage: 90` (90% do CDI)
      QUANDO o cálculo é executado
      ENTÃO cada fator diário deve ser `(1 + CDI_diario × 0.90)` e o valor final deve refletir o rendimento 10% abaixo do CDI

- [ ] DADO um investimento CDI cuja `maturityDate` já passou
      QUANDO o cálculo é executado
      ENTÃO o sistema deve calcular o valor apenas até a `maturityDate` (não além), e indicar status `VENCIDO`

- [ ] DADO que não existem dados de CDI para parte do período
      QUANDO o cálculo é executado
      ENTÃO o sistema deve calcular até a última data com dados disponíveis e indicar `dataUltimaAtualizacao` na resposta

**Dependências**:
- Bloqueada por: EP07-S01 (CRUD Renda Fixa), EP07-S02 (Índices Econômicos)
- Bloqueia: EP07-S06 (Frontend)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura ≥ 90% (cálculos validados contra valores de referência)
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação atualizada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

#### Estrutura de Arquivos

```
src/app/fixed-income/
└── fixed-income-calculator.js    # Serviço de cálculo (CDI, IPCA, Prefixado)
```

#### Serviço de Cálculo — `fixed-income-calculator.js`

```javascript
class FixedIncomeCalculator {
  constructor(economicIndexManager) {
    this.economicIndexManager = economicIndexManager
  }

  async calculateCDI({ principal, indexerPercentage, startDate, maturityDate }) {
    const endDate = min(maturityDate, today())
    const cdiRates = await this.economicIndexManager.getDailyRates('CDI', startDate, endDate)
    const percentage = indexerPercentage / 100

    let accumulatedFactor = 1
    for (const rate of cdiRates) {
      accumulatedFactor *= (1 + rate.value * percentage)
    }

    const currentValue = round(principal * accumulatedFactor, 2)
    const yieldPercentage = round((accumulatedFactor - 1) * 100, 4)

    return {
      currentValue,
      yieldPercentage,
      yieldAbsolute: round(currentValue - principal, 2),
      lastUpdateDate: cdiRates[cdiRates.length - 1]?.date,
      status: maturityDate <= today() ? 'VENCIDO' : 'ATIVO',
      businessDays: cdiRates.length,
    }
  }
}
```

#### Dados de Referência para Testes

| Cenário | Principal | % CDI | Período | CDI Anual ~10,75% | Valor Esperado |
|---------|-----------|-------|---------|---------------------|----------------|
| 100% CDI, 252 d.u. | R$ 10.000 | 100 | 1 ano | 10,75% | ~R$ 11.075,00 |
| 110% CDI, 252 d.u. | R$ 10.000 | 110 | 1 ano | 10,75% | ~R$ 11.183,71 |
| 90% CDI, 126 d.u. | R$ 5.000 | 90 | 6 meses | 10,75% | ~R$ 5.238,07 |

**Cenários de Teste**:
- Cenário 1: CDI 100% por 252 dias úteis → valor correto com precisão de 2 casas
- Cenário 2: CDI 110% por 252 dias úteis → rendimento proporcional acima
- Cenário 3: CDI 90% por 126 dias úteis → rendimento proporcional abaixo
- Cenário 4: Investimento vencido → cálculo até maturityDate, status VENCIDO
- Cenário 5: Dados parciais de CDI → cálculo até última data disponível
- Cenário 6: Investimento com startDate hoje → valorAtual = principal

---

## EP07-S04 — Cálculo de Investimento IPCA+

### [EP07-S04] Cálculo de Rentabilidade IPCA+

**Como** investidor
**Eu quero** que o sistema calcule automaticamente o valor atualizado dos meus investimentos IPCA+
**Para que** eu acompanhe a rentabilidade real dos meus investimentos com proteção inflacionária

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points

**Contexto**:
Investimentos IPCA+ (como Tesouro IPCA+, CDBs IPCA+) são compostos por duas partes: a correção pela inflação (IPCA acumulado) e um spread fixo anual. O cálculo considera a variação mensal do IPCA (publicada pelo IBGE) acumulada desde a data de aplicação, mais a taxa fixa anual composta em dias úteis (base 252). Este é o cálculo mais complexo dentre os três tipos de renda fixa.

**Fórmula**:
```
fatorIPCA = Π(1 + IPCA_mensal_i) para cada mês i no intervalo
fatorSpread = (1 + taxaFixaAnual)^(diasUteis / 252)
valorAtual = principal × fatorIPCA × fatorSpread
```

Onde:
- `IPCA_mensal_i` = variação mensal do IPCA (ex: 0.0044 para 0,44%)
- `taxaFixaAnual` = `rate` do investimento (ex: 0.06 para IPCA + 6% a.a.)
- `diasUteis` = dias úteis entre startDate e data de cálculo

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO um investimento IPCA+ com `principal: 10000`, `rate: 0.06` (6% a.a.), `startDate: 2025-01-02`
      QUANDO o cálculo é executado para a data atual
      ENTÃO o valor atual deve ser `principal × fatorIPCA × fatorSpread`, com precisão de 2 casas decimais

- [ ] DADO um investimento IPCA+ em período com IPCA mensal de 0,44%, 0,50% e 0,38% (3 meses completos)
      QUANDO o cálculo é executado
      ENTÃO o fator IPCA acumulado deve ser `(1.0044) × (1.005) × (1.0038) = 1.01326` (aproximadamente)

- [ ] DADO um investimento IPCA+ com mês parcial (ex: startDate no dia 15 do mês)
      QUANDO o cálculo é executado
      ENTÃO o primeiro mês deve usar pro-rata: `(1 + IPCA_mensal)^(diasRestantes / diasTotaisMes)`

- [ ] DADO um investimento IPCA+ cuja `maturityDate` já passou
      QUANDO o cálculo é executado
      ENTÃO o sistema deve calcular o valor apenas até a `maturityDate` e indicar status `VENCIDO`

- [ ] DADO que os dados de IPCA ainda não foram publicados para o mês corrente
      QUANDO o cálculo é executado
      ENTÃO o sistema deve usar o último IPCA disponível, indicar `dataUltimaAtualizacao` na resposta, e não projetar valores futuros

**Dependências**:
- Bloqueada por: EP07-S01 (CRUD Renda Fixa), EP07-S02 (Índices Econômicos)
- Bloqueia: EP07-S06 (Frontend)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura ≥ 90% (cálculos validados contra valores de referência)
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação atualizada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

#### Método no Calculator — `fixed-income-calculator.js`

```javascript
async calculateIPCA({ principal, rate, startDate, maturityDate }) {
  const endDate = min(maturityDate, today())
  const businessDays = countBusinessDays(startDate, endDate)

  // Fator IPCA acumulado
  const ipcaAccumulated = await this.economicIndexManager.getAccumulatedIndex('IPCA', startDate, endDate)

  // Fator spread (taxa fixa composta em dias úteis)
  const spreadFactor = Math.pow(1 + rate, businessDays / 252)

  const currentValue = round(principal * ipcaAccumulated * spreadFactor, 2)
  const yieldPercentage = round((ipcaAccumulated * spreadFactor - 1) * 100, 4)

  return {
    currentValue,
    yieldPercentage,
    yieldAbsolute: round(currentValue - principal, 2),
    ipcaComponent: round((ipcaAccumulated - 1) * 100, 4),   // % apenas da inflação
    spreadComponent: round((spreadFactor - 1) * 100, 4),      // % apenas do spread
    lastUpdateDate: endDate,
    status: maturityDate <= today() ? 'VENCIDO' : 'ATIVO',
    businessDays,
  }
}
```

#### Considerações de Cálculo

- **Pro-rata de IPCA**: para meses incompletos, usar potenciação fracionária `(1 + IPCA)^(d/D)` onde `d` = dias no mês e `D` = total dias no mês
- **Dias úteis brasileiros**: considerar feriados nacionais (não estaduais/municipais). Utilizar biblioteca `@brazilian-utils/brazilian-utils` ou tabela interna de feriados
- **IPCA com atraso**: o IPCA é publicado com ~15 dias de atraso. O sistema nunca deve projetar/estimar IPCA futuro

**Cenários de Teste**:
- Cenário 1: IPCA+ 6% a.a. por 12 meses completos → fator IPCA × fator spread corretos
- Cenário 2: IPCA+ com mês parcial no início → pro-rata correto
- Cenário 3: IPCA+ com mês parcial no final → pro-rata correto
- Cenário 4: IPCA+ vencido → cálculo até maturityDate, status VENCIDO
- Cenário 5: IPCA indisponível para mês corrente → cálculo até último dado disponível
- Cenário 6: Retorno separado dos componentes (inflação vs. spread)

---

## EP07-S05 — Cálculo de Investimento Prefixado

### [EP07-S05] Cálculo de Rentabilidade Prefixado

**Como** investidor
**Eu quero** que o sistema calcule automaticamente o valor atualizado dos meus investimentos prefixados
**Para que** eu acompanhe a evolução do meu investimento com taxa fixa garantida

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 3 story points

**Contexto**:
Investimentos prefixados (como Tesouro Prefixado, CDBs prefixados) possuem taxa anual fixa definida no momento da aplicação. O cálculo é o mais simples dos três tipos: utiliza juros compostos com base em 252 dias úteis por ano. A taxa é fixa e não depende de nenhum índice econômico externo.

**Fórmula**:
```
valorAtual = principal × (1 + taxaAnual)^(diasUteis / 252)
```

Onde:
- `taxaAnual` = `rate` do investimento (ex: 0.1275 para 12,75% a.a.)
- `diasUteis` = dias úteis entre startDate e data de cálculo (ou maturityDate, o que for menor)

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO um investimento prefixado com `principal: 10000`, `rate: 0.1275` (12,75% a.a.), `startDate: 2025-01-02`
      QUANDO o cálculo é executado após 252 dias úteis
      ENTÃO o valor atual deve ser `10000 × (1.1275)^1 = R$ 11.275,00`

- [ ] DADO um investimento prefixado com `principal: 5000`, `rate: 0.10` (10% a.a.)
      QUANDO o cálculo é executado após 126 dias úteis (meio ano)
      ENTÃO o valor atual deve ser `5000 × (1.10)^(126/252) = 5000 × (1.10)^0.5 ≈ R$ 5.244,04`

- [ ] DADO um investimento prefixado cuja `maturityDate` já passou
      QUANDO o cálculo é executado
      ENTÃO o sistema deve calcular o valor apenas até a `maturityDate` e indicar status `VENCIDO`

- [ ] DADO um investimento prefixado com `startDate` igual à data atual
      QUANDO o cálculo é executado
      ENTÃO o valor atual deve ser igual ao `principal` (0 dias úteis decorridos)

- [ ] DADO um investimento prefixado com `rate: 0` (taxa zero — caso de borda)
      QUANDO o cálculo é executado
      ENTÃO o valor atual deve ser igual ao `principal` independente do período

**Dependências**:
- Bloqueada por: EP07-S01 (CRUD Renda Fixa)
- Bloqueia: EP07-S06 (Frontend)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura ≥ 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação atualizada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

#### Método no Calculator — `fixed-income-calculator.js`

```javascript
async calculatePrefixado({ principal, rate, startDate, maturityDate }) {
  const endDate = min(maturityDate, today())
  const businessDays = countBusinessDays(startDate, endDate)

  const factor = Math.pow(1 + rate, businessDays / 252)
  const currentValue = round(principal * factor, 2)
  const yieldPercentage = round((factor - 1) * 100, 4)

  return {
    currentValue,
    yieldPercentage,
    yieldAbsolute: round(currentValue - principal, 2),
    annualRate: round(rate * 100, 2),
    lastUpdateDate: endDate,
    status: maturityDate <= today() ? 'VENCIDO' : 'ATIVO',
    businessDays,
  }
}
```

#### Utilitário de Dias Úteis

```javascript
// src/utils/business-days.js
function countBusinessDays(startDate, endDate) {
  // Conta dias úteis entre duas datas
  // Exclui sábados, domingos e feriados nacionais brasileiros
  // Utiliza calendário de feriados nacionais (fixos + variáveis como Carnaval, Páscoa, Corpus Christi)
}
```

**Cenários de Teste**:
- Cenário 1: Prefixado 12,75% a.a. por 252 d.u. → R$ 11.275,00
- Cenário 2: Prefixado 10% a.a. por 126 d.u. → ~R$ 5.244,04
- Cenário 3: Prefixado vencido → cálculo até maturityDate, status VENCIDO
- Cenário 4: Prefixado com startDate = hoje → valor = principal
- Cenário 5: Prefixado com taxa 0% → valor = principal sempre
- Cenário 6: Prefixado por 1 dia útil → incremento mínimo correto

---

## EP07-S06 — Interface de Renda Fixa (Frontend)

### [EP07-S06] Telas de Gestão de Renda Fixa

**Como** investidor
**Eu quero** visualizar, cadastrar e gerenciar meus investimentos de renda fixa pela interface web
**Para que** eu tenha uma experiência visual clara do meu portfólio de renda fixa e seus rendimentos

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 13 story points

**Contexto**:
O frontend deve oferecer uma página de listagem de investimentos de renda fixa com valor atualizado, rendimento percentual e absoluto, indicador de vencimento e status. Deve também disponibilizar um formulário de cadastro/edição com seleção do tipo de investimento (CDI, IPCA+, Prefixado), que adapta dinamicamente os campos exibidos conforme o tipo selecionado. A interface segue o layout base definido no Épico 16 e a responsividade do Épico 28.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o investidor acessa a página de Renda Fixa
      QUANDO a carteira ativa possui investimentos cadastrados
      ENTÃO o sistema deve exibir uma tabela/lista com: nome, tipo (CDI/IPCA+/Prefixado), instituição, valor aplicado, valor atual, rendimento (% e R$), data de vencimento, e um badge de status (ATIVO/VENCIDO)

- [ ] DADO que o investidor clica no botão "Novo Investimento"
      QUANDO o formulário é exibido
      ENTÃO o sistema deve apresentar campos: nome, tipo (select: CDI/IPCA+/Prefixado), valor aplicado, data de início, data de vencimento, instituição. Ao selecionar o tipo:
      - **CDI**: exibe campo "% do CDI" (ex: 110)
      - **IPCA+**: exibe campo "Taxa fixa anual" (ex: 6,00%)
      - **Prefixado**: exibe campo "Taxa fixa anual" (ex: 12,75%)

- [ ] DADO que o investidor preenche o formulário com dados válidos e submete
      QUANDO a requisição POST é enviada com sucesso
      ENTÃO o sistema deve exibir notificação de sucesso (toast), fechar o formulário, e atualizar a lista com o novo investimento

- [ ] DADO que o investidor preenche o formulário com dados inválidos (ex: valor negativo)
      QUANDO ele tenta submeter
      ENTÃO o sistema deve exibir mensagens de erro inline nos campos inválidos, sem enviar a requisição

- [ ] DADO que um investimento está a 30 dias ou menos do vencimento
      QUANDO a lista é exibida
      ENTÃO o sistema deve destacar visualmente o investimento com um indicador de "próximo ao vencimento" (cor amarela/warning)

- [ ] DADO que um investimento já venceu
      QUANDO a lista é exibida
      ENTÃO o sistema deve exibir badge "VENCIDO" em vermelho e o valor final calculado até a data de vencimento

- [ ] DADO que o investidor acessa a página de Renda Fixa em um dispositivo mobile (viewport ≤ 768px)
      QUANDO a lista é renderizada
      ENTÃO o layout deve adaptar-se para formato card (em vez de tabela), mantendo as informações essenciais visíveis (nome, valor atual, rendimento, status)

**Dependências**:
- Bloqueada por: EP07-S01 (CRUD), EP07-S03 (CDI), EP07-S04 (IPCA+), EP07-S05 (Prefixado), EP16 (Layout Base), EP28 (Responsividade)
- Bloqueia: Nenhuma

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários de componentes com cobertura ≥ 90%
- [ ] Testes E2E da jornada completa (listar → criar → editar → excluir)
- [ ] QA aprovado por @qa-analyst (desktop + mobile)
- [ ] Documentação atualizada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

#### Estrutura de Arquivos (Frontend)

```
src/pages/fixed-income/
├── FixedIncomePage.jsx               # Página principal (lista + resumo)
├── FixedIncomeList.jsx               # Componente de tabela/cards
├── FixedIncomeForm.jsx               # Formulário de criação/edição
├── FixedIncomeCard.jsx               # Card individual (mobile)
├── FixedIncomeSummary.jsx            # Resumo: total aplicado, total atual, rendimento médio
└── fixed-income.service.js           # Chamadas à API (axios/fetch)

src/components/
├── MaturityBadge.jsx                 # Badge ATIVO/VENCIDO/PRÓXIMO
├── CurrencyDisplay.jsx               # Formatação BRL (R$ X.XXX,XX)
└── PercentageDisplay.jsx             # Formatação percentual (+X,XX%)
```

#### Dados Exibidos na Listagem

| Coluna | Tipo | Formato |
|--------|------|---------|
| Nome | string | Texto livre |
| Tipo | badge | CDI / IPCA+ / Prefixado (cores distintas) |
| Instituição | string | Texto livre |
| Valor Aplicado | currency | R$ 10.000,00 |
| Valor Atual | currency | R$ 11.275,00 |
| Rendimento (%) | percentage | +12,75% (verde) ou -2,30% (vermelho) |
| Rendimento (R$) | currency | +R$ 1.275,00 |
| Vencimento | date + badge | 15/01/2027 + badge status |

#### Formulário — Campos Dinâmicos por Tipo

| Campo | CDI | IPCA+ | Prefixado |
|-------|-----|-------|-----------|
| Nome | Sim | Sim | Sim |
| Valor aplicado | Sim | Sim | Sim |
| Data de início | Sim | Sim | Sim |
| Data de vencimento | Sim | Sim | Sim |
| Instituição | Sim | Sim | Sim |
| % do CDI | **Sim** (ex: 110) | Não | Não |
| Taxa fixa anual | Não | **Sim** (ex: 6%) | **Sim** (ex: 12,75%) |

#### Validações Frontend

| Regra | Mensagem |
|-------|----------|
| Nome obrigatório | "Nome é obrigatório" |
| Valor > 0 | "Valor deve ser maior que zero" |
| Data início ≤ Data vencimento | "Data de início deve ser anterior ao vencimento" |
| % CDI > 0 (quando tipo = CDI) | "Percentual do CDI deve ser maior que zero" |
| Taxa > 0 (quando tipo = IPCA/PREFIXADO) | "Taxa fixa anual deve ser maior que zero" |
| Instituição obrigatória | "Instituição é obrigatória" |

**Cenários de Teste**:
- Cenário 1: Listagem com 5 investimentos (2 CDI, 2 IPCA, 1 Prefixado) → todos exibidos corretamente
- Cenário 2: Formulário CDI → campo "% do CDI" visível, campo "Taxa fixa" oculto
- Cenário 3: Formulário IPCA → campo "Taxa fixa anual" visível, campo "% CDI" oculto
- Cenário 4: Formulário Prefixado → campo "Taxa fixa anual" visível, campo "% CDI" oculto
- Cenário 5: Criação com dados válidos → toast sucesso, lista atualizada
- Cenário 6: Criação com dados inválidos → erros inline, sem submit
- Cenário 7: Investimento próximo ao vencimento (≤30 dias) → destaque visual amarelo
- Cenário 8: Investimento vencido → badge vermelho "VENCIDO"
- Cenário 9: Layout mobile (≤768px) → cards em vez de tabela
- Cenário 10: Edição de investimento existente → formulário pré-preenchido
- Cenário 11: Exclusão com confirmação → modal de confirmação → lista atualizada

---

## Resumo da API — Rotas do Épico 7

### Rotas Públicas (autenticadas via JWT)

| Método | Rota | Descrição | Request Body | Response |
|--------|------|-----------|--------------|----------|
| GET | `/v1/public/fixed-income?walletId={id}` | Listar investimentos da carteira | — | `200: [FixedIncome]` com campos calculados |
| POST | `/v1/public/fixed-income` | Criar investimento | `FixedIncomeInput` | `201: FixedIncome` |
| PUT | `/v1/public/fixed-income/:id` | Atualizar investimento | `FixedIncomeUpdate` | `200: FixedIncome` |
| DELETE | `/v1/public/fixed-income/:id` | Soft delete investimento | — | `200: { message }` |

### Rotas Privadas (inter-serviço)

| Método | Rota | Descrição | Response |
|--------|------|-----------|----------|
| GET | `/v1/private/economic-index?type={CDI\|IPCA\|SELIC}&start={date}&end={date}` | Buscar índices por período | `200: [EconomicIndex]` |

### Response Schema — FixedIncome (com cálculos)

```json
{
  "_id": "uuid",
  "walletId": "uuid",
  "userId": "uuid",
  "name": "CDB Banco XYZ",
  "type": "CDI",
  "principal": 10000,
  "rate": 0,
  "indexerPercentage": 110,
  "startDate": "2025-01-15",
  "maturityDate": "2027-01-15",
  "institution": "Banco XYZ",
  "isDeleted": false,
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T10:00:00Z",
  "calculated": {
    "currentValue": 11183.71,
    "yieldPercentage": 11.84,
    "yieldAbsolute": 1183.71,
    "lastUpdateDate": "2026-03-26",
    "status": "ATIVO",
    "businessDays": 294
  }
}
```

---

## Arquitetura Completa — Estrutura de Arquivos

```
src/
├── app/
│   ├── app-constants.js               # + FIXED_INCOME_* e ECONOMIC_INDEX_* errors
│   ├── app-manager.js                 # + FixedIncomeManager, EconomicIndexManager
│   ├── app-service.js                 # + FixedIncomeRouter, EconomicIndexRouter
│   │
│   ├── fixed-income/
│   │   ├── fixed-income-router.js     # Rotas HTTP públicas
│   │   ├── fixed-income-manager.js    # Lógica de negócio + orquestra cálculos
│   │   ├── fixed-income-dao.js        # Acesso MongoDB
│   │   ├── fixed-income-model.js      # Schema Mongoose
│   │   └── fixed-income-calculator.js # Motor de cálculos (CDI, IPCA, Prefixado)
│   │
│   └── economic-index/
│       ├── economic-index-router.js   # Rota privada (inter-serviço)
│       ├── economic-index-manager.js  # Lógica de busca, cache, acumulação
│       ├── economic-index-dao.js      # Acesso MongoDB
│       ├── economic-index-model.js    # Schema Mongoose
│       └── economic-index-job.js      # Job diário (cron)
│
├── dispatchers/
│   └── bacen-dispatcher.js            # API BACEN + BRAPI fallback
│
├── utils/
│   └── business-days.js               # Contagem de dias úteis (feriados BR)
│
├── __tests__/
│   ├── fixed-income.test.js           # Testes CRUD + validação
│   ├── fixed-income-calculator.test.js # Testes de cálculo (CDI, IPCA, Prefixado)
│   ├── economic-index.test.js         # Testes do serviço de índices
│   └── business-days.test.js          # Testes do utilitário de dias úteis
│
└── frontend/
    └── src/pages/fixed-income/
        ├── FixedIncomePage.jsx
        ├── FixedIncomeList.jsx
        ├── FixedIncomeForm.jsx
        ├── FixedIncomeCard.jsx
        ├── FixedIncomeSummary.jsx
        └── fixed-income.service.js
```

---

## Análise de Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| API BACEN fora do ar por longos períodos | Média | Alto | Fallback BRAPI + dados de CDI/IPCA armazenados localmente (tolerância de 3 dias sem atualização) |
| Dados de IPCA publicados com atraso pelo IBGE | Alta | Médio | Nunca projetar IPCA. Calcular apenas com dados oficiais publicados. Indicar `dataUltimaAtualizacao` |
| Imprecisão no cálculo por arredondamento | Baixa | Alto | Utilizar aritmética de ponto flutuante com `round()` apenas no resultado final. Testes de referência cruzada com Calculadora do Cidadão (BACEN) |
| Calendário de feriados desatualizado | Média | Médio | Manter tabela de feriados atualizada anualmente. Considerar biblioteca `@brazilian-utils/brazilian-utils` para feriados variáveis |
| Volume de dados de índices cresce indefinidamente | Baixa | Baixo | Índices diários de CDI/SELIC desde 2020 ≈ ~1500 registros/tipo. Crescimento linear gerenciável. Index no MongoDB garante performance |

---

## Ordem de Implementação Sugerida

```
1. EP07-S01 (CRUD Renda Fixa)          — Base de dados e API
   └── pode iniciar imediatamente

2. EP07-S02 (Índices Econômicos)        — Infraestrutura de dados externos
   └── pode iniciar em paralelo com S01

3. EP07-S05 (Cálculo Prefixado)         — Cálculo mais simples (sem dependência de índices)
   └── depende de S01

4. EP07-S03 (Cálculo CDI)              — Depende de índices econômicos
   └── depende de S01 + S02

5. EP07-S04 (Cálculo IPCA+)            — Cálculo mais complexo
   └── depende de S01 + S02

6. EP07-S06 (Frontend)                  — Interface completa
   └── depende de S01 + S03 + S04 + S05
```

**Estimativa total**: 50 story points
**Paralelismo máximo**: S01 + S02 simultâneos → S05 + S03 simultâneos → S04 → S06

---

**Story pronta para**: @architect

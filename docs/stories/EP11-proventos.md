# EP11 — Proventos

> **Épico**: 11 — Proventos
> **Versão**: 1.0
> **Data**: 2026-03-27
> **Status**: Ready for Architect

---

## Visão Geral

Proventos (dividendos, JCP, rendimentos) são pagamentos recebidos pelo investidor em função da posse de ativos. No MoneyTrackr, esses proventos devem ser registrados e visualizados sem alterar automaticamente a posição do investidor (não há reinvestimento automático). O sistema deve permitir importação via API externa e cadastro manual, além de oferecer visualização consolidada por diferentes períodos e métricas de yield on cost.

**Impacto no Negócio**: Proventos são um dos principais motivadores de investidores de longo prazo. A ausência dessa feature impede a avaliação real do retorno total de um investimento (ganho de capital + proventos). É funcionalidade essencial para retenção de usuários avançados.

**Métricas-alvo**:
- Importação automática de proventos com < 1 dia de atraso após pagamento
- Precisão de 100% nos valores importados (comparação com fontes oficiais)
- Tempo de carregamento da tela de proventos < 2s para 5 anos de dados

**Dependências de Épicos**:
- Épico 3 (Carteiras) — proventos são vinculados a carteiras
- Épico 4 (Transações) — posições existentes para cálculo de yield on cost
- Épico 5 (Preço Médio) — preço médio usado no cálculo de yield on cost
- Épico 13 (Fontes de Dados) — APIs para importação de proventos

---

## Stories

---

### EP11-001 Registrar Proventos (Manual e Importação)

**Como** investidor que recebe dividendos e outros proventos
**Eu quero** registrar proventos manualmente ou importá-los automaticamente via API
**Para que** eu tenha um histórico completo dos rendimentos recebidos por cada ativo

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points (L)

**Contexto**:
O usuário pode registrar proventos de duas formas: (1) manualmente, preenchendo formulário com ticker, tipo, valor, data e data de pagamento; (2) automaticamente, via importação de dados de APIs externas (BRAPI/Yahoo Finance, conforme Épico 13). Os proventos são sempre vinculados a uma carteira e a um usuário. Não devem existir registros duplicados (mesma data + ticker + tipo + valor = duplicata).

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário está na tela de proventos e clica em "Adicionar Provento"
      QUANDO preenche ticker=PETR4, tipo=DIVIDEND, valor=R$ 1,50 por ação, data=15/03/2026 e data de pagamento=30/03/2026
      ENTÃO o provento deve ser salvo com status `CONFIRMED` e aparecer na lista de proventos

- [ ] DADO que o usuário possui ativos na carteira e clica em "Importar Proventos"
      QUANDO o sistema consulta a API externa para cada ticker da carteira
      ENTÃO deve importar todos os proventos do período selecionado com status `IMPORTED` e exibir contagem de proventos encontrados

- [ ] DADO que o sistema tenta importar um provento com mesmo ticker, tipo, data e valor de um já existente
      QUANDO a importação é processada
      ENTÃO o provento duplicado deve ser ignorado e o usuário deve ser informado de quantos duplicados foram encontrados

- [ ] DADO que o usuário registra um provento do tipo JCP
      QUANDO o registro é salvo
      ENTÃO o campo `type` deve ser `JCP` e o sistema deve armazenar o valor bruto (antes de IR retido na fonte)

- [ ] DADO que o usuário registra um provento com tipo RENDIMENTO para um FII
      QUANDO o registro é salvo
      ENTÃO o provento deve ser vinculado ao ticker do FII com tipo `RENDIMENTO` e isento de IR (flag `taxExempt: true`)

**Dependências**:
- Bloqueada por: EP03 (Carteiras), EP04 (Transações), EP13 (Fontes de Dados)
- Bloqueia: EP11-002, EP11-003

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura >= 90%
- [ ] Testes de integração passando (CRUD + importação mock)
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação da API atualizada (Swagger)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

**Modelo `Dividend`** (`src/app/dividend/dividend-model.js`):
```javascript
const schema = new mongoose.Schema({
  _id: { type: String, required: true, default: uuidv4 },
  domain: { type: String, required: true },
  walletId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  ticker: { type: String, required: true, index: true },
  type: {
    type: String,
    required: true,
    enum: ['DIVIDEND', 'JCP', 'RENDIMENTO'],
  },
  amountPerShare: { type: Number, required: true },  // valor por ação/cota
  totalAmount: { type: Number, required: true },      // valor total recebido
  quantity: { type: Number, required: true },          // quantidade de ações na data-base
  date: { type: Date, required: true },                // data-com (ex-date)
  paymentDate: { type: Date, required: true },         // data de pagamento efetivo
  taxExempt: { type: Boolean, default: false },        // isento de IR (ex: FII rendimentos)
  withholdingTax: { type: Number, default: 0 },        // IR retido na fonte (JCP = 15%)
  source: {
    type: String,
    enum: ['MANUAL', 'BRAPI', 'YAHOO_FINANCE'],
    default: 'MANUAL',
  },
  status: {
    type: String,
    enum: ['CONFIRMED', 'IMPORTED', 'DELETED'],
    default: 'CONFIRMED',
  },
}, { versionKey: false, timestamps: true })

schema.index({ walletId: 1, ticker: 1, date: 1, type: 1 }, { unique: true })
```

**Rotas**:
```
POST /api/dividends
  Body: { walletId, ticker, type, amountPerShare, quantity, date, paymentDate }
  Response: 201 { dividend: {...} }

POST /api/dividends/import
  Body: { walletId, tickers: ['PETR4', 'VALE3'], startDate, endDate }
  Response: 200 {
    imported: 15,
    duplicatesSkipped: 3,
    errors: [],
    dividends: [...]
  }

GET /api/dividends
  Query: ?walletId=xxx&ticker=PETR4&type=DIVIDEND&startDate=...&endDate=...&page=1&limit=50
  Response: 200 { dividends: [...], totalCount: number, page, limit }

DELETE /api/dividends/:dividendId
  Response: 200 { dividend: { ...updatedDividend, status: 'DELETED' } }
  (Soft delete — alinhado com Épico 25)
```

**Serviço de Importação** (`src/app/dividend/dividend-import-service.js`):
- Consultar BRAPI/Yahoo Finance para cada ticker
- Normalizar formato de dados entre diferentes fontes
- Detecção de duplicatas via índice único composto
- Processamento em batch com resultado sumarizado

**Estrutura de Arquivos**:
```
src/app/dividend/
  dividend-model.js
  dividend-dao.js
  dividend-manager.js
  dividend-router.js
  dividend-import-service.js
```

**Cenários de Teste**:
- Cenário 1: Criar provento manual tipo DIVIDEND → salvo com sucesso, totalAmount = amountPerShare * quantity
- Cenário 2: Criar provento tipo JCP → withholdingTax calculado como 15% do valor bruto
- Cenário 3: Criar provento tipo RENDIMENTO para FII → taxExempt = true automaticamente
- Cenário 4: Importar proventos de 3 tickers → retornar contagem correta de importados
- Cenário 5: Importar com duplicatas → duplicatas ignoradas, contagem informada
- Cenário 6: Deletar provento → soft delete, status = DELETED
- Cenário 7: Tentar criar provento sem walletId → erro 400 validação
- Cenário 8: Importar com API indisponível → fallback + mensagem de erro parcial

---

### EP11-002 Proventos Não Alteram Posição Automaticamente

**Como** investidor que recebe proventos
**Eu quero** que os proventos registrados não alterem automaticamente a quantidade ou o preço médio da minha posição
**Para que** minha posição reflita apenas operações de compra e venda, e eu decida se e quando reinvestir

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 3 story points (S)

**Contexto**:
Em muitos sistemas, o recebimento de proventos altera a posição (reinvestimento automático). No MoneyTrackr, o design deliberado é que proventos sejam apenas registros informativos — não geram transações de compra nem alteram quantidade ou preço médio. Se o usuário quiser reinvestir, deve criar uma nova transação de compra explicitamente. Isso garante transparência e controle total ao investidor.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário possui 100 ações de PETR4 a preço médio de R$ 30,00
      QUANDO um dividendo de R$ 2,00 por ação é registrado (total R$ 200,00)
      ENTÃO a posição de PETR4 deve permanecer com 100 ações e preço médio de R$ 30,00

- [ ] DADO que o sistema importa 10 proventos automaticamente para diversos tickers
      QUANDO a importação é concluída
      ENTÃO nenhuma posição de nenhum ticker deve ter sido alterada em quantidade ou preço médio

- [ ] DADO que um provento de JCP de R$ 500,00 é registrado para ITUB4
      QUANDO o usuário consulta a posição de ITUB4
      ENTÃO a posição deve estar idêntica ao estado anterior ao registro do provento

- [ ] DADO que o usuário deseja reinvestir o dividendo recebido
      QUANDO ele vai à tela de transações
      ENTÃO deve conseguir criar uma transação de compra manualmente (fluxo separado do provento)

**Dependências**:
- Bloqueada por: EP11-001, EP05 (Preço Médio)
- Bloqueia: Nenhuma

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura >= 90%
- [ ] Testes de integração provando isolamento posição x provento
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação atualizada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

**Regra Central**: O `dividend-manager.js` **jamais** deve chamar métodos de `position-manager.js` ou `transaction-manager.js` para alterar posições. A separação é arquitetural:

```
dividend-manager.js
  ├── dividend-dao.js       (leitura/escrita de proventos)
  └── NÃO importa position-dao ou transaction-dao

position-manager.js
  ├── transaction-dao.js    (apenas transações alteram posições)
  └── NÃO importa dividend-dao
```

**Validação por Design**:
- Nenhum endpoint de dividendos deve chamar `updatePosition()` ou `recalculateAvgPrice()`
- Teste de integração deve verificar snapshot da posição antes e depois da operação de dividendo
- Usar teste de regressão automatizado que garanta que futuros PRs não introduzam acoplamento

**Cenários de Teste**:
- Cenário 1: Registrar dividendo → posição inalterada (comparar snapshots)
- Cenário 2: Importar 20 proventos em batch → todas as posições inalteradas
- Cenário 3: Registrar JCP → posição inalterada, provento salvo corretamente
- Cenário 4: Deletar provento → posição inalterada
- Cenário 5: Registrar provento + em seguida criar compra manualmente → posição alterada apenas pela compra
- Cenário 6: Teste de regressão: verificar que dividend-manager não importa position-dao

---

### EP11-003 Visualização de Proventos por Período com Métricas

**Como** investidor que recebe proventos regularmente
**Eu quero** visualizar meus proventos filtrados por período (mensal, semestral, anual, total) com métricas consolidadas
**Para que** eu possa acompanhar a evolução dos meus rendimentos passivos e calcular o yield on cost da minha carteira

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points (L)

**Contexto**:
O investidor precisa entender quanto está recebendo em proventos ao longo do tempo. A tela deve exibir: (1) tabela de proventos com filtros por período, ticker e tipo; (2) cards de resumo com total recebido, yield on cost mensal e anual, e projeção de 12 meses; (3) gráfico de evolução mensal dos proventos. O endpoint de summary deve ser otimizado com agregação MongoDB para performance.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário seleciona o filtro "Mensal" e o mês de "Março/2026"
      QUANDO a tela carrega
      ENTÃO deve exibir apenas proventos recebidos (paymentDate) em Março/2026, com total do mês no card de resumo

- [ ] DADO que o usuário seleciona o filtro "Anual" e o ano "2025"
      QUANDO a tela carrega
      ENTÃO deve exibir todos os proventos com paymentDate em 2025, agrupados por mês, com total anual no card de resumo

- [ ] DADO que o usuário seleciona o filtro "Total"
      QUANDO a tela carrega
      ENTÃO deve exibir todos os proventos da carteira ativa e o card de resumo deve mostrar: total recebido em toda a história, yield on cost médio e projeção anual

- [ ] DADO que o usuário possui R$ 100.000,00 investidos (custo total) e recebeu R$ 8.000,00 em proventos nos últimos 12 meses
      QUANDO visualiza o card "Yield on Cost"
      ENTÃO o valor exibido deve ser 8,00% (R$ 8.000 / R$ 100.000 * 100)

- [ ] DADO que o usuário filtra por ticker=ITUB4 e período=Semestral (Jan-Jun/2026)
      QUANDO a tela carrega
      ENTÃO deve exibir apenas proventos de ITUB4 pagos entre Jan e Jun/2026, com subtotal para esse filtro

**Dependências**:
- Bloqueada por: EP11-001, EP05 (Preço Médio para yield on cost)
- Bloqueia: Nenhuma

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura >= 90%
- [ ] Testes de integração passando (agregações)
- [ ] Performance validada: < 2s para 5 anos de dados
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação da API atualizada (Swagger)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

**Rota de Summary**:
```
GET /api/dividends/summary
  Query: ?walletId=xxx&period=MONTHLY|SEMI_ANNUAL|ANNUAL|TOTAL&year=2026&month=3&ticker=PETR4
  Response: {
    period: 'MONTHLY',
    periodLabel: 'Março/2026',
    totalReceived: 1500.00,
    totalReceivedGross: 1700.00,
    totalWithholdingTax: 200.00,
    yieldOnCost: 8.00,                // percentual
    totalInvested: 100000.00,          // custo total das posições
    projection12Months: 18000.00,      // projeção baseada nos últimos 12m
    byTicker: [
      { ticker: 'PETR4', total: 800.00, count: 4 },
      { ticker: 'ITUB4', total: 700.00, count: 3 },
    ],
    byType: [
      { type: 'DIVIDEND', total: 1000.00, count: 5 },
      { type: 'JCP', total: 300.00, count: 1 },
      { type: 'RENDIMENTO', total: 200.00, count: 1 },
    ],
    byMonth: [
      { month: '2026-01', total: 500.00 },
      { month: '2026-02', total: 450.00 },
      { month: '2026-03', total: 550.00 },
    ],
  }
```

**Agregação MongoDB** (`dividend-dao.js`):
```javascript
async getSummary({ walletId, startDate, endDate }) {
  return this.objectModel.aggregate([
    { $match: {
      walletId,
      status: { $ne: 'DELETED' },
      paymentDate: { $gte: startDate, $lte: endDate },
    }},
    { $group: {
      _id: null,
      totalReceived: { $sum: '$totalAmount' },
      totalWithholdingTax: { $sum: '$withholdingTax' },
      count: { $sum: 1 },
    }},
  ])
}

async getSummaryByTicker({ walletId, startDate, endDate }) {
  return this.objectModel.aggregate([
    { $match: { walletId, status: { $ne: 'DELETED' }, paymentDate: { $gte: startDate, $lte: endDate } } },
    { $group: { _id: '$ticker', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ])
}

async getSummaryByMonth({ walletId, startDate, endDate }) {
  return this.objectModel.aggregate([
    { $match: { walletId, status: { $ne: 'DELETED' }, paymentDate: { $gte: startDate, $lte: endDate } } },
    { $group: {
      _id: { $dateToString: { format: '%Y-%m', date: '$paymentDate' } },
      total: { $sum: '$totalAmount' },
    }},
    { $sort: { _id: 1 } },
  ])
}
```

**Cálculo de Yield on Cost**:
```
yieldOnCost = (totalProventosRecebidos12Meses / custoTotalPosicoes) * 100
```
- `custoTotalPosicoes` = soma de (quantidade * preço médio) para todos os ativos da carteira
- Usar dados do position-manager para obter custo total (leitura apenas, sem alteração)

**Cache Redis**:
- Cachear resultado do summary por 1 hora (invalidar ao registrar novo provento)
- Key pattern: `dividends:summary:{walletId}:{period}:{year}:{month}`

**Frontend** (`src/pages/dividends/`):
- Componente `DividendTable` — tabela paginada com colunas: Ticker, Tipo, Valor/Ação, Total, Data-Com, Data Pagamento
- Componente `DividendSummaryCards` — 4 cards: Total Recebido, Yield on Cost (%), Projeção 12M, IR Retido
- Componente `DividendChart` — gráfico de barras com evolução mensal dos proventos
- Componente `DividendFilters` — filtros: Período (mensal/semestral/anual/total), Ticker, Tipo
- Skeleton loading para todos os componentes durante carregamento

**Cenários de Teste**:
- Cenário 1: Filtro mensal Março/2026 com 5 proventos → exibir 5 registros, total correto
- Cenário 2: Filtro anual 2025 com 50 proventos → agrupamento por mês, total anual correto
- Cenário 3: Filtro total → todos os proventos da carteira, yield on cost calculado
- Cenário 4: Yield on cost = R$ 8000 / R$ 100.000 → exibir 8,00%
- Cenário 5: Filtro por ticker ITUB4 + semestral → apenas proventos de ITUB4 no período
- Cenário 6: Carteira sem proventos → exibir mensagem "Nenhum provento registrado" e cards zerados
- Cenário 7: Performance: 1000 proventos em 5 anos → resposta < 2s
- Cenário 8: Cache: segunda requisição idêntica → resposta do Redis (< 100ms)
- Cenário 9: Registro de novo provento → cache invalidado, próxima consulta atualizada

---

## Mapa de Dependências

```
EP03 (Carteiras) ────┐
EP04 (Transações) ───┤
EP05 (Preço Médio) ──┤
EP13 (APIs) ─────────┤
                     ▼
              EP11-001 (Registrar)
                 │          │
                 ▼          ▼
          EP11-002       EP11-003
     (Não Reinvestir)  (Visualização)
```

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| API não retorna todos os proventos históricos | Alta | Médio | Permitir cadastro manual como complemento |
| Duplicatas de proventos na importação | Média | Médio | Índice único composto + deduplicação na importação |
| Valores de JCP com IR retido inconsistentes entre fontes | Média | Alto | Usar sempre valor bruto + calcular IR (15%) no sistema |
| Performance de agregação com grande volume | Baixa | Médio | Índices compostos + cache Redis por período |
| Proventos de ativos internacionais em moeda estrangeira | Média | Médio | Armazenar em moeda original + converter via câmbio do dia (Épico 6) |
| Futuro PR acidentalmente acoplando proventos a posições | Baixa | Crítico | Teste de regressão automatizado + code review checklist |

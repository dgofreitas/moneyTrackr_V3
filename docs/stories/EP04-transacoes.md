# EP04 — Transacoes

> **Epico**: 04 — Transacoes
> **Versao**: 1.0
> **Data**: 2026-03-27
> **Status**: Pronta para Desenvolvimento
> **Epicos Relacionados**: EP02 (Autenticacao), EP03 (Carteiras), EP05 (Preco Medio), EP21 (Transacoes UI), EP22 (Formularios), EP25 (Auditoria)

---

## Visao Geral

Este epico cobre todo o ciclo de vida de transacoes de investimento no MoneyTrackr: registro de compras e vendas, validacao de posicoes, calculo de preco medio, edicao/exclusao com trilha de auditoria, e a interface de usuario para gerenciamento de transacoes. E o epico central do sistema — sem transacoes, nao ha portfolio.

### Personas

| Persona | Descricao |
|---------|-----------|
| **Investidor** | Usuario autenticado que gerencia seu portfolio de investimentos |
| **Sistema** | Backend que valida, persiste e recalcula posicoes automaticamente |

### Metricas de Sucesso

- 100% das transacoes com posicao recalculada em < 200ms
- Zero vendas permitidas acima da quantidade disponivel
- Trilha de auditoria completa para todas as operacoes de edicao/exclusao
- Cobertura de testes >= 90%

---

## Grafo de Dependencias

```
EP02 (Auth) ──┐
              ├──> EP04 (Transacoes) ──> EP05 (Preco Medio)
EP03 (Carteiras)┘        │
                          ├──> EP06 (Cambio) [conversao de moedas]
                          ├──> EP21 (Transacoes UI) [tabela/filtros]
                          ├──> EP22 (Formularios) [entrada de dados]
                          └──> EP25 (Auditoria) [soft delete/historico]
```

---

## Stories

---

### EP04-001 — Registrar Transacao de Compra

**Como** investidor autenticado
**Eu quero** registrar uma transacao de compra de ativo
**Para que** o sistema atualize minha posicao e calcule o preco medio corretamente

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points (M)

**Contexto**:
O registro de compra e a operacao mais fundamental do sistema. Ao registrar uma compra, o sistema deve criar o registro da transacao, atualizar (ou criar) a posicao do ativo na carteira, e recalcular o preco medio ponderado incluindo taxas. A formula do preco medio e: `(totalInvestidoAnterior + (quantidade * preco) + taxas) / (quantidadeAnterior + quantidade)`. Todas as operacoes devem ser atomicas — se o calculo da posicao falhar, a transacao nao deve ser persistida.

**Criterios de Aceite (Verificaveis)**:

- [ ] DADO um investidor autenticado com uma carteira ativa
      QUANDO ele submete uma transacao de compra com ticker "PETR4", quantidade 100, preco 28.50, taxas 10.00 e data "2026-03-15"
      ENTAO o sistema deve criar a transacao com type "BUY" e status 201
      E a posicao de "PETR4" deve ter quantidade = 100, precoMedio = 28.60 ((100*28.50+10)/100), totalInvestido = 2860.00

- [ ] DADO um investidor que ja possui 100 unidades de "PETR4" com preco medio 28.60
      QUANDO ele registra nova compra de 50 unidades a 30.00 com taxas 5.00
      ENTAO a posicao deve ter quantidade = 150, totalInvestido = 4365.00 (2860+1505), precoMedio = 29.10 (4365/150)

- [ ] DADO um investidor autenticado
      QUANDO ele submete uma compra com campos obrigatorios ausentes (ex: sem ticker ou quantidade)
      ENTAO o sistema deve retornar status 400 com mensagem indicando os campos faltantes

- [ ] DADO um investidor autenticado
      QUANDO ele submete uma compra com valores invalidos (quantidade negativa, preco zero, taxas negativas)
      ENTAO o sistema deve retornar status 400 com mensagem de validacao especifica

- [ ] DADO um investidor autenticado
      QUANDO ele registra uma compra de um ativo que ainda nao existe na carteira
      ENTAO o sistema deve criar automaticamente a posicao para este ativo

**Dependencias**:
- Bloqueada por: EP02 (autenticacao JWT), EP03 (carteiras existem)
- Bloqueia: EP04-002, EP04-003, EP04-004, EP04-005, EP05 (preco medio)

**Definicao de Pronto (DoD)**:
- [ ] Codigo revisado por @code-reviewer
- [ ] Testes unitarios com cobertura >= 90%
- [ ] Testes de integracao passando (API + MongoDB)
- [ ] QA aprovado por @qa-analyst
- [ ] Documentacao da API atualizada (Swagger)
- [ ] PR criado por @merge-request

**Notas Tecnicas**:

```
Arquivos a criar/modificar (Backend):
  src/app/transaction/
    transaction-model.js     — Schema Mongoose da transacao
    transaction-dao.js       — CRUD de transacoes no MongoDB
    transaction-manager.js   — Logica de negocio, validacao, orquestracao
    transaction-router.js    — Rotas Express, validacao de request
  src/app/position/
    position-model.js        — Schema Mongoose da posicao
    position-dao.js          — CRUD de posicoes no MongoDB
    position-manager.js      — Recalculo de posicao e preco medio
  src/app/app-constants.js   — Novas constantes de erro
  src/__tests__/
    transaction.test.js      — Testes de integracao

Rota: POST /api/v1/transactions
Headers: Authorization: Bearer <JWT>
Body: {
  walletId: String (required),
  ticker: String (required, uppercase, trimmed),
  type: "BUY" (required),
  quantity: Number (required, > 0),
  price: Number (required, > 0),
  fees: Number (default: 0, >= 0),
  date: Date (required, <= hoje),
  currency: String (default: "BRL"),
  notes: String (optional, max 500 chars)
}
Response 201: { transaction, position }

Regras de negocio:
  - Ticker deve ser normalizado para uppercase e trimmed
  - Data nao pode ser futura
  - Operacao atomica: usar session/transaction do MongoDB
  - Preco medio: (totalInvestido + novoInvestimento + taxas) / novaQuantidade
  - Logar operacao com json-log-middleware
```

**Cenarios de Teste**:
- Cenario 1: Compra de ativo novo — cria posicao do zero
- Cenario 2: Compra de ativo existente — acumula posicao e recalcula preco medio
- Cenario 3: Compra com taxas zero — preco medio sem taxas
- Cenario 4: Compra com taxas altas — valida impacto no preco medio
- Cenario 5: Body incompleto — retorna 400 com campos faltantes
- Cenario 6: Valores invalidos (negativos, zero) — retorna 400
- Cenario 7: Data futura — retorna 400
- Cenario 8: Wallet inexistente — retorna 404
- Cenario 9: Usuario tenta registrar em wallet de outro usuario — retorna 403
- Cenario 10: Duas compras concorrentes do mesmo ativo — consistencia garantida

---

### EP04-002 — Registrar Transacao de Venda Valida

**Como** investidor autenticado
**Eu quero** registrar uma venda de ativos que possuo
**Para que** o sistema diminua minha posicao e registre o lucro ou prejuizo da operacao

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points (M)

**Contexto**:
A venda valida ocorre quando o investidor vende uma quantidade menor ou igual a que possui. O sistema deve diminuir a posicao, manter o preco medio inalterado (venda parcial nao altera preco medio), e calcular o lucro/prejuizo da operacao: `P/L = (precoVenda * quantidade) - (precoMedio * quantidade) - taxas`. Este P/L deve ser registrado na transacao para consulta futura. O frontend deve exibir um dialog de confirmacao antes de executar a venda.

**Criterios de Aceite (Verificaveis)**:

- [ ] DADO um investidor com posicao de 100 unidades de "VALE3" a preco medio 68.00
      QUANDO ele registra venda de 30 unidades a 75.00 com taxas 8.00
      ENTAO a transacao deve ser criada com type "SELL"
      E a posicao deve ter quantidade = 70
      E o preco medio deve permanecer 68.00
      E o realizedPnL da transacao deve ser = (75*30) - (68*30) - 8 = 202.00

- [ ] DADO um investidor com posicao de 50 unidades de "ITUB4" a preco medio 30.00
      QUANDO ele registra venda de 50 unidades a 25.00 com taxas 5.00
      ENTAO o realizedPnL deve ser = (25*50) - (30*50) - 5 = -255.00 (prejuizo)
      E a posicao deve ser zerada (ver EP04-004)

- [ ] DADO um investidor autenticado
      QUANDO ele registra uma venda
      ENTAO o frontend deve exibir dialog de confirmacao com resumo: ticker, quantidade, preco, taxas e P/L estimado
      E a operacao so deve ser executada apos confirmacao

- [ ] DADO um investidor com posicao em "PETR4"
      QUANDO ele registra venda com data anterior a uma compra ja registrada
      ENTAO o sistema deve recalcular a posicao considerando a ordem cronologica de todas as transacoes

**Dependencias**:
- Bloqueada por: EP04-001 (compra deve existir primeiro)
- Bloqueia: EP04-004 (zerar posicao e caso especial de venda)

**Definicao de Pronto (DoD)**:
- [ ] Codigo revisado por @code-reviewer
- [ ] Testes unitarios com cobertura >= 90%
- [ ] Testes de integracao passando (API + MongoDB)
- [ ] QA aprovado por @qa-analyst
- [ ] Documentacao da API atualizada (Swagger)
- [ ] PR criado por @merge-request

**Notas Tecnicas**:

```
Rota: POST /api/v1/transactions
Body: { ...mesmos campos, type: "SELL" }
Response 201: { transaction (com realizedPnL), position }

Regras de negocio:
  - Validar quantidade disponivel ANTES de persistir
  - Preco medio NAO se altera em venda parcial (conforme EP05)
  - Calculo P/L: (precoVenda * qtd) - (precoMedio * qtd) - taxas
  - Armazenar realizedPnL no documento da transacao
  - Considerar ordem cronologica para recalculo retroativo
  - Frontend: dialog de confirmacao com preview do impacto

Campo adicional no transaction-model.js:
  realizedPnL: { type: Number, default: null }  // apenas para SELL
```

**Cenarios de Teste**:
- Cenario 1: Venda parcial com lucro — posicao diminui, P/L positivo
- Cenario 2: Venda parcial com prejuizo — posicao diminui, P/L negativo
- Cenario 3: Venda no ponto de equilibrio (P/L = 0)
- Cenario 4: Venda com taxas altas transformando lucro em prejuizo
- Cenario 5: Venda com data retroativa — recalculo cronologico
- Cenario 6: Frontend exibe dialog de confirmacao corretamente
- Cenario 7: Usuario cancela no dialog — nenhuma operacao executada

---

### EP04-003 — Bloquear Venda Invalida (Quantidade Insuficiente)

**Como** investidor autenticado
**Eu quero** que o sistema bloqueie vendas acima da minha posicao
**Para que** eu nao tenha posicoes negativas inconsistentes no portfolio

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 3 story points (S)

**Contexto**:
O MoneyTrackr nao suporta operacoes de venda a descoberto (short selling). Se o investidor tenta vender mais do que possui, o sistema deve bloquear a operacao imediatamente, retornando erro claro com a quantidade disponivel. A validacao deve ocorrer tanto no backend (fonte da verdade) quanto no frontend (UX preventiva).

**Criterios de Aceite (Verificaveis)**:

- [ ] DADO um investidor com posicao de 10 unidades de "MGLU3"
      QUANDO ele tenta registrar venda de 15 unidades
      ENTAO o sistema deve retornar status 422 (Unprocessable Entity)
      E a mensagem deve ser: "Quantidade insuficiente. Voce possui 10 unidades de MGLU3 e tentou vender 15."
      E nenhuma transacao deve ser criada
      E a posicao deve permanecer inalterada

- [ ] DADO um investidor sem posicao no ativo "WEGE3"
      QUANDO ele tenta registrar venda de qualquer quantidade
      ENTAO o sistema deve retornar status 422
      E a mensagem deve ser: "Voce nao possui posicao em WEGE3 nesta carteira."

- [ ] DADO um investidor com posicao de 10 unidades de "BBDC4"
      QUANDO ele tenta registrar venda de exatamente 10 unidades
      ENTAO a operacao deve ser PERMITIDA (caso coberto por EP04-004)

- [ ] DADO um investidor no frontend preenchendo formulario de venda
      QUANDO ele insere quantidade superior a posicao
      ENTAO o campo deve exibir validacao em tempo real: "Maximo disponivel: X unidades"
      E o botao de submit deve ser desabilitado

**Dependencias**:
- Bloqueada por: EP04-001 (precisa de posicao para validar)
- Bloqueia: Nenhuma

**Definicao de Pronto (DoD)**:
- [ ] Codigo revisado por @code-reviewer
- [ ] Testes unitarios com cobertura >= 90%
- [ ] Testes de integracao passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentacao da API atualizada
- [ ] PR criado por @merge-request

**Notas Tecnicas**:

```
Validacao no transaction-manager.js:

async validateSell({ walletId, userId, ticker, quantity }) {
  const position = await this.positionDAO.findOne({ walletId, userId, ticker })
  if (!position || position.quantity <= 0) {
    this.handleError(APP_CONSTANTS.ERRORS.NO_POSITION_FOR_ASSET)
  }
  if (quantity > position.quantity) {
    this.handleError(APP_CONSTANTS.ERRORS.INSUFFICIENT_QUANTITY)
  }
}

Novas constantes em app-constants.js:
  ERRORS: {
    NO_POSITION_FOR_ASSET: {
      statusCode: 422,
      message: 'Voce nao possui posicao em {ticker} nesta carteira.'
    },
    INSUFFICIENT_QUANTITY: {
      statusCode: 422,
      message: 'Quantidade insuficiente. Voce possui {available} unidades de {ticker} e tentou vender {requested}.'
    }
  }

Frontend:
  - Buscar posicao atual ao selecionar ticker no formulario de venda
  - Validacao client-side em tempo real no campo quantidade
  - Desabilitar botao submit quando quantidade > posicao
```

**Cenarios de Teste**:
- Cenario 1: Venda > posicao — retorna 422 com mensagem detalhada
- Cenario 2: Venda sem posicao nenhuma — retorna 422
- Cenario 3: Venda = posicao — deve ser permitida (nao bloqueia)
- Cenario 4: Venda < posicao — deve ser permitida
- Cenario 5: Tentativa de venda concorrente esgotando posicao — apenas uma deve ser aceita
- Cenario 6: Frontend bloqueia submit com quantidade invalida
- Cenario 7: Frontend exibe quantidade disponivel ao lado do campo

---

### EP04-004 — Zerar Posicao (Venda Total)

**Como** investidor autenticado
**Eu quero** vender toda a minha posicao em um ativo
**Para que** o ativo saia da minha carteira ativa e o preco medio seja resetado

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points (M)

**Contexto**:
Quando o investidor vende exatamente a quantidade total que possui, a posicao deve ser zerada: quantidade = 0, precoMedio = 0, totalInvestido = 0. O ativo NAO e removido do banco — ele permanece com quantidade zero para historico e pode voltar a ter posicao em compras futuras. No frontend, ativos com posicao zero devem ser exibidos em secao separada "Posicoes Encerradas" ou ocultados conforme filtro do usuario.

**Criterios de Aceite (Verificaveis)**:

- [ ] DADO um investidor com posicao de 100 unidades de "ABEV3" a preco medio 14.50
      QUANDO ele registra venda de 100 unidades a 16.00 com taxas 10.00
      ENTAO a posicao deve ter quantidade = 0, precoMedio = 0, totalInvestido = 0
      E o realizedPnL da transacao deve ser = (16*100) - (14.50*100) - 10 = 140.00

- [ ] DADO uma posicao zerada de "ABEV3"
      QUANDO o investidor registra nova compra de 50 unidades a 15.00
      ENTAO a posicao deve ser recriada com quantidade = 50 e preco medio calculado normalmente
      E o historico de transacoes anteriores deve permanecer intacto

- [ ] DADO uma posicao zerada
      QUANDO o investidor consulta a lista de posicoes
      ENTAO ativos com quantidade = 0 devem aparecer em secao "Posicoes Encerradas"
      E devem ter opcao de filtro para exibir/ocultar

- [ ] DADO uma posicao zerada de "ABEV3"
      QUANDO o investidor consulta o historico de transacoes de "ABEV3"
      ENTAO todas as transacoes (compras e vendas) devem estar disponiveis

**Dependencias**:
- Bloqueada por: EP04-002 (logica de venda)
- Bloqueia: Nenhuma

**Definicao de Pronto (DoD)**:
- [ ] Codigo revisado por @code-reviewer
- [ ] Testes unitarios com cobertura >= 90%
- [ ] Testes de integracao passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentacao da API atualizada
- [ ] PR criado por @merge-request

**Notas Tecnicas**:

```
Logica no position-manager.js:

async recalculatePosition({ walletId, userId, ticker }) {
  // ... apos aplicar transacao
  if (position.quantity === 0) {
    position.averagePrice = 0
    position.totalInvested = 0
  }
  await this.positionDAO.update(position)
}

Importante:
  - NAO deletar a posicao — apenas zerar os campos numericos
  - Manter o documento position para referencia historica
  - Se nova compra vier apos zeragem, calcular preco medio do zero
  - Frontend: filtro de posicoes ativas vs encerradas
  - Considerar flag position.isActive (true quando quantity > 0)
```

**Cenarios de Teste**:
- Cenario 1: Venda total — posicao zerada com todos os campos em 0
- Cenario 2: P/L calculado corretamente na venda total
- Cenario 3: Recompra apos zeragem — posicao recriada corretamente
- Cenario 4: Historico de transacoes intacto apos zeragem
- Cenario 5: Frontend exibe posicao encerrada na secao correta
- Cenario 6: Filtro de posicoes ativas/encerradas funciona

---

### EP04-005 — Editar e Excluir Transacao

**Como** investidor autenticado
**Eu quero** editar ou excluir transacoes registradas anteriormente
**Para que** eu possa corrigir erros de digitacao sem perder o historico de auditoria

**Tipo**: Feature
**Prioridade**: Should Have
**Estimativa**: 13 story points (L)

**Contexto**:
Erros acontecem — o investidor pode digitar o preco errado, a quantidade incorreta, ou registrar uma transacao duplicada. O sistema deve permitir edicao e exclusao, mas com trilha de auditoria completa. A exclusao e sempre soft delete (isDeleted = true) — o registro nunca e removido fisicamente do banco. Apos qualquer edicao ou exclusao, TODAS as posicoes afetadas devem ser recalculadas do zero, reprocessando todas as transacoes ativas em ordem cronologica. Isso garante consistencia mesmo com edicoes retroativas.

**Criterios de Aceite (Verificaveis)**:

- [ ] DADO uma transacao de compra de 100 unidades de "PETR4" a 28.50
      QUANDO o investidor edita o preco para 29.00
      ENTAO a transacao deve ser atualizada
      E o campo updatedAt deve ser preenchido
      E a posicao de "PETR4" deve ser recalculada com o novo preco
      E o historico da alteracao deve ser preservado

- [ ] DADO uma transacao de compra
      QUANDO o investidor altera o tipo de BUY para SELL
      ENTAO o sistema deve validar se a venda e possivel (quantidade disponivel na data)
      E recalcular toda a posicao em ordem cronologica

- [ ] DADO uma transacao de compra
      QUANDO o investidor exclui a transacao
      ENTAO a transacao deve receber isDeleted = true e deletedAt = now
      E a transacao NAO deve ser removida fisicamente do banco
      E a posicao deve ser recalculada EXCLUINDO esta transacao
      E a transacao excluida nao deve aparecer nas listagens padrao

- [ ] DADO uma edicao/exclusao que resultaria em posicao negativa em algum ponto da timeline
      QUANDO o sistema recalcula as posicoes
      ENTAO a operacao deve ser BLOQUEADA com status 422
      E a mensagem deve explicar o conflito: "A alteracao resultaria em posicao negativa de {ticker} na data {date}."

- [ ] DADO uma transacao excluida (soft delete)
      QUANDO o investidor consulta com filtro de auditoria
      ENTAO a transacao deve ser visivel com indicacao de "Excluida" e data da exclusao

**Dependencias**:
- Bloqueada por: EP04-001, EP04-002 (transacoes devem existir)
- Bloqueia: Nenhuma

**Definicao de Pronto (DoD)**:
- [ ] Codigo revisado por @code-reviewer
- [ ] Testes unitarios com cobertura >= 90%
- [ ] Testes de integracao passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentacao da API atualizada
- [ ] PR criado por @merge-request

**Notas Tecnicas**:

```
Rotas:
  PUT  /api/v1/transactions/:id  — Editar transacao
  DELETE /api/v1/transactions/:id — Soft delete

PUT /api/v1/transactions/:id
Headers: Authorization: Bearer <JWT>
Body: { campos editaveis — mesmos campos da criacao }
Response 200: { transaction, position }
Validacoes:
  - Transacao deve pertencer ao usuario
  - Transacao nao pode estar deletada
  - Recalcular posicao do zero apos edicao

DELETE /api/v1/transactions/:id
Headers: Authorization: Bearer <JWT>
Response 200: { transaction (com isDeleted: true), position }
Comportamento:
  - Marca isDeleted = true, deletedAt = new Date()
  - NAO remove do banco
  - Recalcula posicao excluindo esta transacao

Recalculo completo de posicao (position-manager.js):

async fullRecalculate({ walletId, userId, ticker }) {
  const transactions = await this.transactionDAO.findActive({
    walletId, userId, ticker,
    isDeleted: { $ne: true }
  }).sort({ date: 1 })

  let quantity = 0
  let totalInvested = 0

  for (const tx of transactions) {
    if (tx.type === 'BUY') {
      totalInvested += (tx.quantity * tx.price) + (tx.fees || 0)
      quantity += tx.quantity
    } else if (tx.type === 'SELL') {
      // Valida se posicao ficaria negativa neste ponto
      if (tx.quantity > quantity) {
        throw new Exception(422, 'Conflito de posicao...')
      }
      totalInvested -= (averagePrice * tx.quantity)
      quantity -= tx.quantity
    }
  }

  const averagePrice = quantity > 0 ? totalInvested / quantity : 0
  await this.positionDAO.upsert({ walletId, userId, ticker }, {
    quantity, averagePrice, totalInvested
  })
}

Campos adicionais no transaction-model.js:
  isDeleted: { type: Boolean, default: false, index: true }
  deletedAt: { type: Date, default: null }

Indices recomendados:
  { walletId: 1, userId: 1, ticker: 1, isDeleted: 1, date: 1 }
```

**Cenarios de Teste**:
- Cenario 1: Editar preco — posicao recalculada corretamente
- Cenario 2: Editar quantidade — posicao recalculada
- Cenario 3: Editar data — reordenacao cronologica e recalculo
- Cenario 4: Editar tipo BUY->SELL — valida e recalcula
- Cenario 5: Soft delete — isDeleted=true, posicao recalculada
- Cenario 6: Transacao deletada nao aparece na listagem padrao
- Cenario 7: Transacao deletada aparece com filtro de auditoria
- Cenario 8: Edicao que causa posicao negativa — bloqueada com erro 422
- Cenario 9: Exclusao que causa posicao negativa — bloqueada com erro 422
- Cenario 10: Editar transacao de outro usuario — retorna 403
- Cenario 11: Editar transacao ja excluida — retorna 404
- Cenario 12: Multiplas edicoes concorrentes — consistencia garantida

---

### EP04-006 — Listar Transacoes com Filtros e Ordenacao

**Como** investidor autenticado
**Eu quero** visualizar minhas transacoes com filtros e ordenacao
**Para que** eu possa encontrar e analisar operacoes especificas rapidamente

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points (M)

**Contexto**:
O investidor precisa consultar seu historico de transacoes com flexibilidade. A listagem deve suportar filtros por periodo, tipo (BUY/SELL), ticker, e ordenacao por qualquer coluna. A API deve suportar paginacao para performance. O frontend deve exibir uma tabela responsiva com as colunas: Data, Ticker, Tipo, Quantidade, Preco, Taxas, Total e P/L (para vendas).

**Criterios de Aceite (Verificaveis)**:

- [ ] DADO um investidor autenticado com transacoes registradas
      QUANDO ele acessa a listagem de transacoes da carteira ativa
      ENTAO o sistema deve retornar todas as transacoes nao-deletadas, paginadas
      E cada transacao deve conter: date, ticker, type, quantity, price, fees, total, realizedPnL

- [ ] DADO um investidor com transacoes de compra e venda
      QUANDO ele filtra por type = "SELL"
      ENTAO apenas transacoes de venda devem ser retornadas

- [ ] DADO um investidor com transacoes entre 2025 e 2026
      QUANDO ele filtra por periodo "2026-01-01" a "2026-03-31"
      ENTAO apenas transacoes dentro do periodo devem ser retornadas

- [ ] DADO um investidor com transacoes de diversos tickers
      QUANDO ele filtra por ticker = "PETR4"
      ENTAO apenas transacoes de "PETR4" devem ser retornadas

- [ ] DADO uma listagem de transacoes
      QUANDO o investidor clica na coluna "Preco" para ordenar
      ENTAO a tabela deve reordenar por preco (crescente/decrescente alternando)

**Dependencias**:
- Bloqueada por: EP04-001 (transacoes devem existir)
- Bloqueia: Nenhuma

**Definicao de Pronto (DoD)**:
- [ ] Codigo revisado por @code-reviewer
- [ ] Testes unitarios com cobertura >= 90%
- [ ] Testes de integracao passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentacao da API atualizada
- [ ] PR criado por @merge-request

**Notas Tecnicas**:

```
Rota: GET /api/v1/transactions
Headers: Authorization: Bearer <JWT>
Query params:
  walletId: String (required)
  type: "BUY" | "SELL" (optional)
  ticker: String (optional)
  startDate: ISO Date (optional)
  endDate: ISO Date (optional)
  sortBy: String (default: "date")
  sortOrder: "asc" | "desc" (default: "desc")
  page: Number (default: 1)
  limit: Number (default: 50, max: 200)

Response 200: {
  data: [Transaction],
  pagination: {
    page: Number,
    limit: Number,
    total: Number,
    totalPages: Number
  }
}

Filtros no transaction-dao.js:
  - Sempre filtrar por userId (seguranca)
  - Sempre filtrar isDeleted: { $ne: true }
  - Usar indices compostos para performance

Indices recomendados:
  { walletId: 1, userId: 1, isDeleted: 1, date: -1 }
  { walletId: 1, userId: 1, ticker: 1, isDeleted: 1 }

Frontend:
  - Tabela com colunas: Data | Ticker | Tipo | Qtd | Preco | Taxas | Total | P/L
  - Filtros no topo da pagina: periodo (date picker), tipo (select), ticker (autocomplete)
  - Ordenacao clicavel em cada cabecalho de coluna
  - Paginacao no rodape
  - Badge colorido para tipo: verde (BUY), vermelho (SELL)
  - Badge colorido para P/L: verde (positivo), vermelho (negativo)
  - Responsivo: em mobile, tabela com scroll horizontal ou layout de cards
```

**Cenarios de Teste**:
- Cenario 1: Listagem padrao — retorna transacoes recentes paginadas
- Cenario 2: Filtro por tipo — apenas BUY ou apenas SELL
- Cenario 3: Filtro por periodo — transacoes dentro do intervalo
- Cenario 4: Filtro por ticker — transacoes do ativo especifico
- Cenario 5: Filtros combinados — tipo + periodo + ticker
- Cenario 6: Ordenacao por cada coluna (asc/desc)
- Cenario 7: Paginacao — navegacao entre paginas
- Cenario 8: Lista vazia — mensagem amigavel
- Cenario 9: Transacoes deletadas nao aparecem
- Cenario 10: Usuario so ve transacoes proprias (isolamento)

---

### EP04-007 — Formulario de Transacao (Frontend)

**Como** investidor autenticado
**Eu quero** um formulario intuitivo para registrar compras e vendas
**Para que** eu possa inserir transacoes rapidamente e sem erros

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points (M)

**Contexto**:
O formulario de transacao e o ponto de entrada principal de dados do sistema. Deve ser simples, com validacao em tempo real, e adaptar-se ao tipo de operacao (compra ou venda). Para vendas, deve exibir a posicao disponivel e um dialog de confirmacao. O formulario deve funcionar tanto para criacao quanto para edicao, reaproveitando a mesma estrutura com campos pre-preenchidos.

**Criterios de Aceite (Verificaveis)**:

- [ ] DADO um investidor no formulario de nova transacao
      QUANDO ele seleciona o tipo "Compra" ou "Venda"
      ENTAO o formulario deve adaptar-se: vendas exibem posicao disponivel e dialog de confirmacao

- [ ] DADO um investidor preenchendo o formulario
      QUANDO ele insere valores invalidos (quantidade negativa, preco zero, data futura)
      ENTAO a validacao deve ocorrer em tempo real campo a campo
      E mensagens de erro devem aparecer abaixo do campo invalido

- [ ] DADO um investidor preenchendo o formulario
      QUANDO ele preenche quantidade e preco
      ENTAO o campo "Total" deve ser calculado automaticamente em tempo real: (quantidade * preco) + taxas

- [ ] DADO um investidor editando uma transacao existente
      QUANDO ele abre o formulario de edicao
      ENTAO todos os campos devem vir pre-preenchidos com os valores atuais

- [ ] DADO um investidor submetendo o formulario de venda
      QUANDO ele clica em "Registrar"
      ENTAO um dialog de confirmacao deve ser exibido com resumo completo da operacao
      E botoes "Confirmar" e "Cancelar" devem estar disponiveis

**Dependencias**:
- Bloqueada por: EP04-001 (API de transacoes), EP03 (carteira ativa)
- Bloqueia: Nenhuma

**Definicao de Pronto (DoD)**:
- [ ] Codigo revisado por @code-reviewer
- [ ] Testes unitarios com cobertura >= 90%
- [ ] Testes de integracao (e2e) passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentacao atualizada
- [ ] PR criado por @merge-request

**Notas Tecnicas**:

```
Componentes Frontend:

  TransactionForm/
    TransactionForm.vue (ou .tsx)  — Formulario principal
    TransactionConfirmDialog.vue   — Dialog de confirmacao para vendas
    TransactionFormValidation.js   — Regras de validacao client-side

Campos do formulario:
  - Tipo: Select (Compra / Venda) — required
  - Ticker: Input text com autocomplete — required, uppercase
  - Quantidade: Input number — required, > 0, inteiro ou decimal
  - Preco unitario: Input number — required, > 0, 2 casas decimais
  - Taxas: Input number — default 0, >= 0, 2 casas decimais
  - Data: Date picker — required, <= hoje
  - Moeda: Select (BRL, USD, EUR) — default BRL
  - Observacoes: Textarea — opcional, max 500 chars
  - Total (calculado): Readonly — (quantidade * preco) + taxas

Dialog de confirmacao (apenas venda):
  - Ticker e quantidade sendo vendida
  - Preco de venda e taxas
  - Posicao atual e posicao apos venda
  - P/L estimado com destaque colorido
  - Botoes: "Confirmar Venda" (vermelho) e "Cancelar" (neutro)

Validacao client-side:
  - Ticker: obrigatorio, 3-10 chars, uppercase, alfanumerico
  - Quantidade: obrigatorio, numerico, > 0
  - Preco: obrigatorio, numerico, > 0
  - Taxas: numerico, >= 0
  - Data: obrigatorio, nao futura
  - Venda: quantidade <= posicao disponivel

UX:
  - Auto-focus no campo ticker ao abrir
  - Tab order logico entre campos
  - Loading state no botao submit durante requisicao
  - Toast de sucesso apos criar/editar transacao
  - Redirecionar para lista de transacoes apos sucesso
```

**Cenarios de Teste**:
- Cenario 1: Preencher formulario de compra completo — submit com sucesso
- Cenario 2: Preencher formulario de venda — dialog de confirmacao aparece
- Cenario 3: Validacao campo a campo em tempo real
- Cenario 4: Total calculado automaticamente ao preencher quantidade e preco
- Cenario 5: Formulario de edicao com campos pre-preenchidos
- Cenario 6: Submit com campos invalidos — erros exibidos, nao submete
- Cenario 7: Cancelar dialog de confirmacao — nenhuma acao executada
- Cenario 8: Loading state durante submissao
- Cenario 9: Erro da API — mensagem de erro exibida
- Cenario 10: Formulario responsivo em mobile

---

## Modelos de Dados

### Transaction Model

```javascript
// src/app/transaction/transaction-model.js
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const transactionSchema = new mongoose.Schema({
  _id: { type: String, required: true, default: uuidv4 },
  walletId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  ticker: { type: String, required: true, uppercase: true, trim: true },
  type: { type: String, required: true, enum: ['BUY', 'SELL'] },
  quantity: { type: Number, required: true, min: 0.00000001 },
  price: { type: Number, required: true, min: 0.00000001 },
  fees: { type: Number, default: 0, min: 0 },
  date: { type: Date, required: true },
  currency: { type: String, default: 'BRL', enum: ['BRL', 'USD', 'EUR'] },
  notes: { type: String, maxlength: 500, default: '' },
  realizedPnL: { type: Number, default: null },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
}, {
  timestamps: true,  // createdAt, updatedAt
  versionKey: false,
})

// Indices compostos para queries frequentes
transactionSchema.index({ walletId: 1, userId: 1, isDeleted: 1, date: -1 })
transactionSchema.index({ walletId: 1, userId: 1, ticker: 1, isDeleted: 1, date: 1 })

module.exports = { schema: transactionSchema }
```

### Position Model

```javascript
// src/app/position/position-model.js
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const positionSchema = new mongoose.Schema({
  _id: { type: String, required: true, default: uuidv4 },
  walletId: { type: String, required: true },
  userId: { type: String, required: true },
  ticker: { type: String, required: true, uppercase: true, trim: true },
  quantity: { type: Number, default: 0, min: 0 },
  averagePrice: { type: Number, default: 0, min: 0 },
  totalInvested: { type: Number, default: 0, min: 0 },
  currency: { type: String, default: 'BRL', enum: ['BRL', 'USD', 'EUR'] },
}, {
  timestamps: true,
  versionKey: false,
})

// Indice unico: um ativo por carteira por usuario
positionSchema.index({ walletId: 1, userId: 1, ticker: 1 }, { unique: true })

module.exports = { schema: positionSchema }
```

---

## Estrutura de Arquivos

```
src/
  app/
    transaction/
      transaction-model.js       # Schema Mongoose
      transaction-dao.js         # Data Access Object
      transaction-manager.js     # Logica de negocio e validacao
      transaction-router.js      # Rotas Express + Swagger docs
    position/
      position-model.js          # Schema Mongoose
      position-dao.js            # Data Access Object
      position-manager.js        # Recalculo de posicao e preco medio
    app-constants.js             # + novas constantes de erro
  __tests__/
    transaction.test.js          # Testes de integracao
    position.test.js             # Testes de recalculo de posicao
```

---

## Constantes de Erro

```javascript
// Adicionar em src/app/app-constants.js
ERRORS: {
  // ... erros existentes
  TRANSACTION_NOT_FOUND: {
    statusCode: 404,
    message: 'Transacao nao encontrada.'
  },
  INVALID_TRANSACTION_TYPE: {
    statusCode: 400,
    message: 'Tipo de transacao invalido. Use BUY ou SELL.'
  },
  INVALID_TRANSACTION_DATA: {
    statusCode: 400,
    message: 'Dados da transacao invalidos.'
  },
  NO_POSITION_FOR_ASSET: {
    statusCode: 422,
    message: 'Voce nao possui posicao neste ativo nesta carteira.'
  },
  INSUFFICIENT_QUANTITY: {
    statusCode: 422,
    message: 'Quantidade insuficiente para venda.'
  },
  POSITION_CONFLICT: {
    statusCode: 422,
    message: 'A alteracao resultaria em posicao negativa.'
  },
  FUTURE_DATE_NOT_ALLOWED: {
    statusCode: 400,
    message: 'Data da transacao nao pode ser futura.'
  },
  WALLET_NOT_FOUND: {
    statusCode: 404,
    message: 'Carteira nao encontrada.'
  },
  TRANSACTION_ALREADY_DELETED: {
    statusCode: 404,
    message: 'Transacao ja foi excluida.'
  },
}
```

---

## Rotas da API (Resumo)

| Metodo | Rota | Descricao | Auth | Status |
|--------|------|-----------|------|--------|
| GET | /api/v1/transactions?walletId=X | Listar transacoes com filtros | JWT | 200 |
| POST | /api/v1/transactions | Criar transacao (compra/venda) | JWT | 201 |
| PUT | /api/v1/transactions/:id | Editar transacao | JWT | 200 |
| DELETE | /api/v1/transactions/:id | Soft delete transacao | JWT | 200 |
| GET | /api/v1/positions?walletId=X | Listar posicoes da carteira | JWT | 200 |

---

## Formulas de Negocio

### Preco Medio (Compra)

```
novoTotalInvestido = totalInvestidoAnterior + (quantidade * preco) + taxas
novaQuantidade = quantidadeAnterior + quantidade
precoMedio = novoTotalInvestido / novaQuantidade
```

### Lucro/Prejuizo Realizado (Venda)

```
realizedPnL = (precoVenda * quantidade) - (precoMedio * quantidade) - taxas
```

### Venda Parcial (Impacto na Posicao)

```
novaQuantidade = quantidadeAnterior - quantidadeVendida
novoTotalInvestido = precoMedio * novaQuantidade
precoMedio = inalterado (permanece o mesmo)
```

### Recalculo Completo (Apos Edicao/Exclusao)

```
1. Buscar todas as transacoes ativas (isDeleted != true) do ativo
2. Ordenar por data crescente
3. Iterar e recalcular posicao do zero
4. Validar que posicao nunca fica negativa em nenhum ponto
5. Persistir posicao final
```

---

## Analise de Riscos

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|-----------|
| Inconsistencia por operacoes concorrentes | Media | Alto | Usar MongoDB sessions/transactions e locks otimistas |
| Recalculo lento com muitas transacoes | Baixa | Medio | Indexar corretamente, paginar, considerar cache de posicao |
| Edicao retroativa causando posicao negativa | Media | Alto | Validar toda a timeline antes de persistir |
| Perda de dados por delete acidental | Baixa | Alto | Soft delete obrigatorio, sem delete fisico |
| Precisao de calculo com float | Media | Medio | Usar arredondamento consistente (2 casas decimais para precos, 8 para cripto) |

---

## Ordem de Implementacao Sugerida

```
1. EP04-001 — Registrar Compra (base de tudo)
   ├── Transaction Model + DAO
   ├── Position Model + DAO
   ├── Transaction Manager + Router
   └── Testes

2. EP04-006 — Listar Transacoes (necessario para validar compras)
   └── GET endpoint + filtros + paginacao

3. EP04-002 — Registrar Venda Valida
   └── Logica de venda + P/L

4. EP04-003 — Bloquear Venda Invalida
   └── Validacao de quantidade

5. EP04-004 — Zerar Posicao
   └── Caso especial de venda total

6. EP04-005 — Editar/Excluir Transacao
   └── Soft delete + recalculo completo

7. EP04-007 — Formulario Frontend
   └── Form + validacao + dialog
```

---

> **Story pronta para @architect** — Todos os campos obrigatorios preenchidos, criterios de aceite verificaveis, dependencias mapeadas, notas tecnicas detalhadas.

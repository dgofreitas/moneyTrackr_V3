# EP05 — Preço Médio

> **Épico**: 5 — Preço Médio
> **Produto**: MoneyTrackr — Gestor de Investimentos
> **Versão**: 3.0
> **Data**: 2026-03-27
> **Status**: Ready for Development

---

## Visão Geral do Épico

O cálculo de preço médio é a base para que o investidor saiba, de forma precisa, quanto pagou por cada ativo em carteira. A partir dele derivam-se métricas essenciais como lucro/prejuízo não realizado, rentabilidade percentual e exposição de risco. Este épico abrange o cálculo, a manutenção sob vendas parciais, o recálculo automático em edições/exclusões, a camada de backend (serviço + integração com Position) e a exibição no frontend.

**Fórmula base**:

```
Preço Médio = (Total Investido + Total de Taxas) / Quantidade Total
```

Onde:
- **Total Investido** = somatório de (preço unitário x quantidade) de cada compra
- **Total de Taxas** = somatório de todas as taxas (corretagem, emolumentos, etc.) de cada compra
- **Quantidade Total** = somatório das quantidades compradas (descontadas as vendas para posição, mas NÃO para o cálculo do preço médio)

**Regras fundamentais**:
- Vendas parciais **não alteram** o preço médio
- Venda total (posição zerada) **reseta** o preço médio para zero
- Novas compras após venda parcial **recalculam** o preço médio ponderado
- Edição ou exclusão de transação dispara **recálculo completo** via replay cronológico

---

## Mapa de Dependências

```
EP02 (Autenticação) ──> EP03 (Carteiras) ──> EP04 (Transações) ──> EP05 (Preço Médio)
                                                                         │
                                                                         ├──> EP06 (Câmbio) - conversão para visão consolidada
                                                                         ├──> EP10 (Eventos Corporativos) - recálculo pós-split/bonificação
                                                                         └──> EP12 (Criptomoedas) - mesma lógica de preço médio
```

---

## Story 1 — Calcular Preço Médio de Compras

### [EP05-S01] Calcular Preço Médio ao Registrar Compras

**Como** investidor
**Eu quero** que o sistema calcule automaticamente o preço médio dos meus ativos
**Para que** eu saiba exatamente quanto paguei por cada unidade, incluindo taxas

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points (M)

**Contexto**:
O preço médio é calculado toda vez que uma transação de compra é registrada. A fórmula considera o custo total acumulado (valor investido + taxas) dividido pela quantidade total em carteira. Quando o investidor realiza múltiplas compras em momentos diferentes e a preços diferentes, o sistema deve ponderar corretamente para refletir o custo real por unidade.

**Critérios de Aceite (Verificáveis)**:

- [ ] **CA-01**: DADO que o investidor registra uma compra de 100 unidades a R$ 10,00 com taxa de R$ 5,00
      QUANDO a transação é salva com sucesso
      ENTÃO o preço médio do ativo deve ser (1000 + 5) / 100 = R$ 10,05

- [ ] **CA-02**: DADO que o investidor já possui 100 unidades com preço médio de R$ 10,05
      E registra nova compra de 50 unidades a R$ 12,00 com taxa de R$ 3,00
      QUANDO a transação é salva com sucesso
      ENTÃO o preço médio deve ser recalculado:
      custo anterior = 100 x 10,05 = R$ 1.005,00
      custo nova compra = (50 x 12,00) + 3,00 = R$ 603,00
      novo preço médio = (1.005 + 603) / 150 = R$ 10,72

- [ ] **CA-03**: DADO que o investidor registra uma compra com taxa zero (R$ 0,00)
      QUANDO a transação é salva
      ENTÃO o preço médio deve ser calculado normalmente, apenas sem a parcela de taxas

- [ ] **CA-04**: DADO que o investidor registra a primeira compra de um ativo nunca antes possuído
      QUANDO a transação é salva
      ENTÃO uma nova posição (Position) deve ser criada para o ativo
      E o preço médio inicial deve refletir essa primeira compra

- [ ] **CA-05**: DADO que ocorre um erro durante o salvamento da transação
      QUANDO o cálculo de preço médio falha ou a persistência falha
      ENTÃO nenhuma alteração deve ser aplicada (rollback)
      E o usuário deve receber mensagem de erro clara

**Dependências**:
- Bloqueada por: EP04 (Transações — modelo e CRUD de transações devem existir)
- Bloqueia: EP05-S02, EP05-S03, EP05-S04, EP05-S05

---

## Story 2 — Venda Parcial Não Altera Preço Médio

### [EP05-S02] Manter Preço Médio Inalterado em Vendas Parciais

**Como** investidor
**Eu quero** que vendas parciais não alterem meu preço médio
**Para que** eu tenha uma visão fiel do custo real de aquisição dos ativos que ainda possuo

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points (S)

**Contexto**:
No método do preço médio brasileiro (utilizado pela B3 e pela Receita Federal), a venda parcial reduz a quantidade em carteira, mas **não** recalcula o preço médio. O preço médio só muda quando há uma nova compra. A venda total (posição zerada) reseta o preço médio para zero, pois não há mais posição ativa. Se o investidor comprar novamente o mesmo ativo após zerar a posição, o cálculo reinicia do zero.

**Critérios de Aceite (Verificáveis)**:

- [ ] **CA-01**: DADO que o investidor possui 150 unidades com preço médio de R$ 10,72
      QUANDO registra uma venda de 50 unidades a R$ 15,00
      ENTÃO a quantidade em posição deve ser 100
      E o preço médio deve permanecer R$ 10,72 (inalterado)

- [ ] **CA-02**: DADO que o investidor possui 100 unidades com preço médio de R$ 10,72
      QUANDO registra uma venda de 100 unidades (venda total)
      ENTÃO a quantidade em posição deve ser 0
      E o preço médio deve ser resetado para R$ 0,00
      E o total investido acumulado deve ser resetado para R$ 0,00

- [ ] **CA-03**: DADO que o investidor zerou a posição de um ativo (preço médio = R$ 0,00)
      QUANDO registra uma nova compra de 200 unidades a R$ 8,00 com taxa de R$ 10,00
      ENTÃO o preço médio deve ser calculado como nova posição: (1.600 + 10) / 200 = R$ 8,05
      E a posição anterior não deve influenciar o novo cálculo

- [ ] **CA-04**: DADO que o investidor realiza múltiplas vendas parciais consecutivas
      QUANDO cada venda é processada
      ENTÃO o preço médio deve permanecer inalterado em todas elas
      E apenas a quantidade deve ser decrementada

- [ ] **CA-05**: DADO que o investidor tenta vender mais unidades do que possui
      QUANDO a transação é submetida
      ENTÃO o sistema deve rejeitar a operação com erro "Quantidade insuficiente para venda"
      E nenhuma alteração deve ser aplicada na posição

**Dependências**:
- Bloqueada por: EP05-S01, EP04 (validação de venda)
- Bloqueia: EP05-S04, EP05-S05

---

## Story 3 — Recálculo em Edição/Exclusão de Transações

### [EP05-S03] Recalcular Preço Médio ao Editar ou Excluir Transações

**Como** investidor
**Eu quero** que ao editar ou excluir uma transação, o preço médio seja recalculado corretamente
**Para que** meu histórico e posições reflitam sempre a realidade, mesmo após correções

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 13 story points (L)

**Contexto**:
Quando uma transação é editada (valor, quantidade, taxa ou data alterados) ou excluída, o preço médio não pode ser simplesmente ajustado de forma incremental — é necessário **replay completo**: o sistema deve buscar todas as transações do ativo naquela carteira, ordená-las cronologicamente e recalcular a posição e o preço médio do zero. Isso garante consistência mesmo em cenários complexos (ex: exclusão de uma compra intermediária que afetou o preço médio de compras posteriores).

**Critérios de Aceite (Verificáveis)**:

- [ ] **CA-01**: DADO que existem 3 transações de compra para PETR4:
        - T1: 100 un a R$ 28,00, taxa R$ 5,00 (2025-01-10)
        - T2: 50 un a R$ 30,00, taxa R$ 3,00 (2025-02-15)
        - T3: 50 un a R$ 25,00, taxa R$ 4,00 (2025-03-20)
      QUANDO o investidor edita T2 para 50 un a R$ 32,00, taxa R$ 3,00
      ENTÃO o sistema deve recalcular a posição replaying T1, T2(editada), T3 em ordem cronológica
      E o novo preço médio deve refletir os valores atualizados

- [ ] **CA-02**: DADO as mesmas 3 transações do CA-01
      QUANDO o investidor exclui T2
      ENTÃO o sistema deve recalcular a posição com apenas T1 e T3
      E a quantidade total deve ser 150 (ao invés de 200)
      E o preço médio deve refletir apenas T1 e T3

- [ ] **CA-03**: DADO que existe 1 compra de 100 un e 1 venda de 50 un
      QUANDO o investidor edita a compra para 40 un (menos que os 50 já vendidos)
      ENTÃO o sistema deve rejeitar a edição com erro "Edição resultaria em posição negativa"
      E nenhuma alteração deve ser aplicada

- [ ] **CA-04**: DADO que o investidor edita a data de uma transação, alterando a ordem cronológica
      QUANDO o recálculo é disparado
      ENTÃO o replay deve usar a nova ordem cronológica
      E o preço médio final deve refletir a sequência correta

- [ ] **CA-05**: DADO que o investidor exclui todas as transações de um ativo
      QUANDO o recálculo é disparado
      ENTÃO a posição do ativo deve ser zerada (quantidade = 0, preço médio = 0)
      E a posição pode ser removida ou marcada como inativa

**Dependências**:
- Bloqueada por: EP05-S01, EP04 (edição e exclusão de transações)
- Bloqueia: EP05-S04

---

## Story 4 — Backend: Serviço de Preço Médio e Integração com Position

### [EP05-S04] Implementar Serviço de Cálculo de Preço Médio no Backend

**Como** desenvolvedor backend
**Eu quero** um serviço dedicado de cálculo de preço médio integrado ao modelo de Position
**Para que** o cálculo seja centralizado, testável e reutilizável em todos os fluxos de transação

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 13 story points (L)

**Contexto**:
O backend segue a arquitetura em camadas (Router → Manager → DAO → Model). O serviço de preço médio deve ser implementado como utilitário puro (função sem side-effects) para facilitar testes, e integrado ao fluxo de transações via Manager. O modelo Position armazena a posição atual de cada ativo por carteira/usuário.

### Estrutura de Arquivos Proposta

```
src/
├── app/
│   ├── position/
│   │   ├── position-model.js          # Schema: { asset, wallet, quantity, averagePrice, totalInvested, totalFees }
│   │   ├── position-dao.js            # CRUD de posições
│   │   ├── position-manager.js        # Orquestra cálculo + persistência
│   │   └── position-router.js         # Endpoints de consulta
│   ├── transaction/
│   │   ├── transaction-model.js       # (Épico 4 — existente)
│   │   ├── transaction-dao.js         # (Épico 4 — existente)
│   │   ├── transaction-manager.js     # Hooks pós-CRUD que disparam recálculo
│   │   └── transaction-router.js      # (Épico 4 — existente)
│   └── utils/
│       └── average-price-calculator.js # Função pura de cálculo
├── __tests__/
│   ├── average-price-calculator.test.js
│   ├── position-manager.test.js
│   └── position.integration.test.js
```

### Modelo Position (position-model.js)

```javascript
const schema = new mongoose.Schema({
  _id: { type: String, required: true, default: uuidv4 },
  domain: { type: String, required: true },           // tenant/user
  walletId: { type: String, required: true, ref: 'wallet' },
  assetTicker: { type: String, required: true },       // ex: PETR4, AAPL
  assetType: { type: String, required: true },         // STOCK, FII, CRYPTO, ETF, BDR
  quantity: { type: Number, required: true, default: 0 },
  averagePrice: { type: Number, required: true, default: 0 },
  totalInvested: { type: Number, required: true, default: 0 }, // custo acumulado (investido + taxas)
  totalFees: { type: Number, required: true, default: 0 },
  status: { type: String, default: 'ACTIVE', enum: ['ACTIVE', 'CLOSED'] },
  lastTransactionDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { versionKey: false })

schema.index({ domain: 1, walletId: 1, assetTicker: 1 }, { unique: true })
```

### Utilitário de Cálculo (average-price-calculator.js)

```javascript
/**
 * Calcula o preço médio via replay cronológico de transações.
 * @param {Array} transactions - lista ordenada por data (ascendente)
 *   Cada transação: { type: 'BUY'|'SELL', quantity, unitPrice, fees, date }
 * @returns {{ quantity, averagePrice, totalInvested, totalFees, status }}
 */
function calculateAveragePrice(transactions) {
  let quantity = 0
  let totalInvested = 0
  let totalFees = 0

  for (const tx of transactions) {
    if (tx.type === 'BUY') {
      const txCost = (tx.unitPrice * tx.quantity) + tx.fees
      totalInvested += txCost
      totalFees += tx.fees
      quantity += tx.quantity
    } else if (tx.type === 'SELL') {
      if (tx.quantity > quantity) {
        throw new Exception(400, 'Quantidade insuficiente para venda')
      }

      // Venda parcial: reduz quantidade mas mantém proporcionalidade
      const sellRatio = tx.quantity / quantity
      totalInvested -= totalInvested * sellRatio
      totalFees -= totalFees * sellRatio
      quantity -= tx.quantity

      // Venda total: zera tudo
      if (quantity === 0) {
        totalInvested = 0
        totalFees = 0
      }
    }
  }

  const averagePrice = quantity > 0 ? totalInvested / quantity : 0
  const status = quantity > 0 ? 'ACTIVE' : 'CLOSED'

  return {
    quantity,
    averagePrice: Math.round(averagePrice * 100) / 100,
    totalInvested: Math.round(totalInvested * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
    status,
  }
}
```

### Fluxo de Integração no Transaction Manager

```
Transação CRUD (create/update/delete)
  └─> transactionManager.afterSave()
        └─> Buscar todas as transações do ativo+carteira (ordenadas por data)
              └─> calculateAveragePrice(transactions)
                    └─> positionDAO.upsert(positionData)
```

**Critérios de Aceite (Verificáveis)**:

- [ ] **CA-01**: DADO o utilitário `calculateAveragePrice`
      QUANDO recebe uma lista de compras [{ type: 'BUY', quantity: 100, unitPrice: 10, fees: 5 }]
      ENTÃO deve retornar { quantity: 100, averagePrice: 10.05, totalInvested: 1005, totalFees: 5, status: 'ACTIVE' }

- [ ] **CA-02**: DADO o utilitário `calculateAveragePrice`
      QUANDO recebe compras e vendas que resultam em posição zero
      ENTÃO deve retornar { quantity: 0, averagePrice: 0, totalInvested: 0, totalFees: 0, status: 'CLOSED' }

- [ ] **CA-03**: DADO que uma transação de compra é criada via POST /api/transactions
      QUANDO a resposta é 201 (sucesso)
      ENTÃO a Position correspondente deve estar atualizada no banco de dados
      E GET /api/positions?walletId=X&assetTicker=Y deve retornar o preço médio correto

- [ ] **CA-04**: DADO que uma transação é editada via PUT /api/transactions/:id
      QUANDO a resposta é 200 (sucesso)
      ENTÃO o sistema deve ter feito replay de todas as transações do ativo
      E a Position deve refletir o novo preço médio recalculado

- [ ] **CA-05**: DADO que uma transação é excluída via DELETE /api/transactions/:id
      QUANDO a resposta é 200 (sucesso)
      ENTÃO o sistema deve ter feito replay das transações restantes
      E a Position deve refletir o preço médio sem a transação excluída

- [ ] **CA-06**: DADO que o utilitário recebe uma venda de 150 unidades mas a posição acumulada é de apenas 100
      QUANDO o cálculo é executado
      ENTÃO deve lançar exceção com statusCode 400 e mensagem "Quantidade insuficiente para venda"

- [ ] **CA-07**: DADO que ocorre erro durante a atualização da Position
      QUANDO o fluxo pós-transação falha
      ENTÃO a transação originária não deve ser persistida (atomicidade)
      E o erro deve ser logado com contexto completo (domain, walletId, assetTicker)

**Cenários de Teste Unitário** (`average-price-calculator.test.js`):

| # | Cenário | Transações | Resultado Esperado |
|---|---------|------------|--------------------|
| 1 | Compra única | BUY 100 x R$10 + R$5 taxa | PM = R$10,05; qty = 100 |
| 2 | Duas compras | BUY 100 x R$10 + R$5; BUY 50 x R$12 + R$3 | PM = R$10,72; qty = 150 |
| 3 | Compra + Venda parcial | BUY 100 x R$10 + R$5; SELL 50 | PM = R$10,05; qty = 50 |
| 4 | Compra + Venda total | BUY 100 x R$10 + R$5; SELL 100 | PM = R$0; qty = 0; status = CLOSED |
| 5 | Zera e recompra | BUY 100 x R$10; SELL 100; BUY 200 x R$8 + R$10 | PM = R$8,05; qty = 200 |
| 6 | Múltiplas compras e vendas | BUY 100 x R$10; BUY 100 x R$12; SELL 50; BUY 50 x R$15 + R$5 | Recálculo correto |
| 7 | Venda inválida (qty insuficiente) | BUY 10; SELL 20 | Exceção 400 |
| 8 | Lista vazia | [] | PM = R$0; qty = 0; status = CLOSED |
| 9 | Compra com taxa zero | BUY 100 x R$10 + R$0 | PM = R$10,00; qty = 100 |
| 10 | Precisão decimal | BUY 3 x R$10,33 + R$0,01 | PM arredondado corretamente |

**Cenários de Teste de Integração** (`position.integration.test.js`):

| # | Cenário | Fluxo |
|---|---------|-------|
| 1 | Criar transação → Position criada | POST compra → GET position → validar dados |
| 2 | Editar transação → Position recalculada | POST compra → PUT edição → GET position → validar recálculo |
| 3 | Excluir transação → Position recalculada | POST 2 compras → DELETE 1 → GET position → validar recálculo |
| 4 | Venda total → Position zerada | POST compra → POST venda total → GET position → status = CLOSED |
| 5 | Concorrência | 2 transações simultâneas → posição final consistente |

**Dependências**:
- Bloqueada por: EP04 (modelo Transaction, CRUD completo), EP03 (modelo Wallet)
- Bloqueia: EP05-S05, EP06 (conversão cambial de posições), EP10 (eventos corporativos)

**Notas Técnicas**:
- O `calculateAveragePrice` deve ser uma **função pura** exportada separadamente para facilitar testes unitários sem mock de banco
- Utilizar `mongoose.startSession()` + `session.withTransaction()` para garantir atomicidade entre Transaction e Position
- O campo `totalInvested` na Position armazena o custo acumulado proporcional (reduz proporcionalmente na venda) — isso é necessário para o recálculo correto do preço médio
- Arredondamento: utilizar 2 casas decimais para BRL; em épico futuro (EP06), ajustar para moeda do ativo
- O índice único `{ domain, walletId, assetTicker }` garante uma Position por ativo por carteira por usuário
- Utilizar `upsert: true` no DAO para criar Position automaticamente na primeira compra
- Redis pode cachear posições para leitura rápida no dashboard (EP19); invalidar cache no pós-cálculo

---

## Story 5 — Frontend: Exibição de Preço Médio e Lucro/Prejuízo

### [EP05-S05] Exibir Preço Médio e Lucro/Prejuízo por Ativo na Visão de Carteira

**Como** investidor
**Eu quero** ver o preço médio e o lucro/prejuízo não realizado de cada ativo na minha carteira
**Para que** eu possa tomar decisões de investimento baseadas em dados claros e atualizados

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points (M)

**Contexto**:
Na visão de carteira (portfolio view), cada ativo deve exibir o preço médio de aquisição e o lucro ou prejuízo não realizado, calculado como a diferença entre o preço atual de mercado e o preço médio, multiplicada pela quantidade em posição. Essa informação é essencial para que o investidor avalie a performance de cada ativo e do portfólio como um todo.

**Fórmulas de exibição**:
```
Lucro/Prejuízo (R$) = (Preço Atual - Preço Médio) x Quantidade
Lucro/Prejuízo (%)  = ((Preço Atual - Preço Médio) / Preço Médio) x 100
Valor de Mercado     = Preço Atual x Quantidade
Custo Total          = Preço Médio x Quantidade
```

### Componentes Frontend Propostos

```
src/
├── components/
│   └── portfolio/
│       ├── PortfolioTable.vue          # Tabela principal de posições
│       ├── PositionRow.vue             # Linha individual por ativo
│       ├── GainLossIndicator.vue       # Componente visual de lucro/prejuízo
│       └── PortfolioSummary.vue        # Resumo total da carteira
├── composables/
│   └── usePositions.js                 # Hook para fetch e estado de posições
├── services/
│   └── position-service.js             # Chamadas HTTP ao backend
└── stores/
    └── position-store.js               # State management (Pinia)
```

### Colunas da Tabela de Portfólio

| Coluna | Fonte | Formato |
|--------|-------|---------|
| Ativo | position.assetTicker | Texto (ex: PETR4) |
| Tipo | position.assetType | Badge colorido |
| Quantidade | position.quantity | Número inteiro ou decimal |
| Preço Médio | position.averagePrice | R$ 0,00 |
| Preço Atual | marketData.currentPrice | R$ 0,00 |
| Custo Total | averagePrice x quantity | R$ 0,00 |
| Valor de Mercado | currentPrice x quantity | R$ 0,00 |
| Lucro/Prejuízo (R$) | (currentPrice - averagePrice) x qty | R$ +0,00 / R$ -0,00 |
| Lucro/Prejuízo (%) | ((current - avg) / avg) x 100 | +0,00% / -0,00% |

**Critérios de Aceite (Verificáveis)**:

- [ ] **CA-01**: DADO que o investidor possui PETR4 com preço médio de R$ 28,50 e quantidade 100
      E o preço atual de mercado é R$ 32,00
      QUANDO acessa a visão de carteira
      ENTÃO deve ver: Preço Médio = R$ 28,50 | Lucro = R$ 350,00 | Rentabilidade = +12,28%

- [ ] **CA-02**: DADO que o investidor possui VALE3 com preço médio de R$ 70,00 e quantidade 50
      E o preço atual de mercado é R$ 65,00
      QUANDO acessa a visão de carteira
      ENTÃO deve ver: Preço Médio = R$ 70,00 | Prejuízo = -R$ 250,00 | Rentabilidade = -7,14%
      E o valor deve estar destacado em vermelho

- [ ] **CA-03**: DADO que o investidor possui ativos com lucro e prejuízo
      QUANDO acessa a visão de carteira
      ENTÃO o resumo da carteira deve exibir:
      - Total investido (soma dos custos totais)
      - Valor de mercado total
      - Lucro/Prejuízo total (R$ e %)

- [ ] **CA-04**: DADO que o preço de mercado não está disponível para um ativo
      QUANDO a visão de carteira é carregada
      ENTÃO o sistema deve exibir "Preço indisponível" na coluna de preço atual
      E não calcular lucro/prejuízo (exibir "—")

- [ ] **CA-05**: DADO que o investidor acessa a visão de carteira
      QUANDO os dados estão carregando
      ENTÃO deve exibir skeleton/loading nos campos de preço e lucro/prejuízo
      E não exibir valores zerados ou incorretos durante o carregamento

- [ ] **CA-06**: DADO que o investidor tem posições com status CLOSED (quantidade = 0)
      QUANDO acessa a visão de carteira
      ENTÃO posições zeradas NÃO devem aparecer na tabela por padrão
      E deve existir um filtro/toggle "Mostrar posições encerradas"

- [ ] **CA-07**: DADO que a visão de carteira está aberta
      QUANDO o preço de mercado é atualizado (via polling ou WebSocket)
      ENTÃO o lucro/prejuízo deve ser recalculado e atualizado na interface sem reload da página

**Dependências**:
- Bloqueada por: EP05-S04 (backend de Position), EP13 (dados de mercado para preço atual), EP16 (layout base)
- Bloqueia: EP19 (Dashboard — widgets usarão dados de posição), EP20 (Gráficos)

**Notas Técnicas**:
- Utilizar Pinia store para gerenciar estado das posições
- Preço atual vem de endpoint separado (EP13 — dados de mercado); combinar no frontend ou via endpoint agregado
- Formatação monetária: utilizar `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`
- Cores: verde (#22c55e) para lucro, vermelho (#ef4444) para prejuízo, cinza para neutro
- Responsividade: em mobile, as colunas menos essenciais (tipo, custo total) podem ser ocultadas em favor de preço médio e lucro/prejuízo
- Polling de preço de mercado: intervalo configurável (default 60s para ações, 15s para cripto conforme EP14)

---

## Definição de Pronto (DoD) — Épico 5 Completo

- [ ] Código revisado por @code-reviewer (todas as 5 stories)
- [ ] Testes unitários com cobertura >= 90% no `average-price-calculator.js`
- [ ] Testes unitários no `position-manager.js`
- [ ] Testes de integração E2E passando (transaction CRUD → position atualizada)
- [ ] QA aprovado por @qa-analyst com cenários de teste manuais executados
- [ ] Lint passando sem erros (`yarn lint`)
- [ ] Documentação da API atualizada (Swagger/OpenAPI para endpoints de Position)
- [ ] PR criado por @merge-request para cada story
- [ ] Componentes frontend testados com dados mockados
- [ ] Performance validada: recálculo de preço médio < 500ms para até 1000 transações por ativo

---

## Riscos e Mitigações

| Risco | Impacto | Probabilidade | Mitigação |
|-------|---------|---------------|-----------|
| Precisão de ponto flutuante em cálculos monetários | Alto | Média | Usar arredondamento explícito para 2 casas; considerar uso de biblioteca `decimal.js` se necessário |
| Performance de replay com muitas transações | Médio | Baixa | Indexar transações por { domain, walletId, assetTicker, date }; cache de posição calculada |
| Concorrência: duas transações simultâneas para o mesmo ativo | Alto | Baixa | Utilizar locks otimistas via `version` no MongoDB ou `findOneAndUpdate` atômico |
| Preço de mercado indisponível | Médio | Média | Exibir estado gracioso no frontend; não bloquear exibição do preço médio |
| Inconsistência entre Position e Transactions após falha | Alto | Baixa | Transações atômicas (MongoDB sessions); job de reconciliação periódico |

---

## Métricas de Sucesso (KPIs)

- **Cobertura de testes** do módulo de cálculo >= 95%
- **Tempo de resposta** do endpoint GET /api/positions < 200ms (p95)
- **Tempo de recálculo** pós-transação < 500ms para até 1000 transações por ativo
- **Zero inconsistências** entre Position e Transactions em testes de carga
- **Satisfação do usuário**: preço médio visível e correto na primeira interação com a carteira

---

## Glossário

| Termo | Definição |
|-------|-----------|
| **Preço Médio** | Custo médio ponderado de aquisição de um ativo, incluindo taxas |
| **Position** | Registro consolidado da situação atual de um ativo em uma carteira |
| **Replay** | Recálculo completo da posição a partir do zero, processando todas as transações em ordem cronológica |
| **Lucro/Prejuízo Não Realizado** | Diferença entre valor de mercado e custo de aquisição de ativos ainda em carteira |
| **Venda Total** | Venda de 100% da posição, zerando a quantidade e resetando o preço médio |

# EP10 — Eventos Corporativos

> **Épico**: 10 — Eventos Corporativos
> **Versão**: 1.0
> **Data**: 2026-03-27
> **Status**: Ready for Architect

---

## Visão Geral

Eventos corporativos (splits, bonificações, fusões, grupamentos) alteram a quantidade e o preço médio de ativos em carteira sem que o investidor tenha executado uma operação de compra ou venda. Quando o usuário importa posições históricas ou mantém ativos de longo prazo, o sistema precisa detectar esses eventos automaticamente, permitir revisão humana e recalcular as posições de forma precisa.

**Impacto no Negócio**: Sem tratamento de eventos corporativos, posições históricas ficam inconsistentes — o preço médio e a quantidade divergem da realidade, gerando métricas de rentabilidade incorretas. Essa feature é crítica para credibilidade dos dados.

**Métricas-alvo**:
- 100% dos eventos detectados para ativos da B3 nos últimos 5 anos
- Recálculo de posição com precisão de 2 casas decimais
- Tempo de detecção < 5s por ticker

**Dependências de Épicos**:
- Épico 4 (Transações) — modelo de transações existente
- Épico 5 (Preço Médio) — lógica de cálculo de preço médio
- Épico 13 (Fontes de Dados de Mercado) — APIs externas para buscar eventos

---

## Stories

---

### EP10-001 Detectar Eventos Corporativos Históricos

**Como** investidor que importou posições antigas
**Eu quero** que o sistema detecte automaticamente eventos corporativos ocorridos no período
**Para que** minhas posições reflitam corretamente splits, bonificações, fusões e grupamentos passados

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points (L)

**Contexto**:
Ao importar uma posição com data retroativa (ex: compra de PETR4 em 2019), o sistema deve consultar APIs externas (BRAPI como primária, Yahoo Finance como fallback — conforme Épico 13) para identificar eventos corporativos ocorridos entre a data da transação e a data atual. Os eventos detectados devem ser armazenados em estado `PENDING` para revisão do usuário antes de qualquer alteração nas posições.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário importou uma transação de compra de PETR4 com data de 01/01/2020
      QUANDO o sistema processa a importação
      ENTÃO deve consultar a API externa e retornar todos os eventos corporativos de PETR4 ocorridos entre 01/01/2020 e a data atual, armazenando-os com status `PENDING`

- [ ] DADO que a API primária (BRAPI) está indisponível
      QUANDO o sistema tenta detectar eventos corporativos
      ENTÃO deve automaticamente utilizar a API secundária (Yahoo Finance) como fallback e registrar log de fallback acionado

- [ ] DADO que o sistema detectou 3 eventos corporativos para um ticker
      QUANDO o usuário acessa a tela de eventos pendentes
      ENTÃO deve visualizar os 3 eventos com tipo, data, ratio e descrição, todos com status `PENDING`

- [ ] DADO que não existem eventos corporativos no período consultado
      QUANDO a detecção é concluída
      ENTÃO o sistema deve registrar que a verificação foi feita (campo `lastCheckedAt`) sem criar registros de eventos

- [ ] DADO que um evento corporativo já foi detectado anteriormente para o mesmo ticker e data
      QUANDO o sistema executa nova detecção
      ENTÃO não deve criar evento duplicado, mantendo o registro existente

**Dependências**:
- Bloqueada por: EP04 (Transações), EP13 (Fontes de Dados)
- Bloqueia: EP10-002, EP10-003

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura >= 90%
- [ ] Testes de integração passando (detecção via API mock)
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação da API atualizada (Swagger)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

**Modelo `CorporateEvent`** (`src/app/corporate-event/corporate-event-model.js`):
```javascript
const schema = new mongoose.Schema({
  _id: { type: String, required: true, default: uuidv4 },
  domain: { type: String, required: true },
  ticker: { type: String, required: true, index: true },
  type: {
    type: String,
    required: true,
    enum: ['SPLIT', 'BONUS', 'MERGER', 'REVERSE_SPLIT'],
  },
  ratio: { type: Number, required: true },       // ex: 2 para split 1:2, 0.5 para grupamento 2:1
  date: { type: Date, required: true },
  description: { type: String },
  source: { type: String, enum: ['BRAPI', 'YAHOO_FINANCE', 'MANUAL'] },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'APPLIED', 'REJECTED'],
    default: 'PENDING',
  },
  detectedAt: { type: Date, default: Date.now },
  lastCheckedAt: { type: Date },
  appliedAt: { type: Date },
  appliedBy: { type: String },  // userId
}, { versionKey: false, timestamps: true })

schema.index({ ticker: 1, date: 1, type: 1 }, { unique: true })
```

**Serviço de Detecção** (`src/app/corporate-event/corporate-event-detection-service.js`):
- Implementar padrão Strategy para múltiplas fontes de dados
- Usar Redis para cache de eventos já consultados (TTL: 24h)
- Detecção assíncrona disparada após importação de transações

**Rota**:
```
GET /api/corporate-events/:ticker
  Query params: ?startDate=2020-01-01&endDate=2026-03-27&status=PENDING
  Response: { events: [...], totalCount: number }
```

**Estrutura de Arquivos**:
```
src/app/corporate-event/
  corporate-event-model.js
  corporate-event-dao.js
  corporate-event-manager.js
  corporate-event-router.js
  corporate-event-detection-service.js
```

**Cenários de Teste**:
- Cenário 1: Detectar split 1:2 de PETR4 ocorrido em 2020 — verificar que evento é criado com ratio=2 e type=SPLIT
- Cenário 2: Detectar bonificação de ITUB4 — verificar ratio e tipo BONUS
- Cenário 3: API primária timeout → fallback para Yahoo Finance com sucesso
- Cenário 4: Ambas as APIs indisponíveis → registrar erro e notificar usuário
- Cenário 5: Importação de ticker sem eventos → nenhum registro criado, lastCheckedAt atualizado
- Cenário 6: Reimportação do mesmo período → não gerar duplicatas

---

### EP10-002 Aprovar Eventos Corporativos Detectados

**Como** investidor que recebeu notificação de eventos corporativos detectados
**Eu quero** revisar cada evento e selecionar quais devem ser aplicados às minhas posições
**Para que** eu tenha controle total sobre as alterações na minha carteira e possa rejeitar eventos incorretos

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points (M)

**Contexto**:
Após a detecção automática (EP10-001), o usuário precisa de uma interface para revisar os eventos pendentes. Cada evento mostra os dados detectados (ticker, tipo, ratio, data) e uma prévia do impacto na posição (quantidade antes/depois, preço médio antes/depois). O usuário pode aprovar, rejeitar individualmente ou aprovar/rejeitar todos de uma vez. Somente eventos com status `APPROVED` poderão ser aplicados na EP10-003.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que existem 5 eventos pendentes para o ticker VALE3
      QUANDO o usuário acessa a página de eventos corporativos de VALE3
      ENTÃO deve visualizar uma lista com checkbox para cada evento, contendo: tipo, data, ratio, descrição e prévia de impacto (quantidade e preço médio antes/depois)

- [ ] DADO que o usuário marcou 3 dos 5 eventos como aprovados e 2 como rejeitados
      QUANDO ele confirma a seleção clicando em "Confirmar Revisão"
      ENTÃO os 3 eventos devem ter status alterado para `APPROVED` e os 2 para `REJECTED`

- [ ] DADO que o usuário clica em "Aprovar Todos"
      QUANDO existem eventos pendentes na lista
      ENTÃO todos os eventos visíveis devem ter seu status alterado para `APPROVED` em uma única operação

- [ ] DADO que um evento possui status `APPLIED`
      QUANDO o usuário acessa a lista de eventos
      ENTÃO esse evento deve aparecer como "Já aplicado" e o checkbox deve estar desabilitado

- [ ] DADO que o usuário visualiza a prévia de impacto de um split 1:4
      QUANDO a posição atual é de 100 ações a R$ 40,00 de preço médio
      ENTÃO a prévia deve exibir: quantidade após = 400, preço médio após = R$ 10,00

**Dependências**:
- Bloqueada por: EP10-001
- Bloqueia: EP10-003

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação da API atualizada (Swagger)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

**Rotas**:
```
PATCH /api/corporate-events/:eventId/approve
  Body: {} (sem payload)
  Response: { event: { ...updatedEvent, status: 'APPROVED' } }

PATCH /api/corporate-events/:eventId/reject
  Body: {} (sem payload)
  Response: { event: { ...updatedEvent, status: 'REJECTED' } }

PATCH /api/corporate-events/bulk-approve
  Body: { eventIds: ['id1', 'id2', 'id3'] }
  Response: { updatedCount: 3 }

GET /api/corporate-events/:ticker/preview
  Query params: ?eventId=xxx
  Response: {
    before: { quantity: 100, avgPrice: 40.00 },
    after: { quantity: 400, avgPrice: 10.00 },
    event: { type: 'SPLIT', ratio: 4 }
  }
```

**Frontend** (`src/pages/corporate-events/`):
- Componente `EventApprovalList` — tabela com checkboxes e previews
- Componente `EventImpactPreview` — card mostrando antes/depois
- Usar skeleton loading enquanto calcula previews
- Toast de confirmação após aprovação/rejeição em lote

**Cálculo de Preview**:
```
SPLIT:      quantidade_nova = quantidade_atual * ratio;  preco_novo = preco_atual / ratio
BONUS:      quantidade_nova = quantidade_atual * (1 + ratio);  preco_novo = preco_atual / (1 + ratio)
MERGER:     quantidade_nova = quantidade_atual * ratio;  preco_novo = preco_atual / ratio  (ticker pode mudar)
REVERSE_SPLIT: quantidade_nova = quantidade_atual / ratio;  preco_novo = preco_atual * ratio
```

**Cenários de Teste**:
- Cenário 1: Aprovação individual de um evento → status muda para APPROVED
- Cenário 2: Rejeição individual → status muda para REJECTED
- Cenário 3: Aprovação em lote de 10 eventos → todos com status APPROVED
- Cenário 4: Tentar aprovar evento já aplicado → erro 409 Conflict
- Cenário 5: Preview de split 1:4 com 100 ações → exibir 400 ações e preço /4
- Cenário 6: Preview de grupamento 4:1 com 400 ações → exibir 100 ações e preço *4

---

### EP10-003 Aplicar Eventos Corporativos e Recalcular Posições

**Como** investidor que aprovou eventos corporativos detectados
**Eu quero** que o sistema aplique os eventos e recalcule automaticamente quantidade e preço médio
**Para que** minhas posições fiquem consistentes com a realidade do mercado após os eventos

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 13 story points (XL)

**Contexto**:
Esta é a story mais crítica do épico. Após aprovação (EP10-002), o usuário dispara a aplicação dos eventos. O sistema deve recalcular as posições na ordem cronológica dos eventos, pois um split seguido de uma bonificação gera resultado diferente se aplicados fora de ordem. A operação deve ser atômica (tudo ou nada) — se um evento falhar, nenhum deve ser persistido. Um registro de auditoria deve ser criado para cada aplicação (alinhado com Épico 25 — Auditoria).

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário possui 100 ações de PETR4 a preço médio de R$ 30,00 e um evento de SPLIT com ratio 2 está aprovado
      QUANDO o usuário clica em "Aplicar Eventos"
      ENTÃO a posição deve ser atualizada para 200 ações com preço médio de R$ 15,00, e o evento deve ter status `APPLIED` com data de aplicação registrada

- [ ] DADO que existem 2 eventos aprovados: um SPLIT (ratio 2, data 01/06/2023) e uma BONUS (ratio 0.1, data 15/09/2023)
      QUANDO os eventos são aplicados
      ENTÃO devem ser processados em ordem cronológica: primeiro o SPLIT (100→200, R$30→R$15), depois a BONUS (200→220, R$15→R$13,64)

- [ ] DADO que o sistema está aplicando 3 eventos e o segundo falha por erro de cálculo
      QUANDO ocorre a falha
      ENTÃO nenhum dos 3 eventos deve ser persistido (rollback atômico), e o usuário deve receber mensagem de erro detalhada

- [ ] DADO que um evento de MERGER altera o ticker de VIVT3 para VIVT4 com ratio 0.9
      QUANDO o evento é aplicado
      ENTÃO a posição de VIVT3 deve ser encerrada e uma nova posição de VIVT4 deve ser criada com quantidade = quantidade_anterior * 0.9

- [ ] DADO que o evento foi aplicado com sucesso
      QUANDO consultamos o registro de auditoria
      ENTÃO deve existir um log contendo: userId, eventId, ticker, tipo do evento, posição antes, posição depois e timestamp da aplicação

**Dependências**:
- Bloqueada por: EP10-002, EP05 (Preço Médio)
- Bloqueia: Nenhuma (end of chain)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura >= 90%
- [ ] Testes de integração passando (fluxo completo de aplicação)
- [ ] Teste de rollback atômico validado
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação da API atualizada (Swagger)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

**Rota**:
```
POST /api/corporate-events/apply
  Body: {
    eventIds: ['id1', 'id2', 'id3'],
    walletId: 'wallet-uuid'
  }
  Response: {
    appliedEvents: [
      {
        eventId: 'id1',
        ticker: 'PETR4',
        type: 'SPLIT',
        before: { quantity: 100, avgPrice: 30.00 },
        after: { quantity: 200, avgPrice: 15.00 },
      },
      ...
    ],
    totalEventsApplied: 3
  }
```

**Lógica de Aplicação** (`corporate-event-manager.js`):
```javascript
async applyEvents({ domain, walletId, eventIds }) {
  const session = await this.appDB.getDb().startSession()
  try {
    session.startTransaction()

    // 1. Buscar eventos aprovados, ordenar por data ASC
    const events = await this.corporateEventDAO.findByIds(eventIds, { session })
    events.sort((a, b) => new Date(a.date) - new Date(b.date))

    // 2. Validar que todos estão APPROVED
    // 3. Para cada evento, na ordem cronológica:
    //    a. Buscar posição atual do ticker
    //    b. Calcular nova quantidade e preço médio
    //    c. Atualizar posição
    //    d. Marcar evento como APPLIED
    //    e. Criar registro de auditoria

    await session.commitTransaction()
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}
```

**Fórmulas de Recálculo**:
| Tipo | Nova Quantidade | Novo Preço Médio |
|------|----------------|------------------|
| SPLIT | `qty * ratio` | `avgPrice / ratio` |
| BONUS | `qty * (1 + ratio)` | `avgPrice / (1 + ratio)` |
| MERGER | `qty * ratio` | `avgPrice / ratio` (novo ticker) |
| REVERSE_SPLIT | `qty / ratio` | `avgPrice * ratio` |

**Observação sobre MERGER**: Criar nova posição no ticker destino e zerar a posição no ticker origem. Manter referência cruzada via campo `mergedFrom` / `mergedTo`.

**Integração com Auditoria (Épico 25)**:
- Cada aplicação gera registro em collection `audit-logs` com snapshot antes/depois
- Soft-delete da posição antiga em caso de MERGER

**Frontend**:
- Botão "Aplicar Eventos Aprovados" com modal de confirmação
- Progress bar durante aplicação de múltiplos eventos
- Exibição do resultado (antes/depois) em modal de sucesso
- Tratamento de erro com mensagem descritiva e opção de retry

**Cenários de Teste**:
- Cenário 1: Aplicar split 1:2 em posição de 100 ações → 200 ações, preço médio /2
- Cenário 2: Aplicar bonificação 10% em 200 ações → 220 ações, preço médio ajustado
- Cenário 3: Aplicar 2 eventos em ordem cronológica → resultado correto cumulativo
- Cenário 4: Aplicar eventos fora de ordem → sistema reordena automaticamente
- Cenário 5: Falha no 2o evento de 3 → rollback completo, nenhuma posição alterada
- Cenário 6: Aplicar MERGER VIVT3→VIVT4 → posição antiga zerada, nova criada
- Cenário 7: Tentar aplicar evento já aplicado → erro 409 Conflict
- Cenário 8: Aplicar grupamento 4:1 em 400 ações → 100 ações, preço médio *4
- Cenário 9: Verificar registro de auditoria após aplicação bem-sucedida

---

## Mapa de Dependências

```
EP04 (Transações) ──┐
EP05 (Preço Médio) ──┤
EP13 (APIs) ─────────┤
                     ▼
              EP10-001 (Detectar)
                     │
                     ▼
              EP10-002 (Aprovar)
                     │
                     ▼
              EP10-003 (Aplicar) ──► EP25 (Auditoria)
```

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| API externa não retorna todos os eventos | Média | Alto | Permitir cadastro manual de eventos + múltiplas fontes |
| Eventos aplicados fora de ordem geram posição incorreta | Baixa | Crítico | Ordenação cronológica obrigatória antes da aplicação |
| Falha parcial na aplicação de múltiplos eventos | Média | Crítico | Transação atômica com MongoDB sessions |
| Precisão de casas decimais em cálculos | Média | Alto | Usar arredondamento para 8 casas, exibir com 2 |
| MERGER com ticker que já possui posição | Baixa | Alto | Consolidar posições do mesmo ticker (soma ponderada) |

# EP03 — Gestão de Carteiras

**Épico**: 3 — Carteiras
**Produto**: MoneyTrackr — Gestor de Investimentos
**Autor**: Product Manager (AI Agent)
**Data**: 2026-03-27
**Versão**: 1.0

---

## Visão Geral do Épico

O Épico 3 permite ao usuário organizar seus investimentos em múltiplas carteiras isoladas, alternar entre elas, e obter uma visão consolidada de todo o patrimônio. É o alicerce sobre o qual todos os épicos subsequentes (Transações, Preço Médio, Dashboard, Gráficos) se constroem — sem carteira, não há contexto para nenhum dado financeiro.

### Personas
- **Investidor Pessoa Física**: possui investimentos diversificados e deseja separar por estratégia (ex.: "Longo Prazo", "Dividendos", "Cripto").
- **Investidor Iniciante**: está começando e terá apenas uma carteira, mas não deve ser impactado por complexidade desnecessária.

### Métricas de Sucesso (KPIs)
- 100% dos usuários possuem ao menos 1 carteira após o onboarding
- Tempo médio para criar carteira < 5 segundos
- Taxa de erro na alternância de carteira = 0%
- Adoção da visão consolidada ≥ 30% dos usuários com 2+ carteiras

### Mapa de Dependências

```
EP02 (Autenticação) ──► EP03 (Carteiras) ──► EP04 (Transações)
                                           ──► EP05 (Preço Médio)
                                           ──► EP06 (Câmbio)
                                           ──► EP19 (Dashboard)
                                           ──► EP20 (Gráficos)
```

---

## Story EP03-001 — Criar Carteira

### Definição

**Como** investidor autenticado
**Eu quero** criar uma nova carteira com um nome único
**Para que** eu possa organizar meus investimentos por estratégia, objetivo ou perfil de risco

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points (M)

### Contexto

Cada usuário pode possuir múltiplas carteiras, mas cada uma deve ter um nome único dentro do escopo daquele usuário. A primeira carteira criada pelo usuário deve ser automaticamente marcada como ativa (`isActive: true`). Carteiras subsequentes são criadas como inativas. O nome da carteira deve ser alfanumérico, permitindo espaços e caracteres acentuados, com limite de 50 caracteres. A moeda padrão é BRL, mas o usuário pode selecionar USD ou EUR no momento da criação.

### Critérios de Aceite (Verificáveis)

- [ ] **CA-001**: Criação básica
      DADO que o usuário está autenticado e acessa a funcionalidade de criar carteira
      QUANDO ele preenche o nome "Longo Prazo" e confirma
      ENTÃO o sistema deve criar a carteira com `status: active`, `isDeleted: false`, `currency: BRL` e retornar HTTP 201 com os dados da carteira criada

- [ ] **CA-002**: Primeira carteira é ativa por padrão
      DADO que o usuário não possui nenhuma carteira
      QUANDO ele cria sua primeira carteira
      ENTÃO a carteira deve ser salva com `isActive: true`
      E não deve haver nenhuma outra carteira ativa para o mesmo usuário

- [ ] **CA-003**: Carteiras subsequentes são inativas
      DADO que o usuário já possui ao menos uma carteira ativa
      QUANDO ele cria uma nova carteira
      ENTÃO a nova carteira deve ser salva com `isActive: false`
      E a carteira anteriormente ativa deve permanecer ativa

- [ ] **CA-004**: Nome único por usuário
      DADO que o usuário possui uma carteira chamada "Dividendos"
      QUANDO ele tenta criar outra carteira com o nome "Dividendos"
      ENTÃO o sistema deve retornar HTTP 409 com a mensagem "Já existe uma carteira com este nome"
      E a carteira não deve ser criada

- [ ] **CA-005**: Validação de nome — campo obrigatório
      DADO que o usuário tenta criar uma carteira
      QUANDO ele submete o formulário com o campo nome vazio ou apenas espaços
      ENTÃO o sistema deve retornar HTTP 400 com a mensagem "Nome da carteira é obrigatório"

- [ ] **CA-006**: Validação de nome — limite de caracteres
      DADO que o usuário tenta criar uma carteira
      QUANDO ele preenche um nome com mais de 50 caracteres
      ENTÃO o sistema deve retornar HTTP 400 com a mensagem "Nome da carteira deve ter no máximo 50 caracteres"

- [ ] **CA-007**: Validação de nome — case-insensitive
      DADO que o usuário possui uma carteira chamada "Minha Carteira"
      QUANDO ele tenta criar outra chamada "minha carteira" (lowercase)
      ENTÃO o sistema deve retornar HTTP 409 com erro de nome duplicado

### Dependências
- **Bloqueada por**: EP02 (Autenticação — JWT ativo e middleware de autorização)
- **Bloqueia**: EP03-002, EP03-003, EP03-004, EP04 (Transações), EP05 (Preço Médio)

### Notas Técnicas

#### Backend

**Rota**: `POST /api/wallets`

**Headers obrigatórios**: `Authorization: Bearer <jwt>`

**Request Body**:
```json
{
  "name": "Longo Prazo",
  "currency": "BRL"
}
```

**Response 201**:
```json
{
  "_id": "uuid-v4",
  "userId": "user-uuid",
  "name": "Longo Prazo",
  "currency": "BRL",
  "isActive": true,
  "isDeleted": false,
  "createdAt": "2026-03-27T10:00:00.000Z",
  "updatedAt": "2026-03-27T10:00:00.000Z"
}
```

**Modelo Mongoose** (`wallet-model.js`):
```javascript
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const walletSchema = new mongoose.Schema({
  _id: { type: String, required: true, default: uuidv4 },
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 50 },
  currency: { type: String, enum: ['BRL', 'USD', 'EUR'], default: 'BRL' },
  isActive: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  versionKey: false,
})

walletSchema.index({ userId: 1, name: 1 }, { unique: true })
walletSchema.index({ userId: 1, isActive: 1 })

module.exports = { walletSchema }
```

**Estrutura de Arquivos Backend**:
```
src/app/wallet/
├── wallet-model.js      # Schema Mongoose
├── wallet-dao.js        # Data Access Object
├── wallet-manager.js    # Lógica de negócio
└── wallet-router.js     # Rotas Express
```

**Wallet DAO** — Métodos necessários:
- `create(walletData)` — Cria nova carteira
- `findByUserId(userId)` — Lista carteiras não-deletadas do usuário
- `findByUserIdAndName(userId, name)` — Busca por nome (case-insensitive)
- `countByUserId(userId)` — Conta carteiras não-deletadas do usuário

**Wallet Manager** — Lógica:
1. Receber `{ domain, name, currency }` do router
2. Validar nome (obrigatório, max 50 chars, trim)
3. Verificar unicidade do nome (case-insensitive) para o `userId`
4. Se é a primeira carteira do usuário → `isActive: true`
5. Caso contrário → `isActive: false`
6. Persistir via DAO e retornar resultado

**Erros em `app-constants.js`**:
```javascript
WALLET_NAME_REQUIRED: { statusCode: 400, message: 'Nome da carteira é obrigatório' },
WALLET_NAME_TOO_LONG: { statusCode: 400, message: 'Nome da carteira deve ter no máximo 50 caracteres' },
WALLET_ALREADY_EXISTS: { statusCode: 409, message: 'Já existe uma carteira com este nome' },
WALLET_NOT_FOUND: { statusCode: 404, message: 'Carteira não encontrada' },
```

#### Frontend

**Componentes**:
- `CreateWalletModal` — Modal com formulário (nome + moeda), validação inline
- Botão "Nova Carteira" no header/sidebar e na página de configurações

**Fluxo UX**:
1. Usuário clica em "+" ou "Nova Carteira"
2. Modal abre com campo nome (foco automático) e dropdown de moeda (BRL padrão)
3. Validação em tempo real: nome não vazio, ≤50 chars
4. Ao confirmar: loading spinner no botão, desabilita inputs
5. Sucesso: toast de confirmação, fecha modal, atualiza lista de carteiras
6. Erro 409: exibe mensagem inline abaixo do campo nome
7. Erro genérico: toast de erro

### Cenários de Teste

- **Cenário 1**: Criar primeira carteira — verificar `isActive: true`
- **Cenário 2**: Criar segunda carteira — verificar `isActive: false`, primeira continua ativa
- **Cenário 3**: Nome duplicado (mesmo case) — verificar HTTP 409
- **Cenário 4**: Nome duplicado (case diferente) — verificar HTTP 409
- **Cenário 5**: Nome vazio — verificar HTTP 400
- **Cenário 6**: Nome com 51 caracteres — verificar HTTP 400
- **Cenário 7**: Nome com 50 caracteres — verificar HTTP 201
- **Cenário 8**: Criar carteira com moeda USD — verificar persistência
- **Cenário 9**: Usuário não autenticado — verificar HTTP 401
- **Cenário 10**: Criar carteira com nome contendo acentos e espaços ("Renda Fixa Pós-Fixada") — verificar sucesso

---

## Story EP03-002 — Alternar Carteira Ativa

### Definição

**Como** investidor com múltiplas carteiras
**Eu quero** alternar entre minhas carteiras rapidamente
**Para que** eu visualize e gerencie os investimentos de cada carteira de forma isolada

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points (M)

### Contexto

A carteira ativa define o contexto de todos os dados exibidos na aplicação (transações, posições, gráficos, dashboard). Apenas uma carteira pode estar ativa por vez. A troca deve ser instantânea do ponto de vista do usuário, com feedback visual imediato. A informação de carteira ativa é persistida no backend (campo `isActive` do model) e também cacheada na sessão/preferências do frontend para performance.

### Critérios de Aceite (Verificáveis)

- [ ] **CA-001**: Ativação com sucesso
      DADO que o usuário possui as carteiras "Longo Prazo" (ativa) e "Dividendos" (inativa)
      QUANDO ele seleciona "Dividendos" como carteira ativa
      ENTÃO "Dividendos" deve ter `isActive: true`
      E "Longo Prazo" deve ter `isActive: false`
      E o sistema deve retornar HTTP 200

- [ ] **CA-002**: Apenas uma carteira ativa por vez
      DADO que o usuário possui 5 carteiras
      QUANDO ele ativa a carteira "Cripto"
      ENTÃO apenas "Cripto" deve ter `isActive: true`
      E todas as outras 4 devem ter `isActive: false`

- [ ] **CA-003**: Dados refletem carteira ativa
      DADO que o usuário alternou para a carteira "Dividendos"
      QUANDO ele navega para qualquer tela (Dashboard, Transações, Posições)
      ENTÃO todos os dados exibidos devem corresponder exclusivamente à carteira "Dividendos"

- [ ] **CA-004**: Ativar carteira inexistente
      DADO que o usuário faz uma requisição para ativar um ID inválido
      QUANDO a requisição é processada
      ENTÃO o sistema deve retornar HTTP 404 com "Carteira não encontrada"

- [ ] **CA-005**: Ativar carteira de outro usuário
      DADO que o usuário A tenta ativar uma carteira pertencente ao usuário B
      QUANDO a requisição é processada
      ENTÃO o sistema deve retornar HTTP 404 com "Carteira não encontrada"
      E nenhuma alteração deve ser feita

- [ ] **CA-006**: Persistência da preferência
      DADO que o usuário ativou a carteira "Cripto"
      QUANDO ele faz logout e login novamente
      ENTÃO a carteira "Cripto" deve continuar como ativa

### Dependências
- **Bloqueada por**: EP03-001 (Criar Carteira)
- **Bloqueia**: EP04 (Transações — contexto de carteira), EP19 (Dashboard)

### Notas Técnicas

#### Backend

**Rota**: `PUT /api/wallets/:id/activate`

**Response 200**:
```json
{
  "_id": "wallet-uuid",
  "userId": "user-uuid",
  "name": "Dividendos",
  "currency": "BRL",
  "isActive": true,
  "isDeleted": false,
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Wallet Manager** — Lógica de ativação:
1. Buscar carteira por `_id` e `userId` (garantir ownership)
2. Verificar que carteira existe e `isDeleted: false`
3. **Operação atômica**: desativar todas as carteiras do usuário (`updateMany`) e ativar a selecionada (`updateOne`)
4. Considerar uso de transação MongoDB (session) para garantir atomicidade
5. Invalidar cache Redis da sessão do usuário (se aplicável)

**Wallet DAO** — Métodos necessários:
- `deactivateAll(userId)` — `updateMany({ userId, isDeleted: false }, { isActive: false })`
- `activate(walletId, userId)` — `updateOne({ _id: walletId, userId }, { isActive: true, updatedAt: Date.now() })`
- `findActiveByUserId(userId)` — `findOne({ userId, isActive: true, isDeleted: false })`

#### Frontend

**Componentes**:
- `WalletSelector` — Dropdown no header/sidebar com lista de carteiras
- Indicador visual da carteira ativa (nome + ícone/cor)

**Fluxo UX**:
1. Dropdown exibe carteira ativa com destaque (nome em bold, ícone ✓)
2. Ao clicar, lista todas as carteiras (exceto deletadas) + opção "Visão Consolidada"
3. Seleção dispara loading global (skeleton) pois todos os dados mudam
4. Sucesso: atualiza estado global, recarrega dados da nova carteira
5. Preferência salva em `localStorage` para acesso rápido no reload

**Gerenciamento de Estado**:
- Carteira ativa armazenada em estado global (Redux/Pinia/Context)
- Todas as chamadas API devem incluir `walletId` como parâmetro ou ser filtradas pelo backend via carteira ativa do usuário

### Cenários de Teste

- **Cenário 1**: Ativar carteira inativa — verificar troca de `isActive`
- **Cenário 2**: Verificar que carteira anterior foi desativada (atomicidade)
- **Cenário 3**: Ativar carteira já ativa — deve ser idempotente (HTTP 200)
- **Cenário 4**: Ativar carteira deletada — verificar HTTP 404
- **Cenário 5**: Ativar carteira de outro usuário — verificar HTTP 404
- **Cenário 6**: Persistência após re-login — verificar que carteira ativa permanece
- **Cenário 7**: Verificar que dados do Dashboard mudam ao alternar

---

## Story EP03-003 — Visão Consolidada

### Definição

**Como** investidor com múltiplas carteiras
**Eu quero** visualizar um resumo consolidado de todo meu patrimônio
**Para que** eu tenha uma visão completa do meu portfólio total, independentemente de como organizei minhas carteiras

**Tipo**: Feature
**Prioridade**: Should Have
**Estimativa**: 8 story points (L)

### Contexto

A visão consolidada não é uma "carteira" em si, mas um modo de visualização que agrega dados de todas as carteiras não-deletadas do usuário. Todos os valores devem ser convertidos para BRL utilizando a taxa de câmbio do dia (dependência do EP06 — Câmbio). Enquanto o EP06 não estiver implementado, ativos em moeda estrangeira devem ser exibidos sem conversão, com indicação visual de que a conversão cambial não está disponível.

### Critérios de Aceite (Verificáveis)

- [ ] **CA-001**: Soma de ativos em BRL
      DADO que o usuário possui a carteira "BR" com R$ 10.000 em ativos e a carteira "USA" com R$ 15.000 em ativos (já convertidos)
      QUANDO ele seleciona o modo "Visão Consolidada"
      ENTÃO o sistema deve exibir patrimônio total de R$ 25.000

- [ ] **CA-002**: Conversão cambial aplicada
      DADO que o usuário possui ativos em USD na carteira "Internacional"
      E a taxa USD/BRL do dia é 5,20
      QUANDO ele acessa a visão consolidada
      ENTÃO os ativos em USD devem ser convertidos para BRL usando a taxa 5,20
      E o total deve incluir a soma convertida

- [ ] **CA-003**: Carteiras deletadas não entram na consolidação
      DADO que o usuário possui 3 carteiras, sendo 1 deletada (soft delete)
      QUANDO ele acessa a visão consolidada
      ENTÃO apenas as 2 carteiras ativas devem ser consideradas

- [ ] **CA-004**: Modo consolidado é somente leitura
      DADO que o usuário está na visão consolidada
      QUANDO ele tenta registrar uma transação
      ENTÃO o sistema deve exibir mensagem instruindo a selecionar uma carteira específica
      E a operação de escrita não deve ser permitida

- [ ] **CA-005**: API retorna dados consolidados
      DADO que o usuário possui carteiras com ativos
      QUANDO a rota `GET /api/wallets/consolidated` é chamada
      ENTÃO o sistema deve retornar o total consolidado em BRL, lista de carteiras com seus subtotais, e a data/hora da última atualização cambial

- [ ] **CA-006**: Sem conversão disponível (fallback)
      DADO que o serviço de câmbio (EP06) não está disponível ou não foi implementado
      QUANDO o usuário acessa a visão consolidada com ativos em moeda estrangeira
      ENTÃO os ativos em moeda estrangeira devem ser listados separadamente com suas moedas originais
      E um aviso deve informar que a conversão cambial não está disponível

### Dependências
- **Bloqueada por**: EP03-001 (Criar Carteira), EP04 (Transações — para haver ativos)
- **Dependência opcional**: EP06 (Câmbio — conversão para BRL)
- **Bloqueia**: EP19 (Dashboard — widget de patrimônio total)

### Notas Técnicas

#### Backend

**Rota**: `GET /api/wallets/consolidated`

**Response 200**:
```json
{
  "totalBRL": 25000.00,
  "exchangeRateDate": "2026-03-27",
  "exchangeAvailable": true,
  "wallets": [
    {
      "_id": "wallet-1",
      "name": "Renda Variável BR",
      "currency": "BRL",
      "subtotalOriginal": 10000.00,
      "subtotalBRL": 10000.00
    },
    {
      "_id": "wallet-2",
      "name": "Stocks USA",
      "currency": "USD",
      "subtotalOriginal": 2884.62,
      "subtotalBRL": 15000.00,
      "exchangeRate": 5.20
    }
  ]
}
```

**Wallet Manager** — Lógica de consolidação:
1. Buscar todas as carteiras do usuário (`isDeleted: false`)
2. Para cada carteira, obter subtotal dos ativos (delegado ao Asset/Position Manager — EP04/EP05)
3. Buscar taxas de câmbio do dia via serviço de câmbio (EP06)
4. Converter todos os valores para BRL
5. Somar totais e montar resposta
6. **Fallback**: se câmbio indisponível, retornar `exchangeAvailable: false` e `subtotalBRL: null` para carteiras em moeda estrangeira

**Cache Redis**:
- Cachear resultado consolidado por 5 minutos (`wallets:consolidated:{userId}`)
- Invalidar cache ao: criar/deletar carteira, registrar transação, atualizar câmbio

#### Frontend

**Componentes**:
- Opção "Consolidado" no `WalletSelector` (ícone diferenciado, ex.: ícone de soma/merge)
- `ConsolidatedView` — Exibe cards por carteira com subtotais + total geral
- Badge de aviso quando câmbio não disponível

**Fluxo UX**:
1. No `WalletSelector`, opção "📊 Visão Consolidada" aparece acima da lista de carteiras
2. Ao selecionar, layout muda: header exibe "Visão Consolidada" em vez do nome da carteira
3. Ações de escrita (adicionar transação) ficam desabilitadas com tooltip explicativo
4. Dashboard exibe widgets adaptados (total geral, distribuição por carteira)

### Cenários de Teste

- **Cenário 1**: Consolidação com 2 carteiras em BRL — soma correta
- **Cenário 2**: Consolidação com 1 carteira BRL + 1 USD — conversão correta
- **Cenário 3**: Carteira deletada excluída da consolidação
- **Cenário 4**: Tentativa de escrita em modo consolidado — bloqueio
- **Cenário 5**: Câmbio indisponível — fallback com aviso
- **Cenário 6**: Usuário com 1 carteira — consolidado igual ao valor da carteira
- **Cenário 7**: Usuário sem ativos — consolidado retorna R$ 0,00
- **Cenário 8**: Cache invalidado após nova transação

---

## Story EP03-004 — Editar e Excluir Carteira

### Definição

**Como** investidor autenticado
**Eu quero** renomear ou excluir carteiras existentes
**Para que** eu mantenha minha organização atualizada conforme minha estratégia evolui

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points (M)

### Contexto

A edição permite renomear a carteira e alterar a moeda (apenas se não houver transações na carteira). A exclusão é sempre **soft delete** (`isDeleted: true`) — os dados permanecem no banco para auditoria (alinhado com EP25 — Auditoria). O usuário não pode deletar sua única carteira remanescente. Ao deletar a carteira ativa, o sistema deve automaticamente ativar outra carteira.

### Critérios de Aceite (Verificáveis)

#### Edição

- [ ] **CA-001**: Renomear carteira com sucesso
      DADO que o usuário possui a carteira "Longo Prazo"
      QUANDO ele altera o nome para "Buy & Hold"
      ENTÃO o sistema deve atualizar o nome da carteira
      E retornar HTTP 200 com os dados atualizados
      E o campo `updatedAt` deve ser atualizado

- [ ] **CA-002**: Renomear para nome já existente
      DADO que o usuário possui as carteiras "Alpha" e "Beta"
      QUANDO ele tenta renomear "Alpha" para "Beta"
      ENTÃO o sistema deve retornar HTTP 409 com "Já existe uma carteira com este nome"

- [ ] **CA-003**: Alterar moeda — sem transações
      DADO que a carteira "Internacional" tem moeda BRL e não possui transações
      QUANDO o usuário altera a moeda para USD
      ENTÃO o sistema deve atualizar a moeda e retornar HTTP 200

- [ ] **CA-004**: Alterar moeda — com transações
      DADO que a carteira "BR Stocks" tem moeda BRL e possui transações registradas
      QUANDO o usuário tenta alterar a moeda para USD
      ENTÃO o sistema deve retornar HTTP 422 com "Não é possível alterar a moeda de uma carteira com transações"

#### Exclusão

- [ ] **CA-005**: Soft delete com sucesso
      DADO que o usuário possui 3 carteiras e a carteira "Teste" não é a ativa
      QUANDO ele exclui a carteira "Teste"
      ENTÃO a carteira deve ter `isDeleted: true` e `updatedAt` atualizado
      E retornar HTTP 200
      E a carteira não deve mais aparecer nas listagens

- [ ] **CA-006**: Não pode deletar a única carteira
      DADO que o usuário possui apenas 1 carteira não-deletada
      QUANDO ele tenta excluí-la
      ENTÃO o sistema deve retornar HTTP 422 com "Não é possível excluir a única carteira"

- [ ] **CA-007**: Deletar carteira ativa — auto-ativar outra
      DADO que o usuário possui as carteiras "A" (ativa) e "B" (inativa)
      QUANDO ele exclui a carteira "A"
      ENTÃO "A" deve ser marcada como `isDeleted: true` e `isActive: false`
      E a carteira "B" deve ser automaticamente ativada (`isActive: true`)

- [ ] **CA-008**: Confirmar exclusão
      DADO que o usuário clica em "Excluir carteira"
      QUANDO o diálogo de confirmação aparece
      ENTÃO o usuário deve confirmar digitando o nome da carteira
      E somente após a confirmação o sistema deve processar a exclusão

- [ ] **CA-009**: Carteira de outro usuário
      DADO que o usuário A tenta editar ou excluir uma carteira do usuário B
      QUANDO a requisição é processada
      ENTÃO o sistema deve retornar HTTP 404

### Dependências
- **Bloqueada por**: EP03-001 (Criar Carteira)
- **Relação**: EP25 (Auditoria — soft delete)
- **Bloqueia**: Nenhuma

### Notas Técnicas

#### Backend

**Rota de edição**: `PUT /api/wallets/:id`

**Request Body**:
```json
{
  "name": "Buy & Hold",
  "currency": "USD"
}
```

**Response 200**:
```json
{
  "_id": "wallet-uuid",
  "userId": "user-uuid",
  "name": "Buy & Hold",
  "currency": "USD",
  "isActive": true,
  "isDeleted": false,
  "createdAt": "...",
  "updatedAt": "2026-03-27T12:00:00.000Z"
}
```

**Rota de exclusão**: `DELETE /api/wallets/:id`

**Response 200**:
```json
{
  "message": "Carteira excluída com sucesso",
  "activatedWallet": {
    "_id": "wallet-b-uuid",
    "name": "Carteira B"
  }
}
```

**Wallet Manager** — Lógica de edição:
1. Buscar carteira por `_id` e `userId`
2. Se `name` alterado: validar unicidade (case-insensitive)
3. Se `currency` alterado: verificar se não há transações vinculadas (consultar Transaction DAO — EP04)
4. Atualizar campos e `updatedAt`

**Wallet Manager** — Lógica de exclusão:
1. Buscar carteira por `_id` e `userId`
2. Contar carteiras não-deletadas do usuário
3. Se contagem ≤ 1 → bloquear exclusão
4. Marcar `isDeleted: true`, `isActive: false`, atualizar `updatedAt`
5. Se a carteira era ativa → ativar a carteira mais antiga restante (`createdAt` ASC)
6. Invalidar caches relevantes

**Wallet DAO** — Métodos adicionais:
- `update(walletId, userId, updateData)` — Atualiza carteira
- `softDelete(walletId, userId)` — Marca como deletada
- `findOldestActive(userId)` — Busca a carteira mais antiga não-deletada

**Erros em `app-constants.js`**:
```javascript
WALLET_CANNOT_DELETE_ONLY: { statusCode: 422, message: 'Não é possível excluir a única carteira' },
WALLET_CANNOT_CHANGE_CURRENCY: { statusCode: 422, message: 'Não é possível alterar a moeda de uma carteira com transações' },
```

#### Frontend

**Componentes**:
- `WalletSettingsPage` — Página com lista de carteiras e ações (editar, excluir, ativar)
- `EditWalletModal` — Modal de edição com campos nome e moeda
- `DeleteWalletDialog` — Diálogo de confirmação com input de nome

**Fluxo UX — Edição**:
1. Na página de configurações, usuário clica no ícone de edição da carteira
2. Modal abre pré-preenchido com dados atuais
3. Campo moeda desabilitado se carteira possui transações (tooltip explicativo)
4. Validação em tempo real
5. Sucesso: toast + atualização da lista

**Fluxo UX — Exclusão**:
1. Botão de excluir aparece apenas se houver mais de 1 carteira
2. Clique abre diálogo: "Para confirmar, digite o nome da carteira: **{nome}**"
3. Botão de confirmação habilitado somente quando nome digitado coincide
4. Sucesso: toast informando exclusão + se carteira ativa trocou, informar nova ativa

### Cenários de Teste

- **Cenário 1**: Renomear carteira — sucesso
- **Cenário 2**: Renomear para nome duplicado — HTTP 409
- **Cenário 3**: Alterar moeda sem transações — sucesso
- **Cenário 4**: Alterar moeda com transações — HTTP 422
- **Cenário 5**: Soft delete — verificar `isDeleted: true` no banco
- **Cenário 6**: Deletar única carteira — HTTP 422
- **Cenário 7**: Deletar carteira ativa — verificar auto-ativação da próxima
- **Cenário 8**: Carteira deletada não aparece em `GET /api/wallets`
- **Cenário 9**: Deletar carteira de outro usuário — HTTP 404
- **Cenário 10**: Confirmar que dados da carteira deletada permanecem no banco (auditoria)

---

## Story EP03-005 — Listar Carteiras

### Definição

**Como** investidor autenticado
**Eu quero** visualizar todas as minhas carteiras
**Para que** eu tenha visibilidade do meu portfólio e possa gerenciá-las

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 3 story points (S)

### Contexto

A listagem de carteiras é utilizada pelo `WalletSelector` do header/sidebar e pela página de configurações de carteiras. Deve retornar apenas carteiras não-deletadas do usuário autenticado, ordenadas com a carteira ativa primeiro e as demais por data de criação.

### Critérios de Aceite (Verificáveis)

- [ ] **CA-001**: Listar carteiras com sucesso
      DADO que o usuário possui 3 carteiras (1 ativa, 2 inativas)
      QUANDO ele acessa `GET /api/wallets`
      ENTÃO o sistema deve retornar HTTP 200 com as 3 carteiras
      E a carteira ativa deve aparecer primeiro

- [ ] **CA-002**: Carteiras deletadas são omitidas
      DADO que o usuário possui 3 carteiras, sendo 1 com `isDeleted: true`
      QUANDO ele acessa `GET /api/wallets`
      ENTÃO o sistema deve retornar apenas 2 carteiras

- [ ] **CA-003**: Isolamento por usuário
      DADO que existem carteiras de múltiplos usuários no banco
      QUANDO o usuário A acessa `GET /api/wallets`
      ENTÃO ele deve ver apenas suas próprias carteiras

- [ ] **CA-004**: Usuário sem carteiras
      DADO que o usuário não possui nenhuma carteira
      QUANDO ele acessa `GET /api/wallets`
      ENTÃO o sistema deve retornar HTTP 200 com array vazio

### Dependências
- **Bloqueada por**: EP02 (Autenticação), EP03-001 (Criar Carteira — para ter carteiras a listar)
- **Bloqueia**: EP03-002, EP03-003, EP03-004 (dependem da listagem para UI)

### Notas Técnicas

#### Backend

**Rota**: `GET /api/wallets`

**Response 200**:
```json
[
  {
    "_id": "wallet-1",
    "userId": "user-uuid",
    "name": "Longo Prazo",
    "currency": "BRL",
    "isActive": true,
    "isDeleted": false,
    "createdAt": "...",
    "updatedAt": "..."
  },
  {
    "_id": "wallet-2",
    "userId": "user-uuid",
    "name": "Dividendos",
    "currency": "BRL",
    "isActive": false,
    "isDeleted": false,
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

**Wallet DAO** — Método:
- `findByUserId(userId)` — `find({ userId, isDeleted: false }).sort({ isActive: -1, createdAt: 1 }).lean().exec()`

#### Frontend

**Componentes**:
- Consumido por `WalletSelector` e `WalletSettingsPage`
- Estado global armazena lista de carteiras para evitar requisições redundantes
- Revalidação: ao criar, editar, deletar ou ativar carteira

### Cenários de Teste

- **Cenário 1**: Listar 3 carteiras — verificar ordenação (ativa primeiro)
- **Cenário 2**: Verificar que carteiras deletadas são omitidas
- **Cenário 3**: Isolamento — usuário A não vê carteiras do usuário B
- **Cenário 4**: Lista vazia — retorna `[]` com HTTP 200
- **Cenário 5**: Usuário não autenticado — HTTP 401

---

## Resumo das Rotas do Épico

| Método | Rota                           | Story    | Descrição                    |
|--------|-------------------------------|----------|------------------------------|
| GET    | `/api/wallets`                 | EP03-005 | Listar carteiras do usuário  |
| POST   | `/api/wallets`                 | EP03-001 | Criar nova carteira          |
| PUT    | `/api/wallets/:id`             | EP03-004 | Editar carteira              |
| DELETE | `/api/wallets/:id`             | EP03-004 | Soft delete carteira         |
| PUT    | `/api/wallets/:id/activate`    | EP03-002 | Ativar carteira              |
| GET    | `/api/wallets/consolidated`    | EP03-003 | Visão consolidada            |

---

## Estrutura de Arquivos Completa

### Backend

```
src/
├── app/
│   ├── app-constants.js              # + constantes WALLET_*
│   ├── wallet/
│   │   ├── wallet-model.js           # Schema Mongoose da carteira
│   │   ├── wallet-dao.js             # Data Access Object
│   │   ├── wallet-manager.js         # Lógica de negócio
│   │   └── wallet-router.js          # Rotas Express
│   └── ...
└── __tests__/
    └── wallet.test.js                # Testes de integração
```

### Frontend

```
src/
├── components/
│   ├── wallet/
│   │   ├── WalletSelector.vue/tsx    # Dropdown de seleção no header
│   │   ├── CreateWalletModal.vue/tsx  # Modal de criação
│   │   ├── EditWalletModal.vue/tsx    # Modal de edição
│   │   └── DeleteWalletDialog.vue/tsx # Diálogo de confirmação de exclusão
│   └── ...
├── pages/
│   └── WalletSettingsPage.vue/tsx     # Página de configurações de carteiras
├── stores/ (ou context/)
│   └── walletStore.ts                 # Estado global de carteiras
├── services/
│   └── walletService.ts              # Chamadas API para carteiras
└── ...
```

---

## Definição de Pronto (DoD) — Aplicável a todas as Stories do Épico

- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura ≥ 90% (Manager e DAO)
- [ ] Testes de integração passando (rotas com supertest)
- [ ] Testes E2E para fluxos críticos (criar, alternar, deletar)
- [ ] QA aprovado por @qa-analyst
- [ ] Lint passando sem erros (`yarn lint`)
- [ ] Documentação de API atualizada (Swagger/OpenAPI)
- [ ] PR criado por @merge-request
- [ ] Sem regressão em funcionalidades existentes (EP01, EP02)
- [ ] Performance: tempo de resposta das rotas < 200ms (p95)

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|:------------:|:-------:|-----------|
| Condição de corrida ao ativar carteira (2 requisições simultâneas) | Média | Alto | Usar transação MongoDB com session para garantir atomicidade |
| Câmbio indisponível na visão consolidada | Alta (EP06 pode não estar pronto) | Médio | Implementar fallback: exibir valores em moeda original com aviso |
| Soft delete causa inconsistência em carteira ativa | Baixa | Alto | Lógica de auto-ativação testada exaustivamente; constraint no DAO |
| Nome duplicado em requisições concorrentes | Baixa | Baixo | Índice único no MongoDB (`userId + name`) garante consistência |
| Performance da visão consolidada com muitas carteiras/ativos | Baixa | Médio | Cache Redis de 5 min; paginação de ativos se necessário |

---

## Ordem de Implementação Sugerida

```
1. EP03-001 — Criar Carteira (base para tudo)
2. EP03-005 — Listar Carteiras (necessário para UI)
3. EP03-002 — Alternar Carteira Ativa (contexto de dados)
4. EP03-004 — Editar/Excluir Carteira (gestão)
5. EP03-003 — Visão Consolidada (mais complexa, dependência de EP04/EP06)
```

---

*Story pronta para revisão do @architect e planejamento de sprint.*

# EP09 — Importação de PDF (Nota de Corretagem)

---

## Visão Geral do Épico

O Épico 9 permite que o usuário importe transações diretamente a partir de notas de corretagem em PDF. Como cada corretora emite PDFs em formatos distintos, o sistema utiliza um mecanismo de **templates reutilizáveis**: o usuário cria um mapeamento na primeira vez que importa um PDF de determinada corretora, e o sistema reutiliza automaticamente esse template em importações futuras. Antes de persistir, o usuário sempre revisa e confirma os dados extraídos.

**Persona principal**: Investidor que recebe notas de corretagem mensais em PDF e deseja importá-las automaticamente sem transcrição manual.

**Métrica-alvo**: Permitir importação de nota de corretagem completa em < 3 minutos (incluindo revisão), reduzindo erros de digitação manual para zero.

**Dependências do Épico**:
- **Épico 4 (Transações)** — modelo de transação, manager e DAO já implementados
- **Épico 3 (Carteiras)** — carteira ativa deve estar selecionada
- **Épico 2 (Autenticação)** — usuário deve estar autenticado
- **Épico 8 (Importação CSV)** — pode compartilhar componentes de UI (preview, resumo) e infra de upload

---

## STORY EP09-001: Criar Template de Mapeamento para PDF Novo

### [EP09-001] Criar template de extração para formato de nota de corretagem desconhecido

**Como** investidor que recebeu uma nota de corretagem em PDF de uma corretora nova
**Eu quero** mapear os campos do PDF para os campos do sistema e salvar esse mapeamento como template
**Para que** futuras importações do mesmo formato sejam automáticas

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 21 story points (XL)

---

### Contexto

Cada corretora emite notas de corretagem com layouts diferentes. O sistema precisa de um mecanismo flexível que permita ao usuário "ensinar" como ler um formato novo de PDF. O fluxo é:

1. Usuário faz upload do PDF
2. Sistema extrai o texto bruto com `pdf-parse`
3. Sistema verifica se algum template existente reconhece o formato
4. Se nenhum template é compatível, exibe o texto extraído e uma interface de mapeamento
5. Usuário define: nome do template, corretora, e mapeia campos (regex / posição / delimitadores)
6. Sistema salva o template e o aplica ao PDF atual
7. Dados extraídos são exibidos para revisão

O template deve ser flexível o suficiente para cobrir diferentes formatos: tabular, texto corrido com padrões regex, e layouts mistos.

---

### Critérios de Aceite (Verificáveis)

- [ ] **CA-01**: Upload e extração de texto do PDF
      DADO que o usuário está autenticado e possui uma carteira ativa
      QUANDO ele faz upload de um arquivo PDF válido (nota de corretagem)
      ENTÃO o sistema deve extrair o texto bruto do PDF e exibi-lo na interface para visualização

- [ ] **CA-02**: Detecção de formato desconhecido
      DADO que o texto do PDF foi extraído
      QUANDO nenhum template existente do usuário reconhece o formato (nenhum regex de identificação dá match)
      ENTÃO o sistema deve exibir a interface de criação de template com o texto extraído à esquerda e os campos do sistema à direita

- [ ] **CA-03**: Definição de dados do template
      DADO que o usuário está na interface de criação de template
      QUANDO ele preenche o nome do template e o nome da corretora
      ENTÃO esses dados devem ser obrigatórios e validados (nome único por usuário)

- [ ] **CA-04**: Mapeamento de campos via regex
      DADO que o usuário visualiza o texto extraído do PDF
      QUANDO ele seleciona um trecho de texto e associa a um campo do sistema (ticker, data, tipo, quantidade, preço_unitario, taxas)
      ENTÃO o sistema deve gerar automaticamente uma sugestão de regex para capturar esse padrão e permitir que o usuário ajuste manualmente

- [ ] **CA-05**: Definição de regex de identificação do formato
      DADO que o usuário está criando um template
      QUANDO ele define um padrão de identificação (ex: texto fixo que sempre aparece nas notas dessa corretora, como "NOME DA CORRETORA" ou "CNPJ: XX.XXX.XXX/XXXX-XX")
      ENTÃO o sistema deve salvar esse padrão como critério de auto-detecção para futuras importações

- [ ] **CA-06**: Teste do template no PDF atual
      DADO que o usuário finalizou o mapeamento dos campos
      QUANDO ele clica em "Testar Template"
      ENTÃO o sistema deve aplicar o template ao PDF carregado e exibir os dados extraídos em formato de tabela para validação visual

- [ ] **CA-07**: Salvamento do template
      DADO que o usuário testou o template e está satisfeito com o resultado
      QUANDO ele clica em "Salvar Template"
      ENTÃO o template deve ser persistido no banco de dados vinculado ao usuário, e estar disponível para reutilização

- [ ] **CA-08**: Validação de campos obrigatórios no mapeamento
      DADO que o usuário está criando um template
      QUANDO ele tenta salvar sem mapear todos os campos obrigatórios (ticker, data, tipo, quantidade, preço_unitario)
      ENTÃO o sistema deve exibir erro indicando quais campos obrigatórios estão faltando

---

## STORY EP09-002: Reutilizar Template para PDF de Formato Conhecido

### [EP09-002] Auto-detectar formato de PDF e aplicar template existente

**Como** investidor que já importou notas de uma corretora anteriormente
**Eu quero** que o sistema reconheça automaticamente o formato do PDF e aplique o template salvo
**Para que** eu não precise refazer o mapeamento a cada importação

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points (M)

---

### Contexto

Após o primeiro mapeamento (EP09-001), o sistema já possui um template com regex de identificação. Nas importações seguintes, o sistema deve automaticamente:
1. Extrair o texto do PDF
2. Comparar contra todos os templates do usuário (usando o regex de identificação)
3. Se houver match, aplicar o template automaticamente
4. Exibir os dados extraídos para revisão (nunca salvar sem confirmação)

Se múltiplos templates derem match, o sistema apresenta as opções para o usuário escolher.

---

### Critérios de Aceite (Verificáveis)

- [ ] **CA-09**: Auto-detecção de template
      DADO que o usuário faz upload de um PDF
      QUANDO o texto extraído dá match com o regex de identificação de um template existente do usuário
      ENTÃO o sistema deve aplicar automaticamente esse template e exibir os dados extraídos no preview

- [ ] **CA-10**: Múltiplos templates compatíveis
      DADO que o texto extraído do PDF dá match com mais de um template
      QUANDO o sistema detecta ambiguidade
      ENTÃO deve exibir uma lista dos templates compatíveis para que o usuário escolha qual aplicar

- [ ] **CA-11**: Nenhum template compatível
      DADO que o texto extraído do PDF não dá match com nenhum template
      QUANDO o sistema não encontra correspondência
      ENTÃO deve redirecionar o usuário para o fluxo de criação de template (EP09-001, CA-02)

- [ ] **CA-12**: Edição de template existente
      DADO que o usuário está utilizando um template auto-detectado
      QUANDO os dados extraídos não estão corretos (ex: layout da corretora mudou)
      ENTÃO o usuário deve poder editar o template existente (ajustar regex) ou criar um novo template

- [ ] **CA-13**: Listagem e gerenciamento de templates
      DADO que o usuário acessa a página de importação de PDF
      QUANDO ele navega para a seção de templates
      ENTÃO deve visualizar todos os seus templates com: nome, corretora, data de criação, última utilização — podendo editar ou excluir

---

## STORY EP09-003: Validar e Confirmar Dados Antes de Salvar

### [EP09-003] Revisar e confirmar dados extraídos do PDF antes de persistir

**Como** investidor importando uma nota de corretagem
**Eu quero** revisar todos os dados extraídos antes que sejam salvos
**Para que** eu possa corrigir erros de extração e garantir a integridade dos meus dados

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points (M)

---

### Contexto

Independentemente de o template ter sido criado agora ou reutilizado, os dados extraídos do PDF **nunca são salvos automaticamente**. O usuário sempre passa por uma tela de revisão onde pode:
- Visualizar todas as transações extraídas em tabela
- Editar campos individuais inline
- Remover linhas indesejadas
- Ver validações (campos obrigatórios, formatos)
- Confirmar a importação

Este fluxo de confirmação é a última barreira de segurança antes da persistência.

---

### Critérios de Aceite (Verificáveis)

- [ ] **CA-14**: Preview obrigatório antes de salvar
      DADO que o template foi aplicado ao PDF (criado ou auto-detectado)
      QUANDO os dados são extraídos com sucesso
      ENTÃO o sistema DEVE exibir todos os dados em formato de tabela editável e NÃO deve persistir nada automaticamente

- [ ] **CA-15**: Edição inline de campos
      DADO que o usuário está na tela de preview dos dados extraídos
      QUANDO ele clica em um campo de uma linha específica
      ENTÃO deve poder editar o valor diretamente na tabela (ticker, data, tipo, quantidade, preço, taxas)

- [ ] **CA-16**: Remoção de linhas indesejadas
      DADO que o preview exibe transações extraídas do PDF
      QUANDO o usuário identifica linhas incorretas ou indesejadas
      ENTÃO deve poder removê-las individualmente (checkbox + botão remover) antes de confirmar a importação

- [ ] **CA-17**: Validação em tempo real no preview
      DADO que o usuário está editando dados no preview
      QUANDO um campo contém valor inválido (data inválida, quantidade <= 0, ticker vazio, tipo diferente de COMPRA/VENDA)
      ENTÃO o campo deve ser destacado em vermelho com tooltip explicando o erro, e o botão "Confirmar Importação" deve permanecer desabilitado enquanto houver erros

- [ ] **CA-18**: Confirmação e persistência
      DADO que todos os dados do preview estão válidos e o usuário revisou
      QUANDO ele clica em "Confirmar Importação"
      ENTÃO o sistema deve criar transações para cada linha, vinculadas à carteira ativa, e exibir resumo final (total importado, erros)

- [ ] **CA-19**: Detecção de duplicidade no preview
      DADO que os dados extraídos do PDF passam pelo preview
      QUANDO existem transações cujo (ticker + data + quantidade + preço_unitario) já existem na carteira
      ENTÃO o sistema deve marcar essas linhas como duplicadas e oferecer as mesmas opções do EP08 (ignorar, duplicar, substituir)

- [ ] **CA-20**: Cancelamento seguro
      DADO que o usuário está na tela de preview
      QUANDO ele clica em "Cancelar"
      ENTÃO nenhuma transação deve ser persistida, nenhum dado deve ser alterado, e o usuário deve retornar à página de importação

---

## Estrutura de Arquivos (Backend)

```
src/app/import/
├── pdf/
│   ├── pdf-import-router.js        # Rotas: POST /import/pdf, POST /import/pdf/templates, GET /import/pdf/templates, etc.
│   ├── pdf-import-manager.js       # Lógica de extração, aplicação de template, detecção de formato
│   ├── pdf-import-dao.js           # Consultas e persistência de logs de importação
│   ├── pdf-import-model.js         # Schema do log de importação PDF
│   ├── pdf-template-manager.js     # CRUD de templates, lógica de match
│   ├── pdf-template-dao.js         # Persistência de templates
│   └── pdf-template-model.js       # Schema do template de extração
```

### Rotas da API

| Método | Rota                            | Descrição                                            | Auth |
|--------|---------------------------------|------------------------------------------------------|------|
| POST   | `/api/import/pdf`               | Upload de PDF, extrai texto, detecta/aplica template | Sim  |
| POST   | `/api/import/pdf/confirm`       | Confirma importação após revisão do preview          | Sim  |
| POST   | `/api/import/pdf/templates`     | Cria novo template de extração                       | Sim  |
| GET    | `/api/import/pdf/templates`     | Lista templates do usuário                           | Sim  |
| GET    | `/api/import/pdf/templates/:id` | Retorna um template específico                       | Sim  |
| PUT    | `/api/import/pdf/templates/:id` | Atualiza um template existente                       | Sim  |
| DELETE | `/api/import/pdf/templates/:id` | Exclui um template (soft delete)                     | Sim  |
| POST   | `/api/import/pdf/test-template` | Testa um template contra um texto extraído           | Sim  |

### Model: PDF Template (`pdf-template-model.js`)

```javascript
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const fieldMappingSchema = new mongoose.Schema({
  systemField: {
    type: String,
    required: true,
    enum: ['ticker', 'date', 'type', 'quantity', 'unitPrice', 'fees', 'broker', 'notes'],
  },
  regex: { type: String, required: true },        // Regex para capturar o valor
  groupIndex: { type: Number, default: 1 },        // Índice do grupo de captura
  format: { type: String },                        // Formato esperado (ex: 'DD/MM/YYYY' para data)
  transform: { type: String },                     // Transformação opcional (ex: 'parseFloat', 'toUpperCase')
}, { _id: false })

const schema = new mongoose.Schema({
  _id: { type: String, required: true, default: uuidv4 },
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  brokerName: { type: String, required: true },
  identificationPattern: { type: String, required: true }, // Regex para auto-detecção do formato
  fieldMappings: {
    type: [fieldMappingSchema],
    required: true,
    validate: {
      validator: (mappings) => {
        const required = ['ticker', 'date', 'type', 'quantity', 'unitPrice']
        const mapped = mappings.map((m) => m.systemField)
        return required.every((f) => mapped.includes(f))
      },
      message: 'Todos os campos obrigatórios devem estar mapeados: ticker, date, type, quantity, unitPrice',
    },
  },
  rowDelimiter: { type: String, default: '\\n' },    // Delimitador de linhas de transação
  transactionBlockRegex: { type: String },            // Regex para identificar o bloco de transações no PDF
  isActive: { type: Boolean, default: true },
  lastUsedAt: { type: Date },
  usageCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { versionKey: false })

// Índice composto para garantir nome único por usuário
schema.index({ userId: 1, name: 1 }, { unique: true })

module.exports = { schema }
```

### Model: Import Log PDF (`pdf-import-model.js`)

```javascript
const schema = new mongoose.Schema({
  _id: { type: String, required: true, default: uuidv4 },
  userId: { type: String, required: true },
  walletId: { type: String, required: true },
  templateId: { type: String, required: true },
  filename: { type: String, required: true },
  totalTransactions: { type: Number, required: true },
  importedCount: { type: Number, default: 0 },
  ignoredCount: { type: Number, default: 0 },
  replacedCount: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 },
  errors: [{ row: Number, field: String, message: String }],
  status: { type: String, enum: ['PENDING_REVIEW', 'CONFIRMED', 'CANCELLED', 'FAILED'], default: 'PENDING_REVIEW' },
  extractedData: { type: mongoose.Schema.Types.Mixed }, // Dados extraídos antes da confirmação
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false })
```

### Fluxo de Detecção de Template (Manager)

```javascript
async detectTemplate({ userId, extractedText }) {
  const templates = await this.templateDAO.findByUserId(userId)
  const matches = []

  for (const template of templates) {
    const regex = new RegExp(template.identificationPattern, 'i')
    if (regex.test(extractedText)) {
      matches.push(template)
    }
  }

  if (matches.length === 0) return { status: 'NO_MATCH', templates: [] }
  if (matches.length === 1) return { status: 'SINGLE_MATCH', template: matches[0] }
  return { status: 'MULTIPLE_MATCHES', templates: matches }
}
```

### Constantes de Erro (`app-constants.js`)

```javascript
// Erros do módulo de importação PDF
PDF_INVALID_FORMAT: {
  statusCode: 400,
  code: 'PDF_INVALID_FORMAT',
  message: 'Arquivo PDF inválido ou corrompido',
},
PDF_TEXT_EXTRACTION_FAILED: {
  statusCode: 422,
  code: 'PDF_TEXT_EXTRACTION_FAILED',
  message: 'Não foi possível extrair texto do PDF. O arquivo pode ser uma imagem escaneada.',
},
PDF_TEMPLATE_NOT_FOUND: {
  statusCode: 404,
  code: 'PDF_TEMPLATE_NOT_FOUND',
  message: 'Template de extração não encontrado',
},
PDF_TEMPLATE_NAME_EXISTS: {
  statusCode: 409,
  code: 'PDF_TEMPLATE_NAME_EXISTS',
  message: 'Já existe um template com esse nome',
},
PDF_TEMPLATE_INVALID_REGEX: {
  statusCode: 400,
  code: 'PDF_TEMPLATE_INVALID_REGEX',
  message: 'Expressão regular inválida no mapeamento de campos',
},
PDF_TEMPLATE_MISSING_REQUIRED_FIELDS: {
  statusCode: 400,
  code: 'PDF_TEMPLATE_MISSING_REQUIRED_FIELDS',
  message: 'O template deve mapear todos os campos obrigatórios: ticker, data, tipo, quantidade, preço_unitario',
},
PDF_IMPORT_NOT_FOUND: {
  statusCode: 404,
  code: 'PDF_IMPORT_NOT_FOUND',
  message: 'Importação não encontrada ou já confirmada',
},
PDF_NO_TRANSACTIONS_EXTRACTED: {
  statusCode: 422,
  code: 'PDF_NO_TRANSACTIONS_EXTRACTED',
  message: 'Nenhuma transação foi extraída do PDF com o template aplicado',
},
```

---

## Estrutura de Arquivos (Frontend)

```
src/pages/import/
├── pdf/
│   ├── PdfImportPage.vue            # Página principal de importação PDF
│   ├── PdfUploadStep.vue            # Step 1: Upload do arquivo PDF
│   ├── PdfTextViewer.vue            # Visualizador do texto extraído do PDF
│   ├── PdfTemplateCreator.vue       # Interface de criação de template (mapeamento visual)
│   ├── PdfFieldMappingRow.vue       # Componente de mapeamento de um campo (regex + preview)
│   ├── PdfTemplateSelector.vue      # Dialog para escolher entre múltiplos templates compatíveis
│   ├── PdfTemplateList.vue          # Listagem e gerenciamento de templates
│   ├── PdfPreviewStep.vue           # Preview dos dados extraídos (tabela editável)
│   ├── PdfResultSummary.vue         # Resumo final da importação
│   └── pdf-import.service.js        # Chamadas à API de importação PDF
```

### Fluxo de Telas (UX)

```
[1. Upload PDF]
       │
       ▼
[2. Extração de Texto]
       │
       ├── Template detectado ──────────────────────┐
       │   (auto ou seleção entre múltiplos)        │
       │                                            ▼
       ├── Nenhum template ──► [3. Criar Template]  │
       │                            │               │
       │                            ▼               │
       │                    [3a. Testar Template]    │
       │                            │               │
       │                            ▼               │
       │                    [3b. Salvar Template] ───┤
       │                                            │
       ▼◄──────────────────────────────────────────┘
[4. Preview + Edição Inline]
       │
       ├── Duplicidades? ──► Dialog Ignorar/Duplicar/Substituir
       │
       ▼
[5. Confirmar Importação]
       │
       ▼
[6. Resumo Final]
```

### Interface de Criação de Template (Layout)

```
┌─────────────────────────────────────────────────────────────────────┐
│  CRIAR TEMPLATE DE EXTRAÇÃO                                        │
├──────────────────────────────┬──────────────────────────────────────┤
│  TEXTO EXTRAÍDO DO PDF       │  MAPEAMENTO DE CAMPOS               │
│                              │                                      │
│  NOTA DE NEGOCIAÇÃO          │  Nome do Template: [______________]  │
│  CORRETORA XYZ S.A.         │  Corretora: [____________________]   │
│  CNPJ: 12.345.678/0001-90   │                                      │
│  Data: 15/03/2025            │  Padrão de Identificação:            │
│                              │  [CORRETORA XYZ.*CNPJ.*_________]   │
│  NEGÓCIOS REALIZADOS         │                                      │
│  ─────────────────────       │  ── Campos ──────────────────────    │
│  C PETR4  100  28,50  2850   │  Ticker:  regex: [(\w{4}\d{1,2})__] │
│  V VALE3   50  67,30  3365   │  Data:    regex: [(\d{2}/\d{2}/__)  │
│  C ITUB4  200  25,10  5020   │  Tipo:    regex: [(C|V)\s___________│
│                              │  Qtd:     regex: [\d+\s(\d+)________│
│  [Texto selecionável com     │  Preço:   regex: [\d+\s\d+\s(\d+,__)│
│   highlight ao selecionar]   │                                      │
│                              │  [Testar Template]  [Salvar]         │
└──────────────────────────────┴──────────────────────────────────────┘
```

---

## Dependências

- **Bloqueada por**: EP04 (Transações), EP03 (Carteiras), EP02 (Autenticação)
- **Relacionada com**: EP08 (Importação CSV — componentes reutilizáveis de preview, duplicidade e resumo)
- **Bloqueia**: Nenhuma
- **Bibliotecas externas**: `pdf-parse` (extração de texto do PDF), `multer` (upload de arquivos)

---

## Definição de Pronto (DoD)

- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura ≥ 90% (managers, DAOs, lógica de regex, detecção de template)
- [ ] Testes de integração passando (upload → extração → detecção → preview → confirmação)
- [ ] Testes de integração para CRUD completo de templates
- [ ] Testes de integração para auto-detecção de template (single match, multiple match, no match)
- [ ] Testes de edição inline e validação no preview
- [ ] QA aprovado por @qa-analyst
- [ ] Lint passando sem erros (`yarn lint`)
- [ ] Documentação da API atualizada (Swagger/OpenAPI)
- [ ] PR criado por @merge-request

---

## Cenários de Teste

### Backend — Templates

- **Cenário 1**: Criar template com todos os campos obrigatórios mapeados → template salvo com sucesso
- **Cenário 2**: Criar template sem mapear campo "ticker" → erro 400 indicando campo obrigatório faltante
- **Cenário 3**: Criar template com nome duplicado para o mesmo usuário → erro 409
- **Cenário 4**: Criar template com regex inválida → erro 400 com mensagem clara
- **Cenário 5**: Listar templates do usuário → retorna apenas templates do usuário autenticado
- **Cenário 6**: Atualizar template existente → campos atualizados, updatedAt modificado
- **Cenário 7**: Excluir template → soft delete (isActive: false), não aparece mais na listagem
- **Cenário 8**: Testar template contra texto extraído → retorna dados extraídos para validação visual

### Backend — Importação

- **Cenário 9**: Upload de PDF válido → texto extraído com sucesso, retorna texto bruto
- **Cenário 10**: Upload de PDF que é imagem escaneada (sem texto extraível) → erro 422 informando que OCR não é suportado
- **Cenário 11**: Upload de arquivo não-PDF → erro 400
- **Cenário 12**: PDF com template auto-detectado (match único) → retorna dados extraídos + templateId aplicado
- **Cenário 13**: PDF com múltiplos templates compatíveis → retorna lista de templates para escolha
- **Cenário 14**: PDF sem template compatível → retorna status NO_MATCH, texto bruto para criação de template
- **Cenário 15**: Confirmar importação com dados válidos → transações criadas na carteira ativa, log de importação atualizado
- **Cenário 16**: Confirmar importação com dados duplicados → sistema aplica ações de duplicidade escolhidas
- **Cenário 17**: Cancelar importação → nenhuma transação persistida, log marcado como CANCELLED
- **Cenário 18**: Confirmar importação inexistente ou já confirmada → erro 404

### Backend — Segurança

- **Cenário 19**: Usuário A tenta acessar template do Usuário B → erro 404 (template não encontrado para o userId)
- **Cenário 20**: Requisição sem autenticação → erro 401

### Frontend

- **Cenário 21**: Upload de PDF → texto extraído exibido no visualizador com formatação legível
- **Cenário 22**: Seleção de texto no visualizador → regex sugerida automaticamente para o campo selecionado
- **Cenário 23**: Teste de template → dados extraídos exibidos em tabela no painel de preview
- **Cenário 24**: Auto-detecção de template → dados extraídos exibidos diretamente no preview sem intervenção
- **Cenário 25**: Múltiplos templates → dialog de seleção exibido com nome e corretora de cada template
- **Cenário 26**: Edição inline no preview → campo editado, validação em tempo real, botão "Confirmar" reflete estado
- **Cenário 27**: Remoção de linhas no preview → linhas removidas não são importadas
- **Cenário 28**: Cancelamento → nenhuma alteração no banco, retorno à página de importação
- **Cenário 29**: Listagem de templates → exibe todos os templates com opções de editar e excluir
- **Cenário 30**: Resumo final → exibe contadores corretos (importados, ignorados, substituídos, erros)

---

## Notas Técnicas

- **Extração de texto**: Utilizar `pdf-parse` para extrair texto. Importante: esta biblioteca **não faz OCR** — PDFs escaneados como imagem não serão suportados nesta versão. Informar o usuário caso o texto extraído esteja vazio
- **Regex segura**: Antes de salvar qualquer regex do usuário, validar que ela é compilável (`new RegExp(pattern)`) e definir timeout de execução para evitar ReDoS (Regular Expression Denial of Service). Considerar uso de `safe-regex` ou `re2` para validação
- **Performance de detecção**: Para a auto-detecção, carregar todos os templates do usuário em memória (cache Redis com TTL de 5min) e testar regex de identificação sequencialmente. Com <100 templates por usuário, a performance é adequada
- **Dados temporários**: Os dados extraídos antes da confirmação devem ser armazenados temporariamente. Opções: (1) armazenar no campo `extractedData` do import log no MongoDB, ou (2) armazenar no Redis com TTL de 30min. Preferir opção 1 para persistência entre sessões
- **Upload**: Utilizar `multer` com limite de 10MB, aceitar apenas MIME type `application/pdf`
- **Reutilização com EP08**: Os componentes de preview (tabela editável), detecção de duplicidade e resumo final devem ser componentizados para reutilização entre CSV e PDF. Considerar criar componentes compartilhados em `src/pages/import/shared/`
- **Soft delete de templates**: Templates excluídos devem ser marcados como `isActive: false` e filtrados nas queries normais, mas mantidos para auditoria
- **Índices MongoDB**: Criar índice em `{ userId: 1, isActive: 1 }` para queries de listagem de templates, e índice único em `{ userId: 1, name: 1 }` para evitar duplicidade de nomes

# EP08 — Importação CSV de Transações

---

## Visão Geral do Épico

O Épico 8 permite que o usuário importe transações em lote a partir de arquivos CSV, eliminando a necessidade de cadastro manual individual. O sistema deve validar o arquivo, detectar duplicidades, oferecer resolução interativa e persistir os dados como transações válidas vinculadas à carteira ativa.

**Persona principal**: Investidor que possui histórico de operações em planilhas ou exportações de corretoras e deseja migrar para o MoneyTrackr de forma rápida e confiável.

**Métrica-alvo**: Reduzir o tempo de onboarding de novos usuários com histórico existente de ~30min (cadastro manual) para < 2min (importação CSV).

**Dependências do Épico**:
- **Épico 4 (Transações)** — modelo de transação, manager e DAO já implementados
- **Épico 3 (Carteiras)** — carteira ativa deve estar selecionada para vincular as transações importadas
- **Épico 2 (Autenticação)** — usuário deve estar autenticado

---

## STORY EP08-001: Importar Arquivo CSV Válido

### [EP08-001] Importar transações a partir de arquivo CSV

**Como** investidor com histórico de operações em planilhas
**Eu quero** fazer upload de um arquivo CSV e importar as transações para minha carteira
**Para que** eu possa migrar meus dados rapidamente sem cadastro manual

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 13 story points (L)

---

### Contexto

O usuário possui transações registradas em planilhas ou exportações de corretoras no formato CSV. O sistema deve aceitar o upload, parsear o conteúdo, validar as colunas obrigatórias, permitir mapeamento de colunas (caso os nomes não coincidam), exibir um preview dos dados e, após confirmação, persistir como transações vinculadas à carteira ativa.

O backend utiliza a arquitetura em camadas (Router → Manager → DAO → Model) conforme padrão do projeto. O parser CSV será implementado com a biblioteca `csv-parse`.

---

### Critérios de Aceite (Verificáveis)

- [ ] **CA-01**: Upload e parse de CSV válido
      DADO que o usuário está autenticado e possui uma carteira ativa selecionada
      QUANDO ele faz upload de um arquivo CSV com as colunas obrigatórias (ticker, data, tipo, quantidade, preço_unitario)
      ENTÃO o sistema deve parsear o arquivo, exibir um preview com todas as linhas e aguardar confirmação do usuário

- [ ] **CA-02**: Validação de colunas obrigatórias
      DADO que o usuário faz upload de um arquivo CSV
      QUANDO o arquivo não contém todas as colunas obrigatórias (ticker, data, tipo, quantidade, preço_unitario)
      ENTÃO o sistema deve exibir erro claro indicando quais colunas estão faltando e sugerir o download do template

- [ ] **CA-03**: Mapeamento de colunas
      DADO que o usuário faz upload de um CSV com nomes de colunas diferentes do padrão
      QUANDO o sistema detecta colunas não reconhecidas
      ENTÃO deve exibir uma interface de mapeamento onde o usuário associa cada coluna do arquivo a um campo do sistema

- [ ] **CA-04**: Validação de dados por linha
      DADO que o CSV foi parseado com sucesso
      QUANDO existem linhas com dados inválidos (data fora de formato, quantidade negativa, tipo diferente de COMPRA/VENDA, ticker vazio)
      ENTÃO o sistema deve marcar as linhas inválidas em vermelho no preview, exibir o motivo do erro e impedir a importação dessas linhas específicas (permitindo importar as válidas)

- [ ] **CA-05**: Persistência após confirmação
      DADO que o usuário revisou o preview e as linhas válidas
      QUANDO ele confirma a importação
      ENTÃO o sistema deve criar uma transação para cada linha válida, vinculada à carteira ativa, e retornar um resumo (total importado, total ignorado, erros)

- [ ] **CA-06**: Colunas opcionais
      DADO que o CSV contém colunas opcionais (taxas, corretora, observacao)
      QUANDO essas colunas possuem valores válidos
      ENTÃO o sistema deve persistir esses dados nos campos correspondentes da transação

- [ ] **CA-07**: Limite de tamanho de arquivo
      DADO que o usuário tenta fazer upload de um CSV
      QUANDO o arquivo excede 5MB ou possui mais de 10.000 linhas
      ENTÃO o sistema deve rejeitar o upload e informar o limite permitido

---

## STORY EP08-002: Detectar e Resolver Duplicidades na Importação

### [EP08-002] Detectar duplicidades e oferecer resolução ao usuário

**Como** investidor importando transações via CSV
**Eu quero** que o sistema detecte registros duplicados antes de salvar
**Para que** eu não tenha transações repetidas na minha carteira

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points (M)

---

### Contexto

Ao importar um CSV, é comum o usuário importar o mesmo arquivo duas vezes ou importar arquivos com sobreposição parcial de dados. O sistema deve comparar cada linha do CSV com as transações existentes na carteira, utilizando como chave de duplicidade a combinação: **ticker + data + quantidade + preço_unitario**. Quando duplicidades são encontradas, o usuário deve escolher a ação para cada registro ou em lote.

---

### Critérios de Aceite (Verificáveis)

- [ ] **CA-08**: Detecção de duplicidade
      DADO que o CSV foi parseado e validado com sucesso
      QUANDO existem linhas cujo (ticker + data + quantidade + preço_unitario) já existem como transações na carteira ativa
      ENTÃO o sistema deve marcar essas linhas como "duplicadas" no preview, destacando-as visualmente (cor amarela/ícone de alerta)

- [ ] **CA-09**: Ação "Ignorar" duplicidade
      DADO que o usuário visualiza registros duplicados no preview
      QUANDO ele seleciona a ação "Ignorar" para um ou mais registros
      ENTÃO o sistema não deve criar novas transações para esses registros e deve incluí-los no resumo como "ignorados"

- [ ] **CA-10**: Ação "Duplicar" registro
      DADO que o usuário visualiza registros duplicados no preview
      QUANDO ele seleciona a ação "Duplicar" para um ou mais registros
      ENTÃO o sistema deve criar novas transações mesmo que já existam registros idênticos, e incluí-los no resumo como "duplicados intencionalmente"

- [ ] **CA-11**: Ação "Substituir" registro
      DADO que o usuário visualiza registros duplicados no preview
      QUANDO ele seleciona a ação "Substituir" para um ou mais registros
      ENTÃO o sistema deve atualizar a transação existente com os dados da linha do CSV (mantendo o _id original) e incluí-los no resumo como "substituídos"

- [ ] **CA-12**: Ação em lote
      DADO que existem múltiplos registros duplicados
      QUANDO o usuário seleciona "Aplicar a todos" com uma ação (Ignorar/Duplicar/Substituir)
      ENTÃO o sistema deve aplicar a mesma ação para todos os registros duplicados pendentes

- [ ] **CA-13**: Resumo final da importação
      DADO que a importação foi concluída (com ou sem duplicidades)
      QUANDO o processo termina
      ENTÃO o sistema deve exibir um resumo contendo: total de linhas no arquivo, total importadas com sucesso, total ignoradas (duplicadas), total substituídas, total com erro de validação

---

## STORY EP08-003: Disponibilizar Template CSV para Download

### [EP08-003] Fornecer template CSV para download

**Como** investidor que deseja importar transações
**Eu quero** baixar um modelo de CSV com as colunas corretas e exemplos
**Para que** eu saiba exatamente como formatar meu arquivo antes de importar

**Tipo**: Feature
**Prioridade**: Should Have
**Estimativa**: 2 story points (XS)

---

### Contexto

O template serve como referência para o usuário montar seu arquivo CSV corretamente. Deve conter o cabeçalho com todas as colunas (obrigatórias e opcionais) e 2-3 linhas de exemplo com dados fictícios ilustrando o formato esperado. O arquivo deve usar codificação UTF-8 com BOM para compatibilidade com Excel.

---

### Critérios de Aceite (Verificáveis)

- [ ] **CA-14**: Download do template
      DADO que o usuário está na página de importação CSV
      QUANDO ele clica no botão "Baixar Template"
      ENTÃO o sistema deve retornar um arquivo CSV com codificação UTF-8 BOM, contendo cabeçalho e 2-3 linhas de exemplo

- [ ] **CA-15**: Conteúdo do template
      DADO que o usuário abriu o template CSV baixado
      QUANDO ele visualiza o conteúdo
      ENTÃO deve encontrar as colunas: ticker, data, tipo, quantidade, preco_unitario, taxas, corretora, observacao — com linhas de exemplo preenchidas e comentários explicativos

- [ ] **CA-16**: Compatibilidade com Excel
      DADO que o usuário abre o template CSV no Microsoft Excel
      QUANDO o arquivo é carregado
      ENTÃO as colunas devem estar corretamente separadas e caracteres acentuados devem ser exibidos corretamente (UTF-8 BOM)

---

## Estrutura de Arquivos (Backend)

```
src/app/import/
├── csv/
│   ├── csv-import-router.js       # Rotas: POST /import/csv, GET /import/csv/template
│   ├── csv-import-manager.js      # Lógica de parse, validação, detecção de duplicidade
│   ├── csv-import-dao.js          # Consultas de duplicidade, inserção em lote
│   ├── csv-import-model.js        # Schema do log de importação
│   └── csv-template.js            # Geração do template CSV
```

### Rotas da API

| Método | Rota                      | Descrição                                         | Auth |
|--------|---------------------------|----------------------------------------------------|------|
| POST   | `/api/import/csv`         | Upload e importação de CSV                         | Sim  |
| GET    | `/api/import/csv/template`| Download do template CSV                           | Sim  |

### Model: Import Log (`csv-import-model.js`)

```javascript
const schema = new mongoose.Schema({
  _id: { type: String, required: true, default: uuidv4 },
  userId: { type: String, required: true },
  walletId: { type: String, required: true },
  filename: { type: String, required: true },
  totalRows: { type: Number, required: true },
  importedCount: { type: Number, default: 0 },
  ignoredCount: { type: Number, default: 0 },
  replacedCount: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 },
  errors: [{ row: Number, field: String, message: String }],
  status: { type: String, enum: ['PROCESSING', 'COMPLETED', 'FAILED'], default: 'PROCESSING' },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false })
```

### Fluxo de Duplicidade (Manager)

```javascript
// Chave de duplicidade: ticker + data + quantidade + preço_unitario
async detectDuplicates({ walletId, rows }) {
  const duplicates = []
  for (const row of rows) {
    const existing = await this.transactionDAO.findOne({
      walletId,
      ticker: row.ticker,
      date: row.date,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
    })
    if (existing) {
      duplicates.push({ row, existingTransaction: existing })
    }
  }
  return duplicates
}
```

### Constantes de Erro (`app-constants.js`)

```javascript
// Erros do módulo de importação CSV
CSV_INVALID_FORMAT: {
  statusCode: 400,
  code: 'CSV_INVALID_FORMAT',
  message: 'Formato do arquivo CSV inválido',
},
CSV_MISSING_COLUMNS: {
  statusCode: 400,
  code: 'CSV_MISSING_COLUMNS',
  message: 'Colunas obrigatórias ausentes no CSV',
},
CSV_FILE_TOO_LARGE: {
  statusCode: 413,
  code: 'CSV_FILE_TOO_LARGE',
  message: 'Arquivo CSV excede o tamanho máximo permitido (5MB / 10.000 linhas)',
},
CSV_NO_VALID_ROWS: {
  statusCode: 400,
  code: 'CSV_NO_VALID_ROWS',
  message: 'Nenhuma linha válida encontrada no CSV',
},
WALLET_NOT_SELECTED: {
  statusCode: 400,
  code: 'WALLET_NOT_SELECTED',
  message: 'Nenhuma carteira ativa selecionada',
},
```

---

## Estrutura de Arquivos (Frontend)

```
src/pages/import/
├── csv/
│   ├── CsvImportPage.vue           # Página principal de importação CSV
│   ├── CsvUploadStep.vue           # Step 1: Upload do arquivo
│   ├── CsvColumnMappingStep.vue    # Step 2: Mapeamento de colunas
│   ├── CsvPreviewStep.vue          # Step 3: Preview e resolução de duplicidades
│   ├── CsvDuplicateDialog.vue      # Dialog de resolução de duplicidade
│   ├── CsvResultSummary.vue        # Step 4: Resumo final da importação
│   └── csv-import.service.js       # Chamadas à API de importação
```

### Fluxo de Telas (UX)

```
[1. Upload]  →  [2. Mapeamento de Colunas]  →  [3. Preview + Duplicidades]  →  [4. Resumo]
     │                    │                              │                            │
     ▼                    ▼                              ▼                            ▼
  Drag & drop       Associar colunas            Tabela com linhas            Total importado
  ou seleção        do CSV aos campos           válidas, inválidas           Total ignorado
  de arquivo        do sistema                  e duplicadas                 Total com erro
                    (auto-detect +                   │                       Botão "Ver transações"
                     manual)                         ▼
                                              Dialog de resolução:
                                              Ignorar / Duplicar / Substituir
                                              (individual ou em lote)
```

---

## Dependências

- **Bloqueada por**: EP04 (Transações — model e DAO de transações devem existir), EP03 (Carteiras — carteira ativa)
- **Bloqueia**: Nenhuma (feature independente após transações)
- **Bibliotecas externas**: `csv-parse` (parser CSV), `multer` (upload de arquivos)

---

## Definição de Pronto (DoD)

- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura ≥ 90% (manager, DAO, validação)
- [ ] Testes de integração passando (upload → parse → validação → persistência)
- [ ] Testes de integração para fluxo de duplicidade (ignorar, duplicar, substituir)
- [ ] QA aprovado por @qa-analyst
- [ ] Lint passando sem erros (`yarn lint`)
- [ ] Documentação da API atualizada (Swagger/OpenAPI)
- [ ] PR criado por @merge-request

---

## Cenários de Teste

### Backend

- **Cenário 1**: Upload de CSV válido com 5 colunas obrigatórias → parse bem-sucedido, retorna preview com dados
- **Cenário 2**: Upload de CSV faltando coluna "ticker" → retorna erro 400 com mensagem indicando coluna faltante
- **Cenário 3**: CSV com 3 linhas válidas e 2 inválidas (data inválida, quantidade negativa) → preview marca 2 linhas com erro, permite importar as 3 válidas
- **Cenário 4**: CSV com registros que já existem na carteira → detecção de duplicidade, preview marca linhas amarelas
- **Cenário 5**: Ação "Ignorar" em duplicidade → transação não é criada, contabilizada como ignorada no resumo
- **Cenário 6**: Ação "Substituir" em duplicidade → transação existente é atualizada, contabilizada como substituída
- **Cenário 7**: Ação "Duplicar" em duplicidade → nova transação é criada mesmo com registro existente
- **Cenário 8**: Ação em lote "Aplicar a todos: Ignorar" → todas as duplicidades são ignoradas de uma vez
- **Cenário 9**: Upload de arquivo > 5MB → retorna erro 413
- **Cenário 10**: Upload de arquivo com > 10.000 linhas → retorna erro 400
- **Cenário 11**: Download do template → retorna CSV UTF-8 BOM com cabeçalho e exemplos
- **Cenário 12**: CSV com colunas nomeadas diferente do padrão (ex: "ativo" em vez de "ticker") → exibe tela de mapeamento
- **Cenário 13**: Importação sem carteira ativa selecionada → retorna erro 400
- **Cenário 14**: CSV com colunas opcionais (taxas, corretora) → dados opcionais persistidos corretamente
- **Cenário 15**: CSV vazio (apenas cabeçalho, sem dados) → retorna erro informando que não há dados para importar

### Frontend

- **Cenário 16**: Drag and drop de arquivo CSV → preview exibido corretamente
- **Cenário 17**: Mapeamento manual de colunas → campos associados corretamente
- **Cenário 18**: Auto-detecção de colunas (nomes exatos) → mapeamento preenchido automaticamente
- **Cenário 19**: Dialog de duplicidade → ações individuais e em lote funcionam corretamente
- **Cenário 20**: Resumo final exibe contadores corretos após importação mista (importados + ignorados + erros)

---

## Notas Técnicas

- **Parser CSV**: Utilizar `csv-parse` com opções: `{ columns: true, skip_empty_lines: true, trim: true, bom: true }`
- **Upload**: Utilizar `multer` com limite de 5MB, aceitar apenas MIME types `text/csv` e `application/vnd.ms-excel`
- **Encoding**: Detectar encoding do arquivo (UTF-8, Latin-1, Windows-1252) e converter para UTF-8 antes do parse. Considerar uso de `chardet` ou `iconv-lite`
- **Validação de data**: Aceitar formatos DD/MM/YYYY, YYYY-MM-DD e MM/DD/YYYY — normalizar para ISO 8601 antes de persistir
- **Performance**: Para CSVs grandes (próximo do limite de 10.000 linhas), utilizar streams no parser em vez de carregar tudo em memória. Inserção em lote via `insertMany()` do Mongoose
- **Duplicidade**: A query de detecção deve usar índice composto em `{ walletId, ticker, date, quantity, unitPrice }` para performance
- **Template**: O template deve ser gerado dinamicamente no backend (não um arquivo estático) para facilitar manutenção e versionamento das colunas
- **Separador**: Detectar automaticamente o separador (vírgula, ponto-e-vírgula, tab) no upload — corretoras brasileiras costumam usar ponto-e-vírgula

# Plano Técnico - EP08: Importação CSV de Transações

> **Épico**: 08 — Importação CSV de Transações
> **Versão**: 1.0
> **Data**: 2026-03-27
> **Autor**: @architect

---

## 1. Visão Geral da Arquitetura

### 1.1 Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    FRONTEND (PWA)                                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────────────┐│
│  │                         CsvImportPage                                           ││
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌─────────────────┐  ││
│  │  │ CsvUploadStep │  │ CsvColumnMap  │  │ CsvPreviewStep │  │ CsvResultSummary│  ││
│  │  │ (Drag & Drop) │  │ pingStep      │  │ + Duplicates   │  │                 │  ││
│  │  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └────────┬────────┘  ││
│  │          │                  │                  │                    │           ││
│  │          └──────────────────┼──────────────────┼────────────────────┘           ││
│  │                             │                  │                                ││
│  │                   ┌─────────▼─────────┐        │                                ││
│  │                   │ csv-import.       │        │                                ││
│  │                   │ service.js        │        │                                ││
│  │                   └─────────┬─────────┘        │                                ││
│  └─────────────────────────────┼──────────────────┼────────────────────────────────┘│
│                                │                  │                                 │
│                    ┌───────────▼───────────┐      │                                 │
│                    │  Store (Pinia/Vuex)   │      │                                 │
│                    │  - uploadProgress     │      │                                 │
│                    │  - parsedData         │      │                                 │
│                    │  - duplicates        │      │                                 │
│                    └──────────────────────┘      │                                 │
└───────────────────────────────────────────────────┼─────────────────────────────────┘
                                                    │
                                                    │ HTTP/REST + multipart/form-data
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    BACKEND (Node.js)                                │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                              ROUTER LAYER                                    │   │
│  │  CsvImportRouter                                                             │   │
│  │  - POST   /v1/public/import/csv              (upload + parse)               │   │
│  │  - POST   /v1/public/import/csv/confirm      (confirma importação)          │   │
│  │  - GET    /v1/public/import/csv/template     (download template)            │   │
│  └─────────────────────────────────────┬───────────────────────────────────────┘   │
│                                        │                                            │
│  ┌─────────────────────────────────────▼───────────────────────────────────────┐   │
│  │                              MANAGER LAYER                                   │   │
│  │  CsvImportManager                                                            │   │
│  │  - parseCSV()           → csv-parse library                                 │   │
│  │  - validateRows()       → validação por linha                               │   │
│  │  - detectDuplicates()   → compara com transações existentes                 │   │
│  │  - confirmImport()      → persiste transações                                │   │
│  └──────────┬────────────────────────────────────────────────────────┬──────────┘   │
│             │                                                        │              │
│  ┌──────────▼──────────┐                    ┌────────────────────────▼──────────┐   │
│  │    DAO LAYER        │                    │      TRANSACTION DAO              │   │
│  │  CsvImportDAO       │                    │  (EP04 - já existente)            │   │
│  │  - createLog        │                    │  - bulkInsert                     │   │
│  │  - updateLog        │                    │  - findByDuplicateKey             │   │
│  │  - findLogById      │                    │                                   │   │
│  └──────────┬──────────┘                    └───────────────────────────────────┘   │
│             │                                                                        │
│  ┌──────────▼──────────────────────────────────────────────────────────────────┐   │
│  │                              PARSER LAYER                                    │   │
│  │  CsvParser (csv-parse)                                                       │   │
│  │  - Detecta encoding (UTF-8, Latin-1, Windows-1252)                         │   │
│  │  - Detecta separador (vírgula, ponto-e-vírgula, tab)                       │   │
│  │  - Normaliza dados                                                          │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                              TEMPLATE LAYER                                  │   │
│  │  CsvTemplateGenerator                                                        │   │
│  │  - Gera template dinamicamente                                              │   │
│  │  - UTF-8 BOM para compatibilidade Excel                                      │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    DATA LAYER                                       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────┐     ┌─────────────────────────────┐                 │
│  │        MongoDB              │     │     File Storage            │                 │
│  │  Collection: csvImportLogs  │     │  (temp uploads - multer)    │                 │
│  │  Collection: transactions   │     │  Max: 5MB                   │                 │
│  └─────────────────────────────┘     └─────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Fluxo de Importação CSV

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           FLUXO DE IMPORTAÇÃO CSV                                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│   ┌─────────────────┐                                                              │
│   │ 1. UPLOAD       │                                                              │
│   │    Arquivo CSV  │                                                              │
│   │    (max 5MB)    │                                                              │
│   └────────┬────────┘                                                              │
│            │                                                                        │
│            ▼                                                                        │
│   ┌─────────────────┐                                                              │
│   │ 2. PARSE        │                                                              │
│   │    Detectar     │                                                              │
│   │    encoding     │                                                              │
│   │    separador    │                                                              │
│   └────────┬────────┘                                                              │
│            │                                                                        │
│            ▼                                                                        │
│   ┌─────────────────┐     ┌─────────────────┐                                      │
│   │ 3. VALIDAÇÃO    │────►│ Colunas faltando?│──Sim──► ERRO 400                   │
│   │    Colunas      │     └─────────────────┘                                      │
│   │    obrigatórias │                                                              │
│   └────────┬────────┘                                                              │
│            │ Não                                                                    │
│            ▼                                                                        │
│   ┌─────────────────┐     ┌─────────────────┐                                      │
│   │ 4. MAPEAMENTO   │────►│ Nomes diferentes?│──Sim──► Interface de mapeamento    │
│   │    de colunas   │     └─────────────────┘                                      │
│   │    (se necessário)                                                            │
│   └────────┬────────┘                                                              │
│            │                                                                        │
│            ▼                                                                        │
│   ┌─────────────────┐     ┌─────────────────┐                                      │
│   │ 5. VALIDAÇÃO    │────►│ Linhas inválidas│──► Marcar em vermelho               │
│   │    por linha    │     │ (data, qtd, etc)│     Permitir importar válidas       │
│   └────────┬────────┘     └─────────────────┘                                      │
│            │                                                                        │
│            ▼                                                                        │
│   ┌─────────────────┐     ┌─────────────────┐                                      │
│   │ 6. DETECÇÃO      │────►│ Duplicidades   │──► Marcar em amarelo                │
│   │    DUPLICIDADES  │     │ encontradas    │     Oferecer ações                   │
│   └────────┬────────┘     └─────────────────┘                                      │
│            │                                                                        │
│            ▼                                                                        │
│   ┌─────────────────┐                                                              │
│   │ 7. PREVIEW      │                                                              │
│   │    Tabela com:  │                                                              │
│   │    - Válidas    │                                                              │
│   │    - Inválidas  │                                                              │
│   │    - Duplicadas │                                                              │
│   └────────┬────────┘                                                              │
│            │                                                                        │
│            ▼                                                                        │
│   ┌─────────────────┐                                                              │
│   │ 8. RESOLUÇÃO     │                                                              │
│   │    de duplic.   │                                                              │
│   │    Ignorar/      │                                                              │
│   │    Duplicar/     │                                                              │
│   │    Substituir    │                                                              │
│   └────────┬────────┘                                                              │
│            │                                                                        │
│            ▼                                                                        │
│   ┌─────────────────┐                                                              │
│   │ 9. CONFIRMAÇÃO   │                                                              │
│   │    Persistir     │                                                              │
│   │    transações    │                                                              │
│   └────────┬────────┘                                                              │
│            │                                                                        │
│            ▼                                                                        │
│   ┌─────────────────┐                                                              │
│   │ 10. RESUMO       │                                                              │
│   │     Importados   │                                                              │
│   │     Ignorados    │                                                              │
│   │     Substituídos │                                                              │
│   │     Erros        │                                                              │
│   └─────────────────┘                                                              │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Componentes Backend

### 2.1 Models (Mongoose Schemas)

#### `src/app/import/csv/csv-import-model.js`

```javascript
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const csvImportLogSchema = new mongoose.Schema({
  _id: { 
    type: String, 
    required: true, 
    default: uuidv4 
  },
  userId: { 
    type: String, 
    required: true,
    index: true,
  },
  walletId: { 
    type: String, 
    required: true,
    index: true,
  },
  filename: { 
    type: String, 
    required: true 
  },
  totalRows: { 
    type: Number, 
    required: true 
  },
  importedCount: { 
    type: Number, 
    default: 0 
  },
  ignoredCount: { 
    type: Number, 
    default: 0 
  },
  replacedCount: { 
    type: Number, 
    default: 0 
  },
  errorCount: { 
    type: Number, 
    default: 0 
  },
  errors: [{
    row: { type: Number },
    field: { type: String },
    message: { type: String },
  }],
  status: {
    type: String,
    enum: ['PROCESSING', 'PENDING_CONFIRMATION', 'COMPLETED', 'FAILED', 'CANCELLED'],
    default: 'PROCESSING',
  },
  parsedData: { 
    type: mongoose.Schema.Types.Mixed 
  }, // Dados parseados antes da confirmação
  columnMapping: { 
    type: mongoose.Schema.Types.Mixed 
  }, // Mapeamento de colunas usado
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  completedAt: { 
    type: Date 
  },
}, { 
  versionKey: false 
})

csvImportLogSchema.index({ userId: 1, createdAt: -1 })

module.exports = { csvImportLogSchema }
```

### 2.2 DAOs

#### `src/app/import/csv/csv-import-dao.js`

```javascript
const AppDAO = require('../../app-dao')
const { csvImportLogSchema } = require('./csv-import-model')

class CsvImportDAO extends AppDAO {
  constructor(db) {
    super(db)
  }

  initializeDBModel(db) {
    return db.model('csvImportLog', csvImportLogSchema)
  }

  /**
   * Cria log de importação
   */
  async createLog(data) {
    const log = new this.objectModel(data)
    return await log.save().then((doc) => doc.toObject())
  }

  /**
   * Atualiza log
   */
  async updateLog(id, data) {
    return await this.objectModel.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true }
    ).lean().exec()
  }

  /**
   * Busca log por ID
   */
  async findLogById(id, userId) {
    return await this.objectModel.findOne({
      _id: id,
      userId,
    }).lean().exec()
  }

  /**
   * Lista logs do usuário
   */
  async findByUser(userId, limit = 10) {
    return await this.objectModel.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean().exec()
  }
}

module.exports = CsvImportDAO
```

### 2.3 Managers

#### `src/app/import/csv/csv-import-manager.js`

```javascript
const CsvImportDAO = require('./csv-import-dao')
const CsvParser = require('./csv-parser')
const CsvTemplateGenerator = require('./csv-template')
const APP_CONSTANTS = require('../../app-constants')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../../app-constants')

const logger = new JsonLog(SERVICE_NAME)

// Mapeamento padrão de colunas
const DEFAULT_COLUMN_MAPPING = {
  ticker: ['ticker', 'ativo', 'codigo', 'symbol'],
  date: ['data', 'date', 'data_operacao', 'dt_operacao'],
  type: ['tipo', 'type', 'operacao', 'tipo_operacao', 'cv'],
  quantity: ['quantidade', 'quantity', 'qtd', 'qtde'],
  unitPrice: ['preco_unitario', 'preco', 'price', 'valor_unitario', 'pm'],
  fees: ['taxas', 'fees', 'corretagem', 'taxa'],
  broker: ['corretora', 'broker', 'instituicao'],
  notes: ['observacao', 'notes', 'obs'],
}

class CsvImportManager {
  constructor(appManager, appDB) {
    this.appDB = appDB
    this.config = appManager.config
    this.handleError = appManager.handleError.bind(appManager)
    
    this.csvImportDAO = new CsvImportDAO(this.appDB.getDb())
    this.transactionDAO = appManager.getTransactionDAO() // EP04
    this.parser = new CsvParser()
    this.templateGenerator = new CsvTemplateGenerator()
  }

  /**
   * Parse e valida arquivo CSV
   */
  async parseCSV({ domain, walletId, file, columnMapping = null }) {
    // Verifica se carteira pertence ao usuário
    const walletBelongsToUser = await this._verifyWallet(walletId, domain)
    if (!walletBelongsToUser) {
      this.handleError(APP_CONSTANTS.ERRORS.WALLET_NOT_FOUND)
    }

    // Cria log de importação
    const log = await this.csvImportDAO.createLog({
      userId: domain,
      walletId,
      filename: file.originalname,
      totalRows: 0,
      status: 'PROCESSING',
    })

    try {
      // Parse do CSV
      const parseResult = await this.parser.parse(file.buffer)

      if (!parseResult.rows || parseResult.rows.length === 0) {
        await this.csvImportDAO.updateLog(log._id, {
          status: 'FAILED',
          errorCount: 1,
          errors: [{ row: 0, message: 'Arquivo CSV vazio ou sem dados' }],
        })
        this.handleError(APP_CONSTANTS.ERRORS.CSV_NO_VALID_ROWS)
      }

      // Detecta mapeamento de colunas
      const detectedMapping = columnMapping || this._detectColumnMapping(parseResult.headers)

      // Valida colunas obrigatórias
      const requiredColumns = ['ticker', 'date', 'type', 'quantity', 'unitPrice']
      const missingColumns = requiredColumns.filter((col) => !detectedMapping[col])
      
      if (missingColumns.length > 0) {
        await this.csvImportDAO.updateLog(log._id, {
          status: 'FAILED',
          errorCount: 1,
          errors: [{ 
            row: 0, 
            message: `Colunas obrigatórias não encontradas: ${missingColumns.join(', ')}` 
          }],
        })
        this.handleError(APP_CONSTANTS.ERRORS.CSV_MISSING_COLUMNS)
      }

      // Mapeia e valida cada linha
      const { validRows, invalidRows, columnMappingNeeded } = this._mapAndValidateRows(
        parseResult.rows,
        detectedMapping
      )

      // Detecta duplicidades
      const duplicates = await this._detectDuplicates(walletId, validRows)

      // Atualiza log
      await this.csvImportDAO.updateLog(log._id, {
        totalRows: parseResult.rows.length,
        parsedData: {
          validRows,
          invalidRows,
          duplicates,
        },
        columnMapping: detectedMapping,
        status: 'PENDING_CONFIRMATION',
      })

      logger.log('CSV parsed successfully', {
        domain,
        internal: { method: 'parseCSV', filename: 'csv-import-manager.js' },
        metadata: { 
          logId: log._id, 
          totalRows: parseResult.rows.length,
          validRows: validRows.length,
          invalidRows: invalidRows.length,
          duplicates: duplicates.length,
        },
      })

      return {
        logId: log._id,
        totalRows: parseResult.rows.length,
        validRows: validRows.length,
        invalidRows,
        duplicates,
        columnMapping: detectedMapping,
        columnMappingNeeded,
        headers: parseResult.headers,
      }
    } catch (error) {
      await this.csvImportDAO.updateLog(log._id, {
        status: 'FAILED',
        errorCount: 1,
        errors: [{ row: 0, message: error.message }],
      })
      throw error
    }
  }

  /**
   * Confirma importação
   */
  async confirmImport({ domain, logId, duplicateActions }) {
    const log = await this.csvImportDAO.findLogById(logId, domain)

    if (!log) {
      this.handleError(APP_CONSTANTS.ERRORS.CSV_IMPORT_NOT_FOUND)
    }

    if (log.status !== 'PENDING_CONFIRMATION') {
      this.handleError(APP_CONSTANTS.ERRORS.CSV_IMPORT_ALREADY_PROCESSED)
    }

    const { validRows, duplicates } = log.parsedData
    const transactions = []
    const stats = {
      imported: 0,
      ignored: 0,
      replaced: 0,
      errors: 0,
    }

    // Processa ações de duplicidade
    const duplicateMap = new Map(
      (duplicateActions || []).map((action) => [action.rowIndex, action.action])
    )

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i]
      const duplicate = duplicates.find((d) => d.rowIndex === i)

      if (duplicate) {
        const action = duplicateMap.get(i) || 'IGNORE'

        if (action === 'IGNORE') {
          stats.ignored++
          continue
        }

        if (action === 'REPLACE') {
          // Atualiza transação existente
          await this.transactionDAO.update(duplicate.existingTransaction._id, {
            quantity: row.quantity,
            unitPrice: row.unitPrice,
            fees: row.fees || 0,
            broker: row.broker,
            notes: row.notes,
          })
          stats.replaced++
          continue
        }

        // action === 'DUPLICATE' - cria nova mesmo existindo
      }

      // Cria nova transação
      transactions.push({
        walletId: log.walletId,
        userId: domain,
        ticker: row.ticker.toUpperCase(),
        date: new Date(row.date),
        type: row.type.toUpperCase(),
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        fees: row.fees || 0,
        broker: row.broker || '',
        notes: row.notes || '',
      })
      stats.imported++
    }

    // Bulk insert
    if (transactions.length > 0) {
      await this.transactionDAO.bulkInsert(transactions)
    }

    // Atualiza log final
    await this.csvImportDAO.updateLog(log._id, {
      importedCount: stats.imported,
      ignoredCount: stats.ignored,
      replacedCount: stats.replaced,
      errorCount: stats.errors,
      status: 'COMPLETED',
      completedAt: new Date(),
    })

    logger.log('CSV import completed', {
      domain,
      internal: { method: 'confirmImport', filename: 'csv-import-manager.js' },
      metadata: { logId, stats },
    })

    return {
      success: true,
      stats,
      logId,
    }
  }

  /**
   * Gera template CSV
   */
  async generateTemplate() {
    return this.templateGenerator.generate()
  }

  /**
   * Detecta mapeamento de colunas automaticamente
   */
  _detectColumnMapping(headers) {
    const mapping = {}
    const normalizedHeaders = headers.map((h) => h.toLowerCase().trim())

    for (const [field, aliases] of Object.entries(DEFAULT_COLUMN_MAPPING)) {
      for (const alias of aliases) {
        const index = normalizedHeaders.indexOf(alias.toLowerCase())
        if (index !== -1) {
          mapping[field] = headers[index]
          break
        }
      }
    }

    return mapping
  }

  /**
   * Mapeia e valida linhas
   */
  _mapAndValidateRows(rows, columnMapping) {
    const validRows = []
    const invalidRows = []
    const columnMappingNeeded = Object.keys(columnMapping).length < 5

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const errors = []

      // Mapeia valores
      const mappedRow = {
        ticker: row[columnMapping.ticker] || '',
        date: row[columnMapping.date] || '',
        type: row[columnMapping.type] || '',
        quantity: parseFloat(row[columnMapping.quantity]) || 0,
        unitPrice: parseFloat(row[columnMapping.unitPrice?.replace(',', '.')]) || 0,
        fees: parseFloat(row[columnMapping.fees?.replace(',', '.')]) || 0,
        broker: row[columnMapping.broker] || '',
        notes: row[columnMapping.notes] || '',
      }

      // Validações
      if (!mappedRow.ticker || mappedRow.ticker.trim() === '') {
        errors.push({ field: 'ticker', message: 'Ticker é obrigatório' })
      }

      if (!mappedRow.date || !this._isValidDate(mappedRow.date)) {
        errors.push({ field: 'date', message: 'Data inválida' })
      }

      if (!['COMPRA', 'VENDA', 'C', 'V'].includes(mappedRow.type.toUpperCase())) {
        errors.push({ field: 'type', message: 'Tipo deve ser COMPRA ou VENDA' })
      }

      if (mappedRow.quantity <= 0) {
        errors.push({ field: 'quantity', message: 'Quantidade deve ser maior que zero' })
      }

      if (mappedRow.unitPrice <= 0) {
        errors.push({ field: 'unitPrice', message: 'Preço unitário deve ser maior que zero' })
      }

      // Normaliza tipo
      if (mappedRow.type.toUpperCase() === 'C') mappedRow.type = 'COMPRA'
      if (mappedRow.type.toUpperCase() === 'V') mappedRow.type = 'VENDA'

      if (errors.length > 0) {
        invalidRows.push({
          rowIndex: i + 2, // +2 porque linha 1 é header
          row: mappedRow,
          errors,
        })
      } else {
        validRows.push({
          rowIndex: i + 2,
          ...mappedRow,
          date: this._normalizeDate(mappedRow.date),
        })
      }
    }

    return { validRows, invalidRows, columnMappingNeeded }
  }

  /**
   * Detecta duplicidades
   */
  async _detectDuplicates(walletId, validRows) {
    const duplicates = []

    for (const row of validRows) {
      const existing = await this.transactionDAO.findByDuplicateKey({
        walletId,
        ticker: row.ticker,
        date: new Date(row.date),
        quantity: row.quantity,
        unitPrice: row.unitPrice,
      })

      if (existing) {
        duplicates.push({
          rowIndex: row.rowIndex,
          row,
          existingTransaction: existing,
        })
      }
    }

    return duplicates
  }

  /**
   * Valida formato de data
   */
  _isValidDate(dateStr) {
    const formats = [
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
      /^\d{2}-\d{2}-\d{4}$/, // DD-MM-YYYY
    ]

    return formats.some((regex) => regex.test(dateStr))
  }

  /**
   * Normaliza data para ISO
   */
  _normalizeDate(dateStr) {
    // DD/MM/YYYY -> YYYY-MM-DD
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split('/')
      return `${year}-${month}-${day}`
    }

    // DD-MM-YYYY -> YYYY-MM-DD
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split('-')
      return `${year}-${month}-${day}`
    }

    return dateStr
  }

  /**
   * Verifica se carteira pertence ao usuário
   */
  async _verifyWallet(walletId, userId) {
    // Usa o walletManager do EP03
    return true // TODO: implementar verificação real
  }
}

module.exports = CsvImportManager
```

#### `src/app/import/csv/csv-parser.js`

```javascript
const { parse } = require('csv-parse/sync')
const chardet = require('chardet')
const iconv = require('iconv-lite')

class CsvParser {
  constructor() {
    this.maxFileSize = 5 * 1024 * 1024 // 5MB
    this.maxRows = 10000
  }

  /**
   * Parse do arquivo CSV
   */
  async parse(buffer) {
    // Verifica tamanho
    if (buffer.length > this.maxFileSize) {
      throw new Error('Arquivo excede o tamanho máximo de 5MB')
    }

    // Detecta encoding
    const encoding = chardet.detect(buffer) || 'utf-8'
    
    // Converte para UTF-8 se necessário
    let content
    if (encoding.toLowerCase() !== 'utf-8') {
      content = iconv.decode(buffer, encoding)
    } else {
      content = buffer.toString('utf-8')
    }

    // Detecta separador
    const separator = this._detectSeparator(content)

    // Parse do CSV
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter: separator,
      bom: true,
      relax_column_count: true,
    })

    // Verifica limite de linhas
    if (records.length > this.maxRows) {
      throw new Error(`Arquivo excede o limite de ${this.maxRows} linhas`)
    }

    return {
      rows: records,
      headers: records.length > 0 ? Object.keys(records[0]) : [],
      encoding,
      separator,
    }
  }

  /**
   * Detecta separador do CSV
   */
  _detectSeparator(content) {
    const firstLine = content.split('\n')[0]
    
    const separators = [';', ',', '\t', '|']
    let maxCount = 0
    let detectedSeparator = ','

    for (const sep of separators) {
      const count = (firstLine.match(new RegExp(sep === '\t' ? '\t' : sep, 'g')) || []).length
      if (count > maxCount) {
        maxCount = count
        detectedSeparator = sep
      }
    }

    return detectedSeparator
  }
}

module.exports = CsvParser
```

#### `src/app/import/csv/csv-template.js`

```javascript
class CsvTemplateGenerator {
  constructor() {
    this.columns = [
      { name: 'ticker', description: 'Código do ativo (ex: PETR4)' },
      { name: 'data', description: 'Data da operação (DD/MM/YYYY ou YYYY-MM-DD)' },
      { name: 'tipo', description: 'Tipo: COMPRA ou VENDA (ou C/V)' },
      { name: 'quantidade', description: 'Quantidade de ações/ativos' },
      { name: 'preco_unitario', description: 'Preço unitário em R$' },
      { name: 'taxas', description: 'Taxas e corretagem (opcional)' },
      { name: 'corretora', description: 'Nome da corretora (opcional)' },
      { name: 'observacao', description: 'Observações (opcional)' },
    ]

    this.exampleRows = [
      {
        ticker: 'PETR4',
        data: '15/03/2026',
        tipo: 'COMPRA',
        quantidade: '100',
        preco_unitario: '28,50',
        taxas: '5,00',
        corretora: 'Clear',
        observacao: 'Compra para carteira de dividendos',
      },
      {
        ticker: 'VALE3',
        data: '16/03/2026',
        tipo: 'VENDA',
        quantidade: '50',
        preco_unitario: '67,30',
        taxas: '3,50',
        corretora: 'XP',
        observacao: '',
      },
    ]
  }

  /**
   * Gera template CSV
   */
  generate() {
    // BOM para compatibilidade com Excel
    const BOM = '\uFEFF'
    
    // Cabeçalho
    const headers = this.columns.map((col) => col.name).join(';')
    
    // Linhas de exemplo
    const rows = this.exampleRows.map((row) => 
      this.columns.map((col) => row[col.name] || '').join(';')
    )

    // Monta CSV
    const csv = [headers, ...rows].join('\n')

    return {
      content: BOM + csv,
      filename: 'template_transacoes_moneytrackr.csv',
      mimeType: 'text/csv;charset=utf-8',
    }
  }
}

module.exports = CsvTemplateGenerator
```

### 2.4 Routers

#### `src/app/import/csv/csv-import-router.js`

```javascript
const express = require('express')
const multer = require('multer')
const { Authorizer, Permissions } = require('interact-utils')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../../app-constants')

const logger = new JsonLog(SERVICE_NAME)

// Configuração do multer para upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'text/plain',
    ]
    
    if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
      cb(null, true)
    } else {
      cb(new Error('Apenas arquivos CSV são permitidos'), false)
    }
  },
})

class CsvImportRouter {
  static handleError(exception, res) {
    logger.error('CSV import route error', exception, {
      internal: { method: 'handleError', filename: 'csv-import-router.js' },
    })
    res.status(exception.statusCode || 500).send({
      message: exception.message || 'Server Error',
      code: exception.code || 'INTERNAL_ERROR',
    })
  }

  static getPublicRoutes(appManager) {
    const router = express.Router()
    const manager = appManager.getCsvImportManager()

    /**
     * POST /v1/public/import/csv
     * Upload e parse de arquivo CSV
     */
    router.post('/import/csv',
      Authorizer.getMiddleware(Permissions.SERVICES),
      upload.single('file'),
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const { walletId, columnMapping } = req.body

          if (!req.file) {
            return res.status(400).send({
              message: 'Arquivo CSV é obrigatório',
              code: 'MISSING_FILE',
            })
          }

          if (!walletId) {
            return res.status(400).send({
              message: 'walletId é obrigatório',
              code: 'MISSING_WALLET_ID',
            })
          }

          let parsedMapping = null
          if (columnMapping) {
            try {
              parsedMapping = JSON.parse(columnMapping)
            } catch (e) {
              // Ignora erro de parse
            }
          }

          const result = await manager.parseCSV({
            domain,
            walletId,
            file: req.file,
            columnMapping: parsedMapping,
          })

          res.status(200).send(result)
        } catch (exception) {
          CsvImportRouter.handleError(exception, res)
        }
      })

    /**
     * POST /v1/public/import/csv/confirm
     * Confirma importação após revisão
     */
    router.post('/import/csv/confirm',
      Authorizer.getMiddleware(Permissions.SERVICES),
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const { logId, duplicateActions } = req.body

          if (!logId) {
            return res.status(400).send({
              message: 'logId é obrigatório',
              code: 'MISSING_LOG_ID',
            })
          }

          const result = await manager.confirmImport({
            domain,
            logId,
            duplicateActions,
          })

          res.status(200).send(result)
        } catch (exception) {
          CsvImportRouter.handleError(exception, res)
        }
      })

    /**
     * GET /v1/public/import/csv/template
     * Download do template CSV
     */
    router.get('/import/csv/template',
      Authorizer.getMiddleware(Permissions.SERVICES),
      async (req, res) => {
        try {
          const template = await manager.generateTemplate()

          res.setHeader('Content-Type', template.mimeType)
          res.setHeader('Content-Disposition', `attachment; filename="${template.filename}"`)
          res.send(template.content)
        } catch (exception) {
          CsvImportRouter.handleError(exception, res)
        }
      })

    return router
  }
}

module.exports = CsvImportRouter
```

---

## 3. Componentes Frontend

### 3.1 Pages

#### `src/pages/import/csv/CsvImportPage.vue`

```vue
<template>
  <div class="csv-import-page">
    <header class="page-header">
      <h1>Importar Transações (CSV)</h1>
      <button class="btn-secondary" @click="downloadTemplate">
        📥 Baixar Template
      </button>
    </header>

    <!-- Step 1: Upload -->
    <CsvUploadStep
      v-if="currentStep === 1"
      :wallet-id="activeWalletId"
      @uploaded="onUploaded"
    />

    <!-- Step 2: Column Mapping -->
    <CsvColumnMappingStep
      v-if="currentStep === 2"
      :headers="parseResult.headers"
      :detected-mapping="parseResult.columnMapping"
      @mapped="onMapped"
      @back="currentStep = 1"
    />

    <!-- Step 3: Preview + Duplicates -->
    <CsvPreviewStep
      v-if="currentStep === 3"
      :valid-rows="parseResult.validRows"
      :invalid-rows="parseResult.invalidRows"
      :duplicates="parseResult.duplicates"
      @confirm="onConfirm"
      @back="currentStep = 2"
    />

    <!-- Step 4: Result -->
    <CsvResultSummary
      v-if="currentStep === 4"
      :result="importResult"
      @done="onDone"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useWalletStore } from '@/stores/wallet'
import { csvImportService } from './csv-import.service'
import CsvUploadStep from './CsvUploadStep.vue'
import CsvColumnMappingStep from './CsvColumnMappingStep.vue'
import CsvPreviewStep from './CsvPreviewStep.vue'
import CsvResultSummary from './CsvResultSummary.vue'

const walletStore = useWalletStore()

const currentStep = ref(1)
const parseResult = ref(null)
const importResult = ref(null)

const activeWalletId = computed(() => walletStore.activeWallet?._id)

const downloadTemplate = async () => {
  await csvImportService.downloadTemplate()
}

const onUploaded = (result) => {
  parseResult.value = result
  
  if (result.columnMappingNeeded) {
    currentStep.value = 2
  } else {
    currentStep.value = 3
  }
}

const onMapped = async (mapping) => {
  // Re-parse com mapeamento correto
  // TODO: implementar re-parse
  currentStep.value = 3
}

const onConfirm = async (duplicateActions) => {
  try {
    importResult.value = await csvImportService.confirmImport({
      logId: parseResult.value.logId,
      duplicateActions,
    })
    currentStep.value = 4
  } catch (error) {
    console.error('Error confirming import:', error)
  }
}

const onDone = () => {
  // Reset e volta ao início
  currentStep.value = 1
  parseResult.value = null
  importResult.value = null
}
</script>
```

### 3.2 Components

#### `src/pages/import/csv/CsvUploadStep.vue`

```vue
<template>
  <div class="csv-upload-step">
    <div 
      class="upload-area"
      :class="{ 'drag-over': isDragOver }"
      @dragover.prevent="isDragOver = true"
      @dragleave="isDragOver = false"
      @drop.prevent="onDrop"
      @click="$refs.fileInput.click()"
    >
      <input 
        ref="fileInput"
        type="file"
        accept=".csv"
        hidden
        @change="onFileSelect"
      />
      
      <div class="upload-icon">📁</div>
      <p class="upload-text">
        Arraste um arquivo CSV ou clique para selecionar
      </p>
      <p class="upload-hint">
        Máximo: 5MB / 10.000 linhas
      </p>
    </div>

    <div v-if="uploading" class="upload-progress">
      <div class="spinner"></div>
      <p>Processando arquivo...</p>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { csvImportService } from './csv-import.service'

const props = defineProps({
  walletId: { type: String, required: true },
})

const emit = defineEmits(['uploaded'])

const isDragOver = ref(false)
const uploading = ref(false)
const error = ref(null)

const onDrop = (e) => {
  isDragOver.value = false
  const file = e.dataTransfer.files[0]
  if (file) {
    uploadFile(file)
  }
}

const onFileSelect = (e) => {
  const file = e.target.files[0]
  if (file) {
    uploadFile(file)
  }
}

const uploadFile = async (file) => {
  uploading.value = true
  error.value = null

  try {
    const result = await csvImportService.upload(file, props.walletId)
    emit('uploaded', result)
  } catch (err) {
    error.value = err.response?.data?.message || 'Erro ao processar arquivo'
  } finally {
    uploading.value = false
  }
}
</script>

<style scoped>
.upload-area {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-area:hover,
.upload-area.drag-over {
  border-color: #1a73e8;
  background-color: #f0f7ff;
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 16px;
}
</style>
```

#### `src/pages/import/csv/CsvPreviewStep.vue`

```vue
<template>
  <div class="csv-preview-step">
    <div class="preview-header">
      <h2>Revisar Importação</h2>
      <div class="summary-badges">
        <span class="badge badge-success">{{ validRows.length }} válidas</span>
        <span v-if="invalidRows.length" class="badge badge-error">
          {{ invalidRows.length }} inválidas
        </span>
        <span v-if="duplicates.length" class="badge badge-warning">
          {{ duplicates.length }} duplicadas
        </span>
      </div>
    </div>

    <!-- Tabela de preview -->
    <div class="preview-table-container">
      <table class="preview-table">
        <thead>
          <tr>
            <th>Linha</th>
            <th>Ticker</th>
            <th>Data</th>
            <th>Tipo</th>
            <th>Qtd</th>
            <th>Preço</th>
            <th>Status</th>
            <th v-if="duplicates.length">Ação</th>
          </tr>
        </thead>
        <tbody>
          <!-- Linhas válidas -->
          <tr 
            v-for="row in validRows" 
            :key="row.rowIndex"
            :class="getRowClass(row)"
          >
            <td>{{ row.rowIndex }}</td>
            <td>{{ row.ticker }}</td>
            <td>{{ formatDate(row.date) }}</td>
            <td>{{ row.type }}</td>
            <td>{{ row.quantity }}</td>
            <td>{{ formatCurrency(row.unitPrice) }}</td>
            <td>
              <span v-if="isDuplicate(row)" class="status-badge duplicate">
                Duplicado
              </span>
              <span v-else class="status-badge valid">
                Válido
              </span>
            </td>
            <td v-if="duplicates.length">
              <select 
                v-if="isDuplicate(row)"
                v-model="duplicateActions[row.rowIndex]"
                class="action-select"
              >
                <option value="IGNORE">Ignorar</option>
                <option value="DUPLICATE">Duplicar</option>
                <option value="REPLACE">Substituir</option>
              </select>
            </td>
          </tr>

          <!-- Linhas inválidas -->
          <tr 
            v-for="row in invalidRows" 
            :key="row.rowIndex"
            class="row-invalid"
          >
            <td>{{ row.rowIndex }}</td>
            <td>{{ row.row.ticker }}</td>
            <td>{{ row.row.date }}</td>
            <td>{{ row.row.type }}</td>
            <td>{{ row.row.quantity }}</td>
            <td>{{ row.row.unitPrice }}</td>
            <td>
              <span class="status-badge invalid" :title="row.errors.map(e => e.message).join(', ')">
                Inválido
              </span>
            </td>
            <td v-if="duplicates.length">-</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Ações em lote para duplicados -->
    <div v-if="duplicates.length > 1" class="bulk-actions">
      <span>Ação para todos os duplicados:</span>
      <select v-model="bulkAction" @change="applyBulkAction">
        <option value="">Selecione...</option>
        <option value="IGNORE">Ignorar todos</option>
        <option value="DUPLICATE">Duplicar todos</option>
        <option value="REPLACE">Substituir todos</option>
      </select>
    </div>

    <div class="step-actions">
      <button class="btn-secondary" @click="$emit('back')">Voltar</button>
      <button 
        class="btn-primary" 
        @click="onConfirm"
        :disabled="validRows.length === 0"
      >
        Confirmar Importação
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  validRows: { type: Array, default: () => [] },
  invalidRows: { type: Array, default: () => [] },
  duplicates: { type: Array, default: () => [] },
})

const emit = defineEmits(['confirm', 'back'])

const duplicateActions = ref({})
const bulkAction = ref('')

const duplicateRowIndices = computed(() => 
  new Set(props.duplicates.map((d) => d.rowIndex))
)

const isDuplicate = (row) => duplicateRowIndices.value.has(row.rowIndex)

const getRowClass = (row) => {
  if (isDuplicate(row)) return 'row-duplicate'
  return 'row-valid'
}

const applyBulkAction = () => {
  if (!bulkAction.value) return
  
  for (const dup of props.duplicates) {
    duplicateActions.value[dup.rowIndex] = bulkAction.value
  }
}

const onConfirm = () => {
  const actions = Object.entries(duplicateActions.value).map(([rowIndex, action]) => ({
    rowIndex: parseInt(rowIndex),
    action,
  }))
  
  emit('confirm', actions)
}

const formatDate = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString('pt-BR')
}

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}
</script>

<style scoped>
.row-valid { background-color: #f0fff0; }
.row-invalid { background-color: #fff0f0; }
.row-duplicate { background-color: #fffbe6; }

.status-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.status-badge.valid { background-color: #d4edda; color: #155724; }
.status-badge.invalid { background-color: #f8d7da; color: #721c24; }
.status-badge.duplicate { background-color: #fff3cd; color: #856404; }
</style>
```

### 3.3 Services

#### `src/pages/import/csv/csv-import.service.js`

```javascript
import axios from 'axios'

const API_BASE = '/v1/public'

export const csvImportService = {
  /**
   * Upload e parse de CSV
   */
  async upload(file, walletId, columnMapping = null) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('walletId', walletId)
    
    if (columnMapping) {
      formData.append('columnMapping', JSON.stringify(columnMapping))
    }

    const response = await axios.post(`${API_BASE}/import/csv`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    
    return response.data
  },

  /**
   * Confirma importação
   */
  async confirmImport({ logId, duplicateActions }) {
    const response = await axios.post(`${API_BASE}/import/csv/confirm`, {
      logId,
      duplicateActions,
    })
    
    return response.data
  },

  /**
   * Download do template
   */
  async downloadTemplate() {
    const response = await axios.get(`${API_BASE}/import/csv/template`, {
      responseType: 'blob',
    })
    
    // Cria link de download
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'template_transacoes_moneytrackr.csv')
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },
}
```

---

## 4. API Contracts

### 4.1 POST /v1/public/import/csv

**Descrição**: Upload e parse de arquivo CSV

**Request**: multipart/form-data
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| file | File | Sim | Arquivo CSV (max 5MB) |
| walletId | string | Sim | ID da carteira |
| columnMapping | JSON | Não | Mapeamento de colunas |

**Response 200**:
```json
{
  "logId": "uuid",
  "totalRows": 50,
  "validRows": 45,
  "invalidRows": [
    {
      "rowIndex": 5,
      "row": { "ticker": "PETR4", "date": "invalid", ... },
      "errors": [
        { "field": "date", "message": "Data inválida" }
      ]
    }
  ],
  "duplicates": [
    {
      "rowIndex": 10,
      "row": { "ticker": "VALE3", ... },
      "existingTransaction": { "_id": "uuid", ... }
    }
  ],
  "columnMapping": {
    "ticker": "ativo",
    "date": "data",
    "type": "tipo",
    "quantity": "qtd",
    "unitPrice": "preco"
  },
  "columnMappingNeeded": false,
  "headers": ["ativo", "data", "tipo", "qtd", "preco"]
}
```

### 4.2 POST /v1/public/import/csv/confirm

**Request Body**:
```json
{
  "logId": "uuid",
  "duplicateActions": [
    { "rowIndex": 10, "action": "IGNORE" },
    { "rowIndex": 15, "action": "REPLACE" }
  ]
}
```

**Response 200**:
```json
{
  "success": true,
  "stats": {
    "imported": 43,
    "ignored": 2,
    "replaced": 1,
    "errors": 0
  },
  "logId": "uuid"
}
```

### 4.3 GET /v1/public/import/csv/template

**Response**: Arquivo CSV com UTF-8 BOM

---

## 5. Fluxos de Dados

### 5.1 Diagrama de Sequência - Importação Completa

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────────┐     ┌─────────────┐
│ Frontend│     │ Router  │     │ Manager │     │ CsvParser   │     │ Transaction │
│         │     │ (multer)│     │         │     │             │     │ DAO         │
└────┬────┘     └────┬────┘     └────┬────┘     └──────┬──────┘     └──────┬──────┘
     │               │               │                 │                    │
     │ POST /import/csv              │                 │                    │
     │ (multipart)   │               │                 │                    │
     │──────────────►│               │                 │                    │
     │               │               │                 │                    │
     │               │ parseCSV()    │                 │                    │
     │               │──────────────►│                 │                    │
     │               │               │                 │                    │
     │               │               │ parser.parse()  │                    │
     │               │               │────────────────►│                    │
     │               │               │                 │                    │
     │               │               │ { rows, headers}│                    │
     │               │               │◄────────────────│                    │
     │               │               │                 │                    │
     │               │               │ _detectDuplicates()                  │
     │               │               │─────────────────────────────────────►│
     │               │               │                 │                    │
     │               │               │ [duplicates]    │                    │
     │               │               │◄─────────────────────────────────────│
     │               │               │                 │                    │
     │ { logId, validRows, ... }    │                 │                    │
     │◄──────────────│               │                 │                    │
     │               │               │                 │                    │
     │               │               │                 │                    │
     │ POST /import/csv/confirm     │                 │                    │
     │ { logId, actions }           │                 │                    │
     │──────────────►│               │                 │                    │
     │               │               │                 │                    │
     │               │ confirmImport()│                │                    │
     │               │──────────────►│                 │                    │
     │               │               │                 │                    │
     │               │               │ bulkInsert()   │                    │
     │               │               │─────────────────────────────────────►│
     │               │               │                 │     (MongoDB)       │
     │               │               │                 │                    │
     │               │ { success, stats }             │                    │
     │◄──────────────│               │                 │                    │
     │               │               │                 │                    │
```

---

## 6. Estrutura de Arquivos

```
src/
├── app/
│   └── import/
│       └── csv/
│           ├── csv-import-router.js
│           ├── csv-import-manager.js
│           ├── csv-import-dao.js
│           ├── csv-import-model.js
│           ├── csv-parser.js
│           └── csv-template.js
│
├── __tests__/
│   ├── csv-import.test.js
│   └── csv-parser.test.js
│
└── frontend/
    └── src/
        └── pages/import/
            └── csv/
                ├── CsvImportPage.vue
                ├── CsvUploadStep.vue
                ├── CsvColumnMappingStep.vue
                ├── CsvPreviewStep.vue
                ├── CsvDuplicateDialog.vue
                ├── CsvResultSummary.vue
                └── csv-import.service.js
```

---

## 7. Ordem de Implementação

| Ordem | Story | Componente | Estimativa | Dependências |
|-------|-------|------------|------------|-------------|
| 1 | EP08-001 | Parser + Manager + Router | 13 pts | EP04, EP03 |
| 2 | EP08-002 | Detecção de duplicidades | 8 pts | EP08-001 |
| 3 | EP08-003 | Template generator | 2 pts | EP08-001 |
| 4 | - | Frontend completo | 8 pts | EP08-001, EP08-002 |

**Total**: 31 story points

---

## 8. Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|--------|-----------|
| Encoding incorreto do arquivo | Alta | Médio | Detectar encoding com chardet + converter para UTF-8 |
| Separador diferente (vírgula vs ponto-e-vírgula) | Alta | Baixo | Auto-detecção de separador |
| Arquivo muito grande | Baixa | Médio | Limite de 5MB/10.000 linhas + streaming |
| Duplicidades em massa | Média | Baixo | Bulk actions para resolver duplicidades |
| Formato de data variável | Alta | Médio | Aceitar DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY |

---

## 9. Dependências

### Dependências Externas (NPM)
```json
{
  "dependencies": {
    "csv-parse": "^5.5.0",
    "multer": "^1.4.5-lts.1",
    "chardet": "^2.0.0",
    "iconv-lite": "^0.6.3"
  }
}
```

### Dependências de Épicos
| Épico | Dependência | Tipo |
|-------|-------------|------|
| EP02 | Autenticação JWT | Bloqueante |
| EP03 | Carteiras | Bloqueante |
| EP04 | Transações (DAO) | Bloqueante |

---

## 10. Checklist de Implementação

### Backend
- [ ] Criar `csv-import-model.js`
- [ ] Implementar `CsvImportDAO`
- [ ] Implementar `CsvParser` com detecção de encoding/separador
- [ ] Implementar `CsvTemplateGenerator`
- [ ] Implementar `CsvImportManager` com validações
- [ ] Implementar `CsvImportRouter` com multer
- [ ] Adicionar constantes de erro
- [ ] Testes unitários (Parser, Manager)
- [ ] Testes de integração (API)

### Frontend
- [ ] Criar `CsvImportPage.vue`
- [ ] Criar `CsvUploadStep.vue` (drag & drop)
- [ ] Criar `CsvColumnMappingStep.vue`
- [ ] Criar `CsvPreviewStep.vue`
- [ ] Criar `CsvDuplicateDialog.vue`
- [ ] Criar `CsvResultSummary.vue`
- [ ] Criar service
- [ ] Testes E2E

---

**Status**: Pronto para implementação
**Próximos passos**: Delegar para @tech-lead iniciar EP08-001

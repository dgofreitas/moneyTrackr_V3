# Plano Técnico - EP09: Importação de PDF (Nota de Corretagem)

> **Épico**: 09 — Importação de PDF (Nota de Corretagem)
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
│  │                         PdfImportPage                                           ││
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌─────────────────┐  ││
│  │  │ PdfUploadStep │  │ PdfTemplate   │  │ PdfPreviewStep │  │ PdfResultSummary│  ││
│  │  │               │  │ Creator       │  │               │  │                 │  ││
│  │  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └────────┬────────┘  ││
│  │          │                  │                  │                    │           ││
│  │          └──────────────────┼──────────────────┼────────────────────┘           ││
│  │                             │                  │                                ││
│  │                   ┌─────────▼─────────┐        │                                ││
│  │                   │ pdf-import.       │        │                                ││
│  │                   │ service.js        │        │                                ││
│  │                   └─────────┬─────────┘        │                                ││
│  └─────────────────────────────┼──────────────────┼────────────────────────────────┘│
│                                │                  │                                 │
│                    ┌───────────▼───────────┐      │                                 │
│                    │  Store (Pinia/Vuex)   │      │                                 │
│                    │  - templates          │      │                                 │
│                    │  - extractedData      │      │                                 │
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
│  │  PdfImportRouter                                                             │   │
│  │  - POST   /v1/public/import/pdf              (upload + extract)              │   │
│  │  - POST   /v1/public/import/pdf/confirm      (confirma importação)          │   │
│  │  - POST   /v1/public/import/pdf/templates    (cria template)                │   │
│  │  - GET    /v1/public/import/pdf/templates    (lista templates)              │   │
│  │  - PUT    /v1/public/import/pdf/templates/:id (atualiza template)            │   │
│  │  - DELETE /v1/public/import/pdf/templates/:id (exclui template)              │   │
│  │  - POST   /v1/public/import/pdf/test-template (testa template)               │   │
│  └─────────────────────────────────────┬───────────────────────────────────────┘   │
│                                        │                                            │
│  ┌─────────────────────────────────────▼───────────────────────────────────────┐   │
│  │                              MANAGER LAYER                                   │   │
│  │  PdfImportManager                                                            │   │
│  │  - extractText()       → pdf-parse library                                   │   │
│  │  - detectTemplate()    → match com templates existentes                      │   │
│  │  - applyTemplate()     → extrai dados com regex                              │   │
│  │  - confirmImport()     → persiste transações                                 │   │
│  └──────────┬────────────────────────────────────────────────────────┬──────────┘   │
│             │                                                        │              │
│  ┌──────────▼──────────┐                    ┌────────────────────────▼──────────┐   │
│  │    TEMPLATE MANAGER │                    │      PDF TEXT EXTRACTOR            │   │
│  │  PdfTemplateManager │                    │    (pdf-parse)                     │   │
│  │  - createTemplate   │                    │  - Extrai texto bruto do PDF      │   │
│  │  - updateTemplate   │                    │  - Não suporta OCR                │   │
│  │  - matchTemplate    │                    │                                    │   │
│  └──────────┬──────────┘                    └────────────────────────────────────┘   │
│             │                                                                        │
│  ┌──────────▼──────────────────────────────────────────────────────────────────┐   │
│  │                              DAO LAYER                                       │   │
│  │  PdfImportDAO              │  PdfTemplateDAO                                 │   │
│  │  - createLog               │  - createTemplate                               │   │
│  │  - updateLog               │  - findByUser                                   │   │
│  │  - findLogById             │  - findById                                     │   │
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
│  │  Collection: pdfImportLogs  │     │  (temp uploads - multer)    │                 │
│  │  Collection: pdfTemplates   │     │  Max: 10MB                  │                 │
│  └─────────────────────────────┘     └─────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Fluxo de Importação PDF

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           FLUXO DE IMPORTAÇÃO PDF                                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│   ┌─────────────────┐                                                              │
│   │ 1. UPLOAD PDF   │                                                              │
│   │    (max 10MB)   │                                                              │
│   └────────┬────────┘                                                              │
│            │                                                                        │
│            ▼                                                                        │
│   ┌─────────────────┐                                                              │
│   │ 2. EXTRAÇÃO     │                                                              │
│   │    Texto bruto  │                                                              │
│   │    (pdf-parse)  │                                                              │
│   └────────┬────────┘                                                              │
│            │                                                                        │
│            ▼                                                                        │
│   ┌─────────────────┐     ┌─────────────────┐                                      │
│   │ 3. DETECÇÃO      │────►│ Templates do    │                                      │
│   │    DE TEMPLATE   │     │ usuário         │                                      │
│   └────────┬────────┘     └─────────────────┘                                      │
│            │                                                                        │
│            ├──────────────────────────────────────────────────────────────┐         │
│            │                                                              │         │
│            ▼ (Match único)                                                ▼ (No match)
│   ┌─────────────────┐                                          ┌─────────────────┐
│   │ 4a. APLICAR     │                                          │ 4b. CRIAR       │
│   │    TEMPLATE     │                                          │    TEMPLATE      │
│   │    AUTOMATICAMENTE                                         │    (interface)   │
│   └────────┬────────┘                                          └────────┬────────┘
│            │                                                              │         │
│            │                                                              ▼         │
│            │                                                    ┌─────────────────┐
│            │                                                    │ 4b1. DEFINIR    │
│            │                                                    │     regex de    │
│            │                                                    │     identificação
│            │                                                    └────────┬────────┘
│            │                                                              │         │
│            │                                                              ▼         │
│            │                                                    ┌─────────────────┐
│            │                                                    │ 4b2. MAPEAR     │
│            │                                                    │     campos      │
│            │                                                    │     (regex)     │
│            │                                                    └────────┬────────┘
│            │                                                              │         │
│            │                                                              ▼         │
│            │                                                    ┌─────────────────┐
│            │                                                    │ 4b3. TESTAR     │
│            │                                                    │     template    │
│            │                                                    └────────┬────────┘
│            │                                                              │         │
│            │                                                              ▼         │
│            │                                                    ┌─────────────────┐
│            │                                                    │ 4b4. SALVAR     │
│            │                                                    │     template    │
│            │                                                    └────────┬────────┘
│            │                                                              │         │
│            └──────────────────────────────────────────────────────────────┘         │
│                                        │                                            │
│                                        ▼                                            │
│   ┌─────────────────┐                                                              │
│   │ 5. PREVIEW      │                                                              │
│   │    Dados        │                                                              │
│   │    extraídos    │                                                              │
│   │    (editável)   │                                                              │
│   └────────┬────────┘                                                              │
│            │                                                                        │
│            ▼                                                                        │
│   ┌─────────────────┐                                                              │
│   │ 6. EDIÇÃO       │                                                              │
│   │    INLINE       │                                                              │
│   │    (correções)  │                                                              │
│   └────────┬────────┘                                                              │
│            │                                                                        │
│            ▼                                                                        │
│   ┌─────────────────┐                                                              │
│   │ 7. CONFIRMAÇÃO   │                                                              │
│   │    E IMPORTAÇÃO │                                                              │
│   └────────┬────────┘                                                              │
│            │                                                                        │
│            ▼                                                                        │
│   ┌─────────────────┐                                                              │
│   │ 8. RESUMO       │                                                              │
│   │    FINAL        │                                                              │
│   └─────────────────┘                                                              │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Interface de Criação de Template

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    INTERFACE DE CRIAÇÃO DE TEMPLATE                                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌──────────────────────────────────┐  ┌──────────────────────────────────────────┐ │
│  │  TEXTO EXTRAÍDO DO PDF           │  │  CONFIGURAÇÃO DO TEMPLATE               │ │
│  │                                  │  │                                          │ │
│  │  NOTA DE NEGOCIAÇÃO              │  │  Nome do Template: [______________]     │ │
│  │  CORRETORA XYZ S.A.              │  │  Corretora: [____________________]      │ │
│  │  CNPJ: 12.345.678/0001-90        │  │                                          │ │
│  │  Data: 15/03/2025                │  │  Padrão de Identificação:               │ │
│  │                                  │  │  [CORRETORA XYZ.*CNPJ.*____________]   │ │
│  │  NEGÓCIOS REALIZADOS             │  │                                          │ │
│  │  ─────────────────────           │  │  ── MAPEAMENTO DE CAMPOS ────────────   │ │
│  │  C PETR4  100  28,50  2850      │  │                                          │ │
│  │  V VALE3   50  67,30  3365      │  │  Ticker:                                 │ │
│  │  C ITUB4  200  25,10  5020      │  │  Regex: [(\w{4}\d{1,2})______________]  │ │
│  │                                  │  │  Grupo: [1]                              │ │
│  │  [Texto selecionável com        │  │                                          │ │
│  │   highlight ao selecionar]      │  │  Data:                                   │ │
│  │                                  │  │  Regex: [(\d{2}/\d{2}/\d{4})_________]  │ │
│  │                                  │  │  Formato: DD/MM/YYYY                     │ │
│  │                                  │  │                                          │ │
│  │                                  │  │  Tipo (C/V):                             │ │
│  │                                  │  │  Regex: [^(\w)\s+\w{4}________________]  │ │
│  │                                  │  │  Transform: C→COMPRA, V→VENDA           │ │
│  │                                  │  │                                          │ │
│  │                                  │  │  Quantidade:                             │ │
│  │                                  │  │  Regex: [\w{4,5}\s+(\d+)______________] │ │
│  │                                  │  │                                          │ │
│  │                                  │  │  Preço Unitário:                         │ │
│  │                                  │  │  Regex: [\d+\s+(\d+,\d+)______________] │ │
│  │                                  │  │  Transform: replace(',', '.')            │ │
│  │                                  │  │                                          │ │
│  │                                  │  │  ─────────────────────────────────────   │ │
│  │                                  │  │                                          │ │
│  │                                  │  │  [Testar Template]  [Salvar Template]   │ │
│  └──────────────────────────────────┘  └──────────────────────────────────────────┘ │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Componentes Backend

### 2.1 Models (Mongoose Schemas)

#### `src/app/import/pdf/pdf-template-model.js`

```javascript
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const fieldMappingSchema = new mongoose.Schema({
  systemField: {
    type: String,
    required: true,
    enum: ['ticker', 'date', 'type', 'quantity', 'unitPrice', 'fees', 'broker', 'notes'],
  },
  regex: { 
    type: String, 
    required: true 
  },
  groupIndex: { 
    type: Number, 
    default: 1 
  },
  format: { 
    type: String 
  }, // ex: 'DD/MM/YYYY' para data
  transform: { 
    type: String 
  }, // ex: 'parseFloat', 'toUpperCase', 'replaceComma'
}, { _id: false })

const pdfTemplateSchema = new mongoose.Schema({
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
  name: { 
    type: String, 
    required: true,
    maxlength: 100,
  },
  brokerName: { 
    type: String, 
    required: true,
    maxlength: 100,
  },
  identificationPattern: { 
    type: String, 
    required: true 
  }, // Regex para auto-detecção
  fieldMappings: {
    type: [fieldMappingSchema],
    required: true,
    validate: {
      validator: (mappings) => {
        const required = ['ticker', 'date', 'type', 'quantity', 'unitPrice']
        const mapped = mappings.map((m) => m.systemField)
        return required.every((f) => mapped.includes(f))
      },
      message: 'Todos os campos obrigatórios devem estar mapeados',
    },
  },
  rowDelimiter: { 
    type: String, 
    default: '\\n' 
  },
  transactionBlockRegex: { 
    type: String 
  }, // Regex para identificar bloco de transações
  isActive: { 
    type: Boolean, 
    default: true 
  },
  lastUsedAt: { 
    type: Date 
  },
  usageCount: { 
    type: Number, 
    default: 0 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
}, { 
  versionKey: false 
})

// Índice único para nome por usuário
pdfTemplateSchema.index({ userId: 1, name: 1 }, { unique: true })
pdfTemplateSchema.index({ userId: 1, isActive: 1 })

module.exports = { pdfTemplateSchema, fieldMappingSchema }
```

#### `src/app/import/pdf/pdf-import-model.js`

```javascript
const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const pdfImportLogSchema = new mongoose.Schema({
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
  templateId: { 
    type: String,
    ref: 'pdfTemplate',
  },
  filename: { 
    type: String, 
    required: true 
  },
  totalTransactions: { 
    type: Number, 
    default: 0 
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
    enum: ['PROCESSING', 'PENDING_REVIEW', 'CONFIRMED', 'CANCELLED', 'FAILED'],
    default: 'PROCESSING',
  },
  extractedText: { 
    type: String 
  }, // Texto bruto extraído
  extractedData: { 
    type: mongoose.Schema.Types.Mixed 
  }, // Dados extraídos antes da confirmação
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

pdfImportLogSchema.index({ userId: 1, createdAt: -1 })

module.exports = { pdfImportLogSchema }
```

### 2.2 DAOs

#### `src/app/import/pdf/pdf-template-dao.js`

```javascript
const AppDAO = require('../../app-dao')
const { pdfTemplateSchema } = require('./pdf-template-model')

class PdfTemplateDAO extends AppDAO {
  constructor(db) {
    super(db)
  }

  initializeDBModel(db) {
    return db.model('pdfTemplate', pdfTemplateSchema)
  }

  /**
   * Cria template
   */
  async createTemplate(data) {
    const template = new this.objectModel(data)
    return await template.save().then((doc) => doc.toObject())
  }

  /**
   * Atualiza template
   */
  async updateTemplate(id, userId, data) {
    return await this.objectModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean().exec()
  }

  /**
   * Soft delete (isActive = false)
   */
  async softDelete(id, userId) {
    return await this.objectModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: { isActive: false, updatedAt: new Date() } },
      { new: true }
    ).lean().exec()
  }

  /**
   * Busca por ID
   */
  async findById(id, userId) {
    return await this.objectModel.findOne({
      _id: id,
      userId,
      isActive: true,
    }).lean().exec()
  }

  /**
   * Lista templates do usuário
   */
  async findByUser(userId) {
    return await this.objectModel.find({
      userId,
      isActive: true,
    })
    .sort({ lastUsedAt: -1 })
    .lean().exec()
  }

  /**
   * Atualiza estatísticas de uso
   */
  async updateUsageStats(id) {
    return await this.objectModel.findByIdAndUpdate(
      id,
      {
        $inc: { usageCount: 1 },
        $set: { lastUsedAt: new Date() },
      }
    ).lean().exec()
  }
}

module.exports = PdfTemplateDAO
```

#### `src/app/import/pdf/pdf-import-dao.js`

```javascript
const AppDAO = require('../../app-dao')
const { pdfImportLogSchema } = require('./pdf-import-model')

class PdfImportDAO extends AppDAO {
  constructor(db) {
    super(db)
  }

  initializeDBModel(db) {
    return db.model('pdfImportLog', pdfImportLogSchema)
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

module.exports = PdfImportDAO
```

### 2.3 Managers

#### `src/app/import/pdf/pdf-import-manager.js`

```javascript
const PdfImportDAO = require('./pdf-import-dao')
const PdfTemplateDAO = require('./pdf-template-dao')
const PdfTextExtractor = require('./pdf-text-extractor')
const PdfTemplateMatcher = require('./pdf-template-matcher')
const APP_CONSTANTS = require('../../app-constants')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../../app-constants')

const logger = new JsonLog(SERVICE_NAME)

class PdfImportManager {
  constructor(appManager, appDB) {
    this.appDB = appDB
    this.config = appManager.config
    this.handleError = appManager.handleError.bind(appManager)
    
    this.pdfImportDAO = new PdfImportDAO(this.appDB.getDb())
    this.pdfTemplateDAO = new PdfTemplateDAO(this.appDB.getDb())
    this.textExtractor = new PdfTextExtractor()
    this.templateMatcher = new PdfTemplateMatcher()
    this.transactionDAO = appManager.getTransactionDAO() // EP04
  }

  /**
   * Upload e extração de PDF
   */
  async uploadAndExtract({ domain, walletId, file }) {
    // Cria log de importação
    const log = await this.pdfImportDAO.createLog({
      userId: domain,
      walletId,
      filename: file.originalname,
      status: 'PROCESSING',
    })

    try {
      // Extrai texto do PDF
      const extractedText = await this.textExtractor.extract(file.buffer)

      if (!extractedText || extractedText.trim() === '') {
        await this.pdfImportDAO.updateLog(log._id, {
          status: 'FAILED',
          errorCount: 1,
          errors: [{ row: 0, message: 'Não foi possível extrair texto do PDF. O arquivo pode ser uma imagem escaneada.' }],
        })
        this.handleError(APP_CONSTANTS.ERRORS.PDF_TEXT_EXTRACTION_FAILED)
      }

      // Detecta template
      const templates = await this.pdfTemplateDAO.findByUser(domain)
      const matchResult = this.templateMatcher.match(extractedText, templates)

      // Atualiza log com texto extraído
      await this.pdfImportDAO.updateLog(log._id, {
        extractedText,
      })

      logger.log('PDF text extracted', {
        domain,
        internal: { method: 'uploadAndExtract', filename: 'pdf-import-manager.js' },
        metadata: { 
          logId: log._id, 
          textLength: extractedText.length,
          matchStatus: matchResult.status,
        },
      })

      return {
        logId: log._id,
        extractedText,
        matchStatus: matchResult.status,
        matchedTemplate: matchResult.template,
        matchedTemplates: matchResult.templates,
      }
    } catch (error) {
      await this.pdfImportDAO.updateLog(log._id, {
        status: 'FAILED',
        errorCount: 1,
        errors: [{ row: 0, message: error.message }],
      })
      throw error
    }
  }

  /**
   * Aplica template e extrai dados
   */
  async applyTemplate({ domain, logId, templateId }) {
    const log = await this.pdfImportDAO.findLogById(logId, domain)

    if (!log) {
      this.handleError(APP_CONSTANTS.ERRORS.PDF_IMPORT_NOT_FOUND)
    }

    const template = await this.pdfTemplateDAO.findById(templateId, domain)

    if (!template) {
      this.handleError(APP_CONSTANTS.ERRORS.PDF_TEMPLATE_NOT_FOUND)
    }

    // Aplica regex do template
    const extractedData = this._applyTemplateRegex(log.extractedText, template)

    // Valida dados extraídos
    const { validRows, invalidRows } = this._validateExtractedData(extractedData)

    // Detecta duplicidades
    const duplicates = await this._detectDuplicates(log.walletId, validRows)

    // Atualiza log
    await this.pdfImportDAO.updateLog(log._id, {
      templateId,
      totalTransactions: extractedData.length,
      extractedData: { validRows, invalidRows, duplicates },
      status: 'PENDING_REVIEW',
    })

    // Atualiza estatísticas do template
    await this.pdfTemplateDAO.updateUsageStats(templateId)

    return {
      logId,
      templateId,
      totalTransactions: extractedData.length,
      validRows: validRows.length,
      invalidRows,
      duplicates,
    }
  }

  /**
   * Cria novo template
   */
  async createTemplate({ domain, data }) {
    // Valida regex
    this._validateTemplateRegex(data)

    // Verifica nome único
    const existing = await this.pdfTemplateDAO.findByUser(domain)
    if (existing.some((t) => t.name === data.name)) {
      this.handleError(APP_CONSTANTS.ERRORS.PDF_TEMPLATE_NAME_EXISTS)
    }

    const template = await this.pdfTemplateDAO.createTemplate({
      ...data,
      userId: domain,
    })

    logger.log('PDF template created', {
      domain,
      internal: { method: 'createTemplate', filename: 'pdf-import-manager.js' },
      metadata: { templateId: template._id, name: template.name },
    })

    return template
  }

  /**
   * Testa template contra texto
   */
  async testTemplate({ domain, template, extractedText }) {
    // Valida regex
    this._validateTemplateRegex(template)

    // Aplica regex
    const extractedData = this._applyTemplateRegex(extractedText, template)

    return {
      success: true,
      extractedData,
      count: extractedData.length,
    }
  }

  /**
   * Confirma importação
   */
  async confirmImport({ domain, logId, duplicateActions }) {
    const log = await this.pdfImportDAO.findLogById(logId, domain)

    if (!log || log.status !== 'PENDING_REVIEW') {
      this.handleError(APP_CONSTANTS.ERRORS.PDF_IMPORT_NOT_FOUND)
    }

    const { validRows, duplicates } = log.extractedData
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
          await this.transactionDAO.update(duplicate.existingTransaction._id, {
            quantity: row.quantity,
            unitPrice: row.unitPrice,
            fees: row.fees || 0,
          })
          stats.replaced++
          continue
        }
      }

      transactions.push({
        walletId: log.walletId,
        userId: domain,
        ticker: row.ticker.toUpperCase(),
        date: new Date(row.date),
        type: row.type.toUpperCase(),
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        fees: row.fees || 0,
        broker: row.broker || template?.brokerName || '',
      })
      stats.imported++
    }

    // Bulk insert
    if (transactions.length > 0) {
      await this.transactionDAO.bulkInsert(transactions)
    }

    // Atualiza log
    await this.pdfImportDAO.updateLog(log._id, {
      importedCount: stats.imported,
      ignoredCount: stats.ignored,
      replacedCount: stats.replaced,
      errorCount: stats.errors,
      status: 'CONFIRMED',
      completedAt: new Date(),
    })

    return {
      success: true,
      stats,
      logId,
    }
  }

  /**
   * Aplica regex do template
   */
  _applyTemplateRegex(text, template) {
    const results = []

    // Se tem transactionBlockRegex, extrai bloco primeiro
    let searchText = text
    if (template.transactionBlockRegex) {
      const blockMatch = new RegExp(template.transactionBlockRegex, 'gs').exec(text)
      if (blockMatch) {
        searchText = blockMatch[0]
      }
    }

    // Divide em linhas/registros
    const rows = searchText.split(new RegExp(template.rowDelimiter || '\\n'))

    for (const row of rows) {
      if (!row.trim()) continue

      const extracted = {}

      for (const mapping of template.fieldMappings) {
        try {
          const regex = new RegExp(mapping.regex, 'g')
          const match = regex.exec(row)

          if (match && match[mapping.groupIndex]) {
            let value = match[mapping.groupIndex]

            // Aplica transformações
            if (mapping.transform) {
              value = this._applyTransform(value, mapping.transform)
            }

            // Formata data se necessário
            if (mapping.systemField === 'date' && mapping.format) {
              value = this._parseDate(value, mapping.format)
            }

            extracted[mapping.systemField] = value
          }
        } catch (e) {
          // Regex inválida ou sem match
        }
      }

      // Só adiciona se tiver campos obrigatórios
      if (extracted.ticker && extracted.date && extracted.quantity) {
        results.push(extracted)
      }
    }

    return results
  }

  /**
   * Aplica transformação
   */
  _applyTransform(value, transform) {
    switch (transform) {
      case 'parseFloat':
        return parseFloat(value.replace(',', '.'))
      case 'parseInt':
        return parseInt(value, 10)
      case 'toUpperCase':
        return value.toUpperCase()
      case 'toLowerCase':
        return value.toLowerCase()
      case 'replaceComma':
        return value.replace(',', '.')
      case 'CtoCOMPRA':
        return value === 'C' ? 'COMPRA' : value === 'V' ? 'VENDA' : value
      default:
        return value
    }
  }

  /**
   * Parse de data
   */
  _parseDate(value, format) {
    if (format === 'DD/MM/YYYY') {
      const [day, month, year] = value.split('/')
      return `${year}-${month}-${day}`
    }
    return value
  }

  /**
   * Valida regex do template
   */
  _validateTemplateRegex(template) {
    // Valida regex de identificação
    try {
      new RegExp(template.identificationPattern)
    } catch (e) {
      this.handleError(APP_CONSTANTS.ERRORS.PDF_TEMPLATE_INVALID_REGEX)
    }

    // Valida regex de cada campo
    for (const mapping of template.fieldMappings) {
      try {
        new RegExp(mapping.regex)
      } catch (e) {
        this.handleError(APP_CONSTANTS.ERRORS.PDF_TEMPLATE_INVALID_REGEX)
      }
    }
  }

  /**
   * Valida dados extraídos
   */
  _validateExtractedData(data) {
    const validRows = []
    const invalidRows = []

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const errors = []

      if (!row.ticker) {
        errors.push({ field: 'ticker', message: 'Ticker não extraído' })
      }

      if (!row.date || !this._isValidDate(row.date)) {
        errors.push({ field: 'date', message: 'Data inválida' })
      }

      if (!['COMPRA', 'VENDA'].includes(row.type?.toUpperCase())) {
        errors.push({ field: 'type', message: 'Tipo deve ser COMPRA ou VENDA' })
      }

      if (!row.quantity || row.quantity <= 0) {
        errors.push({ field: 'quantity', message: 'Quantidade inválida' })
      }

      if (!row.unitPrice || row.unitPrice <= 0) {
        errors.push({ field: 'unitPrice', message: 'Preço unitário inválido' })
      }

      if (errors.length > 0) {
        invalidRows.push({ rowIndex: i, row, errors })
      } else {
        validRows.push({ rowIndex: i, ...row })
      }
    }

    return { validRows, invalidRows }
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
    return !isNaN(Date.parse(dateStr))
  }
}

module.exports = PdfImportManager
```

#### `src/app/import/pdf/pdf-text-extractor.js`

```javascript
const pdf = require('pdf-parse')

class PdfTextExtractor {
  constructor() {
    this.maxFileSize = 10 * 1024 * 1024 // 10MB
  }

  /**
   * Extrai texto do PDF
   */
  async extract(buffer) {
    // Verifica tamanho
    if (buffer.length > this.maxFileSize) {
      throw new Error('Arquivo excede o tamanho máximo de 10MB')
    }

    try {
      const data = await pdf(buffer, {
        max: 0, // Sem limite de páginas
      })

      return data.text
    } catch (error) {
      if (error.message.includes('Invalid PDF')) {
        throw new Error('Arquivo PDF inválido ou corrompido')
      }
      throw error
    }
  }
}

module.exports = PdfTextExtractor
```

#### `src/app/import/pdf/pdf-template-matcher.js`

```javascript
class PdfTemplateMatcher {
  /**
   * Encontra template que corresponde ao texto
   */
  match(extractedText, templates) {
    const matches = []

    for (const template of templates) {
      try {
        const regex = new RegExp(template.identificationPattern, 'i')
        if (regex.test(extractedText)) {
          matches.push(template)
        }
      } catch (e) {
        // Ignora regex inválida
      }
    }

    if (matches.length === 0) {
      return { status: 'NO_MATCH', templates: [] }
    }

    if (matches.length === 1) {
      return { status: 'SINGLE_MATCH', template: matches[0], templates: matches }
    }

    return { status: 'MULTIPLE_MATCHES', templates: matches }
  }
}

module.exports = PdfTemplateMatcher
```

### 2.4 Routers

#### `src/app/import/pdf/pdf-import-router.js`

```javascript
const express = require('express')
const multer = require('multer')
const { Authorizer, Permissions } = require('interact-utils')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../../app-constants')

const logger = new JsonLog(SERVICE_NAME)

// Configuração do multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
      cb(null, true)
    } else {
      cb(new Error('Apenas arquivos PDF são permitidos'), false)
    }
  },
})

class PdfImportRouter {
  static handleError(exception, res) {
    logger.error('PDF import route error', exception, {
      internal: { method: 'handleError', filename: 'pdf-import-router.js' },
    })
    res.status(exception.statusCode || 500).send({
      message: exception.message || 'Server Error',
      code: exception.code || 'INTERNAL_ERROR',
    })
  }

  static getPublicRoutes(appManager) {
    const router = express.Router()
    const manager = appManager.getPdfImportManager()

    /**
     * POST /v1/public/import/pdf
     * Upload e extração de PDF
     */
    router.post('/import/pdf',
      Authorizer.getMiddleware(Permissions.SERVICES),
      upload.single('file'),
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const { walletId } = req.body

          if (!req.file) {
            return res.status(400).send({
              message: 'Arquivo PDF é obrigatório',
              code: 'MISSING_FILE',
            })
          }

          if (!walletId) {
            return res.status(400).send({
              message: 'walletId é obrigatório',
              code: 'MISSING_WALLET_ID',
            })
          }

          const result = await manager.uploadAndExtract({
            domain,
            walletId,
            file: req.file,
          })

          res.status(200).send(result)
        } catch (exception) {
          PdfImportRouter.handleError(exception, res)
        }
      })

    /**
     * POST /v1/public/import/pdf/apply-template
     * Aplica template ao PDF
     */
    router.post('/import/pdf/apply-template',
      Authorizer.getMiddleware(Permissions.SERVICES),
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const { logId, templateId } = req.body

          const result = await manager.applyTemplate({ domain, logId, templateId })
          res.status(200).send(result)
        } catch (exception) {
          PdfImportRouter.handleError(exception, res)
        }
      })

    /**
     * POST /v1/public/import/pdf/confirm
     * Confirma importação
     */
    router.post('/import/pdf/confirm',
      Authorizer.getMiddleware(Permissions.SERVICES),
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const { logId, duplicateActions } = req.body

          const result = await manager.confirmImport({ domain, logId, duplicateActions })
          res.status(200).send(result)
        } catch (exception) {
          PdfImportRouter.handleError(exception, res)
        }
      })

    /**
     * POST /v1/public/import/pdf/templates
     * Cria novo template
     */
    router.post('/import/pdf/templates',
      Authorizer.getMiddleware(Permissions.SERVICES),
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const result = await manager.createTemplate({ domain, data: req.body })
          res.status(201).send(result)
        } catch (exception) {
          PdfImportRouter.handleError(exception, res)
        }
      })

    /**
     * GET /v1/public/import/pdf/templates
     * Lista templates do usuário
     */
    router.get('/import/pdf/templates',
      Authorizer.getMiddleware(Permissions.SERVICES),
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const templates = await manager.pdfTemplateDAO.findByUser(domain)
          res.status(200).send(templates)
        } catch (exception) {
          PdfImportRouter.handleError(exception, res)
        }
      })

    /**
     * PUT /v1/public/import/pdf/templates/:id
     * Atualiza template
     */
    router.put('/import/pdf/templates/:id',
      Authorizer.getMiddleware(Permissions.SERVICES),
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const { id } = req.params
          const result = await manager.pdfTemplateDAO.updateTemplate(id, domain, req.body)
          res.status(200).send(result)
        } catch (exception) {
          PdfImportRouter.handleError(exception, res)
        }
      })

    /**
     * DELETE /v1/public/import/pdf/templates/:id
     * Exclui template (soft delete)
     */
    router.delete('/import/pdf/templates/:id',
      Authorizer.getMiddleware(Permissions.SERVICES),
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const { id } = req.params
          await manager.pdfTemplateDAO.softDelete(id, domain)
          res.status(200).send({ message: 'Template excluído com sucesso' })
        } catch (exception) {
          PdfImportRouter.handleError(exception, res)
        }
      })

    /**
     * POST /v1/public/import/pdf/test-template
     * Testa template contra texto
     */
    router.post('/import/pdf/test-template',
      Authorizer.getMiddleware(Permissions.SERVICES),
      async (req, res) => {
        try {
          const domain = req.credentials.domain
          const { template, extractedText } = req.body

          const result = await manager.testTemplate({ domain, template, extractedText })
          res.status(200).send(result)
        } catch (exception) {
          PdfImportRouter.handleError(exception, res)
        }
      })

    return router
  }
}

module.exports = PdfImportRouter
```

---

## 3. Componentes Frontend

### 3.1 Pages

#### `src/pages/import/pdf/PdfImportPage.vue`

```vue
<template>
  <div class="pdf-import-page">
    <header class="page-header">
      <h1>Importar Nota de Corretagem (PDF)</h1>
      <button class="btn-secondary" @click="showTemplateList = true">
        📋 Meus Templates
      </button>
    </header>

    <!-- Step 1: Upload -->
    <PdfUploadStep
      v-if="currentStep === 1"
      :wallet-id="activeWalletId"
      @uploaded="onUploaded"
    />

    <!-- Step 2: Template Detection/Creation -->
    <PdfTemplateSelector
      v-if="currentStep === 2"
      :match-status="uploadResult.matchStatus"
      :matched-templates="uploadResult.matchedTemplates"
      :extracted-text="uploadResult.extractedText"
      :log-id="uploadResult.logId"
      @select="onTemplateSelect"
      @create="onCreateTemplate"
    />

    <!-- Step 3: Template Creator (if no match) -->
    <PdfTemplateCreator
      v-if="currentStep === 3"
      :extracted-text="uploadResult.extractedText"
      :log-id="uploadResult.logId"
      @saved="onTemplateSaved"
      @back="currentStep = 2"
    />

    <!-- Step 4: Preview -->
    <PdfPreviewStep
      v-if="currentStep === 4"
      :valid-rows="extractedData.validRows"
      :invalid-rows="extractedData.invalidRows"
      :duplicates="extractedData.duplicates"
      @confirm="onConfirm"
      @back="currentStep = 2"
    />

    <!-- Step 5: Result -->
    <PdfResultSummary
      v-if="currentStep === 5"
      :result="importResult"
      @done="onDone"
    />

    <!-- Template List Modal -->
    <PdfTemplateList
      v-if="showTemplateList"
      @close="showTemplateList = false"
      @edit="onEditTemplate"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useWalletStore } from '@/stores/wallet'
import { pdfImportService } from './pdf-import.service'
import PdfUploadStep from './PdfUploadStep.vue'
import PdfTemplateSelector from './PdfTemplateSelector.vue'
import PdfTemplateCreator from './PdfTemplateCreator.vue'
import PdfPreviewStep from './PdfPreviewStep.vue'
import PdfResultSummary from './PdfResultSummary.vue'
import PdfTemplateList from './PdfTemplateList.vue'

const walletStore = useWalletStore()

const currentStep = ref(1)
const uploadResult = ref(null)
const extractedData = ref(null)
const importResult = ref(null)
const showTemplateList = ref(false)

const activeWalletId = computed(() => walletStore.activeWallet?._id)

const onUploaded = (result) => {
  uploadResult.value = result
  
  if (result.matchStatus === 'SINGLE_MATCH') {
    // Aplica template automaticamente
    applyTemplateAndPreview(result.matchedTemplate._id)
  } else {
    currentStep.value = 2
  }
}

const onTemplateSelect = (templateId) => {
  applyTemplateAndPreview(templateId)
}

const onCreateTemplate = () => {
  currentStep.value = 3
}

const onTemplateSaved = async (template) => {
  // Aplica o template recém-criado
  await applyTemplateAndPreview(template._id)
}

const applyTemplateAndPreview = async (templateId) => {
  try {
    extractedData.value = await pdfImportService.applyTemplate({
      logId: uploadResult.value.logId,
      templateId,
    })
    currentStep.value = 4
  } catch (error) {
    console.error('Error applying template:', error)
  }
}

const onConfirm = async (duplicateActions) => {
  try {
    importResult.value = await pdfImportService.confirmImport({
      logId: uploadResult.value.logId,
      duplicateActions,
    })
    currentStep.value = 5
  } catch (error) {
    console.error('Error confirming import:', error)
  }
}

const onDone = () => {
  currentStep.value = 1
  uploadResult.value = null
  extractedData.value = null
  importResult.value = null
}

const onEditTemplate = (template) => {
  showTemplateList.value = false
  // TODO: abrir editor de template
}
</script>
```

### 3.2 Components

#### `src/pages/import/pdf/PdfTemplateCreator.vue`

```vue
<template>
  <div class="pdf-template-creator">
    <h2>Criar Template de Extração</h2>

    <div class="creator-layout">
      <!-- Painel esquerdo: Texto extraído -->
      <div class="text-panel">
        <h3>Texto Extraído do PDF</h3>
        <div class="text-content" ref="textContent">
          <pre>{{ extractedText }}</pre>
        </div>
        <p class="hint">Selecione trechos do texto para criar regex automaticamente</p>
      </div>

      <!-- Painel direito: Configuração -->
      <div class="config-panel">
        <div class="form-group">
          <label>Nome do Template *</label>
          <input v-model="template.name" type="text" required />
        </div>

        <div class="form-group">
          <label>Corretora *</label>
          <input v-model="template.brokerName" type="text" required />
        </div>

        <div class="form-group">
          <label>Padrão de Identificação (Regex) *</label>
          <input v-model="template.identificationPattern" type="text" required />
          <p class="hint">Regex que identifica este formato de nota</p>
        </div>

        <h4>Mapeamento de Campos</h4>

        <div 
          v-for="field in requiredFields" 
          :key="field.key"
          class="field-mapping"
        >
          <div class="form-group">
            <label>{{ field.label }} *</label>
            <input 
              v-model="template.fieldMappings[field.key].regex" 
              type="text"
              placeholder="Regex para capturar o valor"
            />
          </div>
          <div class="form-row">
            <div class="form-group small">
              <label>Grupo</label>
              <input 
                v-model.number="template.fieldMappings[field.key].groupIndex" 
                type="number"
                min="1"
              />
            </div>
            <div class="form-group small">
              <label>Transformação</label>
              <select v-model="template.fieldMappings[field.key].transform">
                <option value="">Nenhuma</option>
                <option value="parseFloat">parseFloat</option>
                <option value="replaceComma">Substituir vírgula</option>
                <option value="CtoCOMPRA">C→COMPRA, V→VENDA</option>
              </select>
            </div>
          </div>
        </div>

        <div class="actions">
          <button class="btn-secondary" @click="testTemplate">
            🧪 Testar Template
          </button>
          <button class="btn-primary" @click="saveTemplate">
            💾 Salvar Template
          </button>
        </div>

        <!-- Resultado do teste -->
        <div v-if="testResult" class="test-result">
          <h4>Resultado do Teste</h4>
          <p>{{ testResult.count }} transações extraídas</p>
          <pre>{{ JSON.stringify(testResult.extractedData, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { pdfImportService } from './pdf-import.service'

const props = defineProps({
  extractedText: { type: String, required: true },
  logId: { type: String, required: true },
})

const emit = defineEmits(['saved', 'back'])

const requiredFields = [
  { key: 'ticker', label: 'Ticker' },
  { key: 'date', label: 'Data' },
  { key: 'type', label: 'Tipo (C/V)' },
  { key: 'quantity', label: 'Quantidade' },
  { key: 'unitPrice', label: 'Preço Unitário' },
]

const template = reactive({
  name: '',
  brokerName: '',
  identificationPattern: '',
  fieldMappings: {
    ticker: { regex: '', groupIndex: 1, transform: '' },
    date: { regex: '', groupIndex: 1, transform: '', format: 'DD/MM/YYYY' },
    type: { regex: '', groupIndex: 1, transform: 'CtoCOMPRA' },
    quantity: { regex: '', groupIndex: 1, transform: 'parseInt' },
    unitPrice: { regex: '', groupIndex: 1, transform: 'replaceComma' },
  },
})

const testResult = ref(null)

const testTemplate = async () => {
  testResult.value = await pdfImportService.testTemplate({
    template: {
      ...template,
      fieldMappings: Object.entries(template.fieldMappings).map(([systemField, config]) => ({
        systemField,
        ...config,
      })),
    },
    extractedText: props.extractedText,
  })
}

const saveTemplate = async () => {
  const saved = await pdfImportService.createTemplate({
    ...template,
    fieldMappings: Object.entries(template.fieldMappings).map(([systemField, config]) => ({
      systemField,
      ...config,
    })),
  })
  
  emit('saved', saved)
}
</script>
```

### 3.3 Services

#### `src/pages/import/pdf/pdf-import.service.js`

```javascript
import axios from 'axios'

const API_BASE = '/v1/public'

export const pdfImportService = {
  /**
   * Upload e extração de PDF
   */
  async upload(file, walletId) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('walletId', walletId)

    const response = await axios.post(`${API_BASE}/import/pdf`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    return response.data
  },

  /**
   * Aplica template
   */
  async applyTemplate({ logId, templateId }) {
    const response = await axios.post(`${API_BASE}/import/pdf/apply-template`, {
      logId,
      templateId,
    })
    return response.data
  },

  /**
   * Confirma importação
   */
  async confirmImport({ logId, duplicateActions }) {
    const response = await axios.post(`${API_BASE}/import/pdf/confirm`, {
      logId,
      duplicateActions,
    })
    return response.data
  },

  /**
   * Cria template
   */
  async createTemplate(template) {
    const response = await axios.post(`${API_BASE}/import/pdf/templates`, template)
    return response.data
  },

  /**
   * Lista templates
   */
  async listTemplates() {
    const response = await axios.get(`${API_BASE}/import/pdf/templates`)
    return response.data
  },

  /**
   * Atualiza template
   */
  async updateTemplate(id, data) {
    const response = await axios.put(`${API_BASE}/import/pdf/templates/${id}`, data)
    return response.data
  },

  /**
   * Exclui template
   */
  async deleteTemplate(id) {
    const response = await axios.delete(`${API_BASE}/import/pdf/templates/${id}`)
    return response.data
  },

  /**
   * Testa template
   */
  async testTemplate({ template, extractedText }) {
    const response = await axios.post(`${API_BASE}/import/pdf/test-template`, {
      template,
      extractedText,
    })
    return response.data
  },
}
```

---

## 4. API Contracts

### 4.1 POST /v1/public/import/pdf

**Request**: multipart/form-data
| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| file | File | Sim |
| walletId | string | Sim |

**Response 200**:
```json
{
  "logId": "uuid",
  "extractedText": "NOTA DE NEGOCIAÇÃO...",
  "matchStatus": "SINGLE_MATCH",
  "matchedTemplate": { "_id": "uuid", "name": "Clear" },
  "matchedTemplates": []
}
```

### 4.2 POST /v1/public/import/pdf/templates

**Request Body**:
```json
{
  "name": "Clear",
  "brokerName": "Clear Corretora",
  "identificationPattern": "CLEAR.*CNPJ.*03.016.223/0001-40",
  "fieldMappings": [
    {
      "systemField": "ticker",
      "regex": "(\\w{4}\\d{1,2})",
      "groupIndex": 1
    },
    {
      "systemField": "date",
      "regex": "(\\d{2}/\\d{2}/\\d{4})",
      "groupIndex": 1,
      "format": "DD/MM/YYYY"
    }
  ]
}
```

---

## 5. Estrutura de Arquivos

```
src/
├── app/
│   └── import/
│       └── pdf/
│           ├── pdf-import-router.js
│           ├── pdf-import-manager.js
│           ├── pdf-import-dao.js
│           ├── pdf-import-model.js
│           ├── pdf-template-dao.js
│           ├── pdf-template-model.js
│           ├── pdf-text-extractor.js
│           └── pdf-template-matcher.js
│
├── __tests__/
│   ├── pdf-import.test.js
│   └── pdf-template.test.js
│
└── frontend/
    └── src/
        └── pages/import/
            └── pdf/
                ├── PdfImportPage.vue
                ├── PdfUploadStep.vue
                ├── PdfTemplateSelector.vue
                ├── PdfTemplateCreator.vue
                ├── PdfPreviewStep.vue
                ├── PdfResultSummary.vue
                ├── PdfTemplateList.vue
                └── pdf-import.service.js
```

---

## 6. Ordem de Implementação

| Ordem | Story | Componente | Estimativa | Dependências |
|-------|-------|------------|------------|-------------|
| 1 | EP09-001 | Template Model + DAO + Manager | 21 pts | EP04, EP03 |
| 2 | EP09-002 | Template Matcher + Auto-detect | 8 pts | EP09-001 |
| 3 | EP09-003 | Preview + Confirmação | 8 pts | EP09-001, EP09-002 |
| 4 | - | Frontend completo | 13 pts | EP09-001 a 003 |

**Total**: 50 story points

---

## 7. Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|--------|-----------|
| PDF escaneado (imagem) | Alta | Alto | Informar usuário que OCR não é suportado |
| Regex inválida do usuário | Média | Médio | Validar regex antes de salvar + timeout |
| ReDoS (Regex DoS) | Baixa | Crítico | Timeout de execução + validação de regex |
| Layout de corretora muda | Média | Médio | Permitir edição de templates existentes |
| Múltiplos templates compatíveis | Baixa | Baixo | Interface de seleção entre templates |

---

## 8. Dependências

### Dependências Externas (NPM)
```json
{
  "dependencies": {
    "pdf-parse": "^1.1.1",
    "multer": "^1.4.5-lts.1"
  }
}
```

### Dependências de Épicos
| Épico | Dependência | Tipo |
|-------|-------------|------|
| EP02 | Autenticação JWT | Bloqueante |
| EP03 | Carteiras | Bloqueante |
| EP04 | Transações (DAO) | Bloqueante |
| EP08 | Importação CSV (componentes de preview) | Relacionado |

---

## 9. Checklist de Implementação

### Backend
- [ ] Criar `pdf-template-model.js`
- [ ] Criar `pdf-import-model.js`
- [ ] Implementar `PdfTemplateDAO`
- [ ] Implementar `PdfImportDAO`
- [ ] Implementar `PdfTextExtractor` (pdf-parse)
- [ ] Implementar `PdfTemplateMatcher`
- [ ] Implementar `PdfImportManager`
- [ ] Implementar `PdfImportRouter`
- [ ] Adicionar constantes de erro
- [ ] Testes unitários
- [ ] Testes de integração

### Frontend
- [ ] Criar `PdfImportPage.vue`
- [ ] Criar `PdfUploadStep.vue`
- [ ] Criar `PdfTemplateSelector.vue`
- [ ] Criar `PdfTemplateCreator.vue`
- [ ] Criar `PdfPreviewStep.vue`
- [ ] Criar `PdfResultSummary.vue`
- [ ] Criar `PdfTemplateList.vue`
- [ ] Criar service
- [ ] Testes E2E

---

**Status**: Pronto para implementação
**Próximos passos**: Delegar para @tech-lead iniciar EP09-001

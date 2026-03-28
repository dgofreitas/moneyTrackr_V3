/*eslint-env jest*/
jest.setTimeout(60000)

const AppTest = require('../__mocks__/app-base-test.js')
const config = require('../__mocks__/app.config.js')
const jwt = require('jsonwebtoken')

describe('Transaction API', () => {
  let appTest
  let agent
  let token
  let userId
  let walletId

  const generateToken = (id) => {
    return jwt.sign(
      { userId: id, email: 'test@test.com', name: 'Test User' },
      process.env.JWT_SECRET || config.tokenSecret,
      { expiresIn: '24h' },
    )
  }

  beforeAll(async () => {
    appTest = await AppTest.createApp(config)
    userId = 'user-transaction-test-123'
    token = generateToken(userId)
    agent = require('supertest').agent(appTest.app)
  })

  beforeEach(async () => {
    await AppTest.clearMocks(appTest)

    // Create a wallet for testing
    const walletResponse = await agent
      .post('/v1/wallets')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Wallet', currency: 'BRL' })

    walletId = walletResponse.body._id
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    await AppTest.flushPromises()
  })

  afterAll(async () => {
    await AppTest.clearApp(appTest)
    AppTest.returnConsoleLog()
  })

  // ==================== EP04-001: CRIAR TRANSACAO DE COMPRA ====================

  describe('POST /v1/transactions - Criar Transacao de Compra', () => {
    it('CA-001: Deve criar transacao de compra com sucesso', async () => {
      const transactionData = {
        walletId,
        ticker: 'PETR4',
        type: 'BUY',
        quantity: 100,
        price: 28.50,
        fees: 10.00,
        date: '2026-03-15',
        currency: 'BRL',
        notes: 'Compra inicial',
      }

      const response = await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send(transactionData)

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('transaction')
      expect(response.body).toHaveProperty('position')
      expect(response.body.transaction.ticker).toBe('PETR4')
      expect(response.body.transaction.type).toBe('BUY')
      expect(response.body.transaction.quantity).toBe(100)
      expect(response.body.position.quantity).toBe(100)
      expect(response.body.position.averagePrice).toBe(28.60) // (100*28.50+10)/100
    })

    it('CA-002: Deve acumular compras no mesmo ativo', async () => {
      // Primeira compra
      await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'VALE3',
          type: 'BUY',
          quantity: 100,
          price: 68.00,
          fees: 10.00,
          date: '2026-03-01',
        })

      // Segunda compra
      const response = await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'VALE3',
          type: 'BUY',
          quantity: 50,
          price: 70.00,
          fees: 5.00,
          date: '2026-03-15',
        })

      expect(response.status).toBe(201)
      expect(response.body.position.quantity).toBe(150)
      // totalInvested = (100*68+10) + (50*70+5) = 6810 + 3505 = 10315
      // averagePrice = 10315 / 150 = 68.77
      expect(response.body.position.averagePrice).toBeCloseTo(68.77, 1)
    })

    it('CA-003: Deve normalizar ticker para uppercase', async () => {
      const response = await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'petr4',
          type: 'BUY',
          quantity: 10,
          price: 30.00,
          fees: 0,
          date: '2026-03-15',
        })

      expect(response.status).toBe(201)
      expect(response.body.transaction.ticker).toBe('PETR4')
    })

    it('CA-004: Deve retornar 400 para ticker vazio', async () => {
      const response = await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: '',
          type: 'BUY',
          quantity: 10,
          price: 30.00,
          date: '2026-03-15',
        })

      expect(response.status).toBe(400)
    })

    it('CA-005: Deve retornar 400 para tipo invalido', async () => {
      const response = await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'PETR4',
          type: 'INVALID',
          quantity: 10,
          price: 30.00,
          date: '2026-03-15',
        })

      expect(response.status).toBe(400)
    })

    it('CA-006: Deve retornar 400 para quantidade zero', async () => {
      const response = await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'PETR4',
          type: 'BUY',
          quantity: 0,
          price: 30.00,
          date: '2026-03-15',
        })

      expect(response.status).toBe(400)
    })

    it('CA-007: Deve retornar 400 para preco zero', async () => {
      const response = await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'PETR4',
          type: 'BUY',
          quantity: 10,
          price: 0,
          date: '2026-03-15',
        })

      expect(response.status).toBe(400)
    })

    it('CA-008: Deve retornar 400 para data futura', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 10)

      const response = await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'PETR4',
          type: 'BUY',
          quantity: 10,
          price: 30.00,
          date: futureDate.toISOString().split('T')[0],
        })

      expect(response.status).toBe(400)
    })

    it('CA-009: Deve retornar 400 para taxas negativas', async () => {
      const response = await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'PETR4',
          type: 'BUY',
          quantity: 10,
          price: 30.00,
          fees: -5,
          date: '2026-03-15',
        })

      expect(response.status).toBe(400)
    })

    it('CA-010: Deve retornar 401 sem token', async () => {
      const response = await agent
        .post('/v1/transactions')
        .send({
          walletId,
          ticker: 'PETR4',
          type: 'BUY',
          quantity: 10,
          price: 30.00,
          date: '2026-03-15',
        })

      expect(response.status).toBe(401)
    })
  })

  // ==================== EP04-002: CRIAR TRANSACAO DE VENDA ====================

  describe('POST /v1/transactions - Criar Transacao de Venda', () => {
    beforeEach(async () => {
      // Create a position first
      await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'VALE3',
          type: 'BUY',
          quantity: 100,
          price: 68.00,
          fees: 10.00,
          date: '2026-03-01',
        })
    })

    it('CA-001: Deve criar venda parcial com lucro', async () => {
      const response = await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'VALE3',
          type: 'SELL',
          quantity: 30,
          price: 75.00,
          fees: 8.00,
          date: '2026-03-15',
        })

      expect(response.status).toBe(201)
      expect(response.body.transaction.type).toBe('SELL')
      expect(response.body.position.quantity).toBe(70)
      // P/L = (75*30) - (68.10*30) - 8 = 2250 - 2043 - 8 = 199
      expect(response.body.transaction.realizedPnL).toBeCloseTo(199, 0)
    })

    it('CA-002: Deve criar venda parcial com prejuizo', async () => {
      const response = await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'VALE3',
          type: 'SELL',
          quantity: 50,
          price: 60.00,
          fees: 5.00,
          date: '2026-03-15',
        })

      expect(response.status).toBe(201)
      // P/L = (60*50) - (68.10*50) - 5 = 3000 - 3405 - 5 = -410
      expect(response.body.transaction.realizedPnL).toBeLessThan(0)
    })

    it('CA-003: Deve zerar posicao com venda total', async () => {
      const response = await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'VALE3',
          type: 'SELL',
          quantity: 100,
          price: 70.00,
          fees: 10.00,
          date: '2026-03-15',
        })

      expect(response.status).toBe(201)
      expect(response.body.position.quantity).toBe(0)
      expect(response.body.position.status).toBe('CLOSED')
    })
  })

  // ==================== EP04-003: BLOQUEAR VENDA INVALIDA ====================

  describe('POST /v1/transactions - Validar Venda', () => {
    it('CA-001: Deve retornar 422 para venda sem posicao', async () => {
      const response = await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'WEGE3',
          type: 'SELL',
          quantity: 10,
          price: 30.00,
          date: '2026-03-15',
        })

      expect(response.status).toBe(422)
    })

    it('CA-002: Deve retornar 422 para quantidade insuficiente', async () => {
      // Create position with 10 units
      await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'MGLU3',
          type: 'BUY',
          quantity: 10,
          price: 5.00,
          date: '2026-03-01',
        })

      // Try to sell 15
      const response = await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'MGLU3',
          type: 'SELL',
          quantity: 15,
          price: 6.00,
          date: '2026-03-15',
        })

      expect(response.status).toBe(422)
    })

    it('CA-003: Deve permitir venda igual a posicao', async () => {
      // Create position with 10 units
      await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'BBDC4',
          type: 'BUY',
          quantity: 10,
          price: 30.00,
          date: '2026-03-01',
        })

      // Sell exactly 10
      const response = await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'BBDC4',
          type: 'SELL',
          quantity: 10,
          price: 35.00,
          date: '2026-03-15',
        })

      expect(response.status).toBe(201)
    })
  })

  // ==================== EP04-006: LISTAR TRANSACOES ====================

  describe('GET /v1/transactions - Listar Transacoes', () => {
    beforeEach(async () => {
      // Create multiple transactions
      await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'PETR4',
          type: 'BUY',
          quantity: 100,
          price: 28.00,
          date: '2026-01-15',
        })

      await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'PETR4',
          type: 'BUY',
          quantity: 50,
          price: 30.00,
          date: '2026-02-15',
        })

      await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'VALE3',
          type: 'BUY',
          quantity: 200,
          price: 68.00,
          date: '2026-03-01',
        })
    })

    it('CA-001: Deve listar transacoes paginadas', async () => {
      const response = await agent
        .get('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .query({ walletId })

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('data')
      expect(response.body).toHaveProperty('pagination')
      expect(Array.isArray(response.body.data)).toBe(true)
      expect(response.body.data.length).toBe(3)
    })

    it('CA-002: Deve filtrar por tipo', async () => {
      const response = await agent
        .get('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .query({ walletId, type: 'BUY' })

      expect(response.status).toBe(200)
      expect(response.body.data.every((t) => t.type === 'BUY')).toBe(true)
    })

    it('CA-003: Deve filtrar por ticker', async () => {
      const response = await agent
        .get('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .query({ walletId, ticker: 'PETR4' })

      expect(response.status).toBe(200)
      expect(response.body.data.every((t) => t.ticker === 'PETR4')).toBe(true)
      expect(response.body.data.length).toBe(2)
    })

    it('CA-004: Deve filtrar por periodo', async () => {
      const response = await agent
        .get('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .query({
          walletId,
          startDate: '2026-02-01',
          endDate: '2026-02-28',
        })

      expect(response.status).toBe(200)
      expect(response.body.data.length).toBe(1)
      expect(response.body.data[0].ticker).toBe('PETR4')
    })

    it('CA-005: Deve ordenar por data descendente', async () => {
      const response = await agent
        .get('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .query({ walletId, sortBy: 'date', sortOrder: 'desc' })

      expect(response.status).toBe(200)
      const dates = response.body.data.map((t) => new Date(t.date).getTime())
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i])
      }
    })

    it('CA-006: Deve paginar corretamente', async () => {
      const response = await agent
        .get('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .query({ walletId, page: 1, limit: 2 })

      expect(response.status).toBe(200)
      expect(response.body.data.length).toBe(2)
      expect(response.body.pagination.page).toBe(1)
      expect(response.body.pagination.limit).toBe(2)
      expect(response.body.pagination.total).toBe(3)
      expect(response.body.pagination.totalPages).toBe(2)
    })

    it('CA-007: Isolamento por usuario', async () => {
      const user2Token = generateToken('user-2-test')
      const response = await agent
        .get('/v1/transactions')
        .set('Authorization', `Bearer ${user2Token}`)
        .query({ walletId })

      expect(response.status).toBe(200)
      expect(response.body.data.length).toBe(0)
    })
  })

  // ==================== EP04-005: EDITAR E EXCLUIR ====================

  describe('PUT /v1/transactions/:id - Editar Transacao', () => {
    let transactionId

    beforeEach(async () => {
      const response = await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'ITUB4',
          type: 'BUY',
          quantity: 100,
          price: 30.00,
          date: '2026-03-01',
        })

      transactionId = response.body.transaction._id
    })

    it('CA-001: Deve editar preco da transacao', async () => {
      const response = await agent
        .put(`/v1/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 32.00 })

      expect(response.status).toBe(200)
      expect(response.body.transaction.price).toBe(32.00)
      // Position should be recalculated
      expect(response.body.position.averagePrice).toBe(32.00)
    })

    it('CA-002: Deve editar quantidade da transacao', async () => {
      const response = await agent
        .put(`/v1/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 150 })

      expect(response.status).toBe(200)
      expect(response.body.transaction.quantity).toBe(150)
      expect(response.body.position.quantity).toBe(150)
    })

    it('CA-003: Deve retornar 404 para transacao inexistente', async () => {
      const response = await agent
        .put('/v1/transactions/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 35.00 })

      expect(response.status).toBe(404)
    })

    it('CA-004: Nao deve editar transacao de outro usuario', async () => {
      const user2Token = generateToken('user-2-edit')
      const response = await agent
        .put(`/v1/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ price: 35.00 })

      expect(response.status).toBe(404)
    })
  })

  describe('DELETE /v1/transactions/:id - Excluir Transacao', () => {
    let transactionId

    beforeEach(async () => {
      const response = await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'ABEV3',
          type: 'BUY',
          quantity: 100,
          price: 14.50,
          date: '2026-03-01',
        })

      transactionId = response.body.transaction._id
    })

    it('CA-001: Deve fazer soft delete', async () => {
      const response = await agent
        .delete(`/v1/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.transaction.isDeleted).toBe(true)
      expect(response.body.transaction.deletedAt).toBeDefined()
      // Position should be recalculated (zero)
      expect(response.body.position.quantity).toBe(0)
    })

    it('CA-002: Transacao excluida nao deve aparecer na listagem', async () => {
      await agent
        .delete(`/v1/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${token}`)

      const response = await agent
        .get('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .query({ walletId, ticker: 'ABEV3' })

      expect(response.status).toBe(200)
      expect(response.body.data.length).toBe(0)
    })

    it('CA-003: Deve retornar 404 ao excluir ja excluida', async () => {
      await agent
        .delete(`/v1/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${token}`)

      const response = await agent
        .delete(`/v1/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(404)
    })

    it('CA-004: Nao deve excluir transacao de outro usuario', async () => {
      const user2Token = generateToken('user-2-delete')
      const response = await agent
        .delete(`/v1/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${user2Token}`)

      expect(response.status).toBe(404)
    })
  })

  // ==================== EP04-004: POSICOES ====================

  describe('GET /v1/positions - Listar Posicoes', () => {
    beforeEach(async () => {
      await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'PETR4',
          type: 'BUY',
          quantity: 100,
          price: 28.00,
          date: '2026-03-01',
        })

      await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'VALE3',
          type: 'BUY',
          quantity: 50,
          price: 68.00,
          date: '2026-03-01',
        })
    })

    it('CA-001: Deve listar posicoes ativas', async () => {
      const response = await agent
        .get('/v1/positions')
        .set('Authorization', `Bearer ${token}`)
        .query({ walletId })

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBe(2)
    })

    it('CA-002: Deve filtrar por status', async () => {
      const response = await agent
        .get('/v1/positions')
        .set('Authorization', `Bearer ${token}`)
        .query({ walletId, status: 'ACTIVE' })

      expect(response.status).toBe(200)
      expect(response.body.every((p) => p.status === 'ACTIVE')).toBe(true)
    })

    it('CA-003: Isolamento por usuario', async () => {
      const user2Token = generateToken('user-2-positions')
      const response = await agent
        .get('/v1/positions')
        .set('Authorization', `Bearer ${user2Token}`)
        .query({ walletId })

      expect(response.status).toBe(200)
      expect(response.body.length).toBe(0)
    })
  })

  describe('GET /v1/positions/:ticker - Obter Posicao', () => {
    beforeEach(async () => {
      await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'PETR4',
          type: 'BUY',
          quantity: 100,
          price: 28.00,
          fees: 10.00,
          date: '2026-03-01',
        })
    })

    it('CA-001: Deve retornar posicao por ticker', async () => {
      const response = await agent
        .get('/v1/positions/PETR4')
        .set('Authorization', `Bearer ${token}`)
        .query({ walletId })

      expect(response.status).toBe(200)
      expect(response.body.ticker).toBe('PETR4')
      expect(response.body.quantity).toBe(100)
      expect(response.body.averagePrice).toBe(28.10) // (100*28+10)/100
    })

    it('CA-002: Deve retornar posicao zerada para ativo sem transacoes', async () => {
      const response = await agent
        .get('/v1/positions/WEGE3')
        .set('Authorization', `Bearer ${token}`)
        .query({ walletId })

      expect(response.status).toBe(200)
      expect(response.body.quantity).toBe(0)
      expect(response.body.averagePrice).toBe(0)
    })
  })

  // ==================== RECALCULO DE POSICAO ====================

  describe('Recalculo de Posicao', () => {
    it('Deve recalcular posicao apos edicao', async () => {
      // Create transaction
      const createResponse = await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'BBAS3',
          type: 'BUY',
          quantity: 100,
          price: 40.00,
          date: '2026-03-01',
        })

      const transactionId = createResponse.body.transaction._id

      // Edit price
      const updateResponse = await agent
        .put(`/v1/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 45.00 })

      expect(updateResponse.status).toBe(200)
      expect(updateResponse.body.position.averagePrice).toBe(45.00)
    })

    it('Deve bloquear edicao que causa posicao negativa', async () => {
      // Create buy
      const buyResponse = await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'RENT3',
          type: 'BUY',
          quantity: 50,
          price: 50.00,
          date: '2026-03-01',
        })

      // Create sell
      await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'RENT3',
          type: 'SELL',
          quantity: 30,
          price: 55.00,
          date: '2026-03-15',
        })

      // Try to edit buy to have less quantity than sold
      const editResponse = await agent
        .put(`/v1/transactions/${buyResponse.body.transaction._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 20 }) // Less than 30 sold

      expect(editResponse.status).toBe(422)
    })

    it('Deve recalcular posicao apos exclusao', async () => {
      // Create two buys
      const buy1 = await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'CSNA3',
          type: 'BUY',
          quantity: 100,
          price: 10.00,
          date: '2026-03-01',
        })

      await agent
        .post('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletId,
          ticker: 'CSNA3',
          type: 'BUY',
          quantity: 100,
          price: 12.00,
          date: '2026-03-15',
        })

      // Delete first buy
      const deleteResponse = await agent
        .delete(`/v1/transactions/${buy1.body.transaction._id}`)
        .set('Authorization', `Bearer ${token}`)

      expect(deleteResponse.status).toBe(200)
      expect(deleteResponse.body.position.quantity).toBe(100)
      expect(deleteResponse.body.position.averagePrice).toBe(12.00)
    })
  })
})

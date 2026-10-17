/*eslint-env jest*/
jest.setTimeout(60000)

const AppTest = require('../__mocks__/app-base-test.js')
const config = require('../__mocks__/app.config.js')
const jwt = require('jsonwebtoken')

describe('Wallet API', () => {
  let appTest
  let agent
  let token
  let userId

  const generateToken = (id) => {
    return jwt.sign(
      { userId: id, email: 'test@test.com', name: 'Test User' },
      process.env.JWT_SECRET || config.tokenSecret,
      { expiresIn: '24h' },
    )
  }

  beforeAll(async () => {
    appTest = await AppTest.createApp(config)
    userId = 'user-test-123'
    token = generateToken(userId)
    agent = require('supertest').agent(appTest.app)
  })

  beforeEach(async () => {
    await AppTest.clearMocks(appTest)
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    await AppTest.flushPromises()
  })

  afterAll(async () => {
    await AppTest.clearApp(appTest)
    AppTest.returnConsoleLog()
  })

  // ==================== EP03-001: CRIAR CARTEIRA ====================

  describe('POST /v1/wallets - Criar Carteira', () => {
    it('CA-001: Deve criar carteira com sucesso', async () => {
      const walletData = {
        name: 'Longo Prazo',
        currency: 'BRL',
      }

      const response = await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send(walletData)

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('_id')
      expect(response.body).toHaveProperty('userId', userId)
      expect(response.body).toHaveProperty('name', 'Longo Prazo')
      expect(response.body).toHaveProperty('currency', 'BRL')
      expect(response.body).toHaveProperty('isActive', true)
      expect(response.body).toHaveProperty('isDeleted', false)
    })

    it('CA-002: Primeira carteira deve ser ativa por padrao', async () => {
      const walletData = {
        name: 'Primeira Carteira',
        currency: 'BRL',
      }

      const response = await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send(walletData)

      expect(response.status).toBe(201)
      expect(response.body.isActive).toBe(true)
    })

    it('CA-003: Carteiras subsequentes devem ser inativas', async () => {
      // Criar primeira carteira
      await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Carteira 1', currency: 'BRL' })

      // Criar segunda carteira
      const response = await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Carteira 2', currency: 'BRL' })

      expect(response.status).toBe(201)
      expect(response.body.isActive).toBe(false)
    })

    it('CA-004: Deve retornar 409 para nome duplicado', async () => {
      // Criar primeira carteira
      await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Dividendos', currency: 'BRL' })

      // Tentar criar com mesmo nome
      const response = await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Dividendos', currency: 'BRL' })

      expect(response.status).toBe(409)
    })

    it('CA-005: Deve retornar 400 para nome vazio', async () => {
      const response = await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '', currency: 'BRL' })

      expect(response.status).toBe(400)
    })

    it('CA-006: Deve retornar 400 para nome com mais de 50 caracteres', async () => {
      const response = await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'A'.repeat(51), currency: 'BRL' })

      expect(response.status).toBe(400)
    })

    it('CA-007: Validacao case-insensitive para nome duplicado', async () => {
      // Criar primeira carteira
      await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Minha Carteira', currency: 'BRL' })

      // Tentar criar com mesmo nome em lowercase
      const response = await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'minha carteira', currency: 'BRL' })

      expect(response.status).toBe(409)
    })

    it('Deve criar carteira com moeda USD', async () => {
      const response = await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Internacional', currency: 'USD' })

      expect(response.status).toBe(201)
      expect(response.body.currency).toBe('USD')
    })

    it('Deve criar carteira com nome contendo acentos', async () => {
      const response = await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Renda Fixa Pos-Fixada', currency: 'BRL' })

      expect(response.status).toBe(201)
      expect(response.body.name).toBe('Renda Fixa Pos-Fixada')
    })

    it('Deve retornar 401 sem token', async () => {
      const response = await agent
        .post('/v1/wallets')
        .send({ name: 'Teste', currency: 'BRL' })

      expect(response.status).toBe(401)
    })
  })

  // ==================== EP03-005: LISTAR CARTEIRAS ====================

  describe('GET /v1/wallets - Listar Carteiras', () => {
    it('CA-001: Deve listar carteiras com ativa primeiro', async () => {
      // Criar carteiras
      await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Carteira A', currency: 'BRL' })

      await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Carteira B', currency: 'BRL' })

      // Ativar segunda carteira
      const wallets = await agent
        .get('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)

      const walletB = wallets.body.find((w) => w.name === 'Carteira B')
      if (walletB) {
        await agent
          .put(`/v1/wallets/${walletB._id}/activate`)
          .set('Authorization', `Bearer ${token}`)
      }

      const response = await agent
        .get('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
      if (response.body.length > 0) {
        expect(response.body[0].isActive).toBe(true)
      }
    })

    it('CA-002: Carteiras deletadas nao devem aparecer', async () => {
      // Criar duas carteiras
      const create1 = await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Para Deletar', currency: 'BRL' })

      await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Para Manter', currency: 'BRL' })

      // Deletar primeira
      await agent
        .delete(`/v1/wallets/${create1.body._id}`)
        .set('Authorization', `Bearer ${token}`)

      const response = await agent
        .get('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.find((w) => w.name === 'Para Deletar')).toBeUndefined()
    })

    it('CA-003: Isolamento por usuario', async () => {
      // Criar carteira para usuario 1
      await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'User1 Wallet', currency: 'BRL' })

      // Criar token para usuario 2
      const user2Id = 'user-test-456'
      const user2Token = generateToken(user2Id)

      // Listar carteiras do usuario 2
      const response = await agent
        .get('/v1/wallets')
        .set('Authorization', `Bearer ${user2Token}`)

      expect(response.status).toBe(200)
      expect(response.body.find((w) => w.name === 'User1 Wallet')).toBeUndefined()
    })

    it('CA-004: Deve retornar array vazio para usuario sem carteiras', async () => {
      const newUserToken = generateToken('new-user-789')

      const response = await agent
        .get('/v1/wallets')
        .set('Authorization', `Bearer ${newUserToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toEqual([])
    })
  })

  // ==================== EP03-002: ATIVAR CARTEIRA ====================

  describe('PUT /v1/wallets/:id/activate - Ativar Carteira', () => {
    it('CA-001: Deve ativar carteira com sucesso', async () => {
      // Criar duas carteiras
      const create1 = await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Wallet A', currency: 'BRL' })

      await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Wallet B', currency: 'BRL' })

      // Ativar segunda carteira
      const response = await agent
        .put(`/v1/wallets/${create1.body._id}/activate`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.isActive).toBe(true)
    })

    it('CA-002: Apenas uma carteira deve estar ativa', async () => {
      // Criar duas carteiras
      const create1 = await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Wallet X', currency: 'BRL' })

      const create2 = await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Wallet Y', currency: 'BRL' })

      // Ativar segunda carteira
      await agent
        .put(`/v1/wallets/${create2.body._id}/activate`)
        .set('Authorization', `Bearer ${token}`)

      // Verificar que primeira esta inativa
      const response = await agent
        .get('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)

      const walletX = response.body.find((w) => w._id === create1.body._id)
      const walletY = response.body.find((w) => w._id === create2.body._id)

      expect(walletX.isActive).toBe(false)
      expect(walletY.isActive).toBe(true)
    })

    it('CA-004: Deve retornar 404 para carteira inexistente', async () => {
      const response = await agent
        .put('/v1/wallets/non-existent-id/activate')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(404)
    })

    it('CA-005: Nao deve ativar carteira de outro usuario', async () => {
      // Criar carteira para usuario 1
      const create = await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Other User Wallet', currency: 'BRL' })

      // Tentar ativar com usuario 2
      const user2Token = generateToken('user-test-999')
      const response = await agent
        .put(`/v1/wallets/${create.body._id}/activate`)
        .set('Authorization', `Bearer ${user2Token}`)

      expect(response.status).toBe(404)
    })
  })

  // ==================== EP03-004: EDITAR E EXCLUIR ====================

  describe('PUT /v1/wallets/:id - Editar Carteira', () => {
    it('CA-001: Deve renomear carteira com sucesso', async () => {
      const create = await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Nome Antigo', currency: 'BRL' })

      const response = await agent
        .put(`/v1/wallets/${create.body._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Nome Novo' })

      expect(response.status).toBe(200)
      expect(response.body.name).toBe('Nome Novo')
    })

    it('CA-002: Deve retornar 409 para nome ja existente', async () => {
      await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Alpha', currency: 'BRL' })

      const createBeta = await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Beta', currency: 'BRL' })

      const response = await agent
        .put(`/v1/wallets/${createBeta.body._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Alpha' })

      expect(response.status).toBe(409)
    })

    it('CA-003: Deve alterar moeda sem transacoes', async () => {
      const create = await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Internacional', currency: 'BRL' })

      const response = await agent
        .put(`/v1/wallets/${create.body._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ currency: 'USD' })

      expect(response.status).toBe(200)
      expect(response.body.currency).toBe('USD')
    })
  })

  describe('DELETE /v1/wallets/:id - Excluir Carteira', () => {
    it('CA-005: Deve fazer soft delete com sucesso', async () => {
      // Criar duas carteiras
      const create1 = await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Para Deletar', currency: 'BRL' })

      await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Para Manter', currency: 'BRL' })

      const response = await agent
        .delete(`/v1/wallets/${create1.body._id}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('message')
    })

    it('CA-006: Nao deve excluir unica carteira', async () => {
      const create = await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${generateToken('unique-user')}`)
        .send({ name: 'Unica', currency: 'BRL' })

      const response = await agent
        .delete(`/v1/wallets/${create.body._id}`)
        .set('Authorization', `Bearer ${generateToken('unique-user')}`)

      expect(response.status).toBe(422)
    })

    it('CA-007: Deve auto-ativar outra ao deletar ativa', async () => {
      // Criar duas carteiras
      const create1 = await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Ativa Para Deletar', currency: 'BRL' })

      const create2 = await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Sera Ativada', currency: 'BRL' })

      // Deletar a primeira (ativa)
      const response = await agent
        .delete(`/v1/wallets/${create1.body._id}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('activatedWallet')

      // Verificar que a segunda foi ativada
      const list = await agent
        .get('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)

      const activatedWallet = list.body.find((w) => w._id === create2.body._id)
      expect(activatedWallet.isActive).toBe(true)
    })
  })

  // ==================== EP03-003: VISAO CONSOLIDADA ====================

  describe('GET /v1/wallets/consolidated - Visao Consolidada', () => {
    it('CA-003: Deve excluir carteiras deletadas', async () => {
      // Criar duas carteiras
      const create1 = await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Consolidar A', currency: 'BRL' })

      await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Consolidar B', currency: 'BRL' })

      // Deletar primeira
      await agent
        .delete(`/v1/wallets/${create1.body._id}`)
        .set('Authorization', `Bearer ${token}`)

      const response = await agent
        .get('/v1/wallets/consolidated')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.wallets.find((w) => w.name === 'Consolidar A')).toBeUndefined()
    })

    it('CA-005: Deve retornar dados consolidados', async () => {
      await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Consolidated Test', currency: 'BRL' })

      const response = await agent
        .get('/v1/wallets/consolidated')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('totalBRL')
      expect(response.body).toHaveProperty('exchangeRateDate')
      expect(response.body).toHaveProperty('exchangeAvailable')
      expect(response.body).toHaveProperty('wallets')
      expect(Array.isArray(response.body.wallets)).toBe(true)
    })
  })

  // ==================== GET BY ID ====================

  describe('GET /v1/wallets/:id - Obter Carteira', () => {
    it('Deve retornar carteira por ID', async () => {
      const create = await agent
        .post('/v1/wallets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Get By Id Test', currency: 'BRL' })

      const response = await agent
        .get(`/v1/wallets/${create.body._id}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body._id).toBe(create.body._id)
    })

    it('Deve retornar 404 para carteira inexistente', async () => {
      const response = await agent
        .get('/v1/wallets/non-existent-id')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(404)
    })
  })
})

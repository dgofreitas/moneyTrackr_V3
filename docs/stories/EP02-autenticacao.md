# Story EP02 - Autenticacao e Gestao de Sessao do Usuario

## Informacoes

| Campo | Valor |
|-------|-------|
| Epico | EP02 - Autenticacao |
| Tipo | Feature |
| Prioridade | Must Have (Alta) |
| Estimativa | 21 story points (XL) |
| Sprint | 1-2 |
| Dependencias | EP01 - Arquitetura (infraestrutura Docker, Nginx, MongoDB, Redis) |
| Bloqueia | EP03 - Carteiras, EP04 - Transacoes, EP17 - Navegacao (rotas protegidas) |

---

## Contexto e Objetivo

**Como** usuario do MoneyTrackr,
**Eu quero** me autenticar de forma segura usando minha conta Google ou email/senha,
**Para que** eu possa acessar meu portfolio de investimentos de forma protegida e personalizada.

### Contexto de Negocio

A autenticacao e o pilar fundamental do MoneyTrackr. Sem ela, nenhum dado de investimento pode ser associado a um usuario, nenhuma carteira pode ser criada e nenhuma transacao pode ser registrada. Este epico deve ser implementado primeiro (apos a infraestrutura) pois todos os demais epicos dependem de um usuario autenticado.

O sistema deve suportar dois fluxos de autenticacao:
1. **Login Social (Google OAuth 2.0)** - para reduzir friccao no onboarding, permitindo login com um clique
2. **Login Tradicional (email/senha)** - para usuarios que preferem nao vincular conta Google

Alem disso, o sistema deve prover mecanismo de recuperacao de senha por email, garantindo que usuarios nao fiquem bloqueados.

### Metricas de Sucesso
- Taxa de conversao no cadastro >= 80% (usuarios que iniciam o fluxo e completam)
- Tempo medio de login < 3 segundos
- Zero senhas armazenadas em texto plano
- Sessoes expiram automaticamente apos periodo de inatividade

---

## Criterios de Aceite (BDD/Gherkin)

### Feature: Login com Google (OAuth 2.0)

```gherkin
Cenario: Login com Google - usuario novo
  DADO que o usuario acessa a tela de login
  E possui uma conta Google valida
  QUANDO ele clica no botao "Entrar com Google"
  E autoriza o acesso no popup de consentimento do Google
  ENTAO o sistema deve receber o authorization code do Google
  E trocar o code por um access_token via Google OAuth API
  E obter os dados do perfil (email, nome, avatar, googleId)
  E criar automaticamente uma conta no MoneyTrackr com esses dados
  E gerar um JWT token com payload { userId, email, name }
  E armazenar a sessao no Redis com TTL de 24 horas
  E retornar o JWT token ao frontend
  E redirecionar o usuario para o Dashboard

Cenario: Login com Google - usuario existente
  DADO que o usuario ja possui conta no MoneyTrackr vinculada ao Google
  QUANDO ele faz login com Google
  ENTAO o sistema deve identificar o usuario pelo googleId
  E atualizar os dados do perfil (nome, avatar) caso tenham mudado
  E gerar um novo JWT token
  E armazenar a sessao no Redis
  E retornar o JWT token ao frontend

Cenario: Login com Google - falha na autorizacao
  DADO que o usuario acessa a tela de login
  QUANDO ele clica no botao "Entrar com Google"
  E cancela ou nega a autorizacao no popup do Google
  ENTAO o sistema deve exibir mensagem "Autorizacao cancelada. Tente novamente."
  E o usuario deve permanecer na tela de login

Cenario: Login com Google - email ja cadastrado com senha
  DADO que existe um usuario cadastrado com email "user@email.com" via formulario
  QUANDO outra pessoa faz login com Google usando o mesmo email
  ENTAO o sistema deve vincular a conta Google ao usuario existente
  E permitir login tanto por Google quanto por email/senha a partir de entao
```

### Feature: Login com Email e Senha

```gherkin
Cenario: Registro de novo usuario com email e senha
  DADO que o usuario acessa a tela de cadastro
  QUANDO ele preenche os campos:
    | campo           | valor               |
    | nome            | Joao Silva          |
    | email           | joao@email.com      |
    | senha           | MinhaSenh@123       |
    | confirmar senha | MinhaSenh@123       |
  E clica em "Criar Conta"
  ENTAO o sistema deve validar que o email nao esta em uso
  E hash da senha deve ser gerado com bcrypt (salt rounds = 12)
  E criar o usuario no MongoDB
  E gerar um JWT token
  E armazenar a sessao no Redis
  E retornar o JWT token ao frontend
  E redirecionar para o Dashboard

Cenario: Registro com email ja existente
  DADO que ja existe um usuario com email "joao@email.com"
  QUANDO outro usuario tenta se registrar com o mesmo email
  ENTAO o sistema deve retornar status 409 (Conflict)
  E exibir mensagem "Este email ja esta cadastrado. Faca login ou recupere sua senha."

Cenario: Registro com dados invalidos
  DADO que o usuario acessa a tela de cadastro
  QUANDO ele submete o formulario com dados invalidos
  ENTAO o sistema deve validar e rejeitar:
    | campo  | valor invalido     | mensagem esperada                              |
    | nome   | ""                 | "Nome e obrigatorio"                           |
    | nome   | "A"                | "Nome deve ter no minimo 2 caracteres"         |
    | email  | "email-invalido"   | "Email invalido"                               |
    | email  | ""                 | "Email e obrigatorio"                          |
    | senha  | "123"              | "Senha deve ter no minimo 8 caracteres"        |
    | senha  | "senhasimples"     | "Senha deve conter maiuscula, minuscula, numero e caractere especial" |
    | senha  | ""                 | "Senha e obrigatoria"                          |
    | confirmar | "outraSenha"    | "As senhas nao conferem"                       |

Cenario: Login com email e senha validos
  DADO que o usuario possui conta cadastrada com email "joao@email.com"
  QUANDO ele informa email "joao@email.com" e senha correta
  E clica em "Entrar"
  ENTAO o sistema deve verificar a senha com bcrypt.compare()
  E gerar um JWT token com expiracao de 24 horas
  E armazenar a sessao no Redis
  E retornar o JWT token ao frontend
  E redirecionar para o Dashboard

Cenario: Login com senha incorreta
  DADO que o usuario possui conta cadastrada
  QUANDO ele informa email correto e senha incorreta
  ENTAO o sistema deve retornar status 401 (Unauthorized)
  E exibir mensagem "Email ou senha incorretos"
  E NAO revelar se o email existe ou nao (seguranca)

Cenario: Login com email inexistente
  DADO que nao existe usuario com o email informado
  QUANDO ele tenta fazer login
  ENTAO o sistema deve retornar status 401 (Unauthorized)
  E exibir a mesma mensagem "Email ou senha incorretos"

Cenario: Bloqueio por tentativas excessivas
  DADO que o usuario errou a senha 5 vezes consecutivas
  QUANDO ele tenta fazer login novamente
  ENTAO o sistema deve retornar status 429 (Too Many Requests)
  E exibir mensagem "Muitas tentativas. Tente novamente em 15 minutos."
  E registrar o bloqueio no Redis com TTL de 15 minutos
```

### Feature: Recuperacao de Senha

```gherkin
Cenario: Solicitar recuperacao de senha - email existente
  DADO que o usuario esqueceu sua senha
  QUANDO ele acessa a tela "Esqueci minha senha"
  E informa o email "joao@email.com" cadastrado
  E clica em "Enviar link de recuperacao"
  ENTAO o sistema deve gerar um token unico (UUID v4)
  E armazenar o token no Redis com TTL de 1 hora
  E enviar um email com link: {FRONTEND_URL}/reset-password?token={token}
  E exibir mensagem "Se o email estiver cadastrado, voce recebera um link de recuperacao."

Cenario: Solicitar recuperacao de senha - email inexistente
  DADO que o usuario informa um email nao cadastrado
  QUANDO ele solicita recuperacao de senha
  ENTAO o sistema deve exibir a mesma mensagem generica (seguranca)
  E NAO enviar nenhum email
  E NAO revelar que o email nao existe

Cenario: Redefinir senha com token valido
  DADO que o usuario recebeu o email de recuperacao
  E o token ainda e valido (menos de 1 hora)
  QUANDO ele acessa o link de recuperacao
  E informa a nova senha "NovaSenha@456"
  E confirma a nova senha
  E clica em "Redefinir Senha"
  ENTAO o sistema deve validar o token no Redis
  E atualizar o hash da senha no MongoDB
  E invalidar o token no Redis (uso unico)
  E invalidar todas as sessoes anteriores do usuario
  E exibir mensagem "Senha redefinida com sucesso. Faca login."
  E redirecionar para a tela de login

Cenario: Redefinir senha com token expirado
  DADO que o token de recuperacao foi gerado ha mais de 1 hora
  QUANDO o usuario tenta usar o link
  ENTAO o sistema deve retornar status 400 (Bad Request)
  E exibir mensagem "Link expirado. Solicite um novo link de recuperacao."

Cenario: Redefinir senha com token ja utilizado
  DADO que o token ja foi utilizado anteriormente
  QUANDO o usuario tenta reutilizar o link
  ENTAO o sistema deve retornar status 400 (Bad Request)
  E exibir mensagem "Link invalido ou ja utilizado."
```

### Feature: Gestao de Sessao (JWT + Redis)

```gherkin
Cenario: Acesso a rota protegida com token valido
  DADO que o usuario esta autenticado com JWT valido
  QUANDO ele faz uma requisicao a qualquer rota /api/*
  ENTAO o middleware deve extrair o token do header Authorization: Bearer {token}
  E validar a assinatura do JWT
  E verificar se a sessao existe no Redis
  E anexar os dados do usuario ao req.user
  E prosseguir para o handler da rota

Cenario: Acesso a rota protegida sem token
  DADO que a requisicao nao possui header Authorization
  QUANDO ela chega a uma rota protegida
  ENTAO o middleware deve retornar status 401 (Unauthorized)
  E corpo { "message": "Token nao fornecido" }

Cenario: Acesso com token expirado
  DADO que o JWT do usuario expirou (mais de 24h)
  QUANDO ele faz uma requisicao
  ENTAO o middleware deve retornar status 401 (Unauthorized)
  E corpo { "message": "Token expirado" }
  E o frontend deve redirecionar para a tela de login

Cenario: Refresh de token
  DADO que o usuario possui um JWT valido proximo da expiracao (menos de 1 hora)
  QUANDO ele faz uma requisicao
  ENTAO o middleware deve gerar um novo JWT
  E retornar o novo token no header X-New-Token
  E atualizar a sessao no Redis
  E o frontend deve substituir o token armazenado

Cenario: Logout
  DADO que o usuario esta autenticado
  QUANDO ele clica em "Sair"
  ENTAO o frontend deve chamar POST /api/auth/logout
  E o sistema deve remover a sessao do Redis
  E o frontend deve remover o token do localStorage
  E redirecionar para a tela de login
```

---

## Detalhamento Tecnico

### Backend

#### User Model (`src/app/auth/user-model.js`)

```javascript
// Schema do usuario
{
  _id: { type: String, required: true, default: uuidv4 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  password: { type: String, default: null },         // hash bcrypt, null para login apenas Google
  googleId: { type: String, default: null, sparse: true, unique: true },
  avatar: { type: String, default: null },            // URL do avatar (Google ou gravatar)
  provider: { type: String, enum: ['local', 'google', 'both'], default: 'local' },
  status: { type: String, enum: ['active', 'inactive', 'blocked'], default: 'active' },
  lastLoginAt: { type: Date, default: null },
  loginAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}

// Indices
{ email: 1 }          // busca por email (unique)
{ googleId: 1 }       // busca por Google ID (sparse unique)
{ status: 1 }         // filtragem por status
```

#### Auth Router (`src/app/auth/auth-router.js`)

| Metodo | Rota | Descricao | Auth | Request Body | Response |
|--------|------|-----------|------|-------------|----------|
| POST | `/api/auth/register` | Registro com email/senha | Nao | `{ name, email, password, confirmPassword }` | `201 { user, token }` |
| POST | `/api/auth/login` | Login com email/senha | Nao | `{ email, password }` | `200 { user, token }` |
| POST | `/api/auth/google` | Login/registro com Google | Nao | `{ code }` (authorization code) | `200 { user, token }` |
| POST | `/api/auth/forgot-password` | Solicitar reset de senha | Nao | `{ email }` | `200 { message }` |
| POST | `/api/auth/reset-password` | Redefinir senha | Nao | `{ token, password, confirmPassword }` | `200 { message }` |
| POST | `/api/auth/logout` | Encerrar sessao | Sim (JWT) | - | `200 { message }` |
| GET | `/api/auth/me` | Obter dados do usuario logado | Sim (JWT) | - | `200 { user }` |
| PUT | `/api/auth/me` | Atualizar perfil | Sim (JWT) | `{ name, avatar }` | `200 { user }` |

#### Auth Manager (`src/app/auth/auth-manager.js`)

Responsabilidades e metodos:

```
class AuthManager {
  constructor(appManager, appDB)

  // Registro
  async register({ name, email, password, confirmPassword })
    - Valida campos obrigatorios e formato
    - Verifica se email ja existe
    - Hash da senha com bcrypt (salt rounds = 12)
    - Cria usuario no MongoDB via AuthDAO
    - Gera JWT token
    - Armazena sessao no Redis
    - Retorna { user, token }

  // Login email/senha
  async login({ email, password })
    - Verifica bloqueio por tentativas (Redis)
    - Busca usuario por email
    - Compara senha com bcrypt.compare()
    - Em caso de falha: incrementa loginAttempts, bloqueia apos 5 tentativas
    - Em caso de sucesso: reseta loginAttempts, atualiza lastLoginAt
    - Gera JWT e sessao Redis
    - Retorna { user, token }

  // Login Google OAuth
  async googleAuth({ code })
    - Troca authorization code por tokens via Google OAuth2 API
    - Obtem perfil do usuario via Google People/UserInfo API
    - Busca usuario por googleId OU email
    - Se nao existe: cria usuario com provider 'google'
    - Se existe com email (provider 'local'): vincula Google e muda provider para 'both'
    - Se existe com googleId: atualiza dados e faz login
    - Gera JWT e sessao Redis
    - Retorna { user, token }

  // Recuperacao de senha
  async forgotPassword({ email })
    - Busca usuario por email (silenciosamente falha se nao encontrar)
    - Gera token UUID v4
    - Armazena no Redis: key=reset:{token}, value={userId}, TTL=3600s
    - Envia email com link de recuperacao
    - Retorna mensagem generica

  async resetPassword({ token, password, confirmPassword })
    - Valida token no Redis
    - Busca userId associado ao token
    - Hash da nova senha
    - Atualiza senha no MongoDB
    - Remove token do Redis (uso unico)
    - Invalida todas as sessoes do usuario no Redis
    - Retorna mensagem de sucesso

  // Sessao
  async logout({ userId, sessionId })
    - Remove sessao do Redis
    - Retorna confirmacao

  async getProfile({ userId })
    - Busca usuario por ID
    - Retorna dados sem campos sensiveis (sem password)

  async updateProfile({ userId, name, avatar })
    - Atualiza campos permitidos
    - Retorna usuario atualizado

  // Helpers internos
  _generateJWT(user)
    - Payload: { userId: user._id, email: user.email, name: user.name }
    - Expiracao: 24 horas
    - Assinado com JWT_SECRET do config

  _createSession({ userId, token })
    - Redis SET session:{userId}:{sessionId} com TTL 24h
    - Permite multiplas sessoes simultaneas (multi-device)

  _validatePassword(password)
    - Minimo 8 caracteres
    - Pelo menos 1 maiuscula, 1 minuscula, 1 numero, 1 caractere especial

  _sanitizeUser(user)
    - Remove password, loginAttempts, lockedUntil dos dados retornados
}
```

#### Auth DAO (`src/app/auth/auth-dao.js`)

```
class AuthDAO extends AppDAO {
  initializeDBModel(db)       // Registra model 'user' com userSchema
  async findByEmail(email)    // Busca por email (case-insensitive)
  async findByGoogleId(id)    // Busca por Google ID
  async create(userData)      // Cria usuario
  async updateById(id, data)  // Atualiza usuario por ID
  async updatePassword(id, passwordHash) // Atualiza apenas a senha
  async incrementLoginAttempts(id)  // Incrementa tentativas de login
  async resetLoginAttempts(id)      // Reseta tentativas apos login sucesso
}
```

#### JWT Middleware (`src/app/auth/jwt-middleware.js`)

```
function jwtMiddleware(config, redisClient) {
  return async (req, res, next) => {
    1. Extrai token do header Authorization: Bearer {token}
    2. Se nao tem token: 401 "Token nao fornecido"
    3. Verifica assinatura do JWT com jsonwebtoken.verify()
    4. Se expirado: 401 "Token expirado"
    5. Verifica sessao no Redis: GET session:{userId}:{sessionId}
    6. Se sessao nao existe: 401 "Sessao invalida"
    7. Anexa decoded payload em req.user = { userId, email, name }
    8. Se token expira em < 1 hora: gera novo token, seta header X-New-Token
    9. Chama next()
  }
}
```

#### Constantes de Erro (`src/app/app-constants.js`)

```javascript
ERRORS: {
  // Auth
  INVALID_CREDENTIALS: { statusCode: 401, message: 'Email ou senha incorretos' },
  TOKEN_NOT_PROVIDED: { statusCode: 401, message: 'Token nao fornecido' },
  TOKEN_EXPIRED: { statusCode: 401, message: 'Token expirado' },
  SESSION_INVALID: { statusCode: 401, message: 'Sessao invalida' },
  EMAIL_ALREADY_EXISTS: { statusCode: 409, message: 'Este email ja esta cadastrado' },
  ACCOUNT_LOCKED: { statusCode: 429, message: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  INVALID_RESET_TOKEN: { statusCode: 400, message: 'Link invalido ou ja utilizado' },
  RESET_TOKEN_EXPIRED: { statusCode: 400, message: 'Link expirado. Solicite um novo link.' },
  INVALID_PASSWORD_FORMAT: { statusCode: 400, message: 'Senha nao atende aos requisitos minimos' },
  USER_NOT_FOUND: { statusCode: 404, message: 'Usuario nao encontrado' },
  GOOGLE_AUTH_FAILED: { statusCode: 401, message: 'Falha na autenticacao com Google' },
}
```

#### Configuracao Google OAuth (`config/app.json`)

```json
{
  "auth": {
    "jwtSecret": "OVERRIDDEN_BY_ENV",
    "jwtExpiresIn": "24h",
    "bcryptSaltRounds": 12,
    "maxLoginAttempts": 5,
    "lockDurationMinutes": 15,
    "resetTokenTTLSeconds": 3600,
    "sessionTTLSeconds": 86400
  },
  "google": {
    "clientId": "OVERRIDDEN_BY_ENV",
    "clientSecret": "OVERRIDDEN_BY_ENV",
    "redirectUri": "OVERRIDDEN_BY_ENV",
    "tokenUrl": "https://oauth2.googleapis.com/token",
    "userInfoUrl": "https://www.googleapis.com/oauth2/v2/userinfo"
  }
}
```

#### Variaveis de Ambiente

```
JWT_SECRET=<chave secreta para assinatura JWT>
GOOGLE_CLIENT_ID=<Google OAuth client ID>
GOOGLE_CLIENT_SECRET=<Google OAuth client secret>
GOOGLE_REDIRECT_URI=<URL de callback, ex: https://moneytrackr.com/api/auth/google/callback>
SMTP_HOST=<servidor SMTP para envio de emails>
SMTP_PORT=<porta SMTP>
SMTP_USER=<usuario SMTP>
SMTP_PASS=<senha SMTP>
SMTP_FROM=<email remetente, ex: noreply@moneytrackr.com>
FRONTEND_URL=<URL do frontend, ex: https://moneytrackr.com>
```

#### Fluxo Google OAuth 2.0 (Sequencia)

```
1. Frontend: Usuario clica "Entrar com Google"
2. Frontend: Redireciona para Google Authorization URL:
   https://accounts.google.com/o/oauth2/v2/auth?
     client_id={GOOGLE_CLIENT_ID}&
     redirect_uri={GOOGLE_REDIRECT_URI}&
     response_type=code&
     scope=openid email profile&
     access_type=offline
3. Google: Usuario autoriza no popup
4. Google: Redireciona para {GOOGLE_REDIRECT_URI}?code={authorization_code}
5. Frontend: Captura o code e envia POST /api/auth/google { code }
6. Backend: Troca code por access_token via POST https://oauth2.googleapis.com/token
7. Backend: Obtém perfil via GET https://www.googleapis.com/oauth2/v2/userinfo
8. Backend: Cria/atualiza usuario, gera JWT, cria sessao Redis
9. Backend: Retorna { user, token } ao frontend
10. Frontend: Armazena token e redireciona para Dashboard
```

---

### Frontend

#### Paginas e Rotas

| Rota | Pagina | Auth | Descricao |
|------|--------|------|-----------|
| `/login` | LoginPage | Nao | Formulario de login + botao Google |
| `/register` | RegisterPage | Nao | Formulario de cadastro |
| `/forgot-password` | ForgotPasswordPage | Nao | Solicitar link de recuperacao |
| `/reset-password` | ResetPasswordPage | Nao | Redefinir senha (com token na URL) |
| `/dashboard` | DashboardPage | Sim | Pagina principal (rota protegida) |

#### Componentes

```
src/
  components/
    auth/
      LoginForm.{jsx|vue}           # Formulario email/senha com validacao
      RegisterForm.{jsx|vue}        # Formulario de cadastro com confirmacao de senha
      GoogleLoginButton.{jsx|vue}   # Botao "Entrar com Google" (inicia OAuth flow)
      ForgotPasswordForm.{jsx|vue}  # Formulario de recuperacao
      ResetPasswordForm.{jsx|vue}   # Formulario de nova senha
      PasswordStrengthMeter.{jsx|vue} # Indicador visual de forca da senha
      AuthLayout.{jsx|vue}          # Layout compartilhado das telas de auth (logo, card centralizado)
    common/
      ProtectedRoute.{jsx|vue}      # HOC/guard que verifica token antes de renderizar
      LoadingSpinner.{jsx|vue}      # Indicador de carregamento
      Alert.{jsx|vue}               # Componente de mensagens (erro, sucesso, aviso)
```

#### Servico de Autenticacao (`src/services/auth-service.js`)

```
class AuthService {
  // API calls
  async register({ name, email, password, confirmPassword })
  async login({ email, password })
  async googleAuth({ code })
  async forgotPassword({ email })
  async resetPassword({ token, password, confirmPassword })
  async logout()
  async getProfile()
  async updateProfile({ name, avatar })

  // Token management
  getToken()                    // Retorna token do localStorage
  setToken(token)               // Armazena token no localStorage
  removeToken()                 // Remove token do localStorage
  isAuthenticated()             // Verifica se token existe e nao expirou
  decodeToken()                 // Decodifica payload do JWT (sem verificar assinatura)
  getTokenExpiration()          // Retorna data de expiracao do token

  // Axios interceptors
  setupInterceptors(axiosInstance)
    - Request: adiciona Authorization: Bearer {token} em todas as requests
    - Response: se receber header X-New-Token, atualiza token armazenado
    - Response: se receber 401, remove token e redireciona para /login
}
```

#### Guarda de Rotas (ProtectedRoute)

```
// Logica do ProtectedRoute
1. Verificar se AuthService.isAuthenticated() retorna true
2. Se NAO autenticado: redirecionar para /login com return URL
3. Se autenticado: renderizar componente filho
4. Ao montar: chamar AuthService.getProfile() para validar sessao no servidor
5. Se perfil falhar (401): limpar token e redirecionar para /login
```

#### Comportamento da UI

- **LoginPage**: Dois blocos visuais separados - botao Google (destaque) e formulario email/senha
- **Links de navegacao**: "Criar conta" na tela de login, "Ja tenho conta" na tela de registro, "Esqueci minha senha" na tela de login
- **Validacao em tempo real**: Campos validados enquanto o usuario digita (debounce 300ms)
- **PasswordStrengthMeter**: Barra colorida (vermelha/amarela/verde) indicando forca da senha
- **Feedback**: Toast/snackbar para erros e sucesso, loading spinner durante requests
- **Responsividade**: Telas de auth devem funcionar em mobile (card centralizado, inputs full-width)

---

## Estrutura de Arquivos

```
moneyTrackr/
  backend/
    src/
      app/
        auth/
          auth-router.js          # Rotas HTTP de autenticacao
          auth-manager.js         # Logica de negocio (register, login, OAuth, reset)
          auth-dao.js             # Acesso a dados do usuario (MongoDB)
          user-model.js           # Schema Mongoose do usuario
          jwt-middleware.js       # Middleware de validacao JWT + sessao Redis
        app-constants.js          # + constantes de erro de autenticacao
        app-manager.js            # + inicializacao do AuthManager
        app-service.js            # + registro das rotas de auth
      services/
        email-service.js          # Servico de envio de emails (SMTP)
        google-oauth-service.js   # Client para Google OAuth API
      __tests__/
        auth.test.js              # Testes de integracao da autenticacao
      __mocks__/
        google-oauth-mock.js      # Mock das APIs do Google
        email-service-mock.js     # Mock do servico de email

  frontend/
    src/
      pages/
        auth/
          LoginPage.{jsx|vue}
          RegisterPage.{jsx|vue}
          ForgotPasswordPage.{jsx|vue}
          ResetPasswordPage.{jsx|vue}
      components/
        auth/
          LoginForm.{jsx|vue}
          RegisterForm.{jsx|vue}
          GoogleLoginButton.{jsx|vue}
          ForgotPasswordForm.{jsx|vue}
          ResetPasswordForm.{jsx|vue}
          PasswordStrengthMeter.{jsx|vue}
          AuthLayout.{jsx|vue}
        common/
          ProtectedRoute.{jsx|vue}
      services/
        auth-service.js           # API client + token management
        api.js                    # Axios instance com interceptors
      router/
        index.js                  # + rotas de auth + guards
      store/
        auth.{js|ts}              # Estado global de autenticacao (user, token, isAuthenticated)
```

---

## Dependencias Tecnicas

### Pacotes NPM (Backend)

| Pacote | Versao | Finalidade |
|--------|--------|------------|
| `jsonwebtoken` | ^9.x | Geracao e verificacao de JWT |
| `bcrypt` | ^5.x | Hash de senhas |
| `googleapis` ou `google-auth-library` | ^9.x | OAuth 2.0 com Google |
| `nodemailer` | ^6.x | Envio de emails SMTP |
| `uuid` | ^9.x | Geracao de tokens de reset (ja presente) |
| `express-rate-limit` | ^7.x | Rate limiting nas rotas de auth |

### Pacotes NPM (Frontend)

| Pacote | Versao | Finalidade |
|--------|--------|------------|
| `axios` | ^1.x | HTTP client com interceptors |
| `jwt-decode` | ^4.x | Decodificacao do JWT no frontend |
| `@react-oauth/google` ou equivalente Vue | latest | Componente de login Google |

### Infraestrutura

- **Redis**: Armazenamento de sessoes (key: `session:{userId}:{sessionId}`, TTL: 24h) e tokens de reset (key: `reset:{token}`, TTL: 1h) e rate limiting (key: `login_attempts:{email}`, TTL: 15min)
- **MongoDB**: Collection `users` com indices em `email` (unique) e `googleId` (sparse unique)
- **Nginx**: Proxy das rotas `/api/auth/*` para o backend, headers CORS configurados
- **SMTP**: Servidor de email para envio de links de recuperacao (pode usar servico externo como SendGrid, Mailgun ou SMTP proprio)

---

## Cenarios de Teste

### Testes de Integracao (Backend)

```
Cenario 1: Registro completo com email/senha
  - POST /api/auth/register com dados validos -> 201
  - Verificar usuario criado no MongoDB
  - Verificar senha hashada (nao e texto plano)
  - Verificar JWT retornado e valido
  - Verificar sessao criada no Redis

Cenario 2: Registro com email duplicado
  - POST /api/auth/register (primeira vez) -> 201
  - POST /api/auth/register (mesmo email) -> 409

Cenario 3: Registro com dados invalidos
  - POST /api/auth/register sem nome -> 400
  - POST /api/auth/register com email invalido -> 400
  - POST /api/auth/register com senha fraca -> 400
  - POST /api/auth/register com senhas diferentes -> 400

Cenario 4: Login com credenciais validas
  - Registrar usuario
  - POST /api/auth/login com credenciais corretas -> 200
  - Verificar JWT retornado

Cenario 5: Login com credenciais invalidas
  - POST /api/auth/login com senha errada -> 401
  - POST /api/auth/login com email inexistente -> 401

Cenario 6: Bloqueio por tentativas excessivas
  - 5x POST /api/auth/login com senha errada -> 401
  - 6a tentativa -> 429

Cenario 7: Fluxo Google OAuth
  - POST /api/auth/google com code valido (mockado) -> 200
  - Verificar usuario criado com googleId
  - Verificar JWT retornado

Cenario 8: Google OAuth com email existente (vinculacao)
  - Registrar usuario com email X via formulario
  - POST /api/auth/google com mesmo email -> 200
  - Verificar provider mudou para 'both'

Cenario 9: Recuperacao de senha - fluxo completo
  - Registrar usuario
  - POST /api/auth/forgot-password -> 200
  - Verificar token criado no Redis (mock do email)
  - POST /api/auth/reset-password com token valido -> 200
  - POST /api/auth/login com nova senha -> 200
  - POST /api/auth/login com senha antiga -> 401

Cenario 10: Reset com token expirado/invalido
  - POST /api/auth/reset-password com token inexistente -> 400
  - POST /api/auth/reset-password com token expirado -> 400

Cenario 11: Middleware JWT - rotas protegidas
  - GET /api/auth/me sem token -> 401
  - GET /api/auth/me com token invalido -> 401
  - GET /api/auth/me com token valido -> 200

Cenario 12: Logout
  - Login + obter token
  - POST /api/auth/logout -> 200
  - GET /api/auth/me com token anterior -> 401 (sessao removida)

Cenario 13: Refresh de token
  - Login com token que expira em < 1 hora (mock do tempo)
  - GET /api/auth/me -> 200 + header X-New-Token presente
```

### Testes Unitarios (Frontend)

```
Cenario F1: LoginForm - renderizacao
  - Deve renderizar campos email, senha, botao Entrar
  - Deve renderizar link "Esqueci minha senha"
  - Deve renderizar link "Criar conta"

Cenario F2: LoginForm - validacao
  - Deve exibir erro ao submeter com campos vazios
  - Deve exibir erro com email invalido
  - Deve desabilitar botao durante loading

Cenario F3: RegisterForm - validacao de senha
  - Deve exibir PasswordStrengthMeter
  - Deve indicar forca fraca/media/forte
  - Deve exibir erro quando senhas nao conferem

Cenario F4: GoogleLoginButton
  - Deve renderizar botao com icone Google
  - Deve iniciar fluxo OAuth ao clicar

Cenario F5: ProtectedRoute
  - Deve redirecionar para /login quando nao autenticado
  - Deve renderizar componente filho quando autenticado

Cenario F6: AuthService - token management
  - setToken deve armazenar no localStorage
  - getToken deve retornar token armazenado
  - removeToken deve limpar localStorage
  - isAuthenticated deve retornar false com token expirado

Cenario F7: Interceptors Axios
  - Deve adicionar header Authorization em requests
  - Deve atualizar token ao receber X-New-Token
  - Deve redirecionar para /login ao receber 401
```

---

## Consideracoes de Seguranca

| Aspecto | Implementacao |
|---------|---------------|
| Armazenamento de senha | bcrypt com salt rounds = 12 (nunca texto plano) |
| JWT Secret | Variavel de ambiente, nunca hardcoded, minimo 256 bits |
| Token no frontend | localStorage (com interceptor para auto-refresh) |
| Rate limiting | express-rate-limit: 5 tentativas/15min por IP+email na rota /login |
| Respostas genericas | Login e forgot-password nunca revelam se email existe |
| HTTPS | Obrigatorio em producao (terminacao TLS no Nginx) |
| CORS | Restrito ao dominio do frontend |
| Headers | helmet.js para headers de seguranca (X-Frame-Options, CSP, etc.) |
| Sanitizacao | Inputs sanitizados contra XSS e injection |
| Google OAuth | State parameter para prevenir CSRF |
| Reset token | Uso unico, TTL 1 hora, UUID v4 (imprevisivel) |
| Sessoes | Redis com TTL, invalidacao em cascata no reset de senha |

---

## Definicao de Pronto (DoD)

### Backend
- [ ] User Model implementado com schema completo e indices
- [ ] Auth Router com todas as 8 rotas implementadas e documentadas
- [ ] Auth Manager com toda a logica de negocio
- [ ] Auth DAO com todos os metodos de acesso a dados
- [ ] JWT Middleware funcional e integrado nas rotas protegidas
- [ ] Google OAuth Service implementado e testavel
- [ ] Email Service implementado para envio de links de recuperacao
- [ ] Rate limiting configurado nas rotas de auth
- [ ] Constantes de erro adicionadas ao app-constants.js
- [ ] Variaveis de ambiente documentadas e validadas na inicializacao

### Frontend
- [ ] LoginPage completa com formulario e botao Google
- [ ] RegisterPage com validacao em tempo real e indicador de forca de senha
- [ ] ForgotPasswordPage funcional
- [ ] ResetPasswordPage funcional com validacao de token
- [ ] ProtectedRoute guard implementado
- [ ] AuthService com token management e interceptors
- [ ] Store/estado global de autenticacao
- [ ] Todas as telas responsivas (mobile + desktop)

### Qualidade
- [ ] Codigo revisado por @code-reviewer
- [ ] Cobertura de testes >= 90% no modulo auth (backend)
- [ ] Todos os 13 cenarios de integracao (backend) passando
- [ ] Todos os 7 cenarios unitarios (frontend) passando
- [ ] Testes de seguranca: nenhuma senha em texto plano, tokens expiram corretamente
- [ ] Lint passando sem erros (yarn lint)

### Infraestrutura
- [ ] Redis configurado para sessoes e rate limiting
- [ ] MongoDB com indices criados na collection users
- [ ] Nginx configurado para proxy das rotas /api/auth/*
- [ ] Variaveis de ambiente configuradas no docker-compose

### Documentacao
- [ ] OpenAPI spec atualizada com rotas de auth
- [ ] Variaveis de ambiente documentadas no README
- [ ] PR criado por @merge-request

---

## Notas Tecnicas

### Decisoes Arquiteturais

1. **JWT vs Sessions tradicionais**: Optamos por JWT stateless com sessao Redis como backup. O JWT carrega os dados basicos do usuario (userId, email, name) e o Redis valida se a sessao ainda e ativa. Isso permite invalidacao imediata (logout, reset de senha) sem perder a vantagem de nao precisar consultar o banco em toda requisicao.

2. **bcrypt vs argon2**: bcrypt com salt rounds 12 foi escolhido por ser amplamente suportado, ter implementacao madura em Node.js e oferecer seguranca adequada. Argon2 e superior em benchmarks de resistencia a GPU, mas a diferenca e irrelevante para o escopo deste projeto.

3. **Google OAuth flow (Authorization Code)**: Usamos o fluxo Authorization Code (nao Implicit) porque o backend troca o code pelo token de forma segura, sem expor o access_token ao browser.

4. **Multiplas sessoes**: Um usuario pode estar logado em multiplos dispositivos simultaneamente. Cada sessao tem sua propria chave no Redis (`session:{userId}:{sessionId}`). O logout invalida apenas a sessao atual. O reset de senha invalida todas.

5. **Rate limiting por IP + email**: O rate limit e aplicado pela combinacao de IP + email para evitar ataques de forca bruta. Apenas a rota de login tem rate limiting agressivo (5 tentativas/15min). As demais rotas publicas tem rate limit mais permissivo (100 req/min).

6. **Email service desacoplado**: O EmailService e injetado como dependencia no AuthManager, permitindo facil substituicao por mock nos testes e por diferentes provedores em producao (SMTP, SendGrid, SES, etc.).

### Ordem de Implementacao Sugerida

```
1. User Model + Auth DAO          (fundacao de dados)
2. JWT Middleware                  (infraestrutura de seguranca)
3. Auth Manager - register/login  (fluxo basico)
4. Auth Router - register/login   (exposicao HTTP)
5. Frontend - LoginPage + RegisterPage + AuthService
6. Auth Manager - Google OAuth     (fluxo social)
7. Frontend - GoogleLoginButton
8. Auth Manager - forgot/reset password + Email Service
9. Frontend - ForgotPasswordPage + ResetPasswordPage
10. Frontend - ProtectedRoute + interceptors
11. Testes de integracao completos
12. Testes de seguranca e revisao
```

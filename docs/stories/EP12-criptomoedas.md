# EP12 — Criptomoedas

> **Épico**: 12 — Criptomoedas
> **Versão**: 1.0
> **Data**: 2026-03-27
> **Status**: Ready for Architect

---

## Visão Geral

Criptomoedas são uma classe de ativos com características únicas: operam 24/7, possuem alta volatilidade, taxas em moeda do próprio ativo (gas fees), e exigem atualização de preços em alta frequência. O MoneyTrackr deve suportar compra e venda de criptomoedas reaproveitando os modelos de Transaction e Position existentes (com `assetType: 'CRYPTO'`), integrando com APIs de preços em tempo real (CoinGecko, Binance) e oferecendo uma seção dedicada no frontend com preços atualizados e gráficos sparkline.

**Impacto no Negócio**: Criptomoedas representam uma parcela crescente dos portfólios de investidores brasileiros. Sem suporte a cripto, o MoneyTrackr não atende investidores multi-asset, reduzindo o TAM (Total Addressable Market) significativamente. A atualização em alta frequência é diferencial competitivo frente a apps que atualizam apenas 1x/dia.

**Métricas-alvo**:
- Atualização de preços a cada 30 segundos (configurável)
- Suporte a pelo menos 100 criptomoedas (top por market cap)
- Latência de exibição < 1s após atualização do preço
- Precisão de 8 casas decimais para quantidades (padrão cripto)

**Dependências de Épicos**:
- Épico 4 (Transações) — reuso do modelo de transações
- Épico 5 (Preço Médio) — cálculo de preço médio com taxas
- Épico 6 (Câmbio) — conversão USD/BRL para criptos cotadas em dólar
- Épico 13 (Fontes de Dados) — CoinGecko e Binance como fontes
- Épico 14 (Atualização de Dados) — scheduler de alta frequência

---

## Stories

---

### EP12-001 Registrar Compra e Venda de Criptomoedas

**Como** investidor que opera criptomoedas
**Eu quero** registrar compras e vendas de cripto com taxas (incluindo gas fees e taxas de exchange)
**Para que** o sistema calcule meu preço médio corretamente e eu tenha controle total sobre meu portfólio cripto

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points (L)

**Contexto**:
Criptomoedas utilizam os mesmos modelos de Transaction e Position já existentes (Épicos 4 e 5), mas com `assetType: 'CRYPTO'`. As particularidades incluem: (1) quantidade com até 8 casas decimais (ex: 0.00045000 BTC); (2) taxas podem ser em BRL, USD ou na própria cripto; (3) tickers seguem formato diferente (BTC, ETH, SOL — sem sufixo de bolsa); (4) preços podem ter grande variação de magnitude (BTC ~R$ 500.000 vs SHIB ~R$ 0,00005). O cálculo de preço médio segue a mesma fórmula: `(total investido + taxas) / quantidade total`.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário registra compra de 0.5 BTC a R$ 250.000,00 (preço unitário R$ 500.000,00) com taxa de R$ 125,00
      QUANDO a transação é salva
      ENTÃO a posição de BTC deve ser criada com quantidade 0.5, custo total R$ 250.125,00 e preço médio R$ 500.250,00

- [ ] DADO que o usuário já possui 0.5 BTC a preço médio de R$ 500.250,00 e compra mais 0.3 BTC a R$ 480.000,00 (unitário) com taxa de R$ 72,00
      QUANDO a transação é salva
      ENTÃO o preço médio deve ser recalculado: (250.125 + 144.072) / 0.8 = R$ 492.746,25

- [ ] DADO que o usuário possui 0.8 BTC e tenta vender 1.0 BTC
      QUANDO a transação é submetida
      ENTÃO o sistema deve bloquear a operação com erro "Quantidade insuficiente" (consistente com Épico 4)

- [ ] DADO que o usuário registra compra de 1.000.000 SHIB a R$ 0,00005 por unidade
      QUANDO a transação é salva
      ENTÃO o sistema deve armazenar e exibir corretamente valores com alta precisão decimal

- [ ] DADO que o usuário registra uma compra com taxa em BTC (0.0001 BTC de gas fee)
      QUANDO a transação é salva
      ENTÃO o sistema deve converter a taxa para BRL usando a cotação do momento e incluir no custo total

**Dependências**:
- Bloqueada por: EP04 (Transações), EP05 (Preço Médio), EP06 (Câmbio)
- Bloqueia: EP12-002, EP12-003

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação da API atualizada (Swagger)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

**Extensão do Modelo Transaction** (`src/app/transaction/transaction-model.js`):
```javascript
// Adicionar ao schema existente:
assetType: {
  type: String,
  enum: ['STOCK', 'FII', 'ETF', 'BDR', 'FIXED_INCOME', 'CRYPTO'],
  default: 'STOCK',
  index: true,
},
// Para cripto, campos adicionais:
feeAsset: { type: String },          // moeda da taxa (ex: 'BTC', 'ETH', 'BRL')
feeInAsset: { type: Number },        // valor da taxa na moeda do ativo
feeExchangeRate: { type: Number },   // taxa de câmbio usada para converter fee
```

**Extensão do Modelo Position** (`src/app/position/position-model.js`):
```javascript
// Adicionar ao schema existente:
assetType: {
  type: String,
  enum: ['STOCK', 'FII', 'ETF', 'BDR', 'FIXED_INCOME', 'CRYPTO'],
  default: 'STOCK',
  index: true,
},
decimalPrecision: { type: Number, default: 2 },  // 8 para cripto, 2 para ações
```

**Rotas** (integradas ao router existente):
```
POST /api/transactions
  Body: {
    walletId: 'xxx',
    ticker: 'BTC',
    assetType: 'CRYPTO',
    type: 'BUY',
    quantity: 0.5,
    unitPrice: 500000.00,
    fee: 125.00,
    feeAsset: 'BRL',       // opcional, default BRL
    date: '2026-03-27',
  }
  Response: 201 { transaction: {...}, position: {...} }

GET /api/transactions?assetType=CRYPTO&walletId=xxx
  (filtro adicionado ao endpoint existente)

GET /api/positions?assetType=CRYPTO&walletId=xxx
  (filtro adicionado ao endpoint existente)
```

**Precisão Decimal**:
- Usar `Number` do MongoDB com validação no manager
- Armazenar quantidades com até 8 casas decimais
- Armazenar preços com até 8 casas decimais
- Na exibição: formatar conforme magnitude (BTC: 8 casas, ETH: 6, stablecoins: 2)

**Conversão de Taxa em Cripto**:
```javascript
if (feeAsset !== 'BRL') {
  const exchangeRate = await this.priceService.getCurrentPrice(feeAsset, 'BRL')
  feeBRL = feeInAsset * exchangeRate
  transaction.feeExchangeRate = exchangeRate
  transaction.fee = feeBRL
}
```

**Cenários de Teste**:
- Cenário 1: Compra de 0.5 BTC com taxa em BRL → posição criada, preço médio correto
- Cenário 2: Segunda compra de BTC → preço médio recalculado corretamente
- Cenário 3: Venda parcial de ETH → quantidade reduzida, preço médio mantido
- Cenário 4: Venda total → posição zerada, preço médio resetado
- Cenário 5: Tentativa de vender mais que possui → erro 400
- Cenário 6: Compra de SHIB com valor muito pequeno → precisão mantida
- Cenário 7: Taxa em BTC (gas fee) → convertida para BRL e incluída no custo
- Cenário 8: Filtrar transações por assetType=CRYPTO → apenas transações cripto retornadas
- Cenário 9: Filtrar posições por assetType=CRYPTO → apenas posições cripto retornadas

---

### EP12-002 Atualização de Preços em Alta Frequência

**Como** investidor de criptomoedas
**Eu quero** que os preços dos meus ativos cripto sejam atualizados automaticamente em alta frequência (a cada 30s)
**Para que** eu veja a valorização em tempo quase real, refletindo a volatilidade do mercado cripto

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points (L)

**Contexto**:
Diferente de ações (atualizadas em intervalos maiores — Épico 14), criptomoedas operam 24/7 e exigem atualização mais frequente. O sistema deve usar um scheduler dedicado que consulta CoinGecko (primária) ou Binance API (fallback) a cada 30 segundos para os tickers que o usuário possui em carteira. Os preços devem ser armazenados em Redis para acesso imediato e persistidos em MongoDB para histórico. O frontend deve receber atualizações via polling ou Server-Sent Events (SSE).

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário possui BTC e ETH em carteira
      QUANDO o scheduler de cripto executa
      ENTÃO os preços de BTC e ETH devem ser atualizados no Redis com TTL de 60 segundos e timestamp da última atualização

- [ ] DADO que o preço de BTC foi atualizado no backend
      QUANDO o frontend faz polling (ou recebe SSE)
      ENTÃO o preço exibido na tela deve refletir o novo valor em menos de 5 segundos

- [ ] DADO que a API CoinGecko está indisponível ou retorna rate limit (HTTP 429)
      QUANDO o scheduler tenta atualizar preços
      ENTÃO deve automaticamente usar Binance API como fallback e registrar o evento no log

- [ ] DADO que o usuário não possui nenhuma criptomoeda em carteira
      QUANDO o scheduler executa
      ENTÃO não deve fazer nenhuma chamada às APIs de preço (otimização de recursos)

- [ ] DADO que o scheduler está rodando a cada 30 segundos
      QUANDO há 50 tickers cripto distintos na base de usuários
      ENTÃO deve agrupar as consultas em batch (máximo 1 request por API por ciclo) para respeitar rate limits

**Dependências**:
- Bloqueada por: EP12-001, EP13 (Fontes de Dados), EP14 (Atualização de Dados)
- Bloqueia: EP12-003

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura >= 90%
- [ ] Testes de integração passando (scheduler com API mock)
- [ ] Teste de carga: 50 tickers atualizados em < 10s
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação da API atualizada (Swagger)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

**Scheduler de Alta Frequência** (`src/app/crypto/crypto-price-scheduler.js`):
```javascript
class CryptoPriceScheduler {
  constructor(appManager, redisClient) {
    this.appManager = appManager
    this.redisClient = redisClient
    this.interval = process.env.CRYPTO_UPDATE_INTERVAL || 30000 // 30s
    this.providers = [
      new CoinGeckoProvider(),
      new BinanceProvider(),
    ]
  }

  async start() {
    // 1. Buscar tickers cripto únicos de todas as posições ativas
    // 2. Se nenhum ticker, não agendar
    // 3. Iniciar setInterval com this.interval
    this.timer = setInterval(() => this.updatePrices(), this.interval)
  }

  async updatePrices() {
    const tickers = await this.getActiveCryptoTickers()
    if (tickers.length === 0) return

    for (const provider of this.providers) {
      try {
        const prices = await provider.getBatchPrices(tickers)
        await this.storePrices(prices)
        return // sucesso, não tentar próximo provider
      } catch (error) {
        logger.error(`Provider ${provider.name} failed`, error)
        continue // tentar fallback
      }
    }
  }

  async storePrices(prices) {
    const pipeline = this.redisClient.pipeline()
    for (const { ticker, priceUSD, priceBRL, change24h, volume24h } of prices) {
      const data = JSON.stringify({
        ticker, priceUSD, priceBRL, change24h, volume24h,
        updatedAt: new Date().toISOString(),
      })
      pipeline.set(`crypto:price:${ticker}`, data, 'EX', 60)
    }
    await pipeline.exec()
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
  }
}
```

**Providers** (`src/app/crypto/providers/`):

```
src/app/crypto/
  crypto-price-scheduler.js
  providers/
    coingecko-provider.js
    binance-provider.js
    base-provider.js
```

**CoinGecko Provider**:
```javascript
// GET https://api.coingecko.com/api/v3/simple/price
//   ?ids=bitcoin,ethereum,solana
//   &vs_currencies=usd,brl
//   &include_24hr_change=true
//   &include_24hr_vol=true
// Rate limit: 10-30 req/min (free tier)
```

**Binance Provider (fallback)**:
```javascript
// GET https://api.binance.com/api/v3/ticker/price?symbols=["BTCUSDT","ETHUSDT"]
// Rate limit: 1200 req/min
```

**Mapeamento de Tickers**:
```javascript
const TICKER_MAP = {
  BTC: { coingecko: 'bitcoin', binance: 'BTCUSDT' },
  ETH: { coingecko: 'ethereum', binance: 'ETHUSDT' },
  SOL: { coingecko: 'solana', binance: 'SOLUSDT' },
  // ... expandir conforme necessidade
}
```

**Redis Storage Pattern**:
```
Key:   crypto:price:BTC
Value: { "ticker": "BTC", "priceUSD": 97500.00, "priceBRL": 502125.00, "change24h": -2.3, "volume24h": 45000000000, "updatedAt": "..." }
TTL:   60 seconds
```

**Endpoint de Preços em Tempo Real**:
```
GET /api/crypto/prices
  Query: ?tickers=BTC,ETH,SOL
  Response: {
    prices: [
      { ticker: 'BTC', priceUSD: 97500.00, priceBRL: 502125.00, change24h: -2.3, updatedAt: '...' },
      ...
    ],
    source: 'COINGECKO',
    cachedAt: '...',
  }

// SSE endpoint (opcional, fase 2)
GET /api/crypto/prices/stream
  Response: text/event-stream com updates a cada 30s
```

**Variáveis de Ambiente**:
```
CRYPTO_UPDATE_INTERVAL=30000          # intervalo em ms
COINGECKO_API_KEY=                     # opcional para tier gratuito
BINANCE_API_KEY=                       # opcional para tier gratuito
CRYPTO_PRICE_CACHE_TTL=60             # TTL do cache em segundos
```

**Cenários de Teste**:
- Cenário 1: Scheduler atualiza BTC e ETH → preços salvos no Redis com TTL correto
- Cenário 2: CoinGecko retorna 429 → fallback para Binance com sucesso
- Cenário 3: Ambas as APIs falham → log de erro, preços antigos mantidos no Redis até TTL expirar
- Cenário 4: Nenhum ticker cripto ativo → scheduler não faz chamadas de API
- Cenário 5: 50 tickers em batch → uma única requisição por API (não 50 individuais)
- Cenário 6: Preço atualizado no Redis → endpoint GET retorna valor atualizado
- Cenário 7: Redis indisponível → buscar direto da API e retornar (sem cache)
- Cenário 8: Verificar que scheduler respeita intervalo configurável via env var

---

### EP12-003 Exibir Valorização e Seção Cripto no Frontend

**Como** investidor de criptomoedas
**Eu quero** ver uma seção dedicada a cripto com valor atual, percentual de ganho, ganho absoluto e gráficos sparkline
**Para que** eu acompanhe a performance dos meus ativos cripto de forma visual e intuitiva

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points (L)

**Contexto**:
O frontend deve oferecer uma seção "Criptomoedas" acessível via sidebar (Épico 18) com: (1) cards por ativo mostrando preço atual, variação 24h, quantidade possuída, valor total e ganho/perda; (2) tabela detalhada com todas as posições cripto; (3) gráficos sparkline (mini-gráficos de linha dos últimos 7 dias) para cada ativo; (4) atualização automática via polling a cada 30s (sincronizado com o scheduler do backend).

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário possui 0.5 BTC comprados a preço médio de R$ 500.000,00 e o preço atual é R$ 520.000,00
      QUANDO acessa a seção de Criptomoedas
      ENTÃO deve ver: Preço Atual R$ 520.000,00 | Valor Total R$ 260.000,00 | Ganho +R$ 10.000,00 (+4,00%) com indicador visual verde

- [ ] DADO que o preço de ETH caiu 5% nas últimas 24h
      QUANDO o card de ETH é exibido
      ENTÃO o indicador de variação 24h deve mostrar -5,00% com indicador visual vermelho

- [ ] DADO que o usuário está na seção de Criptomoedas há 2 minutos
      QUANDO o polling atualiza os preços (4 atualizações em 2 min)
      ENTÃO os valores exibidos devem atualizar automaticamente sem necessidade de refresh manual, com animação suave na transição de valores

- [ ] DADO que o ativo BTC possui histórico de preços dos últimos 7 dias
      QUANDO o card de BTC é exibido
      ENTÃO deve conter um gráfico sparkline mostrando a tendência de preço dos últimos 7 dias

- [ ] DADO que o usuário possui criptomoedas e ações na mesma carteira
      QUANDO acessa o Dashboard (Épico 19)
      ENTÃO o valor total da carteira deve incluir o valor atualizado das criptomoedas convertido para BRL

**Dependências**:
- Bloqueada por: EP12-001, EP12-002
- Bloqueia: Nenhuma (end of chain)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] Testes de responsividade (mobile e desktop)
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação atualizada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

**Endpoint de Posições Cripto com Valorização**:
```
GET /api/positions/crypto/valuation
  Query: ?walletId=xxx
  Response: {
    totalValueBRL: 350000.00,
    totalCostBRL: 320000.00,
    totalGainBRL: 30000.00,
    totalGainPercent: 9.375,
    positions: [
      {
        ticker: 'BTC',
        quantity: 0.5,
        avgPrice: 500000.00,
        currentPrice: 520000.00,
        currentValue: 260000.00,
        cost: 250000.00,
        gainBRL: 10000.00,
        gainPercent: 4.00,
        change24h: -2.3,
        sparklineData: [495000, 498000, 510000, 505000, 515000, 518000, 520000],
      },
      {
        ticker: 'ETH',
        quantity: 2.0,
        avgPrice: 17500.00,
        currentPrice: 18000.00,
        currentValue: 36000.00,
        // ...
      },
    ],
  }
```

**Endpoint de Sparkline Data**:
```
GET /api/crypto/sparkline/:ticker
  Query: ?days=7
  Response: {
    ticker: 'BTC',
    prices: [
      { date: '2026-03-21', price: 495000 },
      { date: '2026-03-22', price: 498000 },
      // ... 7 dias
    ],
  }
```

**Frontend — Estrutura de Componentes** (`src/pages/crypto/`):
```
src/pages/crypto/
  CryptoPage.jsx                  // página principal
  components/
    CryptoPortfolioSummary.jsx    // cards de resumo (total investido, valor atual, ganho)
    CryptoAssetCard.jsx           // card individual por ativo
    CryptoAssetTable.jsx          // tabela detalhada de posições
    CryptoSparkline.jsx           // mini-gráfico de 7 dias
    CryptoPriceIndicator.jsx      // indicador verde/vermelho de variação
  hooks/
    useCryptoPrices.js            // hook de polling a cada 30s
    useCryptoValuation.js         // hook para cálculos de valorização
```

**Hook de Polling**:
```javascript
const useCryptoPrices = (tickers, interval = 30000) => {
  const [prices, setPrices] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPrices = async () => {
      const response = await api.get('/crypto/prices', { params: { tickers: tickers.join(',') } })
      setPrices(response.data.prices)
      setLoading(false)
    }

    fetchPrices()
    const timer = setInterval(fetchPrices, interval)
    return () => clearInterval(timer)
  }, [tickers, interval])

  return { prices, loading }
}
```

**Sparkline Chart**:
- Usar biblioteca leve (ex: `react-sparklines` ou `recharts` em modo minimal)
- Dimensões fixas: 120px x 40px
- Cor: verde se preço subiu nos 7 dias, vermelho se caiu
- Sem eixos, labels ou tooltips (clean sparkline)

**Cálculos de Valorização**:
```
valorAtual      = quantidade * precoAtual
custoTotal      = quantidade * precoMedio
ganhoAbsoluto   = valorAtual - custoTotal
ganhoPercentual = ((valorAtual - custoTotal) / custoTotal) * 100
```

**Responsividade**:
- Desktop: grid de cards 3 por linha + tabela completa abaixo
- Tablet: grid 2 por linha
- Mobile: grid 1 por linha, tabela com scroll horizontal

**Cenários de Teste**:
- Cenário 1: Exibir card de BTC com ganho de 4% → indicador verde, valores corretos
- Cenário 2: Exibir card de ETH com perda de 5% → indicador vermelho, valores corretos
- Cenário 3: Polling atualiza preços → valores na tela mudam com animação
- Cenário 4: Sparkline de BTC com tendência de alta → linha verde ascendente
- Cenário 5: Sparkline de ETH com tendência de queda → linha vermelha descendente
- Cenário 6: Usuário sem cripto → exibir estado vazio com CTA "Adicionar primeira cripto"
- Cenário 7: Loading state → skeleton loading nos cards e tabela
- Cenário 8: Responsividade mobile → cards em coluna única, tabela com scroll
- Cenário 9: Valor total da carteira no dashboard inclui cripto → soma correta
- Cenário 10: Alta precisão decimal → SHIB exibido com notação adequada (ex: R$ 0,00005)

---

## Mapa de Dependências

```
EP04 (Transações) ────┐
EP05 (Preço Médio) ───┤
EP06 (Câmbio) ────────┤
EP13 (APIs) ──────────┤
EP14 (Atualização) ───┤
                      ▼
              EP12-001 (Registrar)
                      │
                      ▼
              EP12-002 (Atualizar Preços)
                      │
                      ▼
              EP12-003 (Exibir Valorização)
                      │
                      ▼
              EP19 (Dashboard) — integração do valor cripto no total
```

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Rate limit das APIs de preço (CoinGecko free: 10-30 req/min) | Alta | Alto | Batch requests + cache Redis + fallback Binance |
| Precisão de 8 casas decimais com JavaScript floating point | Alta | Crítico | Usar aritmética de inteiros (multiplicar por 10^8) ou library `decimal.js` para cálculos financeiros |
| Volatilidade extrema gerando UX confusa (preço muda muito rápido) | Média | Médio | Animação suave de transição + limitar frequência visual a 30s |
| CoinGecko deprecia ou muda API | Baixa | Alto | Padrão Strategy permite adicionar novos providers facilmente |
| Gas fees em cripto não-BRL | Média | Médio | Conversão automática usando cotação do momento + armazenar taxa usada |
| Mapeamento de tickers incorreto entre exchanges | Média | Alto | Tabela de mapeamento centralizada com testes de validação |
| Alto consumo de recursos com muitos tickers | Média | Médio | Atualizar apenas tickers de posições ativas + batch requests |
| Stablecoins com variação mínima consumindo recursos | Baixa | Baixo | Frequência reduzida para stablecoins (5 min ao invés de 30s) |

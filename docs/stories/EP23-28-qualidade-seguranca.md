# Épicos 23–28 — Qualidade, Segurança e Experiência Cross-Cutting

> **Produto**: MoneyTrackr — Gestor de Investimentos
> **Escopo**: Concerns transversais que afetam toda a aplicação
> **Épicos**: 23 (Feedback UX), 24 (Editor de Gráficos), 25 (Auditoria), 26 (Performance), 27 (Segurança Frontend), 28 (Responsividade)
> **Data de criação**: 2026-03-27
> **Status**: Pronto para @architect

---

## Mapa de Dependências

```
EP-16 (Layout Base) ──┐
EP-17 (Navegação) ────┤
EP-18 (Sidebar) ──────┼──► EP-28 (Responsividade) ──► EP-23 (Feedback UX)
EP-19 (Dashboard) ────┤                                      │
EP-20 (Gráficos) ─────┼──► EP-24 (Editor de Gráficos)       │
EP-21 (Transações UI)─┤                                      ▼
EP-22 (Formulários) ──┼──► EP-26 (Performance)         EP-27 (Segurança FE)
EP-04 (Transações) ───┼──► EP-25 (Auditoria)
EP-02 (Autenticação) ─┘
```

---

# Épico 23 — Feedback UX

---

### [STORY-2301] Indicadores de Carregamento (Loading States)

**Como** usuário do MoneyTrackr
**Eu quero** ver indicadores visuais enquanto dados estão sendo carregados
**Para que** eu saiba que o sistema está processando minha solicitação e não pense que travou

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points

**Contexto**:
Toda interação que envolve chamadas à API precisa de feedback visual imediato. O sistema deve exibir skeleton screens para carregamentos iniciais de página e spinners inline para ações pontuais (salvar, deletar). A ausência de feedback de loading é a principal causa de cliques duplos e frustração do usuário.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário acessa uma página que depende de dados da API (ex.: Dashboard, Transações)
      QUANDO os dados ainda estão sendo carregados
      ENTÃO o sistema deve exibir skeleton screens com a mesma estrutura visual da página final (tabelas, cards, gráficos)

- [ ] DADO que o usuário executa uma ação que dispara requisição à API (ex.: salvar transação, deletar carteira)
      QUANDO a requisição está em andamento
      ENTÃO o botão acionado deve exibir spinner inline, ficar desabilitado e impedir duplo clique

- [ ] DADO que o carregamento de uma página excede 300ms
      QUANDO o skeleton screen já está visível
      ENTÃO uma barra de progresso sutil (top bar) deve aparecer no topo da viewport

- [ ] DADO que a requisição é concluída com sucesso ou erro
      QUANDO o feedback de loading estava ativo
      ENTÃO o indicador deve desaparecer com transição suave (fade-out de 200ms)

- [ ] DADO que o usuário navega para uma rota que usa lazy loading
      QUANDO o chunk do componente está sendo carregado
      ENTÃO deve exibir um spinner centralizado com fallback de Suspense

**Dependências**:
- Bloqueada por: STORY-1601 (Layout Base), STORY-2101 (Transações UI)
- Bloqueia: STORY-2304 (Empty States)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Criar componente reutilizável `<SkeletonLoader>` com variantes: `text`, `card`, `table-row`, `chart`
- Criar componente `<ButtonSpinner>` que envolve botões de ação com estado `loading`
- Usar `<Suspense>` nativo do React/Vue para lazy-loaded routes com fallback de spinner
- Implementar `<TopProgressBar>` (estilo NProgress) ativado por interceptor Axios
- Interceptor Axios global para gerenciar estado de loading via store/context
- Debounce de 300ms antes de exibir skeleton (evitar flash em respostas rápidas)

*Estrutura de Arquivos*:
```
src/
  components/
    feedback/
      SkeletonLoader.vue          # Componente skeleton com variantes
      SkeletonLoader.test.js
      ButtonSpinner.vue            # Botão com spinner inline
      ButtonSpinner.test.js
      TopProgressBar.vue           # Barra de progresso global
      TopProgressBar.test.js
  composables/
    useLoading.js                  # Hook/composable de estado de loading
    useLoading.test.js
  plugins/
    axios-loading-interceptor.js   # Interceptor para gerenciar loading
```

**Cenários de Teste**:
- Cenário 1: Skeleton aparece ao acessar Dashboard sem dados em cache
- Cenário 2: Spinner inline aparece no botão "Salvar Transação" durante POST
- Cenário 3: Barra de progresso aparece após 300ms de carregamento
- Cenário 4: Botão permanece desabilitado durante requisição ativa (impede duplo clique)
- Cenário 5: Transição suave ao trocar de skeleton para conteúdo real
- Cenário 6: Suspense fallback exibido ao carregar rota lazy-loaded

---

### [STORY-2302] Mensagens de Erro (Toast e Inline)

**Como** usuário do MoneyTrackr
**Eu quero** ver mensagens de erro claras e contextuais quando algo dá errado
**Para que** eu entenda o que aconteceu e saiba como corrigir o problema

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points

**Contexto**:
O sistema precisa de duas estratégias de erro: (1) erros de formulário inline — exibidos junto ao campo que causou o problema; (2) toast notifications — para erros de rede, timeout, servidor ou ações assíncronas. Mensagens devem ser amigáveis (nunca exibir stack traces ou códigos HTTP crus). Erros de rede devem sugerir ações (ex.: "Tente novamente").

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário submete um formulário com campos inválidos
      QUANDO a validação frontend detecta erros
      ENTÃO mensagens de erro inline devem aparecer abaixo de cada campo inválido, em vermelho, com ícone de alerta

- [ ] DADO que uma requisição à API retorna erro 4xx (ex.: 400, 404, 409)
      QUANDO o erro tem mensagem traduzível no mapa de erros
      ENTÃO o sistema deve exibir toast notification com mensagem amigável em português

- [ ] DADO que uma requisição à API retorna erro 5xx ou timeout
      QUANDO o erro é de infraestrutura
      ENTÃO o sistema deve exibir toast notification vermelho com mensagem "Erro inesperado. Tente novamente." e botão "Tentar novamente"

- [ ] DADO que o usuário perde conexão com a internet
      QUANDO qualquer requisição falhar por erro de rede
      ENTÃO o sistema deve exibir um banner persistente no topo da página: "Sem conexão com a internet"

- [ ] DADO que um toast de erro é exibido
      QUANDO o tempo de exibição atinge 8 segundos
      ENTÃO o toast deve desaparecer automaticamente, ou o usuário pode fechá-lo manualmente antes disso

**Dependências**:
- Bloqueada por: STORY-1601 (Layout Base)
- Bloqueia: STORY-2303 (Confirmações de Sucesso)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Criar componente `<ToastNotification>` com variantes: `error`, `warning`, `info`, `success`
- Toast container posicionado no canto superior direito, empilhável (máx. 3 simultâneos)
- Criar composable/hook `useToast()` com métodos: `showError()`, `showSuccess()`, `showWarning()`
- Mapa de erros em `src/constants/error-messages.js` traduzindo códigos de erro da API para mensagens PT-BR
- Interceptor Axios global para capturar erros e disparar toasts automaticamente
- Criar componente `<InlineError>` para uso em formulários, integrado com validação (Vuelidate/React Hook Form)
- Banner de offline usando `navigator.onLine` + evento `online`/`offline`

*Backend*:
- Padronizar resposta de erro da API: `{ statusCode, errorCode, message, details? }`
- Garantir que todo erro retorne `errorCode` mapeável (ex.: `MAILING_NOT_FOUND`, `INVALID_TRANSACTION`)

*Estrutura de Arquivos*:
```
src/
  components/
    feedback/
      ToastNotification.vue        # Componente toast individual
      ToastNotification.test.js
      ToastContainer.vue           # Container que empilha toasts
      ToastContainer.test.js
      InlineError.vue              # Erro inline para formulários
      InlineError.test.js
      OfflineBanner.vue            # Banner de sem conexão
      OfflineBanner.test.js
  composables/
    useToast.js                    # Hook de toast notifications
    useToast.test.js
  constants/
    error-messages.js              # Mapa de erros API → mensagem PT-BR
  plugins/
    axios-error-interceptor.js     # Interceptor global de erros
```

**Cenários de Teste**:
- Cenário 1: Erro inline aparece ao submeter formulário de transação com campo "quantidade" vazio
- Cenário 2: Toast de erro aparece ao tentar vender mais ações do que possui (409)
- Cenário 3: Toast de erro com "Tentar novamente" aparece em timeout de requisição
- Cenário 4: Banner offline aparece ao desconectar da internet e some ao reconectar
- Cenário 5: Toast desaparece automaticamente após 8 segundos
- Cenário 6: Máximo de 3 toasts simultâneos; o mais antigo é removido ao exibir o 4º

---

### [STORY-2303] Confirmações de Sucesso

**Como** usuário do MoneyTrackr
**Eu quero** receber confirmação visual quando uma operação é concluída com sucesso
**Para que** eu tenha certeza de que minha ação foi salva corretamente

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 3 story points

**Contexto**:
Toda ação de criação, edição ou exclusão bem-sucedida deve ter feedback positivo. Confirmações de sucesso usam toast notifications verdes com duração mais curta que erros (5s). Ações destrutivas (deletar) devem pedir confirmação prévia antes da execução.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário cria, edita ou exclui um recurso com sucesso (transação, carteira, etc.)
      QUANDO a API retorna status 2xx
      ENTÃO o sistema deve exibir toast verde com mensagem de confirmação específica (ex.: "Transação criada com sucesso")

- [ ] DADO que o usuário tenta excluir um recurso (transação, carteira)
      QUANDO clica no botão de exclusão
      ENTÃO o sistema deve exibir modal de confirmação com a pergunta "Tem certeza que deseja excluir [nome do recurso]?" e botões "Cancelar" / "Confirmar"

- [ ] DADO que um toast de sucesso é exibido
      QUANDO 5 segundos se passam
      ENTÃO o toast deve desaparecer automaticamente

- [ ] DADO que o usuário importa um arquivo CSV/PDF com sucesso
      QUANDO a importação é concluída
      ENTÃO o sistema deve exibir toast verde com resumo: "X transações importadas com sucesso"

**Dependências**:
- Bloqueada por: STORY-2302 (Mensagens de Erro — componentes de toast reutilizados)
- Bloqueia: —

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Reutilizar `<ToastNotification>` com variante `success` (cor verde, ícone de check)
- Criar componente `<ConfirmModal>` reutilizável com slots para título, mensagem e ações
- Composable `useConfirm()` que retorna `Promise<boolean>` para uso em lógica de negócio
- Mapear mensagens de sucesso por tipo de operação em `src/constants/success-messages.js`
- Toast de sucesso com duração de 5 segundos (vs. 8 segundos para erros)

*Estrutura de Arquivos*:
```
src/
  components/
    feedback/
      ConfirmModal.vue             # Modal de confirmação reutilizável
      ConfirmModal.test.js
  composables/
    useConfirm.js                  # Hook para modal de confirmação
    useConfirm.test.js
  constants/
    success-messages.js            # Mapa de mensagens de sucesso por ação
```

**Cenários de Teste**:
- Cenário 1: Toast verde aparece ao criar transação de compra com sucesso
- Cenário 2: Modal de confirmação aparece ao clicar "Excluir" em uma transação
- Cenário 3: Clicar "Cancelar" no modal não executa a exclusão
- Cenário 4: Clicar "Confirmar" no modal executa a exclusão e exibe toast de sucesso
- Cenário 5: Toast de sucesso desaparece após 5 segundos

---

### [STORY-2304] Empty States

**Como** usuário do MoneyTrackr
**Eu quero** ver mensagens informativas quando uma seção não tem dados para exibir
**Para que** eu entenda que não há dados (e não pense que algo deu errado) e saiba como começar

**Tipo**: Feature
**Prioridade**: Should Have
**Estimativa**: 3 story points

**Contexto**:
Telas vazias são a primeira experiência do usuário novo. Em vez de exibir apenas uma tabela vazia ou espaço em branco, o sistema deve mostrar ilustrações contextuais, mensagem explicativa e call-to-action primário (ex.: "Crie sua primeira carteira"). Cada seção do app tem um empty state específico.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário acessa a página de Transações e não há transações cadastradas
      QUANDO a API retorna lista vazia
      ENTÃO o sistema deve exibir ilustração contextual, texto "Nenhuma transação encontrada" e botão "Registrar primeira transação"

- [ ] DADO que o usuário acessa o Dashboard e não possui carteiras
      QUANDO a API retorna lista vazia de carteiras
      ENTÃO o sistema deve exibir empty state com texto "Crie sua primeira carteira para começar" e botão "Criar Carteira"

- [ ] DADO que o usuário aplica filtros na lista de transações e nenhum resultado é encontrado
      QUANDO os filtros ativos não retornam dados
      ENTÃO o sistema deve exibir empty state de busca: "Nenhum resultado para os filtros aplicados" com botão "Limpar filtros"

- [ ] DADO que o Dashboard possui widgets/gráficos sem dados suficientes
      QUANDO não há transações ou dados de mercado para renderizar
      ENTÃO cada widget deve exibir empty state individual com mensagem contextual

**Dependências**:
- Bloqueada por: STORY-2301 (Loading States — loading precede empty state na sequência de estados)
- Bloqueia: —

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Criar componente `<EmptyState>` com props: `icon`, `title`, `description`, `actionLabel`, `actionRoute`
- Criar ilustrações SVG leves para cada contexto (carteira, transação, gráfico, busca)
- Integrar com lógica de estado: `loading → loaded(empty) → loaded(data)`
- Cada página/seção deve ter configuração de empty state no componente pai

*Estrutura de Arquivos*:
```
src/
  components/
    feedback/
      EmptyState.vue               # Componente genérico de empty state
      EmptyState.test.js
  assets/
    illustrations/
      empty-wallet.svg
      empty-transactions.svg
      empty-chart.svg
      empty-search.svg
```

**Cenários de Teste**:
- Cenário 1: Empty state de transações aparece para usuário novo sem transações
- Cenário 2: Botão CTA do empty state navega para o formulário correto
- Cenário 3: Empty state de busca aparece ao filtrar sem resultados
- Cenário 4: Empty state some quando dados são carregados após criação do primeiro recurso
- Cenário 5: Widget de gráfico exibe empty state individual quando não há dados

---

# Épico 24 — Editor de Gráficos

---

### [STORY-2401] Seleção de Tipo de Gráfico

**Como** usuário do MoneyTrackr
**Eu quero** escolher entre diferentes tipos de gráfico (linha, barra, pizza, donut)
**Para que** eu possa visualizar meus dados da forma mais adequada ao contexto

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points

**Contexto**:
O editor de gráficos permite ao usuário configurar a visualização de dados do dashboard. A seleção de tipo de gráfico é a configuração primária — cada tipo é adequado para diferentes análises: linha para evolução temporal, barra para comparações, pizza/donut para distribuição percentual. A mudança de tipo deve ser instantânea (preview em tempo real).

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário abre o editor de um gráfico no Dashboard
      QUANDO o painel de edição é exibido
      ENTÃO deve mostrar seletor de tipo com 4 opções visuais: Linha, Barra, Pizza e Donut, com o tipo atual destacado

- [ ] DADO que o usuário seleciona um tipo de gráfico diferente do atual
      QUANDO clica na opção desejada
      ENTÃO o gráfico deve renderizar novamente no novo formato imediatamente (preview em tempo real, sem salvar)

- [ ] DADO que o usuário seleciona tipo "Pizza" ou "Donut"
      QUANDO os dados possuem dimensão temporal (evolução ao longo do tempo)
      ENTÃO o sistema deve exibir aviso: "Gráficos de pizza/donut mostram a distribuição atual. Para evolução temporal, use Linha ou Barra." e agregar os dados para o período mais recente

- [ ] DADO que o usuário confirma a configuração do gráfico
      QUANDO clica em "Salvar"
      ENTÃO o tipo selecionado deve ser persistido e o gráfico do Dashboard atualizado

**Dependências**:
- Bloqueada por: STORY-2001 (Gráficos base), STORY-1901 (Dashboard)
- Bloqueia: STORY-2402 (Comparações), STORY-2403 (Customização de Cores), STORY-2404 (Salvar Configuração)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Usar biblioteca de gráficos: Chart.js (via vue-chartjs/react-chartjs-2) ou Apache ECharts
- Criar componente `<ChartEditor>` como painel lateral (drawer) ou modal
- Componente `<ChartTypeSelector>` com ícones visuais para cada tipo
- Estado do editor gerenciado localmente até o "Salvar" (padrão draft/commit)
- Mapeamento de tipos suportados por contexto de dados (temporal vs. distribuição)

*Estrutura de Arquivos*:
```
src/
  components/
    charts/
      ChartEditor.vue              # Painel principal do editor
      ChartEditor.test.js
      ChartTypeSelector.vue        # Seletor visual de tipo
      ChartTypeSelector.test.js
      ChartPreview.vue             # Preview em tempo real
      ChartPreview.test.js
  constants/
    chart-types.js                 # Enum e metadados dos tipos de gráfico
```

**Cenários de Teste**:
- Cenário 1: Seletor exibe 4 tipos com ícones visuais ao abrir o editor
- Cenário 2: Preview muda de linha para barra instantaneamente ao selecionar
- Cenário 3: Aviso contextual aparece ao selecionar pizza com dados temporais
- Cenário 4: Tipo selecionado é revertido ao fechar editor sem salvar (Cancelar)
- Cenário 5: Tipo selecionado persiste ao salvar e reabrir o editor

---

### [STORY-2402] Opções de Comparação (Carteira, Índices, Grupos)

**Como** usuário do MoneyTrackr
**Eu quero** adicionar linhas de comparação aos meus gráficos (carteiras, índices, grupos de ativos)
**Para que** eu possa avaliar o desempenho dos meus investimentos contra benchmarks e agrupamentos

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points

**Contexto**:
A comparação é o recurso mais valioso da visualização de investimentos. O usuário deve poder sobrepor no gráfico: (a) outras carteiras, (b) índices de referência como CDI, IBOVESPA, S&P 500, (c) grupos de ativos (FIIs, Ações BR, Cripto, etc.). Cada série adicionada deve ter cor distinta e legenda clicável para ativar/desativar.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário abre o editor de gráfico
      QUANDO acessa a aba "Comparações"
      ENTÃO deve ver 3 seções: "Carteiras", "Índices" e "Grupos", cada uma com checkboxes dos itens disponíveis

- [ ] DADO que o usuário marca o checkbox de um índice (ex.: CDI)
      QUANDO o preview é atualizado
      ENTÃO uma nova série deve aparecer no gráfico com cor distinta e entrada na legenda

- [ ] DADO que o usuário adicionou múltiplas séries de comparação
      QUANDO clica na legenda de uma série
      ENTÃO a série deve ser ocultada/exibida no gráfico (toggle)

- [ ] DADO que o usuário adiciona comparação com carteira em moeda diferente
      QUANDO a carteira selecionada possui ativos em USD e a carteira atual é em BRL
      ENTÃO os valores devem ser convertidos para a mesma moeda base usando câmbio histórico

- [ ] DADO que o gráfico é do tipo Pizza ou Donut
      QUANDO o usuário tenta adicionar comparações
      ENTÃO o sistema deve desabilitar a aba "Comparações" e exibir tooltip: "Comparações não disponíveis para gráficos de distribuição"

**Dependências**:
- Bloqueada por: STORY-2401 (Seleção de Tipo de Gráfico), STORY-0601 (Câmbio)
- Bloqueia: STORY-2404 (Salvar Configuração)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Componente `<ComparisonPanel>` dentro do `<ChartEditor>`
- Listar carteiras do usuário via API `GET /api/wallets`
- Listar índices disponíveis de constante estática: `CDI`, `IBOVESPA`, `IFIX`, `S&P 500`, `IPCA`
- Listar grupos baseados nos tipos de ativos do usuário: `Ações BR`, `FIIs`, `Ações INT`, `Cripto`, `Renda Fixa`
- Cada série recebe cor automática do sistema de paleta (ver STORY-2403)
- Legenda interativa (clicável) usando funcionalidade nativa da lib de gráficos

*Backend*:
- Endpoint `GET /api/charts/comparison-data` que aceita query params:
  - `walletIds[]` — IDs das carteiras para comparação
  - `indices[]` — nomes dos índices
  - `groups[]` — tipos de ativos
  - `startDate`, `endDate` — intervalo temporal
  - `baseCurrency` — moeda base para conversão
- Retorna séries normalizadas (base 100) para comparação justa de desempenho

*Estrutura de Arquivos*:
```
src/
  components/
    charts/
      ComparisonPanel.vue          # Painel de seleção de comparações
      ComparisonPanel.test.js
      ChartLegend.vue              # Legenda interativa
      ChartLegend.test.js
  services/
    chart-comparison-service.js    # Service para buscar dados de comparação
backend/
  src/app/
    chart/
      chart-router.js              # Rotas de dados de gráfico
      chart-manager.js             # Lógica de agregação e normalização
      chart-dao.js                 # Queries de dados históricos
```

**Cenários de Teste**:
- Cenário 1: Adicionar CDI como benchmark e verificar que nova linha aparece no gráfico
- Cenário 2: Adicionar e remover carteira de comparação — série aparece e desaparece
- Cenário 3: Toggle de legenda oculta/exibe série sem removê-la da configuração
- Cenário 4: Comparações desabilitadas para gráfico tipo Pizza
- Cenário 5: Comparação entre carteiras em moedas diferentes exibe valores normalizados
- Cenário 6: Verificar que dados são normalizados (base 100) para comparação justa

---

### [STORY-2403] Customização de Cores

**Como** usuário do MoneyTrackr
**Eu quero** personalizar as cores das séries nos meus gráficos
**Para que** eu possa diferenciar visualmente as informações e criar visualizações ao meu gosto

**Tipo**: Feature
**Prioridade**: Could Have
**Estimativa**: 3 story points

**Contexto**:
O sistema deve oferecer uma paleta de cores padrão que funciona bem para acessibilidade (contraste, daltonismo). O usuário pode sobrescrever cores individualmente por série. Cores devem ser persistidas junto à configuração do gráfico.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário abre o editor de gráfico
      QUANDO existem séries no gráfico (carteira, índices, grupos)
      ENTÃO cada série deve exibir um indicador de cor clicável ao lado do nome

- [ ] DADO que o usuário clica no indicador de cor de uma série
      QUANDO o color picker é aberto
      ENTÃO deve exibir paleta pré-definida de 12 cores acessíveis e opção de cor custom via input hexadecimal

- [ ] DADO que o usuário seleciona uma nova cor para uma série
      QUANDO o preview do gráfico é atualizado
      ENTÃO a série deve imediatamente refletir a nova cor no gráfico e na legenda

- [ ] DADO que o usuário não customizou cores
      QUANDO séries são adicionadas ao gráfico
      ENTÃO o sistema deve atribuir cores automaticamente da paleta padrão, garantindo que não haja cores repetidas

**Dependências**:
- Bloqueada por: STORY-2401 (Seleção de Tipo de Gráfico)
- Bloqueia: STORY-2404 (Salvar Configuração)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Paleta padrão com 12 cores testadas para WCAG AA (contraste mínimo 4.5:1 contra fundo branco/escuro)
- Paleta amigável para daltonismo (evitar vermelho/verde adjacentes; usar padrão "Color Universal Design")
- Componente `<ColorPicker>` com paleta + input hex + preview
- Cores armazenadas como objeto no estado do gráfico: `{ seriesId: '#hexcolor' }`
- Função utilitária `getNextColor(usedColors)` que retorna próxima cor disponível da paleta

*Estrutura de Arquivos*:
```
src/
  components/
    charts/
      ColorPicker.vue              # Componente de seleção de cor
      ColorPicker.test.js
  constants/
    chart-palette.js               # Paleta de cores padrão (12 cores acessíveis)
  utils/
    color-utils.js                 # Utilitários de cor (nextColor, contrast check)
    color-utils.test.js
```

**Cenários de Teste**:
- Cenário 1: Cores automáticas atribuídas sem repetição ao adicionar 5 séries
- Cenário 2: Color picker abre ao clicar no indicador de cor de uma série
- Cenário 3: Preview do gráfico atualiza imediatamente ao selecionar nova cor
- Cenário 4: Input hex aceita e valida cor digitada manualmente
- Cenário 5: Paleta padrão atende critério de contraste WCAG AA

---

### [STORY-2404] Salvar Configuração de Gráfico

**Como** usuário do MoneyTrackr
**Eu quero** salvar as configurações dos meus gráficos (tipo, comparações, cores)
**Para que** minhas personalizações persistam entre sessões e por carteira

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points

**Contexto**:
Cada gráfico do Dashboard tem uma configuração salva que inclui: tipo de gráfico, séries de comparação ativas, cores customizadas, e posição/tamanho no grid. A configuração é vinculada ao par (userId + walletId), de modo que cada carteira pode ter seu dashboard personalizado. Ao trocar de carteira, os gráficos devem carregar a configuração correspondente.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário configurou um gráfico no editor (tipo, comparações, cores)
      QUANDO clica em "Salvar"
      ENTÃO a configuração deve ser persistida na API e o gráfico do Dashboard atualizado

- [ ] DADO que o usuário fez alterações no editor mas clica em "Cancelar"
      QUANDO o editor é fechado
      ENTÃO nenhuma alteração deve ser salva e o gráfico deve voltar à configuração anterior

- [ ] DADO que o usuário troca de carteira ativa
      QUANDO o Dashboard é recarregado
      ENTÃO os gráficos devem carregar as configurações salvas para a nova carteira

- [ ] DADO que o usuário acessa uma carteira que nunca teve gráficos configurados
      QUANDO o Dashboard carrega
      ENTÃO deve exibir configuração padrão: gráfico de linha com a carteira atual e CDI como benchmark

- [ ] DADO que o usuário exclui um gráfico do Dashboard
      QUANDO confirma a exclusão
      ENTÃO a configuração deve ser removida do banco e o espaço no grid liberado

**Dependências**:
- Bloqueada por: STORY-2401, STORY-2402, STORY-2403
- Bloqueia: —

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Ao salvar, serializar configuração e enviar via `PUT /api/chart-configs/:chartId`
- Ao carregar Dashboard, buscar `GET /api/chart-configs?walletId=xxx`
- Configuração padrão em constante para carteiras sem config salva

*Backend*:
- Modelo Mongoose `ChartConfig`:
  ```javascript
  {
    _id: { type: String, default: uuidv4 },
    userId: { type: String, required: true },
    walletId: { type: String, required: true },
    chartType: { type: String, enum: ['line', 'bar', 'pie', 'donut'], default: 'line' },
    comparisons: {
      walletIds: [String],
      indices: [String],
      groups: [String],
    },
    colors: { type: Map, of: String },          // seriesId → hex color
    gridPosition: { x: Number, y: Number, w: Number, h: Number },
    createdAt: Date,
    updatedAt: Date,
  }
  ```
- Endpoints CRUD: `GET`, `POST`, `PUT`, `DELETE` em `/api/chart-configs`
- Índice composto: `{ userId: 1, walletId: 1 }`

*Estrutura de Arquivos*:
```
backend/
  src/app/
    chart-config/
      chart-config-model.js        # Schema Mongoose
      chart-config-dao.js          # Data Access Object
      chart-config-manager.js      # Lógica de negócio
      chart-config-router.js       # Rotas REST
src/
  services/
    chart-config-service.js        # Service frontend para API de config
  store/
    chart-config-store.js          # State management para configs de gráfico
```

**Cenários de Teste**:
- Cenário 1: Configuração é salva via API ao clicar "Salvar" no editor
- Cenário 2: Configuração NÃO é salva ao clicar "Cancelar"
- Cenário 3: Configurações corretas são carregadas ao trocar de carteira
- Cenário 4: Configuração padrão exibida para carteira nova
- Cenário 5: DELETE remove config e gráfico desaparece do Dashboard
- Cenário 6: Dois usuários distintos podem ter configs diferentes para a mesma carteira

---

# Épico 25 — Auditoria e Consistência

---

### [STORY-2501] Modelo e Middleware de Audit Log

**Como** administrador/usuário do MoneyTrackr
**Eu quero** que todas as alterações em transações e entidades sejam registradas em log de auditoria
**Para que** eu possa rastrear quem alterou o quê e quando, garantindo integridade dos dados

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points

**Contexto**:
O audit log é requisito essencial para um sistema financeiro. Cada criação, edição ou exclusão de entidades (transações, carteiras, ativos, configurações) deve gerar um registro imutável com dados anteriores e posteriores. O middleware de auditoria deve ser transparente — os managers não devem precisar chamar auditoria explicitamente. O audit log nunca deve ser editado ou excluído.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que um usuário cria uma nova transação
      QUANDO a transação é salva no banco
      ENTÃO um registro de auditoria deve ser criado com: `action: 'CREATE'`, `previousData: null`, `newData: {dados da transação}`, `userId`, `entityType: 'transaction'`, `entityId`, `timestamp`

- [ ] DADO que um usuário edita uma transação existente
      QUANDO a alteração é salva
      ENTÃO um registro de auditoria deve ser criado com `action: 'UPDATE'`, `previousData` contendo o estado anterior e `newData` contendo o novo estado

- [ ] DADO que um usuário exclui uma transação (soft delete)
      QUANDO a exclusão é executada
      ENTÃO um registro de auditoria deve ser criado com `action: 'DELETE'`, `previousData` contendo o estado completo da entidade e `newData: null`

- [ ] DADO que qualquer operação CUD é realizada em qualquer entidade (carteira, transação, ativo, provento)
      QUANDO o middleware de auditoria intercepta a operação
      ENTÃO o log deve ser gerado automaticamente sem código explícito no manager

- [ ] DADO que um registro de auditoria existe no banco
      QUANDO qualquer tentativa de edição ou exclusão é feita no registro de auditoria
      ENTÃO a operação deve ser rejeitada com erro 403

**Dependências**:
- Bloqueada por: STORY-0201 (Autenticação — userId), STORY-0401 (Transações)
- Bloqueia: STORY-2502 (Soft Delete), STORY-2503 (Histórico de Alterações — Frontend)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação da API atualizada (Swagger)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Backend*:
- Modelo Mongoose `AuditLog`:
  ```javascript
  const auditLogSchema = new mongoose.Schema({
    _id: { type: String, required: true, default: uuidv4 },
    userId: { type: String, required: true, index: true },
    entityType: { type: String, required: true, enum: ['transaction', 'wallet', 'asset', 'dividend', 'chart-config'] },
    entityId: { type: String, required: true, index: true },
    action: { type: String, required: true, enum: ['CREATE', 'UPDATE', 'DELETE'] },
    previousData: { type: mongoose.Schema.Types.Mixed, default: null },
    newData: { type: mongoose.Schema.Types.Mixed, default: null },
    metadata: {
      ip: String,
      userAgent: String,
    },
    timestamp: { type: Date, required: true, default: Date.now },
  }, { versionKey: false })

  // Índice composto para queries de histórico
  auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 })

  // Impedir edição/exclusão
  auditLogSchema.pre('updateOne', function() { throw new Error('Audit logs are immutable') })
  auditLogSchema.pre('deleteOne', function() { throw new Error('Audit logs cannot be deleted') })
  auditLogSchema.pre('findOneAndUpdate', function() { throw new Error('Audit logs are immutable') })
  auditLogSchema.pre('findOneAndDelete', function() { throw new Error('Audit logs cannot be deleted') })
  ```

- Middleware de auditoria como classe `AuditMiddleware`:
  ```javascript
  class AuditMiddleware {
    constructor(auditLogDAO) { this.auditLogDAO = auditLogDAO }

    wrapDAO(dao, entityType) {
      // Intercepta create, update, delete do DAO
      // Captura dados antes/depois automaticamente
      // Cria registro de auditoria assíncrono (fire-and-forget com retry)
    }
  }
  ```

- O middleware deve usar padrão Proxy ou decorator para envolver os métodos do DAO
- Log de auditoria criado em operação assíncrona separada (não bloqueia a operação principal)
- Em caso de falha no audit log, registrar em logger do sistema (nunca impedir a operação principal)

*Estrutura de Arquivos*:
```
backend/
  src/app/
    audit/
      audit-log-model.js           # Schema Mongoose do AuditLog
      audit-log-dao.js             # DAO para criação e consulta
      audit-log-manager.js         # Manager para lógica de consulta
      audit-log-router.js          # Rotas de consulta de auditoria
      audit-middleware.js           # Middleware que intercepta DAOs
      audit-middleware.test.js
      audit-log-dao.test.js
```

**Cenários de Teste**:
- Cenário 1: Criar transação gera audit log com action CREATE e previousData null
- Cenário 2: Editar transação gera audit log com previousData e newData diferentes
- Cenário 3: Deletar transação gera audit log com action DELETE e newData null
- Cenário 4: Tentativa de editar audit log retorna erro 403
- Cenário 5: Tentativa de deletar audit log retorna erro 403
- Cenário 6: Falha no audit log não impede operação principal
- Cenário 7: Audit log contém userId, timestamp e metadata corretos

---

### [STORY-2502] Soft Delete em Todas as Entidades

**Como** usuário do MoneyTrackr
**Eu quero** que itens excluídos sejam marcados como inativos em vez de removidos permanentemente
**Para que** eu possa recuperar dados excluídos acidentalmente e manter integridade referencial

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points

**Contexto**:
O padrão soft delete é essencial para integridade de dados financeiros. Nenhuma entidade deve ser removida fisicamente do banco — em vez disso, um campo `deletedAt` é preenchido com a data da exclusão. Todas as queries padrão devem filtrar registros excluídos automaticamente. Uma query especial deve permitir buscar registros excluídos para restauração.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que um usuário exclui uma entidade (transação, carteira, ativo, provento)
      QUANDO a operação de exclusão é executada
      ENTÃO o campo `deletedAt` deve ser preenchido com a data atual e o campo `deletedBy` com o userId, mas o registro NÃO deve ser removido do banco

- [ ] DADO que uma entidade possui `deletedAt` preenchido
      QUANDO qualquer listagem ou busca padrão é executada
      ENTÃO a entidade excluída NÃO deve aparecer nos resultados

- [ ] DADO que um administrador/usuário busca entidades excluídas
      QUANDO usa o filtro `includeDeleted=true` na API
      ENTÃO os registros excluídos devem ser retornados junto com os ativos, identificados pelo campo `deletedAt`

- [ ] DADO que o soft delete é aplicado em uma carteira
      QUANDO a carteira é marcada como excluída
      ENTÃO todas as transações vinculadas NÃO devem ser excluídas em cascata (mantêm-se ativas, referenciando a carteira excluída)

- [ ] DADO que o sistema possui entidades de todas as coleções (transactions, wallets, assets, dividends)
      QUANDO qualquer uma delas é excluída
      ENTÃO o padrão soft delete deve ser aplicado consistentemente em todas

**Dependências**:
- Bloqueada por: STORY-2501 (Audit Log — gera log no soft delete)
- Bloqueia: STORY-2504 (Restauração de Itens Excluídos — Frontend)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação da API atualizada (Swagger)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Backend*:
- Adicionar campos em todos os schemas Mongoose:
  ```javascript
  deletedAt: { type: Date, default: null },
  deletedBy: { type: String, default: null },
  ```
- Criar plugin Mongoose `soft-delete-plugin.js` que:
  - Sobrescreve `deleteOne`, `deleteMany` para fazer soft delete
  - Adiciona filtro automático `{ deletedAt: null }` em `find`, `findOne`, `countDocuments`
  - Expõe método `.findWithDeleted()` para queries que incluem excluídos
  - Expõe método `.restore(id)` para remover `deletedAt` e `deletedBy`
- Aplicar plugin em todos os modelos existentes: `Transaction`, `Wallet`, `Asset`, `Dividend`
- Migration script para adicionar campos `deletedAt`/`deletedBy` em documentos existentes
- Índice parcial: `{ deletedAt: 1 }` para queries de itens excluídos

*Estrutura de Arquivos*:
```
backend/
  src/
    plugins/
      soft-delete-plugin.js        # Plugin Mongoose reutilizável
      soft-delete-plugin.test.js
    migrations/
      add-soft-delete-fields.js    # Migration para docs existentes
  src/app/
    transaction/
      transaction-model.js         # Atualizado com soft delete
    wallet/
      wallet-model.js              # Atualizado com soft delete
    asset/
      asset-model.js               # Atualizado com soft delete
    dividend/
      dividend-model.js            # Atualizado com soft delete
```

**Cenários de Teste**:
- Cenário 1: Excluir transação preenche deletedAt e deletedBy sem remover documento
- Cenário 2: Transação excluída não aparece em listagem padrão `GET /api/transactions`
- Cenário 3: Transação excluída aparece com filtro `includeDeleted=true`
- Cenário 4: Soft delete funciona consistentemente em wallets, assets e dividends
- Cenário 5: Excluir carteira NÃO exclui transações vinculadas em cascata
- Cenário 6: Plugin adiciona filtro automático sem alterar código dos DAOs existentes

---

### [STORY-2503] Histórico de Alterações por Transação (Frontend)

**Como** usuário do MoneyTrackr
**Eu quero** visualizar o histórico completo de alterações de uma transação
**Para que** eu possa rastrear todas as modificações feitas e entender a evolução dos meus dados

**Tipo**: Feature
**Prioridade**: Should Have
**Estimativa**: 5 story points

**Contexto**:
A visualização de histórico de alterações complementa o audit log do backend. O usuário deve poder clicar em uma transação e ver uma timeline com todas as alterações: criação, edições e exclusão. Cada entrada da timeline mostra o que mudou (diff visual), quem alterou e quando.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário visualiza os detalhes de uma transação
      QUANDO clica no botão "Histórico de alterações"
      ENTÃO o sistema deve exibir uma timeline com todas as alterações da transação, da mais recente para a mais antiga

- [ ] DADO que a timeline de histórico é exibida
      QUANDO uma entrada de alteração (UPDATE) é mostrada
      ENTÃO deve exibir: data/hora, campos alterados com valor anterior (riscado) e novo valor (destacado), ícone indicando o tipo de ação

- [ ] DADO que a transação possui apenas o registro de criação (sem edições)
      QUANDO o histórico é exibido
      ENTÃO deve mostrar uma única entrada: "Transação criada em [data]" com os dados iniciais

- [ ] DADO que a transação foi excluída (soft delete)
      QUANDO o histórico é exibido
      ENTÃO deve mostrar entrada de exclusão com ícone de lixeira e os dados da transação no momento da exclusão

**Dependências**:
- Bloqueada por: STORY-2501 (Audit Log — backend)
- Bloqueia: —

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Componente `<ChangeHistoryTimeline>` que recebe `entityType` e `entityId`
- Buscar dados via `GET /api/audit-logs?entityType=transaction&entityId=xxx&sort=-timestamp`
- Componente `<DiffViewer>` que compara `previousData` e `newData` campo a campo
- Campos alterados destacados: valor anterior em vermelho riscado, novo em verde
- Timeline vertical com ícones por tipo de ação: + (CREATE), ✎ (UPDATE), 🗑 (DELETE)

*Backend*:
- Endpoint `GET /api/audit-logs` com query params:
  - `entityType` (required)
  - `entityId` (required)
  - `sort` (default: `-timestamp`)
  - `page`, `limit` (paginação)

*Estrutura de Arquivos*:
```
src/
  components/
    audit/
      ChangeHistoryTimeline.vue    # Timeline de alterações
      ChangeHistoryTimeline.test.js
      DiffViewer.vue               # Visualização de diff campo a campo
      DiffViewer.test.js
      AuditEntry.vue               # Entrada individual da timeline
      AuditEntry.test.js
  services/
    audit-service.js               # Service para API de audit logs
```

**Cenários de Teste**:
- Cenário 1: Timeline exibe 3 entradas para transação criada, editada e excluída
- Cenário 2: Diff viewer mostra campo "quantidade" alterado de 10 para 15 com destaque visual
- Cenário 3: Timeline mostra apenas criação para transação nunca editada
- Cenário 4: Paginação funciona quando há muitas alterações (> 20)
- Cenário 5: Timeline carrega com skeleton enquanto busca dados da API

---

### [STORY-2504] Restauração de Itens Excluídos (Frontend)

**Como** usuário do MoneyTrackr
**Eu quero** poder restaurar transações e entidades excluídas acidentalmente
**Para que** eu recupere dados sem precisar recriar manualmente

**Tipo**: Feature
**Prioridade**: Should Have
**Estimativa**: 5 story points

**Contexto**:
Complementa o soft delete do backend. O usuário deve ter uma seção "Lixeira" ou filtro que mostra itens excluídos, permitindo restauração individual. A restauração reverte o soft delete (limpa `deletedAt`) e gera audit log de RESTORE.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário acessa a seção "Lixeira" (ou aplica filtro "Mostrar excluídos")
      QUANDO existem itens com soft delete
      ENTÃO o sistema deve listar os itens excluídos com data de exclusão e botão "Restaurar"

- [ ] DADO que o usuário clica em "Restaurar" em um item excluído
      QUANDO confirma a restauração no modal de confirmação
      ENTÃO o item deve reaparecer nas listagens normais, `deletedAt` e `deletedBy` devem ser limpos, e audit log de RESTORE deve ser gerado

- [ ] DADO que o usuário está na lista de transações
      QUANDO ativa o toggle "Mostrar excluídos"
      ENTÃO os itens excluídos devem aparecer na listagem com indicador visual distinto (opacidade reduzida, badge "Excluído")

- [ ] DADO que um item excluído possui dependências (ex.: transação vinculada a carteira excluída)
      QUANDO o usuário tenta restaurar a transação
      ENTÃO o sistema deve verificar e informar se a carteira vinculada também está excluída, sugerindo restaurar ambos

**Dependências**:
- Bloqueada por: STORY-2502 (Soft Delete — backend)
- Bloqueia: —

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Componente `<TrashBin>` como página acessível via sidebar ou settings
- Toggle "Mostrar excluídos" em listagens existentes (transações, carteiras)
- Items excluídos renderizados com `opacity: 0.6`, badge vermelho "Excluído", data de exclusão
- Modal de confirmação de restauração com verificação de dependências

*Backend*:
- Endpoint `PATCH /api/:entity/:id/restore` que:
  - Limpa `deletedAt` e `deletedBy`
  - Gera audit log com `action: 'RESTORE'`
  - Retorna entidade restaurada
- Endpoint `GET /api/:entity?includeDeleted=true` para listar com excluídos
- Verificação de dependências: ao restaurar transação, checar se wallet está ativa

*Estrutura de Arquivos*:
```
src/
  components/
    audit/
      TrashBin.vue                 # Página de lixeira
      TrashBin.test.js
      DeletedItemBadge.vue         # Badge indicando item excluído
      RestoreModal.vue             # Modal de confirmação de restauração
      RestoreModal.test.js
  pages/
    TrashBinPage.vue               # Rota /lixeira
backend/
  src/app/
    common/
      restore-mixin.js             # Mixin/método reutilizável para restore
```

**Cenários de Teste**:
- Cenário 1: Lixeira lista 3 transações excluídas com datas de exclusão
- Cenário 2: Restaurar transação remove ela da lixeira e aparece na listagem normal
- Cenário 3: Audit log com action RESTORE é gerado após restauração
- Cenário 4: Toggle "Mostrar excluídos" exibe itens com indicador visual na listagem
- Cenário 5: Aviso exibido ao restaurar transação cuja carteira está excluída
- Cenário 6: Lixeira vazia exibe empty state "Nenhum item excluído"

---

# Épico 26 — Performance

---

### [STORY-2601] Lazy Loading e Bundle Splitting (Frontend)

**Como** usuário do MoneyTrackr
**Eu quero** que a aplicação carregue rapidamente, baixando apenas o código necessário para a página atual
**Para que** eu tenha uma experiência fluida mesmo em conexões lentas

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points

**Contexto**:
O bundle da SPA não deve ultrapassar 200KB gzipped no carregamento inicial. Rotas e componentes pesados (gráficos, editor, importação) devem ser carregados sob demanda. O objetivo é atingir score 90+ no Lighthouse Performance.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário acessa a aplicação pela primeira vez
      QUANDO o bundle inicial é carregado
      ENTÃO o tamanho do chunk principal (main bundle) não deve exceder 200KB gzipped

- [ ] DADO que o usuário navega para uma rota secundária (ex.: /importacao, /graficos)
      QUANDO a rota é acessada
      ENTÃO o chunk específico da rota deve ser carregado sob demanda (lazy loading via dynamic import)

- [ ] DADO que componentes pesados são usados em uma página (Chart.js, editor de PDF, etc.)
      QUANDO o componente é necessário
      ENTÃO deve ser carregado via dynamic import com `<Suspense>` fallback

- [ ] DADO que o build de produção é gerado
      QUANDO os chunks são analisados
      ENTÃO deve haver separação clara: vendor chunk (libs externas), common chunk (código compartilhado), e route chunks individuais

- [ ] DADO que o Lighthouse é executado na página principal
      QUANDO o relatório é gerado
      ENTÃO o score de Performance deve ser >= 90

**Dependências**:
- Bloqueada por: STORY-1701 (Navegação/Rotas)
- Bloqueia: —

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Bundle analysis report gerado e documentado
- [ ] Lighthouse score >= 90
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Configurar route-level code splitting:
  ```javascript
  // React
  const Dashboard = React.lazy(() => import('./pages/Dashboard'))
  const Transactions = React.lazy(() => import('./pages/Transactions'))
  const Import = React.lazy(() => import('./pages/Import'))
  
  // Vue
  const Dashboard = () => import('./pages/Dashboard.vue')
  ```
- Configurar Webpack/Vite split chunks:
  - `vendor` — node_modules (React/Vue, Axios, etc.)
  - `charts` — Chart.js / ECharts (pesado, isolado)
  - `common` — componentes compartilhados
- Lazy load de componentes pesados: `<ChartEditor>`, `<PDFParser>`, `<CSVImporter>`
- Prefetch de rotas prováveis: Dashboard → prefetch Transações e Gráficos
- Image optimization: usar WebP com fallback, lazy loading de imagens com `loading="lazy"`
- Usar `@vite-pwa/assets-generator` ou webpack image-minimizer para otimização automática

*Estrutura de Arquivos*:
```
src/
  router/
    index.js                       # Rotas com dynamic imports
  pages/
    Dashboard.vue                  # Lazy loaded
    Transactions.vue               # Lazy loaded
    Import.vue                     # Lazy loaded
    Charts.vue                     # Lazy loaded
vite.config.js / webpack.config.js # Split chunks configurado
  scripts/
    analyze-bundle.js              # Script para gerar relatório de bundle
```

**Cenários de Teste**:
- Cenário 1: Main bundle <= 200KB gzipped no build de produção
- Cenário 2: Navegar para /importacao carrega chunk separado (verificar Network tab)
- Cenário 3: Chart.js carregado apenas quando componente de gráfico é renderizado
- Cenário 4: Suspense fallback exibido durante carregamento de chunk
- Cenário 5: Lighthouse Performance score >= 90
- Cenário 6: Prefetch de rotas prováveis ativo em modo produção

---

### [STORY-2602] Virtual Scrolling para Listas Grandes

**Como** usuário do MoneyTrackr com muitas transações
**Eu quero** que listas grandes (1000+ itens) rolem de forma fluida sem travamentos
**Para que** eu possa navegar pelos dados sem degradação de performance

**Tipo**: Feature
**Prioridade**: Should Have
**Estimativa**: 5 story points

**Contexto**:
Usuários avançados podem ter milhares de transações. Renderizar todos os itens no DOM simultaneamente causa jank e alto consumo de memória. Virtual scrolling mantém apenas os itens visíveis no viewport renderizados, trocando dinamicamente conforme o scroll.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que a lista de transações possui 5.000 itens
      QUANDO o usuário rola a lista
      ENTÃO apenas os itens visíveis no viewport (+ buffer de 5 itens acima/abaixo) devem estar renderizados no DOM

- [ ] DADO que virtual scrolling está ativo
      QUANDO o usuário rola rapidamente (flick scroll)
      ENTÃO a renderização deve manter 60fps sem jank visível

- [ ] DADO que a lista usa virtual scrolling
      QUANDO o usuário usa busca/filtro que reduz a lista para < 50 itens
      ENTÃO o virtual scrolling deve desativar automaticamente (sem overhead para listas pequenas)

- [ ] DADO que o virtual scrolling está ativo
      QUANDO o usuário usa Ctrl+F (busca do navegador)
      ENTÃO o sistema deve exibir busca customizada integrada (pois itens fora do viewport não estão no DOM)

**Dependências**:
- Bloqueada por: STORY-2101 (Transações UI)
- Bloqueia: —

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Performance benchmark documentado (5000 itens a 60fps)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Usar biblioteca: `vue-virtual-scroller` (Vue) ou `react-virtuoso` / `@tanstack/react-virtual` (React)
- Componente `<VirtualList>` que envolve listas longas
- Threshold para ativação: lista > 100 itens ativa virtual scrolling automaticamente
- Row height fixa ou estimada para cálculo de posição (preferir altura fixa para melhor performance)
- Buffer de overscan: 5 itens acima e abaixo do viewport
- Search integrada: componente `<ListSearch>` que filtra no frontend e faz highlight

*Estrutura de Arquivos*:
```
src/
  components/
    common/
      VirtualList.vue              # Wrapper de virtual scrolling
      VirtualList.test.js
      ListSearch.vue               # Busca integrada para listas virtuais
      ListSearch.test.js
  composables/
    useVirtualList.js              # Hook com lógica de threshold e buffer
    useVirtualList.test.js
```

**Cenários de Teste**:
- Cenário 1: DOM contém apenas ~30 elementos para lista de 5000 itens
- Cenário 2: Scroll fluido a 60fps com 5000 transações (medido via DevTools Performance)
- Cenário 3: Virtual scrolling desativado automaticamente para lista com 50 itens
- Cenário 4: Busca integrada encontra e faz highlight de transação fora do viewport visível
- Cenário 5: Scroll para posição específica (ex.: ir para transação #3000)

---

### [STORY-2603] Estratégia de Cache Redis (Backend)

**Como** sistema MoneyTrackr
**Eu quero** implementar cache Redis para dados frequentemente acessados
**Para que** o tempo de resposta da API seja reduzido e a carga no MongoDB diminua

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points

**Contexto**:
Dados de mercado (cotações), índices econômicos e dados agregados do dashboard são acessados com alta frequência e mudam com baixa frequência. Redis deve cachear estes dados com TTLs apropriados. Cache invalidation deve ser automática quando dados são alterados.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que uma requisição busca cotações de mercado (preços de ativos)
      QUANDO os dados estão em cache Redis com TTL válido
      ENTÃO a resposta deve vir do cache sem consultar o MongoDB, com header `X-Cache: HIT`

- [ ] DADO que o cache de cotações expira (TTL: 5 minutos para ações, 1 minuto para cripto)
      QUANDO a próxima requisição é feita
      ENTÃO os dados devem ser buscados da fonte (MongoDB/API externa), cache atualizado, e header `X-Cache: MISS`

- [ ] DADO que o usuário altera uma transação
      QUANDO a alteração é salva
      ENTÃO o cache de dados agregados da carteira afetada deve ser invalidado automaticamente

- [ ] DADO que o Redis está indisponível
      QUANDO uma requisição é feita
      ENTÃO o sistema deve funcionar normalmente buscando dados diretamente do MongoDB (graceful degradation)

- [ ] DADO que múltiplos usuários acessam dados de mercado do mesmo ativo
      QUANDO o primeiro faz a requisição (cache MISS)
      ENTÃO o resultado deve ser cacheado e servir os demais (cache compartilhado por ativo)

**Dependências**:
- Bloqueada por: STORY-0101 (Arquitetura — Redis configurado)
- Bloqueia: —

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de cache strategy atualizada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Backend*:
- Criar classe `CacheManager` como abstração sobre Redis:
  ```javascript
  class CacheManager {
    constructor(redisClient) { this.redis = redisClient }

    async get(key) { /* parse JSON, retorna null se expirado */ }
    async set(key, value, ttlSeconds) { /* stringify e set com EX */ }
    async invalidate(pattern) { /* SCAN + DEL por pattern */ }
    async invalidateByTags(tags) { /* tag-based invalidation */ }

    // Padrão cache-aside
    async getOrSet(key, fetchFn, ttlSeconds) {
      const cached = await this.get(key)
      if (cached) return { data: cached, source: 'cache' }
      const data = await fetchFn()
      await this.set(key, data, ttlSeconds)
      return { data, source: 'database' }
    }
  }
  ```

- TTL por tipo de dado:
  | Tipo | TTL | Chave |
  |------|-----|-------|
  | Cotações ações BR | 5 min | `price:PETR4` |
  | Cotações cripto | 1 min | `price:BTC` |
  | Índices (CDI, IPCA) | 24 horas | `index:CDI:2026-03-27` |
  | Dashboard agregado | 10 min | `dashboard:{userId}:{walletId}` |
  | Dados de câmbio | 30 min | `fx:USD-BRL` |

- Invalidação automática:
  - Ao criar/editar/deletar transação → invalidar `dashboard:{userId}:{walletId}`
  - Ao atualizar cotação → invalidar `price:{ticker}`
  - Usar tags para invalidação em grupo: `tag:wallet:{walletId}`

- Header `X-Cache: HIT|MISS` em todas as respostas cacheáveis
- Graceful degradation: try/catch em toda operação Redis; fallback para MongoDB

*Estrutura de Arquivos*:
```
backend/
  src/
    cache/
      cache-manager.js             # Abstração sobre Redis
      cache-manager.test.js
      cache-keys.js                # Constantes de chaves e TTLs
      cache-invalidation.js        # Lógica de invalidação por tag
      cache-middleware.js           # Express middleware para cache de rotas
      cache-middleware.test.js
```

**Cenários de Teste**:
- Cenário 1: Segunda requisição de cotação retorna do cache (X-Cache: HIT) em < 5ms
- Cenário 2: Cache expira após TTL e próxima requisição busca do MongoDB (X-Cache: MISS)
- Cenário 3: Criar transação invalida cache do dashboard da carteira
- Cenário 4: Redis indisponível — sistema funciona normalmente via MongoDB
- Cenário 5: Dois usuários buscam preço do mesmo ativo — apenas 1 query ao MongoDB
- Cenário 6: Invalidação por pattern limpa todos os caches de um wallet

---

### [STORY-2604] Indexação e Otimização de Queries (Backend)

**Como** sistema MoneyTrackr
**Eu quero** ter índices MongoDB otimizados e queries eficientes em todos os endpoints
**Para que** o tempo de resposta do banco de dados seja consistentemente baixo (<100ms)

**Tipo**: Tech Debt / Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points

**Contexto**:
À medida que o volume de dados cresce, queries sem índices adequados degradam exponencialmente. Cada coleção precisa de índices compostos que cubram os padrões de busca mais comuns. Todas as listagens devem ter paginação obrigatória para evitar retornos massivos.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que a coleção de transações possui 100.000 documentos
      QUANDO uma query de listagem com filtros (walletId, date range, type) é executada
      ENTÃO o tempo de resposta deve ser < 100ms (verificado via `explain()`)

- [ ] DADO que todos os endpoints de listagem são chamados
      QUANDO nenhum parâmetro de paginação é informado
      ENTÃO o sistema deve aplicar paginação padrão: `page=1`, `limit=50`, `maxLimit=200`

- [ ] DADO que um endpoint de listagem é chamado com paginação
      QUANDO a resposta é retornada
      ENTÃO deve incluir metadados: `{ data: [], pagination: { page, limit, total, totalPages, hasNext, hasPrev } }`

- [ ] DADO que todas as queries são analisadas com `explain()`
      QUANDO verificados os planos de execução
      ENTÃO nenhuma query deve fazer COLLSCAN (full collection scan); todas devem usar IXSCAN (index scan)

- [ ] DADO que os índices são definidos nos schemas Mongoose
      QUANDO o serviço inicia
      ENTÃO os índices devem ser criados automaticamente (ensureIndexes)

**Dependências**:
- Bloqueada por: STORY-0401 (Transações — modelos base)
- Bloqueia: —

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Explain plans documentados para queries principais
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Backend*:
- Índices recomendados por coleção:
  ```javascript
  // Transactions
  { userId: 1, walletId: 1, date: -1 }           // Listagem por carteira ordenada por data
  { userId: 1, walletId: 1, assetType: 1 }       // Filtro por tipo de ativo
  { userId: 1, ticker: 1 }                        // Busca por ticker
  { deletedAt: 1 }                                // Filtro de soft delete (parcial)

  // Wallets
  { userId: 1, deletedAt: 1 }                     // Listagem por usuário

  // AuditLog
  { entityType: 1, entityId: 1, timestamp: -1 }   // Histórico por entidade
  { userId: 1, timestamp: -1 }                    // Histórico por usuário

  // ChartConfig
  { userId: 1, walletId: 1 }                      // Config por carteira

  // Dividends
  { userId: 1, walletId: 1, paymentDate: -1 }    // Proventos por carteira
  ```

- Criar mixin de paginação `PaginationMixin`:
  ```javascript
  class PaginationMixin {
    static parsePagination(query) {
      const page = Math.max(1, parseInt(query.page) || 1)
      const limit = Math.min(200, Math.max(1, parseInt(query.limit) || 50))
      const skip = (page - 1) * limit
      return { page, limit, skip }
    }

    static formatResponse(data, total, { page, limit }) {
      return {
        data,
        pagination: {
          page, limit, total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      }
    }
  }
  ```

- Aplicar paginação em TODOS os endpoints de listagem existentes
- Script de análise `explain-queries.js` que executa queries principais e verifica planos

*Estrutura de Arquivos*:
```
backend/
  src/
    common/
      pagination-mixin.js          # Mixin de paginação reutilizável
      pagination-mixin.test.js
    scripts/
      explain-queries.js           # Script de análise de planos de execução
      create-indexes.js            # Script de criação de índices
  src/app/
    transaction/
      transaction-model.js         # Atualizado com índices
    wallet/
      wallet-model.js              # Atualizado com índices
    audit/
      audit-log-model.js           # Atualizado com índices
```

**Cenários de Teste**:
- Cenário 1: Listagem de transações com 100k docs retorna em < 100ms
- Cenário 2: Endpoint sem parâmetro de paginação retorna page=1, limit=50
- Cenário 3: Resposta paginada inclui metadados (total, totalPages, hasNext, hasPrev)
- Cenário 4: Limit > 200 é reduzido para 200 automaticamente
- Cenário 5: Explain de queries principais mostra IXSCAN (não COLLSCAN)
- Cenário 6: Paginação funciona corretamente na última página (items restantes)

---

# Épico 27 — Segurança Frontend

---

### [STORY-2701] Isolamento de Dados por Usuário (JWT Context)

**Como** sistema MoneyTrackr
**Eu quero** garantir que todas as chamadas à API incluam contexto do usuário extraído do JWT
**Para que** nenhum usuário possa acessar dados de outro, mesmo que tente manipular requisições

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points

**Contexto**:
Segurança por isolamento: o userId NUNCA deve vir do frontend — sempre extraído do JWT no backend. Toda query ao MongoDB deve incluir filtro `userId` automaticamente. Este é o controle de segurança mais crítico do sistema.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que um usuário autenticado faz qualquer requisição à API
      QUANDO o backend processa a requisição
      ENTÃO o `userId` deve ser extraído exclusivamente do JWT token (nunca do body, params ou query string)

- [ ] DADO que um usuário tenta acessar um recurso (transação, carteira) que pertence a outro usuário
      QUANDO o backend verifica ownership
      ENTÃO deve retornar 404 (não 403, para não revelar existência do recurso)

- [ ] DADO que toda query ao MongoDB é executada em qualquer DAO
      QUANDO o filtro da query é montado
      ENTÃO deve obrigatoriamente incluir `userId` como critério de filtro

- [ ] DADO que o JWT token expirou
      QUANDO qualquer requisição é feita
      ENTÃO o backend deve retornar 401 e o frontend deve redirecionar para login

- [ ] DADO que o JWT token é inválido ou ausente
      QUANDO qualquer requisição a endpoint protegido é feita
      ENTÃO o backend deve retornar 401 sem revelar detalhes do motivo

**Dependências**:
- Bloqueada por: STORY-0201 (Autenticação)
- Bloqueia: STORY-2702 (XSS Prevention), STORY-2704 (Secure Token Storage)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Teste de penetração manual: tentativa de acessar dados de outro usuário documentada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Backend*:
- Middleware de autenticação que extrai userId do JWT e injeta em `req.userId`:
  ```javascript
  const authMiddleware = (req, res, next) => {
    try {
      const token = req.cookies.accessToken // httpOnly cookie
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      req.userId = decoded.userId
      req.userDomain = decoded.domain
      next()
    } catch (err) {
      res.status(401).json({ error: 'Unauthorized' })
    }
  }
  ```
- Criar base DAO que injeta `userId` automaticamente em todas as queries:
  ```javascript
  class SecureDAO extends AppDAO {
    find(query, userId) {
      return this.objectModel.find({ ...query, userId, deletedAt: null }).lean().exec()
    }
    findOne(query, userId) {
      return this.objectModel.findOne({ ...query, userId, deletedAt: null }).lean().exec()
    }
  }
  ```
- TODOS os DAOs existentes devem herdar de `SecureDAO`
- Testes de segurança: criar transação com userA, tentar acessar com userB → 404

*Frontend*:
- Axios interceptor que adiciona JWT automaticamente (via httpOnly cookie — automático)
- Interceptor de resposta: ao receber 401, limpar estado local e redirecionar para `/login`
- NUNCA armazenar userId no localStorage ou enviar como parâmetro

*Estrutura de Arquivos*:
```
backend/
  src/
    middleware/
      auth-middleware.js            # Middleware JWT
      auth-middleware.test.js
    common/
      secure-dao.js                # DAO base com filtro userId obrigatório
      secure-dao.test.js
src/
  plugins/
    axios-auth-interceptor.js      # Interceptor de autenticação
```

**Cenários de Teste**:
- Cenário 1: Requisição sem token retorna 401
- Cenário 2: Requisição com token expirado retorna 401
- Cenário 3: UserA não consegue acessar transação do UserB (retorna 404)
- Cenário 4: userId é extraído do JWT, não do request body
- Cenário 5: Todas as queries via SecureDAO incluem filtro userId
- Cenário 6: Frontend redireciona para login ao receber 401

---

### [STORY-2702] Prevenção de XSS e Sanitização de Input

**Como** sistema MoneyTrackr
**Eu quero** prevenir ataques XSS (Cross-Site Scripting) em todas as entradas e saídas
**Para que** scripts maliciosos não possam ser executados no contexto do navegador dos usuários

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points

**Contexto**:
XSS é o ataque web mais comum. Dados do usuário (nomes de carteira, notas em transações, etc.) devem ser sanitizados na entrada (backend) e escapados na saída (frontend). O framework frontend (React/Vue) já escapa por padrão, mas é preciso proteger contra uso de `v-html`/`dangerouslySetInnerHTML` e sanitizar no backend para defesa em profundidade.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que um usuário insere HTML/JavaScript em um campo de texto (ex.: nome de carteira: `<script>alert('xss')</script>`)
      QUANDO o dado é salvo via API
      ENTÃO o backend deve sanitizar a entrada, removendo tags HTML e scripts antes de salvar no banco

- [ ] DADO que dados são renderizados no frontend
      QUANDO o dado contém caracteres especiais HTML (`<`, `>`, `&`, `"`, `'`)
      ENTÃO os caracteres devem ser escapados e exibidos como texto (não interpretados como HTML)

- [ ] DADO que o backend retorna dados para o frontend
      QUANDO os headers HTTP são configurados
      ENTÃO devem incluir: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`

- [ ] DADO que o frontend usa `v-html` ou `dangerouslySetInnerHTML` em qualquer componente
      QUANDO o conteúdo renderizado vem de dados do usuário
      ENTÃO o conteúdo deve ser processado por biblioteca de sanitização (DOMPurify) antes da renderização

- [ ] DADO que todas as entradas de formulário são submetidas
      QUANDO chegam ao backend
      ENTÃO devem passar por middleware de sanitização global que aplica trim, remove null bytes e limita tamanho

**Dependências**:
- Bloqueada por: STORY-2701 (JWT Context)
- Bloqueia: —

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Teste de XSS manual documentado (payloads OWASP top 10)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Backend*:
- Instalar e configurar `helmet` para headers de segurança:
  ```javascript
  const helmet = require('helmet')
  app.use(helmet())
  app.use(helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // necessário para libs CSS
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.brapi.dev', 'https://query1.finance.yahoo.com'],
    },
  }))
  ```
- Middleware de sanitização global usando `express-mongo-sanitize` e `xss-clean`:
  ```javascript
  const mongoSanitize = require('express-mongo-sanitize')
  const xss = require('xss-clean')
  app.use(mongoSanitize())  // previne NoSQL injection
  app.use(xss())            // sanitiza input contra XSS
  ```
- Validação de input com `joi` ou `express-validator` em todas as rotas

*Frontend*:
- NUNCA usar `v-html` / `dangerouslySetInnerHTML` com dados de usuário sem DOMPurify
- Lint rule: `eslint-plugin-no-unsanitized` para detectar uso inseguro
- Instalar `DOMPurify` para casos necessários de renderização HTML

*Estrutura de Arquivos*:
```
backend/
  src/
    middleware/
      security-headers.js          # Configuração helmet/CSP
      input-sanitizer.js           # Middleware de sanitização global
      input-sanitizer.test.js
src/
  utils/
    sanitize.js                    # Wrapper DOMPurify para frontend
    sanitize.test.js
  .eslintrc.js                     # Regra no-unsanitized adicionada
```

**Cenários de Teste**:
- Cenário 1: Input `<script>alert(1)</script>` no nome de carteira é salvo como texto plano (sanitizado)
- Cenário 2: Headers CSP, X-Content-Type-Options e X-Frame-Options presentes em todas as respostas
- Cenário 3: NoSQL injection `{ "$gt": "" }` em campo de busca é neutralizado
- Cenário 4: Payloads OWASP XSS top 10 não executam no frontend
- Cenário 5: Caracteres especiais HTML são exibidos como texto no frontend

---

### [STORY-2703] Proteção CSRF e Armazenamento Seguro de Tokens

**Como** sistema MoneyTrackr
**Eu quero** proteger contra ataques CSRF e armazenar tokens de autenticação de forma segura
**Para que** sessões de usuários não possam ser sequestradas por sites maliciosos

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points

**Contexto**:
Tokens JWT devem ser armazenados em cookies httpOnly (inacessíveis via JavaScript). Proteção CSRF deve ser implementada via token sincronizado (Double Submit Cookie pattern) ou SameSite cookie attribute. O frontend nunca deve ter acesso direto ao token de autenticação.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário faz login com sucesso
      QUANDO o token JWT é retornado
      ENTÃO deve ser armazenado em cookie com flags: `httpOnly: true`, `secure: true` (HTTPS), `sameSite: 'strict'`, `path: '/'`

- [ ] DADO que o token está em cookie httpOnly
      QUANDO JavaScript tenta acessar via `document.cookie`
      ENTÃO o token NÃO deve ser visível/acessível

- [ ] DADO que um site externo malicioso tenta fazer requisição cross-origin para a API do MoneyTrackr
      QUANDO a requisição é feita
      ENTÃO deve ser bloqueada pelo CORS configurado (apenas origens permitidas) e pelo CSRF token

- [ ] DADO que uma requisição POST/PUT/DELETE é feita à API
      QUANDO o CSRF token não está presente ou é inválido
      ENTÃO o backend deve rejeitar com 403

- [ ] DADO que o token JWT está expirando
      QUANDO resta menos de 5 minutos de validade
      ENTÃO o sistema deve fazer refresh automático usando refresh token (também em httpOnly cookie)

**Dependências**:
- Bloqueada por: STORY-0201 (Autenticação), STORY-2701 (JWT Context)
- Bloqueia: —

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Teste CSRF manual documentado
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Backend*:
- Login endpoint configura cookies:
  ```javascript
  res.cookie('accessToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,         // 15 minutos
    path: '/',
  })
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    path: '/api/auth/refresh',       // restrito à rota de refresh
  })
  ```
- CSRF protection via `csurf` ou Double Submit Cookie:
  ```javascript
  const csrf = require('csurf')
  app.use(csrf({ cookie: { httpOnly: true, sameSite: 'strict' } }))
  ```
- CORS configurado para aceitar apenas origens confiáveis:
  ```javascript
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS.split(','),
    credentials: true,
  }))
  ```
- Endpoint `POST /api/auth/refresh` para renovar accessToken usando refreshToken
- Logout deve limpar ambos os cookies: `res.clearCookie('accessToken')`, `res.clearCookie('refreshToken')`

*Frontend*:
- Axios configurado com `withCredentials: true` para enviar cookies automaticamente
- CSRF token lido de cookie não-httpOnly ou de header customizado do backend
- Axios interceptor para incluir CSRF token no header `X-CSRF-Token`
- Timer para refresh automático quando accessToken está próximo de expirar
- No logout, chamar endpoint de logout e limpar estado local

*Estrutura de Arquivos*:
```
backend/
  src/
    middleware/
      csrf-middleware.js            # Configuração CSRF
      csrf-middleware.test.js
      cors-config.js               # Configuração CORS
    app/
      auth/
        auth-router.js             # Atualizado com refresh token
        auth-manager.js            # Lógica de refresh
src/
  plugins/
    axios-csrf-interceptor.js      # Interceptor CSRF
  composables/
    useAuth.js                     # Hook de autenticação com auto-refresh
    useAuth.test.js
```

**Cenários de Teste**:
- Cenário 1: Token JWT armazenado em cookie httpOnly (não acessível via document.cookie)
- Cenário 2: Requisição cross-origin sem CORS configurado é bloqueada
- Cenário 3: Requisição POST sem CSRF token retorna 403
- Cenário 4: Refresh token renova accessToken automaticamente antes da expiração
- Cenário 5: Logout limpa todos os cookies de autenticação
- Cenário 6: Cookie tem flags secure e sameSite=strict em produção

---

# Épico 28 — Responsividade

---

### [STORY-2801] Layout Mobile-First e Sistema de Breakpoints

**Como** usuário do MoneyTrackr acessando de diferentes dispositivos
**Eu quero** que o sistema se adapte automaticamente ao tamanho da tela
**Para que** eu tenha uma experiência otimizada em mobile, tablet e desktop

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points

**Contexto**:
O MoneyTrackr deve seguir abordagem mobile-first: o CSS base é para mobile, com media queries que adicionam complexidade para telas maiores. Breakpoints padronizados: mobile (<768px), tablet (768-1024px), desktop (>1024px). O layout deve ser fluido entre breakpoints, não apenas "saltar" entre layouts fixos.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário acessa o MoneyTrackr em tela mobile (<768px)
      QUANDO a página carrega
      ENTÃO o layout deve exibir: sidebar oculta (overlay), conteúdo em coluna única, fontes e espaçamentos otimizados para toque

- [ ] DADO que o usuário acessa em tablet (768-1024px)
      QUANDO a página carrega
      ENTÃO o layout deve exibir: sidebar colapsada (ícones), conteúdo com grid de 2 colunas onde aplicável

- [ ] DADO que o usuário acessa em desktop (>1024px)
      QUANDO a página carrega
      ENTÃO o layout deve exibir: sidebar expandida (ícones + labels), conteúdo com grid de 3+ colunas, tabelas completas

- [ ] DADO que o usuário redimensiona a janela do navegador
      QUANDO cruza um breakpoint
      ENTÃO o layout deve adaptar fluidamente sem reload de página

- [ ] DADO que todos os componentes interativos são exibidos em mobile
      QUANDO o usuário interage via toque
      ENTÃO áreas de toque (botões, links, checkboxes) devem ter tamanho mínimo de 44x44px (WCAG 2.5.5)

**Dependências**:
- Bloqueada por: STORY-1601 (Layout Base), STORY-1801 (Sidebar)
- Bloqueia: STORY-2802 (Sidebar Responsiva), STORY-2803 (Interações Touch-Friendly)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst — testado em dispositivos reais (ou simulador)
- [ ] Lighthouse Accessibility score >= 90
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Definir variáveis CSS de breakpoints:
  ```css
  :root {
    --breakpoint-mobile: 768px;
    --breakpoint-tablet: 1024px;
  }

  /* Mobile-first: estilos base são mobile */
  .container { padding: 16px; }

  /* Tablet */
  @media (min-width: 768px) {
    .container { padding: 24px; }
  }

  /* Desktop */
  @media (min-width: 1024px) {
    .container { padding: 32px; }
  }
  ```
- Composable `useBreakpoint()` que retorna estado reativo:
  ```javascript
  const { isMobile, isTablet, isDesktop, breakpoint } = useBreakpoint()
  ```
- Grid system responsivo com CSS Grid ou Flexbox
- Touch targets: mínimo 44x44px para todos os botões e links interativos
- Font sizes responsivos: base 14px mobile, 15px tablet, 16px desktop
- Tabelas responsivas: em mobile, exibir como cards empilhados (cada row vira card)

*Estrutura de Arquivos*:
```
src/
  styles/
    breakpoints.css                # Variáveis e mixins de breakpoints
    grid.css                       # Sistema de grid responsivo
    typography.css                 # Tipografia responsiva
    touch.css                      # Estilos para touch targets
  composables/
    useBreakpoint.js               # Hook reativo de breakpoint
    useBreakpoint.test.js
  components/
    layout/
      ResponsiveGrid.vue           # Grid adaptável por breakpoint
      ResponsiveGrid.test.js
      ResponsiveTable.vue          # Tabela → cards em mobile
      ResponsiveTable.test.js
```

**Cenários de Teste**:
- Cenário 1: Em 375px (iPhone SE) sidebar está oculta e conteúdo ocupa 100% da largura
- Cenário 2: Em 800px (tablet) sidebar mostra apenas ícones e conteúdo em 2 colunas
- Cenário 3: Em 1440px (desktop) sidebar expandida com labels e conteúdo em 3 colunas
- Cenário 4: Redimensionar de 1440px para 375px adapta layout sem reload
- Cenário 5: Todos os botões têm área de toque >= 44x44px em viewport mobile
- Cenário 6: Tabela de transações vira cards empilhados em mobile

---

### [STORY-2802] Sidebar Responsiva (Overlay Mobile / Fixa Desktop)

**Como** usuário do MoneyTrackr em dispositivos móveis
**Eu quero** que a sidebar funcione como overlay em mobile e fixa em desktop
**Para que** eu tenha navegação acessível sem perder espaço de conteúdo em telas pequenas

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points

**Contexto**:
Em mobile, a sidebar deve ser um drawer/overlay que abre pelo ícone hambúrguer e fecha ao selecionar uma opção ou clicar fora. Em desktop, a sidebar é fixa na lateral esquerda. Em tablet, a sidebar é colapsada (apenas ícones) mas pode ser expandida via hover ou clique.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário está em viewport mobile (<768px)
      QUANDO a página carrega
      ENTÃO a sidebar deve estar oculta e um ícone hambúrguer deve estar visível no header

- [ ] DADO que o usuário clica no ícone hambúrguer em mobile
      QUANDO a sidebar overlay abre
      ENTÃO deve deslizar da esquerda com animação (300ms), e um backdrop escurecido deve cobrir o conteúdo

- [ ] DADO que a sidebar overlay está aberta em mobile
      QUANDO o usuário clica em um item de menu OU clica no backdrop
      ENTÃO a sidebar deve fechar com animação de saída

- [ ] DADO que o usuário está em viewport desktop (>1024px)
      QUANDO a página carrega
      ENTÃO a sidebar deve estar fixa, expandida, com ícones e labels visíveis

- [ ] DADO que o usuário está em viewport tablet (768-1024px)
      QUANDO a página carrega
      ENTÃO a sidebar deve estar colapsada (apenas ícones, 64px de largura) com expand via hover ou clique

**Dependências**:
- Bloqueada por: STORY-2801 (Layout Mobile-First), STORY-1801 (Sidebar base)
- Bloqueia: —

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst — testado em mobile real
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Sidebar com 3 estados: `hidden` (mobile), `collapsed` (tablet), `expanded` (desktop)
- Usar composable `useBreakpoint()` para determinar estado inicial
- Animação CSS: `transform: translateX(-100%)` → `translateX(0)` com `transition: 300ms ease`
- Backdrop: div com `position: fixed`, `background: rgba(0,0,0,0.5)`, `z-index: 40`
- Sidebar z-index: 50 (acima do backdrop)
- Accessibility: sidebar overlay com `role="dialog"`, `aria-modal="true"`, focus trap
- Swipe gesture: fechar sidebar com swipe para a esquerda em mobile (touch event)
- Keyboard: fechar sidebar com ESC

*Estrutura de Arquivos*:
```
src/
  components/
    layout/
      Sidebar.vue                  # Atualizado com 3 estados responsivos
      Sidebar.test.js
      SidebarBackdrop.vue          # Backdrop para overlay
      HamburgerButton.vue          # Botão hambúrguer para mobile
  composables/
    useSidebar.js                  # Estado e controle da sidebar
    useSidebar.test.js
```

**Cenários de Teste**:
- Cenário 1: Sidebar oculta em 375px, hambúrguer visível
- Cenário 2: Clicar hambúrguer abre sidebar como overlay com animação
- Cenário 3: Clicar backdrop fecha sidebar overlay
- Cenário 4: Selecionar menu item em mobile fecha sidebar e navega
- Cenário 5: Sidebar fixa expandida em 1440px
- Cenário 6: Sidebar colapsada com ícones em 900px
- Cenário 7: Swipe left em mobile fecha sidebar
- Cenário 8: ESC fecha sidebar overlay

---

### [STORY-2803] Interações Touch-Friendly

**Como** usuário do MoneyTrackr em dispositivos touch (mobile/tablet)
**Eu quero** que todas as interações sejam otimizadas para toque
**Para que** eu consiga usar o aplicativo confortavelmente com os dedos, sem necessidade de mouse

**Tipo**: Feature
**Prioridade**: Should Have
**Estimativa**: 5 story points

**Contexto**:
Dispositivos touch requerem áreas de toque adequadas, gestos intuitivos e feedback háptico. Ações comuns devem ser acessíveis via swipe (ex.: swipe para deletar transação). Hover states devem ser substituídos por estados ativos/press em dispositivos touch.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário está em dispositivo touch
      QUANDO interage com elementos interativos
      ENTÃO todos os botões, links e áreas clicáveis devem ter mínimo 44x44px de área de toque com espaçamento mínimo de 8px entre eles

- [ ] DADO que o usuário faz swipe left em um item de lista (transação, carteira)
      QUANDO o gesto é detectado
      ENTÃO devem aparecer ações rápidas: "Editar" (azul) e "Excluir" (vermelho) com animação de slide

- [ ] DADO que o usuário faz long press (toque longo > 500ms) em um item de lista
      QUANDO o gesto é detectado
      ENTÃO o sistema deve entrar em modo de seleção múltipla com checkboxes visíveis

- [ ] DADO que elementos possuem hover state em desktop
      QUANDO acessados em dispositivo touch
      ENTÃO o hover deve ser substituído por estado `:active` / `:focus-visible` sem "sticky hover"

- [ ] DADO que o usuário navega em formulários no mobile
      QUANDO um campo de input é focado
      ENTÃO o teclado virtual deve abrir com o tipo adequado (numérico para valores, email para email) e o campo deve ser scrollado para visibilidade

**Dependências**:
- Bloqueada por: STORY-2801 (Layout Mobile-First)
- Bloqueia: —

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst — testado em dispositivo touch real
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Componente `<SwipeActions>` que envolve itens de lista:
  ```vue
  <SwipeActions
    :actions="[
      { label: 'Editar', color: 'blue', icon: 'edit', handler: onEdit },
      { label: 'Excluir', color: 'red', icon: 'trash', handler: onDelete },
    ]"
  >
    <TransactionItem :data="transaction" />
  </SwipeActions>
  ```
- Usar `Hammer.js` ou `@use-gesture/react` para detecção de gestos (swipe, long press, pinch)
- CSS para eliminar sticky hover em touch:
  ```css
  @media (hover: none) {
    .interactive:hover { background: inherit; }
  }
  ```
- Input types adequados: `type="number"` + `inputmode="decimal"` para valores monetários, `type="email"` para email, `type="date"` para datas
- `scroll-margin-top` em campos de formulário para compensar header fixo quando teclado abre
- Pull-to-refresh em listagens: gesto de puxar para baixo recarrega dados

*Estrutura de Arquivos*:
```
src/
  components/
    touch/
      SwipeActions.vue             # Ações por swipe em itens de lista
      SwipeActions.test.js
      PullToRefresh.vue            # Pull-to-refresh em listagens
      PullToRefresh.test.js
  composables/
    useGesture.js                  # Hook de detecção de gestos
    useGesture.test.js
    useTouchDevice.js              # Detecta se é dispositivo touch
    useTouchDevice.test.js
  styles/
    touch.css                      # Estilos específicos para touch
```

**Cenários de Teste**:
- Cenário 1: Swipe left em transação revela botões "Editar" e "Excluir"
- Cenário 2: Long press em item ativa modo de seleção múltipla
- Cenário 3: Botões possuem área de toque >= 44x44px medida via DevTools
- Cenário 4: Sem "sticky hover" em dispositivo touch (hover não persiste após tap)
- Cenário 5: Campo de valor monetário abre teclado numérico decimal
- Cenário 6: Pull-to-refresh recarrega lista de transações
- Cenário 7: Espaçamento mínimo de 8px entre elementos interativos adjacentes

---

# Resumo de Estimativas

| Épico | Story | Título | Estimativa | Prioridade |
|-------|-------|--------|------------|------------|
| 23 | STORY-2301 | Indicadores de Carregamento | 5 SP | Must Have |
| 23 | STORY-2302 | Mensagens de Erro | 5 SP | Must Have |
| 23 | STORY-2303 | Confirmações de Sucesso | 3 SP | Must Have |
| 23 | STORY-2304 | Empty States | 3 SP | Should Have |
| 24 | STORY-2401 | Seleção de Tipo de Gráfico | 5 SP | Must Have |
| 24 | STORY-2402 | Comparações (Carteira, Índices, Grupos) | 8 SP | Must Have |
| 24 | STORY-2403 | Customização de Cores | 3 SP | Could Have |
| 24 | STORY-2404 | Salvar Configuração de Gráfico | 5 SP | Must Have |
| 25 | STORY-2501 | Modelo e Middleware de Audit Log | 8 SP | Must Have |
| 25 | STORY-2502 | Soft Delete em Todas as Entidades | 8 SP | Must Have |
| 25 | STORY-2503 | Histórico de Alterações (Frontend) | 5 SP | Should Have |
| 25 | STORY-2504 | Restauração de Itens Excluídos | 5 SP | Should Have |
| 26 | STORY-2601 | Lazy Loading e Bundle Splitting | 5 SP | Must Have |
| 26 | STORY-2602 | Virtual Scrolling | 5 SP | Should Have |
| 26 | STORY-2603 | Cache Redis | 8 SP | Must Have |
| 26 | STORY-2604 | Indexação e Otimização de Queries | 5 SP | Must Have |
| 27 | STORY-2701 | Isolamento de Dados por Usuário | 5 SP | Must Have |
| 27 | STORY-2702 | Prevenção XSS e Sanitização | 5 SP | Must Have |
| 27 | STORY-2703 | Proteção CSRF e Token Storage | 5 SP | Must Have |
| 28 | STORY-2801 | Layout Mobile-First e Breakpoints | 8 SP | Must Have |
| 28 | STORY-2802 | Sidebar Responsiva | 5 SP | Must Have |
| 28 | STORY-2803 | Interações Touch-Friendly | 5 SP | Should Have |

**Total**: 22 stories | **111 story points**

**Distribuição por prioridade**:
- Must Have: 16 stories (82 SP)
- Should Have: 5 stories (23 SP)
- Could Have: 1 story (3 SP)

---

# Sequência de Implementação Sugerida

```
Sprint N:   EP-27 (Segurança)     → STORY-2701 → STORY-2702 → STORY-2703
Sprint N+1: EP-25 (Auditoria)     → STORY-2501 → STORY-2502 → STORY-2503 → STORY-2504
Sprint N+2: EP-26 (Performance)   → STORY-2604 → STORY-2603 → STORY-2601 → STORY-2602
Sprint N+3: EP-23 (Feedback UX)   → STORY-2301 → STORY-2302 → STORY-2303 → STORY-2304
Sprint N+4: EP-28 (Responsiv.)    → STORY-2801 → STORY-2802 → STORY-2803
Sprint N+5: EP-24 (Editor Gráf.)  → STORY-2401 → STORY-2402 → STORY-2403 → STORY-2404
```

> **Justificativa**: Segurança primeiro (fundação), depois auditoria (integridade de dados), performance (infraestrutura), feedback UX (experiência), responsividade (adaptação) e por fim editor de gráficos (feature avançada que depende de tudo anterior).

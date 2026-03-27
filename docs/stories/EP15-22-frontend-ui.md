# Épicos 15–22 — Frontend UI (Interface de Usuário)

> **Produto**: MoneyTrackr — Gestor de Investimentos
> **Escopo**: Interface de usuário, PWA, navegação, componentes visuais
> **Épicos**: 15 (PWA), 16 (Layout Base), 17 (Navegação), 18 (Sidebar), 19 (Dashboard), 20 (Gráficos), 21 (Transações UI), 22 (Formulários)
> **Data de criação**: 2026-03-27
> **Status**: Pronto para @architect

---

## Mapa de Dependências

```
EP-15 (PWA) ─────────────────────────────────────────────────────────────────┐
                                                                              │
EP-16 (Layout Base) ──┬──► EP-17 (Navegação) ──► EP-18 (Sidebar) ──┐          │
                      │                                            │          │
                      └──► EP-19 (Dashboard) ──► EP-20 (Gráficos) ─┤          │
                      │                                            │          │
                      └──► EP-21 (Transações UI) ──► EP-22 (Formulários) ────┤
                                                                              │
EP-02 (Autenticação) ────────────────────────────────────────────────────────┘
EP-03 (Carteiras) ───────────────────────────────────────────────────────────┘
EP-04 (Transações) ───────────────────────────────────────────────────────────┘
```

---

## Stack Tecnológica Frontend

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| React/Vue | 18.x / 3.x | Framework SPA |
| Vite | 5.x | Build tool e dev server |
| TypeScript | 5.x | Tipagem estática |
| TailwindCSS | 3.x | Estilização utilitária |
| Chart.js / ECharts | 5.x / 5.x | Gráficos interativos |
| vue-grid-layout / react-grid-layout | 1.x | Drag & drop de widgets |
| Lucide Icons | 0.x | Ícones SVG |
| React Router / Vue Router | 6.x / 4.x | Roteamento SPA |
| Vite PWA Plugin | 0.x | Service Worker e manifest |

---

# Épico 15 — PWA (Progressive Web App)

---

### [STORY-1501] Service Worker e Cache Strategy

**Como** usuário do MoneyTrackr
**Eu quero** que a aplicação funcione como uma PWA instalável
**Para que** eu possa acessar o sistema como um app nativo, com ícone na tela inicial e funcionamento básico offline

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points

**Contexto**:
O MoneyTrackr deve ser uma Progressive Web App para oferecer experiência próxima a um app nativo. O service worker deve implementar estratégia de cache que permita funcionamento básico offline (visualização de dados já carregados) e sincronização automática quando a conexão for restaurada.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário acessa o MoneyTrackr pela primeira vez
      QUANDO a página carrega completamente
      ENTÃO o service worker deve ser registrado automaticamente
      E os assets essenciais (HTML, CSS, JS, fontes) devem ser cacheados

- [ ] DADO que o usuário já acessou o sistema anteriormente
      QUANDO ele acessa novamente com conexão lenta ou instável
      ENTÃO a página deve carregar instantaneamente do cache (estratégia cache-first para assets estáticos)

- [ ] DADO que o usuário está offline
      QUANDO ele tenta acessar uma página que já visitou antes
      ENTÃO o sistema deve exibir a página com dados do cache local
      E exibir indicador visual "Modo Offline" no topo da tela

- [ ] DADO que o usuário está offline
      QUANDO ele tenta acessar uma página que nunca visitou
      ENTÃO o sistema deve exibir página de fallback com mensagem "Esta página não está disponível offline"

- [ ] DADO que o usuário estava offline e a conexão foi restaurada
      QUANDO o sistema detecta que voltou online
      ENTÃO deve sincronizar automaticamente dados pendentes (se houver)
      E exibir toast "Conexão restaurada"

- [ ] DADO que uma nova versão do service worker está disponível
      QUANDO o usuário está usando a aplicação
      ENTÃO deve exibir notificação sutil "Nova versão disponível. Clique para atualizar."
      E ao clicar, recarregar a página com a nova versão

**Dependências**:
- Bloqueada por: Nenhuma (épico base)
- Bloqueia: STORY-1601 (Layout Base), STORY-1502 (Manifest)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] Lighthouse PWA score >= 90
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação atualizada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Usar `vite-plugin-pwa` para geração automática de service worker
- Estratégia de cache:
  - `cacheFirst` para assets estáticos (JS, CSS, fontes, imagens)
  - `networkFirst` para chamadas de API (com fallback para cache)
  - `staleWhileRevalidate` para dados não críticos
- Implementar `workbox-window` para gerenciamento de updates
- Criar hook/composable `useOnlineStatus()` para detectar estado de conexão
- Página de fallback offline em `src/pages/OfflineFallback.vue`

*Estrutura de Arquivos*:
```
src/
  service-worker/
    index.js                    # Entry point do SW
    strategies/
      api-cache.js              # Estratégia para APIs
      static-cache.js           # Estratégia para assets
    handlers/
      sync-handler.js           # Background sync
  composables/
    useOnlineStatus.js          # Hook de estado online/offline
    useOnlineStatus.test.js
  pages/
    OfflineFallback.vue         # Página de fallback offline
vite.config.js                  # Config do vite-plugin-pwa
```

**Cenários de Teste**:
- Cenário 1: Service worker registrado no primeiro acesso
- Cenário 2: Assets cacheados corretamente após primeiro carregamento
- Cenário 3: Página carrega do cache em segundo acesso
- Cenário 4: Indicador "Modo Offline" aparece quando offline
- Cenário 5: Página de fallback exibida para rota não cacheada
- Cenário 6: Toast "Conexão restaurada" ao voltar online
- Cenário 7: Notificação de nova versão do SW

---

### [STORY-1502] Manifest.json e Instalação PWA

**Como** usuário do MoneyTrackr
**Eu quero** instalar o MoneyTrackr como um aplicativo no meu dispositivo
**Para que** eu possa acessá-lo diretamente da tela inicial, como um app nativo

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 3 story points

**Contexto**:
O manifest.json é essencial para que a PWA seja instalável. Deve conter todos os metadados necessários: nome, ícones em múltiplos tamanhos, cores do tema, orientação preferida e comportamento de exibição (standalone).

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário acessa o MoneyTrackr em um navegador compatível (Chrome, Edge, Safari)
      QUANDO atende aos critérios de instalação PWA
      ENTÃO o navegador deve exibir prompt de instalação "Adicionar à tela inicial"

- [ ] DADO que o manifest.json está configurado
      QUANDO inspecionado
      ENTÃO deve conter:
        - `name`: "MoneyTrackr - Gestor de Investimentos"
        - `short_name`: "MoneyTrackr"
        - `display`: "standalone"
        - `orientation`: "portrait-primary"
        - `start_url`: "/"
        - `theme_color` e `background_color` conforme tema do sistema

- [ ] DADO que o usuário instala a PWA
      QUANDO abre pelo ícone da tela inicial
      ENTÃO deve abrir em modo standalone (sem barra de endereço do navegador)
      E exibir splash screen com ícone e cor do tema

- [ ] DADO que ícones são necessários para instalação
      QUANDO o manifest é carregado
      ENTÃO deve fornecer ícones nos tamanhos: 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512
      E ícones devem ter máscara para adaptive icons (Android)

- [ ] DADO que o usuário está em dispositivo iOS
      QUANDO acessa o MoneyTrackr
      ENTÃO deve ter meta tags de apple-mobile-web-app configuradas
      E ícones de apple-touch-icon disponíveis

**Dependências**:
- Bloqueada por: STORY-1501 (Service Worker)
- Bloqueia: Nenhuma

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Lighthouse PWA installable = Pass
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação atualizada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Configurar `vite-plugin-pwa` com `registerType: 'autoUpdate'`
- Gerar ícones a partir de um SVG master usando `sharp` ou ferramenta similar
- Meta tags iOS no `index.html`:
  - `<meta name="apple-mobile-web-app-capable" content="yes">`
  - `<meta name="apple-mobile-web-app-status-bar-style" content="default">`
  - `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">`
- Splash screens para iOS gerados dinamicamente

*Estrutura de Arquivos*:
```
public/
  icons/
    icon-72x72.png
    icon-96x96.png
    icon-128x128.png
    icon-144x144.png
    icon-152x152.png
    icon-192x192.png
    icon-384x384.png
    icon-512x512.png
    apple-touch-icon.png
    maskable-icon-512x512.png
  favicon.ico
src/
  assets/
    brand/
      logo.svg                    # Logo master para geração de ícones
vite.config.js                   # Config do manifest
```

**Cenários de Teste**:
- Cenário 1: Prompt de instalação aparece em Chrome desktop
- Cenário 2: Prompt de instalação aparece em Chrome Android
- Cenário 3: PWA abre em modo standalone após instalação
- Cenário 4: Splash screen exibida corretamente
- Cenário 5: Ícone correto exibido na tela inicial
- Cenário 6: Meta tags iOS presentes e corretas

---

### [STORY-1503] Background Sync e Offline Queue

**Como** usuário do MoneyTrackr
**Eu quero** que minhas ações offline sejam sincronizadas automaticamente quando a conexão for restaurada
**Para que** eu não perca nenhuma transação ou alteração feita sem internet

**Tipo**: Feature
**Prioridade**: Should Have
**Estimativa**: 5 story points

**Contexto**:
Usuários podem criar transações ou fazer alterações enquanto estão offline (ex.: no metrô, avião). O sistema deve enfileirar essas ações e sincronizar automaticamente quando a conexão voltar, sem exigir intervenção manual do usuário.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário está offline
      QUANDO ele cria uma nova transação
      ENTÃO o sistema deve salvar localmente no IndexedDB
      E exibir mensagem "Transação salva localmente. Será sincronizada quando online."
      E exibir indicador visual de pendências (badge com contador)

- [ ] DADO que existem transações pendentes de sincronização
      QUANDO a conexão é restaurada
      ENTÃO o sistema deve sincronizar automaticamente todas as pendências
      E exibir toast "X transações sincronizadas com sucesso"

- [ ] DADO que uma transação pendente falha ao sincronizar (ex.: conflito, validação)
      QUANDO o servidor retorna erro
      ENTÃO o sistema deve exibir toast com detalhes do erro
      E manter a transação na fila local para retry manual

- [ ] DADO que o usuário tem múltiplas pendências
      QUANDO visualiza o indicador de pendências
      ENTÃO pode clicar para ver lista detalhada de ações pendentes
      E pode cancelar individualmente ou sincronizar manualmente

- [ ] DADO que o usuário fecha o navegador com pendências
      QUANDO reabre a aplicação posteriormente
      ENTÃO as pendências devem persistir no IndexedDB
      E o sistema deve tentar sincronizar automaticamente se online

**Dependências**:
- Bloqueada por: STORY-1501 (Service Worker), STORY-2201 (Formulário de Transação)
- Bloqueia: Nenhuma

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação atualizada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Usar IndexedDB via biblioteca `idb` ou `Dexie.js`
- Criar store `pendingActions` com estrutura:
  ```javascript
  {
    id: string,
    type: 'CREATE_TRANSACTION' | 'UPDATE_TRANSACTION' | 'DELETE_TRANSACTION',
    payload: object,
    timestamp: number,
    walletId: string
  }
  ```
- Service Worker Background Sync API: `self.registration.sync.register('sync-transactions')`
- Hook/composable `useOfflineQueue()` para gerenciar fila
- Componente `<PendingActionsIndicator>` no header

*Estrutura de Arquivos*:
```
src/
  services/
    offline-queue/
      index.js                    # Gerenciador de fila offline
      indexeddb.js                # Wrapper IndexedDB
      sync-manager.js             # Lógica de sincronização
  composables/
    useOfflineQueue.js            # Hook para fila offline
    useOfflineQueue.test.js
  components/
    layout/
      PendingActionsIndicator.vue # Badge de pendências
      PendingActionsList.vue      # Modal/lista de pendências
```

**Cenários de Teste**:
- Cenário 1: Transação criada offline é salva localmente
- Cenário 2: Indicador de pendências exibe contador correto
- Cenário 3: Sincronização automática ao voltar online
- Cenário 4: Toast de sucesso após sincronização
- Cenário 5: Tratamento de erro na sincronização
- Cenário 6: Persistência de pendências após fechar navegador

---

# Épico 16 — Layout Base

---

### [STORY-1601] Estrutura de Layout Principal

**Como** usuário do MoneyTrackr
**Eu quero** uma interface com layout consistente de sidebar + área de conteúdo
**Para que** eu possa navegar facilmente entre as seções do sistema

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points

**Contexto**:
O layout base é a fundação visual de toda a aplicação. Deve seguir padrão de sidebar fixa à esquerda e área de conteúdo principal à direita, com header superior. O layout deve ser responsivo, adaptando-se para mobile com sidebar colapsável.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário acessa qualquer página autenticada
      QUANDO a página carrega
      ENTÃO deve exibir layout com:
        - Sidebar fixa à esquerda (largura 260px em desktop)
        - Header superior com logo, busca, notificações e perfil
        - Área de conteúdo principal com scroll independente

- [ ] DADO que o usuário está em dispositivo desktop
      QUANDO visualiza o layout
      ENTÃO a sidebar deve estar sempre visível
      E o conteúdo deve ocupar o espaço restante (calc(100vw - 260px))

- [ ] DADO que o usuário está em dispositivo mobile (< 768px)
      QUANDO visualiza o layout
      ENTÃO a sidebar deve estar oculta por padrão
      E deve exibir botão de menu (hamburger) no header
      E o conteúdo deve ocupar 100% da largura

- [ ] DADO que o usuário está em tablet (768px - 1024px)
      QUANDO visualiza o layout
      ENTÃO a sidebar deve estar em modo colapsado (apenas ícones, 64px)
      E ao passar o mouse, expandir temporariamente

- [ ] DADO que o usuário navega entre páginas
      QUANDO a rota muda
      ENTÃO o layout deve permanecer estável (não recarregar)
      E apenas o conteúdo da área principal deve atualizar

**Dependências**:
- Bloqueada por: STORY-1501 (PWA base)
- Bloqueia: STORY-1701 (Navegação), STORY-1801 (Sidebar), STORY-1602 (Tema)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Criar componente `<AppLayout>` que encapsula toda a estrutura
- Usar CSS Grid para layout principal:
  ```css
  .app-layout {
    display: grid;
    grid-template-columns: 260px 1fr;
    grid-template-rows: 64px 1fr;
    grid-template-areas:
      "sidebar header"
      "sidebar content";
    height: 100vh;
  }
  ```
- Criar componentes: `<AppSidebar>`, `<AppHeader>`, `<AppContent>`
- Usar `<Outlet>` / `<RouterView>` para renderizar conteúdo dinâmico
- Breakpoints: mobile < 768px, tablet 768-1024px, desktop > 1024px

*Estrutura de Arquivos*:
```
src/
  components/
    layout/
      AppLayout.vue              # Layout principal
      AppLayout.test.js
      AppSidebar.vue             # Sidebar container
      AppSidebar.test.js
      AppHeader.vue              # Header superior
      AppHeader.test.js
      AppContent.vue             # Área de conteúdo
      AppContent.test.js
  styles/
    layout.css                   # Estilos do layout
  App.vue                        # Entry point com AppLayout
```

**Cenários de Teste**:
- Cenário 1: Layout renderiza corretamente em desktop
- Cenário 2: Sidebar oculta em mobile por padrão
- Cenário 3: Sidebar colapsada em tablet
- Cenário 4: Conteúdo atualiza sem recarregar layout
- Cenário 5: Scroll independente no conteúdo
- Cenário 6: Header fixo no topo

---

### [STORY-1602] Sistema de Temas (Light/Dark Mode)

**Como** usuário do MoneyTrackr
**Eu quero** alternar entre tema claro e escuro
**Para que** eu possa usar o sistema confortavelmente em diferentes condições de iluminação

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points

**Contexto**:
O sistema de temas deve suportar modo claro e escuro, com persistência da preferência do usuário. Deve também detectar automaticamente a preferência do sistema operacional (prefers-color-scheme) na primeira visita.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário acessa o MoneyTrackr pela primeira vez
      QUANDO o sistema operacional está em modo escuro
      ENTÃO o MoneyTrackr deve iniciar em tema escuro automaticamente

- [ ] DADO que o usuário acessa o MoneyTrackr pela primeira vez
      QUANDO o sistema operacional está em modo claro
      ENTÃO o MoneyTrackr deve iniciar em tema claro automaticamente

- [ ] DADO que o usuário está em qualquer página
      QUANDO clica no botão de alternar tema no header
      ENTÃO o tema deve alternar entre claro e escuro instantaneamente
      E a preferência deve ser salva no localStorage

- [ ] DADO que o usuário já definiu uma preferência de tema
      QUANDO acessa o sistema novamente
      ENTÃO o tema salvo deve ser aplicado (ignorando preferência do SO)

- [ ] DADO que o tema é alterado
      QUANDO a transição ocorre
      ENTÃO todas as cores devem mudar suavemente (transição de 200ms)
      E gráficos, tabelas e componentes devem refletir o novo tema

- [ ] DADO que o usuário está em tema escuro
      QUANDO visualiza gráficos
      ENTÃO as cores dos gráficos devem ter contraste adequado
      E o fundo dos gráficos deve ser escuro

**Dependências**:
- Bloqueada por: STORY-1601 (Layout Base)
- Bloqueia: STORY-2001 (Gráficos), STORY-2101 (Transações UI)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Usar CSS Custom Properties (variáveis CSS) para cores:
  ```css
  :root {
    --color-bg-primary: #ffffff;
    --color-bg-secondary: #f5f5f5;
    --color-text-primary: #1a1a1a;
    --color-text-secondary: #666666;
    --color-accent: #3b82f6;
    /* ... */
  }
  
  [data-theme="dark"] {
    --color-bg-primary: #1a1a1a;
    --color-bg-secondary: #2d2d2d;
    --color-text-primary: #ffffff;
    --color-text-secondary: #a0a0a0;
    /* ... */
  }
  ```
- Hook/composable `useTheme()` para gerenciar estado do tema
- Persistir em `localStorage.getItem('moneytrackr-theme')`
- Detectar preferência do SO: `window.matchMedia('(prefers-color-scheme: dark)')`
- Aplicar tema no `<html>` ou `<body>` via atributo `data-theme`

*Estrutura de Arquivos*:
```
src/
  composables/
    useTheme.js                   # Hook de gerenciamento de tema
    useTheme.test.js
  styles/
    themes/
      variables.css               # Variáveis CSS de cores
      light.css                   # Override para tema claro
      dark.css                    # Override para tema escuro
  components/
    layout/
      ThemeToggle.vue             # Botão de alternar tema
      ThemeToggle.test.js
```

**Cenários de Teste**:
- Cenário 1: Tema escuro aplicado automaticamente se SO em dark mode
- Cenário 2: Tema claro aplicado automaticamente se SO em light mode
- Cenário 3: Alternância de tema ao clicar no botão
- Cenário 4: Preferência persistida no localStorage
- Cenário 5: Tema salvo aplicado ao reabrir aplicação
- Cenário 6: Transição suave ao alternar tema
- Cenário 7: Gráficos refletem tema atual

---

### [STORY-1603] Header Global

**Como** usuário do MoneyTrackr
**Eu quero** um header global com elementos de navegação e ações rápidas
**Para que** eu possa acessar funcionalidades importantes de qualquer página

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 3 story points

**Contexto**:
O header global deve conter: logo/nome do sistema, toggle de tema, indicador de pendências offline, notificações, menu de perfil do usuário e botão de menu mobile. Deve ser fixo no topo e responsivo.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário está autenticado
      QUANDO visualiza o header
      ENTÃO deve exibir:
        - Logo "MoneyTrackr" à esquerda (link para Dashboard)
        - Toggle de tema (sol/lua) ao lado do logo
        - Indicador de pendências offline (se houver)
        - Ícone de notificações com badge (se houver)
        - Avatar do usuário com menu dropdown

- [ ] DADO que o usuário clica no avatar
      QUANDO o dropdown abre
      ENTÃO deve exibir:
        - Nome e email do usuário
        - Link para "Minha Conta"
        - Link para "Configurações"
        - Botão "Sair"

- [ ] DADO que o usuário está em dispositivo mobile
      QUANDO visualiza o header
      ENTÃO deve exibir botão hamburger à esquerda
      E o logo deve ser menor ou apenas ícone

- [ ] DADO que o usuário clica no logo
      QUANDO está em qualquer página
      ENTÃO deve navegar para o Dashboard

- [ ] DADO que o usuário clica em "Sair"
      QUANDO no menu de perfil
      ENTÃO deve fazer logout
      E redirecionar para página de login

**Dependências**:
- Bloqueada por: STORY-1601 (Layout Base), STORY-1602 (Tema)
- Bloqueia: Nenhuma

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Componente `<AppHeader>` com slots para extensibilidade
- Subcomponentes: `<HeaderLogo>`, `<ThemeToggle>`, `<NotificationBell>`, `<UserMenu>`
- Menu dropdown usando `<Menu>` / `<DropdownMenu>` de biblioteca de UI ou custom
- Usar `useAuthStore()` para dados do usuário e logout
- Z-index alto para header (z-index: 50)

*Estrutura de Arquivos*:
```
src/
  components/
    layout/
      AppHeader.vue              # Header principal
      AppHeader.test.js
      HeaderLogo.vue             # Componente do logo
      ThemeToggle.vue            # Toggle de tema
      NotificationBell.vue       # Ícone de notificações
      UserMenu.vue               # Menu dropdown do usuário
      UserMenu.test.js
```

**Cenários de Teste**:
- Cenário 1: Header exibe todos os elementos em desktop
- Cenário 2: Botão hamburger aparece em mobile
- Cenário 3: Menu dropdown do usuário abre ao clicar
- Cenário 4: Logout funciona corretamente
- Cenário 5: Logo navega para Dashboard
- Cenário 6: Toggle de tema funciona no header

---

# Épico 17 — Navegação

---

### [STORY-1701] Roteamento SPA com Lazy Loading

**Como** usuário do MoneyTrackr
**Eu quero** navegar entre páginas sem recarregar a aplicação
**Para que** eu tenha uma experiência fluida e rápida

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points

**Contexto**:
O roteamento deve ser client-side (SPA), com carregamento lazy de cada rota para otimizar o bundle inicial. Cada página deve ser um chunk separado, carregado sob demanda.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário navega para uma nova página
      QUANDO clica em um link do menu
      ENTÃO a URL deve mudar sem recarregar a página
      E o conteúdo deve ser carregado dinamicamente

- [ ] DADO que o usuário acessa uma rota pela primeira vez
      QUANDO o componente da página ainda não foi carregado
      ENTÃO deve exibir loading indicator enquanto o chunk é baixado
      E o chunk deve ser cacheado para acessos subsequentes

- [ ] DADO que o usuário acessa uma rota já visitada
      QUANDO o chunk já está em cache
      ENTÃO a transição deve ser instantânea (sem loading)

- [ ] DADO que o usuário usa botões voltar/avançar do navegador
      QUANDO navega pelo histórico
      ENTÃO a aplicação deve restaurar a página correta
      E manter estado de scroll quando aplicável

- [ ] DADO que o usuário acessa uma URL diretamente (deep link)
      QUANDO a URL corresponde a uma rota válida
      ENTÃO a aplicação deve carregar e exibir a página correta

**Dependências**:
- Bloqueada por: STORY-1601 (Layout Base)
- Bloqueia: STORY-1702 (Route Guards), STORY-1703 (Página 404)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação atualizada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend (React)*:
```javascript
// React Router v6 com lazy loading
import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Transactions = lazy(() => import('@/pages/Transactions'))
const Wallets = lazy(() => import('@/pages/Wallets'))

const router = createBrowserRouter([
  { path: '/', element: <Suspense fallback={<PageLoader />}><Dashboard /></Suspense> },
  { path: '/transactions', element: <Suspense fallback={<PageLoader />}><Transactions /></Suspense> },
  // ...
])
```

*Frontend (Vue)*:
```javascript
// Vue Router 4 com lazy loading
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('@/pages/Dashboard.vue')
  },
  {
    path: '/transactions',
    name: 'Transactions',
    component: () => import('@/pages/Transactions.vue')
  },
  // ...
]

const router = createRouter({
  history: createWebHistory(),
  routes
})
```

*Estrutura de Arquivos*:
```
src/
  router/
    index.js                     # Configuração do router
    routes.js                     # Definição de rotas
    guards.js                     # Navigation guards
  pages/
    Dashboard.vue                 # Página Dashboard
    Transactions.vue              # Página Transações
    Wallets.vue                   # Página Carteiras
    Imports.vue                   # Página Importação
    Registrations.vue             # Página Cadastros
    Settings.vue                  # Página Configurações
    NotFound.vue                  # Página 404
  components/
    common/
      PageLoader.vue              # Loading para lazy loading
```

**Cenários de Teste**:
- Cenário 1: Navegação entre páginas sem reload
- Cenário 2: Loading exibido ao carregar rota pela primeira vez
- Cenário 3: Transição instantânea em rota já visitada
- Cenário 4: Botões voltar/avançar funcionam corretamente
- Cenário 5: Deep link carrega página correta
- Cenário 6: Chunks são cacheados após primeiro carregamento

---

### [STORY-1702] Route Guards (Autenticação)

**Como** usuário do MoneyTrackr
**Eu quero** que rotas protegidas redirecionem para login quando não autenticado
**Para que** meus dados de investimento estejam protegidos de acesso não autorizado

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 3 story points

**Contexto**:
Todas as rotas da aplicação (exceto login, registro e recuperação de senha) devem ser protegidas. O guard deve verificar se o usuário está autenticado (token válido) antes de permitir acesso.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário não está autenticado
      QUANDO tenta acessar uma rota protegida (ex.: /transactions)
      ENTÃO deve ser redirecionado para /login
      E a URL original deve ser salva em query param (redirect=/transactions)

- [ ] DADO que o usuário está autenticado
      QUANDO acessa uma rota protegida
      ENTÃO deve ter acesso normal à página

- [ ] DADO que o usuário está autenticado
      QUANDO tenta acessar /login ou /register
      ENTÃO deve ser redirecionado para o Dashboard

- [ ] DADO que o token do usuário expirou
      QUANDO tenta navegar para uma rota protegida
      ENTÃO o sistema deve detectar token expirado
      E redirecionar para login com mensagem "Sessão expirada. Faça login novamente."

- [ ] DADO que o usuário faz login com redirect salvo
      QUANDO o login é bem-sucedido
      ENTÃO deve ser redirecionado para a URL original (redirect param)

**Dependências**:
- Bloqueada por: STORY-1701 (Roteamento), EP-02 (Autenticação)
- Bloqueia: Nenhuma

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação atualizada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend (React)*:
```javascript
// React Router loader + protected route
import { redirect } from 'react-router-dom'

const protectedLoader = async () => {
  const isAuthenticated = useAuthStore.getState().isAuthenticated
  if (!isAuthenticated) {
    return redirect('/login?redirect=' + encodeURIComponent(window.location.pathname))
  }
  return null
}

// No router:
{
  path: '/transactions',
  element: <Transactions />,
  loader: protectedLoader
}
```

*Frontend (Vue)*:
```javascript
// Vue Router navigation guard
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({
      path: '/login',
      query: { redirect: to.fullPath }
    })
  } else if ((to.path === '/login' || to.path === '/register') && authStore.isAuthenticated) {
    next('/dashboard')
  } else {
    next()
  }
})
```

*Estrutura de Arquivos*:
```
src/
  router/
    guards.js                     # Navigation guards
    routes.js                     # Rotas com meta requiresAuth
  composables/
    useAuth.js                    # Hook de autenticação
```

**Cenários de Teste**:
- Cenário 1: Usuário não autenticado é redirecionado para login
- Cenário 2: URL original salva em redirect param
- Cenário 3: Usuário autenticado acessa rotas protegidas
- Cenário 4: Usuário autenticado é redirecionado do login para dashboard
- Cenário 5: Token expirado detectado e redireciona para login
- Cenário 6: Após login, redireciona para URL original

---

### [STORY-1703] Página 404 e Tratamento de Rotas

**Como** usuário do MoneyTrackr
**Eu quero** ver uma página amigável quando acessar uma rota inexistente
**Para que** eu entenda que a página não existe e possa navegar para uma válida

**Tipo**: Feature
**Prioridade**: Should Have
**Estimativa**: 2 story points

**Contexto**:
Quando o usuário acessa uma URL que não corresponde a nenhuma rota configurada, deve ver uma página 404 com design consistente e opção de navegar para o Dashboard.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário acessa uma URL inexistente (ex.: /pagina-que-nao-existe)
      QUANDO a rota não está configurada
      ENTÃO deve exibir página 404 com:
        - Ilustração amigável
        - Mensagem "Página não encontrada"
        - Botão "Voltar ao Dashboard"

- [ ] DADO que o usuário está na página 404
      QUANDO clica em "Voltar ao Dashboard"
      ENTÃO deve navegar para o Dashboard

- [ ] DADO que o usuário está na página 404
      QUANDO usa o botão voltar do navegador
      ENTÃO deve voltar para a página anterior (se houver histórico)

- [ ] DADO que o usuário acessa uma rota com parâmetro inválido (ex.: /wallet/invalid-id)
      QUANDO o ID não existe no sistema
      ENTÃO deve exibir página 404 ou mensagem "Carteira não encontrada"

**Dependências**:
- Bloqueada por: STORY-1701 (Roteamento)
- Bloqueia: Nenhuma

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação atualizada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Rota catch-all no router:
  ```javascript
  // React Router
  { path: '*', element: <NotFound /> }
  
  // Vue Router
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound }
  ```
- Componente `<NotFound>` com ilustração (pode usar Lottie ou SVG)
- Botão com `<Link to="/">` ou `<router-link to="/">`

*Estrutura de Arquivos*:
```
src/
  pages/
    NotFound.vue                 # Página 404
    NotFound.test.js
  assets/
    illustrations/
      404-illustration.svg       # Ilustração da página 404
```

**Cenários de Teste**:
- Cenário 1: Página 404 exibida para rota inexistente
- Cenário 2: Botão "Voltar ao Dashboard" funciona
- Cenário 3: Botão voltar do navegador funciona
- Cenário 4: Página 404 tem design consistente

---

# Épico 18 — Sidebar

---

### [STORY-1801] Menu de Navegação Principal

**Como** usuário do MoneyTrackr
**Eu quero** um menu lateral com acesso às principais seções do sistema
**Para que** eu possa navegar rapidamente entre Dashboard, Transações, Importação, Cadastros e Carteiras

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points

**Contexto**:
A sidebar é o principal elemento de navegação. Deve conter links para todas as seções principais, com ícones e labels claros. O item ativo deve ser destacado visualmente.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário visualiza a sidebar
      QUANDO a página carrega
      ENTÃO deve exibir os seguintes itens de menu:
        - Dashboard (ícone: LayoutDashboard)
        - Transações (ícone: Receipt)
        - Importação (ícone: Upload)
        - Cadastros (ícone: Database)
        - Carteiras (ícone: Wallet)

- [ ] DADO que o usuário está em uma página específica
      QUANDO visualiza a sidebar
      ENTÃO o item de menu correspondente deve estar destacado (cor de fundo diferente, borda esquerda)

- [ ] DADO que o usuário clica em um item do menu
      QUANDO navega para a página
      ENTÃO a URL deve mudar
      E o item correspondente deve ficar ativo

- [ ] DADO que o usuário passa o mouse sobre um item
      QUANDO o hover está ativo
      ENTÃO deve exibir efeito visual (background mais claro, cursor pointer)

- [ ] DADO que o usuário está em dispositivo mobile
      QUANDO a sidebar está oculta
      ENTÃO deve poder abrir via botão hamburger no header
      E a sidebar deve aparecer como overlay (cobrindo o conteúdo)

**Dependências**:
- Bloqueada por: STORY-1601 (Layout Base), STORY-1701 (Roteamento)
- Bloqueia: STORY-1802 (Sidebar Colapsável), STORY-1803 (Mobile Overlay)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Componente `<SidebarMenu>` com lista de `<SidebarItem>`
- Usar ícones da biblioteca Lucide:
  ```javascript
  import { LayoutDashboard, Receipt, Upload, Database, Wallet } from 'lucide-vue-next'
  ```
- Detectar rota ativa via `useRoute()` / `useLocation()`
- Estilo para item ativo: `bg-primary/10 text-primary border-l-2 border-primary`

*Estrutura de Arquivos*:
```
src/
  components/
    layout/
      AppSidebar.vue             # Container da sidebar
      AppSidebar.test.js
      SidebarMenu.vue           # Lista de menu
      SidebarItem.vue            # Item individual do menu
      SidebarItem.test.js
  constants/
    menu-items.js                # Configuração dos itens de menu
```

**Cenários de Teste**:
- Cenário 1: Sidebar exibe todos os itens de menu
- Cenário 2: Item ativo está destacado visualmente
- Cenário 3: Clique em item navega para página correta
- Cenário 4: Hover em item exibe efeito visual
- Cenário 5: Sidebar oculta em mobile por padrão

---

### [STORY-1802] Sidebar Colapsável (Modo Ícones)

**Como** usuário do MoneyTrackr
**Eu quero** poder colapsar a sidebar para exibir apenas ícones
**Para que** eu tenha mais espaço para visualizar o conteúdo principal

**Tipo**: Feature
**Prioridade**: Should Have
**Estimativa**: 3 story points

**Contexto**:
Em desktop, o usuário pode querer mais espaço horizontal para o conteúdo. A sidebar deve poder ser colapsada para exibir apenas os ícones dos itens de menu, expandindo temporariamente ao hover.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário está em desktop
      QUANDO clica no botão de colapsar sidebar
      ENTÃO a sidebar deve reduzir para 64px de largura
      E exibir apenas os ícones dos itens de menu
      E o botão deve mudar para ícone de expandir

- [ ] DADO que a sidebar está colapsada
      QUANDO o usuário passa o mouse sobre um item
      ENTÃO deve exibir tooltip com o nome do item
      E a sidebar pode expandir temporariamente (opcional)

- [ ] DADO que a sidebar está colapsada
      QUANDO o usuário clica no botão de expandir
      ENTÃO a sidebar deve voltar para 260px
      E exibir ícones + labels

- [ ] DADO que o usuário altera o estado da sidebar
      QUANDO recarrega a página
      ENTÃO o estado (expandida/colapsada) deve ser persistido

- [ ] DADO que o usuário está em tablet (768-1024px)
      QUANDO acessa o sistema
      ENTÃO a sidebar deve iniciar colapsada por padrão

**Dependências**:
- Bloqueada por: STORY-1801 (Menu Principal)
- Bloqueia: Nenhuma

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Estado da sidebar em `useSidebarStore()` ou context
- Persistir em `localStorage.getItem('sidebar-collapsed')`
- Transição CSS suave: `transition: width 200ms ease`
- Tooltip usando `<Tooltip>` nativo ou biblioteca
- Botão de toggle no rodapé da sidebar

*Estrutura de Arquivos*:
```
src/
  composables/
    useSidebar.js                # Hook de estado da sidebar
  components/
    layout/
      SidebarToggle.vue          # Botão de colapsar/expandir
```

**Cenários de Teste**:
- Cenário 1: Sidebar colapsa ao clicar no botão
- Cenário 2: Apenas ícones visíveis quando colapsada
- Cenário 3: Tooltip aparece ao hover em item colapsado
- Cenário 4: Sidebar expande ao clicar no botão
- Cenário 5: Estado persistido após recarregar
- Cenário 6: Sidebar inicia colapsada em tablet

---

### [STORY-1803] Sidebar Mobile (Overlay)

**Como** usuário do MoneyTrackr em dispositivo mobile
**Eu quero** uma sidebar que abra como overlay
**Para que** eu possa navegar sem perder espaço da tela

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 3 story points

**Contexto**:
Em dispositivos mobile, a sidebar deve estar oculta por padrão e abrir como um overlay (modal) quando o usuário clica no botão hamburger. Um backdrop escuro deve cobrir o conteúdo principal.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário está em dispositivo mobile (< 768px)
      QUANDO a página carrega
      ENTÃO a sidebar deve estar oculta
      E o botão hamburger deve estar visível no header

- [ ] DADO que o usuário clica no botão hamburger
      QUANDO a sidebar abre
      ENTÃO deve aparecer deslizando da esquerda (animação de 300ms)
      E um backdrop escuro (opacity 50%) deve cobrir o conteúdo
      E o botão hamburger deve mudar para ícone X

- [ ] DADO que a sidebar mobile está aberta
      QUANDO o usuário clica no backdrop
      ENTÃO a sidebar deve fechar
      E o backdrop deve desaparecer

- [ ] DADO que a sidebar mobile está aberta
      QUANDO o usuário clica em um item do menu
      ENTÃO deve navegar para a página
      E a sidebar deve fechar automaticamente

- [ ] DADO que a sidebar mobile está aberta
      QUANDO o usuário pressiona a tecla ESC
      ENTÃO a sidebar deve fechar

- [ ] DADO que a sidebar mobile está aberta
      QUANDO o usuário redimensiona a janela para desktop
      ENTÃO a sidebar deve fechar o modo overlay
      E voltar ao comportamento de sidebar fixa

**Dependências**:
- Bloqueada por: STORY-1801 (Menu Principal)
- Bloqueia: Nenhuma

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Usar media query para detectar mobile: `useMediaQuery('(max-width: 768px)')`
- Componente `<MobileSidebar>` com animação de slide
- Backdrop com `position: fixed; inset: 0; background: rgba(0,0,0,0.5)`
- Usar `<Teleport>` (Vue) ou `createPortal` (React) para renderizar fora do fluxo
- Z-index alto para sidebar mobile (z-index: 40)

*Estrutura de Arquivos*:
```
src/
  components/
    layout/
      MobileSidebar.vue          # Sidebar mobile com overlay
      MobileSidebar.test.js
      MobileBackdrop.vue         # Backdrop escuro
  composables/
    useMediaQuery.js             # Hook para media queries
```

**Cenários de Teste**:
- Cenário 1: Sidebar oculta em mobile por padrão
- Cenário 2: Sidebar abre ao clicar em hamburger
- Cenário 3: Backdrop aparece quando sidebar aberta
- Cenário 4: Sidebar fecha ao clicar no backdrop
- Cenário 5: Sidebar fecha ao navegar
- Cenário 6: Sidebar fecha ao pressionar ESC
- Cenário 7: Sidebar adapta ao redimensionar para desktop

---

# Épico 19 — Dashboard

---

### [STORY-1901] Grid de Widgets com Drag & Drop

**Como** usuário do MoneyTrackr
**Eu quero** um dashboard com widgets que posso reorganizar
**Para que** eu personalize a visualização das informações mais importantes para mim

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points

**Contexto**:
O Dashboard é a página principal do sistema, onde o usuário visualiza um resumo de seu portfolio. Deve exibir widgets em um grid que pode ser reorganizado via drag & drop. O layout deve ser salvo por carteira.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário acessa o Dashboard
      QUANDO a página carrega
      ENTÃO deve exibir um grid de widgets com:
        - Resumo do Patrimônio
        - Gráfico de Performance
        - Distribuição por Classe de Ativo
        - Últimas Transações
        - Próximos Proventos

- [ ] DADO que o usuário quer reorganizar os widgets
      QUANDO arrasta um widget para nova posição
      ENTÃO os outros widgets devem se reorganizar automaticamente
      E a nova posição deve ser salva automaticamente

- [ ] DADO que o usuário quer redimensionar um widget
      QUANDO arrasta a alça de resize
      ENTÃO o widget deve crescer ou diminuir
      E ocupar mais ou menos células do grid

- [ ] DADO que o usuário alterna entre carteiras
      QUANDO seleciona uma carteira diferente
      ENTÃO o layout do dashboard deve ser específico daquela carteira
      E os widgets devem refletir dados da carteira selecionada

- [ ] DADO que o usuário está em dispositivo mobile
      QUANDO visualiza o dashboard
      ENTÃO os widgets devem empilhar verticalmente
      E drag & drop deve estar desabilitado

**Dependências**:
- Bloqueada por: STORY-1601 (Layout Base), EP-03 (Carteiras)
- Bloqueia: STORY-1902 (Adicionar/Remover Widgets), STORY-1903 (Salvar Layout)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Usar `vue-grid-layout` (Vue) ou `react-grid-layout` (React):
  ```javascript
  // Vue Grid Layout
  import { GridLayout, GridItem } from 'vue-grid-layout'
  
  const layout = [
    { i: 'patrimonio', x: 0, y: 0, w: 4, h: 2 },
    { i: 'performance', x: 4, y: 0, w: 4, h: 3 },
    { i: 'distribuicao', x: 0, y: 2, w: 4, h: 3 },
    // ...
  ]
  ```
- Grid de 12 colunas em desktop, 1 coluna em mobile
- Cada widget é um componente independente
- Salvar layout em `localStorage` e sincronizar com API

*Estrutura de Arquivos*:
```
src/
  pages/
    Dashboard.vue                # Página Dashboard
  components/
    dashboard/
      DashboardGrid.vue          # Container do grid
      DashboardGrid.test.js
      WidgetContainer.vue        # Wrapper de cada widget
      widgets/
        PatrimonioWidget.vue     # Widget de patrimônio
        PerformanceWidget.vue    # Widget de performance
        DistribuicaoWidget.vue   # Widget de distribuição
        UltimasTransacoesWidget.vue
        ProventosWidget.vue
  composables/
    useDashboardLayout.js        # Hook para gerenciar layout
```

**Cenários de Teste**:
- Cenário 1: Grid exibe todos os widgets padrão
- Cenário 2: Drag & drop reorganiza widgets
- Cenário 3: Resize altera tamanho do widget
- Cenário 4: Layout salvo automaticamente
- Cenário 5: Layout específico por carteira
- Cenário 6: Widgets empilham verticalmente em mobile

---

### [STORY-1902] Adicionar e Remover Widgets

**Como** usuário do MoneyTrackr
**Eu quero** adicionar ou remover widgets do meu dashboard
**Para que** eu personalize quais informações são exibidas

**Tipo**: Feature
**Prioridade**: Should Have
**Estimativa**: 5 story points

**Contexto**:
O usuário deve poder adicionar novos widgets ao dashboard a partir de uma lista de widgets disponíveis, e remover widgets existentes. Widgets removidos podem ser readicionados posteriormente.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário quer adicionar um widget
      QUANDO clica no botão "Adicionar Widget"
      ENTÃO deve exibir modal com lista de widgets disponíveis:
        - Patrimônio Total
        - Gráfico de Performance
        - Distribuição por Classe
        - Rentabilidade por Ativo
        - Últimas Transações
        - Próximos Proventos
        - Alertas de Preço

- [ ] DADO que o usuário seleciona um widget no modal
      QUANDO clica em "Adicionar"
      ENTÃO o widget deve aparecer no dashboard
      E ser posicionado automaticamente no primeiro espaço disponível

- [ ] DADO que o usuário quer remover um widget
      QUANDO clica no ícone de fechar (X) no canto do widget
      ENTÃO deve exibir confirmação "Remover este widget?"
      E ao confirmar, o widget deve ser removido do grid

- [ ] DADO que o usuário removeu um widget
      QUANDO abre o modal de adicionar widget
      ENTÃO o widget removido deve aparecer na lista de disponíveis

- [ ] DADO que o usuário remove todos os widgets
      QUANDO o dashboard fica vazio
      ENTÃO deve exibir mensagem "Adicione widgets para personalizar seu dashboard"
      E botão "Adicionar Widget"

**Dependências**:
- Bloqueada por: STORY-1901 (Grid de Widgets)
- Bloqueia: Nenhuma

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Modal `<AddWidgetModal>` com lista de widgets
- Cada widget tem propriedade `removable` (alguns podem ser fixos)
- Ícone de fechar aparece no hover do widget
- Estado de widgets disponíveis vs ativos em `useDashboardStore()`

*Estrutura de Arquivos*:
```
src/
  components/
    dashboard/
      AddWidgetModal.vue         # Modal de adicionar widget
      AddWidgetModal.test.js
      WidgetRemoveButton.vue     # Botão de remover widget
  constants/
    available-widgets.js         # Lista de widgets disponíveis
```

**Cenários de Teste**:
- Cenário 1: Modal de adicionar widget abre corretamente
- Cenário 2: Widget é adicionado ao selecionar
- Cenário 3: Widget é posicionado automaticamente
- Cenário 4: Widget é removido ao confirmar
- Cenário 5: Widget removido aparece na lista de disponíveis
- Cenário 6: Dashboard vazio exibe mensagem e botão

---

### [STORY-1903] Persistência de Layout por Carteira

**Como** usuário do MoneyTrackr
**Eu quero** que meu layout de dashboard seja salvo por carteira
**Para que** cada carteira tenha sua própria configuração de widgets

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 3 story points

**Contexto**:
Cada carteira pode ter um propósito diferente (ex.: aposentadoria, reserva de emergência, trading). O usuário pode querer visualizar widgets diferentes para cada carteira. O layout deve ser persistido no backend.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário reorganiza o dashboard
      QUANDO solta um widget em nova posição
      ENTÃO o layout deve ser salvo automaticamente (debounce de 500ms)
      E associado à carteira atualmente selecionada

- [ ] DADO que o usuário alterna entre carteiras
      QUANDO seleciona uma carteira diferente
      ENTÃO o dashboard deve carregar o layout salvo daquela carteira
      E os widgets devem refletir dados da carteira

- [ ] DADO que o usuário acessa uma carteira pela primeira vez
      QUANDO não existe layout salvo
      ENTÃO deve carregar o layout padrão do sistema

- [ ] DADO que o layout é salvo
      QUANDO o usuário recarrega a página
      ENTÃO o layout deve ser restaurado exatamente como estava

- [ ] DADO que o usuário está offline
      QUANDO altera o layout
      ENTÃO deve salvar localmente (IndexedDB)
      E sincronizar quando voltar online

**Dependências**:
- Bloqueada por: STORY-1901 (Grid de Widgets), EP-03 (Carteiras)
- Bloqueia: Nenhuma

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação atualizada
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Estrutura do layout salvo:
  ```javascript
  {
    walletId: 'uuid',
    layout: [
      { i: 'widget-id', x: 0, y: 0, w: 4, h: 2 },
      // ...
    ],
    activeWidgets: ['patrimonio', 'performance', 'distribuicao'],
    updatedAt: '2026-03-27T10:00:00Z'
  }
  ```
- API endpoint: `PUT /api/wallets/:id/dashboard-layout`
- Otimistic update no frontend
- Fallback para localStorage se offline

*Backend*:
- Endpoint: `PUT /api/wallets/:id/dashboard-layout`
- Salvar em collection `dashboardLayouts` ou embed em `wallets`

*Estrutura de Arquivos*:
```
src/
  composables/
    useDashboardLayout.js        # Hook com persistência
  services/
    dashboard-service.js         # Serviço de API
```

**Cenários de Teste**:
- Cenário 1: Layout salvo automaticamente ao reorganizar
- Cenário 2: Layout carregado ao alternar carteira
- Cenário 3: Layout padrão carregado para nova carteira
- Cenário 4: Layout restaurado ao recarregar página
- Cenário 5: Layout salvo localmente quando offline
- Cenário 6: Layout sincronizado ao voltar online

---

# Épico 20 — Gráficos

---

### [STORY-2001] Gráfico de Performance do Portfolio

**Como** usuário do MoneyTrackr
**Eu quero** visualizar a performance do meu portfolio em um gráfico de linha
**Para que** eu entenda a evolução do meu patrimônio ao longo do tempo

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points

**Contexto**:
O gráfico de performance é o principal widget do dashboard. Deve exibir a evolução do patrimônio total ao longo do tempo, com possibilidade de adicionar benchmarks (CDI, IBOV) e agrupar por classe de ativo.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário visualiza o gráfico de performance
      QUANDO o widget carrega
      ENTÃO deve exibir gráfico de linha com:
        - Eixo X: período de tempo (datas)
        - Eixo Y: valor do patrimônio (R$)
        - Linha principal: Patrimônio Total
        - Tooltip ao passar mouse sobre pontos

- [ ] DADO que o usuário passa o mouse sobre o gráfico
      QUANDO posiciona sobre um ponto
      ENTÃO deve exibir tooltip com:
        - Data formatada (DD/MM/YYYY)
        - Valor do patrimônio na data
        - Variação percentual desde o início do período

- [ ] DADO que o usuário quer ver mais detalhes
      QUANDO seleciona uma região do gráfico
      ENTÃO deve aplicar zoom na região selecionada
      E exibir botão "Reset Zoom"

- [ ] DADO que o usuário está em tema escuro
      QUANDO visualiza o gráfico
      ENTÃO as cores devem ter contraste adequado
      E o fundo deve ser escuro

- [ ] DADO que o usuário acessa em dispositivo mobile
      QUANDO visualiza o gráfico
      ENTÃO deve ser responsivo e touch-friendly
      E permitir pinch-to-zoom

**Dependências**:
- Bloqueada por: STORY-1602 (Tema), EP-04 (Transações)
- Bloqueia: STORY-2002 (Benchmarks), STORY-2003 (Grupos de Ativos)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Usar Chart.js ou ECharts:
  ```javascript
  // Chart.js
  import { Line } from 'vue-chartjs'
  import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js'
  
  ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)
  ```
- Componente `<PerformanceChart>` com props: `data`, `benchmarks`, `dateRange`
- Formatar valores com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`
- Responsivo com `maintainAspectRatio: false`

*Estrutura de Arquivos*:
```
src/
  components/
    charts/
      PerformanceChart.vue        # Gráfico de performance
      PerformanceChart.test.js
      ChartTooltip.vue            # Tooltip customizado
      ChartLegend.vue            # Legenda customizada
  utils/
    chart-helpers.js              # Utilitários de formatação
```

**Cenários de Teste**:
- Cenário 1: Gráfico exibe linha de patrimônio
- Cenário 2: Tooltip aparece ao hover
- Cenário 3: Zoom funciona ao selecionar região
- Cenário 4: Reset zoom funciona
- Cenário 5: Cores adequadas em tema escuro
- Cenário 6: Gráfico responsivo em mobile

---

### [STORY-2002] Benchmarks (CDI, IBOV)

**Como** usuário do MoneyTrackr
**Eu quero** adicionar linhas de benchmark ao gráfico de performance
**Para que** eu compare a performance do meu portfolio com CDI e IBOV

**Tipo**: Feature
**Prioridade**: Should Have
**Estimativa**: 5 story points

**Contexto**:
O usuário deve poder adicionar linhas de benchmark ao gráfico para comparar a performance de seu portfolio com indicadores de mercado. Os benchmarks disponíveis são: CDI (taxa livre de risco) e IBOV (índice Bovespa).

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário quer adicionar benchmarks
      QUANDO clica no botão "Comparar"
      ENTÃO deve exibir checkboxes:
        - [ ] CDI
        - [ ] IBOV
        - [ ] IPCA (opcional)

- [ ] DADO que o usuário seleciona CDI
      QUANDO marca o checkbox
      ENTÃO uma linha tracejada deve aparecer no gráfico
      E representar a evolução de R$ 1000 aplicados no CDI desde o início do período

- [ ] DADO que o usuário seleciona IBOV
      QUANDO marca o checkbox
      ENTÃO uma linha tracejada deve aparecer no gráfico
      E representar a evolução de R$ 1000 aplicados no IBOV desde o início do período

- [ ] DADO que o usuário desmarca um benchmark
      QUANDO clica no checkbox
      ENTÃO a linha correspondente deve desaparecer do gráfico

- [ ] DADO que múltiplos benchmarks estão selecionados
      QUANDO o usuário visualiza o gráfico
      ENTÃO cada linha deve ter cor distinta
      E a legenda deve identificar cada linha

- [ ] DADO que o usuário passa o mouse sobre o gráfico
      QUANDO posiciona sobre um ponto
      ENTÃO o tooltip deve exibir valores do portfolio E dos benchmarks selecionados

**Dependências**:
- Bloqueada por: STORY-2001 (Gráfico de Performance)
- Bloqueia: Nenhuma

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Dados de benchmark vindos da API: `GET /api/benchmarks?start=2025-01-01&end=2026-03-27`
- Normalizar valores para base 1000 (ou valor inicial do portfolio)
- Cores: CDI = verde, IBOV = laranja, IPCA = roxo
- Linha tracejada: `borderDash: [5, 5]`

*Backend*:
- Endpoint: `GET /api/benchmarks`
- Fonte de dados: API do Banco Central (CDI, IPCA) e Yahoo Finance (IBOV)

*Estrutura de Arquivos*:
```
src/
  components/
    charts/
      BenchmarkSelector.vue      # Seletor de benchmarks
      BenchmarkSelector.test.js
  services/
    benchmark-service.js         # Serviço de API de benchmarks
```

**Cenários de Teste**:
- Cenário 1: Seletor de benchmarks exibe opções
- Cenário 2: Linha CDI aparece ao selecionar
- Cenário 3: Linha IBOV aparece ao selecionar
- Cenário 4: Linha desaparece ao desmarcar
- Cenário 5: Cores distintas para cada benchmark
- Cenário 6: Tooltip exibe valores do portfolio e benchmarks

---

### [STORY-2003] Grupos de Ativos (FIIs, Ações, etc.)

**Como** usuário do MoneyTrackr
**Eu quero** visualizar a performance por grupo de ativos
**Para que** eu entenda qual classe de ativo está contribuindo mais para meu resultado

**Tipo**: Feature
**Prioridade**: Should Have
**Estimativa**: 5 story points

**Contexto**:
O usuário deve poder filtrar o gráfico de performance por classe de ativo (Ações, FIIs, Renda Fixa, Cripto, etc.) ou visualizar todas as classes em um gráfico de área empilhada.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário quer filtrar por classe de ativo
      QUANDO clica no botão "Filtrar por Classe"
      ENTÃO deve exibir checkboxes:
        - [ ] Ações
        - [ ] FIIs
        - [ ] Renda Fixa
        - [ ] Criptomoedas
        - [ ] ETFs
        - [ ] Outros

- [ ] DADO que o usuário seleciona uma ou mais classes
      QUANDO marca os checkboxes
      ENTÃO o gráfico deve exibir apenas a soma das classes selecionadas

- [ ] DADO que o usuário quer ver todas as classes
      QUANDO clica em "Visão por Classe"
      ENTÃO o gráfico deve mudar para área empilhada
      E cada área representa uma classe de ativo

- [ ] DADO que o usuário passa o mouse sobre o gráfico empilhado
      QUANDO posiciona sobre uma área
      ENTÃO o tooltip deve exibir o valor de cada classe naquela data

- [ ] DADO que o usuário está no modo empilhado
      QUANDO clica em uma área específica
      ENTÃO deve filtrar para mostrar apenas aquela classe

- [ ] DADO que o usuário quer voltar ao normal
      QUANDO clica em "Visão Total"
      ENTÃO o gráfico volta a exibir o patrimônio total

**Dependências**:
- Bloqueada por: STORY-2001 (Gráfico de Performance)
- Bloqueia: Nenhuma

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Toggle entre modo linha e modo área empilhada
- Cores por classe:
  - Ações: #3b82f6 (azul)
  - FIIs: #10b981 (verde)
  - Renda Fixa: #f59e0b (amarelo)
  - Cripto: #8b5cf6 (roxo)
  - ETFs: #ec4899 (rosa)
  - Outros: #6b7280 (cinza)
- Usar `fill: true` para área empilhada no Chart.js

*Estrutura de Arquivos*:
```
src/
  components/
    charts/
      AssetClassFilter.vue       # Filtro de classes
      AssetClassFilter.test.js
      StackedAreaChart.vue       # Gráfico empilhado
```

**Cenários de Teste**:
- Cenário 1: Filtro de classes exibe opções
- Cenário 2: Gráfico filtra ao selecionar classes
- Cenário 3: Gráfico empilhado exibe todas as classes
- Cenário 4: Tooltip exibe valores por classe
- Cenário 5: Clique em área filtra para classe
- Cenário 6: Toggle volta para visão total

---

### [STORY-2004] Seletor de Período (Date Range)

**Como** usuário do MoneyTrackr
**Eu quero** selecionar o período do gráfico de performance
**Para que** eu analise a performance em diferentes janelas de tempo

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 3 story points

**Contexto**:
O usuário deve poder selecionar o período de análise do gráfico, com opções rápidas (1M, 3M, 6M, 1A, Tudo) e possibilidade de selecionar datas customizadas.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário visualiza o gráfico
      QUANDO a página carrega
      ENTÃO deve exibir botões de período rápido:
        - 1M (último mês)
        - 3M (últimos 3 meses)
        - 6M (últimos 6 meses)
        - 1A (último ano)
        - Tudo (todo o histórico)

- [ ] DADO que o usuário clica em um período rápido
      QUANDO seleciona "6M"
      ENTÃO o gráfico deve exibir dados dos últimos 6 meses
      E o botão "6M" deve ficar destacado

- [ ] DADO que o usuário quer um período customizado
      QUANDO clica em "Personalizado"
      ENTÃO deve exibir date picker com data início e data fim
      E ao selecionar, o gráfico deve atualizar

- [ ] DADO que o usuário seleciona um período
      QUANDO o período é válido
      ENTÃO o gráfico deve recarregar com os dados do período
      E exibir loading indicator durante o carregamento

- [ ] DADO que o usuário seleciona um período inválido
      QUANDO data início > data fim
      ENTÃO deve exibir erro "Data início deve ser anterior à data fim"

- [ ] DADO que o usuário alterna entre carteiras
      QUANDO muda de carteira
      ENTÃO o período selecionado deve ser mantido

**Dependências**:
- Bloqueada por: STORY-2001 (Gráfico de Performance)
- Bloqueia: Nenhuma

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Componente `<DateRangeSelector>` com botões e date picker
- Usar biblioteca de date picker (ex.: `vue-datepicker` ou nativo)
- Estado do período em `useChartFilters()` composable
- Default: "1A" (último ano)

*Estrutura de Arquivos*:
```
src/
  components/
    charts/
      DateRangeSelector.vue      # Seletor de período
      DateRangeSelector.test.js
  composables/
    useChartFilters.js           # Estado de filtros do gráfico
```

**Cenários de Teste**:
- Cenário 1: Botões de período rápido exibidos
- Cenário 2: Gráfico atualiza ao clicar em período
- Cenário 3: Date picker abre ao clicar em Personalizado
- Cenário 4: Gráfico carrega dados do período customizado
- Cenário 5: Erro exibido para período inválido
- Cenário 6: Período mantido ao alternar carteira

---

# Épico 21 — Transações UI

---

### [STORY-2101] Tabela de Transações com Paginação

**Como** usuário do MoneyTrackr
**Eu quero** visualizar minhas transações em uma tabela paginada
**Para que** eu possa navegar pelo histórico de forma organizada

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points

**Contexto**:
A tabela de transações é a principal interface para visualizar o histórico de movimentações. Deve exibir colunas relevantes, suportar paginação para grandes volumes, e ser responsiva para mobile.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário acessa a página de Transações
      QUANDO a página carrega
      ENTÃO deve exibir tabela com colunas:
        - Data (DD/MM/YYYY)
        - Tipo (Compra/Venda/Dividendo/etc.)
        - Ticker
        - Quantidade
        - Preço Unitário
        - Total (Quantidade × Preço + Taxas)
        - Carteira
        - Ações (Editar/Excluir)

- [ ] DADO que existem mais de 25 transações
      QUANDO a tabela carrega
      ENTÃO deve exibir apenas as primeiras 25
      E exibir controles de paginação no rodapé

- [ ] DADO que o usuário clica em "Próxima página"
      QUANDO há mais páginas
      ENTÃO deve carregar e exibir as próximas 25 transações
      E atualizar indicador de página atual

- [ ] DADO que o usuário quer ir para uma página específica
      QUANDO digita o número da página
      ENTÃO deve navegar diretamente para aquela página

- [ ] DADO que o usuário quer ver o total de transações
      QUANDO visualiza a tabela
      ENTÃO deve exibir "Exibindo X-Y de Z transações" no rodapé

- [ ] DADO que o usuário está em dispositivo mobile
      QUANDO visualiza a tabela
      ENTÃO deve exibir cards empilhados em vez de tabela
      E cada card mostra informações resumidas da transação

**Dependências**:
- Bloqueada por: STORY-1601 (Layout Base), EP-04 (Transações API)
- Bloqueia: STORY-2102 (Filtros), STORY-2103 (Ordenação)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Componente `<TransactionsTable>` com `<Table>`, `<Pagination>`
- Usar biblioteca de tabela (ex.: `@tanstack/vue-table` ou custom)
- Paginação server-side: `GET /api/transactions?page=1&limit=25`
- Formatar moeda com `Intl.NumberFormat`
- Mobile: componente `<TransactionCard>` para cada transação

*Estrutura de Arquivos*:
```
src/
  pages/
    Transactions.vue             # Página de transações
  components/
    transactions/
      TransactionsTable.vue      # Tabela principal
      TransactionsTable.test.js
      TransactionRow.vue         # Linha da tabela
      TransactionCard.vue        # Card para mobile
      Pagination.vue             # Controles de paginação
      Pagination.test.js
  composables/
    useTransactions.js           # Hook de dados de transações
```

**Cenários de Teste**:
- Cenário 1: Tabela exibe colunas corretas
- Cenário 2: Paginação funciona com mais de 25 transações
- Cenário 3: Navegação entre páginas funciona
- Cenário 4: Ir para página específica funciona
- Cenário 5: Total de transações exibido corretamente
- Cenário 6: Cards exibidos em mobile

---

### [STORY-2102] Filtros de Transações

**Como** usuário do MoneyTrackr
**Eu quero** filtrar minhas transações por data, tipo e ticker
**Para que** eu encontre rapidamente transações específicas

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points

**Contexto**:
O usuário deve poder filtrar a tabela de transações por múltiplos critérios: intervalo de datas, tipo de transação, ticker do ativo, e carteira. Os filtros devem ser combináveis.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário quer filtrar transações
      QUANDO visualiza a página
      ENTÃO deve exibir barra de filtros com:
        - Date range picker (período)
        - Dropdown de Tipo (Compra, Venda, Dividendo, JCP, etc.)
        - Input de Ticker (com autocomplete)
        - Dropdown de Carteira

- [ ] DADO que o usuário seleciona um filtro de data
      QUANDO define período de 01/01/2026 a 31/01/2026
      ENTÃO a tabela deve exibir apenas transações daquele período
      E o contador deve atualizar "Exibindo X de Y transações"

- [ ] DADO que o usuário seleciona um tipo
      QUANDO seleciona "Compra"
      ENTÃO a tabela deve exibir apenas transações do tipo Compra

- [ ] DADO que o usuário digita um ticker
      QUANDO digita "PETR"
      ENTÃO deve exibir autocomplete com tickers que começam com "PETR"
      E ao selecionar, filtrar por aquele ticker

- [ ] DADO que o usuário combina múltiplos filtros
      QUANDO seleciona tipo "Dividendo" e ticker "BBDC4"
      ENTÃO deve exibir apenas dividendos de BBDC4

- [ ] DADO que o usuário quer limpar filtros
      QUANDO clica em "Limpar Filtros"
      ENTÃO todos os filtros devem ser removidos
      E a tabela deve exibir todas as transações

- [ ] DADO que o usuário aplica filtros
      QUANDO recarrega a página
      ENTÃO os filtros devem ser persistidos na URL (query params)

**Dependências**:
- Bloqueada por: STORY-2101 (Tabela de Transações)
- Bloqueia: Nenhuma

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Componente `<TransactionFilters>` com subcomponentes
- Autocomplete usando API: `GET /api/assets?search=PETR`
- Persistir filtros em URL: `?startDate=2026-01-01&endDate=2026-01-31&type=BUY&ticker=PETR4`
- Usar `useQueryParams()` para sincronizar estado com URL

*Estrutura de Arquivos*:
```
src/
  components/
    transactions/
      TransactionFilters.vue     # Barra de filtros
      TransactionFilters.test.js
      FilterDateRange.vue        # Filtro de data
      FilterType.vue             # Filtro de tipo
      FilterTicker.vue           # Filtro de ticker com autocomplete
      FilterWallet.vue           # Filtro de carteira
  composables/
    useTransactionFilters.js     # Hook de estado de filtros
```

**Cenários de Teste**:
- Cenário 1: Barra de filtros exibida
- Cenário 2: Filtro de data funciona
- Cenário 3: Filtro de tipo funciona
- Cenário 4: Autocomplete de ticker funciona
- Cenário 5: Filtros combinados funcionam
- Cenário 6: Limpar filtros funciona
- Cenário 7: Filtros persistidos na URL

---

### [STORY-2103] Ordenação de Colunas

**Como** usuário do MoneyTrackr
**Eu quero** ordenar a tabela de transações por diferentes colunas
**Para que** eu visualize os dados na ordem mais relevante para mim

**Tipo**: Feature
**Prioridade**: Should Have
**Estimativa**: 3 story points

**Contexto**:
O usuário deve poder ordenar a tabela clicando nos cabeçalhos das colunas. A ordenação pode ser ascendente ou descendente, e deve ser indicada visualmente.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário visualiza a tabela
      QUANDO clica no cabeçalho "Data"
      ENTÃO a tabela deve ordenar por data descendente (mais recentes primeiro)
      E exibir ícone de seta para baixo no cabeçalho

- [ ] DADO que a tabela está ordenada por data descendente
      QUANDO o usuário clica novamente em "Data"
      ENTÃO a tabela deve ordenar por data ascendente (mais antigas primeiro)
      E exibir ícone de seta para cima no cabeçalho

- [ ] DADO que o usuário clica em "Total"
      QUANDO ordena por total
      ENTÃO a tabela deve ordenar por valor total da transação

- [ ] DADO que o usuário clica em "Ticker"
      QUANDO ordena por ticker
      ENTÃO a tabela deve ordenar alfabeticamente por ticker

- [ ] DADO que o usuário aplica ordenação
      QUANDO navega entre páginas
      ENTÃO a ordenação deve ser mantida

- [ ] DADO que o usuário aplica filtros e ordenação
      QUANDO recarrega a página
      ENTÃO ambos devem ser persistidos na URL

**Dependências**:
- Bloqueada por: STORY-2101 (Tabela de Transações)
- Bloqueia: Nenhuma

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Colunas ordenáveis: Data, Tipo, Ticker, Quantidade, Preço, Total
- Ícones de ordenação: `ArrowUp`, `ArrowDown` (Lucide)
- Estado de ordenação: `{ column: 'date', direction: 'desc' }`
- Persistir em URL: `?sort=date&order=desc`

*Estrutura de Arquivos*:
```
src/
  components/
    transactions/
      SortableHeader.vue         # Cabeçalho ordenável
      SortableHeader.test.js
```

**Cenários de Teste**:
- Cenário 1: Ordenação por data descendente
- Cenário 2: Toggle para ordenação ascendente
- Cenário 3: Ordenação por total
- Cenário 4: Ordenação por ticker
- Cenário 5: Ordenação mantida entre páginas
- Cenário 6: Ordenação persistida na URL

---

### [STORY-2104] Responsividade Mobile

**Como** usuário do MoneyTrackr em dispositivo mobile
**Eu quero** uma interface de transações otimizada para tela pequena
**Para que** eu possa visualizar e gerenciar minhas transações no celular

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points

**Contexto**:
A interface de transações deve ser totalmente funcional em dispositivos mobile. A tabela deve se transformar em uma lista de cards, os filtros devem ser colapsáveis, e as ações devem ser acessíveis por toque.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário está em dispositivo mobile (< 768px)
      QUANDO acessa a página de Transações
      ENTÃO deve exibir lista de cards em vez de tabela
      E cada card deve conter: Data, Tipo, Ticker, Quantidade, Total

- [ ] DADO que o usuário visualiza um card de transação
      QUANDO toca no card
      ENTÃO deve expandir para mostrar mais detalhes (Preço unitário, Carteira, Notas)
      E exibir botões de ação (Editar, Excluir)

- [ ] DADO que o usuário quer filtrar em mobile
      QUANDO toca no botão "Filtros"
      ENTÃO deve abrir um drawer/modal com todos os filtros
      E ao aplicar, fechar o drawer e filtrar a lista

- [ ] DADO que o usuário quer adicionar transação em mobile
      QUANDO toca no FAB (Floating Action Button)
      ENTÃO deve navegar para o formulário de nova transação

- [ ] DADO que o usuário está rolando a lista
      QUANDO rola para baixo
      ENTÃO deve carregar mais transações automaticamente (infinite scroll)
      E exibir loading indicator no final da lista

- [ ] DADO que o usuário quer voltar ao topo
      QUANDO toca no botão "Voltar ao topo"
      ENTÃO deve rolar suavemente para o início da lista

**Dependências**:
- Bloqueada por: STORY-2101 (Tabela), STORY-2102 (Filtros)
- Bloqueia: Nenhuma

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Usar media query para detectar mobile
- Componente `<TransactionCard>` com estado expandido/colapsado
- Drawer de filtros usando `<Drawer>` ou `<Modal>`
- FAB com `<FloatingActionButton>` fixo no canto inferior direito
- Infinite scroll com `IntersectionObserver` ou biblioteca

*Estrutura de Arquivos*:
```
src/
  components/
    transactions/
      TransactionCard.vue        # Card para mobile
      TransactionCard.test.js
      TransactionFiltersDrawer.vue # Drawer de filtros mobile
      FloatingActionButton.vue   # FAB para adicionar
```

**Cenários de Teste**:
- Cenário 1: Cards exibidos em mobile
- Cenário 2: Card expande ao tocar
- Cenário 3: Drawer de filtros abre
- Cenário 4: FAB navega para formulário
- Cenário 5: Infinite scroll carrega mais transações
- Cenário 6: Botão voltar ao topo funciona

---

# Épico 22 — Formulários

---

### [STORY-2201] Formulário de Transação

**Como** usuário do MoneyTrackr
**Eu quero** um formulário para cadastrar transações com validação
**Para que** eu registre minhas movimentações de forma correta e completa

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 8 story points

**Contexto**:
O formulário de transação é a principal interface de entrada de dados. Deve ser intuitivo, com validação em tempo real, e suportar todos os tipos de transação (Compra, Venda, Dividendo, JCP, etc.).

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário acessa o formulário de nova transação
      QUANDO a página carrega
      ENTÃO deve exibir campos:
        - Tipo (dropdown obrigatório): Compra, Venda, Dividendo, JCP, Subscrição, Desdobramento
        - Ticker (input com autocomplete, obrigatório)
        - Data (date picker, obrigatório, default: hoje)
        - Quantidade (number input, obrigatório para Compra/Venda)
        - Preço Unitário (currency input, obrigatório para Compra/Venda)
        - Taxas (currency input, opcional)
        - Carteira (dropdown, obrigatório)
        - Notas (textarea, opcional)

- [ ] DADO que o usuário preenche o ticker
      QUANDO digita "PETR"
      ENTÃO deve exibir autocomplete com ativos que começam com "PETR"
      E ao selecionar, preencher o ticker

- [ ] DADO que o usuário submete o formulário com campos obrigatórios vazios
      QUANDO clica em "Salvar"
      ENTÃO deve exibir mensagens de erro abaixo de cada campo inválido
      E não deve submeter o formulário

- [ ] DADO que o usuário preenche todos os campos corretamente
      QUANDO clica em "Salvar"
      ENTÃO deve submeter o formulário
      E exibir loading no botão
      E ao sucesso, exibir toast "Transação salva com sucesso"
      E fechar o formulário/navegar de volta

- [ ] DADO que o usuário seleciona tipo "Dividendo"
      QUANDO o tipo muda
      ENTÃO campos "Quantidade" e "Preço Unitário" devem ser desabilitados
      E campo "Valor por Cota" deve aparecer

- [ ] DADO que o usuário quer cancelar
      QUANDO clica em "Cancelar"
      ENTÃO deve exibir confirmação se houver dados preenchidos
      E ao confirmar, fechar o formulário

**Dependências**:
- Bloqueada por: STORY-1601 (Layout Base), EP-04 (Transações API)
- Bloqueia: STORY-2202 (Validação), STORY-2203 (Edição)

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Componente `<TransactionForm>` com subcomponentes
- Validação com Vuelidate (Vue) ou React Hook Form + Zod (React)
- Autocomplete: `GET /api/assets?search={query}`
- Formatação de moeda em tempo real
- Date picker com limite máximo = hoje

*Estrutura de Arquivos*:
```
src/
  components/
    forms/
      TransactionForm.vue        # Formulário principal
      TransactionForm.test.js
      TransactionTypeSelect.vue  # Dropdown de tipo
      TickerInput.vue           # Input com autocomplete
      CurrencyInput.vue          # Input de moeda
      DatePicker.vue             # Seletor de data
      WalletSelect.vue           # Dropdown de carteira
  composables/
    useTransactionForm.js        # Lógica do formulário
    useTransactionForm.test.js
```

**Cenários de Teste**:
- Cenário 1: Formulário exibe todos os campos
- Cenário 2: Autocomplete de ticker funciona
- Cenário 3: Validação exibe erros
- Cenário 4: Submissão bem-sucedida
- Cenário 5: Campos condicionais por tipo
- Cenário 6: Confirmação ao cancelar com dados

---

### [STORY-2202] Validação de Formulário

**Como** usuário do MoneyTrackr
**Eu quero** validação clara e em tempo real no formulário
**Para que** eu saiba exatamente o que precisa ser corrigido

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points

**Contexto**:
A validação deve ser em tempo real (on blur) e na submissão. Mensagens de erro devem ser claras, em português, e posicionadas abaixo do campo correspondente. Campos válidos devem ter indicador visual.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário preenche um campo inválido
      QUANDO sai do campo (blur)
      ENTÃO deve exibir mensagem de erro abaixo do campo
      E borda do campo deve ficar vermelha

- [ ] DADO que o usuário corrige um campo com erro
      QUANDO o valor passa a ser válido
      ENTÃO a mensagem de erro deve desaparecer
      E borda deve voltar ao normal (ou verde se válido)

- [ ] DADO que o usuário submete o formulário
      QUANDO há campos inválidos
      ENTÃO deve exibir todos os erros de uma vez
      E focar no primeiro campo com erro

- [ ] DADO que o usuário preenche ticker inexistente
      QUANDO digita "TICKERINVALIDO"
      ENTÃO deve exibir erro "Ticker não encontrado"

- [ ] DADO que o usuário preenche data futura
      QUANDO seleciona data de amanhã
      ENTÃO deve exibir erro "Data não pode ser futura"

- [ ] DADO que o usuário preenche quantidade negativa
      QUANDO digita "-10"
      ENTÃO deve exibir erro "Quantidade deve ser maior que zero"

- [ ] DADO que o usuário preenche preço negativo
      QUANDO digita valor negativo
      ENTÃO deve exibir erro "Preço deve ser maior que zero"

**Dependências**:
- Bloqueada por: STORY-2201 (Formulário de Transação)
- Bloqueia: Nenhuma

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Regras de validação:
  ```javascript
  const rules = {
    type: { required: true },
    ticker: { required: true, exists: true },
    date: { required: true, notFuture: true },
    quantity: { required: true, min: 0.0001 },
    price: { required: true, min: 0.01 },
    fees: { min: 0 },
    walletId: { required: true }
  }
  ```
- Mensagens em português em `src/constants/validation-messages.js`
- Componente `<FieldError>` para exibir erros

*Estrutura de Arquivos*:
```
src/
  constants/
    validation-messages.js       # Mensagens de erro em PT-BR
  components/
    forms/
      FieldError.vue             # Componente de erro inline
      ValidatedInput.vue         # Input com validação
```

**Cenários de Teste**:
- Cenário 1: Erro exibido ao blur em campo inválido
- Cenário 2: Erro desaparece ao corrigir
- Cenário 3: Todos os erros exibidos na submissão
- Cenário 4: Erro para ticker inexistente
- Cenário 5: Erro para data futura
- Cenário 6: Erro para quantidade negativa
- Cenário 7: Erro para preço negativo

---

### [STORY-2203] Edição de Transação

**Como** usuário do MoneyTrackr
**Eu quero** editar transações existentes
**Para que** eu corrija erros ou atualize informações

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 5 story points

**Contexto**:
O usuário deve poder editar transações já cadastradas. O formulário de edição deve ser pré-populado com os dados existentes e permitir alterações.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário quer editar uma transação
      QUANDO clica no botão "Editar" na tabela
      ENTÃO deve abrir o formulário pré-populado com dados da transação
      E o título deve ser "Editar Transação"

- [ ] DADO que o formulário de edição está aberto
      QUANDO o usuário altera campos
      ENTÃO a validação deve funcionar igual ao formulário de criação

- [ ] DADO que o usuário altera dados e salva
      QUANDO clica em "Salvar"
      ENTÃO deve atualizar a transação via API
      E exibir toast "Transação atualizada com sucesso"
      E fechar o formulário

- [ ] DADO que o usuário não altera nenhum campo
      QUANDO clica em "Salvar"
      ENTÃO deve fechar o formulário sem fazer requisição

- [ ] DADO que o usuário quer cancelar a edição
      QUANDO clica em "Cancelar" e houve alterações
      ENTÃO deve exibir confirmação "Descartar alterações?"
      E ao confirmar, fechar sem salvar

- [ ] DADO que a transação foi editada
      QUANDO a tabela recarrega
      ENTÃO deve exibir os dados atualizados

**Dependências**:
- Bloqueada por: STORY-2201 (Formulário), STORY-2101 (Tabela)
- Bloqueia: Nenhuma

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Reutilizar componente `<TransactionForm>` com prop `mode="edit"`
- Pré-popular com dados: `useTransactionForm({ transactionId: '...' })`
- API: `PUT /api/transactions/:id`
- Detectar alterações com `isDirty` do formulário

*Estrutura de Arquivos*:
```
src/
  pages/
    EditTransaction.vue          # Página de edição (ou modal)
  composables/
    useTransactionForm.js        # Suporta modo create e edit
```

**Cenários de Teste**:
- Cenário 1: Formulário abre pré-populado
- Cenário 2: Validação funciona na edição
- Cenário 3: Transação atualizada ao salvar
- Cenário 4: Sem requisição se não houver alterações
- Cenário 5: Confirmação ao cancelar com alterações
- Cenário 6: Tabela atualizada após edição

---

### [STORY-2204] Exclusão de Transação

**Como** usuário do MoneyTrackr
**Eu quero** excluir transações que foram cadastradas incorretamente
**Para que** meu histórico reflita apenas movimentações reais

**Tipo**: Feature
**Prioridade**: Must Have
**Estimativa**: 3 story points

**Contexto**:
O usuário deve poder excluir transações, com confirmação para evitar exclusões acidentais. A exclusão deve ser irreversível.

**Critérios de Aceite (Verificáveis)**:

- [ ] DADO que o usuário quer excluir uma transação
      QUANDO clica no botão "Excluir" na tabela
      ENTÃO deve exibir modal de confirmação:
        - Título: "Excluir Transação"
        - Mensagem: "Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita."
        - Botões: "Cancelar" e "Excluir"

- [ ] DADO que o usuário confirma a exclusão
      QUANDO clica em "Excluir"
      ENTÃO deve chamar API para deletar
      E exibir loading no botão
      E ao sucesso, remover a transação da tabela
      E exibir toast "Transação excluída com sucesso"

- [ ] DADO que o usuário cancela a exclusão
      QUANDO clica em "Cancelar"
      ENTÃO deve fechar o modal sem excluir

- [ ] DADO que a exclusão falha (ex.: erro de servidor)
      QUANDO a API retorna erro
      ENTÃO deve exibir toast de erro "Erro ao excluir transação. Tente novamente."
      E manter a transação na tabela

- [ ] DADO que o usuário está em mobile
      QUANDO visualiza um card de transação expandido
      ENTÃO deve exibir botão "Excluir" com ícone de lixeira

**Dependências**:
- Bloqueada por: STORY-2101 (Tabela), STORY-2104 (Mobile)
- Bloqueia: Nenhuma

**Definição de Pronto (DoD)**:
- [ ] Código revisado por @code-reviewer
- [ ] Testes com cobertura >= 90%
- [ ] QA aprovado por @qa-analyst
- [ ] Documentação de componentes atualizada (Storybook)
- [ ] PR criado por @merge-request

**Notas Técnicas**:

*Frontend*:
- Componente `<ConfirmModal>` reutilizável
- API: `DELETE /api/transactions/:id`
- Otimistic delete na UI (remover antes da resposta)
- Undo toast (opcional): "Transação excluída. Desfazer?"

*Estrutura de Arquivos*:
```
src/
  components/
    common/
      ConfirmModal.vue          # Modal de confirmação genérico
      ConfirmModal.test.js
```

**Cenários de Teste**:
- Cenário 1: Modal de confirmação exibido
- Cenário 2: Transação removida ao confirmar
- Cenário 3: Modal fecha ao cancelar
- Cenário 4: Erro tratado corretamente
- Cenário 5: Botão de excluir visível em mobile

---

## Resumo de Estimativas

| Épico | Story | Estimativa (SP) |
|-------|-------|-----------------|
| EP-15 | STORY-1501 (Service Worker) | 8 |
| EP-15 | STORY-1502 (Manifest) | 3 |
| EP-15 | STORY-1503 (Background Sync) | 5 |
| EP-16 | STORY-1601 (Layout Base) | 5 |
| EP-16 | STORY-1602 (Tema) | 5 |
| EP-16 | STORY-1603 (Header) | 3 |
| EP-17 | STORY-1701 (Roteamento) | 5 |
| EP-17 | STORY-1702 (Route Guards) | 3 |
| EP-17 | STORY-1703 (Página 404) | 2 |
| EP-18 | STORY-1801 (Menu Principal) | 5 |
| EP-18 | STORY-1802 (Sidebar Colapsável) | 3 |
| EP-18 | STORY-1803 (Mobile Overlay) | 3 |
| EP-19 | STORY-1901 (Grid Widgets) | 8 |
| EP-19 | STORY-1902 (Add/Remove Widgets) | 5 |
| EP-19 | STORY-1903 (Persist Layout) | 3 |
| EP-20 | STORY-2001 (Gráfico Performance) | 8 |
| EP-20 | STORY-2002 (Benchmarks) | 5 |
| EP-20 | STORY-2003 (Grupos Ativos) | 5 |
| EP-20 | STORY-2004 (Date Range) | 3 |
| EP-21 | STORY-2101 (Tabela Transações) | 8 |
| EP-21 | STORY-2102 (Filtros) | 5 |
| EP-21 | STORY-2103 (Ordenação) | 3 |
| EP-21 | STORY-2104 (Mobile) | 5 |
| EP-22 | STORY-2201 (Formulário) | 8 |
| EP-22 | STORY-2202 (Validação) | 5 |
| EP-22 | STORY-2203 (Edição) | 5 |
| EP-22 | STORY-2204 (Exclusão) | 3 |
| **TOTAL** | | **124 SP** |

---

## Definição de Pronto Global (Frontend)

- [ ] Código revisado por @code-reviewer
- [ ] Testes unitários com cobertura >= 90%
- [ ] Testes de integração passando
- [ ] Linting sem erros (ESLint)
- [ ] Build de produção sem erros
- [ ] QA aprovado por @qa-analyst
- [ ] Componentes documentados no Storybook
- [ ] Acessibilidade (WCAG 2.1 AA) verificada
- [ ] Performance (Lighthouse) >= 90
- [ ] PR criado por @merge-request
- [ ] Merge aprovado por tech lead

---

## Notas de Implementação

### Ordem Sugerida de Implementação

1. **Sprint 1**: EP-15 (PWA base) + EP-16 (Layout Base)
2. **Sprint 2**: EP-17 (Navegação) + EP-18 (Sidebar)
3. **Sprint 3**: EP-19 (Dashboard) + EP-20 (Gráficos)
4. **Sprint 4**: EP-21 (Transações UI) + EP-22 (Formulários)

### Dependências Críticas

- EP-16 (Layout Base) é pré-requisito para todos os outros épicos
- EP-17 (Navegação) deve estar pronto antes de EP-18 (Sidebar)
- EP-19 (Dashboard) depende de EP-03 (Carteiras) e EP-04 (Transações) do backend
- EP-21 (Transações UI) depende de EP-04 (Transações) do backend

### Bibliotecas Recomendadas

| Propósito | React | Vue |
|-----------|-------|-----|
| Roteamento | react-router-dom v6 | vue-router v4 |
| Estado | zustand / redux | pinia |
| Formulários | react-hook-form + zod | vee-validate + zod |
| UI Components | radix-ui / headless | headlessui |
| Gráficos | chart.js / recharts | vue-chartjs / echarts |
| Grid Layout | react-grid-layout | vue-grid-layout |
| Ícones | lucide-react | lucide-vue-next |
| Data Grid | @tanstack/react-table | @tanstack/vue-table |
| Date Picker | react-datepicker | vue-datepicker |
| Drag & Drop | @dnd-kit | vue-draggable |

---

**Documento criado por**: @product-manager
**Data**: 2026-03-27
**Status**: Pronto para @architect

# 📊 Gestor de Investimentos — User Stories (BDD / Gherkin) — Versão Final Completa

---

## 🧩 ÉPICO 1 — Arquitetura

Feature: Sistema

  Scenario: Container
    Then Nginx, frontend, backend, mongodb e redis devem rodar em containers separados, orquestrado pelo docker compose

  Scenario: Requisições
    Then todas devem passar pelo NGINX

  Scenario: Persistência
    Then backend deve usar MongoDB, sem necessidade de senhas

  Scenario: Cache
    Then sistema deve evitar chamadas excessivas às APIs

---

## 🧩 ÉPICO 2 — Autenticação

Feature: Autenticação de usuário

  Scenario: Login com Google
    Given o usuário acessa a tela de login
    When ele seleciona login com Google
    Then o sistema deve autenticar via OAuth
    And criar conta caso não exista

  Scenario: Login com email e senha
    Given o usuário possui cadastro
    When ele informa email e senha válidos
    Then o sistema deve autenticar o usuário

  Scenario: Recuperação de senha
    Given o usuário esqueceu a senha
    When solicita recuperação
    Then deve receber email para redefinição

---

## 🧩 ÉPICO 3 — Carteiras

Feature: Gestão de carteiras

  Scenario: Criar carteira
    Given usuário autenticado
    When cria nova carteira
    Then carteira deve ser salva com nome único

  Scenario: Alternar carteira ativa
    Given múltiplas carteiras
    When usuário seleciona uma
    Then todos os dados exibidos devem refletir apenas essa carteira

  Scenario: Visão consolidada
    Given múltiplas carteiras
    When usuário seleciona modo consolidado
    Then sistema deve somar todos os ativos em BRL

---

## 🧩 ÉPICO 4 — Transações

Feature: Registro de transações

  Scenario: Registrar compra
    Given usuário insere compra
    When salva transação
    Then sistema deve aumentar a posição do ativo

  Scenario: Registrar venda válida
    Given usuário possui 10 unidades
    When vende 5 unidades
    Then quantidade final deve ser 5

  Scenario: Bloquear venda inválida
    Given usuário possui 10 unidades
    When tenta vender 15
    Then sistema deve impedir operação

  Scenario: Zerar posição
    Given usuário possui 10 unidades
    When vende 10
    Then quantidade deve ser 0
    And preço médio deve ser resetado

---

## 🧩 ÉPICO 5 — Preço Médio

Feature: Cálculo de preço médio

  Scenario: Calcular preço médio
    Given múltiplas compras com taxas
    When calcular posição
    Then preço médio deve ser:
      (total investido + taxas) / quantidade total

  Scenario: Venda não altera preço médio
    Given preço médio calculado
    When ocorre venda parcial
    Then preço médio deve permanecer o mesmo

---

## 🧩 ÉPICO 6 — Câmbio

Feature: Conversão cambial

  Scenario: Converter ativo internacional
    Given ativo em USD
    When exibir em BRL
    Then deve usar taxa de câmbio do dia

  Scenario: Histórico de câmbio
    Given gráfico histórico
    When exibir evolução
    Then deve usar câmbio histórico correspondente

---

## 🧩 ÉPICO 7 — Renda Fixa

Feature: Cálculo de renda fixa

  Scenario: Investimento CDI
    Given investimento CDI + taxa
    When calcular valor
    Then usar CDI acumulado proporcional

  Scenario: Investimento IPCA
    Given investimento IPCA + taxa
    When calcular valor
    Then usar IPCA acumulado + taxa

  Scenario: Investimento prefixado
    Given taxa fixa anual
    When calcular valor
    Then usar juros compostos ao longo do tempo

---

## 🧩 ÉPICO 8 — Importação CSV

Feature: Importação CSV

  Scenario: Importar arquivo válido
    Given arquivo CSV correto
    When importar
    Then dados devem ser inseridos

  Scenario: Detectar duplicidade
    Given registro já existente
    When importar novamente
    Then sistema deve perguntar:
      - ignorar
      - duplicar
      - substituir

---

## 🧩 ÉPICO 9 — Importação PDF

Feature: Importação de nota de corretagem

  Scenario: Criar template
    Given PDF novo
    When usuário mapeia campos
    Then template deve ser salvo

  Scenario: Reutilizar template
    Given PDF conhecido
    When importar
    Then sistema deve aplicar template automaticamente

  Scenario: Validar antes de salvar
    When dados são extraídos
    Then usuário deve confirmar antes de persistir

---

## 🧩 ÉPICO 10 — Eventos Corporativos

Feature: Reconciliação de eventos

  Scenario: Detectar eventos históricos
    Given ativo com histórico
    When importar posição antiga
    Then sistema deve buscar eventos (split, bonificação, fusão, etc)

  Scenario: Aprovar eventos
    Given eventos encontrados
    When usuário revisa
    Then pode selecionar quais aplicar

  Scenario: Aplicar eventos
    When eventos são aplicados
    Then quantidade e preço médio devem ser recalculados

---

## 🧩 ÉPICO 11 — Proventos

Feature: Proventos

  Scenario: Registrar provento
    Given ativo com dividendos
    When sistema importar dados
    Then deve registrar provento

  Scenario: Não reinvestir automaticamente
    Given provento recebido
    Then não deve alterar posição automaticamente

  Scenario: Visualização por período
    Given histórico de proventos
    When usuário filtra
    Then deve mostrar mensal, semestral, anual ou total

---

## 🧩 ÉPICO 12 — Criptomoedas

Feature: Gestão de criptomoedas

  Scenario: Registrar compra cripto
    Given operação de compra
    Then deve calcular preço médio incluindo taxas

  Scenario: Atualizar preço
    Given ativo cripto
    When sistema atualiza dados
    Then deve usar API externa em alta frequência

  Scenario: Exibir valorização
    Then sistema deve mostrar:
      - valor atual
      - % de ganho
      - valor absoluto

---

## 🧩 ÉPICO 13 — Fontes de Dados de Mercado (APIs)

Feature: Coleta de dados externos

  Scenario: Obter dados da B3
    Given ativo brasileiro
    Then sistema deve usar BRAPI como fonte primária
    And usar Yahoo Finance como fallback

  Scenario: Obter dados internacionais
    Given ativo internacional
    Then sistema deve usar Yahoo Finance

  Scenario: Obter dados de proventos
    Given ativo com dividendos
    Then sistema deve coletar dados via:
      - BRAPI
      - Yahoo Finance

  Scenario: Obter eventos corporativos
    Given ativo com eventos
    Then sistema deve coletar dados via:
      - BRAPI
      - Yahoo Finance

  Scenario: Obter índices econômicos
    Given necessidade de CDI ou IPCA
    Then sistema deve usar API de indicadores econômicos
    And armazenar histórico diário

  Scenario: Obter dados de criptomoedas
    Given ativo cripto
    Then sistema deve usar:
      - CoinGecko
      - Binance API

  Scenario: Estratégia de fallback
    Given falha na API primária
    Then sistema deve usar fonte secundária

---

## 🧩 ÉPICO 14 — Atualização de Dados

Feature: Atualização de mercado

  Scenario: Atualizar ações
    Then atualizar em intervalo configurável

  Scenario: Atualizar renda fixa
    Then atualizar diariamente

  Scenario: Atualizar cripto
    Then atualizar em alta frequência

---

## 🧩 ÉPICO 15 — PWA

Feature: Aplicação instalável

  Scenario: Instalar app
    Then permitir adicionar à tela inicial

  Scenario: Executar standalone
    Then abrir como app

  Scenario: Offline básico
    Then permitir carregamento mínimo

---

## 🧩 ÉPICO 16 — Layout Base

Feature: Estrutura da aplicação

  Scenario: Exibir layout principal
    Then deve mostrar sidebar e área principal

  Scenario: Layout responsivo
    Then deve adaptar para mobile e desktop

---

## 🧩 ÉPICO 17 — Navegação

Feature: Rotas

  Scenario: Navegar entre páginas
    Then deve carregar conteúdo correto

  Scenario: Proteção
    Then usuário não autenticado deve ser redirecionado

---

## 🧩 ÉPICO 18 — Sidebar

Feature: Navegação lateral

  Scenario: Exibir menu
    Then deve conter:
      - Dashboard
      - Transações
      - Importação
      - Cadastros
      - Carteiras

  Scenario: Colapsar sidebar
    When usuário clicar
    Then deve reduzir para ícones

---

## 🧩 ÉPICO 19 — Dashboard

Feature: Dashboard customizável

  Scenario: Adicionar gráfico
    Given dashboard
    When usuário adiciona widget
    Then deve aparecer no layout

  Scenario: Redimensionar
    When usuário arrasta borda
    Then gráfico deve ajustar tamanho

  Scenario: Salvar layout
    When usuário salva dashboard
    Then layout deve persistir por carteira

---

## 🧩 ÉPICO 20 — Gráficos

Feature: Gráfico de rendimento

  Scenario: Exibir carteira
    Given gráfico ativo
    Then deve mostrar linha da carteira

  Scenario: Adicionar benchmark
    When usuário seleciona CDI
    Then gráfico deve incluir CDI

  Scenario: Adicionar grupo
    When usuário seleciona FIIs
    Then gráfico deve incluir linha de FIIs

  Scenario: Combinação dinâmica
    Then sistema deve permitir múltiplas combinações simultâneas

---

## 🧩 ÉPICO 21 — Transações UI

Feature: Tabela

  Scenario: Exibir transações
    Then mostrar lista completa

  Scenario: Filtrar
    Then permitir filtros por período e tipo

  Scenario: Ordenar
    Then permitir ordenação por colunas

---

## 🧩 ÉPICO 22 — Formulários

Feature: Entrada de dados

  Scenario: Validação
    Then impedir campos inválidos

  Scenario: Tipo obrigatório
    Then exigir compra ou venda

---

## 🧩 ÉPICO 23 — Feedback UX

Feature: Feedback

  Scenario: Loading
    Then mostrar indicador

  Scenario: Erro
    Then mostrar mensagem clara

  Scenario: Sucesso
    Then confirmar operação

---

## 🧩 ÉPICO 24 — Editor de Gráficos

Feature: Configuração de gráficos

  Scenario: Selecionar tipo
    Then permitir:
      - linha
      - barra
      - pizza
      - donut

  Scenario: Comparações
    Then permitir adicionar:
      - carteira
      - índices
      - grupos

---

## 🧩 ÉPICO 25 — Auditoria e Consistência

Feature: Auditoria

  Scenario: Alterar transação
    Then sistema deve manter histórico de alteração

  Scenario: Soft delete
    When deletar registro
    Then não remover do banco

---

## 🧩 ÉPICO 26 — Performance

Feature: Performance

  Scenario: Lazy loading
    Then carregar sob demanda

  Scenario: Cache
    Then reutilizar dados locais

---

## 🧩 ÉPICO 27 — Segurança Frontend

Feature: Segurança

  Scenario: Proteção
    Then dados devem ser isolados por usuário

---

## 🧩 ÉPICO 28 — Responsividade

Feature: Responsividade

  Scenario: Mobile
    Then sidebar vira overlay

  Scenario: Desktop
    Then usar layout completo

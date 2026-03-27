# MoneyTrackr V3 - Configuração de Subagents

## Visão Geral

Este documento define a configuração necessária para os subagents do MoneyTrackr funcionarem corretamente.

---

## Tech Lead

### Ferramentas Obrigatórias

O Tech Lead **DEVE** ter acesso às seguintes ferramentas:

```json
{
  "subagent_type": "tech-lead",
  "required_tools": [
    "Task",
    "bash",
    "read",
    "glob",
    "grep"
  ],
  "forbidden_tools": [
    "edit",
    "write"
  ]
}
```

### Por que o Task tool é obrigatório?

O Tech Lead é um **orquestrador**, não um implementador. Ele precisa do Task tool para:
- Delegar para `backend-developer`
- Delegar para `frontend-developer`
- Delegar para `test-engineer`
- Delegar para `shell-developer`
- Delegar para `code-reviewer`
- Delegar para `qa-analyst`

### Configuração Atual (Problemática)

```
Tech Lead subagent:
  - bash: ✅
  - read: ✅
  - glob: ✅
  - grep: ✅
  - edit: ✅ (DEVERIA SER ❌)
  - write: ✅ (DEVERIA SER ❌)
  - Task: ❌ (DEVERIA SER ✅)
```

### Configuração Correta (Necessária)

```
Tech Lead subagent:
  - bash: ✅
  - read: ✅
  - glob: ✅
  - grep: ✅
  - edit: ❌ (REMOVER)
  - write: ❌ (REMOVER)
  - Task: ✅ (ADICIONAR)
```

---

## Outros Subagents

### backend-developer
```json
{
  "subagent_type": "backend-developer",
  "required_tools": ["bash", "read", "write", "edit", "glob", "grep"],
  "optional_tools": ["Task"]
}
```

### frontend-developer
```json
{
  "subagent_type": "frontend-developer",
  "required_tools": ["bash", "read", "write", "edit", "glob", "grep"],
  "optional_tools": ["Task"]
}
```

### test-engineer
```json
{
  "subagent_type": "test-engineer",
  "required_tools": ["bash", "read", "write", "edit", "glob", "grep"],
  "optional_tools": ["Task"]
}
```

### shell-developer
```json
{
  "subagent_type": "shell-developer",
  "required_tools": ["bash", "read", "write", "edit", "glob", "grep"],
  "optional_tools": ["Task"]
}
```

### code-reviewer
```json
{
  "subagent_type": "code-reviewer",
  "required_tools": ["bash", "read", "glob", "grep"],
  "optional_tools": ["Task"]
}
```

### qa-analyst
```json
{
  "subagent_type": "qa-analyst",
  "required_tools": ["bash", "read", "glob", "grep"],
  "optional_tools": ["Task"]
}
```

---

## Workflow Correto

### Com Tech Lead Funcional:

```
Usuário solicita: "@tech-lead execute EP01"
         ↓
Tech Lead analisa a story
         ↓
Tech Lead delega via Task tool:
  ├── Task → shell-developer (Docker)
  ├── Task → backend-developer (Node.js)
  ├── Task → frontend-developer (Vue)
  └── Task → test-engineer (Jest)
         ↓
Tech Lead valida com bash
         ↓
Tech Lead reporta resultados
```

### Sem Tech Lead Funcional (Atual):

```
Usuário solicita: "@tech-lead execute EP01"
         ↓
Tech Lead analisa a story
         ↓
Tech Lead NÃO PODE delegar (sem Task tool)
         ↓
Tech Lead implementa diretamente (VIOLAÇÃO)
         ↓
Resultado: Tech Lead age como implementador
```

### Solução Temporária:

```
Usuário solicita implementação
         ↓
Nível Principal orquestra:
  ├── Task → shell-developer (Docker)
  ├── Task → backend-developer (Node.js)
  ├── Task → frontend-developer (Vue)
  └── Task → test-engineer (Jest)
         ↓
Nível Principal valida
         ↓
Nível Principal reporta resultados
```

---

## Ação Necessária

Para que o workflow funcione 100% com o Tech Lead:

1. **Adicionar Task tool** à configuração do tech-lead subagent
2. **Remover edit/write tools** da configuração do tech-lead subagent
3. **Testar** chamando `@tech-lead` para orquestrar uma story

---

## Contato

Para ajustar a configuração dos subagents, contate o administrador do sistema.

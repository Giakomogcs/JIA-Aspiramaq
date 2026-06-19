# Copiloto Técnico-Comercial ASPIRAMAQ

> Assistente de IA (RAG) que apoia vendedores da ASPIRAMAQ no dimensionamento técnico de coletores de pó, mídias filtrantes e equipamentos de exaustão industrial.

## Responsabilidade

Este projeto entrega um **copiloto conversacional** para o time comercial da ASPIRAMAQ. O vendedor descreve o cenário do cliente (processo, material, captação, rede) e o copiloto conduz um diagnóstico técnico estruturado: levanta os dados que faltam **por conversa**, consulta a base de conhecimento (RAG) e o histórico de casos reais, roda uma calculadora aeráulica determinística e recomenda equipamento + motor + mídia filtrante coerentes com o catálogo.

O copiloto **estrutura o processo, valida informações, bloqueia avanços prematuros e sinaliza riscos** (ATEX/pó combustível, temperatura, umidade). Ele **não** substitui o vendedor nem o especialista técnico (Hiroshi): casos fora do catálogo padrão ou com risco confirmado são escalados.

O que **não** faz: não fecha orçamento, não emite proposta comercial e não toma decisões de preço.

## Stack

| Camada                      | Tecnologia                              | Observação                                              |
| --------------------------- | --------------------------------------- | ------------------------------------------------------- |
| Orquestração de fluxos      | n8n                                     | Workflows em `workspaces/*.json`                        |
| LLM                         | Azure OpenAI (Chat)                     | Nó `Azure OpenAI Chat Model`                            |
| Embeddings                  | Azure OpenAI (Embeddings)               | Indexação e busca semântica                             |
| Vector store / RAG          | Supabase (pgvector)                     | Nó `search_knowledge_base`                              |
| Banco de dados              | PostgreSQL (Supabase)                   | Memória de chat, sessões, metadados de documentos, auth |
| Histórico de casos          | Google Sheets                           | Abas `historico` e `Respostas ao formulário`            |
| Armazenamento de documentos | Google Drive                            | Ingestão para o RAG                                     |
| Frontend                    | HTML + JavaScript (vanilla)             | Arquivo único `front.html` servido pelo nó HTML         |
| Auth                        | Supabase Auth + RPCs `SECURITY DEFINER` | Migrations `migrations/*.sql`                           |
| Cálculo de dimensionamento  | JavaScript determinístico               | `tools/calculadora_dimensionamento.js`                  |

## Pré-requisitos

- Instância **n8n** com acesso para importar workflows
- Projeto **Supabase** (PostgreSQL com extensão `pgvector` habilitada)
- Credenciais **Azure OpenAI** (deployments de chat e de embeddings)
- Credenciais **Google** (Sheets + Drive) configuradas no n8n
- Planilha Google de histórico de casos (id: `13-BsbvxU3bD8yFGnUArhtACpVd7pat9j_0QlLlPpRpo`)

## Setup

1. **Banco de dados** — execute as migrations de autenticação/usuários em ordem:

   ```bash
   # via Supabase SQL Editor ou psql, em ordem numérica
   migrations/001_user_crud_functions.sql
   migrations/002_add_roles.sql
   migrations/003_admin_guards.sql
   migrations/004_add_company_name.sql
   migrations/005_add_coverage_areas.sql
   migrations/006_prevent_self_delete.sql
   migrations/007_add_user_to_chat.sql
   ```

2. **Tabelas do RAG e vetores** — no n8n, abra o workflow `Aspiramaq-RAG` e rode os nós de setup (`Create Standard Tables`, `Create Vector Table & Functions1`) ou chame o webhook `POST /aspiramaq-DatabaseSetup`.

3. **Importe os workflows** do diretório `workspaces/` no n8n e configure as credenciais (Azure OpenAI, Supabase/Postgres, Google Sheets, Google Drive).

4. **Sincronize o prompt e o front** para dentro dos workflows após editar (veja [Manutenção](#manutenção-prompt-e-front)).

5. **Ative** os workflows e configure o `API_BASE` do front se o domínio do n8n mudar.

## Configuração

O frontend aponta para o n8n via constante em [front.html](front.html#L2918):

```js
const API_BASE = "https://longflatworm-n8n.cloudfy.live/webhook";
```

Credenciais sensíveis (Azure OpenAI, Supabase, Google) vivem nas **credenciais do n8n**, não no repositório. A planilha de histórico e suas abas são referenciadas no workflow `Aspiramaq-Cases`.

## Componentes

| Componente               | Arquivo                                                                                                                                                     | Responsabilidade                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Agente RAG + Chat        | [workspaces/Aspiramaq-Agent-IA-copy.json](workspaces/Aspiramaq-Agent-IA-copy.json)                                                                          | Webhook de chat, agente LLM, ferramentas (RAG, planilha, calculadora), memória                   |
| Frontend                 | [front.html](front.html) + [workspaces/Aspiramaq-Front.json](workspaces/Aspiramaq-Front.json)                                                               | UI de chat, formulário guiado, modais de casos/documentos                                        |
| Ingestão RAG             | [workspaces/Aspiramaq-RAG.json](workspaces/Aspiramaq-RAG.json)                                                                                              | Download Drive, extração (PDF/Excel/CSV/Docs), chunking, embeddings, setup de tabelas, expiração |
| Casos (histórico)        | [workspaces/Aspiramaq-Cases.json](workspaces/Aspiramaq-Cases.json)                                                                                          | Lê 2 abas do Google Sheets e normaliza casos para o front                                        |
| Sessões — listar         | [workspaces/Aspiramaq-Chat-GET-Sessions.json](workspaces/Aspiramaq-Chat-GET-Sessions.json)                                                                  | `GET /aspiramaq-sessions`                                                                        |
| Sessões — histórico      | [workspaces/Aspiramaq-Chat-GET-History.json](workspaces/Aspiramaq-Chat-GET-History.json)                                                                    | `GET /aspiramaq-history`                                                                         |
| Sessões — excluir        | [workspaces/Aspiramaq-Chat-DELETE-Session.json](workspaces/Aspiramaq-Chat-DELETE-Session.json)                                                              | `DELETE /aspiramaq-session`                                                                      |
| Gestão de documentos     | [workspaces/Aspiramaq-Docs-Manager.json](workspaces/Aspiramaq-Docs-Manager.json)                                                                            | Listar/excluir documentos do RAG + health check                                                  |
| Sub-fluxo planilha       | [workspaces/[Aspiramaq] Sub-fluxo\_ Consultar Planilha Inteligente.json](workspaces/%5BAspiramaq%5D%20Sub-fluxo_%20Consultar%20Planilha%20Inteligente.json) | Busca por substring de 1 palavra no histórico                                                    |
| Calculadora              | [tools/calculadora_dimensionamento.js](tools/calculadora_dimensionamento.js)                                                                                | Vazão, velocidade, Ø de tronco, perda de carga, motor sugerido, coerência modelo↔motor           |
| Base de conhecimento     | [base_conhecimento_aspiramaq.md](base_conhecimento_aspiramaq.md) / [RAG/base_conhecimento_aspiramaq.md](RAG/base_conhecimento_aspiramaq.md)                 | Fonte do RAG (2 cópias mantidas idênticas)                                                       |
| Exclusividades de filtro | [RAG/linhas_coletor_exclusividade.md](RAG/linhas_coletor_exclusividade.md)                                                                                  | Regras cartucho↔cartucho e plissado↔zigzag                                                       |
| System prompt            | [prompt_v2.md](prompt_v2.md)                                                                                                                                | Mensagem de sistema do agente                                                                    |

## Endpoints (webhooks n8n)

Todos sob o prefixo `${API_BASE}` (`/webhook`).

| Método | Rota                        | Workflow            | Descrição                             |
| ------ | --------------------------- | ------------------- | ------------------------------------- |
| POST   | `/aspiramaq-AgentRag`       | Agent-IA            | Mensagem de chat → resposta do agente |
| POST   | `/aspiramaq-prune-history`  | Agent-IA            | Poda histórico ao editar mensagem     |
| GET    | `/aspiramaq-sessions`       | Chat-GET-Sessions   | Lista sessões                         |
| GET    | `/aspiramaq-history`        | Chat-GET-History    | Histórico de uma sessão               |
| DELETE | `/aspiramaq-session`        | Chat-DELETE-Session | Exclui sessão                         |
| GET    | `/aspiramaq-cases`          | Cases               | Casos reais (histórico do Sheets)     |
| POST   | `/aspiramaq-index-drive`    | RAG                 | Indexa arquivo do Drive no RAG        |
| POST   | `/aspiramaq-DatabaseSetup`  | RAG                 | Cria/reseta tabelas e funções         |
| POST   | `/aspiramaq-docs-reprocess` | RAG                 | Reprocessa documentos                 |
| GET    | `/aspiramaq-docs-list`      | Docs-Manager        | Lista documentos indexados            |
| POST   | `/aspiramaq-docs-delete`    | Docs-Manager        | Exclui documentos (banco + Drive)     |
| GET    | `/aspiramaq_health`         | Docs-Manager        | Health check                          |
| POST   | `/aspiramaq-chat`           | Front               | Serve o `front.html`                  |

## Fluxo de fases do agente

O agente roteia por **intenção** (não há wizard obrigatório):

- **FASE 0** — papo/saudação/dúvida conceitual → resposta curta.
- **FASE R** — dúvida pontual, substituição/saturação de filtro, diagnóstico → responde direto, ancorado no histórico.
- **Coleta conversacional** — caso novo/troca de equipamento → pergunta por **texto** só o que falta (1–3 perguntas). `QUICK_FORM` é opcional.
- **FASE 3+4** — recomendação completa com vazão, motor e mídia, validando as travas de coerência do catálogo.

Detalhes em [prompt_v2.md](prompt_v2.md). Banco de conhecimento técnico em [base_conhecimento_aspiramaq.md](base_conhecimento_aspiramaq.md).

## Regras de negócio críticas

- **ATEX por exceção:** ATEX não é pergunta padrão. Pó combustível conhecido (madeira, MDF, açúcar, farinha, cacau, fumo, plástico, alumínio fino, grãos, ração) ou histórico marcando ATEX → **alerta** (não bloqueia). ATEX **confirmado** → bloqueia e escala o Hiroshi.
- **Exclusividade de filtro:** filtro **cartucho** só em coletor de cartucho; **plissado MID-PLI-240** só na linha **"zigzag"**. Cartucho ≠ plissado/zigzag (famílias distintas). Ver [RAG/linhas_coletor_exclusividade.md](RAG/linhas_coletor_exclusividade.md).
- **Coerência modelo↔motor:** ex. `CICLONE 50 CARTUCHO = 5 cv`; se a necessidade real for 7,5 cv, sobe para `CICLONE 75`.

## Manutenção (prompt e front)

O `prompt_v2.md` e o `front.html` são as **fontes da verdade** e precisam ser sincronizados para dentro dos workflows após edição:

- `prompt_v2.md` → `parameters.options.systemMessage` do nó **RAG AI Agent** em `Aspiramaq-Agent-IA-copy.json` (prefixado com `=`).
- `front.html` → `parameters.html` do nó **HTML** em `Aspiramaq-Front.json`.

Use um script Node (`JSON.parse`/`JSON.stringify`) em vez de `ConvertTo-Json` do PowerShell, e trate BOM (`raw.slice(1)` se `charCodeAt(0) === 0xFEFF`). Mantenha as **duas cópias** de `base_conhecimento_aspiramaq.md` (raiz e `RAG/`) byte-idênticas.

## Estrutura do Repositório

```
Aspiramaq/
├── front.html                      # UI de chat (fonte da verdade do nó HTML)
├── prompt_v2.md                    # System prompt do agente
├── base_conhecimento_aspiramaq.md  # Base RAG (cópia raiz)
├── DIAGNOSTICO_FLUXO.md            # Análise das falhas que motivaram o prompt v2
├── migrations/                     # SQL de auth/usuários (Supabase)
├── tools/
│   └── calculadora_dimensionamento.js
├── RAG/
│   ├── base_conhecimento_aspiramaq.md      # Base RAG (cópia espelhada)
│   └── linhas_coletor_exclusividade.md     # Exclusividades de filtro
└── workspaces/                     # Workflows n8n (.json)
```

## Arquitetura

Para diagramas de componentes, fluxo de requisição, ingestão RAG e modelo de dados, veja [ARCHITECTURE.md](ARCHITECTURE.md).

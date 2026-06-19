# Arquitetura — Copiloto Técnico-Comercial ASPIRAMAQ

## Padrão Arquitetural

O sistema segue um padrão de **orquestração por workflows + RAG (Retrieval-Augmented Generation)**, com o n8n como backend low-code. Cada responsabilidade (chat, sessões, ingestão de documentos, casos, gestão) é um workflow independente exposto por webhook. O frontend é uma SPA de arquivo único que conversa exclusivamente por HTTP com esses webhooks.

Características:

- **Sem servidor de aplicação tradicional:** a lógica vive em nós de workflow do n8n.
- **Agente com ferramentas:** o LLM (Azure OpenAI) decide quando chamar RAG, histórico de casos e a calculadora determinística.
- **Estado externo:** memória de chat, sessões e vetores ficam no PostgreSQL/Supabase; o histórico de casos no Google Sheets; documentos no Google Drive.
- **Conhecimento versionado em Markdown:** prompt e base de conhecimento são arquivos de repositório sincronizados para dentro dos workflows.

## Diagrama de Contexto (C4 — Nível 1)

```mermaid
C4Context
    title Contexto do Sistema — Copiloto ASPIRAMAQ
    Person(vendedor, "Vendedor / Comercial", "Usa o copiloto para dimensionar coletores")
    Person(admin, "Administrador", "Gerencia usuários e documentos do RAG")

    System(copiloto, "Copiloto ASPIRAMAQ", "Frontend + workflows n8n com agente RAG")

    System_Ext(azure, "Azure OpenAI", "Chat + Embeddings")
    System_Ext(supabase, "Supabase / PostgreSQL", "pgvector, memória, sessões, auth")
    System_Ext(sheets, "Google Sheets", "Histórico de casos reais")
    System_Ext(drive, "Google Drive", "Documentos-fonte do RAG")

    Rel(vendedor, copiloto, "Conversa de diagnóstico", "HTTPS")
    Rel(admin, copiloto, "Gerencia docs/usuários", "HTTPS")
    Rel(copiloto, azure, "Gera respostas e embeddings", "API")
    Rel(copiloto, supabase, "Busca vetorial / persistência", "SQL")
    Rel(copiloto, sheets, "Lê casos reais", "API")
    Rel(copiloto, drive, "Lê documentos para indexar", "API")
```

## Diagrama de Componentes

```mermaid
flowchart TB
    subgraph Client["Cliente"]
        FE["front.html (SPA vanilla JS)"]
    end

    subgraph N8N["n8n — Workflows"]
        AGENT["Aspiramaq-Agent-IA<br/>POST /aspiramaq-AgentRag"]
        FRONT["Aspiramaq-Front<br/>serve HTML"]
        SESS["Sessions / History / Delete<br/>GET sessions·history / DELETE session"]
        CASES["Aspiramaq-Cases<br/>GET /aspiramaq-cases"]
        RAGW["Aspiramaq-RAG<br/>index / setup / reprocess"]
        DOCS["Aspiramaq-Docs-Manager<br/>list / delete / health"]
        SUB["Sub-fluxo Planilha Inteligente"]
    end

    subgraph Tools["Ferramentas do Agente"]
        KB["search_knowledge_base"]
        CALC["Calculadora_Dimensionamento"]
        PG["List/Get/Query Document Rows"]
    end

    subgraph Ext["Serviços externos"]
        AZ["Azure OpenAI"]
        SB[("Supabase / PostgreSQL<br/>pgvector")]
        GS[("Google Sheets")]
        GD[("Google Drive")]
    end

    FE -->|chat| AGENT
    FE -->|sessões| SESS
    FE -->|casos| CASES
    FE -->|docs| DOCS
    FE -->|upload| RAGW
    FRONT -.serve.-> FE

    AGENT --> KB --> SB
    AGENT --> CALC
    AGENT --> PG --> SB
    AGENT --> AZ
    AGENT --> SUB --> GS
    AGENT -.memória.-> SB

    CASES --> GS
    RAGW --> GD
    RAGW --> AZ
    RAGW --> SB
    DOCS --> SB
    DOCS --> GD
    SESS --> SB
```

## Fluxo de Requisição — Chat

Sequência de uma mensagem de diagnóstico enviada pelo vendedor:

```mermaid
sequenceDiagram
    actor V as Vendedor
    participant FE as front.html
    participant WH as Webhook /aspiramaq-AgentRag
    participant AG as RAG AI Agent (LLM)
    participant MEM as Postgres Chat Memory
    participant KB as search_knowledge_base (pgvector)
    participant CASE as Sub-fluxo Planilha
    participant CALC as Calculadora
    participant AZ as Azure OpenAI

    V->>FE: digita mensagem
    FE->>WH: POST { chatInput, sessionId }
    WH->>AG: aciona agente
    AG->>MEM: carrega histórico da sessão
    AG->>AZ: raciocina sobre a intenção
    alt precisa de conhecimento técnico
        AG->>KB: busca semântica
        KB-->>AG: trechos relevantes
    end
    alt precisa de caso real
        AG->>CASE: consulta histórico
        CASE-->>AG: casos similares
    end
    alt precisa dimensionar
        AG->>CALC: vazão/velocidade/motor
        CALC-->>AG: resultado determinístico
    end
    AG->>AZ: gera resposta final
    AG->>MEM: persiste turno
    AG-->>WH: resposta
    WH-->>FE: JSON { output }
    FE-->>V: renderiza (markdown + QUICK_REPLIES)
```

## Fluxo de Ingestão — RAG

```mermaid
flowchart LR
    UP["POST /aspiramaq-index-drive"] --> DL["Download File (Drive)"]
    DL --> SW{"Switch tipo"}
    SW -->|PDF| EPDF["Extract PDF Text"]
    SW -->|Doc| EDOC["Extract Document Text"]
    SW -->|Excel| EXLS["Extract from Excel"]
    SW -->|CSV| ECSV["Extract from CSV"]
    EPDF --> SPLIT["Character Text Splitter"]
    EDOC --> SPLIT
    EXLS --> ROWS["Insert Table Rows"]
    ECSV --> ROWS
    SPLIT --> EMB["Embeddings Azure OpenAI"]
    EMB --> VS["Insert into Supabase Vectorstore"]
    VS --> META["Insert Document Metadata"]
    ROWS --> META

    SCHED["24h Schedule Trigger"] --> EXP["Get Expired File IDs"]
    EXP --> DELDRIVE["Delete from Google Drive"]
    EXP --> DELDB["Clean Database Records"]
```

## Entidades de Dados

| Entidade                     | Onde vive                         | Conteúdo                                     |
| ---------------------------- | --------------------------------- | -------------------------------------------- |
| Mensagens de chat            | PostgreSQL (Postgres Chat Memory) | Turnos por `sessionId`                       |
| Sessões                      | PostgreSQL                        | Sessões de conversa, listagem/exclusão       |
| Vetores de conhecimento      | PostgreSQL (pgvector)             | Chunks + embeddings dos documentos           |
| Metadados de documentos      | PostgreSQL                        | Arquivos indexados, origem no Drive          |
| Linhas tabulares (Excel/CSV) | PostgreSQL                        | Dados de planilhas para consulta estruturada |
| Casos reais                  | Google Sheets                     | Abas `historico` e `Respostas ao formulário` |
| Documentos-fonte             | Google Drive                      | PDFs/Docs/planilhas originais                |
| Usuários / papéis            | PostgreSQL (auth + RPCs)          | Admin/viewer via `migrations/*.sql`          |

## Autenticação e Autorização

A autenticação usa **Supabase Auth**, com operações administrativas expostas por funções `SECURITY DEFINER` (prefixo `sameka_`), evoluídas pelas migrations:

- `sameka_is_admin()` — guarda de papel.
- `sameka_admin_list_users()`, `sameka_admin_confirm_user()`, `sameka_admin_update_user()`, `sameka_admin_delete_user()` — CRUD administrativo de usuários.
- Papéis (admin/viewer) em `002_add_roles.sql`; guardas administrativas em `003_admin_guards.sql`; proteção contra auto-exclusão em `006_prevent_self_delete.sql`.

As RPCs verificam o papel do chamador antes de qualquer mutação, evitando escalonamento de privilégios via cliente.

## Decisões de Arquitetura (ADRs)

### ADR-001 — Orquestração por n8n em vez de backend dedicado

**Contexto:** equipe pequena, necessidade de iterar rápido sobre integrações (Azure, Google, Supabase).
**Decisão:** usar n8n como camada de orquestração; lógica em workflows versionados como JSON.
**Consequências:** time-to-market baixo e integrações visuais; em troca, lógica acoplada ao n8n e necessidade de sincronizar prompt/front manualmente para dentro dos JSONs.

### ADR-002 — RAG com pgvector no Supabase

**Contexto:** conhecimento técnico extenso (catálogo, mídias, casos) que não cabe no prompt.
**Decisão:** indexar documentos via embeddings Azure OpenAI no `pgvector`, recuperando trechos sob demanda.
**Consequências:** respostas ancoradas em fontes reais; exige pipeline de ingestão e expiração de documentos.

### ADR-003 — Coleta conversacional em vez de formulários obrigatórios

**Contexto:** formulários multi-etapa engessavam a conversa e geravam abandono.
**Decisão:** o agente pergunta por **texto** apenas o que falta (1–3 perguntas); o formulário guiado só aparece via botão "Ajuda com caso novo".
**Consequências:** experiência mais natural; exige roteamento por intenção bem definido no prompt.

### ADR-004 — ATEX por exceção

**Contexto:** perguntar ATEX a todos atritava cenários sem risco.
**Decisão:** não perguntar ATEX por padrão; alertar automaticamente quando o material/histórico indicar pó combustível e bloquear/escalar apenas em risco confirmado.
**Consequências:** menos fricção sem perder segurança; depende de lista de materiais combustíveis e marcação no histórico.

### ADR-005 — Calculadora determinística como ferramenta

**Contexto:** cálculos aeráulicos não podem depender de "alucinação" do LLM.
**Decisão:** isolar vazão, velocidade, perda de carga e motor em código JavaScript determinístico exposto como ferramenta do agente.
**Consequências:** números reprodutíveis e auditáveis; o LLM interpreta, não calcula.

## Segurança

- **Segredos** ficam nas credenciais do n8n e no Supabase, nunca no repositório.
- **Autorização** administrativa centralizada em RPCs `SECURITY DEFINER` que checam papel.
- **Escalonamento de risco:** cenários ATEX confirmados são bloqueados e encaminhados ao especialista, evitando recomendação automática indevida.
- **Superfície de API** limitada a webhooks n8n; o front não acessa Supabase/Google diretamente.

## Performance

- **Memória de chat por sessão** evita reprocessar todo o histórico a cada turno.
- **Poda de histórico** (`/aspiramaq-prune-history`) ao editar mensagens mantém o contexto enxuto.
- **Busca vetorial** recupera apenas os chunks relevantes em vez de injetar a base inteira no prompt.
- **Expiração agendada (24h)** remove documentos vencidos do Drive e do banco, controlando o crescimento do índice.
- **Sub-fluxo de planilha** usa busca por substring de uma palavra para respostas rápidas sobre casos.

## Referências

- Racional do prompt v2 e modos de falha corrigidos: [DIAGNOSTICO_FLUXO.md](DIAGNOSTICO_FLUXO.md)
- System prompt: [prompt_v2.md](prompt_v2.md)
- Base de conhecimento: [base_conhecimento_aspiramaq.md](base_conhecimento_aspiramaq.md)
- Visão geral e setup: [README.md](README.md)

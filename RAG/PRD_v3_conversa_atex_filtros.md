# PRD v3 — Copiloto ASPIRAMAQ: conversa livre, ATEX por exceção e exclusividade de filtros

> Documento de produto/implementação. **Nada de código foi alterado ainda** — este PRD é para revisão antes da implementação.
> Escopo decidido com o solicitante: (1) trocar formulário em etapas por **conversa de texto livre**; (2) **ATEX vira botão opcional + alerta automático** quando o pó for combustível conhecido; (3) **exclusividade filtro↔modelo de coletor** (cartucho↔cartucho, plissado↔linha "zigzag"), registrando a regra nova quando a base não tiver.

---

## 1. Contexto e problema

O copiloto atual (n8n + front HTML embutido) conduz o vendedor por um **formulário guiado de 7 campos, uma pergunta por tela** (`renderGuidedCaseForm`, navegação "1 de 7 → Próxima/Voltar" em [front.html](front.html)). Isso gera três dores que o solicitante apontou:

1. **Muitas etapas antes da solução.** O fluxo `FASE 1 (QUICK_FORM de 7 campos) → FASE 3+4` exige preencher tela a tela mesmo quando o vendedor já descreveu o caso em texto. O `prompt_v2.md` reforça isso com gates obrigatórios (regras 5, 12, 13: "PROIBIDO pular a FASE 1", "coleta SEMPRE via QUICK_FORM").
2. **ATEX é um muro.** Hoje ATEX é **pergunta obrigatória e bloqueante** em todo pó orgânico (`prompt_v2.md` Bloqueios Obrigatórios, regra T08; campos `atex` em todos os segmentos do front). Como ATEX é **exceção** (só importa quando o cliente solicita ou quando o pó é reconhecidamente combustível), virar bloqueio em todo caso atrapalha o atendimento.
3. **Falta a regra de exclusividade de filtro↔coletor.** A base tem coerência genérica T09 ("coletor de cartucho/plissado exige mídia de cartucho/plissado; coletor de mangas exige mídia de manga"), mas **não distingue cartucho de plissado** nem registra que **o plissado é exclusivo da linha "zigzag"** e o **cartucho só funciona com filtro de cartucho**. Essa exclusividade comercial/técnica não existe em [base_conhecimento_aspiramaq.md](base_conhecimento_aspiramaq.md) e precisa ser **registrada como condição nova**.

### Arquivos e sincronização (estado atual)

| Artefato | Arquivo fonte | Destino no n8n |
| :-- | :-- | :-- |
| System prompt do agente | [prompt_v2.md](prompt_v2.md) | nó `RAG AI Agent` → `parameters.options.systemMessage` em [workspaces/Aspiramaq-Agent-IA-copy.json](workspaces/Aspiramaq-Agent-IA-copy.json) |
| Base de conhecimento (RAG) | [base_conhecimento_aspiramaq.md](base_conhecimento_aspiramaq.md) e [RAG/base_conhecimento_aspiramaq.md](RAG/base_conhecimento_aspiramaq.md) | Supabase (RAG) consumido por `search_knowledge_base` |
| Front do chat | [front.html](front.html) | `parameters.html` do nó HTML em [workspaces/Aspiramaq-Front.json](workspaces/Aspiramaq-Front.json) |
| Calculadora | [tools/calculadora_dimensionamento.js](tools/calculadora_dimensionamento.js) | `jsCode` do nó `Calculadora_Dimensionamento` |

> **Nota de manutenção (memória do repo):** sincronizar via script Node (JSON.parse/stringify), cuidar BOM UTF-8, e validar com grep + get_errors nos 3 arquivos depois.

---

## 2. Objetivos

- **O1.** Reduzir o atrito até a recomendação: o agente deve resolver com **conversa de texto livre**, sem obrigar o vendedor a passar por formulário multi-etapas quando ele já tem o contexto.
- **O2.** Tornar **ATEX uma exceção bem tratada**: presença opcional (botão/seleção) + **alerta automático** disparado quando o pó é combustível conhecido ou quando o histórico/base sinaliza, em vez de pergunta bloqueante em todo caso.
- **O3.** Codificar a **exclusividade filtro↔modelo de coletor** (cartucho↔cartucho; plissado↔linha "zigzag") na base de conhecimento e nas travas de coerência do prompt, registrando como **condição nova** onde a base hoje é omissa.

### Não-objetivos

- Não reescrever a calculadora de dimensionamento nem a física de vazão/velocidade.
- Não mudar a integração com Supabase/Google Sheets nem o webhook de Casos.
- Não remover a capacidade de oferecer um formulário — ele passa a ser **opcional/fallback**, não o caminho padrão.
- Não alterar regras de escalonamento ao Hiroshi (ATEX confirmado continua exigindo análise especializada).

---

## 3. Workstream A — Conversa livre no lugar do formulário em etapas

### A.1 Comportamento desejado

- O caminho padrão passa a ser **conversa**: o vendeder descreve o caso em texto; o agente **extrai o que já foi dito** e **pergunta em linguagem natural apenas o que falta**, idealmente em **1 mensagem curta** (máx. 1–3 perguntas agrupadas), sem telas sequenciais.
- O **formulário deixa de ser obrigatório**. Ele só aparece como **atalho opcional** ("Prefere preencher um mini-formulário?") ou como **fallback** quando o vendedor pede ou quando a conversa empaca.
- O agente continua **sem re-perguntar** o que já está no texto (regra já existente em `prompt_v2.md` — manter e reforçar).

### A.2 Mudanças no prompt (`prompt_v2.md`)

1. **Inverter a prioridade de coleta.** Onde hoje se lê "a coleta é SEMPRE via `QUICK_FORM`" e "PROIBIDO pedir esses dados em texto livre" (FASE 1 / regras 5, 12), substituir por: **coleta padrão por conversa**; `QUICK_FORM` é **opcional**, oferecido só quando há ≥4 lacunas críticas simultâneas ou quando o vendedor pedir.
2. **Reduzir o gate de 7 campos.** Manter a lista dos 7 dados como *checklist mental*, mas permitir avançar para recomendação quando os **dados que de fato mudam o resultado** estiverem presentes (bocas+Ø+simultaneidade, distância+curvas, processo, material). Itens de menor impacto podem virar **premissa declarada** (já previsto na regra de "premissa assumida").
3. **Máximo de perguntas por turno = 1–3**, agrupadas em uma frase natural — não despejar checklist.
4. Manter os **bloqueios de segurança** (faltando bocas/Ø/simultaneidade não há vazão → continua bloqueante), mas expressá-los conversacionalmente.

### A.3 Mudanças no front (`front.html`)

- **Rebaixar** `renderGuidedCaseForm` (fluxo passo-a-passo "X de N") de caminho padrão para **opção secundária** acionada por um chip "Preencher mini-formulário".
- Ajustar `shouldOpenGuidedCaseIntake` para **não abrir** o formulário automaticamente quando houver qualquer contexto do caso — deixar a conversa fluir e mandar o texto direto ao agente.
- `injectFallbackCaseForm` deixa de injetar o formulário de 7 campos por padrão; passa a injetar **no máximo uma pergunta-resumo** ou nada, deixando o agente conduzir por texto.
- Preservar o parser de `QUICK_FORM`/`QUICK_REPLIES` para quando o agente **opcionalmente** decidir usá-los.

### A.4 Critérios de aceite (A)

- [ ] Vendedor descreve "marcenaria, 3 lixadeiras de 5\", 8 m até o coletor, 2 curvas" em texto → agente responde com diagnóstico/recomendação **sem abrir formulário de 7 telas**.
- [ ] Quando faltam dados críticos, o agente faz **uma pergunta curta agrupada** (texto), não um wizard.
- [ ] Formulário ainda é alcançável por opção explícita.
- [ ] Nenhuma regressão no parsing de `QUICK_FORM`/`QUICK_REPLIES`.

---

## 4. Workstream B — ATEX por exceção (botão opcional + alerta automático)

### B.1 Comportamento desejado (decidido com o solicitante)

- ATEX **não é mais pergunta obrigatória bloqueante** em todo pó orgânico.
- Existe um **botão/toggle opcional sempre disponível** ("Marcar como ATEX / pó combustível") para quando o **cliente solicita** explicitamente — é um critério comum de pedido.
- O sistema **dispara alerta automático** quando o pó informado pertence à **lista de combustíveis conhecidos** (madeira, MDF, açúcar, farinha, cacau, fumo, plástico, alumínio fino, grãos, ração) **ou** quando o **histórico/base** marca aquele material/caso como combustível/ATEX.
- Quando ATEX é **confirmado** (pelo toggle ou pelo cliente), mantém-se o **escalonamento ao Hiroshi** (T08 / NR-20) — isso é segurança e não muda.

### B.2 Mudanças no prompt (`prompt_v2.md`)

1. Remover ATEX da lista de **Bloqueios Obrigatórios incondicionais**. ATEX deixa de bloquear o dimensionamento por padrão.
2. Adicionar uma regra **"ATEX por exceção"**:
   - Se o material ∈ lista de combustíveis conhecidos **ou** o histórico retornar caso marcado ATEX → **emitir alerta** ("⚠️ Esse pó costuma ser tratado como combustível; confirme com o cliente se há exigência ATEX/NR-20") **sem travar** o fluxo.
   - Se o vendedor/cliente **confirmar** ATEX → aí sim **bloquear + escalar Hiroshi** (mantém T08).
3. Tirar a pergunta `atex` dos formulários padrão; ela vira **opcional**.

### B.3 Mudanças no front (`front.html`)

- Remover o campo `atex` das listas `GUIDED_SEGMENT_FIELDS` e do `fallbackForm` como **passo obrigatório**.
- Adicionar um **toggle/botão "Pó combustível / ATEX"** acessível na área de composição (sempre visível, opcional). Quando ligado, o front injeta na mensagem um marcador (ex.: `[ATEX: cliente exige]`) para o agente.
- Implementar **detecção client-side leve** (lista de termos combustíveis) que, ao identificar o material na conversa, renderiza um **banner de alerta não-bloqueante** sugerindo confirmar ATEX.

### B.4 Mudanças na base (`base_conhecimento_aspiramaq.md`)

- Ajustar §8 (Bloqueios) e T08 para refletir: **alerta por exceção**, bloqueio só na **confirmação**. Documentar a **lista de pós combustíveis conhecidos** como gatilho de alerta.

### B.5 Critérios de aceite (B)

- [ ] Caso de marcenaria sem menção a ATEX → agente **recomenda normalmente** e exibe **alerta informativo** de combustível (não bloqueia).
- [ ] Toggle "ATEX" ligado pelo vendedor → agente trata como confirmado e **escala Hiroshi**.
- [ ] Pó não-combustível (ex.: cavaco de aço seco) → **sem alerta** ATEX.
- [ ] Nenhum formulário força a pergunta ATEX como etapa obrigatória.

---

## 5. Workstream C — Exclusividade filtro ↔ modelo de coletor

### C.1 Regra a registrar

> **Condição nova** (a base atual não tem os nomes de linha; registrar conforme decisão do solicitante "use os documentos que temos pra fazer as relações, caso não tenha registre essa nova condição").

- **Coletor de cartucho** → **só** aceita **filtro de cartucho**. Não aceita plissado nem manga.
- **Filtro plissado** (hoje `MID-PLI-240`, Plissado UNO PES 240 Membrana PTFE) → **exclusivo da linha "zigzag"**. Não pode ser especificado para coletor de cartucho comum nem de mangas.
- **Coletor de mangas** → **só** filtro de manga (`MID-PES-350-PTFE`, `MID-PES-400`, `MID-PP-550`, `MID-PES-210-SAR`, `MID-PES-630-SAR`).
- **Coletor metálico/colmeia** → `FM-COLM-595` (pré-filtragem).

> **Pendência de catálogo (registrar como TODO na base):** os nomes/códigos comerciais das **linhas de coletor** (cartucho, "zigzag" plissado, mangas, colmeia) não constam em [base_conhecimento_aspiramaq.md](base_conhecimento_aspiramaq.md). A base hoje só detalha os **filtros**. Será criada uma seção nova "Linhas de coletor e compatibilidade de filtro" com os mapeamentos acima; campos sem código oficial ficam marcados `[REVISAR COM ASPIRAMAQ]`.

### C.2 Matriz de compatibilidade (proposta)

| Linha de coletor | Filtro compatível (exclusivo) | Filtros proibidos |
| :-- | :-- | :-- |
| Cartucho | Filtro de cartucho | plissado, manga, colmeia |
| **Zigzag** (plissado) | `MID-PLI-240` (plissado membrana PTFE) | cartucho comum, manga, colmeia |
| Mangas | `MID-PES-350-PTFE`, `MID-PES-400`, `MID-PP-550`, `MID-PES-210-SAR`, `MID-PES-630-SAR` | plissado, cartucho, colmeia |
| Metálico / Colmeia | `FM-COLM-595` | demais |

> ⚠️ Hoje a "lista fechada de filtros válidos" do `prompt_v2.md` **não tem um item explícito de filtro de cartucho** separado do plissado `MID-PLI-240`. Definir com a ASPIRAMAQ se "cartucho" usa um código próprio ou se, na prática, a linha de cartucho usa o mesmo elemento plissado. **Esta é uma questão em aberto (ver §8).**

### C.3 Mudanças no prompt (`prompt_v2.md`)

- Atualizar **TRAVAS DE COERÊNCIA DE CATÁLOGO** e a regra **T09** para distinguir **cartucho ≠ plissado** e codificar:
  - plissado `MID-PLI-240` ⇒ **somente linha zigzag**;
  - cartucho ⇒ **somente filtro de cartucho**;
  - violação ⇒ **bloquear** e não especificar (ou propor a linha correta).
- Atualizar a seção "Filtro (RAG §5, respeitando o tipo de coletor)" e o "MAPA RÁPIDO" para refletir a exclusividade da linha zigzag.

### C.4 Mudanças na base (`base_conhecimento_aspiramaq.md` + `RAG/…`)

- Nova subseção (ex.: §2.4 / §5.x) **"Linhas de coletor e exclusividade de filtro"** com a matriz C.2 e a regra de bloqueio.
- Acrescentar regra de coerência **T09 detalhada** (cartucho↔cartucho, plissado↔zigzag) na tabela de regras (§7) e na árvore de decisão (§9).

### C.5 Mudanças no front (`front.html`)

- Onde o front lista tipo de coletor (ex.: `options: ["Mangas", "Cartucho/plissado", "Ciclone", "Não sei"]`), **separar "Cartucho" de "Plissado/Zigzag"** para não induzir o agente ao erro.

### C.6 Critérios de aceite (C)

- [ ] Agente nunca recomenda `MID-PLI-240` para coletor que não seja a linha zigzag.
- [ ] Agente nunca recomenda filtro de manga/plissado para coletor de cartucho.
- [ ] Ao detectar incompatibilidade, o agente **bloqueia e propõe a linha correta** em vez de inventar.
- [ ] Base de conhecimento contém a matriz de compatibilidade e a marcação `[REVISAR COM ASPIRAMAQ]` nos códigos pendentes.

---

## 6. Impacto por arquivo (resumo de implementação)

| Arquivo | Workstream | Natureza da mudança |
| :-- | :-- | :-- |
| [prompt_v2.md](prompt_v2.md) | A, B, C | Reescrever gates de coleta (conversa-first), regra ATEX por exceção, travas de coerência cartucho/plissado/zigzag |
| [front.html](front.html) | A, B, C | Rebaixar formulário guiado, toggle ATEX + banner de alerta, separar cartucho/zigzag nas opções de coletor |
| [base_conhecimento_aspiramaq.md](base_conhecimento_aspiramaq.md) + [RAG/base_conhecimento_aspiramaq.md](RAG/base_conhecimento_aspiramaq.md) | B, C | §8/T08 ATEX por exceção; nova seção de linhas de coletor + matriz de compatibilidade |
| [workspaces/Aspiramaq-Agent-IA-copy.json](workspaces/Aspiramaq-Agent-IA-copy.json) | A, B, C | Re-sincronizar `systemMessage` a partir do prompt |
| [workspaces/Aspiramaq-Front.json](workspaces/Aspiramaq-Front.json) | A, B, C | Re-sincronizar `parameters.html` a partir do front |

---

## 7. Plano de implementação (fases sugeridas)

1. **Fase 1 — Conhecimento (base RAG).** Registrar exclusividade filtro↔coletor (C.4) e ATEX por exceção (B.4). É a fundação para o resto.
2. **Fase 2 — Prompt.** Reescrever coleta conversa-first (A.2), ATEX por exceção (B.2) e travas de coerência (C.3) no `prompt_v2.md`.
3. **Fase 3 — Front.** Rebaixar formulário, toggle ATEX + banner, separar cartucho/zigzag (A.3, B.3, C.5).
4. **Fase 4 — Sincronização n8n.** Reimportar prompt → `Aspiramaq-Agent-IA-copy.json`; front → `Aspiramaq-Front.json` (script Node, cuidar BOM).
5. **Fase 5 — Validação.** Rodar roteiros de aceite (A/B/C) e revisar com a ASPIRAMAQ os itens `[REVISAR]`.

---

## 8. Questões em aberto (precisam de confirmação da ASPIRAMAQ)

1. **Código do filtro de cartucho.** Existe um elemento de cartucho com código próprio (distinto do plissado `MID-PLI-240`)? Ou a "linha de cartucho" na prática usa outro elemento? Sem isso, a trava cartucho↔cartucho fica conceitual.
2. **Nome/código oficiais da linha "zigzag".** Confirmar o nome comercial e código do coletor zigzag que usa o plissado.
3. **Demais linhas de coletor** (mangas, colmeia/metálico): nomes/modelos comerciais para a seção nova da base.
4. **Lista de pós combustíveis** para o alerta automático ATEX — confirmar/expandir a lista (madeira, MDF, açúcar, farinha, cacau, fumo, plástico, alumínio fino, grãos, ração).

---

## 9. Riscos

| Risco | Impacto | Mitigação |
| :-- | :-- | :-- |
| Afrouxar gates de coleta pode deixar o agente cravar com dados de menos | Recomendação errada | Manter bloqueio só nos dados que mudam vazão/motor (bocas+Ø+simultaneidade, rede); demais viram premissa declarada |
| ATEX deixar de bloquear pode esconder risco real de explosão | Segurança | Alerta automático sempre que o pó for combustível; confirmação → bloqueio + Hiroshi (mantido) |
| Códigos de linha de coletor inexistentes na base | Recomendação incoerente | Registrar como `[REVISAR COM ASPIRAMAQ]` e bloquear quando não houver mapeamento explícito |
| Dessincronização entre arquivos fonte e nós n8n | Comportamento divergente em produção | Seguir checklist de sync (script Node + grep + get_errors) da memória do repo |

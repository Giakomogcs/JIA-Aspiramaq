# BASE DE CONHECIMENTO — LINHAS DE COLETOR E EXCLUSIVIDADE DE FILTRO (ASPIRAMAQ)

> **Status:** condição NOVA registrada a pedido da ASPIRAMAQ. A base principal (`base_conhecimento_aspiramaq.md`) detalha apenas os **elementos filtrantes**; os **modelos/linhas de coletor** não estavam documentados. Este arquivo registra as **relações de exclusividade** entre tipo de coletor e elemento filtrante. Campos sem código comercial oficial estão marcados `[REVISAR COM ASPIRAMAQ]`.
>
> Regra-mãe: **o elemento filtrante é exclusivo da família de coletor correspondente. Nunca misturar famílias.** Em caso de incompatibilidade, **bloquear** e propor a linha correta — nunca improvisar mapeamento.

---

## 1. PRINCÍPIO DE EXCLUSIVIDADE

Cada família de coletor usa **apenas** o elemento filtrante da sua própria família. A geometria do alojamento, a vedação e o sistema de limpeza são específicos — um elemento de outra família **não veda, não limpa e não filtra corretamente**, mesmo que "caiba" fisicamente.

| Família de coletor     | Elemento filtrante exclusivo                                                          | NUNCA usar                      |
| :--------------------- | :------------------------------------------------------------------------------------ | :------------------------------ |
| **Cartucho**           | Filtro de cartucho (elemento cilíndrico de cartucho)                                  | plissado zigzag, manga, colmeia |
| **Zigzag (plissado)**  | `MID-PLI-240` — Plissado UNO PES 240 Membrana PTFE                                    | cartucho comum, manga, colmeia  |
| **Mangas**             | `MID-PES-350-PTFE`, `MID-PES-400`, `MID-PP-550`, `MID-PES-210-SAR`, `MID-PES-630-SAR` | plissado, cartucho, colmeia     |
| **Metálico / Colmeia** | `FM-COLM-595` — Filtro Colmeia                                                        | mangas, cartucho, plissado      |

### 1.1 As duas exclusividades críticas (foco do pedido)

1. **Filtro cartucho ↔ coletor de cartucho.** O **filtro de cartucho só pode ser usado em coletor de cartucho**. Não aceita plissado nem manga.
2. **Filtro plissado ↔ linha "zigzag".** O **filtro plissado (`MID-PLI-240`) é exclusivo da linha "zigzag"**. Não pode ser especificado para coletor de cartucho comum, de mangas ou metálico.

> ⚠️ **Cartucho ≠ Plissado.** Apesar de ambos serem elementos "rígidos pregueados", são famílias **distintas e não intercambiáveis** no catálogo ASPIRAMAQ. O plissado pertence à linha zigzag; o cartucho pertence à linha de cartucho. Tratar como tecnologias separadas.

---

## 2. LINHAS DE COLETOR (registro de catálogo)

> Os nomes/códigos comerciais das linhas de coletor não constavam na base. Registrados aqui para permitir a regra de exclusividade. Confirmar com a ASPIRAMAQ.

| Linha de coletor           | Código                    | Elemento filtrante                      | Aplicação típica                                                          | Status                           |
| :------------------------- | :------------------------ | :-------------------------------------- | :------------------------------------------------------------------------ | :------------------------------- |
| Coletor de cartucho        | `[REVISAR COM ASPIRAMAQ]` | Filtro de cartucho `[código a definir]` | Pó fino seco, alta área filtrante em pouco espaço                         | Código pendente                  |
| **Zigzag** (plissado)      | `[REVISAR COM ASPIRAMAQ]` | `MID-PLI-240` (plissado membrana PTFE)  | Pó ultrafino/submicrométrico, alta eficiência (99,99% ≥0,5 µm), T ≤ 120°C | Nome confirmado; código pendente |
| Coletor de mangas          | `[REVISAR COM ASPIRAMAQ]` | Mangas têxteis (ver §1)                 | Maioria dos despoeiramentos industriais; grande volume                    | Código pendente                  |
| Coletor metálico / Colmeia | `[REVISAR COM ASPIRAMAQ]` | `FM-COLM-595`                           | Pré-filtragem, coifa, névoa de óleo grosso (G1/MERV1)                     | Código pendente                  |

### 2.1 Filtro de cartucho — pendência de registro

A base principal **não possui um elemento de cartucho com código próprio** (distinto do plissado `MID-PLI-240`). É necessário confirmar com a ASPIRAMAQ:

- Existe um cartucho com código próprio (ex.: `MID-CART-xxx`)? **Se sim, registrar na lista fechada de filtros.**
- Ou a "linha de cartucho" usa, na prática, outro elemento?

Enquanto não houver código oficial, o agente deve **bloquear** a recomendação de filtro de cartucho e pedir validação (não inventar ID), conforme regra T11.

---

## 3. REGRAS DE COERÊNCIA (complementam §7.2 da base principal)

| ID        | Regra                                                                                                                                                                | Ação se violada                                                                                                          |
| :-------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| **T09**   | Coletor de **cartucho** usa **somente filtro de cartucho**; coletor de **mangas** usa **somente manga**; coletor **metálico/colmeia** usa **somente** `FM-COLM-595`. | **BLOQUEAR** — propor o elemento da família correta                                                                      |
| **T09.1** | Filtro **plissado `MID-PLI-240`** é **exclusivo da linha "zigzag"**. Proibido em cartucho, mangas ou metálico.                                                       | **BLOQUEAR** — se a aplicação exige plissado, especificar a linha zigzag; senão, escolher elemento da família do coletor |
| **T09.2** | Filtro de **cartucho** é **exclusivo do coletor de cartucho**. Proibido em zigzag, mangas ou metálico.                                                               | **BLOQUEAR** — usar o elemento da família correspondente                                                                 |
| **T11**   | Não há código oficial de filtro de cartucho na base. Enquanto pendente, **não inventar ID** de cartucho.                                                             | **BLOQUEAR** e pedir validação técnica (Hiroshi/ASPIRAMAQ)                                                               |

> **Relação com regras existentes:** estas regras detalham e substituem o T09 genérico ("cartucho/plissado ⇒ mídia cartucho/plissada") que tratava cartucho e plissado como uma família só. A partir de agora, **cartucho e plissado/zigzag são famílias separadas**.

---

## 4. ÁRVORE DE DECISÃO — ESCOLHA DA FAMÍLIA ANTES DO ELEMENTO

```
1) Já existe coletor definido (substituição)?
   ├─ SIM → identifique a família do coletor → use SOMENTE o elemento dessa família (T09).
   │        • Cartucho → filtro de cartucho
   │        • Zigzag → MID-PLI-240
   │        • Mangas → manga compatível (§5 base)
   │        • Colmeia → FM-COLM-595
   └─ NÃO (equipamento novo) → continue.

2) A aplicação exige eficiência submicrométrica / pó ultrafino (99,9%+)?
   ├─ SIM → família ZIGZAG (plissado MID-PLI-240), T ≤ 120°C.
   │        Se T > 120°C → escalar Hiroshi.
   └─ NÃO → continue.

3) Pré-filtragem / coifa / névoa de óleo grosso?
   ├─ SIM → família METÁLICA (FM-COLM-595) + filtro complementar se exigir eficiência fina.
   └─ NÃO → família MANGAS (escolher manga por §5 da base) OU cartucho conforme
            disponibilidade de catálogo e espaço. (Cartucho exige código oficial — T11.)
```

> Nunca recomende um elemento sem antes fixar a **família do coletor**. A família trava o elemento.

---

[BUSCA: coletor, cartucho, plissado, zigzag, manga, colmeia, exclusividade, compatibilidade, família, MID-PLI-240, MID-PES, FM-COLM-595, T09, T11, linha de coletor, elemento filtrante, bloqueio]

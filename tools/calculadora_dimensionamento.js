// Calculadora determinística de dimensionamento aeráulico para coletores de pó.
// Entrada (string JSON via "query"):
//   {
//     "processo": "madeira" | "mdf" | "po_madeira" | "metal" | "farinha" | "plastico" | "organico" | "fumo" | "solda" | "poeira_leve",
//     "bocas": [ { "D_in": 5, "count": 3, "v_alvo": 22 }, ... ],
//     "tronco_D_in": 12,        // opcional — se quiser validar um Ø proposto
//     "rede": { "L_m": 8, "curvas": 3 }, // opcional — estima perda de carga da rede
//     "equipamento_modelo": "CICLONE 50 CARTUCHO" // opcional — valida coerencia modelo x motor
//   }
// Saída: JSON com vazões, faixa de velocidade do processo, Ø de tronco recomendado,
// validação do Ø informado, perda de carga estimada, motor sugerido por faixa de vazão
// e (quando informado) checagem de coerencia de catalogo modelo x motor.

let input;
try {
  input = typeof query === "string" ? JSON.parse(query) : query;
} catch (e) {
  return JSON.stringify({
    error:
      'Entrada deve ser JSON válido. Exemplo: {"processo":"mdf","bocas":[{"D_in":5,"count":3,"v_alvo":22}],"tronco_D_in":12}',
  });
}

const PI = Math.PI;
const v_min_map = {
  madeira: 18,
  mdf: 20,
  po_madeira: 20,
  metal: 22,
  farinha: 18,
  plastico: 18,
  organico: 18,
  fumo: 10,
  solda: 10,
  fumo_metalico: 10,
  fumaca: 10,
  poeira_leve: 12,
};
const v_max_map = {
  madeira: 25,
  mdf: 26,
  po_madeira: 26,
  metal: 28,
  farinha: 22,
  plastico: 22,
  organico: 24,
  fumo: 13,
  solda: 13,
  fumo_metalico: 13,
  fumaca: 13,
  poeira_leve: 15,
};

const proc = String(input.processo || "")
  .toLowerCase()
  .replace(/[^a-z_]/g, "_");
const v_min = v_min_map[proc] || 18;
const v_max = v_max_map[proc] || 25;
const v_target = (v_min + v_max) / 2;

if (!Array.isArray(input.bocas) || input.bocas.length === 0) {
  return JSON.stringify({
    error: 'Informe pelo menos uma boca em "bocas": [{D_in, count, v_alvo?}]',
  });
}

const std_diametros = [4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20];
const area = (D_in) => PI * Math.pow((D_in * 0.0254) / 2, 2);
const Q = (D_in, v, n) => area(D_in) * v * 3600 * (n || 1);

const bocas_out = input.bocas.map((b) => {
  const v = b.v_alvo || v_target;
  const q_each = Q(b.D_in, v, 1);
  const q_total = q_each * (b.count || 1);
  return {
    D_in: b.D_in,
    count: b.count || 1,
    v_alvo_m_s: v,
    area_m2: +area(b.D_in).toFixed(5),
    Q_por_boca_m3h: Math.round(q_each),
    Q_total_m3h: Math.round(q_total),
  };
});

const Q_rede = Math.round(bocas_out.reduce((s, b) => s + b.Q_total_m3h, 0));

// Menor Ø comercial que mantém a velocidade entre v_min e v_max
let tronco_rec = null;
for (const D of std_diametros) {
  const v = Q_rede / (3600 * area(D));
  if (v >= v_min && v <= v_max) {
    tronco_rec = {
      D_in: D,
      v_real_m_s: +v.toFixed(2),
      area_m2: +area(D).toFixed(5),
    };
    break;
  }
}
if (!tronco_rec) {
  let best = null,
    bestDiff = Infinity;
  for (const D of std_diametros) {
    const v = Q_rede / (3600 * area(D));
    const diff = Math.abs(v - v_target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = {
        D_in: D,
        v_real_m_s: +v.toFixed(2),
        area_m2: +area(D).toFixed(5),
        aviso:
          v < v_min
            ? "velocidade abaixo do mínimo de transporte — risco de decantação"
            : "velocidade acima do máximo — risco de erosão/ruído",
      };
    }
  }
  tronco_rec = best;
}

let tronco_informado = null;
if (input.tronco_D_in) {
  const D = Number(input.tronco_D_in);
  const v = Q_rede / (3600 * area(D));
  const ok = v >= v_min && v <= v_max;
  tronco_informado = {
    D_in: D,
    v_real_m_s: +v.toFixed(2),
    area_m2: +area(D).toFixed(5),
    faixa_alvo: { v_min, v_max },
    ok,
    status: ok
      ? "OK"
      : v < v_min
        ? "SUBDIMENSIONADO — velocidade abaixo do mínimo, pó decanta e entope o duto"
        : "SUPERDIMENSIONADO — velocidade acima do máximo, erosão e perda de carga excessiva",
  };
}

const motor_faixas = [
  { min: 0, max: 1200, cv: "3 cv" },
  { min: 1200, max: 2000, cv: "5 cv" },
  { min: 2000, max: 3200, cv: "7,5 a 10 cv" },
  { min: 3200, max: 5000, cv: "12,5 a 15 cv" },
  { min: 5000, max: 7500, cv: "20 cv" },
  { min: 7500, max: 11000, cv: "25 a 30 cv" },
  { min: 11000, max: 999999, cv: "acima de 30 cv — consultar engenharia" },
];
const motor = motor_faixas.find((f) => Q_rede >= f.min && Q_rede < f.max);

const toCvNumber = (value) => {
  const m = String(value || "").match(/(\d+(?:[\.,]\d+)?)/);
  return m ? Number(m[1].replace(",", ".")) : null;
};

const equipamentosComMotorFixo = [
  {
    nome_modelo: "CICLONE 50 CARTUCHO",
    regex: /ciclone\s*50.*cartucho|cartucho.*ciclone\s*50/i,
    motor_catalogo_cv: "5 cv",
    proximo_modelo: "CICLONE 75",
  },
  {
    nome_modelo: "CICLONE 75",
    regex: /ciclone\s*75/i,
    motor_catalogo_cv: "7,5 cv",
    proximo_modelo: null,
  },
];

const equipamentoModelo = String(
  input.equipamento_modelo ?? input.modelo_equipamento ?? input.modelo ?? ""
).trim();

let coerencia_catalogo = null;
if (equipamentoModelo) {
  const regra = equipamentosComMotorFixo.find((r) => r.regex.test(equipamentoModelo));
  if (regra) {
    const motorCalculado = motor ? motor.cv : "consultar engenharia";
    const motorCalculadoCv = toCvNumber(motorCalculado);
    const motorCatalogoCv = toCvNumber(regra.motor_catalogo_cv);
    const coerente =
      motorCalculadoCv !== null && motorCatalogoCv !== null
        ? Math.abs(motorCalculadoCv - motorCatalogoCv) <= 0.3
        : false;

    let acao = "OK";
    if (!coerente) {
      if (regra.nome_modelo === "CICLONE 50 CARTUCHO") {
        acao =
          "Incoerencia catalogo: CICLONE 50 CARTUCHO deve fechar em 5 cv; se a necessidade real for 7,5 cv, migrar para CICLONE 75.";
      } else {
        acao =
          "Incoerencia catalogo: ajuste modelo ou valide o ponto com engenharia antes de fechar proposta.";
      }
    }

    coerencia_catalogo = {
      modelo_informado: equipamentoModelo,
      regra_aplicada: regra.nome_modelo,
      motor_catalogo_cv: regra.motor_catalogo_cv,
      motor_calculado_cv: motorCalculado,
      coerente,
      acao_recomendada: acao,
      proximo_modelo_sugerido: !coerente ? regra.proximo_modelo : null,
    };
  }
}

// Perda de carga estimada da rede (se L_m/curvas informados)
let perda_carga = null;
const rede = input.rede || {};
const L_m = Number(rede.L_m ?? input.L_m ?? 0);
const curvas = Number(rede.curvas ?? input.curvas ?? 0);
if (L_m > 0 || curvas > 0) {
  const duto = tronco_informado && tronco_informado.ok ? tronco_informado : tronco_rec;
  const v = duto.v_real_m_s;
  const D_m = duto.D_in * 0.0254;
  const Pd = +(0.0612 * v * v).toFixed(1); // pressão dinâmica ≈ ρv²/2 ÷ 9,81 (mm.c.a., ar a 1,2 kg/m³)
  const dP_atrito = +((0.02 / D_m) * Pd * L_m).toFixed(1); // λ=0,02 (duto metálico liso)
  const dP_curvas = +(curvas * 0.3 * Pd).toFixed(1); // K≈0,3 por curva 90° R/D≥1,5
  const dP_total = +(dP_atrito + dP_curvas).toFixed(1);
  perda_carga = {
    base: { duto_D_in: duto.D_in, v_m_s: v, L_m, curvas },
    pressao_dinamica_mmca: Pd,
    dP_atrito_mmca: dP_atrito,
    dP_curvas_mmca: dP_curvas,
    dP_rede_total_mmca: dP_total,
    aviso:
      "Estimativa da REDE apenas (atrito + curvas 90°). NÃO inclui perda do coletor/mídia (~80–120 mm.c.a. limpa) nem captão/coifa. Some-as ao selecionar o exaustor.",
  };
}

return JSON.stringify({
  processo: input.processo || "(não informado)",
  equipamento_modelo_informado: equipamentoModelo || null,
  faixa_velocidade_m_s: { v_min, v_max, v_target },
  bocas: bocas_out,
  Q_total_rede_m3h: Q_rede,
  tronco_recomendado: tronco_rec,
  tronco_informado,
  perda_carga_estimada: perda_carga,
  motor_sugerido_cv: motor ? motor.cv : "consultar engenharia",
  coerencia_catalogo,
  observacao:
    "Velocidade no tronco precisa ficar entre v_min e v_max do processo. Some +10–15% à vazão por curvas/perdas em redes longas (>10 m ou >4 curvas).",
});

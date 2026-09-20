// Pure rules for a local, fictional prototype. No model, image analysis or network.
export const CHECKOUT_EXAMPLE_URL = "https://www.designengineer.com.br/oferta";

const demoSource = (name) =>
  Object.freeze({
    title: `SkinBoost · ${name} · catálogo conceitual`,
    detail:
      "Produto fictício. Preço e preço de referência são valores DEMONSTRATIVOS, sem oferta comercial, cotação ou histórico de preço.",
    status: "concept",
  });

export const CATALOG = Object.freeze([
  Object.freeze({
    id: "cleanse",
    name: "Cleanse",
    category: "Limpeza",
    volume: "150 ml",
    description: "Etapa de limpeza do catálogo conceitual SkinBoost.",
    price: 49,
    referencePrice: 59,
    image: "/media/produtos-skinboost.png",
    source: demoSource("Cleanse"),
    benefit: "Papel na demonstração: organizar a etapa de limpeza.",
    evidence:
      "Fórmula, ingredientes, instruções e adequação não foram validados. Não há estudo ou prazo de benefício atribuído a este conceito.",
  }),
  Object.freeze({
    id: "balance",
    name: "Balance",
    category: "Sérum",
    volume: "30 ml",
    description: "Item complementar para explorar a organização de uma rotina.",
    price: 79,
    referencePrice: 99,
    image: "/media/produtos-skinboost.png",
    source: demoSource("Balance"),
    benefit:
      "Papel na demonstração: comparar uma etapa complementar com uma rotina mais curta.",
    evidence:
      "Não há fórmula, estudo de eficácia ou indicação para condição de pele. O nome Balance não comprova efeito clínico.",
  }),
  Object.freeze({
    id: "comfort",
    name: "Comfort",
    category: "Hidratação",
    volume: "50 ml",
    description: "Etapa de hidratação do catálogo conceitual SkinBoost.",
    price: 69,
    referencePrice: 89,
    image: "/media/produtos-skinboost.png",
    source: demoSource("Comfort"),
    benefit: "Papel na demonstração: organizar a etapa de hidratação.",
    evidence:
      "Não há comprovação de tolerância, adequação a pele sensível ou prazo de resultado. Essas informações dependem de documentação real.",
  }),
]);

export const DEFAULT_CONTEXT = Object.freeze({
  intent: "",
  goal: "",
  approach: "",
  budget: "",
  existing: "",
  sensitivity: "",
});

const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
export const formatMoney = (value) =>
  typeof value === "number" && Number.isFinite(value)
    ? money.format(value)
    : "—";

function parseBudget(value) {
  const text = normalize(value);
  if (
    !text ||
    /^(?:prefiro decidir depois|decidir depois|depois|a definir|nao definido|nao sei|sem limite)$/.test(
      text,
    )
  )
    return { value: null, valid: true };
  if (typeof value === "number")
    return Number.isFinite(value) &&
      value >= 0 &&
      Number.isSafeInteger(Math.round(value * 100)) &&
      Math.abs(value * 100 - Math.round(value * 100)) < 1e-6
      ? { value, valid: true }
      : { value: null, valid: false };
  const match = text.match(
    /^(?:(?:ate|limite(?: de)?|orcamento(?: de)?|maximo(?: de)?)\s*)?(?:r\$\s*)?(\d[\d.,]*)(?:\s*(?:reais|brl))?$/,
  );
  if (!match) return { value: null, valid: false };
  const raw = match[1];
  let amount;
  if (/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(raw))
    amount = Number(raw.replaceAll(".", "").replace(",", "."));
  else if (/^\d+\.\d{1,2}$/.test(raw)) amount = Number(raw);
  else return { value: null, valid: false };
  return Number.isFinite(amount) &&
    Number.isSafeInteger(Math.round(amount * 100))
    ? { value: amount, valid: true }
    : { value: null, valid: false };
}

const existingPatterns = {
  cleanse: /\b(?:cleanse|cleanser|limpador|limpeza|sabonete)\b/,
  balance: /\b(?:balance|serum)\b/,
  comfort: /\b(?:comfort|hidratante|hidratacao|moisturi[sz]er)\b/,
};

function existingCategories(value) {
  const text = normalize(Array.isArray(value) ? value.join(", ") : value);
  const found = new Set();
  // Recognize explicit names/categories only; this is not an ingredient matcher.
  for (const clause of text.split(/[,;.\n]|\b(?:e|mas)\b/)) {
    if (
      /\b(?:nao\s+(?:(?:tenho|uso|utilizo)\b)|(?:parei|deixei)\s+de\s+usar\b)/.test(
        clause,
      )
    )
      continue;
    for (const [id, pattern] of Object.entries(existingPatterns)) {
      const match = clause.match(pattern);
      if (
        match &&
        !/\bsem\s+(?:(?:um|uma)\s+)?$/.test(clause.slice(0, match.index))
      )
        found.add(id);
    }
  }
  return found;
}

export function isMedicalRequest(value) {
  // A routing cue for the prototype, not a medical or safety classifier.
  const text = normalize(value).replace(
    /\b(?:nao|sem|dispenso|evitar)\s+(?:(?:quero|preciso|busco|procuro|fazer|um|uma|qualquer|de)\s+){0,4}(?:diagnosti[cq]\w*|tratamentos?(?: medico)?|tratar|curar|prescric\w*)\b/g,
    "",
  );
  if (
    /\b(?:diagnosticar|diagnostique|diagnostica|prescreva|prescrever|receitar|receite)\b/.test(
      text,
    )
  )
    return true;
  if (
    /^(?:diagnostico|prescricao)$/.test(text) ||
    /\b(?:quero|preciso|faca|qual|pode|poderia|me de|me diga|busco|gostaria)\b.{0,40}\b(?:diagnostico|prescricao)\b/.test(
      text,
    )
  )
    return true;
  const disease =
    "(?:acne|rosacea|dermatite|eczema|psoriase|melanoma|cancer|micose|infeccao|alergia|doenca|lesao)";
  if (
    new RegExp(
      `\\b(?:tratar|tratamento|tratamentos|curar|cura|terapia)\\b.{0,55}\\b${disease}\\b`,
    ).test(text)
  )
    return true;
  if (
    new RegExp(
      `\\b(?:isso|isto|essa?|esta?|mancha|pinta)\\b.{0,30}\\b(?:e|parece|pode ser|indica)\\s+(?:uma?\\s+)?${disease}\\b`,
    ).test(text)
  )
    return true;
  if (
    new RegExp(
      `\\b(?:sera que|como saber se|me diga se|diga se|saber se|descobrir se|identificar se|ver se|nao sei se)\\s+(?:eu\\s+)?(?:tenho|e|ha)\\s+(?:uma?\\s+)?${disease}\\b`,
    ).test(text)
  )
    return true;
  return /\b(?:indique|recomende|qual|que|preciso de|posso tomar|posso usar)\b.{0,45}\b(?:medicamento|remedio|antibiotico|corticoide|isotretinoina|dosagem|dose)\b/.test(
    text,
  );
}

export function validatePhoto(file) {
  if (file == null) return "";
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(normalize(file.type)))
    return "Escolha uma foto JPG, PNG ou WebP. Você também pode continuar sem foto.";
  if (
    typeof file.size !== "number" ||
    !Number.isFinite(file.size) ||
    file.size <= 0
  )
    return "O arquivo está vazio ou não pôde ser lido. Escolha outra foto ou continue sem ela.";
  if (file.size > 10 * 1024 * 1024)
    return "A foto deve ter até 10 MB. Escolha um arquivo menor ou continue sem foto.";
  const extension = normalize(file.name).match(/\.([a-z0-9]+)$/)?.[1];
  const extensions = {
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
  };
  if (extension && !extensions[normalize(file.type)].includes(extension))
    return "O formato e a extensão do arquivo não correspondem. Escolha outra foto ou continue sem ela.";
  return "";
}

export function buildRoutine(input = DEFAULT_CONTEXT) {
  const context =
    input && typeof input === "object"
      ? { ...DEFAULT_CONTEXT, ...input }
      : { ...DEFAULT_CONTEXT };
  const budget = parseBudget(context.budget);
  const limitations = [
    "Catálogo e preços fictícios para demonstração. A comparação de preços e a economia são simuladas; não existe oferta comercial.",
    "A foto não é analisada. Esta seleção usa apenas o contexto informado e regras locais; não avalia adequação, segurança ou eficácia dos produtos.",
  ];
  const empty = (explanation, extra = []) => ({
    products: [],
    subtotal: 0,
    comparisonTotal: 0,
    savings: 0,
    withinBudget: false,
    budgetValue: budget.value,
    explanation,
    limitations: [...limitations, ...extra],
  });
  if (!budget.valid)
    return empty(
      "Não foi possível entender o orçamento. Informe um valor em reais ou escolha decidir depois.",
      [
        "Orçamento inválido: nenhuma seleção foi feita para evitar ultrapassar um limite desconhecido.",
      ],
    );
  if (isMedicalRequest([context.intent, context.goal].join(" ")))
    return empty(
      "Este exemplo organiza uma rotina cosmética e não responde a pedidos de diagnóstico ou tratamento. Você pode rever o pedido ou buscar orientação profissional.",
      [
        "O pedido está fora do escopo desta demonstração; nenhuma recomendação foi gerada.",
      ],
    );

  const declared = normalize(`${context.goal} ${context.intent}`);
  const approach = normalize(context.approach) || declared;
  const explore =
    /explor|complet|conhecer (?:a )?(?:linha|catalogo)/.test(approach) &&
    !/poucos passos|minim|simples|essencial/.test(approach);
  const hydrationFirst = /hidrat|ressec|conforto|comfort/.test(declared);
  const priority = hydrationFirst
    ? ["comfort", "cleanse"]
    : ["cleanse", "comfort"];
  if (explore) priority.push("balance");
  const existing = existingCategories(context.existing);
  const candidates = priority.filter((id) => !existing.has(id));
  const products = [];
  let totalCents = 0;
  const budgetCents =
    budget.value === null ? Infinity : Math.round(budget.value * 100);
  const omitted = [];

  if (existing.size)
    limitations.push(
      "As categorias que você declarou já usar não foram adicionadas novamente. Isso não valida os produtos atuais nem combinações de ingredientes.",
    );
  if (
    normalize(context.sensitivity) &&
    !/^(?:nao|nenhuma|nenhuma restricao conhecida|nao tenho|nao sei|prefiro nao informar)$/.test(
      normalize(context.sensitivity),
    )
  )
    limitations.push(
      "A sensibilidade informada foi preservada como limite, mas este catálogo sem fórmula validada não permite concluir tolerância ou adequação.",
    );
  if (budget.value === null)
    limitations.push(
      "Você não definiu um teto de gasto. O total exibido é demonstrativo e pode ser revisto antes de qualquer decisão.",
    );

  for (const id of candidates) {
    const product = CATALOG.find((item) => item.id === id);
    const cost = Math.round(product.price * 100);
    if (totalCents + cost > budgetCents) {
      omitted.push(product.name);
      // Do not fill a small budget with a cheaper add-on after the priority fails.
      if (!products.length) break;
      continue;
    }
    let reason =
      id === "balance"
        ? "Você escolheu explorar possibilidades; este sérum aparece como etapa complementar do catálogo conceitual."
        : id === "comfort" && hydrationFirst
          ? "Você mencionou hidratação ou conforto; esta categoria ganha prioridade na organização do exemplo, sem comprovar adequação."
          : `${id === "cleanse" ? "Limpeza" : "Hidratação"} faz parte da base curta usada neste exemplo e não foi reconhecida entre as categorias que você declarou já usar.`;
    const goal = normalize(context.goal);
    if (/oleosidade/.test(goal))
      reason = `Você declarou interesse em oleosidade. ${reason} Esta organização não comprova controle de oleosidade nem eficácia de uma fórmula.`;
    else if (/hidrat/.test(goal) && id !== "comfort")
      reason = `Seu foco informado é hidratação. ${reason}`;
    else if (/conhecer/.test(goal))
      reason = `Você quer conhecer as opções da linha. ${reason}`;
    if (budget.value !== null)
      reason += ` O valor demonstrativo cabe no teto informado de ${formatMoney(budget.value)} junto dos outros itens selecionados.`;
    products.push({ ...product, source: { ...product.source }, reason });
    totalCents += cost;
  }

  // Selection priority decides what fits; display follows the catalog sequence.
  const displayOrder = CATALOG.map((product) => product.id);
  products.sort(
    (a, b) => displayOrder.indexOf(a.id) - displayOrder.indexOf(b.id),
  );
  const subtotal = totalCents / 100;
  const comparisonTotal =
    products.reduce(
      (total, item) => total + Math.round(item.referencePrice * 100),
      0,
    ) / 100;
  const savings = Math.round((comparisonTotal - subtotal) * 100) / 100;
  if (omitted.length)
    limitations.push(
      `O orçamento reduziu a seleção. ${omitted.join(" e ")} ficou${omitted.length === 1 ? "" : "ram"} fora; a rotina apresentada pode estar incompleta.`,
    );

  let explanation;
  if (!candidates.length)
    explanation =
      "Você declarou já usar as categorias desta proposta. Nenhum item repetido foi acrescentado; confira seus produtos atuais antes de decidir por mudanças.";
  else if (!products.length)
    explanation = `O teto de ${formatMoney(budget.value)} não comporta o primeiro item desta proposta. Nenhum produto foi incluído. Você pode revisar o limite ou consultar o catálogo.`;
  else
    explanation = `${explore ? "Você escolheu explorar possibilidades" : "A proposta começa por poucos passos"}${existing.size ? ", preservando as categorias que você já usa" : ""}. ${products.length} ${products.length === 1 ? "item foi selecionado" : "itens foram selecionados"} por ${formatMoney(subtotal)} em preços demonstrativos.${budget.value === null ? " O orçamento ainda não tem teto definido." : ` O total respeita o teto de ${formatMoney(budget.value)}.`}`;

  return {
    products,
    subtotal,
    comparisonTotal,
    savings,
    withinBudget: subtotal <= (budget.value ?? Infinity),
    budgetValue: budget.value,
    explanation,
    limitations,
  };
}

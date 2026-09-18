import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, DEFAULT_CONTEXT, buildRoutine, formatMoney, isMedicalRequest, validatePhoto } from '../src/routine.js';

const ids = (result) => result.products.map((item) => item.id);

test('minimal and explore have different, explicit demonstrative contents', () => {
  const minimal = buildRoutine({ approach: 'Poucos passos', budget: 'Até R$ 150' });
  const explore = buildRoutine({ approach: 'Quero explorar possibilidades', budget: 'Até R$ 250' });
  assert.deepEqual(ids(minimal), ['cleanse', 'comfort']);
  assert.equal(minimal.subtotal, 118);
  assert.deepEqual(ids(explore), ['cleanse', 'balance', 'comfort']);
  assert.equal(explore.subtotal, 197);
  assert.equal(explore.comparisonTotal, 247);
  assert.equal(explore.savings, 50);
  assert.match(explore.limitations.join(' '), /preços fictícios.*economia são simuladas/);
  assert.ok(explore.products.every((product) => product.reason && product.source.status === 'concept'));
});

test('an explicit minimal approach wins over exploration in the original intent', () => {
  assert.deepEqual(ids(buildRoutine({ intent: 'Quero explorar a linha', approach: 'Poucos passos' })), ['cleanse', 'comfort']);
});

test('budget reduces optional steps and never silently exceeds the cap', () => {
  for (const budget of [0, 30, 48.99, 49, 69, 100, 117.99, 118, 150, 196.99, 197]) {
    const result = buildRoutine({ approach: 'Explorar', budget });
    assert.ok(result.subtotal <= budget, `budget ${budget}, total ${result.subtotal}`);
    assert.equal(result.withinBudget, true);
    assert.equal(result.subtotal, result.products.reduce((sum, item) => sum + item.price, 0));
    if (result.products.length < 3) assert.match(result.limitations.join(' '), /orçamento reduziu/);
  }
  assert.deepEqual(ids(buildRoutine({ approach: 'Explorar', budget: 150 })), ['cleanse', 'comfort']);
  assert.deepEqual(ids(buildRoutine({ approach: 'Explorar', budget: 0 })), []);
});

test('known products are preserved by omitting duplicate categories', () => {
  const result = buildRoutine({ approach: 'Explorar', existing: 'Já uso sabonete e hidratante', budget: 100 });
  assert.deepEqual(ids(result), ['balance']);
  assert.equal(result.subtotal, 79);
  assert.match(result.limitations.join(' '), /não valida os produtos atuais/);
  assert.deepEqual(ids(buildRoutine({ existing: ['Cleanse', 'Comfort'], budget: 0 })), []);
  assert.match(buildRoutine({ existing: 'Cleanse e Comfort' }).explanation, /Nenhum item repetido/);
  assert.deepEqual(ids(buildRoutine({ approach: 'Ajustar o que já uso', existing: 'Já uso limpeza', budget: 150 })), ['comfort']);
  assert.deepEqual(ids(buildRoutine({ approach: 'Ajustar o que já uso', existing: 'Já uso limpeza e hidratação', budget: 150 })), []);
  assert.deepEqual(ids(buildRoutine({ existing: 'Nenhum produto' })), ['cleanse', 'comfort']);
});

test('negative existing-product statements do not count as products in use', () => {
  assert.deepEqual(ids(buildRoutine({ existing: 'Não uso sabonete. Uso hidratante.' })), ['cleanse']);
  assert.deepEqual(ids(buildRoutine({ existing: 'Sem limpador, uso hidratante sem perfume' })), ['cleanse']);
  assert.deepEqual(ids(buildRoutine({ existing: 'Nenhum' })), ['cleanse', 'comfort']);
  assert.deepEqual(ids(buildRoutine({ existing: 'Uso protetor solar' })), ['cleanse', 'comfort']);
});

test('hydration priority cannot be replaced with an unrelated cheaper add-on', () => {
  assert.deepEqual(ids(buildRoutine({ goal: 'Hidratação', budget: 70 })), ['comfort']);
  assert.deepEqual(ids(buildRoutine({ goal: 'Hidratação', budget: 60 })), []);
  assert.match(buildRoutine({ goal: 'Hidratação', budget: 60 }).explanation, /não comporta o primeiro item/);
});

test('display order follows the routine after hydration budget selection', () => {
  const full = buildRoutine({ goal: 'hidratação', approach: 'Explorar possibilidades', budget: 250 });
  assert.deepEqual(ids(full), ['cleanse', 'balance', 'comfort']);
  assert.equal(full.subtotal, 197);
  assert.equal(full.comparisonTotal, 247);
  assert.equal(full.savings, 50);
  const minimal = buildRoutine({ goal: 'hidratação', approach: 'Poucos passos', budget: 150 });
  assert.deepEqual(ids(minimal), ['cleanse', 'comfort']);
  assert.equal(minimal.subtotal, 118);
  const limited = buildRoutine({ goal: 'hidratação', approach: 'Explorar possibilidades', budget: 69 });
  assert.deepEqual(ids(limited), ['comfort']);
  assert.equal(limited.subtotal, 69);
});

test('Brazilian budget values, currency labels and decimal amounts parse consistently', () => {
  for (const [budget, expected] of [['Até R$ 150', 150], ['R$ 150,50', 150.5], ['1.500,00', 1500], ['150.50', 150.5], ['150 reais', 150], [150, 150]]) {
    assert.equal(buildRoutine({ budget }).budgetValue, expected);
  }
});

test('malformed budgets fail closed instead of being treated as unlimited', () => {
  for (const budget of ['R$ -50', '-10', 'abc150', '150 a 250', '1,500.00', '15,,0', '150,999', {}, true, Infinity, NaN, 10.555]) {
    const result = buildRoutine({ budget });
    assert.deepEqual(result.products, []);
    assert.equal(result.withinBudget, false);
    assert.equal(result.budgetValue, null);
    assert.match(result.explanation, /entender o orçamento/);
  }
});

test('undecided budget is explicit and still shows the full demo total', () => {
  for (const budget of ['', undefined, null, 'Prefiro decidir depois']) {
    const result = buildRoutine({ budget });
    assert.equal(result.budgetValue, null);
    assert.equal(result.withinBudget, true);
    assert.equal(result.subtotal, 118);
    assert.match(result.limitations.join(' '), /não definiu um teto/);
  }
});

test('sensitivity remains a limitation and never produces clinical-suitability claims', () => {
  const result = buildRoutine({ sensitivity: 'Tenho sensibilidade ou restrições', budget: 150 });
  assert.equal(result.products.length, 2);
  assert.match(result.limitations.join(' '), /não permite concluir tolerância ou adequação/);
  assert.ok(result.products.every((product) => !/ideal para pele sensível|hipoalergênico|clinicamente testado/i.test(product.reason)));
});

test('declared absence of known restrictions does not become a sensitivity claim', () => {
  const result = buildRoutine({ sensitivity: 'Nenhuma restrição conhecida', budget: 150 });
  assert.ok(!result.limitations.some((text) => /sensibilidade informada/.test(text)));
  assert.match(result.limitations.join(' '), /não avalia adequação, segurança ou eficácia/);
  assert.deepEqual(ids(result), ['cleanse', 'comfort']);
});

test('goals explain the declared preference without inventing efficacy', () => {
  const oily = buildRoutine({ goal: 'oleosidade', budget: 150 });
  assert.ok(oily.products.every((product) => /interesse em oleosidade/.test(product.reason)));
  assert.ok(oily.products.every((product) => /não comprova controle de oleosidade/.test(product.reason)));
  assert.match(buildRoutine({ goal: 'conhecer' }).products[0].reason, /conhecer as opções/);
  assert.match(buildRoutine({ goal: 'hidratação' }).products.find((product) => product.id === 'comfort').reason, /ganha prioridade/);
});

test('medical routing catches explicit diagnosis, disease treatment and medication asks', () => {
  for (const text of ['Diagnostique minha pele', 'Qual é o diagnóstico?', 'Quero tratamento para rosácea', 'Como tratar acne?', 'Essa pinta pode ser melanoma?', 'Me diga se tenho dermatite', 'Qual medicamento devo usar?', 'Prescreva um remédio']) {
    assert.equal(isMedicalRequest(text), true, text);
    const result = buildRoutine({ intent: text, budget: 150 });
    assert.deepEqual(result.products, []);
    assert.match(result.explanation, /não responde a pedidos de diagnóstico ou tratamento/);
  }
});

test('ordinary skincare goals and explicit diagnostic disclaimers are not medical asks', () => {
  for (const text of ['Tenho pele seca', 'Quero uma rotina para pele oleosa', 'Minha pele é sensível', 'Quero hidratação', 'Tenho acne e quero uma rotina simples', 'Sem diagnóstico, só uma rotina simples', 'Não quero diagnóstico', 'Não quero tratar acne, só entender os produtos', 'Uso um medicamento e hidratante', 'Fui diagnosticada com acne e quero entender uma rotina simples', 'Meu médico prescreveu um medicamento']) {
    assert.equal(isMedicalRequest(text), false, text);
  }
});

test('photo validation is optional and validates metadata, not photo quality', () => {
  assert.equal(validatePhoto(null), '');
  assert.equal(validatePhoto(undefined), '');
  assert.equal(validatePhoto({ type: 'image/jpeg', size: 1024, name: 'foto.jpg' }), '');
  assert.equal(validatePhoto({ type: 'image/png', size: 10 * 1024 * 1024, name: 'foto.PNG' }), '');
  assert.equal(validatePhoto({ type: 'image/webp', size: 50, name: 'foto.webp' }), '');
  for (const file of [{ type: 'image/svg+xml', size: 100 }, { type: 'image/jpeg', size: 0 }, { type: 'image/jpeg', size: Infinity }, { type: 'image/jpeg', size: 10 * 1024 * 1024 + 1 }, { type: 'image/png', size: 10, name: 'arquivo.svg' }]) assert.ok(validatePhoto(file));
});

test('calls preserve input, defaults and the catalog across local edits', () => {
  const context = { intent: 'Poucos passos', existing: 'Uso sabonete', budget: 150 };
  const original = structuredClone(context);
  const result = buildRoutine(context);
  result.products[0].source.title = 'Changed in the view';
  assert.deepEqual(context, original);
  assert.equal(DEFAULT_CONTEXT.budget, '');
  assert.match(CATALOG.find((product) => product.id === 'comfort').source.title, /SkinBoost/);
  assert.deepEqual(ids(buildRoutine({ ...context, budget: 60 })), []);
  assert.deepEqual(ids(buildRoutine(context)), ['comfort']);
});

test('currency rendering handles invalid values without showing NaN as a price', () => {
  assert.match(formatMoney(49), /R\$\s*49,00/);
  assert.equal(formatMoney(NaN), '—');
  assert.equal(formatMoney(undefined), '—');
});

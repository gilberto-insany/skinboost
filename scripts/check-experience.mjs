/** Run against the local app: node scripts/check-experience.mjs --base=http://127.0.0.1:4173
 * Optional --only=flow,uploads,zero,draft,keyboard,routing --viewport=desktop|mobile.
 * Synthetic fixtures only. Screenshots and reports stay in ignored qa/.
 */
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = name => process.argv.find(x => x.startsWith(`--${name}=`))?.slice(name.length + 3);
const baseURL = arg('base') || process.env.SKINBOOST_QA_URL || 'http://127.0.0.1:4173';
const only = arg('only')?.split(',');
const output = path.join(root, 'qa', 'experience');
await mkdir(output, { recursive: true });
const report = { baseURL, startedAt: new Date().toISOString(), cases: [], checks: [], errors: [], externalWrites: [], screenshots: [] };
const launchOptions = { headless: true };
if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
else if (!existsSync(chromium.executablePath()) && existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')) launchOptions.channel = 'chrome';
const browser = await chromium.launch(launchOptions);
const viewports = { desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+VhA0AAAAASUVORK5CYII=', 'base64');
const intent = 'Quero entender uma rotina de hidratação com passos que caibam no meu dia.';
let page, viewport;
function check(name, condition, details = {}) {
  const entry = { viewport, name, passed: !!condition, ...details };
  report.checks.push(entry);
  if (!condition) console.log(`FAIL [${viewport}] ${name}`, JSON.stringify(details));
  return !!condition;
}
async function screenshot(name) {
  const file = `${viewport}-${name}.png`;
  await page.screenshot({ path: path.join(output, file), fullPage: false });
  report.screenshots.push(file);
}
async function inspectLayout(stage) {
  const result = await page.locator('.sb-experience').evaluate(el => {
    const shell = el.closest('.composer-shell') || el;
    const main = el.querySelector('.sx-main');
    const rect = shell.getBoundingClientRect();
    const outside = [...el.querySelectorAll('button,input,textarea,select')].filter(n => {
      const s = getComputedStyle(n), r = n.getBoundingClientRect();
      return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && (r.left < rect.left - 2 || r.right > rect.right + 2);
    }).map(n => ({ label: n.getAttribute('aria-label') || n.textContent.trim() || n.getAttribute('name'), width: n.getBoundingClientRect().width }));
    return { experienceOverflow: el.scrollWidth > el.clientWidth + 2, mainOverflow: !!main && main.scrollWidth > main.clientWidth + 2, shellOverflow: shell.scrollWidth > shell.clientWidth + 2, outside, pageOverflow: document.documentElement.scrollWidth > innerWidth + 2 };
  });
  check(`${stage}: no horizontal overflow`, !result.experienceOverflow && !result.mainOverflow && !result.shellOverflow && !result.outside.length, result);
}
const main = () => page.locator('.sb-experience .sx-main');
const action = (name, scope = main()) => scope.locator(`[data-action="${name}"]`).first();
async function openWelcome() {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.locator('#skin-prompt').fill(intent);
  await page.locator('#prompt-form button[type="submit"]').click();
  await page.locator('.composer-shell').waitFor({ state: 'visible' });
  await page.waitForURL(url => url.pathname === '/chat');
  if (!await page.locator('#sx-intent').count()) {
    if (await action('back-question').count()) await action('back-question').click();
    else if (await action('edit-intent').count()) await action('edit-intent').click();
  }
  await page.locator('#sx-intent').waitFor();
}
async function startIntent(text = intent) {
  await openWelcome();
  await page.locator('#sx-intent').fill(text);
  await main().locator('[data-form="intent"] button[type="submit"]').click();
}
async function selectAnswer(value) {
  await main().locator(`input[name="answer"][value=${JSON.stringify(value)}]`).check();
}
async function nextQuestion() {
  await main().locator('[data-form="question"] button[type="submit"]').click();
}
async function completeQuestions({ budget = 'Até R$ 250', customBudget, back = false } = {}) {
  const values = ['hidratação', 'Explorar possibilidades', 'Nenhum produto', 'Não sei'];
  for (let i = 0; i < values.length; i++) {
    await selectAnswer(values[i]);
    await nextQuestion();
    if (back && i === 1) {
      await action('back-question').click();
      check('Voltar preserves submitted approach', await main().locator('input[name="answer"][value="Explorar possibilidades"]').isChecked());
      await nextQuestion();
    }
  }
  if (customBudget !== undefined) await main().locator('#sx-custom').fill(customBudget);
  else await selectAnswer(budget);
  await nextQuestion();
  await action('generate').waitFor();
}
async function generateRoutine() {
  await action('generate').click();
  await main().locator('.sx-cost').waitFor();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const heading = await main().locator('h2').boundingBox();
  check('New routine starts with its heading in view', !!heading && heading.y >= 0 && heading.y < viewports[viewport].height - 30, { heading });
}
async function runCase(name, fn) {
  if (only && !only.includes(name)) return;
  const before = report.checks.length;
  try {
    await fn();
    report.cases.push({ viewport, name, completed: true, checks: report.checks.length - before });
  } catch (error) {
    report.cases.push({ viewport, name, completed: false, error: error.message });
    check(`${name}: journey completed`, false, { error: error.message });
    await screenshot(`${name}-failure`).catch(() => {});
  }
}

for (const [name, size] of Object.entries(viewports)) {
  if (arg('viewport') && arg('viewport') !== name) continue;
  viewport = name;
  const context = await browser.newContext({ viewport: size, reducedMotion: 'reduce' });
  page = await context.newPage();
  page.setDefaultTimeout(6500);
  page.on('pageerror', error => report.errors.push({ viewport: name, message: error.message }));
  page.on('request', request => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) report.externalWrites.push({ viewport: name, method: request.method(), origin: new URL(request.url()).origin, path: new URL(request.url()).pathname });
  });
  await runCase('flow', async () => {
    await startIntent();
    check('First clarification opens from real hero prompt', await main().locator('[data-form="question"]').isVisible());
    await inspectLayout('question'); await screenshot('01-question');
    await completeQuestions({ back: true });
    check('Review preserves original request', (await main().innerText()).includes(intent));
    check('Five answers are reviewable', await main().locator('.sx-review-context dl > div').count() === 5);
    await inspectLayout('review'); await screenshot('02-review');
    await generateRoutine();
    const productCount = await main().locator('.sx-product').count();
    check('Exploring with250 yields3 conceptual items', productCount === 3, { productCount });
    const total = await main().locator('.sx-cost strong').innerText();
    check('Routine total is197.00', /197,00/.test(total), { total });
    await inspectLayout('routine'); await screenshot('03-routine');
    await action('source').click();
    check('Source exposes uncertainty and provenance', /O que ainda falta/.test(await main().innerText()) && /Não é um estudo clínico/.test(await main().innerText()));
    await inspectLayout('source'); await screenshot('04-source');
    await action('routine').click();
    await action('comparison').click();
    check('Comparison labels fictional prices', /fictício/.test(await main().locator('table').innerText()));
    check('Comparison difference is50.00', /50,00/.test(await main().locator('.sx-saving strong').innerText()));
    await inspectLayout('comparison'); await screenshot('05-comparison');
    await action('cart').click();
    const boxes = main().locator('[data-cart-item]');
    check('Cart contains3 reviewable items', await boxes.count() === 3);
    for (let i=0; i<await boxes.count(); i++) await boxes.nth(i).uncheck();
    check('Empty cart disables checkout', await action('checkout').isDisabled());
    await main().locator('[data-cart-item][value="comfort"]').check();
    const selectedTotal = await main().locator('[data-cart-total]').innerText();
    check('Cart total recalculates toComfort69', /69,00/.test(selectedTotal), { selectedTotal });
    await inspectLayout('cart'); await screenshot('06-cart');
    await action('checkout').click();
    check('Checkout is explicitly demonstrative', /sem pagamento|sem pagamento/i.test(await main().innerText()) && !await main().locator('input').count());
    check('Checkout preserves selected1item', /1 produto na seleção/.test(await main().innerText()));
    await inspectLayout('checkout'); await screenshot('07-checkout');
    await action('cart').click();
    check('Back from checkout preserves cart selection', await main().locator('[data-cart-item]:checked').count() === 1);
    await action('checkout').click(); await action('finish').click();
    await action('checkin').click();
    await main().locator('[data-form="checkin"] button[type="submit"]').click();
    check('Check-in requires explicit response', await main().locator('[role="alert"]').isVisible());
    await main().locator('input[name="status"][value="Consegui manter"]').check();
    await main().locator('#sx-note').fill('Exemplo de QA: poucos passos facilitaram a rotina.');
    await inspectLayout('checkin'); await screenshot('08-checkin');
    await main().locator('[data-form="checkin"] button[type="submit"]').click();
    check('Saved check-in stays associated with routine', (await main().locator('.sx-checkin-saved').innerText()).includes('Exemplo de QA'));
    await screenshot('09-saved');
  });
  await runCase('uploads', async () => {
    await openWelcome();
    const draft = 'Rascunho de QA antes de anexar uma foto.';
    await page.locator('#sx-intent').fill(draft);
    await main().locator('[data-photo]').setInputFiles({ name: 'arquivo.txt', mimeType: 'text/plain', buffer: Buffer.from('synthetic fixture') });
    check('Unsupported upload is rejected', /JPG, PNG ou WebP/.test(await main().locator('[role="alert"]').innerText()));
    check('Invalid upload preserves draft', await page.locator('#sx-intent').inputValue() === draft);
    await page.locator('#sx-intent').fill(draft);
    await main().locator('[data-photo]').setInputFiles({ name: 'qa-pixel.png', mimeType: 'image/png', buffer: png });
    check('Valid image exposes filename', (await page.locator('.sb-experience').innerText()).includes('qa-pixel.png'));
    check('Valid upload preserves draft', await page.locator('#sx-intent').inputValue() === draft);
    check('Successful upload clears stale validation error', await main().locator('[role="alert"]').count() === 0);
    await screenshot('upload-valid');
    await page.locator('.sb-experience [data-action="remove-photo"]:visible').first().click();
    check('Removing photo clears filename', !(await page.locator('.sb-experience').innerText()).includes('qa-pixel.png'));
    check('Removing photo preserves draft', await page.locator('#sx-intent').inputValue() === draft);
    await inspectLayout('upload'); await screenshot('upload-removed');
  });
  await runCase('zero', async () => {
    await startIntent(); await completeQuestions({ customBudget: '0' }); await generateRoutine();
    check('Zero budget creates no paid product', await main().locator('.sx-product').count() === 0);
    check('Zero budget has total0.00', /0,00/.test(await main().locator('.sx-cost strong').innerText()));
    check('Zero budget offers no checkout/cart CTA', await action('cart').count() === 0 && await action('checkout').count() === 0);
    check('Zero budget explains why nothing is selected', /não comporta|Nenhum produto foi incluído/.test(await main().innerText()));
    await inspectLayout('zero-budget'); await screenshot('zero-budget');
    await main().locator('[data-action="edit-field"][data-key="budget"]').click();
    check('Custom zero remains editable', await main().locator('#sx-custom').inputValue() === '0');
    await selectAnswer('Até R$ 150'); await nextQuestion();
    const reviewText = await main().locator('.sx-review-context').innerText();
    check('Choosing preset replaces previous custom budget', /Até R\$ 150/.test(reviewText), { reviewText });
    await generateRoutine();
    check('Updated150 budget generates2items', await main().locator('.sx-product').count() === 2);
    await screenshot('budget-updated');
  });
  await runCase('draft', async () => {
    await startIntent();
    await selectAnswer('hidratação'); await nextQuestion();
    await selectAnswer('Poucos passos'); await nextQuestion();
    const custom = 'Uso um limpador à noite.';
    await main().locator('#sx-custom').fill(custom);
    await action('back-question').click(); await nextQuestion();
    check('Unsubmitted custom draft survives back and return', await main().locator('#sx-custom').inputValue() === custom);
    await main().locator('#sx-custom').fill(custom); await nextQuestion();
    await selectAnswer('Não sei'); await nextQuestion();
    await main().locator('#sx-custom').fill('abc'); await nextQuestion();
    check('Invalid budget stays actionable with error', await main().locator('[role="alert"]').isVisible());
    check('Invalid budget preserves typed value for correction', await main().locator('#sx-custom').inputValue() === 'abc');
    await screenshot('budget-validation');
  });
  await runCase('keyboard', async () => {
    await openWelcome();
    const shell = page.locator('.composer-shell');
    check('Chat route has accessible landmark name', !!await shell.getAttribute('aria-label'));
    check('Dedicated chat route has useful page title', /conversa.*SkinBoost/i.test(await page.title()));
    check('Data controls are reachable at this viewport', await page.locator('.sb-experience [data-action="privacy"]:visible').count() > 0);
    const resumeDraft = 'Rascunho para continuar depois de fechar.';
    await page.locator('#sx-intent').fill(resumeDraft);
    for (let i=0;i<15;i++) await page.keyboard.press('Tab');
    check('Hidden landing cannot receive keyboard focus', await shell.evaluate(e=>e.contains(document.activeElement)));
    await page.keyboard.press('Escape');
    await page.waitForURL(url=>url.pathname !== '/chat');
    check('Escape returns to site and hides chat', !await shell.isVisible());
    check('Closing restores useful page focus', await page.evaluate(()=>document.activeElement !== document.body));
    await page.locator('#resume-experience').click();
    await page.waitForURL(url=>url.pathname === '/chat');
    check('Reopening preserves latest typed draft', await page.locator('#sx-intent').inputValue() === resumeDraft);
    const privacy = page.locator('.sb-experience [data-action="privacy"]:visible').first();
    if(await privacy.count()) { await privacy.click(); await action('reset').click(); check('Reset clears current text and photo', await page.locator('#sx-intent').inputValue() === '' && !await page.locator('.sb-experience [data-action="remove-photo"]:visible').count()); }
  });
  await runCase('routing', async () => {
    await startIntent();
    await selectAnswer('hidratação'); await nextQuestion();
    await page.goBack();
    check('Browser Back returns to landing', new URL(page.url()).pathname === '/' && !await page.locator('.composer-shell').isVisible());
    await page.goForward();
    await page.locator('.composer-shell').waitFor({state:'visible'});
    check('Browser Forward restores current question', /Como o cuidado cabe/.test(await main().locator('h2').innerText()));
    await page.reload({waitUntil:'networkidle'});
    await page.locator('#sx-intent').waitFor();
    check('Reload on direct chat starts an empty ephemeral session', new URL(page.url()).pathname === '/chat' && await page.locator('#sx-intent').inputValue() === '');
    await page.keyboard.press('Escape');
    await page.waitForURL(url=>url.pathname === '/');
    check('Direct chat can return to site without browser history', await page.locator('#skin-prompt').isVisible());
    await screenshot('route-back-to-landing');
  });
  await context.close();
}
await browser.close();
report.finishedAt = new Date().toISOString();
report.summary = { passed: report.checks.filter(c=>c.passed).length, failed: report.checks.filter(c=>!c.passed).length, runtimeErrors: report.errors.length, writeRequests: report.externalWrites.length };
await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
const lines=['# SkinBoost experience QA',`\nRun: ${report.startedAt}`,`\nURL: ${baseURL}`,`\nPassed: ${report.summary.passed}; failed: ${report.summary.failed}; runtime errors: ${report.summary.runtimeErrors}; non-read requests: ${report.summary.writeRequests}.`,'\n## Failed checks',...report.checks.filter(c=>!c.passed).map(c=>`- **${c.viewport}: ${c.name}** — ${JSON.stringify(c)}`),'\n## Runtime errors',...report.errors.map(e=>`- ${e.viewport}: ${e.message}`),'\n## Executed journeys',...report.cases.map(c=>`- ${c.viewport} / ${c.name}: ${c.completed?'completed':c.error}`),'\nScreenshots are in this same ignored directory.'];
await writeFile(path.join(output,'report.md'),lines.join('\n'));
console.log(JSON.stringify(report.summary,null,2));
if(report.summary.failed || report.summary.runtimeErrors || report.summary.writeRequests)process.exitCode=1;

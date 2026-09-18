import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { before, after, test } from 'node:test';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'dist/client');
const artifacts = resolve(root, 'qa/storybook');
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.webp':'image/webp', '.woff2':'font/woff2', '.woff':'font/woff', '.ico':'image/x-icon' };
let server, browser, origin;

before(async () => {
  assert.ok(existsSync(resolve(output, 'storybook/wireframe/index.html')), 'Run npm run build:review first.');
  await mkdir(artifacts, { recursive: true });
  server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let file = resolve(output, `.${pathname}`);
      if (file !== output && !file.startsWith(output + sep)) throw new Error('Outside build');
      if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.STORYBOOK_CHROME || (existsSync(localChrome) ? localChrome : undefined),
  });
});

after(async () => {
  await browser?.close();
  await new Promise(resolve => server ? server.close(resolve) : resolve());
});

test('two independent builds expose the same CSF3 inventory', async () => {
  const [wireframe, hifi] = await Promise.all(['wireframe', 'alta-fidelidade'].map(async name => {
    const response = await fetch(`${origin}/storybook/${name}/index.json`);
    assert.equal(response.status, 200);
    const data = await response.json();
    return Object.keys(data.entries).sort();
  }));
  assert.deepEqual(hifi, wireframe);
  for (const name of ['boas-vindas', 'contexto', 'rotina', 'carrinho', 'checkout', 'checkin']) {
    assert.ok(wireframe.includes(`experiencia-jornada-guiada--${name}`), `Missing ${name}`);
  }
});

test('the manager opens foundation stories and proposed typography stays isolated', { timeout: 60000 }, async () => {
  for (const mode of ['wireframe', 'alta-fidelidade']) {
    const page = await browser.newPage({ viewport: { width: 1480, height: 1050 } });
    for (const id of ['paleta', 'tipografia', 'botoes']) {
      await page.goto(`${origin}/storybook/${mode}/?path=/story/fundamentos-identidade--${id}`, { waitUntil: 'networkidle' });
      const frame = page.frameLocator('#storybook-preview-iframe');
      await frame.locator('.sb-foundation').waitFor();
      if (id === 'tipografia') {
        const family = await frame.locator('.sb-catalog').evaluate(el => getComputedStyle(el).fontFamily);
        assert.match(family, mode === 'wireframe' ? /^Arial/ : /Avenir Next/);
      }
      if (id === 'botoes') assert.equal(await frame.getByRole('button', { name:'Aguardando resposta' }).isDisabled(), true);
    }
    await page.screenshot({ path: resolve(artifacts, `${mode}-manager.png`), fullPage:true });
    await page.close();
  }
});

test('real states work at deployed subpaths, with keyboard access, mobile layout and accessibility', { timeout: 120000 }, async () => {
  const report = [];
  for (const mode of ['wireframe', 'alta-fidelidade']) {
    const context = await browser.newContext({ viewport: { width: 1365, height: 1050 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const story = id => `${origin}/storybook/${mode}/iframe.html?id=experiencia-jornada-guiada--${id}&viewMode=story`;
    for (const id of ['boas-vindas', 'contexto', 'rotina', 'carrinho', 'checkout', 'checkin', 'contexto-sem-resposta', 'carrinho-vazio']) {
      await page.goto(story(id), { waitUntil: 'networkidle' });
      await page.locator('.sb-experience .sx-main').waitFor();
      await page.locator('.sb-experience #dialog-title').waitFor();
      if (id === 'contexto-sem-resposta') await page.getByRole('alert').waitFor();
      if (id === 'carrinho-vazio') await page.waitForFunction(() => document.querySelector('[data-action="checkout"]')?.disabled);
      const accessibility = await new AxeBuilder({ page }).include('.sb-catalog').analyze();
      const violations = accessibility.violations.map(v => ({ id:v.id, impact:v.impact, help:v.help, targets:v.nodes.map(n => n.target) }));
      const ink = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ink').trim());
      assert.equal(ink, mode === 'wireframe' ? '#202a24' : '#183e31');
      const label = await page.locator('.sb-catalog-status strong').innerText();
      assert.match(label, mode === 'wireframe' ? /implementada/ : /proposta em revisão/);
      await page.keyboard.press('Tab');
      const focusInside = await page.evaluate(() => Boolean(document.activeElement.closest('.sb-experience')));
      await page.setViewportSize({ width: 390, height: 844 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (['boas-vindas', 'rotina'].includes(id)) await page.screenshot({ path: resolve(artifacts, `${mode}-${id}-mobile.png`), fullPage: true });
      await page.setViewportSize({ width: 1365, height: 1050 });
      report.push({ mode, story:id, violations, focusInside, mobileOverflow:overflow });
    }
    // A new story instance must not inherit the previous canvas selection.
    await page.goto(story('carrinho'), { waitUntil: 'networkidle' });
    assert.ok(await page.locator('[data-cart-item]:checked').count() > 0);
    assert.deepEqual(errors, [], `${mode}: runtime errors`);
    await context.close();
  }
  await writeFile(resolve(artifacts, 'review.json'), JSON.stringify(report, null, 2));
  const failures = report.filter(row => row.violations.length || !row.focusInside || row.mobileOverflow);
  assert.deepEqual(failures, [], 'Inspect qa/storybook/review.json for accessibility/layout findings.');
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  buildTokenFiles,
  loadTokenSource,
} from "../scripts/build-design-tokens.mjs";

const root = resolve(import.meta.dirname, "..");

test("named aliases preserve semantic colors when primitives are reordered", async () => {
  const source = await loadTokenSource();
  const expected = buildTokenFiles(source).files["semantic-colors.css"];
  source.collections["_Colors Primitives"].variables.reverse();
  assert.equal(buildTokenFiles(source).files["semantic-colors.css"], expected);
});

test("new export aliases and missing primitives require review", async () => {
  const source = await loadTokenSource();
  source.collections["1 · Semantic Colors"].variables[0].values.Light =
    "{VariableID:changed}";
  assert.throws(() => buildTokenFiles(source), /Unverified semantic alias/);
  const missing = await loadTokenSource();
  missing.collections["_Colors Primitives"].variables[0].name = "renamed";
  assert.throws(() => buildTokenFiles(missing), /Missing or invalid primitive/);
});

test("the Figma export compiles every collection and resolves semantic aliases", async () => {
  const source = await loadTokenSource();
  const { files, report } = buildTokenFiles(source);

  assert.equal(report.totalVariables, 215);
  assert.equal(report.primitiveColors, 90);
  assert.equal(report.semanticColors, 65);
  assert.equal(report.resolvedAliasCount, 130);
  assert.equal(report.dimensionTokens, 60);
  assert.equal(report.aliasVerification, "screenshots");
  assert.match(files["semantic-colors.css"], /\[data-theme="dark"\]/);
  assert.match(files["semantic-colors.css"], /--color-neutral-maximum:/);
});

test("generated dimensions are safe CSS values", async () => {
  const source = await loadTokenSource();
  const { files } = buildTokenFiles(source);
  const dimensions = files["dimensions.css"];

  assert.match(dimensions, /--space-24: 24px;/);
  assert.match(dimensions, /--radius-full: 999px;/);
  assert.match(dimensions, /--border-md: 1\.5px;/);
  assert.match(dimensions, /--opacity-op-50: 0\.5;/);
  assert.match(dimensions, /--font-size-heading-h1: 48px;/);
  assert.match(dimensions, /--font-tracking-tight: -0\.5px;/);
  assert.match(
    dimensions,
    /--font-family-sans: "Manrope Variable", Arial, sans-serif;/,
  );
});

test("checked-in generated token files are current", async () => {
  const source = await loadTokenSource();
  const { files } = buildTokenFiles(source);

  for (const [name, expected] of Object.entries(files)) {
    const actual = await readFile(
      resolve(root, "src/tokens/generated", name),
      "utf8",
    );
    assert.equal(actual, expected, `${name} must be regenerated`);
  }
});

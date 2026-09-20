#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
for (const script of ['build', 'build:storybook:wireframe', 'build:storybook:hifi']) {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', script], {
    cwd: root, stdio: 'inherit', env: { ...process.env, STORYBOOK_DISABLE_TELEMETRY: '1' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
for (const output of [
  'dist/client/index.html', 'dist/client/wireframe/index.html', 'dist/client/brandbook.html',
  'dist/client/storybook/wireframe/index.html', 'dist/client/storybook/wireframe/iframe.html',
  'dist/client/storybook/alta-fidelidade/index.html', 'dist/client/storybook/alta-fidelidade/iframe.html',
  'dist/server/index.js', 'dist/.openai/hosting.json',
]) accessSync(resolve(root, output), constants.R_OK);
console.log('Review build ready: app + brandbook + two independent Storybooks.');

#!/usr/bin/env node
/* Сборка единого файла лаборатории: src/app.dev.html + src/engine.js -> dist/lab.html */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const appPath = path.join(root, 'src/app.dev.html');
const engPath = path.join(root, 'src/engine.js');
const outDir = path.join(root, 'dist');
const outPath = path.join(outDir, 'lab.html');

let out = fs.readFileSync(appPath, 'utf8');
for (const [marker, file] of [
  ['/*__ENGINE__*/', 'src/engine.js'],
  ['/*__RENEW__*/', 'src/renewables.js'],
  ['/*__RENEW_UI__*/', 'src/renew.ui.js'],
  ['/*__STORAGE__*/', 'src/storage.js'],
  ['/*__STORAGE_UI__*/', 'src/storage.ui.js'],
  ['/*__EFFICIENCY__*/', 'src/efficiency.js'],
  ['/*__EFFICIENCY_UI__*/', 'src/efficiency.ui.js'],
]) {
  if (!out.includes(marker)) {
    console.error(`Нет метки ${marker} в src/app.dev.html`);
    process.exit(1);
  }
  out = out.replace(marker, fs.readFileSync(path.join(root, file), 'utf8'));
}
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, out);
console.log(`${path.relative(root, outPath)} — ${(Buffer.byteLength(out) / 1024).toFixed(0)} КБ`);

#!/usr/bin/env node
/* Сборка единого файла лаборатории: src/app.dev.html + src/engine.js -> dist/lab.html */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const appPath = path.join(root, 'src/app.dev.html');
const engPath = path.join(root, 'src/engine.js');
const outDir = path.join(root, 'dist');
const outPath = path.join(outDir, 'lab.html');

const app = fs.readFileSync(appPath, 'utf8');
const eng = fs.readFileSync(engPath, 'utf8');
if (!app.includes('/*__ENGINE__*/')) {
  console.error('Нет метки /*__ENGINE__*/ в src/app.dev.html');
  process.exit(1);
}
const out = app.replace('/*__ENGINE__*/', eng);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, out);
console.log(`${path.relative(root, outPath)} — ${(Buffer.byteLength(out) / 1024).toFixed(0)} КБ`);

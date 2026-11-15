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
// внешние скрипты встраиваются в единый файл
out = out.replace(/<script src="([^"]+)"><\/script>/g, (m, file) => {
  const code = fs.readFileSync(path.join(root, 'src', path.basename(file)), 'utf8');
  return '<script>\n' + code.replace(/<\/script/gi, '<\\/script') + '\n</script>';
});
for (const [marker, file] of [
  ['/*__ENGINE__*/', 'src/engine.js'],
  ['/*__RENEW__*/', 'src/renewables.js'],
  ['/*__RENEW_UI__*/', 'src/renew.ui.js'],
  ['/*__STORAGE__*/', 'src/storage.js'],
  ['/*__STORAGE_UI__*/', 'src/storage.ui.js'],
  ['/*__EFFICIENCY__*/', 'src/efficiency.js'],
  ['/*__EFFICIENCY_UI__*/', 'src/efficiency.ui.js'],
  ['/*__HYDROGEN__*/', 'src/hydrogen.js'],
  ['/*__HYDROGEN_UI__*/', 'src/hydrogen.ui.js'],
  ['/*__GRID__*/', 'src/grid.js'],
  ['/*__GRID_UI__*/', 'src/grid.ui.js'],
]) {
  if (!out.includes(marker)) {
    console.error(`Нет метки ${marker} в src/app.dev.html`);
    process.exit(1);
  }
  out = out.replace(marker, fs.readFileSync(path.join(root, file), 'utf8'));
}
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, out);

// index.html в корне — это опубликованная версия (GitHub Pages и локальный server.js
// отдают именно её), поэтому обновляем её при каждой сборке: иначе правки в src/
// не доезжают до страницы, и в браузере остаётся старая сборка.
const indexFiles = [path.join(root, 'index.html')];
const parentIndex = path.join(path.dirname(root), 'virtuallab.html');
if (fs.existsSync(path.dirname(parentIndex)) && fs.existsSync(parentIndex)) indexFiles.push(parentIndex);
for (const f of indexFiles) {
  fs.writeFileSync(f, out);
  console.log(`${path.relative(root, f)} — ${(Buffer.byteLength(out) / 1024).toFixed(0)} КБ (обновлён)`);
}
console.log(`${path.relative(root, outPath)} — ${(Buffer.byteLength(out) / 1024).toFixed(0)} КБ`);

// Стенд внутри плагина Moodle (ветка moodle-plugin) — та же сборка, чтобы в курсе
// не оставалась старая версия лаборатории.
const pluginLab = path.join(root, 'moodle/mod/energy/standalone/lab.html');
if (fs.existsSync(path.dirname(pluginLab))) {
  fs.writeFileSync(pluginLab, out);
  console.log(`moodle/mod/energy/standalone/lab.html — ${(Buffer.byteLength(out) / 1024).toFixed(0)} КБ (обновлён)`);
}

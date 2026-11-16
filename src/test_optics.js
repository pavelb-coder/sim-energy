/* Проверки модели стенда «Свет и волны». Запуск: node src/test_optics.js */
'use strict';
const O = require('./optics.js');

let ok = 0, fail = 0;
function check(name, cond, info) {
  if (cond) { ok++; console.log('  OK   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (info === undefined ? '' : ' → ' + info)); }
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

console.log('Снелл и полное отражение');
{
  const s = O.snell(1, 1.333, 30);
  check('воздух → вода, 30° даёт 22,0°', near(s.angle, 22.03, 0.05), s.angle);
  check('преломлённый луч ближе к нормали', s.angle < 30);
  const ratio = Math.sin(30 * Math.PI / 180) / Math.sin(s.angle * Math.PI / 180);
  check('sin i / sin r = 1,333 (показатель воды)', near(ratio, 1.333, 0.002), ratio);
  check('из воздуха полного отражения нет', O.snell(1, 1.333, 80).tir === false);
  const crit = O.snell(1.333, 1, 10).critical;
  check('критический угол вода → воздух ≈ 48,6°', near(crit, 48.6, 0.2), crit);
  check('под критическим углом луч ещё выходит', O.snell(1.333, 1, 45).tir === false);
  check('выше критического — полное отражение', O.snell(1.333, 1, 50).tir === true);
  check('0° — луч не отклоняется', near(O.snell(1, 1.52, 0).angle, 0, 1e-9));
  check('скорость света в воде ≈ 225 Мм/с', near(O.mediumSpeed(1.333) / 1e6, 224.9, 1), O.mediumSpeed(1.333) / 1e6);
  check('длина волны 532 нм в стекле короче', O.wavelengthIn(532, 1.52) < 532);
  check('длина волны в воздухе не меняется', near(O.wavelengthIn(532, 1), 532, 0.01));
  const split = O.beamSplit(1, 1.52, 60);
  check('на границе часть энергии отражается', split.reflected > 0 && split.refracted < 1);
  check('отражение и пропускание дают 100 %', near(split.reflected + split.refracted, 1, 1e-9));
}

console.log('Смешение цветов и фильтры');
{
  check('красный + зелёный = жёлтый', O.mixColor(1, 1, 0).name === 'жёлтый');
  check('все три канала = белый', O.mixColor(1, 1, 1).name === 'белый');
  check('зелёный + синий = голубой', O.mixColor(0, 1, 1).name === 'голубой');
  check('красный + синий = пурпурный', O.mixColor(1, 0, 1).name === 'пурпурный');
  check('ничего не включено = темнота', O.mixColor(0, 0, 0).name === 'темнота');
  check('белый имеет hex #ffffff', O.mixColor(1, 1, 1).hex === '#ffffff');
  check('один канал = 1 канал', O.mixColor(0, 1, 0).channels === 1);
  const t = O.filterTransmit('red', 1, 1, 1);
  check('красный фильтр оставляет красный', t.r === 1 && t.g < 0.1 && t.b < 0.1);
  const dark = O.filterTransmit('red', 0, 1, 1);
  check('зелёный свет через красный фильтр не проходит', O.mixColor(dark.r, dark.g, dark.b).name === 'темнота');
  check('без фильтра свет не меняется', O.filterTransmit('none', 1, 0.5, 0.2).g === 0.5);
}

console.log('Поляризация (закон Малюса)');
{
  check('при 0° проходит всё', near(O.malus(1, 0), 1, 1e-9));
  check('при 45° проходит половина', near(O.malus(1, 45), 0.5, 1e-9), O.malus(1, 45).toFixed(3));
  check('при 90° не проходит ничего', near(O.malus(1, 90), 0, 1e-9));
  check('естественный свет через поляризатор — половина', near(O.naturalThrough(1), 0.5, 1e-9));
  check('два поляризатора под 90° гасят свет', near(O.malus(O.malus(1, 90), 0), 0, 1e-9));
  check('доля поляризации: естественный 0, полный 1', O.polarization('natural') === 0 && O.polarization('full') === 1);
}

console.log('Дифракционная решётка');
{
  const a532 = O.gratingAngles(300, 532, 1);
  check('300 штрихов, 532 нм, k=1 → ≈ 9,2°', near(a532, 9.18, 0.05), a532);
  const a700 = O.gratingAngles(300, 700, 1);
  check('700 нм отклоняется сильнее 410 нм', a700 > O.gratingAngles(300, 410, 1));
  check('второй порядок почти вдвое дальше', near(O.gratingAngles(300, 532, 2) / a532, 2.02, 0.1));
  check('при большем числе штрихов угол больше', O.gratingAngles(600, 532, 1) > a532);
  check('несуществующий порядок даёт null', O.gratingAngles(300, 700, 5) === null);
  check('пятно на экране 1 м для 700 нм ≈ 21 см', near(O.gratingSpot(300, 700, 1, 1), 0.215, 0.005));
  check('красное пятно дальше фиолетового', O.gratingSpot(300, 700, 1, 1) > O.gratingSpot(300, 410, 1, 1));
}

console.log('Интерференция (опыт Юнга)');
{
  check('разность хода λ = усиление', O.interference(532, 532).kind === 'усиление');
  check('разность хода λ/2 = гашение', O.interference(532, 266).kind === 'гашение');
  check('разность хода λ/4 = частично', O.interference(532, 133).kind === 'частично');
  check('амплитуда гашения ≈ 0', Math.abs(O.interference(532, 266).amp) < 1e-6);
}

console.log('Тонкая линза');
{
  const i = O.lensImage(30, 20);
  check('F=20, d=30 → f = 60 см', near(i.f, 60, 0.01), i.f);
  check('изображение действительное', i.real === true);
  check('увеличение 2 (перевёрнутое)', near(Math.abs(i.magnification), 2, 0.01));
  const m = O.lensImage(10, 20);
  check('d < F → изображение мнимое', m.real === false && m.f < 0);
  check('лупа даёт увеличение больше 1', Math.abs(m.magnification) > 1);
  check('d = 2F → увеличение 1', near(Math.abs(O.lensImage(40, 20).magnification), 1, 0.01));
}

console.log('Задания стенда');
{
  check('восемь заданий', O.TASKS.length === 8);
  O.TASKS.forEach(function (t, i) {
    check('задание ' + (i + 1) + ' имеет цель, шаги и три подсказки',
      !!t.t && !!t.goal && t.steps.length >= 2 && t.hints.length === 3 && typeof t.check === 'function' && typeof t.stars === 'function' && !!t.why);
  });
}

console.log('Задания выполнимы на данных модели');
{
  // 1. Снелл — три точки воздух → вода
  const lab1 = O.createLab();
  [10, 30, 60].forEach(function (a) {
    const s = O.snell(1, 1.333, a);
    lab1.measures.push({ kind: 'snell', inc: a, n1: 'air', n2: 'water', refr: s.angle, tir: s.tir, lambda: 532 });
  });
  check('задание 1 решается тремя точками', O.TASKS[0].check(O.facts(lab1)), O.facts(lab1).nMeasured);

  // 2. Полное отражение
  const lab2 = O.createLab();
  [30, 45, 55].forEach(function (a) {
    const s = O.snell(1.333, 1, a);
    lab2.measures.push({ kind: 'snell', inc: a, n1: 'water', n2: 'air', refr: s.angle, tir: s.tir, lambda: 532 });
  });
  check('задание 2 решается (есть полное отражение)', O.TASKS[1].check(O.facts(lab2)));

  // 3. Смешение
  const lab3 = O.createLab();
  lab3.measures.push({ kind: 'color', out: 'жёлтый', r: 1, g: 1, b: 0 });
  lab3.measures.push({ kind: 'color', out: 'белый', r: 1, g: 1, b: 1 });
  check('задание 3 решается (жёлтый и белый)', O.TASKS[2].check(O.facts(lab3)));

  // 4. Фильтры
  const lab4 = O.createLab();
  lab4.measures.push({ kind: 'color', out: 'белый', r: 1, g: 1, b: 1 });
  lab4.measures.push({ kind: 'color', out: 'красный', r: 1, g: 0, b: 0 });
  check('задание 4 решается (белый + красный)', O.TASKS[3].check(O.facts(lab4)));

  // 5. Решётка красный/фиолетовый
  const lab5 = O.createLab();
  [700, 410].forEach(function (l) {
    lab5.measures.push({ kind: 'grating', lines: 300, lambda: l, order: 1, angle: O.gratingAngles(300, l, 1) });
  });
  const f5 = O.facts(lab5);
  check('задание 5 решается (красный дальше фиолетового)', O.TASKS[4].check(f5), f5.redAngle + ' / ' + f5.blueAngle);

  // 6. Порядки
  const lab6 = O.createLab();
  [1, 2].forEach(function (k) {
    lab6.measures.push({ kind: 'grating', lines: 300, lambda: 532, order: k, angle: O.gratingAngles(300, 532, k) });
  });
  check('задание 6 решается (два порядка)', O.TASKS[5].check(O.facts(lab6)));

  // 7. Линза
  const lab7 = O.createLab();
  const li = O.lensImage(30, 20);
  lab7.measures.push({ kind: 'lens', d: 30, F: 20, f: li.f, mag: li.magnification, real: li.real });
  check('задание 7 решается (действительное, ×2)', O.TASKS[6].check(O.facts(lab7)));

  // 8. Дисперсия
  const lab8 = O.createLab();
  [[700, 1.513], [410, 1.532]].forEach(function (p) {
    const s = O.snell(p[1], 1, 40);
    lab8.measures.push({ kind: 'snell', inc: 40, n1: 'glass', n2: 'air', refr: s.angle, tir: s.tir, lambda: p[0] });
  });
  check('задание 8 решается (две длины волны)', O.TASKS[7].check(O.facts(lab8)));

  // задания не срабатывают на пустом стенде
  const empty = O.facts(O.createLab());
  const noneSolved = O.TASKS.every(function (t) { return !t.check(empty); });
  check('на пустом стенде ни одно задание не выполнено', noneSolved);
}

console.log('');
if (fail) { console.log('Провалено проверок: ' + fail + ' из ' + (ok + fail)); process.exit(1); }
console.log('Все проверки пройдены (' + ok + ').');

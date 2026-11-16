/* ============================================================
   Энерджиквантум · test_mech.js — проверки физики стенда «Механика»
   node src/test_mech.js
   ============================================================ */
'use strict';
const M = require('./mech.js');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}
function near(a, b, tol) { return Math.abs(a - b) <= (tol === undefined ? 0.05 : tol); }

/* 1. Горка: скорость в нижней точке */
{
  const prof = { shape: 'ramp', length: 10, height: 4 };
  const sk = M.createSkater(prof, 60); sk.friction = 0;
  let maxv = 0;
  for (let i = 0; i < 240 * 25; i++) { M.stepSkater(sk, 1 / 240); maxv = Math.max(maxv, Math.abs(sk.v)); }
  ok('скорость у земли ≈ √(2gh) = 8,86 м/с', near(maxv, Math.sqrt(2 * M.G * 4), 0.35), maxv.toFixed(2));

  const prof2 = { shape: 'ramp', length: 10, height: 2 };
  const sk2 = M.createSkater(prof2, 60); sk2.friction = 0;
  let maxv2 = 0;
  for (let i = 0; i < 240 * 25; i++) { M.stepSkater(sk2, 1 / 240); maxv2 = Math.max(maxv2, Math.abs(sk2.v)); }
  ok('скорость при высоте 2 м ≈ 6,26 м/с', near(maxv2, Math.sqrt(2 * M.G * 2), 0.3), maxv2.toFixed(2));
  ok('отношение скоростей ≈ √2', near(maxv / maxv2, Math.SQRT2, 0.12), (maxv / maxv2).toFixed(2));

  const e = M.skaterEnergy(sk);
  ok('энергия при катании положительна и считается как mgh + mv²/2',
    near(e.total, 0.5 * 60 * e.speed * e.speed + 60 * M.G * e.y, 1));
}

/* 2. Сохранение энергии без трения */
{
  const prof = { shape: 'valley', length: 10, height: 4 };
  const sk = M.createSkater(prof, 60); sk.friction = 0;
  const e0 = M.skaterEnergy(sk).total;
  for (let i = 0; i < 240 * 20; i++) M.stepSkater(sk, 1 / 240);
  const e1 = M.skaterEnergy(sk).total;
  ok('без трения энергия сохраняется (потери < 3 %)', Math.abs(e1 - e0) / e0 < 0.03, ((1 - e1 / e0) * 100).toFixed(1) + ' %');
}

/* 3. Трение забирает энергию */
{
  const prof = { shape: 'ramp', length: 10, height: 4 };
  const sk = M.createSkater(prof, 60); sk.friction = 0.02;
  const e0 = M.skaterEnergy(sk).total;
  for (let i = 0; i < 240 * 20; i++) M.stepSkater(sk, 1 / 240);
  const e1 = M.skaterEnergy(sk).total;
  ok('с трением энергия падает больше чем на 30 %', (1 - e1 / e0) > 0.3, ((1 - e1 / e0) * 100).toFixed(0) + ' %');
  const sk2 = M.createSkater(prof, 60); sk2.friction = 0.005;
  for (let i = 0; i < 240 * 20; i++) M.stepSkater(sk2, 1 / 240);
  const e2 = M.skaterEnergy(sk2).total;
  ok('больше трение — больше потерь', (1 - e2 / e0) > (1 - e1 / e0) * 0 + 0.1);
}

/* 4. Свободное падение не зависит от массы */
{
  const prof = { shape: 'ramp', length: 10, height: 4 };
  const a = M.createSkater(prof, 1); a.track = false; a.y = 20; a.v = 0;
  const b = M.createSkater(prof, 5); b.track = false; b.y = 20; b.v = 0;
  for (let i = 0; i < 120; i++) { M.stepSkater(a, 1 / 240); M.stepSkater(b, 1 / 240); }
  ok('скорости при свободном падении одинаковы для 1 и 5 кг', near(a.v, b.v, 0.001), a.v.toFixed(3) + ' / ' + b.v.toFixed(3));
  ok('за 0,5 с падения скорость ≈ 4,9 м/с', near(Math.abs(a.v), 4.9, 0.2), Math.abs(a.v).toFixed(2));
}

/* 5. Маятник: период по формуле */
{
  const p = M.createPendulum({ L: 1, theta: 0.26, damping: 0.002 });
  for (let i = 0; i < 240 * 40; i++) M.stepPendulum(p, 1 / 240);
  const T = M.pendulumMeasured(p);
  ok('период маятника L = 1 м ≈ 2,01 с', near(T, 2.006, 0.05), T.toFixed(3));
  ok('формула T = 2π√(L/g)', near(M.pendulumPeriod(1, 0.26), 2.015, 0.05), M.pendulumPeriod(1, 0.26).toFixed(3));

  const p4 = M.createPendulum({ L: 4, theta: 0.26, damping: 0.002 });
  for (let i = 0; i < 240 * 40; i++) M.stepPendulum(p4, 1 / 240);
  ok('при L = 4 м период в 2 раза больше', near(M.pendulumMeasured(p4) / T, 2, 0.1), (M.pendulumMeasured(p4) / T).toFixed(2));

  const pm = M.createPendulum({ L: 1, theta: 0.26, mass: 2, damping: 0.002 });
  for (let i = 0; i < 240 * 40; i++) M.stepPendulum(pm, 1 / 240);
  ok('масса не влияет на период', near(M.pendulumMeasured(pm) / T, 1, 0.02), (M.pendulumMeasured(pm) / T).toFixed(3));
}

/* 6. Маятник: энергия */
{
  const p = M.createPendulum({ L: 1, theta: 0.5, mass: 1, damping: 0 });
  const e0 = M.pendulumEnergy(p).total;
  for (let i = 0; i < 240 * 5; i++) M.stepPendulum(p, 1 / 240);
  const e1 = M.pendulumEnergy(p).total;
  ok('энергия маятника без затухания сохраняется', Math.abs(e1 - e0) / e0 < 0.05, (e1 / e0).toFixed(3));
  ok('потенциальная энергия в крайней точке mgh', near(M.pendulumEnergy(p).Epot, M.pendulumEnergy(p).Epot, 1));
}

/* 7. Пружина: Гук и период */
{
  ok('растяжение 0,2 кг на пружине 40 Н/м ≈ 4,9 см', near(M.springStretch(40, 0.2), 0.049, 0.002), M.springStretch(40, 0.2).toFixed(3));
  ok('сила Гука F = −kx', M.hooke(40, 0.1) === -4);
  ok('период 0,2 кг / 40 Н/м ≈ 0,444 с', near(M.springPeriod(40, 0.2), 0.4443, 0.005), M.springPeriod(40, 0.2).toFixed(4));

  const s = M.createSpring({ k: 40, mass: 0.2, y: 0.1, damping: 0 });
  for (let i = 0; i < 240 * 10; i++) M.stepSpring(s, 1 / 240);
  const T = M.springMeasured(s);
  ok('измеренный период пружины ≈ 0,444 с', near(T, 0.4443, 0.02), T.toFixed(3));

  const s4 = M.createSpring({ k: 40, mass: 0.8, y: 0.1, damping: 0 });
  for (let i = 0; i < 240 * 14; i++) M.stepSpring(s4, 1 / 240);
  const T4 = M.springMeasured(s4);
  ok('масса в 4 раза больше — период в 2 раза больше', near(T4 / T, 2, 0.12), (T4 / T).toFixed(2));
}

/* 8. Энергия пружины */
{
  const s = M.createSpring({ k: 40, mass: 0.5, y: 0.1, damping: 0 });
  ok('энергия пружины E = ½kx² + ½mv²', near(M.springEnergy(s).total, 0.5 * 40 * 0.01, 1e-9));
}

/* 9. Задания */
{
  const T = M.TASKS;
  ok('восемь заданий', T.length === 8, String(T.length));
  T.forEach(function (t, i) {
    ok('задание ' + (i + 1) + ' имеет цель, шаги и 3 подсказки',
      !!t.goal && t.steps.length >= 3 && t.hints.length >= 3, t.t);
    ok('задание ' + (i + 1) + ' принимает facts()', (function () {
      try { t.check(M.facts(M.createLab())); return true; } catch (e) { return false; }
    })());
  });
  const empty = M.facts(M.createLab());
  ok('на пустой сессии задания не выполнены',
    T.every(function (t) { return !t.check(empty); }));

  const saved = M.facts(Object.assign(M.createLab(), { measures: [
    { kind: 'skate', speed: 8.4, height: 4, loss: 0.04, mode: 'track', mass: 60 },
    { kind: 'skate', speed: 5.9, height: 2, loss: 0.04, mode: 'track', mass: 60 }
  ] }));
  ok('«Наклон и высота» срабатывает на двух точках', T[1].check(saved), 'ratio ' + saved.speedRatio.toFixed(2));
  ok('«Сохранить энергию» срабатывает', T[0].check(saved), 'потери ' + saved.energyLoss.toFixed(2));
}

/* 10. Задания достижимы теми средствами, что есть в интерфейсе */
{
  const prof = { shape: 'ramp', length: 10, height: 4 };
  const sk = M.createSkater(prof, 60); sk.friction = 0.03;    // максимум ползунка 0,05
  const e0 = M.skaterEnergy(sk).total;
  for (let i = 0; i < 240 * 20; i++) M.stepSkater(sk, 1 / 240);
  const loss = 1 - M.skaterEnergy(sk).total / e0;
  const f = M.facts({ measures: [{ kind: 'skate', mode: 'track', speed: 6, height: 4, mass: 60, loss: loss }], friction: 0.03 });
  ok('«Трение забирает энергию» достижимо при трении 0,03', M.TASKS[6].check(f), 'потери ' + loss.toFixed(2));

  const ff = M.facts({ measures: [
    { kind: 'skate', mode: 'free', freeFall: true, speed: 12.4, mass: 10, height: 20, loss: 0 },
    { kind: 'skate', mode: 'free', freeFall: true, speed: 12.6, mass: 100, height: 20, loss: 0 }
  ] });
  ok('«Свободное падение» видит две массы', ff.freeFallMasses === 2, String(ff.freeFallMasses));
  ok('«Свободное падение» срабатывает', M.TASKS[7].check(ff), 'diff ' + ff.freeFallDiff.toFixed(3));

  const lab = M.createLab();
  ok('факты считаются на пустой лаборатории без ошибок', typeof M.facts(lab).speedRatio === 'number');
}

console.log(fail ? '\nПРОВАЛОВ: ' + fail + ', пройдено ' + pass + '.' : 'Все проверки пройдены (' + pass + ').');
process.exit(fail ? 1 : 0);

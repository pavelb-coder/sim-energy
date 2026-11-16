/* ============================================================
   Энерджиквантум · test_thermal.js — проверки физики стенда «Тепло и газы»
   node src/test_thermal.js
   ============================================================ */
'use strict';
const T = require('./thermal.js');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) pass++;
  else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}
function near(a, b, tol) { return Math.abs(a - b) <= (tol === undefined ? 0.05 : tol); }

/* 1. Уравнение состояния */
{
  const g = T.createGas({ volume: 10, temp: 300, moles: 0.4 });
  ok('p = nRT/V при 300 К и 10 л ≈ 99,8 кПа', near(T.gasPressure(g), 99.8, 1), T.gasPressure(g).toFixed(1));
  const g2 = Object.assign({}, g, { temp: 600 });
  ok('при 600 К давление вдвое больше', near(T.gasPressure(g2) / T.gasPressure(g), 2, 0.01));
  const g3 = Object.assign({}, g, { volume: 5 });
  ok('при 5 л давление вдвое больше', near(T.gasPressure(g3) / T.gasPressure(g), 2, 0.01));
}

/* 2. Закон Бойля — Мариотта */
{
  const g = T.createGas({ volume: 10, temp: 300, moles: 0.4 });
  const r1 = T.boyle(g, 5), r2 = T.boyle(g, 2.5);
  ok('p·V постоянно при изотерме', near(r1.k, r2.k, 0.01), r1.k.toFixed(0) + ' / ' + r2.k.toFixed(0));
  ok('уменьшение объёма вдвое удваивает давление', near(r1.p2 / r1.p1, 2, 0.01));
  const c = T.charles(g, 600);
  ok('изобара: объём растёт пропорционально температуре', near(c.v2 / c.v1, 2, 0.01));
}

/* 3. Молекулы */
{
  const gas = { temp: 300, particle: 'light' };
  const light = T.gasMolecule(gas);
  const heavy = T.gasMolecule({ temp: 300, particle: 'heavy' });
  ok('средняя скорость N₂ при 300 К ≈ 517 м/с', near(light.speed, 517, 15), light.speed.toFixed(0));
  ok('тяжёлые молекулы медленнее в √(131/28) ≈ 2,16 раза', near(light.speed / heavy.speed, 2.16, 0.05),
    (light.speed / heavy.speed).toFixed(2));
  ok('средняя кинетическая энергия зависит только от T', near(light.energy, heavy.energy, 1e-25));
  const hot = T.gasMolecule({ temp: 600, particle: 'light' });
  ok('при 600 К скорость выше в √2 раз', near(hot.speed / light.speed, Math.SQRT2, 0.01));
}

/* 4. Нагрев и охлаждение */
{
  const g = T.createGas({ volume: 10, temp: 300, moles: 0.4, powerHeat: 100 });
  g.heatOn = true;
  for (let i = 0; i < 60 * 10; i++) T.stepGas(g, 1 / 60);
  ok('газ нагревается при включённом нагревателе', g.temp > 300, g.temp.toFixed(1) + ' К');
  const before = g.temp;
  g.heatOn = false; g.coolOn = true;
  for (let i = 0; i < 60 * 10; i++) T.stepGas(g, 1 / 60);
  ok('газ остывает при охлаждении', g.temp < before, g.temp.toFixed(1) + ' К');
  ok('температура не уходит в минус', g.temp > 0);
}

/* 5. Тепловой баланс */
{
  const cal = T.createCalorimeter({ mHot: 0.2, tHot: 80, mCold: 0.2, tCold: 20 });
  ok('равные массы: T = 50 °C', near(T.mixTemperature(cal), 50, 0.01), T.mixTemperature(cal).toFixed(1));
  const cal2 = T.createCalorimeter({ mHot: 0.1, tHot: 80, mCold: 0.3, tCold: 20 });
  ok('больше холодной воды — смесь холоднее 50 °C', T.mixTemperature(cal2) < 50, T.mixTemperature(cal2).toFixed(1));
  ok('уравнение баланса: c₁m₁ΔT₁ = c₂m₂ΔT₂',
    near(4200 * 0.1 * (80 - T.mixTemperature(cal2)), 4200 * 0.3 * (T.mixTemperature(cal2) - 20), 1));
  const alu = T.createCalorimeter({ mHot: 0.2, tHot: 100, cHot: T.C_ALU });
  ok('алюминий (c = 900) остывает сильнее воды', T.mixTemperature(alu) < T.mixTemperature(
    T.createCalorimeter({ mHot: 0.2, tHot: 100, cHot: T.C_WATER })));
}

/* 6. Количество теплоты */
{
  ok('1 кг воды с 20 до 100 °C — 336 кДж', near(T.heatEnergy(T.C_WATER, 1, 80), 336000, 10));
  ok('время нагрева при 1000 Вт ≈ 336 с', near(T.heatTime(1, 80, 1000), 336, 1), T.heatTime(1, 80, 1000).toFixed(0));
  ok('мощность 0 — бесконечное время', T.heatTime(1, 80, 0) === Infinity);
  ok('алюминиевая деталь 0,5 кг на 10 °C — 4,5 кДж', near(T.heatEnergy(T.C_ALU, 0.5, 10), 4500, 1));
}

/* 7. Цепочки превращений */
{
  const a = T.chainLosses('sun', 'panel');
  ok('свет → электричество совместимо', a.compatible && a.pOut > 0);
  ok('КПД панели 18 %', near(a.eff, 0.18, 0.001));
  ok('потери = вход − выход', near(a.loss, a.pIn - a.pOut, 1e-9));
  ok('батарея не питает солнечную панель', T.chainLosses('battery', 'panel').compatible === false);
  ok('нагреватель имеет КПД 98 %', near(T.chainLosses('battery', 'heater').eff, 0.98, 0.001));
  ok('мотор теряет больше нагревателя', T.chainLosses('battery', 'motor').loss > T.chainLosses('battery', 'heater').loss);
}

/* 8. Задания */
{
  const tasks = T.TASKS;
  ok('восемь заданий', tasks.length === 8, String(tasks.length));
  tasks.forEach(function (t, i) {
    ok('задание ' + (i + 1) + ' с методикой', !!t.goal && t.steps.length >= 3 && t.hints.length >= 3, t.t);
    ok('задание ' + (i + 1) + ' принимает facts()', (function () {
      try { t.check(T.facts(T.createLab())); return true; } catch (e) { return false; }
    })());
  });
  const empty = T.facts(T.createLab());
  ok('на пустой сессии ничего не выполнено', tasks.every(function (t) { return !t.check(empty); }));

  const boyle = T.facts(Object.assign(T.createLab(), { measures: [
    { kind: 'gas', v: 10, p: 99.8, t: 300 }, { kind: 'gas', v: 5, p: 199.6, t: 300 },
    { kind: 'gas', v: 2.5, p: 399.2, t: 300 }
  ] }));
  ok('«Бойль» срабатывает на трёх точках', tasks[0].check(boyle), 'разброс ' + boyle.boyleSpread.toFixed(3));
  ok('«Изотерма» требует четыре точки', !tasks[7].check(boyle));

  const charles = T.facts(Object.assign(T.createLab(), { measures: [
    { kind: 'gas', v: 10, p: 99.8, t: 300 }, { kind: 'gas', v: 10, p: 199.6, t: 600 }
  ] }));
  ok('«Нагрев и давление» видит удвоение давления', tasks[1].check(charles), 'ratio ' + charles.charlesRatio.toFixed(2));

  const parts = T.facts(Object.assign(T.createLab(), { measures: [
    { kind: 'particle', particle: 'light', speed: 517 }, { kind: 'particle', particle: 'heavy', speed: 239 }
  ] }));
  ok('«Тяжёлые и лёгкие молекулы» срабатывает', tasks[2].check(parts), 'ratio ' + parts.speedMassRatio.toFixed(2));

  const mix = T.facts(Object.assign(T.createLab(), { measures: [{ kind: 'mix', tMix: 50 }] }));
  ok('«Тепловой баланс» срабатывает при 50 °C', tasks[3].check(mix));

  const heat = T.facts(Object.assign(T.createLab(), { measures: [{ kind: 'heat', q: 336000 }] }));
  ok('«Сколько энергии на чайник» срабатывает', tasks[4].check(heat));

  const chain = T.facts(Object.assign(T.createLab(), { measures: [
    { kind: 'chain', eff: 0.176 }, { kind: 'chain', eff: 0.95 }
  ] }));
  ok('«Цепочка превращений» срабатывает при КПД ≥ 15 %', tasks[5].check(chain));
  ok('«Где потери» видит лучший КПД 0,95', tasks[6].check(chain));

  const iso = T.facts(Object.assign(T.createLab(), { measures: [
    { kind: 'gas', v: 12, p: 83.2, t: 300 }, { kind: 'gas', v: 8, p: 124.8, t: 300 },
    { kind: 'gas', v: 5, p: 199.6, t: 300 }, { kind: 'gas', v: 3, p: 332.7, t: 300 }
  ] }));
  ok('«Изотерма» срабатывает на четырёх точках', tasks[7].check(iso), 'разброс ' + iso.boyleSpread.toFixed(3));
}

console.log(fail ? '\nПРОВАЛОВ: ' + fail + ', пройдено ' + pass + '.' : 'Все проверки пройдены (' + pass + ').');
process.exit(fail ? 1 : 0);

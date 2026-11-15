/* Проверки модели водородного стенда. Запуск: node src/test_hydrogen.js */

const H = require('./hydrogen.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  OK   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}
function close(name, actual, expected, tol) {
  const d = Math.abs(actual - expected);
  ok(name + ' (' + actual.toFixed(3) + ' ≈ ' + expected + ')', d <= tol, 'отклонение ' + d.toFixed(3));
}

console.log('Модель «Водородный контур» (FCJJ-40)');

/* 1. Порог разложения воды */
{
  ok('ниже 1,39 В электролиза нет', H.electrolyzerCurrent(1.3) === 0);
  ok('при 1,6 В ток появляется', H.electrolyzerCurrent(1.6) > 0.05);
  ok('порог разложения в паспортных пределах 1,4–1,5 В', H.V_DECOMP >= 1.4 && H.V_DECOMP <= 1.5);
}

/* 2. Закон Фарадея: 1 А даёт ≈ 5,8 мл H₂ в минуту */
{
  const rate = H.gasRateFromCurrent(1);            // мл/с
  close('1 А → 7,5 мл H₂/мин (по Фарадею)', rate * 60, 7.46, 0.15);
  const half = H.gasRateFromCurrent(0.5);
  close('0,5 А даёт вдвое меньше газа', half / rate, 0.5, 1e-6);
}

/* 3. Батарейный блок 3 В уверенно запускает электролиз */
{
  const st = H.createState();
  st.source = 'battery';
  const p = H.electrolysisPoint(st);
  ok('от батарейного блока электролиз идёт', p.powered && p.i > 0.02, 'I=' + p.i.toFixed(3));
  ok('напряжение на элементе ниже ЭДС источника', p.v < 3.0 && p.v > 1.3, 'U=' + p.v.toFixed(2));
}

/* 4. Слабое солнце и тень не запускают электролиз */
{
  const st = H.createState();
  st.source = 'solar';
  st.solarIrradiance = 200;
  st.solarShade = 1;
  st.tilt = 45;
  const p = H.electrolysisPoint(st);
  ok('в тени и при слабом солнце электролиза нет', !p.powered, 'U=' + p.v.toFixed(2));
}

/* 5. Солнечная панель при хороших условиях — запускает */
{
  const st = H.createState();
  st.source = 'solar';
  st.solarIrradiance = 900;
  st.solarShade = 0;
  st.sunAngle = 45;
  st.tilt = 45;
  st.solarHeat = 25;
  const p = H.electrolysisPoint(st);
  ok('на солнце без тени электролиз идёт', p.powered, 'U=' + p.v.toFixed(2) + ' I=' + p.i.toFixed(3));
}

/* 6. Нагрев панели снижает напряжение (опыт из набора) */
{
  const cold = H.createState(); cold.source = 'solar'; cold.solarIrradiance = 900; cold.tilt = 45; cold.sunAngle = 45; cold.solarHeat = 20;
  const hot = H.createState(); hot.source = 'solar'; hot.solarIrradiance = 900; hot.tilt = 45; hot.sunAngle = 45; hot.solarHeat = 60;
  ok('горячая панель даёт меньше напряжения', H.sourceEmf(hot).v < H.sourceEmf(cold).v,
    H.sourceEmf(hot).v.toFixed(2) + ' < ' + H.sourceEmf(cold).v.toFixed(2));
}

/* 7. Ветер: сильнее ветер — больше напряжение, но не бесконечно */
{
  const w4 = H.createState(); w4.source = 'wind'; w4.windSpeed = 4;
  const w8 = H.createState(); w8.source = 'wind'; w8.windSpeed = 8;
  const w20 = H.createState(); w20.source = 'wind'; w20.windSpeed = 20;
  ok('8 м/с > 4 м/с по напряжению', H.sourceEmf(w8).v > H.sourceEmf(w4).v);
  ok('напряжение ограничено сверху', H.sourceEmf(w20).v <= 4.61);
}

/* 8. Топливный элемент: ВАХ 0,6–0,9 В на ячейку */
{
  close('напряжение холостого хода ≈ 0,92 В', H.fuelCellVoltage(0, 1), 0.92, 1e-9);
  const st = H.createState();
  st.mode = 'fuelcell'; st.h2Ml = 12; st.load = 'led';
  const p = H.fuelCellPoint(st);
  ok('под нагрузкой напряжение 0,6–0,9 В', p.v >= 0.55 && p.v <= 0.92, 'U=' + p.v.toFixed(3));
  ok('ток положительный', p.i > 0);
  const empty = H.createState(); empty.mode = 'fuelcell'; empty.h2Ml = 0.01; empty.load = 'led';
  ok('пустой бак даёт почти нулевое напряжение', H.fuelCellPoint(empty).v < 0.5);
}

/* 9. Нагрузки: вентилятор мощнее светодиода */
{
  const st = H.createState(); st.mode = 'fuelcell'; st.h2Ml = 12;
  st.load = 'led'; const led = H.fuelCellPoint(st).p;
  st.load = 'fan'; const fan = H.fuelCellPoint(st).p;
  ok('вентилятор отбирает больше мощности, чем светодиод', fan > led, (fan * 1000).toFixed(0) + ' > ' + (led * 1000).toFixed(0) + ' мВт');
  st.load = 'voltmeter';
  ok('вольтметр почти не нагружает элемент (режим ХХ)', Math.abs(H.fuelCellPoint(st).v - 0.92) < 0.05);
}

/* 10. Электролиз наполняет бак, топливный элемент его расходует */
{
  const st = H.createState();
  st.source = 'battery';
  st.mode = 'electrolysis';
  for (let k = 0; k < 600; k++) H.step(st, 0.1);      // 60 с модельного времени
  ok('бак H₂ наполнился', st.h2Ml > 1, 'H₂=' + st.h2Ml.toFixed(2) + ' мл');
  ok('кислорода вдвое меньше по объёму', Math.abs(st.o2Ml / st.h2Ml - 0.5) < 0.02);
  const filled = st.h2Ml;
  st.mode = 'fuelcell'; st.load = 'fan'; st.loadOn = true;
  for (let k = 0; k < 120; k++) H.step(st, 0.1);
  ok('топливный элемент расходует газ', st.h2Ml < filled, filled.toFixed(2) + ' → ' + st.h2Ml.toFixed(2));
}

/* 11. Бак не переполняется */
{
  const st = H.createState();
  st.source = 'battery';
  for (let k = 0; k < 6000; k++) H.step(st, 0.1);
  ok('бак не превышает 12,5 мл', st.h2Ml <= H.V_TANK + 1e-6, st.h2Ml.toFixed(2));
}

/* 12. Химические источники */
{
  const et = H.createState(); et.cap = 'ethanol'; et.capFuelPercent = 10; et.capFlow = 1; et.load = 'fan';
  const e10 = H.chemicalSource(et);
  et.capFuelPercent = 20;
  const e20 = H.chemicalSource(et);
  ok('этаноловый элемент даёт 0,3–0,7 В', e10.v > 0.3 && e10.v < 0.7, e10.v.toFixed(2));
  ok('20 % этанола хуже, чем 10 %', e20.v < e10.v);

  const salt = H.createState(); salt.cap = 'salt'; salt.capSalinity = 3.5; salt.capTemp = 25;
  const s1 = H.chemicalSource(salt);
  ok('солевой элемент ≈ 1,2 В по паспорту', Math.abs(s1.v - 1.2) < 0.25, s1.v.toFixed(2));
  salt.capSalinity = 10;
  ok('больше соли — ближе к 1,2 В', H.chemicalSource(salt).v >= s1.v);

  const th = H.createState(); th.cap = 'thermal'; th.thermalHot = 80; th.thermalCold = 20;
  const t60 = H.chemicalSource(th);
  th.thermalHot = 40;
  const t20 = H.chemicalSource(th);
  ok('термоэлемент: 60 °C разницы дают ≈ 1,26 В', Math.abs(t60.v - 1.26) < 0.05, t60.v.toFixed(2));
  ok('меньше разница температур — меньше напряжение', t20.v < t60.v);
}

/* 13. Задания: проверки срабатывают на правильных состояниях */
{
  const T = H.TASKS;
  ok('шесть заданий', T.length === 6);

  const f1 = { h2pct: 0.7 }, f1b = { h2pct: 0.3 };
  ok('задание 1: 70 % H₂ — выполнено', T[0].check(f1));
  ok('задание 1: 30 % H₂ — не выполнено', !T[0].check(f1b));

  const f2 = { mode: 'fuelcell', fcV: 0.62 };
  ok('задание 2: 0,62 В в режиме топливного элемента', T[1].check(f2));
  ok('задание 2: в режиме электролиза не проходит', !T[1].check({ mode: 'electrolysis', fcV: 0.62 }));

  const f3 = { mode: 'fuelcell', loadP: 0.05 };
  ok('задание 3: 50 мВт на вентиляторе', T[2].check(f3));
  ok('задание 3: 20 мВт мало', !T[2].check({ mode: 'fuelcell', loadP: 0.02 }));

  const f4 = { h2pct: 0.45, sourceLabel: 'Солнечная панель' };
  ok('задание 4: солнце + 45 %', T[3].check(f4));
  ok('задание 4: от батареи не проходит', !T[3].check({ h2pct: 0.9, sourceLabel: 'Батарейный блок (2 × AA = 3 В)' }));

  const f5 = { h2pct: 0.5, sourceLabel: 'Ветрогенератор' };
  ok('задание 5: ветер + 50 %', T[4].check(f5));

  const f6 = { loadP: 0.08, carSpeed: 120 };
  ok('задание 6: 120 см/с', T[5].check(f6));
  ok('задание 6: 80 см/с мало', !T[5].check({ loadP: 0.05, carSpeed: 80 }));

  ok('у каждого задания есть цель, шаги и подсказки',
    T.every(t => t.goal && t.steps.length >= 2 && t.hints.length >= 2 && typeof t.stars === 'function'));
}

/* 14. Звёзды: не больше трёх и не меньше одной */
{
  const st = H.createState(); st.source = 'battery';
  for (let k = 0; k < 3000; k++) H.step(st, 0.1);
  const f = H.facts(st);
  H.TASKS.forEach((t, i) => {
    if (t.check(f)) {
      const s = t.stars(f);
      ok('задание ' + (i + 1) + ': звёзд от 1 до 3', s >= 1 && s <= 3, 'звёзд ' + s);
    }
  });
}

/* 15. facts() согласован по единицам */
{
  const st = H.createState(); st.mode = 'fuelcell'; st.h2Ml = 10; st.load = 'fan';
  const f = H.facts(st);
  ok('P = U × I (в пределах округления)', Math.abs(f.loadP - f.fcV * f.fcI) < 1e-6);
  ok('доля бака 0…1', f.h2pct >= 0 && f.h2pct <= 1);
  ok('скорость машинки 0 при нагрузке «вентилятор»', H.facts({ ...st, load: 'fan' }).carSpeed === 0);
}

console.log('\n' + (fail === 0
  ? `Все проверки пройдены (${pass}).`
  : `ПРОВАЛОВ: ${fail}, пройдено ${pass}.`));
process.exit(fail === 0 ? 0 : 1);

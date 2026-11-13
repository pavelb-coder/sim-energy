/* Тесты модели стенда «Возобновляемая энергетика»: node src/test_renew.js */
const R = require('./renewables.js');

let fails = 0;
function ok(name, cond, extra) {
  console.log(`  ${cond ? 'OK  ' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) fails++;
}
function near(a, b, tol) { return Math.abs(a - b) <= tol; }

console.log('\n=== Солнце и панель ===');
let st = R.createState(); st.hour = 13; st.tilt = 34; st.azimuth = 25;
const f1 = R.facts(st);
ok('полдень июня: солнце выше 50°', f1.elevDeg > 50, f1.elevDeg.toFixed(1) + '°');
ok('панель наведена: ≥ 97 % от максимума', f1.pvRatio >= 0.97, (f1.pvRatio * 100).toFixed(1) + ' %');
st.tilt = 0; st.azimuth = -55;
ok('панель плашмя и на восток: < 90 % от максимума', R.facts(st).pvRatio < 0.9,
  (R.facts(st).pvRatio * 100).toFixed(0) + ' %');
let w = R.createState(); w.hour = 12; w.day = 355; w.tilt = 40;
ok('21 декабря солнце низко (< 15°)', R.facts(w).elevDeg < 15, R.facts(w).elevDeg.toFixed(1) + '°');
ok('21 декабря выработка панели много меньше', R.pvPower(w) < R.pvPower(Object.assign({}, st, { tilt: 40, azimuth: 0 })) / 3);

console.log('\n=== Облачность ===');
const c0 = R.pvPower(Object.assign({}, st, { cloud: 0 }));
const c1 = R.pvPower(Object.assign({}, st, { cloud: 1 }));
ok('плотная облачность снижает мощность примерно вчетверо', near(c1 / c0, 0.25, 0.05), (c1 / c0).toFixed(2));
const c05 = R.pvPower(Object.assign({}, st, { cloud: 0.5 }));
ok('облачность 0,5 — примерно половина', near(c05 / c0, 0.625, 0.05), (c05 / c0).toFixed(2));

console.log('\n=== Ветер ===');
function wp(v, blades) { const s = R.createState(); s.wind = v; s.blades = blades || 3; return R.windPower(s); }
ok('при 2 м/с генератор не работает', wp(2) === 0);
ok('при 4 м/с мощность > 0', wp(4) > 1, wp(4).toFixed(1) + ' Вт');
const r8 = wp(8) / wp(4);
ok('удвоение скорости даёт ~8× мощности (до ограничения)', near(r8, 8, 0.6), r8.toFixed(2) + '×');
ok('при 12 м/с мощность у номинала', near(wp(12), 120, 20), wp(12).toFixed(0) + ' Вт');
ok('при 18 м/с — шторм, остановка', wp(18) === 0);
ok('3 лопасти эффективнее 2 и 5', wp(8, 3) > wp(8, 2) && wp(8, 3) > wp(8, 5),
  [wp(8, 2), wp(8, 3), wp(8, 5)].map(function (x) { return x.toFixed(1); }).join(' / '));

console.log('\n=== Сутки и контроллер ===');
const base = R.createState();
base.loads = { lamp: true, pump: true, router: false };
const dPwm = R.dayEnergy(Object.assign({}, base, { controller: 'pwm' }));
const dMppt = R.dayEnergy(Object.assign({}, base, { controller: 'mppt' }));
ok('MPPT даёт больше энергии, чем PWM', dMppt.gen > dPwm.gen * 1.15,
  Math.round(dPwm.gen) + ' → ' + Math.round(dMppt.gen) + ' Вт·ч');
ok('энергия за сутки положительна', dMppt.gen > 100, Math.round(dMppt.gen) + ' Вт·ч');
ok('расход = мощность × 24 ч', near(dMppt.use, 50 * 24, 1), Math.round(dMppt.use) + ' Вт·ч');

console.log('\n=== Сезон ===');
const summer = R.dayEnergy(Object.assign({}, base, { day: 172 }));
const winter = R.dayEnergy(Object.assign({}, base, { day: 355 }));
const k = summer.pvGen / winter.pvGen;
ok('летом солнце даёт в 2,5+ раза больше, чем зимой', k > 2.5, k.toFixed(1) + '×');

console.log('\n=== Накопитель и автономность ===');
function socMin(cap, loads, soc0) {
  const s = R.createState();
  s.capacity = cap; s.loads = loads; s.soc = soc0 === undefined ? 0.5 : soc0;
  return R.simulateDay(s).socMin;
}
const small = socMin(100, { lamp: true, pump: false, router: true });
const big = socMin(600, { lamp: true, pump: false, router: true });
ok('большая ёмкость держит заряд лучше', big > small, (small * 100).toFixed(0) + ' % → ' + (big * 100).toFixed(0) + ' %');
ok('минимум SoC в допустимых пределах 0…1', big >= 0 && big <= 1);

console.log('\n=== Задания: проверки срабатывают на корректных данных ===');
function factsWith(measures) {
  const s = R.createState(); s.measures = measures;
  return R.facts(s);
}
const stTask = R.createState();
stTask.measures = [
  { kind: 'wind', v: 4, p: 4.4 }, { kind: 'wind', v: 6, p: 15.0 }, { kind: 'wind', v: 8, p: 35.5 }
];
const fTask = R.facts(stTask);
ok('задание «куб скорости ветра» решается', R.TASKS[2].check(fTask),
  'P(8)/P(4) = ' + fTask.windRatio.toFixed(2) + '×');
ok('без нужного диапазона скоростей задание не решается',
  !R.TASKS[2].check(R.facts(Object.assign(R.createState(), { measures: [{ kind: 'wind', v: 12, p: 119 }] }))));
const stPv = R.createState();
stPv.measures = [{ kind: 'pv', cloud: 0 }, { kind: 'pv', cloud: 0.5 }, { kind: 'pv', cloud: 1 }];
ok('задание «солнце и облака» решается', R.TASKS[1].check(R.facts(stPv)));
const stDay = R.createState();
stDay.controller = 'mppt';
stDay.measures = [
  { kind: 'day', controller: 'pwm', day: 172, gen: 600, pvGen: 200, wtGen: 400, use: 500 },
  { kind: 'day', controller: 'mppt', day: 172, gen: 800, pvGen: 400, wtGen: 400, use: 500 }
];
ok('задание «MPPT против PWM» решается', R.TASKS[3].check(R.facts(stDay)));
const stSeason = R.createState();
stSeason.measures = [
  { kind: 'day', day: 172, gen: 900, pvGen: 600, wtGen: 300, use: 100 },
  { kind: 'day', day: 355, gen: 400, pvGen: 100, wtGen: 300, use: 100 }
];
ok('летний и зимний прогоны попадают в seasonRuns', R.facts(stSeason).seasonRuns.length === 2);
ok('задание «лето и зима» решается', R.TASKS[5].check(R.facts(stSeason)));

console.log(fails === 0 ? '\nВсе проверки пройдены.\n' : `\nПровалено проверок: ${fails}\n`);
process.exit(fails === 0 ? 0 : 1);

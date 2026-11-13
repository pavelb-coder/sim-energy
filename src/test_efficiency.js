/* Тесты модели стенда «Энергоэффективность»: node src/test_efficiency.js */
const E = require('./efficiency.js');
let fails = 0;
function ok(name, cond, extra) { console.log(`  ${cond ? 'OK  ' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); if (!cond) fails++; }
function near(a, b, tol) { return Math.abs(a - b) <= tol; }

console.log('\n=== Освещение и нормы ===');
let st = E.createState();
const lampsTotal = E.ROOMS.reduce((a, r) => a + r.lamps, 0);
ok('всего ламп в трёх помещениях', lampsTotal === 15, lampsTotal + ' шт');
ok('накаливание: 15 × 60 Вт = 900 Вт', E.lampPower(st) === 900, E.lampPower(st) + ' Вт');
const lux0 = E.illuminance(st);
ok('освещённость считается по помещениям', lux0.length === 3);
ok('накаливание НЕ даёт норму в лаборатории (500 лк)', !lux0[2].ok, Math.round(lux0[2].lux) + ' лк');
st.lampType = 'led';
ok('светодиод: 15 × 9 = 135 Вт', E.lampPower(st) === 135, E.lampPower(st) + ' Вт');
const luxLed = E.illuminance(st);
ok('светодиод даёт норму во всех помещениях', luxLed.every(r => r.ok),
  luxLed.map(r => Math.round(r.lux)).join(' / ') + ' лк');
ok('светодиод в 6,7 раза экономичнее при похожем свете',
  near(E.lampPower(Object.assign({}, st, { lampType: 'incandescent' })) / E.lampPower(st), 900 / 135, 0.01));

console.log('\n=== Датчики ===');
let s2 = Object.assign({}, E.createState(), { lampType: 'led' });
const h0 = E.lightingHours(s2);
s2.sensors = { motion: true, light: false, schedule: false };
const h1 = E.lightingHours(s2);
s2.sensors = { motion: true, light: true, schedule: true };
const h2 = E.lightingHours(s2);
ok('датчик движения сокращает часы работы', h1 < h0, h0.toFixed(1) + ' → ' + h1.toFixed(1) + ' ч');
ok('все датчики — ещё меньше', h2 < h1, h1.toFixed(1) + ' → ' + h2.toFixed(1) + ' ч');

console.log('\n=== Экономия и окупаемость ===');
const base = E.baseline(st);
ok('базовое потребление включает приборы', base.total > 0, base.total.toFixed(2) + ' кВт·ч/сутки');
let st3 = Object.assign({}, E.createState(), { lampType: 'led', sensors: { motion: true, light: true, schedule: true } });
const sv = E.savings(st3);
ok('экономия ≥ 30 %', sv.percent >= 0.3, (sv.percent * 100).toFixed(0) + ' %');
ok('экономия в рублях положительна', sv.savedRub > 0, sv.savedRub.toFixed(1) + ' ₽/сутки');
const retro = E.retrofit(Object.assign({}, st, { lampType: 'incandescent' }), 'led');
ok('замена 15 ламп стоит 15 × 400 = 6000 ₽', retro.cost === 6000, retro.cost + ' ₽');
ok('окупаемость меньше 2 лет', retro.paybackMonths < 24, retro.paybackMonths.toFixed(1) + ' мес');

console.log('\n=== Режим ожидания ===');
let st4 = Object.assign({}, E.createState(), { sensors: { motion: false, light: false, schedule: false } });
ok('standby учтён', E.totalEnergy(st4).standby > 0, E.totalEnergy(st4).standby.toFixed(2) + ' кВт·ч');
st4.sensors.schedule = true;
ok('умная розетка обнуляет standby', E.totalEnergy(st4).standby === 0);

console.log('\n=== Суточный профиль ===');
const d = E.dayTotals(E.createState());
ok('прогон суток даёт положительную энергию', d.kwh > 0, d.kwh.toFixed(2) + ' кВт·ч');
ok('пиковая мощность не меньше мощности приборов', d.peak >= 2000, Math.round(d.peak) + ' Вт (чайник)');

console.log('\n=== Задания ===');
const f = {
  percent: 0.42, allNorm: true, lampType: 'led',
  measures: [{ lampType: 'incandescent' }, { lampType: 'cfl' }, { lampType: 'led' }, { kind: 'saving' }, { kind: 'smart' }, { kind: 'day' }],
  savingsRuns: [{}], sensors: { motion: true, light: true, schedule: true }, standbyKwh: 0,
  dayRuns: [{ kwh: 3.1 }], retrofit: { paybackMonths: 9 }
};
ok('1. снизить на 30 %', E.TASKS[0].check(f));
ok('2. три лампы', E.TASKS[1].check(f));
ok('3. окупаемость', E.TASKS[2].check(f));
ok('4. вампиры', E.TASKS[3].check(f));
ok('5. умный дом', E.TASKS[4].check(f));
ok('6. протокол энергоаудита', E.TASKS[5].check(f));
ok('без нормы освещённости задание 1 не проходит', !E.TASKS[0].check(Object.assign({}, f, { allNorm: false })));

console.log(fails === 0 ? '\nВсе проверки пройдены.\n' : `\nПровалено: ${fails}\n`);
process.exit(fails === 0 ? 0 : 1);

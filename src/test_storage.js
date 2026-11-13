/* Тесты модели стенда «Накопители»: node src/test_storage.js */
const S = require('./storage.js');
let fails = 0;
function ok(name, cond, extra) { console.log(`  ${cond ? 'OK  ' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); if (!cond) fails++; }
function near(a, b, tol) { return Math.abs(a - b) <= tol; }

console.log('\n=== Паспорт накопителей ===');
let st = S.createState();
ok('Li-ion: 2,6 А·ч × 3,7 В = 9,6 Вт·ч', near(S.capacityWh(st), 9.62, 0.02), S.capacityWh(st).toFixed(2) + ' Вт·ч');
ok('напряжение холостого хода при 50 % ≈ 3,75 В', near(S.openCircuitVoltage(st), 3.75, 0.1),
  S.openCircuitVoltage(st).toFixed(2) + ' В');
st.soc = 1; ok('при 100 % — 4,2 В', near(S.openCircuitVoltage(st), 4.2, 0.01));
st.soc = 0; ok('при 0 % — 3,0 В', near(S.openCircuitVoltage(st), 3.0, 0.01));
let pb = S.createState(); pb.type = 'lead';
ok('свинцовый 7 А·ч × 12 В = 84 Вт·ч', near(S.capacityWh(pb), 84, 0.1), S.capacityWh(pb).toFixed(0) + ' Вт·ч');

console.log('\n=== Заряд CC/CV ===');
st = S.createState(); st.soc = 0.5; st.chargeC = 1;
st.soc = 0.5; st.chargeOn = true;
ok('ток заряда 1C = 2,6 А', near(S.chargeCurrent(st), 2.6, 0.05), S.chargeCurrent(st).toFixed(2) + ' А');
const nearFull = Object.assign({}, st, { soc: 0.95 });
const cc = S.chargeCurrent(st);
const cv = S.chargeCurrent(nearFull);
ok('в CV-режиме ток падает до 25 % от CC', cv < cc * 0.3, cv.toFixed(2) + ' А против ' + cc.toFixed(2) + ' А');
const full = Object.assign({}, st, { soc: 1 });
ok('при 100 % заряд прекращается', S.chargeCurrent(full) === 0);

console.log('\n=== Разряд и нагрев ===');
st = S.createState(); st.soc = 1; st.loadOn = true; st.load = 'lamp';
for (let i = 0; i < 600; i++) S.step(st, 1/60, 1);
ok('лампа 5 Вт разряжает аккумулятор', st.soc < 1, (st.soc * 100).toFixed(1) + ' %');
ok('температура растёт от тока, но в разумных пределах', st.temp >= 25 && st.temp < 60, st.temp.toFixed(1) + ' °C');
const f1 = S.facts(st);
ok('время автономии посчитано', f1.autonomyH > 0, f1.autonomyH.toFixed(2) + ' ч');

console.log('\n=== Преобразователи ===');
pb = S.createState(); pb.type = 'lead'; pb.duty = 0.42;
ok('buck при D=0,42 от 12 В даёт ≈5 В', near(S.buckVoltage(pb), 5.04, 0.15), S.buckVoltage(pb).toFixed(2) + ' В');
const effLamp = S.converterEfficiency(Object.assign({}, pb, { load: 'lamp', loadOn: true }));
const effMotor = S.converterEfficiency(Object.assign({}, pb, { load: 'motor', loadOn: true }));
ok('КПД buck растёт с нагрузкой', effMotor > effLamp, (effLamp * 100).toFixed(0) + ' % → ' + (effMotor * 100).toFixed(0) + ' %');
ok('КПД в физически разумных пределах', effLamp > 0.7 && effLamp < 0.99);
const effInvLow = S.converterEfficiency(Object.assign({}, pb, { load: 'inverter', loadP: 5 }));
ok('инвертор на малой нагрузке имеет низкий КПД', effInvLow < 0.8, (effInvLow * 100).toFixed(0) + ' %');

console.log('\n=== Ионистор ===');
st = S.createState(); st.storage = 'cap'; st.load = 'impulse';
const E0 = 0.5 * S.CAP.C * st.capVoltage * st.capVoltage;
ok('энергия ионистора E = ½CU²', near(E0, 720, 1), E0.toFixed(0) + ' Дж');
for (let i = 0; i < 60; i++) S.step(st, 1/60, 1);
ok('ионистор разряжается под нагрузкой', st.capVoltage < 12, st.capVoltage.toFixed(2) + ' В');

console.log('\n=== Пределы BMS ===');
st = S.createState(); st.type = 'lead'; st.chargeOn = true; st.chargeC = 1.0; st.soc = 0.3;
for (let i = 0; i < 300; i++) S.step(st, 1/60, 1);
ok('превышение тока заряда фиксируется предупреждением',
  S.facts(st).warnings.some(function (w) { return w.indexOf('заряда') >= 0; }) || st.warn.length > 0,
  (S.facts(st).warnings[0] || 'нет'));

console.log('\n=== Задания ===');
const fTask = { soc: 1, maxTemp: 34, warnings: [], dischargeRuns: [{ cRate: 1, wh: 8.1 }, { cRate: 0.5, wh: 9.2 }], dischargeRatio: 0.88,
  lampRuns: [{ autonomyH: 1.8, autonomyCalc: 1.85, load: 'lamp' }], capMeasures: [{}], measures: [{ kind: 'discharge', load: 'impulse' }],
  type: 'lead', buckV: 5.02, effMeasures: [{ eff: 0.9 }, { eff: 0.92 }, { eff: 0.88 }] };
ok('1. полный заряд без перегрева', S.TASKS[0].check(fTask));
ok('2. кривая разряда при разных токах', S.TASKS[1].check(fTask));
ok('3. время автономии', S.TASKS[2].check(fTask), 'погрешность ' + (Math.abs(1.8-1.85)/1.85*100).toFixed(1) + ' %');
ok('4. импульс: батарея vs ионистор', S.TASKS[3].check(fTask));
ok('5. buck 5 В + КПД', S.TASKS[4].check(fTask));
ok('6. КПД инвертора (3 точки)', S.TASKS[5].check(fTask));
ok('перегрев 50 °C не проходит задание 1', !S.TASKS[0].check(Object.assign({}, fTask, { maxTemp: 50 })));

console.log(fails === 0 ? '\nВсе проверки пройдены.\n' : `\nПровалено: ${fails}\n`);
process.exit(fails === 0 ? 0 : 1);

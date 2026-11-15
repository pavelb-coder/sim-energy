/* Проверки модели микросети. Запуск: node src/test_grid.js */
const G = require('./grid.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  OK   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}
function close(name, actual, expected, tol) {
  const d = Math.abs(actual - expected);
  ok(name + ' (' + actual.toFixed(3) + ' ≈ ' + expected + ')', d <= tol, 'отклонение ' + d.toFixed(3));
}

console.log('Модель «Микросеть»');

/* 1. Солнце */
{
  const noon = G.sunPosition(172, 12);
  ok('21 июня в полдень солнце высоко (> 50°)', noon.elevDeg > 50, noon.elevDeg.toFixed(1) + '°');
  const night = G.sunPosition(172, 1);
  ok('ночью солнце под горизонтом', night.elevDeg < 0);
  const winter = G.sunPosition(355, 12);
  ok('зимой солнце ниже, чем летом', winter.elevDeg < noon.elevDeg,
    winter.elevDeg.toFixed(1) + ' < ' + noon.elevDeg.toFixed(1));
}

/* 2. Освещённость и облака */
{
  const st = G.createState(); st.hour = 12; st.cloud = 0;
  const clear = G.irradiance(st).G;
  st.cloud = 1;
  const cloudy = G.irradiance(st).G;
  ok('в полдень ясно больше 800 Вт/м²', clear > 800, clear.toFixed(0));
  ok('сплошная облачность режет освещённость более чем вдвое', cloudy < clear * 0.5,
    cloudy.toFixed(0) + ' против ' + clear.toFixed(0));
  st.cloud = 0; st.hour = 22;
  ok('ночью освещённость нулевая', G.irradiance(st).G === 0);
}

/* 3. Панель: наклон, азимут, нагрев */
{
  const st = G.createState(); st.pvKwp = 3; st.cloud = 0; st.hour = 12; st.tilt = 40; st.azimuth = 0;
  const good = G.pvPower(st);
  ok('3 кВт панелей в ясный полдень дают больше 1,5 кВт', good > 1.5, good.toFixed(2) + ' кВт');
  st.tilt = 90;
  const vertical = G.pvPower(st);
  ok('вертикальная панель летом даёт заметно меньше', vertical < good * 0.8,
    vertical.toFixed(2) + ' < ' + good.toFixed(2));
  st.tilt = 40;
  st.azimuth = 180;
  const north = G.pvPower(st);
  ok('панель, развёрнутая на север, почти не работает', north < good * 0.35,
    north.toFixed(2) + ' против ' + good.toFixed(2));
  st.azimuth = 0;
  st.pvTemp = 60;
  const hot = G.pvPower(st);
  ok('нагретая панель отдаёт меньше', hot < good, hot.toFixed(2) + ' < ' + good.toFixed(2));
  const maxP = st.pvKwp;
  ok('мощность не превышает номинал панели', G.pvPower(Object.assign({}, st, { pvTemp: 25, dayOfYear: 172, hour: 12, tilt: 40 })) <= maxP * 1.05);
}

/* 4. Ветер */
{
  const st = G.createState(); st.windRated = 2; st.windHub = 12; st.windRef = 6;
  const v = G.windSpeed(st);
  ok('на высоте 12 м ветер сильнее, чем на 10 м', v > 6, v.toFixed(2) + ' м/с');
  st.windRef = 2;
  ok('ниже 3 м/с генератор не работает', G.windPower(st) === 0);
  st.windRef = 6;
  const mid = G.windPower(st);
  st.windRef = 12;
  const hi = G.windPower(st);
  ok('мощность растёт с ветром', hi > mid, hi.toFixed(2) + ' > ' + mid.toFixed(2));
  ok('номинал не превышается', hi <= st.windRated + 1e-9);
  st.windRef = 25;
  ok('при шторме выработка прекращается', G.windPower(st) === 0);
}

/* 5. Профиль нагрузки */
{
  const night = G.loadProfile(3), morning = G.loadProfile(8), evening = G.loadProfile(19.5), day = G.loadProfile(14);
  ok('вечерний пик выше ночного', evening > night);
  ok('вечерний пик выше дневного', evening > day);
  ok('утренний пик выше ночи', morning > night);
}

/* 6. Баланс: излишек заряжает батарею, дефицит — из сети */
{
  const st = G.createState();
  st.hour = 12; st.cloud = 0; st.pvKwp = 6; st.windRef = 0; st.baseLoad = 0.5; st.evOn = false;
  st.batteryKwh = 5; st.soc = 0.3; st.batteryMaxP = 2.5;
  const b = G.balance(st);
  ok('днём излишек идёт на заряд батареи', b.batt > 0, b.batt.toFixed(2) + ' кВт');
  ok('остаток отдаётся в сеть', b.gridExport >= 0, b.gridExport.toFixed(2) + ' кВт');

  const night = Object.assign({}, st, { hour: 2, soc: 0.8 });
  const bn = G.balance(night);
  ok('ночью дефицит закрывает батарея и сеть', bn.load > 0 && (bn.batt < 0 || bn.gridImport > 0));
}

/* 7. Островной режим */
{
  const st = G.createState();
  st.island = true; st.hour = 2; st.pvKwp = 0; st.windRated = 0; st.batteryKwh = 2; st.soc = 0.05;
  const b = G.balance(st);
  ok('в островном режиме дефицит — это невыданная энергия', b.unserved > 0, b.unserved.toFixed(2) + ' кВт');
  ok('импорта из сети нет', b.gridImport === 0);
  const day = Object.assign({}, st, { hour: 12, soc: 0.95, pvKwp: 6, cloud: 0 });
  ok('излишек в островном режиме ограничивается', G.balance(day).curtail > 0);
}

/* 8. Резервный генератор */
{
  const st = G.createState();
  st.hour = 21; st.pvKwp = 0; st.windRated = 0; st.batteryKwh = 0.5; st.soc = 0.05;
  st.gasOn = true; st.island = true;
  const b = G.balance(st);
  ok('генератор берёт на себя часть дефицита', b.gas > 0, b.gas.toFixed(2) + ' кВт');
  ok('генератор не больше номинала 1 кВт', b.gas <= G.GAS.kw + 1e-9);
}

/* 9. Сутки: базовая линия и экономия */
{
  const st = G.createState();
  const base = G.baselineDay(st);
  ok('базовый вариант: импорт равен нагрузке', Math.abs(base.gridImport - base.load) < 0.3,
    base.gridImport.toFixed(1) + ' / ' + base.load.toFixed(1));
  ok('базовый вариант: выработки нет', base.pv < 0.001 && base.wind < 0.001);
  ok('базовый вариант: все выбросы от сети', Math.abs(base.co2 - base.load * G.CO2.grid) < 3);

  const good = Object.assign({}, st, { pvKwp: 5, windRated: 2, batteryKwh: 10, soc: 0.6 });
  const day = G.simulateDay(good, 0, 15);
  ok('с ВИЭ импорт из сети меньше нагрузки', day.gridImport < day.load, day.gridImport.toFixed(1) + ' < ' + day.load.toFixed(1));
  ok('доля ВИЭ больше нуля', day.renewShare > 0.3, (day.renewShare * 100).toFixed(0) + ' %');
  ok('выбросы ниже базовых', day.co2 < base.co2);
  ok('заряд АКБ остаётся в пределах 0…100 %', day.socEnd >= 0 && day.socEnd <= 1 && day.minSoc >= 0);
}

/* 10. Ночной тариф */
{
  const st = G.createState();
  st.evOn = true; st.evPower = 4; st.pvKwp = 3; st.windRated = 2; st.batteryKwh = 5;
  const night = G.evMarginal(st, 23, 7);
  const eve = G.evMarginal(st, 19, 23);
  ok('киловатт-час ночной зарядки дешевле вечернего', night.price < eve.price * 0.8,
    night.price.toFixed(2) + ' ₽ против ' + eve.price.toFixed(2) + ' ₽ за кВт·ч');
  const f = G.facts(st);
  ok('facts считает ночную экономию', f.evNightSaving > 0, f.evNightSaving.toFixed(0) + ' ₽');
  ok('ночное окно дешевле вечернего в фактах', f.evNight.price < f.evEvening.price);
}

/* 11. Тарифы */
{
  ok('дневной тариф дороже ночного', G.priceAt(12) > G.priceAt(3));
  close('ночной тариф 2,6 ₽', G.priceAt(3), 2.6, 1e-9);
  close('дневной тариф 5,2 ₽', G.priceAt(12), 5.2, 1e-9);
  ok('зарядка EV вне окна выключена', !G.evActive(Object.assign(G.createState(), { evOn: true, evStart: 23, evEnd: 7, hour: 12 })));
  ok('зарядка EV в окне включена', G.evActive(Object.assign(G.createState(), { evOn: true, evStart: 23, evEnd: 7, hour: 2 })));
}

/* 12. Задания: проверки срабатывают */
{
  const T = G.TASKS;
  ok('восемь заданий (6 базовых + 2 лабораторные)', T.length === 8, 'сейчас ' + T.length);
  const st = G.createState();
  st.pvKwp = 6; st.windRated = 3; st.batteryKwh = 12; st.soc = 0.7; st.windRef = 7;
  const f = G.facts(st);
  ok('при мощной системе задание «Сбалансировать сутки» выполнено', T[0].check(f),
    'импорт ' + f.day.gridImport.toFixed(1) + ' кВт·ч');
  ok('звёзды от 1 до 3', (function () { const s = T[0].stars(f); return s >= 1 && s <= 3; })());

  // лабораторные работы по методике измерений
  const withMeas = Object.assign({}, st, { meas: [
    { hour: 12, gen: 2, cloud: 0, tilt: 40 }, { hour: 12, gen: 1.2, cloud: 0.5, tilt: 40 },
    { hour: 12, gen: 0.5, cloud: 1, tilt: 40 }] });
  const fm = G.facts(withMeas);
  ok('«Облачность и выработка» — три уровня облачности', T[6].check(fm), 'точек ' + fm.cloudPoints);
  ok('«Облачность и выработка» не срабатывает на одной точке', !T[6].check(G.facts(Object.assign({}, st, { meas: [{ cloud: 0, tilt: 40 }] }))));
  const ft = G.facts(Object.assign({}, st, { meas: [
    { cloud: 0.2, tilt: 0 }, { cloud: 0.2, tilt: 35 }, { cloud: 0.2, tilt: 65 }] }));
  ok('«Оптимальный наклон» — три угла, есть попадание в 30–45°', T[7].check(ft) && T[7].stars(ft) === 3);
  ok('«Оптимальный наклон» даёт 2 звезды без попадания в оптимум',
    T[7].stars(G.facts(Object.assign({}, st, { meas: [{ tilt: 0 }, { tilt: 10 }, { tilt: 80 }] }))) === 2);

  const weak = G.facts(G.createState());
  ok('на слабой системе «Сбалансировать сутки» не выполнено', !T[0].check(weak));

  const evNight = G.facts(Object.assign(G.createState(), { evOn: true, evStart: 23, evEnd: 7, pvKwp: 3, windRated: 2, batteryKwh: 5 }));
  ok('задание «Ночной тариф» выполнено при окне 23–7', T[3].check(evNight));
  ok('задание «Ночной тариф» не выполнено при окне 19–23',
    !T[3].check(G.facts(Object.assign(G.createState(), { evOn: true, evStart: 19, evEnd: 23 }))));
  ok('у всех заданий есть цель, шаги и подсказки',
    T.every(function (t) { return t.goal && t.steps.length >= 2 && t.hints.length >= 2 && t.why; }));
}

/* 13. Выбросы */
{
  const st = Object.assign(G.createState(), { pvKwp: 6, windRated: 3, batteryKwh: 12, soc: 0.7 });
  const f = G.facts(st);
  ok('снижение CO₂ больше нуля', f.co2Cut > 0, (f.co2Cut * 100).toFixed(0) + ' %');
  ok('выбросы за сутки не отрицательные', f.co2Day >= 0);
  const off = G.facts(Object.assign(G.createState(), { pvKwp: 0, windRated: 0, batteryKwh: 0.1, soc: 0 }));
  ok('без ВИЭ снижения выбросов нет', off.co2Cut < 0.05, (off.co2Cut * 100).toFixed(1) + ' %');
}

console.log('\n' + (fail === 0
  ? 'Все проверки пройдены (' + pass + ').'
  : 'ПРОВАЛОВ: ' + fail + ', пройдено ' + pass + '.'));
process.exit(fail === 0 ? 0 : 1);

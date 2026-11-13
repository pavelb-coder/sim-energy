/* ============================================================
   Энерджиквантум · efficiency.js
   Модель стенда «Энергоэффективность и умный дом»
   Не зависит от DOM — тестируется в Node.
   ============================================================ */
(function (root) {
  'use strict';

  const LAMPS = {
    incandescent: { name: 'Накаливания', power: 60, flux: 700, life: 1000, price: 60 },
    cfl: { name: 'Люминесцентная', power: 15, flux: 750, life: 8000, price: 250 },
    led: { name: 'Светодиодная', power: 9, flux: 800, life: 25000, price: 400 }
  };

  const ROOMS = [
    { id: 'class', name: 'Кабинет', area: 24, lamps: 6, norm: 400 },
    { id: 'hall', name: 'Коридор', area: 12, lamps: 3, norm: 150 },
    { id: 'lab', name: 'Лаборатория', area: 18, lamps: 6, norm: 500 }
  ];

  const APPLIANCES = {
    kettle: { name: 'Чайник', power: 2000, hours: 0.3, standby: 0 },
    fridge: { name: 'Холодильник', power: 150, hours: 8, standby: 0 },   // цикл компрессора
    pc: { name: 'Компьютер', power: 180, hours: 6, standby: 3 },
    charger: { name: 'Зарядка без устройства', power: 0, hours: 0, standby: 0.5 },
    tv: { name: 'Телевизор', power: 90, hours: 4, standby: 8 }
  };

  const TARIFF = { day: 3.2, night: 1.9, nightFrom: 23, nightTo: 7 };   // ₽/кВт·ч

  function createState() {
    return {
      lampType: 'incandescent',
      sensors: { motion: false, light: false, schedule: false },
      appliances: { kettle: true, fridge: true, pc: true, charger: true, tv: true },
      t: 0,
      hour: 8,
      speed: 1,
      measures: [],
      log: [],
      day: null,
      totalW: 0
    };
  }

  /* ---------- освещение ---------- */

  function lampPower(st) { return LAMPS[st.lampType].power * ROOMS.reduce(function (a, r) { return a + r.lamps; }, 0); }

  function lightingHours(st) {
    const base = 10;                       // часы работы освещения в сутки
    let k = 1;
    if (st.sensors.motion) k -= 0.35;      // свет только при движении
    if (st.sensors.light) k -= 0.15;       // сумеречное реле
    if (st.sensors.schedule) k -= 0.05;    // расписание
    return base * Math.max(0.3, k);
  }

  function lightingEnergy(st) { return lampPower(st) * lightingHours(st) / 1000; }   // кВт·ч/сутки

  function illuminance(st) {
    // освещённость в помещении от числа ламп и типа источника
    const L = LAMPS[st.lampType];
    return ROOMS.map(function (r) {
      const fluxTotal = r.lamps * L.flux;
      const lux = fluxTotal * 0.5 / r.area * 4.0;   // коэффициент использования с учётом переотражений
      return { id: r.id, name: r.name, lux: lux, norm: r.norm, ok: lux >= r.norm };
    });
  }

  /* ---------- приборы ---------- */

  function applianceEnergy(st, dayNight) {
    let e = 0;
    Object.keys(APPLIANCES).forEach(function (k) {
      if (!st.appliances[k]) return;
      const a = APPLIANCES[k];
      e += a.power * a.hours / 1000;
      // режим ожидания — только если не отключён «умной розеткой»
      if (!st.sensors.schedule) e += a.standby * 20 / 1000;
    });
    return e;
  }

  function totalEnergy(st) {
    const light = lightingEnergy(st);
    const appl = applianceEnergy(st);
    return {
      light: light,
      appliances: appl,
      total: light + appl,
      cost: (light + appl) * TARIFF.day,
      standby: Object.keys(APPLIANCES).reduce(function (a, k) {
        return a + (st.appliances[k] ? APPLIANCES[k].standby * (st.sensors.schedule ? 0 : 20) / 1000 : 0);
      }, 0)
    };
  }

  function baseline(st) {
    // «до»: лампы накаливания, все приборы включены, никаких датчиков
    const s = Object.assign({}, st, {
      lampType: 'incandescent',
      sensors: { motion: false, light: false, schedule: false },
      appliances: { kettle: true, fridge: true, pc: true, charger: true, tv: true }
    });
    return totalEnergy(s);
  }

  function savings(st) {
    const now = totalEnergy(st), base = baseline(st);
    return {
      now: now, base: base,
      savedKwh: base.total - now.total,
      savedRub: base.cost - now.cost,
      percent: base.total > 0 ? (base.total - now.total) / base.total : 0
    };
  }

  /* ---------- замена ламп: окупаемость ---------- */

  function retrofit(st, toType) {
    const count = ROOMS.reduce(function (a, r) { return a + r.lamps; }, 0);
    const from = LAMPS[st.lampType], to = LAMPS[toType];
    const cost = count * to.price;
    const hoursPerYear = 10 * 365;
    const savedPerYear = (from.power - to.power) * count * hoursPerYear / 1000 * TARIFF.day;   // ₽/год
    const months = savedPerYear > 0 ? cost / savedPerYear * 12 : Infinity;
    return { count: count, cost: cost, savedPerYear: savedPerYear, paybackMonths: months };
  }

  /* ---------- суточный профиль ---------- */

  function dayProfile(st) {
    const out = [];
    for (let h = 0; h <= 24; h++) {
      let w = 0;
      // освещение: утро 7-9 и вечер 17-22 (или по датчикам — меньше часов)
      const lit = (h >= 7 && h <= 9) || (h >= 17 && h <= 22);
      const lightFactor = st.sensors.motion ? 0.55 : (st.sensors.light ? 0.8 : 1);
      if (lit) w += lampPower(st) * lightFactor;
      Object.keys(APPLIANCES).forEach(function (k) {
        if (!st.appliances[k]) return;
        const a = APPLIANCES[k];
        if (k === 'fridge') { if (h % 3 === 0) w += a.power; return; }
        if (k === 'kettle' && (h === 8 || h === 18)) { w += a.power; return; }
        if (k === 'pc' && h >= 9 && h <= 17) { w += a.power; return; }
        if (k === 'tv' && h >= 19 && h <= 22) { w += a.power; return; }
        if (k === 'charger') w += st.sensors.schedule ? 0 : a.standby;
        w += st.sensors.schedule ? 0 : a.standby;
      });
      out.push({ h: h, w: w });
    }
    return out;
  }

  function dayTotals(st) {
    const p = dayProfile(st);
    let e = 0;
    for (let i = 1; i < p.length; i++) e += (p[i].w + p[i - 1].w) / 2 / 1000;   // кВт·ч (шаг 1 ч)
    return { kwh: e, cost: e * TARIFF.day, peak: Math.max.apply(null, p.map(function (x) { return x.w; })) };
  }

  /* ---------- шаг модельного времени ---------- */

  function step(st, dtReal, speed) {
    st.t += dtReal;
    st.hour = (st.hour + dtReal * speed * 1.5) % 24;   // 1 модельный час за 40 с при ×1
    const prof = dayProfile(st);
    const idx = Math.round(st.hour) % 24;
    st.totalW = prof[idx] ? prof[idx].w : 0;
    return st;
  }

  /* ---------- факты ---------- */

  function facts(st) {
    const s = savings(st);
    const d = dayTotals(st);
    return {
      lampType: st.lampType,
      sensors: Object.assign({}, st.sensors),
      appliances: Object.assign({}, st.appliances),
      lightKwh: s.now.light,
      totalKwh: s.now.total,
      baseKwh: s.base.total,
      savedKwh: s.savedKwh,
      savedRub: s.savedRub,
      percent: s.percent,
      standbyKwh: s.now.standby,
      dayKwh: d.kwh,
      dayCost: d.cost,
      peakW: d.peak,
      lux: illuminance(st),
      allNorm: illuminance(st).every(function (r) { return r.ok; }),
      retrofit: retrofit(st, 'led'),
      measures: st.measures.slice(),
      dayRuns: st.measures.filter(function (m) { return m.kind === 'day'; }),
      sensorRuns: st.measures.filter(function (m) { return m.kind === 'smart'; }),
      savingsRuns: st.measures.filter(function (m) { return m.kind === 'saving'; }),
      tariff: TARIFF
    };
  }

  /* ---------- задания ---------- */

  const TASKS = [
    {
      t: 'Снизить потребление на 30 %',
      goal: 'Снизьте суточное потребление кабинета на 30 % относительно исходного, не опустив освещённость ниже нормы во всех помещениях.',
      steps: ['Посмотрите исходное потребление и нормы освещённости.', 'Замените лампы и включите датчики.', 'Проверьте процент экономии.'],
      hints: ['Лампа накаливания 60 Вт и светодиодная 9 Вт дают примерно одинаковый поток.',
              'Датчик движения сокращает часы работы освещения на треть.',
              'Норма: кабинет 400 лк, лаборатория 500 лк, коридор 150 лк.'],
      check: function (f) { return f.percent >= 0.3 && f.allNorm; },
      stars: function (f) { return f.percent >= 0.45 && f.allNorm ? 3 : (f.percent >= 0.3 && f.allNorm ? 2 : 1); },
      why: 'Освещение — самая «дешёвая» экономия: современные лампы дают тот же световой поток при мощности в 6–7 раз меньше.'
    },
    {
      t: 'Три лампы при равном свете',
      goal: 'Снимите в протокол три точки — для каждого типа лампы — при сохранении нормы освещённости.',
      steps: ['Переключите тип лампы.', 'Снимите точку в протокол.', 'Повторите для всех трёх типов.'],
      hints: ['Сравнивайте не мощность, а мощность при одинаковом световом потоке.',
              'Светодиодная лампа: 9 Вт ≈ 800 лм ≈ 60 Вт накаливания.',
              'Кнопка «Снять точку» пишет тип лампы, мощность и освещённость.'],
      check: function (f) {
        const types = {};
        f.measures.forEach(function (m) { if (m.lampType) types[m.lampType] = 1; });
        return Object.keys(types).length >= 3;
      },
      stars: function (f) {
        const types = {};
        f.measures.forEach(function (m) { if (m.lampType) types[m.lampType] = 1; });
        return Object.keys(types).length >= 3 ? 3 : 1;
      },
      why: 'Светоотдача: накаливания ~12 лм/Вт, люминесцентная ~50 лм/Вт, светодиодная ~90 лм/Вт. Отсюда и разница в счетах.'
    },
    {
      t: 'Окупаемость замены',
      goal: 'Рассчитайте окупаемость замены всех ламп на светодиодные и зафиксируйте точку с расчётом.',
      steps: ['Выберите светодиодные лампы.', 'Снимите точку с расчётом окупаемости.', 'Сравните срок окупаемости с ресурсом лампы.'],
      hints: ['Окупаемость = стоимость замены / годовая экономия.',
              'Считайте по 10 часам работы в сутки и тарифу 3,2 ₽/кВт·ч.',
              'Если окупаемость меньше года — решение почти всегда выгодно.'],
      check: function (f) { return f.lampType === 'led' && f.savingsRuns.length >= 1; },
      stars: function (f) {
        if (!(f.lampType === 'led' && f.savingsRuns.length >= 1)) return 1;
        return f.retrofit.paybackMonths <= 12 ? 3 : 2;
      },
      why: 'Светодиод дороже при покупке, но потребляет в 6 раз меньше и живёт 25 000 часов. Окупаемость обычно 6–14 месяцев.'
    },
    {
      t: 'Найти «вампиров»',
      goal: 'Определите суммарное потребление в режиме ожидания и снизьте его до нуля умной розеткой.',
      steps: ['Посмотрите вклад standby в протоколе.', 'Включите «умное расписание».', 'Снимите точку с нулевым standby.'],
      hints: ['Даже выключенный телевизор потребляет 8 Вт — это 58 кВт·ч в год.',
              'Умная розетка обесточивает приборы полностью.',
              'Кнопка «Снять точку» пишет вклад ожидания.'],
      check: function (f) { return f.sensors.schedule && f.standbyKwh < 0.01; },
      stars: function (f) { return f.sensors.schedule && f.standbyKwh < 0.01 ? 3 : 1; },
      why: 'Режим ожидания незаметен, но в сумме по квартире даёт 200–400 кВт·ч в год. Умная розетка или выключатель на блоке питания решает вопрос.'
    },
    {
      t: 'Сценарий «умный дом»',
      goal: 'Включите датчики движения и освещённости и снизьте потребление на освещение не менее чем на 35 % при сохранении норм.',
      steps: ['Зафиксируйте исходное потребление освещения.', 'Включите датчики.', 'Снимите точку с новой цифрой.'],
      hints: ['Датчик движения убирает свет там, где никого нет.',
              'Сумеречное реле не даёт светить днём.',
              'Экономия идёт не за счёт лампы, а за счёт часов работы.'],
      check: function (f) { return f.sensors.motion && f.sensors.light && f.allNorm && f.percent >= 0.35; },
      stars: function (f) { return f.percent >= 0.5 && f.allNorm ? 3 : (f.percent >= 0.35 ? 2 : 1); },
      why: 'Автоматика не меняет мощность, она меняет время работы. Датчики и реле — самый дешёвый способ сэкономить без потери комфорта.'
    },
    {
      t: 'Протокол энергоаудита',
      goal: 'Соберите полный протокол: три точки по лампам, две точки по экономии и один прогон суток.',
      steps: ['Снимите точки с разными лампами.', 'Снимите точки с разными настройками экономии.', 'Прогоните сутки и добавьте результат.'],
      hints: ['Протокол — основа защиты проекта: данные, а не ощущения.',
              'Минимум 6 записей разного типа.',
              'Выгрузите CSV и вставьте в отчёт.'],
      check: function (f) { return f.measures.length >= 6 && f.dayRuns.length >= 1; },
      stars: function (f) { return f.measures.length >= 8 && f.dayRuns.length >= 2 ? 3 : 2; },
      why: 'Энергоаудит всегда начинается с измерений: без цифр «до» невозможно доказать эффект «после».'
    }
  ];

  const API = {
    LAMPS: LAMPS, ROOMS: ROOMS, APPLIANCES: APPLIANCES, TARIFF: TARIFF, TASKS: TASKS,
    createState: createState, step: step, facts: facts,
    lampPower: lampPower, lightingHours: lightingHours, lightingEnergy: lightingEnergy,
    illuminance: illuminance, totalEnergy: totalEnergy, baseline: baseline, savings: savings,
    retrofit: retrofit, dayProfile: dayProfile, dayTotals: dayTotals, applianceEnergy: applianceEnergy
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Efficiency = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);

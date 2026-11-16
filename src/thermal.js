/* ============================================================
   Энерджиквантум · thermal.js — стенд «Тепло и газы»
   Модель в духе PhET: Gas Properties, Energy Forms and Changes.
   Не зависит от DOM: тестируется в Node, используется в браузере.
   ============================================================ */
(function (root) {
  'use strict';

  const R = 8.314;            // универсальная газовая постоянная, Дж/(моль·К)
  const C_WATER = 4200;       // удельная теплоёмкость воды, Дж/(кг·К)
  const C_ALU = 900;          // алюминий, Дж/(кг·К)
  const C_IRON = 450;         // железо, Дж/(кг·К)
  const K_B = 1.380649e-23;   // постоянная Больцмана, Дж/К
  const N_A = 6.02214076e23;
  // молярные массы (кг/моль) — в формуле v = √(3kT/m) нужна масса ОДНОЙ молекулы,
  // поэтому делим на число Авогадро
  const MOLAR = { light: 28e-3, heavy: 131e-3 };   // N₂ и Xe

  /* ---------- идеальный газ ---------- */

  function createGas(opts) {
    opts = opts || {};
    return {
      volume: opts.volume || 10,          // объём, л
      temp: opts.temp || 300,             // температура, К
      moles: opts.moles === undefined ? 0.4 : opts.moles,   // количество вещества, моль
      particle: opts.particle || 'light', // сорт частиц
      heatOn: false, powerHeat: 50,       // нагреватель, Вт
      coolOn: false, powerCool: 40,       // охладитель, Вт
      t: 0
    };
  }

  // p = nRT/V — давление в кПа (V в литрах, поэтому 1 л = 1e-3 м³)
  function gasPressure(g) {
    return (g.moles * R * g.temp) / (g.volume * 1e-3) / 1000;
  }

  // средняя кинетическая энергия молекулы и средняя скорость
  function gasMolecule(g) {
    const e = 1.5 * K_B * g.temp;
    const molar = MOLAR[g.particle] || MOLAR.light;
    const m = molar / N_A;                              // масса одной молекулы, кг
    return { energy: e, speed: Math.sqrt((3 * K_B * g.temp) / m), mass: m, molar: molar };
  }

  // внутренняя энергия газа U = 3/2·nRT (одноатомный приближение для оценок)
  function gasInternal(g) { return 1.5 * g.moles * R * g.temp; }

  function stepGas(g, dt) {
    dt = dt || 1 / 60;
    const n = Math.max(0.001, g.moles);
    // теплоёмкость при постоянном объёме: Cv = 3/2·nR (в Дж/К)
    const cV = 1.5 * n * R;
    let dT = 0;
    if (g.heatOn) dT += (g.powerHeat * dt) / cV;
    if (g.coolOn) dT -= (g.powerCool * dt) / cV;
    // остывание к температуре среды (теплообмен со стенками)
    dT -= (g.temp - 300) * 0.02 * dt;
    g.temp = Math.max(1, g.temp + dT);
    g.t += dt;
    return g;
  }

  // изотермический процесс: p₁V₁ = p₂V₂
  function boyle(g, newVolume) {
    const p1 = gasPressure(g);
    const v1 = g.volume;
    const p2 = (p1 * v1) / newVolume;
    return { p1: p1, p2: p2, v1: v1, v2: newVolume, k: p1 * v1 };
  }

  // изобарное расширение: V/T = const
  function charles(g, newTemp) {
    return { v1: g.volume, t1: g.temp, v2: g.volume * newTemp / g.temp, t2: newTemp };
  }

  /* ---------- теплообмен ---------- */

  function createCalorimeter(opts) {
    opts = opts || {};
    return {
      mHot: opts.mHot || 0.2, tHot: opts.tHot || 80,
      mCold: opts.mCold || 0.2, tCold: opts.tCold || 20,
      cHot: opts.cHot || C_WATER, cCold: opts.cCold || C_WATER,
      t: 0, mixed: false, tMix: 0
    };
  }

  // уравнение теплового баланса: c₁m₁(T − t₁) + c₂m₂(T − t₂) = 0
  function mixTemperature(cal) {
    const c1 = cal.cHot * cal.mHot, c2 = cal.cCold * cal.mCold;
    if (c1 + c2 < 1e-9) return cal.tCold;
    return (c1 * cal.tHot + c2 * cal.tCold) / (c1 + c2);
  }

  // энергия для нагрева: Q = cmΔT
  function heatEnergy(c, m, dT) { return c * m * dT; }

  /* ---------- превращения энергии (Energy Forms and Changes) ---------- */

  const SOURCES = {
    sun:      { name: 'Солнечный свет', power: 500, kind: 'light', cost: 0 },
    battery:  { name: 'Батарея',        power: 300, kind: 'electric', cost: 0.30 },
    burner:   { name: 'Горелка',        power: 800, kind: 'chemical', cost: 0.55 },
    hand:     { name: 'Ручной генератор', power: 120, kind: 'mechanical', cost: 0 }
  };

  const DEVICES = {
    heater:   { name: 'Нагреватель',    inKind: 'electric', outKind: 'thermal', eff: 0.98 },
    lamp:     { name: 'Лампа',          inKind: 'electric', outKind: 'light',   eff: 0.95 },
    motor:    { name: 'Мотор',          inKind: 'electric', outKind: 'mechanical', eff: 0.85 },
    panel:    { name: 'Солнечная панель', inKind: 'light', outKind: 'electric', eff: 0.18 },
    kettle:   { name: 'Чайник',         inKind: 'electric', outKind: 'thermal', eff: 0.90 }
  };

  function chainLosses(sourceKey, deviceKey) {
    const src = SOURCES[sourceKey], dev = DEVICES[deviceKey];
    if (!src || !dev) return null;
    const compatible = src.kind === dev.inKind;
    const pIn = compatible ? src.power : 0;
    const pOut = pIn * dev.eff;
    const loss = pIn - pOut;
    return { compatible: compatible, pIn: pIn, pOut: pOut, loss: loss, eff: dev.eff,
      // потери «рассеиваются» в тепло — их видно на схеме
      lossKind: dev.outKind === 'thermal' ? 'нагрев среды' : 'тепло' };
  }

  // сколько времени нужно, чтобы нагреть воду: t = cmΔT / P
  function heatTime(mass, dT, power, c) {
    const q = (c || C_WATER) * mass * dT;
    return power > 0 ? q / power : Infinity;
  }

  /* ---------- задания ---------- */

  const TASKS = [
    {
      t: 'Закон Бойля — Мариотта',
      goal: 'Снимите 3 точки давление–объём при постоянной температуре и убедитесь, что p·V постоянно (расхождение меньше 10 %).',
      steps: ['Поставьте постоянную температуру 300 К.', 'Снимите точку при объёме 10 л.',
        'Уменьшите объём до 5 л и до 2,5 л, снимая точки.'],
      hints: ['При постоянной температуре p·V = const.',
        'Уменьшили объём в 2 раза — давление выросло в 2 раза.',
        'Клапан «постоянная температура» включает изотермический режим.'],
      check: function (f) { return f.boylePoints >= 3 && f.boyleSpread <= 0.1; },
      stars: function (f) { return f.boyleSpread <= 0.05 ? 3 : 2; },
      why: 'pV = nRT: при неизменной температуре произведение давления на объём остаётся постоянным.'
    },
    {
      t: 'Нагрев и давление',
      goal: 'Нагрейте газ от 300 до 600 К при постоянном объёме и убедитесь, что давление выросло примерно в 2 раза.',
      steps: ['Включите нагреватель.', 'Дождитесь 600 К и снимите точку.', 'Сравните давление с исходным.'],
      hints: ['При постоянном объёме p/T = const (закон Шарля).',
        'Удвоение температуры в кельвинах даёт удвоение давления.',
        'Скорость нагрева зависит от мощности нагревателя.'],
      check: function (f) { return f.charlesRatio >= 1.7 && f.charlesRatio <= 2.3; },
      stars: function (f) { return f.charlesRatio >= 1.85 && f.charlesRatio <= 2.15 ? 3 : 2; },
      why: 'p = nRT/V: давление пропорционально абсолютной температуре, если объём не меняется.'
    },
    {
      t: 'Тяжёлые и лёгкие молекулы',
      goal: 'Снимите среднюю скорость молекул при одной температуре для двух сортов частиц и сравните с формулой v = √(3kT/m).',
      steps: ['Снимите точку с лёгкими частицами (N₂).', 'Переключите сорт на тяжёлые (Xe), повторите.',
        'Сравните скорости: тяжёлые должны двигаться медленнее.'],
      hints: ['Тяжёлая молекула при той же температуре медленнее: v ~ 1/√m.',
        'Масса Xe ≈ 131 а.е.м., N₂ ≈ 28 а.е.м.',
        'Отношение скоростей должно быть около √(131/28) ≈ 2,2.'],
      check: function (f) { return f.particleKinds >= 2 && f.speedMassRatio >= 1.7; },
      stars: function (f) { return f.speedMassRatio >= 2.0 && f.speedMassRatio <= 2.4 ? 3 : 2; },
      why: 'Средняя кинетическая энергия зависит только от температуры, поэтому тяжёлые молекулы медленнее: v = √(3kT/m).'
    },
    {
      t: 'Тепловой баланс',
      goal: 'Смешайте 0,2 кг воды при 80 °C и 0,2 кг при 20 °C — температура смеси должна быть 50 °C (отклонение меньше 2 °C).',
      steps: ['Задайте горячую воду 0,2 кг · 80 °C.', 'Холодную — 0,2 кг · 20 °C.',
        'Смешайте и снимите точку.'],
      hints: ['Тепло, отданное горячей водой, равно теплу, принятому холодной.',
        'При равных массах и теплоёмкостях T = (t₁ + t₂)/2.',
        'Если массы разные, средняя температура смещается к массе с большей теплоёмкостью.'],
      check: function (f) { return f.mixPoints >= 1 && Math.abs(f.mixTemp - 50) <= 2; },
      stars: function (f) { return Math.abs(f.mixTemp - 50) <= 0.5 ? 3 : 2; },
      why: 'Уравнение теплового баланса: c₁m₁(T₁ − T) = c₂m₂(T − T₂). Энергия переходит, но не исчезает.'
    },
    {
      t: 'Сколько энергии на чайник',
      goal: 'Нагрейте 1 кг воды от 20 до 100 °C и проверьте, что нужно около 336 кДж энергии.',
      steps: ['Масса воды 1 кг, начальная температура 20 °C.', 'Включите нагреватель 1000 Вт.',
        'Снимите точку и сравните Q с расчётом.'],
      hints: ['Q = cmΔT = 4200 · 1 · 80 ≈ 336 кДж.',
        'Время нагрева = Q / P: при 1000 Вт это около 5,6 минуты.',
        'Часть энергии уходит в среду — потери видны на схеме.'],
      check: function (f) { return f.heatPoints >= 1 && Math.abs(f.heatEnergy - 336000) / 336000 <= 0.1; },
      stars: function (f) { return Math.abs(f.heatEnergy - 336000) / 336000 <= 0.05 ? 3 : 2; },
      why: 'Количество теплоты Q = cmΔT: чтобы нагреть литр воды на 80 градусов, нужно около 336 кДж.'
    },
    {
      t: 'Цепочка превращений',
      goal: 'Соберите цепочку «свет → электричество → тепло» с КПД не ниже 15 % и снимите точку.',
      steps: ['Поставьте источник «Солнечный свет».', 'Подключите солнечную панель, затем нагреватель.',
        'Снимите точку и посмотрите на итоговый КПД.'],
      hints: ['Панель отдаёт около 18 % энергии света в виде электричества.',
        'Нагреватель почти всю электроэнергию превращает в тепло (КПД около 98 %).',
        'Итоговый КПД цепочки равен произведению КПД звеньев.'],
      check: function (f) { return f.chainPoints >= 1 && f.chainEff >= 0.15; },
      stars: function (f) { return f.chainEff >= 0.17 ? 3 : 2; },
      why: 'Каждое звено теряет часть энергии: при последовательном соединении КПД перемножаются.'
    },
    {
      t: 'Где потери',
      goal: 'Сравните две цепочки — «батарея → лампа» и «батарея → мотор» — и найдите ту, где потерь меньше.',
      steps: ['Соберите цепочку с лампой, снимите точку.', 'Соберите с мотором, снимите точку.',
        'Сравните потери в ваттах.'],
      hints: ['Лампа отдаёт 95 % энергии светом, мотор — 85 % механической работой.',
        'Остальное превращается в тепло и рассеивается.',
        'КПД — это отношение полезной мощности к затраченной.'],
      check: function (f) { return f.chainPoints >= 2 && f.bestEff >= 0.94; },
      stars: function (f) { return f.bestEff >= 0.95 ? 3 : 2; },
      why: 'Даже у хорошего устройства часть энергии уходит в тепло: КПД всегда меньше 100 %.'
    },
    {
      t: 'Изотерма на графике',
      goal: 'Снимите 4 точки p–V при постоянной температуре — на графике должна получиться гипербола, а p·V остаться постоянным.',
      steps: ['Температура 300 К, объём от 12 л до 3 л.', 'Снимайте точку на каждом шаге объёма.',
        'Проверьте, что все точки лежат на одной гиперболе.'],
      hints: ['Гипербола p = const/V.',
        'Чем меньше объём, тем круче кривая.',
        'Разброс p·V меньше 5 % — отличный результат.'],
      check: function (f) { return f.boylePoints >= 4 && f.boyleSpread <= 0.05; },
      stars: function (f) { return f.boylePoints >= 5 && f.boyleSpread <= 0.03 ? 3 : 2; },
      why: 'Изотерма идеального газа в координатах p–V — гипербола: pV = nRT = const.'
    }
  ];

  /* ---------- сессия измерений ---------- */

  function createLab() {
    return { measures: [], gas: createGas(), cal: createCalorimeter(), source: 'battery', device: 'heater' };
  }

  function facts(lab) {
    const m = lab.measures || [];
    const byKind = function (k) { return m.filter(function (r) { return r.kind === k; }); };
    const gas = byKind('gas');
    const mix = byKind('mix');
    const heat = byKind('heat');
    const chain = byKind('chain');
    const part = byKind('particle');
    const f = { measures: m.length, gasPoints: gas.length, mixPoints: mix.length };

    // Бойль — Мариотт
    const pv = gas.map(function (r) { return r.p * r.v; });
    f.boylePoints = pv.length;
    f.boyleSpread = pv.length >= 2
      ? (Math.max.apply(null, pv) - Math.min.apply(null, pv)) / Math.max.apply(null, pv) : 1;

    // Шарль: отношение давлений при нагреве
    f.charlesRatio = 0;
    if (gas.length >= 2) {
      const cold = gas.reduce(function (a, b) { return b.t < a.t ? b : a; }, gas[0]);
      const hot = gas.reduce(function (a, b) { return b.t > a.t ? b : a; }, gas[0]);
      // привод к одной температуре: p/T должно быть постоянным, поэтому
      // ожидаемое отношение давлений = отношение температур
      f.charlesRatio = cold.t > 1 ? (hot.p / cold.p) * (cold.t / hot.t) * (hot.t / cold.t) : 0;
      f.charlesRatio = cold.t > 1 ? (hot.p / cold.p) / (hot.t / cold.t) * (hot.t / cold.t) : 0;
      f.charlesRatio = cold.t > 1 ? hot.p / cold.p : 0;
    }

    // молекулы
    f.particleKinds = Object.keys((function () {
      const o = {}; part.forEach(function (r) { o[r.particle] = r.speed; }); return o;
    })()).length;
    const sp = {};
    part.forEach(function (r) { sp[r.particle] = r.speed; });
    const spv = Object.keys(sp).map(function (k) { return sp[k]; });
    f.speedMassRatio = spv.length >= 2 ? Math.max.apply(null, spv) / Math.min.apply(null, spv) : 0;

    // тепловой баланс
    f.mixTemp = mix.length ? mix[mix.length - 1].tMix : 0;

    // нагрев воды
    f.heatPoints = heat.length;
    f.heatEnergy = heat.length ? heat[heat.length - 1].q : 0;

    // цепочки превращений
    f.chainPoints = chain.length;
    f.chainEff = chain.length ? chain[chain.length - 1].eff : 0;
    f.bestEff = chain.length ? Math.max.apply(null, chain.map(function (r) { return r.eff; })) : 0;
    return f;
  }

  const API = {
    R: R, N_A: N_A, K_B: K_B, C_WATER: C_WATER, C_ALU: C_ALU, C_IRON: C_IRON,
    SOURCES: SOURCES, DEVICES: DEVICES, TASKS: TASKS, MOLAR: MOLAR,
    createGas: createGas,
    gasPressure: gasPressure,
    gasMolecule: gasMolecule,
    gasInternal: gasInternal,
    stepGas: stepGas,
    boyle: boyle,
    charles: charles,
    createCalorimeter: createCalorimeter,
    mixTemperature: mixTemperature,
    heatEnergy: heatEnergy,
    heatTime: heatTime,
    chainLosses: chainLosses,
    createLab: createLab,
    facts: facts
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Thermal = API;
})(typeof window !== 'undefined' ? window : globalThis);

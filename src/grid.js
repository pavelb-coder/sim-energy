/* ============================================================
   Энерджиквантум · grid.js
   Модель стенда «Микросеть»: солнце + ветер + накопитель + сеть + зарядка EV.
   Не зависит от DOM — тестируется в Node.
   ============================================================ */
(function (root) {
  'use strict';

  const LAT = 56.0;                 // Красноярск
  const D2R = Math.PI / 180;

  const PV = {
    kwp: { min: 0.5, max: 8, step: 0.5 },
    derate: 0.86,                   // инвертор + провода + загрязнение
    tempCoeff: -0.004,              // −0,4 %/°C
    noct: 45                        // °C при 800 Вт/м²
  };

  const WIND = {
    cutIn: 3, cutOut: 22, rated: 11,
    shear: 0.14,                    // показатель степени профиля ветра
    refHeight: 10
  };

  const BATTERY = {
    eff: 0.95,                      // КПД заряда/разряда
    minSoc: 0.05,                   // нижняя граница, чтобы не гробить АКБ
    maxSoc: 1.0
  };

  const TARIFF = { day: 5.2, night: 2.6, feedIn: 2.2, dayStart: 7, dayEnd: 23 };
  const CO2 = { grid: 0.42, gas: 0.20 };   // кг CO₂ на кВт·ч

  const GAS = { kw: 1.0, eff: 0.28, fuelCost: 0.09 };  // ₽ за кВт·ч электричества от ДГУ

  function createState() {
    return {
      t: 0,
      hour: 12,                    // модельный час суток
      dayOfYear: 172,              // 21 июня
      cloud: 0.2,                  // 0 — ясно, 1 — сплошная облачность
      pvKwp: 3,
      tilt: 40,
      azimuth: 0,                  // 0 — на юг, «−» на восток, «+» на запад
      pvTemp: 25,
      windRated: 2,                // номинальная мощность ветрогенератора, кВт
      windHub: 12,                 // высота оси, м
      windRef: 6,                  // скорость ветра на 10 м, м/с
      batteryKwh: 5,
      batteryMaxP: 2.5,            // кВт
      soc: 0.5,
      baseLoad: 1.2,               // кВт (бытовой профиль)
      evOn: false,
      evPower: 7,                  // кВт (зарядка электромобиля)
      evStart: 19,
      evEnd: 23,
      island: false,               // островной режим (сеть отключена)
      gasOn: false,                // резервный генератор
      // накопленные за модель значения
      energyGen: 0, energyLoad: 0, energyImport: 0, energyExport: 0,
      energyUnserved: 0, energyCurtailed: 0, cost: 0,
      log: []
    };
  }

  /* ---------------- солнце ---------------- */
  function declination(dayOfYear) {
    return 23.44 * Math.sin(D2R * 360 * (284 + dayOfYear) / 365);
  }

  function sunPosition(dayOfYear, hour) {
    const dec = declination(dayOfYear) * D2R;
    const hourAngle = (hour - 12) * 15 * D2R;
    const lat = LAT * D2R;
    const sinElev = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle);
    const elev = Math.asin(Math.max(-1, Math.min(1, sinElev)));
    const cosAz = (Math.sin(dec) - Math.sin(elev) * Math.sin(lat)) /
      (Math.cos(elev) * Math.cos(lat) || 1e-6);
    const acosAz = Math.acos(Math.max(-1, Math.min(1, cosAz))) / D2R;    // 0…180
    // до полудня солнце на востоке, после — на западе
    const azNorth = hourAngle > 0 ? 360 - acosAz : acosAz;               // от севера
    // азимут: 0 — юг, отрицательный — восток, положительный — запад
    const az = azNorth - 180;
    return { elev: elev, elevDeg: elev / D2R, azimuth: az };
  }

  // освещённость на горизонтальной площадке, Вт/м²
  function irradiance(st) {
    const s = sunPosition(st.dayOfYear, st.hour);
    const clear = 1000 * Math.max(0, Math.sin(s.elev));
    const cloudy = clear * (1 - 0.72 * Math.pow(Math.max(0, Math.min(1, st.cloud)), 1.4));
    return { G: cloudy, clearG: clear, sun: s };
  }

  // мощность солнечной панели с учётом наклона, азимута и нагрева
  function pvPower(st) {
    return pvFrom(st, irradiance(st));
  }

  function pvFrom(st, ir) {
    if (ir.G <= 1) return 0;
    const s = ir.sun;
    const tilt = st.tilt * D2R;
    const panelAz = st.azimuth;
    // косинус угла падения через разность азимутов
    const azDiff = (s.azimuth - panelAz) * D2R;
    const cosInc = Math.cos(s.elev) * Math.sin(tilt) * Math.cos(azDiff) +
      Math.sin(s.elev) * Math.cos(tilt);
    // освещённость на плоскости панели: без деления на синус (иначе при низком солнце она завышается)
    const poa = ir.G * Math.max(0, cosInc);
    const G = Math.min(ir.clearG * 1.1, Math.max(0, poa));
    const cellT = st.pvTemp + (PV.noct - 20) / 800 * G;
    const fTemp = 1 + PV.tempCoeff * (cellT - 25);
    return Math.max(0, st.pvKwp * (G / 1000) * PV.derate * fTemp);
  }

  /* ---------------- ветер ---------------- */
  function windSpeed(st) {
    const h = Math.max(2, st.windHub);
    return Math.max(0, st.windRef) * Math.pow(h / WIND.refHeight, WIND.shear);
  }

  function windPower(st) {
    const v = windSpeed(st);
    if (v < WIND.cutIn || v > WIND.cutOut) return 0;
    if (v >= WIND.rated) return st.windRated;
    return st.windRated * Math.pow((v - WIND.cutIn) / (WIND.rated - WIND.cutIn), 3);
  }

  /* ---------------- нагрузка ---------------- */
  function loadProfile(hour) {
    const h = ((hour % 24) + 24) % 24;
    // утренний и вечерний пики
    const morning = Math.exp(-Math.pow((h - 8) / 1.9, 2)) * 0.75;
    const evening = Math.exp(-Math.pow((h - 19.5) / 2.6, 2)) * 1.0;
    const night = h < 6 ? 0.28 : 1;
    const day = h >= 9 && h <= 17 ? 0.62 : 1;
    return night * day + morning + evening;
  }

  function evActive(st) {
    if (!st.evOn) return false;
    const h = ((st.hour % 24) + 24) % 24;
    const a = ((st.evStart % 24) + 24) % 24;
    const b = ((st.evEnd % 24) + 24) % 24;
    return a <= b ? (h >= a && h < b) : (h >= a || h < b);   // окно может переходить через полночь
  }

  function loadPower(st) {
    const base = st.baseLoad * loadProfile(st.hour);
    return base + (evActive(st) ? st.evPower : 0);
  }

  /* ---------------- диспетчеризация ---------------- */
  function priceAt(hour) {
    const h = ((hour % 24) + 24) % 24;
    return (h >= TARIFF.dayStart && h < TARIFF.dayEnd) ? TARIFF.day : TARIFF.night;
  }

  // мгновенный баланс без изменения состояния
  function balance(st) {
    const ir = irradiance(st);
    return dispatch(st, pvFrom(st, ir), windPower(st), loadPower(st), windSpeed(st), priceAt(st.hour));
  }

  // диспетчеризация при уже известных выработке и нагрузке (без повторного расчёта солнца)
  function dispatch(st, pv, wind, load, vWind, price) {
    const gen = pv + wind;
    const net = gen - load;
    const capKwh = Math.max(0.1, st.batteryKwh);
    const maxP = Math.max(0, st.batteryMaxP);
    let batt = 0, gridImport = 0, gridExport = 0, curtail = 0, unserved = 0, gas = 0;

    if (net >= 0) {
      const room = (BATTERY.maxSoc - st.soc) * capKwh;         // сколько ещё влезет, кВт·ч
      // при заряженной батарее излишек сразу уходит в сеть или ограничивается
      batt = room < 1e-3 ? 0 : Math.min(net, maxP, room / 0.25);
      const rest = net - batt;
      if (st.island) curtail = rest;
      else gridExport = rest;
    } else {
      const need = -net;
      const avail = Math.max(0, (st.soc - BATTERY.minSoc)) * capKwh;
      batt = avail < 1e-3 ? 0 : -Math.min(need, maxP, avail * 60);
      const rest = need + batt;
      if (st.gasOn) gas = Math.min(GAS.kw, rest);
      const rest2 = rest - gas;
      if (st.island) unserved = rest2;
      else gridImport = rest2;
    }
    return {
      pv: pv, wind: wind, gen: gen, load: load, net: net,
      batt: batt, gridImport: gridImport, gridExport: gridExport,
      curtail: curtail, unserved: unserved, gas: gas,
      soc: st.soc, vWind: vWind === undefined ? windSpeed(st) : vWind,
      price: price === undefined ? priceAt(st.hour) : price
    };
  }

  function step(st, dtHours) {
    const dt = Math.max(0, dtHours);
    const b = balance(st);
    st.t += dt * 3600;
    st.hour += dt;
    while (st.hour >= 24) st.hour -= 24;

    const capKwh = Math.max(0.1, st.batteryKwh);
    if (b.batt > 0) {
      st.soc = Math.min(BATTERY.maxSoc, st.soc + b.batt * dt * BATTERY.eff / capKwh);
    } else if (b.batt < 0) {
      st.soc = Math.max(0, st.soc + b.batt * dt / BATTERY.eff / capKwh);
    }

    st.energyGen += b.gen * dt;
    st.energyLoad += b.load * dt;
    st.energyImport += b.gridImport * dt;
    st.energyExport += b.gridExport * dt;
    st.energyUnserved += b.unserved * dt;
    st.energyCurtailed += b.curtail * dt;
    st.cost += (b.gridImport * priceAt(st.hour) - b.gridExport * TARIFF.feedIn + b.gas * GAS.fuelCost) * dt;
    return st;
  }

  /* ---------------- сутки целиком ---------------- */
  // кэш суточных прогонов: ключ — все настройки, влияющие на сутки.
  // simulateDay вызывается из facts() десятки раз за кадр, считать каждый раз заново незачем.
  const dayCache = new Map();
  function dayKeyOf(st, startHour, stepMin) {
    return [startHour, stepMin, st.dayOfYear, st.cloud, st.tilt, st.azimuth, st.pvKwp, st.pvTemp,
      st.windRef, st.windHub, st.windRated, st.baseLoad, st.batteryKwh, st.batteryMaxP,
      Math.round(st.soc * 100), st.gasOn, st.island, st.evOn, st.evStart, st.evEnd, st.evPower].join('|');
  }

  function simulateDay(st, startHour, stepMin) {
    const key = dayKeyOf(st, startHour, stepMin);
    const hit = dayCache.get(key);
    if (hit) return hit;
    const out = simulateDayCalc(st, startHour, stepMin);
    if (dayCache.size > 120) dayCache.clear();
    dayCache.set(key, out);
    return out;
  }

  function simulateDayCalc(st, startHour, stepMin) {
    const s = Object.assign({}, st);
    s.hour = startHour === undefined ? 0 : startHour;
    const dt = (stepMin || 15) / 60;
    const out = {
      pv: 0, wind: 0, load: 0, gen: 0, gridImport: 0, gridExport: 0,
      unserved: 0, curtail: 0, gas: 0, cost: 0, co2: 0, socEnd: s.soc, minSoc: s.soc,
      series: []
    };
    let socc = s.soc;
    const capKwh = Math.max(0.1, s.batteryKwh);
    for (let k = 0; k < Math.round(24 / dt); k++) {
      s.hour = (startHour === undefined ? 0 : startHour) + k * dt;
      const ir = irradiance(s);
      s.soc = socc;
      const b = dispatch(s, pvFrom(s, ir), windPower(s), loadPower(s), windSpeed(s), priceAt(s.hour));
      // интегрируем заряд
      if (b.batt > 0) socc = Math.min(BATTERY.maxSoc, socc + b.batt * dt * BATTERY.eff / capKwh);
      else if (b.batt < 0) socc = Math.max(0, socc + b.batt * dt / BATTERY.eff / capKwh);
      out.pv += b.pv * dt; out.wind += b.wind * dt; out.load += b.load * dt;
      out.gen += b.gen * dt;
      out.gridImport += b.gridImport * dt; out.gridExport += b.gridExport * dt;
      out.unserved += b.unserved * dt; out.curtail += b.curtail * dt; out.gas += b.gas * dt;
      out.cost += (b.gridImport * priceAt(s.hour) - b.gridExport * TARIFF.feedIn + b.gas * GAS.fuelCost) * dt;
      out.co2 += (b.gridImport * CO2.grid + b.gas * CO2.gas) * dt;
      out.minSoc = Math.min(out.minSoc, socc);
      out.series.push({
        hour: s.hour, pv: b.pv, wind: b.wind, load: b.load,
        batt: b.batt, grid: b.gridImport - b.gridExport, soc: socc
      });
    }
    out.socEnd = socc;
    out.selfUse = out.gen > 0.01 ? Math.max(0, Math.min(1, (out.gen - out.gridExport - out.curtail) / out.gen)) : 0;
    out.renewShare = out.load > 0.01 ? Math.max(0, Math.min(1, (out.load - out.gridImport - out.gas - out.unserved) / out.load)) : 0;
    return out;
  }

  // сколько стоит зарядка электромобиля в заданном окне: разница суток с EV и без него
  function evMarginal(st, start, end) {
    const withEv = simulateDay(Object.assign({}, st, { evOn: true, evStart: start, evEnd: end }), 0, 15);
    const noEv = simulateDay(Object.assign({}, st, { evOn: false }), 0, 15);
    const energy = Math.max(0.01, withEv.load - noEv.load);
    const cost = withEv.cost - noEv.cost;
    return { energy: energy, cost: cost, price: cost / energy, day: withEv };
  }

  // базовый вариант «до модернизации»: только сеть, без ВИЭ и АКБ
  function baselineDay(st) {
    const s = Object.assign({}, st, {
      pvKwp: 0, windRated: 0, batteryKwh: 0.1, soc: 0, gasOn: false, island: false
    });
    const d = simulateDay(s, 0, 15);
    d.co2 = d.load * CO2.grid;
    d.cost = d.load * 0 + (() => { // считаем по тарифу в каждом шаге
      let c = 0;
      const s2 = Object.assign({}, s);
      for (let k = 0; k < 96; k++) {
        s2.hour = k * 0.25;
        c += loadPower(s2) * priceAt(s2.hour) * 0.25;
      }
      return c;
    })();
    return d;
  }

  /* ---------------- задания ---------------- */
  const TASKS = [
    {
      t: 'Сбалансировать сутки',
      goal: 'Добейтесь, чтобы за сутки не было невыданной энергии (0 кВт·ч) и расход из сети не превышал 6 кВт·ч.',
      steps: ['Подберите мощность панелей под дневной профиль.', 'Добавьте ветрогенератор для вечера и ночи.',
        'Поставьте накопитель (батарею), чтобы перекрыть вечерний пик.'],
      hints: ['Начните с 3–4 кВт панелей и ветряка 2 кВт.',
        'Аккумулятор на 5–10 кВт·ч снимает вечерний пик нагрузки.',
        'Следите за строкой «Из сети» на панели показаний.'],
      check: function (f) { return f.day.unserved < 0.01 && f.day.gridImport <= 6; },
      stars: function (f) { return f.day.unserved < 0.01 && f.day.gridImport <= 2 ? 3 : (f.day.gridImport <= 4 ? 2 : 1); },
      why: 'Микросеть работает, когда выработка закрывает нагрузку в каждый момент: днём солнце, вечером — ветер и батарея.'
    },
    {
      t: 'Собственное потребление',
      goal: 'Доведите долю собственного потребления выработки до 70 % (выработка не уходит в сеть зря).',
      steps: ['Посмотрите суточную выработку и отдачу в сеть.', 'Уменьшите мощность ВИЭ, если выработка избыточна.',
        'Добавьте накопитель, чтобы запасать излишки.'],
      hints: ['Если отдача в сеть больше трети выработки — источник слишком мощный.',
        'Накопитель повышает собственное потребление сильнее, чем рост панелей.'],
      check: function (f) { return f.day.selfUse >= 0.7; },
      stars: function (f) { return f.day.selfUse >= 0.9 ? 3 : (f.day.selfUse >= 0.8 ? 2 : 1); },
      why: 'Собственное потребление = (выработка − отдача в сеть − ограничение) / выработка. Чем оно выше, тем выгоднее установка.'
    },
    {
      t: 'Автономность',
      goal: 'В островном режиме (сеть отключена) продержитесь сутки без отключений нагрузки.',
      steps: ['Включите островной режим.', 'Настройте накопитель и резервный генератор.',
        'Проверьте, что невыданной энергии нет.'],
      hints: ['В островном режиме излишек не отдаётся в сеть, а ограничивается.',
        'Небольшой резервный генератор закрывает редкие провалы.'],
      check: function (f) { return f.st.island && f.day.unserved < 0.01; },
      stars: function (f) { return f.st.island && f.day.unserved < 0.01 && !f.st.gasOn ? 3 : 2; },
      why: 'Островная микросеть живёт только на своей выработке и накопителе: баланс должен сходиться в каждом получасовом интервале.'
    },
    {
      t: 'Ночной тариф',
      goal: 'Включите зарядку электромобиля ночью (с 23 до 7) — стоимость суток должна быть ниже, чем при заряде вечером.',
      steps: ['Задайте окно зарядки EV: 23 → 7.', 'Сравните стоимость с вечерним окном (19 → 23).',
        'Проверьте, что пик нагрузки не превышает мощность батареи и сети.'],
      hints: ['Ночью тариф 2,6 ₽, днём и вечером — 5,2 ₽.',
        'Ночью же обычно дует ветер — часть зарядки закроет ветрогенератор.'],
      check: function (f) {
        const night = ((f.st.evStart % 24) + 24) % 24;
        return f.st.evOn && (night >= 22 || night < 6) && f.evNight.price < f.evEvening.price * 0.75;
      },
      stars: function (f) {
        const k = f.evEvening.price > 0 ? f.evNight.price / f.evEvening.price : 1;
        return k <= 0.55 ? 3 : (k <= 0.65 ? 2 : 1);
      },
      why: 'Сдвиг мощной нагрузки на ночной тариф — самый дешёвый способ снизить счёт: он не требует нового оборудования.'
    },
    {
      t: 'Меньше CO₂',
      goal: 'Снизьте суточные выбросы CO₂ не меньше чем на 40 % относительно варианта «только сеть».',
      steps: ['Посмотрите базовый вариант: сколько CO₂ даёт сеть.', 'Добавьте ВИЭ и накопитель.',
        'Сравните выбросы на панели экологии.'],
      hints: ['Каждый кВт·ч из сети — это 0,42 кг CO₂.',
        'Резервный генератор тоже даёт выбросы (0,20 кг/кВт·ч), но меньше сетевых.'],
      check: function (f) { return f.co2Cut >= 0.4; },
      stars: function (f) { return f.co2Cut >= 0.7 ? 3 : (f.co2Cut >= 0.55 ? 2 : 1); },
      why: 'Выбросы считаются по энергии, взятой из сети и от генератора; собственная выработка ВИЭ считается нулевой.'
    },
    {
      t: 'Вечерний пик',
      goal: 'Пройдите вечерний пик (18–22 ч) без импорта из сети больше 0,5 кВт·ч.',
      steps: ['Увеличьте накопитель.', 'Поднимите ветрогенератор или его высоту.',
        'Не включайте EV в вечерний пик.'],
      hints: ['Пик нагрузки — около 19–20 часов, солнца в это время почти нет.',
        'Высота оси ветряка даёт прибавку: скорость растёт как h^0,14.'],
      check: function (f) {
        const eve = f.eveningImport;
        return eve !== undefined && eve <= 0.5;
      },
      stars: function (f) { return f.eveningImport <= 0.15 ? 3 : (f.eveningImport <= 0.3 ? 2 : 1); },
      why: 'Вечерний пик — самый дорогой и самый углеродоёмкий период. Его закрывают накопитель и ветер.'
    }
  ];

  /* ---------------- факты для UI ---------------- */
  function facts(st) {
    // уже снятые точки (нужны лабораторным работам по методике измерений)
    const meas = (st.meas || []).map(function (m) {
      return { hour: m.hour, gen: m.gen, load: m.load, imp: m.imp, exp: m.exp, soc: m.soc, cloud: m.cloud, tilt: m.tilt };
    });
    const cloudKeys = {}, tiltKeys = {};
    meas.forEach(function (m) {
      if (typeof m.cloud === 'number') cloudKeys[Math.round(m.cloud * 10)] = 1;
      if (typeof m.tilt === 'number') tiltKeys[Math.round(m.tilt / 10) * 10] = 1;
    });
    const b = balance(st);
    const day = simulateDay(st, 0, 15);
    const base = baselineDay(st);
    // импорт из сети за вечерний пик
    const s2 = Object.assign({}, st);
    let eveningImport = 0;
    for (let k = 0; k < 16; k++) {           // 18:00 … 22:00 шагом 15 мин
      s2.hour = 18 + k * 0.25;
      const bb = balance(s2);
      eveningImport += bb.gridImport * 0.25;
    }
    // стоимость зарядки в ночном и вечернем окнах
    const evNight = evMarginal(st, 23, 7);
    const evEvening = evMarginal(st, 19, 23);
    const co2Base = base.load * CO2.grid;
    return {
      t: st.t, hour: st.hour, st: st,
      pv: b.pv, wind: b.wind, gen: b.gen, load: b.load, net: b.net,
      batt: b.batt, gridImport: b.gridImport, gridExport: b.gridExport,
      unserved: b.unserved, curtail: b.curtail, gas: b.gas,
      soc: st.soc, vWind: b.vWind, price: b.price,
      day: day, base: base,
      eveningImport: eveningImport,
      co2Cut: co2Base > 0.01 ? Math.max(0, 1 - day.co2 / co2Base) : 0,
      co2Day: day.co2, co2Base: co2Base,
      evNight: evNight, evEvening: evEvening,
      evNightCost: evNight.cost, evDayCost: evEvening.cost,
      evNightSaving: Math.max(0, (evEvening.price - evNight.price) * evNight.energy),
      selfUse: day.selfUse, renewShare: day.renewShare,
      measCount: meas.length,
      meas: meas,
      cloudPoints: Object.keys(cloudKeys).length,
      tiltPoints: Object.keys(tiltKeys).length,
      warnings: (function () {
        const w = [];
        if (day.unserved > 0.01) w.push('Невыданная энергия: ' + day.unserved.toFixed(2) + ' кВт·ч');
        if (st.soc < 0.1) w.push('Батарея почти пуста');
        if (b.curtail > 0.05) w.push('Излишек ограничивается: ' + (b.curtail * 1000).toFixed(0) + ' Вт');
        if (st.windRef > 20) w.push('Штормовой ветер — генератор остановлен');
        return w;
      })()
    };
  }

  // ---------- лабораторные работы: методика измерений ----------
  TASKS.push({
    t: 'Облачность и выработка',
    goal: 'Снимите точки при трёх разных уровнях облачности (полдень, небо от ясного до пасмурного) и убедитесь, что мощность панели падает.',
    steps: ['Поставьте время 12:00 и ясную погоду, снимите точку.', 'Повторите при облачности 50 % и 100 %.',
      'Сравните выработку в протоколе.'],
    hints: ['Ползунок «Облачность» задаёт долю закрытого неба.',
      'Кнопка «Снять точку» пишет строку в журнал и протокол.',
      'Разница между ясно и пасмурно — примерно в 5 раз.'],
    check: function (f) { return f.cloudPoints >= 3; },
    stars: function (f) { return f.cloudPoints >= 4 ? 3 : 2; },
    why: 'Мощность панели пропорциональна освещённости: облака рассеивают свет, и выработка падает почти линейно.'
  });
  TASKS.push({
    t: 'Оптимальный наклон',
    goal: 'Снимите точки при трёх разных углах наклона панели и найдите угол, при котором выработка максимальна.',
    steps: ['Полдень, ясно, наклон 0° — снимите точку.', 'Повторите при 35° и 65°.', 'Сравните мощность.'],
    hints: ['Оптимальный наклон летом в полдень близок к 35–40°, зимой — к 60°.',
      'Разница между «плашмя» и оптимальным углом — до 30 %.',
      'Смотрите на карточку «Выработка» после каждого снятия точки.'],
    check: function (f) { return f.tiltPoints >= 3; },
    stars: function (f) {
      if (f.tiltPoints < 3) return 0;
      const m = f.meas || [];
      const best = m.filter(function (x) { return x.tilt >= 30 && x.tilt <= 45; });
      return best.length ? 3 : 2;
    },
    why: 'Наклон выбирают так, чтобы лучи падали перпендикулярно панели: летом угол меньше, зимой больше.'
  });

  const API = {
    LAT: LAT, PV: PV, WIND: WIND, BATTERY: BATTERY, TARIFF: TARIFF, CO2: CO2, GAS: GAS,
    TASKS: TASKS,
    createState: createState, step: step, facts: facts,
    sunPosition: sunPosition, irradiance: irradiance, pvPower: pvPower,
    windSpeed: windSpeed, windPower: windPower, loadProfile: loadProfile, loadPower: loadPower,
    evActive: evActive, priceAt: priceAt, balance: balance,
    simulateDay: simulateDay, baselineDay: baselineDay, evMarginal: evMarginal
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Grid = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);

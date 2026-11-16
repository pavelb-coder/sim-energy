/* ============================================================
   Энерджиквантум · Виртуальная лаборатория
   renewables.js — модель и интерфейс стенда «Возобновляемая энергетика»
   Модель не зависит от DOM и тестируется в Node.
   ============================================================ */
(function (root) {
  'use strict';

  const LAT = 56 * Math.PI / 180;      // широта Красноярска
  const RHO = 1.225;                   // плотность воздуха, кг/м³
  const PANEL_A = 0.67;                // площадь модуля, м² (100 Вт при 1000 Вт/м²)
  const PANEL_ETA = 0.15;              // КПД модуля
  const TURB_D = 0.60;                 // диаметр ротора, м
  const TURB_RATED = 150;              // номинальная мощность, Вт
  const CUT_IN = 2.5, CUT_OUT = 16;    // рабочий диапазон ветра, м/с
  const CP_BY_BLADES = { 2: 0.30, 3: 0.40, 5: 0.34 };
  const EFF_CONTROLLER = { pwm: 0.78, mppt: 0.95 };

  const LOADS = {
    lamp: { name: 'Лампа', power: 10 },
    pump: { name: 'Насос', power: 40 },
    router: { name: 'Роутер', power: 8 }
  };

  function createState() {
    return {
      hour: 13.0,              // модельное время, ч
      day: 172,                // 172 = 21 июня, 355 = 21 декабря
      tilt: 0,                 // наклон панели от горизонта, °
      azimuth: -55,            // азимут панели: 0 = юг, + = запад, − = восток
      cloud: 0,                // 0 — ясно, 1 — плотная облачность
      wind: 6,                 // скорость ветра, м/с
      blades: 3,
      controller: 'mppt',
      loads: { lamp: true, pump: false, router: false },
      capacity: 200,           // ёмкость АКБ, Вт·ч
      soc: 0.35,               // 0…1
      energyGen: 0,            // выработано за сессию, Вт·ч
      energyUsed: 0,
      dayStart: 13.0,
      socMin: 0.35,
      log: [],
      sun: null,
      pv: 0, wt: 0, load: 0, net: 0,
      t: 0
    };
  }

  /* ---------- положение солнца ---------- */

  function declination(day) {
    return 23.45 * Math.sin(2 * Math.PI / 365 * (284 + day)) * Math.PI / 180;
  }

  function sunPosition(hour, day) {
    const dec = declination(day);
    const H = (hour - 12) * 15 * Math.PI / 180;               // часовой угол
    const sinH = Math.sin(LAT) * Math.sin(dec) + Math.cos(LAT) * Math.cos(dec) * Math.cos(H);
    const elev = Math.asin(Math.max(-1, Math.min(1, sinH)));   // высота солнца
    const azim = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(LAT) - Math.tan(dec) * Math.cos(LAT));
    return { elev: elev, azim: azim, sinH: sinH };             // azim: 0 = юг, + = запад
  }

  function clearSky(elev) {
    if (elev <= 0) return 0;
    // прямая + рассеянная: простая модель, максимум ~1000 Вт/м²
    return Math.min(1050, 1000 * Math.pow(Math.sin(elev), 1.15));
  }

  function irradiance(st) {
    const s = sunPosition(st.hour, st.day);
    const g = clearSky(s.elev) * (1 - 0.75 * st.cloud);
    return { G: g, sun: s };
  }

  /* ---------- выработка ---------- */

  function incidenceCos(st) {
    const s = sunPosition(st.hour, st.day);
    if (s.elev <= 0) return 0;
    const beta = st.tilt * Math.PI / 180;
    const alpha = st.azimuth * Math.PI / 180;
    const cosT = Math.sin(s.elev) * Math.cos(beta) +
      Math.cos(s.elev) * Math.sin(beta) * Math.cos(s.azim - alpha);
    return Math.max(0, cosT);
  }

  function panelTemp(st) {
    const ir = irradiance(st);
    return 25 + (ir.G / 800) * 28;   // нагрев модуля: до +28 °C при полном солнце
  }

  // быстрый вариант: солнце считается один раз на вызов (было три раза)
  function pvPowerAt(st, G, sun) {
    if (G <= 0 || sun.elev <= 0) return 0;
    const beta = st.tilt * Math.PI / 180;
    const alpha = st.azimuth * Math.PI / 180;
    const cosT = Math.sin(sun.elev) * Math.cos(beta) +
      Math.cos(sun.elev) * Math.sin(beta) * Math.cos(sun.azim - alpha);
    if (cosT <= 0) return 0;
    const tCoeff = 1 - 0.004 * ((G / 800) * 28);
    return Math.max(0, G * cosT * PANEL_A * PANEL_ETA * tCoeff);
  }

  function pvPower(st) {
    const ir = irradiance(st);
    return pvPowerAt(st, ir.G, ir.sun);
  }

  // лучший наклон/азимут для текущего солнца — с кэшем по (час, день, облачность)
  let bestCache = { key: '', G: 0, sun: null, best: 0, tilt: 0, az: 0 };
  function bestPanel(st, G, sun) {
    const key = st.hour.toFixed(3) + '|' + st.day + '|' + st.cloud;
    if (bestCache.key === key) return bestCache;
    let best = 0, bestTilt = 0, bestAz = 0;
    if (G > 0 && sun.elev > 0) {
      for (let tilt = 0; tilt <= 90; tilt += 2) {
        for (let az = -90; az <= 90; az += 5) {
          const p = pvPowerAt({ tilt: tilt, azimuth: az }, G, sun);
          if (p > best) { best = p; bestTilt = tilt; bestAz = az; }
          else if (p === best) { /* первое попадание оставляем */ }
        }
      }
    }
    bestCache = { key: key, G: G, sun: sun, best: best, tilt: bestTilt, az: bestAz };
    return bestCache;
  }

  function windPower(st) {
    const v = st.wind;
    if (v < CUT_IN || v > CUT_OUT) return 0;
    const A = Math.PI * TURB_D * TURB_D / 4;
    const cp = CP_BY_BLADES[st.blades] || 0.40;
    const p = 0.5 * RHO * A * v * v * v * cp;
    return Math.min(TURB_RATED, p);
  }

  function loadPower(st) {
    return Object.keys(st.loads).reduce(function (s, k) {
      return s + (st.loads[k] ? LOADS[k].power : 0);
    }, 0);
  }

  function controllerEff(st) { return EFF_CONTROLLER[st.controller] || 0.95; }

  /* ---------- шаг модели ---------- */

  function step(st, dtReal, speed) {
    // 1 модельный час за 6 реальных секунд при ×1
    const dHours = dtReal * speed / 6;
    st.hour += dHours;
    if (st.hour >= 24) { st.hour -= 24; st.log.push({ t: st.t, kind: 'ok', text: 'Наступили новые сутки' }); }
    st.t += dtReal;

    const dtSec = dHours * 3600;
    st.pv = pvPower(st);
    st.wt = windPower(st);
    st.load = loadPower(st);
    const gen = (st.pv + st.wt) * controllerEff(st);
    st.net = gen - st.load;

    let dE;
    if (st.net > 0) {
      const room = (1 - st.soc) * st.capacity;
      dE = Math.min(st.net * dtSec / 3600 * 0.95, room);
      st.soc += dE / st.capacity;
    } else {
      const avail = Math.max(0, (st.soc - 0) * st.capacity);
      dE = -Math.min(Math.abs(st.net) * dtSec / 3600 / 0.95, avail);
      st.soc += dE / st.capacity;
    }
    st.soc = Math.max(0, Math.min(1, st.soc));
    st.socMin = Math.min(st.socMin, st.soc);
    st.energyGen += Math.max(0, gen) * dtSec / 3600;
    st.energyUsed += st.load * dtSec / 3600;
    const ir = irradiance(st);
    st.G = ir.G;
    st.sun = ir.sun;
    return st;
  }

  /* ---------- суточный профиль для графика ---------- */

  function dayProfile(st) {
    const out = [];
    for (let h = 0; h <= 24; h += 0.5) {
      const tmp = Object.assign({}, st, { hour: h < 24 ? h : 23.99 });
      out.push({
        h: h,
        pv: pvPower(tmp) * controllerEff(st),
        wt: windPower(tmp) * controllerEff(st),
        load: loadPower(st)
      });
    }
    return out;
  }

  // кэш суточных расчётов: пока не поменялись настройки и час, профиль не пересчитываем
  let dayCache = { key: '', prof: null, energy: null, sim: null };
  function dayKey(st) {
    return [st.day, st.cloud, st.tilt, st.azimuth, st.blades, st.controller,
      st.wind, st.capacity, Math.round(st.soc * 200),
      Object.keys(st.loads).filter(function (k) { return st.loads[k]; }).join(',')].join('|');
  }
  function dayData(st) {
    const key = dayKey(st);
    if (dayCache.key === key) return dayCache;
    const prof = dayProfile(st);
    dayCache = { key: key, prof: prof, energy: dayEnergyCalc(st, prof), sim: null };
    return dayCache;
  }

  function dayEnergy(st) {
    return dayData(st).energy;
  }

  function dayEnergyCalc(st, prof) {
    let pvGen = 0, wtGen = 0, use = 0;
    for (let i = 1; i < prof.length; i++) {
      const dh = prof[i].h - prof[i - 1].h;
      pvGen += prof[i].pv * dh;
      wtGen += prof[i].wt * dh;
      use += prof[i].load * dh;
    }
    const gen = pvGen + wtGen;
    return { gen: gen, pvGen: pvGen, wtGen: wtGen, use: use, kium: gen / ((100 + TURB_RATED) * 24) };
  }

  // сутки с учётом накопителя: возвращает минимум SoC
  function simulateDay(st) {
    const c = dayData(st);
    if (c.sim) return c.sim;
    const prof = c.prof;
    let soc = st.soc, min = soc;
    for (let i = 1; i < prof.length; i++) {
      const dh = prof[i].h - prof[i - 1].h;
      const net = prof[i].pv + prof[i].wt - prof[i].load;
      if (net > 0) soc = Math.min(1, soc + net * dh * 0.95 / st.capacity);
      else soc = Math.max(0, soc + net * dh / 0.95 / st.capacity);
      min = Math.min(min, soc);
    }
    c.sim = { socEnd: soc, socMin: min };
    return c.sim;
  }

  /* ---------- факты для заданий ---------- */

  function facts(st) {
    const ir = irradiance(st);
    // максимально возможная мощность при текущем солнце — из кэша (перебор идёт раз в час, а не каждый кадр)
    const bp = bestPanel(st, ir.G, ir.sun);
    const best = bp.best, bestTilt = bp.tilt, bestAz = bp.az;
    const f = {
      hour: st.hour,
      G: ir.G,
      elevDeg: ir.sun.elev * 180 / Math.PI,
      pv: pvPowerAt(st, ir.G, ir.sun),
      wt: windPower(st),
      load: loadPower(st),
      soc: st.soc,
      pvMax: best,
      pvRatio: best > 0.5 ? pvPowerAt(st, ir.G, ir.sun) / best : 0,
      bestTilt: bestTilt,
      bestAz: bestAz,
      energyGen: st.energyGen,
      energyUsed: st.energyUsed,
      day: dayEnergy(st),
      sim: simulateDay(st),
      windRatio: 0,
      measures: (st.measures || []).slice(),
      pvMeasure: (st.measures || []).filter(function (m) { return m.kind === 'pv'; }).length,
      windMeasure: (st.measures || []).filter(function (m) { return m.kind === 'wind'; }),
      dayRuns: (st.measures || []).filter(function (m) { return m.kind === 'day'; }),
      seasonRuns: (st.measures || []).filter(function (m) { return m.kind === 'day'; })
    };
    // кубическая зависимость: ищем пару измерений, где скорость отличается примерно вдвое
    const w = f.windMeasure;
    let pair = null;
    for (let i = 0; i < w.length; i++) {
      for (let j = 0; j < w.length; j++) {
        if (i === j) continue;
        const ratio = w[i].v / w[j].v;
        if (ratio >= 1.8 && ratio <= 2.2 && w[j].p > 0.5) {
          pair = { hi: w[i], lo: w[j], ratio: ratio };
          break;
        }
      }
      if (pair) break;
    }
    // разброс по наклону панели и по числу лопастей — для лабораторных работ
    const pm = (st.measures || []).filter(function (m) { return m.kind === 'pv'; });
    const tilts = {};
    pm.forEach(function (m) { tilts[Math.round(m.tilt / 5) * 5] = 1; });
    f.tiltPoints = Object.keys(tilts).length;
    const tiltsPv = pm.map(function (m) { return { tilt: m.tilt, pv: m.pv }; });
    if (tiltsPv.length >= 2) {
      const hi = tiltsPv.reduce(function (a, b) { return b.pv > a.pv ? b : a; }, tiltsPv[0]);
      const lo = tiltsPv.reduce(function (a, b) { return b.pv < a.pv ? b : a; }, tiltsPv[0]);
      f.tiltBest = hi.tilt;
      f.tiltWorst = lo.tilt;
      f.tiltGain = lo.pv > 0.5 ? hi.pv / lo.pv : 0;
    }
    const wm = (st.measures || []).filter(function (m) { return m.kind === 'wind'; });
    const bladeGroups = {};
    wm.forEach(function (m) { bladeGroups[m.blades] = (bladeGroups[m.blades] || 0) + 1; });
    f.bladeGroups = Object.keys(bladeGroups).length;
    // средняя мощность при каждом числе лопастей
    const byBlades = {};
    wm.forEach(function (m) {
      byBlades[m.blades] = byBlades[m.blades] || { sum: 0, n: 0 };
      byBlades[m.blades].sum += m.p; byBlades[m.blades].n += 1;
    });
    f.bladeAvg = {};
    Object.keys(byBlades).forEach(function (k) {
      f.bladeAvg[k] = byBlades[k].sum / byBlades[k].n;
    });

    if (pair) {
      f.windRatio = pair.hi.p / pair.lo.p;
      f.windRatioTheory = Math.pow(pair.ratio, 3);
      f.windPair = { lo: pair.lo.v, hi: pair.hi.v };
    } else if (w.length >= 2) {
      const a = w.reduce(function (x, m) { return m.v > x.v ? m : x; }, w[0]);
      const b = w.reduce(function (x, m) { return m.v < x.v ? m : x; }, w[0]);
      f.windRatio = (a.v !== b.v && b.p > 0.5) ? a.p / b.p : 0;
      f.windRatioTheory = Math.pow(a.v / b.v, 3);
      f.windPair = { lo: b.v, hi: a.v };
    }
    return f;
  }

  /* ---------- задачи ---------- */

  const TASKS = [
    {
      t: 'Навести панель на солнце',
      goal: 'Наклоните и разверните панель так, чтобы она давала не меньше 90 % максимально возможной мощности при текущем солнце.',
      steps: ['Посмотрите на высоту солнца и его азимут.', 'Подберите наклон панели.', 'Проверьте азимут: 0 — на юг.'],
      hints: ['Панель смотрит на солнце, когда её нормаль направлена на него: наклон ≈ 90° − высота солнца.',
              'Если солнце на западе — азимут положительный, на востоке — отрицательный.',
              'Задача считается выполненной при отношении ≥ 90 % от максимума.'],
      check: function (f) { return f.pvRatio >= 0.9; },
      stars: function (f) { return f.pvRatio >= 0.97 ? 3 : (f.pvRatio >= 0.9 ? 2 : 1); },
      why: 'Мощность панели пропорциональна косинусу угла падения света. Отклонение на 30° от нормали стоит 13 % мощности.'
    },
    {
      t: 'Солнце и облака',
      goal: 'Снимите в протокол 3 точки при одной orientation панели и разной облачности: ясно, облачно, пасмурно.',
      steps: ['Наведите панель на солнце.', 'Установите облачность 0 и снимите показания.', 'Повторите при 0,5 и при 1.'],
      hints: ['Облачность снижает освещённость линейно — так устроена модель.',
              'Кнопка «Снять показания» пишет точку в протокол.',
              'Проверьте по прибору G: при плотной облачности освещённость падает в 4 раза.'],
      check: function (f) {
        const pv = f.measures.filter(function (m) { return m.kind === 'pv'; });
        const clouds = {};
        pv.forEach(function (m) { clouds[Math.round(m.cloud * 10)] = 1; });
        return Object.keys(clouds).length >= 3;
      },
      stars: function (f) {
        const pv = f.measures.filter(function (m) { return m.kind === 'pv'; });
        const clouds = {};
        pv.forEach(function (m) { clouds[Math.round(m.cloud * 10)] = 1; });
        return Object.keys(clouds).length >= 4 ? 3 : 2;
      },
      why: 'Освещённость (и мощность) падает почти пропорционально облачности: при плотных облаках остаётся около четверти мощности.'
    },
    {
      t: 'Куб скорости ветра',
      goal: 'Измерьте мощность ветрогенератора при 4, 6 и 8 м/с. Убедитесь, что при удвоении скорости (4 → 8 м/с) мощность растёт примерно в 8 раз.',
      steps: ['Установите ветер 4 м/с и снимите показания.', 'Повторите при 6 и 8 м/с.', 'Сравните мощности при 4 и 8 м/с.'],
      hints: ['Формула: P = ½·ρ·A·v³·Cp — скорость в третьей степени.',
              'Снимайте показания при одном и том же числе лопастей.',
              'Выше 12 м/с генератор выходит на номинал, а после 16 м/с — останавливается, поэтому берите 4…8 м/с.'],
      check: function (f) { return f.windMeasure.length >= 3 && f.windRatio >= 6 && f.windRatio <= 10; },
      stars: function (f) {
        if (!(f.windMeasure.length >= 3 && f.windRatio >= 6 && f.windRatio <= 10)) return 1;
        return f.windMeasure.length >= 4 ? 3 : 2;
      },
      why: 'Мощность ветра растёт как куб скорости: удвоение скорости даёт восьмикратную мощность. Поэтому ветроэнергетика любит ветреные места.'
    },
    {
      t: 'MPPT против PWM',
      goal: 'Прогоните сутки с контроллером PWM и с MPPT при одинаковой нагрузке. MPPT должен дать заметно больше энергии.',
      steps: ['Включите лампу и насос.', 'Выберите PWM и нажмите «Прогнать сутки».', 'Повторите с MPPT и сравните.'],
      hints: ['PWM теряет до 22 % энергии, MPPT — около 5 %.',
              'Кнопка «Прогнать сутки» считает энергию за 24 часа при текущих настройках.',
              'Сравнивайте прогоны при одинаковой нагрузке и одинаковой облачности.'],
      check: function (f) {
        const d = f.dayRuns;
        const pwm = d.filter(function (m) { return m.controller === 'pwm'; }).pop();
        const mppt = d.filter(function (m) { return m.controller === 'mppt'; }).pop();
        return !!(pwm && mppt && mppt.gen > pwm.gen * 1.1);
      },
      stars: function (f) {
        const d = f.dayRuns;
        const pwm = d.filter(function (m) { return m.controller === 'pwm'; }).pop();
        const mppt = d.filter(function (m) { return m.controller === 'mppt'; }).pop();
        if (!(pwm && mppt && mppt.gen > pwm.gen * 1.1)) return 1;
        return (mppt.gen > pwm.gen * 1.15) ? 3 : 2;
      },
      why: 'MPPT подстраивает рабочую точку панели под максимум мощности, PWM просто «срезает» напряжение. На практике MPPT даёт 15–25 % прироста в пасмурную погоду.'
    },
    {
      t: 'Автономные сутки',
      goal: 'Обеспечьте работу лампы и роутера круглые сутки без разряда аккумулятора ниже 20 %.',
      steps: ['Включите лампу и роутер, насос выключите.', 'Подберите ёмкость и контроллер.', 'Проверьте минимум SoC по прогону суток.'],
      hints: ['Сначала посчитайте потребление: (10 + 8) Вт × 24 ч = 432 Вт·ч.',
              'Запас на пасмурный день: ёмкость около 2 суточных норм.',
              'Ночи без солнца — накопитель должен продержаться до рассвета.'],
      check: function (f) { return f.load >= 18 && f.sim.socMin >= 0.2 && f.day.gen >= f.day.use; },
      stars: function (f) {
        if (!(f.load >= 18 && f.sim.socMin >= 0.2 && f.day.gen >= f.day.use)) return 1;
        return f.sim.socMin >= 0.35 ? 3 : 2;
      },
      why: 'Автономная система считается по худшему случаю: выработка за сутки должна покрывать потребление, а ёмкость — держать нагрузку ночью.'
    },
    {
      t: 'Лето и зима',
      goal: 'Сравните суточную выработку 21 июня и 21 декабря при одинаковых настройках. Разница должна быть заметной.',
      steps: ['Выберите 21 июня и нажмите «Прогнать сутки».', 'Выберите 21 декабря и повторите.', 'Сравните солнечную выработку в протоколе.'],
      hints: ['В декабре солнце низко, день короткий — выработка падает в несколько раз.',
              'Для зимы помогает увеличить наклон панели: солнце низко над горизонтом.',
              'Прогон записывается в протокол с датой и энергией.'],
      check: function (f) {
        const s = f.seasonRuns;
        const summer = s.filter(function (m) { return m.day <= 200; }).pop();
        const winter = s.filter(function (m) { return m.day > 200; }).pop();
        return !!(summer && winter && winter.pvGen > 0 && summer.pvGen > winter.pvGen * 2.5);
      },
      stars: function (f) {
        const s = f.seasonRuns;
        const summer = s.filter(function (m) { return m.day <= 200; }).pop();
        const winter = s.filter(function (m) { return m.day > 200; }).pop();
        if (!(summer && winter && winter.pvGen > 0 && summer.pvGen > winter.pvGen * 2.5)) return 1;
        return (summer.pvGen > winter.pvGen * 4) ? 3 : 2;
      },
      why: 'На широте Красноярска (56°) зимой солнце поднимается низко, а день короткий: суммарная выработка падает в 3–4 раза. Поэтому в автономных системах закладывают зимний расчёт.'
    }
  ];

  TASKS.push({
    t: 'Наклон панели',
    goal: 'Снимите не меньше 3 точек при разном наклоне панели (например, 0°, 30°, 60°) и найдите наклон, при котором мощность максимальна.',
    steps: ['Оставьте ясную погоду и полдень.', 'Меняйте наклон панели и снимайте показания.',
      'Сравните мощность при разных углах.'],
    hints: ['Летом в полдень солнце высоко, поэтому оптимальный наклон меньше 45°.',
      'Разница между «плашмя» и оптимальным наклоном заметна на глаз — до 40 %.',
      'На каждое значение наклона нужна своя точка в протоколе.'],
    check: function (f) { return f.tiltPoints >= 3 && f.tiltGain >= 1.06; },
    stars: function (f) { return f.tiltPoints >= 3 && f.tiltGain >= 1.06 ? (f.tiltGain >= 1.2 ? 3 : 2) : 0; },
    why: 'Мощность панели зависит от угла падения света: оптимальный наклон — когда лучи перпендикулярны плоскости панели. Летом он меньше, зимой больше.'
  });
  TASKS.push({
    t: 'Число лопастей',
    goal: 'Снимите точки для двух разных чисел лопастей при одинаковом ветре и сравните мощность.',
    steps: ['Задайте ветер 8 м/с.', 'Поставьте 3 лопасти и снимите точку.', 'Поставьте 5 лопастей и снимите ещё одну.'],
    hints: ['Больше лопастей — больше ометаемая площадь и выше мощность при слабом ветре.',
      'При сильном ветре разница меньше: генератор уже выходит на номинал.',
      'Проверьте по протоколу, что точки отличаются только числом лопастей.'],
    check: function (f) { return f.bladeGroups >= 2 && f.windMeasure.length >= 2; },
    stars: function (f) {
      const a = f.bladeAvg || {};
      const k = Object.keys(a);
      if (k.length < 2) return 0;
      const max = Math.max.apply(null, k.map(function (x) { return a[x]; }));
      const min = Math.min.apply(null, k.map(function (x) { return a[x]; }));
      return min > 0.5 && max / min > 1.15 ? 3 : 2;
    },
    why: 'Мощность ветрогенератора пропорциональна ометаемой площади: пять лопастей при том же диаметре дают заметно больше, чем три.'
  });

  const API = {
    LAT: LAT, PANEL_A: PANEL_A, TURB_D: TURB_D, LOADS: LOADS, TASKS: TASKS,
    CP_BY_BLADES: CP_BY_BLADES, EFF_CONTROLLER: EFF_CONTROLLER,
    createState: createState, sunPosition: sunPosition, irradiance: irradiance,
    pvPower: pvPower, windPower: windPower, loadPower: loadPower,
    incidenceCos: incidenceCos, panelTemp: panelTemp, controllerEff: controllerEff,
    step: step, dayProfile: dayProfile, dayEnergy: dayEnergy, simulateDay: simulateDay,
    facts: facts, declination: declination, clearSky: clearSky
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Renew = API;

  /* ============================================================
     Интерфейс стенда (только в браузере)
     ============================================================ */
  if (typeof document === 'undefined' || !root.Renew || !root.Renew.ui) {
    if (typeof document !== 'undefined') root.RenewUI = function () {};
    return;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);

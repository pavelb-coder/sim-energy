/* ============================================================
   Энерджиквантум · mech.js — стенд «Механика и энергия»
   Модель в духе PhET: Energy Skate Park, Pendulum Lab, Masses and Springs.
   Не зависит от DOM: тестируется в Node, используется в браузере.
   ============================================================ */
(function (root) {
  'use strict';

  const G = 9.81;          // ускорение свободного падения, м/с²
  const DT = 1 / 240;      // шаг интегрирования, с

  /* ---------- горка: трасса задаётся профилем высоты ---------- */

  // трасса «полупайп»: y = h * (x/L)^2, x ∈ [0, L]
  function trackHeight(profile, x) {
    const L = profile.length;
    const h = profile.height;
    if (x < 0) x = 0;
    if (x > L) x = L;
    switch (profile.shape) {
      case 'parabola': return h * Math.pow(x / L, 2);
      case 'valley':   return h * Math.pow(1 - x / L, 2);
      case 'hill':     return h * Math.sin(Math.PI * x / L);
      case 'ramp':     return h * (1 - x / L);
      default:         return h * (x / L);
    }
  }

  function trackSlope(profile, x) {
    const d = 0.01;
    return (trackHeight(profile, x + d) - trackHeight(profile, x - d)) / (2 * d);
  }

  function createSkater(profile, mass) {
    const x = 0.05 * profile.length;
    return {
      profile: profile, mass: mass || 60, x: x, v: 0, vmax: 0,
      y: trackHeight(profile, x), friction: 0.02, gravityOn: true,
      track: true, t: 0
    };
  }

  // число прошедших полных колебаний маятника (по переходам через положение равновесия)
  function pendulumCount(p) { return p.periods / 2; }

  function skaterEnergy(sk) {
    const y = sk.track ? trackHeight(sk.profile, sk.x) : sk.y;
    const h = sk.gravityOn ? y : 0;
    const ke = 0.5 * sk.mass * sk.v * sk.v;
    return { y: y, h: h, Ekin: ke, Epot: sk.mass * G * h, total: ke + sk.mass * G * h,
      speed: Math.abs(sk.v) };
  }

  function stepSkater(sk, dt) {
    dt = dt || DT;
    if (!sk.track) {
      // свободный полёт: ускорение g одинаково для любой массы
      sk.v += -G * dt;
      sk.y += sk.v * dt;
      if (sk.y < 0) { sk.y = 0; sk.v = 0; }
      sk.t += dt;
      return sk;
    }

    // sqrt(1 + h'²) — перевод длины вдоль трассы в горизонтальную координату
    const arc = function (x) {
      const sl = trackSlope(sk.profile, x);
      return Math.sqrt(1 + sl * sl);
    };
    const accel = function (x, v) {
      const slope = trackSlope(sk.profile, x);
      const s2 = Math.sqrt(1 + slope * slope);
      let a = sk.gravityOn ? -G * slope / s2 : 0;
      // трение о трассу: μ·g·cosθ, где cosθ = 1/√(1+h'²)
      a -= sk.friction * G * (1 / s2) * Math.sign(v || 1);
      return a;
    };

    // leapfrog (симплектический интегратор): энергия не «уползает» на длинных прогонах
    const xh = sk.x + 0.5 * dt * sk.v / arc(sk.x);
    sk.v += accel(xh, sk.v) * dt;
    sk.x += sk.v / arc(xh) * dt;

    // страховка от численной расходимости
    const vMax = Math.sqrt(2 * G * Math.max(0.5, sk.profile.height)) * 1.6 + 1;
    if (Math.abs(sk.v) > vMax) sk.v = Math.sign(sk.v) * vMax;
    if (!isFinite(sk.x) || !isFinite(sk.v)) { sk.x = 0; sk.v = 0; }

    // упор на краях трассы: отражаем без потерь (потери задаёт только трение)
    if (sk.x < 0) { sk.x = -sk.x; sk.v = Math.abs(sk.v); }
    if (sk.x > sk.profile.length) { sk.x = 2 * sk.profile.length - sk.x; sk.v = -Math.abs(sk.v); }
    sk.y = trackHeight(sk.profile, sk.x);
    sk.vmax = Math.max(sk.vmax || 0, Math.abs(sk.v));
    sk.t += dt;
    return sk;
  }

  /* ---------- маятник ---------- */

  function createPendulum(opts) {
    opts = opts || {};
    return {
      L: opts.L || 1.0,          // длина нити, м
      mass: opts.mass || 1.0,    // масса груза, кг
      theta: opts.theta === undefined ? 0.35 : opts.theta,   // угол от вертикали, рад
      omega: 0,
      damping: opts.damping === undefined ? 0.02 : opts.damping,
      gravityOn: opts.gravityOn !== false,
      t: 0, periods: 0, lastZeroCross: 0
    };
  }

  function stepPendulum(p, dt) {
    dt = dt || DT;
    const g = p.gravityOn ? G : 0;
    // leapfrog: сначала半 шаг по скорости, затем шаг по углу
    p.omega += (-(g / p.L) * Math.sin(p.theta) - p.damping * p.omega) * dt;
    const prev = p.theta;
    p.theta += p.omega * dt;
    p.t += dt;
    // переход через положение равновесия = половина периода
    if ((prev > 0 && p.theta <= 0) || (prev < 0 && p.theta >= 0)) {
      if (!p.crossings) p.crossings = [];
      p.crossings.push(p.t);
      if (p.crossings.length > 40) p.crossings.shift();
      p.periods += 0.5;
    }
    return p;
  }

  // измеренный период по двум полным колебаниям
  function pendulumMeasured(p) {
    const c = p.crossings || [];
    if (c.length < 3) return 0;
    const n = c.length;
    // переходы через равновесие идут каждые полпериода: два перехода = целый период
    return c[n - 1] - c[n - 3];
  }

  function pendulumEnergy(p) {
    const g = p.gravityOn ? G : 0;
    const h = p.L * (1 - Math.cos(p.theta));
    const v = p.L * p.omega;
    const ke = 0.5 * p.mass * v * v;
    return { h: h, Ekin: ke, Epot: p.mass * g * h, total: ke + p.mass * g * h, speed: Math.abs(v) };
  }

  // теория: T = 2π√(L/g); при больших углах период растёт (поправка первого порядка)
  function pendulumPeriod(L, theta) {
    const small = 2 * Math.PI * Math.sqrt(L / G);
    const amp = Math.abs(theta || 0);
    return small * (1 + (amp * amp) / 16 + (11 * Math.pow(amp, 4)) / 3072);
  }

  /* ---------- груз на пружине ---------- */

  function createSpring(opts) {
    opts = opts || {};
    return {
      k: opts.k || 40,          // жёсткость, Н/м
      mass: opts.mass || 0.5,   // масса груза, кг
      y: opts.y === undefined ? 0.15 : opts.y,   // смещение от равновесия, м
      v: 0,
      damping: opts.damping === undefined ? 0.05 : opts.damping,
      g: G, t: 0
    };
  }

  function stepSpring(s, dt) {
    dt = dt || DT;
    // leapfrog: скорость на полушаге, затем координата — энергия не «уползает»
    s.v += ((-s.k * s.y - s.damping * s.v) / s.mass) * dt;
    s.y += s.v * dt;
    s.t += dt;
    if (!s.crossings) s.crossings = [];
    const prev = s.prevY;
    if (prev !== undefined && ((prev > 0 && s.y <= 0) || (prev < 0 && s.y >= 0))) {
      s.crossings.push(s.t);
      if (s.crossings.length > 40) s.crossings.shift();
    }
    s.prevY = s.y;
    return s;
  }

  // измеренный период пружинного маятника: между переходами через равновесие полпериода
  function springMeasured(s) {
    const c = s.crossings || [];
    if (c.length < 3) return 0;
    return c[c.length - 1] - c[c.length - 3];
  }

  function springPeriod(k, mass) { return 2 * Math.PI * Math.sqrt(mass / k); }

  function springEnergy(s) {
    const ke = 0.5 * s.mass * s.v * s.v;
    const ep = 0.5 * s.k * s.y * s.y;
    return { y: s.y, Ekin: ke, Epot: ep, total: ke + ep, speed: Math.abs(s.v) };
  }

  // статическое удлинение под весом груза
  function springStretch(k, mass) { return mass * G / k; }
  // закон Гука: F = k·x
  function hooke(k, x) { return -k * x; }

  /* ---------- задания ---------- */

  const TASKS = [
    {
      t: 'Сохранить энергию',
      goal: 'Скатите груз с горки так, чтобы в нижней точке скорость была не меньше 6 м/с, а полная энергия почти не менялась (потери меньше 15 %).',
      steps: ['Отключите трение (ползунок «Трение» в 0).', 'Пустите груз с верхней точки трассы.',
        'Следите за полной энергией E на графике: она должна оставаться ровной.'],
      hints: ['Полная энергия E = mgh + mv²/2, если трения нет.',
        'Высота горки 4 м даёт скорость у земли v = √(2gh) ≈ 8,9 м/с.',
        'Чем меньше трение, тем ровнее линия полной энергии.'],
      check: function (f) { return f.speedMax >= 6 && f.energyLoss <= 0.15; },
      stars: function (f) { return f.energyLoss <= 0.08 && f.speedMax >= 7 ? 3 : 2; },
      why: 'Без трения механическая энергия сохраняется: сколько потенциальной ушло, столько и стало кинетической.'
    },
    {
      t: 'Наклон и высота',
      goal: 'Снимите скорость в нижней точке при двух разных высотах горки и убедитесь, что v ∝ √h.',
      steps: ['Задайте высоту 2 м, внизу нажмите «Снять точку».', 'Повторите при высоте 4 м.',
        'Сравните: скорость должна вырасти в √2 ≈ 1,41 раза.'],
      hints: ['v = √(2gh) — масса и форма трассы не важны.',
        'При высоте 2 м v ≈ 6,3 м/с, при 4 м — ≈ 8,9 м/с.',
        'Отношение скоростей проверяйте по протоколу.'],
      guess: {
        prompt: 'Предскажите скорость у земли при высоте 4 м (трение выключено)?',
        placeholder: 'скорость, м/с',
        unit: 'м/с',
        actual: function (f) { return f.speedMax; }
      },
      check: function (f) { return f.heightsMeasured >= 2 && f.speedRatio >= 1.3 && f.speedRatio <= 1.55; },
      stars: function (f) { return f.speedRatio >= 1.38 && f.speedRatio <= 1.46 ? 3 : 2; },
      why: 'v = √(2gh): скорость зависит только от перепада высот — масса и форма горки её не меняют.'
    },
    {
      t: 'Период маятника',
      goal: 'Измерьте период маятника при длине 1 м и при 4 м. Период должен увеличиться примерно в 2 раза.',
      steps: ['Поставьте маятник, длину 1 м, угол 15°.', 'Дождитесь 3–4 колебаний и снимите точку.',
        'Повторите при длине 4 м.'],
      hints: ['T = 2π√(L/g): при длине 1 м T ≈ 2 с.',
        'Увеличение длины в 4 раза даёт период в 2 раза больше.',
        'Масса груза на период не влияет — проверьте.'],
      check: function (f) { return f.pendLengths >= 2 && f.periodRatio >= 1.8 && f.periodRatio <= 2.2; },
      stars: function (f) { return f.periodRatio >= 1.9 && f.periodRatio <= 2.1 ? 3 : 2; },
      why: 'Период маятника T = 2π√(L/g) зависит от длины и ускорения свободного падения, но не от массы.'
    },
    {
      t: 'Масса не важна',
      goal: 'Снимите период маятника при двух разных массах груза и при одинаковой длине — периоды должны совпадать.',
      steps: ['Длина 1 м, угол 15°, масса 0,5 кг — снимите точку.', 'Смените массу на 2 кг, повторите.',
        'Сравните периоды.'],
      hints: ['В формуле T = 2π√(L/g) массы нет.',
        'Отличие в опыте — только за счёт погрешности измерения.',
        'Разницей меньше 5 % можно пренебречь.'],
      check: function (f) { return f.pendMasses >= 2 && f.massPeriodDiff <= 0.05; },
      stars: function (f) { return f.massPeriodDiff <= 0.02 ? 3 : 2; },
      why: 'Тяжелее груз — больше возвращающая сила, но и больше инертность: они компенсируют друг друга.'
    },
    {
      t: 'Закон Гука',
      goal: 'Снимите 3 точки растяжения пружины при разных массах грузов и убедитесь, что удлинение пропорционально массе.',
      steps: ['Подвесьте груз 0,1 кг и снимите точку.', 'Повторите с 0,2 и 0,4 кг.',
        'Проверьте: удлинение растёт во столько же раз, что и масса.'],
      hints: ['x = mg/k — удлинение прямо пропорционально массе.',
        'При жёсткости 40 Н/м груз 0,2 кг растягивает пружину на 4,9 см.',
        'Меняйте жёсткость пружины и смотрите, как меняется наклон.'],
      check: function (f) { return f.springPoints >= 3 && f.hookeSpread <= 0.08; },
      stars: function (f) { return f.hookeSpread <= 0.04 ? 3 : 2; },
      why: 'Закон Гука: F = kx. Отношение mg/x при разных грузах одинаковое — это и есть жёсткость пружины.'
    },
    {
      t: 'Период пружины',
      goal: 'Измерьте период колебаний груза на пружине при двух массах: при массе в 4 раза больше период должен удвоиться.',
      steps: ['Масса 0,2 кг, пружина 40 Н/м — дождитесь колебаний и снимите точку.',
        'Поставьте массу 0,8 кг, повторите.', 'Сравните периоды.'],
      hints: ['T = 2π√(m/k).',
        'Масса в 4 раза больше — период в 2 раза больше.',
        'Жёсткость в 4 раза больше — период в 2 раза меньше.'],
      check: function (f) { return f.springMasses >= 2 && f.springPeriodRatio >= 1.8 && f.springPeriodRatio <= 2.2; },
      stars: function (f) { return f.springPeriodRatio >= 1.9 && f.springPeriodRatio <= 2.1 ? 3 : 2; },
      why: 'Период пружинного маятника T = 2π√(m/k): тяжелее груз — медленнее колебания, жёстче пружина — быстрее.'
    },
    {
      t: 'Трение забирает энергию',
      goal: 'Пустите груз с горки с трением не меньше 0,02 — механическая энергия должна уменьшиться не меньше чем на 25 %.',
      steps: ['Поставьте трение 0,03 и высоту 4 м.', 'Спустите груз и дайте ему пройти горку несколько раз.',
        'Снимите точку и посмотрите на потери энергии.'],
      hints: ['Трение переводит механическую энергию во внутреннюю — груз и горка нагреваются.',
        'С каждым проходом амплитуда уменьшается, пока груз не остановится внизу.',
        'Потери считайте по отношению E(конец)/E(начало).'],
      check: function (f) { return f.friction >= 0.02 && f.energyLoss >= 0.25; },
      stars: function (f) { return f.energyLoss >= 0.5 ? 3 : 2; },
      why: 'Работа силы трения A = −Fтр·s уменьшает механическую энергию: она переходит в тепло, а не исчезает.'
    },
    {
      t: 'Свободное падение',
      goal: 'Включите свободное падение с высоты и снимите две точки при разных массах груза: набранные скорости должны совпасть.',
      steps: ['Включите «Свободное падение» (слева).', 'Снимите точку при массе 10 кг и при массе 100 кг.',
        'Сравните скорость: она не должна зависеть от массы.'],
      hints: ['В свободном падении a = g для любого тела.',
        'Масса влияет только на силу тяжести, но не на ускорение.',
        'Кнопка «Пустить» запускает падение с высоты 20 м; скорость растёт линейно со временем.'],
      check: function (f) { return f.freeFallMasses >= 2 && f.freeFallDiff <= 0.1; },
      stars: function (f) { return f.freeFallDiff <= 0.05 ? 3 : 2; },
      why: 'Ускорение свободного падения одинаково для всех тел: F = mg, a = F/m = g.'
    }
  ];

  /* ---------- сессия измерений ---------- */

  function createLab() {
    return { measures: [], friction: 0.002, skater: null, pendulum: null, spring: null };
  }

  function ratio(a, b) { return b > 0.001 ? a / b : 0; }

  function facts(lab) {
    const m = lab.measures || [];
    const byKind = function (k) { return m.filter(function (r) { return r.kind === k; }); };
    const sk = byKind('skate');
    const pd = byKind('pendulum');
    const sp = byKind('spring');
    const f = { measures: m.length, skate: sk.length, pendulum: pd.length, springCount: sp.length };

    // горка
    const vmax = sk.map(function (r) { return r.speed; });
    f.speedMax = vmax.length ? Math.max.apply(null, vmax) : 0;
    f.energyLoss = sk.length
      ? Math.max(0, Math.max.apply(null, sk.map(function (r) { return r.loss; })))
      : 0;
    f.friction = lab.friction;
    const heights = {};
    sk.forEach(function (r) {
      if (r.mode !== 'track') return;
      heights[Math.round(r.height * 10) / 10] = r.speed;
    });
    const hKeys = Object.keys(heights).map(Number).sort(function (a, b) { return a - b; });
    f.heightsMeasured = hKeys.length;
    f.speedRatio = hKeys.length >= 2
      ? ratio(heights[hKeys[hKeys.length - 1]], heights[hKeys[0]]) : 0;
    // свободное падение: разброс набранной скорости при разных массах
    // режим свободного полёта: гравитация выключена, груз не на трассе
    const ff = sk.filter(function (r) { return r.mode === 'free' || r.freeFall; });
    const ffm = {};
    ff.forEach(function (r) { ffm[r.mass] = r.speed; });
    f.freeFallMasses = Object.keys(ffm).length;
    const ffv = Object.keys(ffm).map(function (k) { return ffm[k]; });
    f.freeFallDiff = ffv.length >= 2 ? (Math.max.apply(null, ffv) - Math.min.apply(null, ffv)) / Math.max.apply(null, ffv) : 1;

    // маятник
    const lenKey = {};
    pd.forEach(function (r) { lenKey[Math.round(r.L * 100) / 100] = r.period; });
    f.pendLengths = Object.keys(lenKey).length;
    const Ls = Object.keys(lenKey).map(Number).sort(function (a, b) { return a - b; });
    f.periodRatio = Ls.length >= 2 ? ratio(lenKey[Math.max.apply(null, Ls)], lenKey[Math.min.apply(null, Ls)]) : 0;
    const massKey = {};
    pd.forEach(function (r) { massKey[Math.round(r.mass * 100) / 100] = r.period; });
    f.pendMasses = Object.keys(massKey).length;
    const mv = Object.keys(massKey).map(function (k) { return massKey[k]; });
    f.massPeriodDiff = mv.length >= 2 ? (Math.max.apply(null, mv) - Math.min.apply(null, mv)) / Math.max.apply(null, mv) : 1;

    // пружина
    const spMassKey = {}, spK = {};
    sp.forEach(function (r) {
      spK[Math.round(r.stretch * 1000)] = r.mass;
      spMassKey[Math.round(r.mass * 100) / 100 + '|' + Math.round(r.k)] = r.period;
    });
    f.springPoints = Object.keys(spK).length;
    // закон Гука: mg/x при разных грузах должно давать одну жёсткость
    const kEst = sp.filter(function (r) { return r.stretch > 0.001; }).map(function (r) { return r.mass * G / r.stretch; });
    f.hookeSpread = kEst.length >= 2
      ? (Math.max.apply(null, kEst) - Math.min.apply(null, kEst)) / Math.max.apply(null, kEst) : 1;
    const keyByK = {};
    sp.forEach(function (r) {
      keyByK[r.k] = keyByK[r.k] || {};
      keyByK[r.k][Math.round(r.mass * 100)] = r.period;
    });
    const ks = Object.keys(keyByK).filter(function (k) { return Object.keys(keyByK[k]).length >= 2; });
    f.springMasses = ks.length ? 2 : 0;
    f.springPeriodRatio = ks.length ? (function () {
      const cfg = keyByK[ks[0]];
      const ms = Object.keys(cfg).map(Number).sort(function (a, b) { return a - b; });
      return ratio(cfg[Math.max.apply(null, ms)], cfg[Math.min.apply(null, ms)]);
    })() : 0;
    return f;
  }

  const API = {
    G: G, DT: DT,
    TASKS: TASKS,
    trackHeight: trackHeight,
    trackSlope: trackSlope,
    createSkater: createSkater,
    stepSkater: stepSkater,
    skaterEnergy: skaterEnergy,
    createPendulum: createPendulum,
    stepPendulum: stepPendulum,
    pendulumEnergy: pendulumEnergy,
    pendulumPeriod: pendulumPeriod,
    pendulumCount: pendulumCount,
    pendulumMeasured: pendulumMeasured,
    createSpring: createSpring,
    stepSpring: stepSpring,
    springEnergy: springEnergy,
    springPeriod: springPeriod,
    springMeasured: springMeasured,
    springStretch: springStretch,
    hooke: hooke,
    createLab: createLab,
    facts: facts
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Mech = API;
})(typeof window !== 'undefined' ? window : globalThis);

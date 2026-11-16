/* ============================================================
   Энерджиквантум · optics.js — стенд «Свет и волны»
   Модель в духе PhET: Bending Light, Geometric Optics, Color Vision,
   Wave Interference. Не зависит от DOM: тестируется в Node.
   ============================================================ */
(function (root) {
  'use strict';

  // показатель преломления: воздух ≈ 1, вода 1,33, стекло 1,52, алмаз 2,42
  const MEDIA = {
    air: { name: 'Воздух', n: 1.0, color: '#dbe9f4' },
    water: { name: 'Вода', n: 1.333, color: '#bcdcf0' },
    glass: { name: 'Стекло', n: 1.52, color: '#c9e3ea' },
    diamond: { name: 'Алмаз', n: 2.417, color: '#e4e9f7' }
  };
  const C_LIGHT = 299792458;            // м/с
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;

  /* ---------- преломление и полное внутреннее отражение ---------- */

  // угол преломления по закону Снелла; null — полное внутреннее отражение
  function snell(n1, n2, angleDeg) {
    const s2 = (n1 / n2) * Math.sin(angleDeg * D2R);
    const tir = s2 > 1;
    return {
      angle: tir ? null : Math.asin(Math.max(-1, Math.min(1, s2))) * R2D,
      tir: tir,
      critical: n1 > n2 ? Math.asin(n2 / n1) * R2D : null
    };
  }

  // скорость света в среде
  function mediumSpeed(n) { return C_LIGHT / n; }

  // длина волны в среде при переходе из воздуха (частота сохраняется)
  function wavelengthIn(lambdaVacNm, n) { return lambdaVacNm / n; }

  // коэффициент отражения по Френелю (нормальное падение) — для оценок
  function fresnelNormal(n1, n2) {
    const r = (n1 - n2) / (n1 + n2);
    return r * r;
  }

  // отношение яркостей: отражённый / прошедший луч по энергии (по Френелю при малых углах)
  function beamSplit(n1, n2, angleDeg) {
    const s = snell(n1, n2, angleDeg);
    if (s.tir) return { reflected: 1, refracted: 0, ...s };
    // упрощённо: чем больше разница n и угол, тем больше отражение
    const fres = fresnelNormal(n1, n2);
    const grow = Math.min(0.6, Math.pow(Math.sin(angleDeg * D2R), 2) * 0.8);
    const reflected = Math.min(0.95, fres + grow);
    return { reflected: reflected, refracted: 1 - reflected, angle: s.angle, tir: false, critical: s.critical };
  }

  /* ---------- смешение цветов (Color Vision) ---------- */

  const CHANNELS = {
    r: { name: 'красный', nm: 630, hex: '#e2453c' },
    g: { name: 'зелёный', nm: 532, hex: '#2fa84f' },
    b: { name: 'синий', nm: 465, hex: '#2f6fd0' }
  };

  // аддитивное смешение: интенсивности 0…1 → цвет и название
  function mixColor(r, g, b) {
    const on = [r > 0.15, g > 0.15, b > 0.15];
    const hex = '#' + [r, g, b].map(function (v) {
      return Math.round(255 * Math.max(0, Math.min(1, v))).toString(16).padStart(2, '0');
    }).join('');
    const key = on.map(function (x) { return x ? 1 : 0; }).join('');
    const names = {
      '100': 'красный', '010': 'зелёный', '001': 'синий',
      '110': 'жёлтый', '011': 'голубой', '101': 'пурпурный',
      '111': 'белый', '000': 'темнота'
    };
    return { hex: hex, name: names[key] || 'смесь', channels: on.filter(Boolean).length };
  }

  // коэффициент пропускания светофильтра по каналам
  function filterTransmit(filter, r, g, b) {
    const map = {
      red: { r: 1, g: 0.05, b: 0.05 }, green: { r: 0.05, g: 1, b: 0.05 }, blue: { r: 0.05, g: 0.05, b: 1 },
      yellow: { r: 1, g: 1, b: 0.05 }, cyan: { r: 0.05, g: 1, b: 1 }, magenta: { r: 1, g: 0.05, b: 1 },
      none: { r: 1, g: 1, b: 1 }
    };
    const m = map[filter] || map.none;
    return { r: r * m.r, g: g * m.g, b: b * m.b };
  }

  /* ---------- поляризация: закон Малюса ---------- */

  // поляризатор под углом alpha к плоскости колебаний: I = I₀·cos²α
  function malus(intensity, alphaDeg) {
    const c = Math.cos(alphaDeg * D2R);
    return Math.max(0, intensity * c * c);
  }

  // естественный свет через идеальный поляризатор теряет половину интенсивности
  function naturalThrough(intensity) { return intensity * 0.5; }

  // доля поляризованного света: 0 — естественный, 1 — полностью поляризованный
  function polarization(kind) {
    return { natural: 0, partial: 0.5, full: 1 }[kind] === undefined ? 0 : { natural: 0, partial: 0.5, full: 1 }[kind];
  }

  /* ---------- дифракционная решётка и интерференция ---------- */

  // d·sinθ = k·λ — положение максимумов (мм и нм), экран на расстоянии L (м)
  function gratingAngles(linesPerMm, lambdaNm, k) {
    const d = 1e-3 / linesPerMm;                 // шаг решётки, м
    const sinT = (k * lambdaNm * 1e-9) / d;
    if (Math.abs(sinT) > 1) return null;
    return Math.asin(sinT) * R2D;
  }

  // расстояние на экране от центрального максимума
  function gratingSpot(linesPerMm, lambdaNm, k, screenM) {
    const a = gratingAngles(linesPerMm, lambdaNm, k);
    if (a === null) return null;
    return screenM * Math.tan(a * D2R);
  }

  // опыт Юнга: усиление/ослабление двух волн с разностью хода Δ
  function interference(lambdaNm, deltaNm) {
    const phase = 2 * Math.PI * deltaNm / lambdaNm;
    const amp = Math.cos(phase / 2);
    // амплитуда 1 — полное усиление, 0 — полное гашение; промежуточные значения «частично»
    const strength = Math.abs(amp);
    return { phase: phase, amp: amp, kind: strength > 0.95 ? 'усиление' : (strength < 0.05 ? 'гашение' : 'частично') };
  }

  /* ---------- линза ---------- */

  // формула тонкой линзы: 1/F = 1/d + 1/f
  function lensImage(d, F) {
    const inv = 1 / F - 1 / d;
    if (Math.abs(inv) < 1e-9) return { f: Infinity, magnification: Infinity, real: false };
    const f = 1 / inv;
    return { f: f, magnification: -f / d, real: f > 0 && d > F, inverted: f < 0 };
  }

  /* ---------- задачи ---------- */

  const PRISM_COLORS = [
    { name: 'красный', nm: 700, n: 1.513 },
    { name: 'жёлтый', nm: 580, n: 1.517 },
    { name: 'зелёный', nm: 532, n: 1.520 },
    { name: 'синий', nm: 465, n: 1.528 },
    { name: 'фиолетовый', nm: 410, n: 1.532 }
  ];

  function createLab() {
    return {
      measures: [],
      n1: 'air', n2: 'water', angle: 30,
      color: { r: 1, g: 0, b: 0 },
      filter: 'none',
      lines: 300, lambda: 532, order: 1, screen: 1,
      lensD: 30, lensF: 20,
      polAngle: 45, polKind: 'natural'
    };
  }

  function facts(lab) {
    const m = lab.measures || [];
    const by = function (k) { return m.filter(function (r) { return r.kind === k; }); };
    const snells = by('snell'), colors = by('color'), gratings = by('grating'), lenses = by('lens');

    const f = { measures: m.length, snellPoints: snells.length, colorPoints: colors.length };
    f.gratingPoints = gratings.length;
    f.lensPoints = lenses.length;

    // Снелл: минимальный угол преломления (сильнее всего отклоняется к нормали)
    f.minRefract = snells.length ? Math.min.apply(null, snells.map(function (r) { return r.refr === null ? 90 : r.refr; })) : 0;
    f.tirSeen = snells.some(function (r) { return r.tir; });

    // разные среды → разные углы при одном угле падения
    const media = {};
    snells.forEach(function (r) { media[r.n2] = { a: r.inc, b: r.refr }; });
    f.mediaCount = Object.keys(media).length;
    // отношение sin(i)/sin(r) — это и есть показатель преломления
    const ratios = snells.filter(function (r) { return r.refr && r.refr > 0.5; })
      .map(function (r) { return Math.sin(r.inc * D2R) / Math.sin(r.refr * D2R); });
    f.nMeasured = ratios.length ? ratios[ratios.length - 1] : 0;

    // цвет
    f.colorNames = Object.keys((function () {
      const o = {}; colors.forEach(function (r) { o[r.out] = 1; }); return o;
    })()).length;
    f.mixNames = Object.keys((function () {
      const o = {}; colors.forEach(function (r) { o[r.out] = 1; }); return o;
    })()).length;
    f.sawWhite = colors.some(function (r) { return r.out === 'белый' || r.out === 'жёлтый'; });
    f.sawBlack = colors.some(function (r) { return r.out === 'темнота'; });

    // решётка
    f.gratingOrders = Object.keys((function () {
      const o = {}; gratings.forEach(function (r) { o[r.lines + '/' + r.lambda + '/k' + r.order] = 1; }); return o;
    })()).length;
    f.redAngle = 0; f.blueAngle = 0;
    gratings.forEach(function (r) {
      if (r.lines === 300 && r.lambda === 700) f.redAngle = r.angle;
      if (r.lines === 300 && r.lambda === 410) f.blueAngle = r.angle;
    });

    // дисперсия: точки по разным длинам волн внутри одной среды
    const wl = {};
    snells.forEach(function (r) { if (r.lambda) wl[r.n2 + ':' + r.lambda] = 1; });
    f.wavelengthCount = Object.keys(wl).length;
    f.redRefr = 0; f.violetRefr = 0;
    snells.forEach(function (r) {
      if (r.lambda === 700) f.redRefr = r.refr;
      if (r.lambda === 410) f.violetRefr = r.refr;
    });

    // линза
    f.lensReal = lenses.length ? lenses[lenses.length - 1].real : false;
    f.lensMag = lenses.length ? Math.abs(lenses[lenses.length - 1].mag) : 0;
    return f;
  }

  const TASKS = [
    {
      t: 'Снелл: преломление',
      goal: 'Снимите не меньше трёх точек «воздух → вода» при разных углах падения и убедитесь, что с ростом угла падения растёт и угол преломления, а отношение sin i / sin r остаётся ≈ 1,33.',
      steps: ['Поставьте среды «Воздух → Вода».', 'Меняйте угол падения от 10° до 60°, снимая точку на каждом шаге.',
        'Проверьте, что отношение синусов не меняется.'],
      hints: ['Закон Снелла: n₁·sin i = n₂·sin r.',
        'Для границы воздух → вода n₁ = 1, n₂ = 1,33, значит sin r всегда меньше sin i.',
        'Отношение sin i / sin r равно показателю преломления второй среды.'],
      check: function (f) { return f.snellPoints >= 3 && Math.abs(f.nMeasured - 1.333) / 1.333 <= 0.06; },
      stars: function (f) { return f.snellPoints >= 4 && Math.abs(f.nMeasured - 1.333) / 1.333 <= 0.03 ? 3 : 2; },
      why: 'На границе двух сред свет меняет направление: n₁ sin i = n₂ sin r. Отношение синусов и есть показатель преломления.'
    },
    {
      t: 'Полное отражение',
      goal: 'Перейдите из воды в воздух и найдите угол, при котором свет перестаёт выходить наружу: снимите точку с полным внутренним отражением.',
      steps: ['Поставьте среды «Вода → Воздух».', 'Увеличивайте угол падения после 45°.',
        'Найдите угол, где преломлённый луч исчезает.'],
      hints: ['Полное внутреннее отражение возможно только при переходе из плотной среды в менее плотную.',
        'Критический угол: sin i = n₂ / n₁ — для воды это около 48,6°.',
        'После критического угла вся энергия остаётся в первой среде.'],
      check: function (f) { return f.tirSeen; },
      stars: function (f) { return f.snellPoints >= 3 && f.tirSeen ? 3 : 2; },
      why: 'Если луч идёт из плотной среды в воздух под углом больше критического, преломлённого луча нет — свет отражается целиком. На этом работают оптоволокно и «алмазный» блеск.'
    },
    {
      t: 'Смешение цветов',
      goal: 'Включите два канала (красный и зелёный) и снимите точку — в центре должен получиться жёлтый. Затем добавьте синий и получите белый.',
      steps: ['Включите красный и зелёный источники.', 'Снимите точку при двух каналах.',
        'Добавьте синий и снимите точку ещё раз.'],
      hints: ['Свет складывается, а не смешивается как краска.',
        'Красный + зелёный = жёлтый, зелёный + синий = голубой, красный + синий = пурпурный.',
        'Все три канала вместе дают белый свет.'],
      check: function (f) { return f.colorPoints >= 2 && f.sawWhite; },
      stars: function (f) { return f.colorPoints >= 3 && f.sawWhite && f.mixNames >= 4 ? 3 : 2; },
      why: 'В аддитивной модели (экран, светодиод) белый — это сумма красного, зелёного и синего каналов.'
    },
    {
      t: 'Светофильтр',
      goal: 'Пропустите белый свет через красный фильтр и убедитесь, что остаётся только красный канал: снимите точку, где часть каналов «съедена».',
      steps: ['Включите все три канала.', 'Выберите красный фильтр и снимите точку.',
        'Повторите с синим или зелёным фильтром.'],
      hints: ['Фильтр не добавляет цвет, а вычитает остальные.',
        'Красный фильтр пропускает только длинноволновую часть спектра.',
        'Свет, которого нет в источнике, фильтр не вернёт.'],
      check: function (f) { return f.colorPoints >= 2 && f.colorNames >= 2; },
      stars: function (f) { return f.colorPoints >= 3 && f.colorNames >= 3 ? 3 : 2; },
      why: 'Светофильтр работает на вычитание: он пропускает свой участок спектра и поглощает остальные.'
    },
    {
      t: 'Дифракционная решётка',
      goal: 'Снимите точки для красного (700 нм) и фиолетового (410 нм) при 300 штрихах на мм и убедитесь, что красный отклоняется сильнее.',
      steps: ['Поставьте 300 штрихов на мм и первый максимум.', 'Снимите точку для 700 нм.',
        'Поставьте 410 нм и снимите точку.'],
      hints: ['Условие максимума: d·sinθ = k·λ — чем больше длина волны, тем больше угол.',
        'Шаг решётки d = 1 мм / число штрихов.',
        'Поэтому красный в спектре дальше от центра, чем фиолетовый.'],
      check: function (f) { return f.gratingPoints >= 2 && f.redAngle > f.blueAngle && f.blueAngle > 0; },
      stars: function (f) { return f.gratingPoints >= 3 && f.gratingOrders >= 3 ? 3 : 2; },
      why: 'Решётка разделяет свет по длинам волн: d·sinθ = k·λ. Красный (большая λ) отклоняется на больший угол, поэтому радуга начинается с красного края.'
    },
    {
      t: 'Спектр порядка',
      goal: 'Снимите второй максимум (k = 2) хотя бы для одной длины волны и сравните с первым: угол должен заметно вырасти.',
      steps: ['Оставьте 300 штрихов на мм, длину волны 532 нм.', 'Снимите точку для k = 1.',
        'Переключите k = 2 и снимите точку.'],
      hints: ['Порядок максимума k входит в формулу линейно.',
        'При 300 штрихах и 532 нм первый максимум около 9°, второй — около 19°.',
        'Если d·sinθ превышает 1, такого максимума не будет.'],
      check: function (f) { return f.gratingPoints >= 2 && f.gratingOrders >= 2; },
      stars: function (f) { return f.gratingPoints >= 4 ? 3 : 2; },
      why: 'Максимумы решётки идут под углами, где разность хода между соседними щелями равна целому числу длин волн.'
    },
    {
      t: 'Линза и изображение',
      goal: 'При F = 20 см снимите точку для d = 30 см и убедитесь, что изображение действительное, а увеличение больше 1.',
      steps: ['Поставьте фокусное расстояние 20 см.', 'Установите предмет на 30 см от линзы.',
        'Снимите точку и посмотрите на увеличение.'],
      hints: ['Формула тонкой линзы: 1/F = 1/d + 1/f.',
        'Если предмет между F и 2F, изображение действительное, перевёрнутое и увеличенное.',
        'Если d < F, изображение мнимое — так работает лупа.'],
      check: function (f) { return f.lensPoints >= 1 && f.lensReal && f.lensMag >= 1.95; },
      stars: function (f) { return f.lensPoints >= 2 && f.lensMag >= 1.95 ? 3 : 2; },
      why: 'Линза собирает лучи: 1/F = 1/d + 1/f. Положение предмета относительно фокуса определяет, получится изображение действительным или мнимым.'
    },
    {
      t: 'Дисперсия',
      goal: 'Снимите углы преломления для красного (700 нм) и фиолетового (410 нм) в одной призме при одинаковом угле падения — фиолетовый должен отклоняться сильнее.',
      steps: ['Поставьте среду «Стекло» и угол падения 40°.', 'Снимите точку для 700 нм.',
        'Поставьте 410 нм и снимите точку.'],
      hints: ['Показатель преломления стекла растёт к фиолетовому концу спектра: 1,513 против 1,532.',
        'Чем больше n, тем сильнее луч прижимается к нормали при выходе в воздух.',
        'Поэтому красный луч в призме уходит дальше от нормали, чем фиолетовый.'],
      check: function (f) { return f.wavelengthCount >= 2 && f.redRefr > 0 && f.violetRefr > 0; },
      stars: function (f) { return f.wavelengthCount >= 3 ? 3 : 2; },
      why: 'Дисперсия — зависимость показателя преломления от длины волны. У стекла n растёт к фиолетовому краю, поэтому фиолетовый луч сильнее прижимается к нормали, а красный уходит дальше — так призма и разлагает белый свет в радугу.'
    }
  ];

  const API = {
    MEDIA: MEDIA, CHANNELS: CHANNELS, PRISM_COLORS: PRISM_COLORS, C_LIGHT: C_LIGHT,
    TASKS: TASKS,
    snell: snell, mediumSpeed: mediumSpeed, wavelengthIn: wavelengthIn,
    fresnelNormal: fresnelNormal, beamSplit: beamSplit,
    mixColor: mixColor, filterTransmit: filterTransmit,
    gratingAngles: gratingAngles, gratingSpot: gratingSpot, interference: interference,
    malus: malus, naturalThrough: naturalThrough, polarization: polarization,
    lensImage: lensImage,
    createLab: createLab, facts: facts
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Optics = API;
})(typeof window !== 'undefined' ? window : globalThis);

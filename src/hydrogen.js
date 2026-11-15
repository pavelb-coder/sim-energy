/* ============================================================
   Энерджиквантум · hydrogen.js
   Стенд «Водородный контур» — по мотивам набора Horizon Energy Box (FCJJ-40):
   обратимый PEM-элемент (электролизёр ↔ топливный элемент), баки H2/O2,
   источники (солнечная панель, ветрогенератор, кривошип, батарейный блок),
   ионистор, нагрузки, топливный элемент на этаноле, солевой элемент,
   термоэлектрический элемент и машинка на разных источниках.

   Модель упрощена осознанно, но числа соответствуют натурному набору:
   электролиз идёт от 1,4–1,5 В, топливный элемент даёт 0,6–0,9 В на ячейку,
   действующая площадь мембраны 25 × 25 мм, баки по 12,5 мл газа.
   ============================================================ */
(function (root) {
  'use strict';

  /* ---------- константы ---------- */

  // разложение воды: теоретически 1,23 В, на практике в наборе нужно ≈1,45 В
  const V_DECOMP = 1.48;
  // напряжение одной ячейки PEM в режиме топливного элемента (без нагрузки)
  const V_OCV = 0.92;
  // площадь мембраны, м² (25 × 25 мм)
  const A_MEMBRANE = 25e-3 * 25e-3;
  // баки воды и газа, мл
  const V_TANK = 12.5;
  // молярный объём газа при 25 °C, мл/моль
  const V_MOLAR_ML = 24000;
  // заряд на моль H2 = 2F
  const F = 96485;

  /* ---------- источники ---------- */

  const SOURCES = {
    solar: { label: 'Солнечная панель', v: 2.6, r: 2.2, signed: false },
    wind: { label: 'Ветрогенератор', v: 3.2, r: 8.0, signed: false },
    crank: { label: 'Кривошип (ручной генератор)', v: 3.6, r: 5.0, signed: true },
    battery: { label: 'Батарейный блок (2 × AA = 3 В)', v: 3.0, r: 0.9, signed: false },
  };

  /* ---------- обратимый PEM-элемент ---------- */

  // вольт-амперная кривая топливного элемента: активация + омика, 0,6–0,9 В на ячейку
  // напряжение ячейки при токе i (А) и заполнении бака c (0…1)
  function fuelCellVoltage(i, c) {
    if (i <= 0) return V_OCV;
    const cc = Math.max(0.02, c);
    const act = 0.045 * Math.log10(1 + i / 0.02);          // активационные потери
    const ohm = i * (0.35 / cc);                           // омические, R = 0,35 Ом / заполнение
    return Math.max(0, V_OCV - act - ohm);
  }

  // ток электролиза при заданном напряжении (после порога 1,45 В — почти линейно)
  function electrolyzerCurrent(v) {
    if (v < 1.39) return 0;
    return Math.max(0, (v - 1.39) * 0.62);
  }

  /**
   * Скорость выделения газа (мл/с) при токе I, А.
   * Объём одного моля газа при н. у. — 22,4 л, на 1 H2 нужно 2F заряда.
   */
  function gasRateFromCurrent(i) {
    // 1 А даёт 24000 / (2 · 96485) ≈ 0,124 мл/с ≈ 7,5 мл H₂ в минуту
    return i * V_MOLAR_ML / (2 * F);
  }

  /* ---------- состояние ---------- */

  function createState() {
    return {
      t: 0,
      // источник питания
      source: 'battery',
      solarIrradiance: 700,      // Вт/м²
      sunAngle: 45,              // угол падения на панель, °
      solarShade: 0,             // 0 — нет тени, 1 — полная
      solarHeat: 25,             // температура панели, °C
      windSpeed: 6,              // м/с
      tilt: 45,                  // наклон панели, °
      crankRpm: 120,
      crankTime: 0,              // сколько секунд крутим
      crankBattery: 0,           // заряд кривошипа, 0…1 (ионистор)
      // режим элемента
      mode: 'electrolysis',      // electrolysis | fuelcell
      // газы
      h2: 0,                     // Вт·ч накопленной химической энергии (эквивалент)
      o2: 0,
      h2Ml: 0,                   // мл газа в баке
      o2Ml: 0,
      // нагрузка
      load: 'led',               // led | fan | car | voltmeter | resistor
      loadOhm: 100,
      loadOn: true,
      // накопитель
      cap: 'none',               // none | pure | salt | thermal | ethanol
      capTemp: 25,
      thermalHot: 60,            // °C горячая вода в термоэлектрическом
      thermalCold: 20,           // °C холодная
      capSalinity: 3.5,          // % NaCl
      capFuelPercent: 10,        // % этанола
      capFlow: 1,                // расход реагента, 0…1
      // измерения
      log: [],
      solved: {},
      totalH2: 0,                // всего произведено водорода, мл
      peakPower: 0,              // лучшая мощность топливного элемента, мВт
    };
  }

  /* ---------- модель ---------- */

  /**
   * Напряжение и внутреннее сопротивление выбранного источника.
   * @param {object} st
   * @returns {{v:number, r:number, label:string}}
   */
  function sourceEmf(st) {
    const s = SOURCES[st.source] || SOURCES.battery;
    let v = s.v;
    let r = s.r;
    if (st.source === 'solar') {
      // ток зависит от освещённости, наклона, тени и нагрева
      const cosTilt = Math.max(0, Math.cos((st.tilt - (90 - st.sunAngle)) * Math.PI / 180));
      const shade = 1 - 0.85 * Math.max(0, Math.min(1, st.solarShade));
      // нагрев снижает напряжение примерно на 0,4 %/°C выше 25 °C
      const heatK = 1 - 0.004 * (st.solarHeat - 25);
      v = st.solarIrradiance / 700 * cosTilt * shade * heatK * 2.6;
      r = 2.2 / Math.max(0.25, st.solarIrradiance / 700);
    } else if (st.source === 'wind') {
      // P ~ v³, панель генератора 3,2 В при 6 м/с
      const ratio = Math.max(0, st.windSpeed) / 6;
      v = Math.min(4.6, 3.2 * Math.pow(ratio, 1.5));
      r = 8.0 / Math.max(0.3, ratio * ratio);
    } else if (st.source === 'crank') {
      const ratio = Math.max(0, st.crankRpm) / 120;
      v = Math.min(5.2, 3.6 * ratio);
      r = 5.0;
    }
    return { v: Math.max(0, v * (1 - Math.max(0, Math.min(1, st.crankBattery)) * 0.15)), r: r, label: s.label };
  }

  /**
   * Напряжение и ток электролизёра (источник → элемент).
   * @param {object} st
   * @returns {{v:number, i:number, powered:boolean}}
   */
  function electrolysisPoint(st) {
    const e = sourceEmf(st);
    if (e.v <= V_DECOMP * 0.95) return { v: e.v, i: 0, powered: false };
    // рабочая точка — пересечение нагрузочной прямой источника (E − I·r)
    // и вольт-амперной кривой электролизёра; ищем делением отрезка
    const f = function (v) { return (e.v - v) / e.r - electrolyzerCurrent(v); };
    let lo = 0, hi = e.v;
    if (f(0) <= 0) return { v: e.v, i: 0, powered: false };
    for (let k = 0; k < 80; k++) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) lo = mid; else hi = mid;
    }
    const v = (lo + hi) / 2;
    const i = electrolyzerCurrent(v);
    return { v: Math.max(0, v), i: Math.max(0, i), powered: i > 1e-4 };
  }

  /**
   * Точка работы топливного элемента на выбранную нагрузку.
   * @param {object} st
   * @returns {{v:number, i:number, p:number, r:number}}
   */
  function fuelCellPoint(st) {
    // нет топлива — нет реакции: напряжение падает почти до нуля
    if (st.h2Ml < 0.05) return { v: 0.08 * (st.h2Ml / 0.05), i: 0, p: 0, r: 0.35 };
    const c = Math.max(0.02, Math.min(1, st.h2Ml / V_TANK));
    const R = loadResistance(st);
    // рабочая точка: пересечение ВАХ элемента и прямой U = I·R (деление отрезка)
    const f = function (i) { return fuelCellVoltage(i, c) - i * R; };
    let lo = 0, hi = 1.5;
    if (f(hi) > 0) { const i = hi, v = i * R; return { v: v, i: i, p: v * i, r: 0.35 / c }; }
    for (let k = 0; k < 90; k++) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) lo = mid; else hi = mid;
    }
    const i = (lo + hi) / 2;
    const v = Math.max(0, i * R);
    return { v: v, i: i, p: v * i, r: 0.35 / c };
  }

  /**
   * Сопротивление нагрузки, Ом.
   * @param {object} st
   * @returns {number}
   */
  function loadResistance(st) {
    switch (st.load) {
      case 'led': return 220;      // светодиод с резистором
      case 'fan': return 12;       // моторчик вентилятора
      case 'car': return 6;        // мотор машинки под нагрузкой
      case 'voltmeter': return 1e6;
      case 'resistor': return Math.max(5, st.loadOhm);
      default: return 220;
    }
  }

  /**
   * Выход топливного элемента на этаноле, солевого и термоэлектрического.
   * @param {object} st
   * @returns {{v:number, i:number, p:number, kind:string, note:string}}
   */
  function chemicalSource(st) {
    if (st.cap === 'ethanol') {
      // DEFC: заметно ниже PEM и падает при концентрации выше 15 %
      const over = st.capFuelPercent > 15 ? (st.capFuelPercent - 15) * 0.035 : 0;
      const c = Math.max(0.05, Math.min(1, st.capFuelPercent / 10));
      const v = Math.max(0, 0.55 * c - over) * (0.6 + 0.4 * st.capFlow);
      return { v: v, i: v / loadResistance(st), p: v * v / loadResistance(st), kind: 'ethanol',
        note: st.capFuelPercent > 15 ? 'концентрация выше 15 % — элемент деградирует' : 'реакция идёт 5–10 минут после заливки' };
    }
    if (st.cap === 'salt') {
      // солевой элемент: Mg-анод, 1,2 В / 200 мА по паспорту, зависит от концентрации и температуры
      const c = Math.max(0, Math.min(1, st.capSalinity / 5));
      const tempK = 1 + 0.012 * (st.capTemp - 25);
      const v = Math.min(1.2, 1.2 * (0.72 + 0.28 * c) * tempK);
      return { v: v, i: v / Math.max(5, loadResistance(st)), p: v * v / Math.max(5, loadResistance(st)),
        kind: 'salt', note: st.capSalinity < 1 ? 'слишком мало соли' : 'магниевый анод расходуется' };
    }
    if (st.cap === 'thermal') {
      // термоэлектрический: ~20 мВ на °C разницы в наборе
      const dT = Math.max(0, st.thermalHot - st.thermalCold);
      const v = dT * 0.021;
      const rint = 2.5;
      const i = v / (rint + loadResistance(st));
      return { v: v, i: i, p: i * i * loadResistance(st), kind: 'thermal',
        note: dT > 30 ? 'разница температур большая' : 'нужна разница температур больше 30 °C' };
    }
    return { v: 0, i: 0, p: 0, kind: 'none', note: 'накопитель не выбран' };
  }

  /**
   * Шаг модели на dt секунд модельного времени.
   * @param {object} st
   * @param {number} dt
   * @returns {void}
   */
  function step(st, dt) {
    st.t += dt;
    const elec = electrolysisPoint(st);

    if (st.mode === 'electrolysis') {
      if (elec.powered) {
        const rate = gasRateFromCurrent(elec.i);          // мл/с H2
        st.h2Ml = Math.min(V_TANK, st.h2Ml + rate * dt);
        st.o2Ml = Math.min(V_TANK, st.o2Ml + rate * dt * 0.5);
        st.totalH2 += rate * dt;
      }
      // в электролизёре топливный элемент не работает
      st.h2 = st.h2Ml / V_TANK;
    } else {
      const fc = fuelCellPoint(st);
      if (st.h2Ml > 0.02 && st.loadOn) {
        // расход газа пропорционален току
        const rate = gasRateFromCurrent(fc.i);            // мл/с
        st.h2Ml = Math.max(0, st.h2Ml - rate * dt);
        st.o2Ml = Math.max(0, st.o2Ml - rate * dt * 0.5);
        st.peakPower = Math.max(st.peakPower, fc.p * 1000);
      }
      st.h2 = st.h2Ml / V_TANK;
    }
    return st;
  }

  /**
   * Все измеряемые величины для интерфейса и заданий.
   * @param {object} st
   * @returns {object}
   */
  function facts(st) {
    const elec = electrolysisPoint(st);
    const fc = fuelCellPoint(st);
    const chem = chemicalSource(st);
    const e = sourceEmf(st);
    const h2pct = st.h2Ml / V_TANK;
    const active = st.mode === 'electrolysis' ? elec : fc;
    const loadP = st.mode === 'electrolysis' ? 0 : (st.loadOn ? fc.p : 0);
    return {
      t: st.t,
      sourceLabel: e.label,
      sourceV: e.v,
      mode: st.mode,
      elecV: elec.v,
      elecI: elec.i,
      elecP: elec.v * elec.i,
      powered: elec.powered,
      fcV: st.h2Ml > 0.02 ? fc.v : 0,
      fcI: st.h2Ml > 0.02 ? fc.i : 0,
      loadP: loadP,
      peakPower: st.peakPower,
      h2Ml: st.h2Ml,
      o2Ml: st.o2Ml,
      h2pct: h2pct,
      totalH2: st.totalH2,
      gasRate: st.mode === 'electrolysis' ? gasRateFromCurrent(elec.i) : gasRateFromCurrent(fc.i),
      chem: chem,
      // энергия для машинки: P/LED эквивалент
      carSpeed: carSpeed(st, fc, chem),
    };
  }

  /**
   * Скорость машинки, см/с — для наглядности «едим» мощность.
   * @param {object} st
   * @param {object} fc
   * @param {object} chem
   * @returns {number}
   */
  // скорость машинки: ≈ 1,1 см/с на каждый милливатт на моторе
  function carSpeed(st, fc, chem) {
    if (st.load !== 'car') return 0;
    const p = st.mode === 'fuelcell' ? fc.p : chem.p;
    if (st.mode === 'fuelcell' && st.h2Ml <= 0.02) return 0;
    return Math.min(160, Math.round(p * 1000 * 1.1));
  }

  /* ---------- задания ---------- */

  const TASKS = [
    {
      t: 'Разложить воду',
      goal: 'Получите водород электролизом: заполните бак H₂ не меньше чем на 60 %.',
      steps: ['Выберите источник: батарейный блок или солнечную панель.',
        'Включите режим «Электролиз».',
        'Дождитесь, пока бак H₂ заполнится.'],
      hints: ['Разложение воды начинается примерно с 1,45 В — батарейного блока 3 В хватает.',
        'Газа выделяется тем больше, чем выше ток.',
        'Солнечная панель даёт нужное напряжение при хорошей освещённости и без тени.'],
      check: function (f) { return f.h2pct >= 0.6; },
      stars: function (f) { return f.h2pct >= 0.95 ? 3 : (f.h2pct >= 0.75 ? 2 : 1); },
    },
    {
      t: 'Зажечь светодиод водородом',
      goal: 'Переключите элемент в режим топливного элемента и зажгите светодиод: напряжение не меньше 0,6 В.',
      steps: ['Наберите водород.', 'Переключите режим на «Топливный элемент».', 'Подключите нагрузку «Светодиод».'],
      hints: ['Топливный элемент отдаёт 0,6–0,9 В на ячейку.', 'Чем больше газа в баке, тем меньше внутреннее сопротивление.',
        'Пустой бак — нет реакции: сначала наберите H₂.'],
      check: function (f) { return f.mode === 'fuelcell' && f.fcV >= 0.6; },
      stars: function (f) { return f.fcV >= 0.8 ? 3 : (f.fcV >= 0.7 ? 2 : 1); },
    },
    {
      t: 'Вращение вентилятора',
      goal: 'Раскрутите вентилятор от водорода: получите мощность не меньше 40 мВт.',
      steps: ['Подключите нагрузку «Вентилятор».', 'Заполните бак H₂.', 'Переключитесь в режим топливного элемента.'],
      hints: ['Мощность = U × I, у вентилятора малое сопротивление — ток большой.',
        'Слишком малый бак даёт просадку напряжения.', 'Сравните мощность с нагрузкой «Светодиод».'],
      check: function (f) { return f.mode === 'fuelcell' && f.loadP * 1000 >= 40; },
      stars: function (f) { return f.loadP * 1000 >= 100 ? 3 : (f.loadP * 1000 >= 60 ? 2 : 1); },
    },
    {
      t: 'Солнечный электролиз',
      goal: 'Получите водород только от солнца: бак H₂ не меньше 40 %, источник — панель.',
      steps: ['Источник — солнечная панель.', 'Уберите тень и подберите наклон.', 'Включите электролиз.'],
      hints: ['Тень на панели снижает ток почти линейно.', 'Наклон панели настраивается под высоту солнца.',
        'Нагретая панель даёт меньше напряжения.'],
      check: function (f) { return f.h2pct >= 0.4 && f.sourceLabel.indexOf('Солнечная') === 0; },
      stars: function (f) { return f.h2pct >= 0.8 ? 3 : (f.h2pct >= 0.6 ? 2 : 1); },
    },
    {
      t: 'Ветряной электролиз',
      goal: 'Получите водород от ветрогенератора: бак H₂ не меньше 40 % при скорости ветра.',
      steps: ['Источник — ветрогенератор.', 'Поднимите скорость ветра.', 'Включите электролиз.'],
      hints: ['Мощность ветра растёт как куб скорости, напряжение — быстрее линейного.',
        'При слабом ветре напряжения не хватит для разложения воды.', 'Сравните 4 и 8 м/с.'],
      check: function (f) { return f.h2pct >= 0.4 && f.sourceLabel.indexOf('Ветро') === 0; },
      stars: function (f) { return f.h2pct >= 0.8 ? 3 : (f.h2pct >= 0.6 ? 2 : 1); },
    },
    {
      t: 'Машинка на водороде',
      goal: 'Разгоните машинку на водородном топливном элементе до 100 см/с.',
      steps: ['Нагрузка — «Машинка».', 'Наберите водород.', 'Переключитесь в режим топливного элемента.'],
      hints: ['У машинки ещё меньшее сопротивление, чем у вентилятора, — ток больше.',
        'Держите бак поближе к полному.', 'Скорость считается по мощности на мотор.'],
      check: function (f) { return f.loadP > 0 && f.carSpeed >= 100; },
      stars: function (f) { return f.carSpeed >= 140 ? 3 : (f.carSpeed >= 120 ? 2 : 1); },
    },
  ];

  /* ---------- экспорт ---------- */

  const api = {
    TASKS: TASKS,
    SOURCES: SOURCES,
    V_DECOMP: V_DECOMP,
    V_OCV: V_OCV,
    V_TANK: V_TANK,
    A_MEMBRANE: A_MEMBRANE,
    createState: createState,
    step: step,
    facts: facts,
    electrolysisPoint: electrolysisPoint,
    fuelCellPoint: fuelCellPoint,
    electrolyzerCurrent: electrolyzerCurrent,
    fuelCellVoltage: fuelCellVoltage,
    gasRateFromCurrent: gasRateFromCurrent,
    sourceEmf: sourceEmf,
    chemicalSource: chemicalSource,
    loadResistance: loadResistance,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Hydrogen = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);

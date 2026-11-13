/* ============================================================
   Энерджиквантум · storage.js
   Модель стенда «Накопители и преобразователи»
   Не зависит от DOM — тестируется в Node.
   ============================================================ */
(function (root) {
  'use strict';

  // Параметры накопителей: напряжение, ёмкость, внутреннее сопротивление, пределы
  const TYPES = {
    liion: {
      name: 'Li-ion 18650', short: 'Li-ion', nominal: 3.7, full: 4.2, empty: 3.0,
      capAh: 2.6, rInt: 0.08, maxC: 1.0, maxChargeC: 1.0, eff: 0.95, tempMax: 45, cycles: 500
    },
    lifepo4: {
      name: 'LiFePO₄ 6 А·ч', short: 'LiFePO₄', nominal: 3.2, full: 3.65, empty: 2.8,
      capAh: 6, rInt: 0.05, maxC: 1.0, maxChargeC: 1.0, eff: 0.96, tempMax: 45, cycles: 2000
    },
    lead: {
      name: 'Свинцовый 12 В · 7 А·ч', short: 'Pb', nominal: 12, full: 13.8, empty: 11.0,
      capAh: 7, rInt: 0.03, maxC: 0.5, maxChargeC: 0.25, eff: 0.85, tempMax: 40, cycles: 300
    }
  };

  const LOADS = {
    lamp: { name: 'Лампа 5 Вт', power: 5, kind: 'dc' },
    motor: { name: 'Двигатель 20 Вт', power: 20, kind: 'dc' },
    impulse: { name: 'Импульсная нагрузка 50 Вт', power: 50, kind: 'impulse', duty: 0.1 },
    inverter: { name: 'Инвертор 220 В · 60 Вт', power: 60, kind: 'ac' }
  };

  const CAP = { C: 10, name: 'Ионистор 10 Ф' };   // суперконденсатор

  function createState() {
    return {
      type: 'liion',
      soc: 0.5,
      temp: 25,
      chargeOn: false,
      chargeC: 0.5,            // ток заряда в долях ёмкости (C-rate)
      load: 'lamp',
      loadOn: true,
      converter: 'buck',       // buck | boost | none
      duty: 0.42,              // скважность ШИМ
      inverterOn: false,
      storage: 'battery',      // battery | cap
      capVoltage: 12,
      t: 0,
      energyIn: 0, energyOut: 0,
      measures: [],
      log: [],
      i: 0, u: 0, p: 0, loadP: 0,
      eff: 0,
      warn: [],
      wave: []
    };
  }

  function typeOf(st) { return TYPES[st.type]; }

  /* ---------- кривая напряжения от SoC (кусочно-линейная) ---------- */

  function openCircuitVoltage(st) {
    const T = typeOf(st);
    const soc = Math.max(0, Math.min(1, st.soc));
    // характерная «полка» литиевых и линейный участок свинцовых
    const pts = st.type === 'lead'
      ? [[0, 11.0], [0.2, 11.8], [0.5, 12.2], [0.8, 12.6], [1.0, 12.9]]
      : [[0, T.empty], [0.1, T.empty + 0.25], [0.5, T.nominal + 0.05], [0.9, T.nominal + 0.3], [1.0, T.full]];
    for (let i = 1; i < pts.length; i++) {
      if (soc <= pts[i][0]) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        const k = (soc - x0) / (x1 - x0);
        return y0 + k * (y1 - y0);
      }
    }
    return pts[pts.length - 1][1];
  }

  function capacityWh(st) { return typeOf(st).capAh * typeOf(st).nominal; }

  function storedWh(st) { return capacityWh(st) * st.soc; }

  /* ---------- преобразователи ---------- */

  function buckVoltage(st) { return openCircuitVoltage(st) * st.duty; }

  function converterEfficiency(st) {
    // buck/boost: КПД зависит от тока; инвертор — от загрузки
    if (st.load === 'inverter') {
      const P = LOADS.inverter.power;
      const load = Math.max(0.05, st.loadP / P);
      return 0.72 + 0.22 * Math.min(1, load) - 0.06 * Math.max(0, load - 0.8);  // 72 % при малой, до 94 %
    }
    const P = loadPower(st);
    const nominal = 20;
    const ratio = Math.min(1.5, P / nominal);
    return 0.82 + 0.12 * Math.min(1, ratio);   // 82…94 %
  }

  function loadPower(st) {
    if (st.storage === 'cap') return LOADS[st.load].power;
    const L = LOADS[st.load];
    return st.loadOn ? L.power * (L.duty || 1) : 0;
  }

  /* ---------- заряд CC/CV ---------- */

  function chargeCurrent(st) {
    const T = typeOf(st);
    const iMax = T.capAh * st.chargeC;
    const v = openCircuitVoltage(st);
    if (!st.chargeOn) return 0;
    if (v >= T.full - 0.001) return 0;                 // отсечка по напряжению
    // CV-режим: чем ближе к полному, тем меньше ток
    if (st.soc < 0.8) return iMax;                       // CC: постоянный ток
    const k = Math.max(0, 1 - (st.soc - 0.8) / 0.2);      // CV: ток линейно падает
    return iMax * k;
  }

  /* ---------- шаг модели ---------- */

  function step(st, dtReal, speed) {
    // 1 модельная минута за 1 реальную секунду при ×1
    const dMin = dtReal * speed * 1;
    const dtH = dMin / 60;   // модельные часы за шаг
    st.t += dtReal;
    const T = typeOf(st);

    // 1. нагрев от протекающего тока и охлаждение
    let iNow = 0;

    // 2. заряд
    const iC = chargeCurrent(st);
    if (iC > 0 && st.storage === 'battery') {
      const add = iC * dtH * 0.95 / T.capAh;            // прирост SoC
      st.soc = Math.min(1, st.soc + add);
      iNow = iC;
      st.energyIn += iC * T.nominal * dtH;
    }

    // 3. разряд под нагрузкой
    const Pout = loadPower(st);
    st.loadP = Pout;
    if (Pout > 0) {
      if (st.storage === 'cap') {
        // ионистор: E = ½CU², разряд линейно по энергии
        const E = 0.5 * CAP.C * st.capVoltage * st.capVoltage;   // Дж
        const used = Pout * dtReal * speed * 0.25;               // ускоренная шкала
        const Enew = Math.max(0, E - used);
        st.capVoltage = Math.sqrt(2 * Enew / CAP.C);
        st.i = Pout / Math.max(1, st.capVoltage);
        st.u = st.capVoltage;
        st.p = Pout;
        st.energyOut += used / 3600;
        st.soc = Enew / (0.5 * CAP.C * 12 * 12);
        st.loadP = Enew > 0.5 ? Pout : 0;
        return st;
      }
      const eff = converterEfficiency(st);
      st.eff = eff;
      const v = openCircuitVoltage(st);
      const iLoad = Pout / eff / Math.max(0.5, v);   // ток из накопителя
      iNow = Math.max(iNow, iLoad);
      const drop = iLoad * dtH / 0.95 / T.capAh;
      st.soc = Math.max(0, st.soc - drop);
      st.energyOut += Pout * dtH;
    } else {
      st.eff = converterEfficiency(st);
    }

    // 4. температура: нагрев I²R + саморазогрев при заряде, охлаждение к среде
    const heat = iNow * iNow * T.rInt;                        // Вт тепла на внутреннем сопротивлении
    const dTemp = (heat * 1.6 * dMin - (st.temp - 25) * 0.35 * dMin);   // нагрев/охлаждение за модельную минуту
    st.temp = Math.max(25, Math.min(80, st.temp + dTemp));

    // 5. мгновенные показания
    const vNow = openCircuitVoltage(st);
    st.i = iNow;
    st.u = st.storage === 'cap' ? st.capVoltage : vNow - iNow * T.rInt;
    st.p = st.u * iNow;

    // 6. предупреждения BMS
    st.warn = [];
    if (iNow > T.capAh * T.maxC) st.warn.push('ток разряда выше ' + T.maxC + 'C');
    if (iC > T.capAh * T.maxChargeC) st.warn.push('ток заряда выше ' + T.maxChargeC + 'C');
    if (st.temp > T.tempMax) st.warn.push('перегрев: ' + Math.round(st.temp) + ' °C');
    if (st.soc <= 0.02 && Pout > 0) st.warn.push('глубокий разряд');

    return st;
  }

  /* ---------- формы сигналов для осциллографа ---------- */

  function waveform(st, points) {
    const n = points || 120;
    const out = [];
    for (let i = 0; i < n; i++) {
      const phase = i / n;
      let v = 0;
      if (st.load === 'inverter' && st.inverterOn) {
        // чистая синусоида 50 Гц (на экране — 2 периода)
        v = Math.sin(phase * 4 * Math.PI) * 230 * Math.sqrt(2) * 0.5;
      } else if (st.converter !== 'none') {
        // ШИМ: меандр со скважностью D
        v = (phase % 1) < st.duty ? openCircuitVoltage(st) : 0;
      }
      out.push(v);
    }
    return out;
  }

  /* ---------- факты для заданий ---------- */

  function facts(st) {
    const T = typeOf(st);
    const Pout = loadPower(st);
    const eff = converterEfficiency(st);
    const f = {
      type: st.type,
      soc: st.soc,
      volt: openCircuitVoltage(st),
      terminal: st.u,
      temp: st.temp,
      current: st.i,
      power: st.p,
      loadP: Pout,
      eff: eff,
      buckV: buckVoltage(st),
      duty: st.duty,
      capacityWh: capacityWh(st),
      storedWh: storedWh(st),
      energyIn: st.energyIn,
      energyOut: st.energyOut,
      autonomyH: Pout > 0 ? storedWh(st) / (Pout / eff) : 0,
      warnings: st.warn.slice(),
      measures: st.measures.slice(),
      chargeMeasures: st.measures.filter(function (m) { return m.kind === 'charge'; }),
      dischargeRuns: st.measures.filter(function (m) { return m.kind === 'discharge'; }),
      effMeasures: st.measures.filter(function (m) { return m.kind === 'eff'; }),
      capMeasures: st.measures.filter(function (m) { return m.kind === 'cap'; }),
      lampRuns: st.measures.filter(function (m) { return m.kind === 'autonomy' && m.load === 'lamp'; }),
      maxTemp: st.measures.reduce(function (a, m) { return Math.max(a, m.temp || 0); }, st.temp),
      capEnergyJ: 0.5 * CAP.C * st.capVoltage * st.capVoltage
    };
    // разброс отданной ёмкости при разных токах
    const d = f.dischargeRuns;
    if (d.length >= 2) {
      const a = d.reduce(function (x, m) { return m.cRate > x.cRate ? m : x; }, d[0]);
      const b = d.reduce(function (x, m) { return m.cRate < x.cRate ? m : x; }, d[0]);
      f.dischargeRatio = b.wh > 0 ? a.wh / b.wh : 0;
      f.dischargeDelta = b.wh - a.wh;
    }
    return f;
  }

  /* ---------- задания ---------- */

  const TASKS = [
    {
      t: 'Полный заряд без перегрева',
      goal: 'Зарядите аккумулятор с 50 % до 100 % так, чтобы температура не превысила 45 °C, а ток заряда — 1C.',
      steps: ['Включите заряд и задайте ток.', 'Следите за температурой и током.', 'Дождитесь полного заряда.'],
      hints: ['Ток заряда задаётся в долях ёмкости: 1C для Li-ion 2,6 А·ч — это 2,6 А.',
              'Чем больше ток, тем сильнее нагрев: Q = I²·Rвн.',
              'Свинцовый аккумулятор не любит быстрый заряд — не больше 0,25C.'],
      check: function (f) { return f.soc >= 0.99 && f.maxTemp <= 45 && f.warnings.length === 0; },
      stars: function (f) { return f.maxTemp <= 35 ? 3 : (f.maxTemp <= 45 ? 2 : 1); },
      why: 'Заряд идёт в два этапа: сначала постоянным током (CC), затем при постоянном напряжении (CV) ток сам падает. Перегрев выше 45 °C ускоряет износ и опасен.'
    },
    {
      t: 'Кривая разряда при разных токах',
      goal: 'Разрядите аккумулятор дважды: при 0,5C и при 1C. При большем токе отданная энергия должна быть меньше.',
      steps: ['Включите нагрузку «лампа» и снимите точку разряда.', 'Увеличьте ток (нагрузка мощнее) и повторите.', 'Сравните отданную энергию.'],
      hints: ['Нагрузка «лампа 5 Вт» — это примерно 0,5C для элемента 2,6 А·ч.',
              'Кнопка «Снять точку» пишет ток, напряжение, температуру и отданную энергию.',
              'Разница появляется из-за внутреннего сопротивления: часть энергии уходит в тепло.'],
      check: function (f) { return f.dischargeRuns.length >= 2 && f.dischargeRatio < 0.97; },
      stars: function (f) {
        if (!(f.dischargeRuns.length >= 2 && f.dischargeRatio < 0.97)) return 1;
        return f.dischargeRuns.length >= 3 ? 3 : 2;
      },
      why: 'При большем токе часть энергии теряется на внутреннем сопротивлении (I²R) и напряжение проседает быстрее — отданная ёмкость падает.'
    },
    {
      t: 'Время автономии',
      goal: 'Рассчитайте и измерьте время работы лампы 5 Вт от полностью заряженного аккумулятора. Расхождение — не более 10 %.',
      steps: ['Зарядите аккумулятор до 100 %.', 'Включите лампу и заметьте время.', 'Сравните с расчётом E/(P/КПД).'],
      hints: ['Энергия = ёмкость (А·ч) × напряжение (В). Для Li-ion 2,6 А·ч это 9,6 Вт·ч.',
              'Учитывайте КПД преобразователя — он ниже 100 %.',
              'Кнопка «Снять точку» фиксирует расчётное время автономии.'],
      check: function (f) { return f.lampRuns.length >= 1 && f.lampRuns.some(function (m) { return m.autonomyH > 0; }); },
      stars: function (f) {
        const m = f.lampRuns[f.lampRuns.length - 1];
        if (!m) return 1;
        const err = Math.abs(m.autonomyH - m.autonomyCalc) / Math.max(m.autonomyCalc, 0.01);
        return err <= 0.05 ? 3 : (err <= 0.1 ? 2 : 1);
      },
      why: 'Время автономии = запас энергии × КПД / мощность нагрузки. Реальная ёмкость всегда меньше паспортной, поэтому расчёт — это верхняя оценка.'
    },
    {
      t: 'Импульсная нагрузка: батарея или ионистор',
      goal: 'Снимите точку с батареи и с ионистора при импульсной нагрузке. Сравните просадку напряжения.',
      steps: ['Выберите нагрузку «импульсная».', 'Снимите точку с аккумулятором.', 'Переключитесь на ионистор и повторите.'],
      hints: ['Ионистор держит большие токи: E = ½·C·U².',
              'У батареи напряжение проседает на I·Rвн — это и есть просадка.',
              'Кнопка «Снять точку» записывает выбранный накопитель.'],
      check: function (f) { return f.capMeasures.length >= 1 && f.measures.some(function (m) { return m.kind === 'discharge' && m.load === 'impulse'; }); },
      stars: function (f) { return (f.capMeasures.length >= 1 && f.dischargeRuns.some(function (m) { return m.load === 'impulse'; })) ? 3 : 1; },
      why: 'Батарея оптимизирована под энергию, ионистор — под мощность. Для коротких импульсов ионистор отдаёт ток без глубокой просадки и не изнашивается.'
    },
    {
      t: 'Настроить понижающий преобразователь',
      goal: 'Настройте buck так, чтобы получить 5,0 В от свинцового аккумулятора 12 В, и снимите КПД.',
      steps: ['Выберите свинцовый аккумулятор.', 'Подберите скважность ШИМ.', 'Снимите точку КПД.'],
      hints: ['Buck: Uвых = D · Uвх, значит D = 5 / 12 ≈ 0,42.',
              'КПД buck — 82…94 % в зависимости от тока нагрузки.',
              'Проверьте выходное напряжение в индикаторе преобразователя.'],
      check: function (f) { return f.type === 'lead' && f.buckV >= 4.75 && f.buckV <= 5.25 && f.effMeasures.length >= 1; },
      stars: function (f) {
        if (!(f.type === 'lead' && f.buckV >= 4.75 && f.buckV <= 5.25 && f.effMeasures.length >= 1)) return 1;
        return (f.buckV >= 4.9 && f.buckV <= 5.1) ? 3 : 2;
      },
      why: 'Понижающий преобразователь «рубит» входное напряжение ключом: среднее на выходе равно U·D. КПД определяется потерями в ключе и дросселе.'
    },
    {
      t: 'КПД инвертора',
      goal: 'Снимите КПД инвертора при трёх уровнях нагрузки: лампа, двигатель, импульсная. Найдите, где КПД выше.',
      steps: ['Включите инвертор и нагрузку «лампа».', 'Снимите точку.', 'Повторите с двигателем и импульсной нагрузкой.'],
      hints: ['КПД инвертора зависит от загрузки: на малой мощности он низкий.',
              'Три точки — три разных нагрузки.',
              'Кнопка «Снять точку» пишет КПД в протокол.'],
      check: function (f) { return f.effMeasures.length >= 3; },
      stars: function (f) { return f.effMeasures.length >= 3 && f.effMeasures.some(function (m) { return m.eff >= 0.88; }) ? 3 : 2; },
      why: 'У инвертора есть «холостой ход»: собственное потребление 3–8 Вт. На малой нагрузке оно съедает большую долю, поэтому КПД растёт с загрузкой.'
    }
  ];

  const API = {
    TYPES: TYPES, LOADS: LOADS, CAP: CAP, TASKS: TASKS,
    createState: createState, step: step, facts: facts,
    openCircuitVoltage: openCircuitVoltage, capacityWh: capacityWh, storedWh: storedWh,
    chargeCurrent: chargeCurrent, loadPower: loadPower, converterEfficiency: converterEfficiency,
    buckVoltage: buckVoltage, waveform: waveform
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Storage = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);

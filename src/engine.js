/* ============================================================
   Энерджиквантум · Виртуальная лаборатория
   engine.js — физическая модель виртуального стенда «Электрические цепи»
   Не зависит от DOM: тестируется в Node, используется в браузере.
   ============================================================ */
(function (root) {
  'use strict';

  const AMB = 293.15;          // температура среды, К
  const R_WIRE = 1e-3;         // сопротивление идеального ключа/амперметра, Ом
  const R_OPEN = 1e9;          // сопротивление разомкнутого ключа, Ом
  const R_VOLTMETER = 1e7;     // входное сопротивление вольтметра, Ом
  const G_LEAK = 1e-12;        // утечка в узел земли (регуляризация матрицы)

  const PART_DEFS = {
    source:   { cat: 'src',  name: 'Батарея',          terms: ['−', '+'], def: { emf: 9, r: 0.5 } },
    resistor: { cat: 'load', name: 'Резистор',         terms: ['1', '2'], def: { R: 10, pMax: 2 } },
    lamp:     { cat: 'load', name: 'Лампа',            terms: ['1', '2'], def: { ratedU: 9, ratedP: 2 } },
    led:      { cat: 'load', name: 'Светодиод',        terms: ['A', 'K'], def: { Uf: 2, Rd: 10, iMax: 0.025 } },
    rheostat: { cat: 'load', name: 'Реостат',          terms: ['1', '2'], def: { R: 20 } },
    key:      { cat: 'sw',   name: 'Ключ',             terms: ['1', '2'], def: { closed: false } },
    fuse:     { cat: 'sw',   name: 'Предохранитель',   terms: ['1', '2'], def: { iRated: 2, blown: false } },
    ammeter:  { cat: 'inst', name: 'Амперметр',        terms: ['+', '−'], def: {} },
    voltmeter:{ cat: 'inst', name: 'Вольтметр',        terms: ['+', '−'], def: {} },
    wattmeter:{ cat: 'inst', name: 'Ваттметр',         terms: ['+', '−'], def: {} }
  };

  /* ---------- утилиты ---------- */

  function lampResistance(part) {
    const ratedU = part.props.ratedU, ratedP = part.props.ratedP;
    const rHot = (ratedU * ratedU) / ratedP;
    const rCold = rHot / 10;               // R_гор / R_хол ≈ 10 для вольфрама
    const alpha = (rHot - rCold) / (rCold * (2500 - AMB));
    const T = part.state.T || AMB;
    return { r: rCold * (1 + alpha * (T - AMB)), rHot, rCold };
  }

  function lampBrightness(part) {
    const T = part.state.T || AMB;
    let b = (T - AMB) / (2500 - AMB);
    if (b < 0) b = 0;
    return Math.pow(Math.min(b, 1.35), 1.4);
  }

  /* ---------- создание мира ---------- */

  function createWorld() {
    return {
      t: 0,
      nextId: 1,
      parts: [],
      wires: [],
      events: [],
      measurements: [],
      energySourceWh: 0,
      energyLoadWh: 0,
      sourceTripped: false,
      counters: { shortCircuit: 0, fuseBlown: 0, burned: 0, tripped: 0 }
    };
  }

  function addPart(world, type, x, y, props) {
    const def = PART_DEFS[type];
    if (!def) throw new Error('unknown part ' + type);
    const p = {
      id: 'p' + (world.nextId++),
      type: type,
      x: x, y: y,
      props: Object.assign({}, def.def, props || {}),
      state: { T: AMB, burned: false, over: 0, overHeat: 0, ledOn: false }
    };
    world.parts.push(p);
    return p;
  }

  function getPart(world, id) { return world.parts.find(function (p) { return p.id === id; }); }

  function removePart(world, id) {
    const w = world.wires.filter(function (x) { return x.a.indexOf(id + ':') === 0 || x.b.indexOf(id + ':') === 0; });
    world.wires = world.wires.filter(function (x) { return w.indexOf(x) < 0; });
    world.parts = world.parts.filter(function (p) { return p.id !== id; });
  }

  function addWire(world, a, b) {
    if (a === b) return null;
    // уже есть такая связь?
    const dup = world.wires.some(function (w) {
      return (w.a === a && w.b === b) || (w.a === b && w.b === a);
    });
    if (dup) return null;
    const w = { id: 'w' + (world.nextId++), a: a, b: b };
    world.wires.push(w);
    return w;
  }

  function removeWire(world, id) {
    world.wires = world.wires.filter(function (w) { return w.id !== id; });
  }

  /* ---------- объединение клемм в узлы ---------- */

  function buildNets(world) {
    const parent = {};
    function find(x) {
      if (parent[x] === undefined) parent[x] = x;
      while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
      return x;
    }
    function union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }

    world.parts.forEach(function (p) {
      const n = PART_DEFS[p.type].terms.length;
      for (let i = 0; i < n; i++) find(p.id + ':' + i);
    });
    world.wires.forEach(function (w) { union(w.a, w.b); });

    const index = {}, nets = [];
    Object.keys(parent).forEach(function (k) {
      const r = find(k);
      if (index[r] === undefined) { index[r] = nets.length; nets.push([]); }
      index[k] = index[r];
      nets[index[r]].push(k);
    });
    return { netOf: index, nets: nets, count: nets.length };
  }

  /* ---------- решение схемы (узловой анализ) ---------- */

  function g_inv(g) { return 1 / Math.max(g, 1e-12); }

  function solveLinear(A, b) {
    const n = b.length;
    const M = A.map(function (row, i) { return row.concat([b[i]]); });
    for (let c = 0; c < n; c++) {
      let piv = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      if (Math.abs(M[piv][c]) < 1e-14) continue;
      const tmp = M[c]; M[c] = M[piv]; M[piv] = tmp;
      const d = M[c][c];
      for (let k = c; k <= n; k++) M[c][k] /= d;
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c];
        if (f === 0) continue;
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    return M.map(function (row) { return row[n] || 0; });
  }

  // Возвращает { V: {net: вольт}, partInfo: {id: {I, V, P}} }
  function analyze(world, netInfo) {
    const ni = netInfo || buildNets(world);
    const N = ni.count;
    if (N === 0) return { V: {}, parts: {} };

    // светодиод решаем как кусочно-линейный элемент:
    // «открыт» — источник Uf последовательно с Rd, «закрыт» — утечка 1e-9 См
    let V = new Array(N).fill(0);

    function conductanceOf(p) {
      const pr = p.props;
      switch (p.type) {
        case 'key': return pr.closed ? 1 / R_WIRE : 0;
        case 'fuse': return pr.blown ? 0 : 1 / R_WIRE;
        case 'ammeter':
        case 'wattmeter': return 1 / R_WIRE;
        case 'voltmeter': return 1 / R_VOLTMETER;
        case 'resistor':
        case 'rheostat': return p.state.burned ? 0 : 1 / Math.max(pr.R, 1e-6);
        case 'lamp': return p.state.burned ? 0 : 1 / Math.max(lampResistance(p).r, 1e-6);
        case 'led': return (p.state.ledOn && !p.state.burned) ? 1 / Math.max(pr.Rd, 1e-6) : 1e-9;
        default: return 0;   // источник обрабатывается отдельно
      }
    }

    // итерации по состоянию диодов: до 6 переключений
    for (let outer = 0; outer < 6; outer++) {
      const A = [], b = [];
      for (let i = 0; i < N; i++) { A.push(new Array(N).fill(0)); b.push(0); }

      world.parts.forEach(function (p) {
        if (p.type === 'source') {
          const a = ni.netOf[p.id + ':0'], c = ni.netOf[p.id + ':1'];
          const r = Math.max(p.props.r, 1e-3);
          const g = 1 / r;
          const emf = world.sourceTripped ? 0 : p.props.emf;
          A[a][a] += g; A[c][c] += g; A[a][c] -= g; A[c][a] -= g;
          b[c] += emf / r; b[a] -= emf / r;
          return;
        }
        const a = ni.netOf[p.id + ':0'], c = ni.netOf[p.id + ':1'];
        const g = conductanceOf(p);
        if (!g) return;
        A[a][a] += g; A[c][c] += g; A[a][c] -= g; A[c][a] -= g;
        if (p.type === 'led' && p.state.ledOn && !p.state.burned) {
          // вклад источника Uf: I(a→c) = (Ua − Uc − Uf)/Rd
          b[a] += p.props.Uf / g_inv(g);
          b[c] -= p.props.Uf / g_inv(g);
        }
      });

      for (let i = 0; i < N; i++) A[i][i] += G_LEAK;
      V = solveLinear(A, b);

      // проверяем согласованность состояний диодов и при необходимости переключаем
      let switched = false;
      world.parts.forEach(function (p) {
        if (p.type !== 'led' || p.state.burned) return;
        const a = ni.netOf[p.id + ':0'], c = ni.netOf[p.id + ':1'];
        const U = V[a] - V[c];
        const g = conductanceOf(p);
        const I = U * g - ((p.state.ledOn && !p.state.burned) ? p.props.Uf / g_inv(g) : 0);
        if (p.state.ledOn) {
          if (I < 1e-7) { p.state.ledOn = false; switched = true; }   // ток не идёт — закрыт
        } else {
          if (U > p.props.Uf) { p.state.ledOn = true; switched = true; } // напряжение выше порога — открыт
        }
      });
      if (!switched) break;
    }

    // токи и напряжения на элементах
    const info = {};
    world.parts.forEach(function (p) {
      const a = ni.netOf[p.id + ':0'], c = ni.netOf[p.id + ':1'];
      const Uab = V[a] - V[c];
      let I = 0, P = 0;
      if (p.type === 'source') {
        const emf = world.sourceTripped ? 0 : p.props.emf;
        I = (emf - (V[c] - V[a])) / Math.max(p.props.r, 1e-3); // от − к + внутри, т.е. наружу из «+»
        P = (V[c] - V[a]) * I;                                 // мощность, отдаваемая в цепь
        info[p.id] = { I: I, U: V[c] - V[a], P: P, Uab: Uab, emf: emf };
        return;
      }
      if (p.type === 'led') {
        // кусочно-линейная модель: открыт → I = (U − Uf)/Rd, закрыт → ток утечки
        if (p.state.ledOn && !p.state.burned) {
          I = (Uab - p.props.Uf) / Math.max(p.props.Rd, 1e-6);
          P = Math.max(0, I * (Uab - p.props.Uf) + I * p.props.Uf);
        } else {
          I = Uab * 1e-9;
          P = 0;
        }
        info[p.id] = { I: I, U: Uab, P: P, Uab: Uab };
        return;
      }
      const g = conductanceOf(p);
      if (g > 0) { I = Uab * g; P = Math.abs(I * Uab); }
      info[p.id] = { I: I, U: Uab, P: P, Uab: Uab };
    });

    return { V: V, nets: ni, parts: info };
  }

  /* ---------- факты о цепи (для заданий и интерфейса) ---------- */

  function facts(world, sol) {
    const f = {
      partCount: world.parts.length,
      wireCount: world.wires.length,
      lampBright: 0,
      lamps: 0,
      lampsOn: 0,
      resistors: 0,
      leds: 0,
      ledCurrentMa: 0,
      ledIntact: true,
      closed: false,
      sourceCurrent: 0,
      sourceVoltage: 0,
      sourcePower: 0,
      loadVoltage: 0,
      loadCurrent: 0,
      loadPower: 0,
      loadR: 0,
      shortCircuit: world.counters.shortCircuit,
      fuseBlown: world.counters.fuseBlown,
      burned: world.counters.burned,
      measurements: world.measurements.length,
      energyWh: world.energyLoadWh
    };

    let best = null;
    world.parts.forEach(function (p) {
      const i = sol.parts[p.id];
      if (!i) return;
      if (p.type === 'lamp') {
        f.lamps++;
        const b = lampBrightness(p);
        f.lampBright = Math.max(f.lampBright, b);
        if (b > 0.12) f.lampsOn++;
        if (!best || Math.abs(i.I) > Math.abs(best.I)) best = { I: i.I, U: i.U, P: i.P, part: p };
      }
      if (p.type === 'resistor') f.resistors++;
      if (p.type === 'rheostat') f.resistors++;
      if (p.type === 'led') {
        f.leds++;
        f.ledCurrentMa = Math.abs(i.I) * 1000;
        f.ledIntact = !p.state.burned;
        if (!best || Math.abs(i.I) > Math.abs(best.I)) best = { I: i.I, U: i.U, P: i.P, part: p };
      }
      if (p.type === 'source') {
        f.sourceCurrent = i.I;
        f.sourceVoltage = i.U;
        f.sourcePower = i.U * i.I;
      }
    });

    // «нагрузка» — элемент с наибольшим током среди потребителей
    let load = null;
    world.parts.forEach(function (p) {
      if (['lamp', 'resistor', 'rheostat', 'led'].indexOf(p.type) < 0) return;
      const i = sol.parts[p.id];
      if (!i || Math.abs(i.I) < 1e-9) return;
      if (!load || Math.abs(i.I) > Math.abs(load.I)) load = { I: i.I, U: i.U, P: i.P, part: p };
    });
    if (load) {
      f.loadCurrent = Math.abs(load.I);
      f.loadVoltage = Math.abs(load.U);
      f.loadPower = Math.abs(load.P);
      f.loadR = f.loadCurrent > 1e-9 ? f.loadVoltage / f.loadCurrent : 0;
      f.loadType = load.part.type;
    }

    // «цепь замкнута»: через источник течёт заметный ток
    f.closed = Math.abs(f.sourceCurrent) > 1e-4;

    // нелинейность лампы по измерениям
    // дополнительные величины для лабораторных работ
    f.energyWh = world.energyLoadWh;
    const kinds = {};
    world.measurements.forEach(function (m) { kinds[m.kind] = (kinds[m.kind] || 0) + 1; });
    f.measureKinds = kinds;
    // параллельное соединение: две лампы с примерно равными напряжениями при одном источнике
    const lamps = world.parts.filter(function (p) { return p.type === 'lamp'; });
    f.lampVoltages = lamps.map(function (p) {
      const i = sol.parts[p.id] || {};
      return Math.abs(i.U || 0);
    });
    f.lampCurrents = lamps.map(function (p) {
      const i = sol.parts[p.id] || {};
      return Math.abs(i.I || 0);
    });
    // признак параллельного включения: напряжения близки, токи складываются
    const lv = f.lampVoltages.filter(function (v) { return v > 0.2; });
    f.parallelLamps = lv.length >= 2 && Math.abs(lv[0] - lv[1]) / Math.max(lv[0], lv[1]) < 0.08 &&
      Math.abs(f.sourceCurrent) > Math.max.apply(null, f.lampCurrents) * 1.3;
    // последовательное включение: токи равны, напряжения разные
    const lc = f.lampCurrents.filter(function (v) { return v > 0.005; });
    f.seriesLamps = lc.length >= 2 && Math.abs(lc[0] - lc[1]) / Math.max(lc[0], lc[1]) < 0.05;

    const lampM = world.measurements.filter(function (m) { return m.kind === 'lamp'; });
    const rl = lampM.filter(function (m) { return m.R > 0; }).map(function (m) { return m.R; });
    f.lampRratio = rl.length >= 2 ? Math.max.apply(null, rl) / Math.min.apply(null, rl) : 0;
    f.lampMeasurements = rl.length;
    f.resistorMeasurements = world.measurements.filter(function (m) { return m.kind === 'resistor'; }).length;
    const ri = world.measurements.filter(function (m) { return m.kind === 'resistor'; });
    const cur = ri.map(function (m) { return m.I; });
    f.resistorSpread = cur.length >= 2 ? Math.max.apply(null, cur) / Math.max(Math.min.apply(null, cur), 1e-9) : 0;

    return f;
  }

  /* ---------- шаг моделирования ---------- */

  function step(world, dt) {
    const ni = buildNets(world);
    const sol = analyze(world, ni);
    const events = [];

    world.parts.forEach(function (p) {
      const i = sol.parts[p.id];
      if (!i) return;
      const U = Math.abs(i.U), I = Math.abs(i.I), P = U * I;

      if (p.type === 'lamp' && !p.state.burned) {
        const lm = lampResistance(p);
        const k = 9.06e-4;                     // Вт/К
        const C = 6.5e-4;                      // Дж/К  → τ ≈ 0,7 с
        p.state.T += ((P - k * (p.state.T - AMB)) / C) * dt;
        if (p.state.T < AMB) p.state.T = AMB;
        if (p.state.T > 3300) {
          p.state.burned = true;
          world.counters.burned++;
          events.push({ kind: 'burned', part: p.id, text: 'Лампа перегорела: нить перегрелась' });
        }
      }

      if ((p.type === 'resistor' || p.type === 'rheostat') && !p.state.burned) {
        if (P > p.props.pMax) {
          p.state.overHeat += dt * (P / p.props.pMax);
          if (p.state.overHeat > 1.2) {
            p.state.burned = true;
            world.counters.burned++;
            events.push({ kind: 'burned', part: p.id, text: 'Резистор сгорел: мощность ' + P.toFixed(2) + ' Вт превысила допустимую ' + p.props.pMax + ' Вт' });
          }
        } else {
          p.state.overHeat = Math.max(0, p.state.overHeat - dt * 0.5);
        }
      }

      if (p.type === 'led' && !p.state.burned) {
        if (I > p.props.iMax * 1.15) {
          p.state.burned = true;
          world.counters.burned++;
          events.push({ kind: 'burned', part: p.id, text: 'Светодиод сгорел: ток ' + (I * 1000).toFixed(1) + ' мА больше предельного ' + (p.props.iMax * 1000).toFixed(0) + ' мА' });
        }
      }

      if (p.type === 'fuse' && !p.props.blown) {
        if (I > p.props.iRated) {
          p.state.over += dt;
          if (p.state.over > 0.08) {
            p.props.blown = true;
            world.counters.fuseBlown++;
            events.push({ kind: 'fuse', part: p.id, text: 'Предохранитель сработал: ток ' + I.toFixed(2) + ' А превысил ' + p.props.iRated + ' А' });
          }
        } else {
          p.state.over = Math.max(0, p.state.over - dt);
        }
      }

      if (p.type === 'source' && !world.sourceTripped) {
        if (I > 3.5) {
          p.state.over += dt;
          if (p.state.over > 2.5) {
            world.sourceTripped = true;
            world.counters.tripped++;
            events.push({ kind: 'tripped', part: p.id, text: 'Защита источника: ток ' + I.toFixed(2) + ' А слишком велик, источник отключён' });
          }
        } else {
          p.state.over = Math.max(0, p.state.over - dt);
        }
      }
    });

    // короткое замыкание: большой ток при малом сопротивлении внешней цепи
    const src = world.parts.find(function (p) { return p.type === 'source'; });
    if (src) {
      const si = sol.parts[src.id];
      if (si && Math.abs(si.I) > 3 && Math.abs(si.U) < 2.5) {
        world._scTimer = (world._scTimer || 0) + dt;
        if (world._scTimer > 0.03 && !world._scLogged) {
          world.counters.shortCircuit++;
          world._scLogged = true;
          events.push({ kind: 'short', text: 'Короткое замыкание: клеммы источника соединены почти без нагрузки' });
        }
      } else {
        world._scTimer = 0; world._scLogged = false;
      }
    }

    // энергия
    const gen = Math.max(0, (sol.parts[src ? src.id : ''] || { P: 0 }).P || 0);
    let loadP = 0;
    world.parts.forEach(function (p) {
      if (['lamp', 'resistor', 'rheostat', 'led'].indexOf(p.type) >= 0) {
        const i = sol.parts[p.id];
        if (i) loadP += Math.abs(i.P);
      }
    });
    world.energySourceWh += gen * dt / 3600;
    world.energyLoadWh += loadP * dt / 3600;

    world.t += dt;
    events.forEach(function (e) { e.t = world.t; world.events.push(e); });
    return { sol: sol, events: events };
  }

  const Lab = {
    PART_DEFS: PART_DEFS,
    AMB: AMB,
    createWorld: createWorld,
    addPart: addPart,
    getPart: getPart,
    removePart: removePart,
    addWire: addWire,
    removeWire: removeWire,
    buildNets: buildNets,
    analyze: analyze,
    facts: facts,
    step: step,
    lampResistance: lampResistance,
    lampBrightness: lampBrightness
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Lab;
  else root.Lab = Lab;
})(typeof globalThis !== 'undefined' ? globalThis : this);

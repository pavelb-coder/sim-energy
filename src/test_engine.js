const Lab = require('./engine.js');

function mk(parts) {
  const w = Lab.createWorld();
  const map = {};
  parts.forEach(([k, type, props]) => { map[k] = Lab.addPart(w, type, 0, 0, props); });
  return { w, map };
}

function run(name, build, steps = 1200) {
  const { w, map } = build();
  let last = null;
  for (let i = 0; i < steps; i++) last = Lab.step(w, 1 / 240);
  const f = Lab.facts(w, last.sol);
  console.log('\n=== ' + name + ' ===');
  console.log('  t=%s  srcI=%s A  loadU=%s V  loadP=%s W  bright=%s  closed=%s',
    w.t.toFixed(1), f.sourceCurrent.toFixed(3), f.loadVoltage.toFixed(2),
    f.loadPower.toFixed(2), f.lampBright.toFixed(2), f.closed);
  console.log('  events:', w.events.map(e => e.kind + ' @' + e.t.toFixed(2)).join(', ') || '—');
  return { w, map, f, last };
}

// 1. Источник 9 В (r=0.5) — ключ — лампа 9 В / 2 Вт
run('Лампа 9В 2Вт через ключ', () => {
  const { w, map } = mk([['s', 'source', { emf: 9, r: 0.5 }], ['k', 'key', {}], ['l', 'lamp', { ratedU: 9, ratedP: 2 }]]);
  Lab.addWire(w, map.s.id + ':1', map.k.id + ':0');
  Lab.addWire(w, map.k.id + ':1', map.l.id + ':0');
  Lab.addWire(w, map.l.id + ':1', map.s.id + ':0');
  map.k.props.closed = true;
  return { w, map };
});

// 2. Резистор 10 Ом + ключ, источник 9 В
run('Резистор 10 Ом, источник 9 В r=0.5', () => {
  const { w, map } = mk([['s', 'source', { emf: 9, r: 0.5 }], ['k', 'key', {}], ['r', 'resistor', { R: 10, pMax: 2 }]]);
  Lab.addWire(w, map.s.id + ':1', map.k.id + ':0');
  Lab.addWire(w, map.k.id + ':1', map.r.id + ':0');
  Lab.addWire(w, map.r.id + ':1', map.s.id + ':0');
  map.k.props.closed = true;
  return { w, map };
});

// 3. Короткое замыкание: ключ напрямую
run('КЗ: источник 9 В на ключ (с предохранителем 2 А)', () => {
  const { w, map } = mk([['s', 'source', { emf: 9, r: 0.5 }], ['k', 'key', {}], ['f', 'fuse', { iRated: 2 }]]);
  Lab.addWire(w, map.s.id + ':1', map.f.id + ':0');
  Lab.addWire(w, map.f.id + ':1', map.k.id + ':0');
  Lab.addWire(w, map.k.id + ':1', map.s.id + ':0');
  map.k.props.closed = true;
  return { w, map };
});

// 4. Светодиод без резистора — должен сгореть
run('Светодиод без резистора (должен сгореть)', () => {
  const { w, map } = mk([['s', 'source', { emf: 9, r: 0.5 }], ['d', 'led', {}], ['k', 'key', {}]]);
  Lab.addWire(w, map.s.id + ':1', map.k.id + ':0');
  Lab.addWire(w, map.k.id + ':1', map.d.id + ':0');
  Lab.addWire(w, map.d.id + ':1', map.s.id + ':0');
  map.k.props.closed = true;
  return { w, map };
});

// 5. Светодиод с резистором 330 Ом — должен работать ~19 мА? I=(9-2)/(330+10)=20.6 мА
run('Светодиод + 330 Ом (норма)', () => {
  const { w, map } = mk([['s', 'source', { emf: 9, r: 0.5 }], ['k', 'key', {}], ['r', 'resistor', { R: 330, pMax: 2 }], ['d', 'led', {}]]);
  Lab.addWire(w, map.s.id + ':1', map.k.id + ':0');
  Lab.addWire(w, map.k.id + ':1', map.r.id + ':0');
  Lab.addWire(w, map.r.id + ':1', map.d.id + ':0');
  Lab.addWire(w, map.d.id + ':1', map.s.id + ':0');
  map.k.props.closed = true;
  return { w, map };
});

// 6. Разрыв цепи — ключ разомкнут
run('Ключ разомкнут (тока нет)', () => {
  const { w, map } = mk([['s', 'source', { emf: 9, r: 0.5 }], ['k', 'key', {}], ['l', 'lamp', { ratedU: 9, ratedP: 2 }]]);
  Lab.addWire(w, map.s.id + ':1', map.k.id + ':0');
  Lab.addWire(w, map.k.id + ':1', map.l.id + ':0');
  Lab.addWire(w, map.l.id + ':1', map.s.id + ':0');
  return { w, map };
});

// 7. Лампа при 4.5 В — ток меньше, R ниже (холоднее) → проверяем нелинейность
run('Лампа при 4.5 В (нить холоднее)', () => {
  const { w, map } = mk([['s', 'source', { emf: 4.5, r: 0.5 }], ['k', 'key', {}], ['l', 'lamp', { ratedU: 9, ratedP: 2 }]]);
  Lab.addWire(w, map.s.id + ':1', map.k.id + ':0');
  Lab.addWire(w, map.k.id + ':1', map.l.id + ':0');
  Lab.addWire(w, map.l.id + ':1', map.s.id + ':0');
  map.k.props.closed = true;
  return { w, map };
});

// 8. Вольтметр параллельно лампе
{
  const { w, map } = mk([['s', 'source', { emf: 9, r: 0.5 }], ['k', 'key', {}], ['l', 'lamp', { ratedU: 9, ratedP: 2 }], ['v', 'voltmeter', {}]]);
  Lab.addWire(w, map.s.id + ':1', map.k.id + ':0');
  Lab.addWire(w, map.k.id + ':1', map.l.id + ':0');
  Lab.addWire(w, map.l.id + ':1', map.s.id + ':0');
  Lab.addWire(w, map.v.id + ':0', map.l.id + ':0');
  Lab.addWire(w, map.v.id + ':1', map.l.id + ':1');
  map.k.props.closed = true;
  let sol;
  for (let i = 0; i < 1200; i++) sol = Lab.step(w, 1 / 240);
  console.log('\n=== Вольтметр параллельно лампе ===');
  console.log('  U лампы = %s В, U вольтметра = %s В (должны совпасть)',
    sol.sol.parts[map.l.id].U.toFixed(3), sol.sol.parts[map.v.id].U.toFixed(3));
  console.log('  I источника = %s А', sol.sol.parts[map.s.id].I.toFixed(4));
}

// 9. Последовательное соединение: две лампы 4.5В 1Вт последовательно на 9В
{
  const { w, map } = mk([['s', 'source', { emf: 9, r: 0.5 }], ['k', 'key', {}],
    ['l1', 'lamp', { ratedU: 4.5, ratedP: 1 }], ['l2', 'lamp', { ratedU: 4.5, ratedP: 1 }]]);
  Lab.addWire(w, map.s.id + ':1', map.k.id + ':0');
  Lab.addWire(w, map.k.id + ':1', map.l1.id + ':0');
  Lab.addWire(w, map.l1.id + ':1', map.l2.id + ':0');
  Lab.addWire(w, map.l2.id + ':1', map.s.id + ':0');
  map.k.props.closed = true;
  let sol;
  for (let i = 0; i < 2400; i++) sol = Lab.step(w, 1 / 240);
  console.log('\n=== Две лампы последовательно на 9 В (21.2 Ом каждая в горячем) ===');
  console.log('  I = %s А, U1 = %s В, U2 = %s В',
    sol.sol.parts[map.s.id].I.toFixed(3), sol.sol.parts[map.l1.id].U.toFixed(2), sol.sol.parts[map.l2.id].U.toFixed(2));
}

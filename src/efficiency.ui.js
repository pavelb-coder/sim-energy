/* ============================================================
   Энерджиквантум · efficiency.ui.js
   Интерфейс стенда «Энергоэффективность и умный дом»
   ============================================================ */
(function () {
  'use strict';
  var E = window.Efficiency;
  if (!E || !document.getElementById('benchEfficiency')) return;

  var $ = function (id) { return document.getElementById(id); };
  var st = E.createState();
  var solved = {}, taskIndex = 0, lastFacts = null, lastTick = 0, taskTick = 0;
  var playing = true, meterTick = 0;

  var css = document.createElement('style');
  UI.text(css, `
  .eff main{display:grid;grid-template-columns:246px minmax(420px,1fr) 330px;gap:10px;padding:10px;min-height:0}
  .eff .seg{display:flex;gap:2px;background:#e8eef5;border-radius:7px;padding:2px;flex-wrap:wrap}
  .eff .seg button{flex:1;padding:4px 2px;font-size:11px;border-radius:5px;color:var(--muted)}
  .eff .seg button.active{background:#fff;color:var(--accent);font-weight:700;box-shadow:0 1px 2px rgba(0,0,0,.08)}
  .eff .fld{margin-bottom:8px}
  .eff .fld .top{display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);margin-bottom:3px}
  .eff .chk{display:flex;align-items:center;gap:7px;font-size:12px;padding:3px 0}
  .eff .chk input{width:15px;height:15px;accent-color:var(--accent)}
  .eff .chk span.pw{margin-left:auto;color:var(--muted);font-size:11px}
  .estage{position:relative;flex:1;min-height:0;border-radius:var(--r);border:1px solid var(--line);background:#f6f9fc;overflow:hidden}
  .estage svg{width:100%;height:100%;display:block}
  .houseroom{cursor:pointer}
  .houseroom:hover rect{stroke:var(--accent)}
  .efftable{width:100%;border-collapse:collapse;font-size:11px}
  .efftable th,.efftable td{padding:3px 8px;text-align:right;border-bottom:1px solid #eef2f6}
  .efftable th{color:var(--muted);font-weight:600;text-align:right;position:sticky;top:0;background:#fff}
  .efftable th:first-child,.efftable td:first-child{text-align:left}
  .ok-lux{color:#146c4b;font-weight:600}
  .bad-lux{color:#a02020;font-weight:600}
  @media (max-width:980px){.eff main{grid-template-columns:1fr}.estage{min-height:360px}}
  @media (max-height:820px){.eff main{min-height:0}.estage{min-height:260px;max-height:46vh}}
  `);
  document.head.appendChild(css);

  var main = $('benchEfficiency');
  main.className = 'eff';
  UI.html(main, `
    <aside class="panel rctl">
      <h2>Настройка кабинета</h2>
      <div class="grp">
        <div class="gl">Тип ламп (15 шт)</div>
        <div class="seg" id="segLamp">
          <button data-lamp="incandescent" class="active">Накаливания</button>
          <button data-lamp="cfl">Люминесц.</button>
          <button data-lamp="led">Светодиод</button>
        </div>
      </div>
      <div class="grp">
        <div class="gl">Автоматика</div>
        <label class="chk"><input type="checkbox" id="senMotion">Датчик движения</label>
        <label class="chk"><input type="checkbox" id="senLight">Сумеречное реле</label>
        <label class="chk"><input type="checkbox" id="senSched">Умная розетка / расписание</label>
      </div>
      <div class="grp">
        <div class="gl">Приборы</div>
        <label class="chk"><input type="checkbox" id="apKettle" checked>Чайник<span class="pw">2000 Вт</span></label>
        <label class="chk"><input type="checkbox" id="apFridge" checked>Холодильник<span class="pw">150 Вт</span></label>
        <label class="chk"><input type="checkbox" id="apPc" checked>Компьютер<span class="pw">180 Вт</span></label>
        <label class="chk"><input type="checkbox" id="apTv" checked>Телевизор<span class="pw">90 Вт</span></label>
        <label class="chk"><input type="checkbox" id="apCharger" checked>Зарядка в розетке<span class="pw">0,5 Вт</span></label>
      </div>
      <div class="grp">
        <button class="btn primary" id="efDay" style="width:100%;margin-bottom:6px">Прогнать сутки</button>
        <button class="btn" id="efReset" style="width:100%">Исходные настройки</button>
      </div>
    </aside>

    <section class="stagewrap">
      <div class="timebar panel">
        <div class="grp">
          <button id="efPlay" title="Пауза / пуск">⏸</button>
          <button data-efspeed="1" class="active">×1</button>
          <button data-efspeed="2">×2</button>
          <button data-efspeed="4">×4</button>
        </div>
        <div class="clock">время: <b id="efClock">08:00</b></div>
        <div class="grow"></div>
        <button class="btn primary" id="efSample">＋ Снять точку</button>
      </div>

      <div class="estage" id="efStage">
        <svg viewBox="0 0 760 400" preserveAspectRatio="xMidYMid meet">
          <rect x="0" y="0" width="760" height="400" fill="#f6f9fc"/>
          <!-- кабинет -->
          <g class="houseroom" id="roomClass">
            <rect x="30" y="40" width="330" height="230" rx="8" fill="#ffffff" stroke="#cbd9e4" stroke-width="2"/>
            <text x="46" y="66" font-size="12" fill="#5a6772" font-family="sans-serif">Кабинет · 24 м² · 6 ламп</text>
            <g id="lampsClass"></g>
            <text id="luxClass" x="195" y="252" text-anchor="middle" font-size="12" font-weight="700" fill="#1f2a36" font-family="sans-serif">— лк</text>
          </g>
          <!-- коридор -->
          <g class="houseroom" id="roomHall">
            <rect x="380" y="40" width="150" height="230" rx="8" fill="#ffffff" stroke="#cbd9e4" stroke-width="2"/>
            <text x="392" y="66" font-size="11" fill="#5a6772" font-family="sans-serif">Коридор · 12 м²</text>
            <g id="lampsHall"></g>
            <text id="luxHall" x="455" y="252" text-anchor="middle" font-size="11.5" font-weight="700" fill="#1f2a36" font-family="sans-serif">— лк</text>
          </g>
          <!-- лаборатория -->
          <g class="houseroom" id="roomLab">
            <rect x="550" y="40" width="180" height="230" rx="8" fill="#ffffff" stroke="#cbd9e4" stroke-width="2"/>
            <text x="562" y="66" font-size="11" fill="#5a6772" font-family="sans-serif">Лаборатория · 18 м²</text>
            <g id="lampsLab"></g>
            <text id="luxLab" x="640" y="252" text-anchor="middle" font-size="11.5" font-weight="700" fill="#1f2a36" font-family="sans-serif">— лк</text>
          </g>
          <!-- приборы -->
          <g id="gAppl" transform="translate(30,300)">
            <rect x="0" y="0" width="700" height="72" rx="8" fill="#fff" stroke="#cbd9e4" stroke-width="2"/>
            <text x="14" y="18" font-size="11" fill="#5a6772" font-family="sans-serif">Бытовые приборы</text>
            <g id="applIcons"></g>
          </g>
          <!-- счётчик -->
          <g id="gMeter" transform="translate(690,394)">
            <rect x="-52" y="-16" width="104" height="34" rx="7" fill="#1f2a36"/>
            <text id="meterW" x="0" y="7" text-anchor="middle" font-size="14" font-weight="700" fill="#8fe0b8" font-family="sans-serif">0 Вт</text>
          </g>
          <!-- солнце/время -->
          <g id="gDay" transform="translate(700,20)"></g>
        </svg>
      </div>

      <div class="panel" style="padding:6px 9px 9px">
        <div class="row" style="display:flex;justify-content:space-between;padding:0 2px 4px">
          <span class="tiny muted" style="font-size:10.5px;letter-spacing:.5px;text-transform:uppercase;font-weight:600">Профиль потребления за сутки</span>
          <span class="tiny muted" id="efPeak">пик —</span>
        </div>
        <svg id="efChart" viewBox="0 0 800 120" preserveAspectRatio="none" style="width:100%;height:120px;display:block"></svg>
      </div>

      <div class="bottombar panel" style="height:132px">
        <div class="tabs">
          <button class="active" data-eftab="journal">Журнал</button>
          <button data-eftab="meas">Протокол <span id="efMeasCount" class="badge"></span></button>
          <div class="grow"></div>
          <button class="btn ghost tiny" id="efCsv" style="margin:4px 6px 4px 0">Экспорт CSV</button>
        </div>
        <div class="tabbody" id="efTabJournal"><div class="journal" id="efJournal"></div></div>
        <div class="tabbody" id="efTabMeas" hidden></div>
      </div>
    </section>

    <aside class="right">
      <div class="card task">
        <h2>Задание <span class="badge" id="efTaskId">1 / 6</span></h2>
        <div class="body" id="efTaskBody"></div>
        <div class="tasklist" id="efTaskList"></div>
      </div>

      <div class="card">
        <h2>Энергия и деньги</h2>
        <div style="padding:9px 9px 0">
          <div class="lcd" style="text-align:center">
            <div class="cap"><span>за сутки, кВт·ч</span><span>₽</span></div>
            <div class="main" id="lcdKwh">0,00</div>
            <div class="sub" id="lcdRub">0,0</div>
          </div>
        </div>
        <div class="meters">
          <div class="meter accent"><div class="k"><span>За сутки</span><span>кВт·ч</span></div>
            <div class="v" id="efKwh">0 <small>кВт·ч</small></div></div>
          <div class="meter"><div class="k"><span>Стоимость</span><span>₽</span></div>
            <div class="v" id="efRub">0 <small>₽</small></div></div>
          <div class="meter"><div class="k"><span>Экономия</span><span>%</span></div>
            <div class="v" id="efSave">0 <small>%</small></div></div>
          <div class="meter"><div class="k"><span>Ожидание</span><span>кВт·ч</span></div>
            <div class="v" id="efStandby">0 <small>кВт·ч</small></div></div>
        </div>
        <div class="aux"><span>Исходно: <b id="efBase">—</b></span><span>Экономия: <b id="efSavedRub">—</b></span></div>
        <div class="aux" style="padding-top:0"><span>Окупаемость LED: <b id="efPayback">—</b></span></div>
      </div>

      <div class="card">
        <h2>Освещённость и нормы</h2>
        <div style="padding:4px 0">
          <table class="efftable" id="efLuxTable"></table>
        </div>
      </div>
    </aside>`);

  function pct(v, d) { return v.toFixed(d === undefined ? 1 : d).replace('.', ','); }

  /* ---------- журнал ---------- */
  function log(kind, text) {
    st.log.push({ t: st.t, hour: st.hour, kind: kind, text: text });
    if (st.log.length > 300) st.log.shift();
    renderJournal();
  }
  function renderJournal() {
    var box = $('efJournal');
    if (!st.log.length) { UI.html(box, '<div class="empty-note">Меняйте настройки слева — всё попадёт в журнал.</div>'); return; }
    UI.html(box, st.log.slice(-80).map(function (r) {
      return '<div class="jrow ' + r.kind + '"><span class="tm">' + timeText(r.hour) + '</span><span class="dot"></span><span class="tx">' +
        String(r.text).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }) + '</span></div>';
    }).join(''));
    box.parentElement.scrollTop = box.parentElement.scrollHeight;
  }
  function timeText(h) {
    var hh = Math.floor(h) % 24, mm = Math.round((h - Math.floor(h)) * 60);
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }

  /* ---------- управление ---------- */
  function renderControls() {
    [].forEach.call($('segLamp').children, function (b) { b.classList.toggle('active', b.dataset.lamp === st.lampType); });
    $('senMotion').checked = st.sensors.motion;
    $('senLight').checked = st.sensors.light;
    $('senSched').checked = st.sensors.schedule;
    $('apKettle').checked = st.appliances.kettle;
    $('apFridge').checked = st.appliances.fridge;
    $('apPc').checked = st.appliances.pc;
    $('apTv').checked = st.appliances.tv;
    $('apCharger').checked = st.appliances.charger;
  }
  $('segLamp').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    st.lampType = b.dataset.lamp;
    log('ok', 'Лампы: ' + E.LAMPS[st.lampType].name + ' · ' + E.lampPower(st) + ' Вт на весь кабинет');
    renderControls(); checkTask(false);
  });
  [['senMotion', 'motion', 'Датчик движения'], ['senLight', 'light', 'Сумеречное реле'], ['senSched', 'schedule', 'Умная розетка / расписание']].forEach(function (p) {
    $(p[0]).addEventListener('change', function (e) {
      st.sensors[p[1]] = e.target.checked;
      log(e.target.checked ? 'ok' : 'warn', p[2] + (e.target.checked ? ' включён' : ' выключен'));
      checkTask(false);
    });
  });
  [['apKettle', 'kettle'], ['apFridge', 'fridge'], ['apPc', 'pc'], ['apTv', 'tv'], ['apCharger', 'charger']].forEach(function (p) {
    $(p[0]).addEventListener('change', function (e) {
      st.appliances[p[1]] = e.target.checked;
      log(e.target.checked ? 'ok' : 'warn', E.APPLIANCES[p[1]].name + (e.target.checked ? ' в работе' : ' отключён'));
      checkTask(false);
    });
  });
  $('efPlay').onclick = function () { playing = !playing; UI.text(this, playing ? '⏸' : '▶'); };
  var speed = 1;
  [].forEach.call(document.querySelectorAll('[data-efspeed]'), function (b) {
    b.onclick = function () {
      speed = +b.dataset.efspeed;
      [].forEach.call(document.querySelectorAll('[data-efspeed]'), function (x) { x.classList.toggle('active', x === b); });
    };
  });
  $('efDay').onclick = function () {
    var d = E.dayTotals(st), sv = E.savings(st);
    st.measures.push({ kind: 'day', t: st.t, kwh: d.kwh, cost: d.cost, peak: d.peak, lampType: st.lampType,
      percent: sv.percent, sensors: Object.assign({}, st.sensors) });
    log(d.kwh <= sv.base.total ? 'ok' : 'warn', 'Прогон суток: ' + pct(d.kwh, 2) + ' кВт·ч, ' + pct(d.cost, 1) +
      ' ₽, пик ' + Math.round(d.peak) + ' Вт');
    renderMeasurements(); checkTask(false);
    toast('Сутки: ' + pct(d.kwh, 2) + ' кВт·ч · ' + pct(d.cost, 1) + ' ₽');
  };
  $('efReset').onclick = function () {
    st = E.createState(); solved = {}; lastFacts = null;
    log('warn', 'Исходные настройки: лампы накаливания, датчики выключены');
    renderControls(); renderMeasurements(); renderTask();
  };

  /* ---------- протокол ---------- */
  function sample() {
    var f = E.facts(st), s = E.savings(st);
    var rec = {
      t: st.t, kind: 'saving', lampType: st.lampType, lightKwh: s.now.light, totalKwh: s.now.total,
      baseKwh: s.base.total, percent: s.percent, savedRub: s.savedRub, standbyKwh: s.now.standby,
      lux: f.lux.map(function (r) { return Math.round(r.lux); }), allNorm: f.allNorm,
      payback: f.retrofit.paybackMonths, sensors: Object.assign({}, st.sensors)
    };
    st.measures.push(rec);
    if (st.sensors.motion || st.sensors.light) st.measures.push(Object.assign({ kind: 'smart' }, rec));
    log('ok', 'Точка: ' + pct(s.now.total, 2) + ' кВт·ч/сутки, экономия ' + Math.round(s.percent * 100) +
      ' %, standby ' + pct(s.now.standby, 2) + ' кВт·ч');
    renderMeasurements(); checkTask(false);
  }
  function renderMeasurements() {
    var box = $('efTabMeas');
    UI.text($('efMeasCount'), st.measures.length || '');
    if (!st.measures.length) { UI.html(box, '<div class="empty-note">Нажмите «Снять точку» или «Прогнать сутки».</div>'); return; }
    UI.html(box, '<table class="mtable"><thead><tr><th>Что</th><th>Лампы</th><th>Свет, кВт·ч</th><th>Всего, кВт·ч</th>' +
      '<th>Экономия, %</th><th>Ожидание, кВт·ч</th><th>лк (каб./кор./лаб.)</th></tr></thead><tbody>' +
      st.measures.slice(-50).reverse().map(function (m) {
        return '<tr><td>' + (m.kind === 'day' ? 'сутки' : m.kind === 'smart' ? 'автоматика' : 'точка') +
          '</td><td style="text-align:left">' + (E.LAMPS[m.lampType] || {}).name + '</td><td>' +
          pct(m.lightKwh || 0, 2) + '</td><td>' + pct(m.kind === 'day' ? m.kwh : (m.totalKwh || 0), 2) + '</td><td>' +
          Math.round((m.percent || 0) * 100) + '</td><td>' + pct(m.standbyKwh || 0, 2) + '</td><td style="text-align:left">' +
          (m.lux ? m.lux.join(' / ') : '—') + '</td></tr>';
      }).join('') + '</tbody></table>');
  }
  function exportCsv() {
    if (!st.measures.length) { toast('Протокол пуст'); return; }
    var lines = ['Тип;Лампы;Свет,кВт·ч;Всего,кВт·ч;Экономия,%;Ожидание,кВт·ч;лк кабинет;лк коридор;лк лаборатория;Окупаемость,мес'];
    st.measures.forEach(function (m) {
      lines.push([m.kind, (E.LAMPS[m.lampType] || {}).name, pct(m.lightKwh || 0, 3),
        pct(m.kind === 'day' ? m.kwh : (m.totalKwh || 0), 3), Math.round((m.percent || 0) * 100),
        pct(m.standbyKwh || 0, 3)].concat(m.lux || ['', '', '']).concat([pct(m.payback || 0, 1)]).join(';'));
    });
    var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'протокол-энергоаудит.csv';
    document.body.appendChild(a); a.click(); a.remove();
    log('ok', 'Протокол выгружен в CSV');
  }
  [].forEach.call(document.querySelectorAll('.tabs button[data-eftab]'), function (b) {
    b.onclick = function () {
      [].forEach.call(document.querySelectorAll('.tabs button[data-eftab]'), function (x) { x.classList.toggle('active', x === b); });
      $('efTabJournal').hidden = b.dataset.eftab !== 'journal';
      $('efTabMeas').hidden = b.dataset.eftab !== 'meas';
    };
  });

  /* ---------- задания ---------- */
  function facts() { return lastFacts || E.facts(st); }
  function renderTask() {
    var tk = E.TASKS[taskIndex], done = solved[taskIndex];
    UI.text($('efTaskId'), (taskIndex + 1) + ' / ' + E.TASKS.length);
    UI.html($('efTaskBody'), '<div class="goal"><b>' + tk.t + '</b><br>' + tk.goal + '</div>' +
      '<ol>' + tk.steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' +
      (done ? '<div class="result ok"><span class="stars">' + '★★★'.slice(0, done) + '</span><br>' + tk.why + '</div>' : '') +
      '<div class="hints">' + (tk._hints || []).map(function (h, i) { return '<div class="hint">Подсказка ' + (i + 1) + ': ' + h + '</div>'; }).join('') + '</div>' +
      '<div style="display:flex;gap:6px;margin-top:9px"><button class="btn" id="efHint">Подсказка</button>' +
      '<button class="btn primary" id="efCheck">Проверить</button></div><div id="efCheckOut"></div>');
    UI.html($('efTaskList'), E.TASKS.map(function (t, i) {
      return '<button data-i="' + i + '" class="' + (i === taskIndex ? 'active ' : '') + (solved[i] ? 'done' : '') + '">' +
        '<span class="num">' + (solved[i] ? '★' : (i + 1)) + '</span><span>' + t.t + '</span></button>';
    }).join(''));
    [].forEach.call($('efTaskList').children, function (b) { b.onclick = function () { taskIndex = +b.dataset.i; renderTask(); }; });
    $('efHint').onclick = function () {
      var t2 = E.TASKS[taskIndex]; t2._hints = t2._hints || [];
      if (t2._hints.length < t2.hints.length) { t2._hints.push(t2.hints[t2._hints.length]); renderTask(); } else toast('Подсказки закончились');
    };
    $('efCheck').onclick = function () {
      if (!checkTask(true)) {
        var f = facts();
        UI.html($('efCheckOut'), '<div class="result bad">Пока не выполнено: экономия ' + Math.round(f.percent * 100) +
          ' %, нормы ' + (f.allNorm ? 'соблюдены' : 'НАРУШЕНЫ') + ', точек в протоколе ' + f.measures.length + '.</div>');
      }
    };
  }
  function checkTask(show) {
    var tk = E.TASKS[taskIndex], f = facts(), was = !!solved[taskIndex];
    var ok = false;
    try { ok = tk.check(f); } catch (e) { ok = false; }
    if (ok && !was) {
      var stars = 1;
      try { stars = tk.stars(f) || 1; } catch (e) {}
      solved[taskIndex] = stars;
      log('ok', 'Задание выполнено: ' + tk.t + ' (' + stars + '★)');
      renderTask();
    } else if (ok && show) renderTask();
    return ok;
  }

  /* ---------- сцена ---------- */
  function drawLamps(container, count, room) {
    // сетка иконок подбирается под ширину комнаты, чтобы лампы не выходили за стены
    // координаты абсолютные в системе сцены: комнаты стоят в ряд, поэтому у каждой свой x0
    var g = room === 'hall' ? { x0: 424, dx: 62, y0: 112, dy: 62, cols: 2 }
          : room === 'lab' ? { x0: 592, dx: 54, y0: 112, dy: 62, cols: 3 }
          : { x0: 52, dx: 90, y0: 96, dy: 60, cols: 3 };
    var s = '';
    for (var i = 0; i < count; i++) {
      var x = g.x0 + (i % g.cols) * g.dx, y = g.y0 + Math.floor(i / g.cols) * g.dy;
      var on = st.totalW > 0;
      s += '<g transform="translate(' + x + ',' + y + ')">' +
        '<circle r="13" fill="' + (on ? '#ffe9a8' : '#eef3f7') + '" stroke="#cbd9e4" stroke-width="1.6"/>' +
        '<path d="M-6 -1 L-2 -1 L-4 5 L2 5 L-1 -5 L-5 -5 Z" fill="' + (on ? '#e8a93a' : '#b9c7d2') + '"/></g>';
    }
    UI.html(container, s);
  }
  var lastApplSig = '', lastLampSig = '';
  function drawScene(f) {
    // иконки ламп перерисовываем только когда меняется тип ламп или их состояние
    var lampSig = st.lampType + ':' + (st.totalW > 0 ? 1 : 0);
    if (lampSig !== lastLampSig) {
      lastLampSig = lampSig;
      drawLamps($('lampsClass'), 6, 'class');
      drawLamps($('lampsHall'), 3, 'hall');
      drawLamps($('lampsLab'), 6, 'lab');
    }
    // «горит» только та комната, где сейчас есть люди/свет
    var litNow = (st.hour >= 7 && st.hour <= 9) || (st.hour >= 17 && st.hour <= 22);
    [['lampsClass', 'roomClass'], ['lampsHall', 'roomHall'], ['lampsLab', 'roomLab']].forEach(function (pair) {
      UI.attr($(pair[0]).parentElement, 'opacity', litNow || !st.sensors.motion ? 1 : 0.45);
    });
    UI.text($('luxClass'), Math.round(f.lux[0].lux) + ' лк' + (f.lux[0].ok ? '' : ' · ниже нормы'));
    UI.text($('luxHall'), Math.round(f.lux[1].lux) + ' лк');
    UI.text($('luxLab'), Math.round(f.lux[2].lux) + ' лк');
    UI.attr($('luxClass'), 'fill', f.lux[0].ok ? '#146c4b' : '#a02020');;
    UI.attr($('luxHall'), 'fill', f.lux[1].ok ? '#146c4b' : '#a02020');;
    UI.attr($('luxLab'), 'fill', f.lux[2].ok ? '#146c4b' : '#a02020');;
    // иконки приборов
    var keys = Object.keys(E.APPLIANCES);
    var applSig = keys.map(function (k) { return k + (st.appliances[k] ? 1 : 0); }).join('');
    if (applSig === lastApplSig) return;
    lastApplSig = applSig;
    UI.html($('applIcons'), keys.map(function (k, i) {
      var a = E.APPLIANCES[k], on = st.appliances[k];
      var x = 14 + i * 132;
      return '<g transform="translate(' + x + ',26)">' +
        '<rect width="118" height="36" rx="7" fill="' + (on ? '#eaf7f1' : '#f4f7fa') + '" stroke="' + (on ? '#b8e2ce' : '#e0e8ef') + '"/>' +
        '<text x="8" y="15" font-size="10" fill="#1f2a36" font-family="sans-serif">' + a.name + '</text>' +
        '<text x="8" y="29" font-size="9.5" fill="#7a8a97" font-family="sans-serif">' + (on ? a.power + ' Вт' : 'выключен') + '</text></g>';
    }).join(''));
    UI.text($('meterW'), Math.round(st.totalW) + ' Вт');
    // солнце / время суток
    var night = st.hour < 6 || st.hour > 20;
    UI.html($('gDay'), '<circle cx="0" cy="0" r="16" fill="' + (night ? '#2f4a63' : '#ffd166') + '"/>');
  }

  function renderChart() {
    var prof = E.dayProfile(st);
    var maxV = Math.max.apply(null, prof.map(function (p) { return p.w; })) || 1;
    var W = 800, H = 120, pad = 24;
    function x(h) { return pad + (h / 24) * (W - pad - 8); }
    function y(v) { return H - 18 - (v / maxV) * (H - 30); }
    var grid = '';
    for (var h = 0; h <= 24; h += 3) {
      grid += '<line x1="' + x(h) + '" y1="' + y(0) + '" x2="' + x(h) + '" y2="6" stroke="#e7eef4"/>' +
        '<text x="' + x(h) + '" y="' + (H - 5) + '" font-size="8" fill="#9aabb8" text-anchor="middle" font-family="sans-serif">' + h + '</text>';
    }
    var area = prof.map(function (p, i) { return (i ? 'L' : 'M') + x(p.h).toFixed(1) + ',' + y(p.w).toFixed(1); }).join(' ') +
      ' L' + x(24).toFixed(1) + ',' + y(0).toFixed(1) + ' L' + x(0).toFixed(1) + ',' + y(0).toFixed(1) + ' Z';
    var nowX = x(st.hour);
    UI.html($('efChart'), grid +
      '<path d="' + area + '" fill="#e6f2f8" stroke="#1b3e8f" stroke-width="1.6"/>' +
      '<line x1="' + nowX + '" y1="6" x2="' + nowX + '" y2="' + y(0) + '" stroke="#f07d20" stroke-width="1.4"/>');
    UI.text($('efPeak'), 'пик ' + Math.round(maxV) + ' Вт');
  }

  function renderMeters(f) {
    var s = E.savings(st);
    UI.html($('efKwh'), pct(s.now.total, 2) + ' <small>кВт·ч</small>');
    UI.html($('efRub'), pct(s.now.cost, 1) + ' <small>₽</small>');
    UI.text($('lcdKwh'), pct(s.now.total, 2));
    UI.text($('lcdRub'), pct(s.now.cost, 1));
    UI.html($('efSave'), Math.round(s.percent * 100) + ' <small>%</small>');
    UI.html($('efStandby'), pct(s.now.standby, 2) + ' <small>кВт·ч</small>');
    UI.text($('efBase'), pct(s.base.total, 2) + ' кВт·ч · ' + pct(s.base.cost, 1) + ' ₽');
    UI.text($('efSavedRub'), pct(s.savedRub, 1) + ' ₽/сутки');
    UI.text($('efPayback'), f.retrofit.paybackMonths === Infinity ? '—' :
      pct(f.retrofit.paybackMonths, 1) + ' мес');
    UI.text($('efClock'), timeText(st.hour));
    UI.html($('efLuxTable'), '<thead><tr><th>Помещение</th><th>Сейчас, лк</th><th>Норма, лк</th><th></th></tr></thead><tbody>' +
      f.lux.map(function (r) {
        return '<tr><td>' + r.name + '</td><td>' + Math.round(r.lux) + '</td><td>' + r.norm + '</td><td class="' +
          (r.ok ? 'ok-lux' : 'bad-lux') + '">' + (r.ok ? '✓' : '✕') + '</td></tr>';
      }).join('') + '</tbody>');
  }

  function frame(now) {
    var dt = lastTick ? Math.min(0.25, (now - lastTick) / 1000) : 0;
    lastTick = now;
    if (window.__bench === 'efficiency') {
      if (playing && dt > 0) E.step(st, dt, speed);
      lastFacts = E.facts(st);
      drawScene(lastFacts);
      meterTick += dt;
      if (meterTick > 0.1) { meterTick = 0; renderMeters(lastFacts); }
      if (Math.abs(st.hour - (frame._lastHour || -1)) > 0.5) { frame._lastHour = st.hour; renderChart(); }
      taskTick += dt;
      if (taskTick > 0.5) { taskTick = 0; checkTask(false); }
    }
    requestAnimationFrame(frame);
  }
  function toast(text) {
    var t = document.getElementById('toast'); if (!t) return;
    UI.text(t, text); t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  $('efSample').onclick = sample;
  $('efCsv').onclick = exportCsv;

  renderControls(); renderJournal(); renderMeasurements(); renderTask(); renderChart();
  st.totalW = 0;
  log('ok', 'Стенд «Энергоэффективность»: кабинет 15 ламп накаливания, приборы включены.');
  requestAnimationFrame(frame);

  window.__eff = {
    state: function () { return st; }, facts: function () { return E.facts(st); },
    sample: sample, solved: function () { return solved; }, E: E
  };
})();

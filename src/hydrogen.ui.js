/* ============================================================
   Энерджиквантум · hydrogen.ui.js
   Интерфейс стенда «Водородный контур» (по мотивам Horizon Energy Box FCJJ-40)
   ============================================================ */
(function () {
  'use strict';
  var H = window.Hydrogen;
  if (!H || !document.getElementById('benchHydrogen')) return;

  var $ = function (id) { return document.getElementById(id); };
  var st = H.createState();
  var solved = {}, taskIndex = 0, lastFacts = null, taskTick = 0, meterTick = 0, playing = true;
  var lastKey = '';

  var css = document.createElement('style');
  UI.text(css, `
  .hyd main{display:grid;grid-template-columns:250px minmax(420px,1fr) 330px;gap:10px;padding:10px;min-height:0}
  .hyd .seg{display:flex;gap:2px;background:#f2f6f9;border-radius:7px;padding:2px;flex-wrap:wrap}
  .hyd .seg button{flex:1 1 auto;min-width:0;padding:4px 6px;font-size:11px;border-radius:5px;color:var(--muted);white-space:nowrap}
  .hyd #hyLoad{display:grid;grid-template-columns:1fr 1fr;gap:2px}
  .hyd .rctl{overflow:auto}
  .hyd .seg button.active{background:#fff;color:var(--accent);font-weight:700;box-shadow:0 1px 2px rgba(0,0,0,.08)}
  .hyd .fld{margin-bottom:8px}
  .hyd .fld .top{display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);margin-bottom:3px}
  .hyd .fld .top b{color:var(--ink);font-variant-numeric:tabular-nums}
  .hyd input[type=range]{width:100%}
  .hyd .chk{display:flex;align-items:center;gap:7px;font-size:12px;padding:3px 0}
  .hyd .chk input{width:15px;height:15px;accent-color:var(--accent)}
  .hstage{position:relative;flex:1;min-height:0;border-radius:var(--r);border:1px solid var(--line);background:#f7fafc;overflow:hidden}
  .hstage svg{width:100%;height:100%;display:block}
  .hyd .mol{animation:hydMol 2.6s linear infinite}
  @keyframes hydMol{from{offset-distance:0}to{offset-distance:100%}}
  .hydtable{width:100%;border-collapse:collapse;font-size:11px}
  .hydtable th,.hydtable td{padding:3px 8px;text-align:right;border-bottom:1px solid #eef2f6}
  .hydtable th{color:var(--muted);font-weight:600;position:sticky;top:0;background:#fff}
  .hydtable th:first-child,.hydtable td:first-child{text-align:left}
  @media (max-width:1180px){.hyd main{grid-template-columns:220px minmax(360px,1fr) 300px}}
  @media (max-width:980px){.hyd main{grid-template-columns:1fr}.hstage{min-height:380px}}
  @media (max-height:820px){.hyd main{min-height:0}.hstage{min-height:280px;max-height:52vh}}
  `);
  document.head.appendChild(css);

  var main = $('benchHydrogen');
  main.className = 'hyd';

  UI.html(main, `
    <aside class="panel rctl">
      <h2>Источник питания</h2>
      <div class="grp">
        <div class="seg" id="hySource">
          <button data-src="battery" class="active">Батареи</button>
          <button data-src="solar">Солнце</button>
          <button data-src="wind">Ветер</button>
          <button data-src="crank">Кривошип</button>
        </div>
      </div>
      <div class="grp" id="hySrcParams"></div>

      <h2>Обратимый PEM-элемент</h2>
      <div class="grp">
        <div class="seg" id="hyMode">
          <button data-mode="electrolysis" class="active">Электролиз</button>
          <button data-mode="fuelcell">Топливный элемент</button>
        </div>
      </div>
      <div class="fld">
        <div class="top"><span>Нагрузка</span><b id="hyLoadRes">220 Ом</b></div>
        <div class="seg" id="hyLoad">
          <button data-load="led" class="active">Светодиод</button>
          <button data-load="fan">Вентилятор</button>
          <button data-load="car">Машинка</button>
          <button data-load="resistor">Резистор</button>
        </div>
        <input type="range" id="hyOhm" min="5" max="200" step="5" value="100">
      </div>

      <h2>Другие элементы набора</h2>
      <div class="grp">
        <div class="seg" id="hyCap">
          <button data-cap="none" class="active">Нет</button>
          <button data-cap="ethanol">Этанол</button>
          <button data-cap="salt">Соль</button>
          <button data-cap="thermal">Термо</button>
        </div>
      </div>
      <div class="grp" id="hyCapParams"></div>
    </aside>

    <section class="stagewrap">
      <div class="timebar panel">
        <div class="grp" id="hySpeed">
          <button id="hyPlay" title="Пауза / пуск">⏸</button>
          <button data-sp="1" class="active">×1</button>
          <button data-sp="2">×2</button>
          <button data-sp="4">×4</button>
        </div>
        <div class="clock">модельное время: <b id="hyClock">0 с</b></div>
        <div class="grow"></div>
        <button class="btn ghost" id="hyReset">Сброс</button>
        <button class="btn primary" id="hySample">＋ Снять точку</button>
      </div>

      <div class="hstage" id="hyStage">
        <svg id="hyScene" viewBox="0 0 760 400" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="h2TankG" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stop-color="#9fd8ff"/><stop offset="100%" stop-color="#4ea8e0"/>
            </linearGradient>
            <linearGradient id="o2TankG" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stop-color="#cfe6f5"/><stop offset="100%" stop-color="#9dc4dd"/>
            </linearGradient>
            <linearGradient id="panelG" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#1b4f72"/><stop offset="55%" stop-color="#2d7096"/><stop offset="100%" stop-color="#1b4f72"/>
            </linearGradient>
            <radialGradient id="cellGlowG">
              <stop offset="0%" stop-color="#e8f7ff" stop-opacity=".9"/><stop offset="100%" stop-color="#9fd8ff" stop-opacity="0"/>
            </radialGradient>
          </defs>

          <rect x="0" y="0" width="760" height="400" fill="#f7fafc"/>

          <!-- источник -->
          <g id="hySrcGlyph" transform="translate(96,96)"></g>

          <!-- обратимый элемент: две ячейки, мембрана между ними -->
          <g id="hyCell" transform="translate(330,150)">
            <rect x="-56" y="-56" width="112" height="112" rx="10" fill="#ffffff" stroke="#a9bcc9" stroke-width="2"/>
            <rect x="-2" y="-46" width="4" height="92" fill="#cbd9e4"/>
            <circle id="hyCellGlow" cx="0" cy="0" r="70" fill="url(#cellGlowG)" opacity="0"/>
            <text x="-28" y="-32" text-anchor="middle" font-size="10" fill="#5a6772" font-family="sans-serif">H₂</text>
            <text x="28" y="-32" text-anchor="middle" font-size="10" fill="#5a6772" font-family="sans-serif">O₂</text>
            <text id="hyCellMode" x="0" y="76" text-anchor="middle" font-size="10.5" fill="#33475a" font-family="sans-serif">электролиз</text>
            <text id="hyCellV" x="0" y="-62" text-anchor="middle" font-size="13" font-weight="700" fill="#1f2a36" font-family="sans-serif">— В</text>
          </g>

          <!-- баки с газом -->
          <g transform="translate(520,150)">
            <rect x="-34" y="-56" width="68" height="112" rx="9" fill="#fff" stroke="#a9bcc9" stroke-width="2"/>
            <rect id="hyH2Fill" x="-28" y="48" width="56" height="0" rx="5" fill="url(#h2TankG)" style="transition:height .2s,y .2s"/>
            <text id="hyH2Txt" x="0" y="-40" text-anchor="middle" font-size="11" font-weight="700" fill="#1f2a36" font-family="sans-serif">H₂ 0 %</text>
            <text x="0" y="70" text-anchor="middle" font-size="10.5" fill="#5a6772" font-family="sans-serif">бак H₂ · 12,5 мл</text>
          </g>
          <g transform="translate(620,150)">
            <rect x="-24" y="-56" width="48" height="112" rx="9" fill="#fff" stroke="#a9bcc9" stroke-width="2"/>
            <rect id="hyO2Fill" x="-18" y="48" width="36" height="0" rx="5" fill="url(#o2TankG)" style="transition:height .2s,y .2s"/>
            <text id="hyO2Txt" x="0" y="-40" text-anchor="middle" font-size="10.5" fill="#33475a" font-family="sans-serif">O₂ 0 %</text>
            <text x="0" y="70" text-anchor="middle" font-size="10" fill="#5a6772" font-family="sans-serif">O₂</text>
          </g>

          <!-- провода и поток -->
          <path id="hyWireIn" d="M136 96 C 220 96 260 150 274 150" fill="none" stroke="#8fa3b3" stroke-width="3"/>
          <path id="hyFlowIn" d="M136 96 C 220 96 260 150 274 150" fill="none" stroke="#f2a93b" stroke-width="3"
                stroke-dasharray="5 12" opacity="0"/>
          <path id="hyWireOut" d="M386 150 L 470 150" fill="none" stroke="#8fa3b3" stroke-width="3"/>
          <path id="hyFlowOut" d="M386 150 L 470 150" fill="none" stroke="#3aa0c9" stroke-width="3"
                stroke-dasharray="5 12" opacity="0"/>

          <!-- нагрузка -->
          <g id="hyLoadGlyph" transform="translate(300,300)"></g>

          <!-- накопитель/химический элемент -->
          <g id="hyCapGlyph" transform="translate(560,300)"></g>

          <!-- показания на сцене -->
          <g transform="translate(96,300)">
            <rect x="-58" y="-30" width="116" height="60" rx="8" fill="#1f2a36"/>
            <text id="hyMeterMain" x="0" y="-4" text-anchor="middle" font-size="15" font-weight="700" fill="#8fe0b8" font-family="sans-serif">0,00 В</text>
            <text id="hyMeterSub" x="0" y="14" text-anchor="middle" font-size="10.5" fill="#cbd9e4" font-family="sans-serif">0,0 мА</text>
          </g>
        </svg>
      </div>

      <div class="panel" style="padding:6px 9px 9px">
        <div class="tabs">
          <button class="active" data-hytab="journal">Журнал</button>
          <button data-hytab="meas">Протокол <span id="hyMeasCount" class="badge"></span></button>
          <div class="grow"></div>
          <button class="btn ghost tiny" id="hyCsv" style="margin:4px 6px 4px 0">Экспорт CSV</button>
        </div>
        <div class="tabbody" id="hyTabJournal"><div class="journal" id="hyJournal"></div></div>
        <div class="tabbody" id="hyTabMeas" hidden></div>
      </div>
    </section>

    <aside class="right">
      <div class="card task">
        <h2>Задание <span class="badge" id="hyTaskId">1 / 6</span></h2>
        <div class="body" id="hyTaskBody"></div>
        <div class="tasklist" id="hyTaskList"></div>
      </div>

      <div class="card">
        <h2>Показания</h2>
        <div class="meters">
          <div class="meter accent"><div class="k"><span>Напряжение</span><span>U</span></div>
            <div class="v" id="hyU">0 <small>В</small></div></div>
          <div class="meter"><div class="k"><span>Ток</span><span>I</span></div>
            <div class="v" id="hyI">0 <small>А</small></div></div>
          <div class="meter"><div class="k"><span>Мощность</span><span>P</span></div>
            <div class="v" id="hyP">0 <small>Вт</small></div></div>
          <div class="meter"><div class="k"><span>Газ H₂</span><span>мл</span></div>
            <div class="v" id="hyGas">0 <small>мл</small></div></div>
        </div>
        <div class="meter wide" style="margin-top:6px"><div class="k"><span>Бак водорода</span><span id="hyTankState">пусто</span></div>
          <div class="bar"><i id="hyTankBar" style="width:0%"></i></div></div>
        <div class="aux"><span>Скорость газа: <b id="hyRate">—</b></span><span>Пик: <b id="hyPeak">—</b></span></div>
      </div>

      <div class="card">
        <h2>Химические источники</h2>
        <div style="padding:4px 0"><table class="hydtable" id="hyChemTable"></table></div>
      </div>
    </aside>`);

  /* ---------- журнал и протокол ---------- */
  function log(kind, text) {
    st.log.push({ t: st.t, kind: kind, text: text });
    if (st.log.length > 300) st.log.shift();
    renderJournal();
  }
  function timeText(t) {
    var m = Math.floor(t / 60), s = Math.round(t % 60);
    return (m ? m + ' мин ' : '') + s + ' с';
  }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function renderJournal() {
    var box = $('hyJournal');
    if (!st.log.length) { UI.html(box, '<div class="empty-note">Меняйте настройки слева — всё попадёт в журнал.</div>'); return; }
    UI.html(box, st.log.slice(-80).map(function (r) {
      return '<div class="jrow ' + r.kind + '"><span class="tm">' + timeText(r.t) + '</span><span class="dot"></span><span class="tx">' + esc(r.text) + '</span></div>';
    }).join(''));
    var p = box.parentElement;
    p.scrollTop = p.scrollHeight;
  }

  var meas = [];
  function sample() {
    var f = H.facts(st);
    meas.push({
      t: st.t, mode: st.mode, src: f.sourceLabel,
      u: f.mode === 'electrolysis' ? f.elecV : f.fcV,
      i: f.mode === 'electrolysis' ? f.elecI : f.fcI,
      p: f.mode === 'electrolysis' ? f.elecP : f.loadP,
      h2: f.h2Ml,
    });
    log('ok', 'Точка снята: U = ' + n(f.mode === 'electrolysis' ? f.elecV : f.fcV, 2) + ' В, I = ' +
      n(f.mode === 'electrolysis' ? f.elecI : f.fcI, 3) + ' А, H₂ ' + n(f.h2Ml, 1) + ' мл');
    renderMeasurements();
  }
  function renderMeasurements() {
    var box = $('hyTabMeas'), cnt = $('hyMeasCount');
    if (cnt) cnt.textContent = meas.length ? String(meas.length) : '';
    if (!meas.length) {
      UI.html(box, '<div class="empty-note">Нажмите «Снять точку», чтобы записать измерение.</div>');
      return;
    }
    var rows = meas.slice().reverse().map(function (r) {
      return '<tr><td>' + timeText(r.t) + '</td><td>' + esc(r.src) + '</td><td>' +
        (r.mode === 'electrolysis' ? 'электролиз' : 'топл. элемент') + '</td><td>' + n(r.u, 2) + '</td><td>' +
        n(r.i, 3) + '</td><td>' + n(r.p * 1000, 0) + '</td><td>' + n(r.h2, 1) + '</td></tr>';
    }).join('');
    UI.html(box, '<table class="hydtable"><thead><tr><th>Время</th><th>Источник</th><th>Режим</th>' +
      '<th>U, В</th><th>I, А</th><th>P, мВт</th><th>H₂, мл</th></tr></thead><tbody>' + rows + '</tbody></table>');
  }
  function exportCsv() {
    var lines = ['Время;Источник;Режим;U,В;I,А;P,мВт;H2,мл'];
    meas.forEach(function (r) {
      lines.push([timeText(r.t), r.src, r.mode === 'electrolysis' ? 'электролиз' : 'топл. элемент',
        n(r.u, 3), n(r.i, 4), n(r.p * 1000, 1), n(r.h2, 2)].join(';'));
    });
    var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hydrogen-protocol.csv';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    log('ok', 'Протокол выгружен в CSV (' + meas.length + ' строк)');
  }

  /* ---------- форматирование ---------- */
  function n(v, d) { return Number(v || 0).toFixed(d === undefined ? 1 : d).replace('.', ','); }

  /* ---------- элементы управления ---------- */
  function renderControls() {
    var box = $('hySrcParams');
    var html = '';
    if (st.source === 'solar') {
      html += range('Освещённость', 'sIrr', st.solarIrradiance, 100, 1000, 25, ' Вт/м²');
      html += range('Угол солнца', 'sSun', st.sunAngle, 10, 80, 1, '°');
      html += range('Наклон панели', 'sTilt', st.tilt, 0, 90, 1, '°');
      html += range('Тень на панели', 'sShade', Math.round(st.solarShade * 100), 0, 100, 5, ' %');
      html += range('Нагрев панели', 'sHeat', st.solarHeat, 10, 70, 1, ' °C');
    } else if (st.source === 'wind') {
      html += range('Скорость ветра', 'sWind', st.windSpeed, 1, 20, 0.5, ' м/с');
    } else if (st.source === 'crank') {
      html += range('Обороты кривошипа', 'sRpm', st.crankRpm, 20, 240, 5, ' об/мин');
    } else {
      html += '<div class="aux" style="padding:0 0 4px"><span>2 элемента AA, 3 В, внутреннее сопротивление 0,9 Ом</span></div>';
    }
    UI.html(box, html);

    var box2 = $('hyCapParams');
    var html2 = '';
    if (st.cap === 'ethanol') {
      html2 += range('Концентрация этанола', 'cFuel', st.capFuelPercent, 5, 25, 1, ' %');
      html2 += range('Подача топлива', 'cFlow', Math.round(st.capFlow * 100), 10, 100, 10, ' %');
    } else if (st.cap === 'salt') {
      html2 += range('Концентрация соли', 'cSalt', st.capSalinity, 0.5, 10, 0.5, ' %');
      html2 += range('Температура раствора', 'cTemp', st.capTemp, 5, 60, 1, ' °C');
    } else if (st.cap === 'thermal') {
      html2 += range('Горячая вода', 'cHot', st.thermalHot, 20, 95, 1, ' °C');
      html2 += range('Холодная вода', 'cCold', st.thermalCold, 0, 40, 1, ' °C');
    } else {
      html2 = '<div class="aux" style="padding:0 0 4px"><span>Выберите элемент: этаноловый, солевой или термоэлектрический.</span></div>';
    }
    UI.html(box2, html2);

    bindRanges();
    var r = H.loadResistance(st);
    UI.text($('hyLoadRes'), r >= 1e5 ? 'вольтметр' : Math.round(r) + ' Ом');
    $('hyOhm').style.display = st.load === 'resistor' ? '' : 'none';
  }

  function range(label, id, value, min, max, step, unit) {
    return '<div class="fld"><div class="top"><span>' + label + '</span><b id="' + id + 'V">' + n(value, step < 1 ? 1 : 0) + unit + '</b></div>' +
      '<input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '"></div>';
  }

  function bindRanges() {
    var map = {
      sIrr: function (v) { st.solarIrradiance = v; },
      sSun: function (v) { st.sunAngle = v; },
      sTilt: function (v) { st.tilt = v; },
      sShade: function (v) { st.solarShade = v / 100; },
      sHeat: function (v) { st.solarHeat = v; },
      sWind: function (v) { st.windSpeed = v; },
      sRpm: function (v) { st.crankRpm = v; },
      cFuel: function (v) { st.capFuelPercent = v; },
      cFlow: function (v) { st.capFlow = v / 100; },
      cSalt: function (v) { st.capSalinity = v; },
      cTemp: function (v) { st.capTemp = v; },
      cHot: function (v) { st.thermalHot = v; },
      cCold: function (v) { st.thermalCold = v; },
    };
    Object.keys(map).forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.oninput = function () {
        var v = parseFloat(el.value);
        map[id](v);
        var out = $(id + 'V');
        if (out) UI.text(out, n(v, parseFloat(el.step) < 1 ? 1 : 0) + (id === 'sIrr' ? ' Вт/м²' : id === 'sShade' || id === 'cFlow' ? ' %' : id === 'sWind' ? ' м/с' : id === 'sRpm' ? ' об/мин' : id === 'cFuel' || id === 'cSalt' ? ' %' : ' °C'));
        refreshSoon();
      };
    });
  }

  var refreshTimer = 0;
  function refreshSoon() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function () { lastKey = ''; render(H.facts(st)); }, 40);
  }

  /* ---------- сцена ---------- */
  function drawSource(f) {
    var g = $('hySrcGlyph'), html = '';
    if (st.source === 'battery') {
      html = '<rect x="-34" y="-16" width="68" height="32" rx="5" fill="#fff" stroke="#a9bcc9" stroke-width="2"/>' +
        '<rect x="-22" y="-22" width="10" height="6" rx="2" fill="#a9bcc9"/>' +
        '<text x="0" y="5" text-anchor="middle" font-size="12" font-weight="700" fill="#1f2a36" font-family="sans-serif">3 В</text>' +
        '<text x="0" y="34" text-anchor="middle" font-size="10" fill="#5a6772" font-family="sans-serif">батарейный блок</text>';
    } else if (st.source === 'solar') {
      var sy = 0.25 + 0.75 * Math.sin(Math.max(0, st.tilt) * Math.PI / 180);
      html = '<g transform="scale(1,' + sy.toFixed(3) + ')">' +
        '<rect x="-40" y="-18" width="80" height="36" rx="3" fill="url(#panelG)" stroke="#1b4f72"/>' +
        '<path d="M-20 -18 V18 M0 -18 V18 M20 -18 V18 M-40 0 H40" stroke="#5f9ec4" stroke-width="1" opacity=".7"/></g>' +
        '<text x="0" y="40" text-anchor="middle" font-size="10" fill="#5a6772" font-family="sans-serif">солнечная панель</text>';
    } else if (st.source === 'wind') {
      html = '<line x1="0" y1="26" x2="0" y2="-6" stroke="#9fb4c4" stroke-width="3"/>' +
        '<g class="rotor"><path d="M0 0 L-4 -34 L4 -34 Z" fill="#f2f6f9" stroke="#9fb4c4" stroke-width="1.2"/>' +
        '<path d="M0 0 L-4 -34 L4 -34 Z" fill="#f2f6f9" stroke="#9fb4c4" stroke-width="1.2" transform="rotate(120)"/>' +
        '<path d="M0 0 L-4 -34 L4 -34 Z" fill="#f2f6f9" stroke="#9fb4c4" stroke-width="1.2" transform="rotate(240)"/></g>' +
        '<circle r="3" fill="#33475a"/>' +
        '<text x="0" y="42" text-anchor="middle" font-size="10" fill="#5a6772" font-family="sans-serif">ветрогенератор</text>';
    } else {
      html = '<circle r="20" fill="none" stroke="#a9bcc9" stroke-width="4"/>' +
        '<circle r="7" fill="#a9bcc9"/>' +
        '<line id="hyCrankArm" x1="0" y1="0" x2="0" y2="-20" stroke="#7a8fa0" stroke-width="3"/>' +
        '<text x="0" y="44" text-anchor="middle" font-size="10" fill="#5a6772" font-family="sans-serif">кривошип</text>';
    }
    UI.html(g, html);
  }

  function drawLoad(f) {
    var g = $('hyLoadGlyph'), html = '';
    var on = f.mode === 'fuelcell' && f.fcV > 0.25 && st.loadOn;
    if (st.load === 'led') {
      html = '<circle r="15" fill="' + (on ? '#ffd166' : '#e9eff4') + '" stroke="#a9bcc9" stroke-width="2"/>' +
        '<circle r="26" fill="url(#cellGlowG)" opacity="' + (on ? Math.min(0.85, f.fcV * 0.7) : 0) + '"/>' +
        '<text x="0" y="38" text-anchor="middle" font-size="10" fill="#5a6772" font-family="sans-serif">светодиод</text>';
    } else if (st.load === 'fan') {
      var spin = on ? Math.min(0.9, f.fcV) : 0;
      html = '<g class="fanrot" opacity="' + (on ? 1 : 0.45) + '">' +
        '<path d="M0 0 C 14 -12 22 -2 6 6 Z" fill="#9fb4c4"/><path d="M0 0 C 12 14 2 22 -6 6 Z" fill="#9fb4c4"/>' +
        '<path d="M0 0 C -14 12 -22 2 -6 -6 Z" fill="#9fb4c4"/></g>' +
        '<text x="0" y="38" text-anchor="middle" font-size="10" fill="#5a6772" font-family="sans-serif">вентилятор</text>';
      g.dataset.spin = String(spin);
    } else if (st.load === 'car') {
      html = '<rect x="-26" y="-10" width="52" height="18" rx="4" fill="#' + (on ? '2d7096' : 'cbd9e4') + '" stroke="#7a8fa0"/>' +
        '<circle cx="-14" cy="10" r="6" fill="#33475a"/><circle cx="14" cy="10" r="6" fill="#33475a"/>' +
        '<text x="0" y="34" text-anchor="middle" font-size="10" fill="#5a6772" font-family="sans-serif">машинка</text>';
    } else {
      html = '<rect x="-22" y="-10" width="44" height="20" rx="3" fill="#fff" stroke="#a9bcc9" stroke-width="2"/>' +
        '<text x="0" y="4" text-anchor="middle" font-size="10" fill="#1f2a36" font-family="sans-serif">' + Math.round(st.loadOhm) + ' Ом</text>' +
        '<text x="0" y="34" text-anchor="middle" font-size="10" fill="#5a6772" font-family="sans-serif">резистор</text>';
    }
    UI.html(g, html);
  }

  function drawCap(f) {
    var g = $('hyCapGlyph'), html = '';
    var c = f.chem;
    if (st.cap === 'none') {
      UI.html(g, '<text x="0" y="0" text-anchor="middle" font-size="10.5" fill="#8a97a3" font-family="sans-serif">дополнительный элемент не подключён</text>');
      return;
    }
    var title = { ethanol: 'этаноловый элемент', salt: 'солевой элемент', thermal: 'термоэлемент' }[st.cap];
    html = '<rect x="-62" y="-24" width="124" height="48" rx="8" fill="#fff" stroke="#a9bcc9" stroke-width="2"/>' +
      '<text x="0" y="-6" text-anchor="middle" font-size="12" font-weight="700" fill="#1f2a36" font-family="sans-serif">' + n(c.v, 2) + ' В</text>' +
      '<text x="0" y="10" text-anchor="middle" font-size="10" fill="#5a6772" font-family="sans-serif">' + n(c.p * 1000, 0) + ' мВт</text>' +
      '<text x="0" y="40" text-anchor="middle" font-size="10" fill="#5a6772" font-family="sans-serif">' + title + '</text>' +
      (c.note ? '<text x="0" y="56" text-anchor="middle" font-size="9.5" fill="#a02020" font-family="sans-serif">' + esc(c.note) + '</text>' : '');
    UI.html(g, html);
  }

  function render(f) {
    f = f || H.facts(st);

    // источник и нагрузка
    var srcKey = st.source + '|' + Math.round(st.tilt) + '|' + st.solarShade.toFixed(2);
    if (lastKey !== srcKey) { drawSource(f); lastKey = srcKey; }
    drawLoad(f);
    drawCap(f);

    // элемент
    UI.text($('hyCellMode'), st.mode === 'electrolysis' ? 'электролиз' : 'топливный элемент');
    var cellV = st.mode === 'electrolysis' ? f.elecV : f.fcV;
    UI.text($('hyCellV'), n(cellV, 2) + ' В');
    UI.attr($('hyCellGlow'), 'opacity', st.mode === 'electrolysis' ? (f.powered ? 0.55 : 0) : Math.min(0.8, f.fcV));

    // баки
    var h2h = Math.max(0, Math.min(1, f.h2pct)) * 96;
    UI.attr($('hyH2Fill'), 'height', Math.round(h2h));
    UI.attr($('hyH2Fill'), 'y', Math.round(48 - h2h));
    var o2h = Math.max(0, Math.min(1, f.o2Ml / H.V_TANK)) * 96;
    UI.attr($('hyO2Fill'), 'height', Math.round(o2h));
    UI.attr($('hyO2Fill'), 'y', Math.round(48 - o2h));
    UI.text($('hyH2Txt'), 'H₂ ' + Math.round(f.h2pct * 100) + ' %');
    UI.text($('hyO2Txt'), 'O₂ ' + Math.round(f.o2Ml / H.V_TANK * 100) + ' %');

    // потоки
    UI.attr($('hyFlowIn'), 'opacity', f.powered ? 0.85 : 0);
    UI.attr($('hyFlowOut'), 'opacity', f.mode === 'fuelcell' && f.fcV > 0.2 ? 0.85 : 0);

    // показания на сцене
    var u = st.mode === 'electrolysis' ? f.elecV : f.fcV;
    var i = st.mode === 'electrolysis' ? f.elecI : f.fcI;
    UI.text($('hyMeterMain'), n(u, 2) + ' В');
    UI.text($('hyMeterSub'), n(i * 1000, 1) + ' мА');

    // панель показаний
    UI.text($('hyU'), n(u, 2) + ' В');
    UI.text($('hyI'), n(i, 3) + ' А');
    UI.text($('hyP'), st.mode === 'electrolysis' ? n(f.elecP * 1000, 0) + ' мВт' : n(f.loadP * 1000, 0) + ' мВт');
    UI.text($('hyGas'), n(f.h2Ml, 1) + ' мл');
    UI.text($('hyRate'), n(f.gasRate * 60, 2) + ' мл H₂/мин');
    UI.text($('hyPeak'), n(f.peakPower, 0) + ' мВт');
    var bar = $('hyTankBar');
    bar.style.width = Math.round(f.h2pct * 100) + '%';
    UI.text($('hyTankState'), f.h2pct > 0.95 ? 'полный' : (f.h2pct > 0.6 ? 'заряжен' : (f.h2pct > 0.15 ? 'частично' : 'пусто')));
    UI.text($('hyClock'), timeText(st.t));

    // таблица химических источников
    var rows = [
      ['Этанол 10 %', H.chemicalSource(Object.assign({}, st, { cap: 'ethanol', capFuelPercent: 10, capFlow: 1 })), 'ethanol'],
      ['Соль 3,5 %', H.chemicalSource(Object.assign({}, st, { cap: 'salt', capSalinity: 3.5 })), 'salt'],
      ['Термо 60/20 °C', H.chemicalSource(Object.assign({}, st, { cap: 'thermal', thermalHot: 60, thermalCold: 20 })), 'thermal'],
    ];
    UI.html($('hyChemTable'), '<thead><tr><th>Источник</th><th>U, В</th><th>P, мВт</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td>' + r[0] + '</td><td>' + n(r[1].v, 2) + '</td><td>' + n(r[1].p * 1000, 0) + '</td></tr>';
      }).join('') + '</tbody>');
  }

  /* ---------- задания ---------- */
  function renderTask() {
    var tk = H.TASKS[taskIndex], f = H.facts(st);
    var done = solved[taskIndex];
    UI.text($('hyTaskId'), (taskIndex + 1) + ' / ' + H.TASKS.length);
    UI.html($('hyTaskBody'),
      '<div class="glyph">' + (done ? '★'.repeat(done) : '🎯') + '</div>' +
      '<div class="goal"><b>' + esc(tk.t) + '</b><br>' + esc(tk.goal) + '</div>' +
      '<ol class="steps">' + tk.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<div class="row" style="gap:6px;margin-top:6px">' +
      '<button class="btn ghost tiny" id="hyHint">Подсказка</button>' +
      '<button class="btn primary tiny" id="hyCheck">Проверить</button></div>' +
      '<div class="checkout" id="hyCheckOut"></div>');
    UI.html($('hyTaskList'), H.TASKS.map(function (t, i) {
      return '<button data-i="' + i + '" class="' + (i === taskIndex ? 'active ' : '') + (solved[i] ? 'done' : '') + '">' +
        '<span class="num">' + (solved[i] ? '★' : (i + 1)) + '</span><span>' + esc(t.t) + '</span></button>';
    }).join(''));

    $('hyHint').onclick = function () {
      var box = $('hyCheckOut');
      var hint = tk.hints[(tk._h || 0) % tk.hints.length];
      tk._h = (tk._h || 0) + 1;
      UI.html(box, '<div class="hintline">💡 ' + esc(hint) + '</div>');
      log('info', 'Подсказка к заданию ' + (taskIndex + 1) + ': ' + hint);
    };
    $('hyCheck').onclick = function () { checkTask(true); };
    [].forEach.call($('hyTaskList').children, function (b) {
      b.onclick = function () { taskIndex = +b.dataset.i; renderTask(); };
    });
    if (done) return;
  }

  function checkTask(show) {
    var tk = H.TASKS[taskIndex], f = H.facts(st), was = !!solved[taskIndex];
    var ok = false;
    try { ok = tk.check(f); } catch (e) { ok = false; }
    if (ok && !was) {
      var stars = 1;
      try { stars = tk.stars(f) || 1; } catch (e) {}
      solved[taskIndex] = stars;
      log('ok', 'Задание выполнено: ' + tk.t + ' (' + stars + '★)');
      renderTask();
    } else if (show) {
      var box = $('hyCheckOut');
      if (box) UI.html(box, ok ? '<div class="okline">✓ Условие выполнено</div>'
        : '<div class="badline">Пока не выполнено — сверьтесь с шагами и подсказкой.</div>');
    }
    return ok;
  }

  /* ---------- кадр ---------- */
  var lastTick = 0, speed = 1;
  function frame(ts) {
    if (!lastTick) lastTick = ts;
    var dtReal = Math.min(0.1, (ts - lastTick) / 1000);
    lastTick = ts;
    if (window.__bench === 'hydrogen') {
      var dt = playing ? dtReal * speed : 0;
      if (dt > 0) H.step(st, dt);
      var f = H.facts(st);
      render(f);
      meterTick += dtReal;
      if (meterTick > 0.15) {
        meterTick = 0; taskTick += 0.15;
        // первое задание — про набор газа: сразу после загрузки стенда он пуст,
        // поэтому не засчитываем его в первые секунды модельного времени
        if (taskTick > 0.8) { taskTick = 0; if (st.t > 3) checkTask(false); }
      }
    }
    requestAnimationFrame(frame);
  }

  /* ---------- управление: обработчики ---------- */
  function seg(id, attr, onPick, current) {
    [].forEach.call($(id).children, function (b) {
      b.classList.toggle('active', b.dataset[attr] === current);
      b.onclick = function () {
        [].forEach.call($(id).children, function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        onPick(b.dataset[attr]);
      };
    });
  }

  seg('hySource', 'src', function (v) {
    st.source = v;
    log('info', 'Источник питания: ' + H.SOURCES[v].label);
    renderControls(); refreshSoon();
  }, st.source);
  seg('hyMode', 'mode', function (v) {
    st.mode = v;
    log('ok', v === 'electrolysis' ? 'Режим электролиза: вода разлагается, газ идёт в баки.' :
      'Режим топливного элемента: водород и кислород дают ток.');
    refreshSoon();
  }, st.mode);
  seg('hyLoad', 'load', function (v) {
    st.load = v;
    log('info', 'Нагрузка: ' + ({ led: 'светодиод', fan: 'вентилятор', car: 'машинка', resistor: 'резистор' }[v]));
    renderControls(); refreshSoon();
  }, st.load);
  seg('hyCap', 'cap', function (v) {
    st.cap = v;
    log('info', 'Дополнительный элемент: ' + ({ none: 'нет', ethanol: 'этаноловый', salt: 'солевой', thermal: 'термоэлектрический' }[v]));
    renderControls(); refreshSoon();
  }, st.cap);
  (function () {
    var btns = document.querySelectorAll('#hySpeed button[data-sp]');
    [].forEach.call(btns, function (b) {
      b.onclick = function () {
        [].forEach.call(btns, function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        speed = +b.dataset.sp;
        log('info', 'Множитель времени ×' + b.dataset.sp);
      };
    });
  })();

  $('hyOhm').oninput = function () {
    st.loadOhm = +this.value;
    var out = $('hyLoadRes');
    if (out) UI.text(out, Math.round(H.loadResistance(st)) + ' Ом');
    refreshSoon();
  };
  $('hyPlay').onclick = function () {
    playing = !playing;
    this.textContent = playing ? '⏸' : '▶';
    log('info', playing ? 'Моделирование продолжено' : 'Моделирование на паузе');
  };
  $('hyReset').onclick = function () {
    st = H.createState();
    meas.length = 0;
    lastKey = '';
    renderControls(); renderTask(); renderMeasurements(); render(H.facts(st));
    log('ok', 'Стенд сброшен: баки пусты, источник — батарейный блок.');
  };
  $('hySample').onclick = sample;
  $('hyCsv').onclick = exportCsv;
  [].forEach.call(document.querySelectorAll('[data-hytab]'), function (b) {
    b.onclick = function () {
      [].forEach.call(document.querySelectorAll('[data-hytab]'), function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      var measTab = b.dataset.hytab === 'meas';
      $('hyTabJournal').hidden = measTab;
      $('hyTabMeas').hidden = !measTab;
    };
  });

  /* ---------- старт ---------- */
  renderControls();
  renderTask();
  renderMeasurements();
  render(H.facts(st));
  log('ok', 'Стенд «Водородный контур»: обратимый PEM-элемент, баки 12,5 мл, источник — батарейный блок.');
  log('info', 'Наберите водород в режиме электролиза, затем переключитесь на топливный элемент.');
  requestAnimationFrame(frame);

  window.__hydrogen = {
    state: function () { return st; },
    facts: function () { return H.facts(st); },
    sample: sample,
    solved: function () { return solved; },
    H: H,
  };
})();

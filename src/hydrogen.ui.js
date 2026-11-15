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
  var chemKinds = {};   // какие химические элементы уже снимали точку
  var lastKey = '';

  var css = document.createElement('style');
  UI.text(css, `
  .hyd main{display:grid;grid-template-columns:250px minmax(420px,1fr) 330px;gap:10px;padding:10px;min-height:0}
  .hyd .seg{display:flex;gap:2px;background:#e8eef5;border-radius:7px;padding:2px;flex-wrap:wrap}
  .hyd .seg button{flex:1 1 auto;min-width:0;padding:4px 6px;font-size:11px;border-radius:5px;color:var(--muted);white-space:nowrap}
  .hyd #hyLoad{display:grid;grid-template-columns:1fr 1fr;gap:2px}
  .hyd .rctl{overflow:auto}
  .hyd .bottombar.collapsed{height:36px!important;flex:0 0 36px}
  .hyd .bottombar.collapsed .tabbody{display:none}
  .hyd .seg button.active{background:#fff;color:var(--accent);font-weight:700;box-shadow:0 1px 2px rgba(0,0,0,.08)}
  .hyd .rctl > .fld{padding:0 9px}
  .hyd .fld{margin-bottom:8px}
  .hyd .fld .top{display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);margin-bottom:3px}
  .hyd .fld .top b{color:var(--ink);font-variant-numeric:tabular-nums}
  .hyd input[type=range]{width:100%;-webkit-appearance:none;appearance:none;height:6px;border-radius:4px;
    background:#dbe6ee;outline:none;margin:4px 0}
  .hyd input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:15px;height:15px;border-radius:50%;
    background:#f07d20;border:2px solid #fff;box-shadow:0 1px 3px rgba(20,40,90,.35);cursor:pointer}
  .hyd input[type=range]::-moz-range-thumb{width:13px;height:13px;border-radius:50%;background:#f07d20;
    border:2px solid #fff;box-shadow:0 1px 3px rgba(20,40,90,.35);cursor:pointer}
  .hyd .rctl h2{position:relative}
  .hyd .card.task .badge{background:#fff2e6;color:#a35c00}
  .hyd .tasklist button.active{border-left:3px solid #f07d20}
  .hyd .card.task .glyph{color:#f07d20}
  .hyd .chk{display:flex;align-items:center;gap:7px;font-size:12px;padding:3px 0}
  .hyd .chk input{width:15px;height:15px;accent-color:var(--accent)}
  .hstage{position:relative;flex:1;min-height:0;border-radius:var(--r);border:1px solid #c4d0da;overflow:hidden;
    box-shadow:inset 0 0 70px rgba(15,31,74,.05);background:#f4f7fa}
  .hstage svg{width:100%;height:100%;display:block;position:relative;z-index:1}

  /* --- фирменный вид Horizon: белый пластик, синий корпус, оранжевые метки --- */
  .hyd .btn.primary{background:#1b3e8f;border-color:#1b3e8f}
  .hyd .btn.primary:hover{background:#16327a}
  .hyd .seg{background:#e8eef5;border-radius:8px}
  .hyd .seg button.active{color:#1b3e8f;box-shadow:0 1px 3px rgba(20,40,90,.16)}
  .hyd .panel h2,.hyd .card h2{color:#41566b}
  .hyd .panel h2::before,.hyd .card h2::before{content:'';width:7px;height:7px;border-radius:2px;background:#2ea3dc;flex:0 0 7px;
    box-shadow:0 0 0 2px rgba(46,163,220,.16)}
  .hyd .meter{background:#f6f9fc;border-color:#d7e2ec}
  .hyd .meter.accent .v{color:#1b3e8f}
  .hybrand{display:flex;align-items:center;gap:8px;padding:7px 10px 0;font-size:10.5px;color:#7a8b99;
    text-transform:uppercase;letter-spacing:.8px}
  .hybrand b{color:#1b3e8f;letter-spacing:1.2px;font-size:11px}
  .hybrand .o{width:8px;height:8px;border-radius:50%;background:#f07d20}
  .hytag{display:inline-flex;align-items:center;gap:5px;background:#eaf4fb;border:1px solid #c2dff0;color:#1b5f8a;
    border-radius:20px;padding:1px 8px;font-size:10px;letter-spacing:.3px}
  .hytag.o{background:#fff2e6;border-color:#f6d3ae;color:#a35c00}
  @keyframes hySpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
  @keyframes hyFlow{to{stroke-dashoffset:-34}}
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
        <div class="hybrand" style="padding:0 4px 0 0"><span class="o"></span><b>HORIZON</b> ENERGY BOX</div>
        <div class="grow" style="max-width:2px"></div>
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
        <svg id="hyScene" viewBox="0 0 760 530" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="hyBenchG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#ffffff"/><stop offset="70%" stop-color="#f1f5f8"/><stop offset="100%" stop-color="#e3eaf0"/>
            </linearGradient>
            <linearGradient id="hyWaterG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#bfe9f7" stop-opacity=".95"/><stop offset="100%" stop-color="#7fcbe8" stop-opacity=".95"/>
            </linearGradient>
            <linearGradient id="hyH2G" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stop-color="#5cc6ef"/><stop offset="100%" stop-color="#a8e3f8"/>
            </linearGradient>
            <linearGradient id="hyO2G" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stop-color="#cfe0ec"/><stop offset="100%" stop-color="#eef5fa"/>
            </linearGradient>
            <linearGradient id="hyPanelG" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#122a4a"/><stop offset="50%" stop-color="#1f4a76"/><stop offset="100%" stop-color="#0e2340"/>
            </linearGradient>
            <linearGradient id="hyPlateG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#eef3f7"/>
            </linearGradient>
            <radialGradient id="hyGlowG">
              <stop offset="0%" stop-color="#d8f2ff" stop-opacity=".85"/><stop offset="100%" stop-color="#d8f2ff" stop-opacity="0"/>
            </radialGradient>
            <radialGradient id="hySunG">
              <stop offset="0%" stop-color="#fff6c9"/><stop offset="100%" stop-color="#ffd166" stop-opacity=".1"/>
            </radialGradient>
            <pattern id="hyGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M20 0 H0 V20" fill="none" stroke="#dfe8ef" stroke-width="1"/>
            </pattern>
            <filter id="hySoft" x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#2a4358" flood-opacity=".14"/>
            </filter>
          </defs>

          <!-- рабочий стол: светлый пластик с сеткой, как на фото набора -->
          <rect x="0" y="0" width="760" height="530" fill="url(#hyBenchG)"/>
          <rect x="0" y="0" width="760" height="530" fill="url(#hyGrid)" opacity=".55"/>
          <rect x="0" y="380" width="760" height="150" fill="#e9eff4" opacity=".55"/>

          <!-- подпись стенда -->
          <g transform="translate(20,22)">
            <circle cx="6" cy="6" r="6" fill="#f07d20"/>
            <text x="20" y="10" font-size="11.5" font-family="sans-serif" fill="#2b3a48">
              <tspan font-weight="700" letter-spacing="1.6" fill="#1b3e8f">HORIZON</tspan>
              <tspan fill="#6b7c8b"> ENERGY BOX · FCJJ-40</tspan>
            </text>
          </g>
          <text x="740" y="30" text-anchor="end" font-size="10.5" font-family="sans-serif" fill="#8b9aa6">стенд «Водородный контур»</text>

          <!-- ================= МОДУЛЬ 1: источник питания ================= -->
          <g id="hySrcGlyph" transform="translate(112,168)"></g>

          <!-- ================= МОДУЛЬ 2: обратимый PEM-элемент ================= -->
          <g transform="translate(340,186)">
            <path d="M-52 44 L68 20 Q78 18 80 27 L80 36 Q78 45 68 44 Z" fill="none" stroke="#c9d5de" stroke-width="0"/>
            <ellipse cx="12" cy="78" rx="92" ry="12" fill="#cfdde7" opacity=".55"/>
            <rect x="-76" y="6" width="176" height="66" rx="12" fill="url(#hyPlateG)" stroke="#c6d3dd" stroke-width="2" filter="url(#hySoft)"/>
            <rect x="-64" y="16" width="152" height="10" rx="5" fill="#dbe6ee"/>
            <text x="12" y="64" text-anchor="middle" font-size="9.5" font-family="sans-serif" fill="#7d8d9b" letter-spacing=".6">REVERSIBLE PEM FUEL CELL</text>
            <circle cx="-60" cy="40" r="4.5" fill="#f07d20"/><circle cx="84" cy="40" r="4.5" fill="#2b3a48"/>
            <text x="-54" y="44" font-size="8.5" font-family="sans-serif" fill="#f07d20">+</text>
            <text x="88" y="44" font-size="8.5" font-family="sans-serif" fill="#2b3a48">–</text>
            <!-- герметичные цилиндры -->
            <g transform="translate(-34,-46)">
              <rect x="-26" y="0" width="52" height="60" rx="10" fill="#f8fbfd" stroke="#c6d3dd" stroke-width="2"/>
              <rect x="-20" y="6" width="40" height="48" rx="6" fill="url(#hyWaterG)"/>
              <rect x="-16" y="-16" width="32" height="18" rx="5" fill="#eef4f8" stroke="#c6d3dd" stroke-width="2"/>
              <rect x="-11" y="-28" width="22" height="14" rx="4" fill="#dfeaf2" stroke="#c6d3dd" stroke-width="2"/>
              <text x="0" y="34" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#1b5f8a">H₂O</text>
            </g>
            <g transform="translate(58,-46)">
              <rect x="-26" y="0" width="52" height="60" rx="10" fill="#f8fbfd" stroke="#c6d3dd" stroke-width="2"/>
              <rect x="-20" y="6" width="40" height="48" rx="6" fill="url(#hyWaterG)" opacity=".7"/>
              <rect x="-16" y="-16" width="32" height="18" rx="5" fill="#eef4f8" stroke="#c6d3dd" stroke-width="2"/>
              <rect x="-11" y="-28" width="22" height="14" rx="4" fill="#dfeaf2" stroke="#c6d3dd" stroke-width="2"/>
              <text x="0" y="34" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#1b5f8a">H₂O</text>
            </g>
            <!-- пузырьки и режим -->
            <g id="hyBubbles" opacity="0"></g>
            <circle id="hyCellGlow" cx="0" cy="0" r="86" fill="url(#hyGlowG)" opacity="0"/>
            <text id="hyCellMode" x="12" y="100" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#5d6f7d">электролиз воды</text>
            <text id="hyCellV" x="12" y="-96" text-anchor="middle" font-size="12" font-weight="700" font-family="sans-serif" fill="#22303c">— В</text>
          </g>

          <!-- ================= МОДУЛЬ 3: баки H₂ и O₂ ================= -->
          <g transform="translate(536,158)">
            <ellipse cx="0" cy="112" rx="44" ry="9" fill="#cfdde7" opacity=".6"/>
            <rect x="-34" y="6" width="68" height="100" rx="12" fill="#f8fbfd" stroke="#c6d3dd" stroke-width="2" filter="url(#hySoft)"/>
            <rect x="-28" y="12" width="56" height="88" rx="8" fill="#ffffff" stroke="#e0e9f0"/>
            <rect id="hyH2Fill" x="-28" y="95" width="56" height="0" rx="7" fill="url(#hyH2G)" opacity=".92" style="transition:height .2s,y .2s"/>
            <g stroke="#eef4f8" stroke-width="2"><path d="M-28 30 H28"/><path d="M-28 52 H28"/><path d="M-28 74 H28"/></g>
            <rect x="-14" y="-8" width="28" height="14" rx="4" fill="#e7eff6" stroke="#c6d3dd" stroke-width="2"/>
            <text id="hyH2Txt" x="0" y="-14" text-anchor="middle" font-size="10.5" font-weight="700" font-family="sans-serif" fill="#1b5f8a">H₂ 0 %</text>
            <text x="0" y="124" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#6b7c8b">бак H₂ · 12,5 мл</text>
          </g>
          <g transform="translate(644,158)">
            <ellipse cx="0" cy="112" rx="32" ry="8" fill="#cfdde7" opacity=".6"/>
            <rect x="-24" y="6" width="48" height="100" rx="10" fill="#f8fbfd" stroke="#c6d3dd" stroke-width="2" filter="url(#hySoft)"/>
            <rect x="-18" y="12" width="36" height="88" rx="6" fill="#ffffff" stroke="#e0e9f0"/>
            <rect id="hyO2Fill" x="-18" y="95" width="36" height="0" rx="5" fill="url(#hyO2G)" style="transition:height .2s,y .2s"/>
            <g stroke="#eef4f8" stroke-width="2"><path d="M-18 34 H18"/><path d="M-18 60 H18"/><path d="M-18 86 H18"/></g>
            <rect x="-11" y="-8" width="22" height="14" rx="4" fill="#e7eff6" stroke="#c6d3dd" stroke-width="2"/>
            <text id="hyO2Txt" x="0" y="-14" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#5d6f7d">O₂ 0 %</text>
            <text x="0" y="124" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#6b7c8b">кислород</text>
          </g>

          <!-- провода с клеммами «банан» -->
          <path id="hyWireIn" d="M166 208 C 214 208 236 226 266 226" fill="none" stroke="#c33b3b" stroke-width="3.4" stroke-linecap="round"/>
          <path id="hyFlowIn" d="M166 208 C 214 208 236 226 266 226" fill="none" stroke="#ffb347" stroke-width="3.4"
                stroke-dasharray="4 13" opacity="0" stroke-linecap="round"/>
          <path id="hyWireOut" d="M424 226 L 502 226" fill="none" stroke="#2b3a48" stroke-width="3.4" stroke-linecap="round"/>
          <path id="hyFlowOut" d="M424 226 L 502 226" fill="none" stroke="#39b3e0" stroke-width="3.4"
                stroke-dasharray="4 13" opacity="0" stroke-linecap="round"/>

          <!-- ================= МОДУЛЬ 4: нагрузка ================= -->
          <g id="hyLoadGlyph" transform="translate(142,408)"></g>

          <!-- ================= МОДУЛЬ 5: измерительный прибор ================= -->
          <g transform="translate(360,412)">
            <ellipse cx="0" cy="46" rx="72" ry="9" fill="#cfdde7" opacity=".55"/>
            <rect x="-66" y="-34" width="132" height="78" rx="12" fill="url(#hyPlateG)" stroke="#c6d3dd" stroke-width="2" filter="url(#hySoft)"/>
            <rect x="-52" y="-24" width="104" height="40" rx="5" fill="#dfe9d2" stroke="#24313d" stroke-width="2"/>
            <text id="hyMeterMain" x="0" y="-7" text-anchor="middle" font-size="16" font-weight="700" fill="#22301a"
                  font-family="'DejaVu Sans Mono',Consolas,monospace">0,00 В</text>
            <text id="hyMeterSub" x="0" y="10" text-anchor="middle" font-size="10.5" fill="#3d5230"
                  font-family="'DejaVu Sans Mono',Consolas,monospace">0,0 мА</text>
            <circle cx="-46" cy="32" r="6" fill="#2ea3dc"/><circle cx="0" cy="32" r="6" fill="#f07d20"/>
            <circle cx="46" cy="32" r="6" fill="#2b3a48" opacity=".55"/>
          </g>

          <!-- ================= МОДУЛЬ 6: химический элемент ================= -->
          <g id="hyCapGlyph" transform="translate(596,408)"></g>
        </svg>
      </div>

      <div class="bottombar panel" style="height:132px">
        <div class="tabs">
          <button class="active" data-hytab="journal">Журнал</button>
          <button data-hytab="meas">Протокол <span id="hyMeasCount" class="badge"></span></button>
          <div class="grow"></div>
          <button class="btn ghost tiny" id="hyCsv" style="margin:4px 6px 4px 0">Экспорт CSV</button>
          <button class="btn ghost tiny" id="hyLogFold" title="Свернуть журнал" style="margin:4px 6px 4px 0">Свернуть ▾</button>
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
        <h2>Показания прибора</h2>
        <div style="padding:9px 9px 0">
          <div class="lcd" style="text-align:center">
            <div class="cap"><span>U, В</span><span>I, мА</span></div>
            <div class="main" id="hyU">0,00</div>
            <div class="sub" id="hyI">0,0</div>
          </div>
        </div>
        <div class="meters">
          <div class="meter accent"><div class="k"><span>Мощность</span><span>P</span></div>
            <div class="v" id="hyP">0 <small>мВт</small></div></div>
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
    if (st.cap && st.cap !== 'none') chemKinds[st.cap] = true;
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
  // белая пластиковая плата модуля — как у деталей набора
  function plate(w, h, label, accent) {
    var x = -w / 2, y = -h / 2;
    return '<ellipse cx="0" cy="' + (y + h + 6) + '" rx="' + (w / 2 - 2) + '" ry="6" fill="#cfdde7" opacity=".55"/>' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="10" fill="url(#hyPlateG)" stroke="#c6d3dd" stroke-width="2" filter="url(#hySoft)"/>' +
      (label ? '<text x="' + (x + 9) + '" y="' + (y + 13) + '" font-size="7.5" font-family="sans-serif" letter-spacing=".7" fill="#b3c1cc">' + label + '</text>' : '') +
      '<circle cx="' + (x + 12) + '" cy="' + (y + h - 5) + '" r="9" fill="none" stroke="' + (accent || '#c6d3dd') + '" stroke-width="1.4" opacity=".8"/>';
  }

  function socket(x, y, color) {
    return '<circle cx="' + x + '" cy="' + y + '" r="7" fill="#f3f7fa" stroke="#b9c8d4" stroke-width="1.6"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="3.2" fill="' + color + '"/>';
  }

  function drawSource(f) {
    var g = $('hySrcGlyph'), html = '';
    if (st.source === 'battery') {
      html = plate(112, 74, '', '#2b3a48') +
        '<rect x="-30" y="-16" width="26" height="34" rx="4" fill="#f4f8fb" stroke="#b9c8d4" stroke-width="1.6"/>' +
        '<rect x="-4" y="-16" width="26" height="34" rx="4" fill="#f4f8fb" stroke="#b9c8d4" stroke-width="1.6"/>' +
        '<rect x="0" y="-21" width="6" height="6" rx="2" fill="#b9c8d4"/>' +
        '<text x="-17" y="6" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#41566b">AA</text>' +
        '<text x="9" y="6" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#41566b">AA</text>' +
        '<text x="0" y="-24" text-anchor="middle" font-size="10.5" font-weight="700" font-family="sans-serif" fill="#22303c">3 В</text>' +
        '<text x="0" y="58" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#6b7c8b">батарейный блок</text>';
    } else if (st.source === 'solar') {
      var sy = 0.3 + 0.7 * Math.sin(Math.max(0, st.tilt) * Math.PI / 180);
      var lit = 0.35 + 0.65 * Math.min(1, st.solarIrradiance / 900) * (1 - st.solarShade);
      html = plate(122, 74, 'SOLAR PANEL', '#1b3e8f') +
        '<circle cx="40" cy="-24" r="26" fill="url(#hySunG)" opacity="' + lit.toFixed(2) + '"/>' +
        '<g transform="translate(-4,-4) scale(1,' + sy.toFixed(3) + ')">' +
        '<rect x="-42" y="-20" width="84" height="40" rx="3" fill="url(#hyPanelG)" stroke="#0e2340"/>' +
        '<path d="M-21 -20 V20 M0 -20 V20 M21 -20 V20 M-42 0 H42" stroke="#5f9ec4" stroke-width="1" opacity=".65"/></g>' +
        '<text x="0" y="58" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#6b7c8b">солнечная панель</text>';
    } else if (st.source === 'wind') {
      var dur = Math.max(0.4, 3.2 / Math.max(0.6, st.windSpeed)).toFixed(2);
      html = plate(122, 84, 'WIND TURBINE', '#2ea3dc') +
        '<line x1="0" y1="24" x2="0" y2="-6" stroke="#dbe6ee" stroke-width="5" stroke-linecap="round"/>' +
        '<g transform="translate(0,-12)"><g>' +
        '<path d="M0 0 C 5 -9 2 -22 -3 -26 C -1 -16 -2 -6 0 0 Z" fill="#2ea3dc"/>' +
        '<path d="M0 0 C 5 -9 2 -22 -3 -26 C -1 -16 -2 -6 0 0 Z" fill="#2ea3dc" transform="rotate(120)"/>' +
        '<path d="M0 0 C 5 -9 2 -22 -3 -26 C -1 -16 -2 -6 0 0 Z" fill="#2ea3dc" transform="rotate(240)"/>' +
        '<animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="' + dur + 's" repeatCount="indefinite"/></g>' +
        '<circle r="5" fill="#ffffff" stroke="#c6d3dd" stroke-width="1.6"/></g>' +
        '<text x="0" y="58" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#6b7c8b">ветрогенератор</text>';
    } else {
      html = plate(122, 74, 'HAND CRANK', '#f07d20') +
        '<circle cx="0" cy="-4" r="20" fill="none" stroke="#dbe6ee" stroke-width="5"/>' +
        '<g id="hyCrankArm"><line x1="0" y1="-4" x2="0" y2="-24" stroke="#9fb0bd" stroke-width="4" stroke-linecap="round"/>' +
        '<circle cx="0" cy="-24" r="4.5" fill="#f07d20"/></g>' +
        '<circle cx="0" cy="-4" r="5" fill="#b9c8d4"/>' +
        '<text x="0" y="58" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#6b7c8b">кривошип</text>';
    }
    UI.html(g, html);
    spinCrank();
  }

  var crankAngle = 0;
  function spinCrank() {
    var arm = document.getElementById('hyCrankArm');
    if (!arm) return;
    crankAngle = (crankAngle + (st.source === 'crank' ? st.crankRpm * 0.06 : 0)) % 360;
    arm.setAttribute('transform', 'rotate(' + crankAngle.toFixed(1) + ' 0 -4)');
  }

  var lastLoadKey = '', lastCapKey = '';
  function drawLoad(f, force) {
    var on = f.mode === 'fuelcell' && f.fcV > 0.25 && st.loadOn;
    var key = st.load + '|' + (on ? 1 : 0) + '|' + Math.round(st.loadOhm);
    if (!force && key === lastLoadKey) return;
    lastLoadKey = key;
    var g = $('hyLoadGlyph'), html = '';
    if (st.load === 'led') {
      html = plate(104, 76, 'LED', '#f07d20') +
        '<circle r="24" fill="url(#hyGlowG)" opacity="' + (on ? Math.min(0.95, f.fcV) : 0) + '"/>' +
        '<circle cx="0" cy="-6" r="14" fill="' + (on ? '#ffd166' : '#e9eff4') + '" stroke="#b9c8d4" stroke-width="1.8"/>' +
        '<path d="M-9 -12 L-9 -2 M-4 -14 L-4 0 M1 -14 L1 0" stroke="' + (on ? '#f0a500' : '#c3d0db') + '" stroke-width="1.6"/>' +
        '<circle cx="0" cy="-6" r="14" fill="#ffe9a8" opacity="' + (on ? 0.45 : 0) + '"/>' +
        socket(-22, 16, '#c33b3b') + socket(22, 16, '#2b3a48') +
        '<text x="0" y="58" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#6b7c8b">светодиод</text>';
    } else if (st.load === 'fan') {
      var fast = on ? Math.max(0.22, 0.95 - f.fcV * 0.7) : 0;
      html = plate(104, 84, 'FAN', '#2ea3dc') +
        '<g transform="translate(0,-8)" opacity="' + (on ? 1 : 0.5) + '">' +
        '<path d="M0 0 C 11 -9 18 -2 4 4 Z" fill="#2ea3dc"/><path d="M0 0 C 9 11 2 17 -4 4 Z" fill="#2ea3dc"/>' +
        '<path d="M0 0 C -11 9 -18 2 -4 -4 Z" fill="#2ea3dc"/>' +
        (on ? '<animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="' + fast.toFixed(2) + 's" repeatCount="indefinite"/>' : '') +
        '</g>' +
        '<circle cx="0" cy="-8" r="4" fill="#ffffff" stroke="#b9c8d4" stroke-width="1.4"/>' +
        socket(-22, 16, '#c33b3b') + socket(22, 16, '#2b3a48') +
        '<text x="0" y="58" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#6b7c8b">вентилятор</text>';
    } else if (st.load === 'car') {
      html = plate(118, 78, 'CAR', '#1b3e8f') +
        '<g transform="translate(0,-6)">' +
        '<rect x="-38" y="-10" width="76" height="16" rx="3" fill="' + (on ? '#2ea3dc' : '#dbe6ee') + '" stroke="#b9c8d4" stroke-width="1.4"/>' +
        '<rect x="-22" y="-20" width="34" height="10" rx="3" fill="#f4f8fb" stroke="#b9c8d4" stroke-width="1.4"/>' +
        '<rect x="14" y="-18" width="22" height="8" rx="2" fill="#1f4a76" opacity=".85"/>' +
        '<circle cx="-22" cy="8" r="8" fill="#2b3a48"/><circle cx="-22" cy="8" r="3" fill="#cfdde7"/>' +
        '<circle cx="22" cy="8" r="8" fill="#2b3a48"/><circle cx="22" cy="8" r="3" fill="#cfdde7"/></g>' +
        '<text x="0" y="58" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#6b7c8b">машинка</text>';
    } else {
      html = plate(104, 74, 'RESISTOR', '#2b3a48') +
        '<rect x="-26" y="-14" width="52" height="22" rx="4" fill="#f4f8fb" stroke="#b9c8d4" stroke-width="1.6"/>' +
        '<path d="M-18 -3 h6 l3 -6 l4 12 l4 -12 l3 6 h6" fill="none" stroke="#2ea3dc" stroke-width="1.6"/>' +
        '<text x="0" y="20" text-anchor="middle" font-size="10.5" font-weight="700" font-family="sans-serif" fill="#22303c">' + Math.round(st.loadOhm) + ' Ом</text>' +
        socket(-26, -14, '#c33b3b') + socket(26, -14, '#2b3a48') +
        '<text x="0" y="58" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#6b7c8b">резистор (нагрузка)</text>';
    }
    UI.html(g, html);
  }

  function drawCap(f, force) {
    var key = st.cap + '|' + n(f.chem.v, 2) + '|' + n(f.chem.p * 1000, 0) + '|' + (f.chem.note || '');
    if (!force && key === lastCapKey) return;
    lastCapKey = key;
    var g = $('hyCapGlyph'), html = '';
    var c = f.chem;
    if (st.cap === 'none') {
      UI.html(g, '<rect x="-58" y="-30" width="116" height="66" rx="10" fill="none" stroke="#cbd8e2" stroke-width="1.6" stroke-dasharray="5 6"/>' +
        '<text x="0" y="0" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#9aa9b5">слот для модуля</text>' +
        '<text x="0" y="15" text-anchor="middle" font-size="9.5" font-family="sans-serif" fill="#b6c2cc">этанол · соль · термо</text>');
      return;
    }
    var title = { ethanol: 'этаноловый элемент', salt: 'солевой элемент', thermal: 'термоэлемент' }[st.cap];
    var lbl = { ethanol: 'ETHANOL CELL', salt: 'SALT WATER CELL', thermal: 'THERMAL CELL' }[st.cap];
    html = plate(120, 78, lbl, '#f07d20');
    if (st.cap === 'salt' || st.cap === 'ethanol') {
      html += '<rect x="-24" y="-24" width="20" height="34" rx="4" fill="#e7eff6" stroke="#b9c8d4" stroke-width="1.4"/>' +
        '<rect x="4" y="-24" width="20" height="34" rx="4" fill="#dfeaf2" stroke="#b9c8d4" stroke-width="1.4"/>' +
        '<rect x="-24" y="-4" width="48" height="14" rx="4" fill="url(#hyWaterG)" opacity=".85"/>' +
        '<text x="-14" y="-12" text-anchor="middle" font-size="8.5" font-family="sans-serif" fill="#7d8d9b">Mg</text>' +
        '<text x="14" y="-12" text-anchor="middle" font-size="8.5" font-family="sans-serif" fill="#7d8d9b">Cu</text>';
    } else {
      html += '<rect x="-30" y="-18" width="22" height="26" rx="4" fill="#ffd9c2" stroke="#f0b192" stroke-width="1.4"/>' +
        '<rect x="8" y="-18" width="22" height="26" rx="4" fill="#cfe6f5" stroke="#9dc4dd" stroke-width="1.4"/>' +
        '<path d="M-8 -6 H8" stroke="#b9c8d4" stroke-width="2"/>';
    }
    html += '<text x="0" y="26" text-anchor="middle" font-size="11" font-weight="700" font-family="sans-serif" fill="#22303c">' +
      n(c.v, 2) + ' В · ' + n(c.p * 1000, 0) + ' мВт</text>' +
      '<text x="0" y="58" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#6b7c8b">' + title + '</text>' +
      (c.note ? '<text x="0" y="73" text-anchor="middle" font-size="9" font-family="sans-serif" fill="#c2410c">' + esc(c.note) + '</text>' : '');
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
    UI.attr($('hyFlowIn'), 'opacity', f.powered ? 0.9 : 0);
    UI.attr($('hyFlowOut'), 'opacity', f.mode === 'fuelcell' && f.fcV > 0.2 ? 0.9 : 0);
    var fl = $('hyFlowIn'), fo = $('hyFlowOut');
    if (fl) {
      var dash = f.powered ? Math.max(0.25, 1.1 - f.elecI * 1.2).toFixed(2) + 's' : '0s';
      if (fl.dataset.sp !== dash) { fl.dataset.sp = dash; fl.style.animation = f.powered ? 'hyFlow ' + dash + ' linear infinite' : 'none'; }
      if (fo.dataset.sp !== dash) { fo.dataset.sp = dash; fo.style.animation = (f.mode === 'fuelcell' && f.fcV > 0.2) ? 'hyFlow ' + dash + ' linear infinite' : 'none'; }
    }
    // пузырьки в цилиндрах при электролизе
    var bub = $('hyBubbles');
    if (bub) {
      var want = f.powered ? 'on' : 'off';
      if (bub.dataset.state !== want) {
        bub.dataset.state = want;
        UI.attr(bub, 'opacity', f.powered ? 0.9 : 0);
        UI.html(bub, f.powered ? [-34, 58].map(function (bx) {
          return [0, 1, 2, 3].map(function (k) {
            return '<circle cx="' + (bx - 12 + (k % 2) * 34) + '" cy="0" r="' + (1.6 + (k % 2) * 0.9) + '" fill="#ffffff" opacity=".9">' +
              '<animate attributeName="cy" values="8;-30" dur="' + (1.4 + k * 0.35) + 's" repeatCount="indefinite"/>' +
              '<animate attributeName="opacity" values="0;.95;0" dur="' + (1.4 + k * 0.35) + 's" repeatCount="indefinite"/></circle>';
          }).join('');
        }).join('') : '');
      }
    }

    // показания на сцене
    var u = st.mode === 'electrolysis' ? f.elecV : f.fcV;
    var i = st.mode === 'electrolysis' ? f.elecI : f.fcI;
    UI.text($('hyMeterMain'), n(u, 2) + ' В');
    UI.text($('hyMeterSub'), n(i * 1000, 1) + ' мА');

    // панель показаний
    UI.text($('hyU'), n(u, 2));
    UI.text($('hyI'), n(i * 1000, 1));
    UI.text($('hyP'), st.mode === 'electrolysis' ? n(f.elecP * 1000, 0) + ' мВт' : n(f.loadP * 1000, 0) + ' мВт');
    UI.text($('hyGas'), n(f.h2Ml, 1) + ' мл');
    UI.text($('hyRate'), n(f.gasRate * 60, 2) + ' мл H₂/мин');
    UI.text($('hyPeak'), n(f.peakPower, 0) + ' мВт');
    var bar = $('hyTankBar');
    bar.style.width = Math.round(f.h2pct * 100) + '%';
    UI.text($('hyTankState'), f.h2pct > 0.95 ? 'полный' : (f.h2pct > 0.6 ? 'заряжен' : (f.h2pct > 0.03 ? 'мало газа' : 'пусто')));
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
      '<div class="glyph">' + (done ? '★'.repeat(done) : '◎') + '</div>' +
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
    f.chemKinds = chemKinds;
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
      spinCrank();
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
    lastKey = ''; lastLoadKey = ''; lastCapKey = '';
    renderControls(); renderTask(); renderMeasurements(); render(H.facts(st));
    log('ok', 'Стенд сброшен: баки пусты, источник — батарейный блок.');
  };
  $('hySample').onclick = sample;
  $('hyCsv').onclick = exportCsv;
  $('hyLogFold').onclick = function () {
    var bar = document.querySelector('#benchHydrogen .bottombar');
    var folded = bar.classList.toggle('collapsed');
    UI.text(this, folded ? 'Развернуть ▴' : 'Свернуть ▾');
    this.title = folded ? 'Развернуть журнал' : 'Свернуть журнал';
  };
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

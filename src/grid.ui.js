/* ============================================================
   Энерджиквантум · grid.ui.js
   Интерфейс стенда «Микросеть»: солнце + ветер + накопитель + сеть + зарядка EV
   ============================================================ */
(function () {
  'use strict';
  var G = window.Grid;
  if (!G || !document.getElementById('benchGrid')) return;

  var $ = function (id) { return document.getElementById(id); };
  var st = G.createState();
  var solved = {}, taskIndex = 0, playing = true, speed = 1;
  var lastTick = 0, taskTick = 0, meterTick = 0, lastKey = '';
  var meas = [];

  function n(v, d) { return Number(v || 0).toFixed(d === undefined ? 1 : d).replace('.', ','); }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function hhmm(h) {
    var hh = Math.floor(((h % 24) + 24) % 24), mm = Math.round((h - Math.floor(h)) * 60);
    if (mm === 60) { hh = (hh + 1) % 24; mm = 0; }
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }

  var css = document.createElement('style');
  UI.text(css, `
  .grid main{display:grid;grid-template-columns:252px minmax(430px,1fr) 330px;gap:10px;padding:10px;min-height:0}
  .grid .rctl{overflow:auto}
  .grid .fld{margin-bottom:9px;padding:0 9px}
  .grid .fld .top{display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);margin-bottom:3px}
  .grid .fld .top b{color:var(--ink);font-variant-numeric:tabular-nums}
  .grid .seg{display:flex;gap:2px;background:#e8eef5;border-radius:8px;padding:2px;margin:0 9px 8px}
  .grid .seg button{flex:1;padding:4px 2px;font-size:11px;border-radius:5px;color:var(--muted);white-space:nowrap}
  .grid .seg button.active{background:#fff;color:var(--accent);font-weight:700;box-shadow:0 1px 3px rgba(20,40,90,.16)}
  .grid .chk{display:flex;align-items:center;gap:7px;font-size:12px;padding:3px 9px}
  .grid .chk input{width:15px;height:15px;accent-color:var(--accent)}
  .gstage{position:relative;flex:1;min-height:0;border-radius:var(--r);border:1px solid #c4d0da;background:#f4f8fb;overflow:hidden}
  .gstage svg{width:100%;height:100%;display:block}
  .grid .bottombar.collapsed{height:36px!important;flex:0 0 36px}
  .grid .bottombar.collapsed .tabbody{display:none}
  .gridtable{width:100%;border-collapse:collapse;font-size:11px}
  .gridtable th,.gridtable td{padding:3px 8px;text-align:right;border-bottom:1px solid #eef2f6}
  .gridtable th{color:var(--muted);font-weight:600;position:sticky;top:0;background:#fff}
  .gridtable th:first-child,.gridtable td:first-child{text-align:left}
  .grid .ecom{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:9px}
  .grid .ecom .cell{background:#f6f9fc;border:1px solid #d7e2ec;border-radius:9px;padding:6px 8px}
  .grid .ecom .k{font-size:9.5px;letter-spacing:.4px;color:var(--muted);text-transform:uppercase}
  .grid .ecom .v{font-size:16px;font-weight:700;font-variant-numeric:tabular-nums}
  .grid .ecom .v small{font-size:10px;color:var(--muted);font-weight:600}
  @media (max-width:1180px){.grid main{grid-template-columns:226px minmax(360px,1fr) 300px}}
  @media (max-width:980px){.grid main{grid-template-columns:1fr}.gstage{min-height:380px}}
  @media (max-height:820px){.grid main{min-height:0}.gstage{min-height:280px;max-height:52vh}}
  `);
  document.head.appendChild(css);

  var main = $('benchGrid');
  main.className = 'grid';

  UI.html(main, `
    <aside class="panel rctl">
      <h2>Солнце</h2>
      <div class="fld"><div class="top"><span>Мощность панелей</span><b id="gPvV">3 кВт</b></div>
        <input type="range" id="gPv" min="0" max="8" step="0.5" value="3"></div>
      <div class="fld"><div class="top"><span>Наклон панели</span><b id="gTiltV">40°</b></div>
        <input type="range" id="gTilt" min="0" max="90" step="1" value="40"></div>
      <div class="fld"><div class="top"><span>Азимут (0 — юг)</span><b id="gAzV">0°</b></div>
        <input type="range" id="gAz" min="-90" max="90" step="5" value="0"></div>
      <div class="fld"><div class="top"><span>Облачность</span><b id="gCloudV">20 %</b></div>
        <input type="range" id="gCloud" min="0" max="100" step="5" value="20"></div>

      <h2>Ветер</h2>
      <div class="fld"><div class="top"><span>Номинал генератора</span><b id="gWindV">2 кВт</b></div>
        <input type="range" id="gWind" min="0" max="5" step="0.5" value="2"></div>
      <div class="fld"><div class="top"><span>Скорость ветра (10 м)</span><b id="gVrefV">6,0 м/с</b></div>
        <input type="range" id="gVref" min="0" max="24" step="0.5" value="6"></div>
      <div class="fld"><div class="top"><span>Высота оси</span><b id="gHubV">12 м</b></div>
        <input type="range" id="gHub" min="3" max="30" step="1" value="12"></div>

      <h2>Накопитель и нагрузка</h2>
      <div class="fld"><div class="top"><span>Ёмкость батареи</span><b id="gBattV">5 кВт·ч</b></div>
        <input type="range" id="gBatt" min="0" max="20" step="1" value="5"></div>
      <div class="fld"><div class="top"><span>Мощность батареи</span><b id="gBpV">2,5 кВт</b></div>
        <input type="range" id="gBp" min="0" max="6" step="0.5" value="2.5"></div>
      <div class="fld"><div class="top"><span>Базовый расход дома</span><b id="gBaseV">1,2 кВт</b></div>
        <input type="range" id="gBase" min="0.2" max="4" step="0.1" value="1.2"></div>

      <h2>Электромобиль</h2>
      <label class="chk"><input type="checkbox" id="gEvOn"> Зарядка включена</label>
      <div class="fld"><div class="top"><span>Мощность зарядки</span><b id="gEvPV">7 кВт</b></div>
        <input type="range" id="gEvP" min="1" max="11" step="1" value="7"></div>
      <div class="fld"><div class="top"><span>Окно зарядки</span><b id="gEvWinV">19:00–23:00</b></div>
        <input type="range" id="gEvStart" min="0" max="23" step="1" value="19">
        <input type="range" id="gEvEnd" min="1" max="24" step="1" value="23"></div>

      <h2>Режимы</h2>
      <label class="chk"><input type="checkbox" id="gIsland"> Островной режим (сеть отключена)</label>
      <label class="chk"><input type="checkbox" id="gGas"> Резервный генератор 1 кВт</label>
    </aside>

    <section class="stagewrap">
      <div class="timebar panel">
        <div class="grp" id="gSpeed">
          <button id="gPlay" title="Пауза / пуск">⏸</button>
          <button data-sp="1" class="active">×1</button>
          <button data-sp="4">×4</button>
          <button data-sp="12">×12</button>
        </div>
        <div class="clock">время: <b id="gClock">12:00</b></div>
        <div class="grow"></div>
        <button class="btn ghost" id="gReset">Сброс</button>
        <button class="btn primary" id="gSample">＋ Снять точку</button>
      </div>

      <div class="gstage" id="gStage">
        <svg id="gScene" viewBox="0 0 760 470" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="gSkyD" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#a9d4ee"/><stop offset="100%" stop-color="#f4f9fc"/>
            </linearGradient>
            <linearGradient id="gSkyN" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#1b2f52"/><stop offset="100%" stop-color="#33507a"/>
            </linearGradient>
            <linearGradient id="gGround" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#e9f0f6"/><stop offset="100%" stop-color="#dde7ef"/>
            </linearGradient>
            <linearGradient id="gPanelFace" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#122a4a"/><stop offset="55%" stop-color="#1f4a76"/><stop offset="100%" stop-color="#0e2340"/>
            </linearGradient>
            <radialGradient id="gSunGlow">
              <stop offset="0%" stop-color="#fff3c4" stop-opacity=".95"/><stop offset="100%" stop-color="#ffd166" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="gBattFillG" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stop-color="#2ea3dc"/><stop offset="100%" stop-color="#1b3e8f"/>
            </linearGradient>
            <pattern id="gGridP" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M20 0 H0 V20" fill="none" stroke="#dbe6ee" stroke-width="1"/>
            </pattern>
          </defs>

          <rect id="gSky" x="0" y="0" width="760" height="470" fill="url(#gSkyD)"/>
          <rect x="0" y="0" width="760" height="470" fill="url(#gGridP)" opacity=".35"/>
          <g id="gStars" opacity="0"></g>
          <circle id="gSunGlowC" cx="0" cy="0" r="64" fill="url(#gSunGlow)" opacity="0"/>
          <circle id="gSunDisc" cx="0" cy="0" r="20" fill="#ffd166" opacity="0"/>
          <g id="gClouds" opacity=".85"></g>
          <rect x="0" y="330" width="760" height="140" fill="url(#gGround)"/>
          <line x1="0" y1="330" x2="760" y2="330" stroke="#c6d3dd" stroke-width="2"/>

          <!-- дом с нагрузкой -->
          <g id="gGridHouse" transform="translate(120,232)">
            <rect x="-46" y="0" width="92" height="76" rx="6" fill="#ffffff" stroke="#c6d3dd" stroke-width="2"/>
            <path d="M-56 2 L0 -46 L56 2 Z" fill="#eef3f8" stroke="#c6d3dd" stroke-width="2"/>
            <rect id="gWin1" x="-32" y="16" width="26" height="22" rx="3" fill="#cfe3f2"/>
            <rect id="gWin2" x="6" y="16" width="26" height="22" rx="3" fill="#cfe3f2"/>
            <rect x="-16" y="46" width="32" height="30" rx="3" fill="#e3ebf2" stroke="#c6d3dd"/>
            <text id="gHouseP" x="0" y="96" text-anchor="middle" font-size="11" font-weight="700" fill="#22303c" font-family="sans-serif">0,0 кВт</text>
            <text x="0" y="112" text-anchor="middle" font-size="9.5" fill="#6b7c8b" font-family="sans-serif">дом</text>
          </g>

          <!-- солнечная панель -->
          <g id="gPvG" transform="translate(258,268)">
            <line x1="0" y1="46" x2="0" y2="66" stroke="#b9c8d4" stroke-width="5"/>
            <g id="gPvTilt">
              <rect x="-52" y="-30" width="104" height="60" rx="4" fill="url(#gPanelFace)" stroke="#0e2340" stroke-width="2"/>
              <g stroke="#5f9ec4" stroke-width="1" opacity=".6">
                <path d="M-26 -30 V30 M0 -30 V30 M26 -30 V30 M-52 0 H52"/>
              </g>
            </g>
            <text id="gPvTxt" x="0" y="86" text-anchor="middle" font-size="11" font-weight="700" fill="#22303c" font-family="sans-serif">0,0 кВт</text>
            <text x="0" y="102" text-anchor="middle" font-size="9.5" fill="#6b7c8b" font-family="sans-serif">солнечная панель</text>
          </g>

          <!-- ветрогенератор -->
          <g id="gWindG" transform="translate(388,300)">
            <line x1="0" y1="30" x2="0" y2="-70" stroke="#dbe6ee" stroke-width="6" stroke-linecap="round"/>
            <g transform="translate(0,-76)">
              <g id="gRotor">
                <path d="M0 0 C 8 -14 4 -38 -6 -44 C -2 -28 -3 -10 0 0 Z" fill="#2ea3dc"/>
                <path d="M0 0 C 8 -14 4 -38 -6 -44 C -2 -28 -3 -10 0 0 Z" fill="#2ea3dc" transform="rotate(120)"/>
                <path d="M0 0 C 8 -14 4 -38 -6 -44 C -2 -28 -3 -10 0 0 Z" fill="#2ea3dc" transform="rotate(240)"/>
              </g>
              <circle r="6" fill="#fff" stroke="#c6d3dd" stroke-width="1.6"/>
            </g>
            <text id="gWindTxt" x="0" y="48" text-anchor="middle" font-size="11" font-weight="700" fill="#22303c" font-family="sans-serif">0,0 кВт</text>
            <text id="gWindVv" x="0" y="64" text-anchor="middle" font-size="9.5" fill="#6b7c8b" font-family="sans-serif">6,0 м/с</text>
          </g>

          <!-- батарея -->
          <g id="gGridBatt" transform="translate(520,236)">
            <rect x="-34" y="0" width="68" height="78" rx="8" fill="#fff" stroke="#c6d3dd" stroke-width="2"/>
            <rect x="-12" y="-8" width="24" height="10" rx="3" fill="#dbe6ee" stroke="#c6d3dd" stroke-width="1.6"/>
            <rect id="gBattFill" x="-28" y="70" width="56" height="0" rx="6" fill="url(#gBattFillG)" style="transition:height .2s,y .2s"/>
            <text id="gSocTxt" x="0" y="-16" text-anchor="middle" font-size="11" font-weight="700" fill="#1b3e8f" font-family="sans-serif">50 %</text>
            <text id="gBattP" x="0" y="98" text-anchor="middle" font-size="11" font-weight="700" fill="#22303c" font-family="sans-serif">0,0 кВт</text>
            <text x="0" y="114" text-anchor="middle" font-size="9.5" fill="#6b7c8b" font-family="sans-serif">накопитель</text>
          </g>

          <!-- сеть -->
          <g id="gGridG" transform="translate(646,268)">
            <line x1="0" y1="72" x2="0" y2="-6" stroke="#b9c8d4" stroke-width="5"/>
            <line x1="-20" y1="-6" x2="20" y2="-6" stroke="#b9c8d4" stroke-width="5"/>
            <line x1="-14" y1="-24" x2="14" y2="-24" stroke="#b9c8d4" stroke-width="4"/>
            <line x1="0" y1="-40" x2="0" y2="-58" stroke="#b9c8d4" stroke-width="3"/>
            <text id="gGridTxt" x="0" y="92" text-anchor="middle" font-size="11" font-weight="700" fill="#22303c" font-family="sans-serif">0,0 кВт</text>
            <text id="gGridDir" x="0" y="108" text-anchor="middle" font-size="9.5" fill="#6b7c8b" font-family="sans-serif">сеть</text>
          </g>

          <!-- электромобиль -->
          <g id="gEvG" transform="translate(120,398)">
            <g id="gCar">
              <rect x="-44" y="-14" width="88" height="22" rx="6" fill="#2ea3dc" stroke="#1f4a76" stroke-width="1.6"/>
              <path d="M-24 -14 L-14 -28 L18 -28 L28 -14 Z" fill="#cfe3f2" stroke="#1f4a76" stroke-width="1.4"/>
              <circle cx="-24" cy="10" r="9" fill="#22303c"/><circle cx="-24" cy="10" r="3.5" fill="#dbe6ee"/>
              <circle cx="24" cy="10" r="9" fill="#22303c"/><circle cx="24" cy="10" r="3.5" fill="#dbe6ee"/>
            </g>
            <g id="gEvBolt" opacity="0">
              <path d="M-6 -46 L4 -46 L-2 -36 L8 -36 L-8 -18 L-2 -32 L-10 -32 Z" fill="#ffd166" stroke="#e0a300" stroke-width="1"/>
            </g>
            <text id="gEvTxt" x="0" y="34" text-anchor="middle" font-size="10" fill="#6b7c8b" font-family="sans-serif">электромобиль</text>
          </g>

          <!-- потоки энергии -->
          <path id="gFlowPv" d="M258 320 L170 300" stroke="#ffd166" stroke-width="4" stroke-dasharray="5 10" fill="none" opacity="0"/>
          <path id="gFlowWind" d="M388 320 L200 312" stroke="#2ea3dc" stroke-width="4" stroke-dasharray="5 10" fill="none" opacity="0"/>
          <path id="gFlowGrid" d="M646 330 L560 314" stroke="#8fa3b3" stroke-width="4" stroke-dasharray="5 10" fill="none" opacity="0"/>

          <!-- итоговое табло -->
          <g transform="translate(380,52)">
            <rect x="-176" y="-26" width="352" height="56" rx="10" fill="#ffffff" stroke="#d7e2ec" stroke-width="1.5" opacity=".95"/>
            <text id="gBalTxt" x="0" y="-2" text-anchor="middle" font-size="12" font-weight="700" fill="#1b3e8f" font-family="sans-serif">баланс: 0,0 кВт</text>
            <text id="gBalSub" x="0" y="17" text-anchor="middle" font-size="10" fill="#5d6f7d" font-family="sans-serif">выработка — нагрузка — накопитель</text>
          </g>
        </svg>
      </div>

      <div class="bottombar panel" style="height:132px">
        <div class="tabs">
          <button class="active" data-gtab="journal">Журнал</button>
          <button data-gtab="meas">Протокол <span id="gMeasCount" class="badge"></span></button>
          <div class="grow"></div>
          <button class="btn ghost tiny" id="gCsv" style="margin:4px 6px 4px 0">Экспорт CSV</button>
          <button class="btn ghost tiny" id="gLogFold" title="Свернуть журнал" style="margin:4px 6px 4px 0">Свернуть ▾</button>
        </div>
        <div class="tabbody" id="gTabJournal"><div class="journal" id="gJournal"></div></div>
        <div class="tabbody" id="gTabMeas" hidden></div>
      </div>
    </section>

    <aside class="right">
      <div class="card task">
        <h2>Задание <span class="badge" id="gTaskId">1 / 6</span></h2>
        <div class="body" id="gTaskBody"></div>
        <div class="tasklist" id="gTaskList"></div>
      </div>

      <div class="card">
        <h2>Показания прибора</h2>
        <div style="padding:9px 9px 0">
          <div class="lcd" style="text-align:center">
            <div class="cap"><span>баланс, кВт</span><span>АКБ, %</span></div>
            <div class="main" id="gLcdBal">0,00</div>
            <div class="sub" id="gLcdSoc">50</div>
          </div>
        </div>
        <div class="meters">
          <div class="meter accent"><div class="k"><span>Выработка</span><span>P</span></div>
            <div class="v" id="gGen">0 <small>кВт</small></div></div>
          <div class="meter"><div class="k"><span>Нагрузка</span><span>L</span></div>
            <div class="v" id="gLcdLoad">0 <small>кВт</small></div></div>
          <div class="meter"><div class="k"><span>Из сети</span><span>⇦</span></div>
            <div class="v" id="gImp">0 <small>кВт</small></div></div>
          <div class="meter"><div class="k"><span>В сеть</span><span>⇨</span></div>
            <div class="v" id="gExp">0 <small>кВт</small></div></div>
          <div class="meter wide"><div class="k"><span>Заряд АКБ</span><span id="gSocState">—</span></div>
            <div class="v" id="gSoc">50 <small>%</small></div>
            <div class="bar"><i id="gSocBar" style="width:50%"></i></div></div>
        </div>
        <div class="aux"><span>Ветер на оси: <b id="gVhub">—</b></span><span>Тариф: <b id="gPrice">—</b></span></div>
      </div>

      <div class="card">
        <h2>Сутки и экология</h2>
        <div class="ecom">
          <div class="cell"><div class="k">выработка</div><div class="v" id="gDayGen">0 <small>кВт·ч</small></div></div>
          <div class="cell"><div class="k">из сети</div><div class="v" id="gDayImp">0 <small>кВт·ч</small></div></div>
          <div class="cell"><div class="k">стоимость</div><div class="v" id="gDayCost">0 <small>₽</small></div></div>
          <div class="cell"><div class="k">CO₂</div><div class="v" id="gDayCo2">0 <small>кг</small></div></div>
        </div>
        <div class="aux"><span>Доля ВИЭ: <b id="gRenew">—</b></span><span>Своё потребление: <b id="gSelf">—</b></span></div>
        <div class="aux" style="padding-top:0"><span>Снижение CO₂: <b id="gCo2Cut">—</b></span><span>Пик вечером: <b id="gEve">—</b></span></div>
      </div>

      <div class="card">
        <h2>Сравнение с «только сеть»</h2>
        <div style="padding:4px 0"><table class="gridtable" id="gCompare"></table></div>
      </div>
    </aside>`);

  /* ---------- журнал ---------- */
  function log(kind, text) {
    st.log.push({ t: st.t, hour: st.hour, kind: kind, text: text });
    if (st.log.length > 300) st.log.shift();
    renderJournal();
  }
  function renderJournal() {
    var box = $('gJournal');
    if (!st.log.length) { UI.html(box, '<div class="empty-note">Меняйте настройки слева — всё попадёт в журнал.</div>'); return; }
    UI.html(box, st.log.slice(-80).map(function (r) {
      return '<div class="jrow ' + r.kind + '"><span class="tm">' + hhmm(r.hour) + '</span><span class="dot"></span><span class="tx">' + esc(r.text) + '</span></div>';
    }).join(''));
    var p = box.parentElement;
    p.scrollTop = p.scrollHeight;
  }

  function renderMeasurements() {
    var box = $('gTabMeas'), cnt = $('gMeasCount');
    if (cnt) cnt.textContent = meas.length ? String(meas.length) : '';
    if (!meas.length) { UI.html(box, '<div class="empty-note">Нажмите «Снять точку», чтобы записать режим сети.</div>'); return; }
    UI.html(box, '<table class="gridtable"><thead><tr><th>Время</th><th>Выраб.</th><th>Нагрузка</th><th>Из сети</th><th>В сеть</th><th>АКБ</th><th>%, АКБ</th></tr></thead><tbody>' +
      meas.slice().reverse().map(function (r) {
        return '<tr><td>' + hhmm(r.hour) + '</td><td>' + n(r.gen) + '</td><td>' + n(r.load) + '</td><td>' +
          n(r.imp) + '</td><td>' + n(r.exp) + '</td><td>' + n(r.batt) + '</td><td>' + Math.round(r.soc * 100) + '</td></tr>';
      }).join('') + '</tbody></table>');
  }

  function sample() {
    var f = G.facts(st);
    meas.push({ hour: st.hour, gen: f.gen, load: f.load, imp: f.gridImport, exp: f.gridExport,
      batt: f.batt, soc: f.soc, cloud: st.cloud, tilt: st.tilt,
      vWind: f.vWind, pv: f.pv, wind: f.wind, price: f.price });
    st.meas = meas;
    log('ok', 'Точка снята: выработка ' + n(f.gen) + ' кВт, нагрузка ' + n(f.load) + ' кВт, из сети ' + n(f.gridImport) + ' кВт');
    renderMeasurements();
    checkTask(false);
  }

  function exportCsv() {
    var lines = ['Время;Выработка,кВт;Нагрузка,кВт;Из сети,кВт;В сеть,кВт;АКБ,кВт;Заряд АКБ,%'];
    meas.forEach(function (r) {
      lines.push([hhmm(r.hour), n(r.gen, 2), n(r.load, 2), n(r.imp, 2), n(r.exp, 2), n(r.batt, 2), Math.round(r.soc * 100)].join(';'));
    });
    var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'microgrid-protocol.csv';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    log('ok', 'Протокол выгружен в CSV (' + meas.length + ' строк)');
  }

  /* ---------- элементы управления ---------- */
  var RANGES = {
    gPv: { set: function (v) { st.pvKwp = v; }, fmt: function (v) { return n(v, 1) + ' кВт'; } },
    gTilt: { set: function (v) { st.tilt = v; }, fmt: function (v) { return v + '°'; } },
    gAz: { set: function (v) { st.azimuth = v; }, fmt: function (v) { return v + '°'; } },
    gCloud: { set: function (v) { st.cloud = v / 100; }, fmt: function (v) { return v + ' %'; } },
    gWind: { set: function (v) { st.windRated = v; }, fmt: function (v) { return n(v, 1) + ' кВт'; } },
    gVref: { set: function (v) { st.windRef = v; }, fmt: function (v) { return n(v, 1) + ' м/с'; } },
    gHub: { set: function (v) { st.windHub = v; }, fmt: function (v) { return v + ' м'; } },
    gBatt: { set: function (v) { st.batteryKwh = v; }, fmt: function (v) { return v + ' кВт·ч'; } },
    gBp: { set: function (v) { st.batteryMaxP = v; }, fmt: function (v) { return n(v, 1) + ' кВт'; } },
    gBase: { set: function (v) { st.baseLoad = v; }, fmt: function (v) { return n(v, 1) + ' кВт'; } },
    gEvP: { set: function (v) { st.evPower = v; }, fmt: function (v) { return v + ' кВт'; } },
    gEvStart: { set: function (v) { st.evStart = v; }, fmt: null },
    gEvEnd: { set: function (v) { st.evEnd = v; }, fmt: null }
  };

  function syncControls() {
    Object.keys(RANGES).forEach(function (id) {
      var el = $(id);
      if (el) el.value = id === 'gCloud' ? Math.round(st.cloud * 100) : (RANGES[id].get ? RANGES[id].get() : evalValue(id));
    });
    syncLabels();
    $('gEvOn').checked = st.evOn;
    $('gIsland').checked = st.island;
    $('gGas').checked = st.gasOn;
  }
  function evalValue(id) {
    return ({
      gPv: st.pvKwp, gTilt: st.tilt, gAz: st.azimuth, gCloud: st.cloud * 100,
      gWind: st.windRated, gVref: st.windRef, gHub: st.windHub,
      gBatt: st.batteryKwh, gBp: st.batteryMaxP, gBase: st.baseLoad,
      gEvP: st.evPower, gEvStart: st.evStart, gEvEnd: st.evEnd
    })[id];
  }

  function syncLabels() {
    Object.keys(RANGES).forEach(function (id) {
      var el = $(id), out = $(id + 'V');
      if (!out || !el) return;
      var f = RANGES[id].fmt;
      if (f) UI.text(out, f(parseFloat(el.value)));
    });
    UI.text($('gEvWinV'), hhmm(st.evStart) + '–' + hhmm(st.evEnd));
  }

  Object.keys(RANGES).forEach(function (id) {
    var el = $(id);
    if (!el) return;
    el.oninput = function () {
      RANGES[id].set(parseFloat(el.value));
      syncLabels();
      lastKey = '';
      render(G.facts(st));
    };
    el.onchange = function () {
      log('info', 'Изменено: ' + id.replace('g', '') + ' → ' + el.value);
    };
  });
  $('gEvOn').onchange = function () { st.evOn = this.checked; log('info', this.checked ? 'Зарядка электромобиля включена' : 'Зарядка электромобиля выключена'); lastKey = ''; };
  $('gIsland').onchange = function () {
    st.island = this.checked;
    log(st.island ? 'warn' : 'ok', st.island ? 'Островной режим: сеть отключена' : 'Сеть подключена');
    lastKey = '';
  };
  $('gGas').onchange = function () { st.gasOn = this.checked; log('info', this.checked ? 'Резервный генератор включён (1 кВт)' : 'Резервный генератор выключен'); };

  (function () {
    var btns = document.querySelectorAll('#gSpeed button[data-sp]');
    [].forEach.call(btns, function (b) {
      b.onclick = function () {
        [].forEach.call(btns, function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        speed = +b.dataset.sp;
      };
    });
  })();

  $('gPlay').onclick = function () {
    playing = !playing;
    this.textContent = playing ? '⏸' : '▶';
  };
  $('gReset').onclick = function () {
    st = G.createState();
    meas.length = 0;
    lastKey = '';
    syncControls();
    renderTask(); renderMeasurements(); render(G.facts(st));
    log('ok', 'Стенд сброшен: 3 кВт панелей, 2 кВт ветра, батарея 5 кВт·ч.');
  };
  $('gSample').onclick = sample;
  $('gCsv').onclick = exportCsv;
  $('gLogFold').onclick = function () {
    var bar = document.querySelector('#benchGrid .bottombar');
    var folded = bar.classList.toggle('collapsed');
    UI.text(this, folded ? 'Развернуть ▴' : 'Свернуть ▾');
  };
  [].forEach.call(document.querySelectorAll('[data-gtab]'), function (b) {
    b.onclick = function () {
      [].forEach.call(document.querySelectorAll('[data-gtab]'), function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      var m = b.dataset.gtab === 'meas';
      $('gTabJournal').hidden = m;
      $('gTabMeas').hidden = !m;
    };
  });

  /* ---------- сцена ---------- */
  function drawSky(f) {
    var day = f.hour >= 6 && f.hour < 21;
    var s = G.sunPosition(st.dayOfYear, st.hour);
    var night = !day;
    UI.attr($('gSky'), 'fill', night ? 'url(#gSkyN)' : 'url(#gSkyD)');
    UI.attr($('gStars'), 'opacity', night ? 0.9 : 0);
    if (night && !$('gStars').childNodes.length) {
      var stars = '';
      for (var i = 0; i < 40; i++) {
        stars += '<circle cx="' + (Math.random() * 740 + 10).toFixed(0) + '" cy="' + (Math.random() * 200 + 10).toFixed(0) +
          '" r="' + (Math.random() * 1.2 + 0.5).toFixed(1) + '" fill="#eaf1ff" opacity="' + (0.4 + Math.random() * 0.6).toFixed(2) + '"/>';
      }
      UI.html($('gStars'), stars);
    }
    // солнце
    var vis = s.elevDeg > 0;
    var x = 380 + (s.azimuth) * 2.6, y = 250 - s.elevDeg * 2.9;
    UI.attr($('gSunDisc'), 'cx', x); UI.attr($('gSunDisc'), 'cy', y);
    UI.attr($('gSunGlowC'), 'cx', x); UI.attr($('gSunGlowC'), 'cy', y);
    var lit = vis ? Math.max(0.15, (1 - st.cloud)) * Math.min(1, s.elevDeg / 30) : 0;
    UI.attr($('gSunDisc'), 'opacity', vis ? 1 : 0);
    UI.attr($('gSunGlowC'), 'opacity', lit);
    // облака
    var key = st.cloud.toFixed(2) + '|' + night;
    if (lastKey.indexOf(key) < 0) {
      var cl = '';
      var n2 = Math.round(st.cloud * 6);
      for (var k = 0; k < n2; k++) {
        var cx = 90 + k * 120, cy = 70 + (k % 3) * 26;
        cl += '<g opacity="' + (0.5 + 0.5 * st.cloud).toFixed(2) + '"><ellipse cx="' + cx + '" cy="' + cy + '" rx="46" ry="17" fill="' +
          (night ? '#4a6588' : '#ffffff') + '"/><ellipse cx="' + (cx + 30) + '" cy="' + (cy + 6) + '" rx="32" ry="13" fill="' +
          (night ? '#4a6588' : '#f4f8fb') + '"/></g>';
      }
      UI.html($('gClouds'), cl);
    }
  }

  function render(f) {
    f = f || G.facts(st);
    drawSky(f);

    // панель: наклон
    var tiltNow = st.tilt;
    UI.attr($('gPvTilt'), 'transform', 'rotate(' + (-tiltNow * 0.30).toFixed(1) + ' 0 8)');
    UI.attr($('gPvG'), 'opacity', st.pvKwp > 0.01 ? 1 : 0.35);
    UI.text($('gPvTxt'), n(f.pv) + ' кВт');

    // ветряк: скорость вращения
    var dur = f.vWind > 0.5 ? Math.max(0.35, 2.6 / f.vWind).toFixed(2) : 0;
    var rotor = $('gRotor');
    if (Math.abs((rotor.dataset.dur || 0) - dur) > 0.02) {
      rotor.dataset.dur = dur;
      UI.html(rotor, dur === 0
        ? '<path d="M0 0 C 8 -14 4 -38 -6 -44 C -2 -28 -3 -10 0 0 Z" fill="#c6d3dd"/><path d="M0 0 C 8 -14 4 -38 -6 -44 C -2 -28 -3 -10 0 0 Z" fill="#c6d3dd" transform="rotate(120)"/><path d="M0 0 C 8 -14 4 -38 -6 -44 C -2 -28 -3 -10 0 0 Z" fill="#c6d3dd" transform="rotate(240)"/>'
        : '<g><path d="M0 0 C 8 -14 4 -38 -6 -44 C -2 -28 -3 -10 0 0 Z" fill="#2ea3dc"/><path d="M0 0 C 8 -14 4 -38 -6 -44 C -2 -28 -3 -10 0 0 Z" fill="#2ea3dc" transform="rotate(120)"/><path d="M0 0 C 8 -14 4 -38 -6 -44 C -2 -28 -3 -10 0 0 Z" fill="#2ea3dc" transform="rotate(240)"/>' +
        '<animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="' + dur + 's" repeatCount="indefinite"/></g>');
    }
    UI.attr($('gWindG'), 'opacity', st.windRated > 0.01 ? 1 : 0.35);
    UI.text($('gWindTxt'), n(f.wind) + ' кВт');
    UI.text($('gWindVv'), n(f.vWind, 1) + ' м/с');

    // батарея
    var h = Math.round(Math.max(0, Math.min(1, f.soc)) * 68);
    UI.attr($('gBattFill'), 'height', h);
    UI.attr($('gBattFill'), 'y', 70 - h);
    UI.text($('gSocTxt'), Math.round(f.soc * 100) + ' %');
    UI.text($('gBattP'), (f.batt >= 0 ? '+' : '−') + n(Math.abs(f.batt)) + ' кВт');

    // дом и сеть
    UI.text($('gHouseP'), n(f.load) + ' кВт');
    var litWin = f.load / Math.max(0.2, st.baseLoad) > 1.2;
    UI.attr($('gWin1'), 'fill', litWin ? '#ffe9a8' : '#cfe3f2');
    UI.attr($('gWin2'), 'fill', litWin ? '#ffe9a8' : '#cfe3f2');
    UI.text($('gGridTxt'), n(Math.max(f.gridImport, f.gridExport)) + ' кВт');
    UI.text($('gGridDir'), st.island ? 'сеть отключена' : (f.gridImport > 0.02 ? 'импорт из сети' : (f.gridExport > 0.02 ? 'отдача в сеть' : 'обмен ≈ 0')));

    // электромобиль
    var ev = st.evOn && G.evActive(st);
    UI.attr($('gCar'), 'opacity', st.evOn ? 1 : 0.4);
    UI.attr($('gEvBolt'), 'opacity', ev ? 1 : 0);
    UI.text($('gEvTxt'), st.evOn ? (ev ? 'зарядка ' + n(st.evPower, 0) + ' кВт' : 'ждёт окна ' + hhmm(st.evStart)) : 'выключен');

    // потоки
    UI.attr($('gFlowPv'), 'opacity', f.pv > 0.05 ? 0.85 : 0);
    UI.attr($('gFlowWind'), 'opacity', f.wind > 0.05 ? 0.85 : 0);
    UI.attr($('gFlowGrid'), 'opacity', (Math.abs(f.gridImport) + Math.abs(f.gridExport)) > 0.05 ? 0.8 : 0);

    // табло баланса
    var bal = f.gen - f.load + f.batt + f.gridImport - f.gridExport;
    UI.text($('gBalTxt'), (bal >= 0 ? 'профицит ' : 'дефицит ') + n(Math.abs(bal)) + ' кВт');
    UI.text($('gBalSub'), st.island ? 'островной режим — только своя выработка' :
      (f.gridImport > 0.02 ? 'недостаток покрывает сеть' : (f.gridExport > 0.02 ? 'излишек уходит в сеть' : 'баланс сходится')));
    UI.attr($('gBalTxt'), 'fill', bal >= -0.02 ? '#1f7a4d' : '#c2410c');

    // приборная панель
    UI.text($('gLcdBal'), n(f.gen - f.load, 2));
    UI.text($('gLcdSoc'), String(Math.round(f.soc * 100)));
    UI.text($('gGen'), n(f.gen) + ' кВт');
    UI.text($('gLcdLoad'), n(f.load) + ' кВт');
    UI.text($('gImp'), n(f.gridImport) + ' кВт');
    UI.text($('gExp'), n(f.gridExport) + ' кВт');
    UI.text($('gSoc'), Math.round(f.soc * 100) + ' %');
    $('gSocBar').style.width = Math.round(f.soc * 100) + '%';
    $('gSocBar').style.background = f.soc < 0.15 ? '#d64545' : (f.soc > 0.8 ? '#1f9d6b' : 'linear-gradient(90deg,#2ea3dc,#1b3e8f)');
    UI.text($('gSocState'), f.soc < 0.15 ? 'низкий' : (f.soc > 0.92 ? 'полный' : 'заряд'));
    UI.text($('gVhub'), n(f.vWind, 1) + ' м/с');
    UI.text($('gPrice'), n(f.price, 1) + ' ₽/кВт·ч');

    // сутки и экология
    UI.text($('gDayGen'), n(f.day.gen, 1) + ' кВт·ч');
    UI.text($('gDayImp'), n(f.day.gridImport, 1) + ' кВт·ч');
    UI.text($('gDayCost'), n(f.day.cost, 0) + ' ₽');
    UI.text($('gDayCo2'), n(f.day.co2, 1) + ' кг');
    UI.text($('gRenew'), Math.round(f.day.renewShare * 100) + ' %');
    UI.text($('gSelf'), Math.round(f.day.selfUse * 100) + ' %');
    UI.text($('gCo2Cut'), Math.round(f.co2Cut * 100) + ' %');
    UI.text($('gEve'), n(f.eveningImport, 2) + ' кВт·ч');
    UI.text($('gClock'), hhmm(st.hour));

    // сравнение
    UI.html($('gCompare'), '<thead><tr><th>Показатель</th><th>Сеть</th><th>Микросеть</th></tr></thead><tbody>' +
      [['Из сети, кВт·ч', n(f.base.gridImport, 1), n(f.day.gridImport, 1)],
       ['Стоимость, ₽', n(f.base.cost, 0), n(f.day.cost, 0)],
       ['CO₂, кг', n(f.co2Base, 1), n(f.day.co2, 1)],
       ['Нагрузка, кВт·ч', n(f.base.load, 1), n(f.day.load, 1)]].map(function (r) {
        return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td><b>' + r[2] + '</b></td></tr>';
      }).join('') + '</tbody>');
  }

  /* ---------- задания ---------- */
  function renderTask() {
    var tk = G.TASKS[taskIndex];
    var done = solved[taskIndex];
    UI.text($('gTaskId'), (taskIndex + 1) + ' / ' + G.TASKS.length);
    UI.html($('gTaskBody'),
      '<div class="glyph">' + (done ? '★'.repeat(done) : '◎') + '</div>' +
      '<div class="goal"><b>' + esc(tk.t) + '</b><br>' + esc(tk.goal) + '</div>' +
      '<ol class="steps">' + tk.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<div class="row" style="gap:6px;margin-top:6px">' +
      '<button class="btn ghost tiny" id="gHint">Подсказка</button>' +
      '<button class="btn primary tiny" id="gCheck">Проверить</button></div>' +
      '<div class="checkout" id="gCheckOut"></div>');
    UI.html($('gTaskList'), G.TASKS.map(function (t, i) {
      return '<button data-i="' + i + '" class="' + (i === taskIndex ? 'active ' : '') + (solved[i] ? 'done' : '') + '">' +
        '<span class="num">' + (solved[i] ? '★' : (i + 1)) + '</span><span>' + esc(t.t) + '</span></button>';
    }).join(''));
    $('gHint').onclick = function () {
      tk._h = tk._h || 0;
      var hint = tk.hints[tk._h % tk.hints.length];
      tk._h++;
      UI.html($('gCheckOut'), '<div class="hintline">💡 ' + esc(hint) + '</div>');
      log('info', 'Подсказка к заданию ' + (taskIndex + 1) + ': ' + hint);
    };
    $('gCheck').onclick = function () { checkTask(true); };
    [].forEach.call($('gTaskList').children, function (b) {
      b.onclick = function () { taskIndex = +b.dataset.i; renderTask(); };
    });
  }

  function checkTask(show) {
    var tk = G.TASKS[taskIndex], f = G.facts(st), was = !!solved[taskIndex];
    var ok = false;
    try { ok = tk.check(f); } catch (e) { ok = false; }
    if (ok && !was) {
      var stars = 1;
      try { stars = tk.stars(f) || 1; } catch (e) { stars = 1; }
      solved[taskIndex] = stars;
      log('ok', 'Задание выполнено: ' + tk.t + ' (' + stars + '★)');
      renderTask();
    } else if (show) {
      UI.html($('gCheckOut'), ok
        ? '<div class="okline">✓ Условие выполнено' + (tk.why ? '<br><span class="tiny muted">' + esc(tk.why) + '</span>' : '') + '</div>'
        : '<div class="badline">Пока не выполнено — сверьтесь с шагами и подсказкой.</div>');
    }
    return ok;
  }

  /* ---------- кадр ---------- */
  function frame(ts) {
    if (!lastTick) lastTick = ts;
    var dtReal = Math.min(0.1, (ts - lastTick) / 1000);
    lastTick = ts;
    if (window.__bench === 'grid') {
      if (playing) G.step(st, dtReal * speed / 600);   // 1 с ≈ 1 мин модельного времени при ×1
      render(G.facts(st));
      meterTick += dtReal;
      if (meterTick > 0.15) {
        meterTick = 0; taskTick += 0.15;
        if (taskTick > 1.2 && st.t > 5) { taskTick = 0; checkTask(false); }
      }
    }
    requestAnimationFrame(frame);
  }

  /* ---------- старт ---------- */
  syncControls();
  renderTask();
  renderMeasurements();
  render(G.facts(st));
  log('ok', 'Стенд «Микросеть»: 3 кВт панелей, ветряк 2 кВт, батарея 5 кВт·ч, нагрузка дома 1,2 кВт.');
  log('info', 'Задание 1 — сбалансировать сутки: выработка должна закрывать нагрузку в каждый момент.');
  requestAnimationFrame(frame);

  window.__grid = {
    state: function () { return st; },
    facts: function () { return G.facts(st); },
    sample: sample,
    solved: function () { return solved; },
    G: G
  };
})();

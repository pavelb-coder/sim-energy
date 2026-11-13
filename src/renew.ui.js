/* ============================================================
   Энерджиквантум · renew.ui.js
   Интерфейс стенда «Возобновляемая энергетика»
   ============================================================ */
(function () {
  'use strict';
  var R = window.Renew;
  if (!R || !document.getElementById('benchRenew')) return;
  window.__renInit = function () { init(); };
  function init() {

  var $ = function (id) { return document.getElementById(id); };
  var st = R.createState();
  st.measures = [];
  var run = { playing: true, speed: 1 };
  var solved = {}, taskIndex = 0, lastTick = 0, taskTick = 0, lastFacts = null;

  /* ---------- стили (добавляем один раз) ---------- */
  var css = document.createElement('style');
  css.textContent = `
  .renew main{display:grid;grid-template-columns:236px minmax(420px,1fr) 320px;gap:10px;padding:10px;min-height:0}
  .rctl{display:flex;flex-direction:column;min-height:0;overflow:auto}
  .rctl .grp{padding:9px 11px;border-bottom:1px solid var(--line)}
  .rctl .grp:last-child{border-bottom:0}
  .rctl .gl{font-size:10.5px;letter-spacing:.5px;text-transform:uppercase;color:var(--muted);margin-bottom:7px;font-weight:600}
  .rctl .fld{margin-bottom:9px}
  .rctl .fld .top{display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);margin-bottom:2px}
  .rctl .fld .top b{color:var(--ink);font-variant-numeric:tabular-nums}
  .rctl input[type=range]{width:100%}
  .rctl .seg{display:flex;gap:2px;background:#f2f6f9;border-radius:7px;padding:2px}
  .rctl .seg button{flex:1;padding:4px 0;font-size:11.5px;border-radius:5px;color:var(--muted)}
  .rctl .seg button.active{background:#fff;color:var(--accent);font-weight:700;box-shadow:0 1px 2px rgba(0,0,0,.08)}
  .rctl .chk{display:flex;align-items:center;gap:7px;font-size:12px;padding:4px 0;color:var(--ink)}
  .rctl .chk input{width:15px;height:15px;accent-color:var(--accent)}
  .rctl .chk span.pw{margin-left:auto;color:var(--muted);font-size:11px;font-variant-numeric:tabular-nums}

  .rstage{position:relative;flex:1;min-height:0;border-radius:var(--r);border:1px solid var(--line);overflow:hidden;
    box-shadow:inset 0 0 60px rgba(11,110,153,.04);background:#dbeaf6}
  .rstage svg{width:100%;height:100%;display:block}
  .rflow{stroke-dasharray:4 10;stroke-linecap:round}
  .rrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .chartbox{padding:6px 9px 9px}
  .chartbox svg{width:100%;height:132px;display:block}
  .legend{display:flex;gap:10px;font-size:10.5px;color:var(--muted);padding:0 9px 8px;flex-wrap:wrap}
  .legend i{display:inline-block;width:9px;height:3px;border-radius:2px;margin-right:4px;vertical-align:middle}
  .mtable{width:100%;border-collapse:collapse;font-size:11px}
  .mtable th,.mtable td{padding:3px 8px;text-align:right;border-bottom:1px solid #eef2f6}
  .mtable th{color:var(--muted);font-weight:600;position:sticky;top:0;background:#fff}
  .mtable th:first-child,.mtable td:first-child{text-align:left}
  @media (max-width:1180px){.renew main{grid-template-columns:210px minmax(360px,1fr) 290px}}
  @media (max-width:980px){.renew main{grid-template-columns:1fr}.rstage{min-height:420px}}
  `;
  document.head.appendChild(css);

  /* ---------- разметка стенда ---------- */
  var main = document.querySelector('#benchRenew');
  main.className = 'renew';
  main.innerHTML = `
    <aside class="panel rctl" id="rctl">
      <h2>Условия опыта</h2>
      <div class="grp">
        <div class="gl">Солнце и ветер</div>
        <div class="fld"><span class="top"><span>Время суток</span><b id="vHour">13:00</b></span>
          <input type="range" id="sHour" min="0" max="23.9" step="0.1" value="13"></div>
        <div class="fld"><span class="top"><span>Дата</span><b id="vDate">21 июня</b></span>
          <input type="range" id="sDay" min="1" max="365" step="1" value="172"></div>
        <div class="fld"><span class="top"><span>Облачность</span><b id="vCloud">ясно</b></span>
          <input type="range" id="sCloud" min="0" max="1" step="0.05" value="0"></div>
        <div class="fld"><span class="top"><span>Скорость ветра</span><b id="vWind">6,0 м/с</b></span>
          <input type="range" id="sWind" min="0" max="18" step="0.5" value="6"></div>
      </div>
      <div class="grp">
        <div class="gl">Панель и генератор</div>
        <div class="fld"><span class="top"><span>Наклон панели</span><b id="vTilt">0°</b></span>
          <input type="range" id="sTilt" min="0" max="90" step="1" value="0"></div>
        <div class="fld"><span class="top"><span>Азимут панели</span><b id="vAz">−55°</b></span>
          <input type="range" id="sAz" min="-90" max="90" step="5" value="-55"></div>
        <div class="fld"><span class="top"><span>Число лопастей</span></span>
          <div class="seg" id="segBlades">
            <button data-blades="2">2</button><button data-blades="3" class="active">3</button><button data-blades="5">5</button>
          </div></div>
        <div class="fld"><span class="top"><span>Контроллер заряда</span></span>
          <div class="seg" id="segCtrl">
            <button data-ctrl="pwm">PWM</button><button data-ctrl="mppt" class="active">MPPT</button>
          </div></div>
      </div>
      <div class="grp">
        <div class="gl">Нагрузка</div>
        <label class="chk"><input type="checkbox" id="loadLamp" checked>Лампа<span class="pw">10 Вт</span></label>
        <label class="chk"><input type="checkbox" id="loadPump">Насос<span class="pw">40 Вт</span></label>
        <label class="chk"><input type="checkbox" id="loadRouter">Роутер<span class="pw">8 Вт</span></label>
        <div class="fld" style="margin-top:8px"><span class="top"><span>Ёмкость АКБ</span><b id="vCap">200 Вт·ч</b></span>
          <input type="range" id="sCap" min="50" max="1000" step="50" value="200"></div>
      </div>
    </aside>

    <section class="stagewrap">
      <div class="timebar panel">
        <div class="grp" role="group" aria-label="Время">
          <button id="rPlay" title="Пауза / пуск">⏸</button>
          <button data-rspeed="1" class="active">×1</button>
          <button data-rspeed="2">×2</button>
          <button data-rspeed="4">×4</button>
        </div>
        <div class="clock">t = <b id="rClock">13:00</b></div>
        <button class="btn ghost" id="rNoon" title="Перейти к полудню">Полдень</button>
        <div class="grow"></div>
        <button class="btn" id="btnDay" title="Посчитать энергию за 24 часа при текущих настройках">Прогнать сутки</button>
        <button class="btn primary" id="btnSample">＋ Снять показания</button>
      </div>

      <div class="rstage" id="rStage">
        <svg id="rScene" viewBox="0 0 800 460" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="skyDay" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#8fc6ea"/><stop offset="100%" stop-color="#e7f3fb"/>
            </linearGradient>
            <linearGradient id="skyNight" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#16283d"/><stop offset="100%" stop-color="#264a68"/>
            </linearGradient>
            <radialGradient id="sunGlow"><stop offset="0%" stop-color="#fff3c4" stop-opacity=".95"/>
              <stop offset="100%" stop-color="#ffd166" stop-opacity="0"/></radialGradient>
            <linearGradient id="panelFace" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#1b4f72"/><stop offset="55%" stop-color="#2d7096"/><stop offset="100%" stop-color="#1b4f72"/>
            </linearGradient>
            <linearGradient id="battFill" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stop-color="#7ed0a8"/><stop offset="100%" stop-color="#1f9d6b"/>
            </linearGradient>
          </defs>
          <rect id="sky" x="0" y="0" width="800" height="460" fill="url(#skyDay)"/>
          <g id="clouds"></g>
          <circle id="sunGlowC" cx="0" cy="0" r="70" fill="url(#sunGlow)" opacity="0"/>
          <circle id="sunDisc" cx="0" cy="0" r="22" fill="#ffd166" opacity="0"/>
          <g id="sunRays" opacity="0"></g>
          <line id="horizon" x1="0" y1="372" x2="800" y2="372" stroke="#b7cbd9" stroke-width="2"/>
          <rect x="0" y="372" width="800" height="88" fill="#e6eef4"/>

          <g id="gPanel" transform="translate(215,300)">
            <line x1="0" y1="52" x2="0" y2="72" stroke="#6b7d8c" stroke-width="5"/>
            <g id="panelTilt">
              <rect id="panelRect" x="-70" y="-46" width="140" height="92" rx="4" fill="url(#panelFace)" stroke="#123c56" stroke-width="2"/>
              <g stroke="#79b4d4" stroke-width="1.2" opacity=".85">
                <line x1="-70" y1="-23" x2="70" y2="-23"/><line x1="-70" y1="0" x2="70" y2="0"/><line x1="-70" y1="23" x2="70" y2="23"/>
                <line x1="-35" y1="-46" x2="-35" y2="46"/><line x1="0" y1="-46" x2="0" y2="46"/><line x1="35" y1="-46" x2="35" y2="46"/>
              </g>
            </g>
            <text x="0" y="88" text-anchor="middle" font-size="11" fill="#5a6772" font-family="sans-serif">панель 100 Вт</text>
          </g>

          <g id="gTurb" transform="translate(450,296)">
            <path d="M-6 72 L6 72 L4 -60 L-4 -60 Z" fill="#dfe8ee" stroke="#a9bcc9" stroke-width="1.5"/>
            <g id="rotor" transform="translate(0,-62)">
              <circle cx="0" cy="0" r="7" fill="#7a8fa0"/>
              <g id="blades">
                <path d="M0 0 L-6 -72 L6 -72 Z" fill="#f2f6f9" stroke="#9fb4c4" stroke-width="1.4"/>
                <path d="M0 0 L-6 -72 L6 -72 Z" fill="#f2f6f9" stroke="#9fb4c4" stroke-width="1.4" transform="rotate(120)"/>
                <path d="M0 0 L-6 -72 L6 -72 Z" fill="#f2f6f9" stroke="#9fb4c4" stroke-width="1.4" transform="rotate(240)"/>
              </g>
              <circle cx="0" cy="0" r="4" fill="#33475a"/>
            </g>
            <text x="0" y="88" text-anchor="middle" font-size="11" fill="#5a6772" font-family="sans-serif">ветрогенератор</text>
          </g>

          <g id="gHouse" transform="translate(620,300)">
            <path d="M-46 32 L-46 -12 L0 -48 L46 -12 L46 32 Z" fill="#f7fafc" stroke="#a9bcc9" stroke-width="2"/>
            <rect id="win" x="-16" y="-6" width="32" height="24" rx="2" fill="#cfe3ee" stroke="#a9bcc9"/>
            <circle id="lampGlow" cx="0" cy="6" r="30" fill="#ffd166" opacity="0"/>
            <text x="0" y="56" text-anchor="middle" font-size="11" fill="#5a6772" font-family="sans-serif">потребители</text>
          </g>

          <g id="gBatt" transform="translate(560,406)">
            <rect x="-34" y="-20" width="68" height="34" rx="5" fill="#fff" stroke="#7a8fa0" stroke-width="2"/>
            <rect x="-6" y="-26" width="12" height="6" rx="2" fill="#7a8fa0"/>
            <rect id="battFill" x="-30" y="-16" width="60" height="26" rx="3" fill="url(#battFill)"/>
            <text id="battTxt" x="0" y="30" text-anchor="middle" font-size="11" fill="#5a6772" font-family="sans-serif">АКБ 35 %</text>
          </g>

          <g id="flows">
            <path id="flowPV" d="M215 332 C 300 356 370 384 416 396" fill="none" stroke="#f2a93b" stroke-width="3" class="rflow" opacity="0"/>
            <path id="flowWT" d="M450 318 C 450 356 500 380 528 396" fill="none" stroke="#3aa0c9" stroke-width="3" class="rflow" opacity="0"/>
            <path id="flowLoad" d="M592 396 C 616 386 618 352 620 330" fill="none" stroke="#8f6bd0" stroke-width="3" class="rflow" opacity="0"/>
          </g>
          <g id="warnText" opacity="0">
            <rect x="300" y="16" width="200" height="26" rx="7" fill="#fff4e5" stroke="#f2cf9e"/>
            <text x="400" y="33" text-anchor="middle" font-size="11.5" fill="#8a5a00" font-family="sans-serif" id="warnLabel"></text>
          </g>
        </svg>
      </div>

      <div class="bottombar panel">
        <div class="tabs">
          <button class="active" data-rtab="journal">Журнал</button>
          <button data-rtab="meas">Протокол <span id="rMeasCount" class="badge"></span></button>
          <div class="grow"></div>
          <button class="btn ghost tiny" id="rCsv" style="margin:4px 6px 4px 0">Экспорт CSV</button>
        </div>
        <div class="tabbody" id="rTabJournal"><div class="journal" id="rJournal"></div></div>
        <div class="tabbody" id="rTabMeas" hidden></div>
      </div>
    </section>

    <aside class="right">
      <div class="card task" id="rTaskCard">
        <h2>Задание <span class="badge" id="rTaskId">1 / 6</span></h2>
        <div class="body" id="rTaskBody"></div>
        <div class="tasklist" id="rTaskList"></div>
      </div>

      <div class="card">
        <h2>Мощности</h2>
        <div class="meters">
          <div class="meter accent"><div class="k"><span>Солнце</span><span>PV</span></div>
            <div class="v" id="rPV">0 <small>Вт</small></div></div>
          <div class="meter"><div class="k"><span>Ветер</span><span>WT</span></div>
            <div class="v" id="rWT">0 <small>Вт</small></div></div>
          <div class="meter"><div class="k"><span>Нагрузка</span><span>P</span></div>
            <div class="v" id="rLoad">0 <small>Вт</small></div></div>
          <div class="meter"><div class="k"><span>Баланс</span><span>Δ</span></div>
            <div class="v" id="rNet">0 <small>Вт</small></div></div>
          <div class="meter wide" id="rSocBox"><div class="k"><span>Заряд АКБ</span><span id="rSocState">—</span></div>
            <div class="v" id="rSoc">35 <small>%</small></div>
            <div class="bar"><i id="rSocBar" style="width:35%"></i></div></div>
        </div>
        <div class="aux">
          <span>Освещённость: <b id="rG">0</b></span>
          <span>Высота солнца: <b id="rElev">0°</b></span>
        </div>
        <div class="aux">
          <span>Выработано: <b id="rGen">0</b></span>
          <span>Потреблено: <b id="rUse">0</b></span>
        </div>
      </div>

      <div class="card">
        <h2>Выработка за сутки</h2>
        <div class="chartbox"><svg id="rChart" viewBox="0 0 300 132" preserveAspectRatio="none"></svg></div>
        <div class="legend">
          <span><i style="background:#f2a93b"></i>солнце</span>
          <span><i style="background:#3aa0c9"></i>ветер</span>
          <span><i style="background:#8f6bd0"></i>нагрузка</span>
        </div>
        <div class="aux" style="padding:0 9px 9px">
          <span>За сутки: <b id="rDayGen">—</b></span>
          <span>Расход: <b id="rDayUse">—</b></span>
        </div>
      </div>
    </aside>`;

  /* ---------- инициализация управления ---------- */
  function pct(v, d) { return v.toFixed(d === undefined ? 1 : d).replace('.', ','); }
  function fmtW(v) { return v < 100 ? pct(v, 1) : Math.round(v) + ''; }

  function bindRange(id, key, after) {
    var el = $(id);
    el.addEventListener('input', function () {
      st[key] = parseFloat(el.value);
      if (after) after();
      renderControls();
      renderChart();
    });
  }
  function renderControls() {
    $('vHour').textContent = timeText(st.hour);
    $('vDate').textContent = dateText(st.day);
    $('vCloud').textContent = st.cloud < 0.08 ? 'ясно' : (st.cloud < 0.45 ? 'переменная' : (st.cloud < 0.8 ? 'облачно' : 'пасмурно'));
    $('vWind').textContent = pct(st.wind, 1) + ' м/с';
    $('vTilt').textContent = st.tilt + '°';
    $('vAz').textContent = (st.azimuth > 0 ? '+' : (st.azimuth < 0 ? '−' : '')) + Math.abs(st.azimuth) + '°';
    $('vCap').textContent = st.capacity + ' Вт·ч';
    [].forEach.call($('segBlades').children, function (b) { b.classList.toggle('active', +b.dataset.blades === st.blades); });
    [].forEach.call($('segCtrl').children, function (b) { b.classList.toggle('active', b.dataset.ctrl === st.controller); });
    $('loadLamp').checked = st.loads.lamp;
    $('loadPump').checked = st.loads.pump;
    $('loadRouter').checked = st.loads.router;
  }
  function timeText(h) {
    var hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    if (mm === 60) { mm = 0; hh = (hh + 1) % 24; }
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }
  function dateText(d) {
    var months = [['января', 31], ['февраля', 28], ['марта', 31], ['апреля', 30], ['мая', 31], ['июня', 30],
      ['июля', 31], ['августа', 31], ['сентября', 30], ['октября', 31], ['ноября', 30], ['декабря', 31]];
    var rest = d, i = 0;
    while (i < 12 && rest > months[i][1]) { rest -= months[i][1]; i++; }
    var day = Math.max(1, Math.min(months[Math.min(i, 11)][1], rest));
    return day + ' ' + months[Math.min(i, 11)][0];
  }

  bindRange('sHour', 'hour', function () { st.socMin = st.soc; });
  bindRange('sDay', 'day');
  bindRange('sCloud', 'cloud');
  bindRange('sWind', 'wind');
  bindRange('sTilt', 'tilt');
  bindRange('sAz', 'azimuth');
  bindRange('sCap', 'capacity');
  $('segBlades').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    st.blades = +b.dataset.blades; renderControls(); renderChart();
    log('ok', 'Лопастей: ' + st.blades + ' (Cp = ' + R.CP_BY_BLADES[st.blades] + ')');
  });
  $('segCtrl').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    st.controller = b.dataset.ctrl; renderControls();
    log('ok', 'Контроллер заряда: ' + (st.controller === 'mppt' ? 'MPPT' : 'PWM'));
  });
  ['lamp', 'pump', 'router'].forEach(function (k) {
    $('load' + k.charAt(0).toUpperCase() + k.slice(1)).addEventListener('change', function (e) {
      st.loads[k] = e.target.checked;
      log('ok', (R.LOADS[k].name) + ' ' + (e.target.checked ? 'включён' : 'выключен') + ' · ' + R.LOADS[k].power + ' Вт');
    });
  });
  $('rPlay').onclick = function () {
    run.playing = !run.playing;
    this.textContent = run.playing ? '⏸' : '▶';
  };
  [].forEach.call(document.querySelectorAll('[data-rspeed]'), function (b) {
    b.onclick = function () {
      run.speed = +b.dataset.rspeed;
      [].forEach.call(document.querySelectorAll('[data-rspeed]'), function (x) { x.classList.toggle('active', x === b); });
    };
  });
  $('rNoon').onclick = function () {
    st.hour = 12.6; $('sHour').value = 12.6; st.socMin = st.soc;
    renderControls(); renderChart(); log('ok', 'Время переведено на полдень');
  };

  /* ---------- журнал и протокол ---------- */
  function log(kind, text) {
    st.log.push({ t: st.t, hour: st.hour, kind: kind, text: text });
    if (st.log.length > 300) st.log.shift();
    renderJournal();
  }
  function renderJournal() {
    var box = $('rJournal');
    if (!st.log.length) { box.innerHTML = '<div class="empty-note">Меняйте условия опыта слева — действия будут записываться сюда.</div>'; return; }
    box.innerHTML = st.log.slice(-90).map(function (r) {
      return '<div class="jrow ' + r.kind + '"><span class="tm">' + timeText(r.hour !== undefined ? r.hour : (r.t % 24)) + '</span><span class="dot"></span>' +
        '<span class="tx">' + String(r.text).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }) + '</span></div>';
    }).join('');
    box.parentElement.scrollTop = box.parentElement.scrollHeight;
  }

  function sample() {
    var f = facts();
    var rec = {
      t: st.t, hour: st.hour, day: st.day, cloud: st.cloud, tilt: st.tilt, azimuth: st.azimuth,
      G: f.G, pv: f.pv, v: st.wind, wt: f.wt, load: f.load, soc: st.soc
    };
    st.measures.push(Object.assign({ kind: 'pv' }, rec));
    st.measures.push(Object.assign({ kind: 'wind', p: f.wt, blades: st.blades }, rec));
    log('ok', 'Показания: G = ' + Math.round(f.G) + ' Вт/м² · PV = ' + fmtW(f.pv) + ' Вт · ветер ' +
      pct(st.wind, 1) + ' м/с → ' + fmtW(f.wt) + ' Вт · АКБ ' + Math.round(st.soc * 100) + ' %');
    renderMeasurements();
    checkTask(false);
  }

  function runDay() {
    var d = R.dayEnergy(st);
    var sim = R.simulateDay(st);
    st.measures.push({
      kind: 'day', t: st.t, day: st.day, cloud: st.cloud, tilt: st.tilt, azimuth: st.azimuth,
      controller: st.controller, gen: d.gen, pvGen: d.pvGen, wtGen: d.wtGen, use: d.use,
      socMin: sim.socMin, capacity: st.capacity
    });
    log(d.gen >= d.use ? 'ok' : 'warn', 'Прогон суток (' + dateText(st.day) + ', ' +
      (st.controller === 'mppt' ? 'MPPT' : 'PWM') + '): выработано ' + Math.round(d.gen) +
      ' Вт·ч (солнце ' + Math.round(d.pvGen) + ', ветер ' + Math.round(d.wtGen) + '), расход ' + Math.round(d.use) +
      ' Вт·ч, минимум АКБ ' + Math.round(sim.socMin * 100) + ' %');
    renderMeasurements();
    checkTask(false);
    toast('Прогон суток: ' + Math.round(d.gen) + ' Вт·ч выработано, ' + Math.round(d.use) + ' Вт·ч израсходовано');
  }

  function renderMeasurements() {
    var box = $('rTabMeas');
    $('rMeasCount').textContent = st.measures.length || '';
    var rows = st.measures.filter(function (m) { return m.kind !== 'wind'; }).slice(-60).reverse();
    if (!rows.length) { box.innerHTML = '<div class="empty-note">Пока нет данных. Нажмите «Снять показания» или «Прогнать сутки».</div>'; return; }
    box.innerHTML = '<table class="mtable"><thead><tr><th>Что</th><th>Условия</th><th>G, Вт/м²</th><th>PV, Вт</th>' +
      '<th>Ветер, м/с</th><th>WT, Вт</th><th>Нагрузка, Вт</th><th>АКБ, %</th></tr></thead><tbody>' +
      rows.map(function (m) {
        if (m.kind === 'day') {
          return '<tr><td>Сутки</td><td style="text-align:left">' + dateText(m.day) + ' · ' +
            (m.controller === 'mppt' ? 'MPPT' : 'PWM') + '</td><td colspan="4" style="text-align:left">' +
            'выработка ' + Math.round(m.gen) + ' Вт·ч (солнце ' + Math.round(m.pvGen) + ', ветер ' + Math.round(m.wtGen) + ')</td>' +
            '<td>' + Math.round(m.use) + '</td><td>' + Math.round(m.socMin * 100) + '</td></tr>';
        }
        return '<tr><td>Точка</td><td style="text-align:left">' + timeText(m.hour) + ' · ' + dateText(m.day) + '</td><td>' +
          Math.round(m.G) + '</td><td>' + fmtW(m.pv) + '</td><td>' + pct(m.v, 1) + '</td><td>' + fmtW(m.wt) + '</td><td>' +
          fmtW(m.load) + '</td><td>' + Math.round(m.soc * 100) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function exportCsv() {
    if (!st.measures.length) { toast('Протокол пуст'); return; }
    var lines = ['Тип;Время;Дата;Облачность;Наклон;Азимут;G,Вт/м2;PV,Вт;Ветер,м/с;WT,Вт;Нагрузка,Вт;АКБ,%'];
    st.measures.filter(function (m) { return m.kind !== 'wind'; }).forEach(function (m) {
      lines.push([m.kind === 'day' ? 'сутки' : 'точка', timeText(m.hour), dateText(m.day),
        pct(m.cloud, 2), m.tilt, m.azimuth, Math.round(m.G || 0), pct(m.pv || 0, 1),
        pct(m.v || 0, 1), pct(m.wt || 0, 1), fmtW(m.load || m.use || 0),
        Math.round((m.soc !== undefined ? m.soc : m.socMin) * 100)].join(';'));
    });
    var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'протокол-виэ.csv';
    document.body.appendChild(a); a.click(); a.remove();
    log('ok', 'Протокол выгружен в CSV');
  }

  [].forEach.call(document.querySelectorAll('.tabs button[data-rtab]'), function (b) {
    b.onclick = function () {
      [].forEach.call(document.querySelectorAll('.tabs button[data-rtab]'), function (x) { x.classList.toggle('active', x === b); });
      $('rTabJournal').hidden = b.dataset.rtab !== 'journal';
      $('rTabMeas').hidden = b.dataset.rtab !== 'meas';
    };
  });

  /* ---------- задания ---------- */
  function facts() { return lastFacts || R.facts(st); }

  function renderTask() {
    var tk = R.TASKS[taskIndex];
    var done = solved[taskIndex];
    $('rTaskId').textContent = (taskIndex + 1) + ' / ' + R.TASKS.length;
    $('rTaskBody').innerHTML =
      '<div class="goal"><b>' + tk.t + '</b><br>' + tk.goal + '</div>' +
      '<ol>' + tk.steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' +
      (done ? '<div class="result ok"><span class="stars">' + '★★★'.slice(0, done) + '</span><br>' + tk.why + '</div>' : '') +
      '<div class="hints">' + (tk._hints || []).map(function (h, i) { return '<div class="hint">Подсказка ' + (i + 1) + ': ' + h + '</div>'; }).join('') + '</div>' +
      '<div style="display:flex;gap:6px;margin-top:9px;flex-wrap:wrap">' +
      '<button class="btn" id="rHint">Подсказка</button>' +
      '<button class="btn primary" id="rCheck">Проверить</button></div>' +
      '<div id="rCheckOut"></div>';
    $('rTaskList').innerHTML = R.TASKS.map(function (t, i) {
      return '<button data-i="' + i + '" class="' + (i === taskIndex ? 'active ' : '') + (solved[i] ? 'done' : '') + '">' +
        '<span class="num">' + (solved[i] ? '★' : (i + 1)) + '</span><span>' + t.t + '</span></button>';
    }).join('');
    [].forEach.call($('rTaskList').children, function (b) {
      b.onclick = function () { taskIndex = +b.dataset.i; renderTask(); };
    });
    $('rHint').onclick = function () {
      var t2 = R.TASKS[taskIndex];
      t2._hints = t2._hints || [];
      if (t2._hints.length < t2.hints.length) { t2._hints.push(t2.hints[t2._hints.length]); renderTask(); }
      else toast('Подсказки закончились');
    };
    $('rCheck').onclick = function () {
      var ok = checkTask(true);
      if (!ok) {
        var out = $('rCheckOut');
        var f = facts();
        out.innerHTML = '<div class="result bad">Пока не выполнено. ' +
          (R.TASKS[taskIndex].t.indexOf('Навести') === 0 ? 'Сейчас ' + Math.round(f.pvRatio * 100) + ' % от максимума (нужно ≥ 90 %).'
            : R.TASKS[taskIndex].t.indexOf('Солнце и облака') === 0 ? 'Точек с разной облачностью: ' + distinctClouds(f) + ' из 3.'
            : R.TASKS[taskIndex].t.indexOf('Куб') === 0 ? 'Измерений ветра: ' + f.windMeasure.length + ' из 3, отношение P(высок.)/P(низк.) = ' + pct(f.windRatio, 1) + ' (нужно 6…10).'
            : R.TASKS[taskIndex].t.indexOf('MPPT') === 0 ? 'Прогонов суток: ' + f.dayRuns.length + ' (нужно минимум по одному с PWM и MPPT).'
            : R.TASKS[taskIndex].t.indexOf('Автономные') === 0 ? 'Нагрузка ' + f.load + ' Вт, минимум АКБ ' + Math.round(f.sim.socMin * 100) + ' % (нужно ≥ 20 %), выработка ' + Math.round(f.day.gen) + ' / расход ' + Math.round(f.day.use) + ' Вт·ч.'
            : 'Прогонов суток: ' + f.seasonRuns.length + ' (нужны и летние, и зимние).') + '</div>';
      }
    };
  }
  function distinctClouds(f) {
    var c = {};
    f.measures.filter(function (m) { return m.kind === 'pv'; }).forEach(function (m) { c[Math.round(m.cloud * 10)] = 1; });
    return Object.keys(c).length;
  }
  function checkTask(show) {
    var tk = R.TASKS[taskIndex];
    var f = facts();
    var was = !!solved[taskIndex];
    var ok = false;
    try { ok = tk.check(f); } catch (e) { ok = false; }
    if (ok && !was) {
      var stars = 1;
      try { stars = tk.stars(f) || 1; } catch (e) {}
      solved[taskIndex] = stars;
      log('ok', 'Задание выполнено: ' + tk.t + ' (' + stars + '★)');
      renderTask();
    } else if (ok && show) {
      renderTask();
    }
    return ok;
  }

  /* ---------- график суток ---------- */
  function renderChart() {
    var prof = R.dayProfile(st);
    var maxV = 1;
    prof.forEach(function (p) { maxV = Math.max(maxV, p.pv + p.wt, p.load); });
    var W = 300, H = 132, pad = 16;
    function x(h) { return pad + (h / 24) * (W - pad - 6); }
    function y(v) { return H - 18 - (v / maxV) * (H - 34); }
    function line(key) {
      return prof.map(function (p, i) { return (i ? 'L' : 'M') + x(p.h).toFixed(1) + ',' + y(p[key]).toFixed(1); }).join(' ');
    }
    var area = prof.map(function (p, i) { return (i ? 'L' : 'M') + x(p.h).toFixed(1) + ',' + y(p.pv + p.wt).toFixed(1); }).join(' ') +
      ' L' + x(24).toFixed(1) + ',' + y(0).toFixed(1) + ' L' + x(0).toFixed(1) + ',' + y(0).toFixed(1) + ' Z';
    var grid = '';
    for (var hh = 0; hh <= 24; hh += 6) {
      grid += '<line x1="' + x(hh) + '" y1="' + y(0) + '" x2="' + x(hh) + '" y2="8" stroke="#e7eef4" stroke-width="1"/>';
      grid += '<text x="' + x(hh) + '" y="' + (H - 6) + '" font-size="8" fill="#9aabb8" text-anchor="middle" font-family="sans-serif">' + hh + '</text>';
    }
    var now = x(st.hour);
    $('rChart').innerHTML =
      grid +
      '<path d="' + area + '" fill="#fdf0dc" opacity=".75"/>' +
      '<path d="' + line('pv') + '" fill="none" stroke="#f2a93b" stroke-width="1.6"/>' +
      '<path d="' + line('wt') + '" fill="none" stroke="#3aa0c9" stroke-width="1.6" stroke-dasharray="3 2"/>' +
      '<path d="' + line('load') + '" fill="none" stroke="#8f6bd0" stroke-width="1.4"/>' +
      '<line x1="' + now + '" y1="6" x2="' + now + '" y2="' + y(0) + '" stroke="#0b6e99" stroke-width="1.2" opacity=".8"/>' +
      '<circle cx="' + now + '" cy="8" r="2.6" fill="#0b6e99"/>';
    var d = R.dayEnergy(st);
    $('rDayGen').textContent = Math.round(d.gen) + ' Вт·ч';
    $('rDayUse').textContent = Math.round(d.use) + ' Вт·ч';
  }

  /* ---------- сцена ---------- */
  var rotorAngle = 0;
  function renderScene(f) {
    var elev = f.elevDeg, day = elev > 0;
    // небо
    var sky = $('sky');
    var night = elev < -6;
    var t = Math.max(0, Math.min(1, (elev + 6) / 20));
    sky.setAttribute('fill', night ? 'url(#skyNight)' : 'url(#skyDay)');
    sky.setAttribute('opacity', night ? 1 : 0.15 + 0.85 * t);
    // солнце: путь по небу
    var x = 105 + (st.hour / 24) * 590;
    var ySun = 300 - Math.max(0, elev) * 3.6;
    ['sunDisc', 'sunGlowC'].forEach(function (id) {
      var el = $(id);
      el.setAttribute('cx', x); el.setAttribute('cy', ySun);
      el.setAttribute('opacity', elev > 0 ? (id === 'sunDisc' ? Math.min(1, 0.35 + elev / 40) : 0.9) : 0);
    });
    $('sunGlowC').setAttribute('r', 50 + Math.max(0, elev) * 0.6);
    // облака
    var cl = $('clouds');
    if (cl.dataset.level !== String(st.cloud.toFixed(2))) {
      cl.dataset.level = String(st.cloud.toFixed(2));
      var n = Math.round(st.cloud * 6);
      var out = '';
      for (var i = 0; i < n; i++) {
        var cx = 80 + ((i * 137) % 640), cy = 40 + ((i * 53) % 90);
        out += '<g opacity="' + (0.35 + 0.4 * st.cloud) + '"><ellipse cx="' + cx + '" cy="' + cy + '" rx="46" ry="17" fill="#fff"/>' +
          '<ellipse cx="' + (cx + 30) + '" cy="' + (cy + 6) + '" rx="34" ry="13" fill="#f2f7fb"/></g>';
      }
      cl.innerHTML = out;
    }
    // панель: наклон (сжатие по вертикали) и азимут (сжатие по горизонтали)
    var beta = st.tilt * Math.PI / 180;
    var sx = 1 - 0.45 * Math.abs(Math.sin(st.azimuth * Math.PI / 180));
    var sy = 0.12 + 0.88 * Math.sin(beta);   // tilt=0 — плашмя (видна с ребра), tilt=90 — анфас
    $('panelTilt').setAttribute('transform', 'scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')');
    // лопасти
    var p = f.wt;
    var speed = p > 0.5 ? Math.min(9, 1.2 + p / 18) : 0;
    rotorAngle = (rotorAngle + speed) % 360;
    $('blades').setAttribute('transform', 'rotate(' + rotorAngle.toFixed(1) + ')');
    // дом и лампа
    var lampOn = st.loads.lamp;
    $('lampGlow').setAttribute('opacity', lampOn ? 0.55 : 0);
    $('win').setAttribute('fill', lampOn ? '#ffe9a8' : '#cfe3ee');
    // батарея
    var battW = 60 * st.soc;
    $('battFill').setAttribute('width', Math.max(0, battW));
    $('battFill').setAttribute('fill', st.soc < 0.2 ? '#e8850c' : (st.soc > 0.8 ? '#1f9d6b' : 'url(#battFill)'));
    $('battTxt').textContent = 'АКБ ' + Math.round(st.soc * 100) + ' %';
    // потоки энергии
    var fPV = f.pv > 1 ? Math.min(1, 0.35 + f.pv / 100) : 0;
    var fWT = f.wt > 1 ? Math.min(1, 0.35 + f.wt / 100) : 0;
    var fL = f.load > 0 ? 0.7 : 0;
    $('flowPV').setAttribute('opacity', fPV);
    $('flowWT').setAttribute('opacity', fWT);
    $('flowLoad').setAttribute('opacity', fL);
    // предупреждение
    var warn = '', show = false;
    if (st.wind > 16) { warn = 'шторм: ветрогенератор остановлен'; show = true; }
    else if (st.soc < 0.06 && f.load > 0) { warn = 'аккумулятор разряжен'; show = true; }
    else if (f.pv < 1 && f.wt < 1 && f.load > 0 && st.hour > 20 || f.pv < 1 && f.wt < 1 && f.load > 0 && st.hour < 5) { warn = 'нет выработки — работаем от АКБ'; show = true; }
    $('warnText').setAttribute('opacity', show ? 1 : 0);
    $('warnLabel').textContent = warn;
  }

  /* ---------- приборы ---------- */
  function renderMeters(f) {
    $('rPV').innerHTML = fmtW(f.pv) + ' <small>Вт</small>';
    $('rWT').innerHTML = fmtW(f.wt) + ' <small>Вт</small>';
    $('rLoad').innerHTML = fmtW(f.load) + ' <small>Вт</small>';
    var net = f.pv + f.wt * 1 - f.load;
    var netCtrl = Math.round((f.pv + f.wt) * R.controllerEff(st) - f.load);
    $('rNet').innerHTML = (netCtrl >= 0 ? '+' : '−') + Math.abs(netCtrl) + ' <small>Вт</small>';
    $('rNet').style.color = netCtrl >= 0 ? '#1f9d6b' : '#d64545';
    $('rSoc').innerHTML = Math.round(st.soc * 100) + ' <small>%</small>';
    $('rSocBar').style.width = Math.round(st.soc * 100) + '%';
    $('rSocBar').style.background = st.soc < 0.2 ? '#d64545' : (st.soc > 0.8 ? '#1f9d6b' : 'linear-gradient(90deg,#ffd08a,#f28c28)');
    $('rSocState').textContent = st.soc < 0.2 ? 'низкий' : (st.soc > 0.9 ? 'полный' : 'заряд');
    $('rG').textContent = Math.round(f.G) + ' Вт/м²';
    $('rElev').textContent = pct(Math.max(0, f.elevDeg), 1) + '°';
    $('rGen').textContent = Math.round(st.energyGen) + ' Вт·ч';
    $('rUse').textContent = Math.round(st.energyUsed) + ' Вт·ч';
    $('rClock').textContent = timeText(st.hour);
    $('sHour').value = st.hour;
    $('vHour').textContent = timeText(st.hour);
  }

  /* ---------- цикл ---------- */
  function frame(now) {
    var dt = lastTick ? Math.min(0.25, (now - lastTick) / 1000) : 0;
    lastTick = now;
    if (window.__bench === 'renew') {
      if (run.playing && dt > 0) R.step(st, dt, run.speed);
      else R.step(st, 0, 0);
      lastFacts = R.facts(st);
      renderScene(lastFacts);
      renderMeters(lastFacts);
      if (Math.abs(st.hour - (lastFacts._chartHour || -1)) > 0.25) {
        lastFacts._chartHour = st.hour;
        renderChart();
      }
      taskTick += dt;
      if (taskTick > 0.4) { taskTick = 0; checkTask(false); }
    }
    requestAnimationFrame(frame);
  }

  /* ---------- сервис ---------- */
  function toast(text) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = text; t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  $('btnSample').onclick = sample;
  $('btnDay').onclick = runDay;
  $('rCsv').onclick = exportCsv;

  renderControls();
  renderChart();
  renderJournal();
  renderMeasurements();
  renderTask();
  log('ok', 'Стенд «Возобновляемая энергетика»: 21 июня, 13:00, ясно, ветер 6 м/с.');
  log('ok', 'Панель пока стоит плашмя и развёрнута на восток — начните с задания 1.');
  requestAnimationFrame(frame);

  // для отладки и сквозных проверок
  window.__renew = {
    state: function () { return st; }, facts: function () { return R.facts(st); },
    R: R, sample: sample, runDay: runDay, solved: function () { return solved; },
    setHour: function (h) { st.hour = h; $('sHour').value = h; renderControls(); renderChart(); }
  };
  }   // init
})();

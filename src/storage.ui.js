/* ============================================================
   Энерджиквантум · storage.ui.js
   Интерфейс стенда «Накопители и преобразователи»
   ============================================================ */
(function () {
  'use strict';
  var S = window.Storage;
  if (!S || !document.getElementById('benchStorage')) return;

  var $ = function (id) { return document.getElementById(id); };
  var st = S.createState();
  var run = { playing: true, speed: 1 };
  var solved = {}, taskIndex = 0, lastFacts = null, lastTick = 0, taskTick = 0;
  var waveT = 0;

  var css = document.createElement('style');
  css.textContent = `
  .stor main{display:grid;grid-template-columns:238px minmax(420px,1fr) 320px;gap:10px;padding:10px;min-height:0}
  .stor .seg{display:flex;gap:2px;background:#f2f6f9;border-radius:7px;padding:2px}
  .stor .seg button{flex:1;padding:4px 0;font-size:11.5px;border-radius:5px;color:var(--muted)}
  .stor .seg button.active{background:#fff;color:var(--accent);font-weight:700;box-shadow:0 1px 2px rgba(0,0,0,.08)}
  .stor .fld{margin-bottom:9px}
  .stor .fld .top{display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);margin-bottom:2px}
  .stor .fld .top b{color:var(--ink);font-variant-numeric:tabular-nums}
  .stor input[type=range]{width:100%}
  .stor .chk{display:flex;align-items:center;gap:7px;font-size:12px;padding:4px 0}
  .stor .chk input{width:15px;height:15px;accent-color:var(--accent)}
  .sstage{position:relative;flex:1;min-height:0;border-radius:var(--r);border:1px solid var(--line);background:#fbfdfe;overflow:hidden}
  .sstage svg.scene{width:100%;height:100%;display:block}
  .scope{padding:6px 9px 9px}
  .scope canvas{width:100%;height:104px;display:block;background:#f7fafc;border:1px solid var(--line);border-radius:8px}
  .warnchip{display:inline-block;background:#fdecec;border:1px solid #f3bcbc;color:#a02020;border-radius:6px;padding:1px 6px;font-size:10.5px;margin:2px 3px 0 0}
  @media (max-width:980px){.stor main{grid-template-columns:1fr}.sstage{min-height:380px}}
  `;
  document.head.appendChild(css);

  var main = $('benchStorage');
  main.className = 'stor';
  main.innerHTML = `
    <aside class="panel rctl">
      <h2>Накопитель</h2>
      <div class="grp">
        <div class="fld"><span class="top"><span>Тип</span></span>
          <div class="seg" id="segType">
            <button data-type="liion" class="active">Li-ion</button>
            <button data-type="lifepo4">LiFePO₄</button>
            <button data-type="lead">Pb</button>
            <button data-type="cap">Ионистор</button>
          </div></div>
        <div class="fld"><span class="top"><span>Заряд</span><b id="vSoc">50 %</b></span>
          <div class="bar" style="margin-bottom:6px"><i id="socBar" style="width:50%"></i></div>
          <button class="btn tiny" id="btnFull" style="width:100%">Поставить заряд 100 %</button></div>
        <label class="chk"><input type="checkbox" id="chargeOn">Заряд включён (CC/CV)</label>
        <div class="fld"><span class="top"><span>Ток заряда</span><b id="vChargeC">0,5C</b></span>
          <input type="range" id="sChargeC" min="0.1" max="1.5" step="0.1" value="0.5"></div>
      </div>
      <div class="grp">
        <div class="gl" style="font-size:10.5px;letter-spacing:.5px;text-transform:uppercase;color:var(--muted);margin-bottom:7px;font-weight:600">Нагрузка и преобразователь</div>
        <div class="fld"><span class="top"><span>Нагрузка</span></span>
          <div class="seg" id="segLoad" style="flex-wrap:wrap">
            <button data-load="lamp" class="active">Лампа</button>
            <button data-load="motor">Двигатель</button>
            <button data-load="impulse">Импульс</button>
            <button data-load="inverter">Инвертор</button>
          </div></div>
        <label class="chk"><input type="checkbox" id="loadOn" checked>Нагрузка подключена</label>
        <div class="fld"><span class="top"><span>Преобразователь</span></span>
          <div class="seg" id="segConv">
            <button data-conv="none">нет</button>
            <button data-conv="buck" class="active">buck</button>
            <button data-conv="boost">boost</button>
          </div></div>
        <div class="fld"><span class="top"><span>Скважность D</span><b id="vDuty">0,42</b></span>
          <input type="range" id="sDuty" min="0.05" max="0.95" step="0.01" value="0.42"></div>
        <label class="chk"><input type="checkbox" id="invOn">Инвертор 220 В включён</label>
      </div>
      <div class="grp">
        <button class="btn primary" id="btnDischarge" style="width:100%;margin-bottom:6px">Прогнать полный разряд</button>
        <button class="btn" id="btnReset" style="width:100%">Сбросить опыт</button>
      </div>
    </aside>

    <section class="stagewrap">
      <div class="timebar panel">
        <div class="grp">
          <button id="stPlay" title="Пауза / пуск">⏸</button>
          <button data-sspeed="1" class="active">×1</button>
          <button data-sspeed="2">×2</button>
          <button data-sspeed="4">×4</button>
        </div>
        <div class="clock">модельное время: <b id="stClock">0 мин</b></div>
        <div class="grow"></div>
        <button class="btn primary" id="stSample">＋ Снять точку</button>
      </div>

      <div class="sstage" id="stStage">
        <svg class="scene" viewBox="0 0 760 380" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="cellFill" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stop-color="#8fe0b8"/><stop offset="100%" stop-color="#1f9d6b"/>
            </linearGradient>
            <linearGradient id="cellWarm" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stop-color="#ffd08a"/><stop offset="100%" stop-color="#e8850c"/>
            </linearGradient>
          </defs>

          <!-- накопитель -->
          <g id="gCell" transform="translate(120,190)">
            <rect x="-62" y="-96" width="124" height="192" rx="14" fill="#fff" stroke="#7a8fa0" stroke-width="2.5"/>
            <rect x="-20" y="-108" width="40" height="14" rx="4" fill="#7a8fa0"/>
            <rect id="cellFill" x="-56" y="90" width="112" height="0" rx="8" fill="url(#cellFill)" style="transition:height .12s,y .12s"/>
            <g id="cellBolt" opacity="0">
              <path d="M-4 -44 L12 -44 L-2 -12 L12 -12 L-12 34 L-4 -6 L-16 -6 Z" fill="#ffd166" stroke="#e8a93a"/>
            </g>
            <text id="cellPct" x="0" y="-64" text-anchor="middle" font-size="26" font-weight="700" fill="#1f2a36" font-family="sans-serif">50 %</text>
            <text id="cellType" x="0" y="118" text-anchor="middle" font-size="11.5" fill="#5a6772" font-family="sans-serif">Li-ion 18650</text>
            <text id="cellTemp" x="0" y="134" text-anchor="middle" font-size="11" fill="#8a97a3" font-family="sans-serif">25 °C</text>
          </g>

          <!-- провода и преобразователь -->
          <path d="M182 190 L246 190" stroke="#8fa3b3" stroke-width="3" fill="none"/>
          <g id="gConv" transform="translate(300,190)">
            <rect x="-54" y="-50" width="108" height="100" rx="10" fill="#fff" stroke="#a9bcc9" stroke-width="2"/>
            <text x="0" y="-30" text-anchor="middle" font-size="10.5" fill="#5a6772" font-family="sans-serif" id="convName">buck</text>
            <text id="convOut" x="0" y="4" text-anchor="middle" font-size="19" font-weight="700" fill="#0b6e99" font-family="sans-serif">5,0 В</text>
            <text id="convEff" x="0" y="24" text-anchor="middle" font-size="10.5" fill="#5a6772" font-family="sans-serif">КПД 85 %</text>
            <text id="convD" x="0" y="40" text-anchor="middle" font-size="10" fill="#8a97a3" font-family="sans-serif">D = 0,42</text>
          </g>
          <path d="M354 190 L418 190" stroke="#8fa3b3" stroke-width="3" fill="none"/>

          <!-- нагрузка -->
          <g id="gLoad" transform="translate(486,190)">
            <rect x="-56" y="-46" width="112" height="92" rx="10" fill="#fff" stroke="#a9bcc9" stroke-width="2"/>
            <circle id="loadBulb" cx="0" cy="-12" r="15" fill="#e9eff4" stroke="#a9bcc9" stroke-width="2"/>
            <text id="loadName" x="0" y="20" text-anchor="middle" font-size="11" fill="#5a6772" font-family="sans-serif">Лампа 5 Вт</text>
            <text id="loadP" x="0" y="36" text-anchor="middle" font-size="11" font-weight="700" fill="#1f2a36" font-family="sans-serif">5 Вт</text>
          </g>

          <!-- инвертор -->
          <g id="gInv" transform="translate(620,190)" opacity="0.35">
            <rect x="-50" y="-40" width="100" height="80" rx="10" fill="#fff" stroke="#a9bcc9" stroke-width="2"/>
            <path d="M-26 8 q13 -26 26 0 q13 26 26 0" fill="none" stroke="#8f6bd0" stroke-width="2.4"/>
            <text x="0" y="28" text-anchor="middle" font-size="10.5" fill="#5a6772" font-family="sans-serif">220 В · 50 Гц</text>
          </g>

          <!-- поток -->
          <path id="stFlow" d="M182 160 L418 160" stroke="#7ed0ff" stroke-width="3" stroke-dasharray="5 12" opacity="0" fill="none"/>

          <!-- предупреждения -->
          <g id="stWarn" opacity="0">
            <rect x="180" y="16" width="400" height="30" rx="8" fill="#fff4e5" stroke="#f2cf9e"/>
            <text id="stWarnText" x="380" y="36" text-anchor="middle" font-size="12" fill="#8a5a00" font-family="sans-serif"></text>
          </g>
          <line x1="40" y1="300" x2="720" y2="300" stroke="#dbe6ee" stroke-width="2"/>
        </svg>
      </div>

      <div class="panel scope">
        <div class="row" style="display:flex;justify-content:space-between;align-items:center;padding:0 2px 4px">
          <span class="tiny muted" style="font-size:10.5px;letter-spacing:.5px;text-transform:uppercase;font-weight:600">Осциллограф</span>
          <span class="tiny muted" id="scopeLabel">ШИМ на нагрузке</span>
        </div>
        <canvas id="scope" width="900" height="208"></canvas>
      </div>

      <div class="bottombar panel" style="height:132px">
        <div class="tabs">
          <button class="active" data-sttab="journal">Журнал</button>
          <button data-sttab="meas">Протокол <span id="stMeasCount" class="badge"></span></button>
          <div class="grow"></div>
          <button class="btn ghost tiny" id="stCsv" style="margin:4px 6px 4px 0">Экспорт CSV</button>
        </div>
        <div class="tabbody" id="stTabJournal"><div class="journal" id="stJournal"></div></div>
        <div class="tabbody" id="stTabMeas" hidden></div>
      </div>
    </section>

    <aside class="right">
      <div class="card task">
        <h2>Задание <span class="badge" id="stTaskId">1 / 6</span></h2>
        <div class="body" id="stTaskBody"></div>
        <div class="tasklist" id="stTaskList"></div>
      </div>

      <div class="card">
        <h2>Показания</h2>
        <div class="meters">
          <div class="meter accent"><div class="k"><span>Напряжение</span><span>U</span></div>
            <div class="v" id="stU">3,75 <small>В</small></div></div>
          <div class="meter"><div class="k"><span>Ток</span><span>I</span></div>
            <div class="v" id="stI">0 <small>А</small></div></div>
          <div class="meter"><div class="k"><span>Мощность</span><span>P</span></div>
            <div class="v" id="stP">0 <small>Вт</small></div></div>
          <div class="meter" id="stTempBox"><div class="k"><span>Температура</span><span>T</span></div>
            <div class="v" id="stT">25 <small>°C</small></div></div>
          <div class="meter wide"><div class="k"><span>Заряд</span><span id="stSocState">—</span></div>
            <div class="v" id="stSoc">50 <small>%</small></div>
            <div class="bar"><i id="stSocBar" style="width:50%"></i></div></div>
        </div>
        <div class="aux"><span>КПД: <b id="stEff">—</b></span><span>Автономия: <b id="stAuto">—</b></span></div>
        <div class="aux" style="padding-top:0"><span>Энергия: <b id="stEnergy">0 Вт·ч</b></span><span id="stWarnChip"></span></div>
      </div>
    </aside>`;

  /* ---------- управление ---------- */
  function pct(v, d) { return v.toFixed(d === undefined ? 1 : d).replace('.', ','); }
  function log(kind, text) {
    st.log.push({ t: st.t, kind: kind, text: text });
    if (st.log.length > 300) st.log.shift();
    renderJournal();
  }
  function renderJournal() {
    var box = $('stJournal');
    if (!st.log.length) { box.innerHTML = '<div class="empty-note">Действия появятся здесь.</div>'; return; }
    box.innerHTML = st.log.slice(-80).map(function (r) {
      return '<div class="jrow ' + r.kind + '"><span class="tm">' + pct(r.t / 60, 1) + ' мин</span><span class="dot"></span><span class="tx">' +
        String(r.text).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }) + '</span></div>';
    }).join('');
    box.parentElement.scrollTop = box.parentElement.scrollHeight;
  }

  function renderControls() {
    $('vSoc').textContent = Math.round(st.soc * 100) + ' %';
    $('socBar').style.width = Math.round(st.soc * 100) + '%';
    $('vChargeC').textContent = pct(st.chargeC, 1) + 'C';
    $('vDuty').textContent = pct(st.duty, 2);
    $('chargeOn').checked = st.chargeOn;
    $('loadOn').checked = st.loadOn;
    $('invOn').checked = st.inverterOn;
    [].forEach.call($('segType').children, function (b) { b.classList.toggle('active', b.dataset.type === st.type); });
    [].forEach.call($('segLoad').children, function (b) { b.classList.toggle('active', b.dataset.load === st.load); });
    [].forEach.call($('segConv').children, function (b) { b.classList.toggle('active', b.dataset.conv === st.converter); });
  }

  $('segType').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.type === 'cap') {
      st.storage = 'cap'; st.type = 'liion'; st.capVoltage = 12;
    } else {
      st.storage = 'battery'; st.type = b.dataset.type;
    }
    st.temp = 25; renderControls();
    log('ok', 'Накопитель: ' + (st.storage === 'cap' ? 'ионистор 10 Ф' : S.TYPES[st.type].name));
    drawScene();
  });
  $('segLoad').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    st.load = b.dataset.load; st.loadOn = true; renderControls();
    log('ok', 'Нагрузка: ' + S.LOADS[st.load].name);
  });
  $('segConv').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    st.converter = b.dataset.conv; renderControls();
    log('ok', 'Преобразователь: ' + (st.converter === 'none' ? 'без преобразователя' : st.converter));
  });
  $('sChargeC').addEventListener('input', function (e) {
    st.chargeC = parseFloat(e.target.value);
    $('vChargeC').textContent = pct(st.chargeC, 1) + 'C';
  });
  $('sDuty').addEventListener('input', function (e) {
    st.duty = parseFloat(e.target.value);
    $('vDuty').textContent = pct(st.duty, 2);
  });
  $('chargeOn').addEventListener('change', function (e) {
    st.chargeOn = e.target.checked;
    log(e.target.checked ? 'ok' : 'warn', 'Заряд ' + (e.target.checked ? 'включён' : 'выключен'));
  });
  $('loadOn').addEventListener('change', function (e) {
    st.loadOn = e.target.checked;
    log(e.target.checked ? 'ok' : 'warn', 'Нагрузка ' + (e.target.checked ? 'подключена' : 'отключена'));
  });
  $('invOn').addEventListener('change', function (e) {
    st.inverterOn = e.target.checked;
    log(e.target.checked ? 'ok' : 'warn', 'Инвертор ' + (e.target.checked ? 'включён' : 'выключен'));
  });
  $('btnFull').onclick = function () { st.soc = 1; st.temp = 25; log('ok', 'Накопитель заряжен до 100 %'); renderControls(); };
  $('stPlay').onclick = function () { run.playing = !run.playing; this.textContent = run.playing ? '⏸' : '▶'; };
  [].forEach.call(document.querySelectorAll('[data-sspeed]'), function (b) {
    b.onclick = function () {
      run.speed = +b.dataset.sspeed;
      [].forEach.call(document.querySelectorAll('[data-sspeed]'), function (x) { x.classList.toggle('active', x === b); });
    };
  });
  $('btnReset').onclick = function () {
    var keepType = st.type;
    st = S.createState(); st.type = keepType;
    solved = {}; lastFacts = null;
    log('warn', 'Опыт сброшен');
    renderControls(); renderMeasurements(); renderTask(); drawScene();
  };
  $('btnDischarge').onclick = function () {
    st.loadOn = true;
    if (st.soc < 0.2) { st.soc = 1; log('ok', 'Накопитель заряжен до 100 % перед разрядом'); }
    var start = st.soc, t0 = st.t, guard = 0;
    while (st.soc > 0.02 && guard < 20000) { S.step(st, 0.1, 1); guard++; }
    var wh = st.energyOut;
    st.measures.push({
      kind: 'discharge', t: st.t, cRate: (S.loadPower(st) / (S.capacityWh(st) || 1)).toFixed(2) * 1,
      load: st.load, wh: wh, socStart: start, temp: st.temp, minutes: st.t - t0
    });
    log('ok', 'Полный разряд: ' + (start * 100).toFixed(0) + ' % → 2 %, отдано ' + pct(wh, 2) + ' Вт·ч, нагрев до ' + Math.round(st.temp) + ' °C');
    renderMeasurements(); checkTask(false);
    toast('Разряд завершён: отдано ' + pct(wh, 2) + ' Вт·ч');
  };

  /* ---------- протокол ---------- */
  function sample() {
    var f = S.facts(st);
    var rec = {
      t: st.t, kind: st.chargeOn ? 'charge' : 'discharge', type: st.storage === 'cap' ? 'cap' : st.type,
      load: st.load, soc: st.soc, volt: f.volt, current: f.current, power: f.power,
      temp: st.temp, eff: f.eff, autonomyH: f.autonomyH,
      autonomyCalc: (f.capacityWh * st.soc) / Math.max(0.01, f.loadP / Math.max(0.5, f.eff)),
      wh: st.energyOut, buckV: f.buckV
    };
    if (st.converter !== 'none') st.measures.push(Object.assign({ kind: 'eff' }, rec));
    if (st.storage === 'cap') st.measures.push(Object.assign({ kind: 'cap' }, rec));
    if (st.load === 'lamp' && !st.chargeOn) st.measures.push(Object.assign({ kind: 'autonomy' }, rec));
    st.measures.push(rec);
    log('ok', 'Точка: U = ' + pct(f.volt, 2) + ' В · I = ' + pct(f.current, 2) + ' А · ' +
      Math.round(st.soc * 100) + ' % · ' + Math.round(st.temp) + ' °C · КПД ' + Math.round(f.eff * 100) + ' %');
    renderMeasurements(); checkTask(false);
  }
  function renderMeasurements() {
    var box = $('stTabMeas');
    $('stMeasCount').textContent = st.measures.length || '';
    if (!st.measures.length) { box.innerHTML = '<div class="empty-note">Нажмите «Снять точку» — запись попадёт в протокол.</div>'; return; }
    box.innerHTML = '<table class="mtable"><thead><tr><th>Тип</th><th>Накопитель</th><th>Нагрузка</th><th>U, В</th>' +
      '<th>I, А</th><th>SoC, %</th><th>T, °C</th><th>КПД</th><th>Отдано, Вт·ч</th></tr></thead><tbody>' +
      st.measures.slice(-60).reverse().map(function (m) {
        return '<tr><td>' + (m.kind === 'eff' ? 'КПД' : m.kind === 'cap' ? 'ионистор' : m.kind === 'autonomy' ? 'автономия' : m.kind === 'charge' ? 'заряд' : 'разряд') +
          '</td><td style="text-align:left">' + (m.type === 'cap' ? 'ионистор' : (S.TYPES[m.type] || {}).short || '—') +
          '</td><td style="text-align:left">' + (S.LOADS[m.load] || {}).name + '</td><td>' + pct(m.volt || 0, 2) +
          '</td><td>' + pct(m.current || 0, 2) + '</td><td>' + Math.round((m.soc || 0) * 100) + '</td><td>' +
          Math.round(m.temp || 0) + '</td><td>' + Math.round((m.eff || 0) * 100) + ' %</td><td>' + pct(m.wh || 0, 2) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }
  function exportCsv() {
    if (!st.measures.length) { toast('Протокол пуст'); return; }
    var lines = ['Тип;Накопитель;Нагрузка;U,В;I,А;SoC,%;T,°C;КПД;Отдано,Вт·ч;Uвых,В'];
    st.measures.forEach(function (m) {
      lines.push([m.kind || '', m.type === 'cap' ? 'ионистор' : ((S.TYPES[m.type] || {}).short || ''),
        (S.LOADS[m.load] || {}).name || '', pct(m.volt || 0, 3), pct(m.current || 0, 3),
        Math.round((m.soc || 0) * 100), Math.round(m.temp || 0), Math.round((m.eff || 0) * 100),
        pct(m.wh || 0, 3), pct(m.buckV || 0, 2)].join(';'));
    });
    var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'протокол-накопители.csv';
    document.body.appendChild(a); a.click(); a.remove();
    log('ok', 'Протокол выгружен в CSV');
  }
  [].forEach.call(document.querySelectorAll('.tabs button[data-sttab]'), function (b) {
    b.onclick = function () {
      [].forEach.call(document.querySelectorAll('.tabs button[data-sttab]'), function (x) { x.classList.toggle('active', x === b); });
      $('stTabJournal').hidden = b.dataset.sttab !== 'journal';
      $('stTabMeas').hidden = b.dataset.sttab !== 'meas';
    };
  });

  /* ---------- задания ---------- */
  function facts() { return lastFacts || S.facts(st); }
  function renderTask() {
    var tk = S.TASKS[taskIndex], done = solved[taskIndex];
    $('stTaskId').textContent = (taskIndex + 1) + ' / ' + S.TASKS.length;
    $('stTaskBody').innerHTML =
      '<div class="goal"><b>' + tk.t + '</b><br>' + tk.goal + '</div>' +
      '<ol>' + tk.steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' +
      (done ? '<div class="result ok"><span class="stars">' + '★★★'.slice(0, done) + '</span><br>' + tk.why + '</div>' : '') +
      '<div class="hints">' + (tk._hints || []).map(function (h, i) { return '<div class="hint">Подсказка ' + (i + 1) + ': ' + h + '</div>'; }).join('') + '</div>' +
      '<div style="display:flex;gap:6px;margin-top:9px"><button class="btn" id="stHint">Подсказка</button>' +
      '<button class="btn primary" id="stCheck">Проверить</button></div><div id="stCheckOut"></div>';
    $('stTaskList').innerHTML = S.TASKS.map(function (t, i) {
      return '<button data-i="' + i + '" class="' + (i === taskIndex ? 'active ' : '') + (solved[i] ? 'done' : '') + '">' +
        '<span class="num">' + (solved[i] ? '★' : (i + 1)) + '</span><span>' + t.t + '</span></button>';
    }).join('');
    [].forEach.call($('stTaskList').children, function (b) { b.onclick = function () { taskIndex = +b.dataset.i; renderTask(); }; });
    $('stHint').onclick = function () {
      var t2 = S.TASKS[taskIndex]; t2._hints = t2._hints || [];
      if (t2._hints.length < t2.hints.length) { t2._hints.push(t2.hints[t2._hints.length]); renderTask(); } else toast('Подсказки закончились');
    };
    $('stCheck').onclick = function () {
      if (!checkTask(true)) {
        var f = facts();
        $('stCheckOut').innerHTML = '<div class="result bad">Пока не выполнено: SoC ' +
          Math.round(f.soc * 100) + ' %, максимум температуры ' + Math.round(f.maxTemp) + ' °C, точек в протоколе ' +
          f.measures.length + ', предупреждений ' + f.warnings.length + '.</div>';
      }
    };
  }
  function checkTask(show) {
    var tk = S.TASKS[taskIndex], f = facts(), was = !!solved[taskIndex];
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
  function drawScene() {
    var f = S.facts(st);
    var T = S.TYPES[st.type];
    var socPct = st.storage === 'cap' ? Math.min(1, st.capVoltage / 12) : st.soc;
    // заливка ячейки
    var hMax = 176, h = Math.max(0, Math.min(1, socPct)) * hMax;
    var fill = $('cellFill');
    fill.setAttribute('height', h.toFixed(1));
    fill.setAttribute('y', (90 - h).toFixed(1));
    fill.setAttribute('fill', st.storage === 'cap' ? 'url(#cellWarm)' : (st.soc < 0.2 ? 'url(#cellWarm)' : 'url(#cellFill)'));
    $('cellPct').textContent = Math.round(socPct * 100) + ' %';
    $('cellType').textContent = st.storage === 'cap' ? 'Ионистор 10 Ф' : T.name;
    $('cellTemp').textContent = Math.round(st.temp) + ' °C' + (st.temp > T.tempMax ? ' · перегрев' : '');
    $('cellBolt').setAttribute('opacity', st.chargeOn && st.soc < 1 ? 1 : 0);
    // преобразователь
    var convName = st.converter === 'none' ? 'без DC-DC' : (st.converter === 'buck' ? 'buck (понижающий)' : 'boost (повышающий)');
    $('convName').textContent = convName;
    var out = st.converter === 'buck' ? f.buckV : (st.converter === 'boost' ? f.volt / Math.max(0.1, (1 - st.duty)) : f.volt);
    $('convOut').textContent = pct(out, 2) + ' В';
    $('convEff').textContent = 'КПД ' + Math.round(f.eff * 100) + ' %';
    $('convD').textContent = st.converter === 'none' ? '' : 'D = ' + pct(st.duty, 2);
    // нагрузка
    $('loadName').textContent = S.LOADS[st.load].name;
    $('loadP').textContent = pct(f.loadP, 0) + ' Вт';
    var lit = f.loadP > 0 && st.loadOn;
    $('loadBulb').setAttribute('fill', lit ? '#ffe9a8' : '#e9eff4');
    $('loadBulb').setAttribute('r', lit ? 15 + Math.min(6, f.loadP / 12) : 15);
    $('gInv').setAttribute('opacity', st.inverterOn ? 1 : 0.35);
    // поток
    $('stFlow').setAttribute('opacity', (st.chargeOn || lit) ? 0.9 : 0);
    // предупреждения
    var w = (f.warnings || []).join(' · ');
    $('stWarn').setAttribute('opacity', w ? 1 : 0);
    $('stWarnText').textContent = w;
    $('scopeLabel').textContent = st.load === 'inverter' && st.inverterOn ? 'Синусоида 50 Гц на выходе инвертора' :
      (st.converter === 'none' ? 'Постоянное напряжение' : 'ШИМ (скважность ' + pct(st.duty, 2) + ')');
  }

  function drawScope() {
    var c = $('scope'), ctx = c.getContext('2d');
    var W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = '#e7eef4'; ctx.lineWidth = 1;
    for (var i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo(i * W / 8, 0); ctx.lineTo(i * W / 8, H); ctx.stroke(); }
    for (var j = 1; j < 4; j++) { ctx.beginPath(); ctx.moveTo(0, j * H / 4); ctx.lineTo(W, j * H / 4); ctx.stroke(); }
    var wf = S.waveform(st, 240);
    var maxV = Math.max(1, Math.max.apply(null, wf.map(Math.abs)));
    ctx.beginPath();
    wf.forEach(function (v, i) {
      var x = i / (wf.length - 1) * W;
      var y = H / 2 - (v / maxV) * (H / 2 - 12);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.strokeStyle = st.load === 'inverter' && st.inverterOn ? '#8f6bd0' : '#0b6e99';
    ctx.lineWidth = 2.2; ctx.stroke();
    ctx.fillStyle = '#8a97a3'; ctx.font = '18px sans-serif';
    ctx.fillText(Math.round(maxV) + ' В', 8, 22);
    ctx.fillText(st.load === 'inverter' && st.inverterOn ? '50 Гц' : (st.converter === 'none' ? 'DC' : 'PWM'), W - 74, H - 12);
  }

  /* ---------- приборы ---------- */
  function renderMeters(f) {
    $('stU').innerHTML = pct(f.volt, 2) + ' <small>В</small>';
    $('stI').innerHTML = pct(f.current, 2) + ' <small>А</small>';
    $('stP').innerHTML = pct(f.power, 1) + ' <small>Вт</small>';
    $('stT').innerHTML = Math.round(st.temp) + ' <small>°C</small>';
    $('stTempBox').classList.toggle('hot', st.temp > S.TYPES[st.type].tempMax);
    var socPct = st.storage === 'cap' ? st.capVoltage / 12 : st.soc;
    $('stSoc').innerHTML = Math.round(socPct * 100) + ' <small>%</small>';
    $('stSocBar').style.width = Math.round(socPct * 100) + '%';
    $('stSocState').textContent = st.chargeOn ? 'заряд' : (f.loadP > 0 ? 'разряд' : 'покой');
    $('stEff').textContent = Math.round(f.eff * 100) + ' %';
    $('stAuto').textContent = f.autonomyH > 0 ? pct(f.autonomyH, 1) + ' ч' : '—';
    $('stEnergy').textContent = pct(st.energyOut, 2) + ' Вт·ч';
    $('stWarnChip').innerHTML = (f.warnings || []).map(function (w) { return '<span class="warnchip">' + w + '</span>'; }).join('');
    $('stClock').textContent = Math.round(st.t / 60) + ' мин';
    $('vSoc').textContent = Math.round(st.soc * 100) + ' %';
    $('socBar').style.width = Math.round(st.soc * 100) + '%';
  }

  /* ---------- цикл ---------- */
  function frame(now) {
    var dt = lastTick ? Math.min(0.25, (now - lastTick) / 1000) : 0;
    lastTick = now;
    if (window.__bench === 'storage') {
      if (run.playing && dt > 0) S.step(st, dt, run.speed);
      lastFacts = S.facts(st);
      drawScene();
      renderMeters(lastFacts);
      drawScope();
      taskTick += dt;
      if (taskTick > 0.4) { taskTick = 0; checkTask(false); }
    }
    requestAnimationFrame(frame);
  }

  function toast(text) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = text; t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  $('stSample').onclick = sample;
  $('stCsv').onclick = exportCsv;

  renderControls(); renderJournal(); renderMeasurements(); renderTask(); drawScene(); drawScope();
  log('ok', 'Стенд «Накопители»: Li-ion 18650, заряд 50 %, нагрузка — лампа 5 Вт.');
  requestAnimationFrame(frame);

  window.__storage = {
    state: function () { return st; }, facts: function () { return S.facts(st); },
    sample: sample, solved: function () { return solved; }, S: S
  };
})();

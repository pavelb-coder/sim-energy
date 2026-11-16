/* ============================================================
   Энерджиквантум · thermal.ui.js
   Интерфейс стенда «Тепло и газы»: газ (p–V–T), калориметр, цепочки превращений.
   ============================================================ */
(function () {
  'use strict';
  var T = window.Thermal;
  if (!T || !document.getElementById('benchThermal')) return;

  var $ = function (id) { return document.getElementById(id); };
  var lab = T.createLab();
  var gas = lab.gas, cal = lab.cal;
  var mode = 'gas';                       // gas | mix | chain
  var solved = {}, taskIndex = 0, playing = true;
  var lastFrame = 0, tick = 0, heatTick = 0;

  function n(v, d) { return Number(v || 0).toFixed(d === undefined ? 1 : d).replace('.', ','); }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  var css = document.createElement('style');
  UI.text(css, `
  .therm main{display:grid;grid-template-columns:250px minmax(420px,1fr) 320px;gap:10px;padding:10px;min-height:0}
  .therm .lctl{overflow:auto}
  .therm .fld{margin-bottom:9px;padding:0 9px}
  .therm .fld .top{display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);margin-bottom:3px}
  .therm .fld .top b{color:var(--ink);font-variant-numeric:tabular-nums}
  .therm .seg{display:flex;gap:2px;background:#e8eef5;border-radius:8px;padding:2px;margin:0 9px 9px}
  .therm .seg button{flex:1;padding:4px 2px;font-size:11px;border-radius:5px;color:var(--muted)}
  .therm .seg button.active{background:#fff;color:var(--accent);font-weight:700;box-shadow:0 1px 3px rgba(20,40,90,.16)}
  .therm .chk{display:flex;align-items:center;gap:7px;font-size:12px;padding:3px 9px}
  .therm .chk input{width:15px;height:15px;accent-color:var(--accent)}
  .tstage{position:relative;flex:1;min-height:0;border-radius:var(--r);border:1px solid #c4d0da;background:#f4f8fb;overflow:hidden}
  .tstage svg{width:100%;height:100%;display:block}
  .therm .bottombar.collapsed{height:36px!important;flex:0 0 36px}
  .therm .bottombar.collapsed .tabbody{display:none}
  .therm .ttable{width:100%;border-collapse:collapse;font-size:11px}
  .therm .ttable th,.therm .ttable td{padding:3px 8px;text-align:right;border-bottom:1px solid #eef2f6}
  .therm .ttable th{color:var(--muted);font-weight:600;position:sticky;top:0;background:#fff}
  .therm .ttable th:first-child,.therm .ttable td:first-child{text-align:left}
  .therm .tgrid{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:9px}
  .therm .tgrid .cell{background:#f6f9fc;border:1px solid #d7e2ec;border-radius:9px;padding:5px 7px}
  .therm .tgrid .k{font-size:9.5px;letter-spacing:.4px;color:var(--muted);text-transform:uppercase}
  .therm .tgrid .v{font-size:15px;font-weight:700;font-variant-numeric:tabular-nums}
  .therm .tgrid .v small{font-size:10px;color:var(--muted)}
  .therm .row{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:5px;font-size:12px}
  .therm .row b{font-variant-numeric:tabular-nums}
  .therm .tiny{font-size:11px;line-height:1.45}
  @media (max-width:1180px){.therm main{grid-template-columns:226px minmax(360px,1fr) 296px}}
  @media (max-width:980px){.therm main{grid-template-columns:1fr}.tstage{min-height:360px}}
  @media (max-height:860px){.tstage{min-height:260px}}
  `);
  document.head.appendChild(css);

  var main = $('benchThermal');
  main.className = 'therm';

  UI.html(main, `
    <aside class="panel lctl">
      <h2>Опыт</h2>
      <div class="seg" id="tMode">
        <button data-mode="gas" class="active">Газ</button>
        <button data-mode="mix">Смешивание</button>
        <button data-mode="heat">Нагрев</button>
        <button data-mode="chain">Цепочки</button>
      </div>

      <div id="tGasBox">
        <div class="fld"><div class="top"><span>Объём</span><b id="tVv">10,0 л</b></div>
          <input type="range" id="tV" min="1" max="20" step="0.5" value="10"></div>
        <div class="fld"><div class="top"><span>Температура</span><b id="tTv">300 К</b></div>
          <input type="range" id="tT" min="100" max="900" step="10" value="300"></div>
        <div class="fld"><div class="top"><span>Количество газа</span><b id="tNv">0,40 моль</b></div>
          <input type="range" id="tN" min="0.05" max="1.5" step="0.05" value="0.4"></div>
        <div class="seg" id="tKind">
          <button data-kind="light" class="active">Лёгкие (N₂)</button>
          <button data-kind="heavy">Тяжёлые (Xe)</button>
        </div>
        <div class="chk"><input type="checkbox" id="tHeat"><label for="tHeat">Нагреватель 50 Вт</label></div>
        <div class="chk"><input type="checkbox" id="tCool"><label for="tCool">Охладитель 40 Вт</label></div>
      </div>

      <div id="tMixBox" hidden>
        <div class="fld"><div class="top"><span>Масса горячей воды</span><b id="tHmv">0,20 кг</b></div>
          <input type="range" id="tHm" min="0.05" max="1" step="0.05" value="0.2"></div>
        <div class="fld"><div class="top"><span>Температура горячей</span><b id="tHtv">80 °C</b></div>
          <input type="range" id="tHt" min="40" max="100" step="1" value="80"></div>
        <div class="fld"><div class="top"><span>Масса холодной воды</span><b id="tCmv">0,20 кг</b></div>
          <input type="range" id="tCm" min="0.05" max="1" step="0.05" value="0.2"></div>
        <div class="fld"><div class="top"><span>Температура холодной</span><b id="tCtv">20 °C</b></div>
          <input type="range" id="tCt" min="0" max="40" step="1" value="20"></div>
        <div class="seg" id="tMat">
          <button data-mat="water" class="active">Вода</button>
          <button data-mat="alu">Алюминий</button>
          <button data-mat="iron">Железо</button>
        </div>
        <button class="btn primary" id="tMixGo" style="margin:6px 9px 10px;width:calc(100% - 18px)">Смешать</button>
      </div>

      <div id="tHeatBox" hidden>
        <div class="fld"><div class="top"><span>Масса воды</span><b id="tWmv">1,00 кг</b></div>
          <input type="range" id="tWm" min="0.1" max="3" step="0.1" value="1"></div>
        <div class="fld"><div class="top"><span>Начальная температура</span><b id="tW0v">20 °C</b></div>
          <input type="range" id="tW0" min="0" max="60" step="1" value="20"></div>
        <div class="fld"><div class="top"><span>Мощность нагревателя</span><b id="tPwv">1000 Вт</b></div>
          <input type="range" id="tPw" min="200" max="2000" step="50" value="1000"></div>
        <button class="btn primary" id="tHeatGo" style="margin:6px 9px 10px;width:calc(100% - 18px)">Нагреть до 100 °C</button>
      </div>

      <div id="tChainBox" hidden>
        <div class="fld"><div class="top"><span>Источник</span></div>
          <div class="seg" id="tSrc" style="margin:0 0 6px">
            <button data-src="sun" class="active">Свет</button>
            <button data-src="battery">Батарея</button>
            <button data-src="burner">Горелка</button>
          </div></div>
        <div class="fld"><div class="top"><span>Устройство</span></div>
          <div class="seg" id="tDev" style="margin:0 0 6px">
            <button data-dev="panel" class="active">Панель</button>
            <button data-dev="heater">Нагреватель</button>
            <button data-dev="lamp">Лампа</button>
            <button data-dev="motor">Мотор</button>
          </div></div>
        <button class="btn primary" id="tChainGo" style="margin:6px 9px 10px;width:calc(100% - 18px)">Собрать цепочку</button>
      </div>

      <h2>Время</h2>
      <div class="chk"><input type="checkbox" id="tPlay" checked><label for="tPlay">Модель идёт</label></div>
      <button class="btn" id="tSample" style="margin:8px 9px;width:calc(100% - 18px)">＋ Снять точку</button>
    </aside>

    <section class="stagewrap">
      <div class="tstage" id="tStage"><svg id="tSvg" viewBox="0 0 760 470" preserveAspectRatio="xMidYMid meet"></svg></div>
      <div class="bottombar panel">
        <div class="tabs">
          <button class="active" data-tab="meas">Протокол <span class="badge" id="tCount"></span></button>
          <div class="grow"></div>
          <button class="btn ghost tiny" id="tCsv" style="margin:4px 6px 4px 0">Экспорт CSV</button>
        </div>
        <div class="tabbody" id="tTabMeas"></div>
      </div>
    </section>

    <aside class="right">
      <div class="card task">
        <h2>Задание <span class="badge" id="tTaskId">1 / 8</span></h2>
        <div class="body" id="tTaskBody"></div>
        <div class="tasklist" id="tTaskList"></div>
      </div>

      <div class="card">
        <h2>Показания</h2>
        <div style="padding:9px 9px 0">
          <div class="lcd" style="text-align:center">
            <div class="cap"><span id="tCapMain">ДАВЛЕНИЕ, кПа</span><span id="tCapKind">газ</span></div>
            <div class="main" id="tLcdP">99,8</div>
            <div class="sub" id="tLcdSub">p = nRT/V</div>
          </div>
        </div>
        <div class="tgrid">
          <div class="cell"><div class="k" id="tK1">Температура</div><div class="v" id="tTemp">300 <small>К</small></div></div>
          <div class="cell"><div class="k" id="tK2">Объём</div><div class="v" id="tVol">10,0 <small>л</small></div></div>
          <div class="cell"><div class="k" id="tK3">p·V</div><div class="v" id="tPV">998 <small>Дж</small></div></div>
          <div class="cell"><div class="k" id="tK4">Скорость молекул</div><div class="v" id="tSpd">517 <small>м/с</small></div></div>
        </div>
      </div>

      <div class="card">
        <h2>Что происходит</h2>
        <div class="body" id="tRead"><div class="muted" style="font-size:12px">Выберите опыт слева.</div></div>
      </div>
    </aside>
  `);

  /* ---------- сцена ---------- */

  function svg() { return $('tSvg'); }

  var gasPhase = 0;   // «время» внутри сосуда — молекулы двигаются

  function drawGas(dt) {
    gasPhase += (dt || 0.16) * (300 + gas.temp) / 120;      // горячее газ — быстрее
    // размер «сосуда» зависит от объёма, число молекул — от количества вещества
    var w = 150 + (gas.volume / 20) * 330;
    var h = 170 + (gas.volume / 20) * 190;
    var x0 = (760 - w) / 2, y0 = 108;
    var count = Math.max(6, Math.min(48, Math.round(gas.moles * 40)));
    var heavy = gas.particle === 'heavy';
    var mols = '';
    for (var i = 0; i < count; i++) {
      // псевдослучайные, но стабильные для каждой молекулы траектории
      var sx = Math.sin(i * 12.9898) * 43758.5453;
      var sy = Math.sin(i * 78.233) * 12345.6789;
      var fx = sx - Math.floor(sx), fy = sy - Math.floor(sy);
      var vx = 6 + (i % 5) * 2, vy = 4 + (i % 7) * 1.6;
      var mx = x0 + 14 + ((fx * (w - 28) + gasPhase * vx) % (w - 28));
      var my = y0 + 14 + ((fy * (h - 28) + gasPhase * vy) % (h - 28));
      mols += '<circle cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="' + (heavy ? 7 : 4.5) +
        '" fill="' + (heavy ? '#7a5cc4' : '#2ea3dc') + '" opacity=".85"/>';
    }
    var hot = (gas.temp - 100) / 800;
    UI.html(svg(),
      '<rect x="' + x0 + '" y="' + (y0 + h) + '" width="' + w + '" height="26" fill="#dfe9f2"/>' +
      '<rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + h + '" rx="10" fill="#eaf3fa" stroke="#8fb4cc" stroke-width="4"/>' +
      mols +
      '<rect x="' + (x0 + w / 2 - 42) + '" y="' + (y0 - 32) + '" width="84" height="22" rx="6" fill="' +
      (gas.heatOn ? '#f07d20' : '#c6d3dd') + '"/>' +
      '<text x="' + (x0 + w / 2) + '" y="' + (y0 - 16) + '" text-anchor="middle" font-size="11" fill="#fff" font-family="sans-serif">нагрев</text>' +
      '<rect x="' + (x0 + 6) + '" y="' + (y0 + h + 6) + '" width="' + Math.max(0, (w - 12) * hot).toFixed(1) +
      '" height="8" rx="4" fill="#f07d20" opacity=".7"/>' +
      '<text x="' + x0 + '" y="' + (y0 + h + 34) + '" font-size="12" fill="#1f4a76" font-family="sans-serif">' +
      'T = ' + n(gas.temp, 0) + ' К · V = ' + n(gas.volume, 1) + ' л · p = ' + n(T.gasPressure(gas), 0) + ' кПа</text>' +
      '<text x="' + x0 + '" y="' + (y0 - 46) + '" font-size="13" font-weight="700" fill="#1b3e8f" font-family="sans-serif">' +
      (heavy ? 'Тяжёлые молекулы (Xe)' : 'Лёгкие молекулы (N₂)') + '</text>');
  }

  function drawMix() {
    var tMix = T.mixTemperature(cal);
    var hHot = 150, y0 = 170;
    var yHot = y0 + 40 * (1 - (cal.tHot - 0) / 100);
    var yCold = y0 + 40 * (1 - (cal.tCold - 0) / 100);
    UI.html(svg(),
      '<text x="60" y="60" font-size="13" font-weight="700" fill="#1b3e8f" font-family="sans-serif">Уравнение теплового баланса</text>' +
      '<rect x="70" y="' + (y0 - 70) + '" width="120" height="150" rx="8" fill="#fde3d0" stroke="#f07d20" stroke-width="3"/>' +
      '<text x="130" y="' + (y0 + 10) + '" text-anchor="middle" font-size="13" fill="#a35c00" font-family="sans-serif">' +
      n(cal.tHot, 0) + ' °C</text>' +
      '<text x="130" y="' + (y0 + 30) + '" text-anchor="middle" font-size="11" fill="#6b7c8b" font-family="sans-serif">' +
      n(cal.mHot, 2) + ' кг</text>' +
      '<text x="215" y="' + (y0) + '" font-size="22" fill="#6b7c8b" font-family="sans-serif">+</text>' +
      '<rect x="245" y="' + (y0 - 70) + '" width="120" height="150" rx="8" fill="#dceaf6" stroke="#2ea3dc" stroke-width="3"/>' +
      '<text x="305" y="' + (y0 + 10) + '" text-anchor="middle" font-size="13" fill="#1f4a76" font-family="sans-serif">' +
      n(cal.tCold, 0) + ' °C</text>' +
      '<text x="305" y="' + (y0 + 30) + '" text-anchor="middle" font-size="11" fill="#6b7c8b" font-family="sans-serif">' +
      n(cal.mCold, 2) + ' кг</text>' +
      '<text x="390" y="' + (y0) + '" font-size="22" fill="#6b7c8b" font-family="sans-serif">=</text>' +
      '<rect x="420" y="' + (y0 - 70) + '" width="150" height="150" rx="8" fill="#eaf3e6" stroke="#1f9d6b" stroke-width="3"/>' +
      '<text x="495" y="' + (y0 + 6) + '" text-anchor="middle" font-size="26" font-weight="700" fill="#1f9d6b" font-family="sans-serif">' +
      n(tMix, 1) + ' °C</text>' +
      '<text x="495" y="' + (y0 + 30) + '" text-anchor="middle" font-size="11" fill="#6b7c8b" font-family="sans-serif">смесь</text>' +
      '<text x="70" y="380" font-size="12" fill="#6b7c8b" font-family="sans-serif">c₁m₁(T − t₁) + c₂m₂(T − t₂) = 0</text>');
  }

  function drawChain() {
    var r = T.chainLosses(chosenSrc, chosenDev);
    var src = T.SOURCES[chosenSrc], dev = T.DEVICES[chosenDev];
    var boxes = '';
    if (!r.compatible) {
      boxes = '<text x="380" y="200" text-anchor="middle" font-size="15" font-weight="700" fill="#d64545" font-family="sans-serif">' +
        'Несовместимо: ' + esc(src.name) + ' → ' + esc(dev.name) + '</text>' +
        '<text x="380" y="230" text-anchor="middle" font-size="12" fill="#6b7c8b" font-family="sans-serif">' +
        'устройство рассчитано на ' + esc(dev.inKind) + '</text>';
    } else {
      boxes =
        '<rect x="60" y="170" width="150" height="90" rx="10" fill="#e8eef5" stroke="#1b3e8f" stroke-width="3"/>' +
        '<text x="135" y="205" text-anchor="middle" font-size="12" font-weight="700" fill="#1b3e8f" font-family="sans-serif">' + esc(src.name) + '</text>' +
        '<text x="135" y="228" text-anchor="middle" font-size="11" fill="#6b7c8b" font-family="sans-serif">' + n(r.pIn, 0) + ' Вт</text>' +
        '<path d="M215 215 L275 215" stroke="#2ea3dc" stroke-width="4" marker-end="url(#tArrow)"/>' +
        '<rect x="285" y="170" width="170" height="90" rx="10" fill="#eaf3fa" stroke="#2ea3dc" stroke-width="3"/>' +
        '<text x="370" y="205" text-anchor="middle" font-size="12" font-weight="700" fill="#1f4a76" font-family="sans-serif">' + esc(dev.name) + '</text>' +
        '<text x="370" y="228" text-anchor="middle" font-size="11" fill="#6b7c8b" font-family="sans-serif">КПД ' + n(r.eff * 100, 0) + ' %</text>' +
        '<path d="M460 215 L520 215" stroke="#2ea3dc" stroke-width="4" marker-end="url(#tArrow)"/>' +
        '<rect x="530" y="170" width="160" height="90" rx="10" fill="#eaf3e6" stroke="#1f9d6b" stroke-width="3"/>' +
        '<text x="610" y="205" text-anchor="middle" font-size="12" font-weight="700" fill="#1f9d6b" font-family="sans-serif">' +
        esc(sourceOutLabel(r)) + '</text>' +
        '<text x="610" y="228" text-anchor="middle" font-size="11" fill="#6b7c8b" font-family="sans-serif">' + n(r.pOut, 0) + ' Вт</text>' +
        '<text x="380" y="320" text-anchor="middle" font-size="12" fill="#a35c00" font-family="sans-serif">' +
        'Потери: ' + n(r.loss, 0) + ' Вт (' + n((1 - r.eff) * 100, 0) + ' %) — уходят в ' + esc(r.lossKind) + '</text>';
    }
    UI.html(svg(),
      '<defs><marker id="tArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">' +
      '<path d="M0 0 L10 5 L0 10 z" fill="#2ea3dc"/></marker></defs>' + boxes);
  }

  function sourceOutLabel(r) {
    if (r.pOut <= 0) return '—';
    return r.lossKind === 'нагрев среды' ? 'тепло' : 'полезная работа';
  }

  function drawHeat() {
    var q = T.heatEnergy(T.C_WATER, heater.mass, 100 - heater.t0);
    var time = T.heatTime(heater.mass, 100 - heater.t0, heater.power, T.C_WATER);
    var fill = Math.min(1, 0.15 + heater.mass / 3 * 0.6);
    var done = heater.done;
    UI.html(svg(),
      '<text x="60" y="60" font-size="13" font-weight="700" fill="#1b3e8f" font-family="sans-serif">Нагрев воды: Q = cmΔT</text>' +
      '<rect x="250" y="120" width="260" height="200" rx="14" fill="#eaf3fa" stroke="#8fb4cc" stroke-width="4"/>' +
      '<rect x="254" y="' + (320 - 196 * fill).toFixed(1) + '" width="252" height="' + (196 * fill).toFixed(1) +
      '" rx="10" fill="' + (done ? '#f7b98a' : '#bcdcf0') + '"/>' +
      '<text x="380" y="215" text-anchor="middle" font-size="26" font-weight="700" fill="#1f4a76" font-family="sans-serif">' +
      (done ? '100 °C' : n(heater.t0, 0) + ' °C') + '</text>' +
      '<rect x="330" y="330" width="100" height="26" rx="8" fill="#f07d20"/>' +
      '<text x="380" y="348" text-anchor="middle" font-size="12" fill="#fff" font-family="sans-serif">' +
      n(heater.power, 0) + ' Вт</text>' +
      '<text x="380" y="420" text-anchor="middle" font-size="12" fill="#1f4a76" font-family="sans-serif">' +
      'Q = ' + n(q / 1000, 0) + ' кДж · время ' + n(time, 0) + ' с (' + n(time / 60, 1) + ' мин)</text>');
  }

  function draw() {
    if (mode === 'gas') drawGas();
    else if (mode === 'mix') drawMix();
    else if (mode === 'heat') drawHeat();
    else drawChain();
    renderReadout();
  }

  /* ---------- управление ---------- */

  var chosenSrc = 'sun', chosenDev = 'panel';
  // нагреватель воды: Q = cmΔT, время = Q/P
  var heater = { mass: 1, t0: 20, power: 1000, done: false };
  var matC = { water: T.C_WATER, alu: T.C_ALU, iron: T.C_IRON };

  function bindRange(id, out, fmt, fn) {
    $(id).oninput = function () {
      UI.text($(out), fmt(parseFloat(this.value)));
      if (fn) fn(parseFloat(this.value));
      draw();
    };
  }
  bindRange('tV', 'tVv', function (v) { return n(v) + ' л'; }, function (v) { gas.volume = v; });
  bindRange('tT', 'tTv', function (v) { return n(v, 0) + ' К'; }, function (v) { gas.temp = v; });
  bindRange('tN', 'tNv', function (v) { return n(v, 2) + ' моль'; }, function (v) { gas.moles = v; });
  bindRange('tHm', 'tHmv', function (v) { return n(v, 2) + ' кг'; }, function (v) { cal.mHot = v; });
  bindRange('tHt', 'tHtv', function (v) { return n(v, 0) + ' °C'; }, function (v) { cal.tHot = v; });
  bindRange('tCm', 'tCmv', function (v) { return n(v, 2) + ' кг'; }, function (v) { cal.mCold = v; });
  bindRange('tCt', 'tCtv', function (v) { return n(v, 0) + ' °C'; }, function (v) { cal.tCold = v; });
  bindRange('tWm', 'tWmv', function (v) { return n(v, 2) + ' кг'; }, function (v) { heater.mass = v; });
  bindRange('tW0', 'tW0v', function (v) { return n(v, 0) + ' °C'; }, function (v) { heater.t0 = v; });
  bindRange('tPw', 'tPwv', function (v) { return n(v, 0) + ' Вт'; }, function (v) { heater.power = v; });

  $('tHeat').onchange = function () { gas.heatOn = this.checked; draw(); };
  $('tCool').onchange = function () { gas.coolOn = this.checked; draw(); };
  $('tPlay').onchange = function () { playing = this.checked; };

  [].forEach.call($('tKind').children, function (b) {
    b.onclick = function () {
      [].forEach.call($('tKind').children, function (x) { x.classList.toggle('active', x === b); });
      gas.particle = b.dataset.kind;
      draw();
    };
  });

  [].forEach.call($('tMat').children, function (b) {
    b.onclick = function () {
      [].forEach.call($('tMat').children, function (x) { x.classList.toggle('active', x === b); });
      cal.cHot = matC[b.dataset.mat];
      draw();
    };
  });

  [].forEach.call($('tSrc').children, function (b) {
    b.onclick = function () {
      [].forEach.call($('tSrc').children, function (x) { x.classList.toggle('active', x === b); });
      chosenSrc = b.dataset.src;
      draw();
    };
  });
  [].forEach.call($('tDev').children, function (b) {
    b.onclick = function () {
      [].forEach.call($('tDev').children, function (x) { x.classList.toggle('active', x === b); });
      chosenDev = b.dataset.dev;
      draw();
    };
  });

  [].forEach.call($('tMode').children, function (b) {
    b.onclick = function () {
      [].forEach.call($('tMode').children, function (x) { x.classList.toggle('active', x === b); });
      mode = b.dataset.mode;
      $('tGasBox').hidden = mode !== 'gas';
      $('tMixBox').hidden = mode !== 'mix';
      $('tHeatBox').hidden = mode !== 'heat';
      $('tChainBox').hidden = mode !== 'chain';
      draw();
    };
  });

  /* ---------- показания ---------- */

  function readoutLabels(cap, kind, k1, k2, k3, k4) {
    UI.text($('tCapMain'), cap);
    UI.text($('tCapKind'), kind);
    UI.text($('tK1'), k1);
    UI.text($('tK2'), k2);
    UI.text($('tK3'), k3);
    UI.text($('tK4'), k4);
  }

  function renderReadout() {
    if (mode === 'gas') {
      var p = T.gasPressure(gas), mol = T.gasMolecule(gas);
      UI.text($('tLcdP'), n(p, 1));
      readoutLabels('ДАВЛЕНИЕ, кПа', 'газ', 'Температура', 'Объём', 'p·V', 'Скорость молекул');
      UI.text($('tLcdSub'), 'p = nRT/V');
      UI.text($('tTemp'), n(gas.temp, 0) + ' К');
      UI.text($('tVol'), n(gas.volume, 1) + ' л');
      UI.text($('tPV'), n(p * gas.volume, 0) + ' Дж');
      UI.text($('tSpd'), n(mol.speed, 0) + ' м/с');
      UI.html($('tRead'),
        '<div class="row"><span>Давление</span><b>' + n(p, 1) + ' кПа</b></div>' +
        '<div class="row"><span>Внутренняя энергия</span><b>' + n(T.gasInternal(gas), 0) + ' Дж</b></div>' +
        '<div class="row"><span>Молекул в сосуде</span><b>' + n(gas.moles * T.N_A / 1e22, 2) + '·10²²</b></div>' +
        '<div class="tiny muted" style="margin-top:6px">При постоянной температуре p·V = const (Бойль — Мариотт).</div>');
    } else if (mode === 'heat') {
      var q = T.heatEnergy(T.C_WATER, heater.mass, 100 - heater.t0);
      var time = T.heatTime(heater.mass, 100 - heater.t0, heater.power, T.C_WATER);
      UI.text($('tLcdP'), n(q / 1000, 0));
      readoutLabels('НУЖНО, кДж', 'нагрев',
        'Начальная t°', 'Масса воды', 'Время до 100 °C', 'Мощность');
      UI.text($('tLcdSub'), 'Q = cmΔT');
      UI.text($('tTemp'), n(heater.t0, 0) + ' °C');
      UI.text($('tVol'), n(heater.mass, 2) + ' кг');
      UI.text($('tPV'), n(time, 0) + ' с');
      UI.text($('tSpd'), n(heater.power, 0) + ' Вт');
      UI.html($('tRead'),
        '<div class="row"><span>Масса воды</span><b>' + n(heater.mass, 2) + ' кг</b></div>' +
        '<div class="row"><span>Нужно энергии</span><b>' + n(q / 1000, 0) + ' кДж</b></div>' +
        '<div class="row"><span>Время при ' + n(heater.power, 0) + ' Вт</span><b>' + n(time / 60, 1) + ' мин</b></div>' +
        '<div class="tiny muted" style="margin-top:6px">Q = cmΔT: чтобы нагреть литр воды на 80 градусов, нужно 336 кДж.</div>');
    } else if (mode === 'mix') {
      var tMix = T.mixTemperature(cal);
      UI.text($('tLcdP'), n(tMix, 1));
      readoutLabels('СМЕСЬ, °C', 'смешивание',
        'Горячая вода', 'Всего воды', 'Отдала энергия', 'Итог');
      UI.text($('tLcdSub'), 'баланс энергии');
      UI.text($('tTemp'), n(cal.tHot, 0) + ' °C');
      UI.text($('tVol'), n(cal.mHot + cal.mCold, 2) + ' кг');
      UI.text($('tPV'), n(T.heatEnergy(cal.cHot, cal.mHot, cal.tHot - tMix), 0) + ' Дж');
      UI.text($('tSpd'), n(tMix, 1) + ' °C');
      UI.html($('tRead'),
        '<div class="row"><span>Температура смеси</span><b>' + n(tMix, 1) + ' °C</b></div>' +
        '<div class="row"><span>Отдала горячая</span><b>' + n(T.heatEnergy(cal.cHot, cal.mHot, cal.tHot - tMix), 0) + ' Дж</b></div>' +
        '<div class="row"><span>Приняла холодная</span><b>' + n(T.heatEnergy(cal.cCold, cal.mCold, tMix - cal.tCold), 0) + ' Дж</b></div>' +
        '<div class="tiny muted" style="margin-top:6px">Сколько энергии отдано, столько и принято.</div>');
    } else {
      var r = T.chainLosses(chosenSrc, chosenDev);
      UI.text($('tLcdP'), r.compatible ? n(r.pOut, 0) : '—');
      readoutLabels('ПОЛЕЗНАЯ, Вт', 'цепочка',
        'На входе', 'Потери', 'КПД', 'Вид потерь');
      UI.text($('tLcdSub'), 'КПД ' + (r.compatible ? n(r.eff * 100, 0) + ' %' : 'несовместимо'));
      UI.text($('tTemp'), r.compatible ? n(r.pIn, 0) + ' Вт' : '—');
      UI.text($('tVol'), r.compatible ? n(r.loss, 0) + ' Вт' : '—');
      UI.text($('tPV'), r.compatible ? n(r.eff * 100, 0) + ' %' : '—');
      UI.text($('tSpd'), r.compatible ? esc(r.lossKind) : '—');
      UI.html($('tRead'), r.compatible
        ? '<div class="row"><span>На входе</span><b>' + n(r.pIn, 0) + ' Вт</b></div>' +
          '<div class="row"><span>Полезная мощность</span><b>' + n(r.pOut, 0) + ' Вт</b></div>' +
          '<div class="row"><span>Потери</span><b>' + n(r.loss, 0) + ' Вт</b></div>' +
          '<div class="tiny muted" style="margin-top:6px">КПД = полезная / затраченная. Остальное уходит в тепло.</div>'
        : '<div class="muted" style="font-size:12px">Источник и устройство несовместимы по виду энергии.</div>');
    }
  }

  /* ---------- протокол ---------- */

  function sample() {
    if (mode === 'gas') {
      var mol = T.gasMolecule(gas);
      var rec = { kind: 'gas', v: gas.volume, p: T.gasPressure(gas), t: gas.temp, moles: gas.moles };
      lab.measures.push(rec);
      lab.measures.push({ kind: 'particle', particle: gas.particle, speed: mol.speed, t: gas.temp });
      log('ok', 'Газ: V = ' + n(gas.volume) + ' л, T = ' + n(gas.temp, 0) + ' К → p = ' + n(rec.p, 1) + ' кПа');
    } else if (mode === 'mix') {
      var tMix = T.mixTemperature(cal);
      lab.measures.push({ kind: 'mix', tMix: tMix, mHot: cal.mHot, tHot: cal.tHot, mCold: cal.mCold, tCold: cal.tCold });
      log('ok', 'Смесь: ' + n(tMix, 1) + ' °C');
    } else if (mode === 'heat') {
      var qh = T.heatEnergy(T.C_WATER, heater.mass, 100 - heater.t0);
      heater.done = true;
      lab.measures.push({ kind: 'heat', q: qh, mass: heater.mass, t0: heater.t0, power: heater.power });
      log('ok', 'Нагрев: ' + n(heater.mass, 2) + ' кг с ' + n(heater.t0, 0) + ' °C → Q = ' + n(qh / 1000, 0) + ' кДж');
    } else {
      var r = T.chainLosses(chosenSrc, chosenDev);
      if (!r.compatible) { log('warn', 'Цепочка несовместима — точка не снята'); return; }
      // итоговый КПД: для света → панель → потребитель считаем каскад звеньев
      var eff = r.eff;
      if (chosenSrc === 'sun' && chosenDev === 'panel') eff = r.eff * T.DEVICES.heater.eff;
      lab.measures.push({ kind: 'chain', src: chosenSrc, dev: chosenDev, eff: eff, totalEff: eff,
        pIn: r.pIn, pOut: r.pOut });
      log('ok', 'Цепочка ' + T.SOURCES[chosenSrc].name + ' → ' + T.DEVICES[chosenDev].name +
        ': итоговый КПД ' + n(eff * 100, 0) + ' %');
    }
    renderMeasurements();
    syncTask(false);
    draw();
  }

  function renderMeasurements() {
    var box = $('tTabMeas');
    UI.text($('tCount'), lab.measures.length || '');
    if (!lab.measures.length) {
      UI.html(box, '<div class="empty-note">Настройте опыт и нажмите «Снять точку».</div>');
      return;
    }
    var kinds = { gas: 'газ', particle: 'молекулы', mix: 'смесь', chain: 'цепочка', heat: 'нагрев' };
    UI.html(box, '<table class="ttable"><thead><tr><th>Опыт</th><th>Параметры</th><th>Результат</th></tr></thead><tbody>' +
      lab.measures.map(function (r) {
        var p = '', res = '';
        if (r.kind === 'gas') { p = 'V = ' + n(r.v) + ' л, T = ' + n(r.t, 0) + ' К'; res = 'p = ' + n(r.p, 1) + ' кПа, pV = ' + n(r.p * r.v, 0); }
        if (r.kind === 'particle') { p = r.particle === 'heavy' ? 'Xe, 300 К' : 'N₂, 300 К'; res = 'v = ' + n(r.speed, 0) + ' м/с'; }
        if (r.kind === 'mix') { p = n(r.mHot, 2) + ' кг · ' + n(r.tHot, 0) + ' °C + ' + n(r.mCold, 2) + ' кг · ' + n(r.tCold, 0) + ' °C'; res = n(r.tMix, 1) + ' °C'; }
        if (r.kind === 'heat') { p = n(r.mass, 2) + ' кг, ' + n(r.t0, 0) + ' → 100 °C, ' + n(r.power, 0) + ' Вт'; res = 'Q = ' + n(r.q / 1000, 0) + ' кДж'; }
        if (r.kind === 'chain') { p = esc(T.SOURCES[r.src].name) + ' → ' + esc(T.DEVICES[r.dev].name); res = 'КПД ' + n(r.eff * 100, 0) + ' %, ' + n(r.pOut, 0) + ' Вт'; }
        return '<tr><td>' + (kinds[r.kind] || r.kind) + '</td><td>' + p + '</td><td>' + res + '</td></tr>';
      }).join('') + '</tbody></table>');
  }

  $('tCsv').onclick = function () {
    var lines = ['Опыт;Параметры;Результат'];
    lab.measures.forEach(function (r) {
      lines.push([r.kind, r.v || r.mHot || r.src || '', r.p || r.tMix || r.eff || r.speed || ''].join(';'));
    });
    var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'thermal-protocol.csv';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  };
  $('tSample').onclick = sample;
  $('tMixGo').onclick = function () { sample(); };
  $('tHeatGo').onclick = function () {
    heater.done = true;
    sample();
  };
  $('tChainGo').onclick = function () { sample(); };

  /* ---------- задания ---------- */

  function syncTask(show) {
    var tk = T.TASKS[taskIndex];
    var f = T.facts(lab);
    var okNow = false;
    try { okNow = tk.check(f); } catch (e) { okNow = false; }
    if (okNow && !solved[taskIndex]) {
      solved[taskIndex] = tk.stars(f);
      renderTask();
      log('ok', '★ Задание «' + tk.t + '» выполнено (' + solved[taskIndex] + ' из 3)');
    }
    if (show) {
      UI.html($('tCheckOut'), okNow
        ? '<div class="hintline">✅ Условие выполнено' + (solved[taskIndex] ? ' — ' + '★'.repeat(solved[taskIndex]) : '') + '</div>'
        : '<div class="hintline">Пока не выполнено: ' + esc(tk.goal) + '</div>');
    }
  }

  function renderTask() {
    var tk = T.TASKS[taskIndex];
    var done = solved[taskIndex];
    UI.text($('tTaskId'), (taskIndex + 1) + ' / ' + T.TASKS.length);
    UI.html($('tTaskBody'),
      '<div class="goal"><b>' + esc(tk.t) + '</b><br>' + esc(tk.goal) + '</div>' +
      '<ol>' + tk.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      (done ? '<div class="checkout"><div class="hintline">' + '★'.repeat(done) + ' ' + esc(tk.why) + '</div></div>' : '') +
      '<div class="row" style="gap:6px;margin-top:6px">' +
      '<button class="btn ghost tiny" id="tHint">Подсказка</button>' +
      '<button class="btn primary tiny" id="tCheck">Проверить</button></div>' +
      '<div class="checkout" id="tCheckOut"></div>');
    UI.html($('tTaskList'), T.TASKS.map(function (t, i) {
      return '<button data-i="' + i + '" class="' + (i === taskIndex ? 'active ' : '') + (solved[i] ? 'done' : '') + '">' +
        '<span class="num">' + (solved[i] ? '★' : (i + 1)) + '</span><span>' + esc(t.t) + '</span></button>';
    }).join(''));
    $('tHint').onclick = function () {
      tk._h = tk._h || 0;
      var hint = tk.hints[tk._h % tk.hints.length];
      tk._h++;
      UI.html($('tCheckOut'), '<div class="hintline">💡 ' + esc(hint) + '</div>');
    };
    $('tCheck').onclick = function () { syncTask(true); };
    [].forEach.call($('tTaskList').children, function (b) {
      b.onclick = function () { taskIndex = +b.dataset.i; renderTask(); };
    });
  }

  /* ---------- журнал (в консоль стенда, чтобы не занимать сцену) ---------- */

  var logRows = [];
  function log(kind, text) {
    logRows.push({ kind: kind, text: text, d: new Date() });
    if (logRows.length > 60) logRows.shift();
    var el = $('tLcdSub');
    if (el && kind === 'ok') UI.text(el, text.length > 42 ? text.slice(0, 42) + '…' : text);
  }

  /* ---------- анимация ---------- */

  function frame(ts) {
    var dt = lastFrame ? Math.min(0.05, (ts - lastFrame) / 1000) : 0.016;
    lastFrame = ts;
    if (window.__bench === 'thermal' && playing && mode === 'gas') {
      if (gas.heatOn || gas.coolOn || Math.abs(gas.temp - 300) > 0.5) {
        T.stepGas(gas, dt * 8);       // ускоренное время: 1 с ≈ 8 с опыта
        // сцену и приборы перерисовываем ~6 раз в секунду, а не каждый кадр
        heatTick += dt;
        if (heatTick > 0.16) { heatTick = 0; drawGas(0.16); renderReadout(); }
      }
    }
    requestAnimationFrame(frame);
  }

  /* ---------- старт ---------- */

  draw();
  renderTask();
  renderMeasurements();
  requestAnimationFrame(frame);

  window.__thermal = {
    lab: lab, gas: function () { return gas; }, cal: function () { return cal; },
    facts: function () { return T.facts(lab); }, sample: sample,
    solved: function () { return solved; }, T: T,
    mode: function (m) { var b = $('tMode').querySelector('[data-mode="' + m + '"]'); if (b) b.click(); }
  };
})();

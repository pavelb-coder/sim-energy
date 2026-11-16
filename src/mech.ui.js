/* ============================================================
   Энерджиквантум · mech.ui.js
   Интерфейс стенда «Механика и энергия»: горка, маятник, пружина.
   Оформление — как у остальных стендов (Horizon-палитра, ЖК-табло).
   ============================================================ */
(function () {
  'use strict';
  var M = window.Mech;
  if (!M || !document.getElementById('benchMech')) return;

  var $ = function (id) { return document.getElementById(id); };
  var lab = M.createLab();
  var sk = null, pd = null, sp = null;
  var scene = 'skate';                       // skate | pendulum | spring
  var solved = {}, taskIndex = 0, playing = true, speed = 1;
  var tickTask = 0, lastFrame = 0;

  function n(v, d) { return Number(v || 0).toFixed(d === undefined ? 1 : d).replace('.', ','); }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  var css = document.createElement('style');
  UI.text(css, `
  .mech main{display:grid;grid-template-columns:250px minmax(420px,1fr) 320px;gap:10px;padding:10px;min-height:0}
  .mech .lctl{overflow:auto}
  .mech .fld{margin-bottom:9px;padding:0 9px}
  .mech .fld .top{display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);margin-bottom:3px}
  .mech .fld .top b{color:var(--ink);font-variant-numeric:tabular-nums}
  .mech .seg{display:flex;gap:2px;background:#e8eef5;border-radius:8px;padding:2px;margin:0 9px 9px}
  .mech .seg button{flex:1;padding:4px 2px;font-size:11px;border-radius:5px;color:var(--muted)}
  .mech .seg button.active{background:#fff;color:var(--accent);font-weight:700;box-shadow:0 1px 3px rgba(20,40,90,.16)}
  .mech .chk{display:flex;align-items:center;gap:7px;font-size:12px;padding:3px 9px}
  .mech .chk input{width:15px;height:15px;accent-color:var(--accent)}
  .mstage{position:relative;flex:1;min-height:0;border-radius:var(--r);border:1px solid #c4d0da;background:#f4f8fb;overflow:hidden}
  .mstage svg{width:100%;height:100%;display:block}
  .mech .bottombar.collapsed{height:36px!important;flex:0 0 36px}
  .mech .bottombar.collapsed .tabbody{display:none}
  .mech .mtable{width:100%;border-collapse:collapse;font-size:11px}
  .mech .mtable th,.mech .mtable td{padding:3px 8px;text-align:right;border-bottom:1px solid #eef2f6}
  .mech .mtable th{color:var(--muted);font-weight:600;position:sticky;top:0;background:#fff}
  .mech .mtable th:first-child,.mech .mtable td:first-child{text-align:left}
  .mech .energy{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;padding:9px}
  .mech .energy .cell{background:#f6f9fc;border:1px solid #d7e2ec;border-radius:9px;padding:5px 7px}
  .mech .energy .k{font-size:9.5px;letter-spacing:.4px;color:var(--muted);text-transform:uppercase}
  .mech .energy .v{font-size:15px;font-weight:700;font-variant-numeric:tabular-nums}
  .mech .energy .v small{font-size:10px;color:var(--muted)}
  .mech .row{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:5px;font-size:12px}
  .mech .row b{font-variant-numeric:tabular-nums}
  .mech .tiny{font-size:11px;line-height:1.45}
  .mech .taskitem{padding:4px 7px;font-size:11.5px}
  @media (max-width:1180px){.mech main{grid-template-columns:226px minmax(360px,1fr) 296px}}
  @media (max-width:980px){.mech main{grid-template-columns:1fr}.mstage{min-height:360px}}
  @media (max-height:860px){.mstage{min-height:260px}}
  `);
  document.head.appendChild(css);

  var main = $('benchMech');
  main.className = 'mech';

  UI.html(main, `
    <aside class="panel lctl">
      <h2>Опыт</h2>
      <div class="seg" id="mScene">
        <button data-scene="skate" class="active">Горка</button>
        <button data-scene="pendulum">Маятник</button>
        <button data-scene="spring">Пружина</button>
      </div>

      <div id="mSkateBox">
        <div class="fld"><div class="top"><span>Высота горки</span><b id="mHv">4,0 м</b></div>
          <input type="range" id="mH" min="1" max="8" step="0.5" value="4"></div>
        <div class="fld"><div class="top"><span>Масса груза</span><b id="mMv">60 кг</b></div>
          <input type="range" id="mM" min="10" max="120" step="5" value="60"></div>
        <div class="fld"><div class="top"><span>Трение</span><b id="mFv">0,002</b></div>
          <input type="range" id="mF" min="0" max="0.05" step="0.001" value="0.002"></div>
        <div class="seg" id="mShape">
          <button data-shape="valley" class="active">Ложбина</button>
          <button data-shape="ramp">Спуск</button>
          <button data-shape="hill">Горб</button>
        </div>
        <div class="chk"><input type="checkbox" id="mGrav" checked><label for="mGrav">Гравитация включена</label></div>
        <div class="chk"><input type="checkbox" id="mFree"><label for="mFree">Свободное падение с высоты 20 м</label></div>
        <button class="btn primary" id="mDrop" style="margin:6px 9px 10px;width:calc(100% - 18px)">Пустить груз</button>
      </div>

      <div id="mPendBox" hidden>
        <div class="fld"><div class="top"><span>Длина нити</span><b id="mLv">1,00 м</b></div>
          <input type="range" id="mL" min="0.2" max="4" step="0.1" value="1"></div>
        <div class="fld"><div class="top"><span>Масса груза</span><b id="mPmv">1,0 кг</b></div>
          <input type="range" id="mPm" min="0.2" max="5" step="0.1" value="1"></div>
        <div class="fld"><div class="top"><span>Начальный угол</span><b id="mAv">20°</b></div>
          <input type="range" id="mA" min="5" max="80" step="1" value="20"></div>
        <div class="fld"><div class="top"><span>Затухание</span><b id="mDv">0,002</b></div>
          <input type="range" id="mD" min="0" max="0.05" step="0.001" value="0.002"></div>
        <button class="btn primary" id="mSwing" style="margin:6px 9px 10px;width:calc(100% - 18px)">Запустить маятник</button>
      </div>

      <div id="mSpringBox" hidden>
        <div class="fld"><div class="top"><span>Жёсткость пружины</span><b id="mKv">20 Н/м</b></div>
          <input type="range" id="mK" min="5" max="200" step="5" value="20"></div>
        <div class="fld"><div class="top"><span>Масса груза</span><b id="mSmv">0,20 кг</b></div>
          <input type="range" id="mSm" min="0.05" max="2" step="0.05" value="0.2"></div>
        <div class="fld"><div class="top"><span>Начальное смещение</span><b id="mXv">20 см</b></div>
          <input type="range" id="mX" min="1" max="30" step="1" value="20"></div>
        <div class="fld"><div class="top"><span>Затухание</span><b id="mSdv">0,05</b></div>
          <input type="range" id="mSd" min="0" max="1" step="0.01" value="0.05"></div>
        <button class="btn primary" id="mPull" style="margin:6px 9px 10px;width:calc(100% - 18px)">Отпустить груз</button>
      </div>

      <h2>Время</h2>
      <div class="seg" id="mSpeed">
        <button data-speed="0.25">×0,25</button>
        <button data-speed="1" class="active">×1</button>
        <button data-speed="2">×2</button>
      </div>
      <div class="chk"><input type="checkbox" id="mPlay" checked><label for="mPlay">Модель идёт</label></div>
      <button class="btn" id="mSample" style="margin:8px 9px;width:calc(100% - 18px)">＋ Снять точку</button>
    </aside>

    <section class="stagewrap">
      <div class="mstage" id="mStage">
        <svg id="mSvg" viewBox="0 0 760 470" preserveAspectRatio="xMidYMid meet"></svg>
      </div>
      <div class="bottombar panel">
        <div class="tabs">
          <button class="active" data-tab="meas">Протокол <span class="badge" id="mCount"></span></button>
          <div class="grow"></div>
          <button class="btn ghost tiny" id="mCsv" style="margin:4px 6px 4px 0">Экспорт CSV</button>
        </div>
        <div class="tabbody" id="mTabMeas"></div>
      </div>
    </section>

    <aside class="right">
      <div class="card task">
        <h2>Задание <span class="badge" id="mTaskId">1 / 8</span></h2>
        <div class="body" id="mTaskBody"></div>
        <div class="tasklist" id="mTaskList"></div>
      </div>

      <div class="card">
        <h2>Энергия</h2>
        <div style="padding:9px 9px 0">
          <div class="lcd" style="text-align:center">
            <div class="cap"><span>E ПОЛНАЯ, Дж</span><span id="mCapKind">горка</span></div>
            <div class="main" id="mLcdE">0</div>
            <div class="sub" id="mLcdSub">потенциальная + кинетическая</div>
          </div>
        </div>
        <div class="energy">
          <div class="cell"><div class="k">E кин.</div><div class="v" id="mEk">0 <small>Дж</small></div></div>
          <div class="cell"><div class="k">E пот.</div><div class="v" id="mEp">0 <small>Дж</small></div></div>
          <div class="cell"><div class="k">Скорость</div><div class="v" id="mV">0 <small>м/с</small></div></div>
          <div class="cell"><div class="k">Высота</div><div class="v" id="mY">0 <small>м</small></div></div>
        </div>
      </div>

      <div class="card">
        <h2>Показания</h2>
        <div class="body" id="mRead">
          <div class="muted" style="font-size:12px">Выберите опыт слева и запустите модель.</div>
        </div>
      </div>
    </aside>
  `);

  /* ---------- сцена ---------- */

  function svg() { return $('mSvg'); }

  function drawFreeFall() {
    var yTop = 90, yGround = 420;
    var y = yTop + (1 - sk.y / 20) * (yGround - yTop);
    UI.html(svg(),
      ground(yGround) +
      '<line x1="120" y1="' + yTop + '" x2="660" y2="' + yTop + '" stroke="#b8c9d6" stroke-dasharray="6 6"/>' +
      '<text x="120" y="' + (yTop - 8) + '" font-size="11" fill="#6b7c8b" font-family="sans-serif">20 м</text>' +
      '<g id="mSkaterG"><circle cx="0" cy="0" r="15" fill="#f07d20" stroke="#1b3e8f" stroke-width="3"/>' +
      '<circle cx="0" cy="0" r="5" fill="#fff"/></g>' +
      '<text id="mSkaterT" x="0" y="0" text-anchor="middle" font-size="12" font-weight="700" fill="#1b3e8f" font-family="sans-serif"></text>' +
      '<text x="380" y="450" text-anchor="middle" font-size="11" fill="#6b7c8b" font-family="sans-serif">' +
      'свободное падение: a = g, масса не важна</text>');
    var g = $('mSkaterG');
    if (g) UI.attr(g, 'transform', 'translate(390,' + (y - 16).toFixed(1) + ')');
    var t = $('mSkaterT');
    if (t) {
      t.setAttribute('x', '390'); t.setAttribute('y', (y - 38).toFixed(1));
      t.textContent = n(Math.abs(sk.v), 1) + ' м/с · ' + n(sk.y, 1) + ' м';
    }
  }

  function drawScene() {
    var free = $('mFree') && $('mFree').checked;
    if (scene === 'skate' && free) { drawFreeFall(); return; }
    if (scene === 'skate') drawSkate();
    else if (scene === 'pendulum') drawPendulum();
    else drawSpring();
  }

  function ground(y) {
    return '<rect x="0" y="' + y + '" width="760" height="' + (470 - y) + '" fill="#dfe9f2"/>' +
      '<line x1="0" y1="' + y + '" x2="760" y2="' + y + '" stroke="#b8c9d6" stroke-width="2"/>';
  }

  function drawSkate() {
    var prof = sk.profile;
    var W = 620, H = 320, x0 = 70, y0 = 420;
    var pts = [];
    for (var i = 0; i <= 80; i++) {
      var x = prof.length * i / 80;
      var y = M.trackHeight(prof, x);
      pts.push([x0 + (x / prof.length) * W, y0 - (y / Math.max(1, prof.height)) * H]);
    }
    var path = 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L');
    UI.html(svg(),
      '<defs><linearGradient id="mTrackG" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#8fc7e8"/><stop offset="100%" stop-color="#2e7fb8"/></linearGradient></defs>' +
      ground(y0 + 4) +
      '<path d="' + path + ' L' + (x0 + W) + ' ' + (y0 + 4) + ' L' + x0 + ' ' + (y0 + 4) + ' Z" fill="url(#mTrackG)" opacity=".35"/>' +
      '<path d="' + path + '" fill="none" stroke="#2e7fb8" stroke-width="5" stroke-linecap="round"/>' +
      '<g id="mSkaterG"><circle cx="0" cy="0" r="14" fill="#f07d20" stroke="#1b3e8f" stroke-width="3"/>' +
      '<circle cx="0" cy="0" r="5" fill="#fff"/></g>' +
      '<text id="mSkaterT" x="0" y="0" text-anchor="middle" font-size="12" font-weight="700" fill="#1b3e8f" font-family="sans-serif"></text>' +
      '<text x="' + (x0 + W / 2) + '" y="455" text-anchor="middle" font-size="11" fill="#6b7c8b" font-family="sans-serif">' +
      'высота горки ' + n(prof.height) + ' м · трение ' + n(sk.friction, 3) + '</text>' +
      '<text x="' + x0 + '" y="60" font-size="12" font-weight="700" fill="#1f4a76" font-family="sans-serif">' +
      'полная энергия E = mgh + mv²/2</text>' +
      '<g id="mEbarG"><rect x="' + x0 + '" y="72" width="0" height="10" rx="5" fill="#2ea3dc"/></g>');
    moveSkater();
  }

  function moveSkater() {
    var g = $('mSkaterG');
    if (!g || !sk) return;
    var prof = sk.profile, W = 620, H = 320, x0 = 70, y0 = 420;
    var px = x0 + (sk.x / prof.length) * W;
    var py = y0 - (sk.y / Math.max(1, prof.height)) * H;
    UI.attr(g, 'transform', 'translate(' + px.toFixed(1) + ',' + (py - 16).toFixed(1) + ')');
    var t = document.getElementById('mSkaterT');
    if (t) {
      t.setAttribute('x', px.toFixed(1));
      t.setAttribute('y', (py - 38).toFixed(1));
      t.textContent = n(Math.abs(sk.v), 1) + ' м/с';
    }
    var bar = document.getElementById('mEbarG');
    if (bar) {
      var e = M.skaterEnergy(sk);
      var e0 = Math.max(1, sk.mass * M.G * sk.profile.height);
      bar.firstChild.setAttribute('width', Math.max(2, Math.min(620, 620 * e.total / e0)).toFixed(1));
    }
  }

  function drawPendulum() {
    var Lpx = 60 + (pd.L / 4) * 260;
    var cx = 380, cy = 90;
    UI.html(svg(),
      ground(420) +
      '<line x1="' + cx + '" y1="' + cy + '" x2="' + cx + '" y2="' + (cy + Lpx) + '" stroke="#6b7c8b" stroke-width="2"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="7" fill="#1b3e8f"/>' +
      '<g id="mBob"><circle cx="0" cy="0" r="' + (10 + Math.min(pd.mass, 5) * 3) + '" fill="#2ea3dc" stroke="#1b3e8f" stroke-width="3"/></g>' +
      '<g id="mRod"><line x1="0" y1="0" x2="0" y2="' + Lpx + '" stroke="#95a9b8" stroke-width="2"/></g>' +
      '<line id="mArc" x1="' + cx + '" y1="' + (cy + Lpx) + '" x2="' + cx + '" y2="' + (cy + Lpx) + '" stroke="#f07d20" stroke-width="2" stroke-dasharray="4 4"/>' +
      '<text x="' + cx + '" y="450" text-anchor="middle" font-size="11" fill="#6b7c8b" font-family="sans-serif">' +
      'L = ' + n(pd.L, 2) + ' м · m = ' + n(pd.mass) + ' кг · T ≈ ' + n(M.pendulumPeriod(pd.L, pd.theta), 2) + ' с</text>');
    moveBob();
  }

  function moveBob() {
    var bob = $('mBob'), rod = $('mRod');
    if (!bob || !pd) return;
    var Lpx = 60 + (pd.L / 4) * 260;
    var cx = 380, cy = 90;
    var bx = cx + Lpx * Math.sin(pd.theta), by = cy + Lpx * Math.cos(pd.theta);
    UI.attr(bob, 'transform', 'translate(' + bx.toFixed(1) + ',' + by.toFixed(1) + ')');
    UI.attr(rod, 'transform', 'translate(' + cx + ',' + cy + ') rotate(' + (pd.theta * 180 / Math.PI).toFixed(1) + ')');
    var arc = $('mArc');
    if (arc) {
      arc.setAttribute('x1', cx); arc.setAttribute('y1', cy + Lpx);
      arc.setAttribute('x2', bx.toFixed(1)); arc.setAttribute('y2', by.toFixed(1));
    }
  }

  var PX_PER_M = 300;   // масштаб сцены пружины

  function springGeom() {
    var ceilY = 86;
    var stretch = M.springStretch(sp.k, sp.mass);      // м, под весом груза
    var eqY = ceilY + 40 + stretch * PX_PER_M;         // положение равновесия
    var massY = eqY + sp.y * PX_PER_M;                 // с учётом колебаний
    return { ceilY: ceilY, eqY: eqY, massY: massY, stretch: stretch };
  }

  function coilsPath(y1, y2, kx) {
    var nC = 9, a = 24, span = Math.max(30, y2 - y1);
    var top = y1, bot = y2;
    var pts = [[kx, top]];
    var body = span - 18;
    for (var i = 0; i < nC * 2 + 1; i++) {
      var yy = top + 9 + body * (i + 0.5) / (nC * 2 + 1);
      pts.push([kx + (i % 2 === 0 ? -a : a), yy]);
    }
    pts.push([kx, bot - 9]);
    pts.push([kx, bot]);
    return '<polyline points="' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') +
      '" fill="none" stroke="#7ea9c4" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>';
  }

  function drawSpring() {
    var g = springGeom(), kx = 380;
    var body = '<text x="' + kx + '" y="450" text-anchor="middle" font-size="11" fill="#6b7c8b" font-family="sans-serif">' +
      'k = ' + n(sp.k, 0) + ' Н/м · статическое растяжение ' + n(g.stretch * 100, 1) + ' см · T ≈ ' +
      n(M.springPeriod(sp.k, sp.mass), 2) + ' с</text>';
    UI.html(svg(),
      ground(432) +
      '<rect x="' + (kx - 80) + '" y="' + (g.ceilY - 14) + '" width="160" height="14" rx="4" fill="#1b3e8f"/>' +
      '<line x1="120" y1="' + g.eqY.toFixed(1) + '" x2="260" y2="' + g.eqY.toFixed(1) + '" stroke="#b8c9d6" stroke-width="1" stroke-dasharray="5 5"/>' +
      '<text x="120" y="' + (g.eqY - 8).toFixed(1) + '" font-size="11" fill="#6b7c8b" font-family="sans-serif">равновесие</text>' +
      '<g id="mSpringBody"></g>' + body);
    renderSpringBody();
  }

  function renderSpringBody() {
    var box = $('mSpringBody');
    if (!box || !sp) return;
    var g = springGeom(), kx = 380, bw = 70, bh = 44;
    box.innerHTML = coilsPath(g.ceilY, g.massY, kx) +
      '<rect x="' + (kx - bw / 2) + '" y="' + (g.massY - 4).toFixed(1) + '" width="' + bw + '" height="' + bh +
      '" rx="8" fill="#f07d20" stroke="#1b3e8f" stroke-width="3"/>' +
      '<text x="' + kx + '" y="' + (g.massY + 22).toFixed(1) + '" text-anchor="middle" font-size="12" font-weight="700" ' +
      'fill="#fff" font-family="sans-serif">' + n(sp.mass, 2) + ' кг</text>';
  }

  function moveSpring() { renderSpringBody(); }

  /* ---------- управление ---------- */

  function resetSkater() {
    sk = M.createSkater({ shape: currentShape, length: 10, height: currentHeight }, currentMass);
    sk.friction = lab.friction;
    sk.gravityOn = $('mGrav').checked;
    if ($('mFree') && $('mFree').checked) {
      // свободное падение: груз не на трассе, стартует с высоты 20 м
      sk.track = false; sk.freeFall = true;
      sk.y = 20; sk.v = 0; sk.x = 0;
    }
    drawScene();
    renderReadout();
  }
  var currentShape = 'valley', currentHeight = 4, currentMass = 60;

  function resetPendulum() {
    pd = M.createPendulum({
      L: parseFloat($('mL').value), mass: parseFloat($('mPm').value),
      theta: parseFloat($('mA').value) * Math.PI / 180, damping: parseFloat($('mD').value)
    });
    drawScene();
    renderReadout();
  }

  function resetSpring() {
    sp = M.createSpring({
      k: parseFloat($('mK').value), mass: parseFloat($('mSm').value),
      // при 40 Н/м и смещении 10 см энергия колебаний всего 0,2 Дж — на дисплее «0»;
      // мягче пружина и больше начальное смещение дают читаемые 0,4 Дж
      y: parseFloat($('mX').value) / 100, damping: parseFloat($('mSd').value)
    });
    sp.y0 = sp.y;
    drawScene();
    renderReadout();
  }

  function bindRange(id, out, fmt, onInput) {
    $(id).oninput = function () {
      UI.text($(out), fmt(parseFloat(this.value)));
      if (onInput) onInput(parseFloat(this.value));
    };
  }

  bindRange('mH', 'mHv', function (v) { return n(v) + ' м'; }, function (v) { currentHeight = v; resetSkater(); });
  bindRange('mM', 'mMv', function (v) { return n(v, 0) + ' кг'; }, function (v) { currentMass = v; resetSkater(); });
  bindRange('mF', 'mFv', function (v) { return n(v, 3); }, function (v) { lab.friction = v; if (sk) sk.friction = v; drawScene(); });
  bindRange('mL', 'mLv', function (v) { return n(v, 2) + ' м'; }, function () { resetPendulum(); });
  bindRange('mPm', 'mPmv', function (v) { return n(v) + ' кг'; }, function () { resetPendulum(); });
  bindRange('mA', 'mAv', function (v) { return n(v, 0) + '°'; }, function () { resetPendulum(); });
  bindRange('mD', 'mDv', function (v) { return n(v, 3); }, function () { resetPendulum(); });
  bindRange('mK', 'mKv', function (v) { return n(v, 0) + ' Н/м'; }, function () { resetSpring(); });
  bindRange('mSm', 'mSmv', function (v) { return n(v, 2) + ' кг'; }, function () { resetSpring(); });
  bindRange('mX', 'mXv', function (v) { return n(v, 0) + ' см'; }, function () { resetSpring(); });
  bindRange('mSd', 'mSdv', function (v) { return n(v, 2); }, function () { resetSpring(); });

  $('mGrav').onchange = function () { if (sk) sk.gravityOn = this.checked; if (pd) pd.gravityOn = this.checked; };
  $('mFree').onchange = function () { resetSkater(); log('info', this.checked ? 'Режим свободного падения: высота 20 м' : 'Режим горки'); };
  $('mPlay').onchange = function () { playing = this.checked; };

  [].forEach.call($('mScene').children, function (b) {
    b.onclick = function () {
      [].forEach.call($('mScene').children, function (x) { x.classList.toggle('active', x === b); });
      scene = b.dataset.scene;
      $('mSkateBox').hidden = scene !== 'skate';
      $('mPendBox').hidden = scene !== 'pendulum';
      $('mSpringBox').hidden = scene !== 'spring';
      if (scene === 'skate') resetSkater();
      if (scene === 'pendulum') resetPendulum();
      if (scene === 'spring') resetSpring();
    };
  });

  [].forEach.call($('mShape').children, function (b) {
    b.onclick = function () {
      [].forEach.call($('mShape').children, function (x) { x.classList.toggle('active', x === b); });
      currentShape = b.dataset.shape;
      resetSkater();
    };
  });

  [].forEach.call($('mSpeed').children, function (b) {
    b.onclick = function () {
      [].forEach.call($('mSpeed').children, function (x) { x.classList.toggle('active', x === b); });
      speed = parseFloat(b.dataset.speed);
    };
  });

  $('mDrop').onclick = function () {
    resetSkater();
    if (!sk.track) {
      sk.y = 20; sk.v = 0;
      log('ok', 'Свободное падение с 20 м, масса ' + n(sk.mass, 0) + ' кг');
    } else {
      sk.x = 0.02; sk.y = M.trackHeight(sk.profile, 0.02); sk.v = 0;
      log('ok', 'Груз пущен с верхней точки: h = ' + n(sk.profile.height) + ' м, масса ' + n(sk.mass, 0) + ' кг');
    }
    playing = true; $('mPlay').checked = true;
  };
  $('mSwing').onclick = function () {
    resetPendulum();
    playing = true; $('mPlay').checked = true;
    log('ok', 'Маятник запущен: L = ' + n(pd.L, 2) + ' м, угол ' + n(pd.theta * 180 / Math.PI, 0) + '°');
  };
  $('mPull').onclick = function () {
    resetSpring();
    playing = true; $('mPlay').checked = true;
    log('ok', 'Груз отпущен: k = ' + n(sp.k, 0) + ' Н/м, m = ' + n(sp.mass, 2) + ' кг');
  };

  /* ---------- показания ---------- */

  function renderReadout() {
    var e;
    if (scene === 'skate') e = M.skaterEnergy(sk);
    else if (scene === 'pendulum') e = M.pendulumEnergy(pd);
    else e = M.springEnergy(sp);

    // у горки энергии сотни джоулей, у маятника и пружины — единицы:
    // округление до целых обнуляло показания
    var eDig = scene === 'skate' ? 0 : 2;
    UI.text($('mLcdE'), n(e.total, eDig));
    UI.text($('mEk'), n(e.Ekin, eDig) + ' Дж');
    UI.text($('mEp'), n(e.Epot, eDig) + ' Дж');
    UI.text($('mV'), n(e.speed, 1) + ' м/с');
    UI.text($('mY'), scene === 'spring' ? n(sp.y * 100, 1) + ' см' : n(e.y === undefined ? (e.h || 0) : e.y, 2) + ' м');
    UI.text($('mCapKind'), scene === 'skate'
      ? (sk.freeFall ? 'свободное падение' : 'горка')
      : (scene === 'pendulum' ? 'маятник' : 'пружина'));

    var read = '';
    if (scene === 'skate') {
      read = '<div class="row"><span>Скорость</span><b>' + n(Math.abs(sk.v), 2) + ' м/с</b></div>' +
        '<div class="row"><span>Высота над низом</span><b>' + n(sk.y, 2) + ' м</b></div>' +
        '<div class="row"><span>Полная энергия</span><b>' + n(e.total, eDig) + ' Дж</b></div>' +
        '<div class="row"><span>Трение</span><b>' + n(sk.friction, 3) + '</b></div>' +
        '<div class="tiny muted" style="margin-top:6px">E = mgh + mv²/2. При нулевом трении сумма не меняется.</div>';
    } else if (scene === 'pendulum') {
      var T = M.pendulumMeasured(pd);
      read = '<div class="row"><span>Угол</span><b>' + n(pd.theta * 180 / Math.PI, 1) + '°</b></div>' +
        '<div class="row"><span>Период (измерен)</span><b>' + (T > 0 ? n(T, 2) + ' с' : 'мало колебаний') + '</b></div>' +
        '<div class="row"><span>Период (формула)</span><b>' + n(M.pendulumPeriod(pd.L, Math.abs(pd.theta) || 0.26), 2) + ' с</b></div>' +
        '<div class="row"><span>Скорость груза</span><b>' + n(Math.abs(pd.omega * pd.L), 2) + ' м/с</b></div>' +
        '<div class="tiny muted" style="margin-top:6px">T = 2π√(L/g). Масса на период не влияет.</div>';
    } else {
      var Ts = M.springMeasured(sp);
      read = '<div class="row"><span>Смещение от равновесия</span><b>' + n(sp.y * 100, 1) + ' см</b></div>' +
        '<div class="row"><span>Сила Гука</span><b>' + n(Math.abs(M.hooke(sp.k, sp.y)) * -1, 2) + ' Н</b></div>' +
        '<div class="row"><span>Статическое растяжение</span><b>' + n(M.springStretch(sp.k, sp.mass) * 100, 1) + ' см</b></div>' +
        '<div class="row"><span>Период (измерен)</span><b>' + (Ts > 0 ? n(Ts, 2) + ' с' : 'мало колебаний') + '</b></div>' +
        '<div class="tiny muted" style="margin-top:6px">T = 2π√(m/k). Жёстче пружина — быстрее колебания.</div>';
    }
    UI.html($('mRead'), read);
  }

  /* ---------- протокол ---------- */

  function sample() {
    var f = M.facts(lab);
    var rec = { t: Date.now() / 1000, scene: scene };
    if (scene === 'skate') {
      var e = M.skaterEnergy(sk);
      var e0 = sk.mass * M.G * sk.profile.height;
      rec = Object.assign(rec, {
        kind: 'skate', mode: sk.track === false ? 'free' : 'track', freeFall: sk.track === false,
        speed: Math.max(Math.abs(sk.v), sk.vmax || 0), height: sk.profile.height, mass: sk.mass,
        loss: Math.max(0, 1 - e.total / Math.max(1, e0)), energy: e.total, friction: sk.friction
      });
    } else if (scene === 'pendulum') {
      rec = Object.assign(rec, {
        kind: 'pendulum', L: pd.L, mass: pd.mass, period: M.pendulumMeasured(pd),
        theta: pd.theta, damping: pd.damping
      });
    } else {
      rec = Object.assign(rec, {
        kind: 'spring', k: sp.k, mass: sp.mass, stretch: M.springStretch(sp.k, sp.mass),
        period: M.springMeasured(sp), y: sp.y
      });
    }
    lab.measures.push(rec);
    log('ok', 'Точка: ' + describe(rec));
    renderMeasurements();
    syncTask(false);
  }

  function describe(r) {
    if (r.kind === 'skate') return 'скорость ' + n(r.speed, 2) + ' м/с при высоте ' + n(r.height) + ' м';
    if (r.kind === 'pendulum') return 'период ' + n(r.period, 2) + ' с при длине ' + n(r.L, 2) + ' м';
    return 'период ' + n(r.period, 2) + ' с при m = ' + n(r.mass, 2) + ' кг';
  }

  function renderMeasurements() {
    var box = $('mTabMeas');
    UI.text($('mCount'), lab.measures.length || '');
    if (!lab.measures.length) {
      UI.html(box, '<div class="empty-note">Запустите опыт и нажмите «Снять точку».</div>');
      return;
    }
    UI.html(box, '<table class="mtable"><thead><tr><th>Опыт</th><th>Параметры</th><th>Результат</th></tr></thead><tbody>' +
      lab.measures.map(function (r) {
        var p = r.kind === 'skate' ? ('h = ' + n(r.height) + ' м, m = ' + n(r.mass, 0) + ' кг')
          : r.kind === 'pendulum' ? ('L = ' + n(r.L, 2) + ' м, m = ' + n(r.mass) + ' кг')
            : ('k = ' + n(r.k, 0) + ' Н/м, m = ' + n(r.mass, 2) + ' кг');
        return '<tr><td>' + ({ skate: 'горка', pendulum: 'маятник', spring: 'пружина' }[r.kind]) + '</td>' +
          '<td>' + p + '</td><td>' + describe(r) + '</td></tr>';
      }).join('') + '</tbody></table>');
  }

  $('mCsv').onclick = function () {
    var lines = ['Опыт;Параметры;Результат'];
    lab.measures.forEach(function (r) { lines.push([r.kind, r.height || r.L || r.k, describe(r)].join(';')); });
    var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mechanics-protocol.csv';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  };

  $('mSample').onclick = sample;

  /* ---------- задания ---------- */

  function syncTask(show) {
    var tk = M.TASKS[taskIndex];
    var f = M.facts(lab);
    var okNow = false;
    try { okNow = tk.check(f); } catch (e) { okNow = false; }
    if (okNow && !solved[taskIndex]) {
      solved[taskIndex] = tk.stars(f);
      renderTask();
      log('ok', '★ Задание «' + tk.t + '» выполнено (' + solved[taskIndex] + ' из 3)');
    }
    if (show) {
      UI.html($('mCheckOut'), okNow
        ? '<div class="hintline">✅ Условие выполнено' + (solved[taskIndex] ? ' — ' + '★'.repeat(solved[taskIndex]) : '') + '</div>'
        : '<div class="hintline">Пока не выполнено: ' + esc(tk.goal) + '</div>');
    }
  }

  function renderTask() {
    var tk = M.TASKS[taskIndex];
    var done = solved[taskIndex];
    UI.text($('mTaskId'), (taskIndex + 1) + ' / ' + M.TASKS.length);
    UI.html($('mTaskBody'),
      '<div class="goal"><b>' + esc(tk.t) + '</b><br>' + esc(tk.goal) + '</div>' +
      '<ol>' + tk.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      (done ? '<div class="checkout"><div class="hintline">★'.repeat(done) + ' ' + esc(tk.why) + '</div></div>' : '') +
      '<div class="row" style="gap:6px;margin-top:6px">' +
      '<button class="btn ghost tiny" id="mHint">Подсказка</button>' +
      '<button class="btn primary tiny" id="mCheck">Проверить</button></div>' +
      '<div class="checkout" id="mCheckOut"></div>');
    UI.html($('mTaskList'), M.TASKS.map(function (t, i) {
      return '<button data-i="' + i + '" class="' + (i === taskIndex ? 'active ' : '') + (solved[i] ? 'done' : '') + '">' +
        '<span class="num">' + (solved[i] ? '★' : (i + 1)) + '</span><span>' + esc(t.t) + '</span></button>';
    }).join(''));
    $('mHint').onclick = function () {
      tk._h = tk._h || 0;
      var hint = tk.hints[tk._h % tk.hints.length];
      tk._h++;
      UI.html($('mCheckOut'), '<div class="hintline">💡 ' + esc(hint) + '</div>');
    };
    $('mCheck').onclick = function () { syncTask(true); };
    [].forEach.call($('mTaskList').children, function (b) {
      b.onclick = function () { taskIndex = +b.dataset.i; renderTask(); };
    });
  }

  /* ---------- журнал ---------- */

  var logEl, logRows = [];
  function log(kind, text) {
    var row = { kind: kind, text: text, t: new Date() };
    logRows.push(row);
    if (logRows.length > 60) logRows.shift();
    renderLog();
  }
  function renderLog() {
    if (!logEl) return;
    UI.html(logEl, logRows.slice(-20).map(function (r) {
      return '<div class="jrow ' + r.kind + '"><span class="tm">' +
        (r.t.getHours() < 10 ? '0' : '') + r.t.getHours() + ':' + (r.t.getMinutes() < 10 ? '0' : '') + r.t.getMinutes() +
        '</span><span class="tx">' + esc(r.text) + '</span></div>';
    }).join(''));
    logEl.scrollTop = logEl.scrollHeight;
  }

  /* ---------- анимация ---------- */

  function frame(ts) {
    var dt = lastFrame ? Math.min(0.05, (ts - lastFrame) / 1000) : 0.016;
    lastFrame = ts;
    if (window.__bench === 'mech' && window.__benchVisible === 'mech' && playing) {
      var steps = Math.min(40, Math.round((dt * speed) / M.DT));
      for (var i = 0; i < steps; i++) {
        if (scene === 'skate' && sk) M.stepSkater(sk, M.DT);
        else if (scene === 'pendulum' && pd) M.stepPendulum(pd, M.DT);
        else if (scene === 'spring' && sp) M.stepSpring(sp, M.DT);
      }
      if (scene === 'skate' && sk && sk.track === false) drawFreeFall();
      else if (scene === 'skate') moveSkater();
      else if (scene === 'pendulum') moveBob();
      else moveSpring();
      // показания и проверка задания — 6 раз в секунду (раньше каждый кадр)
      readTick += dt;
      if (readTick > 0.16) { readTick = 0; renderReadout(); if (playing) syncTaskSilent(); }
    }
    requestAnimationFrame(frame);
  }
  var tick = 0, readTick = 0;
  function syncTaskSilent() {
    tick += 1;
    if (tick < 5) return;     // раз в ~0,8 с при вызове 6 раз в секунду
    tick = 0;
    var tk = M.TASKS[taskIndex];
    var f = M.facts(lab);
    if (!solved[taskIndex] && tk.check(f)) {
      solved[taskIndex] = tk.stars(f);
      renderTask();
    }
  }

  /* ---------- старт ---------- */

  resetSkater();
  renderTask();
  renderMeasurements();
  renderReadout();
  requestAnimationFrame(frame);

  window.__mech = {
    lab: lab, state: function () { return { scene: scene, sk: sk, pd: pd, sp: sp }; },
    facts: function () { return M.facts(lab); },
    sample: sample, solved: function () { return solved; }, M: M,
    scene: function (s) {
      var b = $('mScene').querySelector('[data-scene="' + s + '"]');
      if (b) b.click();
    }
  };
})();

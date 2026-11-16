/* ============================================================
   Энерджиквантум · optics.ui.js
   Интерфейс стенда «Свет и волны»: преломление, смешение цветов,
   дифракционная решётка, тонкая линза.
   ============================================================ */
(function () {
  'use strict';
  var O = window.Optics;
  if (!O || !document.getElementById('benchOptics')) return;

  var $ = function (id) { return document.getElementById(id); };
  var lab = O.createLab();
  var mode = 'refract';                    // refract | color | grating | lens
  var solved = {}, taskIndex = 0;

  var POL = { s: false, p: false, random: true, uni: false, beam: false };

  function n(v, d) { return Number(v || 0).toFixed(d === undefined ? 1 : d).replace('.', ','); }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  var css = document.createElement('style');
  UI.text(css, `
  .optics main{display:grid;grid-template-columns:250px minmax(420px,1fr) 320px;gap:10px;padding:10px;min-height:0}
  .optics .lctl{overflow:auto}
  .optics .fld{margin-bottom:9px;padding:0 9px}
  .optics .fld .top{display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);margin-bottom:3px}
  .optics .fld .top b{color:var(--ink);font-variant-numeric:tabular-nums}
  .optics .seg{display:flex;gap:2px;background:#e8eef5;border-radius:8px;padding:2px;margin:0 9px 9px}
  .optics .seg button{flex:1;padding:4px 2px;font-size:11px;border-radius:5px;color:var(--muted)}
  .optics .seg button.active{background:#fff;color:var(--accent);font-weight:700;box-shadow:0 1px 3px rgba(20,40,90,.16)}
  .optics .chk{display:flex;align-items:center;gap:7px;font-size:12px;padding:3px 9px}
  .optics .chk input{width:15px;height:15px;accent-color:var(--accent)}
  .ostage{position:relative;flex:1;min-height:0;border-radius:var(--r);border:1px solid #c4d0da;background:#f4f8fb;overflow:hidden}
  .ostage svg{width:100%;height:100%;display:block}
  .optics .bottombar.collapsed{height:36px!important;flex:0 0 36px}
  .optics .bottombar.collapsed .tabbody{display:none}
  .optics .otable{width:100%;border-collapse:collapse;font-size:11px}
  .optics .otable th,.optics .otable td{padding:3px 8px;text-align:right;border-bottom:1px solid #eef2f6}
  .optics .otable th{color:var(--muted);font-weight:600;position:sticky;top:0;background:#fff}
  .optics .otable th:first-child,.optics .otable td:first-child{text-align:left}
  .optics .ogrid{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:9px}
  .optics .ogrid .cell{background:#f6f9fc;border:1px solid #d7e2ec;border-radius:9px;padding:5px 7px}
  .optics .ogrid .k{font-size:9.5px;letter-spacing:.4px;color:var(--muted);text-transform:uppercase}
  .optics .ogrid .v{font-size:15px;font-weight:700;font-variant-numeric:tabular-nums}
  .optics .ogrid .v small{font-size:10px;color:var(--muted)}
  .optics .row{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:5px;font-size:12px}
  .optics .row b{font-variant-numeric:tabular-nums}
  .optics .tiny{font-size:11px;line-height:1.45}
  /* поляризация: волна с плоской поляризацией, вид «сбоку» */
  .optics .polar{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:2px 9px 9px}
  .optics .polar .pbtn{border:1px solid #cfdce8;border-radius:8px;background:#fff;padding:4px 6px;
    display:flex;align-items:center;gap:5px;font-size:10.5px;line-height:1.15;color:var(--muted);
    text-align:left;white-space:normal}
  .optics .polar .pbtn span{flex:1;min-width:0}
  .optics .polar .pbtn.active{border-color:var(--accent);box-shadow:0 0 0 2px #dbe8fb inset;color:var(--accent);font-weight:700}
  .optics .polar .pbtn svg{width:34px;height:22px;flex:0 0 34px}
  @media (max-width:1180px){.optics main{grid-template-columns:226px minmax(360px,1fr) 296px}}
  @media (max-width:980px){.optics main{grid-template-columns:1fr}.ostage{min-height:360px}}
  @media (max-height:860px){.ostage{min-height:260px}}
  `);
  document.head.appendChild(css);

  var main = $('benchOptics');
  main.className = 'optics';

  UI.html(main, `
    <aside class="panel lctl">
      <h2>Опыт</h2>
      <div class="seg" id="oMode">
        <button data-mode="refract" class="active">Преломление</button>
        <button data-mode="color">Цвета</button>
        <button data-mode="grating">Решётка</button>
        <button data-mode="lens">Линза</button>
      </div>

      <div id="oRefractBox">
        <div class="fld"><div class="top"><span>Среда 1</span></div>
          <div class="seg" id="oN1" style="margin:0 0 6px">
            <button data-n="air" class="active">Воздух</button>
            <button data-n="water">Вода</button>
            <button data-n="glass">Стекло</button>
            <button data-n="diamond">Алмаз</button>
          </div></div>
        <div class="fld"><div class="top"><span>Среда 2</span></div>
          <div class="seg" id="oN2" style="margin:0 0 6px">
            <button data-n="air">Воздух</button>
            <button data-n="water" class="active">Вода</button>
            <button data-n="glass">Стекло</button>
            <button data-n="diamond">Алмаз</button>
          </div></div>
        <div class="fld"><div class="top"><span>Угол падения</span><b id="oAv">30°</b></div>
          <input type="range" id="oA" min="0" max="85" step="1" value="30"></div>
        <div class="fld"><div class="top"><span>Длина волны</span><b id="oLv">532 нм</b></div>
          <input type="range" id="oL" min="410" max="700" step="5" value="532"></div>
        <button class="btn primary" id="oSampleRefract" style="margin:6px 9px 10px;width:calc(100% - 18px)">＋ Снять точку</button>
      </div>

      <div id="oColorBox" hidden>
        <div class="fld"><div class="top"><span>Источники (RGB)</span></div>
          <div class="seg" id="oCh" style="margin:0 0 6px;flex-wrap:wrap">
            <button data-ch="r" class="active">R</button>
            <button data-ch="g">G</button>
            <button data-ch="b">B</button>
          </div></div>
        <div class="fld"><div class="top"><span>Светофильтр</span></div>
          <div class="seg" id="oFilter" style="margin:0 0 6px;flex-wrap:wrap">
            <button data-f="none" class="active">нет</button>
            <button data-f="red">красный</button>
            <button data-f="green">зелёный</button>
            <button data-f="blue">синий</button>
            <button data-f="yellow">жёлтый</button>
            <button data-f="cyan">голубой</button>
            <button data-f="magenta">пурпурный</button>
          </div></div>
        <button class="btn primary" id="oSampleColor" style="margin:6px 9px 10px;width:calc(100% - 18px)">＋ Снять точку</button>
      </div>

      <div id="oGratingBox" hidden>
        <div class="fld"><div class="top"><span>Штрихов на мм</span><b id="oLinv">300</b></div>
          <input type="range" id="oLin" min="100" max="600" step="50" value="300"></div>
        <div class="fld"><div class="top"><span>Длина волны</span><b id="oGlv">532 нм</b></div>
          <input type="range" id="oGl" min="410" max="700" step="5" value="532"></div>
        <div class="fld"><div class="top"><span>Порядок максимума k</span><b id="oKv">1</b></div>
          <input type="range" id="oK" min="1" max="4" step="1" value="1"></div>
        <div class="fld"><div class="top"><span>Расстояние до экрана</span><b id="oDv">1,0 м</b></div>
          <input type="range" id="oD" min="0.3" max="2" step="0.1" value="1"></div>
        <button class="btn primary" id="oSampleGrating" style="margin:6px 9px 10px;width:calc(100% - 18px)">＋ Снять точку</button>
      </div>

      <div id="oLensBox" hidden>
        <div class="fld"><div class="top"><span>Фокусное расстояние F</span><b id="oFv">20 см</b></div>
          <input type="range" id="oF" min="10" max="40" step="1" value="20"></div>
        <div class="fld"><div class="top"><span>Расстояние до предмета d</span><b id="oD2v">30 см</b></div>
          <input type="range" id="oD2" min="5" max="80" step="1" value="30"></div>
        <button class="btn primary" id="oSampleLens" style="margin:6px 9px 10px;width:calc(100% - 18px)">＋ Снять точку</button>
      </div>

      <h2>Поляризация</h2>
      <div class="polar" id="oPolar">
        <button class="pbtn active" data-pol="random">
          <svg viewBox="0 0 34 22"><path d="M2 11 Q6 2 10 11 T18 11 T26 11 T34 11" fill="none" stroke="#2ea3dc" stroke-width="1.6"/>
            <path d="M2 11 Q6 20 10 11 T18 11 T26 11 T34 11" fill="none" stroke="#2ea3dc" stroke-width="1.2" opacity=".5"/>
            <path d="M2 4 L32 18 M2 18 L32 4" stroke="#f07d20" stroke-width="1.4"/></svg>
          <span>не поляризован</span></button>
        <button class="pbtn" data-pol="uni">
          <svg viewBox="0 0 34 22"><path d="M2 11 Q6 2 10 11 T18 11 T26 11 T34 11" fill="none" stroke="#2ea3dc" stroke-width="1.6"/></svg>
          <span>поляризован</span></button>
        <button class="pbtn" data-pol="s">
          <svg viewBox="0 0 34 22"><path d="M2 11 H32" stroke="#2ea3dc" stroke-width="1.6"/>
            <path d="M6 6 V16 M12 6 V16 M18 6 V16 M24 6 V16 M30 6 V16" stroke="#f07d20" stroke-width="1.6"/></svg>
          <span>s · вертикально</span></button>
        <button class="pbtn" data-pol="p">
          <svg viewBox="0 0 34 22"><path d="M2 11 H32" stroke="#2ea3dc" stroke-width="1.6"/>
            <path d="M2 6 H32 M2 11 H32 M2 16 H32" stroke="#f07d20" stroke-width="1.4"/></svg>
          <span>p · горизонт.</span></button>
      </div>
      <div class="fld"><div class="top"><span>Угол поляризатора α</span><b id="oPav">45°</b></div>
        <input type="range" id="oPa" min="0" max="90" step="1" value="45"></div>
      <div class="fld"><div class="top"><span>Свет</span></div>
        <div class="seg" id="oPkind" style="margin:0 0 6px">
          <button data-pk="natural" class="active">естественный</button>
          <button data-pk="partial">частично</button>
          <button data-pk="full">поляризованный</button>
        </div></div>
      <div class="chk"><input type="checkbox" id="oBeam"><label for="oBeam">Показать оба луча (s и p)</label></div>

      <h2>Время</h2>
      <div class="chk"><input type="checkbox" id="oPlay" checked><label for="oPlay">Анимация идёт</label></div>
    </aside>

    <section class="stagewrap">
      <div class="ostage" id="oStage"><svg id="oSvg" viewBox="0 0 760 470" preserveAspectRatio="xMidYMid meet"></svg></div>
      <div class="bottombar panel">
        <div class="tabs">
          <button class="active" data-tab="meas">Протокол <span class="badge" id="oCount"></span></button>
          <div class="grow"></div>
          <button class="btn ghost tiny" id="oCsv" style="margin:4px 6px 4px 0">Экспорт CSV</button>
        </div>
        <div class="tabbody" id="oTabMeas"></div>
      </div>
    </section>

    <aside class="right">
      <div class="card task">
        <h2>Задание <span class="badge" id="oTaskId">1 / 8</span></h2>
        <div class="body" id="oTaskBody"></div>
        <div class="tasklist" id="oTaskList"></div>
      </div>

      <div class="card">
        <h2>Показания</h2>
        <div style="padding:9px 9px 0">
          <div class="lcd" style="text-align:center">
            <div class="cap"><span id="oCapMain">УГОЛ ПРЕЛОМЛЕНИЯ</span><span id="oCapKind">воздух → вода</span></div>
            <div class="main" id="oLcd">22,0</div>
            <div class="sub" id="oLcdSub">n₁·sin i = n₂·sin r</div>
          </div>
        </div>
        <div class="ogrid">
          <div class="cell"><div class="k" id="oK1">Угол падения</div><div class="v" id="oV1">30 <small>°</small></div></div>
          <div class="cell"><div class="k" id="oK2">Показатель n₂</div><div class="v" id="oV2">1,33</div></div>
          <div class="cell"><div class="k" id="oK3">Скорость света</div><div class="v" id="oV3">225 <small>Мм/с</small></div></div>
          <div class="cell"><div class="k" id="oK4">Критический угол</div><div class="v" id="oV4">—</div></div>
        </div>
      </div>

      <div class="card">
        <h2>Что происходит</h2>
        <div class="body" id="oRead"><div class="muted" style="font-size:12px">Выберите опыт слева.</div></div>
      </div>
    </aside>
  `);

  /* ---------- сцена ---------- */

  function svg() { return $('oSvg'); }
  var phase = 0;

  var SPECTRUM = [
    { nm: 700, hex: '#e2453c' }, { nm: 620, hex: '#e8792c' }, { nm: 580, hex: '#e2c22c' },
    { nm: 532, hex: '#3fa85a' }, { nm: 480, hex: '#2f9fd0' }, { nm: 440, hex: '#3f5fc4' },
    { nm: 410, hex: '#8455c0' }
  ];
  function nmColor(nm) {
    var best = SPECTRUM[0];
    SPECTRUM.forEach(function (s) { if (Math.abs(s.nm - nm) < Math.abs(best.nm - nm)) best = s; });
    return best.hex;
  }
  function rgbColor(c) { return O.mixColor(c.r, c.g, c.b).hex; }

  // «бегущая» волна по лучу: фаза анимации смещает пунктир
  function waveDash() { return 'stroke-dasharray="10 8" stroke-dashoffset="' + (-phase * 26 % 18).toFixed(1) + '"'; }

  function arrow(x1, y1, x2, y2, color, w) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + color +
      '" stroke-width="' + (w || 2.4) + '" stroke-linecap="round"/>';
  }

  // ПРЕЛОМЛЕНИЕ
  function drawRefract() {
    var med = O.MEDIA, n1 = med[lab.n1].n, n2 = med[lab.n2].n;
    var split = O.beamSplit(n1, n2, lab.angle);
    var cx = 380, cy = 235, L = 250;
    var inc = lab.angle * Math.PI / 180;
    var col = nmColor(lab.lambda);

    // луч падающий: из левого верхнего угла к точке на границе
    var ix = cx - L * Math.sin(inc), iy = cy - L * Math.cos(inc);
    var out = '';
    out += '<rect x="0" y="0" width="760" height="' + cy + '" fill="' + med[lab.n1].color + '" opacity=".55"/>';
    out += '<rect x="0" y="' + cy + '" width="760" height="' + (470 - cy) + '" fill="' + med[lab.n2].color + '" opacity=".75"/>';
    out += '<line x1="0" y1="' + cy + '" x2="760" y2="' + cy + '" stroke="#8fb4cc" stroke-width="2"/>';
    out += '<line x1="' + cx + '" y1="' + (cy - 190) + '" x2="' + cx + '" y2="' + (cy + 190) +
      '" stroke="#8aa3b6" stroke-width="1.4" stroke-dasharray="6 6"/>';

    // падающий луч
    out += arrow(ix, iy, cx, cy, col, 3) ;
    out += '<line x1="' + ix + '" y1="' + iy + '" x2="' + cx + '" y2="' + cy + '" stroke="' + col +
      '" stroke-width="6" opacity=".25"/>';

    // отражённый луч
    var rx = cx - L * Math.sin(inc), ry = cy - L * Math.cos(inc);
    if (split.reflected > 0.02) {
      out += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + L * Math.sin(inc)) + '" y2="' + (cy - L * Math.cos(inc)) +
        '" stroke="' + col + '" stroke-width="' + (1.4 + split.reflected * 4) + '" opacity="' + (0.35 + split.reflected * 0.5) +
        '" stroke-dasharray="12 6"/>';
    }
    // преломлённый луч
    if (!split.tir && split.angle !== null) {
      var r = split.angle * Math.PI / 180;
      var ex = cx + L * Math.sin(r), ey = cy + L * Math.cos(r);
      out += '<line x1="' + cx + '" y1="' + cy + '" x2="' + ex + '" y2="' + ey + '" stroke="' + col +
        '" stroke-width="' + (1.4 + split.refracted * 4) + '" opacity="' + (0.45 + split.refracted * 0.5) + '"/>';
      out += '<circle cx="' + ex.toFixed(1) + '" cy="' + ey.toFixed(1) + '" r="5" fill="' + col + '"/>';
    } else {
      out += '<text x="' + (cx + 16) + '" y="' + (cy + 40) + '" font-size="13" font-weight="700" fill="#d64545" font-family="sans-serif">полное внутреннее отражение</text>';
    }

    // подписи углов
    out += '<text x="' + (cx + 8) + '" y="' + (cy - 20) + '" font-size="12" fill="#1f4a76" font-family="sans-serif">i = ' + n(lab.angle, 0) + '°</text>';
    if (!split.tir && split.angle !== null) {
      out += '<text x="' + (cx + 8) + '" y="' + (cy + 24) + '" font-size="12" fill="#1f4a76" font-family="sans-serif">r = ' + n(split.angle, 1) + '°</text>';
    }
    out += '<text x="16" y="26" font-size="13" font-weight="700" fill="#1b3e8f" font-family="sans-serif">' +
      esc(med[lab.n1].name) + ' (n = ' + n(n1, 3) + ') → ' + esc(med[lab.n2].name) + ' (n = ' + n(n2, 3) + ')</text>';
    // поляризация: яркость по закону Малюса + штриховка «плоскости колебаний»
    var polI = (lab.polKind === 'natural' ? O.naturalThrough(1) : 1) * O.malus(1, lab.polAngle) *
      (lab.polKind === 'partial' ? 1.5 : 1);
    // штрихи «плоскости колебаний» — поперёк падающего луча, ближе к его середине
    var midx = (ix + cx) / 2, midy = (iy + cy) / 2;
    out += '<g opacity="' + (0.2 + polI * 0.7).toFixed(2) + '">';
    for (var pi = -3; pi <= 3; pi++) {
      var tx = midx + pi * 6 * Math.cos(inc), ty = midy - pi * 6 * Math.sin(inc);
      out += '<line x1="' + (tx - 9 * Math.cos(inc)).toFixed(1) + '" y1="' + (ty + 9 * Math.sin(inc)).toFixed(1) +
        '" x2="' + (tx + 9 * Math.cos(inc)).toFixed(1) + '" y2="' + (ty - 9 * Math.sin(inc)).toFixed(1) +
        '" stroke="#1b3e8f" stroke-width="1.3" opacity=".7"/>';
    }
    out += '</g>';
    out += '<text x="16" y="452" font-size="12" fill="#6b7c8b" font-family="sans-serif">λ = ' + n(lab.lambda, 0) +
      ' нм · в среде ' + n(O.wavelengthIn(lab.lambda, n2), 0) + ' нм · скорость ' + n(O.mediumSpeed(n2) / 1e6, 0) + ' Мм/с</text>';
    if (split.critical) {
      out += '<text x="560" y="26" text-anchor="end" font-size="12" fill="#d64545" font-family="sans-serif">критический угол ' + n(split.critical, 1) + '°</text>';
    }
    UI.html(svg(), out);
  }

  // ЦВЕТА
  function drawColor() {
    var out = '<rect x="0" y="0" width="760" height="470" fill="#f2f6fa"/>';
    // три источника света, лучи сходятся в центр
    var lamps = [
      { k: 'r', x: 150, y: 110, c: O.CHANNELS.r.hex, name: 'R 630 нм' },
      { k: 'g', x: 610, y: 110, c: O.CHANNELS.g.hex, name: 'G 532 нм' },
      { k: 'b', x: 380, y: 400, c: O.CHANNELS.b.hex, name: 'B 465 нм' }
    ];
    var cx = 380, cy = 210;
    lamps.forEach(function (l) {
      var on = lab.color[l.k] > 0.15;
      out += '<circle cx="' + l.x + '" cy="' + l.y + '" r="18" fill="' + (on ? l.c : '#cbd8e3') + '" stroke="#8fb4cc" stroke-width="2"/>';
      out += '<text x="' + l.x + '" y="' + (l.y - 28) + '" text-anchor="middle" font-size="11" fill="#1f4a76" font-family="sans-serif">' + l.name + '</text>';
      if (on) {
        out += '<line x1="' + l.x + '" y1="' + l.y + '" x2="' + cx + '" y2="' + cy + '" stroke="' + l.c +
          '" stroke-width="9" opacity=".28" stroke-linecap="round"/>';
        out += '<line x1="' + l.x + '" y1="' + l.y + '" x2="' + cx + '" y2="' + cy + '" stroke="' + l.c +
          '" stroke-width="2.6" ' + waveDash() + ' stroke-linecap="round"/>';
      }
    });
    // фильтр между источниками и экраном
    var tr = O.filterTransmit(lab.filter, lab.color.r, lab.color.g, lab.color.b);
    var res = O.mixColor(tr.r, tr.g, tr.b);
    if (lab.filter !== 'none') {
      var fcol = O.filterTransmit(lab.filter, 1, 1, 1);
      var fhex = O.mixColor(fcol.r, fcol.g, fcol.b).hex;
      out += '<rect x="' + (cx - 58) + '" y="' + (cy - 128) + '" width="116" height="52" rx="8" fill="' + fhex +
        '" opacity=".35" stroke="#8fb4cc" stroke-width="2"/>';
      out += '<text x="' + cx + '" y="' + (cy - 96) + '" text-anchor="middle" font-size="11" fill="#1f4a76" font-family="sans-serif">светофильтр</text>';
    }
    // «экран» с результатом
    out += '<rect x="' + (cx - 90) + '" y="' + (cy - 58) + '" width="180" height="116" rx="10" fill="' + res.hex +
      '" stroke="#8fb4cc" stroke-width="3"/>';
    out += '<text x="' + cx + '" y="' + (cy + 96) + '" text-anchor="middle" font-size="15" font-weight="700" fill="#1b3e8f" font-family="sans-serif">' +
      'на экране: ' + esc(res.name) + '</text>';
    out += '<text x="16" y="26" font-size="13" font-weight="700" fill="#1b3e8f" font-family="sans-serif">Аддитивное смешение: свет складывается</text>';
    UI.html(svg(), out);
  }

  // РЕШЁТКА
  function drawGrating() {
    var out = '<rect x="0" y="0" width="760" height="470" fill="#eef4f9"/>';
    var gx = 120, gy = 235, sx = 700;
    // решётка
    out += '<rect x="' + (gx - 8) + '" y="60" width="16" height="330" rx="4" fill="#cfe0ec" stroke="#8fb4cc" stroke-width="2"/>';
    for (var i = 0; i < 26; i++) {
      out += '<line x1="' + (gx - 6) + '" y1="' + (70 + i * 12.6).toFixed(1) + '" x2="' + (gx + 6) + '" y2="' + (70 + i * 12.6).toFixed(1) +
        '" stroke="#6f8ea6" stroke-width="1"/>';
    }
    out += '<text x="' + gx + '" y="46" text-anchor="middle" font-size="11" fill="#1f4a76" font-family="sans-serif">' + n(lab.lines, 0) + ' штр/мм</text>';
    // экран
    out += '<line x1="' + sx + '" y1="50" x2="' + sx + '" y2="420" stroke="#8fb4cc" stroke-width="3"/>';
    out += '<text x="' + sx + '" y="440" text-anchor="middle" font-size="11" fill="#6b7c8b" font-family="sans-serif">экран, ' + n(lab.screen, 1) + ' м</text>';
    // входящий белый луч
    out += '<line x1="20" y1="' + gy + '" x2="' + gx + '" y2="' + gy + '" stroke="#f6f9fc" stroke-width="6"/>';
    out += '<line x1="20" y1="' + gy + '" x2="' + gx + '" y2="' + gy + '" stroke="#9fb4c6" stroke-width="2"/>';
    // максимумы по порядкам для текущей длины волны и весь спектр первого порядка
    [-3, -2, -1, 0, 1, 2, 3].forEach(function (k) {
      var a = O.gratingAngles(lab.lines, lab.lambda, k);
      if (a === null) return;
      var rad = a * Math.PI / 180;
      var ex = gx + (sx - gx) * Math.cos(rad) * 1.0, ey = gy + (sx - gx) * Math.sin(rad) * 0.55;
      out += '<line x1="' + gx + '" y1="' + gy + '" x2="' + ex.toFixed(1) + '" y2="' + ey.toFixed(1) +
        '" stroke="' + nmColor(lab.lambda) + '" stroke-width="' + (k === lab.order ? 3 : 1.6) +
        '" opacity="' + (k === lab.order ? 0.95 : 0.45) + '"/>';
      out += '<circle cx="' + ex.toFixed(1) + '" cy="' + ey.toFixed(1) + '" r="' + (k === lab.order ? 8 : 5) +
        '" fill="' + nmColor(lab.lambda) + '" opacity="' + (k === lab.order ? 1 : 0.55) + '"/>';
      if (k === lab.order && a !== null) {
        out += '<text x="' + (ex - 12) + '" y="' + (ey - 12) + '" text-anchor="end" font-size="12" font-weight="700" fill="#1b3e8f" font-family="sans-serif">' +
          n(a, 1) + '°</text>';
      }
    });
    // радуга первого порядка
    SPECTRUM.forEach(function (s) {
      var a = O.gratingAngles(lab.lines, s.nm, 1);
      if (a === null) return;
      var rad = a * Math.PI / 180;
      var ex = gx + (sx - gx) * Math.cos(rad), ey = gy + (sx - gx) * Math.sin(rad) * 0.55;
      out += '<circle cx="' + ex.toFixed(1) + '" cy="' + ey.toFixed(1) + '" r="4" fill="' + s.hex + '"/>';
      var a2 = O.gratingAngles(lab.lines, s.nm, -1);
      if (a2 !== null) {
        var r2 = a2 * Math.PI / 180;
        out += '<circle cx="' + (gx + (sx - gx) * Math.cos(r2)).toFixed(1) + '" cy="' + (gy + (sx - gx) * Math.sin(r2) * 0.55).toFixed(1) +
          '" r="4" fill="' + s.hex + '"/>';
      }
    });
    out += '<text x="16" y="26" font-size="13" font-weight="700" fill="#1b3e8f" font-family="sans-serif">d·sin θ = k·λ — максимумы решётки</text>';
    UI.html(svg(), out);
  }

  // ЛИНЗА
  function drawLens() {
    var img = O.lensImage(lab.lensD, lab.lensF);
    var out = '<rect x="0" y="0" width="760" height="470" fill="#f1f6fa"/>';
    var cx = 380, cy = 235, scale = 4;    // 4 px на см
    // оптическая ось
    out += '<line x1="20" y1="' + cy + '" x2="740" y2="' + cy + '" stroke="#9fb4c6" stroke-width="1.4" stroke-dasharray="7 6"/>';
    // линза
    out += '<path d="M' + cx + ' ' + (cy - 110) + ' Q' + (cx + 34) + ' ' + cy + ' ' + cx + ' ' + (cy + 110) +
      ' Q' + (cx - 34) + ' ' + cy + ' ' + cx + ' ' + (cy - 110) + '" fill="#cfe8f6" stroke="#2ea3dc" stroke-width="3"/>';
    // фокусы
    [-1, 1].forEach(function (s) {
      var fx = cx + s * lab.lensF * scale;
      out += '<circle cx="' + fx + '" cy="' + cy + '" r="4" fill="#f07d20"/>';
      out += '<text x="' + fx + '" y="' + (cy + 20) + '" text-anchor="middle" font-size="10" fill="#a35c00" font-family="sans-serif">F</text>';
    });
    // предмет
    var px = cx - lab.lensD * scale;
    var ph = 70;
    out += arrow(px, cy, px, cy - ph, '#1b3e8f', 4);
    out += '<text x="' + px + '" y="' + (cy - ph - 10) + '" text-anchor="middle" font-size="11" fill="#1b3e8f" font-family="sans-serif">предмет</text>';
    // лучи: от вершины предмета параллельно оси и через центр
    out += '<line x1="' + px + '" y1="' + (cy - ph) + '" x2="' + cx + '" y2="' + (cy - ph) + '" stroke="#2ea3dc" stroke-width="2"/>';
    out += '<line x1="' + cx + '" y1="' + (cy - ph) + '" x2="' + (cx + 200) + '" y2="' + (cy - ph + (200 / lab.lensF / scale) * ph) + '" stroke="#2ea3dc" stroke-width="2"/>';
    out += '<line x1="' + px + '" y1="' + (cy - ph) + '" x2="' + cx + '" y2="' + cy + '" stroke="#2ea3dc" stroke-width="1.6" opacity=".7"/>';
    out += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + 200) + '" y2="' + (cy + 200 * (ph / (lab.lensD * scale))) + '" stroke="#2ea3dc" stroke-width="1.6" opacity=".7"/>';
    // изображение
    if (isFinite(img.f) && img.real && Math.abs(img.f) < 200) {
      var ix = cx + img.f * scale;
      var ih = ph * Math.abs(img.magnification);
      out += arrow(ix, cy, ix, cy + Math.min(150, ih), '#f07d20', 4);
      out += '<text x="' + ix + '" y="' + (cy + Math.min(150, ih) + 16) + '" text-anchor="middle" font-size="11" fill="#a35c00" font-family="sans-serif">изображение ' +
        n(img.f, 0) + ' см</text>';
    } else if (isFinite(img.f)) {
      // мнимое изображение — правее линзы со стороны предмета
      var mx = cx + Math.abs(img.f) * scale * 0.5;
      out += '<line x1="' + px + '" y1="' + (cy - ph - 30) + '" x2="' + mx + '" y2="' + (cy - ph - 30) +
        '" stroke="#f07d20" stroke-width="3" stroke-dasharray="8 6"/>';
      out += '<text x="' + mx + '" y="' + (cy - ph - 44) + '" text-anchor="middle" font-size="11" fill="#a35c00" font-family="sans-serif">мнимое изображение (лупа)</text>';
    }
    out += '<text x="16" y="26" font-size="13" font-weight="700" fill="#1b3e8f" font-family="sans-serif">1/F = 1/d + 1/f</text>';
    out += '<text x="16" y="452" font-size="12" fill="#6b7c8b" font-family="sans-serif">F = ' + n(lab.lensF, 0) + ' см · d = ' + n(lab.lensD, 0) +
      ' см · f = ' + (isFinite(img.f) ? n(img.f, 1) + ' см' : '∞') + ' · увеличение ' + (isFinite(img.magnification) ? '×' + n(Math.abs(img.magnification), 2) : '—') + '</text>';
    UI.html(svg(), out);
  }

  function draw() {
    if (mode === 'refract') drawRefract();
    else if (mode === 'color') drawColor();
    else if (mode === 'grating') drawGrating();
    else drawLens();
    renderReadout();
  }

  /* ---------- показания ---------- */

  function labels(cap, kind, k1, k2, k3, k4) {
    UI.text($('oCapMain'), cap);
    UI.text($('oCapKind'), kind);
    UI.text($('oK1'), k1); UI.text($('oK2'), k2); UI.text($('oK3'), k3); UI.text($('oK4'), k4);
  }

  function renderReadout() {
    var read = '';
    if (mode === 'refract') {
      var med = O.MEDIA, n1 = med[lab.n1].n, n2 = med[lab.n2].n;
      var s = O.beamSplit(n1, n2, lab.angle);
      UI.text($('oLcd'), s.tir ? '—' : n(s.angle, 1));
      UI.text($('oLcdSub'), s.tir ? 'полное отражение' : 'n₁·sin i = n₂·sin r');
      labels('УГОЛ ПРЕЛОМЛЕНИЯ', esc(med[lab.n1].name.toLowerCase()) + ' → ' + esc(med[lab.n2].name.toLowerCase()),
        'Угол падения', 'Показатель n₂', 'Скорость света', 'Критический угол');
      UI.html($('oV1'), n(lab.angle, 0) + ' <small>°</small>');
      UI.html($('oV2'), n(n2, 3));
      UI.html($('oV3'), n(O.mediumSpeed(n2) / 1e6, 0) + ' <small>Мм/с</small>');
      UI.html($('oV4'), s.critical ? n(s.critical, 1) + ' <small>°</small>' : '— <small>нет</small>');
      read = '<div class="row"><span>Отражено энергии</span><b>' + n(s.reflected * 100, 0) + ' %</b></div>' +
        '<div class="row"><span>Прошло во вторую среду</span><b>' + n(s.refracted * 100, 0) + ' %</b></div>' +
        '<div class="row"><span>Длина волны в среде 2</span><b>' + n(O.wavelengthIn(lab.lambda, n2), 0) + ' нм</b></div>' +
        '<div class="row"><span>Через поляризатор α = ' + n(lab.polAngle, 0) + '°</span><b>' +
        n((lab.polKind === 'natural' ? O.naturalThrough(1) : 1) * O.malus(1, lab.polAngle) *
          (lab.polKind === 'partial' ? 1.5 : 1) * 100, 0) + ' %</b></div>' +
        '<div class="tiny muted" style="margin-top:6px">' +
        (s.tir ? 'Угол больше критического — луч не выходит во вторую среду, свет отражается целиком.'
          : 'Частота при переходе не меняется, поэтому в плотной среде длина волны короче: λ = λ₀ / n.') + '</div>';
    } else if (mode === 'color') {
      var tr = O.filterTransmit(lab.filter, lab.color.r, lab.color.g, lab.color.b);
      var res = O.mixColor(tr.r, tr.g, tr.b);
      UI.text($('oLcd'), res.channels);
      UI.text($('oLcdSub'), 'каналов на экране');
      labels('ЦВЕТ НА ЭКРАНЕ', esc(res.name), 'Красный', 'Зелёный', 'Синий', 'Каналов');
      UI.html($('oV1'), n(tr.r, 2)); UI.html($('oV2'), n(tr.g, 2));
      UI.html($('oV3'), n(tr.b, 2)); UI.html($('oV4'), String(res.channels));
      read = '<div class="row"><span>Результат</span><b>' + esc(res.name) + '</b></div>' +
        '<div class="row"><span>Код цвета</span><b>' + res.hex + '</b></div>' +
        '<div class="tiny muted" style="margin-top:6px">Аддитивное смешение: белый = R + G + B. Светофильтр работает на вычитание — он пропускает свой участок спектра.</div>';
    } else if (mode === 'grating') {
      var a = O.gratingAngles(lab.lines, lab.lambda, lab.order);
      UI.text($('oLcd'), a === null ? '—' : n(a, 1));
      UI.text($('oLcdSub'), a === null ? 'максимума нет' : 'd·sin θ = k·λ');
      labels('УГОЛ МАКСИМУМА', 'порядок k = ' + lab.order, 'Штрихов на мм', 'Длина волны', 'Шаг d', 'Пятно на экране');
      var d = 1e-3 / lab.lines * 1e6;     // мкм
      UI.html($('oV1'), n(lab.lines, 0));
      UI.html($('oV2'), n(lab.lambda, 0) + ' <small>нм</small>');
      UI.html($('oV3'), n(d, 2) + ' <small>мкм</small>');
      var spot = O.gratingSpot(lab.lines, lab.lambda, lab.order, lab.screen);
      UI.html($('oV4'), spot === null ? '—' : n(spot * 100, 0) + ' <small>см</small>');
      read = '<div class="row"><span>Угол для 700 нм</span><b>' + (function () { var x = O.gratingAngles(lab.lines, 700, lab.order); return x === null ? 'нет' : n(x, 1) + '°'; })() + '</b></div>' +
        '<div class="row"><span>Угол для 410 нм</span><b>' + (function () { var x = O.gratingAngles(lab.lines, 410, lab.order); return x === null ? 'нет' : n(x, 1) + '°'; })() + '</b></div>' +
        '<div class="tiny muted" style="margin-top:6px">Чем больше длина волны, тем дальше от центра её максимум — поэтому красный край спектра уходит дальше всех.</div>';
    } else {
      var img = O.lensImage(lab.lensD, lab.lensF);
      UI.text($('oLcd'), isFinite(img.f) ? n(img.f, 1) : '∞');
      UI.text($('oLcdSub'), '1/F = 1/d + 1/f');
      labels('f, см', img.real ? 'действительное' : 'мнимое',
        'Фокус F', 'Предмет d', 'Увеличение', 'Тип');
      UI.html($('oV1'), n(lab.lensF, 0) + ' <small>см</small>');
      UI.html($('oV2'), n(lab.lensD, 0) + ' <small>см</small>');
      UI.html($('oV3'), isFinite(img.magnification) ? '×' + n(Math.abs(img.magnification), 2) : '—');
      UI.html($('oV4'), img.real ? 'действ.' : 'мнимое');
      read = '<div class="row"><span>Изображение</span><b>' + (img.real ? 'действительное, перевёрнутое' : 'мнимое, прямое') + '</b></div>' +
        '<div class="row"><span>Оптическая сила</span><b>' + n(1 / (lab.lensF / 100), 1) + ' дптр</b></div>' +
        '<div class="tiny muted" style="margin-top:6px">' +
        (lab.lensD > lab.lensF ? 'Предмет дальше фокуса — лучи собираются в действительное изображение.' : 'Предмет ближе фокуса — лучи расходятся, изображение мнимое: так работает лупа.') + '</div>';
    }
    UI.html($('oRead'), read);
  }

  /* ---------- задания ---------- */

  function renderTask() {
    var tk = O.TASKS[taskIndex];
    var done = solved[taskIndex];
    UI.text($('oTaskId'), (taskIndex + 1) + ' / ' + O.TASKS.length);
    UI.html($('oTaskBody'),
      '<div class="goal"><b>' + esc(tk.t) + '</b><br>' + esc(tk.goal) + '</div>' +
      '<ol>' + tk.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      (done ? '<div class="checkout"><div class="hintline">' + '★'.repeat(done) + ' ' + esc(tk.why) + '</div></div>' : '') +
      '<div class="row" style="gap:6px;margin-top:6px">' +
      '<button class="btn ghost tiny" id="oHint">Подсказка</button>' +
      '<button class="btn primary tiny" id="oCheck">Проверить</button></div>' +
      '<div class="checkout" id="oCheckOut"></div>');
    UI.html($('oTaskList'), O.TASKS.map(function (t, i) {
      return '<button data-i="' + i + '" class="' + (i === taskIndex ? 'active ' : '') + (solved[i] ? 'done' : '') + '">' +
        '<span class="num">' + (solved[i] ? '★' : (i + 1)) + '</span><span>' + esc(t.t) + '</span></button>';
    }).join(''));
    $('oHint').onclick = function () {
      tk._h = tk._h || 0;
      var hint = tk.hints[tk._h % tk.hints.length];
      tk._h++;
      UI.html($('oCheckOut'), '<div class="hintline">💡 ' + esc(hint) + '</div>');
    };
    $('oCheck').onclick = function () { checkTask(true); };
    [].forEach.call($('oTaskList').children, function (b) {
      b.onclick = function () { taskIndex = +b.dataset.i; renderTask(); };
    });
  }

  function checkTask(show) {
    var tk = O.TASKS[taskIndex];
    var f = O.facts(lab);
    var ok = tk.check(f);
    if (ok && !solved[taskIndex]) {
      solved[taskIndex] = tk.stars(f);
      renderTask();
    }
    if (show) {
      UI.html($('oCheckOut'), ok
        ? '<div class="okline">✅ Условие выполнено — ' + '★'.repeat(solved[taskIndex] || tk.stars(f)) + '</div>'
        : '<div class="badline">Пока не выполнено — сверьтесь с шагами и подсказкой.</div>');
    }
    return ok;
  }

  /* ---------- протокол ---------- */

  function renderMeasurements() {
    var box = $('oTabMeas');
    UI.text($('oCount'), lab.measures.length || '');
    if (!lab.measures.length) {
      UI.html(box, '<div class="empty-note">Настройте опыт и нажмите «Снять точку».</div>');
      return;
    }
    var kinds = { snell: 'преломление', color: 'цвет', grating: 'решётка', lens: 'линза' };
    UI.html(box, '<table class="otable"><thead><tr><th>Опыт</th><th>Параметры</th><th>Результат</th></tr></thead><tbody>' +
      lab.measures.map(function (r) {
        var p = '', res = '';
        if (r.kind === 'snell') {
          p = esc(O.MEDIA[r.n1].name) + ' → ' + esc(O.MEDIA[r.n2].name) + ', i = ' + n(r.inc, 0) + '°, λ = ' + n(r.lambda, 0) + ' нм';
          res = r.tir ? 'полное отражение' : 'r = ' + n(r.refr, 1) + '°';
        }
        if (r.kind === 'color') { p = 'R ' + n(r.r, 0) + ' · G ' + n(r.g, 0) + ' · B ' + n(r.b, 0); res = esc(r.out); }
        if (r.kind === 'grating') {
          p = n(r.lines, 0) + ' штр/мм, λ = ' + n(r.lambda, 0) + ' нм, k = ' + r.order;
          res = r.angle === null ? 'максимума нет' : 'θ = ' + n(r.angle, 1) + '°';
        }
        if (r.kind === 'lens') { p = 'F = ' + n(r.F, 0) + ' см, d = ' + n(r.d, 0) + ' см'; res = (r.real ? 'действ.' : 'мнимое') + ', f = ' + (isFinite(r.f) ? n(r.f, 1) : '∞') + ' см'; }
        return '<tr><td>' + (kinds[r.kind] || r.kind) + '</td><td>' + p + '</td><td>' + res + '</td></tr>';
      }).join('') + '</tbody></table>');
  }

  function sample() {
    var rec = null;
    if (mode === 'refract') {
      var med = O.MEDIA, n1 = med[lab.n1].n, n2 = med[lab.n2].n;
      var s = O.snell(n1, n2, lab.angle);
      rec = { kind: 'snell', inc: lab.angle, n1: lab.n1, n2: lab.n2, refr: s.angle, tir: s.tir, lambda: lab.lambda };
    } else if (mode === 'color') {
      var tr = O.filterTransmit(lab.filter, lab.color.r, lab.color.g, lab.color.b);
      var res = O.mixColor(tr.r, tr.g, tr.b);
      rec = { kind: 'color', r: tr.r, g: tr.g, b: tr.b, out: res.name, filter: lab.filter };
    } else if (mode === 'grating') {
      rec = { kind: 'grating', lines: lab.lines, lambda: lab.lambda, order: lab.order,
        angle: O.gratingAngles(lab.lines, lab.lambda, lab.order), spot: O.gratingSpot(lab.lines, lab.lambda, lab.order, lab.screen) };
    } else {
      var img = O.lensImage(lab.lensD, lab.lensF);
      rec = { kind: 'lens', d: lab.lensD, F: lab.lensF, f: img.f, mag: img.magnification, real: img.real };
    }
    lab.measures.push(rec);
    renderMeasurements();
    checkTask(false);
    log('ok', 'Точка снята: ' + (rec.kind === 'snell' ? 'преломление ' + n(lab.angle, 0) + '°' :
      rec.kind === 'color' ? 'цвет ' + rec.out : rec.kind === 'grating' ? 'решётка ' + n(rec.angle || 0, 1) + '°' : 'линза f = ' + n(rec.f, 0) + ' см'));
  }

  /* ---------- журнал ---------- */

  var logRows = [];
  function log(kind, text) {
    logRows.push({ kind: kind, text: text, d: new Date() });
    if (logRows.length > 60) logRows.shift();
    var el = $('oLcdSub');
    if (el && kind === 'ok') UI.text(el, text.length > 42 ? text.slice(0, 42) + '…' : text);
  }

  /* ---------- управление ---------- */

  function bindRange(id, out, fmt, fn) {
    $(id).oninput = function () {
      UI.text($(out), fmt(parseFloat(this.value)));
      if (fn) fn(parseFloat(this.value));
      draw();
    };
  }
  bindRange('oA', 'oAv', function (v) { return n(v, 0) + '°'; }, function (v) { lab.angle = v; });
  bindRange('oL', 'oLv', function (v) { return n(v, 0) + ' нм'; }, function (v) { lab.lambda = v; });
  bindRange('oLin', 'oLinv', function (v) { return n(v, 0); }, function (v) { lab.lines = v; });
  bindRange('oGl', 'oGlv', function (v) { return n(v, 0) + ' нм'; }, function (v) { lab.lambda = v; });
  bindRange('oK', 'oKv', function (v) { return n(v, 0); }, function (v) { lab.order = v; });
  bindRange('oD', 'oDv', function (v) { return n(v, 1) + ' м'; }, function (v) { lab.screen = v; });
  bindRange('oF', 'oFv', function (v) { return n(v, 0) + ' см'; }, function (v) { lab.lensF = v; });
  bindRange('oD2', 'oD2v', function (v) { return n(v, 0) + ' см'; }, function (v) { lab.lensD = v; });
  lab.screen = 1.0;

  // подписи ползунков всегда берём из фактических значений: иначе «30 см» на экране
  // и 40 см в модели расходятся, и задание не сходится
  function syncLabels() {
    [['oA', 'oAv', function (v) { return n(v, 0) + '°'; }],
     ['oL', 'oLv', function (v) { return n(v, 0) + ' нм'; }],
     ['oLin', 'oLinv', function (v) { return n(v, 0); }],
     ['oGl', 'oGlv', function (v) { return n(v, 0) + ' нм'; }],
     ['oK', 'oKv', function (v) { return n(v, 0); }],
     ['oD', 'oDv', function (v) { return n(v, 1) + ' м'; }],
     ['oF', 'oFv', function (v) { return n(v, 0) + ' см'; }],
     ['oD2', 'oD2v', function (v) { return n(v, 0) + ' см'; }]
    ].forEach(function (r) {
      var el = $(r[0]);
      if (el) { el.value = el.value; UI.text($(r[1]), r[2](parseFloat(el.value))); }
    });
  }
  syncLabels();

  function seg(el, attr, fn) {
    [].forEach.call(el.children, function (b) {
      b.onclick = function () {
        [].forEach.call(el.children, function (x) { x.classList.toggle('active', x === b); });
        fn(b.dataset[attr]);
      };
    });
  }
  seg($('oN1'), 'n', function (v) { lab.n1 = v; draw(); });
  seg($('oN2'), 'n', function (v) { lab.n2 = v; draw(); });
  seg($('oFilter'), 'f', function (v) { lab.filter = v; draw(); });
  seg($('oPkind'), 'pk', function (v) { lab.polKind = v; draw(); });
  bindRange('oPa', 'oPav', function (v) { return n(v, 0) + '°'; }, function (v) { lab.polAngle = v; });
  [].forEach.call($('oCh').children, function (b) {
    b.onclick = function () {
      var k = b.dataset.ch;
      lab.color[k] = lab.color[k] > 0.15 ? 0 : 1;
      b.classList.toggle('active', lab.color[k] > 0.15);
      draw();
    };
  });
  [].forEach.call($('oMode').children, function (b) {
    b.onclick = function () {
      [].forEach.call($('oMode').children, function (x) { x.classList.toggle('active', x === b); });
      mode = b.dataset.mode;
      ['oRefractBox', 'oColorBox', 'oGratingBox', 'oLensBox'].forEach(function (id) {
        $(id).hidden = !((id === 'oRefractBox' && mode === 'refract') || (id === 'oColorBox' && mode === 'color') ||
          (id === 'oGratingBox' && mode === 'grating') || (id === 'oLensBox' && mode === 'lens'));
      });
      draw();
    };
  });

  // поляризация: только визуальная подсказка о состоянии волны
  [].forEach.call($('oPolar').children, function (b) {
    b.onclick = function () {
      [].forEach.call($('oPolar').children, function (x) { x.classList.toggle('active', x === b); });
      var k = b.dataset.pol;
      POL.s = k === 's'; POL.p = k === 'p'; POL.random = k === 'random'; POL.uni = k === 'uni';
      draw();
    };
  });
  $('oBeam').onchange = function () { POL.beam = this.checked; };
  $('oPlay').onchange = function () { playing = this.checked; };

  var playing = true;
  $('oSampleRefract').onclick = sample;
  $('oSampleColor').onclick = sample;
  $('oSampleGrating').onclick = sample;
  $('oSampleLens').onclick = sample;

  $('oCsv').onclick = function () {
    var lines = ['Опыт;Параметры;Результат'];
    lab.measures.forEach(function (r) {
      var p = '', res = '';
      if (r.kind === 'snell') { p = r.n1 + '→' + r.n2 + ', i=' + r.inc + ', λ=' + r.lambda; res = r.tir ? 'ПВО' : 'r=' + Number(r.refr).toFixed(2); }
      if (r.kind === 'color') { p = 'R' + r.r + ' G' + r.g + ' B' + r.b; res = r.out; }
      if (r.kind === 'grating') { p = r.lines + '/мм, λ=' + r.lambda + ', k=' + r.order; res = r.angle === null ? 'нет' : Number(r.angle).toFixed(2) + '°'; }
      if (r.kind === 'lens') { p = 'F=' + r.F + ', d=' + r.d; res = 'f=' + Number(r.f).toFixed(1); }
      lines.push([r.kind, p, res].join(';'));
    });
    var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'optics-protocol.csv';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  };

  /* ---------- анимация: бегущая волна ---------- */

  var lastFrame = 0;
  function frame(ts) {
    var dt = lastFrame ? Math.min(0.05, (ts - lastFrame) / 1000) : 0.016;
    lastFrame = ts;
    if (window.__bench === 'optics' && window.__benchVisible === 'optics' && playing) {
      phase += dt;
      // перерисовываем не чаще 20 раз в секунду: сцена — статичный SVG, гнать 60 кадров незачем
      if (phase - (frame._last || 0) > 0.05) { frame._last = phase; draw(); }
    }
    requestAnimationFrame(frame);
  }

  /* ---------- старт ---------- */

  draw();
  renderTask();
  renderMeasurements();
  requestAnimationFrame(frame);

  window.__optics = {
    lab: lab, facts: function () { return O.facts(lab); }, sample: sample,
    solved: function () { return solved; }, O: O,
    mode: function (m) { var b = $('oMode').querySelector('[data-mode="' + m + '"]'); if (b) b.click(); },
    set: function (k, v) { lab[k] = v; draw(); }
  };
})();

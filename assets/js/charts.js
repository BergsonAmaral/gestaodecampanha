/* ==========================================================================
   charts.js — biblioteca de gráficos SVG (sem dependências externas)
   Todos os gráficos são responsivos, animados e com tooltip interativo.
   ========================================================================== */
(function (global) {
  'use strict';
  const { svg, el, esc, num, dec, clamp } = global.U;

  /* ---------- tooltip compartilhado ---------- */
  let tipEl;
  function tip() {
    if (!tipEl) {
      tipEl = el('div', { class: 'chart-tip' });
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }
  function showTip(html, x, y) {
    const t = tip();
    t.innerHTML = html;
    t.classList.add('show');
    const r = t.getBoundingClientRect();
    t.style.left = clamp(x - r.width / 2, 8, innerWidth - r.width - 8) + 'px';
    t.style.top = Math.max(8, y - r.height - 14) + 'px';
  }
  function hideTip() {
    if (tipEl) tipEl.classList.remove('show');
  }

  /* ---------- infraestrutura ---------- */
  const registry = new Set();
  function mount(container, height, draw) {
    container.classList.add('chart');
    container.style.position = container.style.position || 'relative';
    let ultimaLargura = 0;
    const render = () => {
      const w = container.clientWidth;
      if (!w) return; // ainda sem largura: o observador redesenha quando ela existir
      ultimaLargura = w;
      const h = typeof height === 'function' ? height(w) : height;
      container.innerHTML = '';
      const s = svg('svg', { viewBox: '0 0 ' + w + ' ' + h, width: '100%', height: h, class: 'chart-svg' });
      container.appendChild(s);
      draw(s, w, h);
    };
    container.__render = render;
    registry.add(container);

    // redesenha sempre que a largura real mudar (entrada no DOM, grade, sidebar, janela)
    if (typeof ResizeObserver !== 'undefined') {
      let pendente;
      const ro = new ResizeObserver(() => {
        const w = container.clientWidth;
        if (!w || Math.abs(w - ultimaLargura) < 2) return;
        clearTimeout(pendente);
        pendente = setTimeout(render, 40);
      });
      ro.observe(container);
      container.__ro = ro;
    }
    render();

    // toque: traduz para mousemove/mouseleave no elemento tocado, para que
    // todo gráfico (barra, fatia, ponto) mostre o balão sem código duplicado
    let alvoTocado = null;
    // sem preventDefault: a rolagem da página e o toque para navegar (onClick)
    // continuam funcionando normalmente — isto só acrescenta o balão informativo
    container.addEventListener('touchstart', (ev) => {
      const t = ev.touches[0];
      const alvo = document.elementFromPoint(t.clientX, t.clientY);
      if (!alvo || !container.contains(alvo)) return;
      if (alvoTocado && alvoTocado !== alvo) alvoTocado.dispatchEvent(new MouseEvent('mouseleave'));
      alvoTocado = alvo;
      alvo.dispatchEvent(new MouseEvent('mousemove', { clientX: t.clientX, clientY: t.clientY, bubbles: true }));
    }, { passive: true });
    container.addEventListener('touchend', () => {
      setTimeout(() => { if (alvoTocado) { alvoTocado.dispatchEvent(new MouseEvent('mouseleave')); alvoTocado = null; } }, 1800);
    });

    return container;
  }
  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      registry.forEach((c) => {
        if (!document.body.contains(c)) return registry.delete(c);
        c.__render();
      });
    }, 160);
  });

  const niceMax = (v) => {
    if (v <= 0) return 10;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  };
  const short = (v) => (Math.abs(v) >= 1000 ? dec(v / 1000) + 'k' : num(v));

  function grid(s, x0, y0, w, h, max, ticks, fmt) {
    ticks = ticks || 4;
    for (let i = 0; i <= ticks; i++) {
      const y = y0 + h - (h * i) / ticks;
      s.appendChild(svg('line', { x1: x0, y1: y, x2: x0 + w, y2: y, class: 'grid-line' }));
      s.appendChild(svg('text', { x: x0 - 8, y: y + 4, class: 'axis-label', 'text-anchor': 'end' })).textContent =
        (fmt || short)((max * i) / ticks);
    }
  }

  function gradient(s, id, color, from, to) {
    const defs = svg('defs');
    const g = svg('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 });
    g.appendChild(svg('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': from === undefined ? 0.45 : from }));
    g.appendChild(svg('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': to === undefined ? 0.02 : to }));
    defs.appendChild(g);
    s.appendChild(defs);
    return id;
  }

  const smoothPath = (pts) => {
    if (pts.length < 2) return '';
    let d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i], p1 = pts[i + 1];
      const cx = (p0[0] + p1[0]) / 2;
      d += ' C' + cx + ' ' + p0[1] + ' ' + cx + ' ' + p1[1] + ' ' + p1[0] + ' ' + p1[1];
    }
    return d;
  };

  /* ==========================================================================
     Linha / área — séries múltiplas com crosshair
     ========================================================================== */
  function line(container, opts) {
    const dados = opts.data;
    const series = opts.series; // [{key, label, color, area}]
    return mount(container, opts.height || 260, (s, w, h) => {
      const max = niceMax(Math.max(1, ...dados.flatMap((d) => series.map((se) => d[se.key] || 0))) * 1.08);
      const pad = { l: Math.max(44, String((opts.fmtY || short)(max)).length * 7 + 12), r: 14, t: 16, b: 26 };
      const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
      grid(s, pad.l, pad.t, cw, ch, max, 4, opts.fmtY);
      const X = (i) => pad.l + (cw * i) / Math.max(1, dados.length - 1);
      const Y = (v) => pad.t + ch - (ch * (v || 0)) / max;

      series.forEach((se, si) => {
        const pts = dados.map((d, i) => [X(i), Y(d[se.key])]);
        const dPath = smoothPath(pts);
        if (se.area !== false) {
          const gid = gradient(s, 'g' + si + '_' + Math.random().toString(36).slice(2, 9), se.color);
          const a = svg('path', { d: dPath + ' L' + X(dados.length - 1) + ' ' + (pad.t + ch) + ' L' + X(0) + ' ' + (pad.t + ch) + ' Z', fill: 'url(#' + gid + ')', class: 'chart-area' });
          s.appendChild(a);
        }
        const path = svg('path', { d: dPath, fill: 'none', stroke: se.color, 'stroke-width': 2.4, 'stroke-linecap': 'round', class: 'chart-line' });
        s.appendChild(path);
        const len = path.getTotalLength ? path.getTotalLength() : 1000;
        path.style.strokeDasharray = len;
        path.style.strokeDashoffset = len;
        requestAnimationFrame(() => {
          path.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.3,.8,.3,1)';
          path.style.strokeDashoffset = 0;
        });
      });

      // eixo X
      const passo = Math.ceil(dados.length / (w < 520 ? 4 : 8));
      dados.forEach((d, i) => {
        if (i % passo && i !== dados.length - 1) return;
        const t = svg('text', { x: X(i), y: h - 6, class: 'axis-label', 'text-anchor': 'middle' });
        t.textContent = opts.labelX ? opts.labelX(d, i) : d.label;
        s.appendChild(t);
      });

      // interação
      const cross = svg('line', { y1: pad.t, y2: pad.t + ch, class: 'crosshair', opacity: 0 });
      s.appendChild(cross);
      const dots = series.map((se) => {
        const c = svg('circle', { r: 4.5, fill: se.color, stroke: 'var(--bg-1)', 'stroke-width': 2, opacity: 0 });
        s.appendChild(c);
        return c;
      });
      const overlay = svg('rect', { x: pad.l, y: pad.t, width: cw, height: ch, fill: 'transparent' });
      s.appendChild(overlay);
      const posicao = (clientX, clientY) => {
        const box = s.getBoundingClientRect();
        const rel = ((clientX - box.left) / box.width) * w;
        const i = clamp(Math.round(((rel - pad.l) / cw) * (dados.length - 1)), 0, dados.length - 1);
        marcar(i, clientX, clientY);
      };
      const marcar = (i, clientX, clientY) => {
        cross.setAttribute('x1', X(i));
        cross.setAttribute('x2', X(i));
        cross.setAttribute('opacity', 1);
        dots.forEach((c, si) => {
          c.setAttribute('cx', X(i));
          c.setAttribute('cy', Y(dados[i][series[si].key]));
          c.setAttribute('opacity', 1);
        });
        const html =
          '<div class="tip-title">' + esc(opts.labelTip ? opts.labelTip(dados[i], i) : dados[i].label) + '</div>' +
          series.map((se) => '<div class="tip-row"><i style="background:' + se.color + '"></i>' + esc(se.label) + '<b>' + num(dados[i][se.key]) + '</b></div>').join('');
        showTip(html, clientX, clientY);
      };
      const soltar = () => { cross.setAttribute('opacity', 0); dots.forEach((c) => c.setAttribute('opacity', 0)); hideTip(); };
      // no toque, o mount() traduz o toque em 'mousemove' sintético sobre este
      // elemento — não duplicamos o gesto aqui para não travar a rolagem da página
      overlay.addEventListener('mousemove', (ev) => posicao(ev.clientX, ev.clientY));
      overlay.addEventListener('mouseleave', soltar);
    });
  }

  /* ==========================================================================
     Barras verticais (simples ou agrupadas)
     ========================================================================== */
  function bars(container, opts) {
    const dados = opts.data; // [{label, valores:[..]}] ou [{label, valor}]
    const series = opts.series || [{ key: 'valor', label: opts.label || 'Valor', color: 'var(--accent)' }];
    return mount(container, opts.height || 250, (s, w, h) => {
      const max = niceMax(Math.max(1, ...dados.flatMap((d) => series.map((se) => d[se.key] || 0))) * 1.1);
      const pad = { l: Math.max(44, String((opts.fmtY || short)(max)).length * 7 + 12), r: 12, t: 16, b: 34 };
      const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
      grid(s, pad.l, pad.t, cw, ch, max, 4, opts.fmtY);
      const bw = cw / dados.length;
      const inner = Math.min(38, (bw * 0.68) / series.length);
      dados.forEach((d, i) => {
        series.forEach((se, si) => {
          const v = d[se.key] || 0;
          const bh = Math.max(1, (ch * v) / max);
          const x = pad.l + bw * i + bw / 2 - (inner * series.length) / 2 + inner * si;
          const r = svg('rect', { x, y: pad.t + ch - bh, width: inner - 3, height: bh, rx: 4, fill: se.color, class: 'chart-bar' });
          r.style.transformOrigin = '0 ' + (pad.t + ch) + 'px';
          r.style.animationDelay = i * 26 + 'ms';
          r.addEventListener('mousemove', (ev) =>
            showTip('<div class="tip-title">' + esc(d.label) + '</div>' + series.map((x2) => '<div class="tip-row"><i style="background:' + x2.color + '"></i>' + esc(x2.label) + '<b>' + (opts.fmtTip ? opts.fmtTip(d[x2.key]) : num(d[x2.key])) + '</b></div>').join(''), ev.clientX, ev.clientY)
          );
          r.addEventListener('mouseleave', hideTip);
          if (opts.onClick) { r.style.cursor = 'pointer'; r.addEventListener('click', () => opts.onClick(d, i)); }
          s.appendChild(r);
        });
        const t = svg('text', { x: pad.l + bw * i + bw / 2, y: h - 12, class: 'axis-label', 'text-anchor': 'middle' });
        t.textContent = d.label.length > 11 && dados.length > 8 ? d.label.slice(0, 10) + '…' : d.label;
        s.appendChild(t);
      });
    });
  }

  /* ==========================================================================
     Barras horizontais (rankings)
     ========================================================================== */
  function hbars(container, opts) {
    const dados = opts.data; // [{label, valor, sub, color}]
    const rowH = opts.rowH || 34;
    return mount(container, dados.length * rowH + 12, (s, w) => {
      const labelW = opts.labelW || Math.min(190, w * 0.42);
      const cw = w - labelW - 62;
      const max = Math.max(1, ...dados.map((d) => d.valor));
      dados.forEach((d, i) => {
        const y = i * rowH + 6;
        const t = svg('text', { x: 0, y: y + rowH / 2 + 1, class: 'hbar-label' });
        t.textContent = d.label.length > 26 ? d.label.slice(0, 25) + '…' : d.label;
        s.appendChild(t);
        s.appendChild(svg('rect', { x: labelW, y: y + 4, width: cw, height: rowH - 16, rx: 5, class: 'hbar-track' }));
        const bw = Math.max(3, (cw * d.valor) / max);
        const r = svg('rect', { x: labelW, y: y + 4, width: bw, height: rowH - 16, rx: 5, fill: d.color || 'var(--accent)', class: 'hbar-fill' });
        r.style.transformOrigin = labelW + 'px 0';
        r.style.animationDelay = i * 40 + 'ms';
        r.addEventListener('mousemove', (ev) => showTip('<div class="tip-title">' + esc(d.label) + '</div><div class="tip-row">' + esc(d.sub || 'Total') + '<b>' + (opts.fmt ? opts.fmt(d.valor) : num(d.valor)) + '</b></div>', ev.clientX, ev.clientY));
        r.addEventListener('mouseleave', hideTip);
        s.appendChild(r);
        const v = svg('text', { x: w - 4, y: y + rowH / 2 + 1, class: 'hbar-value', 'text-anchor': 'end' });
        v.textContent = opts.fmt ? opts.fmt(d.valor) : num(d.valor);
        s.appendChild(v);
        if (opts.onClick) { r.style.cursor = 'pointer'; r.addEventListener('click', () => opts.onClick(d, i)); }
      });
    });
  }

  /* ==========================================================================
     Rosca (donut)
     ========================================================================== */
  function donut(container, opts) {
    const dados = opts.data; // [{label, valor, color}]
    return mount(container, opts.height || 230, (s, w, h) => {
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 10, r0 = R * (opts.thickness || 0.62);
      const total = dados.reduce((a, b) => a + b.valor, 0) || 1;
      let ang = -Math.PI / 2;
      const g = svg('g', { class: 'donut-g' });
      s.appendChild(g);
      dados.forEach((d, i) => {
        const a1 = ang, a2 = ang + (d.valor / total) * Math.PI * 2;
        ang = a2;
        const large = a2 - a1 > Math.PI ? 1 : 0;
        const p = svg('path', {
          d: ['M', cx + Math.cos(a1) * R, cy + Math.sin(a1) * R, 'A', R, R, 0, large, 1, cx + Math.cos(a2) * R, cy + Math.sin(a2) * R,
              'L', cx + Math.cos(a2) * r0, cy + Math.sin(a2) * r0, 'A', r0, r0, 0, large, 0, cx + Math.cos(a1) * r0, cy + Math.sin(a1) * r0, 'Z'].join(' '),
          fill: d.color, class: 'donut-slice',
        });
        p.style.animationDelay = i * 70 + 'ms';
        p.addEventListener('mousemove', (ev) => showTip('<div class="tip-title">' + esc(d.label) + '</div><div class="tip-row"><i style="background:' + d.color + '"></i>Total<b>' + num(d.valor) + ' · ' + dec((d.valor / total) * 100) + '%</b></div>', ev.clientX, ev.clientY));
        p.addEventListener('mouseleave', hideTip);
        if (opts.onClick) { p.style.cursor = 'pointer'; p.addEventListener('click', () => opts.onClick(d)); }
        g.appendChild(p);
      });
      if (opts.centro) {
        const t1 = svg('text', { x: cx, y: cy - 2, class: 'donut-center-value', 'text-anchor': 'middle' });
        t1.textContent = opts.centro.valor;
        const t2 = svg('text', { x: cx, y: cy + 18, class: 'donut-center-label', 'text-anchor': 'middle' });
        t2.textContent = opts.centro.rotulo;
        s.appendChild(t1);
        s.appendChild(t2);
      }
    });
  }

  /* ==========================================================================
     Funil de relacionamento
     ========================================================================== */
  function funnel(container, opts) {
    const dados = opts.data;
    return mount(container, dados.length * 46 + 10, (s, w) => {
      const max = Math.max(...dados.map((d) => d.valor)) || 1;
      dados.forEach((d, i) => {
        const y = i * 46 + 4;
        const bw = (w - 8) * (d.valor / max);
        const x = (w - bw) / 2;
        const r = svg('rect', { x, y, width: bw, height: 34, rx: 8, fill: d.cor, class: 'funnel-bar' });
        r.style.animationDelay = i * 60 + 'ms';
        r.addEventListener('mousemove', (ev) => {
          const conv = i ? dec((d.valor / dados[i - 1].valor) * 100) + '% do estágio anterior' : '100% da base';
          showTip('<div class="tip-title">' + esc(d.rotulo) + '</div><div class="tip-row">Pessoas<b>' + num(d.valor) + '</b></div><div class="tip-sub">' + conv + '</div>', ev.clientX, ev.clientY);
        });
        r.addEventListener('mouseleave', hideTip);
        if (opts.onClick) { r.style.cursor = 'pointer'; r.addEventListener('click', () => opts.onClick(d)); }
        s.appendChild(r);
        const texto = d.rotulo + ' · ' + num(d.valor);
        const cabe = bw > texto.length * 6.6 + 18;
        const t = svg('text', {
          x: cabe ? w / 2 : x + bw + 8, y: y + 22,
          class: 'funnel-label', 'text-anchor': cabe ? 'middle' : 'start',
          style: cabe ? '' : 'fill:var(--txt-2);font-weight:550',
        });
        t.textContent = texto;
        s.appendChild(t);
      });
    });
  }

  /* ==========================================================================
     Anel de progresso
     ========================================================================== */
  function ring(container, opts) {
    const v = clamp(opts.valor, 0, 100);
    return mount(container, opts.height || 150, (s, w, h) => {
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 10;
      const C = 2 * Math.PI * R;
      s.appendChild(svg('circle', { cx, cy, r: R, fill: 'none', 'stroke-width': opts.espessura || 11, class: 'ring-track' }));
      const arc = svg('circle', { cx, cy, r: R, fill: 'none', 'stroke-width': opts.espessura || 11, stroke: opts.cor || 'var(--accent)', 'stroke-linecap': 'round', transform: 'rotate(-90 ' + cx + ' ' + cy + ')' });
      arc.style.strokeDasharray = C;
      arc.style.strokeDashoffset = C;
      s.appendChild(arc);
      requestAnimationFrame(() => {
        arc.style.transition = 'stroke-dashoffset 1s cubic-bezier(.3,.8,.3,1)';
        arc.style.strokeDashoffset = C - (C * v) / 100;
      });
      const t = svg('text', { x: cx, y: cy + 4, class: 'ring-value', 'text-anchor': 'middle' });
      t.textContent = Math.round(v) + '%';
      s.appendChild(t);
      if (opts.rotulo) {
        const l = svg('text', { x: cx, y: cy + 24, class: 'ring-label', 'text-anchor': 'middle' });
        l.textContent = opts.rotulo;
        s.appendChild(l);
      }
    });
  }

  /* ==========================================================================
     Sparkline compacto
     ========================================================================== */
  function spark(container, valores, cor) {
    return mount(container, 42, (s, w, h) => {
      const max = Math.max(1, ...valores), min = Math.min(...valores);
      const pts = valores.map((v, i) => [(w * i) / (valores.length - 1), h - 4 - ((h - 10) * (v - min)) / (max - min || 1)]);
      const d = smoothPath(pts);
      const id = 'sp' + Math.random().toString(36).slice(2, 8);
      gradient(s, id, cor || 'var(--accent)', 0.35, 0);
      s.appendChild(svg('path', { d: d + ' L' + w + ' ' + h + ' L0 ' + h + ' Z', fill: 'url(#' + id + ')' }));
      s.appendChild(svg('path', { d, fill: 'none', stroke: cor || 'var(--accent)', 'stroke-width': 2, 'stroke-linecap': 'round' }));
      s.appendChild(svg('circle', { cx: pts[pts.length - 1][0] - 1, cy: pts[pts.length - 1][1], r: 3, fill: cor || 'var(--accent)' }));
    });
  }

  /* ==========================================================================
     Radar (desempenho multidimensional)
     ========================================================================== */
  function radar(container, opts) {
    const eixos = opts.eixos; // [{label, valor 0..100}]
    return mount(container, opts.height || 260, (s, w, h) => {
      const cx = w / 2, cy = h / 2 + 4, R = Math.min(w, h) / 2 - 34;
      const n = eixos.length;
      const pt = (i, t) => [cx + Math.cos((i / n) * 2 * Math.PI - Math.PI / 2) * R * t, cy + Math.sin((i / n) * 2 * Math.PI - Math.PI / 2) * R * t];
      [0.25, 0.5, 0.75, 1].forEach((t) => {
        const d = eixos.map((_, i) => pt(i, t)).map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ') + ' Z';
        s.appendChild(svg('path', { d, class: 'radar-grid' }));
      });
      eixos.forEach((e, i) => {
        const p = pt(i, 1);
        s.appendChild(svg('line', { x1: cx, y1: cy, x2: p[0], y2: p[1], class: 'radar-grid' }));
        const lp = pt(i, 1.17);
        const t = svg('text', { x: lp[0], y: lp[1] + 4, class: 'axis-label', 'text-anchor': lp[0] > cx + 6 ? 'start' : lp[0] < cx - 6 ? 'end' : 'middle' });
        t.textContent = e.label;
        s.appendChild(t);
      });
      const pts = eixos.map((e, i) => pt(i, clamp(e.valor, 0, 100) / 100));
      const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ') + ' Z';
      const poly = svg('path', { d, class: 'radar-area', fill: opts.cor || 'var(--accent)' });
      s.appendChild(poly);
      pts.forEach((p, i) => {
        const c = svg('circle', { cx: p[0], cy: p[1], r: 3.5, fill: opts.cor || 'var(--accent)' });
        c.addEventListener('mousemove', (ev) => showTip('<div class="tip-title">' + esc(eixos[i].label) + '</div><div class="tip-row">Índice<b>' + Math.round(eixos[i].valor) + '%</b></div>', ev.clientX, ev.clientY));
        c.addEventListener('mouseleave', hideTip);
        s.appendChild(c);
      });
    });
  }

  /* ==========================================================================
     Calendário de intensidade
     ========================================================================== */
  function heatCal(container, opts) {
    const dados = opts.data; // [{data, valor}]
    const cols = Math.ceil(dados.length / 7);
    return mount(container, 7 * 16 + 22, (s, w) => {
      const cell = Math.min(16, (w - 30) / cols);
      const max = Math.max(1, ...dados.map((d) => d.valor));
      dados.forEach((d, i) => {
        const c = Math.floor(i / 7), r = i % 7;
        const t = d.valor / max;
        const rect = svg('rect', { x: 28 + c * cell, y: 16 + r * cell, width: cell - 2.5, height: cell - 2.5, rx: 3, fill: d.valor ? global.U.scaleColor(0.12 + t * 0.88, document.documentElement.dataset.tema === 'escuro' ? ['#16324f', '#1d6fd0', '#22d3a5'] : ['#e8f1ee', '#7fcbb0', '#0b6b52']) : 'var(--surface-3)', class: 'heat-cell' });
        rect.addEventListener('mousemove', (ev) => showTip('<div class="tip-title">' + global.U.fmtDate(d.data) + '</div><div class="tip-row">' + esc(opts.rotulo || 'Registros') + '<b>' + num(d.valor) + '</b></div>', ev.clientX, ev.clientY));
        rect.addEventListener('mouseleave', hideTip);
        s.appendChild(rect);
      });
      ['seg', 'qua', 'sex'].forEach((lbl, k) => {
        const t = svg('text', { x: 0, y: 16 + (k * 2 + 1) * cell + cell * 0.7, class: 'axis-label' });
        t.textContent = lbl;
        s.appendChild(t);
      });
    });
  }

  /* ==========================================================================
     Rede de indicações (layout radial determinístico)
     ========================================================================== */
  function rede(container, opts) {
    const raiz = opts.raiz; // {label}
    const filhos = opts.filhos; // [{label, valor, filhos:[{label}]}]
    return mount(container, opts.height || 320, (s, w, h) => {
      const cx = w / 2, cy = h / 2, R1 = Math.min(w, h) * 0.3, R2 = Math.min(w, h) * 0.46;
      const gLinks = svg('g'), gNodes = svg('g');
      s.appendChild(gLinks); s.appendChild(gNodes);
      filhos.forEach((f, i) => {
        const a = (i / filhos.length) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * R1, y = cy + Math.sin(a) * R1;
        gLinks.appendChild(svg('path', { d: 'M' + cx + ' ' + cy + ' Q' + (cx + Math.cos(a) * R1 * 0.5) + ' ' + (cy + Math.sin(a) * R1 * 0.72) + ' ' + x + ' ' + y, class: 'net-link' }));
        (f.filhos || []).forEach((g, k, arr) => {
          const a2 = a + (k - (arr.length - 1) / 2) * 0.13;
          const x2 = cx + Math.cos(a2) * R2, y2 = cy + Math.sin(a2) * R2;
          gLinks.appendChild(svg('path', { d: 'M' + x + ' ' + y + ' L' + x2 + ' ' + y2, class: 'net-link dim' }));
          const c2 = svg('circle', { cx: x2, cy: y2, r: 4, class: 'net-node small' });
          c2.addEventListener('mousemove', (ev) => showTip('<div class="tip-title">' + esc(g.label) + '</div><div class="tip-sub">indicado por ' + esc(f.label) + '</div>', ev.clientX, ev.clientY));
          c2.addEventListener('mouseleave', hideTip);
          gNodes.appendChild(c2);
        });
        const c = svg('circle', { cx: x, cy: y, r: 6 + Math.min(10, f.valor * 0.5), class: 'net-node' });
        c.addEventListener('mousemove', (ev) => showTip('<div class="tip-title">' + esc(f.label) + '</div><div class="tip-row">Indicações<b>' + num(f.valor) + '</b></div>', ev.clientX, ev.clientY));
        c.addEventListener('mouseleave', hideTip);
        if (opts.onClick) { c.style.cursor = 'pointer'; c.addEventListener('click', () => opts.onClick(f)); }
        gNodes.appendChild(c);
      });
      gNodes.appendChild(svg('circle', { cx, cy, r: 16, class: 'net-root' }));
      const t = svg('text', { x: cx, y: cy + 4, class: 'net-root-label', 'text-anchor': 'middle' });
      t.textContent = raiz.label;
      gNodes.appendChild(t);
    });
  }

  global.CH = { line, bars, hbars, donut, funnel, ring, spark, radar, heatCal, rede, showTip, hideTip, mount, niceMax, short };
})(window);

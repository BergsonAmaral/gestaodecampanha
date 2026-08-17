/* ==========================================================================
   map.js — mapa territorial interativo (choropleth + camadas + zoom)
   ========================================================================== */
(function (global) {
  'use strict';
  const { svg, el, esc, num, dec, scaleColor, clamp } = global.U;

  const METRICAS = {
    apoiadores: { rotulo: 'Apoiadores', fmt: num, desc: 'Total de apoiadores declarados no bairro' },
    cobertura: { rotulo: 'Cobertura do eleitorado', fmt: (v) => dec(v) + '%', desc: 'Apoiadores sobre o eleitorado estimado' },
    metaPct: { rotulo: 'Atingimento da meta', fmt: (v) => Math.round(v) + '%', desc: 'Apoiadores sobre a meta do território' },
    pessoas: { rotulo: 'Pessoas cadastradas', fmt: num, desc: 'Total de pessoas na base' },
    liderancas: { rotulo: 'Lideranças', fmt: num, desc: 'Lideranças com atuação no território' },
    eventos: { rotulo: 'Eventos', fmt: num, desc: 'Atividades registradas no território' },
    tarefasAtrasadas: { rotulo: 'Tarefas atrasadas', fmt: num, desc: 'Tarefas vencidas sem conclusão' },
    diasSemAtividade: { rotulo: 'Dias sem atividade', fmt: num, desc: 'Tempo desde o último registro no bairro' },
  };
  const PALETAS_CLARO = {
    campanha: ['#f2f7f5', '#c3e5d7', '#5cbf9c', '#0b6b52'],
    frio: ['#f3f7fb', '#c8def1', '#6aa9db', '#1d5fa6'],
    alerta: ['#f8f9fb', '#fbdcc4', '#ef9a55', '#d93a4e'],
  };
  const PALETAS_ESCURO = {
    campanha: ['#14243f', '#1d4ed8', '#22d3a5', '#a7f3d0'],
    frio: ['#132b45', '#1b5fa8', '#22b0d3', '#5eead4'],
    alerta: ['#1f2937', '#7c3aed', '#f97316', '#fb7185'],
  };
  const PALETAS = new Proxy({}, { get: (_, k) =>
    (document.documentElement.dataset.tema === 'escuro' ? PALETAS_ESCURO : PALETAS_CLARO)[k] });

  function render(container, opts) {
    opts = opts || {};
    const metrica = opts.metrica || 'apoiadores';
    const modo = opts.modo || 'choropleth';
    const stats = global.DB.territorioStats();
    const idx = new Map(stats.map((s) => [s.id, s]));
    const inverso = metrica === 'diasSemAtividade' || metrica === 'tarefasAtrasadas';
    const paleta = PALETAS[opts.paleta || (inverso ? 'alerta' : 'campanha')];
    const vals = stats.map((s) => s[metrica] || 0);
    const min = Math.min(...vals), max = Math.max(...vals) || 1;
    const t = (v) => (max === min ? 0.6 : (v - min) / (max - min));

    container.innerHTML = '';
    container.classList.add('mapa-wrap');
    const M = global.DB.mapa;
    if (!M) {
      // nenhum bairro cadastrado ainda — sem geometria para desenhar
      container.appendChild(global.U.el('div', { class: 'vazio', text: 'Cadastre os bairros do município em Territórios para o mapa aparecer aqui.' }));
      return;
    }
    const s = svg('svg', { viewBox: '0 0 ' + M.w + ' ' + M.h, class: 'mapa-svg', preserveAspectRatio: 'xMidYMid meet' });
    container.appendChild(s);

    /* filtros e brilho */
    const defs = svg('defs');
    defs.innerHTML =
      '<filter id="mapGlow" x="-20%" y="-20%" width="140%" height="140%">' +
      '<feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<radialGradient id="mapHalo" cx="50%" cy="50%" r="55%"><stop offset="0%" stop-color="#2dd4bf" stop-opacity=".22"/><stop offset="100%" stop-color="#2dd4bf" stop-opacity="0"/></radialGradient>';
    s.appendChild(defs);

    const world = svg('g', { class: 'mapa-world' });
    s.appendChild(world);
    world.appendChild(svg('ellipse', { cx: M.w / 2, cy: M.h / 2, rx: M.w / 2, ry: M.h / 2, fill: 'url(#mapHalo)' }));
    world.appendChild(svg('path', { d: M.outlinePath, class: 'mapa-outline', filter: 'url(#mapGlow)' }));

    const gCells = svg('g'); world.appendChild(gCells);
    const gLabels = svg('g'); world.appendChild(gLabels);
    const gLayer = svg('g'); world.appendChild(gLayer);

    global.DB.bairros.forEach((b, i) => {
      const st = idx.get(b.id);
      const v = st[metrica] || 0;
      const p = svg('path', {
        d: b.path, class: 'mapa-cell' + (opts.selecionado === b.id ? ' sel' : ''),
        fill: scaleColor(0.08 + t(v) * 0.92, paleta), 'data-id': b.id,
      });
      p.style.animationDelay = i * 22 + 'ms';
      const balao = (bb, ss) =>
        '<div class="tip-title">' + esc(bb.nome) + '</div>' +
        '<div class="tip-sub">' + esc(ss.regiao) + (bb.zona ? ' · zona ' + bb.zona : '') + '</div>' +
        '<div class="tip-row">' + esc(METRICAS[metrica].rotulo) + '<b>' + METRICAS[metrica].fmt(v) + '</b></div>' +
        '<div class="tip-row">Apoiadores<b>' + num(ss.apoiadores) + '</b></div>' +
        '<div class="tip-row">Meta<b>' + Math.round(ss.metaPct) + '%</b></div>' +
        '<div class="tip-row">Eleitorado<b>' + num(ss.eleitores) + '</b></div>';
      p.addEventListener('mousemove', (ev) => global.CH.showTip(balao(b, st), ev.clientX, ev.clientY));
      p.addEventListener('mouseleave', global.CH.hideTip);
      let tocado = false;
      p.addEventListener('touchstart', (ev) => {
        // no celular o primeiro toque mostra os números; o segundo abre o território
        if (!tocado) {
          ev.preventDefault();
          tocado = true;
          const t = ev.touches[0];
          global.CH.showTip(balao(b, st), t.clientX, t.clientY);
          setTimeout(() => { tocado = false; global.CH.hideTip(); }, 2600);
        } else if (opts.onSelect) opts.onSelect(b.id);
      }, { passive: false });
      p.addEventListener('click', () => opts.onSelect && opts.onSelect(b.id));
      gCells.appendChild(p);

      const lb = svg('text', { x: b.center[0], y: b.center[1] - 2, class: 'mapa-label', 'text-anchor': 'middle' });
      lb.textContent = b.nome;
      const val = svg('text', { x: b.center[0], y: b.center[1] + 13, class: 'mapa-value', 'text-anchor': 'middle' });
      val.textContent = METRICAS[metrica].fmt(v);
      gLabels.appendChild(lb); gLabels.appendChild(val);
    });

    /* camadas adicionais */
    if (modo === 'eventos') {
      const evs = global.DB.eventos.filter((e) => e.publicoPresente);
      const maxP = Math.max(...evs.map((e) => e.publicoPresente));
      evs.forEach((e, i) => {
        const b = global.DB.terr(e.territorioId);
        const jx = ((i * 37) % 60) - 30, jy = ((i * 53) % 44) - 22;
        const c = svg('circle', { cx: b.center[0] + jx, cy: b.center[1] + jy, r: 5 + (e.publicoPresente / maxP) * 20, class: 'mapa-bolha' });
        c.addEventListener('mousemove', (ev) => global.CH.showTip('<div class="tip-title">' + esc(e.nome) + '</div><div class="tip-sub">' + global.U.fmtDate(e.data) + '</div><div class="tip-row">Público<b>' + num(e.publicoPresente) + '</b></div><div class="tip-row">Novos cadastros<b>' + num(e.novosCadastros) + '</b></div>', ev.clientX, ev.clientY));
        c.addEventListener('mouseleave', global.CH.hideTip);
        gLayer.appendChild(c);
      });
    }
    if (modo === 'liderancas') {
      global.DB.liderancas.forEach((l, i) => {
        const p = global.DB.P(l.pessoaId);
        const b = global.DB.terr(p.bairroId);
        if (!b || !b.center) return;
        const jx = ((i * 29) % 70) - 35, jy = ((i * 41) % 50) - 25;
        const g = svg('g', { class: 'mapa-pin' });
        g.appendChild(svg('path', { d: 'M0 0 c0 -7 -5 -10 -5 -15 a5 5 0 0 1 10 0 c0 5 -5 8 -5 15 z', transform: 'translate(' + (b.center[0] + jx) + ',' + (b.center[1] + jy) + ')', class: 'pin-shape', style: 'fill:' + (l.capacidade >= 4 ? '#fb7185' : l.capacidade >= 3 ? '#f59e0b' : '#38bdf8') }));
        g.addEventListener('mousemove', (ev) => global.CH.showTip('<div class="tip-title">' + esc(p.nome) + '</div><div class="tip-sub">' + esc(l.segmento) + ' · ' + esc(b.nome) + '</div><div class="tip-row">Capacidade<b>' + l.capacidade + ' de 5' + '</b></div><div class="tip-row">Alcance estimado<b>' + num(l.alcanceEstimado) + '</b></div>', ev.clientX, ev.clientY));
        g.addEventListener('mouseleave', global.CH.hideTip);
        gLayer.appendChild(g);
      });
    }
    if (modo === 'equipes') {
      global.DB.equipes.forEach((eq) => {
        const b = global.DB.terr(eq.territorioId);
        if (!b || !b.center) return;
        const st = global.DB.equipeStats(eq);
        const g = svg('g', { class: 'mapa-pin' });
        const c = svg('circle', { cx: b.center[0], cy: b.center[1] + 26, r: 12, class: 'mapa-eq', style: 'fill:' + (st.desempenho >= 70 ? '#22d3a5' : st.desempenho >= 45 ? '#f59e0b' : '#f43f5e') });
        g.appendChild(c);
        const t2 = svg('text', { x: b.center[0], y: b.center[1] + 30, class: 'mapa-eq-label', 'text-anchor': 'middle' });
        t2.textContent = st.desempenho;
        g.appendChild(t2);
        g.addEventListener('mousemove', (ev) => global.CH.showTip('<div class="tip-title">' + esc(eq.nome) + '</div><div class="tip-row">Desempenho<b>' + st.desempenho + '%</b></div><div class="tip-row">Tarefas concluídas<b>' + st.concluidas + '/' + st.tarefas + '</b></div><div class="tip-row">Cadastros<b>' + num(st.cadastros) + '</b></div>', ev.clientX, ev.clientY));
        g.addEventListener('mouseleave', global.CH.hideTip);
        gLayer.appendChild(g);
      });
    }

    /* zoom e deslocamento */
    let k = 1, tx = 0, ty = 0;
    const apply = () => { world.setAttribute('transform', 'translate(' + tx + ',' + ty + ') scale(' + k + ')'); container.classList.toggle('zoomed', k > 1.05); };
    s.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const box = s.getBoundingClientRect();
      const mx = ((ev.clientX - box.left) / box.width) * M.w, my = ((ev.clientY - box.top) / box.height) * M.h;
      const nk = clamp(k * (ev.deltaY < 0 ? 1.18 : 0.85), 1, 6);
      tx = mx - ((mx - tx) / k) * nk; ty = my - ((my - ty) / k) * nk;
      k = nk;
      if (k === 1) { tx = 0; ty = 0; }
      apply();
    }, { passive: false });
    let drag = null;
    s.addEventListener('mousedown', (ev) => { drag = { x: ev.clientX, y: ev.clientY, tx, ty }; s.classList.add('grabbing'); });
    window.addEventListener('mouseup', () => { drag = null; s.classList.remove('grabbing'); });
    s.addEventListener('mousemove', (ev) => {
      if (!drag) return;
      const box = s.getBoundingClientRect();
      tx = drag.tx + ((ev.clientX - drag.x) / box.width) * M.w;
      ty = drag.ty + ((ev.clientY - drag.y) / box.height) * M.h;
      apply();
    });

    /* toque: um dedo arrasta, dois dedos aproximam */
    let toque = null;
    const centro = (t) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
    const distancia = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    s.addEventListener('touchstart', (ev) => {
      const t = ev.touches;
      if (t.length === 1) toque = { modo: 'arrasto', x: t[0].clientX, y: t[0].clientY, tx, ty };
      else if (t.length === 2) toque = { modo: 'pinca', d: distancia(t), c: centro(t), k, tx, ty };
    }, { passive: true });
    s.addEventListener('touchmove', (ev) => {
      if (!toque) return;
      const box = s.getBoundingClientRect();
      const t = ev.touches;
      if (toque.modo === 'arrasto' && t.length === 1) {
        if (k <= 1.02) return; // sem aproximação, deixa a página rolar
        ev.preventDefault();
        tx = toque.tx + ((t[0].clientX - toque.x) / box.width) * M.w;
        ty = toque.ty + ((t[0].clientY - toque.y) / box.height) * M.h;
        apply();
      } else if (toque.modo === 'pinca' && t.length === 2) {
        ev.preventDefault();
        const nk = clamp(toque.k * (distancia(t) / toque.d), 1, 6);
        const mx = ((toque.c.x - box.left) / box.width) * M.w;
        const my = ((toque.c.y - box.top) / box.height) * M.h;
        tx = mx - ((mx - toque.tx) / toque.k) * nk;
        ty = my - ((my - toque.ty) / toque.k) * nk;
        k = nk;
        if (k <= 1.01) { k = 1; tx = 0; ty = 0; }
        apply();
      }
    }, { passive: false });
    s.addEventListener('touchend', () => { toque = null; });

    /* controles + legenda */
    const ctrl = el('div', { class: 'mapa-ctrl' }, [
      el('button', { class: 'icon-btn', html: global.icHTML('zoom-in', 16), title: 'Aproximar', onclick: () => { k = clamp(k * 1.35, 1, 6); apply(); } }),
      el('button', { class: 'icon-btn', html: global.icHTML('zoom-out', 16), title: 'Afastar', onclick: () => { k = clamp(k / 1.35, 1, 6); if (k === 1) { tx = 0; ty = 0; } apply(); } }),
      el('button', { class: 'icon-btn', html: global.icHTML('refresh-cw', 15), title: 'Restaurar', onclick: () => { k = 1; tx = 0; ty = 0; apply(); } }),
    ]);
    container.appendChild(ctrl);

    const grad = 'linear-gradient(90deg,' + [0, 0.33, 0.66, 1].map((x) => scaleColor(x, paleta)).join(',') + ')';
    container.appendChild(
      el('div', { class: 'mapa-legenda' }, [
        el('div', { class: 'ml-titulo', text: METRICAS[metrica].rotulo }),
        el('div', { class: 'ml-escala', style: { background: grad } }),
        el('div', { class: 'ml-eixo' }, [
          el('span', { text: METRICAS[metrica].fmt(min) }),
          el('span', { text: METRICAS[metrica].fmt(max) }),
        ]),
        el('div', { class: 'ml-desc', text: METRICAS[metrica].desc }),
      ])
    );
    return { METRICAS };
  }

  global.MAPA = { render, METRICAS, PALETAS };
})(window);

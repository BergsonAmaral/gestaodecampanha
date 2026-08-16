/* ==========================================================================
   ui.js — componentes reutilizáveis de interface
   ========================================================================== */
(function (global) {
  'use strict';
  const { el, esc, num, dec, pct, initials, sortBy } = global.U;

  const CORES_STATUS = {
    'concluída': 'verde', 'em andamento': 'azul', 'não iniciada': 'cinza', 'atrasada': 'vermelho', 'cancelada': 'cinza',
    'realizado': 'verde', 'confirmado': 'azul', 'pendências': 'laranja',
    'aberta': 'laranja', 'em análise': 'azul', 'encaminhada': 'roxo', 'atendida': 'verde', 'não atendida': 'vermelho',
    'disponível': 'verde', 'em uso': 'azul', 'manutenção': 'laranja',
    'urgente': 'vermelho', 'alta': 'laranja', 'média': 'azul', 'baixa': 'cinza',
    'aproximação': 'cinza', 'relacionamento': 'azul', 'compromisso firmado': 'verde', 'em disputa': 'laranja', 'afastada': 'vermelho',
    'resolvida': 'verde', 'em atendimento': 'azul',
  };
  const tag = (txt, cor) => el('span', { class: 'tag ' + (cor || CORES_STATUS[txt] || 'cinza') + ' ponto', text: txt });

  function cabecalho(titulo, sub, acoes) {
    return el('div', { class: 'cabecalho' }, [
      el('div', {}, [el('h1', { text: titulo }), sub ? el('p', { text: sub }) : null]),
      acoes ? el('div', { class: 'acoes' }, acoes) : null,
    ]);
  }

  function cartao(titulo, sub, conteudo, direita) {
    const c = el('div', { class: 'cartao' });
    if (titulo) {
      c.appendChild(el('div', { class: 'cartao-topo' }, [
        el('div', {}, [el('h3', { text: titulo }), sub ? el('p', { text: sub }) : null]),
        direita ? el('div', { class: 'direita' }, direita) : null,
      ]));
    }
    (Array.isArray(conteudo) ? conteudo : [conteudo]).forEach((x) => x && c.appendChild(x));
    return c;
  }

  function kpi(o) {
    const card = el('div', { class: 'cartao kpi' }, [
      el('div', { class: 'kpi-rotulo' }, [
        o.icone ? el('span', { class: 'kpi-icone', style: { '--kpi-cor': o.cor || 'var(--accent)', '--kpi-soft': o.corSoft || 'var(--accent-soft)' } }, global.ic(o.icone, 15)) : null,
        el('span', { text: o.rotulo }),
      ]),
      el('div', { class: 'kpi-valor', text: o.valor }),
      el('div', { class: 'kpi-rodape' }, [
        o.delta !== undefined && o.delta !== null
          ? el('span', { class: 'delta ' + (o.delta > 0 ? 'sobe' : o.delta < 0 ? 'desce' : 'neutro'),
              html: global.icHTML(o.delta > 0 ? 'trending-up' : o.delta < 0 ? 'trending-down' : 'circle', 12) + ' ' + Math.abs(o.delta) + '%' })
          : null,
        el('span', { text: o.nota || '' }),
      ]),
    ]);
    if (o.serie) {
      const sp = el('div', { class: 'kpi-spark' });
      card.appendChild(sp);
      setTimeout(() => global.CH.spark(sp, o.serie, o.cor || 'var(--accent)'), 0);
    }
    if (o.rota) { card.style.cursor = 'pointer'; card.addEventListener('click', () => (location.hash = o.rota)); }
    return card;
  }

  function avatarPessoa(id, tam) {
    const p = global.DB.P(id);
    const cls = p && p.classificacao === 'lideranca' ? ' lid' : p && p.classificacao === 'mobilizador' ? ' mob' : p && global.DB.isApoiador(p) ? ' apo' : '';
    return el('div', { class: 'avatar' + (tam ? ' ' + tam : '') + cls, text: p ? initials(p.nome) : '?' });
  }

  function pessoaCell(id, sub) {
    const p = global.DB.P(id);
    if (!p) return el('span', { text: '—' });
    return el('div', { class: 'pessoa-linha' }, [
      avatarPessoa(id, 'pequeno'),
      el('div', { style: { minWidth: 0 } }, [
        el('b', { text: p.nome }),
        el('small', { text: sub !== undefined ? sub : (global.DB.funcaoDe(id) || global.DB.CLASSIF_LABEL[p.classificacao]) + ' · ' + global.DB.terr(p.bairroId).nome }),
      ]),
    ]);
  }

  function barra(valor, max, cor) {
    const p = Math.min(100, max ? (valor / max) * 100 : 0);
    return el('div', { class: 'barra' }, el('i', { style: { width: p + '%', background: cor || (p >= 80 ? 'var(--accent)' : p >= 45 ? 'var(--warn)' : 'var(--danger)') } }));
  }

  /** Tabela com ordenação, filtro textual e paginação */
  function tabela(opts) {
    const wrap = el('div', {});
    const estado = { ord: opts.ordPadrao || null, dir: opts.dirPadrao || 'desc', pagina: 0, tam: opts.tam || 25 };
    const box = el('div', { class: 'tabela-wrap' });
    const rodape = el('div', { class: 'filtros', style: { marginTop: '12px', justifyContent: 'flex-end' } });
    wrap.appendChild(box);
    wrap.appendChild(rodape);

    function desenhar() {
      let linhas = opts.linhas.slice();
      if (estado.ord) {
        const col = opts.colunas.find((c) => c.k === estado.ord);
        const f = col.valor || ((r) => r[col.k]);
        linhas = sortBy(linhas, (r) => { const v = f(r); return typeof v === 'string' ? global.U.norm(v) : v; }, estado.dir);
      }
      const total = linhas.length;
      const paginas = Math.max(1, Math.ceil(total / estado.tam));
      estado.pagina = Math.min(estado.pagina, paginas - 1);
      const vis = linhas.slice(estado.pagina * estado.tam, (estado.pagina + 1) * estado.tam);

      box.innerHTML = '';
      const t = el('table');
      const thead = el('thead');
      const tr = el('tr');
      opts.colunas.forEach((c) => {
        const th = el('th', { class: (c.num ? 'num' : '') + (estado.ord === c.k ? ' ord' + (estado.dir === 'asc' ? ' asc' : '') : ''), text: c.rotulo, title: 'Ordenar por ' + c.rotulo, onclick: () => {
          if (estado.ord === c.k) estado.dir = estado.dir === 'asc' ? 'desc' : 'asc';
          else { estado.ord = c.k; estado.dir = c.num ? 'desc' : 'asc'; }
          desenhar();
        }});
        tr.appendChild(th);
      });
      if (opts.onRow) tr.appendChild(el('th', { style: { width: '34px' } }));
      thead.appendChild(tr);
      t.appendChild(thead);
      const tb = el('tbody');
      if (!vis.length) {
        tb.appendChild(el('tr', {}, el('td', { colspan: opts.colunas.length + (opts.onRow ? 1 : 0) }, el('div', { class: 'vazio', text: opts.vazio || 'Nenhum registro encontrado com os filtros atuais.' }))));
      }
      vis.forEach((r) => {
        const linha = el('tr', { onclick: opts.onRow ? () => opts.onRow(r) : null, title: opts.onRow ? 'Abrir' : null });
        opts.colunas.forEach((c) => {
          const td = el('td', { class: c.num ? 'num' : '' });
          const v = c.render ? c.render(r) : r[c.k];
          if (v === null || v === undefined) td.textContent = '—';
          else if (typeof v === 'object') td.appendChild(v);
          else td.textContent = v;
          linha.appendChild(td);
        });
        if (opts.onRow) linha.appendChild(el('td', { class: 'linha-abrir' }, global.ic('chevron-right', 15)));
        tb.appendChild(linha);
      });
      t.appendChild(tb);
      box.appendChild(t);

      rodape.innerHTML = '';
      rodape.appendChild(el('span', { class: 'hint', text: num(total) + ' registro(s) · página ' + (estado.pagina + 1) + ' de ' + paginas }));
      rodape.appendChild(el('button', { class: 'btn pequeno', disabled: estado.pagina === 0, html: global.icHTML('chevron-left', 14) + ' anterior', onclick: () => { if (estado.pagina > 0) { estado.pagina--; desenhar(); } } }));
      rodape.appendChild(el('button', { class: 'btn pequeno', disabled: estado.pagina >= paginas - 1, html: 'próxima ' + global.icHTML('chevron-right', 14), onclick: () => { if (estado.pagina < paginas - 1) { estado.pagina++; desenhar(); } } }));
    }
    desenhar();
    wrap.atualizar = (novas) => { opts.linhas = novas; estado.pagina = 0; desenhar(); return novas.length; };
    return wrap;
  }

  /** Barra de filtros com busca, selects e chips */
  function filtros(defs, aoMudar) {
    const estado = {};
    const box = el('div', { class: 'filtros' });
    const padroes = {};
    const controles = [];
    const limpar = el('button', {
      class: 'btn pequeno', html: global.icHTML('x', 13) + ' limpar filtros',
      style: { display: 'none' },
      onclick: () => { controles.forEach((f) => f()); notificar(); },
    });
    const contador = el('span', { class: 'hint', style: { marginLeft: 'auto' } });
    function notificar() {
      const ativos = Object.keys(estado).filter((k) => String(estado[k]) !== String(padroes[k])).length;
      limpar.style.display = ativos ? 'inline-flex' : 'none';
      const n = aoMudar(estado);
      contador.textContent = typeof n === 'number' ? global.U.num(n) + ' resultado(s)' + (ativos ? ' · ' + ativos + ' filtro(s) ativo(s)' : '') : '';
    }
    defs.forEach((d) => {
      estado[d.k] = d.padrao !== undefined ? d.padrao : d.tipo === 'busca' ? '' : 'todos';
      padroes[d.k] = d.tipo === 'busca' ? '' : 'todos';
      if (d.tipo === 'busca') {
        const inp = el('input', { type: 'text', placeholder: d.placeholder || 'Buscar…', oninput: global.U.debounce(() => { estado[d.k] = inp.value; notificar(); }, 200) });
        controles.push(() => { inp.value = ''; estado[d.k] = ''; });
        box.appendChild(inp);
      } else if (d.tipo === 'select') {
        const s = el('select', { onchange: (e) => { estado[d.k] = e.target.value; notificar(); } });
        controles.push(() => { s.value = 'todos'; estado[d.k] = 'todos'; });
        s.appendChild(el('option', { value: 'todos', text: d.rotulo }));
        d.opcoes.forEach((o) => s.appendChild(el('option', { value: typeof o === 'object' ? o.v : o, text: typeof o === 'object' ? o.t : o })));
        if (d.padrao && d.padrao !== 'todos') s.value = d.padrao;
        box.appendChild(s);
      } else if (d.tipo === 'chips') {
        const grupo = el('div', { class: 'chips' });
        const opts = [{ v: 'todos', t: d.rotulo || 'Todos' }].concat(d.opcoes.map((o) => (typeof o === 'object' ? o : { v: o, t: o })));
        opts.forEach((o) => {
          const c = el('div', { class: 'chip' + (estado[d.k] === o.v ? ' ativo' : ''), onclick: () => {
            estado[d.k] = o.v;
            global.U.$$('.chip', grupo).forEach((x) => x.classList.remove('ativo'));
            c.classList.add('ativo');
            notificar();
          }}, [el('span', { text: o.t }), o.n !== undefined ? el('small', { text: o.n }) : null]);
          if (o.v === 'todos') controles.push(() => {
            estado[d.k] = 'todos';
            global.U.$$('.chip', grupo).forEach((x) => x.classList.remove('ativo'));
            c.classList.add('ativo');
          });
          grupo.appendChild(c);
        });
        box.appendChild(grupo);
      }
    });
    box.appendChild(limpar);
    box.appendChild(contador);
    box.estado = estado;
    box.notificar = notificar;
    return box;
  }

  function abas(itens, aoTrocar) {
    const box = el('div', { class: 'abas' });
    itens.forEach((it, i) => {
      const a = el('div', { class: 'aba' + (i === 0 ? ' ativa' : ''), text: it, onclick: () => {
        global.U.$$('.aba', box).forEach((x) => x.classList.remove('ativa'));
        a.classList.add('ativa');
        aoTrocar(it, i);
      }});
      box.appendChild(a);
    });
    return box;
  }

  function listaItem(o) {
    return el('div', { class: 'lista-item', onclick: o.onclick }, [
      o.avatar || (o.icone ? el('div', { class: 'ic-box', style: { width: '28px', height: '28px', flex: '0 0 28px' } }, global.ic(o.icone, 15)) : null),
      el('div', { style: { minWidth: 0, flex: 1 } }, [
        el('b', { text: o.titulo, style: { fontSize: '13px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }),
        o.sub ? el('small', { text: o.sub, style: { fontSize: '11px', color: 'var(--txt-3)' } }) : null,
      ]),
      o.valor !== undefined ? el('div', { class: 'direita' }, [el('b', { text: o.valor }), o.nota ? el('small', { text: o.nota }) : null]) : null,
      o.tag ? o.tag : null,
    ]);
  }

  function indicador(rotulo, valor, nota, cor) {
    return el('div', { style: { marginBottom: '11px' } }, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' } }, [
        el('span', { text: rotulo, style: { fontSize: '12.5px' } }),
        el('b', { text: typeof valor === 'number' ? Math.round(valor) + '%' : valor, style: { fontSize: '13px' } }),
      ]),
      barra(typeof valor === 'number' ? valor : 0, 100, cor),
      nota ? el('small', { class: 'subtexto', text: nota }) : null,
    ]);
  }


  /**
   * Formulário declarativo em modal.
   * campos: [{k, rot, tipo:'texto'|'numero'|'data'|'hora'|'select'|'textarea'|'pessoa', opcoes, valor, obrigatorio, dica, largura:'meia'}]
   * aoSalvar(valores) -> string de erro interrompe; qualquer outro retorno fecha o modal.
   */
  function exigeEscrita() {
    if (global.DB.podeEscrever()) return true;
    global.U.toast('Seu acesso é somente leitura — esta ação precisa de outro perfil.', 'erro');
    return false;
  }

  function formModal(titulo, campos, aoSalvar, opcoes) {
    if (!exigeEscrita()) return null;
    opcoes = opcoes || {};
    const nos = {};
    const corpo = el('div', {});
    let linha = null;
    campos.forEach((c) => {
      let node;
      if (c.tipo === 'select') {
        node = el('select', {}, (c.opcoes || []).map((o) => {
          const v = typeof o === 'object' ? o.v : o, t = typeof o === 'object' ? o.t : o;
          return el('option', { value: v, text: t, selected: String(v) === String(c.valor) });
        }));
      } else if (c.tipo === 'textarea') {
        node = el('textarea', { rows: c.linhas || 3, placeholder: c.dica || '' });
        if (c.valor) node.value = c.valor;
      } else if (c.tipo === 'pessoa') {
        node = el('input', { type: 'text', placeholder: c.dica || 'Digite o nome…', list: 'lista-pessoas-form' });
        if (!global.U.$('#lista-pessoas-form')) {
          corpo.appendChild(el('datalist', { id: 'lista-pessoas-form' },
            global.DB.pessoas.filter((p) => p.classificacao !== 'contato').slice(0, 500).map((p) => el('option', { value: p.nome }))));
        }
      } else {
        node = el('input', { type: c.tipo === 'numero' ? 'number' : c.tipo === 'data' ? 'date' : c.tipo === 'hora' ? 'time' : 'text', placeholder: c.dica || '' });
        if (c.valor !== undefined && c.valor !== null) node.value = c.valor;
      }
      nos[c.k] = node;
      const bloco = el('div', { class: 'campo' }, [el('label', { text: c.rot + (c.obrigatorio ? ' *' : '') }), node]);
      if (c.largura === 'meia') {
        if (!linha) { linha = el('div', { class: 'campo-linha' }); corpo.appendChild(linha); }
        linha.appendChild(bloco);
        if (linha.children.length === 2) linha = null;
      } else { linha = null; corpo.appendChild(bloco); }
    });
    if (opcoes.nota) corpo.appendChild(el('p', { class: 'subtexto', text: opcoes.nota }));

    const m = global.U.modal(titulo, corpo, {
      wide: opcoes.wide,
      footer: [
        el('button', { class: 'btn', text: 'Cancelar', onclick: () => m.close() }),
        el('button', { class: 'btn primario', text: opcoes.acao || 'Salvar', onclick: () => {
          const v = {};
          for (const c of campos) {
            v[c.k] = nos[c.k].value.trim ? nos[c.k].value.trim() : nos[c.k].value;
            if (c.obrigatorio && !v[c.k]) { nos[c.k].focus(); return global.U.toast('Preencha o campo "' + c.rot + '".', 'erro'); }
          }
          const erro = aoSalvar(v);
          if (typeof erro === 'string') return global.U.toast(erro, 'erro');
          m.close();
          if (global.refresh) global.refresh();
        } }),
      ],
    });
    const primeiro = campos[0] && nos[campos[0].k];
    if (primeiro) setTimeout(() => primeiro.focus(), 60);
    return m;
  }

  /** exporta uma listagem para CSV e entrega o arquivo ao navegador */
  function exportarCSV(nomeArquivo, colunas, linhas) {
    const esc = (v) => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
    const csv = [colunas.map((c) => esc(c.rotulo)).join(';')]
      .concat(linhas.map((r) => colunas.map((c) => esc(c.valor(r))).join(';')))
      .join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = el('a', { href: url, download: nomeArquivo });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    global.U.toast(linhas.length + ' registro(s) exportado(s) para ' + nomeArquivo + '.');
  }

  /** cartão de estado vazio: diz o que falta e qual é o próximo passo */
  function vazio(o) {
    return el('div', { class: 'cartao estado-vazio' }, [
      el('div', { class: 'ev-icone' }, global.ic(o.icone || 'sparkles', 22)),
      el('h3', { text: o.titulo }),
      el('p', { text: o.texto }),
      o.acao ? el('button', {
        class: 'btn primario', html: global.icHTML('plus', 14) + ' ' + o.acao.rotulo,
        onclick: o.acao.onclick || (() => (location.hash = o.acao.rota)),
      }) : null,
    ]);
  }

  const dado = (rotulo, valor) => el('div', { class: 'dado-linha' }, [el('span', { text: rotulo }), el('b', { text: valor })]);
  const legenda = (itens) => el('div', { class: 'legenda' }, itens.map((i) => el('span', {}, [el('i', { style: { background: i.cor } }), el('span', { text: i.rotulo })])));
  const estrelas = (n) => {
    const box = el('span', { class: 'estrelas', title: n + ' de 5' });
    for (let i = 0; i < 5; i++) {
      const s = global.ic('star', 12);
      s.style.fill = i < n ? 'currentColor' : 'none';
      s.style.opacity = i < n ? 1 : 0.35;
      box.appendChild(s);
    }
    return box;
  };
  const voltar = (rota, txt) => el('button', { class: 'btn pequeno', html: global.icHTML('chevron-left', 14) + ' ' + (txt || 'voltar'), onclick: () => (location.hash = rota) });

  global.UI = { tag, cabecalho, cartao, kpi, avatarPessoa, pessoaCell, barra, tabela, filtros, abas, listaItem, dado, indicador, vazio, legenda, estrelas, voltar, formModal, exigeEscrita, exportarCSV, CORES_STATUS };
})(window);

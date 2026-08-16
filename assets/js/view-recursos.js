/* ==========================================================================
   view-recursos.js — Materiais, veículos/recursos e controle financeiro
   ========================================================================== */
(function (global) {
  'use strict';
  const { el, num, dec, pct, money, moneyShort, fmtDate, fmtDateShort, sortBy, sum, norm, toast, modal, iso } = global.U;
  const { cabecalho, cartao, kpi, tag, pessoaCell, barra, tabela, filtros, listaItem, dado, legenda, formModal, exportarCSV, vazio } = global.UI;

  /* ==========================  MATERIAIS  ========================== */
  global.VIEWS['materiais'] = function (alvo) {
    const D = global.DB;
    const M = D.materiais.map((m) => Object.assign({}, m, {
      entradas: sum(m.movimentos.filter((x) => x.tipo === 'entrada'), (x) => x.qtd),
      saidas: sum(m.movimentos.filter((x) => x.tipo === 'saída'), (x) => x.qtd),
    }));
    const criticos = M.filter((m) => m.saldo <= m.minimo);

    alvo.appendChild(cabecalho('Controle de materiais e insumos', D.materiais.length + ' itens controlados · entrada, saída, responsável, destino e saldo', [
      el('button', { class: 'btn pequeno primario', html: icHTML('plus', 14) + ' Novo material', onclick: () => formModal('Novo material', [
        { k: 'nome', rot: 'Nome do material', tipo: 'texto', obrigatorio: true, dica: 'Ex.: Panfleto A5, Santinho, Camiseta' },
        { k: 'unidade', rot: 'Unidade', tipo: 'texto', largura: 'meia', valor: 'un' },
        { k: 'minimo', rot: 'Estoque mínimo (alerta)', tipo: 'numero', largura: 'meia' },
        { k: 'entradaInicial', rot: 'Quantidade já em estoque', tipo: 'numero' },
      ], (v) => { const m = D.addMaterial(v); toast('"' + m.nome + '" cadastrado' + (m.saldo ? ' com ' + num(m.saldo) + ' ' + m.unidade + ' em estoque.' : '.')); }, { acao: 'Cadastrar' }) }),
      D.materiais.length ? el('button', { class: 'btn pequeno', html: icHTML('download', 14) + ' Registrar entrada', onclick: () => movimentar('entrada') }) : null,
      D.materiais.length ? el('button', { class: 'btn pequeno', html: icHTML('upload', 14) + ' Registrar saída', onclick: () => movimentar('saída') }) : null,
    ]));

    if (!D.materiais.length) {
      alvo.appendChild(vazio({
        icone: 'package', titulo: 'Nenhum material cadastrado ainda',
        texto: 'Cadastre os itens que a campanha usa — panfletos, santinhos, camisetas — para depois controlar entrada e saída.',
        acao: { rotulo: 'Cadastrar primeiro material', onclick: () => global.U.$('.cabecalho .btn.primario').click() },
      }));
      return;
    }

    alvo.appendChild(el('div', { class: 'grade g4', style: { marginBottom: '16px' } }, [
      kpi({ rotulo: 'Itens controlados', icone: 'package', valor: M.length, nota: num(sum(M, (m) => m.saldo)) + ' unidades em estoque' }),
      kpi({ rotulo: 'Saídas registradas', icone: 'upload', valor: num(sum(M, (m) => m.saidas)), cor: 'var(--accent-2)', nota: 'material distribuído às equipes' }),
      kpi({ rotulo: 'Itens abaixo do mínimo', icone: 'triangle-alert', valor: criticos.length, cor: 'var(--danger)', nota: criticos.map((m) => m.nome).slice(0, 2).join(', ') || 'estoque equilibrado' }),
      kpi({ rotulo: 'Consumo médio', icone: 'trending-down', valor: pct(sum(M, (m) => m.saidas), sum(M, (m) => m.entradas)) + '%', cor: 'var(--warn)', nota: 'do total que entrou já foi distribuído' }),
    ]));

    alvo.appendChild(el('p', { class: 'subtexto', style: { marginBottom: '14px' } },
      [el('span', { text: 'Entrada × saldo por item e destino das saídas estão no ' }),
       el('a', { text: 'relatório de materiais', style: { color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }, onclick: () => (location.hash = '#/relatorios?tipo=materiais') }),
       el('span', { text: '.' })]));

    alvo.appendChild(tabela({
      linhas: M, ordPadrao: 'saldo', tam: 20, onRow: detalheMaterial,
      colunas: [
        { k: 'nome', rotulo: 'Material', render: (m) => el('div', {}, [el('b', { text: m.nome, style: { fontSize: '13px' } }), el('small', { text: m.movimentos.length + ' movimentações', style: { display: 'block', color: 'var(--txt-3)', fontSize: '11px' } })]) },
        { k: 'entradas', rotulo: 'Entradas', num: true, render: (m) => num(m.entradas) },
        { k: 'saidas', rotulo: 'Saídas', num: true, render: (m) => num(m.saidas) },
        { k: 'saldo', rotulo: 'Saldo', num: true, render: (m) => el('b', { text: num(m.saldo) + ' ' + m.unidade }) },
        { k: 'minimo', rotulo: 'Mínimo', num: true, render: (m) => num(m.minimo) },
        { k: 'nivel', rotulo: 'Nível do estoque', num: true, valor: (m) => m.saldo / m.entradas,
          render: (m) => el('div', { style: { minWidth: '140px' } }, [el('small', { text: pct(m.saldo, m.entradas) + '% do total recebido' }), barra(m.saldo, m.entradas, m.saldo <= m.minimo ? 'var(--danger)' : 'var(--accent)')]) },
        { k: 'situacao', rotulo: 'Situação', valor: (m) => m.saldo <= m.minimo ? 0 : 1, render: (m) => m.saldo <= m.minimo ? tag('repor', 'vermelho') : m.saldo <= m.minimo * 1.6 ? tag('atenção', 'laranja') : tag('adequado', 'verde') },
      ],
    }));
  };

  function movimentar(tipo, materialId) {
    const D = global.DB;
    return formModal(tipo === 'entrada' ? 'Registrar entrada de material' : 'Registrar saída de material', [
      { k: 'materialId', rot: 'Material', tipo: 'select', obrigatorio: true, valor: materialId,
        opcoes: D.materiais.map((m) => ({ v: m.id, t: m.nome + ' — saldo ' + num(m.saldo) + ' ' + m.unidade })) },
      { k: 'qtd', rot: 'Quantidade', tipo: 'numero', largura: 'meia', obrigatorio: true },
      { k: 'responsavelId', rot: tipo === 'entrada' ? 'Quem recebeu' : 'Quem retirou', tipo: 'select', largura: 'meia',
        opcoes: D.equipe.map((e) => ({ v: e.pessoaId, t: D.nome(e.pessoaId) })) },
      { k: 'destino', rot: tipo === 'entrada' ? 'Origem' : 'Destino', tipo: 'select',
        opcoes: tipo === 'entrada' ? ['Compra', 'Doação', 'Devolução de equipe'] : D.equipes.map((e) => ({ v: e.nome, t: e.nome })) },
      { k: 'finalidade', rot: 'Finalidade', tipo: 'texto', dica: 'Ex.: panfletagem na feira de sábado' },
    ], (v) => {
      const r = D.movimentarMaterial(v.materialId, tipo, +v.qtd, v);
      if (!r || r.erro) return (r && r.erro) || 'Não foi possível registrar a movimentação.';
      toast(tipo === 'entrada' ? 'Entrada registrada. Novo saldo: ' + num(r.material.saldo) + '.' : 'Saída registrada. Restam ' + num(r.material.saldo) + ' ' + r.material.unidade + '.');
    }, { acao: 'Registrar ' + tipo });
  }

  function detalheMaterial(m) {
    const D = global.DB;
    const movs = sortBy(m.movimentos, (x) => x.data, 'desc');
    let saldo = m.saldo;
    const linhas = movs.map((x) => { const atual = saldo; if (x.tipo === 'saída') saldo += x.qtd; else saldo -= x.qtd; return Object.assign({}, x, { saldoApos: atual }); });
    const corpo = el('div', {}, [
      el('div', { class: 'grade g3', style: { marginBottom: '14px' } }, [
        kpi({ rotulo: 'Saldo atual', valor: num(m.saldo) + ' ' + m.unidade }),
        kpi({ rotulo: 'Estoque mínimo', valor: num(m.minimo), cor: 'var(--warn)' }),
        kpi({ rotulo: 'Movimentações', valor: m.movimentos.length, cor: 'var(--accent-2)' }),
      ]),
      el('div', { class: 'filtros' }, [
        el('button', { class: 'btn pequeno', html: icHTML('download', 14) + ' entrada', onclick: () => movimentar('entrada', m.id) }),
        el('button', { class: 'btn pequeno', html: icHTML('upload', 14) + ' saída', onclick: () => movimentar('saída', m.id) }),
      ]),
      tabela({
        linhas, ordPadrao: 'data', tam: 10,
        colunas: [
          { k: 'data', rotulo: 'Data', render: (x) => fmtDate(x.data) },
          { k: 'tipo', rotulo: 'Tipo', render: (x) => tag(x.tipo, x.tipo === 'entrada' ? 'verde' : 'laranja') },
          { k: 'qtd', rotulo: 'Quantidade', num: true, render: (x) => (x.tipo === 'saída' ? '−' : '+') + num(x.qtd) },
          { k: 'destino', rotulo: 'Destino' },
          { k: 'finalidade', rotulo: 'Finalidade' },
          { k: 'responsavel', rotulo: 'Responsável', valor: (x) => D.nome(x.responsavelId), render: (x) => el('small', { text: D.nome(x.responsavelId) }) },
          { k: 'saldoApos', rotulo: 'Saldo após', num: true, render: (x) => num(x.saldoApos) },
        ],
      }),
    ]);
    modal('Movimentação — ' + m.nome, corpo, { wide: true });
  }

  /* ==========================  RECURSOS  ========================== */
  global.VIEWS['recursos'] = function (alvo) {
    const D = global.DB;
    const R = D.recursos;
    alvo.appendChild(cabecalho('Veículos e outros recursos', R.length + ' recursos controlados · saiba o que está disponível, com quem está e para qual atividade', [
      el('button', { class: 'btn pequeno primario', html: icHTML('plus', 14) + ' Registrar recurso', onclick: () => formModal('Registrar recurso', [
        { k: 'nome', rot: 'Recurso', tipo: 'texto', obrigatorio: true, dica: 'Ex.: van 15 lugares' },
        { k: 'tipo', rot: 'Tipo', tipo: 'select', largura: 'meia', opcoes: ['Veículo', 'Equipamento', 'Estrutura'] },
        { k: 'status', rot: 'Situação', tipo: 'select', largura: 'meia', opcoes: ['disponível', 'em uso', 'manutenção'] },
        { k: 'local', rot: 'Onde está', tipo: 'texto', dica: 'Ex.: comitê central' },
      ], (v) => { D.addRecurso(v); toast('Recurso "' + v.nome + '" cadastrado.'); }, { acao: 'Cadastrar' }) }),
    ]));

    alvo.appendChild(el('div', { class: 'grade g4', style: { marginBottom: '16px' } }, [
      kpi({ rotulo: 'Disponíveis', icone: 'square-check', valor: R.filter((r) => r.status === 'disponível').length, nota: 'prontos para uso imediato' }),
      kpi({ rotulo: 'Em uso', icone: 'truck', valor: R.filter((r) => r.status === 'em uso').length, cor: 'var(--accent-2)', nota: 'alocados em atividades da campanha' }),
      kpi({ rotulo: 'Em manutenção', icone: 'settings', valor: R.filter((r) => r.status === 'manutenção').length, cor: 'var(--warn)', nota: 'indisponíveis temporariamente' }),
      kpi({ rotulo: 'Veículos', icone: 'car', valor: R.filter((r) => r.tipo === 'Veículo').length, cor: 'var(--accent-3)', nota: R.filter((r) => r.tipo === 'Equipamento').length + ' equipamentos · ' + R.filter((r) => r.tipo === 'Estrutura').length + ' estruturas' }),
    ]));

    const grade = el('div', { class: 'grade g4' });
    const desenhar = (lista) => {
      grade.innerHTML = '';
      const total = lista.length;
      lista.forEach((r) => grade.appendChild(el('div', { class: 'cartao' }, [
        el('div', { class: 'cartao-topo' }, [
          el('div', { style: { flex: 1 } }, [el('h3', { text: r.nome, style: { fontSize: '13.5px' } }), el('p', { text: r.tipo })]),
          tag(r.status),
        ]),
        dado('Local', r.local),
        dado('Responsável', r.responsavelId ? D.nome(r.responsavelId).split(' ').slice(0, 2).join(' ') : '—'),
        dado('Atividade', r.atividade ? r.atividade.slice(0, 28) + '…' : 'sem alocação'),
      ])));
      return total;
    };
    alvo.appendChild(filtros([
      { k: 'busca', tipo: 'busca', placeholder: 'Buscar recurso…' },
      { k: 'tipo', tipo: 'chips', rotulo: 'Todos', opcoes: ['Veículo', 'Equipamento', 'Estrutura'] },
      { k: 'status', tipo: 'select', rotulo: 'Todas as situações', opcoes: ['disponível', 'em uso', 'manutenção'] },
    ], (e) => desenhar(R.filter((r) =>
      (!e.busca || norm(r.nome).includes(norm(e.busca))) &&
      (e.tipo === 'todos' || r.tipo === e.tipo) &&
      (e.status === 'todos' || r.status === e.status)))));
    alvo.appendChild(grade);
    desenhar(R);
  };

  /* ==========================  FINANCEIRO  ========================== */
  global.VIEWS['financeiro'] = function (alvo) {
    const D = global.DB;
    const F = D.financeiro;
    const previsto = sum(F, (f) => f.previsto), realizado = sum(F, (f) => f.realizado);

    alvo.appendChild(cabecalho('Controle financeiro gerencial', 'Visão administrativa dos gastos — quanto, onde e em que atividade estamos gastando', [
      el('button', { class: 'btn pequeno', html: icHTML('download', 14) + ' Exportar', onclick: () => exportarCSV('financeiro-campanha.csv', [
        { rotulo: 'Descrição', valor: (f) => f.descricao }, { rotulo: 'Área', valor: (f) => f.area },
        { rotulo: 'Fornecedor', valor: (f) => f.fornecedor }, { rotulo: 'Data', valor: (f) => fmtDate(f.data) },
        { rotulo: 'Previsto', valor: (f) => f.previsto }, { rotulo: 'Realizado', valor: (f) => f.realizado },
        { rotulo: 'Atividade', valor: (f) => (f.eventoId ? (D.eventos.find((e) => e.id === f.eventoId) || {}).nome : '') },
      ], F) }),
      el('button', { class: 'btn pequeno primario', html: icHTML('plus', 14) + ' Lançamento', onclick: () => formModal('Novo lançamento', [
        { k: 'descricao', rot: 'Descrição', tipo: 'texto', obrigatorio: true, dica: 'Ex.: impressão de material' },
        { k: 'area', rot: 'Área responsável', tipo: 'select', largura: 'meia', opcoes: D.AREAS },
        { k: 'fornecedor', rot: 'Fornecedor', tipo: 'texto', largura: 'meia' },
        { k: 'previsto', rot: 'Valor previsto (R$)', tipo: 'numero', largura: 'meia', obrigatorio: true },
        { k: 'realizado', rot: 'Valor realizado (R$)', tipo: 'numero', largura: 'meia', valor: 0 },
        { k: 'eventoId', rot: 'Vincular a um evento', tipo: 'select', opcoes: [{ v: '', t: 'nenhum' }].concat(D.eventos.slice(0, 60).map((e) => ({ v: e.id, t: e.nome }))) },
      ], (v) => { D.addLancamento({ ...v, previsto: +v.previsto, realizado: +v.realizado, eventoId: v.eventoId || null }); toast('Lançamento registrado no controle gerencial.'); }, { acao: 'Lançar' }) }),
    ]));

    alvo.appendChild(el('div', { class: 'grade g4', style: { marginBottom: '16px' } }, [
      kpi({ rotulo: 'Previsto', icone: 'clipboard-list', valor: moneyShort(previsto), nota: F.length + ' lançamentos registrados' }),
      kpi({ rotulo: 'Realizado', icone: 'wallet', valor: moneyShort(realizado), cor: 'var(--accent)', nota: pct(realizado, previsto) + '% do previsto foi executado' }),
      kpi({ rotulo: 'Saldo do previsto', icone: 'scale', valor: moneyShort(previsto - realizado), cor: 'var(--accent-2)', nota: 'diferença entre previsto e realizado' }),
      kpi({ rotulo: 'Gasto médio por evento', icone: 'megaphone', valor: moneyShort(sum(F.filter((f) => f.eventoId), (f) => f.realizado) / Math.max(1, new Set(F.filter((f) => f.eventoId).map((f) => f.eventoId)).size)), cor: 'var(--warn)', nota: 'considerando lançamentos vinculados' }),
    ]));

    const areaBox = el('div');
    const porArea = D.AREAS.map((a) => ({ label: a.replace('Coordenação ', ''), previsto: sum(F.filter((f) => f.area === a), (f) => f.previsto), realizado: sum(F.filter((f) => f.area === a), (f) => f.realizado) }));
    global.CH.bars(areaBox, { height: 260, data: porArea, fmtY: (v) => moneyShort(v), fmtTip: (v) => money(v), series: [
      { key: 'previsto', label: 'Previsto', color: 'var(--surface-3)' },
      { key: 'realizado', label: 'Realizado', color: '#0e9f6e' }] });

    const serie = (() => {
      const dias = 90, out = [];
      let acum = 0;
      for (let i = dias - 1; i >= 0; i--) {
        const d = iso(global.U.addDays(D.HOJE, -i));
        acum += sum(F.filter((f) => f.data === d), (f) => f.realizado);
        out.push({ data: d, acumulado: acum });
      }
      return out;
    })();
    const lineBox = el('div');
    global.CH.line(lineBox, { height: 260, data: serie, fmtY: (v) => moneyShort(v), series: [{ key: 'acumulado', label: 'Gasto acumulado', color: '#2563eb' }], labelX: (d) => fmtDateShort(d.data), labelTip: (d) => fmtDate(d.data) });

    alvo.appendChild(el('div', { class: 'grade g2', style: { marginBottom: '16px' } }, [
      cartao('Gasto por área responsável', 'Previsto × realizado em cada frente', [areaBox]),
      cartao('Evolução do gasto', 'Acumulado dos últimos 90 dias', [lineBox]),
    ]));

    const forn = new Map();
    F.forEach((f) => forn.set(f.fornecedor, (forn.get(f.fornecedor) || 0) + f.realizado));
    const fornBox = el('div');
    global.CH.hbars(fornBox, { rowH: 30, fmt: moneyShort, data: sortBy(Array.from(forn, ([label, valor]) => ({ label, valor })), (x) => x.valor, 'desc') });
    alvo.appendChild(el('div', { class: 'grade g-1-2', style: { marginBottom: '16px' } }, [
      cartao('Fornecedores', 'Concentração dos gastos realizados', [fornBox]),
      cartao('Lançamentos', F.length + ' registros do controle gerencial', [tabela({
        linhas: F, ordPadrao: 'realizado', tam: 12,
        colunas: [
          { k: 'descricao', rotulo: 'Descrição', render: (f) => el('div', {}, [el('b', { text: f.descricao, style: { fontSize: '13px' } }), el('small', { text: f.fornecedor, style: { display: 'block', color: 'var(--txt-3)', fontSize: '11px' } })]) },
          { k: 'area', rotulo: 'Área', render: (f) => el('small', { text: f.area }) },
          { k: 'data', rotulo: 'Data', render: (f) => fmtDate(f.data) },
          { k: 'previsto', rotulo: 'Previsto', num: true, render: (f) => money(f.previsto) },
          { k: 'realizado', rotulo: 'Realizado', num: true, render: (f) => f.realizado ? el('b', { text: money(f.realizado) }) : tag('a executar', 'cinza') },
          { k: 'evento', rotulo: 'Atividade', valor: (f) => f.eventoId || '', render: (f) => f.eventoId ? el('small', { text: (D.eventos.find((e) => e.id === f.eventoId) || {}).nome }) : '—' },
        ],
      })]),
    ]));
  };
})(window);

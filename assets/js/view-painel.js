/* ==========================================================================
   view-painel.js — Painel geral (sala de situação) e Alertas
   ========================================================================== */
(function (global) {
  'use strict';
  const { el, num, dec, money, moneyShort, fmtDate, fmtDateShort, relDays, sortBy, sum } = global.U;
  const { cabecalho, cartao, kpi, tag, pessoaCell, barra, listaItem, dado, legenda } = global.UI;

  global.VIEWS[''] = function (alvo) {
    const D = global.DB, s = D.stats();
    const serie = D.serieCrescimento(60);
    const ult14 = serie.slice(-14).map((d) => d.novos);

    alvo.appendChild(cabecalho(
      'Painel geral da campanha',
      'Como está a campanha hoje — ' + fmtDate(D.HOJE) + (s.diasEleicao !== null ? ' · faltam ' + s.diasEleicao + ' dias para a eleição' : ''),
      [
        el('button', { class: 'btn pequeno', html: icHTML('map', 14) + ' Ver território', onclick: () => (location.hash = '#/territorio') }),
        el('button', { class: 'btn pequeno primario', html: icHTML('file-text', 14) + ' Relatório gerencial', onclick: () => (location.hash = '#/relatorios') }),
      ]
    ));

    /* ---- KPIs ---- */
    const metasOk = D.metas.filter((m) => D.metaAtual(m) >= m.alvo).length;
    alvo.appendChild(el('div', { class: 'grade g5', style: { marginBottom: '16px' } }, [
      kpi({ rotulo: 'Pessoas na base', icone: 'users', valor: num(s.total), delta: s.variacao7, nota: num(s.novos7) + ' nos últimos 7 dias', serie: ult14, rota: '#/pessoas' }),
      kpi({ rotulo: 'Apoiadores declarados', icone: 'handshake', valor: num(s.apoiadores), cor: 'var(--accent-2)', nota: dec(s.penetracao) + '% do eleitorado estimado', serie: serie.slice(-14).map((d) => d.acumulado), rota: '#/mobilizacao' }),
      kpi({ rotulo: 'Lideranças mapeadas', icone: 'star', valor: num(s.liderancas), cor: 'var(--rose)', nota: D.liderancas.filter((l) => l.situacao === 'compromisso firmado').length + ' com compromisso firmado', rota: '#/liderancas' }),
      kpi({ rotulo: 'Tarefas atrasadas', icone: 'clock', valor: num(s.tarefasAtrasadas), cor: 'var(--danger)', nota: s.tarefasAndamento + ' em andamento · ' + s.tarefasConcluidas + ' concluídas', rota: '#/tarefas' }),
      kpi({ rotulo: 'Metas atingidas', icone: 'target', valor: metasOk + '/' + D.metas.length, cor: 'var(--warn)', nota: s.demandasPendentes + ' demandas pendentes', rota: '#/metas' }),
    ]));

    /* ---- crescimento + funil ---- */
    const cxCresc = el('div');
    const desenhaCresc = (modo) => {
      cxCresc.innerHTML = '';
      const g = el('div');
      cxCresc.appendChild(g);
      if (modo === 'Novos por dia') {
        global.CH.line(g, { height: 250, data: serie, series: [{ key: 'novos', label: 'Novos cadastros', color: '#2563eb' }], labelX: (d) => fmtDateShort(d.data), labelTip: (d) => fmtDate(d.data) });
      } else if (modo === 'Por semana') {
        const sem = D.serieClassificacao(10).map((l) => ({ label: fmtDateShort(l.periodo), simpatizante: l.simpatizante, apoiador: l.apoiador, lideranca: l.lideranca + l.mobilizador }));
        global.CH.bars(g, { height: 250, data: sem, series: [
          { key: 'simpatizante', label: 'Simpatizantes', color: '#2563eb' },
          { key: 'apoiador', label: 'Apoiadores', color: '#0e9f6e' },
          { key: 'lideranca', label: 'Mobilizadores e lideranças', color: '#e11d48' },
        ]});
      } else {
        global.CH.line(g, { height: 250, data: serie, series: [{ key: 'acumulado', label: 'Base acumulada', color: '#0e9f6e' }], labelX: (d) => fmtDateShort(d.data), labelTip: (d) => fmtDate(d.data) });
      }
    };
    const abasCresc = global.UI.abas(['Base acumulada', 'Novos por dia', 'Por semana'], desenhaCresc);
    abasCresc.style.marginBottom = '6px';
    desenhaCresc('Base acumulada');

    const cardCresc = cartao('Crescimento da base de relacionamento', 'Últimos 60 dias de cadastramento', [abasCresc, cxCresc]);

    const funilBox = el('div');
    global.CH.funnel(funilBox, { data: D.funil(), onClick: (d) => (location.hash = '#/pessoas?classificacao=' + d.chave) });
    const f = D.funil();
    const cardFunil = cartao('Funil de relacionamento', 'Do primeiro contato à liderança', [
      funilBox,
      el('div', { class: 'divisor' }),
      dado('Contato → apoiador', f[0].valor ? dec((f[2].valor / f[0].valor) * 100) + '%' : '—'),
      dado('Apoiador → participante', f[2].valor ? dec((f[3].valor / f[2].valor) * 100) + '%' : '—'),
      dado('Participante → mobilizador', f[3].valor ? dec((f[4].valor / f[3].valor) * 100) + '%' : '—'),
    ]);
    alvo.appendChild(el('div', { class: 'grade g-2-1', style: { marginBottom: '16px' } }, [cardCresc, cardFunil]));

    /* ---- mapa + alertas ---- */
    const mapBox = el('div', { style: { height: '420px' } });
    const selMetrica = el('select', {}, Object.keys(global.MAPA.METRICAS).map((k) => el('option', { value: k, text: global.MAPA.METRICAS[k].rotulo })));
    const selModo = el('select', {}, [
      el('option', { value: 'choropleth', text: 'Somente territórios' }),
      el('option', { value: 'eventos', text: '+ Eventos realizados' }),
      el('option', { value: 'liderancas', text: '+ Lideranças' }),
      el('option', { value: 'equipes', text: '+ Equipes' }),
    ]);
    const redesenhar = () => global.MAPA.render(mapBox, { metrica: selMetrica.value, modo: selModo.value, onSelect: (id) => (location.hash = '#/territorio/' + id) });
    selMetrica.onchange = redesenhar;
    selModo.onchange = redesenhar;
    setTimeout(redesenhar, 0);
    const cardMapa = cartao('Leitura territorial', 'Clique em um bairro para abrir o território · role para aproximar', [mapBox], [selModo, selMetrica]);

    const alertas = D.alertas();
    const cardAlertas = cartao('Alertas da coordenação', alertas.length + ' situações exigem atenção', [
      el('div', { class: 'lista rolagem', style: { '--h': '400px', gap: '8px' } },
        alertas.slice(0, 14).map((a) =>
          el('div', { class: 'alerta ' + a.nivel, onclick: () => (location.hash = a.rota) }, [
            el('div', { class: 'ic-box' }, global.ic(a.icone, 15)),
            el('div', {}, [el('b', { text: a.titulo }), el('span', { text: a.detalhe })]),
          ])
        )
      ),
    ], [el('button', { class: 'btn pequeno', text: 'ver todos', onclick: () => (location.hash = '#/alertas') })]);
    alvo.appendChild(el('div', { class: 'grade g-3-2', style: { marginBottom: '16px' } }, [cardMapa, cardAlertas]));

    /* ---- classificação, ranking, operação ---- */
    const rank = D.rankingMobilizadores(8);
    const rankBox = el('div');
    global.CH.hbars(rankBox, {
      data: rank.map((r) => ({ label: D.P(r.pessoaId).nome.split(' ').slice(0, 2).join(' '), valor: r.cadastros, sub: 'Cadastros', id: r.pessoaId })),
      onClick: (d) => (location.hash = '#/pessoas/' + d.id),
    });
    const cardRank = cartao('Quem está ampliando a base', 'Cadastros realizados por mobilizador', [rankBox], [el('button', { class: 'btn pequeno', text: 'mobilização', onclick: () => (location.hash = '#/mobilizacao') })]);

    const ringBox = el('div');
    const conclusao = D.tarefas.length ? (s.tarefasConcluidas / D.tarefas.length) * 100 : 0;
    global.CH.ring(ringBox, { valor: conclusao, rotulo: 'tarefas concluídas', height: 140 });
    const proximos = sortBy(D.eventos.filter((e) => e.data >= global.U.iso(D.HOJE)), (e) => e.data).slice(0, 4);
    const cardOper = cartao('Operação', 'Execução e próximos compromissos', [
      ringBox,
      el('div', { class: 'divisor' }),
      el('div', { class: 'lista' }, proximos.map((e) => listaItem({
        icone: 'megaphone', titulo: e.nome, sub: fmtDate(e.data) + ' · ' + e.hora + ' · ' + relDays(e.data),
        tag: tag(e.status), onclick: () => (location.hash = '#/eventos/' + e.id),
      }))),
    ]);
    alvo.appendChild(el('div', { class: 'grade g-2-1', style: { marginBottom: '16px' } }, [cardRank, cardOper]));

    /* ---- metas e recursos ---- */
    const emRisco = sortBy(
      D.metas.map((m) => { const at = D.metaAtual(m); return { m, at, p: m.alvo ? (at / m.alvo) * 100 : 0, dias: global.U.daysBetween(D.HOJE, m.prazo) }; })
        .filter((x) => x.p < 100),
      (x) => x.p
    ).slice(0, 6);
    const cardMetas = cartao('Metas em risco', emRisco.length + ' de ' + D.metas.length + ' metas ainda não atingidas — ordenadas pelo que está mais distante', [
      el('div', {}, emRisco.map((x) =>
        el('div', { style: { marginBottom: '12px', cursor: 'pointer' }, onclick: () => (location.hash = '#/metas') }, [
          el('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' } }, [
            el('span', { text: x.m.titulo, style: { fontSize: '12.5px' } }),
            el('b', { text: num(x.at) + ' / ' + num(x.m.alvo), style: { fontSize: '12.5px', whiteSpace: 'nowrap' } }),
          ]),
          barra(x.p, 100),
          el('small', { class: 'subtexto', text: Math.round(x.p) + '% · prazo ' + fmtDate(x.m.prazo) + (x.dias < 0 ? ' (vencido)' : x.dias <= 7 ? ' (faltam ' + x.dias + ' dias)' : '') }),
        ])
      )),
    ], [el('button', { class: 'btn pequeno', text: 'todas as metas', onclick: () => (location.hash = '#/metas') })]);

    const baixos = sortBy(D.materiais.filter((m) => m.saldo <= m.minimo * 1.6), (m) => m.saldo / m.minimo).slice(0, 5);
    const recDisp = D.recursos.filter((r) => r.status === 'disponível').length;
    const cardRec = cartao('Recursos e materiais', 'Situação do estoque e dos recursos', [
      el('div', { class: 'lista' }, baixos.map((m) => listaItem({
        icone: 'package', titulo: m.nome, sub: 'mínimo ' + num(m.minimo) + ' ' + m.unidade,
        valor: num(m.saldo), nota: m.saldo <= m.minimo ? 'abaixo do mínimo' : 'atenção',
        onclick: () => (location.hash = '#/materiais'),
      }))),
      el('div', { class: 'divisor' }),
      dado('Recursos disponíveis', recDisp + ' de ' + D.recursos.length),
      dado('Gasto realizado', moneyShort(s.gastoRealizado) + ' de ' + moneyShort(s.gastoPrevisto) + ' previstos'),
      barra(s.gastoRealizado, s.gastoPrevisto, 'var(--accent-2)'),
    ]);
    alvo.appendChild(el('div', { class: 'grade g2' }, [cardMetas, cardRec]));
  };

  /* ==========================  ALERTAS  ========================== */
  global.VIEWS['alertas'] = function (alvo) {
    const D = global.DB;
    const alertas = D.alertas();
    alvo.appendChild(cabecalho('Alertas', 'Situações que exigem intervenção da coordenação — ' + alertas.length + ' no total'));

    const cont = el('div', { class: 'grade', style: { gap: '10px' } });
    const desenhar = (nivel) => {
      cont.innerHTML = '';
      const sel = alertas.filter((a) => nivel === 'todos' || a.nivel === nivel);
      sel.forEach((a) =>
        cont.appendChild(el('div', { class: 'alerta ' + a.nivel, onclick: () => (location.hash = a.rota) }, [
          el('div', { class: 'ic-box' }, global.ic(a.icone, 15)),
          el('div', { style: { flex: 1 } }, [el('b', { text: a.titulo }), el('span', { text: a.detalhe })]),
          el('span', { class: 'tag ' + (a.nivel === 'alto' ? 'vermelho' : 'laranja') + ' ponto', text: a.nivel === 'alto' ? 'prioridade alta' : 'acompanhar' }),
        ]))
      );
      return sel.length;
    };
    alvo.appendChild(global.UI.filtros([{ k: 'nivel', tipo: 'chips', rotulo: 'Todos (' + alertas.length + ')', opcoes: [
      { v: 'alto', t: 'Prioridade alta', n: alertas.filter((a) => a.nivel === 'alto').length },
      { v: 'medio', t: 'Acompanhar', n: alertas.filter((a) => a.nivel === 'medio').length },
    ]}], (e) => desenhar(e.nivel)));
    alvo.appendChild(cont);
    desenhar('todos');
  };
})(window);

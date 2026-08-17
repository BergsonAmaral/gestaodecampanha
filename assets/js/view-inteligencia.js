/* ==========================================================================
   view-inteligencia.js — Pesquisas, performance das equipes e relatórios
   ========================================================================== */
(function (global) {
  'use strict';
  const { el, num, dec, pct, money, moneyShort, fmtDate, fmtDateShort, sortBy, sum, toast, modal, iso } = global.U;
  const { cabecalho, cartao, kpi, tag, pessoaCell, barra, tabela, filtros, listaItem, dado, indicador, legenda } = global.UI;

  /* ==========================  PESQUISAS  ========================== */
  global.VIEWS['pesquisas'] = function (alvo) {
    const D = global.DB;
    alvo.appendChild(cabecalho('Pesquisas e questionários', D.pesquisas.length + ' pesquisas registradas · resultados analisáveis por território, período e segmento', [
      el('button', { class: 'btn pequeno primario', html: icHTML('plus', 14) + ' Nova pesquisa', onclick: () => novaPesquisa() }),
    ]));

    if (!D.pesquisas.length) {
      alvo.appendChild(global.UI.vazio({
        icone: 'chart-column', titulo: 'Nenhuma pesquisa registrada ainda',
        texto: 'Cadastre os resultados de rodadas de pesquisa — intenção de voto, avaliação de gestão, levantamento de demandas — para acompanhar a evolução ao longo da campanha.',
        acao: { rotulo: 'Registrar primeira pesquisa', onclick: () => novaPesquisa() },
      }));
      return;
    }

    // "principal" = primeira pergunta da rodada mais recente, quando existir
    const maisRecente = sortBy(D.pesquisas, (p) => p.data, 'desc')[0];
    const perguntaPrincipal = maisRecente && maisRecente.perguntas[0];
    const topOpcao = perguntaPrincipal && sortBy(perguntaPrincipal.opcoes, (o) => o[1], 'desc')[0];

    alvo.appendChild(el('div', { class: 'grade g4', style: { marginBottom: '16px' } }, [
      kpi({ rotulo: 'Pesquisas realizadas', icone: 'chart-column', valor: D.pesquisas.length, nota: 'com resultados consolidados' }),
      kpi({ rotulo: 'Pessoas ouvidas', icone: 'megaphone', valor: num(sum(D.pesquisas, (p) => p.amostra)), cor: 'var(--accent-2)', nota: 'soma das amostras das rodadas' }),
      kpi({ rotulo: 'Rodada mais recente', icone: 'calendar-days', valor: maisRecente ? fmtDate(maisRecente.data) : '—', cor: 'var(--accent)', nota: maisRecente ? maisRecente.titulo : 'nenhuma pesquisa ainda' }),
      kpi({ rotulo: topOpcao ? topOpcao[0] : 'Resposta líder', icone: 'trending-up', valor: topOpcao ? dec(topOpcao[1]) + '%' : '—', cor: 'var(--warn)', nota: perguntaPrincipal ? perguntaPrincipal.texto : 'cadastre uma pergunta na pesquisa' }),
    ]));

    D.pesquisas.forEach((ps) => {
      const cards = ps.perguntas.map((q) => {
        const box = el('div');
        const cores = ['#0e9f6e', '#e11d48', '#2563eb', '#98a2b3', '#7c3aed', '#d97706'];
        global.CH.hbars(box, { rowH: 32, fmt: (v) => v + '%', data: q.opcoes.map((o, i) => ({ label: o[0], valor: o[1], sub: 'Respostas', color: cores[i % cores.length] })) });
        return cartao(q.texto, 'Base: ' + ps.amostra + ' entrevistados', [box]);
      });
      alvo.appendChild(el('div', { style: { marginBottom: '18px' } }, [
        el('div', { class: 'cabecalho', style: { marginBottom: '10px' } }, [
          el('div', {}, [el('h1', { text: ps.titulo, style: { fontSize: '17px' } }), el('p', { text: ps.tipo + ' · aplicada em ' + fmtDate(ps.data) + ' · amostra de ' + ps.amostra + ' pessoas' })]),
          el('div', { class: 'acoes' }, [el('span', { class: 'tag', text: 'amostra de ' + ps.amostra + ' entrevistados' })]),
        ]),
        el('div', { class: 'grade ' + (cards.length > 1 ? 'g2' : '') }, cards),
      ]));
    });

    alvo.appendChild(cartao('Como as respostas se conectam às pessoas', null, el('p', { class: 'subtexto',
      text: 'Quando permitido e adequado, cada resposta pode ficar vinculada ao histórico individual da pessoa pesquisada — permitindo que a coordenação identifique demandas específicas de quem já está na base de relacionamento da campanha.' })));
  };

  function novaPesquisa() {
    const D = global.DB;
    formModal('Nova pesquisa', [
      { k: 'titulo', rot: 'Título da pesquisa', tipo: 'texto', obrigatorio: true, dica: 'Ex.: Intenção de voto — rodada 4' },
      { k: 'tipo', rot: 'Tipo', tipo: 'select', largura: 'meia', opcoes: ['Opinião eleitoral', 'Avaliação de temas', 'Identificação de demandas', 'Levantamento territorial', 'Consulta a apoiadores', 'Consulta a lideranças'] },
      { k: 'amostra', rot: 'Tamanho da amostra', tipo: 'numero', largura: 'meia', obrigatorio: true },
      { k: 'pergunta', rot: 'Pergunta principal', tipo: 'texto', dica: 'Ex.: Em quem votaria hoje para prefeito?' },
      { k: 'opcoes', rot: 'Respostas e percentuais', tipo: 'textarea', linhas: 4,
        dica: 'uma opção por linha, no formato: Nome, percentual — Ex.: Ricardo Fontes, 34' },
    ], (v) => {
      const perguntas = [];
      if (v.pergunta && v.opcoes) {
        const opcoes = v.opcoes.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
          const [rotulo, valor] = l.split(',');
          return [(rotulo || '').trim(), parseFloat((valor || '0').replace(',', '.')) || 0];
        });
        if (opcoes.length) perguntas.push({ texto: v.pergunta, opcoes });
      }
      const ps = D.addPesquisa({ titulo: v.titulo, tipo: v.tipo, amostra: +v.amostra, perguntas });
      toast('Pesquisa "' + ps.titulo + '" registrada.');
    }, { acao: 'Registrar pesquisa', wide: true, nota: 'A pergunta e as respostas são opcionais, mas não podem ser editadas depois de registradas — confira antes de salvar. Cada linha de resposta vira uma barra no gráfico.' });
  }

  /* ==========================  PERFORMANCE  ========================== */
  global.VIEWS['performance'] = function (alvo) {
    const D = global.DB;
    const E = D.equipes.map((eq) => ({ eq, st: D.equipeStats(eq) }));
    const T = D.territorioStats();

    alvo.appendChild(cabecalho('Performance', 'Onde as ações estão funcionando, onde estão atrasadas e quem precisa de apoio'));

    if (!E.length) return alvo.appendChild(global.UI.vazio({
      icone: 'users-round', titulo: 'Nenhuma equipe cadastrada ainda',
      texto: 'A performance compara equipes: tarefas concluídas, metas atingidas e cadastros. Cadastre a primeira equipe para começar a acompanhar.',
      acao: { rotulo: 'Cadastrar equipe', rota: '#/equipes' },
    }));
    const media = Math.round(sum(E, (x) => x.st.desempenho) / E.length);
    alvo.appendChild(el('div', { class: 'grade g5', style: { marginBottom: '16px' } }, [
      kpi({ rotulo: 'Desempenho médio', icone: 'zap', valor: media + '%', nota: 'índice combinado das equipes' }),
      kpi({ rotulo: 'Melhor equipe', icone: 'crown', valor: sortBy(E, (x) => x.st.desempenho, 'desc')[0].st.desempenho + '%', cor: 'var(--accent)', nota: sortBy(E, (x) => x.st.desempenho, 'desc')[0].eq.nome }),
      kpi({ rotulo: 'Equipes com atraso', icone: 'clock', valor: E.filter((x) => x.st.atrasadas > 0).length, cor: 'var(--danger)', nota: sum(E, (x) => x.st.atrasadas) + ' tarefas atrasadas no total' }),
      kpi({ rotulo: 'Conclusão de tarefas', icone: 'square-check', valor: dec(sum(E, (x) => x.st.conclusao) / E.length) + '%', cor: 'var(--accent-2)', nota: 'média entre todas as equipes' }),
      kpi({ rotulo: 'Territórios ativos', icone: 'map-pin', valor: T.filter((t) => t.diasSemAtividade !== null && t.diasSemAtividade < 7).length + '/' + T.length, cor: 'var(--warn)', nota: 'com registro nos últimos 7 dias' }),
    ]));

    const rankBox = el('div');
    global.CH.hbars(rankBox, { rowH: 30, fmt: (v) => v + '%', labelW: 200,
      data: sortBy(E, (x) => x.st.desempenho, 'desc').map((x) => ({ label: x.eq.nome, valor: x.st.desempenho, sub: 'Índice de desempenho', id: x.eq.id,
        color: x.st.desempenho >= 70 ? '#0e9f6e' : x.st.desempenho >= 45 ? '#d97706' : '#e11d48' })),
      onClick: (d) => (location.hash = '#/equipes/' + d.id) });

    const melhor = sortBy(E, (x) => x.st.desempenho, 'desc')[0];
    const pior = sortBy(E, (x) => x.st.desempenho)[0];
    const medias = el('div', {}, [
      indicador('Conclusão de tarefas', sum(E, (x) => x.st.conclusao) / E.length, 'média entre as ' + E.length + ' equipes'),
      indicador('Atingimento das metas', sum(E, (x) => Math.min(100, x.st.metaPct)) / E.length, 'média das metas do período'),
      indicador('Pontualidade', 100 - (sum(E, (x) => x.st.atrasadas) / Math.max(1, sum(E, (x) => x.st.tarefas))) * 100, sum(E, (x) => x.st.atrasadas) + ' tarefas atrasadas no total'),
      indicador('Cadastros por equipe', Math.min(100, sum(E, (x) => x.st.cadastros) / E.length / 3), Math.round(sum(E, (x) => x.st.cadastros) / E.length) + ' pessoas por equipe, em média'),
      el('div', { class: 'divisor' }),
      dado('Melhor desempenho', melhor.eq.nome + ' · ' + melhor.st.desempenho + '%'),
      dado('Precisa de apoio', pior.eq.nome + ' · ' + pior.st.desempenho + '%'),
    ]);

    alvo.appendChild(el('div', { class: 'grade g-2-1', style: { marginBottom: '16px' } }, [
      cartao('Ranking das equipes', 'Índice combinado de tarefas, metas e cadastros', [rankBox]),
      cartao('Perfil médio da operação', 'Médias das equipes e os dois extremos', [medias]),
    ]));

    alvo.appendChild(tabela({
      linhas: E, ordPadrao: 'desempenho', tam: 15, onRow: (x) => (location.hash = '#/equipes/' + x.eq.id),
      colunas: [
        { k: 'equipe', rotulo: 'Equipe', valor: (x) => x.eq.nome, render: (x) => el('div', {}, [el('b', { text: x.eq.nome, style: { fontSize: '13px' } }), el('small', { text: D.nomeTerr(x.eq.territorioId) + ' · ' + x.eq.integrantes.length + ' integrantes', style: { display: 'block', color: 'var(--txt-3)', fontSize: '11px' } })]) },
        { k: 'responsavel', rotulo: 'Responsável', valor: (x) => D.nome(x.eq.responsavelId), render: (x) => pessoaCell(x.eq.responsavelId) },
        { k: 'tarefas', rotulo: 'Tarefas', num: true, valor: (x) => x.st.tarefas, render: (x) => x.st.tarefas },
        { k: 'concluidas', rotulo: 'Concluídas', num: true, valor: (x) => x.st.concluidas, render: (x) => x.st.concluidas },
        { k: 'atrasadas', rotulo: 'Atrasadas', num: true, valor: (x) => x.st.atrasadas, render: (x) => x.st.atrasadas ? el('span', { class: 'tag vermelho ponto', text: x.st.atrasadas }) : '—' },
        { k: 'cadastros', rotulo: 'Cadastros', num: true, valor: (x) => x.st.cadastros, render: (x) => num(x.st.cadastros) },
        { k: 'metaPct', rotulo: 'Meta', num: true, valor: (x) => x.st.metaPct, render: (x) => el('div', { style: { minWidth: '110px' } }, [el('small', { text: Math.round(x.st.metaPct) + '%' }), barra(x.st.metaPct, 100)]) },
        { k: 'desempenho', rotulo: 'Desempenho', num: true, valor: (x) => x.st.desempenho, render: (x) => el('b', { text: x.st.desempenho + '%' }) },
      ],
    }));
  };

  /* ==========================  RELATÓRIOS  ========================== */
  global.VIEWS['relatorios'] = function (alvo, param, params) {
    const D = global.DB;
    const RELATORIOS = [
      { id: 'territorial', icone: 'map', nome: 'Relatório territorial', desc: 'Situação da campanha em cada região e bairro do município.' },
      { id: 'mobilizacao', icone: 'trending-up', nome: 'Relatório de mobilização', desc: 'Crescimento da base e desempenho dos mobilizadores.' },
      { id: 'liderancas', icone: 'star', nome: 'Relatório de lideranças', desc: 'Lideranças cadastradas e situação do relacionamento.' },
      { id: 'atividades', icone: 'square-check', nome: 'Relatório de atividades', desc: 'Tarefas, andamento e atrasos por equipe e território.' },
      { id: 'eventos', icone: 'megaphone', nome: 'Relatório de eventos', desc: 'Eventos realizados, público e resultados obtidos.' },
      { id: 'demandas', icone: 'inbox', nome: 'Relatório de demandas', desc: 'O que foi pedido, por quem, e o que a campanha respondeu.' },
      { id: 'materiais', icone: 'package', nome: 'Relatório de materiais', desc: 'Entrada, saída e saldo do estoque de campanha.' },
      { id: 'gerencial', icone: 'file-text', nome: 'Relatório gerencial', desc: 'Visão resumida da campanha para a coordenação.' },
    ];

    alvo.appendChild(cabecalho('Relatórios', 'Relatórios simples e úteis para a coordenação — clique para gerar com os dados de hoje'));

    const grade = el('div', { class: 'grade g4', style: { marginBottom: '18px' } });
    RELATORIOS.forEach((r) => grade.appendChild(el('div', { class: 'cartao', style: { cursor: 'pointer' }, onclick: () => gerar(r.id) }, [
      el('div', { style: { fontSize: '22px', marginBottom: '8px' } }, r.icone),
      el('h3', { text: r.nome, style: { fontSize: '14px' } }),
      el('p', { class: 'subtexto', style: { marginTop: '4px' }, text: r.desc }),
      el('div', { class: 'divisor' }),
      el('span', { class: 'tag verde ponto', text: 'gerar agora' }),
    ])));
    alvo.appendChild(grade);

    const saida = el('div');
    alvo.appendChild(saida);

    if (params.get('tipo') && RELATORIOS.some((r) => r.id === params.get('tipo'))) gerar(params.get('tipo'));

    function linha(rotulo, valor) { return el('div', { class: 'dado-linha' }, [el('span', { text: rotulo }), el('b', { text: valor })]); }
    function grafico(titulo, sub, desenhar) {
      const box = el('div');
      const c = cartao(titulo, sub, [box]);
      c.style.marginBottom = '14px';
      setTimeout(() => desenhar(box), 0);
      return c;
    }

    function gerar(tipo) {
      const s = D.stats();
      saida.innerHTML = '';
      const topo = el('div', { class: 'cabecalho' }, [
        el('div', {}, [el('h1', { text: (RELATORIOS.find((r) => r.id === tipo) || {}).nome, style: { fontSize: '19px' } }),
                       el('p', { text: (D.config.candidato || 'Campanha') + ' · ' + (D.municipio.nome || 'município não configurado') + ' · emitido em ' + fmtDate(D.HOJE) })]),
        el('div', { class: 'acoes' }, [el('button', { class: 'btn pequeno', html: icHTML('printer', 14) + ' Imprimir', onclick: () => window.print() })]),
      ]);
      const corpo = el('div', { class: 'cartao' });
      saida.appendChild(topo);
      saida.appendChild(corpo);

      if (tipo === 'territorial') {
        const T = sortBy(D.territorioStats(), (t) => t.apoiadores, 'desc');
        corpo.appendChild(el('p', { class: 'subtexto', text: 'O município possui ' + D.bairros.length + ' bairros distribuídos em ' + D.regioes.length + ' regiões, com ' + num(D.municipio.eleitores) + ' eleitores estimados. A campanha registra ' + num(s.apoiadores) + ' apoiadores, o equivalente a ' + dec(s.penetracao) + '% do eleitorado.' }));
        corpo.appendChild(grafico('Regiões: meta × apoiadores', 'Leitura agregada por região', (box) =>
          global.CH.bars(box, { height: 230, data: D.regioes.map((r) => {
            const bs = T.filter((t) => t.regiao === r.nome);
            return { label: r.nome.replace('Região ', ''), meta: sum(bs, (b) => b.meta), apoiadores: sum(bs, (b) => b.apoiadores) };
          }), series: [
            { key: 'meta', label: 'Meta da região', color: 'var(--surface-3)' },
            { key: 'apoiadores', label: 'Apoiadores', color: '#0e9f6e' }] })));
        corpo.appendChild(el('div', { class: 'divisor' }));
        corpo.appendChild(tabela({ linhas: T, tam: 20, ordPadrao: 'apoiadores', colunas: [
          { k: 'nome', rotulo: 'Bairro' }, { k: 'regiao', rotulo: 'Região' },
          { k: 'eleitores', rotulo: 'Eleitores', num: true, render: (t) => num(t.eleitores) },
          { k: 'pessoas', rotulo: 'Cadastros', num: true }, { k: 'apoiadores', rotulo: 'Apoiadores', num: true },
          { k: 'cobertura', rotulo: 'Cobertura', num: true, render: (t) => dec(t.cobertura) + '%' },
          { k: 'metaPct', rotulo: 'Meta', num: true, render: (t) => Math.round(t.metaPct) + '%' },
          { k: 'liderancas', rotulo: 'Lideranças', num: true }, { k: 'eventos', rotulo: 'Eventos', num: true },
          { k: 'diasSemAtividade', rotulo: 'Sem atividade', num: true, render: (t) => t.diasSemAtividade + ' d' },
        ]}));
      } else if (tipo === 'mobilizacao') {
        const rank = D.rankingMobilizadores(25);
        corpo.appendChild(el('div', { class: 'grade g4', style: { marginBottom: '14px' } }, [
          kpi({ rotulo: 'Base total', valor: num(s.total) }), kpi({ rotulo: 'Apoiadores', valor: num(s.apoiadores), cor: 'var(--accent)' }),
          kpi({ rotulo: 'Novos em 7 dias', valor: num(s.novos7), cor: 'var(--accent-2)' }), kpi({ rotulo: 'Mobilizadores ativos', valor: num(rank.length), cor: 'var(--warn)' }),
        ]));
        const g = el('div');
        global.CH.line(g, { height: 220, data: D.serieCrescimento(60), series: [{ key: 'acumulado', label: 'Base acumulada', color: '#0e9f6e' }], labelX: (d) => fmtDateShort(d.data) });
        corpo.appendChild(g);
        corpo.appendChild(grafico('Quem está ampliando a base', 'Cadastros por mobilizador', (box) =>
          global.CH.hbars(box, { rowH: 28, data: rank.slice(0, 12).map((r) => ({ label: D.nome(r.pessoaId).split(' ').slice(0, 2).join(' '), valor: r.cadastros, sub: 'Cadastros' })) })));
        corpo.appendChild(el('div', { class: 'divisor' }));
        corpo.appendChild(tabela({ linhas: rank, ordPadrao: 'cadastros', tam: 15, colunas: [
          { k: 'nome', rotulo: 'Mobilizador', valor: (r) => D.nome(r.pessoaId), render: (r) => D.nome(r.pessoaId) },
          { k: 'cadastros', rotulo: 'Cadastros', num: true }, { k: 'simpatizantes', rotulo: 'Simpatizantes', num: true },
          { k: 'apoiadores', rotulo: 'Apoiadores', num: true }, { k: 'participantes', rotulo: 'Participantes', num: true },
          { k: 'conversao', rotulo: 'Conversão', num: true, render: (r) => dec(r.conversao) + '%' },
        ]}));
      } else if (tipo === 'liderancas') {
        const porSit = global.U.countBy(D.liderancas, 'situacao');
        corpo.appendChild(el('div', { class: 'grade g2' }, [
          grafico('Segmentos de influência', 'Onde estão as lideranças relacionadas', (box) =>
            global.CH.hbars(box, { rowH: 26, data: sortBy(D.SEGMENTOS.map((seg) => ({ label: seg, valor: D.liderancas.filter((l) => l.segmento === seg).length })), (x) => x.valor, 'desc') })),
          grafico('Situação do relacionamento', 'Estágio da relação com a campanha', (box) => {
            global.CH.donut(box, { height: 210, data: ['aproximação', 'relacionamento', 'compromisso firmado', 'em disputa', 'afastada'].map((x, i) => ({
              label: x, valor: porSit.get(x) || 0, color: ['#98a2b3', '#2563eb', '#0e9f6e', '#d97706', '#e11d48'][i] })), centro: { valor: num(D.liderancas.length), rotulo: 'lideranças' } });
            box.parentNode.appendChild(legenda(['aproximação', 'relacionamento', 'compromisso firmado', 'em disputa', 'afastada'].map((x, i) => ({ cor: ['#98a2b3', '#2563eb', '#0e9f6e', '#d97706', '#e11d48'][i], rotulo: x }))));
          }),
        ]));
        corpo.appendChild(tabela({ linhas: D.liderancas, ordPadrao: 'alcanceEstimado', tam: 20, colunas: [
          { k: 'nome', rotulo: 'Liderança', valor: (l) => D.nome(l.pessoaId), render: (l) => D.nome(l.pessoaId) },
          { k: 'segmento', rotulo: 'Segmento' }, { k: 'atuacao', rotulo: 'Atuação' },
          { k: 'territorio', rotulo: 'Território', valor: (l) => (l.territorios.length ? D.nomeTerr(l.territorios[0]) : '—'), render: (l) => (l.territorios.length ? D.nomeTerr(l.territorios[0]) : '—') },
          { k: 'capacidade', rotulo: 'Capacidade', num: true }, { k: 'alcanceEstimado', rotulo: 'Alcance', num: true, render: (l) => num(l.alcanceEstimado) },
          { k: 'reunioes', rotulo: 'Reuniões', num: true }, { k: 'situacao', rotulo: 'Situação', render: (l) => tag(l.situacao) },
          { k: 'responsavel', rotulo: 'Responsável', valor: (l) => D.nome(l.responsavelId), render: (l) => D.nome(l.responsavelId) },
        ]}));
      } else if (tipo === 'atividades') {
        const porEquipe = D.equipes.map((eq) => ({ eq, st: D.equipeStats(eq) }));
        corpo.appendChild(el('p', { class: 'subtexto', text: 'A campanha possui ' + D.tarefas.length + ' tarefas registradas: ' + s.tarefasConcluidas + ' concluídas, ' + s.tarefasAndamento + ' em andamento e ' + s.tarefasAtrasadas + ' atrasadas.' }));
        corpo.appendChild(grafico('Tarefas por equipe', 'Concluídas × atrasadas', (box) =>
          global.CH.bars(box, { height: 240, data: sortBy(porEquipe, (x) => x.st.concluidas, 'desc').map((x) => ({
            label: x.eq.nome.replace(/^(Núcleo |Equipe )/, ''), concluidas: x.st.concluidas, atrasadas: x.st.atrasadas })), series: [
            { key: 'concluidas', label: 'Concluídas', color: '#0e9f6e' },
            { key: 'atrasadas', label: 'Atrasadas', color: '#e11d48' }] })));
        corpo.appendChild(grafico('Metas: previsto × realizado', 'Principais metas de território e equipe', (box) =>
          global.CH.bars(box, { height: 250, data: D.metas.slice(0, 12).map((m) => ({
            label: m.titulo.replace(/^(Cadastrar apoiadores no |Novos contatos — )/, ''), previsto: m.alvo, realizado: D.metaAtual(m) })), series: [
            { key: 'previsto', label: 'Meta prevista', color: 'var(--surface-3)' },
            { key: 'realizado', label: 'Resultado alcançado', color: '#0e9f6e' }] })));
        corpo.appendChild(el('div', { class: 'divisor' }));
        corpo.appendChild(tabela({ linhas: porEquipe, ordPadrao: 'desempenho', tam: 15, colunas: [
          { k: 'equipe', rotulo: 'Equipe', valor: (x) => x.eq.nome, render: (x) => x.eq.nome },
          { k: 'tarefas', rotulo: 'Tarefas', num: true, valor: (x) => x.st.tarefas, render: (x) => x.st.tarefas },
          { k: 'concluidas', rotulo: 'Concluídas', num: true, valor: (x) => x.st.concluidas, render: (x) => x.st.concluidas },
          { k: 'atrasadas', rotulo: 'Atrasadas', num: true, valor: (x) => x.st.atrasadas, render: (x) => x.st.atrasadas },
          { k: 'conclusao', rotulo: 'Conclusão', num: true, valor: (x) => x.st.conclusao, render: (x) => dec(x.st.conclusao) + '%' },
          { k: 'desempenho', rotulo: 'Desempenho', num: true, valor: (x) => x.st.desempenho, render: (x) => x.st.desempenho + '%' },
        ]}));
      } else if (tipo === 'eventos') {
        const ev = sortBy(D.eventos.filter((e) => e.status === 'realizado'), (e) => e.data, 'desc');
        corpo.appendChild(el('div', { class: 'grade g4', style: { marginBottom: '14px' } }, [
          kpi({ rotulo: 'Eventos realizados', valor: ev.length }),
          kpi({ rotulo: 'Público total', valor: num(sum(ev, (e) => e.publicoPresente)), cor: 'var(--accent)' }),
          kpi({ rotulo: 'Novos cadastros', valor: num(sum(ev, (e) => e.novosCadastros)), cor: 'var(--accent-2)' }),
          kpi({ rotulo: 'Novos apoiadores', valor: num(sum(ev, (e) => e.novosApoiadores)), cor: 'var(--warn)' }),
        ]));
        corpo.appendChild(grafico('Público previsto × presente', 'Últimos 12 eventos realizados', (box) =>
          global.CH.bars(box, { height: 240, data: sortBy(ev, (e) => e.data).slice(-12).map((e) => ({
            label: fmtDateShort(e.data), previsto: e.publicoPrevisto, presente: e.publicoPresente })), series: [
            { key: 'previsto', label: 'Público previsto', color: 'var(--surface-3)' },
            { key: 'presente', label: 'Público presente', color: '#0e9f6e' }] })));
        corpo.appendChild(grafico('Tipos de atividade', 'Formatos utilizados pela campanha', (box) =>
          global.CH.hbars(box, { rowH: 26, data: sortBy(D.TIPO_EVENTO.map((t) => ({ label: t, valor: D.eventos.filter((e) => e.tipo === t).length })), (x) => x.valor, 'desc') })));
        corpo.appendChild(tabela({ linhas: ev, ordPadrao: 'publicoPresente', tam: 15, colunas: [
          { k: 'nome', rotulo: 'Evento' }, { k: 'tipo', rotulo: 'Tipo' },
          { k: 'data', rotulo: 'Data', render: (e) => fmtDate(e.data) },
          { k: 'territorio', rotulo: 'Território', valor: (e) => D.nomeTerr(e.territorioId), render: (e) => D.nomeTerr(e.territorioId) },
          { k: 'publicoPrevisto', rotulo: 'Previsto', num: true, render: (e) => num(e.publicoPrevisto) },
          { k: 'publicoPresente', rotulo: 'Presente', num: true, render: (e) => num(e.publicoPresente) },
          { k: 'novosCadastros', rotulo: 'Cadastros', num: true }, { k: 'novosApoiadores', rotulo: 'Apoiadores', num: true },
        ]}));
      } else if (tipo === 'materiais') {
        const destinos = new Map();
        D.materiais.forEach((m) => m.movimentos.filter((x) => x.tipo === 'saída').forEach((x) => destinos.set(x.destino, (destinos.get(x.destino) || 0) + x.qtd)));
        corpo.appendChild(grafico('Entrada × saldo por item', 'Quanto entrou e quanto ainda resta', (box) =>
          global.CH.bars(box, { height: 240, data: D.materiais.map((m) => ({
            label: m.nome, entrada: sum(m.movimentos.filter((x) => x.tipo === 'entrada'), (x) => x.qtd), saldo: m.saldo })), series: [
            { key: 'entrada', label: 'Entrada total', color: 'var(--surface-3)' },
            { key: 'saldo', label: 'Saldo atual', color: '#0e9f6e' }] })));
        corpo.appendChild(grafico('Destino das saídas', 'Para onde o material foi enviado', (box) =>
          global.CH.hbars(box, { rowH: 26, data: sortBy(Array.from(destinos, ([label, valor]) => ({ label, valor })), (x) => x.valor, 'desc').slice(0, 12) })));
        corpo.appendChild(tabela({ linhas: D.materiais, ordPadrao: 'saldo', tam: 20, colunas: [
          { k: 'nome', rotulo: 'Material' },
          { k: 'entradas', rotulo: 'Entradas', num: true, valor: (m) => sum(m.movimentos.filter((x) => x.tipo === 'entrada'), (x) => x.qtd), render: (m) => num(sum(m.movimentos.filter((x) => x.tipo === 'entrada'), (x) => x.qtd)) },
          { k: 'saidas', rotulo: 'Saídas', num: true, valor: (m) => sum(m.movimentos.filter((x) => x.tipo === 'saída'), (x) => x.qtd), render: (m) => num(sum(m.movimentos.filter((x) => x.tipo === 'saída'), (x) => x.qtd)) },
          { k: 'saldo', rotulo: 'Saldo', num: true, render: (m) => num(m.saldo) },
          { k: 'minimo', rotulo: 'Mínimo', num: true, render: (m) => num(m.minimo) },
          { k: 'situacao', rotulo: 'Situação', valor: (m) => m.saldo - m.minimo, render: (m) => m.saldo <= m.minimo ? tag('repor', 'vermelho') : tag('adequado', 'verde') },
        ]}));
      } else if (tipo === 'demandas') {
        const cont = global.U.countBy(D.demandas, 'status');
        const atendidas = D.demandas.filter((x) => x.status === 'atendida');
        corpo.appendChild(el('div', { class: 'grade g4', style: { marginBottom: '14px' } }, [
          kpi({ rotulo: 'Demandas registradas', valor: num(D.demandas.length) }),
          kpi({ rotulo: 'Atendidas', valor: num(atendidas.length), cor: 'var(--accent)' }),
          kpi({ rotulo: 'Pendentes', valor: num(s.demandasPendentes), cor: 'var(--warn)' }),
          kpi({ rotulo: 'Taxa de atendimento', valor: pct(atendidas.length, D.demandas.length) + '%', cor: 'var(--accent-2)' }),
        ]));
        corpo.appendChild(el('div', { class: 'grade g2' }, [
          grafico('Demandas por área responsável', 'Onde está concentrada a resposta', (box) =>
            global.CH.hbars(box, { rowH: 26, data: sortBy(D.AREAS.map((a) => ({ label: a, valor: D.demandas.filter((x) => x.area === a).length })), (x) => x.valor, 'desc') })),
          grafico('Situação das demandas', 'Do registro à solução', (box) =>
            global.CH.donut(box, { height: 210, data: ['aberta', 'em análise', 'encaminhada', 'atendida', 'não atendida'].map((x, i) => ({
              label: x, valor: cont.get(x) || 0, color: ['#d97706', '#2563eb', '#7c3aed', '#0e9f6e', '#e11d48'][i] })), centro: { valor: num(D.demandas.length), rotulo: 'demandas' } })),
        ]));
        corpo.appendChild(tabela({ linhas: D.demandas, ordPadrao: 'data', tam: 20, colunas: [
          { k: 'descricao', rotulo: 'Demanda' },
          { k: 'solicitante', rotulo: 'Solicitante', valor: (x) => D.nome(x.solicitanteId), render: (x) => D.nome(x.solicitanteId) },
          { k: 'territorio', rotulo: 'Território', valor: (x) => D.nomeTerr(x.territorioId), render: (x) => D.nomeTerr(x.territorioId) },
          { k: 'area', rotulo: 'Área' }, { k: 'prioridade', rotulo: 'Prioridade' },
          { k: 'data', rotulo: 'Registro', render: (x) => fmtDate(x.data) },
          { k: 'status', rotulo: 'Situação', render: (x) => tag(x.status) },
          { k: 'solucao', rotulo: 'Solução', render: (x) => x.solucao || '—' },
        ]}));
      } else {
        const T = D.territorioStats();
        corpo.appendChild(grafico('Funil de relacionamento', 'Do primeiro contato à liderança', (box) =>
          global.CH.funnel(box, { data: D.funil() })));
        corpo.appendChild(el('div', { class: 'grade g2' }, [
          el('div', {}, [
            el('h3', { text: 'Pessoas', style: { fontSize: '14px', marginBottom: '8px' } }),
            linha('Total cadastrado', num(s.total)), linha('Simpatizantes', num(s.simpatizantes)), linha('Apoiadores', num(s.apoiadores)),
            linha('Mobilizadores', num(s.mobilizadores)), linha('Lideranças', num(s.liderancas)),
            el('h3', { text: 'Mobilização', style: { fontSize: '14px', margin: '14px 0 8px' } }),
            linha('Novos nos últimos 7 dias', num(s.novos7)), linha('Variação sobre a semana anterior', s.variacao7 + '%'),
            linha('Cobertura do eleitorado', dec(s.penetracao) + '%'),
            el('h3', { text: 'Território', style: { fontSize: '14px', margin: '14px 0 8px' } }),
            linha('Bairro mais forte', T.length ? sortBy(T, (t) => t.apoiadores, 'desc')[0].nome : '—'),
            linha('Bairro com menor atividade', T.length ? sortBy(T, (t) => t.diasSemAtividade || 0, 'desc')[0].nome : '—'),
            linha('Territórios na meta', T.filter((t) => t.metaPct >= 100).length + ' de ' + T.length),
          ]),
          el('div', {}, [
            el('h3', { text: 'Operação', style: { fontSize: '14px', marginBottom: '8px' } }),
            linha('Tarefas em andamento', num(s.tarefasAndamento)), linha('Tarefas atrasadas', num(s.tarefasAtrasadas)),
            linha('Eventos realizados', num(s.eventosRealizados)), linha('Eventos previstos', num(s.eventosProximos)),
            linha('Demandas pendentes', num(s.demandasPendentes)),
            el('h3', { text: 'Recursos', style: { fontSize: '14px', margin: '14px 0 8px' } }),
            linha('Materiais abaixo do mínimo', D.materiais.filter((m) => m.saldo <= m.minimo).length + ' itens'),
            linha('Recursos disponíveis', D.recursos.filter((r) => r.status === 'disponível').length + ' de ' + D.recursos.length),
            linha('Gasto realizado', money(s.gastoRealizado)), linha('Gasto previsto', money(s.gastoPrevisto)),
            el('h3', { text: 'Gestão', style: { fontSize: '14px', margin: '14px 0 8px' } }),
            linha('Metas atingidas', D.metas.filter((m) => D.metaAtual(m) >= m.alvo).length + ' de ' + D.metas.length),
            linha('Melhor equipe', D.equipes.length ? sortBy(D.equipes.map((eq) => ({ eq, st: D.equipeStats(eq) })), (x) => x.st.desempenho, 'desc')[0].eq.nome : '—'),
            linha('Dias para a eleição', s.diasEleicao),
          ]),
        ]));
      }
      saida.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (params && params.get('tipo')) gerar(params.get('tipo'));
  };
})(window);

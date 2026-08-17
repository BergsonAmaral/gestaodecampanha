/* ==========================================================================
   view-territorio.js — Mapa territorial, ficha do território e dia da eleição
   ========================================================================== */
(function (global) {
  'use strict';
  const { el, num, dec, pct, fmtDate, fmtDateShort, sortBy, sum, toast } = global.U;
  const { cabecalho, cartao, kpi, tag, pessoaCell, avatarPessoa, barra, tabela, filtros, listaItem, dado, legenda, voltar, formModal } = global.UI;

  /* ==========================  MAPA TERRITORIAL  ========================== */
  global.VIEWS['territorio'] = function (alvo, param, params) {
    const D = global.DB;
    if (param) return ficha(alvo, param);
    const T = D.territorioStats();

    alvo.appendChild(cabecalho('Mapa territorial', D.municipio.nome + ' · ' + D.bairros.length + ' bairros em ' + D.regioes.length + ' regiões · ' + num(D.municipio.eleitores) + ' eleitores estimados', [
      el('button', { class: 'btn pequeno', html: icHTML('file-text', 14) + ' Relatório territorial', onclick: () => (location.hash = '#/relatorios?tipo=territorial') }),
    ]));

    if (!T.length) {
      alvo.appendChild(global.UI.vazio({
        icone: 'map', titulo: 'O mapa aparece quando houver bairros cadastrados',
        texto: 'O desenho do município é montado a partir dos bairros que você cadastrar — cada um vira uma área no mapa, colorida pelo indicador que a coordenação escolher.',
        acao: { rotulo: 'Cadastrar bairros', rota: '#/territorios' },
      }));
      return;
    }
    const acima = T.filter((t) => t.metaPct >= 100).length;
    const paradas = T.filter((t) => t.diasSemAtividade >= 7);
    alvo.appendChild(el('div', { class: 'grade g4', style: { marginBottom: '16px' } }, [
      kpi({ rotulo: 'Cobertura do eleitorado', icone: 'target', valor: pct(sum(T, (t) => t.apoiadores), D.municipio.eleitores) + '%', nota: num(sum(T, (t) => t.apoiadores)) + ' apoiadores declarados' }),
      kpi({ rotulo: 'Bairros na meta', icone: 'square-check', valor: acima + '/' + T.length, cor: 'var(--accent-2)', nota: 'territórios que atingiram a meta prevista' }),
      kpi({ rotulo: 'Territórios parados', icone: 'triangle-alert', valor: paradas.length, cor: 'var(--danger)', nota: 'sem registro de atividade há 7 dias ou mais' }),
      kpi({ rotulo: 'Lideranças em campo', icone: 'star', valor: num(sum(T, (t) => t.liderancas)), cor: 'var(--rose)', nota: 'com atuação declarada em algum território' }),
    ]));

    const mapBox = el('div', { style: { height: '520px' } });
    const selMetrica = el('select', {}, Object.keys(global.MAPA.METRICAS).map((k) => el('option', { value: k, text: global.MAPA.METRICAS[k].rotulo })));
    const selModo = el('select', {}, [
      el('option', { value: 'choropleth', text: 'Somente territórios' }),
      el('option', { value: 'eventos', text: '+ Eventos realizados' }),
      el('option', { value: 'liderancas', text: '+ Lideranças' }),
      el('option', { value: 'equipes', text: '+ Equipes' }),
    ]);
    if (params.get('modo')) selModo.value = params.get('modo');
    const redesenhar = () => global.MAPA.render(mapBox, { metrica: selMetrica.value, modo: selModo.value, onSelect: (id) => (location.hash = '#/territorio/' + id) });
    selMetrica.onchange = redesenhar;
    selModo.onchange = redesenhar;
    setTimeout(redesenhar, 0);

    const rankBox = el('div');
    const desenhaRank = (chave) => {
      rankBox.innerHTML = '';
      const g = el('div');
      rankBox.appendChild(g);
      const dados = sortBy(T, (t) => t[chave], 'desc').map((t) => ({ label: t.nome, valor: t[chave], sub: global.MAPA.METRICAS[chave] ? global.MAPA.METRICAS[chave].rotulo : chave, id: t.id }));
      global.CH.hbars(g, { data: dados, rowH: 27, labelW: 130, fmt: chave === 'cobertura' || chave === 'metaPct' ? (v) => dec(v) + '%' : num, onClick: (d) => (location.hash = '#/territorio/' + d.id) });
    };
    const selRank = el('select', {}, ['apoiadores', 'pessoas', 'cobertura', 'metaPct', 'liderancas', 'eventos'].map((k) => el('option', { value: k, text: global.MAPA.METRICAS[k].rotulo })));
    selRank.onchange = () => desenhaRank(selRank.value);
    desenhaRank('apoiadores');

    alvo.appendChild(el('div', { class: 'grade g-3-2', style: { marginBottom: '16px' } }, [
      cartao('Município em camadas', 'Clique no bairro para abrir o território · arraste e use a roda do mouse para navegar', [mapBox], [selModo, selMetrica]),
      cartao('Ranking territorial', 'Comparação direta entre bairros', [el('div', { class: 'rolagem', style: { '--h': '470px' } }, rankBox)], [selRank]),
    ]));

    const regBox = el('div');
    const porRegiao = D.regioes.map((r) => {
      const bs = T.filter((t) => t.regiao === r.nome);
      return { label: r.nome.replace('Região ', ''), apoiadores: sum(bs, (b) => b.apoiadores), meta: sum(bs, (b) => b.meta) };
    });
    global.CH.bars(regBox, { height: 230, data: porRegiao, series: [
      { key: 'meta', label: 'Meta da região', color: 'var(--surface-3)' },
      { key: 'apoiadores', label: 'Apoiadores', color: '#0e9f6e' }] });

    const alertaBox = el('div', { class: 'lista' }, sortBy(paradas, (t) => t.diasSemAtividade, 'desc').slice(0, 8).map((t) => listaItem({
      icone: 'map-pin', titulo: t.nome, sub: t.regiao + ' · cobertura ' + dec(t.cobertura) + '%',
      valor: t.diasSemAtividade + 'd', nota: 'sem atividade', onclick: () => (location.hash = '#/territorio/' + t.id),
    })));

    alvo.appendChild(el('div', { class: 'grade g2', style: { marginBottom: '16px' } }, [
      cartao('Regiões: meta × apoiadores', 'Leitura agregada por região do município', [regBox]),
      cartao('Territórios que precisam de atenção', 'Bairros sem registro recente de atividade', [alertaBox.children.length ? alertaBox : el('div', { class: 'vazio', text: 'Todos os territórios registraram atividade recente.' })]),
    ]));

  };


  /* ==========================  CADASTRO DE TERRITÓRIOS  ========================== */
  global.VIEWS['territorios'] = function (alvo, param) {
    const D = global.DB;
    if (param) return ficha(alvo, param);
    const T = D.territorioStats();

    alvo.appendChild(cabecalho('Territórios', D.bairros.length + ' bairros em ' + D.regioes.length + ' regiões · base cadastral do município', [
      el('button', { class: 'btn pequeno', html: icHTML('plus', 14) + ' Nova região', onclick: () => formModal('Nova região ou distrito', [
        { k: 'nome', rot: 'Nome da região', tipo: 'texto', obrigatorio: true, dica: 'Ex.: Região Norte, Distrito de Boa Vista' },
      ], (v) => { D.addTerritorio({ nome: v.nome, tipo: 'regiao' }); toast('Região cadastrada.'); }, { acao: 'Cadastrar região' }) }),
      el('button', { class: 'btn pequeno primario', html: icHTML('plus', 14) + ' Novo bairro', onclick: () => novoBairro() }),
      el('button', { class: 'btn pequeno', html: icHTML('map', 14) + ' Ver no mapa', onclick: () => (location.hash = '#/territorio') }),
      el('button', { class: 'btn pequeno', html: icHTML('download', 14) + ' Exportar', onclick: () => global.UI.exportarCSV('territorios.csv', [
        { rotulo: 'Bairro', valor: (t) => t.nome }, { rotulo: 'Região', valor: (t) => t.regiao },
        { rotulo: 'Eleitores', valor: (t) => t.eleitores }, { rotulo: 'Cadastros', valor: (t) => t.pessoas },
        { rotulo: 'Apoiadores', valor: (t) => t.apoiadores }, { rotulo: 'Cobertura %', valor: (t) => dec(t.cobertura) },
        { rotulo: 'Meta', valor: (t) => t.meta }, { rotulo: 'Lideranças', valor: (t) => t.liderancas },
      ], T) }),
    ]));

    if (!T.length) {
      alvo.appendChild(global.UI.vazio({
        icone: 'map-pin', titulo: 'Nenhum bairro cadastrado ainda',
        texto: 'O território é a espinha dorsal do sistema: mapa, metas, equipes e relatórios se organizam por bairro. Comece cadastrando os bairros do município com o eleitorado estimado de cada um.',
        acao: { rotulo: 'Cadastrar primeiro bairro', onclick: () => novoBairro() },
      }));
      return;
    }

    const tab = tabela({
      linhas: T, ordPadrao: 'apoiadores', tam: 20,
      onRow: (t) => (location.hash = '#/territorios/' + t.id),
      colunas: [
        { k: 'nome', rotulo: 'Bairro', render: (t) => el('div', {}, [el('b', { text: t.nome, style: { fontSize: '13px' } }), el('small', { text: D.terr(t.id).localidades.join(', '), style: { display: 'block', color: 'var(--txt-3)', fontSize: '11px' } })]) },
        { k: 'regiao', rotulo: 'Região' },
        { k: 'zona', rotulo: 'Zona', valor: (t) => D.terr(t.id).zona, render: (t) => D.terr(t.id).zona },
        { k: 'eleitores', rotulo: 'Eleitores', num: true, render: (t) => num(t.eleitores) },
        { k: 'pessoas', rotulo: 'Cadastros', num: true, render: (t) => num(t.pessoas) },
        { k: 'apoiadores', rotulo: 'Apoiadores', num: true, render: (t) => el('b', { text: num(t.apoiadores) }) },
        { k: 'meta', rotulo: 'Meta', num: true, render: (t) => num(t.meta) },
        { k: 'metaPct', rotulo: 'Atingido', num: true, render: (t) => el('div', { style: { minWidth: '110px' } }, [el('small', { text: Math.round(t.metaPct) + '%' }), barra(t.metaPct, 100)]) },
        { k: 'liderancas', rotulo: 'Lideranças', num: true },
        { k: 'diasSemAtividade', rotulo: 'Sem atividade', num: true, render: (t) => t.diasSemAtividade + ' d' },
      ],
    });
    alvo.appendChild(filtros([
      { k: 'busca', tipo: 'busca', placeholder: 'Buscar bairro ou localidade…' },
      { k: 'regiao', tipo: 'chips', rotulo: 'Todas as regiões', opcoes: D.regioes.map((r) => ({ v: r.nome, t: r.nome.replace('Região ', ''), n: T.filter((t) => t.regiao === r.nome).length })) },
    ], (e) => {
      let l = T;
      if (e.busca) { const q = global.U.norm(e.busca); l = l.filter((t) => global.U.norm(t.nome).includes(q) || global.U.norm(D.terr(t.id).localidades.join(' ')).includes(q)); }
      if (e.regiao !== 'todos') l = l.filter((t) => t.regiao === e.regiao);
      return tab.atualizar(l);
    }));
    alvo.appendChild(tab);
  };

  function novoBairro() {
    const D = global.DB;
    const regs = D.regioes;
    return formModal('Novo bairro', [
      { k: 'nome', rot: 'Nome do bairro', tipo: 'texto', obrigatorio: true, dica: 'Ex.: Centro, Alto Alegre' },
      { k: 'paiId', rot: 'Região', tipo: 'select', largura: 'meia',
        opcoes: regs.length ? regs.map((r) => ({ v: r.id, t: r.nome })) : [{ v: '', t: 'nenhuma região cadastrada' }] },
      { k: 'zona', rot: 'Zona eleitoral', tipo: 'texto', largura: 'meia', dica: 'Ex.: 021' },
      { k: 'eleitores', rot: 'Eleitorado estimado', tipo: 'numero', largura: 'meia', obrigatorio: true, dica: 'consulte no TSE' },
      { k: 'meta', rot: 'Meta de apoiadores', tipo: 'numero', largura: 'meia' },
      { k: 'localidades', rot: 'Localidades e comunidades', tipo: 'texto', dica: 'separe por vírgula' },
    ], (v) => {
      D.addTerritorio({
        nome: v.nome, tipo: 'bairro', paiId: v.paiId || null, zona: v.zona,
        eleitores: +v.eleitores, meta: +v.meta || Math.round(+v.eleitores * 0.05),
        localidades: v.localidades ? v.localidades.split(',').map((x) => x.trim()).filter(Boolean) : [],
      });
      toast('Bairro "' + v.nome + '" cadastrado.');
    }, { acao: 'Cadastrar bairro', nota: 'A meta em branco é calculada como 5% do eleitorado — você pode ajustar depois.' });
  }

  /* ==========================  FICHA DO TERRITÓRIO  ========================== */
  function ficha(alvo, id) {
    const D = global.DB;
    const b = D.terr(id);
    if (!b || b.tipo !== 'bairro') return alvo.appendChild(cartao('Território não encontrado', null, el('p', { class: 'subtexto', text: 'Verifique o endereço.' })));
    const st = D.territorioStats().find((t) => t.id === id);
    const ps = D.pessoas.filter((p) => p.bairroId === id);
    const evs = sortBy(D.eventos.filter((e) => e.territorioId === id), (e) => e.data, 'desc');
    const tfs = D.tarefas.filter((t) => t.territorioId === id);
    const lids = D.liderancas.filter((l) => l.territorios.includes(id));
    const eqs = D.equipes.filter((e) => e.territorioId === id);
    const dems = D.demandas.filter((d) => d.territorioId === id);
    const locais = D.locaisVotacao.filter((l) => l.territorioId === id);

    alvo.appendChild(el('div', { class: 'filtros' }, [voltar('#/territorios', 'territórios')]));
    alvo.appendChild(cabecalho(b.nome, (b.paiId ? D.nomeTerr(b.paiId) : 'sem região') + ' · zona eleitoral ' + b.zona + ' · ' + num(b.eleitores) + ' eleitores estimados · localidades: ' + b.localidades.join(', '), [
      el('button', { class: 'btn pequeno', html: icHTML('megaphone', 14) + ' Novo evento aqui', onclick: () => global.novoEvento({ territorioId: b.id }) }),
      el('button', { class: 'btn pequeno primario', html: icHTML('square-check', 14) + ' Nova tarefa', onclick: () => global.novaTarefa({ territorioId: b.id, titulo: '' }) }),
    ]));

    alvo.appendChild(el('div', { class: 'grade g5', style: { marginBottom: '16px' } }, [
      kpi({ rotulo: 'Pessoas cadastradas', icone: 'users', valor: num(st.pessoas), nota: num(st.simpatizantes) + ' simpatizantes ou mais' }),
      kpi({ rotulo: 'Apoiadores', icone: 'handshake', valor: num(st.apoiadores), cor: 'var(--accent-2)', nota: dec(st.cobertura) + '% do eleitorado' }),
      kpi({ rotulo: 'Meta do território', icone: 'target', valor: Math.round(st.metaPct) + '%', cor: 'var(--warn)', nota: 'meta de ' + num(st.meta) + ' apoiadores' }),
      kpi({ rotulo: 'Lideranças', icone: 'star', valor: num(lids.length), cor: 'var(--rose)', nota: num(st.mobilizadores) + ' mobilizadores atuando' }),
      kpi({ rotulo: 'Atividades', icone: 'megaphone', valor: num(st.eventos), cor: 'var(--accent-3)', nota: st.eventosRealizados + ' realizadas · ' + tfs.length + ' tarefas' }),
    ]));

    const mapBox = el('div', { style: { height: '320px' } });
    setTimeout(() => global.MAPA.render(mapBox, { metrica: 'apoiadores', selecionado: id, onSelect: (x) => (location.hash = '#/territorio/' + x) }), 0);

    alvo.appendChild(el('div', { class: 'grade g3', style: { marginBottom: '16px' } }, [
      cartao('Localização no município', 'Território destacado no mapa', [el('div', { class: 'mini-mapa' }, mapBox)]),
      cartao('Composição da base local', 'Estágio de relacionamento no bairro', [
        el('div', {}, D.CLASSIF.map((c) => {
          const n = ps.filter((p) => p.classificacao === c).length;
          return el('div', { style: { marginBottom: '9px', cursor: 'pointer' }, onclick: () => (location.hash = '#/pessoas?classificacao=' + c) }, [
            el('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '3px' } }, [
              el('span', { text: D.CLASSIF_LABEL[c], style: { fontSize: '12.5px' } }),
              el('b', { text: num(n) + ' · ' + dec(ps.length ? (n / ps.length) * 100 : 0) + '%', style: { fontSize: '12.5px' } }),
            ]),
            barra(n, ps.length || 1, D.CLASSIF_COR[c]),
          ]);
        })),
      ]),
      (function () {
        const dias = (n) => ps.filter((p) => global.U.daysBetween(p.dataCadastro, D.HOJE) <= n).length;
        const ultimo = sortBy(ps, (p) => p.dataCadastro, 'desc')[0];
        const evsPass = evs.filter((e) => e.status === 'realizado');
        return cartao('Atividade recente', 'O que aconteceu neste território', [
          dado('Cadastros nos últimos 7 dias', num(dias(7))),
          dado('Nos últimos 30 dias', num(dias(30))),
          dado('Último cadastro', ultimo ? fmtDate(ultimo.dataCadastro) + ' · ' + global.U.relDays(ultimo.dataCadastro) : '—'),
          dado('Última ação da campanha', st.ultimaAtividade ? fmtDate(st.ultimaAtividade) + ' (' + st.diasSemAtividade + ' dias)' : 'sem registro'),
          dado('Eventos realizados', num(evsPass.length) + (evsPass.length ? ' · ' + num(sum(evsPass, (e) => e.publicoPresente)) + ' presentes' : '')),
          dado('Tarefas em aberto', num(tfs.filter((t) => ['não iniciada', 'em andamento', 'atrasada'].includes(t.status)).length) + ' de ' + tfs.length),
          st.diasSemAtividade >= 7 ? el('p', { class: 'subtexto', style: { marginTop: '10px', color: 'var(--danger)' }, text: 'Território sem ação registrada há ' + st.diasSemAtividade + ' dias — considere agendar uma atividade.' }) : null,
        ]);
      })(),
    ]));

    alvo.appendChild(el('div', { class: 'grade g3', style: { marginBottom: '16px' } }, [
      cartao('Lideranças do território', lids.length + ' com atuação declarada', [
        el('div', { class: 'lista rolagem', style: { '--h': '300px' } }, lids.length ? lids.map((l) => listaItem({
          avatar: avatarPessoa(l.pessoaId, 'pequeno'), titulo: D.nome(l.pessoaId), sub: l.segmento + ' · ' + l.atuacao,
          tag: tag(l.situacao), onclick: () => (location.hash = '#/pessoas/' + l.pessoaId),
        })) : [el('div', { class: 'vazio', text: 'Nenhuma liderança mapeada neste território.' })]),
      ]),
      cartao('Equipes e núcleos', eqs.length + ' com atuação neste bairro', [
        el('div', { class: 'lista' }, eqs.length ? eqs.map((eq) => {
          const es = D.equipeStats(eq);
          return listaItem({ icone: 'users-round', titulo: eq.nome, sub: eq.integrantes.length + ' integrantes · resp. ' + D.nome(eq.responsavelId), valor: es.desempenho + '%', nota: 'desempenho', onclick: () => (location.hash = '#/equipes/' + eq.id) });
        }) : [el('div', { class: 'vazio', text: 'Nenhuma equipe designada para este território.' })]),
        el('div', { class: 'divisor' }),
        el('div', { class: 'subtexto', text: 'Locais de votação' }),
        el('div', { class: 'lista' }, locais.map((l) => listaItem({
          icone: 'vote', titulo: l.nome, sub: l.secoes + ' seções · ' + num(l.eleitores) + ' eleitores',
          valor: l.fiscaisConfirmados + '/' + l.fiscaisNecessarios, nota: 'fiscais', onclick: () => (location.hash = '#/eleicao'),
        }))),
      ]),
      cartao('Demandas do território', dems.length + ' registradas', [
        el('div', { class: 'lista rolagem', style: { '--h': '300px' } }, dems.length ? dems.map((d) => listaItem({
          icone: 'inbox', titulo: d.descricao, sub: fmtDate(d.data) + ' · ' + D.nome(d.solicitanteId), tag: tag(d.status),
          onclick: () => (location.hash = '#/demandas'),
        })) : [el('div', { class: 'vazio', text: 'Nenhuma demanda registrada.' })]),
      ]),
    ]));

    alvo.appendChild(el('div', { class: 'grade g2' }, [
      cartao('Atividades realizadas e previstas', evs.length + ' eventos no território', [
        el('div', { class: 'lista rolagem', style: { '--h': '320px' } }, evs.map((e) => listaItem({
          icone: 'megaphone', titulo: e.nome, sub: fmtDate(e.data) + ' · ' + e.local,
          valor: e.publicoPresente ? num(e.publicoPresente) : num(e.publicoPrevisto), nota: e.publicoPresente ? 'presentes' : 'previstos',
          onclick: () => (location.hash = '#/eventos/' + e.id),
        }))),
      ]),
      cartao('Tarefas do território', tfs.length + ' tarefas vinculadas', [
        el('div', { class: 'lista rolagem', style: { '--h': '320px' } }, tfs.map((t) => listaItem({
          icone: 'square-check', titulo: t.titulo, sub: 'prazo ' + fmtDate(t.prazo) + ' · ' + D.nome(t.responsavelId),
          tag: tag(t.status), onclick: () => (location.hash = '#/tarefas'),
        }))),
      ]),
    ]));
  }

  /* ==========================  DIA DA ELEIÇÃO  ========================== */
  global.VIEWS['eleicao'] = function (alvo) {
    const D = global.DB;
    const L = D.locaisVotacao;
    const totalSecoes = sum(L, (l) => l.secoes);
    const fiscaisNec = sum(L, (l) => l.fiscaisNecessarios);
    const fiscaisOk = sum(L, (l) => l.fiscaisConfirmados);
    const ocorr = L.flatMap((l) => l.ocorrencias.map((o) => Object.assign({}, o, { local: l })));

    const novoLocal = () => formModal('Novo local de votação', [
      { k: 'nome', rot: 'Nome do local', tipo: 'texto', obrigatorio: true, dica: 'Ex.: E.M. Professor Antônio Silva' },
      { k: 'territorioId', rot: 'Bairro', tipo: 'select', largura: 'meia', opcoes: D.bairros.map((b) => ({ v: b.id, t: b.nome })) },
      { k: 'plantao', rot: 'Plantão', tipo: 'select', largura: 'meia', opcoes: ['manhã', 'tarde', 'dia inteiro'] },
      { k: 'secoes', rot: 'Número de seções', tipo: 'numero', largura: 'meia', obrigatorio: true },
      { k: 'eleitores', rot: 'Eleitores no local', tipo: 'numero', largura: 'meia' },
      { k: 'coordenadorId', rot: 'Coordenador(a) do local', tipo: 'select', opcoes: D.equipe.map((e) => ({ v: e.pessoaId, t: D.nome(e.pessoaId) })) },
    ], (v) => { D.addLocalVotacao(v); toast('Local de votação cadastrado.'); }, { acao: 'Cadastrar local' });

    alvo.appendChild(cabecalho('Dia da eleição', (D.DIA_ELEICAO ? 'Operação do município em ' + fmtDate(D.DIA_ELEICAO) : 'Data da eleição não configurada') + ' · ' + L.length + ' locais de votação e ' + totalSecoes + ' seções', [
      el('button', { class: 'btn pequeno primario', html: icHTML('plus', 14) + ' Novo local de votação', onclick: novoLocal }),
      L.length ? el('button', { class: 'btn pequeno', html: icHTML('clipboard-list', 14) + ' Escala de plantões', onclick: () => {
        const porTurno = global.U.by(L, 'plantao');
        global.U.modal('Escala de plantões', el('div', {}, Array.from(porTurno.keys()).map((t) => el('div', { style: { marginBottom: '14px' } }, [
          el('h3', { text: 'Plantão ' + t, style: { fontSize: '14px', marginBottom: '6px' } }),
          el('p', { class: 'subtexto', text: porTurno.get(t).length + ' locais · ' + sum(porTurno.get(t), (l) => l.secoes) + ' seções · ' + sum(porTurno.get(t), (l) => l.fiscaisConfirmados) + ' fiscais confirmados' }),
          el('div', { class: 'lista' }, porTurno.get(t).map((l) => listaItem({
            icone: 'vote', titulo: l.nome, sub: D.nomeTerr(l.territorioId) + ' · coord. ' + D.nome(l.coordenadorId),
            valor: l.fiscaisConfirmados + '/' + l.fiscaisNecessarios, nota: 'fiscais',
          }))),
        ]))), { wide: true });
      } }) : null,
      L.length ? el('button', { class: 'btn pequeno primario', html: icHTML('triangle-alert', 14) + ' Registrar ocorrência', onclick: () => formModal('Registrar ocorrência', [
        { k: 'localId', rot: 'Local de votação', tipo: 'select', obrigatorio: true, opcoes: L.map((l) => ({ v: l.id, t: l.nome + ' — ' + D.nomeTerr(l.territorioId) })) },
        { k: 'texto', rot: 'O que está acontecendo', tipo: 'textarea', linhas: 2, obrigatorio: true },
        { k: 'gravidade', rot: 'Gravidade', tipo: 'select', largura: 'meia', opcoes: ['baixa', 'média', 'alta'], valor: 'média' },
        { k: 'hora', rot: 'Hora', tipo: 'hora', largura: 'meia' },
      ], (v) => { D.addOcorrencia(v.localId, v); toast('Ocorrência registrada e visível para a coordenação.'); }, { acao: 'Registrar' }) }) : null,
    ]));

    if (!L.length) {
      alvo.appendChild(global.UI.vazio({
        icone: 'vote', titulo: 'Nenhum local de votação cadastrado',
        texto: 'Cadastre os locais de votação do município para organizar fiscais, plantões e transporte no dia da eleição.',
        acao: { rotulo: 'Cadastrar primeiro local', onclick: () => novoLocal() },
      }));
      return;
    }

    alvo.appendChild(el('div', { class: 'grade g5', style: { marginBottom: '16px' } }, [
      kpi({ rotulo: 'Locais de votação', icone: 'vote', valor: num(L.length), nota: totalSecoes + ' seções no município' }),
      kpi({ rotulo: 'Fiscais confirmados', icone: 'scale', valor: fiscaisOk + '/' + fiscaisNec, cor: 'var(--accent-2)', nota: pct(fiscaisOk, fiscaisNec) + '% de cobertura das seções' }),
      kpi({ rotulo: 'Locais críticos', icone: 'triangle-alert', valor: L.filter((l) => l.fiscaisConfirmados / l.fiscaisNecessarios < 0.6).length, cor: 'var(--danger)', nota: 'menos de 60% das seções cobertas' }),
      kpi({ rotulo: 'Transporte previsto', icone: 'truck', valor: L.filter((l) => l.transporte).length, cor: 'var(--warn)', nota: 'locais com apoio de deslocamento' }),
      kpi({ rotulo: 'Ocorrências', icone: 'megaphone', valor: ocorr.length, cor: 'var(--rose)', nota: ocorr.filter((o) => o.status !== 'resolvida').length + ' ainda em aberto' }),
    ]));

    const covBox = el('div', {}, ['021', '034', '057'].map((z) => {
      const ls = L.filter((l) => l.zona === z);
      const nec = sum(ls, (l) => l.fiscaisNecessarios), conf = sum(ls, (l) => l.fiscaisConfirmados);
      if (!nec) return null;
      return global.UI.indicador('Zona ' + z, (conf / nec) * 100, conf + ' de ' + nec + ' seções cobertas · ' + ls.length + ' locais',
        conf / nec >= 0.8 ? 'var(--accent)' : conf / nec >= 0.6 ? 'var(--warn)' : 'var(--danger)');
    }).filter(Boolean));

    const ocorrBox = el('div', { class: 'lista rolagem', style: { '--h': '260px' } }, sortBy(ocorr, (o) => o.hora).map((o) => listaItem({
      icone: o.gravidade === 'alta' ? 'circle-alert' : o.gravidade === 'média' ? 'circle-alert' : 'circle-alert',
      titulo: o.texto, sub: o.hora + ' · ' + o.local.nome + ' · ' + D.nomeTerr(o.local.territorioId), tag: tag(o.status),
    })));

    alvo.appendChild(el('div', { class: 'grade g2', style: { marginBottom: '16px' } }, [
      cartao('Cobertura de fiscais por zona', 'Necessário × confirmado', [covBox]),
      cartao('Ocorrências do dia', ocorr.length + ' registros da operação', [ocorr.length ? ocorrBox : el('div', { class: 'vazio', text: 'Nenhuma ocorrência registrada.' })]),
    ]));

    const tab = tabela({
      linhas: L, ordPadrao: 'eleitores', tam: 20,
      colunas: [
        { k: 'nome', rotulo: 'Local de votação', render: (l) => el('div', {}, [el('b', { text: l.nome, style: { fontSize: '13px' } }), el('small', { text: D.nomeTerr(l.territorioId) + ' · zona ' + l.zona, style: { display: 'block', color: 'var(--txt-3)', fontSize: '11px' } })]) },
        { k: 'secoes', rotulo: 'Seções', num: true },
        { k: 'eleitores', rotulo: 'Eleitores', num: true, render: (l) => num(l.eleitores) },
        { k: 'cobertura', rotulo: 'Fiscais', num: true, valor: (l) => l.fiscaisConfirmados / l.fiscaisNecessarios,
          render: (l) => el('div', { style: { minWidth: '130px' } }, [el('small', { text: l.fiscaisConfirmados + ' de ' + l.fiscaisNecessarios }), barra(l.fiscaisConfirmados, l.fiscaisNecessarios)]) },
        { k: 'coordenador', rotulo: 'Coordenação', valor: (l) => D.nome(l.coordenadorId), render: (l) => pessoaCell(l.coordenadorId, 'responsável pelo local') },
        { k: 'plantao', rotulo: 'Plantão', render: (l) => tag(l.plantao, 'azul') },
        { k: 'transporte', rotulo: 'Transporte', render: (l) => l.transporte ? tag('previsto', 'verde') : tag('não previsto', 'cinza') },
        { k: 'ocorrencias', rotulo: 'Ocorrências', num: true, valor: (l) => l.ocorrencias.length, render: (l) => l.ocorrencias.length ? el('span', { class: 'tag laranja ponto', text: l.ocorrencias.length }) : '—' },
      ],
    });
    alvo.appendChild(filtros([
      { k: 'busca', tipo: 'busca', placeholder: 'Buscar local de votação…' },
      { k: 'zona', tipo: 'chips', rotulo: 'Todas as zonas', opcoes: ['021', '034', '057'].map((z) => ({ v: z, t: 'Zona ' + z, n: L.filter((l) => l.zona === z).length })) },
    ], (e) => {
      let l = L;
      if (e.busca) { const q = global.U.norm(e.busca); l = l.filter((x) => global.U.norm(x.nome).includes(q) || global.U.norm(D.nomeTerr(x.territorioId)).includes(q)); }
      if (e.zona !== 'todos') l = l.filter((x) => x.zona === e.zona);
      return tab.atualizar(l);
    }));
    alvo.appendChild(tab);
  };
})(window);

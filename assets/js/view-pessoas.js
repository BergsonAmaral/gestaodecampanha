/* ==========================================================================
   view-pessoas.js — Cadastro geral, ficha da pessoa, lideranças e mobilização
   ========================================================================== */
(function (global) {
  'use strict';
  const { el, esc, num, dec, fmtDate, fmtDateShort, relDays, sortBy, norm, initials, toast, modal } = global.U;
  const { cabecalho, cartao, kpi, tag, pessoaCell, avatarPessoa, barra, tabela, filtros, abas, listaItem, dado, legenda, estrelas, voltar, formModal, exportarCSV } = global.UI;

  /* ==========================  LISTA DE PESSOAS  ========================== */
  global.VIEWS['pessoas'] = function (alvo, param, params) {
    const D = global.DB;
    if (param) return ficha(alvo, param);

    alvo.appendChild(cabecalho('Cadastro geral de pessoas', num(D.pessoas.length) + ' pessoas relacionadas à campanha · o cadastro funciona como prontuário de relacionamento', [
      el('button', { class: 'btn pequeno', html: icHTML('download', 14) + ' Exportar', onclick: () => exportarCSV('pessoas-campanha.csv', [
        { rotulo: 'Nome', valor: (p) => p.nome }, { rotulo: 'Telefone', valor: (p) => p.telefone },
        { rotulo: 'Classificação', valor: (p) => D.CLASSIF_LABEL[p.classificacao] },
        { rotulo: 'Bairro', valor: (p) => D.terr(p.bairroId).nome }, { rotulo: 'Localidade', valor: (p) => p.localidade },
        { rotulo: 'Zona', valor: (p) => p.zona }, { rotulo: 'Seção', valor: (p) => p.secao },
        { rotulo: 'Origem', valor: (p) => p.origem }, { rotulo: 'Indicado por', valor: (p) => (p.indicadoPor ? D.nome(p.indicadoPor) : '') },
        { rotulo: 'Cadastrado por', valor: (p) => D.nome(p.cadastradoPor) }, { rotulo: 'Data do cadastro', valor: (p) => fmtDate(p.dataCadastro) },
      ], D.pessoas) }),
      el('button', { class: 'btn pequeno primario', html: icHTML('plus', 14) + ' Nova pessoa', onclick: () => global.registroRapido() }),
    ]));

    const contagem = global.U.countBy(D.pessoas, 'classificacao');
    const cx = el('div');
    const tab = tabela({
      linhas: D.pessoas, ordPadrao: 'dataCadastro', dirPadrao: 'desc', tam: 20,
      onRow: (p) => (location.hash = '#/pessoas/' + p.id),
      colunas: [
        { k: 'nome', rotulo: 'Pessoa', render: (p) => pessoaCell(p.id, D.funcaoDe(p.id) || (p.tipos.slice(0, 3).join(', ')) ) },
        { k: 'classificacao', rotulo: 'Classificação', render: (p) => tag(D.CLASSIF_LABEL[p.classificacao], p.classificacao === 'lideranca' ? 'vermelho' : p.classificacao === 'mobilizador' ? 'laranja' : p.classificacao === 'apoiador' ? 'verde' : p.classificacao === 'participante' ? 'roxo' : p.classificacao === 'simpatizante' ? 'azul' : 'cinza') },
        { k: 'bairro', rotulo: 'Território', valor: (p) => D.terr(p.bairroId).nome, render: (p) => el('div', {}, [el('div', { text: D.terr(p.bairroId).nome, style: { fontSize: '12.5px' } }), el('small', { text: p.localidade + ' · zona ' + p.zona + ' · seção ' + p.secao, style: { color: 'var(--txt-3)', fontSize: '11px' } })]) },
        { k: 'origem', rotulo: 'Origem', render: (p) => el('div', {}, [el('div', { text: p.origem, style: { fontSize: '12.5px' } }), p.indicadoPor ? el('small', { text: 'por ' + D.nome(p.indicadoPor), style: { color: 'var(--txt-3)', fontSize: '11px' } }) : null]) },
        { k: 'interacoes', rotulo: 'Interações', num: true, valor: (p) => (D.interPorPessoa.get(p.id) || []).length, render: (p) => el('span', { class: 'badge-num', text: (D.interPorPessoa.get(p.id) || []).length }) },
        { k: 'indicados', rotulo: 'Indicou', num: true, valor: (p) => (D.indicadosPor.get(p.id) || []).length, render: (p) => num((D.indicadosPor.get(p.id) || []).length) },
        { k: 'dataCadastro', rotulo: 'Cadastro', render: (p) => el('div', {}, [el('div', { text: fmtDate(p.dataCadastro), style: { fontSize: '12.5px' } }), el('small', { text: relDays(p.dataCadastro), style: { color: 'var(--txt-3)', fontSize: '11px' } })]) },
      ],
    });

    const aplicar = (e) => {
      let l = D.pessoas;
      if (e.busca) { const q = norm(e.busca); l = l.filter((p) => norm(p.nome).includes(q) || p.telefone.includes(e.busca)); }
      if (e.classificacao !== 'todos') l = l.filter((p) => p.classificacao === e.classificacao);
      if (e.bairro !== 'todos') l = l.filter((p) => p.bairroId === e.bairro);
      if (e.origem !== 'todos') l = l.filter((p) => p.origem === e.origem);
      if (e.periodo !== 'todos') l = l.filter((p) => global.U.daysBetween(p.dataCadastro, D.HOJE) <= +e.periodo);
      return tab.atualizar(l);
    };
    const f = filtros([
      { k: 'busca', tipo: 'busca', placeholder: 'Buscar por nome ou telefone…' },
      { k: 'bairro', tipo: 'select', rotulo: 'Todos os bairros', opcoes: D.bairros.map((b) => ({ v: b.id, t: b.nome })) },
      { k: 'origem', tipo: 'select', rotulo: 'Todas as origens', opcoes: D.ORIGENS },
      { k: 'periodo', tipo: 'select', rotulo: 'Todo o período', opcoes: [{ v: '7', t: 'Últimos 7 dias' }, { v: '30', t: 'Últimos 30 dias' }, { v: '90', t: 'Últimos 90 dias' }] },
      { k: 'classificacao', tipo: 'chips', rotulo: 'Todas (' + num(D.pessoas.length) + ')', padrao: params.get('classificacao') || 'todos',
        opcoes: D.CLASSIF.map((c) => ({ v: c, t: D.CLASSIF_LABEL[c], n: contagem.get(c) || 0 })) },
    ], aplicar);
    alvo.appendChild(f);
    alvo.appendChild(cx);
    cx.appendChild(tab);
    if (params.get('classificacao')) aplicar(f.estado);
  };

  /* ==========================  FICHA DA PESSOA  ========================== */
  function ficha(alvo, id) {
    const D = global.DB, p = D.P(id);
    if (!p) return alvo.appendChild(cartao('Pessoa não encontrada', null, el('p', { class: 'subtexto', text: 'O registro solicitado não existe nesta base.' })));
    const b = D.terr(p.bairroId);
    const hist = D.historicoPessoa(id);
    const indicados = D.indicadosPor.get(id) || [];
    const cadastrados = D.cadastradosPor.get(id) || [];
    const lider = D.liderancas.find((l) => l.pessoaId === id);
    const dem = D.demandasPorPessoa.get(id) || [];
    const evs = (D.interPorPessoa.get(id) || []).filter((i) => i.eventoId).map((i) => D.eventos.find((e) => e.id === i.eventoId)).filter(Boolean);

    alvo.appendChild(el('div', { class: 'filtros' }, [voltar('#/pessoas', 'cadastro geral')]));
    alvo.appendChild(el('div', { class: 'cartao destaque', style: { marginBottom: '16px' } }, [
      el('div', { style: { display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' } }, [
        avatarPessoa(id, 'grande'),
        el('div', { style: { flex: 1, minWidth: '220px' } }, [
          el('h1', { text: p.nome, style: { fontSize: '21px', letterSpacing: '-.5px' } }),
          el('div', { class: 'filtros', style: { marginTop: '7px', marginBottom: 0 } }, [
            tag(D.CLASSIF_LABEL[p.classificacao], p.classificacao === 'lideranca' ? 'vermelho' : p.classificacao === 'mobilizador' ? 'laranja' : 'verde'),
            D.funcaoDe(id) ? tag(D.funcaoDe(id), 'roxo') : null,
            tag(b.nome, 'azul'),
            el('span', { class: 'tag', text: 'zona ' + p.zona + ' · seção ' + p.secao }),
          ]),
        ]),
        el('div', { class: 'filtros', style: { marginBottom: 0 } }, [
          el('button', { class: 'btn pequeno', html: icHTML('phone', 14) + ' Registrar contato', onclick: () => registrarInteracao(p) }),
          el('button', { class: 'btn pequeno', html: icHTML('inbox', 14) + ' Nova demanda', onclick: () => novaDemanda(p) }),
          el('button', { class: 'btn pequeno primario', html: icHTML('star', 14) + ' Promover estágio', onclick: () => promover(p) }),
          el('button', { class: 'icon-btn', html: icHTML('pencil', 15), title: 'Editar dados cadastrais', onclick: () => editarDados(p) }),
        ]),
      ]),
    ]));

    /* KPIs da pessoa */
    alvo.appendChild(el('div', { class: 'grade g4', style: { marginBottom: '16px' } }, [
      kpi({ rotulo: 'Interações registradas', icone: 'message-square', valor: num((D.interPorPessoa.get(id) || []).length), nota: 'último em ' + (hist[0] ? fmtDate(hist[0].data) : '—') }),
      kpi({ rotulo: 'Pessoas que indicou', icone: 'link-2', valor: num(indicados.length), cor: 'var(--accent-2)', nota: indicados.filter((x) => D.isApoiador(x)).length + ' viraram apoiadores' }),
      kpi({ rotulo: 'Pessoas que cadastrou', icone: 'pencil', valor: num(cadastrados.length), cor: 'var(--warn)', nota: cadastrados.length ? dec((cadastrados.filter((x) => D.isApoiador(x)).length / cadastrados.length) * 100) + '% de conversão' : 'sem cadastros' }),
      kpi({ rotulo: 'Demandas apresentadas', icone: 'inbox', valor: num(dem.length), cor: 'var(--rose)', nota: dem.filter((d) => d.status === 'atendida').length + ' atendidas' }),
    ]));

    /* dados + histórico */
    const dados = cartao('Dados cadastrais', 'Identificação e contato', [
      dado('Telefone', p.telefone),
      dado('E-mail', p.email || 'não informado'),
      dado('Nascimento', fmtDate(p.nascimento) + ' (' + Math.floor(global.U.daysBetween(p.nascimento, D.HOJE) / 365) + ' anos)'),
      dado('Gênero', p.genero === 'F' ? 'Feminino' : 'Masculino'),
      el('div', { class: 'divisor' }),
      dado('Município', D.municipio.nome),
      dado('Região', D.terr(b.paiId).nome),
      dado('Bairro', b.nome),
      dado('Localidade', p.localidade),
      dado('Zona / seção', p.zona + ' / ' + p.secao),
      el('div', { class: 'divisor' }),
      dado('Cadastrado em', fmtDate(p.dataCadastro) + ' (' + relDays(p.dataCadastro) + ')'),
      dado('Cadastrado por', D.nome(p.cadastradoPor)),
      dado('Responsável', D.nome(p.responsavelId)),
      dado('Origem', p.origem),
      dado('Indicado por', p.indicadoPor ? D.nome(p.indicadoPor) : 'sem indicação'),
      el('div', { class: 'divisor' }),
      el('div', { class: 'filtros', style: { marginBottom: 0 } }, p.tipos.map((t) => el('span', { class: 'tag', text: t }))),
    ]);

    const tl = el('div', { class: 'timeline rolagem', style: { '--h': '520px' } });
    hist.forEach((h) => {
      tl.appendChild(el('div', { class: 'tl-item' }, [
        el('span', { class: 'tl-icone' }, global.ic(h.icone, 14)),
        el('div', { class: 'tl-data', text: fmtDate(h.data) + ' · ' + h.tipo }),
        el('div', { class: 'tl-texto', text: h.texto }),
        el('div', { class: 'tl-meta' }, [
          h.canal ? el('span', {}, [global.ic('radio-tower', 12), el('span', { text: h.canal })]) : null,
          h.responsavelId ? el('span', {}, [global.ic('user-round', 12), el('span', { text: D.nome(h.responsavelId) })]) : null,
        ]),
      ]));
    });
    const historico = cartao('Histórico de relacionamento', hist.length + ' registros — tudo que já ocorreu entre esta pessoa e a campanha', [tl],
      [el('button', { class: 'btn pequeno', html: icHTML('plus', 14) + ' registrar', onclick: () => registrarInteracao(p) })]);

    alvo.appendChild(el('div', { class: 'grade g-1-2', style: { marginBottom: '16px' } }, [dados, historico]));

    /* liderança + rede + eventos */
    const cards = [];
    if (lider) {
      cards.push(cartao('Perfil de liderança', lider.segmento + ' · ' + lider.atuacao, [
        el('div', { class: 'filtros' }, [tag(lider.situacao), estrelas(lider.capacidade)]),
        dado('Alcance estimado', num(lider.alcanceEstimado) + ' pessoas'),
        dado('Reuniões realizadas', num(lider.reunioes)),
        dado('Responsável na campanha', D.nome(lider.responsavelId)),
        dado('Territórios de atuação', lider.territorios.map((t) => D.terr(t).nome).join(', ')),
        el('div', { class: 'divisor' }),
        el('div', { class: 'subtexto', text: 'Compromissos assumidos' }),
        el('div', { class: 'lista' }, lider.compromissos.length ? lider.compromissos.map((c) => listaItem({ icone: 'handshake', titulo: c })) : [el('div', { class: 'vazio', text: 'Nenhum compromisso registrado até o momento.' })]),
      ]));
    }
    if (indicados.length) {
      const redeBox = el('div');
      global.CH.rede(redeBox, {
        raiz: { label: initials(p.nome) },
        filhos: indicados.slice(0, 12).map((x) => ({ label: x.nome, valor: (D.indicadosPor.get(x.id) || []).length, filhos: (D.indicadosPor.get(x.id) || []).slice(0, 5).map((y) => ({ label: y.nome })), id: x.id })),
        onClick: (f) => (location.hash = '#/pessoas/' + f.id),
      });
      cards.push(cartao('Rede de indicações', 'Quem esta pessoa trouxe para a campanha', [redeBox]));
    }
    cards.push(cartao('Participação em atividades', evs.length + ' eventos registrados', [
      el('div', { class: 'lista rolagem', style: { '--h': '260px' } }, evs.length ? evs.map((e) => listaItem({
        icone: 'megaphone', titulo: e.nome, sub: fmtDate(e.data) + ' · ' + e.local, onclick: () => (location.hash = '#/eventos/' + e.id),
      })) : [el('div', { class: 'vazio', text: 'Sem participação registrada em eventos.' })]),
      dem.length ? el('div', { class: 'divisor' }) : null,
      dem.length ? el('div', { class: 'subtexto', text: 'Demandas apresentadas' }) : null,
      dem.length ? el('div', { class: 'lista' }, dem.map((d) => listaItem({ icone: 'inbox', titulo: d.descricao, sub: fmtDate(d.data) + ' · ' + D.nome(d.responsavelId), tag: tag(d.status) }))) : null,
    ]));
    alvo.appendChild(el('div', { class: 'grade ' + (cards.length === 3 ? 'g3' : 'g2') }, cards));
  }

  function editarDados(p) {
    if (!global.UI.exigeEscrita()) return;
    const D = global.DB;
    formModal('Editar dados de ' + p.nome, [
      { k: 'nome', rot: 'Nome completo', tipo: 'texto', obrigatorio: true, valor: p.nome },
      { k: 'telefone', rot: 'Telefone', tipo: 'texto', largura: 'meia', valor: p.telefone },
      { k: 'email', rot: 'E-mail', tipo: 'texto', largura: 'meia', valor: p.email },
      { k: 'bairroId', rot: 'Bairro', tipo: 'select', largura: 'meia', valor: p.bairroId, opcoes: D.bairros.map((b) => ({ v: b.id, t: b.nome })) },
      { k: 'localidade', rot: 'Localidade', tipo: 'texto', largura: 'meia', valor: p.localidade },
      { k: 'secao', rot: 'Seção eleitoral', tipo: 'texto', largura: 'meia', valor: p.secao },
      { k: 'obs', rot: 'Observação', tipo: 'texto', largura: 'meia', valor: p.obs },
    ], (v) => {
      D.editarPessoa(p.id, v);
      toast('Dados de ' + p.nome.split(' ')[0] + ' atualizados.');
    }, { acao: 'Salvar alterações', wide: true });
  }

  function registrarInteracao(p) {
    if (!global.UI.exigeEscrita()) return;
    const D = global.DB;
    const selTipo = el('select', {}, D.TIPO_INTER.map((t) => el('option', { value: t, text: t })));
    const selCanal = el('select', {}, ['WhatsApp', 'Telefone', 'Presencial', 'E-mail', 'Visita'].map((t) => el('option', { value: t, text: t })));
    const txtResumo = el('textarea', { rows: 3, placeholder: 'Ex.: ligação realizada em ' + fmtDate(D.HOJE) + '. Confirmou presença na reunião do bairro.' });
    const inpEnc = el('input', { type: 'text', placeholder: 'Ex.: coordenação de logística deve confirmar transporte até sexta.' });
    const form = el('div', {}, [
      el('div', { class: 'campo-linha' }, [
        el('div', { class: 'campo' }, [el('label', { text: 'Tipo de interação' }), selTipo]),
        el('div', { class: 'campo' }, [el('label', { text: 'Canal' }), selCanal]),
      ]),
      el('div', { class: 'campo' }, [el('label', { text: 'O que aconteceu *' }), txtResumo]),
      el('div', { class: 'campo' }, [el('label', { text: 'Encaminhamento / retorno devido' }), inpEnc]),
    ]);
    const m = modal('Registrar contato com ' + p.nome, form, {
      footer: [el('button', { class: 'btn', text: 'Cancelar', onclick: () => m.close() }),
               el('button', { class: 'btn primario', text: 'Salvar no histórico', onclick: () => {
                 const txt = txtResumo.value.trim();
                 if (txt.length < 4) { txtResumo.focus(); return toast('Descreva o que aconteceu no contato.', 'erro'); }
                 D.addInteracao(p.id, { tipo: selTipo.value, canal: selCanal.value, resumo: txt, responsavelId: D.coordGeral.id, retorno: !inpEnc.value.trim() });
                 if (inpEnc.value.trim()) D.addInteracao(p.id, { tipo: 'Encaminhamento', canal: selCanal.value, resumo: inpEnc.value.trim(), responsavelId: D.coordGeral.id });
                 m.close();
                 toast('Interação registrada no histórico de ' + p.nome.split(' ')[0] + '.');
                 global.refresh();
               } })],
    });
    setTimeout(() => txtResumo.focus(), 60);
  }

  function promover(p) {
    if (!global.UI.exigeEscrita()) return;
    const D = global.DB;
    const i = D.CLASSIF.indexOf(p.classificacao);
    const opcoes = D.CLASSIF.filter((c, k) => k !== i);
    const sel = el('select', {}, opcoes.map((c) => el('option', { value: c, text: D.CLASSIF_LABEL[c], selected: c === D.CLASSIF[Math.min(i + 1, D.CLASSIF.length - 1)] })));
    const obs = el('textarea', { rows: 2, placeholder: 'Ex.: passou a organizar as reuniões da rua e trouxe seis vizinhos.' });
    const form = el('div', {}, [
      el('p', { class: 'subtexto', text: 'Situação atual: ' + D.CLASSIF_LABEL[p.classificacao] + '. A mudança fica registrada no histórico com a data de hoje.' }),
      el('div', { class: 'campo', style: { marginTop: '12px' } }, [el('label', { text: 'Nova classificação' }), sel]),
      el('div', { class: 'campo' }, [el('label', { text: 'Motivo (opcional)' }), obs]),
    ]);
    const m = modal('Alterar estágio de ' + p.nome, form, {
      footer: [el('button', { class: 'btn', text: 'Cancelar', onclick: () => m.close() }),
               el('button', { class: 'btn primario', text: 'Confirmar', onclick: () => {
                 D.setClassificacao(p.id, sel.value);
                 if (obs.value.trim()) D.addInteracao(p.id, { tipo: 'Encaminhamento', canal: 'Presencial', resumo: obs.value.trim(), responsavelId: D.coordGeral.id });
                 m.close();
                 toast(p.nome.split(' ')[0] + ' agora é ' + D.CLASSIF_LABEL[sel.value] + '.');
                 global.refresh();
               } })],
    });
  }

  function novaDemanda(p) {
    if (!global.UI.exigeEscrita()) return;
    const D = global.DB;
    const desc = el('textarea', { rows: 2, placeholder: 'Ex.: solicita reunião com o candidato para a associação de moradores.' });
    const selArea = el('select', {}, D.AREAS.map((a) => el('option', { value: a, text: a })));
    const selPri = el('select', {}, D.PRIORIDADES.map((x) => el('option', { value: x, text: x, selected: x === 'média' })));
    const form = el('div', {}, [
      el('p', { class: 'subtexto', text: 'Solicitante: ' + p.nome + ' · ' + D.terr(p.bairroId).nome }),
      el('div', { class: 'campo', style: { marginTop: '12px' } }, [el('label', { text: 'O que está sendo pedido *' }), desc]),
      el('div', { class: 'campo-linha' }, [
        el('div', { class: 'campo' }, [el('label', { text: 'Área responsável' }), selArea]),
        el('div', { class: 'campo' }, [el('label', { text: 'Prioridade' }), selPri]),
      ]),
    ]);
    const m = modal('Nova demanda', form, {
      footer: [el('button', { class: 'btn', text: 'Cancelar', onclick: () => m.close() }),
               el('button', { class: 'btn primario', text: 'Registrar demanda', onclick: () => {
                 if (desc.value.trim().length < 5) { desc.focus(); return toast('Descreva a demanda.', 'erro'); }
                 D.addDemanda({ solicitanteId: p.id, descricao: desc.value.trim(), area: selArea.value, prioridade: selPri.value });
                 m.close();
                 toast('Demanda registrada e vinculada a ' + p.nome.split(' ')[0] + '.');
                 global.refresh();
               } })],
    });
    setTimeout(() => desc.focus(), 60);
  }

  /* ==========================  LIDERANÇAS  ========================== */
  global.VIEWS['liderancas'] = function (alvo, param) {
    const D = global.DB;
    if (param) return ficha(alvo, param);
    const L = D.liderancas.map((l) => Object.assign({}, l, { p: D.P(l.pessoaId) }));

    alvo.appendChild(cabecalho('Lideranças', L.length + ' lideranças mapeadas — o objetivo não é ter uma lista, é acompanhar o relacionamento', [
      el('button', { class: 'btn pequeno', html: icHTML('map', 14) + ' Ver no mapa', onclick: () => (location.hash = '#/territorio?modo=liderancas') }),
      el('button', { class: 'btn pequeno primario', html: icHTML('plus', 14) + ' Nova liderança', onclick: () => formModal('Mapear nova liderança', [
        { k: 'pessoa', rot: 'Pessoa', tipo: 'pessoa', obrigatorio: true, dica: 'Digite o nome de quem já está na base' },
        { k: 'segmento', rot: 'Segmento de influência', tipo: 'select', largura: 'meia', opcoes: D.SEGMENTOS },
        { k: 'capacidade', rot: 'Capacidade percebida (1 a 5)', tipo: 'numero', largura: 'meia', valor: 3 },
        { k: 'atuacao', rot: 'Onde atua', tipo: 'texto', dica: 'Ex.: associação de moradores, igreja, sindicato' },
        { k: 'responsavelId', rot: 'Responsável pelo relacionamento', tipo: 'select', opcoes: D.equipe.map((e) => ({ v: e.pessoaId, t: D.nome(e.pessoaId) })) },
      ], (v) => {
        const p = D.pessoas.find((x) => norm(x.nome) === norm(v.pessoa));
        if (!p) return 'Não encontrei "' + v.pessoa + '" na base. Cadastre a pessoa primeiro pelo botão Registrar.';
        if (!D.addLideranca(p.id, { segmento: v.segmento, capacidade: Math.max(1, Math.min(5, +v.capacidade || 3)), atuacao: v.atuacao, responsavelId: v.responsavelId }))
          return p.nome + ' já está mapeado(a) como liderança.';
        toast(p.nome.split(' ')[0] + ' agora consta como liderança ' + v.segmento.toLowerCase() + '.');
      }, { acao: 'Mapear liderança', nota: 'A liderança é sempre uma pessoa que já está no cadastro geral — o vínculo preserva todo o histórico dela.' }) }),
    ]));

    const porSit = global.U.countBy(L, 'situacao');
    alvo.appendChild(el('div', { class: 'grade g4', style: { marginBottom: '16px' } }, [
      kpi({ rotulo: 'Lideranças mapeadas', icone: 'star', valor: num(L.length), nota: D.SEGMENTOS.length + ' segmentos representados' }),
      kpi({ rotulo: 'Compromissos firmados', icone: 'handshake', valor: num(porSit.get('compromisso firmado') || 0), cor: 'var(--accent-2)', nota: (porSit.get('relacionamento') || 0) + ' em relacionamento' }),
      kpi({ rotulo: 'Alcance estimado', icone: 'megaphone', valor: num(global.U.sum(L, (l) => l.alcanceEstimado)), cor: 'var(--warn)', nota: 'soma da capacidade percebida de mobilização' }),
      kpi({ rotulo: 'Atenção', icone: 'triangle-alert', valor: num((porSit.get('em disputa') || 0) + (porSit.get('afastada') || 0)), cor: 'var(--danger)', nota: 'em disputa ou afastadas' }),
    ]));

    alvo.appendChild(el('p', { class: 'subtexto', style: { marginBottom: '14px' } },
      [global.U.el('span', { text: 'Distribuição por segmento e situação do relacionamento está no ' }),
       global.U.el('a', { text: 'relatório de lideranças', style: { color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }, onclick: () => (location.hash = '#/relatorios?tipo=liderancas') }),
       global.U.el('span', { text: '.' })]));

    const tab = tabela({
      linhas: L, ordPadrao: 'alcanceEstimado', tam: 15,
      onRow: (l) => (location.hash = '#/pessoas/' + l.pessoaId),
      colunas: [
        { k: 'nome', rotulo: 'Liderança', valor: (l) => l.p.nome, render: (l) => pessoaCell(l.pessoaId, l.atuacao) },
        { k: 'segmento', rotulo: 'Segmento', render: (l) => tag(l.segmento, 'roxo') },
        { k: 'territorio', rotulo: 'Territórios', valor: (l) => D.terr(l.territorios[0]).nome, render: (l) => l.territorios.map((t) => D.terr(t).nome).join(', ') },
        { k: 'capacidade', rotulo: 'Capacidade', num: true, render: (l) => estrelas(l.capacidade) },
        { k: 'alcanceEstimado', rotulo: 'Alcance', num: true, render: (l) => num(l.alcanceEstimado) },
        { k: 'reunioes', rotulo: 'Reuniões', num: true },
        { k: 'situacao', rotulo: 'Situação', render: (l) => tag(l.situacao) },
        { k: 'responsavel', rotulo: 'Responsável', valor: (l) => D.nome(l.responsavelId), render: (l) => el('small', { text: D.nome(l.responsavelId), style: { color: 'var(--txt-2)' } }) },
      ],
    });
    alvo.appendChild(filtros([
      { k: 'busca', tipo: 'busca', placeholder: 'Buscar liderança…' },
      { k: 'segmento', tipo: 'select', rotulo: 'Todos os segmentos', opcoes: D.SEGMENTOS },
      { k: 'bairro', tipo: 'select', rotulo: 'Todos os territórios', opcoes: D.bairros.map((b) => ({ v: b.id, t: b.nome })) },
      { k: 'situacao', tipo: 'chips', rotulo: 'Todas', opcoes: ['aproximação', 'relacionamento', 'compromisso firmado', 'em disputa', 'afastada'].map((s) => ({ v: s, t: s, n: porSit.get(s) || 0 })) },
    ], (e) => {
      let l = L;
      if (e.busca) { const q = norm(e.busca); l = l.filter((x) => norm(x.p.nome).includes(q)); }
      if (e.segmento !== 'todos') l = l.filter((x) => x.segmento === e.segmento);
      if (e.bairro !== 'todos') l = l.filter((x) => x.territorios.includes(e.bairro));
      if (e.situacao !== 'todos') l = l.filter((x) => x.situacao === e.situacao);
      return tab.atualizar(l);
    }));
    alvo.appendChild(tab);
  };

  /* ==========================  MOBILIZAÇÃO  ========================== */
  global.VIEWS['mobilizacao'] = function (alvo) {
    const D = global.DB, s = D.stats();
    alvo.appendChild(cabecalho('Mobilização', 'Como a base está sendo formada e movimentada — e quem está contribuindo para esse crescimento'));

    const serie = D.serieCrescimento(45);
    const novos = (dias, filtro) => D.pessoas.filter((p) => global.U.daysBetween(p.dataCadastro, D.HOJE) <= dias && (!filtro || filtro(p))).length;
    alvo.appendChild(el('div', { class: 'grade g5', style: { marginBottom: '16px' } }, [
      kpi({ rotulo: 'Novos contatos (7d)', icone: 'sparkles', valor: num(novos(7)), delta: s.variacao7, serie: serie.slice(-14).map((d) => d.novos) }),
      kpi({ rotulo: 'Novos simpatizantes', icone: 'heart-handshake', valor: num(novos(7, (p) => p.classificacao === 'simpatizante')), cor: 'var(--accent-2)', nota: 'nos últimos 7 dias' }),
      kpi({ rotulo: 'Novos apoiadores', icone: 'handshake', valor: num(novos(7, (p) => D.isApoiador(p))), cor: 'var(--accent)', nota: 'nos últimos 7 dias' }),
      kpi({ rotulo: 'Novos mobilizadores', icone: 'megaphone', valor: num(novos(30, (p) => p.classificacao === 'mobilizador')), cor: 'var(--warn)', nota: 'nos últimos 30 dias' }),
      kpi({ rotulo: 'Novas lideranças', icone: 'star', valor: num(novos(30, (p) => p.classificacao === 'lideranca')), cor: 'var(--rose)', nota: 'nos últimos 30 dias' }),
    ]));

    const areaBox = el('div');
    global.CH.line(areaBox, { height: 260, data: serie, series: [{ key: 'novos', label: 'Novos cadastros', color: '#0e9f6e' }], labelX: (d) => fmtDateShort(d.data), labelTip: (d) => fmtDate(d.data) });
    alvo.appendChild(el('div', { class: 'grade g-2-1', style: { marginBottom: '16px' } }, [
      cartao('Ritmo de cadastramento', 'Novos registros por dia nos últimos 45 dias', [areaBox]),
      (function () {
        const s45 = D.serieCrescimento(45);
        const ult7 = s45.slice(-7), ant7 = s45.slice(-14, -7);
        const somaN = (a) => global.U.sum(a, (d) => d.novos);
        const melhor = sortBy(s45, (d) => d.novos, 'desc')[0];
        const apo7 = D.pessoas.filter((p) => global.U.daysBetween(p.dataCadastro, D.HOJE) <= 7 && D.isApoiador(p)).length;
        return cartao('Resumo do período', 'Últimos 7 dias comparados aos 7 anteriores', [
          global.UI.dado('Novos cadastros', num(somaN(ult7))),
          global.UI.dado('Semana anterior', num(somaN(ant7))),
          global.UI.dado('Média por dia', dec(somaN(ult7) / 7)),
          global.UI.dado('Melhor dia', fmtDate(melhor.data) + ' · ' + num(melhor.novos)),
          global.UI.dado('Viraram apoiadores', num(apo7) + ' (' + dec((apo7 / Math.max(1, somaN(ult7))) * 100) + '%)'),
          global.UI.dado('Mobilizadores ativos', num(D.rankingMobilizadores().filter((r) => r.recentes > 0).length)),
          el('p', { class: 'subtexto', style: { marginTop: '10px' }, text: 'Mobilizador ativo é quem registrou pelo menos um cadastro nos últimos 14 dias.' }),
        ]);
      })(),
    ]));

    const rank = D.rankingMobilizadores(30);
    const detalhe = (r) => {
      const p = D.P(r.pessoaId);
      const lista = D.cadastradosPor.get(r.pessoaId) || [];
      const corpo = el('div', {}, [
        el('div', { class: 'grade g3', style: { marginBottom: '14px' } }, [
          kpi({ rotulo: 'Cadastros', valor: num(r.cadastros) }),
          kpi({ rotulo: 'Viraram apoiadores', valor: num(r.apoiadores), cor: 'var(--accent)' }),
          kpi({ rotulo: 'Participam de atividades', valor: num(r.participantes), cor: 'var(--accent-3)' }),
        ]),
        el('p', { class: 'subtexto', text: p.nome + ' cadastrou ' + r.cadastros + ' pessoas. Dessas, ' + r.simpatizantes + ' tornaram-se simpatizantes, ' + r.apoiadores + ' declararam apoio e ' + r.participantes + ' começaram a participar de atividades.' }),
        el('div', { class: 'divisor' }),
        el('div', { class: 'lista rolagem', style: { '--h': '260px' } }, sortBy(lista, (x) => x.dataCadastro, 'desc').slice(0, 40).map((x) => listaItem({
          avatar: avatarPessoa(x.id, 'pequeno'), titulo: x.nome, sub: D.terr(x.bairroId).nome + ' · ' + fmtDate(x.dataCadastro),
          tag: tag(D.CLASSIF_LABEL[x.classificacao]), onclick: () => { location.hash = '#/pessoas/' + x.id; },
        }))),
      ]);
      modal('Produtividade de ' + p.nome, corpo, { wide: true });
    };

    const tabRank = tabela({
      linhas: rank, ordPadrao: 'cadastros', tam: 12, onRow: detalhe,
      colunas: [
        { k: 'nome', rotulo: 'Mobilizador', valor: (r) => D.nome(r.pessoaId), render: (r) => pessoaCell(r.pessoaId) },
        { k: 'cadastros', rotulo: 'Cadastros', num: true, render: (r) => el('b', { text: num(r.cadastros) }) },
        { k: 'simpatizantes', rotulo: 'Simpatizantes', num: true },
        { k: 'apoiadores', rotulo: 'Apoiadores', num: true },
        { k: 'participantes', rotulo: 'Participantes', num: true },
        { k: 'recentes', rotulo: 'Últimos 14d', num: true, render: (r) => el('span', { class: 'badge-num', text: r.recentes }) },
        { k: 'conversao', rotulo: 'Conversão', num: true, render: (r) => el('div', { style: { minWidth: '110px' } }, [el('small', { text: dec(r.conversao) + '%' }), barra(r.conversao, 100)]) },
      ],
    });

    const redeTop = D.redeIndicacoes(10);
    const redeBox = el('div');
    global.CH.hbars(redeBox, { data: redeTop.map((r) => ({ label: D.nome(r.pessoaId).split(' ').slice(0, 2).join(' '), valor: r.total, sub: 'Indicações diretas e indiretas', id: r.pessoaId })), rowH: 30, onClick: (d) => (location.hash = '#/pessoas/' + d.id) });

    alvo.appendChild(el('div', { class: 'grade g-2-1' }, [
      cartao('Produtividade dos mobilizadores', 'Clique para ver quem cada um trouxe para a campanha', [tabRank]),
      cartao('Rede de indicações', 'Quem mais amplia a base indicando pessoas', [redeBox]),
    ]));
  };
})(window);

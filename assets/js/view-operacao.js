/* ==========================================================================
   view-operacao.js — Equipes, tarefas, metas, demandas, eventos e agenda
   ========================================================================== */
(function (global) {
  'use strict';
  const { el, num, dec, pct, fmtDate, fmtDateShort, fmtWeekday, relDays, sortBy, sum, norm, toast, modal, iso, addDays, daysBetween } = global.U;
  const { cabecalho, cartao, kpi, tag, pessoaCell, avatarPessoa, barra, tabela, filtros, abas, listaItem, dado, indicador, legenda, voltar, formModal } = global.UI;

  /* ==========================  EQUIPES E NÚCLEOS  ========================== */
  global.VIEWS['equipes'] = function (alvo, param) {
    const D = global.DB;
    if (param) return fichaEquipe(alvo, param);
    const E = D.equipes.map((eq) => ({ eq, st: D.equipeStats(eq) }));

    alvo.appendChild(cabecalho('Equipes e núcleos', D.equipes.length + ' equipes ativas · ' + num(sum(D.equipes, (e) => e.integrantes.length)) + ' integrantes vinculados', [
      el('button', { class: 'btn pequeno', html: icHTML('compass', 14) + ' Estrutura da campanha', onclick: () => estrutura() }),
      el('button', { class: 'btn pequeno primario', html: icHTML('plus', 14) + ' Novo núcleo', onclick: () => formModal('Novo núcleo ou equipe', [
        { k: 'nome', rot: 'Nome do núcleo', tipo: 'texto', obrigatorio: true, dica: 'Ex.: Núcleo Bairro Alto Alegre' },
        { k: 'territorioId', rot: 'Território de atuação', tipo: 'select', largura: 'meia', opcoes: D.bairros.map((b) => ({ v: b.id, t: b.nome })) },
        { k: 'responsavelId', rot: 'Responsável', tipo: 'select', largura: 'meia', opcoes: D.equipe.map((e) => ({ v: e.pessoaId, t: D.nome(e.pessoaId) })) },
        { k: 'objetivo', rot: 'Objetivo', tipo: 'textarea', linhas: 2, dica: 'Ex.: organizar reuniões semanais com moradores' },
      ], (v) => { D.addEquipe(v); toast('Núcleo "' + v.nome + '" criado.'); }, { acao: 'Criar núcleo' }) }),
    ]));

    alvo.appendChild(el('div', { class: 'grade g4', style: { marginBottom: '16px' } }, [
      kpi({ rotulo: 'Equipes e núcleos', icone: 'users-round', valor: D.equipes.length, nota: D.equipes.filter((e) => daysBetween(e.criadaEm, D.HOJE) <= 30).length + ' criados nos últimos 30 dias' }),
      kpi({ rotulo: 'Integrantes', icone: 'users', valor: num(sum(D.equipes, (e) => e.integrantes.length)), cor: 'var(--accent-2)', nota: 'pessoas participando da operação' }),
      kpi({ rotulo: 'Desempenho médio', icone: 'zap', valor: (E.length ? Math.round(sum(E, (x) => x.st.desempenho) / E.length) : 0) + '%', cor: 'var(--warn)', nota: 'índice combinado de tarefas, metas e cadastros' }),
      kpi({ rotulo: 'Equipes abaixo da meta', icone: 'triangle-alert', valor: E.filter((x) => x.st.metaPct < 45).length, cor: 'var(--danger)', nota: 'menos de 45% da meta do período' }),
    ]));

    const grade = el('div', { class: 'grade g3' });
    sortBy(E, (x) => x.st.desempenho, 'desc').forEach(({ eq, st }) => {
      const cor = st.desempenho >= 70 ? 'var(--accent)' : st.desempenho >= 45 ? 'var(--warn)' : 'var(--danger)';
      grade.appendChild(el('div', { class: 'cartao', style: { cursor: 'pointer' }, onclick: () => (location.hash = '#/equipes/' + eq.id) }, [
        el('div', { style: { display: 'flex', gap: '12px', alignItems: 'flex-start' } }, [
          el('div', { style: { textAlign: 'center', minWidth: '62px' } }, [
            el('div', { text: st.desempenho + '%', style: { fontSize: '23px', fontWeight: 700, letterSpacing: '-.8px', color: cor } }),
            el('small', { class: 'subtexto', text: 'desempenho' }),
          ]),
          el('div', { style: { flex: 1, minWidth: 0 } }, [
            el('h3', { text: eq.nome, style: { fontSize: '14px' } }),
            el('p', { class: 'subtexto', text: D.terr(eq.territorioId).nome + ' · ' + eq.integrantes.length + ' integrantes' }),
            el('div', { class: 'filtros', style: { marginTop: '8px', marginBottom: 0, gap: '5px' } }, [
              tag(st.concluidas + '/' + st.tarefas + ' tarefas', 'azul'),
              st.atrasadas ? tag(st.atrasadas + ' atrasadas', 'vermelho') : null,
            ]),
          ]),
        ]),
        el('div', { class: 'divisor' }),
        el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12px' } }, [
          el('span', { class: 'subtexto', text: 'Responsável' }), el('b', { text: D.nome(eq.responsavelId).split(' ').slice(0, 2).join(' ') }),
        ]),
        el('div', { style: { marginTop: '8px' } }, [el('div', { class: 'subtexto', text: 'Meta do período · ' + Math.round(st.metaPct) + '%' }), barra(st.metaPct, 100)]),
      ]));
    });
    alvo.appendChild(grade);
  };

  function estrutura() {
    const D = global.DB;
    const corpo = el('div', {});
    const desenhar = () => {
      corpo.innerHTML = '';
      corpo.appendChild(el('p', { class: 'subtexto', style: { marginBottom: '12px' }, text: 'Quem coordena, quem supervisiona e quem está em campo — e a quem cada um responde. Esta estrutura define, no banco de dados, o alcance de cada perfil de acesso.' }));
      corpo.appendChild(el('button', { class: 'btn primario', style: { marginBottom: '14px' }, html: global.icHTML('plus', 14) + ' Adicionar à estrutura', onclick: () => novoIntegranteEstrutura(desenhar) }));
      if (!D.equipe.length) {
        corpo.appendChild(global.UI.vazio({ icone: 'users-round', titulo: 'Ninguém na estrutura ainda',
          texto: 'Comece pela coordenação geral e vá descendo: quem ela coordena, quem cada coordenador supervisiona.',
          acao: { rotulo: 'Adicionar à estrutura', onclick: () => novoIntegranteEstrutura(desenhar) } }));
        return;
      }
      const porArea = global.U.by(D.equipe, 'area');
      Array.from(porArea.keys()).forEach((area) =>
        corpo.appendChild(el('div', { style: { marginBottom: '14px' } }, [
          el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', { text: area }), el('p', { text: porArea.get(area).length + ' integrantes' })])]),
          el('div', { class: 'lista' }, porArea.get(area).map((m) => listaItem({
            avatar: avatarPessoa(m.pessoaId, 'pequeno'), titulo: D.nome(m.pessoaId),
            sub: m.funcao + (m.respondeA ? ' · responde a ' + D.nome(m.respondeA) : ' · topo da estrutura'),
            onclick: () => (location.hash = '#/pessoas/' + m.pessoaId),
          }))),
        ]))
      );
    };
    desenhar();
    modal('Estrutura da campanha', corpo, { wide: true });
  }

  function novoIntegranteEstrutura(aoSalvar) {
    const D = global.DB;
    formModal('Adicionar à estrutura', [
      { k: 'pessoa', rot: 'Pessoa (já cadastrada)', tipo: 'pessoa', obrigatorio: true, dica: 'digite o nome de quem entra na estrutura' },
      { k: 'funcao', rot: 'Função', tipo: 'select', opcoes: D.FUNCOES },
      { k: 'area', rot: 'Área', tipo: 'select', largura: 'meia', opcoes: D.AREAS },
      { k: 'respondeA', rot: 'Responde a', tipo: 'select', largura: 'meia',
        opcoes: [{ v: '', t: 'topo da estrutura' }].concat(D.equipe.map((e) => ({ v: e.pessoaId, t: D.nome(e.pessoaId) + ' — ' + e.funcao }))) },
      { k: 'regiaoId', rot: 'Região (se coordenação territorial)', tipo: 'select',
        opcoes: [{ v: '', t: 'não se aplica' }].concat(D.regioes.map((r) => ({ v: r.id, t: r.nome }))) },
    ], (v) => {
      const p = D.pessoas.find((x) => global.U.norm(x.nome) === global.U.norm(v.pessoa));
      if (!p) return 'Não encontrei "' + v.pessoa + '" no cadastro de pessoas. Cadastre a pessoa primeiro.';
      const r = D.addIntegranteEquipe({ pessoaId: p.id, funcao: v.funcao, area: v.area, respondeA: v.respondeA || null, regiaoId: v.regiaoId || null });
      if (!r) return p.nome + ' já faz parte da estrutura.';
      toast(p.nome.split(' ')[0] + ' entrou na estrutura como ' + v.funcao.toLowerCase() + '.');
      if (aoSalvar) aoSalvar();
    }, { acao: 'Adicionar' });
  }

  function fichaEquipe(alvo, id) {
    const D = global.DB;
    const eq = D.equipes.find((e) => e.id === id);
    if (!eq) return alvo.appendChild(cartao('Equipe não encontrada', null, el('p', { class: 'subtexto', text: 'Verifique o endereço.' })));
    const st = D.equipeStats(eq);
    const tfs = D.tarefas.filter((t) => t.equipeId === eq.id);
    const evs = D.eventos.filter((e) => e.equipeId === eq.id);
    const ms = D.metas.filter((m) => m.escopo === 'equipe' && m.alvoId === eq.id);
    const cad = D.pessoas.filter((p) => eq.integrantes.includes(p.cadastradoPor));

    alvo.appendChild(el('div', { class: 'filtros' }, [voltar('#/equipes', 'equipes')]));
    alvo.appendChild(cabecalho(eq.nome, 'Território: ' + D.terr(eq.territorioId).nome + ' · criada em ' + fmtDate(eq.criadaEm) + ' · ' + eq.integrantes.length + ' integrantes', [
      el('button', { class: 'btn pequeno', html: icHTML('plus', 14) + ' Tarefa para a equipe', onclick: () => novaTarefa({ equipeId: eq.id, territorioId: eq.territorioId }) }),
    ]));
    alvo.appendChild(cartao(null, null, el('p', { class: 'subtexto', style: { display: 'flex', gap: '7px', alignItems: 'center' }, html: global.icHTML('target', 14) + ' <span>Objetivo: ' + global.U.esc(eq.objetivo) + '</span>' })));

    alvo.appendChild(el('div', { class: 'grade g5', style: { margin: '16px 0' } }, [
      kpi({ rotulo: 'Desempenho', icone: 'zap', valor: st.desempenho + '%', nota: 'índice combinado da equipe' }),
      kpi({ rotulo: 'Tarefas concluídas', icone: 'square-check', valor: st.concluidas + '/' + st.tarefas, cor: 'var(--accent-2)', nota: dec(st.conclusao) + '% de conclusão' }),
      kpi({ rotulo: 'Tarefas atrasadas', icone: 'clock', valor: st.atrasadas, cor: 'var(--danger)', nota: 'exigem repactuação de prazo' }),
      kpi({ rotulo: 'Cadastros da equipe', icone: 'pencil', valor: num(st.cadastros), cor: 'var(--warn)', nota: num(st.apoiadores) + ' viraram apoiadores' }),
      kpi({ rotulo: 'Meta do período', icone: 'target', valor: Math.round(st.metaPct) + '%', cor: 'var(--accent-3)', nota: ms.length + ' metas vinculadas' }),
    ]));

    const indicadores = el('div', {}, [
      indicador('Conclusão de tarefas', st.conclusao, st.concluidas + ' de ' + st.tarefas + ' tarefas concluídas'),
      indicador('Atingimento das metas', Math.min(100, st.metaPct), ms.length + ' meta(s) do período'),
      indicador('Pontualidade', st.tarefas ? 100 - (st.atrasadas / st.tarefas) * 100 : 100, st.atrasadas + ' tarefa(s) atrasada(s)'),
      indicador('Cadastros da equipe', Math.min(100, st.cadastros / 3), num(st.cadastros) + ' pessoas cadastradas pelos integrantes'),
      indicador('Presença em eventos', Math.min(100, st.eventos * 12), st.eventos + ' atividade(s) sob responsabilidade da equipe'),
    ]);

    alvo.appendChild(el('div', { class: 'grade g3', style: { marginBottom: '16px' } }, [
      cartao('Perfil de desempenho', 'Dimensões acompanhadas pela coordenação', [indicadores]),
      cartao('Integrantes', eq.integrantes.length + ' pessoas na equipe', [
        el('div', { class: 'lista rolagem', style: { '--h': '260px' } }, eq.integrantes.map((pid) => listaItem({
          avatar: avatarPessoa(pid, 'pequeno'), titulo: D.nome(pid),
          sub: (pid === eq.responsavelId ? 'Responsável · ' : '') + (D.funcaoDe(pid) || D.CLASSIF_LABEL[D.P(pid).classificacao]),
          onclick: () => (location.hash = '#/pessoas/' + pid),
        }))),
      ], [el('button', { class: 'btn pequeno', html: icHTML('plus', 13) + ' integrante', onclick: () => formModal('Adicionar integrante — ' + eq.nome, [
        { k: 'pessoa', rot: 'Pessoa (já cadastrada)', tipo: 'pessoa', obrigatorio: true },
      ], (v) => {
        const p = D.pessoas.find((x) => global.U.norm(x.nome) === global.U.norm(v.pessoa));
        if (!p) return 'Não encontrei "' + v.pessoa + '" no cadastro de pessoas.';
        const r = D.addIntegrante(eq.id, p.id);
        if (!r) return p.nome + ' já está nesta equipe.';
        toast(p.nome.split(' ')[0] + ' entrou em ' + eq.nome + '.');
        global.refresh();
      }, { acao: 'Adicionar' }) })]),
      cartao('Metas da equipe', ms.length + ' metas do período', [
        el('div', { class: 'lista' }, ms.map((m) => {
          const at = D.metaAtual(m);
          return el('div', { style: { padding: '8px 0' } }, [
            el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' } }, [el('span', { text: m.titulo }), el('b', { text: num(at) + '/' + num(m.alvo) })]),
            barra(at, m.alvo),
            el('small', { class: 'subtexto', text: m.periodo + ' · prazo ' + fmtDate(m.prazo) }),
          ]);
        })),
      ]),
    ]));

    alvo.appendChild(el('div', { class: 'grade g2' }, [
      cartao('Tarefas da equipe', tfs.length + ' tarefas', [
        el('div', { class: 'lista rolagem', style: { '--h': '340px' } }, tfs.map((t) => listaItem({
          icone: 'square-check', titulo: t.titulo, sub: 'prazo ' + fmtDate(t.prazo) + ' · ' + D.nome(t.responsavelId),
          tag: tag(t.status), onclick: () => detalheTarefa(t),
        }))),
      ]),
      cartao('Eventos da equipe', evs.length + ' atividades', [
        el('div', { class: 'lista rolagem', style: { '--h': '340px' } }, evs.map((e) => listaItem({
          icone: 'megaphone', titulo: e.nome, sub: fmtDate(e.data) + ' · ' + e.local,
          valor: e.publicoPresente ? num(e.publicoPresente) : num(e.publicoPrevisto), nota: e.publicoPresente ? 'presentes' : 'previstos',
          onclick: () => (location.hash = '#/eventos/' + e.id),
        }))),
      ]),
    ]));
  }

  /* ==========================  TAREFAS  ========================== */
  const STATUS_TAREFA = ['não iniciada', 'em andamento', 'concluída', 'atrasada', 'cancelada'];

  global.VIEWS['tarefas'] = function (alvo, param, params) {
    const D = global.DB;
    const cont = global.U.countBy(D.tarefas, 'status');
    alvo.appendChild(cabecalho('Gestão de tarefas', D.tarefas.length + ' tarefas registradas · ' + (cont.get('atrasada') || 0) + ' atrasadas · o sistema mostra o andamento real das atividades', [
      el('button', { class: 'btn pequeno primario', html: icHTML('plus', 14) + ' Nova tarefa', onclick: () => novaTarefa() }),
    ]));

    alvo.appendChild(el('div', { class: 'grade g5', style: { marginBottom: '16px' } }, STATUS_TAREFA.map((s, i) => kpi({
      rotulo: s.charAt(0).toUpperCase() + s.slice(1), icone: ['circle-dashed', 'activity', 'square-check', 'clock', 'circle-x'][i], valor: num(cont.get(s) || 0),
      cor: ['var(--txt-3)', 'var(--accent-2)', 'var(--accent)', 'var(--danger)', 'var(--txt-3)'][i],
      nota: (D.tarefas.length ? dec(((cont.get(s) || 0) / D.tarefas.length) * 100) : '0') + '% do total',
    }))));

    const area = el('div');
    let visao = 'Quadro';
    let lista = D.tarefas.slice();
    if (params.get('status')) lista = lista.filter((t) => t.status === params.get('status'));

    const desenhar = () => {
      area.innerHTML = '';
      if (visao === 'Quadro') {
        const kb = el('div', { class: 'kanban' });
        STATUS_TAREFA.forEach((s) => {
          const col = el('div', { class: 'kb-col' }, el('h4', {}, [
            el('span', { class: 'tag ' + global.UI.CORES_STATUS[s] + ' ponto', text: s }),
            el('em', { text: lista.filter((t) => t.status === s).length }),
          ]));
          sortBy(lista.filter((t) => t.status === s), (t) => t.prazo).slice(0, 40).forEach((t) => {
            col.appendChild(el('div', { class: 'kb-card', onclick: () => detalheTarefa(t) }, [
              el('b', { text: t.titulo }),
              el('div', { style: { marginTop: '8px' } }, barra(t.progresso, 100)),
              el('div', { class: 'kb-meta' }, [
                avatarPessoa(t.responsavelId, 'pequeno'),
                el('span', { text: D.nome(t.responsavelId).split(' ')[0] }),
                el('span', { style: { marginLeft: 'auto' }, text: fmtDateShort(t.prazo) }),
              ]),
            ]));
          });
          kb.appendChild(col);
        });
        area.appendChild(kb);
      } else {
        area.appendChild(tabela({
          linhas: lista, ordPadrao: 'prazo', dirPadrao: 'asc', tam: 20, onRow: detalheTarefa,
          colunas: [
            { k: 'titulo', rotulo: 'Tarefa', render: (t) => el('div', {}, [el('b', { text: t.titulo, style: { fontSize: '13px' } }), el('small', { text: t.objetivo, style: { display: 'block', color: 'var(--txt-3)', fontSize: '11px' } })]) },
            { k: 'responsavel', rotulo: 'Responsável', valor: (t) => D.nome(t.responsavelId), render: (t) => pessoaCell(t.responsavelId) },
            { k: 'equipe', rotulo: 'Equipe', valor: (t) => D.equipes.find((e) => e.id === t.equipeId).nome, render: (t) => el('small', { text: D.equipes.find((e) => e.id === t.equipeId).nome }) },
            { k: 'territorio', rotulo: 'Território', valor: (t) => D.terr(t.territorioId).nome },
            { k: 'prazo', rotulo: 'Prazo', render: (t) => el('div', {}, [el('div', { text: fmtDate(t.prazo), style: { fontSize: '12.5px' } }), el('small', { text: relDays(t.prazo), style: { color: t.status === 'atrasada' ? 'var(--danger)' : 'var(--txt-3)', fontSize: '11px' } })]) },
            { k: 'prioridade', rotulo: 'Prioridade', render: (t) => tag(t.prioridade) },
            { k: 'progresso', rotulo: 'Andamento', num: true, render: (t) => el('div', { style: { minWidth: '110px' } }, [el('small', { text: t.progresso + '%' }), barra(t.progresso, 100)]) },
            { k: 'status', rotulo: 'Situação', render: (t) => tag(t.status) },
          ],
        }));
      }
    };

    const ab = abas(['Quadro', 'Lista'], (v) => { visao = v; desenhar(); });
    alvo.appendChild(filtros([
      { k: 'busca', tipo: 'busca', placeholder: 'Buscar tarefa…' },
      { k: 'equipe', tipo: 'select', rotulo: 'Todas as equipes', opcoes: D.equipes.map((e) => ({ v: e.id, t: e.nome })) },
      { k: 'territorio', tipo: 'select', rotulo: 'Todos os territórios', opcoes: D.bairros.map((b) => ({ v: b.id, t: b.nome })) },
      { k: 'prioridade', tipo: 'select', rotulo: 'Todas as prioridades', opcoes: D.PRIORIDADES },
      { k: 'status', tipo: 'chips', rotulo: 'Todas (' + D.tarefas.length + ')', padrao: params.get('status') || 'todos', opcoes: STATUS_TAREFA.map((s) => ({ v: s, t: s, n: cont.get(s) || 0 })) },
    ], (e) => {
      lista = D.tarefas.filter((t) =>
        (!e.busca || norm(t.titulo).includes(norm(e.busca))) &&
        (e.equipe === 'todos' || t.equipeId === e.equipe) &&
        (e.territorio === 'todos' || t.territorioId === e.territorio) &&
        (e.prioridade === 'todos' || t.prioridade === e.prioridade) &&
        (e.status === 'todos' || t.status === e.status));
      desenhar();
      return lista.length;
    }));
    alvo.appendChild(ab);
    alvo.appendChild(area);
    desenhar();
  };

  function detalheTarefa(t) {
    const D = global.DB;
    const prog = el('div');
    const check = el('div', { class: 'lista' });
    const atualizar = () => {
      const feitos = t.checklist.filter((c) => c.feito).length;
      const p = Math.round((feitos / t.checklist.length) * 100);
      prog.innerHTML = '';
      prog.appendChild(el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '5px' } }, [
        el('span', { class: 'subtexto', text: 'Andamento registrado pelo responsável' }), el('b', { text: p + '%' })]));
      prog.appendChild(barra(p, 100));
      check.innerHTML = '';
      t.checklist.forEach((c, i) => {
        check.appendChild(el('div', { class: 'lista-item', onclick: () => { c.feito = !c.feito; atualizar(); } }, [
          el('div', { class: 'avatar pequeno', text: c.feito ? 'check' : (i + 1), style: c.feito ? { background: 'rgba(34,211,165,.25)', color: '#5eead4' } : {} }),
          el('div', { style: { flex: 1 } }, el('b', { text: c.passo, style: { fontSize: '13px', textDecoration: c.feito ? 'line-through' : 'none', opacity: c.feito ? 0.6 : 1 } })),
        ]));
      });
    };
    const corpo = el('div', {}, [
      el('div', { class: 'filtros' }, [tag(t.status), tag(t.prioridade), el('span', { class: 'tag azul', text: D.terr(t.territorioId).nome }), el('span', { class: 'tag roxo', text: t.area })]),
      el('p', { class: 'subtexto', text: t.descricao }),
      el('div', { class: 'divisor' }),
      el('div', { class: 'grade g2' }, [
        el('div', {}, [
          dado('Responsável', D.nome(t.responsavelId)),
          dado('Equipe', D.equipes.find((e) => e.id === t.equipeId).nome),
          dado('Objetivo', t.objetivo),
        ]),
        el('div', {}, [
          dado('Criada em', fmtDate(t.criadaEm)),
          dado('Prazo', fmtDate(t.prazo) + ' (' + relDays(t.prazo) + ')'),
          dado('Onde', D.terr(t.territorioId).nome),
        ]),
      ]),
      el('div', { class: 'divisor' }),
      prog,
      el('div', { style: { marginTop: '12px' } }, [el('div', { class: 'subtexto', text: 'Etapas da atividade — clique para marcar o que já foi feito' }), check]),
      t.andamento ? el('div', { class: 'cartao', style: { marginTop: '12px', padding: '12px' } }, [el('div', { class: 'subtexto', text: 'Registro do responsável' }), el('p', { text: t.andamento, style: { fontSize: '13px', marginTop: '4px' } })]) : null,
    ]);
    atualizar();
    const m = modal(t.titulo, corpo, { wide: true, footer: [
      el('button', { class: 'btn', text: 'Fechar', onclick: () => m.close() }),
      el('button', { class: 'btn primario', text: 'Salvar andamento', onclick: () => {
        global.DB.atualizarTarefa(t);
        m.close();
        toast('Tarefa em "' + t.status + '" · ' + t.progresso + '% concluído.');
        global.refresh();
      } }),
    ]});
  }

  function novaTarefa(preset) {
    if (!global.UI.exigeEscrita()) return;
    const D = global.DB;
    preset = preset || {};
    const inpTitulo = el('input', { type: 'text', placeholder: 'Ex.: organizar reunião no Bairro São José', value: preset.titulo || '' });
    const selResp = el('select', {}, D.equipe.map((e) => el('option', { value: e.pessoaId, text: D.nome(e.pessoaId) + ' — ' + e.funcao })));
    const selEquipe = el('select', {}, D.equipes.map((e) => el('option', { value: e.id, text: e.nome, selected: e.id === preset.equipeId })));
    const inpPrazo = el('input', { type: 'date', value: global.U.iso(global.U.addDays(D.HOJE, 7)) });
    const selTerr = el('select', {}, D.bairros.map((b) => el('option', { value: b.id, text: b.nome, selected: b.id === preset.territorioId })));
    const inpObj = el('input', { type: 'text', placeholder: 'Ex.: ampliar a base de apoiadores no território' });
    const selPri = el('select', {}, D.PRIORIDADES.map((x) => el('option', { value: x, text: x, selected: x === 'média' })));
    const txtEtapas = el('textarea', { rows: 4, placeholder: 'contactar liderança local\ndefinir local\nconvidar participantes' });

    const form = el('div', {}, [
      el('div', { class: 'campo' }, [el('label', { text: 'O que precisa ser feito? *' }), inpTitulo]),
      el('div', { class: 'campo-linha' }, [
        el('div', { class: 'campo' }, [el('label', { text: 'Quem é responsável?' }), selResp]),
        el('div', { class: 'campo' }, [el('label', { text: 'Equipe' }), selEquipe]),
      ]),
      el('div', { class: 'campo-linha' }, [
        el('div', { class: 'campo' }, [el('label', { text: 'Quando deverá ser concluído?' }), inpPrazo]),
        el('div', { class: 'campo' }, [el('label', { text: 'Onde deverá acontecer?' }), selTerr]),
      ]),
      el('div', { class: 'campo-linha' }, [
        el('div', { class: 'campo' }, [el('label', { text: 'Qual é o objetivo?' }), inpObj]),
        el('div', { class: 'campo' }, [el('label', { text: 'Prioridade' }), selPri]),
      ]),
      el('div', { class: 'campo' }, [el('label', { text: 'Etapas previstas (uma por linha)' }), txtEtapas]),
    ]);
    const m = modal('Nova tarefa', form, { wide: true, footer: [
      el('button', { class: 'btn', text: 'Cancelar', onclick: () => m.close() }),
      el('button', { class: 'btn primario', text: 'Criar tarefa', onclick: () => {
        if (inpTitulo.value.trim().length < 5) { inpTitulo.focus(); return toast('Descreva o que precisa ser feito.', 'erro'); }
        D.addTarefa({
          titulo: inpTitulo.value.trim(), responsavelId: selResp.value, equipeId: selEquipe.value,
          prazo: inpPrazo.value || undefined, territorioId: selTerr.value, objetivo: inpObj.value.trim(),
          prioridade: selPri.value, descricao: preset.descricao || 'Tarefa criada pela coordenação.',
          etapas: txtEtapas.value.split('\n').map((x) => x.trim()).filter(Boolean),
        });
        m.close();
        toast('Tarefa criada e atribuída a ' + D.nome(selResp.value).split(' ')[0] + '.');
        location.hash = '#/tarefas';
        global.refresh();
      } }),
    ]});
    setTimeout(() => inpTitulo.focus(), 60);
  }

  function novoEvento(preset) {
    const D = global.DB;
    preset = preset || {};
    return formModal('Novo evento', [
      { k: 'nome', rot: 'Nome do evento', tipo: 'texto', obrigatorio: true, dica: 'Ex.: reunião com moradores do Centro' },
      { k: 'tipo', rot: 'Tipo', tipo: 'select', largura: 'meia', opcoes: D.TIPO_EVENTO },
      { k: 'territorioId', rot: 'Território', tipo: 'select', largura: 'meia', valor: preset.territorioId, opcoes: D.bairros.map((b) => ({ v: b.id, t: b.nome })) },
      { k: 'data', rot: 'Data', tipo: 'data', largura: 'meia', obrigatorio: true, valor: global.U.iso(global.U.addDays(D.HOJE, 3)) },
      { k: 'hora', rot: 'Hora', tipo: 'hora', largura: 'meia', valor: '19:00' },
      { k: 'local', rot: 'Local', tipo: 'texto', obrigatorio: true, dica: 'Ex.: salão comunitário' },
      { k: 'responsavelId', rot: 'Responsável', tipo: 'select', largura: 'meia', opcoes: D.equipe.map((e) => ({ v: e.pessoaId, t: D.nome(e.pessoaId) })) },
      { k: 'publicoPrevisto', rot: 'Público previsto', tipo: 'numero', largura: 'meia', valor: 100 },
    ], (v) => {
      const e = D.addEvento({ ...v, publicoPrevisto: +v.publicoPrevisto });
      toast('Evento criado para ' + fmtDate(e.data) + '.');
      location.hash = '#/eventos/' + e.id;
    }, { acao: 'Criar evento', wide: true, nota: 'Depois do evento, use "Registrar resultado" para lançar público, cadastros e apoiadores.' });
  }

  global.novaTarefa = novaTarefa;
  global.novoEvento = novoEvento;

  /* ==========================  METAS  ========================== */
  global.VIEWS['metas'] = function (alvo) {
    const D = global.DB;
    const M = D.metas.map((m) => { const at = D.metaAtual(m); return { m, at, p: m.alvo ? (at / m.alvo) * 100 : 0 }; });
    const atingidas = M.filter((x) => x.p >= 100).length;

    alvo.appendChild(cabecalho('Metas', D.metas.length + ' metas ativas · o sistema compara meta prevista × resultado alcançado', [
      el('button', { class: 'btn pequeno primario', html: icHTML('plus', 14) + ' Nova meta', onclick: () => formModal('Nova meta', [
        { k: 'titulo', rot: 'Meta', tipo: 'texto', obrigatorio: true, dica: 'Ex.: cadastrar 200 novos apoiadores no Bairro A' },
        { k: 'alvo', rot: 'Quantidade prevista', tipo: 'numero', largura: 'meia', obrigatorio: true, valor: 100 },
        { k: 'prazo', rot: 'Prazo', tipo: 'data', largura: 'meia', valor: global.U.iso(global.U.addDays(D.HOJE, 14)) },
        { k: 'escopo', rot: 'Escopo', tipo: 'select', largura: 'meia', opcoes: ['campanha', 'território', 'equipe'] },
        { k: 'periodo', rot: 'Período', tipo: 'select', largura: 'meia', opcoes: ['Semanal', 'Mensal', 'Campanha'] },
      ], (v) => { D.addMeta({ titulo: v.titulo, alvo: +v.alvo, prazo: v.prazo, escopo: v.escopo, periodo: v.periodo }); toast('Meta criada.'); }, { acao: 'Criar meta' }) }),
    ]));

    alvo.appendChild(el('div', { class: 'grade g4', style: { marginBottom: '16px' } }, [
      kpi({ rotulo: 'Metas atingidas', icone: 'target', valor: atingidas + '/' + M.length, nota: pct(atingidas, M.length) + '% do conjunto de metas' }),
      kpi({ rotulo: 'Atingimento médio', icone: 'chart-column', valor: (M.length ? Math.round(sum(M, (x) => Math.min(100, x.p)) / M.length) : 0) + '%', cor: 'var(--accent-2)', nota: 'média de todas as metas ativas' }),
      kpi({ rotulo: 'Metas em risco', icone: 'triangle-alert', valor: M.filter((x) => x.p < 50 && daysBetween(D.HOJE, x.m.prazo) < 10).length, cor: 'var(--danger)', nota: 'abaixo de 50% com prazo próximo' }),
      kpi({ rotulo: 'Prazo mais próximo', icone: 'clock', valor: M.length ? fmtDateShort(sortBy(D.metas, (m) => m.prazo)[0].prazo) : '—', cor: 'var(--warn)', nota: M.length ? sortBy(D.metas, (m) => m.prazo)[0].titulo : 'nenhuma meta cadastrada' }),
    ]));

    alvo.appendChild(el('p', { class: 'subtexto', style: { marginBottom: '4px' } },
      [el('span', { text: 'A comparação gráfica de previsto × realizado está no ' }),
       el('a', { text: 'relatório de atividades', style: { color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }, onclick: () => (location.hash = '#/relatorios?tipo=atividades') }),
       el('span', { text: '.' })]));

    const grade = el('div', { class: 'grade g3', style: { marginTop: '16px' } });
    sortBy(M, (x) => x.p, 'desc').forEach(({ m, at, p }) => {
      const cor = p >= 100 ? 'var(--accent)' : p >= 60 ? 'var(--accent-2)' : p >= 35 ? 'var(--warn)' : 'var(--danger)';
      grade.appendChild(el('div', { class: 'cartao' }, [
        el('div', {}, [
          el('h3', { text: m.titulo, style: { fontSize: '13.5px' } }),
          el('p', { class: 'subtexto', text: m.escopo + ' · ' + m.periodo }),
          el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '10px 0 5px' } }, [
            el('div', {}, [el('b', { text: num(at), style: { fontSize: '19px' } }), el('span', { class: 'subtexto', text: ' de ' + num(m.alvo) })]),
            el('b', { text: Math.round(p) + '%', style: { color: cor } }),
          ]),
          barra(Math.min(100, p), 100, cor),
        ]),
        el('div', { class: 'divisor' }),
        el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' } }, [
          el('span', { class: 'subtexto', text: 'Prazo: ' + fmtDate(m.prazo) }),
          tag(p >= 100 ? 'atingida' : daysBetween(D.HOJE, m.prazo) < 0 ? 'vencida' : 'em andamento', p >= 100 ? 'verde' : daysBetween(D.HOJE, m.prazo) < 0 ? 'vermelho' : 'azul'),
        ]),
      ]));
    });
    alvo.appendChild(grade);
  };

  /* ==========================  DEMANDAS  ========================== */
  global.VIEWS['demandas'] = function (alvo) {
    const D = global.DB;
    const cont = global.U.countBy(D.demandas, 'status');
    alvo.appendChild(cabecalho('Demandas', D.demandas.length + ' solicitações registradas · acompanhe o que foi pedido e se a campanha respondeu', [
      el('button', { class: 'btn pequeno primario', html: icHTML('plus', 14) + ' Nova demanda', onclick: () => formModal('Nova demanda', [
        { k: 'solicitante', rot: 'Quem está solicitando', tipo: 'pessoa', obrigatorio: true, dica: 'Digite o nome de quem pediu' },
        { k: 'descricao', rot: 'O que está sendo pedido', tipo: 'textarea', linhas: 2, obrigatorio: true },
        { k: 'area', rot: 'Área responsável', tipo: 'select', largura: 'meia', opcoes: D.AREAS },
        { k: 'prioridade', rot: 'Prioridade', tipo: 'select', largura: 'meia', opcoes: D.PRIORIDADES, valor: 'média' },
      ], (v) => {
        const p = D.pessoas.find((x) => norm(x.nome) === norm(v.solicitante));
        if (!p) return 'Não encontrei "' + v.solicitante + '" na base. Cadastre a pessoa primeiro.';
        D.addDemanda({ solicitanteId: p.id, descricao: v.descricao, area: v.area, prioridade: v.prioridade });
        toast('Demanda registrada para ' + p.nome.split(' ')[0] + '.');
      }, { acao: 'Registrar demanda' }) }),
    ]));

    alvo.appendChild(el('div', { class: 'grade g5', style: { marginBottom: '16px' } }, ['aberta', 'em análise', 'encaminhada', 'atendida', 'não atendida'].map((s, i) => kpi({
      rotulo: s.charAt(0).toUpperCase() + s.slice(1), icone: ['inbox', 'search', 'route', 'square-check', 'circle-x'][i], valor: num(cont.get(s) || 0),
      cor: ['var(--warn)', 'var(--accent-2)', 'var(--accent-3)', 'var(--accent)', 'var(--danger)'][i],
      nota: (D.demandas.length ? dec(((cont.get(s) || 0) / D.demandas.length) * 100) : '0') + '% do total',
    }))));

    const areaBox = el('div', { class: 'lista' }, sortBy(D.AREAS.map((a) => ({
      area: a, n: D.demandas.filter((d) => d.area === a).length,
      pend: D.demandas.filter((d) => d.area === a && ['aberta', 'em análise', 'encaminhada'].includes(d.status)).length,
    })), (x) => x.n, 'desc').map((x) => listaItem({
      icone: 'inbox', titulo: x.area, sub: x.pend + ' pendente(s) de ' + x.n + ' registrada(s)',
      valor: x.n, nota: 'demandas',
    })));
    const atendidas = D.demandas.filter((d) => d.status === 'atendida');
    const abertasVelhas = D.demandas.filter((d) => ['aberta', 'em análise'].includes(d.status) && daysBetween(d.data, D.HOJE) > 12);
    const prioBox = el('div', {}, [
      el('div', {}, D.PRIORIDADES.slice().reverse().map((p, i) => {
        const n = D.demandas.filter((d) => d.prioridade === p).length;
        const pend = D.demandas.filter((d) => d.prioridade === p && ['aberta', 'em análise', 'encaminhada'].includes(d.status)).length;
        return indicador(p.charAt(0).toUpperCase() + p.slice(1), D.demandas.length ? (n / D.demandas.length) * 100 : 0,
          num(n) + ' demanda(s) · ' + num(pend) + ' ainda pendente(s)',
          ['#e11d48', '#d97706', '#2563eb', '#98a2b3'][i]);
      })),
      el('div', { class: 'divisor' }),
      dado('Taxa de atendimento', pct(atendidas.length, D.demandas.length) + '%'),
      dado('Abertas há mais de 12 dias', num(abertasVelhas.length)),
    ]);

    alvo.appendChild(el('div', { class: 'grade g2', style: { marginBottom: '16px' } }, [
      cartao('Demandas por área responsável', 'Onde está concentrada a resposta da campanha', [areaBox]),
      cartao('Prioridade e resposta', 'Onde estão as demandas e o que já foi respondido', [prioBox]),
    ]));

    const tab = tabela({
      linhas: D.demandas, ordPadrao: 'data', tam: 20, onRow: detalheDemanda,
      colunas: [
        { k: 'descricao', rotulo: 'Demanda', render: (d) => el('div', {}, [el('b', { text: d.descricao, style: { fontSize: '13px' } }), el('small', { text: d.area + ' · ' + D.terr(d.territorioId).nome, style: { display: 'block', color: 'var(--txt-3)', fontSize: '11px' } })]) },
        { k: 'solicitante', rotulo: 'Solicitante', valor: (d) => D.nome(d.solicitanteId), render: (d) => pessoaCell(d.solicitanteId) },
        { k: 'responsavel', rotulo: 'Responsável', valor: (d) => D.nome(d.responsavelId), render: (d) => el('small', { text: D.nome(d.responsavelId) }) },
        { k: 'data', rotulo: 'Registro', render: (d) => fmtDate(d.data) },
        { k: 'prazo', rotulo: 'Prazo', render: (d) => el('small', { text: fmtDate(d.prazo) + ' · ' + relDays(d.prazo), style: { color: daysBetween(D.HOJE, d.prazo) < 0 && d.status !== 'atendida' ? 'var(--danger)' : 'var(--txt-3)' } }) },
        { k: 'prioridade', rotulo: 'Prioridade', render: (d) => tag(d.prioridade) },
        { k: 'status', rotulo: 'Situação', render: (d) => tag(d.status) },
      ],
    });
    alvo.appendChild(filtros([
      { k: 'busca', tipo: 'busca', placeholder: 'Buscar demanda…' },
      { k: 'area', tipo: 'select', rotulo: 'Todas as áreas', opcoes: D.AREAS },
      { k: 'prioridade', tipo: 'select', rotulo: 'Todas as prioridades', opcoes: D.PRIORIDADES },
      { k: 'status', tipo: 'chips', rotulo: 'Todas', opcoes: ['aberta', 'em análise', 'encaminhada', 'atendida', 'não atendida'].map((s) => ({ v: s, t: s, n: cont.get(s) || 0 })) },
    ], (e) => tab.atualizar(D.demandas.filter((d) =>
      (!e.busca || norm(d.descricao).includes(norm(e.busca))) &&
      (e.area === 'todos' || d.area === e.area) &&
      (e.prioridade === 'todos' || d.prioridade === e.prioridade) &&
      (e.status === 'todos' || d.status === e.status)))));
    alvo.appendChild(tab);
  };

  function detalheDemanda(d) {
    const D = global.DB;
    const txtEnc = el('textarea', { rows: 2, placeholder: 'Ex.: material separado no comitê, retirada prevista para sexta.' });
    const selStatus = el('select', {}, ['aberta', 'em análise', 'encaminhada', 'atendida', 'não atendida'].map((x) => el('option', { value: x, text: x, selected: x === d.status })));
    const corpo = el('div', {}, [
      el('div', { class: 'filtros' }, [tag(d.status), tag(d.prioridade), el('span', { class: 'tag azul', text: D.terr(d.territorioId).nome }), el('span', { class: 'tag roxo', text: d.area })]),
      el('div', { class: 'grade g2' }, [
        el('div', {}, [dado('Solicitante', D.nome(d.solicitanteId)), dado('Registrada em', fmtDate(d.data)), dado('Prazo', fmtDate(d.prazo))]),
        el('div', {}, [dado('Responsável', D.nome(d.responsavelId)), dado('Área', d.area), dado('Território', D.terr(d.territorioId).nome)]),
      ]),
      el('div', { class: 'divisor' }),
      el('div', { class: 'timeline' }, [
        el('div', { class: 'tl-item', dataset: { icone: 'inbox' } }, [el('div', { class: 'tl-data', text: fmtDate(d.data) + ' · Registro' }), el('div', { class: 'tl-texto', text: d.descricao })]),
        d.encaminhamento ? el('div', { class: 'tl-item', dataset: { icone: 'route' } }, [el('div', { class: 'tl-data', text: 'Encaminhamento' }), el('div', { class: 'tl-texto', text: d.encaminhamento })]) : null,
        d.solucao ? el('div', { class: 'tl-item', dataset: { icone: 'square-check' } }, [el('div', { class: 'tl-data', text: 'Solução' }), el('div', { class: 'tl-texto', text: d.solucao })]) : null,
      ]),
      el('div', { class: 'campo', style: { marginTop: '12px' } }, [el('label', { text: 'Registrar novo encaminhamento' }), txtEnc]),
      el('div', { class: 'campo' }, [el('label', { text: 'Situação' }), selStatus]),
    ]);
    const m = modal('Demanda', corpo, { wide: true, footer: [
      el('button', { class: 'btn', text: 'Fechar', onclick: () => m.close() }),
      el('button', { class: 'btn primario', text: 'Salvar', onclick: () => {
        if (txtEnc.value.trim()) d.encaminhamento = txtEnc.value.trim();
        d.status = selStatus.value;
        if (d.status === 'atendida' && !d.solucao) d.solucao = txtEnc.value.trim() || 'Demanda atendida pela coordenação.';
        m.close();
        toast('Demanda atualizada para "' + d.status + '".');
        global.refresh();
      } }),
    ]});
  }

  /* ==========================  EVENTOS  ========================== */
  global.VIEWS['eventos'] = function (alvo, param) {
    const D = global.DB;
    if (param) return fichaEvento(alvo, param);
    const realizados = D.eventos.filter((e) => e.status === 'realizado');
    const futuros = sortBy(D.eventos.filter((e) => e.data >= iso(D.HOJE)), (e) => e.data);

    alvo.appendChild(cabecalho('Eventos', D.eventos.length + ' atividades registradas · o evento deixa de ser agenda e passa a produzir informação gerencial', [
      el('button', { class: 'btn pequeno primario', html: icHTML('plus', 14) + ' Novo evento', onclick: () => novoEvento() }),
    ]));

    alvo.appendChild(el('div', { class: 'grade g5', style: { marginBottom: '16px' } }, [
      kpi({ rotulo: 'Eventos realizados', icone: 'megaphone', valor: realizados.length, nota: futuros.length + ' previstos nos próximos dias' }),
      kpi({ rotulo: 'Público alcançado', icone: 'users', valor: num(sum(realizados, (e) => e.publicoPresente)), cor: 'var(--accent-2)', nota: 'soma dos presentes nas atividades' }),
      kpi({ rotulo: 'Novos cadastros', icone: 'pencil', valor: num(sum(realizados, (e) => e.novosCadastros)), cor: 'var(--warn)', nota: 'pessoas cadastradas durante eventos' }),
      kpi({ rotulo: 'Novos apoiadores', icone: 'handshake', valor: num(sum(realizados, (e) => e.novosApoiadores)), cor: 'var(--accent)', nota: 'apoios declarados nas atividades' }),
      kpi({ rotulo: 'Público × previsto', icone: 'trending-up', valor: pct(sum(realizados, (e) => e.publicoPresente), sum(realizados, (e) => e.publicoPrevisto)) + '%', cor: 'var(--accent-3)', nota: 'relação entre esperado e efetivo' }),
    ]));

    alvo.appendChild(el('p', { class: 'subtexto', style: { marginBottom: '14px' } },
      [el('span', { text: 'Público previsto × presente, tipos de atividade e resultados consolidados estão no ' }),
       el('a', { text: 'relatório de eventos', style: { color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }, onclick: () => (location.hash = '#/relatorios?tipo=eventos') }),
       el('span', { text: '.' })]));

    const grade = el('div', { class: 'grade g3' });
    const desenhar = (lista) => {
      grade.innerHTML = '';
      const total = lista.length;
      lista.forEach((e) => {
        const rend = e.publicoPresente ? pct(e.publicoPresente, e.publicoPrevisto) : null;
        grade.appendChild(el('div', { class: 'cartao', style: { cursor: 'pointer' }, onclick: () => (location.hash = '#/eventos/' + e.id) }, [
          el('div', { class: 'cartao-topo' }, [
            el('div', { style: { flex: 1 } }, [el('h3', { text: e.nome, style: { fontSize: '13.5px' } }), el('p', { text: e.tipo + ' · ' + D.terr(e.territorioId).nome })]),
            tag(e.status),
          ]),
          el('div', { class: 'dado-linha' }, [el('span', { style: { display: 'flex', gap: '6px', alignItems: 'center' }, html: global.icHTML('calendar-days', 13) + ' Quando' }), el('b', { text: fmtDate(e.data) + ' · ' + e.hora })]),
          el('div', { class: 'dado-linha' }, [el('span', { style: { display: 'flex', gap: '6px', alignItems: 'center' }, html: global.icHTML('map-pin', 13) + ' Onde' }), el('b', { text: e.local })]),
          el('div', { class: 'dado-linha' }, [el('span', { style: { display: 'flex', gap: '6px', alignItems: 'center' }, html: global.icHTML('user-round', 13) + ' Responsável' }), el('b', { text: D.nome(e.responsavelId).split(' ').slice(0, 2).join(' ') })]),
          el('div', { style: { marginTop: '10px' } }, [
            el('div', { class: 'subtexto', text: e.publicoPresente ? 'Público: ' + num(e.publicoPresente) + ' de ' + num(e.publicoPrevisto) + ' previstos (' + rend + '%)' : 'Público previsto: ' + num(e.publicoPrevisto) }),
            barra(e.publicoPresente || 0, e.publicoPrevisto, rend >= 100 ? 'var(--accent)' : 'var(--warn)'),
          ]),
          e.novosCadastros ? el('div', { class: 'filtros', style: { marginTop: '10px', marginBottom: 0, gap: '5px' } }, [
            tag('+' + e.novosCadastros + ' cadastros', 'azul'), tag('+' + e.novosApoiadores + ' apoiadores', 'verde'),
            e.novosMobilizadores ? tag('+' + e.novosMobilizadores + ' mobilizadores', 'laranja') : null,
          ]) : null,
        ]));
      });
      return total;
    };
    alvo.appendChild(filtros([
      { k: 'busca', tipo: 'busca', placeholder: 'Buscar evento…' },
      { k: 'territorio', tipo: 'select', rotulo: 'Todos os territórios', opcoes: D.bairros.map((b) => ({ v: b.id, t: b.nome })) },
      { k: 'tipo', tipo: 'select', rotulo: 'Todos os tipos', opcoes: D.TIPO_EVENTO },
      { k: 'status', tipo: 'chips', rotulo: 'Todos', opcoes: ['realizado', 'confirmado', 'pendências'] },
    ], (e) => desenhar(sortBy(D.eventos.filter((x) =>
      (!e.busca || norm(x.nome).includes(norm(e.busca))) &&
      (e.territorio === 'todos' || x.territorioId === e.territorio) &&
      (e.tipo === 'todos' || x.tipo === e.tipo) &&
      (e.status === 'todos' || x.status === e.status)), (x) => x.data, 'desc'))));
    alvo.appendChild(grade);
    desenhar(sortBy(D.eventos, (x) => x.data, 'desc'));
  };

  function fichaEvento(alvo, id) {
    const D = global.DB;
    const e = D.eventos.find((x) => x.id === id);
    if (!e) return alvo.appendChild(cartao('Evento não encontrado', null, el('p', { class: 'subtexto', text: 'Verifique o endereço.' })));
    const eq = D.equipes.find((x) => x.id === e.equipeId);
    const gastos = D.financeiro.filter((f) => f.eventoId === e.id);
    const participantes = D.interacoes.filter((i) => i.eventoId === e.id);

    alvo.appendChild(el('div', { class: 'filtros' }, [voltar('#/eventos', 'eventos')]));
    alvo.appendChild(cabecalho(e.nome, e.tipo + ' · ' + fmtDate(e.data) + ' às ' + e.hora + ' · ' + e.local, [
      tag(e.status),
      el('button', { class: 'btn pequeno primario', html: icHTML('clipboard-list', 14) + ' Registrar resultado', onclick: () => registrarResultado(e) }),
    ]));

    alvo.appendChild(el('div', { class: 'grade g5', style: { marginBottom: '16px' } }, [
      kpi({ rotulo: 'Público previsto', icone: 'target', valor: num(e.publicoPrevisto), nota: 'estimativa da equipe organizadora' }),
      kpi({ rotulo: 'Público presente', icone: 'users', valor: e.publicoPresente ? num(e.publicoPresente) : '—', cor: 'var(--accent)', nota: e.publicoPresente ? pct(e.publicoPresente, e.publicoPrevisto) + '% do previsto' : 'evento ainda não realizado' }),
      kpi({ rotulo: 'Novos cadastros', icone: 'pencil', valor: e.novosCadastros !== null ? num(e.novosCadastros) : '—', cor: 'var(--accent-2)', nota: 'pessoas cadastradas na atividade' }),
      kpi({ rotulo: 'Novos apoiadores', icone: 'handshake', valor: e.novosApoiadores !== null ? num(e.novosApoiadores) : '—', cor: 'var(--warn)', nota: 'apoios declarados no evento' }),
      kpi({ rotulo: 'Lideranças presentes', icone: 'star', valor: num(e.liderancasPresentes), cor: 'var(--rose)', nota: e.novosMobilizadores ? e.novosMobilizadores + ' novos mobilizadores identificados' : 'confirmação em andamento' }),
    ]));

    alvo.appendChild(el('div', { class: 'grade g3', style: { marginBottom: '16px' } }, [
      cartao('Organização', 'Responsabilidades e equipe', [
        dado('Responsável', D.nome(e.responsavelId)),
        dado('Equipe', eq ? eq.nome : '—'),
        dado('Território', D.terr(e.territorioId).nome),
        dado('Local', e.local),
        dado('Data e hora', fmtDate(e.data) + ' · ' + e.hora),
        el('div', { class: 'divisor' }),
        el('div', { class: 'subtexto', text: 'Necessidades logísticas' }),
        el('div', { class: 'filtros', style: { marginTop: '6px', marginBottom: 0 } }, e.logistica.length ? e.logistica.map((l) => el('span', { class: 'tag azul', text: l })) : [el('span', { class: 'subtexto', text: 'sem necessidades registradas' })]),
      ]),
      cartao('Custos vinculados', gastos.length + ' lançamentos ligados a este evento', [
        el('div', { class: 'lista' }, gastos.length ? gastos.map((g) => listaItem({ icone: 'wallet', titulo: g.descricao, sub: g.fornecedor + ' · ' + g.area, valor: global.U.money(g.realizado || g.previsto), nota: g.realizado ? 'realizado' : 'previsto' })) : [el('div', { class: 'vazio', text: 'Nenhum custo vinculado.' })]),
        gastos.length ? el('div', { class: 'divisor' }) : null,
        gastos.length ? dado('Total realizado', global.U.money(sum(gastos, (g) => g.realizado))) : null,
        gastos.length && e.publicoPresente ? dado('Custo por presente', global.U.money(sum(gastos, (g) => g.realizado) / e.publicoPresente)) : null,
      ]),
      cartao('Registro do evento', e.status === 'realizado' ? 'Avaliação após a atividade' : 'Pendente de realização', [
        e.obs ? el('p', { class: 'subtexto', text: e.obs }) : el('p', { class: 'subtexto', text: 'O resultado será registrado após a realização do evento.' }),
        el('div', { class: 'divisor' }),
        el('div', { class: 'subtexto', text: 'Participantes identificados' }),
        el('div', { class: 'lista rolagem', style: { '--h': '200px' } }, participantes.length ? participantes.slice(0, 30).map((i) => listaItem({
          avatar: avatarPessoa(i.pessoaId, 'pequeno'), titulo: D.nome(i.pessoaId), sub: D.terr(D.P(i.pessoaId).bairroId).nome,
          onclick: () => (location.hash = '#/pessoas/' + i.pessoaId),
        })) : [el('div', { class: 'vazio', text: 'Nenhum participante registrado.' })]),
      ]),
    ]));
  }

  function registrarResultado(e) {
    const campos = {
      publicoPresente: el('input', { type: 'number', value: e.publicoPresente || '' }),
      liderancasPresentes: el('input', { type: 'number', value: e.liderancasPresentes }),
      novosCadastros: el('input', { type: 'number', value: e.novosCadastros || '' }),
      novosApoiadores: el('input', { type: 'number', value: e.novosApoiadores || '' }),
      novosMobilizadores: el('input', { type: 'number', value: e.novosMobilizadores || '' }),
    };
    const obs = el('textarea', { rows: 3, text: e.obs });
    const form = el('div', {}, [
      el('div', { class: 'campo-linha' }, [
        el('div', { class: 'campo' }, [el('label', { text: 'Público presente' }), campos.publicoPresente]),
        el('div', { class: 'campo' }, [el('label', { text: 'Lideranças presentes' }), campos.liderancasPresentes]),
      ]),
      el('div', { class: 'campo-linha' }, [
        el('div', { class: 'campo' }, [el('label', { text: 'Novos cadastrados' }), campos.novosCadastros]),
        el('div', { class: 'campo' }, [el('label', { text: 'Novos apoiadores' }), campos.novosApoiadores]),
      ]),
      el('div', { class: 'campo' }, [el('label', { text: 'Novos mobilizadores identificados' }), campos.novosMobilizadores]),
      el('div', { class: 'campo' }, [el('label', { text: 'Avaliação e encaminhamentos' }), obs]),
      el('p', { class: 'subtexto', text: 'Ao salvar, o evento passa a "realizado" e os números entram nos indicadores da campanha.' }),
    ]);
    const m = modal('Registrar resultado — ' + e.nome, form, { footer: [
      el('button', { class: 'btn', text: 'Cancelar', onclick: () => m.close() }),
      el('button', { class: 'btn primario', text: 'Salvar resultado', onclick: () => {
        Object.keys(campos).forEach((k) => { const v = parseInt(campos[k].value, 10); if (!isNaN(v)) e[k] = v; });
        e.obs = obs.value.trim();
        if (e.publicoPresente) e.status = 'realizado';
        m.close();
        toast('Resultado registrado: ' + global.U.num(e.publicoPresente || 0) + ' presentes.');
        global.refresh();
      } }),
    ]});
  }

  /* ==========================  AGENDA  ========================== */
  global.VIEWS['agenda'] = function (alvo) {
    const D = global.DB;
    const itens = sortBy(D.agenda.map((a) => Object.assign({}, a, { origem: 'agenda' }))
      .concat(D.eventos.filter((e) => e.data >= iso(addDays(D.HOJE, -10))).map((e) => ({
        id: e.id, titulo: e.nome, tipo: 'Evento', data: e.data, hora: e.hora, duracao: 120, local: e.local,
        responsaveis: [e.responsavelId], obs: e.publicoPrevisto + ' pessoas previstas', origem: 'evento',
      }))), (x) => x.data + x.hora);

    alvo.appendChild(cabecalho('Agenda da candidatura', 'Compromissos, eventos, entrevistas e deslocamentos — um compromisso pode gerar tarefas para outras áreas', [
      el('button', { class: 'btn pequeno primario', html: icHTML('plus', 14) + ' Novo compromisso', onclick: () => formModal('Novo compromisso da agenda', [
        { k: 'titulo', rot: 'Compromisso', tipo: 'texto', obrigatorio: true, dica: 'Ex.: entrevista na Rádio Cidade' },
        { k: 'tipo', rot: 'Tipo', tipo: 'select', largura: 'meia', opcoes: ['Reunião', 'Entrevista', 'Gravação', 'Visita', 'Interno', 'Deslocamento'] },
        { k: 'responsavelId', rot: 'Responsável', tipo: 'select', largura: 'meia', opcoes: D.equipe.map((e) => ({ v: e.pessoaId, t: D.nome(e.pessoaId) })) },
        { k: 'data', rot: 'Data', tipo: 'data', largura: 'meia', obrigatorio: true, valor: global.U.iso(D.HOJE) },
        { k: 'hora', rot: 'Hora', tipo: 'hora', largura: 'meia', valor: '09:00' },
        { k: 'local', rot: 'Local', tipo: 'texto', dica: 'Ex.: comitê central' },
        { k: 'obs', rot: 'Observações', tipo: 'texto', dica: 'Ex.: levar material de campanha' },
      ], (v) => { D.addAgenda(v); toast('Compromisso incluído na agenda.'); }, { acao: 'Incluir na agenda' }) }),
    ]));

    const proximos = itens.filter((i) => i.data >= iso(D.HOJE));
    alvo.appendChild(el('div', { class: 'grade g4', style: { marginBottom: '16px' } }, [
      kpi({ rotulo: 'Compromissos futuros', icone: 'calendar-days', valor: proximos.length, nota: 'a partir de hoje' }),
      kpi({ rotulo: 'Nos próximos 7 dias', icone: 'clock', valor: proximos.filter((i) => daysBetween(D.HOJE, i.data) <= 7).length, cor: 'var(--accent-2)', nota: 'semana em curso' }),
      kpi({ rotulo: 'Eventos públicos', icone: 'megaphone', valor: proximos.filter((i) => i.origem === 'evento').length, cor: 'var(--warn)', nota: 'atividades com público' }),
      kpi({ rotulo: 'Compromissos internos', icone: 'building-2', valor: proximos.filter((i) => ['Reunião', 'Interno', 'Gravação'].includes(i.tipo)).length, cor: 'var(--accent-3)', nota: 'reuniões, gravações e produção' }),
    ]));

    const porDia = global.U.by(itens, 'data');
    const dias = Array.from(porDia.keys()).sort();
    const lista = el('div', { class: 'grade', style: { gap: '12px' } });
    dias.forEach((d) => {
      const passado = d < iso(D.HOJE);
      lista.appendChild(el('div', { class: 'cartao' + (d === iso(D.HOJE) ? ' destaque' : ''), style: { opacity: passado ? 0.6 : 1 } }, [
        el('div', { class: 'cartao-topo' }, [
          el('div', {}, [
            el('h3', { text: fmtWeekday(d).toUpperCase() + ', ' + fmtDate(d) }),
            el('p', { text: d === iso(D.HOJE) ? 'hoje · ' + porDia.get(d).length + ' compromissos' : relDays(d) + ' · ' + porDia.get(d).length + ' compromissos' }),
          ]),
        ]),
        el('div', { class: 'lista' }, sortBy(porDia.get(d), (x) => x.hora).map((x) => listaItem({
          icone: x.origem === 'evento' ? 'megaphone' : { Entrevista: 'mic', 'Gravação': 'video', 'Reunião': 'handshake', Visita: 'door-open', Interno: 'building-2', 'Deslocamento': 'truck' }[x.tipo] || 'bookmark',
          titulo: x.hora + ' · ' + x.titulo,
          sub: x.local + (x.obs ? ' · ' + x.obs : '') + ' · ' + x.responsaveis.map((r) => D.nome(r).split(' ')[0]).join(', '),
          tag: tag(x.tipo, x.origem === 'evento' ? 'verde' : 'azul'),
          onclick: () => (x.origem === 'evento' ? (location.hash = '#/eventos/' + x.id) : detalheCompromisso(x)),
        }))),
      ]));
    });
    alvo.appendChild(lista);
  };

  function detalheCompromisso(x) {
    const D = global.DB;
    const corpo = el('div', {}, [
      el('div', { class: 'filtros' }, [tag(x.tipo, 'azul'), el('span', { class: 'tag', text: fmtDate(x.data) + ' · ' + x.hora })]),
      dado('Local', x.local),
      dado('Duração prevista', x.duracao + ' minutos'),
      dado('Responsáveis', x.responsaveis.map((r) => D.nome(r)).join(', ')),
      x.obs ? dado('Observações', x.obs) : null,
      el('div', { class: 'divisor' }),
      el('div', { class: 'subtexto', text: 'Este compromisso pode gerar tarefas para outras áreas:' }),
      el('div', { class: 'filtros', style: { marginTop: '8px' } }, ['Mobilização', 'Logística', 'Comunicação', 'Transporte', 'Materiais', 'Equipe'].map((a) =>
        el('button', { class: 'btn pequeno', text: '+ ' + a, onclick: () => global.novaTarefa({ titulo: a + ' — ' + x.titulo, descricao: 'Tarefa gerada a partir do compromisso de ' + fmtDate(x.data) + '.' }) }))),
    ]);
    modal(x.titulo, corpo);
  }
})(window);

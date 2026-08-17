/* ==========================================================================
   view-sistema.js — primeiros passos, configuração da campanha,
   banco de dados (Supabase), backup e base de demonstração
   ========================================================================== */
(function (global) {
  'use strict';
  const { el, num, esc, iso, addDays, toast, modal } = global.U;
  const { cabecalho, cartao, kpi, tag, dado, vazio, formModal, indicador } = global.UI;

  /* ==========================  PRIMEIROS PASSOS  ========================== */
  global.VIEWS['inicio'] = function (alvo) {
    const D = global.DB;
    const cfg = D.config;
    const passos = [
      { ok: !!cfg.configurado, titulo: 'Identificar a campanha', texto: 'Candidatura, município e data da eleição. É o que dá contexto a todos os números.', rotulo: 'Configurar', rota: '#/config' },
      { ok: D.bairros.length > 0, titulo: 'Cadastrar o território', texto: 'Regiões e bairros do município, com o eleitorado estimado de cada um. O mapa e as metas nascem daqui.', rotulo: 'Cadastrar bairros', rota: '#/territorios' },
      { ok: D.equipe.length > 0, titulo: 'Montar a estrutura', texto: 'Quem coordena, quem supervisiona e quem está em campo — e a quem cada um responde.', rotulo: 'Montar equipe', rota: '#/equipes' },
      { ok: D.pessoas.length > 0, titulo: 'Começar o cadastro de pessoas', texto: 'Cada contato entra com origem, território e responsável. É a base de tudo.', rotulo: 'Cadastrar pessoa', rota: '#/pessoas' },
      { ok: D.tarefas.length > 0 || D.eventos.length > 0, titulo: 'Colocar a operação para andar', texto: 'Tarefas com responsável e prazo, eventos com resultado registrado depois.', rotulo: 'Criar tarefa', rota: '#/tarefas' },
    ];
    const feitos = passos.filter((p) => p.ok).length;

    alvo.appendChild(cabecalho('Bem-vindo ao SIGC',
      (feitos === passos.length ? 'Todos os primeiros passos foram concluídos' : 'A plataforma está pronta para receber os dados da sua campanha') +
      ' — ' + feitos + ' de ' + passos.length + ' primeiros passos concluídos'));

    alvo.appendChild(el('div', { class: 'cartao', style: { marginBottom: '16px' } }, [
      el('div', { class: 'subtexto', style: { marginBottom: '8px' } }, 'Progresso da implantação'),
      global.UI.barra(feitos, passos.length),
    ]));

    alvo.appendChild(el('div', { class: 'grade', style: { gap: '10px', marginBottom: '16px' } },
      passos.map((p, i) => el('div', { class: 'cartao passo' + (p.ok ? ' feito' : ''), style: { cursor: 'pointer' }, onclick: () => (location.hash = p.rota) }, [
        el('div', { class: 'passo-num' }, p.ok ? global.ic('check', 16) : el('span', { text: i + 1 })),
        el('div', { style: { flex: 1 } }, [
          el('b', { text: p.titulo }),
          el('p', { class: 'subtexto', text: p.texto }),
        ]),
        el('span', { class: 'tag ' + (p.ok ? 'verde' : 'cinza') + ' ponto', text: p.ok ? 'feito' : p.rotulo }),
      ]))
    ));

    alvo.appendChild(el('div', { class: 'grade g2' }, [
      cartao('Já tem os dados em outro lugar?', 'Traga tudo de uma vez', [
        el('p', { class: 'subtexto', text: 'Se você já usa o sistema em outro computador, importe o arquivo de backup. Se a campanha usa banco de dados próprio (Supabase), conecte o projeto e sincronize.' }),
        el('div', { class: 'filtros', style: { marginTop: '12px', marginBottom: 0 } }, [
          el('button', { class: 'btn', html: global.icHTML('upload', 14) + ' Importar backup', onclick: () => (location.hash = '#/config') }),
          el('button', { class: 'btn', html: global.icHTML('shield-check', 14) + ' Conectar banco', onclick: () => (location.hash = '#/config') }),
        ]),
      ]),
      cartao('Quer ver o sistema funcionando antes?', 'Base de demonstração', [
        el('p', { class: 'subtexto', text: 'Carrega uma campanha fictícia completa — município, bairros, equipe, pessoas, tarefas, eventos e relatórios — só para você conhecer as telas. Pode apagar depois com um clique.' }),
        el('div', { class: 'filtros', style: { marginTop: '12px', marginBottom: 0 } }, [
          el('button', { class: 'btn', html: global.icHTML('sparkles', 14) + ' Carregar demonstração', onclick: carregarDemo }),
        ]),
      ]),
    ]));
  };

  function carregarDemo() {
    const m = modal('Carregar base de demonstração', el('div', {}, [
      el('p', { class: 'subtexto', text: 'Isto apaga o que estiver cadastrado e coloca no lugar uma campanha fictícia completa, para conhecer o sistema. Use apenas antes de começar os trabalhos de verdade.' }),
    ]), { footer: [
      el('button', { class: 'btn', text: 'Cancelar', onclick: () => m.close() }),
      el('button', { class: 'btn primario', text: 'Carregar demonstração', onclick: () => {
        m.close();
        toast('Gerando base de demonstração…');
        setTimeout(() => {
          const r = global.DEMO.gerar();
          toast(num(r.pessoas) + ' pessoas em ' + r.bairros + ' bairros. É tudo fictício.');
          location.hash = '#/';
          global.refresh();
        }, 60);
      } }),
    ]});
  }


  /* ==========================  ACESSOS  ========================== */
  global.VIEWS['acessos'] = function (alvo) {
    const D = global.DB, SB = global.SB;

    alvo.appendChild(cabecalho('Acessos ao sistema', 'Quem entra no sistema e com que alcance', [
      el('button', { class: 'btn pequeno primario', html: global.icHTML('plus', 14) + ' Convidar para a equipe', onclick: () => novoConviteEquipe(redesenhar) }),
    ]));

    const corpoPerfis = el('div', { class: 'grade g3', style: { marginBottom: '18px' } });
    const corpo = el('div');
    alvo.appendChild(corpoPerfis);
    alvo.appendChild(corpo);

    async function redesenhar() {
      if (!SB.autenticado()) {
        corpoPerfis.innerHTML = '';
        corpo.innerHTML = '';
        corpo.appendChild(vazio({
          icone: 'shield-check', titulo: 'Disponível só com a conta conectada',
          texto: 'Convidar e liberar acesso para a equipe depende da conta da campanha estar conectada — no modo de teste local isso não se aplica.',
        }));
        return;
      }
      corpo.innerHTML = '';
      corpo.appendChild(el('p', { class: 'subtexto', text: 'Carregando…' }));

      let convites = [], membros = [];
      try { convites = await SB.listarConvitesEquipe(); } catch (e) { toast('Não foi possível carregar os convites: ' + e.message, 'erro'); }
      try { membros = await SB.listarMembros(); } catch (e) { toast('Não foi possível carregar os acessos: ' + e.message, 'erro'); }
      const emailPorUser = new Map(convites.map((c) => [c.user_id, c.email]));

      corpoPerfis.innerHTML = '';
      Object.keys(D.PERFIS).forEach((k) => {
        const p = D.PERFIS[k];
        const usados = membros.filter((m) => m.perfil === k && m.ativo).length;
        corpoPerfis.appendChild(el('div', { class: 'cartao' }, [
          el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' } }, [
            el('div', { class: 'ic-box' }, global.ic(p.icone, 15)),
            el('div', { style: { flex: 1 } }, [
              el('b', { text: p.rotulo, style: { fontSize: '13.5px' } }),
              el('div', { class: 'subtexto', text: usados ? usados + ' pessoa(s) com este acesso' : 'ninguém ainda' }),
            ]),
            p.admin ? tag('administra', 'roxo') : p.escreve ? tag('escreve', 'verde') : tag('só consulta', 'cinza'),
          ]),
          el('p', { class: 'subtexto', text: p.descricao }),
        ]));
      });

      corpo.innerHTML = '';
      const aguardandoAceite = convites.filter((c) => c.usado && !c.aceito);
      const aguardandoLink = convites.filter((c) => !c.usado);

      if (aguardandoAceite.length) {
        corpo.appendChild(el('h3', { style: { fontSize: '14px', margin: '4px 0 10px' }, text: aguardandoAceite.length + ' pessoa(s) esperando aceite' }));
        const grade = el('div', { class: 'grade g3', style: { marginBottom: '18px' } });
        aguardandoAceite.forEach((c) => grade.appendChild(cartaoAceite(c)));
        corpo.appendChild(grade);
      }
      if (aguardandoLink.length) {
        corpo.appendChild(el('h3', { style: { fontSize: '14px', margin: '4px 0 10px' }, text: aguardandoLink.length + ' link(s) aguardando ativação' }));
        aguardandoLink.forEach((c) => corpo.appendChild(cartaoLink(c)));
      }

      corpo.appendChild(el('h3', { style: { fontSize: '14px', margin: '4px 0 10px' }, text: 'Acessos ativos' }));
      if (!membros.length) {
        corpo.appendChild(vazio({
          icone: 'shield-check', titulo: 'Ninguém além de você tem acesso ainda',
          texto: 'Convide alguém da equipe pelo botão acima — a pessoa cria a própria senha pelo link e você aceita o acesso aqui depois.',
        }));
      } else {
        corpo.appendChild(global.UI.tabela({
          linhas: membros, ordPadrao: 'perfil', dirPadrao: 'asc', tam: 20, onRow: (m) => abrirMembro(m, emailPorUser.get(m.user_id), redesenhar),
          colunas: [
            { k: 'pessoa', rotulo: 'Pessoa', valor: (m) => (m.pessoas ? m.pessoas.nome : emailPorUser.get(m.user_id)) || '—',
              render: (m) => el('div', {}, [el('b', { text: (m.pessoas ? m.pessoas.nome : null) || emailPorUser.get(m.user_id) || 'sem nome', style: { fontSize: '13px' } }), el('small', { text: emailPorUser.get(m.user_id) || 'sem e-mail conhecido', style: { display: 'block', color: 'var(--txt-3)', fontSize: '11px' } })]) },
            { k: 'perfil', rotulo: 'Perfil', render: (m) => tag(D.PERFIS[m.perfil].rotulo, m.perfil === 'coordenacao_geral' ? 'roxo' : D.PERFIS[m.perfil].escreve ? 'verde' : 'cinza') },
            { k: 'regiao', rotulo: 'Alcance', valor: (m) => (m.regiao_id ? D.nomeTerr(m.regiao_id) : ''),
              render: (m) => m.regiao_id ? D.nomeTerr(m.regiao_id) : (D.PERFIS[m.perfil].rotas === '*' ? 'campanha inteira' : 'próprio trabalho') },
            { k: 'ativo', rotulo: 'Situação', render: (m) => m.ativo ? tag('ativo', 'verde') : tag('suspenso', 'cinza') },
          ],
        }));
      }
    }
    redesenhar();
  };

  function novoConviteEquipe(aoSalvar) {
    const D = global.DB;
    const selPerfil = el('select', {}, Object.keys(D.PERFIS).filter((k) => k !== 'coordenacao_geral').map((k) => el('option', { value: k, text: D.PERFIS[k].rotulo, selected: k === 'mobilizador' })));
    const selRegiao = el('select', {}, [el('option', { value: '', text: 'não se aplica' })].concat(D.regioes.map((r) => el('option', { value: r.id, text: r.nome }))));
    const inpNota = el('input', { type: 'text', placeholder: 'ex.: nome da pessoa, só para você lembrar' });
    const areaLink = el('div', { style: { display: 'none', marginTop: '12px' } });
    const btn = el('button', { class: 'btn primario', type: 'submit', html: global.icHTML('plus', 14) + ' Gerar link de convite' });
    const form = el('form', { class: 'login-form', onsubmit: async (ev) => {
      ev.preventDefault();
      if (selPerfil.value === 'coordenacao_territorial' && !selRegiao.value) return toast('Escolha uma região para coordenação territorial.', 'erro');
      btn.disabled = true;
      try {
        const token = await global.SB.criarConviteEquipe(selPerfil.value, selRegiao.value || null, inpNota.value.trim());
        const link = location.origin + location.pathname + '#/ativar-equipe/' + token;
        areaLink.style.display = 'block';
        areaLink.innerHTML = '';
        areaLink.appendChild(el('div', { class: 'campo' }, [
          el('label', { text: 'Envie este link para a pessoa (WhatsApp, e-mail — o que for melhor)' }),
          el('div', { class: 'filtros', style: { marginBottom: 0 } }, [
            el('input', { type: 'text', readonly: true, value: link, style: { flex: 1 }, onclick: (e) => e.target.select() }),
            el('button', { class: 'btn pequeno', type: 'button', html: global.icHTML('clipboard-list', 13) + ' Copiar', onclick: () => {
              global.U.copiarTexto(link).then(() => toast('Link copiado.'), () => toast('Não foi possível copiar automaticamente — clique no campo e use Cmd/Ctrl+C.', 'erro'));
            } }),
          ]),
        ]));
        if (aoSalvar) aoSalvar();
      } catch (e) { toast(String(e.message || e), 'erro'); }
      btn.disabled = false;
    } }, [
      el('div', { class: 'campo' }, [el('label', { text: 'Perfil' }), selPerfil]),
      el('div', { class: 'campo' }, [el('label', { text: 'Região (apenas para coordenação territorial)' }), selRegiao]),
      el('div', { class: 'campo' }, [el('label', { text: 'Anotação (opcional)' }), inpNota]),
      btn, areaLink,
    ]);
    modal('Convidar para a equipe', form, { wide: true });
  }

  function cartaoAceite(c) {
    const D = global.DB;
    return el('div', { class: 'cartao' }, [
      el('div', { style: { marginBottom: '8px' } }, [
        el('b', { text: c.email || 'sem e-mail', style: { fontSize: '13.5px' } }),
        el('div', { class: 'subtexto', text: D.PERFIS[c.perfil].rotulo + (c.regiao_id ? ' · ' + D.nomeTerr(c.regiao_id) : '') + (c.nota ? ' · ' + c.nota : '') }),
      ]),
      el('div', { class: 'filtros', style: { marginBottom: 0 } }, [
        el('button', { class: 'btn pequeno perigo', text: 'Recusar', onclick: async () => {
          try { await global.SB.cancelarConviteEquipe(c.id); toast('Convite recusado.'); global.refresh(); } catch (e) { toast(String(e.message || e), 'erro'); }
        } }),
        el('button', { class: 'btn pequeno primario', text: 'Aceitar', onclick: () => aceitarConvite(c) }),
      ]),
    ]);
  }

  function aceitarConvite(c) {
    const D = global.DB;
    const inpPessoa = el('input', { type: 'text', placeholder: 'digite o nome, se já estiver cadastrada', list: 'lista-pessoas-aceite' });
    const lista = el('datalist', { id: 'lista-pessoas-aceite' }, D.pessoas.slice(0, 500).map((p) => el('option', { value: p.nome })));
    const corpo = el('div', {}, [
      el('p', { class: 'subtexto', text: 'Confirma o acesso de ' + (c.email || 'esta pessoa') + ' como ' + D.PERFIS[c.perfil].rotulo.toLowerCase() + '?' }),
      el('div', { class: 'campo', style: { marginTop: '10px' } }, [el('label', { text: 'Vincular ao cadastro de pessoas (opcional)' }), inpPessoa, lista]),
    ]);
    const m = modal('Aceitar acesso', corpo, { footer: [
      el('button', { class: 'btn', text: 'Cancelar', onclick: () => m.close() }),
      el('button', { class: 'btn primario', text: 'Confirmar aceite', onclick: async () => {
        const nomeBuscado = inpPessoa.value.trim();
        const p = nomeBuscado ? D.pessoas.find((x) => global.U.norm(x.nome) === global.U.norm(nomeBuscado)) : null;
        if (nomeBuscado && !p) return toast('Não encontrei "' + nomeBuscado + '" no cadastro de pessoas.', 'erro');
        try {
          await global.SB.aceitarConviteEquipe(c.id, p ? p.id : null);
          m.close();
          toast('Acesso liberado.');
          global.refresh();
        } catch (e) { toast(String(e.message || e), 'erro'); }
      } }),
    ]});
  }

  function cartaoLink(c) {
    const D = global.DB;
    const link = location.origin + location.pathname + '#/ativar-equipe/' + c.id;
    return el('div', { class: 'admin-cartao decidida', style: { flexWrap: 'wrap' } }, [
      el('div', { style: { flex: '1 1 220px' } }, [
        el('b', { text: c.nota || D.PERFIS[c.perfil].rotulo }),
        el('div', { class: 'subtexto', text: D.PERFIS[c.perfil].rotulo + (c.regiao_id ? ' · ' + D.nomeTerr(c.regiao_id) : '') + ' · gerado em ' + new Date(c.criado_em).toLocaleDateString('pt-BR') }),
      ]),
      el('span', { class: 'tag laranja ponto', text: 'aguardando' }),
      el('input', { type: 'text', readonly: true, value: link, style: { flex: '1 1 100%', marginTop: '8px' }, onclick: (e) => e.target.select() }),
      el('div', { class: 'filtros', style: { marginTop: '8px', marginBottom: 0 } }, [
        el('button', { class: 'btn pequeno', html: global.icHTML('clipboard-list', 13) + ' Copiar link', onclick: () => {
          global.U.copiarTexto(link).then(() => toast('Link copiado.'), () => toast('Não foi possível copiar automaticamente — clique no campo acima e use Cmd/Ctrl+C.', 'erro'));
        } }),
        el('button', { class: 'btn pequeno perigo', text: 'Cancelar convite', onclick: async () => {
          try { await global.SB.cancelarConviteEquipe(c.id); toast('Convite cancelado.'); global.refresh(); } catch (e) { toast(String(e.message || e), 'erro'); }
        } }),
      ]),
    ]);
  }

  function abrirMembro(m, email, aoMudar) {
    const D = global.DB;
    const corpo = el('div', {}, [
      el('div', { class: 'filtros' }, [
        tag(D.PERFIS[m.perfil].rotulo, 'roxo'),
        m.regiao_id ? tag(D.nomeTerr(m.regiao_id), 'azul') : null,
        m.ativo ? tag('ativo', 'verde') : tag('suspenso', 'cinza'),
      ]),
      dado('Pessoa', m.pessoas ? m.pessoas.nome : 'não vinculada ao cadastro'),
      dado('E-mail', email || 'não disponível'),
      dado('Acesso desde', global.U.fmtDate(m.criado_em)),
      email ? el('div', { class: 'divisor' }) : null,
      email ? el('p', { class: 'subtexto', text: 'A pessoa pode pedir uma nova senha a qualquer momento — o link vai direto para o e-mail dela, ninguém aqui vê ou define a senha.' }) : null,
    ]);
    const botoes = [
      el('button', { class: 'btn perigo', text: 'Remover acesso', onclick: async () => {
        try { await global.SB.removerMembro(m.id); mod.close(); toast('Acesso removido.'); global.refresh(); } catch (e) { toast(String(e.message || e), 'erro'); }
      } }),
      el('button', { class: 'btn', text: m.ativo ? 'Suspender' : 'Reativar', onclick: async () => {
        try { await global.SB.editarMembro(m.id, { ativo: !m.ativo }); mod.close(); toast('Situação atualizada.'); global.refresh(); } catch (e) { toast(String(e.message || e), 'erro'); }
      } }),
    ];
    if (email) botoes.push(el('button', { class: 'btn', html: global.icHTML('key', 14) + ' Enviar redefinição de senha', onclick: async () => {
      try { await global.SB.enviarRedefinicaoSenha(email); toast('E-mail de redefinição enviado para ' + email + '.'); } catch (e) { toast(String(e.message || e), 'erro'); }
    } }));
    botoes.push(el('button', { class: 'btn primario', text: 'Fechar', onclick: () => mod.close() }));
    const mod = modal('Acesso de ' + (m.pessoas ? m.pessoas.nome : (email || 'pessoa')), corpo, { wide: true, footer: botoes });
  }

  /* ==========================  CONFIGURAÇÃO  ========================== */
  global.VIEWS['config'] = function (alvo) {
    const D = global.DB;
    const cfg = D.config;

    alvo.appendChild(cabecalho('Configurações', 'Identificação da campanha, banco de dados, backup e manutenção da base'));

    /* --- dados da campanha --- */
    const campos = {};
    const campo = (k, rot, tipo, valor, opcoes) => {
      let node;
      if (tipo === 'select') node = el('select', {}, opcoes.map((o) => el('option', { value: o, text: o, selected: o === valor })));
      else { node = el('input', { type: tipo || 'text' }); node.value = valor || ''; }
      campos[k] = node;
      return el('div', { class: 'campo' }, [el('label', { text: rot }), node]);
    };
    const formCampanha = el('div', {}, [
      campo('candidato', 'Nome da candidatura', 'text', cfg.candidato),
      el('div', { class: 'campo-linha' }, [
        campo('cargo', 'Cargo', 'select', cfg.cargo || 'Prefeito(a)', ['Prefeito(a)', 'Vice-prefeito(a)', 'Vereador(a)', 'Deputado(a) estadual', 'Deputado(a) federal', 'Senador(a)', 'Governador(a)']),
        campo('ano', 'Ano da eleição', 'number', cfg.ano),
      ]),
      el('div', { class: 'campo-linha' }, [
        campo('municipio', 'Município', 'text', cfg.municipio),
        campo('uf', 'UF', 'text', cfg.uf),
      ]),
      campo('dataEleicao', 'Data da eleição', 'date', cfg.dataEleicao),
      el('button', { class: 'btn primario', style: { marginTop: '6px' }, html: global.icHTML('check', 14) + ' Salvar identificação', onclick: () => {
        const dados = {};
        Object.keys(campos).forEach((k) => { dados[k] = campos[k].value.trim ? campos[k].value.trim() : campos[k].value; });
        if (!dados.candidato || !dados.municipio) return toast('Informe ao menos a candidatura e o município.', 'erro');
        dados.ano = +dados.ano || new Date().getFullYear();
        D.salvarConfig(dados);
        toast('Identificação da campanha salva.');
        global.refresh();
      } }),
    ]);

    /* --- banco de dados --- */
    const SB = global.SB;
    const sbCfg = SB.cfg;
    const inpUrl = el('input', { type: 'text', placeholder: 'https://xxxxxxxx.supabase.co' });
    inpUrl.value = sbCfg.url || '';
    const inpChave = el('input', { type: 'password', placeholder: 'chave anon (publishable) do projeto' });
    inpChave.value = sbCfg.chave || '';
    const selCampanha = el('select', {}, [el('option', { value: '', text: 'conecte para listar' })]);
    const estadoConexao = el('div', { class: 'subtexto', style: { marginTop: '8px' } });

    const mostrarEstado = (txt, ok) => {
      estadoConexao.innerHTML = '';
      estadoConexao.appendChild(el('span', { class: 'tag ' + (ok ? 'verde' : 'vermelho') + ' ponto', text: txt }));
    };
    if (SB.configurado()) mostrarEstado(SB.autenticado() ? 'conectado — os dados são salvos automaticamente' : 'falta entrar na conta', SB.autenticado());
    else mostrarEstado('modo de teste: os dados ficam só neste navegador', false);

    const formBanco = SB.autenticado() ? el('div', {}, [
      estadoConexao,
      el('div', { class: 'filtros', style: { marginTop: '10px' } }, [
        el('button', { class: 'btn perigo', html: global.icHTML('log-out', 14) + ' Sair da conta', onclick: () => { SB.sair(); location.reload(); } }),
      ]),
    ]) : el('div', {}, [
      el('p', { class: 'subtexto', text: 'Sem conta conectada, o sistema funciona só neste navegador — bom para testar, insuficiente para a equipe.' }),
      el('div', { class: 'divisor' }),
      el('div', { class: 'campo' }, [el('label', { text: 'URL do projeto' }), inpUrl]),
      el('div', { class: 'campo' }, [el('label', { text: 'Chave pública (anon)' }), inpChave]),
      el('div', { class: 'filtros' }, [
        el('button', { class: 'btn', html: global.icHTML('shield-check', 14) + ' Testar conexão', onclick: async () => {
          SB.salvarCfg({ url: inpUrl.value.trim(), chave: inpChave.value.trim() });
          try {
            const campanhas = await SB.testar();
            selCampanha.innerHTML = '';
            (campanhas || []).forEach((c) => selCampanha.appendChild(el('option', { value: c.id, text: c.nome + ' — ' + c.municipio, selected: c.id === sbCfg.campanhaId })));
            if (!campanhas || !campanhas.length) selCampanha.appendChild(el('option', { value: '', text: 'nenhuma campanha cadastrada no projeto' }));
            mostrarEstado('conexão bem-sucedida · ' + (campanhas || []).length + ' campanha(s)', true);
          } catch (e) {
            mostrarEstado(String(e.message || e), false);
          }
        } }),
        el('button', { class: 'btn', html: global.icHTML('user-round', 14) + ' Entrar', onclick: () => entrar() }),
      ]),
      el('div', { class: 'campo' }, [el('label', { text: 'Campanha a sincronizar' }), selCampanha]),
      el('div', { class: 'filtros' }, [
        el('button', { class: 'btn', html: global.icHTML('download', 14) + ' Baixar do banco', onclick: async () => {
          SB.salvarCfg({ campanhaId: selCampanha.value });
          try {
            await SB.baixarTudo();
            toast('Base sincronizada a partir do banco.');
            global.refresh();
          } catch (e) { toast(String(e.message || e), 'erro'); }
        } }),
        el('button', { class: 'btn', html: global.icHTML('upload', 14) + ' Enviar pendências (' + SB.pendentes + ')', onclick: async () => {
          try {
            const r = await SB.enviarFila();
            toast(r.enviados + ' registro(s) enviado(s) · ' + r.pendentes + ' pendente(s).');
          } catch (e) { toast(String(e.message || e), 'erro'); }
        } }),
      ]),
      estadoConexao,
    ]);

    /* --- backup e manutenção --- */
    const arquivo = el('input', { type: 'file', accept: '.json', style: { display: 'none' }, onchange: (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const leitor = new FileReader();
      leitor.onload = () => {
        try {
          global.DB.importarBase(leitor.result);
          toast('Backup importado: ' + num(global.DB.pessoas.length) + ' pessoas.');
          global.refresh();
        } catch (err) { toast('Arquivo inválido: ' + err.message, 'erro'); }
      };
      leitor.readAsText(f);
    }});

    const formBackup = el('div', {}, [
      el('p', { class: 'subtexto', text: 'O backup é um arquivo com toda a base — pessoas, território, operação e histórico. Guarde uma cópia com frequência, principalmente enquanto o sistema estiver em modo local.' }),
      el('div', { class: 'filtros', style: { marginTop: '12px' } }, [
        el('button', { class: 'btn', html: global.icHTML('download', 14) + ' Exportar backup', onclick: () => {
          const url = URL.createObjectURL(new Blob([global.DB.exportarBase()], { type: 'application/json' }));
          const a = el('a', { href: url, download: 'sigc-' + (cfg.municipio || 'campanha').toLowerCase().replace(/\s+/g, '-') + '-' + iso(new Date()) + '.json' });
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
          toast('Backup gerado.');
        } }),
        el('button', { class: 'btn', html: global.icHTML('upload', 14) + ' Importar backup', onclick: () => arquivo.click() }),
        arquivo,
      ]),
      el('div', { class: 'divisor' }),
      el('div', { class: 'filtros', style: { marginBottom: 0 } }, [
        el('button', { class: 'btn', html: global.icHTML('sparkles', 14) + ' Carregar demonstração', onclick: carregarDemo }),
        el('button', { class: 'btn perigo', html: global.icHTML('circle-x', 14) + ' Zerar a base', onclick: () => {
          const m = modal('Zerar a base', el('div', {}, [
            el('p', { class: 'subtexto', text: 'Isto apaga tudo o que está neste navegador: pessoas, território, tarefas, eventos e histórico. Exporte um backup antes se tiver dúvida. Esta ação não pode ser desfeita.' }),
          ]), { footer: [
            el('button', { class: 'btn', text: 'Cancelar', onclick: () => m.close() }),
            el('button', { class: 'btn perigo', text: 'Apagar tudo', onclick: () => { global.DB.zerar(); m.close(); toast('Base zerada. A plataforma está pronta para começar.'); location.hash = '#/inicio'; global.refresh(); } }),
          ]});
        } }),
      ]),
    ]);

    const selPerfil = el('select', {}, Object.keys(D.PERFIS).map((k) => el('option', { value: k, text: D.PERFIS[k].rotulo, selected: k === D.perfil })));
    const cardPerfil = cartao('Perfil em uso', global.SB.autenticado() ? 'Definido pelo banco, conforme o seu usuário' : 'No modo local o sistema assume coordenação geral', [
      el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' } }, [
        el('div', { class: 'ic-box' }, global.ic(D.perfilInfo().icone, 15)),
        el('div', {}, [el('b', { text: D.perfilInfo().rotulo }), el('div', { class: 'subtexto', text: D.perfilInfo().descricao })]),
      ]),
      global.SB.autenticado() ? el('p', { class: 'subtexto', text: 'Seu alcance vem do cadastro de acessos da campanha e é aplicado pelo próprio banco de dados.' })
        : el('div', {}, [
          el('div', { class: 'divisor' }),
          el('div', { class: 'campo' }, [
            el('label', { text: 'Ver o sistema como' }), selPerfil,
            el('small', { class: 'subtexto', text: 'Serve para conferir o que cada perfil enxerga antes de dar acesso a alguém. É pré-visualização de tela: no modo local não há proteção de dados — quem protege é o banco.' }),
          ]),
          el('button', { class: 'btn', html: global.icHTML('eye', 14) + ' Pré-visualizar', onclick: () => { D.simularPerfil(selPerfil.value); global.remontar(); } }),
        ]),
    ]);

    const s = D.stats();
    alvo.appendChild(el('div', { class: 'grade g2' }, [
      cartao('Identificação da campanha', 'Aparece nos relatórios e no painel', [formCampanha]),
      el('div', { class: 'grade', style: { gap: '14px', alignContent: 'start' } }, [
        cardPerfil,
        cartao('Sua conta', global.SB.autenticado() ? 'Acesso e sincronização' : 'Modo de teste — dados só neste navegador', [formBanco]),
        cartao('Backup e manutenção', 'Base atual: ' + num(s.total) + ' pessoas, ' + D.bairros.length + ' bairros, ' + D.tarefas.length + ' tarefas', [formBackup]),
      ]),
    ]));
  };

  function entrar() {
    const email = el('input', { type: 'email', placeholder: 'seu e-mail cadastrado no projeto' });
    const senha = el('input', { type: 'password', placeholder: 'sua senha' });
    const m = modal('Entrar no banco da campanha', el('div', {}, [
      el('p', { class: 'subtexto', text: 'As credenciais são suas e vão direto para o seu projeto Supabase — o sistema não as guarda em lugar nenhum além da sessão deste navegador.' }),
      el('div', { class: 'campo', style: { marginTop: '12px' } }, [el('label', { text: 'E-mail' }), email]),
      el('div', { class: 'campo' }, [el('label', { text: 'Senha' }), senha]),
    ]), { footer: [
      el('button', { class: 'btn', text: 'Cancelar', onclick: () => m.close() }),
      el('button', { class: 'btn primario', text: 'Entrar', onclick: async () => {
        try {
          await global.SB.entrar(email.value.trim(), senha.value);
          m.close();
          toast('Autenticado no banco da campanha.');
          global.refresh();
        } catch (e) { toast(String(e.message || e), 'erro'); }
      } }),
    ]});
    setTimeout(() => email.focus(), 60);
  }
})(window);

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
      'A plataforma está vazia e pronta para receber os dados da sua campanha — ' + feitos + ' de ' + passos.length + ' primeiros passos concluídos'));

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
    const D = global.DB;
    const A = D.acessos;

    alvo.appendChild(cabecalho('Acessos ao sistema',
      'Quem entra no sistema e com que alcance — a seção 28 do documento aplicada na prática', [
      el('button', { class: 'btn pequeno primario', html: global.icHTML('plus', 14) + ' Dar acesso', onclick: () => novoAcesso() }),
    ]));

    /* perfis disponíveis, explicados */
    alvo.appendChild(el('div', { class: 'grade g3', style: { marginBottom: '18px' } },
      Object.keys(D.PERFIS).map((k) => {
        const p = D.PERFIS[k];
        const usados = A.filter((a) => a.perfil === k && a.ativo).length;
        return el('div', { class: 'cartao' }, [
          el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' } }, [
            el('div', { class: 'ic-box' }, global.ic(p.icone, 15)),
            el('div', { style: { flex: 1 } }, [
              el('b', { text: p.rotulo, style: { fontSize: '13.5px' } }),
              el('div', { class: 'subtexto', text: usados ? usados + ' pessoa(s) com este acesso' : 'ninguém ainda' }),
            ]),
            p.admin ? tag('administra', 'roxo') : p.escreve ? tag('escreve', 'verde') : tag('só consulta', 'cinza'),
          ]),
          el('p', { class: 'subtexto', text: p.descricao }),
        ]);
      })
    ));

    /* lista de pessoas com acesso */
    if (!A.length) {
      alvo.appendChild(vazio({
        icone: 'shield-check', titulo: 'Ninguém além de você tem acesso ainda',
        texto: 'Cada pessoa da campanha entra com o próprio usuário e enxerga apenas o que o perfil dela permite. Registre aqui quem vai usar o sistema e com qual alcance.',
        acao: { rotulo: 'Dar o primeiro acesso', onclick: () => novoAcesso() },
      }));
    } else {
      alvo.appendChild(global.UI.tabela({
        linhas: A, ordPadrao: 'perfil', dirPadrao: 'asc', tam: 20, onRow: (a) => editarAcesso(a),
        colunas: [
          { k: 'pessoa', rotulo: 'Pessoa', valor: (a) => (a.pessoaId ? D.nome(a.pessoaId) : a.email),
            render: (a) => a.pessoaId ? global.UI.pessoaCell(a.pessoaId, a.email || 'sem e-mail informado')
              : el('div', {}, [el('b', { text: a.email, style: { fontSize: '13px' } }), el('small', { text: 'ainda sem vínculo com o cadastro', style: { display: 'block', color: 'var(--txt-3)', fontSize: '11px' } })]) },
          { k: 'perfil', rotulo: 'Perfil', render: (a) => tag(D.PERFIS[a.perfil].rotulo, a.perfil === 'coordenacao_geral' ? 'roxo' : D.PERFIS[a.perfil].escreve ? 'verde' : 'cinza') },
          { k: 'regiao', rotulo: 'Alcance', valor: (a) => (a.regiaoId ? D.nomeTerr(a.regiaoId) : ''),
            render: (a) => a.regiaoId ? D.nomeTerr(a.regiaoId) : (D.PERFIS[a.perfil].rotas === '*' ? 'campanha inteira' : 'próprio trabalho') },
          { k: 'email', rotulo: 'E-mail de entrada' },
          { k: 'ativo', rotulo: 'Situação', render: (a) => a.ativo ? tag('ativo', 'verde') : tag('suspenso', 'cinza') },
          { k: 'sincronizado', rotulo: 'No banco', render: (a) => a.sincronizado ? tag('vinculado', 'verde') : tag('pendente', 'laranja') },
        ],
      }));
      alvo.appendChild(el('p', { class: 'subtexto', style: { marginTop: '12px' } },
        'Registrar aqui define o alcance de cada pessoa. Para que ela consiga entrar de fato, o usuário precisa existir no projeto Supabase — clique em uma linha para copiar o comando que faz o vínculo.'));
    }
  };

  function novoAcesso() {
    const D = global.DB;
    const pessoas = D.pessoas.filter((p) => D.funcaoDe(p.id)).concat(D.pessoas.filter((p) => !D.funcaoDe(p.id)));
    formModal('Dar acesso ao sistema', [
      { k: 'pessoa', rot: 'Pessoa (já cadastrada)', tipo: 'pessoa', dica: 'digite o nome de quem vai usar o sistema' },
      { k: 'email', rot: 'E-mail de entrada', tipo: 'texto', obrigatorio: true, dica: 'o mesmo e-mail que será criado no banco' },
      { k: 'perfil', rot: 'Perfil', tipo: 'select', opcoes: Object.keys(D.PERFIS).map((k) => ({ v: k, t: D.PERFIS[k].rotulo })), valor: 'mobilizador' },
      { k: 'regiaoId', rot: 'Região (apenas para coordenação territorial)', tipo: 'select',
        opcoes: [{ v: '', t: 'não se aplica' }].concat(D.regioes.map((r) => ({ v: r.id, t: r.nome }))) },
    ], (v) => {
      const p = v.pessoa ? D.pessoas.find((x) => global.U.norm(x.nome) === global.U.norm(v.pessoa)) : null;
      if (v.pessoa && !p) return 'Não encontrei "' + v.pessoa + '" no cadastro de pessoas.';
      if (v.perfil === 'coordenacao_territorial' && !v.regiaoId) return 'Coordenação territorial precisa de uma região.';
      const r = D.addAcesso({ pessoaId: p ? p.id : null, email: v.email, perfil: v.perfil, regiaoId: v.regiaoId || null });
      if (typeof r === 'string') return r;
      toast('Acesso registrado para ' + (p ? p.nome.split(' ')[0] : v.email) + '.');
    }, { acao: 'Registrar acesso', nota: 'O perfil define o que a pessoa enxerga. Quem é coordenação territorial vê apenas a região escolhida.' });
  }

  function editarAcesso(a) {
    const D = global.DB;
    const sql = "insert into membros (campanha_id, user_id, pessoa_id, perfil, regiao_id)\n" +
      "select '" + (global.SB.cfg.campanhaId || '<id-da-campanha>') + "', u.id, " +
      (a.pessoaId ? "'<id-da-pessoa-no-banco>'" : 'null') + ", '" + a.perfil + "', " +
      (a.regiaoId ? "'<id-da-regiao-no-banco>'" : 'null') + "\n" +
      "from auth.users u where u.email = '" + a.email + "';";
    const corpo = el('div', {}, [
      el('div', { class: 'filtros' }, [
        tag(D.PERFIS[a.perfil].rotulo, 'roxo'),
        a.regiaoId ? tag(D.nomeTerr(a.regiaoId), 'azul') : null,
        a.ativo ? tag('ativo', 'verde') : tag('suspenso', 'cinza'),
      ]),
      dado('Pessoa', a.pessoaId ? D.nome(a.pessoaId) : 'não vinculada ao cadastro'),
      dado('E-mail', a.email || '—'),
      dado('Registrado em', global.U.fmtDate(a.criadoEm)),
      el('div', { class: 'divisor' }),
      el('p', { class: 'subtexto', text: 'Para esta pessoa entrar de fato, crie o usuário em Authentication → Users no Supabase e rode o comando abaixo no SQL Editor:' }),
      el('pre', { class: 'bloco-sql', text: sql }),
      el('div', { class: 'filtros', style: { marginTop: '10px' } }, [
        el('button', { class: 'btn pequeno', html: global.icHTML('clipboard-list', 13) + ' Copiar comando', onclick: () => {
          navigator.clipboard.writeText(sql).then(() => toast('Comando copiado.'), () => toast('Não foi possível copiar.', 'erro'));
        } }),
      ]),
    ]);
    const m = modal('Acesso de ' + (a.pessoaId ? D.nome(a.pessoaId) : a.email), corpo, { wide: true, footer: [
      el('button', { class: 'btn perigo', text: 'Remover acesso', onclick: () => { D.removerAcesso(a.id); m.close(); toast('Acesso removido.'); global.refresh(); } }),
      el('button', { class: 'btn', text: a.ativo ? 'Suspender' : 'Reativar', onclick: () => { D.editarAcesso(a.id, { ativo: !a.ativo }); m.close(); toast('Situação atualizada.'); global.refresh(); } }),
      el('button', { class: 'btn primario', text: 'Fechar', onclick: () => m.close() }),
    ]});
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
    if (SB.configurado()) mostrarEstado(SB.autenticado() ? 'projeto conectado e autenticado' : 'projeto configurado — falta entrar', SB.autenticado());
    else mostrarEstado('modo local: os dados ficam apenas neste navegador', false);

    const formBanco = el('div', {}, [
      el('p', { class: 'subtexto', text: 'Sem banco, o sistema funciona só neste navegador — bom para testar, insuficiente para a equipe. Com o projeto Supabase conectado, todo mundo trabalha na mesma base e as regras de acesso da seção 28 passam a valer.' }),
      el('div', { class: 'divisor' }),
      el('div', { class: 'campo' }, [el('label', { text: 'URL do projeto' }), inpUrl]),
      el('div', { class: 'campo' }, [el('label', { text: 'Chave pública (anon)' }), inpChave,
        el('small', { class: 'subtexto', text: 'Cole aqui a chave anon do seu projeto. Ela é pública por natureza — quem protege os dados são as políticas de acesso do arquivo 02_rls.sql.' })]),
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
        SB.autenticado() ? el('button', { class: 'btn', html: global.icHTML('log-out', 14) + ' Sair', onclick: () => { SB.sair(); location.reload(); } }) : null,
        el('button', { class: 'btn perigo', text: 'Desconectar deste banco', onclick: () => { SB.limparCfg(); SB.sair(); toast('Projeto desconectado. O sistema voltou ao modo local.'); location.reload(); } }),
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
        cartao('Banco de dados', 'Modo atual: ' + (global.SB.configurado() ? 'Supabase' : 'local (somente este navegador)'), [formBanco]),
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

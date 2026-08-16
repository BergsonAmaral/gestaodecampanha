/* ==========================================================================
   app.js — casca da aplicação: navegação, rotas, busca global e tema
   ========================================================================== */
(function (global) {
  'use strict';
  const { $, el, esc, num, store, toast, norm, initials, debounce } = global.U;
  const VIEWS = (global.VIEWS = global.VIEWS || {});

  const MENU = [
    { grupo: 'Acompanhar', nota: 'leitura da campanha', itens: [
      { rota: '', icone: 'layout-dashboard', rotulo: 'Painel geral' },
      { rota: 'alertas', icone: 'triangle-alert', rotulo: 'Alertas', badge: () => global.DB.alertas().filter((a) => a.nivel === 'alto').length },
      { rota: 'territorio', icone: 'map', rotulo: 'Mapa territorial' },
      { rota: 'mobilizacao', icone: 'trending-up', rotulo: 'Mobilização' },
      { rota: 'performance', icone: 'zap', rotulo: 'Performance' },
      { rota: 'financeiro', icone: 'wallet', rotulo: 'Financeiro' },
      { rota: 'pesquisas', icone: 'chart-column', rotulo: 'Pesquisas' },
      { rota: 'relatorios', icone: 'file-text', rotulo: 'Relatórios' },
    ]},
    { grupo: 'Cadastros', nota: 'o que a campanha registra', itens: [
      { rota: 'pessoas', icone: 'users', rotulo: 'Pessoas' },
      { rota: 'liderancas', icone: 'star', rotulo: 'Lideranças' },
      { rota: 'territorios', icone: 'map-pin', rotulo: 'Territórios' },
      { rota: 'equipes', icone: 'users-round', rotulo: 'Equipes e núcleos' },
      { rota: 'materiais', icone: 'package', rotulo: 'Materiais' },
      { rota: 'recursos', icone: 'truck', rotulo: 'Veículos e recursos' },
    ]},
    { grupo: 'Sistema', nota: 'configuração e base', itens: [
      { rota: 'inicio', icone: 'compass', rotulo: 'Primeiros passos' },
      { rota: 'acessos', icone: 'shield-check', rotulo: 'Acessos', admin: true },
      { rota: 'config', icone: 'settings', rotulo: 'Configurações', badge: () => global.SB.pendentes, neutro: true },
    ]},
    { grupo: 'Ação', nota: 'o que a campanha faz', itens: [
      { rota: 'tarefas', icone: 'list-checks', rotulo: 'Tarefas', badge: () => global.DB.stats().tarefasAtrasadas },
      { rota: 'agenda', icone: 'calendar-days', rotulo: 'Agenda' },
      { rota: 'eventos', icone: 'megaphone', rotulo: 'Eventos' },
      { rota: 'demandas', icone: 'inbox', rotulo: 'Demandas', badge: () => global.DB.stats().demandasPendentes, neutro: true },
      { rota: 'metas', icone: 'target', rotulo: 'Metas' },
      { rota: 'eleicao', icone: 'vote', rotulo: 'Dia da eleição' },
    ]},
  ];

  /* ---------------- casca ---------------- */
  function montarCasca() {
    const app = el('div', { class: 'app' + (store.get('sidebar') === 'colapsada' ? ' colapsado' : '') });

    const nav = el('nav', { class: 'nav' });
    MENU.forEach((g) => {
      const permitidos = g.itens.filter((it) => global.DB.podeVer(it.rota) && (!it.admin || global.DB.ehAdmin()));
      if (!permitidos.length) return;
      nav.appendChild(el('div', { class: 'nav-grupo-titulo', title: g.nota || '' }, [
        el('span', { text: g.grupo }),
        g.nota ? el('em', { text: g.nota }) : null,
      ]));
      permitidos.forEach((it) => {
        const item = el('div', { class: 'nav-item', dataset: { rota: it.rota }, title: it.rotulo, onclick: () => {
          location.hash = '#/' + it.rota;
          if (ehCelular()) $('.app').classList.remove('menu-aberto');
        } }, [
          global.ic(it.icone, 17),
          el('span', { text: it.rotulo }),
        ]);
        if (it.badge) {
          const v = it.badge();
          if (v) item.appendChild(el('em', { class: 'nav-badge' + (it.neutro ? ' neutro' : ''), text: v, style: { fontStyle: 'normal' } }));
        }
        nav.appendChild(item);
      });
    });

    const sidebar = el('aside', { class: 'sidebar' }, [
      el('div', { class: 'marca', onclick: alternarSidebar, style: { cursor: 'pointer' } }, [
        el('img', { class: 'marca-icone', src: 'assets/img/logo-icone.png', alt: 'SIGC' }),
        el('div', { class: 'marca-txt' }, [
          el('b', { text: global.DB.config.candidato || 'Sistema de Gestão de Campanha' }),
          el('span', { text: global.DB.config.municipio ? global.DB.config.municipio + ' · ' + global.DB.config.ano : 'campanha não configurada' }),
        ]),
      ]),
      nav,
      el('div', { class: 'rodape-user', onclick: () => (location.hash = '#/config'), title: 'Perfil em uso e configurações' }, [
        el('div', { class: 'avatar apo' }, global.ic(global.DB.perfilInfo().icone, 15)),
        el('div', {}, [
          el('b', { text: global.DB.perfilInfo().rotulo }),
          el('span', { text: global.SB.configurado() ? (global.SB.autenticado() ? 'banco conectado' : 'falta entrar no banco') : 'modo local' }),
        ]),
      ]),
    ]);

    const st = global.DB.stats();
    const busca = el('div', { class: 'busca' }, [
      global.ic('search', 15),
      el('input', { type: 'text', id: 'busca-global', placeholder: 'Buscar pessoa, liderança, bairro, equipe, evento…', autocomplete: 'off' }),
      el('span', { class: 'busca-atalho', text: '/' }),
      el('div', { class: 'busca-resultados', id: 'busca-res' }),
    ]);

    const topbar = el('header', { class: 'topbar' }, [
      el('button', { class: 'icon-btn', html: global.icHTML('panel-left', 17), title: 'Menu', onclick: alternarSidebar }),
      busca,
      el('button', { class: 'icon-btn so-celular', html: global.icHTML('search', 16), title: 'Buscar', onclick: () => {
        busca.classList.toggle('aberta');
        if (busca.classList.contains('aberta')) setTimeout(() => $('#busca-global').focus(), 60);
      } }),
      el('div', { class: 'top-acoes' }, [
        st.diasEleicao !== null ? el('div', { class: 'contagem-regressiva', title: 'Dias para a eleição' }, [
          el('b', { text: st.diasEleicao }),
          el('span', { html: 'dias para<br>a eleição' }),
        ]) : null,
        global.DB.podeEscrever() ? el('button', { class: 'btn pequeno primario', html: global.icHTML('plus', 14) + ' Registrar', onclick: registroRapido }) : null,
        el('button', { class: 'icon-btn', html: global.icHTML(store.get('tema', 'claro') === 'escuro' ? 'sun' : 'moon', 16), id: 'btn-tema', title: 'Alternar tema', onclick: alternarTema }),
      ]),
    ]);

    const conteudo = el('main', { class: 'conteudo', id: 'conteudo' });
    app.appendChild(el('div', { class: 'menu-fundo', onclick: () => app.classList.remove('menu-aberto') }));
    app.appendChild(sidebar);
    app.appendChild(el('div', { class: 'principal' }, [topbar, conteudo]));
    document.body.appendChild(app);

    const input = $('#busca-global');
    input.addEventListener('input', debounce(() => buscaGlobal(input.value), 160));
    input.addEventListener('focus', () => input.value && buscaGlobal(input.value));
    input.addEventListener('keydown', (e) => {
      const abertos = $('#busca-res').classList.contains('abrir');
      if (e.key === 'ArrowDown' && abertos) { e.preventDefault(); marcar(selIdx + 1); }
      else if (e.key === 'ArrowUp' && abertos) { e.preventDefault(); marcar(selIdx - 1); }
      else if (e.key === 'Enter' && abertos && selIdx >= 0) { e.preventDefault(); itensBusca()[selIdx].click(); input.blur(); }
      else if (e.key === 'Escape') { $('#busca-res').classList.remove('abrir'); input.blur(); }
    });
    document.addEventListener('click', (e) => {
      if (e.target.closest('.busca') || e.target.closest('.so-celular')) return;
      $('#busca-res').classList.remove('abrir');
      if (ehCelular()) global.U.$('.busca').classList.remove('aberta');
    });
    document.addEventListener('keydown', (e) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
        e.preventDefault();
        input.focus();
        input.select();
      }
    });
  }

  const ehCelular = () => window.matchMedia('(max-width:760px)').matches;

  function alternarSidebar() {
    const app = $('.app');
    if (ehCelular()) return app.classList.toggle('menu-aberto');
    app.classList.toggle('colapsado');
    store.set('sidebar', app.classList.contains('colapsado') ? 'colapsada' : 'aberta');
    setTimeout(() => window.dispatchEvent(new Event('resize')), 260);
  }
  function alternarTema() {
    const novo = document.documentElement.dataset.tema === 'escuro' ? 'claro' : 'escuro';
    document.documentElement.dataset.tema = novo;
    store.set('tema', novo);
    $('#btn-tema').innerHTML = global.icHTML(novo === 'escuro' ? 'sun' : 'moon', 16);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
  }

  function registroRapido() {
    if (!global.UI.exigeEscrita()) return;
    const D = global.DB;
    const campos = {};
    const campo = (rot, node, chave) => { campos[chave] = node; return el('div', { class: 'campo' }, [el('label', { text: rot }), node]); };
    const selBairro = el('select', {}, D.bairros.map((b) => el('option', { value: b.id, text: b.nome })));
    const selClass = el('select', {}, D.CLASSIF.map((c) => el('option', { value: c, text: D.CLASSIF_LABEL[c] })));
    const selOrigem = el('select', {}, D.ORIGENS.map((o) => el('option', { value: o, text: o })));
    const inpIndic = el('input', { type: 'text', placeholder: 'Digite o nome de quem trouxe esta pessoa', list: 'lista-indicadores' });
    const sugestoes = el('datalist', { id: 'lista-indicadores' },
      D.pessoas.filter((p) => ['mobilizador', 'lideranca'].includes(p.classificacao)).slice(0, 300).map((p) => el('option', { value: p.nome })));

    const form = el('div', {}, [
      campo('Nome completo *', el('input', { type: 'text', placeholder: 'Ex.: João da Silva Sousa' }), 'nome'),
      el('div', { class: 'campo-linha' }, [
        campo('Telefone', el('input', { type: 'text', placeholder: '(88) 99999-0000' }), 'telefone'),
        campo('Bairro', selBairro, 'bairro'),
      ]),
      el('div', { class: 'campo-linha' }, [
        campo('Classificação', selClass, 'classificacao'),
        campo('Origem do contato', selOrigem, 'origem'),
      ]),
      campo('Quem indicou', inpIndic, 'indicou'),
      campo('Observação / primeiro contato', el('textarea', { rows: 3, placeholder: 'Ex.: abordada na feira, demonstrou interesse em ajudar no bairro.' }), 'obs'),
      sugestoes,
      el('p', { class: 'subtexto', text: 'A pessoa entra na base com o histórico já iniciado: data, quem cadastrou e origem.' }),
    ]);

    const salvar = () => {
      const nome = campos.nome.value.trim();
      if (nome.length < 3) { campos.nome.focus(); return toast('Informe o nome completo da pessoa.', 'erro'); }
      const ind = D.pessoas.find((p) => norm(p.nome) === norm(campos.indicou.value.trim()));
      const p = D.addPessoa({
        nome, telefone: campos.telefone.value.trim(), bairroId: campos.bairro.value,
        classificacao: campos.classificacao.value, origem: campos.origem.value,
        indicadoPor: ind ? ind.id : null, obs: campos.obs.value.trim(),
      });
      m.close();
      toast(nome.split(' ')[0] + ' foi cadastrado(a) e vinculado(a) a ' + D.terr(p.bairroId).nome + '.');
      location.hash = '#/pessoas/' + p.id;
    };
    const m = global.U.modal('Registro rápido de pessoa', form, {
      footer: [
        el('button', { class: 'btn', text: 'Cancelar', onclick: () => m.close() }),
        el('button', { class: 'btn primario', text: 'Salvar cadastro', onclick: salvar }),
      ],
    });
    setTimeout(() => campos.nome.focus(), 60);
  }

  global.registroRapido = registroRapido;

  /* ---------------- busca global ---------------- */
  function buscaGlobal(q) {
    const box = $('#busca-res');
    q = norm(q).trim();
    if (q.length < 2) return box.classList.remove('abrir');
    const D = global.DB;
    const res = [];
    D.pessoas.filter((p) => norm(p.nome).includes(q)).slice(0, 6).forEach((p) =>
      res.push({ cat: 'Pessoas', txt: p.nome, sub: D.CLASSIF_LABEL[p.classificacao] + ' · ' + D.terr(p.bairroId).nome, rota: '#/pessoas/' + p.id, ini: initials(p.nome) }));
    D.bairros.filter((b) => norm(b.nome).includes(q)).slice(0, 4).forEach((b) =>
      res.push({ cat: 'Territórios', txt: b.nome, sub: D.terr(b.paiId).nome + ' · ' + num(b.eleitores) + ' eleitores', rota: '#/territorio/' + b.id, icone: 'map' }));
    D.equipes.filter((e) => norm(e.nome).includes(q)).slice(0, 4).forEach((e) =>
      res.push({ cat: 'Equipes', txt: e.nome, sub: e.integrantes.length + ' integrantes', rota: '#/equipes/' + e.id, icone: 'users-round' }));
    D.eventos.filter((e) => norm(e.nome).includes(q)).slice(0, 4).forEach((e) =>
      res.push({ cat: 'Eventos', txt: e.nome, sub: global.U.fmtDate(e.data) + ' · ' + e.status, rota: '#/eventos/' + e.id, icone: 'megaphone' }));
    D.tarefas.filter((t) => norm(t.titulo).includes(q)).slice(0, 4).forEach((t) =>
      res.push({ cat: 'Tarefas', txt: t.titulo, sub: t.status + ' · ' + global.U.fmtDate(t.prazo), rota: '#/tarefas', icone: 'list-checks' }));

    box.innerHTML = '';
    if (!res.length) {
      box.appendChild(el('div', { class: 'vazio', text: 'Nada encontrado para "' + q + '".' }));
    } else {
      let cat = null;
      res.forEach((r) => {
        if (r.cat !== cat) { cat = r.cat; box.appendChild(el('div', { class: 'br-cat', text: cat })); }
        box.appendChild(el('div', { class: 'br-item', onclick: () => { location.hash = r.rota; box.classList.remove('abrir'); } }, [
          r.icone ? el('div', { class: 'ic-box', style: { width: '26px', height: '26px', flex: '0 0 26px' } }, global.ic(r.icone, 14)) : el('div', { class: 'avatar pequeno', text: r.ini }),
          el('div', {}, [el('b', { text: r.txt, style: { fontSize: '13px', display: 'block' } }), el('small', { text: r.sub, style: { color: 'var(--txt-3)', fontSize: '11px' } })]),
        ]));
      });
    }
    box.classList.add('abrir');
    marcar(0);
  }

  /* seleção por teclado dentro dos resultados */
  let selIdx = -1;
  function itensBusca() { return global.U.$$('.br-item', $('#busca-res')); }
  function marcar(i) {
    const itens = itensBusca();
    if (!itens.length) return (selIdx = -1);
    selIdx = (i + itens.length) % itens.length;
    itens.forEach((n, k) => n.classList.toggle('sel', k === selIdx));
    itens[selIdx].scrollIntoView({ block: 'nearest' });
  }

  /* ---------------- roteador ---------------- */
  function rotear() {
    const hash = location.hash.replace(/^#\/?/, '');
    const [caminho, query] = hash.split('?');
    const partes = caminho.split('/').filter(Boolean);
    const base = partes[0] || '';
    const param = partes[1] || null;
    const params = new URLSearchParams(query || '');

    global.U.$$('.nav-item').forEach((n) => n.classList.toggle('ativo', n.dataset.rota === (global.DB.vazia && base !== 'config' ? 'inicio' : base)));
    const alvo = $('#conteudo');
    alvo.innerHTML = '';
    alvo.scrollTop = 0;
    const titulos = { '': 'Painel geral', alertas: 'Alertas', pessoas: 'Pessoas', liderancas: 'Lideranças',
      mobilizacao: 'Mobilização', territorio: 'Mapa territorial', territorios: 'Territórios', eleicao: 'Dia da eleição', equipes: 'Equipes',
      tarefas: 'Tarefas', metas: 'Metas', demandas: 'Demandas', eventos: 'Eventos', agenda: 'Agenda',
      materiais: 'Materiais', recursos: 'Recursos', financeiro: 'Financeiro', pesquisas: 'Pesquisas',
      performance: 'Performance', relatorios: 'Relatórios', inicio: 'Primeiros passos', config: 'Configurações', acessos: 'Acessos' };
    const nomeCampanha = global.DB.config.candidato || 'SIGC';
    document.title = (titulos[base] || 'Painel') + ' · ' + nomeCampanha;
    let alvoRota = base;
    if (global.DB.vazia && base !== 'config' && base !== 'inicio') alvoRota = 'inicio';
    if (!global.DB.podeVer(alvoRota) || (alvoRota === 'acessos' && !global.DB.ehAdmin())) {
      const info = global.DB.perfilInfo();
      alvo.appendChild(global.UI.vazio({
        icone: 'shield-check', titulo: 'Esta tela não faz parte do seu acesso',
        texto: 'Você está no sistema como ' + info.rotulo.toLowerCase() + '. ' + info.descricao + ' Se precisar desta tela, fale com a coordenação geral.',
        acao: { rotulo: 'Voltar ao painel', rota: '#/' },
      }));
      return;
    }
    const view = VIEWS[alvoRota] || VIEWS[''];
    try {
      view(alvo, param, params);
    } catch (err) {
      console.error(err);
      alvo.appendChild(el('div', { class: 'cartao' }, [el('h3', { text: 'Não foi possível abrir esta tela' }), el('p', { class: 'subtexto', text: String(err) })]));
    }
  }

  /** remonta o menu quando o perfil em uso muda */
  global.remontar = function () {
    const app = $('.app');
    if (app) app.remove();
    montarCasca();
    rotear();
    atualizarCasca();
  };

  /** atualiza os elementos fixos da casca (marca, contagem, modo de armazenamento) */
  function atualizarCasca() {
    const cfg = global.DB.config;
    const txt = $('.marca-txt');
    if (txt) {
      txt.innerHTML = '';
      txt.appendChild(el('b', { text: cfg.candidato || 'Sistema de Gestão de Campanha' }));
      txt.appendChild(el('span', { text: cfg.municipio ? cfg.municipio + ' · ' + cfg.ano : 'campanha não configurada' }));
    }
    const s = global.DB.stats();
    const cr = $('.contagem-regressiva');
    if (cr) {
      cr.style.display = s.diasEleicao === null ? 'none' : '';
      if (s.diasEleicao !== null) cr.querySelector('b').textContent = s.diasEleicao;
    }
    const rod = $('.rodape-user');
    if (rod) {
      const info = global.DB.perfilInfo();
      rod.innerHTML = '';
      rod.appendChild(el('div', { class: 'avatar apo' }, global.ic(info.icone, 15)));
      rod.appendChild(el('div', {}, [
        el('b', { text: info.rotulo }),
        el('span', { text: global.SB.configurado() ? (global.SB.autenticado() ? 'banco conectado' : 'falta entrar no banco') : 'modo local' }),
      ]));
    }
    // aviso permanente quando a coordenação está pré-visualizando outro perfil
    let aviso = $('#aviso-simulacao');
    if (global.DB.simulando()) {
      if (!aviso) {
        aviso = el('div', { id: 'aviso-simulacao', class: 'aviso-simulacao' });
        document.body.appendChild(aviso);
      }
      aviso.innerHTML = '';
      aviso.appendChild(el('span', { html: global.icHTML('eye', 14) + ' Você está vendo o sistema como <b>' + global.DB.perfilInfo().rotulo + '</b>' }));
      aviso.appendChild(el('button', { class: 'btn pequeno', text: 'voltar ao meu acesso', onclick: () => { global.DB.simularPerfil(null); global.remontar(); } }));
    } else if (aviso) aviso.remove();
  }

  /** redesenha a tela atual — usado após ações que alteram a base */
  global.refresh = function () {
    rotear();
    atualizarCasca();
    global.U.$$('.nav-badge').forEach((b) => b.remove());
    MENU.forEach((g) => g.itens.forEach((it) => {
      if (!it.badge) return;
      const v = it.badge();
      if (!v) return;
      const item = global.U.$$('.nav-item').find((n) => n.dataset.rota === it.rota);
      if (item) item.appendChild(el('em', { class: 'nav-badge' + (it.neutro ? ' neutro' : ''), text: v, style: { fontStyle: 'normal' } }));
    }));
  };

  window.addEventListener('hashchange', () => {
    const app = $('.app');
    if (app && ehCelular()) app.classList.remove('menu-aberto');
    rotear();
  });
  /* ==========================  ENTRADA  ========================== */
  const CHAVE_PENDENTE = 'sigc.bootstrapPendente';

  /** conclui o vínculo de coordenação para quem se cadastrou mas precisou confirmar o e-mail antes */
  async function tentarConcluirBootstrapPendente(email) {
    let pend;
    try { pend = JSON.parse(localStorage.getItem(CHAVE_PENDENTE) || 'null'); } catch (e) { pend = null; }
    if (!pend || pend.email !== email) return null;
    try {
      await global.SB.bootstrapCoordenacao(pend);
      localStorage.removeItem(CHAVE_PENDENTE);
      return await global.SB.carregarMembro();
    } catch (e) {
      return null; // provavelmente outra pessoa já concluiu o próprio acesso primeiro
    }
  }

  function montarLogin(aoEntrar) {
    document.body.innerHTML = '';
    document.documentElement.dataset.tema = store.get('tema', 'claro'); // login sempre no tema salvo — claro por padrão
    let modo = 'entrar'; // 'entrar' | 'criar'

    const erro = el('div', { class: 'login-erro', style: { display: 'none' } });
    const aviso = el('div', { class: 'login-aviso', style: { display: 'none' } });
    const mostrarErro = (msg) => { erro.textContent = msg; erro.style.display = 'block'; aviso.style.display = 'none'; };
    const mostrarAviso = (msg) => { aviso.textContent = msg; aviso.style.display = 'block'; erro.style.display = 'none'; };
    const limparMsgs = () => { erro.style.display = 'none'; aviso.style.display = 'none'; };

    const corpo = el('div', { class: 'login-caixa' }, [
      el('img', { class: 'login-logo', src: 'assets/img/logo-completa.png', alt: 'Sistema de Gestão de Campanha' }),
      el('p', { class: 'subtexto', id: 'login-sub' }),
    ]);
    document.body.appendChild(el('div', { class: 'login-tela' }, [corpo]));
    const areaForm = el('div');
    corpo.appendChild(areaForm);

    function desenharEntrar() {
      modo = 'entrar';
      corpo.querySelector('#login-sub').textContent = 'Entre com o e-mail e a senha cadastrados pela sua coordenação.';
      areaForm.innerHTML = '';
      const email = el('input', { type: 'email', placeholder: 'seu e-mail', autocomplete: 'username' });
      const senha = el('input', { type: 'password', placeholder: 'sua senha', autocomplete: 'current-password' });
      const btn = el('button', { class: 'btn primario', type: 'submit', html: global.icHTML('user-round', 15) + ' Entrar' });
      const form = el('form', { class: 'login-form', onsubmit: async (ev) => {
        ev.preventDefault();
        limparMsgs();
        btn.disabled = true;
        btn.textContent = 'Entrando…';
        try {
          await global.SB.entrar(email.value.trim(), senha.value);
          let membro = await global.SB.carregarMembro();
          if (!membro) membro = await tentarConcluirBootstrapPendente(email.value.trim());
          if (!membro) {
            global.SB.sair();
            mostrarErro('Login correto, mas este e-mail ainda não tem acesso vinculado a nenhuma campanha. Peça à coordenação geral para registrar seu acesso em Acessos.');
            btn.disabled = false;
            btn.innerHTML = global.icHTML('user-round', 15) + ' Entrar';
            return;
          }
          await aoEntrar();
        } catch (e) {
          mostrarErro(String(e.message || e));
          btn.disabled = false;
          btn.innerHTML = global.icHTML('user-round', 15) + ' Entrar';
        }
      }}, [
        el('div', { class: 'campo' }, [el('label', { text: 'E-mail' }), email]),
        el('div', { class: 'campo' }, [el('label', { text: 'Senha' }), senha]),
        erro, aviso, btn,
      ]);
      areaForm.appendChild(form);
      areaForm.appendChild(el('button', { class: 'login-alterna', type: 'button', text: 'Primeira vez usando o sistema? Criar acesso da coordenação', onclick: desenharCriar }));
      setTimeout(() => email.focus(), 60);
    }

    function desenharCriar() {
      modo = 'criar';
      limparMsgs();
      corpo.querySelector('#login-sub').textContent = 'Crie o primeiro acesso — quem cria vira coordenação geral da campanha. Funciona uma única vez.';
      areaForm.innerHTML = '';
      const c = {
        email: el('input', { type: 'email', placeholder: 'seu e-mail', autocomplete: 'username' }),
        senha: el('input', { type: 'password', placeholder: 'crie uma senha (mínimo 6 caracteres)', autocomplete: 'new-password' }),
        candidato: el('input', { type: 'text', placeholder: 'nome da candidatura' }),
        municipio: el('input', { type: 'text', placeholder: 'município' }),
        uf: el('input', { type: 'text', placeholder: 'UF', maxlength: 2 }),
        ano: el('input', { type: 'number', placeholder: 'ano da eleição', value: new Date().getFullYear() }),
        dataEleicao: el('input', { type: 'date' }),
      };
      const btn = el('button', { class: 'btn primario', type: 'submit', html: global.icHTML('sparkles', 15) + ' Criar acesso da coordenação' });
      const form = el('form', { class: 'login-form', onsubmit: async (ev) => {
        ev.preventDefault();
        limparMsgs();
        btn.disabled = true;
        btn.textContent = 'Criando…';
        const dados = {
          email: c.email.value.trim(), candidato: c.candidato.value.trim(), municipio: c.municipio.value.trim(),
          uf: c.uf.value.trim().toUpperCase(), ano: +c.ano.value || new Date().getFullYear(),
          dataEleicao: c.dataEleicao.value || null,
        };
        try {
          if (!dados.email || c.senha.value.length < 6 || !dados.candidato || !dados.municipio) {
            throw new Error('Preencha e-mail, senha (6+ caracteres), candidatura e município.');
          }
          const r = await global.SB.cadastrar(dados.email, c.senha.value);
          if (!r.access_token) {
            localStorage.setItem(CHAVE_PENDENTE, JSON.stringify(dados));
            mostrarAviso('Conta criada! Este projeto pede confirmação por e-mail — verifique sua caixa de entrada, clique no link e depois entre normalmente aqui.');
            btn.disabled = false;
            btn.innerHTML = global.icHTML('sparkles', 15) + ' Criar acesso da coordenação';
            return;
          }
          await global.SB.bootstrapCoordenacao(dados);
          const membro = await global.SB.carregarMembro();
          if (!membro) throw new Error('Conta criada, mas não consegui vincular a campanha. Tente entrar normalmente.');
          await aoEntrar();
        } catch (e) {
          mostrarErro(String(e.message || e));
          btn.disabled = false;
          btn.innerHTML = global.icHTML('sparkles', 15) + ' Criar acesso da coordenação';
        }
      }}, [
        el('div', { class: 'campo' }, [el('label', { text: 'E-mail' }), c.email]),
        el('div', { class: 'campo' }, [el('label', { text: 'Senha' }), c.senha]),
        el('div', { class: 'campo' }, [el('label', { text: 'Candidatura' }), c.candidato]),
        el('div', { class: 'campo-linha' }, [
          el('div', { class: 'campo' }, [el('label', { text: 'Município' }), c.municipio]),
          el('div', { class: 'campo' }, [el('label', { text: 'UF' }), c.uf]),
        ]),
        el('div', { class: 'campo-linha' }, [
          el('div', { class: 'campo' }, [el('label', { text: 'Ano da eleição' }), c.ano]),
          el('div', { class: 'campo' }, [el('label', { text: 'Data da eleição' }), c.dataEleicao]),
        ]),
        erro, aviso, btn,
      ]);
      areaForm.appendChild(form);
      areaForm.appendChild(el('button', { class: 'login-alterna', type: 'button', text: '‹ Já tenho acesso, voltar para entrar', onclick: desenharEntrar }));
      setTimeout(() => c.email.focus(), 60);
    }

    desenharEntrar();
  }

  async function iniciarApp() {
    document.body.innerHTML = '';
    document.documentElement.dataset.tema = store.get('tema', 'claro');
    montarCasca();
    rotear();
    atualizarCasca();
    setTimeout(() => {
      if (global.DB.vazia) return;
      toast('Base carregada: ' + num(global.DB.pessoas.length) + ' pessoas em ' + global.DB.bairros.length + ' bairros' + (global.SB.configurado() ? ' · banco conectado' : ' · modo local') + '.');
    }, 500);
  }

  async function entrarNaPlataforma() {
    if (global.SB.autenticado()) {
      const m = await global.SB.carregarMembro();
      if (m) {
        try { await global.SB.baixarTudo(); } catch (e) { toast('Conectado, mas não consegui baixar a campanha: ' + e.message, 'erro'); }
        return iniciarApp();
      }
      global.SB.sair(); // sessão sem vínculo de acesso — volta para o login
    }
    if (global.SB.configurado()) return montarLogin(() => entrarPosLogin());
    return iniciarApp();
  }

  async function entrarPosLogin() {
    try { await global.SB.baixarTudo(); } catch (e) { toast('Conectado, mas não consegui baixar a campanha: ' + e.message, 'erro'); }
    return iniciarApp();
  }

  document.addEventListener('DOMContentLoaded', () => { entrarNaPlataforma(); });
})(window);

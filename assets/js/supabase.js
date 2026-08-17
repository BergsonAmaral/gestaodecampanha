/* ==========================================================================
   supabase.js — adaptador de banco (PostgREST + Auth do Supabase)
   Sem SDK externo: usa apenas fetch.
   Enquanto não houver projeto configurado, o sistema opera local
   (localStorage) e nada aqui é acionado.
   ========================================================================== */
(function (global) {
  'use strict';
  const CHAVE_CFG = 'sigc.supabase';
  const CHAVE_FILA = 'sigc.fila';
  const CHAVE_SESSAO = 'sigc.sessao';

  const ler = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) || def; } catch (e) { return def; } };
  const escrever = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const CHAVE_MEMBRO = 'sigc.membro';
  // conexão padrão desta instalação — a chave é a pública (anon), protegida
  // pelas políticas de acesso do banco (supabase/02_rls.sql), por isso pode
  // ficar embutida no código como qualquer aplicativo cliente do Supabase.
  const PADRAO = {
    url: 'https://qsmimfehrvbsiqgnwdln.supabase.co',
    chave: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzbWltZmVocnZic2lxZ253ZGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5MjEyNzQsImV4cCI6MjEwMjQ5NzI3NH0.zc4jwAoC5krX1gtSU2UeqHw8XOvzkp_JLuC9QbWAdng',
    campanhaId: '',
  };
  let cfg = ler(CHAVE_CFG, PADRAO);
  if (!cfg.url) cfg = PADRAO;
  let sessao = ler(CHAVE_SESSAO, null);
  let membro = ler(CHAVE_MEMBRO, null);
  let fila = ler(CHAVE_FILA, []);

  const configurado = () => !!(cfg.url && cfg.chave);
  const autenticado = () => !!(sessao && sessao.access_token);

  /* ---------------- mapeamento entre o modelo e as tabelas ---------------- */
  // { tabela: { campoNoBanco: campoNoModelo } }  — o inverso é derivado
  const MAPA = {
    territorios: { nome: 'nome', tipo: 'tipo', pai_id: 'paiId', eleitores: 'eleitores', zona: 'zona', localidades: 'localidades', meta: 'meta', obs: 'obs' },
    pessoas: { nome: 'nome', telefone: 'telefone', email: 'email', nascimento: 'nascimento', genero: 'genero', bairro_id: 'bairroId', localidade: 'localidade', zona: 'zona', secao: 'secao', classificacao: 'classificacao', origem: 'origem', indicado_por: 'indicadoPor', responsavel_id: 'responsavelId', cadastrado_por: 'cadastradoPor', data_cadastro: 'dataCadastro', tags: 'tags', obs: 'obs' },
    interacoes: { pessoa_id: 'pessoaId', tipo: 'tipo', canal: 'canal', data: 'data', responsavel_id: 'responsavelId', resumo: 'resumo', retorno: 'retorno', evento_id: 'eventoId' },
    historico_classificacao: { pessoa_id: 'pessoaId', classificacao: 'classificacao', data: 'data' },
    liderancas: { pessoa_id: 'pessoaId', segmento: 'segmento', atuacao: 'atuacao', territorios: 'territorios', responsavel_id: 'responsavelId', capacidade: 'capacidade', alcance_estimado: 'alcanceEstimado', reunioes: 'reunioes', compromissos: 'compromissos', situacao: 'situacao' },
    equipe_campanha: { pessoa_id: 'pessoaId', funcao: 'funcao', area: 'area', responde_a: 'respondeA', regiao_id: 'regiaoId', desde: 'desde' },
    equipes: { nome: 'nome', responsavel_id: 'responsavelId', territorio_id: 'territorioId', objetivo: 'objetivo', criada_em: 'criadaEm' },
    tarefas: { titulo: 'titulo', descricao: 'descricao', responsavel_id: 'responsavelId', equipe_id: 'equipeId', territorio_id: 'territorioId', area: 'area', prazo: 'prazo', criada_em: 'criadaEm', status: 'status', progresso: 'progresso', prioridade: 'prioridade', objetivo: 'objetivo', andamento: 'andamento' },
    metas: { titulo: 'titulo', escopo: 'escopo', alvo_id: 'alvoId', alvo: 'alvo', periodo: 'periodo', prazo: 'prazo', tipo: 'tipo' },
    demandas: { solicitante_id: 'solicitanteId', descricao: 'descricao', responsavel_id: 'responsavelId', data: 'data', prazo: 'prazo', prioridade: 'prioridade', status: 'status', territorio_id: 'territorioId', area: 'area', encaminhamento: 'encaminhamento', solucao: 'solucao' },
    eventos: { nome: 'nome', tipo: 'tipo', data: 'data', hora: 'hora', local: 'local', territorio_id: 'territorioId', responsavel_id: 'responsavelId', equipe_id: 'equipeId', publico_previsto: 'publicoPrevisto', publico_presente: 'publicoPresente', novos_cadastros: 'novosCadastros', novos_apoiadores: 'novosApoiadores', novos_mobilizadores: 'novosMobilizadores', liderancas_presentes: 'liderancasPresentes', logistica: 'logistica', status: 'status', obs: 'obs' },
    agenda: { titulo: 'titulo', tipo: 'tipo', data: 'data', hora: 'hora', duracao: 'duracao', local: 'local', responsaveis: 'responsaveis', obs: 'obs' },
    materiais: { nome: 'nome', unidade: 'unidade', minimo: 'minimo', saldo: 'saldo' },
    recursos: { nome: 'nome', tipo: 'tipo', status: 'status', responsavel_id: 'responsavelId', local: 'local', atividade: 'atividade' },
    financeiro: { descricao: 'descricao', area: 'area', fornecedor: 'fornecedor', previsto: 'previsto', realizado: 'realizado', data: 'data', evento_id: 'eventoId' },
    pesquisas: { titulo: 'titulo', tipo: 'tipo', data: 'data', amostra: 'amostra' },
    locais_votacao: { nome: 'nome', territorio_id: 'territorioId', zona: 'zona', secoes: 'secoes', eleitores: 'eleitores', fiscais_necessarios: 'fiscaisNecessarios', fiscais_confirmados: 'fiscaisConfirmados', coordenador_id: 'coordenadorId', transporte: 'transporte', plantao: 'plantao' },
  };
  // coleção do modelo correspondente a cada tabela
  const COLECAO = {
    territorios: 'territorios', pessoas: 'pessoas', interacoes: 'interacoes',
    historico_classificacao: 'historicoClass', liderancas: 'liderancas',
    equipe_campanha: 'equipe', equipes: 'equipes', tarefas: 'tarefas', metas: 'metas',
    demandas: 'demandas', eventos: 'eventos', agenda: 'agenda', materiais: 'materiais',
    recursos: 'recursos', financeiro: 'financeiro', pesquisas: 'pesquisas', locais_votacao: 'locaisVotacao',
  };
  // qual tabela cada função de escrita alimenta
  const ESCRITAS = {
    addTerritorio: 'territorios', editarTerritorio: 'territorios',
    addPessoa: 'pessoas', editarPessoa: 'pessoas', setClassificacao: 'pessoas',
    addInteracao: 'interacoes', addIntegranteEquipe: 'equipe_campanha',
    addEquipe: 'equipes', addLideranca: 'liderancas', addTarefa: 'tarefas',
    atualizarTarefa: 'tarefas', addMeta: 'metas', addDemanda: 'demandas',
    addEvento: 'eventos', addAgenda: 'agenda', addMaterial: 'materiais',
    addRecurso: 'recursos', addLancamento: 'financeiro', addLocalVotacao: 'locais_votacao',
    addPesquisa: 'pesquisas',
  };

  const paraBanco = (tabela, reg) => {
    const m = MAPA[tabela] || {};
    const linha = { id: reg.id, campanha_id: cfg.campanhaId };
    Object.keys(m).forEach((col) => {
      const v = reg[m[col]];
      if (v !== undefined) linha[col] = v === '' ? null : v;
    });
    return linha;
  };
  const doBanco = (tabela, linha) => {
    const m = MAPA[tabela] || {};
    const reg = { id: linha.id };
    Object.keys(m).forEach((col) => { reg[m[col]] = linha[col]; });
    return reg;
  };

  /* ---------------- chamadas HTTP ---------------- */
  function cabecalhos(extra) {
    return Object.assign({
      apikey: cfg.chave,
      Authorization: 'Bearer ' + (autenticado() ? sessao.access_token : cfg.chave),
      'Content-Type': 'application/json',
    }, extra || {});
  }

  async function rest(caminho, opcoes) {
    if (!configurado()) throw new Error('Projeto Supabase não configurado.');
    const r = await fetch(cfg.url.replace(/\/$/, '') + '/rest/v1/' + caminho, Object.assign({ headers: cabecalhos((opcoes || {}).headers) }, opcoes));
    const texto = await r.text();
    if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + (texto || r.statusText));
    return texto ? JSON.parse(texto) : null;
  }

  async function entrar(email, senha) {
    const r = await fetch(cfg.url.replace(/\/$/, '') + '/auth/v1/token?grant_type=password', {
      method: 'POST', headers: { apikey: cfg.chave, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: senha }),
    });
    const dados = await r.json();
    if (!r.ok) {
      const bruta = dados.error_description || dados.msg || '';
      const traducoes = {
        'Invalid login credentials': 'E-mail ou senha incorretos.',
        'Email not confirmed': 'E-mail ainda não confirmado — verifique sua caixa de entrada.',
        'User not found': 'Não existe usuário com este e-mail.',
      };
      throw new Error(traducoes[bruta] || bruta || 'Não foi possível entrar. Confira o e-mail e a senha.');
    }
    sessao = dados;
    escrever(CHAVE_SESSAO, sessao);
    await carregarMembro();
    return dados;
  }

  /** cria a conta de autenticação (o próprio usuário digita e-mail/senha) */
  async function cadastrar(email, senha) {
    const r = await fetch(cfg.url.replace(/\/$/, '') + '/auth/v1/signup', {
      method: 'POST', headers: { apikey: cfg.chave, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: senha }),
    });
    const dados = await r.json();
    if (!r.ok) {
      const bruta = dados.error_description || dados.msg || dados.error || '';
      const traducoes = {
        'User already registered': 'Já existe uma conta com este e-mail — tente entrar em vez de criar.',
        'Password should be at least 6 characters': 'A senha precisa ter pelo menos 6 caracteres.',
      };
      throw new Error(traducoes[bruta] || bruta || 'Não foi possível criar a conta.');
    }
    if (dados.access_token) { sessao = dados; escrever(CHAVE_SESSAO, sessao); }
    return dados; // se não vier access_token, o projeto exige confirmação por e-mail
  }

  /** quem acabou de criar a conta pede acesso — não cria campanha na hora */
  async function solicitarAcesso(dados) {
    return rest('rpc/solicitar_acesso', {
      method: 'POST',
      body: JSON.stringify({
        p_candidato: dados.candidato, p_municipio: dados.municipio, p_uf: dados.uf,
        p_ano: dados.ano, p_eleicao: dados.dataEleicao, p_nome_campanha: dados.nomeCampanha || null,
      }),
    });
  }

  /** true quando o usuário autenticado é administrador da plataforma (não de uma campanha) */
  async function souSuperadmin() {
    try { return await rest('rpc/sou_superadmin', { method: 'POST', body: '{}' }); } catch (e) { return false; }
  }

  const listarSolicitacoes = () => rest('solicitacoes_acesso?select=*&order=criada_em.desc');
  const criarConvite = (nota) => rest('rpc/criar_convite', { method: 'POST', body: JSON.stringify({ p_nota: nota || null }) });
  const ativarConvite = (token) => rest('rpc/ativar_convite', { method: 'POST', body: JSON.stringify({ p_token: token }) });
  const listarConvites = () => rest('convites?select=*&order=criado_em.desc');
  const aprovarSolicitacao = (id) => rest('rpc/aprovar_solicitacao', { method: 'POST', body: JSON.stringify({ p_solicitacao_id: id }) });
  const recusarSolicitacao = (id, motivo) => rest('rpc/recusar_solicitacao', { method: 'POST', body: JSON.stringify({ p_solicitacao_id: id, p_motivo: motivo || null }) });

  function sair() {
    sessao = null;
    membro = null;
    localStorage.removeItem(CHAVE_SESSAO);
    localStorage.removeItem(CHAVE_MEMBRO);
  }

  /** descobre com que perfil o usuário autenticado entra na campanha */
  async function carregarMembro() {
    if (!autenticado()) return null;
    try {
      const uid = JSON.parse(atob(sessao.access_token.split('.')[1])).sub;
      const linhas = await rest('membros?user_id=eq.' + uid + '&select=*');
      membro = (linhas && linhas[0]) || null;
      if (membro) {
        escrever(CHAVE_MEMBRO, membro);
        if (!cfg.campanhaId) { cfg.campanhaId = membro.campanha_id; escrever(CHAVE_CFG, cfg); }
      }
      return membro;
    } catch (e) {
      return null;
    }
  }

  async function testar() {
    const r = await rest('campanhas?select=id,nome,municipio&limit=5');
    return r;
  }

  /* ---------------- carga e envio ---------------- */
  async function baixarTudo() {
    if (!cfg.campanhaId) throw new Error('Escolha a campanha antes de sincronizar.');
    const base = global.DB.baseVazia();
    const campanha = (await rest('campanhas?id=eq.' + cfg.campanhaId + '&select=*'))[0];
    if (!campanha) throw new Error('Campanha não encontrada no projeto.');
    Object.assign(base.config, {
      candidato: campanha.candidato, cargo: campanha.cargo, municipio: campanha.municipio,
      uf: campanha.uf, ano: campanha.ano, dataEleicao: campanha.data_eleicao,
      configurado: !!(campanha.municipio && campanha.municipio.trim()), // fica pendente até o coordenador preencher de verdade
    });
    for (const tabela of Object.keys(COLECAO)) {
      const filtro = MAPA[tabela] && Object.prototype.hasOwnProperty.call(MAPA[tabela], 'campanha_id') ? '' : '';
      const linhas = await rest(tabela + '?campanha_id=eq.' + cfg.campanhaId + '&select=*' + filtro);
      base[COLECAO[tabela]] = (linhas || []).map((l) => doBanco(tabela, l));
    }
    // etapas e integrantes vivem em tabelas próprias
    const etapas = await rest('tarefa_etapas?select=*');
    const porTarefa = new Map();
    (etapas || []).forEach((e) => {
      if (!porTarefa.has(e.tarefa_id)) porTarefa.set(e.tarefa_id, []);
      porTarefa.get(e.tarefa_id).push({ passo: e.passo, feito: e.feito });
    });
    base.tarefas.forEach((t) => { t.checklist = porTarefa.get(t.id) || [{ passo: 'Executar a tarefa', feito: false }]; });
    const integ = await rest('equipe_integrantes?select=*');
    const porEquipe = new Map();
    (integ || []).forEach((i) => {
      if (!porEquipe.has(i.equipe_id)) porEquipe.set(i.equipe_id, []);
      porEquipe.get(i.equipe_id).push(i.pessoa_id);
    });
    base.equipes.forEach((e) => { e.integrantes = porEquipe.get(e.id) || []; });
    const movs = await rest('movimentos_material?select=*');
    const porMaterial = new Map();
    (movs || []).forEach((m) => {
      if (!porMaterial.has(m.material_id)) porMaterial.set(m.material_id, []);
      porMaterial.get(m.material_id).push({ tipo: m.tipo, qtd: m.qtd, data: m.data, responsavelId: m.responsavel_id, destino: m.destino, finalidade: m.finalidade });
    });
    base.materiais.forEach((m) => { m.movimentos = porMaterial.get(m.id) || []; });

    global.DB.substituirBase(base);
    return base;
  }

  async function enviarFila() {
    if (!configurado() || !fila.length) return { enviados: 0, pendentes: fila.length };
    const restante = [];
    let enviados = 0;
    for (const item of fila) {
      try {
        await rest(item.tabela + '?on_conflict=id', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(item.linha),
        });
        enviados++;
      } catch (e) {
        item.erro = String(e.message || e);
        restante.push(item);
      }
    }
    fila = restante;
    escrever(CHAVE_FILA, fila);
    return { enviados, pendentes: fila.length };
  }

  /* ---------------- ligação com o modelo ---------------- */
  function enfileirar(tabela, registro) {
    if (!registro || !registro.id) return;
    fila = fila.filter((x) => !(x.tabela === tabela && x.linha.id === registro.id));
    fila.push({ tabela, linha: paraBanco(tabela, registro), em: new Date().toISOString() });
    escrever(CHAVE_FILA, fila);
    if (configurado() && navigator.onLine) enviarFila();
  }

  function instrumentar() {
    Object.keys(ESCRITAS).forEach((fn) => {
      const original = global.DB[fn];
      if (typeof original !== 'function' || original.__instrumentado) return;
      const novo = function () {
        const r = original.apply(global.DB, arguments);
        const alvo = r && r.material ? r.material : r;
        if (alvo && alvo.id) enfileirar(ESCRITAS[fn], alvo);
        return r;
      };
      novo.__instrumentado = true;
      global.DB[fn] = novo;
    });
    const mov = global.DB.movimentarMaterial;
    if (mov && !mov.__instrumentado) {
      const novo = function () {
        const r = mov.apply(global.DB, arguments);
        if (r && r.material) enfileirar('materiais', r.material);
        return r;
      };
      novo.__instrumentado = true;
      global.DB.movimentarMaterial = novo;
    }
  }

  window.addEventListener('online', () => { if (configurado()) enviarFila(); });

  global.SB = {
    get cfg() { return Object.assign({}, cfg); },
    salvarCfg(novo) { cfg = Object.assign(cfg, novo); escrever(CHAVE_CFG, cfg); instrumentar(); return cfg; },
    limparCfg() { cfg = { url: '', chave: '', campanhaId: '' }; localStorage.removeItem(CHAVE_CFG); },
    configurado, autenticado, entrar, sair, testar, baixarTudo, enviarFila, instrumentar, carregarMembro,
    cadastrar, solicitarAcesso, souSuperadmin, listarSolicitacoes, aprovarSolicitacao, recusarSolicitacao,
    criarConvite, ativarConvite, listarConvites,
    membro: () => (membro ? { perfil: membro.perfil, pessoaId: membro.pessoa_id, regiaoId: membro.regiao_id, campanhaId: membro.campanha_id } : null),
    get sessao() { return sessao; },
    get pendentes() { return fila.length; },
    listarCampanhas: () => rest('campanhas?select=id,nome,municipio,ano&order=criada_em.desc'),
    modo: () => (configurado() ? 'supabase' : 'local'),
  };
  if (configurado()) instrumentar();
})(window);

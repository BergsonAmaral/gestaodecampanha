/* ==========================================================================
   modelo.js — camada de dados da campanha
   Base própria, iniciada vazia, gravada no navegador (localStorage).
   Toda escrita passa por aqui; as telas leem sempre o estado corrente.
   ========================================================================== */
(function (global) {
  'use strict';
  const { iso, addDays, daysBetween, by, countBy, sum, sortBy, toDate } = global.U;

  const CHAVE = 'sigc.base.v1';
  const VERSAO = 1;

  /* ---------------- vocabulário fixo do sistema ---------------- */
  const CLASSIF = ['contato', 'simpatizante', 'apoiador', 'participante', 'mobilizador', 'lideranca'];
  const CLASSIF_LABEL = { contato: 'Contato', simpatizante: 'Simpatizante', apoiador: 'Apoiador', participante: 'Participante', mobilizador: 'Mobilizador', lideranca: 'Liderança' };
  const CLASSIF_COR = { contato: '#98a2b3', simpatizante: '#2563eb', apoiador: '#0e9f6e', participante: '#7c3aed', mobilizador: '#d97706', lideranca: '#e11d48' };
  const ORIGENS = ['Abordagem de rua', 'Evento', 'Indicação de apoiador', 'Indicação de liderança', 'Redes sociais', 'WhatsApp', 'Telefone', 'Comitê', 'Reunião', 'Formulário', 'Pesquisa', 'Cadastro espontâneo'];
  const SEGMENTOS = ['Comunitária', 'Política', 'Religiosa', 'Empresarial', 'Sindical', 'Esportiva', 'Cultural', 'Profissional', 'Estudantil', 'Digital', 'Territorial', 'Institucional'];
  const AREAS = ['Coordenação Geral', 'Mobilização', 'Logística', 'Comunicação', 'Administrativo', 'Financeiro', 'Eventos', 'Território', 'Jurídico', 'Pesquisa'];
  const TIPO_INTER = ['Ligação', 'Mensagem', 'Visita', 'Reunião', 'Convite', 'Participação em evento', 'Pedido', 'Reclamação', 'Solicitação', 'Retorno da campanha', 'Encaminhamento'];
  const TIPO_EVENTO = ['Reunião', 'Caminhada', 'Encontro', 'Visita', 'Comício', 'Plenária', 'Lançamento', 'Reunião de segmento', 'Atividade comunitária'];
  const PRIORIDADES = ['baixa', 'média', 'alta', 'urgente'];
  const FUNCOES = ['Candidato(a)', 'Coordenação geral', 'Coordenação de área', 'Coordenação territorial', 'Supervisor(a)', 'Agente de mobilização', 'Mobilizador(a) de campo', 'Voluntário(a)', 'Apoio administrativo'];

  const PERFIS = {
    coordenacao_geral: {
      rotulo: 'Coordenação geral', icone: 'crown', escreve: true, admin: true, rotas: '*',
      descricao: 'Enxerga e administra toda a campanha, inclusive quem tem acesso ao sistema.',
    },
    coordenacao_area: {
      rotulo: 'Coordenação de área', icone: 'briefcase', escreve: true, admin: false, rotas: '*',
      descricao: 'Acompanha a campanha inteira e cuida da sua frente: logística, comunicação, eventos, financeiro.',
    },
    coordenacao_territorial: {
      rotulo: 'Coordenação territorial', icone: 'map-pin', escreve: true, admin: false,
      rotas: ['', 'inicio', 'config', 'alertas', 'territorio', 'territorios', 'mobilizacao', 'performance', 'relatorios',
              'pessoas', 'liderancas', 'equipes', 'tarefas', 'agenda', 'eventos', 'demandas', 'metas', 'eleicao'],
      descricao: 'Acompanha a própria região: pessoas, equipes, tarefas, eventos e demandas do território.',
    },
    supervisor: {
      rotulo: 'Supervisão de mobilização', icone: 'users-round', escreve: true, admin: false,
      rotas: ['', 'inicio', 'config', 'pessoas', 'mobilizacao', 'equipes', 'tarefas', 'agenda', 'eventos', 'demandas', 'territorios'],
      descricao: 'Acompanha a equipe sob sua supervisão: os contatos e as tarefas de quem responde a ela.',
    },
    mobilizador: {
      rotulo: 'Mobilizador de campo', icone: 'user-round', escreve: true, admin: false,
      rotas: ['', 'inicio', 'config', 'pessoas', 'tarefas', 'agenda', 'eventos', 'demandas', 'territorios'],
      descricao: 'Enxerga apenas os próprios contatos, as próprias tarefas e as metas individuais.',
    },
    leitura: {
      rotulo: 'Somente leitura', icone: 'eye', escreve: false, admin: false, rotas: '*',
      descricao: 'Consulta toda a campanha e não altera nada. Útil para assessoria e aliados.',
    },
  };

  const ICONE_INTER = {
    'Ligação': 'phone', 'Mensagem': 'message-square', 'Visita': 'door-open', 'Reunião': 'handshake',
    'Convite': 'mail', 'Participação em evento': 'megaphone', 'Pedido': 'hand-coins', 'Reclamação': 'circle-alert',
    'Solicitação': 'clipboard-list', 'Retorno da campanha': 'arrow-right', 'Encaminhamento': 'route',
  };

  /* ---------------- estado ---------------- */
  function baseVazia() {
    return {
      versao: VERSAO,
      config: { candidato: '', cargo: 'Prefeito(a)', municipio: '', uf: '', ano: new Date().getFullYear(), dataEleicao: '', configurado: false, criadaEm: iso(new Date()) },
      seq: {},
      territorios: [], pessoas: [], equipe: [], equipes: [], liderancas: [],
      interacoes: [], historicoClass: [], tarefas: [], metas: [], demandas: [],
      eventos: [], agenda: [], materiais: [], recursos: [], financeiro: [],
      pesquisas: [], locaisVotacao: [],
    };
  }

  let estado = baseVazia();

  const id = (pre) => {
    estado.seq[pre] = (estado.seq[pre] || 0) + 1;
    return pre + estado.seq[pre];
  };

  /* ---------------- persistência ---------------- */
  let timerGravacao;
  function gravar(imediato) {
    clearTimeout(timerGravacao);
    const escrever = () => {
      try {
        localStorage.setItem(CHAVE, JSON.stringify(estado));
      } catch (e) {
        global.U.toast('Não foi possível gravar: armazenamento do navegador cheio.', 'erro');
      }
    };
    imediato ? escrever() : (timerGravacao = setTimeout(escrever, 400));
  }

  function carregar() {
    try {
      const bruto = localStorage.getItem(CHAVE);
      if (!bruto) return false;
      const dados = JSON.parse(bruto);
      if (!dados || !dados.config) return false;
      estado = Object.assign(baseVazia(), dados);
      reindexar();
      return true;
    } catch (e) {
      return false;
    }
  }

  function substituirBase(nova) {
    estado = Object.assign(baseVazia(), nova);
    reindexar();
    gravar(true);
  }

  function zerar() {
    estado = baseVazia();
    reindexar();
    gravar(true);
  }

  const exportarBase = () => JSON.stringify(estado, null, 1);

  function importarBase(texto) {
    const dados = JSON.parse(texto);
    if (!dados || !dados.config || !Array.isArray(dados.pessoas)) throw new Error('Arquivo fora do formato do sistema.');
    substituirBase(dados);
    return dados;
  }

  /* ---------------- índices e geometria ---------------- */
  let idxPessoa, idxTerr, idxEquipe, idxFuncao, idxLideranca;
  let interPorPessoa, indicadosPor, cadastradosPor, demandasPorPessoa;
  let mapa = null;

  function reindexar() {
    idxPessoa = new Map(estado.pessoas.map((p) => [p.id, p]));
    idxTerr = new Map(estado.territorios.map((t) => [t.id, t]));
    idxEquipe = new Map(estado.equipes.map((e) => [e.id, e]));
    idxFuncao = new Map(estado.equipe.map((e) => [e.pessoaId, e]));
    idxLideranca = new Map(estado.liderancas.map((l) => [l.pessoaId, l]));
    interPorPessoa = by(estado.interacoes, 'pessoaId');
    indicadosPor = by(estado.pessoas.filter((p) => p.indicadoPor), 'indicadoPor');
    cadastradosPor = by(estado.pessoas.filter((p) => p.cadastradoPor), 'cadastradoPor');
    demandasPorPessoa = by(estado.demandas, 'solicitanteId');
    gerarGeometria();
  }

  /** distribui as células do desenho do município entre os bairros cadastrados */
  function gerarGeometria() {
    const bs = bairros();
    if (!bs.length) { mapa = null; return; }
    if (!mapa || mapa.cells.length !== bs.length) mapa = global.GEO.buildMunicipio(bs.length, 771);
    bs.forEach((b, i) => {
      const c = mapa.cells[i];
      b.path = c.path;
      b.center = c.center;
      b.areaDesenho = c.area;
    });
  }

  const bairros = () => estado.territorios.filter((t) => t.tipo === 'bairro');
  const regioes = () => estado.territorios.filter((t) => t.tipo === 'regiao');

  function municipio() {
    const eleitores = sum(bairros(), (b) => b.eleitores || 0);
    return { id: 'mun', nome: estado.config.municipio || 'Município', tipo: 'municipio', paiId: null, eleitores };
  }

  const P = (pid) => idxPessoa.get(pid) || null;
  const nome = (pid) => (P(pid) ? P(pid).nome : '—');
  const primeiroNome = (pid) => (P(pid) ? P(pid).nome.split(' ').slice(0, 2).join(' ') : '—');
  const terr = (tid) => (tid === 'mun' ? municipio() : idxTerr.get(tid) || null);
  const nomeTerr = (tid) => (terr(tid) ? terr(tid).nome : '—');
  const nomeEquipe = (eid) => (idxEquipe.get(eid) ? idxEquipe.get(eid).nome : '—');
  const funcaoDe = (pid) => (idxFuncao.get(pid) ? idxFuncao.get(pid).funcao : null);
  const isApoiador = (p) => !!p && ['apoiador', 'participante', 'mobilizador', 'lideranca'].includes(p.classificacao);
  const isSimp = (p) => !!p && p.classificacao !== 'contato';
  const staffIds = () => estado.equipe.map((e) => e.pessoaId);
  const candidato = () => estado.equipe.find((e) => /candidat/i.test(e.funcao)) || null;
  const coordGeral = () => estado.equipe.find((e) => /coordena[çc][ãa]o geral/i.test(e.funcao)) || candidato() || estado.equipe[0] || null;
  const responsavelPadrao = () => (coordGeral() ? coordGeral().pessoaId : null);
  const configurado = () => estado.config.configurado && bairros().length > 0;
  const zonas = () => Array.from(new Set(bairros().map((b) => b.zona).filter(Boolean))).sort();

  /* ==========================================================================
     Escrita
     ========================================================================== */
  const HOJE = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; };
  const hojeIso = () => iso(HOJE());

  function salvarConfig(dados) {
    Object.assign(estado.config, dados, { configurado: true });
    gravar(true);
    return estado.config;
  }

  function addTerritorio(d) {
    const t = {
      id: id(d.tipo === 'regiao' ? 'reg' : 'b'), nome: d.nome, tipo: d.tipo || 'bairro',
      paiId: d.paiId || null, eleitores: +d.eleitores || 0, zona: d.zona || '',
      localidades: d.localidades || [], meta: +d.meta || 0, obs: d.obs || '',
    };
    estado.territorios.push(t);
    reindexar();
    gravar();
    return t;
  }

  function editarTerritorio(tid, d) {
    const t = idxTerr.get(tid);
    if (!t) return null;
    Object.assign(t, d, { eleitores: +d.eleitores || t.eleitores, meta: +d.meta || t.meta });
    reindexar();
    gravar();
    return t;
  }

  function removerTerritorio(tid) {
    const usado = estado.pessoas.some((p) => p.bairroId === tid) || estado.territorios.some((t) => t.paiId === tid);
    if (usado) return 'Este território já tem registros vinculados e não pode ser removido.';
    estado.territorios = estado.territorios.filter((t) => t.id !== tid);
    mapa = null;
    reindexar();
    gravar();
    return null;
  }

  function addPessoa(d) {
    const b = idxTerr.get(d.bairroId) || bairros()[0];
    const p = {
      id: id('p'), nome: d.nome, telefone: d.telefone || '', email: d.email || '',
      nascimento: d.nascimento || '', genero: d.genero || '',
      bairroId: b ? b.id : null, localidade: d.localidade || '',
      zona: d.zona || (b ? b.zona : ''), secao: d.secao || '',
      tipos: [], classificacao: d.classificacao || 'contato',
      origem: d.origem || 'Cadastro espontâneo', indicadoPor: d.indicadoPor || null,
      responsavelId: d.responsavelId || d.cadastradoPor || responsavelPadrao(),
      cadastradoPor: d.cadastradoPor || responsavelPadrao(),
      dataCadastro: d.dataCadastro || hojeIso(), tags: d.tags || [], obs: d.obs || '',
    };
    aplicarTipos(p);
    estado.pessoas.push(p);
    estado.historicoClass.push({ pessoaId: p.id, classificacao: p.classificacao, data: p.dataCadastro });
    reindexar();
    if (d.obs) addInteracao(p.id, { tipo: 'Encaminhamento', canal: 'Presencial', resumo: d.obs, responsavelId: p.cadastradoPor });
    gravar();
    return p;
  }

  function aplicarTipos(p) {
    const i = CLASSIF.indexOf(p.classificacao);
    const t = new Set(p.tipos || []);
    t.add('eleitor');
    if (i >= 1) t.add('simpatizante');
    if (i >= 2) t.add('apoiador');
    if (i >= 4) t.add('mobilizador');
    if (i >= 5) t.add('liderança');
    if (idxFuncao && idxFuncao.has(p.id)) t.add('integrante da equipe');
    p.tipos = Array.from(t);
    return p;
  }

  function editarPessoa(pid, d) {
    const p = P(pid);
    if (!p) return null;
    Object.assign(p, d);
    aplicarTipos(p);
    reindexar();
    gravar();
    return p;
  }

  function addInteracao(pessoaId, d) {
    const i = {
      id: id('i'), pessoaId, tipo: d.tipo || 'Ligação', canal: d.canal || 'Telefone',
      data: d.data || hojeIso(), responsavelId: d.responsavelId || responsavelPadrao(),
      resumo: d.resumo || '', retorno: !!d.retorno, eventoId: d.eventoId || null,
    };
    estado.interacoes.push(i);
    if (!interPorPessoa.has(pessoaId)) interPorPessoa.set(pessoaId, []);
    interPorPessoa.get(pessoaId).push(i);
    gravar();
    return i;
  }

  function setClassificacao(pessoaId, nova) {
    const p = P(pessoaId);
    if (!p || p.classificacao === nova) return p;
    p.classificacao = nova;
    estado.historicoClass.push({ pessoaId, classificacao: nova, data: hojeIso() });
    aplicarTipos(p);
    gravar();
    return p;
  }

  function addIntegranteEquipe(d) {
    const e = {
      pessoaId: d.pessoaId, funcao: d.funcao || 'Voluntário(a)', area: d.area || 'Mobilização',
      respondeA: d.respondeA || null, regiaoId: d.regiaoId || null, desde: d.desde || hojeIso(),
    };
    if (estado.equipe.some((x) => x.pessoaId === e.pessoaId)) return null;
    estado.equipe.push(e);
    reindexar();
    if (P(e.pessoaId)) aplicarTipos(P(e.pessoaId));
    gravar();
    return e;
  }

  function addEquipe(d) {
    const eq = {
      id: id('eq'), nome: d.nome, responsavelId: d.responsavelId || null,
      territorioId: d.territorioId || null, objetivo: d.objetivo || '',
      integrantes: d.responsavelId ? [d.responsavelId] : [], criadaEm: hojeIso(),
    };
    estado.equipes.push(eq);
    reindexar();
    gravar();
    return eq;
  }

  function addIntegrante(equipeId, pessoaId) {
    const eq = idxEquipe.get(equipeId);
    if (!eq || eq.integrantes.includes(pessoaId)) return null;
    eq.integrantes.push(pessoaId);
    gravar();
    return eq;
  }

  function addLideranca(pessoaId, d) {
    const p = P(pessoaId);
    if (!p || idxLideranca.has(pessoaId)) return null;
    setClassificacao(pessoaId, 'lideranca');
    const l = {
      pessoaId, segmento: d.segmento || 'Comunitária', atuacao: d.atuacao || '',
      territorios: [p.bairroId].filter(Boolean), responsavelId: d.responsavelId || responsavelPadrao(),
      capacidade: +d.capacidade || 3, alcanceEstimado: (+d.capacidade || 3) * 80,
      reunioes: 0, compromissos: [], situacao: d.situacao || 'aproximação',
    };
    estado.liderancas.push(l);
    reindexar();
    gravar();
    return l;
  }

  function addTarefa(d) {
    const t = {
      id: id('t'), titulo: d.titulo, descricao: d.descricao || '',
      responsavelId: d.responsavelId || null, equipeId: d.equipeId || null,
      territorioId: d.territorioId || null, area: d.area || 'Mobilização',
      prazo: d.prazo || iso(addDays(HOJE(), 7)), criadaEm: hojeIso(),
      status: 'não iniciada', progresso: 0, prioridade: d.prioridade || 'média',
      objetivo: d.objetivo || '', andamento: '',
      checklist: (d.etapas || []).map((x) => ({ passo: x, feito: false })),
    };
    if (!t.checklist.length) t.checklist = [{ passo: 'Executar a tarefa', feito: false }];
    estado.tarefas.push(t);
    gravar();
    return t;
  }

  function atualizarTarefa(t) {
    const feitos = t.checklist.filter((c) => c.feito).length;
    t.progresso = Math.round((feitos / t.checklist.length) * 100);
    if (t.status !== 'cancelada') {
      if (t.progresso === 100) t.status = 'concluída';
      else if (t.prazo < hojeIso()) t.status = 'atrasada';
      else if (t.progresso === 0) t.status = 'não iniciada';
      else t.status = 'em andamento';
    }
    gravar();
    return t;
  }

  function addMeta(d) {
    const m = {
      id: id('m'), titulo: d.titulo, escopo: d.escopo || 'campanha', alvoId: d.alvoId || null,
      alvo: +d.alvo || 1, periodo: d.periodo || 'Semanal', prazo: d.prazo || iso(addDays(HOJE(), 7)),
      tipo: d.tipo || 'apoiadores',
    };
    estado.metas.push(m);
    gravar();
    return m;
  }

  function addDemanda(d) {
    const p = P(d.solicitanteId);
    const dem = {
      id: id('d'), solicitanteId: d.solicitanteId, descricao: d.descricao,
      responsavelId: d.responsavelId || responsavelPadrao(), data: hojeIso(),
      prazo: d.prazo || iso(addDays(HOJE(), 7)), prioridade: d.prioridade || 'média',
      status: 'aberta', territorioId: p ? p.bairroId : null, area: d.area || 'Coordenação Geral',
      encaminhamento: '', solucao: '',
    };
    estado.demandas.push(dem);
    reindexar();
    gravar();
    return dem;
  }

  function addEvento(d) {
    const e = {
      id: id('ev'), nome: d.nome, tipo: d.tipo || 'Reunião', data: d.data, hora: d.hora || '19:00',
      local: d.local || '', territorioId: d.territorioId || null, responsavelId: d.responsavelId || responsavelPadrao(),
      equipeId: d.equipeId || null, publicoPrevisto: +d.publicoPrevisto || 0, publicoPresente: null,
      novosCadastros: null, novosApoiadores: null, novosMobilizadores: null, liderancasPresentes: 0,
      logistica: d.logistica || [], status: 'confirmado', obs: '',
    };
    estado.eventos.push(e);
    gravar();
    return e;
  }

  function addAgenda(d) {
    const a = {
      id: id('ag'), titulo: d.titulo, tipo: d.tipo || 'Reunião', data: d.data, hora: d.hora || '09:00',
      duracao: +d.duracao || 60, local: d.local || '', responsaveis: [d.responsavelId || responsavelPadrao()].filter(Boolean), obs: d.obs || '',
    };
    estado.agenda.push(a);
    gravar();
    return a;
  }

  function addMaterial(d) {
    const m = { id: id('mat'), nome: d.nome, unidade: d.unidade || 'un', minimo: +d.minimo || 0, saldo: 0, movimentos: [] };
    estado.materiais.push(m);
    if (+d.entradaInicial) movimentarMaterial(m.id, 'entrada', +d.entradaInicial, { destino: 'Estoque central', finalidade: 'Carga inicial' });
    gravar();
    return m;
  }

  function movimentarMaterial(materialId, tipo, qtd, dados) {
    const m = estado.materiais.find((x) => x.id === materialId);
    if (!m) return null;
    qtd = Math.abs(+qtd || 0);
    if (!qtd) return { erro: 'Informe a quantidade.' };
    if (tipo === 'saída' && qtd > m.saldo) return { erro: 'Saldo insuficiente: restam ' + m.saldo + ' ' + m.unidade + '.' };
    m.saldo += tipo === 'entrada' ? qtd : -qtd;
    m.movimentos.push({
      tipo, qtd, data: hojeIso(), responsavelId: (dados && dados.responsavelId) || responsavelPadrao(),
      destino: (dados && dados.destino) || 'Estoque central', finalidade: (dados && dados.finalidade) || '',
    });
    gravar();
    return { material: m };
  }

  function addRecurso(d) {
    const r = {
      id: id('rec'), nome: d.nome, tipo: d.tipo || 'Equipamento', status: d.status || 'disponível',
      responsavelId: d.responsavelId || null, local: d.local || 'Comitê central', atividade: d.atividade || null,
    };
    estado.recursos.push(r);
    gravar();
    return r;
  }

  function addLancamento(d) {
    const f = {
      id: id('f'), descricao: d.descricao, area: d.area || 'Administrativo', fornecedor: d.fornecedor || '',
      previsto: +d.previsto || 0, realizado: +d.realizado || 0, data: d.data || hojeIso(), eventoId: d.eventoId || null,
    };
    estado.financeiro.push(f);
    gravar();
    return f;
  }

  function addLocalVotacao(d) {
    const lv = {
      id: id('lv'), nome: d.nome, territorioId: d.territorioId, zona: d.zona || (terr(d.territorioId) ? terr(d.territorioId).zona : ''),
      secoes: +d.secoes || 1, eleitores: +d.eleitores || 0,
      fiscaisNecessarios: +d.fiscaisNecessarios || +d.secoes || 1, fiscaisConfirmados: +d.fiscaisConfirmados || 0,
      coordenadorId: d.coordenadorId || null, transporte: !!d.transporte, plantao: d.plantao || 'dia inteiro', ocorrencias: [],
    };
    estado.locaisVotacao.push(lv);
    gravar();
    return lv;
  }

  function addOcorrencia(localId, d) {
    const lv = estado.locaisVotacao.find((x) => x.id === localId);
    if (!lv) return null;
    const o = { id: id('oc'), texto: d.texto, hora: d.hora || new Date().toTimeString().slice(0, 5), gravidade: d.gravidade || 'média', status: 'aberta' };
    lv.ocorrencias.push(o);
    gravar();
    return o;
  }

  function addPesquisa(d) {
    const ps = { id: id('ps'), titulo: d.titulo, tipo: d.tipo || 'Opinião eleitoral', data: d.data || hojeIso(), amostra: +d.amostra || 0, perguntas: d.perguntas || [] };
    estado.pesquisas.push(ps);
    gravar();
    return ps;
  }

  /* ---------------- perfil em uso ---------------- */
  /** perfil com que o sistema está sendo usado agora */
  function perfilAtual() {
    const remoto = global.SB && global.SB.membro ? global.SB.membro() : null;
    if (remoto && remoto.perfil) return remoto.perfil;
    return estado.config.perfilSimulado || 'coordenacao_geral';
  }
  const perfilInfo = () => PERFIS[perfilAtual()] || PERFIS.coordenacao_geral;
  const simulando = () => !(global.SB && global.SB.membro && global.SB.membro()) && !!estado.config.perfilSimulado && estado.config.perfilSimulado !== 'coordenacao_geral';
  function simularPerfil(p) {
    estado.config.perfilSimulado = p || null;
    gravar(true);
  }
  const podeVer = (rota) => {
    const info = perfilInfo();
    return info.rotas === '*' || info.rotas.indexOf(rota) >= 0;
  };
  const podeEscrever = () => perfilInfo().escreve;
  const ehAdmin = () => perfilInfo().admin;

  /* ==========================================================================
     Consultas gerenciais (todas seguras com a base vazia)
     ========================================================================== */
  function stats() {
    const ps = estado.pessoas;
    const c = countBy(ps, 'classificacao');
    const apoiadores = ps.filter(isApoiador).length;
    const hoje = HOJE();
    const novos7 = ps.filter((p) => daysBetween(p.dataCadastro, hoje) <= 7).length;
    const novos7ant = ps.filter((p) => { const d = daysBetween(p.dataCadastro, hoje); return d > 7 && d <= 14; }).length;
    const eleitores = municipio().eleitores;
    const dataEleicao = estado.config.dataEleicao;
    return {
      total: ps.length, apoiadores,
      contatos: c.get('contato') || 0, simpatizantes: c.get('simpatizante') || 0,
      participantes: c.get('participante') || 0, mobilizadores: c.get('mobilizador') || 0,
      liderancas: c.get('lideranca') || 0,
      novos7, novos7ant, variacao7: novos7ant ? Math.round(((novos7 - novos7ant) / novos7ant) * 100) : 0,
      eleitores, penetracao: eleitores ? (apoiadores / eleitores) * 100 : 0,
      tarefasAtrasadas: estado.tarefas.filter((t) => t.status === 'atrasada').length,
      tarefasAndamento: estado.tarefas.filter((t) => t.status === 'em andamento').length,
      tarefasConcluidas: estado.tarefas.filter((t) => t.status === 'concluída').length,
      demandasPendentes: estado.demandas.filter((d) => ['aberta', 'em análise', 'encaminhada'].includes(d.status)).length,
      eventosProximos: estado.eventos.filter((e) => e.data >= iso(hoje)).length,
      eventosRealizados: estado.eventos.filter((e) => e.status === 'realizado').length,
      publicoTotal: sum(estado.eventos.filter((e) => e.publicoPresente), (e) => e.publicoPresente),
      gastoPrevisto: sum(estado.financeiro, (f) => f.previsto),
      gastoRealizado: sum(estado.financeiro, (f) => f.realizado),
      diasEleicao: dataEleicao ? daysBetween(hoje, dataEleicao) : null,
    };
  }

  function serieCrescimento(dias) {
    dias = dias || 60;
    const hoje = HOJE();
    const ini = addDays(hoje, -dias + 1);
    const porDia = new Map();
    estado.pessoas.forEach((p) => porDia.set(p.dataCadastro, (porDia.get(p.dataCadastro) || 0) + 1));
    let acum = estado.pessoas.filter((p) => p.dataCadastro < iso(ini)).length;
    const out = [];
    for (let i = 0; i < dias; i++) {
      const d = iso(addDays(ini, i));
      const n = porDia.get(d) || 0;
      acum += n;
      out.push({ data: d, novos: n, acumulado: acum });
    }
    return out;
  }

  function serieClassificacao(semanas) {
    semanas = semanas || 12;
    const hoje = HOJE();
    const out = [];
    for (let s = semanas - 1; s >= 0; s--) {
      const fim = iso(addDays(hoje, -s * 7));
      const ini = iso(addDays(hoje, -(s + 1) * 7));
      const linha = { periodo: fim };
      CLASSIF.forEach((c) => {
        linha[c] = estado.pessoas.filter((p) => p.classificacao === c && p.dataCadastro > ini && p.dataCadastro <= fim).length;
      });
      out.push(linha);
    }
    return out;
  }

  const funil = () => CLASSIF.map((c, i) => ({
    chave: c, rotulo: CLASSIF_LABEL[c], cor: CLASSIF_COR[c],
    valor: estado.pessoas.filter((p) => CLASSIF.indexOf(p.classificacao) >= i).length,
  }));

  function rankingMobilizadores(limite) {
    const hoje = HOJE();
    const linhas = [];
    cadastradosPor.forEach((lista, pid) => {
      if (!P(pid)) return;
      const apo = lista.filter(isApoiador).length;
      linhas.push({
        pessoaId: pid, cadastros: lista.length,
        simpatizantes: lista.filter(isSimp).length, apoiadores: apo,
        participantes: lista.filter((p) => ['participante', 'mobilizador', 'lideranca'].includes(p.classificacao)).length,
        recentes: lista.filter((p) => daysBetween(p.dataCadastro, hoje) <= 14).length,
        conversao: lista.length ? (apo / lista.length) * 100 : 0,
      });
    });
    return sortBy(linhas, (l) => l.cadastros, 'desc').slice(0, limite || 999);
  }

  function redeIndicacoes(limite) {
    const linhas = [];
    indicadosPor.forEach((lista, pid) => {
      if (!P(pid)) return;
      let netos = 0;
      lista.forEach((p) => { netos += (indicadosPor.get(p.id) || []).length; });
      linhas.push({ pessoaId: pid, diretos: lista.length, indiretos: netos, total: lista.length + netos });
    });
    return sortBy(linhas, (l) => l.total, 'desc').slice(0, limite || 999);
  }

  function territorioStats() {
    const hoje = HOJE();
    return bairros().map((b) => {
      const ps = estado.pessoas.filter((p) => p.bairroId === b.id);
      const apo = ps.filter(isApoiador).length;
      const evs = estado.eventos.filter((e) => e.territorioId === b.id);
      const tfs = estado.tarefas.filter((t) => t.territorioId === b.id);
      const lids = estado.liderancas.filter((l) => (l.territorios || []).includes(b.id));
      const ultimaAtividade = []
        .concat(evs.filter((e) => e.status === 'realizado').map((e) => e.data))
        .concat(tfs.filter((t) => t.status === 'concluída' && t.prazo <= iso(hoje)).map((t) => t.prazo))
        .sort().pop();
      return {
        id: b.id, nome: b.nome, regiao: b.paiId && terr(b.paiId) ? terr(b.paiId).nome : 'sem região',
        eleitores: b.eleitores || 0, meta: b.meta || 0,
        pessoas: ps.length, apoiadores: apo, simpatizantes: ps.filter(isSimp).length,
        mobilizadores: ps.filter((p) => p.classificacao === 'mobilizador').length,
        liderancas: lids.length, eventos: evs.length,
        eventosRealizados: evs.filter((e) => e.status === 'realizado').length,
        tarefas: tfs.length, tarefasAtrasadas: tfs.filter((t) => t.status === 'atrasada').length,
        demandas: estado.demandas.filter((d) => d.territorioId === b.id).length,
        cobertura: b.eleitores ? (apo / b.eleitores) * 100 : 0,
        metaPct: b.meta ? (apo / b.meta) * 100 : 0,
        ultimaAtividade: ultimaAtividade || null,
        diasSemAtividade: ultimaAtividade ? daysBetween(ultimaAtividade, hoje) : null,
      };
    });
  }

  function metaAtual(m) {
    if (m.escopo === 'território') return estado.pessoas.filter((p) => p.bairroId === m.alvoId && isApoiador(p)).length;
    if (m.escopo === 'equipe') {
      const eq = idxEquipe.get(m.alvoId);
      return eq ? estado.pessoas.filter((p) => eq.integrantes.includes(p.cadastradoPor)).length : 0;
    }
    const hoje = HOJE();
    if (m.tipo === 'eventos') return estado.eventos.filter((e) => e.status === 'realizado' && daysBetween(e.data, hoje) <= 7).length;
    if (m.tipo === 'nucleos') return estado.equipes.filter((e) => daysBetween(e.criadaEm, hoje) <= 30).length;
    if (m.tipo === 'liderancas') return estado.liderancas.length;
    if (m.tipo === 'contatos') return estado.pessoas.filter((p) => daysBetween(p.dataCadastro, hoje) <= 30).length;
    return estado.pessoas.filter(isApoiador).length;
  }

  function equipeStats(eq) {
    const tfs = estado.tarefas.filter((t) => t.equipeId === eq.id);
    const cadastros = estado.pessoas.filter((p) => eq.integrantes.includes(p.cadastradoPor));
    const evs = estado.eventos.filter((e) => e.equipeId === eq.id);
    const concl = tfs.filter((t) => t.status === 'concluída').length;
    const atras = tfs.filter((t) => t.status === 'atrasada').length;
    const ms = estado.metas.filter((m) => m.escopo === 'equipe' && m.alvoId === eq.id);
    const metaPct = ms.length ? sum(ms, (m) => Math.min(100, m.alvo ? (metaAtual(m) / m.alvo) * 100 : 0)) / ms.length : 0;
    const conclusao = tfs.length ? (concl / tfs.length) * 100 : 0;
    return {
      tarefas: tfs.length, concluidas: concl, atrasadas: atras, conclusao,
      cadastros: cadastros.length, apoiadores: cadastros.filter(isApoiador).length,
      eventos: evs.length, metaPct,
      desempenho: Math.round(conclusao * 0.45 + Math.min(100, metaPct) * 0.4 + Math.min(100, cadastros.length / 3) * 0.15),
    };
  }

  function alertas() {
    const out = [];
    const s = stats();
    const hoje = HOJE();
    if (s.tarefasAtrasadas) {
      const eqs = new Set(estado.tarefas.filter((t) => t.status === 'atrasada').map((t) => t.equipeId)).size;
      out.push({ nivel: 'alto', icone: 'clock', titulo: s.tarefasAtrasadas + ' tarefas atrasadas', detalhe: eqs ? 'Distribuídas entre ' + eqs + ' equipes.' : 'Verifique os prazos com os responsáveis.', rota: '#/tarefas?status=atrasada' });
    }
    estado.materiais.filter((m) => m.minimo && m.saldo <= m.minimo).forEach((m) =>
      out.push({ nivel: 'alto', icone: 'package', titulo: 'Estoque baixo: ' + m.nome, detalhe: 'Saldo de ' + global.U.num(m.saldo) + ' ' + m.unidade + ' (mínimo ' + global.U.num(m.minimo) + ').', rota: '#/materiais' }));
    territorioStats().filter((t) => t.diasSemAtividade !== null && t.diasSemAtividade >= 7).forEach((t) =>
      out.push({ nivel: 'medio', icone: 'map-pin', titulo: t.nome + ' sem atividade há ' + t.diasSemAtividade + ' dias', detalhe: 'Cobertura de ' + global.U.dec(t.cobertura) + '% do eleitorado do bairro.', rota: '#/territorios/' + t.id }));
    estado.eventos.filter((e) => e.status === 'pendências' && e.data >= iso(hoje)).forEach((e) =>
      out.push({ nivel: 'alto', icone: 'triangle-alert', titulo: 'Evento com pendências: ' + e.nome, detalhe: global.U.fmtDate(e.data) + ' às ' + e.hora + ' — ' + e.local, rota: '#/eventos/' + e.id }));
    estado.equipes.map((eq) => ({ eq, st: equipeStats(eq) })).filter((x) => x.st.tarefas && x.st.metaPct < 45).forEach((x) =>
      out.push({ nivel: 'medio', icone: 'target', titulo: x.eq.nome + ' abaixo da meta', detalhe: 'Atingiu ' + Math.round(x.st.metaPct) + '% da meta do período.', rota: '#/equipes/' + x.eq.id }));
    estado.demandas.filter((d) => d.status === 'aberta' && daysBetween(d.data, hoje) > 12).forEach((d) =>
      out.push({ nivel: 'medio', icone: 'inbox', titulo: 'Demanda aberta há ' + daysBetween(d.data, hoje) + ' dias', detalhe: d.descricao, rota: '#/demandas' }));
    estado.locaisVotacao.filter((l) => l.fiscaisNecessarios && l.fiscaisConfirmados / l.fiscaisNecessarios < 0.6).forEach((l) =>
      out.push({ nivel: 'medio', icone: 'vote', titulo: 'Fiscais insuficientes: ' + l.nome, detalhe: l.fiscaisConfirmados + ' de ' + l.fiscaisNecessarios + ' seções cobertas.', rota: '#/eleicao' }));
    const ordem = { alto: 0, medio: 1, baixo: 2 };
    return out.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
  }

  function historicoPessoa(pid) {
    const p = P(pid);
    if (!p) return [];
    const itens = [{
      data: p.dataCadastro, tipo: 'Cadastro', icone: 'user-round-plus',
      texto: 'Cadastrado' + (p.cadastradoPor ? ' por ' + nome(p.cadastradoPor) : '') + (p.indicadoPor ? ', indicado por ' + nome(p.indicadoPor) : '') + '.',
    }];
    (interPorPessoa.get(pid) || []).forEach((i) => itens.push({
      data: i.data, tipo: i.tipo, texto: i.resumo, icone: ICONE_INTER[i.tipo] || 'circle',
      canal: i.canal, responsavelId: i.responsavelId,
    }));
    (demandasPorPessoa.get(pid) || []).forEach((d) => itens.push({
      data: d.data, tipo: 'Demanda', icone: 'inbox', texto: d.descricao + ' — situação: ' + d.status + '.',
    }));
    estado.historicoClass.filter((h) => h.pessoaId === pid).forEach((h, i) => {
      if (i) itens.push({ data: h.data, tipo: 'Classificação', icone: 'star', texto: 'Passou a ser classificado como ' + CLASSIF_LABEL[h.classificacao] + '.' });
    });
    return sortBy(itens, (x) => x.data, 'desc');
  }

  /* ==========================================================================
     Exposição
     ========================================================================== */
  const DB = {
    CLASSIF, CLASSIF_LABEL, CLASSIF_COR, ORIGENS, SEGMENTOS, AREAS, TIPO_INTER, TIPO_EVENTO, PRIORIDADES, FUNCOES,
    P, nome, primeiroNome, terr, nomeTerr, nomeEquipe, funcaoDe, isApoiador, isSimp,
    stats, serieCrescimento, serieClassificacao, funil, rankingMobilizadores, redeIndicacoes,
    territorioStats, metaAtual, equipeStats, alertas, historicoPessoa,
    salvarConfig, addTerritorio, editarTerritorio, removerTerritorio,
    addPessoa, editarPessoa, addInteracao, setClassificacao, addIntegranteEquipe,
    addEquipe, addIntegrante, addLideranca, addTarefa, atualizarTarefa, addMeta, addDemanda,
    addEvento, addAgenda, addMaterial, movimentarMaterial, addRecurso, addLancamento,
    addLocalVotacao, addOcorrencia, addPesquisa,
    zerar, exportarBase, importarBase, substituirBase, carregar, gravar, reindexar, baseVazia,
    PERFIS, simularPerfil,
    perfilInfo, simulando, podeVer, podeEscrever, ehAdmin,
  };

  // coleções e valores derivados sempre atuais
  const vivos = {
    estado: () => estado, config: () => estado.config,
    territorios: () => estado.territorios, bairros, regioes, municipio, zonas,
    pessoas: () => estado.pessoas, equipe: () => estado.equipe, equipes: () => estado.equipes,
    liderancas: () => estado.liderancas, interacoes: () => estado.interacoes,
    historicoClass: () => estado.historicoClass, tarefas: () => estado.tarefas,
    metas: () => estado.metas, demandas: () => estado.demandas, eventos: () => estado.eventos,
    agenda: () => estado.agenda, materiais: () => estado.materiais, recursos: () => estado.recursos,
    financeiro: () => estado.financeiro, pesquisas: () => estado.pesquisas,
    locaisVotacao: () => estado.locaisVotacao,
    mapa: () => mapa, staffIds, candidato, coordGeral, responsavelPadrao, configurado,
    HOJE, DIA_ELEICAO: () => (estado.config.dataEleicao ? toDate(estado.config.dataEleicao) : null),
    perfil: perfilAtual,
    interPorPessoa: () => interPorPessoa, indicadosPor: () => indicadosPor,
    cadastradosPor: () => cadastradosPor, demandasPorPessoa: () => demandasPorPessoa,
    vazia: () => !estado.pessoas.length && !estado.territorios.length,
  };
  Object.keys(vivos).forEach((k) => Object.defineProperty(DB, k, { get: vivos[k], enumerable: true }));

  reindexar();
  DB.carregou = carregar();
  global.DB = DB;
})(window);

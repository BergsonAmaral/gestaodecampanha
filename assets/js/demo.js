/* ==========================================================================
   demo.js — base de demonstração (opcional)
   Popula o sistema usando exatamente as mesmas funções de escrita das telas,
   para apresentar a plataforma sem digitar nada. Nunca roda sozinho.
   ========================================================================== */
(function (global) {
  'use strict';
  const { rng, pick, pickW, int, iso, addDays } = global.U;

  const NOMES_M = ['João','José','Antônio','Francisco','Carlos','Paulo','Pedro','Lucas','Luiz','Marcos','Rafael','Daniel','Bruno','Eduardo','Felipe','Rodrigo','Gustavo','Leandro','Sérgio','Ricardo','Anderson','Thiago','Diego','Roberto','Elias','Raimundo','Sebastião','Valdir','Otávio','Márcio'];
  const NOMES_F = ['Maria','Ana','Francisca','Antônia','Adriana','Juliana','Márcia','Fernanda','Patrícia','Aline','Sandra','Camila','Amanda','Bruna','Jéssica','Letícia','Júlia','Luciana','Vanessa','Mariana','Gabriela','Vera','Cristina','Simone','Rita','Débora','Elaine','Cláudia','Solange','Renata'];
  const SOBRENOMES = ['Silva','Santos','Oliveira','Souza','Lima','Pereira','Ferreira','Alves','Rodrigues','Costa','Gomes','Martins','Araújo','Melo','Barbosa','Ribeiro','Cardoso','Nascimento','Moreira','Carvalho','Dias','Freitas','Teixeira','Batista','Correia','Rocha','Cavalcante','Andrade','Vieira','Monteiro'];
  const REGIOES = ['Região Centro','Região Norte','Região Sul','Região Leste','Região Oeste'];
  const BAIRROS = ['Centro','Alto Alegre','São José','Bela Vista','Nova Esperança','Vila União','Jardim Primavera','Santa Luzia','Boa Vista','Planalto','Cidade Nova','Recanto Verde'];
  const LOCALIDADES = ['Rua do Comércio','Conjunto Habitacional','Vila Nova','Sítio Bom Jesus','Travessa da Igreja','Loteamento Girassol','Núcleo Rural','Praça da Matriz'];

  function gerar() {
    const D = global.DB;
    const R = rng(90210);
    const hoje = D.HOJE;
    const nome = () => {
      const f = R() < 0.51;
      return { nome: (f ? pick(R, NOMES_F) : pick(R, NOMES_M)) + ' ' + pick(R, SOBRENOMES) + ' ' + pick(R, SOBRENOMES), genero: f ? 'F' : 'M' };
    };
    const tel = () => '(88) 9' + int(R, 8000, 9999) + '-' + int(R, 1000, 9999);

    D.zerar();
    D.salvarConfig({
      candidato: 'Ricardo Fontes Albuquerque', cargo: 'Prefeito(a)', municipio: 'Cariré do Vale',
      uf: 'CE', ano: hoje.getFullYear(), dataEleicao: iso(addDays(hoje, 50)),
    });

    /* território */
    const regioes = REGIOES.map((n) => D.addTerritorio({ nome: n, tipo: 'regiao' }));
    const bairros = BAIRROS.map((n, i) => D.addTerritorio({
      nome: n, tipo: 'bairro', paiId: regioes[i % regioes.length].id,
      eleitores: int(R, 1800, 6200), zona: '0' + pick(R, [21, 34, 57]),
      localidades: [pick(R, LOCALIDADES), pick(R, LOCALIDADES)],
      meta: 0,
    }));
    bairros.forEach((b) => D.editarTerritorio(b.id, { meta: Math.round(b.eleitores * 0.05) }));
    const peso = new Map(bairros.map((b) => [b.id, 0.15 + Math.pow(R(), 1.4) * 1.0]));
    const sorteiaBairro = () => pickW(R, bairros, bairros.map((b) => b.eleitores * peso.get(b.id)));

    /* estrutura da campanha */
    const criar = (over) => {
      const n = nome();
      return D.addPessoa(Object.assign({ nome: n.nome, genero: n.genero, telefone: tel(), bairroId: sorteiaBairro().id, secao: String(int(R, 1, 320)).padStart(3, '0') }, over));
    };
    const candidato = criar({ nome: 'Ricardo Fontes Albuquerque', classificacao: 'lideranca', origem: 'Comitê', bairroId: bairros[0].id });
    D.addIntegranteEquipe({ pessoaId: candidato.id, funcao: 'Candidato(a)', area: 'Coordenação Geral' });
    const geral = criar({ nome: 'Helena Muniz Tavares', classificacao: 'lideranca', origem: 'Comitê', bairroId: bairros[0].id });
    D.addIntegranteEquipe({ pessoaId: geral.id, funcao: 'Coordenação geral', area: 'Coordenação Geral', respondeA: candidato.id });

    const coordArea = D.AREAS.slice(1).map((area) => {
      const p = criar({ classificacao: 'lideranca', origem: 'Comitê' });
      D.addIntegranteEquipe({ pessoaId: p.id, funcao: 'Coordenação de área — ' + area, area, respondeA: geral.id });
      return p;
    });
    const coordTerr = regioes.map((reg) => {
      const p = criar({ classificacao: 'lideranca', origem: 'Reunião' });
      D.addIntegranteEquipe({ pessoaId: p.id, funcao: 'Coordenação territorial — ' + reg.nome, area: 'Território', respondeA: geral.id, regiaoId: reg.id });
      return p;
    });
    const agentes = [];
    for (let i = 0; i < 14; i++) {
      const p = criar({ classificacao: 'mobilizador', origem: 'Reunião' });
      D.addIntegranteEquipe({ pessoaId: p.id, funcao: 'Mobilizador(a) de campo', area: 'Mobilização', respondeA: pick(R, coordTerr).id });
      agentes.push(p);
    }

    /* base de pessoas */
    const TOTAL = 900;
    const pessoas = [];
    for (let i = 0; i < TOTAL; i++) {
      const dias = Math.round(Math.pow(R(), 1.28) * 110);
      const n = nome();
      const p = D.addPessoa({
        nome: n.nome, genero: n.genero, telefone: tel(), bairroId: sorteiaBairro().id,
        classificacao: pickW(R, D.CLASSIF, [26, 24, 27, 12, 7, 4]),
        origem: pick(R, D.ORIGENS), dataCadastro: iso(addDays(hoje, -dias)),
        cadastradoPor: pick(R, agentes).id, secao: String(int(R, 1, 320)).padStart(3, '0'),
      });
      pessoas.push(p);
    }
    // indicações e histórico de contato
    const indicadores = pessoas.filter((p) => ['apoiador', 'participante', 'mobilizador', 'lideranca'].includes(p.classificacao));
    pessoas.forEach((p) => {
      if (R() < 0.3 && indicadores.length) {
        const ind = pick(R, indicadores);
        if (ind.id !== p.id && ind.dataCadastro <= p.dataCadastro) {
          D.editarPessoa(p.id, { indicadoPor: ind.id, origem: 'Indicação de apoiador' });
        }
      }
      const qtd = { contato: 0, simpatizante: 1, apoiador: 2, participante: 2, mobilizador: 3, lideranca: 4 }[p.classificacao];
      for (let k = 0; k < qtd; k++) {
        const tipo = pick(R, D.TIPO_INTER);
        D.addInteracao(p.id, {
          tipo, canal: pick(R, ['WhatsApp', 'Telefone', 'Presencial', 'Visita']),
          data: iso(addDays(p.dataCadastro, int(R, 0, Math.max(1, global.U.daysBetween(p.dataCadastro, hoje))))),
          responsavelId: p.cadastradoPor, retorno: R() < 0.7,
          resumo: { 'Ligação': 'Ligação realizada. Confirmou interesse em participar.', 'Mensagem': 'Mensagem enviada com o convite para a reunião.', 'Visita': 'Visita domiciliar realizada pela equipe.', 'Reunião': 'Participou de reunião no território.', 'Convite': 'Convite entregue para atividade do bairro.', 'Participação em evento': 'Presente em atividade da campanha.', 'Pedido': 'Apresentou pedido para a comunidade.', 'Reclamação': 'Registrou reclamação sobre serviço público.', 'Solicitação': 'Solicitou material de campanha.', 'Retorno da campanha': 'Coordenação retornou o contato.', 'Encaminhamento': 'Assunto encaminhado à coordenação.' }[tipo],
        });
      }
    });

    /* lideranças */
    pessoas.filter((p) => p.classificacao === 'lideranca').slice(0, 30).forEach((p) =>
      D.addLideranca(p.id, {
        segmento: pick(R, D.SEGMENTOS), capacidade: int(R, 2, 5),
        atuacao: pick(R, ['Associação de moradores', 'Igreja', 'Sindicato', 'Comércio local', 'Escola', 'Clube esportivo', 'Grupo cultural']),
        responsavelId: pick(R, coordTerr).id, situacao: pickW(R, ['aproximação', 'relacionamento', 'compromisso firmado', 'em disputa'], [24, 36, 28, 12]),
      }));

    /* equipes, tarefas, metas */
    const equipes = ['Núcleo Centro', 'Equipe Juventude', 'Equipe Mulheres', 'Núcleo Alto Alegre', 'Equipe Eventos', 'Equipe Mobilização Norte'].map((n, i) => {
      const eq = D.addEquipe({ nome: n, responsavelId: agentes[i % agentes.length].id, territorioId: bairros[i % bairros.length].id,
        objetivo: pick(R, ['Ampliar a base de apoiadores no território', 'Organizar reuniões semanais com moradores', 'Mobilizar o segmento para as atividades', 'Identificar e formar novas lideranças']) });
      agentes.slice(i, i + 3).forEach((a) => D.addIntegrante(eq.id, a.id));
      pessoas.filter(() => R() < 0.02).slice(0, 12).forEach((p) => D.addIntegrante(eq.id, p.id));
      return eq;
    });

    const TITULOS = ['Organizar reunião no bairro', 'Cadastrar novos apoiadores', 'Visitar liderança comunitária', 'Distribuir material de campanha', 'Confirmar presença para o evento', 'Mapear ruas sem cobertura', 'Levantar demandas da comunidade', 'Recrutar fiscais de seção'];
    const PASSOS = ['Contactar liderança local', 'Definir local', 'Convidar participantes', 'Organizar estrutura', 'Confirmar transporte', 'Realizar a atividade', 'Registrar participantes'];
    for (let i = 0; i < 55; i++) {
      const eq = pick(R, equipes);
      const prazo = addDays(hoje, int(R, -35, 20));
      const t = D.addTarefa({
        titulo: pick(R, TITULOS) + ' — ' + D.terr(eq.territorioId).nome,
        descricao: 'Atividade prevista no plano semanal de mobilização.',
        responsavelId: pick(R, eq.integrantes), equipeId: eq.id, territorioId: eq.territorioId,
        area: pick(R, D.AREAS), prazo: iso(prazo), prioridade: pickW(R, D.PRIORIDADES, [20, 40, 30, 10]),
        objetivo: pick(R, ['Ampliar base no território', 'Garantir público no evento', 'Fortalecer relacionamento com lideranças']),
        etapas: Array.from({ length: int(R, 3, 6) }, (_, k) => PASSOS[k % PASSOS.length]),
      });
      const avanco = prazo < hoje ? pickW(R, [1, 0.6, 0], [62, 26, 12]) : pickW(R, [0, 0.5], [55, 45]);
      t.checklist.forEach((c, k) => { c.feito = k < Math.round(avanco * t.checklist.length); });
      D.atualizarTarefa(t);
    }

    bairros.filter((b, i) => i % 2 === 0).forEach((b) =>
      D.addMeta({ titulo: 'Apoiadores no ' + b.nome, escopo: 'território', alvoId: b.id, alvo: Math.round(b.meta * 0.85), periodo: 'Campanha', prazo: iso(addDays(hoje, int(R, 10, 40))), tipo: 'apoiadores' }));
    equipes.forEach((eq) => D.addMeta({ titulo: 'Novos contatos — ' + eq.nome, escopo: 'equipe', alvoId: eq.id, alvo: int(R, 60, 180), periodo: 'Mensal', prazo: iso(addDays(hoje, 20)), tipo: 'contatos' }));
    D.addMeta({ titulo: 'Realizar 10 reuniões na semana', escopo: 'campanha', alvo: 10, periodo: 'Semanal', prazo: iso(addDays(hoje, 5)), tipo: 'eventos' });
    D.addMeta({ titulo: 'Identificar 40 novas lideranças', escopo: 'campanha', alvo: 40, periodo: 'Campanha', prazo: iso(addDays(hoje, 30)), tipo: 'liderancas' });

    /* eventos e agenda */
    for (let i = 0; i < 22; i++) {
      const b = sorteiaBairro();
      const d = addDays(hoje, int(R, -50, 25));
      const previsto = int(R, 40, 320);
      const ev = D.addEvento({
        nome: pick(R, ['Reunião com moradores', 'Caminhada', 'Encontro com lideranças', 'Plenária', 'Visita à comunidade', 'Lançamento de núcleo']) + ' — ' + b.nome,
        tipo: pick(R, D.TIPO_EVENTO), data: iso(d), hora: pick(R, ['09:00', '15:00', '18:30', '19:00', '20:00']),
        local: pick(R, ['Praça central', 'Quadra da escola', 'Salão comunitário', 'Sede da associação']) + ' — ' + b.nome,
        territorioId: b.id, responsavelId: pick(R, coordTerr).id, equipeId: pick(R, equipes).id,
        publicoPrevisto: previsto, logistica: ['Som', 'Cadeiras', 'Transporte', 'Panfletos'].filter(() => R() < 0.5),
      });
      if (d < hoje) {
        const presente = Math.round(previsto * (0.6 + R() * 0.8));
        Object.assign(ev, {
          publicoPresente: presente, novosCadastros: Math.round(presente * 0.2), novosApoiadores: Math.round(presente * 0.12),
          novosMobilizadores: int(R, 0, 6), liderancasPresentes: int(R, 1, 10), status: 'realizado',
          obs: pick(R, ['Público acima do previsto. Boa adesão local.', 'Participação concentrada em duas ruas do bairro.', 'Liderança local assumiu compromisso de formar núcleo.']),
        });
      } else if (R() < 0.15) ev.status = 'pendências';
    }
    for (let i = 0; i < 16; i++) {
      D.addAgenda({
        titulo: pick(R, ['Entrevista em rádio', 'Gravação de programa', 'Reunião com coordenação', 'Visita a comunidade', 'Encontro com empresários', 'Reunião de logística']),
        tipo: pick(R, ['Entrevista', 'Gravação', 'Reunião', 'Visita', 'Interno']),
        data: iso(addDays(hoje, int(R, -5, 20))), hora: pick(R, ['08:00', '10:00', '14:00', '16:00', '19:00']),
        local: pick(R, ['Comitê central', 'Rádio Cidade', 'Auditório do sindicato', 'Estúdio']), responsavelId: geral.id,
      });
    }

    /* demandas */
    const TXT = ['Liderança solicita reunião com o candidato', 'Equipe solicita 500 panfletos para atividade', 'Moradores pedem melhoria na iluminação da rua', 'Associação pede apoio para evento comunitário', 'Solicitação de transporte para atividade no distrito', 'Pedido de camisetas para o núcleo do bairro'];
    for (let i = 0; i < 28; i++) {
      const sol = pick(R, pessoas.filter((p) => p.classificacao !== 'contato'));
      const dem = D.addDemanda({ solicitanteId: sol.id, descricao: pick(R, TXT), area: pick(R, D.AREAS), prioridade: pickW(R, D.PRIORIDADES, [22, 38, 28, 12]) });
      dem.data = iso(addDays(hoje, -int(R, 0, 45)));
      dem.status = pickW(R, ['aberta', 'em análise', 'encaminhada', 'atendida'], [24, 18, 22, 36]);
      if (dem.status !== 'aberta') dem.encaminhamento = pick(R, ['Encaminhada à coordenação de logística.', 'Repassada ao coordenador territorial.', 'Incluída na pauta da reunião semanal.']);
      if (dem.status === 'atendida') dem.solucao = pick(R, ['Material entregue ao solicitante.', 'Reunião agendada e realizada.', 'Visita realizada pela equipe.']);
    }

    /* recursos */
    [['Panfleto A5', 'un', 20000], ['Santinho', 'un', 40000], ['Adesivo de carro', 'un', 2500], ['Bandeira grande', 'un', 400], ['Camiseta', 'un', 1200], ['Boné', 'un', 600]].forEach((m) => {
      const mat = D.addMaterial({ nome: m[0], unidade: m[1], minimo: Math.round(m[2] * 0.15), entradaInicial: m[2] });
      for (let k = 0; k < int(R, 3, 9); k++) {
        const eq = pick(R, equipes);
        D.movimentarMaterial(mat.id, 'saída', Math.round(m[2] * (0.02 + R() * 0.09)), { destino: eq.nome, finalidade: pick(R, ['Panfletagem', 'Evento', 'Reunião de núcleo', 'Caminhada']), responsavelId: eq.responsavelId });
      }
    });
    ['Van 15 lugares', 'Carro de som', 'Pick-up branca', 'Moto de apoio', 'Notebook coordenação', 'Projetor', 'Tenda de eventos'].forEach((n) =>
      D.addRecurso({ nome: n, tipo: /Van|Carro|Pick|Moto/.test(n) ? 'Veículo' : /Notebook|Projetor/.test(n) ? 'Equipamento' : 'Estrutura',
        status: pickW(R, ['disponível', 'em uso', 'manutenção'], [40, 50, 10]), local: pick(R, bairros).nome, responsavelId: pick(R, agentes).id }));
    for (let i = 0; i < 30; i++) {
      const prev = Math.round((300 + R() * 6000) / 50) * 50;
      D.addLancamento({ descricao: pick(R, ['Impressão de material', 'Locação de som', 'Combustível', 'Alimentação de equipe', 'Locação de veículo', 'Produção de vídeo']),
        area: pick(R, D.AREAS), fornecedor: pick(R, ['Gráfica Central', 'Som & Luz Eventos', 'Transportes Vale', 'Papelaria Modelo', 'Agência Criativa']),
        previsto: prev, realizado: R() < 0.8 ? Math.round(prev * (0.8 + R() * 0.4)) : 0, data: iso(addDays(hoje, -int(R, 0, 90))) });
    }

    /* dia da eleição */
    bairros.forEach((b) => {
      const n = Math.max(1, Math.round(b.eleitores / 3000));
      for (let k = 0; k < n; k++) {
        const secoes = int(R, 4, 12);
        D.addLocalVotacao({
          nome: pick(R, ['E.M. Professor', 'Escola Estadual', 'Centro Comunitário', 'Colégio Municipal']) + ' ' + pick(R, SOBRENOMES),
          territorioId: b.id, secoes, eleitores: Math.round(b.eleitores / n),
          fiscaisNecessarios: secoes, fiscaisConfirmados: Math.round(secoes * (0.4 + R() * 0.7)),
          coordenadorId: pick(R, agentes).id, transporte: R() < 0.4, plantao: pick(R, ['manhã', 'tarde', 'dia inteiro']),
        });
      }
    });
    D.locaisVotacao.filter(() => R() < 0.25).forEach((lv) =>
      D.addOcorrencia(lv.id, { texto: pick(R, ['Boca de urna adversária na entrada', 'Falta de material de identificação', 'Fiscal ausente na seção', 'Eleitor sem transporte']),
        hora: pick(R, ['07:20', '09:10', '11:30', '14:40']), gravidade: pick(R, ['baixa', 'média', 'alta']) }));

    /* pesquisas */
    D.addPesquisa({ titulo: 'Intenção de voto — rodada 3', tipo: 'Opinião eleitoral', data: iso(addDays(hoje, -9)), amostra: 620, perguntas: [
      { texto: 'Em quem votaria hoje para prefeito?', opcoes: [['Ricardo Fontes', 34], ['Adversário A', 29], ['Adversário B', 12], ['Branco/Nulo', 9], ['Indeciso', 16]] },
      { texto: 'Como avalia a gestão atual?', opcoes: [['Ótima', 8], ['Boa', 21], ['Regular', 34], ['Ruim', 22], ['Péssima', 15]] }] });
    D.addPesquisa({ titulo: 'Principais demandas do município', tipo: 'Identificação de demandas', data: iso(addDays(hoje, -22)), amostra: 480, perguntas: [
      { texto: 'Qual o principal problema do seu bairro?', opcoes: [['Saúde', 31], ['Emprego', 24], ['Educação', 16], ['Segurança', 13], ['Saneamento', 11], ['Outros', 5]] }] });

    D.gravar(true);
    return { pessoas: D.pessoas.length, bairros: D.bairros.length };
  }

  global.DEMO = { gerar };
})(window);

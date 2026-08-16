-- ============================================================================
-- SIGC — Sistema Integrado de Gestão de Campanha
-- Esquema do banco (PostgreSQL / Supabase) — parte 1: estrutura
-- Execute no SQL Editor do Supabase, na ordem: 01_schema, 02_rls, 03_seed_opcional
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- vocabulário
do $$ begin
  create type classificacao_pessoa as enum ('contato','simpatizante','apoiador','participante','mobilizador','lideranca');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_territorio as enum ('municipio','regiao','bairro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type perfil_acesso as enum ('coordenacao_geral','coordenacao_area','coordenacao_territorial','supervisor','mobilizador','leitura');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_tarefa as enum ('não iniciada','em andamento','concluída','atrasada','cancelada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_demanda as enum ('aberta','em análise','encaminhada','atendida','não atendida');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_evento as enum ('confirmado','pendências','realizado','cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type prioridade as enum ('baixa','média','alta','urgente');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- campanha
create table if not exists campanhas (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  candidato     text not null,
  cargo         text not null default 'Prefeito(a)',
  municipio     text not null,
  uf            char(2),
  ano           int  not null,
  data_eleicao  date,
  criada_em     timestamptz not null default now()
);

-- ---------------------------------------------------------------- territórios
create table if not exists territorios (
  id           uuid primary key default gen_random_uuid(),
  campanha_id  uuid not null references campanhas(id) on delete cascade,
  nome         text not null,
  tipo         tipo_territorio not null default 'bairro',
  pai_id       uuid references territorios(id) on delete set null,
  eleitores    int  not null default 0,
  zona         text,
  localidades  text[] not null default '{}',
  meta         int  not null default 0,
  obs          text,
  criado_em    timestamptz not null default now(),
  unique (campanha_id, nome)
);
create index if not exists ix_territorios_campanha on territorios(campanha_id);
create index if not exists ix_territorios_pai on territorios(pai_id);

-- ---------------------------------------------------------------- pessoas
create table if not exists pessoas (
  id             uuid primary key default gen_random_uuid(),
  campanha_id    uuid not null references campanhas(id) on delete cascade,
  nome           text not null,
  telefone       text,
  email          text,
  nascimento     date,
  genero         text,
  bairro_id      uuid references territorios(id) on delete set null,
  localidade     text,
  zona           text,
  secao          text,
  classificacao  classificacao_pessoa not null default 'contato',
  origem         text,
  indicado_por   uuid references pessoas(id) on delete set null,
  responsavel_id uuid references pessoas(id) on delete set null,
  cadastrado_por uuid references pessoas(id) on delete set null,
  data_cadastro  date not null default current_date,
  tags           text[] not null default '{}',
  obs            text,
  criado_em      timestamptz not null default now()
);
create index if not exists ix_pessoas_campanha on pessoas(campanha_id);
create index if not exists ix_pessoas_bairro on pessoas(bairro_id);
create index if not exists ix_pessoas_cadastrado_por on pessoas(cadastrado_por);
create index if not exists ix_pessoas_indicado_por on pessoas(indicado_por);
create index if not exists ix_pessoas_classificacao on pessoas(campanha_id, classificacao);
create index if not exists ix_pessoas_nome on pessoas using gin (to_tsvector('portuguese', nome));

-- ---------------------------------------------------------------- acesso
create table if not exists membros (
  id          uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references campanhas(id) on delete cascade,
  user_id     uuid not null,                    -- auth.users.id
  pessoa_id   uuid references pessoas(id) on delete set null,
  perfil      perfil_acesso not null default 'mobilizador',
  regiao_id   uuid references territorios(id) on delete set null,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  unique (campanha_id, user_id)
);
create index if not exists ix_membros_user on membros(user_id);

-- estrutura formal da campanha (quem responde a quem)
create table if not exists equipe_campanha (
  id          uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references campanhas(id) on delete cascade,
  pessoa_id   uuid not null references pessoas(id) on delete cascade,
  funcao      text not null,
  area        text,
  responde_a  uuid references pessoas(id) on delete set null,
  regiao_id   uuid references territorios(id) on delete set null,
  desde       date not null default current_date,
  unique (campanha_id, pessoa_id)
);

-- ---------------------------------------------------------------- relacionamento
create table if not exists interacoes (
  id             uuid primary key default gen_random_uuid(),
  campanha_id    uuid not null references campanhas(id) on delete cascade,
  pessoa_id      uuid not null references pessoas(id) on delete cascade,
  tipo           text not null,
  canal          text,
  data           date not null default current_date,
  responsavel_id uuid references pessoas(id) on delete set null,
  resumo         text,
  retorno        boolean not null default false,
  evento_id      uuid,
  criado_em      timestamptz not null default now()
);
create index if not exists ix_interacoes_pessoa on interacoes(pessoa_id);
create index if not exists ix_interacoes_campanha_data on interacoes(campanha_id, data desc);

create table if not exists historico_classificacao (
  id            uuid primary key default gen_random_uuid(),
  campanha_id   uuid not null references campanhas(id) on delete cascade,
  pessoa_id     uuid not null references pessoas(id) on delete cascade,
  classificacao classificacao_pessoa not null,
  data          date not null default current_date
);
create index if not exists ix_histclass_pessoa on historico_classificacao(pessoa_id);

create table if not exists liderancas (
  pessoa_id        uuid primary key references pessoas(id) on delete cascade,
  campanha_id      uuid not null references campanhas(id) on delete cascade,
  segmento         text,
  atuacao          text,
  territorios      uuid[] not null default '{}',
  responsavel_id   uuid references pessoas(id) on delete set null,
  capacidade       int not null default 3 check (capacidade between 1 and 5),
  alcance_estimado int not null default 0,
  reunioes         int not null default 0,
  compromissos     text[] not null default '{}',
  situacao         text not null default 'aproximação'
);
create index if not exists ix_liderancas_campanha on liderancas(campanha_id);

-- ---------------------------------------------------------------- operação
create table if not exists equipes (
  id             uuid primary key default gen_random_uuid(),
  campanha_id    uuid not null references campanhas(id) on delete cascade,
  nome           text not null,
  responsavel_id uuid references pessoas(id) on delete set null,
  territorio_id  uuid references territorios(id) on delete set null,
  objetivo       text,
  criada_em      date not null default current_date
);
create index if not exists ix_equipes_campanha on equipes(campanha_id);

create table if not exists equipe_integrantes (
  equipe_id uuid not null references equipes(id) on delete cascade,
  pessoa_id uuid not null references pessoas(id) on delete cascade,
  desde     date not null default current_date,
  primary key (equipe_id, pessoa_id)
);

create table if not exists tarefas (
  id             uuid primary key default gen_random_uuid(),
  campanha_id    uuid not null references campanhas(id) on delete cascade,
  titulo         text not null,
  descricao      text,
  responsavel_id uuid references pessoas(id) on delete set null,
  equipe_id      uuid references equipes(id) on delete set null,
  territorio_id  uuid references territorios(id) on delete set null,
  area           text,
  prazo          date,
  criada_em      date not null default current_date,
  status         status_tarefa not null default 'não iniciada',
  progresso      int not null default 0 check (progresso between 0 and 100),
  prioridade     prioridade not null default 'média',
  objetivo       text,
  andamento      text
);
create index if not exists ix_tarefas_campanha_status on tarefas(campanha_id, status);
create index if not exists ix_tarefas_responsavel on tarefas(responsavel_id);

create table if not exists tarefa_etapas (
  id        uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  ordem     int not null default 0,
  passo     text not null,
  feito     boolean not null default false
);
create index if not exists ix_etapas_tarefa on tarefa_etapas(tarefa_id);

create table if not exists metas (
  id          uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references campanhas(id) on delete cascade,
  titulo      text not null,
  escopo      text not null default 'campanha',
  alvo_id     uuid,
  alvo        int not null default 1,
  periodo     text,
  prazo       date,
  tipo        text not null default 'apoiadores'
);

create table if not exists demandas (
  id             uuid primary key default gen_random_uuid(),
  campanha_id    uuid not null references campanhas(id) on delete cascade,
  solicitante_id uuid references pessoas(id) on delete set null,
  descricao      text not null,
  responsavel_id uuid references pessoas(id) on delete set null,
  data           date not null default current_date,
  prazo          date,
  prioridade     prioridade not null default 'média',
  status         status_demanda not null default 'aberta',
  territorio_id  uuid references territorios(id) on delete set null,
  area           text,
  encaminhamento text,
  solucao        text
);
create index if not exists ix_demandas_campanha_status on demandas(campanha_id, status);

create table if not exists eventos (
  id                  uuid primary key default gen_random_uuid(),
  campanha_id         uuid not null references campanhas(id) on delete cascade,
  nome                text not null,
  tipo                text,
  data                date not null,
  hora                time,
  local               text,
  territorio_id       uuid references territorios(id) on delete set null,
  responsavel_id      uuid references pessoas(id) on delete set null,
  equipe_id           uuid references equipes(id) on delete set null,
  publico_previsto    int not null default 0,
  publico_presente    int,
  novos_cadastros     int,
  novos_apoiadores    int,
  novos_mobilizadores int,
  liderancas_presentes int not null default 0,
  logistica           text[] not null default '{}',
  status              status_evento not null default 'confirmado',
  obs                 text
);
create index if not exists ix_eventos_campanha_data on eventos(campanha_id, data);
alter table interacoes drop constraint if exists fk_interacoes_evento;
alter table interacoes add constraint fk_interacoes_evento
  foreign key (evento_id) references eventos(id) on delete set null;

create table if not exists agenda (
  id           uuid primary key default gen_random_uuid(),
  campanha_id  uuid not null references campanhas(id) on delete cascade,
  titulo       text not null,
  tipo         text,
  data         date not null,
  hora         time,
  duracao      int not null default 60,
  local        text,
  responsaveis uuid[] not null default '{}',
  obs          text
);
create index if not exists ix_agenda_campanha_data on agenda(campanha_id, data);

-- ---------------------------------------------------------------- recursos
create table if not exists materiais (
  id          uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references campanhas(id) on delete cascade,
  nome        text not null,
  unidade     text not null default 'un',
  minimo      int not null default 0,
  saldo       int not null default 0
);

create table if not exists movimentos_material (
  id             uuid primary key default gen_random_uuid(),
  material_id    uuid not null references materiais(id) on delete cascade,
  tipo           text not null check (tipo in ('entrada','saída')),
  qtd            int not null check (qtd > 0),
  data           date not null default current_date,
  responsavel_id uuid references pessoas(id) on delete set null,
  destino        text,
  finalidade     text,
  criado_em      timestamptz not null default now()
);
create index if not exists ix_movimentos_material on movimentos_material(material_id);

create table if not exists recursos (
  id             uuid primary key default gen_random_uuid(),
  campanha_id    uuid not null references campanhas(id) on delete cascade,
  nome           text not null,
  tipo           text not null default 'Equipamento',
  status         text not null default 'disponível',
  responsavel_id uuid references pessoas(id) on delete set null,
  local          text,
  atividade      text
);

create table if not exists financeiro (
  id          uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references campanhas(id) on delete cascade,
  descricao   text not null,
  area        text,
  fornecedor  text,
  previsto    numeric(12,2) not null default 0,
  realizado   numeric(12,2) not null default 0,
  data        date not null default current_date,
  evento_id   uuid references eventos(id) on delete set null
);
create index if not exists ix_financeiro_campanha on financeiro(campanha_id);

-- ---------------------------------------------------------------- pesquisas
create table if not exists pesquisas (
  id          uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references campanhas(id) on delete cascade,
  titulo      text not null,
  tipo        text,
  data        date not null default current_date,
  amostra     int not null default 0
);

create table if not exists pesquisa_perguntas (
  id          uuid primary key default gen_random_uuid(),
  pesquisa_id uuid not null references pesquisas(id) on delete cascade,
  texto       text not null,
  ordem       int not null default 0
);

create table if not exists pesquisa_opcoes (
  id          uuid primary key default gen_random_uuid(),
  pergunta_id uuid not null references pesquisa_perguntas(id) on delete cascade,
  rotulo      text not null,
  valor       numeric(6,2) not null default 0
);

-- ---------------------------------------------------------------- dia da eleição
create table if not exists locais_votacao (
  id                  uuid primary key default gen_random_uuid(),
  campanha_id         uuid not null references campanhas(id) on delete cascade,
  nome                text not null,
  territorio_id       uuid references territorios(id) on delete set null,
  zona                text,
  secoes              int not null default 1,
  eleitores           int not null default 0,
  fiscais_necessarios int not null default 1,
  fiscais_confirmados int not null default 0,
  coordenador_id      uuid references pessoas(id) on delete set null,
  transporte          boolean not null default false,
  plantao             text not null default 'dia inteiro'
);

create table if not exists ocorrencias (
  id        uuid primary key default gen_random_uuid(),
  local_id  uuid not null references locais_votacao(id) on delete cascade,
  texto     text not null,
  hora      time not null default current_time,
  gravidade text not null default 'média',
  status    text not null default 'aberta',
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------- visões gerenciais
create or replace view v_territorio_stats as
select
  t.id, t.campanha_id, t.nome, t.eleitores, t.meta,
  count(p.id)                                                             as pessoas,
  count(p.id) filter (where p.classificacao in
    ('apoiador','participante','mobilizador','lideranca'))                as apoiadores,
  count(p.id) filter (where p.classificacao <> 'contato')                 as simpatizantes,
  count(p.id) filter (where p.classificacao = 'mobilizador')              as mobilizadores,
  case when t.eleitores > 0
       then round(100.0 * count(p.id) filter (where p.classificacao in
            ('apoiador','participante','mobilizador','lideranca')) / t.eleitores, 2)
       else 0 end                                                         as cobertura
from territorios t
left join pessoas p on p.bairro_id = t.id
where t.tipo = 'bairro'
group by t.id;

create or replace view v_produtividade_mobilizador as
select
  m.cadastrado_por                                                        as pessoa_id,
  m.campanha_id,
  count(*)                                                                as cadastros,
  count(*) filter (where m.classificacao <> 'contato')                    as simpatizantes,
  count(*) filter (where m.classificacao in
    ('apoiador','participante','mobilizador','lideranca'))                as apoiadores,
  count(*) filter (where m.data_cadastro > current_date - 14)             as recentes
from pessoas m
where m.cadastrado_por is not null
group by m.cadastrado_por, m.campanha_id;

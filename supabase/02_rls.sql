-- ============================================================================
-- SIGC — parte 2: Row Level Security
-- Implementa a seção 28 do documento: cada pessoa acessa conforme sua
-- responsabilidade. Sem estas políticas a chave pública do projeto daria
-- acesso a tudo — execute este arquivo obrigatoriamente.
-- ============================================================================

-- ------------------------------------------------------------ funções de apoio
create or replace function app_membro()
returns membros language sql stable security definer set search_path = public as $$
  select * from membros where user_id = auth.uid() and ativo limit 1;
$$;

create or replace function app_campanha()
returns uuid language sql stable security definer set search_path = public as $$
  select campanha_id from membros where user_id = auth.uid() and ativo limit 1;
$$;

create or replace function app_perfil()
returns perfil_acesso language sql stable security definer set search_path = public as $$
  select perfil from membros where user_id = auth.uid() and ativo limit 1;
$$;

create or replace function app_pessoa()
returns uuid language sql stable security definer set search_path = public as $$
  select pessoa_id from membros where user_id = auth.uid() and ativo limit 1;
$$;

create or replace function app_regiao()
returns uuid language sql stable security definer set search_path = public as $$
  select regiao_id from membros where user_id = auth.uid() and ativo limit 1;
$$;

-- quem responde ao usuário atual, em qualquer profundidade da estrutura
-- (supervisor enxerga a própria equipe; mobilizador enxerga apenas a si)
create or replace function app_equipe_abaixo()
returns setof uuid language sql stable security definer set search_path = public as $$
  with recursive sob as (
    select e.pessoa_id
      from equipe_campanha e
     where e.campanha_id = app_campanha() and e.responde_a = app_pessoa()
    union
    select e.pessoa_id
      from equipe_campanha e
      join sob s on e.responde_a = s.pessoa_id
     where e.campanha_id = app_campanha()
  )
  select pessoa_id from sob
  union
  select app_pessoa();
$$;

-- equipes das quais o usuário participa
create or replace function app_minhas_equipes()
returns setof uuid language sql stable security definer set search_path = public as $$
  select equipe_id from equipe_integrantes where pessoa_id = app_pessoa()
  union
  select id from equipes where campanha_id = app_campanha() and responsavel_id = app_pessoa();
$$;

-- coordenação geral e de área enxergam a campanha inteira
create or replace function app_ve_tudo()
returns boolean language sql stable as $$
  select app_perfil() in ('coordenacao_geral','coordenacao_area','leitura');
$$;

-- bairros sob responsabilidade do usuário (coordenação territorial)
-- registro sem território NÃO é visível por esta via: cai nas demais regras
-- (quem cadastrou, quem é responsável, equipe), evitando vazamento por omissão
create or replace function app_ve_territorio(alvo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select app_ve_tudo()
      or (alvo is not null and app_regiao() is not null and exists (
           select 1 from territorios t
           where t.id = alvo
             and (t.id = app_regiao() or t.pai_id = app_regiao())
         ));
$$;

-- ------------------------------------------------------------ ativação
alter table campanhas             enable row level security;
alter table territorios           enable row level security;
alter table pessoas               enable row level security;
alter table membros               enable row level security;
alter table equipe_campanha       enable row level security;
alter table interacoes            enable row level security;
alter table historico_classificacao enable row level security;
alter table liderancas            enable row level security;
alter table equipes               enable row level security;
alter table equipe_integrantes    enable row level security;
alter table tarefas               enable row level security;
alter table tarefa_etapas         enable row level security;
alter table metas                 enable row level security;
alter table demandas              enable row level security;
alter table eventos               enable row level security;
alter table agenda                enable row level security;
alter table materiais             enable row level security;
alter table movimentos_material   enable row level security;
alter table recursos              enable row level security;
alter table financeiro            enable row level security;
alter table pesquisas             enable row level security;
alter table pesquisa_perguntas    enable row level security;
alter table pesquisa_opcoes       enable row level security;
alter table locais_votacao        enable row level security;
alter table ocorrencias           enable row level security;

-- ------------------------------------------------------------ campanha e acesso
drop policy if exists campanha_leitura on campanhas;
create policy campanha_leitura on campanhas
  for select using (id = app_campanha());

drop policy if exists campanha_escrita on campanhas;
create policy campanha_escrita on campanhas
  for update using (id = app_campanha() and app_perfil() = 'coordenacao_geral');

drop policy if exists membros_leitura on membros;
create policy membros_leitura on membros
  for select using (campanha_id = app_campanha());

drop policy if exists membros_admin on membros;
create policy membros_admin on membros
  for all using (campanha_id = app_campanha() and app_perfil() = 'coordenacao_geral')
  with check (campanha_id = app_campanha() and app_perfil() = 'coordenacao_geral');

-- ------------------------------------------------------------ território (leitura ampla)
drop policy if exists territorios_leitura on territorios;
create policy territorios_leitura on territorios
  for select using (campanha_id = app_campanha());

drop policy if exists territorios_escrita on territorios;
create policy territorios_escrita on territorios
  for all using (campanha_id = app_campanha() and app_perfil() in ('coordenacao_geral','coordenacao_area'))
  with check (campanha_id = app_campanha() and app_perfil() in ('coordenacao_geral','coordenacao_area'));

-- ------------------------------------------------------------ pessoas
-- mobilizador enxerga quem cadastrou ou de quem é responsável;
-- coordenação territorial enxerga o seu território; coordenação geral vê tudo.
drop policy if exists pessoas_leitura on pessoas;
create policy pessoas_leitura on pessoas
  for select using (
    campanha_id = app_campanha()
    and (
      app_ve_tudo()
      or app_ve_territorio(bairro_id)
      or cadastrado_por in (select app_equipe_abaixo())
      or responsavel_id in (select app_equipe_abaixo())
      or id in (select app_equipe_abaixo())      -- a própria equipe sob sua supervisão
    )
  );

drop policy if exists pessoas_insercao on pessoas;
create policy pessoas_insercao on pessoas
  for insert with check (campanha_id = app_campanha() and app_perfil() <> 'leitura');

drop policy if exists pessoas_edicao on pessoas;
create policy pessoas_edicao on pessoas
  for update using (
    campanha_id = app_campanha()
    and (app_ve_tudo() or app_ve_territorio(bairro_id)
         or cadastrado_por in (select app_equipe_abaixo())
         or responsavel_id in (select app_equipe_abaixo()))
  );

drop policy if exists pessoas_exclusao on pessoas;
create policy pessoas_exclusao on pessoas
  for delete using (campanha_id = app_campanha() and app_perfil() = 'coordenacao_geral');

-- ------------------------------------------------------------ histórico de relacionamento
drop policy if exists interacoes_leitura on interacoes;
create policy interacoes_leitura on interacoes
  for select using (
    campanha_id = app_campanha()
    and (app_ve_tudo()
         or responsavel_id in (select app_equipe_abaixo())
         or exists (select 1 from pessoas p where p.id = interacoes.pessoa_id
                    and (app_ve_territorio(p.bairro_id)
                         or p.cadastrado_por in (select app_equipe_abaixo()))))
  );

drop policy if exists interacoes_escrita on interacoes;
create policy interacoes_escrita on interacoes
  for insert with check (campanha_id = app_campanha() and app_perfil() <> 'leitura');

drop policy if exists histclass_leitura on historico_classificacao;
create policy histclass_leitura on historico_classificacao
  for select using (campanha_id = app_campanha());
drop policy if exists histclass_escrita on historico_classificacao;
create policy histclass_escrita on historico_classificacao
  for insert with check (campanha_id = app_campanha() and app_perfil() <> 'leitura');

-- ------------------------------------------------------------ demais tabelas da campanha
-- leitura para toda a campanha; escrita bloqueada para o perfil de leitura.
do $$
declare t text;
begin
  foreach t in array array[
    'equipe_campanha','liderancas','equipes','metas',
    'eventos','agenda','materiais','recursos','financeiro','pesquisas','locais_votacao'
  ] loop
    execute format('drop policy if exists %I_leitura on %I;', t, t);
    execute format('create policy %I_leitura on %I for select using (campanha_id = app_campanha());', t, t);
    execute format('drop policy if exists %I_escrita on %I;', t, t);
    execute format($f$create policy %I_escrita on %I for all
                     using (campanha_id = app_campanha() and app_perfil() <> 'leitura')
                     with check (campanha_id = app_campanha() and app_perfil() <> 'leitura');$f$, t, t);
  end loop;
end $$;

-- tarefas: o mobilizador acompanha as suas; o supervisor, as da equipe abaixo dele
drop policy if exists tarefas_leitura on tarefas;
create policy tarefas_leitura on tarefas
  for select using (
    campanha_id = app_campanha()
    and (app_ve_tudo()
         or app_ve_territorio(territorio_id)
         or responsavel_id in (select app_equipe_abaixo())
         or equipe_id in (select app_minhas_equipes()))
  );
drop policy if exists tarefas_escrita on tarefas;
create policy tarefas_escrita on tarefas
  for all using (
    campanha_id = app_campanha() and app_perfil() <> 'leitura'
    and (app_ve_tudo() or app_ve_territorio(territorio_id)
         or responsavel_id in (select app_equipe_abaixo())
         or equipe_id in (select app_minhas_equipes()))
  )
  with check (campanha_id = app_campanha() and app_perfil() <> 'leitura');

-- demandas: quem registrou, quem responde e quem cuida do território
drop policy if exists demandas_leitura on demandas;
create policy demandas_leitura on demandas
  for select using (
    campanha_id = app_campanha()
    and (app_ve_tudo()
         or app_ve_territorio(territorio_id)
         or responsavel_id in (select app_equipe_abaixo())
         or solicitante_id in (select app_equipe_abaixo()))
  );
drop policy if exists demandas_escrita on demandas;
create policy demandas_escrita on demandas
  for all using (campanha_id = app_campanha() and app_perfil() <> 'leitura')
  with check (campanha_id = app_campanha() and app_perfil() <> 'leitura');

-- tabelas filhas: seguem o pai
drop policy if exists etapas_acesso on tarefa_etapas;
create policy etapas_acesso on tarefa_etapas for all
  using (exists (select 1 from tarefas t where t.id = tarefa_id and t.campanha_id = app_campanha()))
  with check (exists (select 1 from tarefas t where t.id = tarefa_id and t.campanha_id = app_campanha()));

drop policy if exists integrantes_acesso on equipe_integrantes;
create policy integrantes_acesso on equipe_integrantes for all
  using (exists (select 1 from equipes e where e.id = equipe_id and e.campanha_id = app_campanha()))
  with check (exists (select 1 from equipes e where e.id = equipe_id and e.campanha_id = app_campanha()));

drop policy if exists movimentos_acesso on movimentos_material;
create policy movimentos_acesso on movimentos_material for all
  using (exists (select 1 from materiais m where m.id = material_id and m.campanha_id = app_campanha()))
  with check (exists (select 1 from materiais m where m.id = material_id and m.campanha_id = app_campanha()));

drop policy if exists perguntas_acesso on pesquisa_perguntas;
create policy perguntas_acesso on pesquisa_perguntas for all
  using (exists (select 1 from pesquisas p where p.id = pesquisa_id and p.campanha_id = app_campanha()))
  with check (exists (select 1 from pesquisas p where p.id = pesquisa_id and p.campanha_id = app_campanha()));

drop policy if exists opcoes_acesso on pesquisa_opcoes;
create policy opcoes_acesso on pesquisa_opcoes for all
  using (exists (select 1 from pesquisa_perguntas q join pesquisas p on p.id = q.pesquisa_id
                 where q.id = pergunta_id and p.campanha_id = app_campanha()))
  with check (exists (select 1 from pesquisa_perguntas q join pesquisas p on p.id = q.pesquisa_id
                 where q.id = pergunta_id and p.campanha_id = app_campanha()));

drop policy if exists ocorrencias_acesso on ocorrencias;
create policy ocorrencias_acesso on ocorrencias for all
  using (exists (select 1 from locais_votacao l where l.id = local_id and l.campanha_id = app_campanha()))
  with check (exists (select 1 from locais_votacao l where l.id = local_id and l.campanha_id = app_campanha()));

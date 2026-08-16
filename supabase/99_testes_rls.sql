-- ============================================================================
-- SIGC — verificação das políticas de acesso (seção 28)
-- Roda em transação e desfaz tudo no final: pode executar no projeto real.
-- Confirma que cada perfil enxerga exatamente o que deve enxergar.
-- ============================================================================
begin;

-- papel usado pelo Supabase para requisições autenticadas
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- ------------------------------------------------------------------ cenário
insert into campanhas (id, nome, candidato, municipio, uf, ano, data_eleicao)
values ('11111111-1111-1111-1111-111111111111','Campanha Teste','Fulano','Município','CE',2026,'2026-10-04');

insert into territorios (id, campanha_id, nome, tipo) values
  ('22222222-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Região Norte','regiao'),
  ('22222222-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Região Sul','regiao');
insert into territorios (id, campanha_id, nome, tipo, pai_id, eleitores) values
  ('33333333-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Bairro Norte 1','bairro','22222222-0000-0000-0000-000000000001',3000),
  ('33333333-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Bairro Sul 1','bairro','22222222-0000-0000-0000-000000000002',2500);

insert into pessoas (id, campanha_id, nome, bairro_id, cadastrado_por) values
  ('44444444-0000-0000-0000-000000000c01','11111111-1111-1111-1111-111111111111','Coordenadora Geral','33333333-0000-0000-0000-000000000001',null),
  ('44444444-0000-0000-0000-000000000d01','11111111-1111-1111-1111-111111111111','Coord. Territorial Norte','33333333-0000-0000-0000-000000000001',null);
insert into pessoas (id, campanha_id, nome, bairro_id, cadastrado_por) values
  ('44444444-0000-0000-0000-000000000e01','11111111-1111-1111-1111-111111111111','Mobilizador Sul','33333333-0000-0000-0000-000000000002',null);
insert into pessoas (campanha_id, nome, bairro_id, cadastrado_por) values
  ('11111111-1111-1111-1111-111111111111','Eleitor do Norte','33333333-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000d01'),
  ('11111111-1111-1111-1111-111111111111','Eleitor do Sul','33333333-0000-0000-0000-000000000002','44444444-0000-0000-0000-000000000e01'),
  ('11111111-1111-1111-1111-111111111111','Eleitor do Sul 2','33333333-0000-0000-0000-000000000002','44444444-0000-0000-0000-000000000c01');

-- estrutura: supervisor no Sul com um mobilizador abaixo
insert into pessoas (id, campanha_id, nome, bairro_id) values
  ('44444444-0000-0000-0000-000000000501','11111111-1111-1111-1111-111111111111','Supervisora Sul','33333333-0000-0000-0000-000000000002');
insert into equipe_campanha (campanha_id, pessoa_id, funcao) values
  ('11111111-1111-1111-1111-111111111111','44444444-0000-0000-0000-000000000501','Supervisor(a)');
insert into equipe_campanha (campanha_id, pessoa_id, funcao, responde_a) values
  ('11111111-1111-1111-1111-111111111111','44444444-0000-0000-0000-000000000e01','Mobilizador(a) de campo','44444444-0000-0000-0000-000000000501');

insert into membros (campanha_id, user_id, pessoa_id, perfil, regiao_id) values
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000501','44444444-0000-0000-0000-000000000501','supervisor',null),
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000c01','44444444-0000-0000-0000-000000000c01','coordenacao_geral',null),
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000d01','44444444-0000-0000-0000-000000000d01','coordenacao_territorial','22222222-0000-0000-0000-000000000001'),
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000e01','44444444-0000-0000-0000-000000000e01','mobilizador',null);

-- ------------------------------------------------------------------ testes
-- tarefas: uma do mobilizador, uma do território Norte, uma sem vínculo com eles
insert into tarefas (campanha_id, titulo, responsavel_id, territorio_id) values
  ('11111111-1111-1111-1111-111111111111','Cadastrar no Sul','44444444-0000-0000-0000-000000000e01','33333333-0000-0000-0000-000000000002'),
  ('11111111-1111-1111-1111-111111111111','Reunião no Norte','44444444-0000-0000-0000-000000000d01','33333333-0000-0000-0000-000000000001'),
  ('11111111-1111-1111-1111-111111111111','Produção de vídeo','44444444-0000-0000-0000-000000000c01',null);

create or replace function testar(rotulo text, obtido int, esperado int)
returns text language sql immutable as $$
  select case when obtido = esperado then '  ok   ' else '  FALHA' end
      || ' | ' || rotulo || ': ' || obtido || ' (esperado ' || esperado || ')';
$$;

set local role authenticated;

set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000c01';
select testar('coordenação geral vê todas as pessoas', (select count(*)::int from pessoas), 7);

set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000d01';
select testar('coordenação territorial vê apenas a sua região', (select count(*)::int from pessoas), 3);

set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000e01';
select testar('mobilizador vê apenas os próprios contatos', (select count(*)::int from pessoas), 2);

set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000501';
select testar('supervisor vê a si, o mobilizador abaixo e o que ele cadastrou',
              (select count(*)::int from pessoas), 3);
select testar('mobilizador enxerga o território todo (cadastro comum)', (select count(*)::int from territorios), 4);
select testar('mobilizador vê apenas as próprias tarefas', (select count(*)::int from tarefas), 1);

set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000501';
select testar('supervisor vê as tarefas da equipe abaixo', (select count(*)::int from tarefas), 1);

set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000d01';
select testar('coordenação territorial vê as tarefas da sua região', (select count(*)::int from tarefas), 1);

set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000c01';
select testar('coordenação geral vê todas as tarefas', (select count(*)::int from tarefas), 3);

reset role;
-- perfil somente-leitura não pode escrever
insert into membros (campanha_id, user_id, pessoa_id, perfil) values
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000f01','44444444-0000-0000-0000-000000000c01','leitura');
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000f01';
do $$
begin
  insert into pessoas (campanha_id, nome) values ('11111111-1111-1111-1111-111111111111','Não deveria entrar');
  raise notice '  FALHA | perfil de leitura conseguiu inserir pessoa';
exception when insufficient_privilege then
  raise notice '  ok    | perfil de leitura bloqueado na escrita';
end $$;

reset role;
rollback;

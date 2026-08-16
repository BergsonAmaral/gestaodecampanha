-- ============================================================================
-- SIGC — parte 3: primeiro acesso
-- Rode DEPOIS de criar o seu usuário em Authentication → Users no painel do
-- Supabase. Este script cria a campanha e liga o seu usuário a ela como
-- coordenação geral. Ajuste os valores marcados com <<< >>>.
-- ============================================================================

do $$
declare
  v_email    text := '<<< seu-email@exemplo.com >>>';   -- usuário já criado no Supabase
  v_campanha text := '<<< Campanha Fulano 2028 >>>';
  v_candidato text := '<<< Nome da candidatura >>>';
  v_municipio text := '<<< Nome do município >>>';
  v_uf        char(2) := '<<< CE >>>';
  v_ano       int  := 2028;
  v_eleicao   date := '2028-10-01';
  v_user   uuid;
  v_camp   uuid;
  v_pessoa uuid;
begin
  select id into v_user from auth.users where email = v_email;
  if v_user is null then
    raise exception 'Usuário % não encontrado. Crie-o em Authentication → Users antes de rodar este script.', v_email;
  end if;

  insert into campanhas (nome, candidato, municipio, uf, ano, data_eleicao)
  values (v_campanha, v_candidato, v_municipio, v_uf, v_ano, v_eleicao)
  returning id into v_camp;

  -- a pessoa que representa você dentro da campanha
  insert into pessoas (campanha_id, nome)
  values (v_camp, v_candidato || ' — coordenação')
  returning id into v_pessoa;

  insert into equipe_campanha (campanha_id, pessoa_id, funcao, area)
  values (v_camp, v_pessoa, 'Coordenação geral', 'Coordenação Geral');

  insert into membros (campanha_id, user_id, pessoa_id, perfil)
  values (v_camp, v_user, v_pessoa, 'coordenacao_geral');

  raise notice 'Campanha criada: %', v_camp;
  raise notice 'Cole este id no sistema, em Configurações → Banco de dados.';
end $$;

-- ---------------------------------------------------------------------------
-- Para dar acesso a mais gente depois (o usuário precisa existir em auth.users):
--
--   insert into membros (campanha_id, user_id, pessoa_id, perfil, regiao_id)
--   select 'ID-DA-CAMPANHA', u.id, 'ID-DA-PESSOA', 'coordenacao_territorial',
--          'ID-DA-REGIAO'
--   from auth.users u where u.email = 'coordenador@exemplo.com';
--
-- Perfis: coordenacao_geral | coordenacao_area | coordenacao_territorial
--         supervisor | mobilizador | leitura
-- ---------------------------------------------------------------------------

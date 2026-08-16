-- ============================================================================
-- SIGC — parte 4: criação da coordenação geral pelo próprio app
-- Rode uma única vez. Depois disso, a tela de login do sistema tem a opção
-- "Criar acesso da coordenação", que cria a campanha e o primeiro acesso
-- sem precisar voltar ao SQL Editor.
-- ============================================================================

create or replace function bootstrap_coordenacao(
  p_email       text,
  p_candidato   text,
  p_municipio   text,
  p_uf          text,
  p_ano         int,
  p_eleicao     date,
  p_nome_campanha text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_camp   uuid;
  v_pessoa uuid;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar autenticado para criar a coordenação.';
  end if;

  -- proteção principal: só cria enquanto o banco estiver vazio de campanhas.
  -- depois da primeira, novos acessos são dados pela tela de Acessos, não por aqui.
  if exists (select 1 from campanhas) then
    raise exception 'Já existe uma campanha configurada neste projeto. Peça acesso à coordenação geral.';
  end if;

  insert into campanhas (nome, candidato, municipio, uf, ano, data_eleicao)
  values (coalesce(p_nome_campanha, p_candidato), p_candidato, p_municipio, upper(p_uf), p_ano, p_eleicao)
  returning id into v_camp;

  insert into pessoas (campanha_id, nome)
  values (v_camp, p_candidato || ' — coordenação')
  returning id into v_pessoa;

  insert into equipe_campanha (campanha_id, pessoa_id, funcao, area)
  values (v_camp, v_pessoa, 'Coordenação geral', 'Coordenação Geral');

  insert into membros (campanha_id, user_id, pessoa_id, perfil)
  values (v_camp, auth.uid(), v_pessoa, 'coordenacao_geral');

  return v_camp;
end;
$$;

-- só usuários autenticados podem chamar; a proteção de "única vez" está no corpo da função
revoke all on function bootstrap_coordenacao from public, anon;
grant execute on function bootstrap_coordenacao to authenticated;

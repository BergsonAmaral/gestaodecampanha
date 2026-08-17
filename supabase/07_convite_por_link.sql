-- ============================================================================
-- SIGC — parte 7: convite por link (em vez de casar por e-mail)
-- Rode depois do 06_convites.sql. Troca o pareamento por e-mail — que quebra
-- se alguém digitar errado dos dois lados — por um link com código único.
-- O superadmin gera o link; quem abre escolhe o próprio e-mail e senha.
-- ============================================================================

alter table convites alter column email drop not null;
alter table convites drop constraint if exists convites_email_key;

drop function if exists criar_convite(text, text);
drop function if exists ativar_convite();

-- superadmin gera um link (o id do convite é o próprio código do link)
create or replace function criar_convite(p_nota text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not sou_superadmin() then
    raise exception 'Apenas a administração da plataforma pode gerar convites.';
  end if;

  insert into convites (nota, criado_por) values (p_nota, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function criar_convite(text) from public, anon;
grant execute on function criar_convite(text) to authenticated;

-- quem abriu o link e criou a própria conta ativa pelo código, não pelo e-mail
create or replace function ativar_convite(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_conv       convites%rowtype;
  v_camp       uuid;
  v_pessoa     uuid;
  v_email      text;
  v_provisorio text;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar autenticado.';
  end if;
  if exists (select 1 from membros where user_id = auth.uid()) then
    return jsonb_build_object('ativado', false, 'motivo', 'já tem acesso');
  end if;

  select * into v_conv from convites where id = p_token and usado = false;
  if not found then
    return jsonb_build_object('ativado', false, 'motivo', 'link inválido ou já usado');
  end if;

  select email into v_email from auth.users where id = auth.uid();
  v_provisorio := initcap(split_part(v_email, '@', 1));

  insert into campanhas (nome, candidato, municipio, ano)
  values (v_provisorio, v_provisorio, '', extract(year from current_date)::int)
  returning id into v_camp;

  insert into pessoas (campanha_id, nome)
  values (v_camp, v_provisorio || ' — coordenação')
  returning id into v_pessoa;

  insert into equipe_campanha (campanha_id, pessoa_id, funcao, area)
  values (v_camp, v_pessoa, 'Coordenação geral', 'Coordenação Geral');

  insert into membros (campanha_id, user_id, pessoa_id, perfil)
  values (v_camp, auth.uid(), v_pessoa, 'coordenacao_geral');

  update convites set usado = true, usado_em = now(), email = v_email where id = v_conv.id;

  return jsonb_build_object('ativado', true, 'campanha_id', v_camp);
end;
$$;
revoke all on function ativar_convite(uuid) from public, anon;
grant execute on function ativar_convite(uuid) to authenticated;

-- ============================================================================
-- SIGC — parte 6: superadmin cadastra o coordenador diretamente
-- O superadmin convida só pelo e-mail (com uma anotação livre, opcional, para
-- organização própria — não é dado oficial da campanha). Quando essa pessoa
-- cria a própria conta (e-mail + senha dela) e entra pela primeira vez, o
-- sistema já libera o acesso de coordenação geral. Quem preenche candidatura,
-- município, UF e data da eleição é o próprio coordenador, na tela de
-- Configurações — o superadmin nunca entra com dado oficial da campanha.
-- Se a pessoa se cadastrar sem convite, continua caindo na fila de
-- solicitação normal (05_superadmin.sql), sem mudança nesse caminho.
-- ============================================================================

create table if not exists convites (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  nota       text,          -- anotação livre do superadmin (ex.: nome do cliente, origem do contato)
  usado      boolean not null default false,
  criado_por uuid,
  criado_em  timestamptz not null default now(),
  usado_em   timestamptz
);
alter table convites enable row level security;

drop policy if exists convites_admin on convites;
create policy convites_admin on convites for all
  using (sou_superadmin()) with check (sou_superadmin());

-- superadmin convida (ou reenvia, se já existir convite para o e-mail)
create or replace function criar_convite(p_email text, p_nota text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not sou_superadmin() then
    raise exception 'Apenas a administração da plataforma pode convidar coordenadores.';
  end if;

  insert into convites (email, nota, criado_por)
  values (lower(p_email), p_nota, auth.uid())
  on conflict (email) do update set nota = excluded.nota, usado = false, usado_em = null
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function criar_convite from public, anon;
grant execute on function criar_convite to authenticated;

-- quem acabou de logar tenta ativar um convite com o próprio e-mail; a campanha
-- nasce só com um nome provisório (a partir do e-mail) — o coordenador é quem
-- preenche os dados de verdade depois, em Configurações
create or replace function ativar_convite()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email    text;
  v_conv     convites%rowtype;
  v_camp     uuid;
  v_pessoa   uuid;
  v_provisorio text;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar autenticado.';
  end if;
  if exists (select 1 from membros where user_id = auth.uid()) then
    return jsonb_build_object('ativado', false, 'motivo', 'já tem acesso');
  end if;

  select email into v_email from auth.users where id = auth.uid();
  select * into v_conv from convites where email = lower(v_email) and usado = false;
  if not found then
    return jsonb_build_object('ativado', false);
  end if;

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

  update convites set usado = true, usado_em = now() where id = v_conv.id;

  return jsonb_build_object('ativado', true, 'campanha_id', v_camp);
end;
$$;
revoke all on function ativar_convite from public, anon;
grant execute on function ativar_convite to authenticated;

drop policy if exists convites_leitura_admin on convites;
create policy convites_leitura_admin on convites for select using (sou_superadmin());

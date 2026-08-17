-- ============================================================================
-- SIGC — parte 8: coordenação geral convida a própria equipe por link
-- Mesmo modelo do convite do superadmin (07_convite_por_link.sql), mas:
--  - quem gera o link é a coordenação geral da campanha, não a administração
--    da plataforma;
--  - a coordenação já escolhe o perfil (e a região, se for o caso) no
--    momento de gerar o link — é isso que define o alcance da pessoa;
--  - ativar o link NÃO dá acesso na hora: a pessoa cria e-mail e senha, e o
--    acesso só é liberado quando a coordenação geral aceita, na tela de
--    Acessos. Isso evita dar acesso a quem clicou no link errado por engano.
-- ============================================================================

create table if not exists convites_equipe (
  id          uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references campanhas(id) on delete cascade,
  perfil      perfil_acesso not null,
  regiao_id   uuid references territorios(id) on delete set null,
  nota        text,          -- anotação livre da coordenação (ex.: nome da pessoa) — não é dado de acesso
  email       text,          -- preenchido quando a pessoa convidada cria a própria conta
  user_id     uuid,          -- auth.users.id da pessoa convidada, depois que ela ativa o link
  usado       boolean not null default false,  -- já criou a conta pelo link
  aceito      boolean not null default false,  -- coordenação já liberou o acesso de fato
  criado_por  uuid,
  criado_em   timestamptz not null default now(),
  usado_em    timestamptz,
  aceito_em   timestamptz
);
alter table convites_equipe enable row level security;
create index if not exists ix_convites_equipe_campanha on convites_equipe(campanha_id);
create index if not exists ix_convites_equipe_user on convites_equipe(user_id);

-- a coordenação geral administra os convites da própria campanha
drop policy if exists convites_equipe_coord on convites_equipe;
create policy convites_equipe_coord on convites_equipe for all
  using (campanha_id = app_campanha() and app_perfil() = 'coordenacao_geral')
  with check (campanha_id = app_campanha() and app_perfil() = 'coordenacao_geral');

-- quem ativou o link enxerga o próprio convite, mesmo antes de ser aceito
-- (é o que permite mostrar "aguardando aprovação" a cada novo login)
drop policy if exists convites_equipe_propria on convites_equipe;
create policy convites_equipe_propria on convites_equipe for select
  using (user_id = auth.uid());

-- coordenação geral gera o link já com perfil (e região, se territorial) definidos
create or replace function criar_convite_equipe(p_perfil perfil_acesso, p_regiao_id uuid default null, p_nota text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if app_perfil() is distinct from 'coordenacao_geral'::perfil_acesso then
    raise exception 'Apenas a coordenação geral pode convidar para a equipe.';
  end if;
  if p_perfil = 'coordenacao_territorial' and p_regiao_id is null then
    raise exception 'Escolha uma região para coordenação territorial.';
  end if;

  insert into convites_equipe (campanha_id, perfil, regiao_id, nota, criado_por)
  values (app_campanha(), p_perfil, p_regiao_id, p_nota, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function criar_convite_equipe(perfil_acesso, uuid, text) from public, anon;
grant execute on function criar_convite_equipe(perfil_acesso, uuid, text) to authenticated;

-- quem abriu o link e criou a própria conta registra o e-mail escolhido —
-- ainda não ganha acesso: fica aguardando a coordenação aceitar
create or replace function ativar_convite_equipe(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_conv  convites_equipe%rowtype;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar autenticado.';
  end if;
  if exists (select 1 from membros where user_id = auth.uid()) then
    return jsonb_build_object('ativado', false, 'motivo', 'já tem acesso');
  end if;

  select * into v_conv from convites_equipe where id = p_token and usado = false;
  if not found then
    return jsonb_build_object('ativado', false, 'motivo', 'link inválido ou já usado');
  end if;

  select email into v_email from auth.users where id = auth.uid();

  update convites_equipe
     set usado = true, usado_em = now(), user_id = auth.uid(), email = v_email
   where id = v_conv.id;

  return jsonb_build_object('ativado', true, 'aguardandoAprovacao', true);
end;
$$;
revoke all on function ativar_convite_equipe(uuid) from public, anon;
grant execute on function ativar_convite_equipe(uuid) to authenticated;

-- coordenação geral aceita: só agora nasce o acesso de verdade (membros)
create or replace function aceitar_convite_equipe(p_convite_id uuid, p_pessoa_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_conv convites_equipe%rowtype;
  v_membro uuid;
begin
  if app_perfil() is distinct from 'coordenacao_geral'::perfil_acesso then
    raise exception 'Apenas a coordenação geral pode aceitar acessos.';
  end if;

  select * into v_conv from convites_equipe where id = p_convite_id and campanha_id = app_campanha();
  if not found then raise exception 'Convite não encontrado.'; end if;
  if not v_conv.usado then raise exception 'Esta pessoa ainda não criou a própria conta pelo link.'; end if;
  if v_conv.aceito then raise exception 'Este acesso já foi aceito.'; end if;
  if p_pessoa_id is not null and not exists (select 1 from pessoas where id = p_pessoa_id and campanha_id = app_campanha()) then
    raise exception 'Pessoa não encontrada no cadastro desta campanha.';
  end if;

  insert into membros (campanha_id, user_id, pessoa_id, perfil, regiao_id)
  values (v_conv.campanha_id, v_conv.user_id, p_pessoa_id, v_conv.perfil, v_conv.regiao_id)
  returning id into v_membro;

  update convites_equipe set aceito = true, aceito_em = now() where id = p_convite_id;
  return v_membro;
end;
$$;
revoke all on function aceitar_convite_equipe(uuid, uuid) from public, anon;
grant execute on function aceitar_convite_equipe(uuid, uuid) to authenticated;

-- cancelar/recusar um convite (ainda não usado, ou usado mas não aceito) é
-- uma exclusão simples — já coberto pela policy convites_equipe_coord acima,
-- não precisa de função própria.

-- ============================================================================
-- SIGC — parte 5: superadministração da plataforma
-- Troca a criação automática de campanha (04_bootstrap.sql) por um fluxo de
-- aprovação: quem se cadastra vira uma solicitação pendente; só quem está em
-- plataforma_admins pode aprovar e liberar o acesso de coordenação geral.
-- ============================================================================

-- ---------------------------------------------------------------- superadmins
create table if not exists plataforma_admins (
  user_id   uuid primary key,          -- auth.users.id de quem administra a plataforma (você)
  nome      text,
  criado_em timestamptz not null default now()
);
alter table plataforma_admins enable row level security;

create or replace function sou_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from plataforma_admins where user_id = auth.uid());
$$;

drop policy if exists admins_leitura on plataforma_admins;
create policy admins_leitura on plataforma_admins for select using (sou_superadmin());
drop policy if exists admins_escrita on plataforma_admins;
create policy admins_escrita on plataforma_admins for all
  using (sou_superadmin()) with check (sou_superadmin());

-- ---------------------------------------------------------------- solicitações
create table if not exists solicitacoes_acesso (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique,  -- um pedido pendente por conta
  email         text not null,
  candidato     text not null,
  municipio     text not null,
  uf            char(2),
  ano           int,
  data_eleicao  date,
  nome_campanha text,
  status        text not null default 'pendente' check (status in ('pendente','aprovada','recusada')),
  observacao    text,
  criada_em     timestamptz not null default now(),
  decidida_em   timestamptz
);
alter table solicitacoes_acesso enable row level security;

drop policy if exists solicitacoes_propria on solicitacoes_acesso;
create policy solicitacoes_propria on solicitacoes_acesso
  for select using (user_id = auth.uid() or sou_superadmin());

drop policy if exists solicitacoes_admin_escreve on solicitacoes_acesso;
create policy solicitacoes_admin_escreve on solicitacoes_acesso
  for update using (sou_superadmin()) with check (sou_superadmin());

-- inserção só pela função abaixo (security definer), não direto pela tabela
revoke insert on solicitacoes_acesso from authenticated;

-- ---------------------------------------------------------------- funções
-- quem acabou de criar a conta pede acesso; não cria campanha nenhuma ainda
create or replace function solicitar_acesso(
  p_candidato     text,
  p_municipio     text,
  p_uf            text,
  p_ano           int,
  p_eleicao       date,
  p_nome_campanha text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar autenticado para solicitar acesso.';
  end if;
  if exists (select 1 from membros where user_id = auth.uid()) then
    raise exception 'Esta conta já tem acesso a uma campanha.';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into solicitacoes_acesso (user_id, email, candidato, municipio, uf, ano, data_eleicao, nome_campanha)
  values (auth.uid(), v_email, p_candidato, p_municipio, upper(p_uf), p_ano, p_eleicao, p_nome_campanha)
  on conflict (user_id) do update set
    candidato = excluded.candidato, municipio = excluded.municipio, uf = excluded.uf,
    ano = excluded.ano, data_eleicao = excluded.data_eleicao, nome_campanha = excluded.nome_campanha,
    status = 'pendente', decidida_em = null
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function solicitar_acesso from public, anon;
grant execute on function solicitar_acesso to authenticated;

-- superadmin aprova: cria a campanha e o vínculo de coordenação geral
create or replace function aprovar_solicitacao(p_solicitacao_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s solicitacoes_acesso%rowtype;
  v_camp   uuid;
  v_pessoa uuid;
begin
  if not sou_superadmin() then
    raise exception 'Apenas a administração da plataforma pode aprovar acessos.';
  end if;

  select * into s from solicitacoes_acesso where id = p_solicitacao_id;
  if not found then raise exception 'Solicitação não encontrada.'; end if;
  if s.status <> 'pendente' then raise exception 'Esta solicitação já foi %.', s.status; end if;

  insert into campanhas (nome, candidato, municipio, uf, ano, data_eleicao)
  values (coalesce(s.nome_campanha, s.candidato), s.candidato, s.municipio, s.uf, s.ano, s.data_eleicao)
  returning id into v_camp;

  insert into pessoas (campanha_id, nome)
  values (v_camp, s.candidato || ' — coordenação')
  returning id into v_pessoa;

  insert into equipe_campanha (campanha_id, pessoa_id, funcao, area)
  values (v_camp, v_pessoa, 'Coordenação geral', 'Coordenação Geral');

  insert into membros (campanha_id, user_id, pessoa_id, perfil)
  values (v_camp, s.user_id, v_pessoa, 'coordenacao_geral');

  update solicitacoes_acesso set status = 'aprovada', decidida_em = now() where id = p_solicitacao_id;
  return v_camp;
end;
$$;
revoke all on function aprovar_solicitacao from public, anon;
grant execute on function aprovar_solicitacao to authenticated;

create or replace function recusar_solicitacao(p_solicitacao_id uuid, p_motivo text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not sou_superadmin() then
    raise exception 'Apenas a administração da plataforma pode recusar acessos.';
  end if;
  update solicitacoes_acesso
     set status = 'recusada', observacao = p_motivo, decidida_em = now()
   where id = p_solicitacao_id and status = 'pendente';
end;
$$;
revoke all on function recusar_solicitacao from public, anon;
grant execute on function recusar_solicitacao to authenticated;

-- o antigo fluxo automático (04) não deve mais ficar aberto para qualquer autenticado
revoke execute on function bootstrap_coordenacao from authenticated;

-- ---------------------------------------------------------------------------
-- Depois de criar a SUA própria conta (pela tela de login, ou em Authentication
-- → Users), rode isto uma vez, trocando o e-mail, para virar superadmin:
--
--   insert into plataforma_admins (user_id, nome)
--   select id, 'Bergson Amaral' from auth.users where email = 'seu-email@exemplo.com';
-- ---------------------------------------------------------------------------

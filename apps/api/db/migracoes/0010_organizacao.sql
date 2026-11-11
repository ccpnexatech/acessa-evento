-- Organização acima do evento (ADR 0025): quem contrata a plataforma, a equipe
-- com vários papéis por pessoa e o convite que substitui a linha de comando.
-- Só acrescenta: nenhum dado da v1.0.0 é apagado nem muda de sentido.

create table organizacao (
  id         uuid primary key default uuid_v7(),
  nome       text not null check (length(nome) between 2 and 120),
  -- Opcional: associação sem CNPJ também organiza evento. Só dígitos.
  cnpj       text unique check (cnpj ~ '^[0-9]{14}$'),
  criada_em  timestamptz not null default now()
);

-- Dono e admin enxergam todos os eventos da organização. Só o dono mexe em quem é dono ou admin.
create table organizacao_membro (
  organizacao_id  uuid not null references organizacao (id) on delete cascade,
  pessoa_id       uuid not null references pessoa (id) on delete cascade,
  papel           text not null check (papel in ('dono', 'admin')),
  criado_em       timestamptz not null default now(),
  primary key (organizacao_id, pessoa_id, papel)
);
create index organizacao_membro_pessoa on organizacao_membro (pessoa_id);

-- Todo evento pertence a uma organização. Os que já existem ganham a sua, com o mesmo nome.
alter table evento
  add column organizacao_id uuid references organizacao (id),
  -- Evento de demonstração: fora da vitrine, sem avisos reais (ADR 0025).
  add column demonstracao boolean not null default false;

do $$
declare e record; org uuid;
begin
  for e in select id, nome from evento where organizacao_id is null loop
    insert into organizacao (nome) values (e.nome) returning id into org;
    update evento set organizacao_id = org where id = e.id;
    -- O admin mais antigo do evento vira dono; os outros admins viram admin da organização.
    insert into organizacao_membro (organizacao_id, pessoa_id, papel)
      select org, m.pessoa_id, case when row_number() over (order by m.criado_em, m.pessoa_id) = 1 then 'dono' else 'admin' end
      from membro_organizacao m where m.evento_id = e.id and m.papel = 'admin';
  end loop;
end $$;

-- Evento criado sem organização (sementes, scripts antigos) ganha uma própria,
-- para a coluna poder ser obrigatória sem quebrar quem já insere eventos.
create or replace function evento_garantir_organizacao() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.organizacao_id is null then
    insert into organizacao (nome) values (new.nome) returning id into new.organizacao_id;
  end if;
  return new;
end $$;
create trigger evento_garantir_organizacao before insert on evento
  for each row execute function evento_garantir_organizacao();

alter table evento alter column organizacao_id set not null;
create index evento_organizacao on evento (organizacao_id);

-- Vários papéis por pessoa no mesmo evento: o papel entra na chave.
-- Papéis novos: comercial, comunicacao, operacao e acessibilidade.
alter table membro_organizacao drop constraint membro_organizacao_pkey;
alter table membro_organizacao add primary key (evento_id, pessoa_id, papel);
alter table membro_organizacao drop constraint membro_organizacao_papel_check;
alter table membro_organizacao add constraint membro_organizacao_papel_check check (papel in (
  'admin', 'conteudo', 'credenciamento', 'financeiro', 'comercial', 'comunicacao', 'operacao', 'acessibilidade'));
alter table membro_organizacao
  -- Mesa organizadora: quem aparece na página pública do evento, e com que cargo.
  add column cargo text check (length(cargo) between 2 and 80),
  add column exibir_publico boolean not null default false;

-- Lista única dos papéis de evento, para as funções não repetirem a lista.
create or replace function papeis_de_evento() returns text[]
language sql immutable parallel safe as $$
  select array['admin', 'conteudo', 'credenciamento', 'financeiro', 'comercial', 'comunicacao', 'operacao', 'acessibilidade']
$$;

create or replace function tem_papel_org(org uuid, papeis text[]) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from organizacao_membro m
    where m.organizacao_id = org and m.pessoa_id = app_pessoa_id() and m.papel = any (papeis)
  )
$$;

-- Dono e admin da organização valem como qualquer papel em todos os eventos dela.
create or replace function tem_papel(evento uuid, papeis text[]) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from membro_organizacao m
    where m.evento_id = evento and m.pessoa_id = app_pessoa_id() and m.papel = any (papeis)
  ) or exists (
    select 1 from evento e join organizacao_membro om on om.organizacao_id = e.organizacao_id
    where e.id = evento and om.pessoa_id = app_pessoa_id()
  )
$$;

-- Qualquer pessoa da equipe do evento, em qualquer papel.
create or replace function e_da_equipe(evento uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select tem_papel(evento, papeis_de_evento())
$$;

-- Rascunho visível para toda a equipe, inclusive os papéis novos.
create or replace function evento_visivel(evento uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from evento e where e.id = evento and e.publicado) or e_da_equipe(evento)
$$;

revoke all on function tem_papel_org(uuid, text[]), e_da_equipe(uuid), papeis_de_evento() from public;
grant execute on function tem_papel_org(uuid, text[]), e_da_equipe(uuid), papeis_de_evento() to app_api;

alter table organizacao enable row level security;
alter table organizacao_membro enable row level security;

-- organizacao: quem é dela vê; dono e admin alteram. A criação passa por criar_organizacao().
create policy organizacao_ler on organizacao for select to app_api
  using (tem_papel_org(id, array['dono', 'admin'])
         or exists (select 1 from evento e where e.organizacao_id = organizacao.id and e_da_equipe(e.id)));
create policy organizacao_alterar on organizacao for update to app_api
  using (tem_papel_org(id, array['dono', 'admin'])) with check (tem_papel_org(id, array['dono', 'admin']));

create policy organizacao_membro_ler on organizacao_membro for select to app_api
  using (pessoa_id = app_pessoa_id() or tem_papel_org(organizacao_id, array['dono', 'admin']));
create policy organizacao_membro_gerir on organizacao_membro for all to app_api
  using (tem_papel_org(organizacao_id, array['dono'])) with check (tem_papel_org(organizacao_id, array['dono']));

-- evento: a política antiga só conhecia 4 papéis. A nova cobre a equipe inteira
-- e olha a coluna organizacao_id direto, para o insert ... returning enxergar a linha nova.
drop policy evento_ler on evento;
create policy evento_ler on evento for select to app_api
  using ((publicado and not demonstracao) or e_da_equipe(id) or tem_papel_org(organizacao_id, array['dono', 'admin']));
create policy evento_criar on evento for insert to app_api
  with check (tem_papel_org(organizacao_id, array['dono', 'admin']));

revoke all on organizacao, organizacao_membro from public;
grant select, update (nome, cnpj) on organizacao to app_api;
grant select, insert, delete on organizacao_membro to app_api;
grant insert (organizacao_id, slug, nome, inicio, fim, local, fuso, demonstracao) on evento to app_api;
grant update (inicio, fim) on evento to app_api;
grant update (cargo, exibir_publico) on membro_organizacao to app_api;

-- Criar organização: quem cria vira dono. Função porque, antes de existir o
-- vínculo, nenhuma política deixaria a pessoa ver a linha que acabou de inserir.
create or replace function criar_organizacao(nome_org text, cnpj_org text default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare org uuid;
begin
  if app_pessoa_id() is null then
    raise exception 'sem pessoa no contexto' using errcode = '42501';
  end if;
  insert into organizacao (nome, cnpj) values (nome_org, cnpj_org) returning id into org;
  insert into organizacao_membro (organizacao_id, pessoa_id, papel) values (org, app_pessoa_id(), 'dono');
  return org;
end $$;
revoke all on function criar_organizacao(text, text) from public;
grant execute on function criar_organizacao(text, text) to app_api;

-- Convite: substitui a linha de comando. Vale para um evento (papéis de evento)
-- ou para a organização inteira (dono ou admin). O e-mail fica cifrado, como em pessoa.
create table convite (
  id              uuid primary key default uuid_v7(),
  organizacao_id  uuid not null references organizacao (id) on delete cascade,
  evento_id       uuid references evento (id) on delete cascade,
  email_cifrado   bytea not null,
  email_hash      bytea not null check (length(email_hash) = 32),
  papeis          text[] not null check (cardinality(papeis) between 1 and 8),
  criado_por      uuid references pessoa (id) on delete set null,
  criado_em       timestamptz not null default now(),
  expira_em       timestamptz not null default now() + interval '14 days',
  aceito_em       timestamptz,
  aceito_por      uuid references pessoa (id) on delete set null,
  revogado_em     timestamptz,
  -- Convite de evento só carrega papéis de evento; convite de organização, só dono ou admin.
  check (case when evento_id is null then papeis <@ array['dono', 'admin']::text[]
              else papeis <@ papeis_de_evento() end)
);
create index convite_email on convite (email_hash) where aceito_em is null and revogado_em is null;
create index convite_evento on convite (evento_id);

-- O evento do convite tem de ser da organização do convite.
create or replace function convite_conferir_evento() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.evento_id is not null and not exists (
       select 1 from evento e where e.id = new.evento_id and e.organizacao_id = new.organizacao_id) then
    raise exception 'o evento não pertence a esta organização' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger convite_conferir_evento before insert on convite
  for each row execute function convite_conferir_evento();

alter table convite enable row level security;

-- Admin do evento convida para o evento; só o dono convida para a organização.
create policy convite_ler on convite for select to app_api
  using (case when evento_id is null then tem_papel_org(organizacao_id, array['dono', 'admin'])
              else tem_papel(evento_id, array['admin']) end);
create policy convite_criar on convite for insert to app_api
  with check (criado_por = app_pessoa_id()
              and case when evento_id is null then tem_papel_org(organizacao_id, array['dono'])
                       else tem_papel(evento_id, array['admin']) end);
create policy convite_revogar on convite for update to app_api
  using (case when evento_id is null then tem_papel_org(organizacao_id, array['dono'])
              else tem_papel(evento_id, array['admin']) end)
  with check (true);

revoke all on convite from public;
grant select, insert (organizacao_id, evento_id, email_cifrado, email_hash, papeis, criado_por) on convite to app_api;
grant update (revogado_em) on convite to app_api;

-- Convites em aberto para o e-mail de quem está logado. Função porque o
-- convidado ainda não tem papel nenhum que o deixe ler a tabela.
create or replace function meus_convites()
returns table (id uuid, organizacao text, evento text, papeis text[], expira_em timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.id, o.nome, e.nome, c.papeis, c.expira_em
  from convite c
  join pessoa p on p.id = app_pessoa_id() and p.email_hash = c.email_hash
  join organizacao o on o.id = c.organizacao_id
  left join evento e on e.id = c.evento_id
  where c.aceito_em is null and c.revogado_em is null and c.expira_em > now()
  order by c.criado_em
$$;

-- Aceitar: confere o e-mail, a validade e grava os papéis. Devolve falso se o
-- convite não é desta pessoa, venceu, foi revogado ou já foi aceito.
create or replace function aceitar_convite(convite_id uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare c convite;
begin
  select cv.* into c from convite cv
    join pessoa p on p.id = app_pessoa_id() and p.email_hash = cv.email_hash
    where cv.id = convite_id and cv.aceito_em is null and cv.revogado_em is null and cv.expira_em > now()
    for update of cv;
  if not found then
    return false;
  end if;
  if c.evento_id is null then
    insert into organizacao_membro (organizacao_id, pessoa_id, papel)
      select c.organizacao_id, app_pessoa_id(), unnest(c.papeis) on conflict do nothing;
  else
    insert into membro_organizacao (evento_id, pessoa_id, papel)
      select c.evento_id, app_pessoa_id(), unnest(c.papeis) on conflict do nothing;
  end if;
  update convite set aceito_em = now(), aceito_por = app_pessoa_id() where id = c.id;
  return true;
end $$;

revoke all on function meus_convites(), aceitar_convite(uuid) from public;
grant execute on function meus_convites(), aceitar_convite(uuid) to app_api;

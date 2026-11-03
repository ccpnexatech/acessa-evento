-- Acesso sem senha (código por e-mail), sessões e consentimento (feature 01).

-- Código de acesso: só hashes. Vale 10 minutos e aceita até 5 tentativas.
create table codigo_acesso (
  id           uuid primary key default uuid_v7(),
  email_hash   bytea not null check (length(email_hash) = 32),
  codigo_hash  bytea not null check (length(codigo_hash) = 32),
  criado_em    timestamptz not null default now(),
  expira_em    timestamptz not null,
  tentativas   smallint not null default 0 check (tentativas between 0 and 5),
  usado_em     timestamptz
);
create index codigo_acesso_email on codigo_acesso (email_hash, criado_em desc);

-- Sessão opaca: o app guarda o token; o banco, só o SHA-256 dele.
create table sessao (
  id             uuid primary key default uuid_v7(),
  pessoa_id      uuid not null references pessoa (id) on delete cascade,
  token_hash     bytea not null unique check (length(token_hash) = 32),
  criada_em      timestamptz not null default now(),
  expira_em      timestamptz not null,
  revogada_em    timestamptz,
  ultimo_uso_em  timestamptz not null default now()
);
create index sessao_pessoa on sessao (pessoa_id);

create table consentimento (
  pessoa_id      uuid not null references pessoa (id) on delete cascade,
  versao_termos  text not null check (versao_termos ~ '^\d{4}-\d{2}-\d{2}$'),
  aceito_em      timestamptz not null default now(),
  primary key (pessoa_id, versao_termos)
);

alter table codigo_acesso enable row level security;
alter table sessao enable row level security;
alter table consentimento enable row level security;

-- Antes do login não há pessoa no contexto. Estas funções fazem só a busca
-- mínima necessária, com os direitos do dono, e nada além disso.
create or replace function pessoa_por_email_hash(hash bytea) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select id from pessoa where email_hash = hash and excluida_em is null
$$;

create or replace function sessao_validar(hash bytea) returns table (sessao_id uuid, pessoa_id uuid)
language sql volatile security definer set search_path = public, pg_temp as $$
  update sessao s set ultimo_uso_em = now()
  where s.token_hash = hash and s.revogada_em is null and s.expira_em > now()
  returning s.id, s.pessoa_id
$$;

revoke all on function pessoa_por_email_hash(bytea), sessao_validar(bytea) from public;
grant execute on function pessoa_por_email_hash(bytea), sessao_validar(bytea) to app_api;

-- codigo_acesso não tem dado pessoal legível (só hashes): a API opera sem contexto.
create policy codigo_acesso_api on codigo_acesso for all to app_api using (true) with check (true);

-- A sessão é criada no login (contexto = a própria pessoa) e só ela a vê ou revoga.
create policy sessao_propria on sessao for all to app_api
  using (pessoa_id = app_pessoa_id()) with check (pessoa_id = app_pessoa_id());

create policy consentimento_proprio on consentimento for all to app_api
  using (pessoa_id = app_pessoa_id()) with check (pessoa_id = app_pessoa_id());

revoke all on codigo_acesso, sessao, consentimento from public;
grant select, insert, update (tentativas, usado_em), delete on codigo_acesso to app_api;
grant select, insert, update (revogada_em) on sessao to app_api;
grant select, insert on consentimento to app_api;

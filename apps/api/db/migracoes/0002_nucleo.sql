-- Núcleo: evento, pessoa e quem organiza cada evento.

create table evento (
  id          uuid primary key default uuid_v7(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  nome        text not null check (length(nome) between 3 and 120),
  inicio      date not null,
  fim         date not null,
  local       text not null,
  fuso        text not null default 'America/Fortaleza',
  publicado   boolean not null default false,
  -- As 5 chaves do tema (ADR 0011). Validação de contraste fica na aplicação.
  tema        jsonb not null default '{}'::jsonb check (jsonb_typeof(tema) = 'object'),
  criado_em   timestamptz not null default now(),
  check (fim >= inicio)
);

-- Pessoa é global: a mesma conta participa de vários eventos.
-- E-mail só cifrado (AES-256-GCM na aplicação) + HMAC para busca exata.
create table pessoa (
  id             uuid primary key default uuid_v7(),
  email_cifrado  bytea not null,
  email_hash     bytea not null unique check (length(email_hash) = 32),
  nome_cracha    text check (length(nome_cracha) between 1 and 60),
  criada_em      timestamptz not null default now(),
  excluida_em    timestamptz
);

create table membro_organizacao (
  evento_id  uuid not null references evento (id) on delete cascade,
  pessoa_id  uuid not null references pessoa (id) on delete cascade,
  papel      text not null check (papel in ('admin', 'conteudo', 'credenciamento', 'financeiro')),
  criado_em  timestamptz not null default now(),
  primary key (evento_id, pessoa_id)
);
create index membro_organizacao_pessoa on membro_organizacao (pessoa_id);

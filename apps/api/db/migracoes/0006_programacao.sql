-- Programação do evento: salas, palestrantes, atividades e favoritos (feature 03).
-- "atividade" = palestra, mesa ou oficina ("sessao" já é a sessão de login).

create table sala (
  id             uuid primary key default uuid_v7(),
  evento_id      uuid not null references evento (id) on delete cascade,
  nome           text not null check (length(nome) between 1 and 80),
  local          text not null check (length(local) between 1 and 120),
  -- Como chegar sem degraus, onde fica o intérprete etc. Texto da organização.
  acessibilidade text,
  unique (evento_id, nome)
);

create table palestrante (
  id         uuid primary key default uuid_v7(),
  evento_id  uuid not null references evento (id) on delete cascade,
  nome       text not null check (length(nome) between 2 and 120),
  cargo      text check (length(cargo) <= 160)
);

create table atividade (
  id             uuid primary key default uuid_v7(),
  evento_id      uuid not null references evento (id) on delete cascade,
  sala_id        uuid references sala (id) on delete set null,
  titulo         text not null check (length(titulo) between 3 and 200),
  resumo         text check (length(resumo) <= 2000),
  inicio         timestamptz not null,
  fim            timestamptz not null,
  recursos       text[] not null default '{}'
                 check (recursos <@ array['libras', 'legenda', 'audiodescricao']::text[]),
  publicada      boolean not null default true,
  atualizada_em  timestamptz not null default now(),
  check (fim > inicio)
);
create index atividade_evento_inicio on atividade (evento_id, inicio);

create table atividade_palestrante (
  atividade_id    uuid not null references atividade (id) on delete cascade,
  palestrante_id  uuid not null references palestrante (id) on delete cascade,
  ordem           smallint not null default 1,
  primary key (atividade_id, palestrante_id)
);

create table favorito (
  pessoa_id     uuid not null references pessoa (id) on delete cascade,
  atividade_id  uuid not null references atividade (id) on delete cascade,
  criado_em     timestamptz not null default now(),
  primary key (pessoa_id, atividade_id)
);

-- Qualquer mudança na atividade avança atualizada_em: é o que muda o ETag da agenda.
create or replace function atividade_tocar() returns trigger
language plpgsql as $$
begin
  new.atualizada_em := now();
  return new;
end $$;
create trigger atividade_tocar before update on atividade
  for each row execute function atividade_tocar();

alter table sala enable row level security;
alter table palestrante enable row level security;
alter table atividade enable row level security;
alter table atividade_palestrante enable row level security;
alter table favorito enable row level security;

-- Programação de evento publicado é pública; quem organiza vê também o rascunho.
create or replace function evento_visivel(evento uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from evento e where e.id = evento and e.publicado)
      or tem_papel(evento, array['admin', 'conteudo', 'credenciamento', 'financeiro'])
$$;
revoke all on function evento_visivel(uuid) from public;
grant execute on function evento_visivel(uuid) to app_api;

create policy sala_ler on sala for select to app_api using (evento_visivel(evento_id));
create policy palestrante_ler on palestrante for select to app_api using (evento_visivel(evento_id));
create policy atividade_ler on atividade for select to app_api
  using ((publicada and evento_visivel(evento_id)) or tem_papel(evento_id, array['admin', 'conteudo']));
create policy atividade_palestrante_ler on atividade_palestrante for select to app_api
  using (exists (select 1 from atividade a where a.id = atividade_id));

-- Quem cuida do conteúdo edita a programação do próprio evento.
create policy sala_gerir on sala for all to app_api
  using (tem_papel(evento_id, array['admin', 'conteudo'])) with check (tem_papel(evento_id, array['admin', 'conteudo']));
create policy palestrante_gerir on palestrante for all to app_api
  using (tem_papel(evento_id, array['admin', 'conteudo'])) with check (tem_papel(evento_id, array['admin', 'conteudo']));
create policy atividade_gerir on atividade for all to app_api
  using (tem_papel(evento_id, array['admin', 'conteudo'])) with check (tem_papel(evento_id, array['admin', 'conteudo']));

-- Favorito é só da própria pessoa, e só de atividade que ela consegue ver.
create policy favorito_proprio on favorito for all to app_api
  using (pessoa_id = app_pessoa_id())
  with check (pessoa_id = app_pessoa_id() and exists (select 1 from atividade a where a.id = atividade_id));

revoke all on sala, palestrante, atividade, atividade_palestrante, favorito from public;
grant select, insert, update, delete on sala, palestrante, atividade to app_api;
grant select on atividade_palestrante to app_api;
grant select, insert, delete on favorito to app_api;

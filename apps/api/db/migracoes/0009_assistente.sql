-- Assistente guiado (feature 05, ADR 0008): a organização publica o grafo
-- como versão imutável; o app baixa a última e percorre sem internet.

create table assistente_versao (
  evento_id      uuid not null references evento (id) on delete cascade,
  versao         integer not null check (versao > 0),
  -- Formato validado pela API antes de gravar (ADR 0023); o banco só garante que é objeto.
  grafo          jsonb not null check (jsonb_typeof(grafo) = 'object'),
  canais         jsonb not null default '[]' check (jsonb_typeof(canais) = 'array'),
  publicado_em   timestamptz not null default now(),
  publicado_por  uuid references pessoa (id) on delete set null,
  primary key (evento_id, versao)
);

-- Avaliação "Isso respondeu sua dúvida?": sem pessoa, sem hora, só o dia.
create table assistente_avaliacao (
  id           uuid primary key default uuid_v7(),
  evento_id    uuid not null references evento (id) on delete cascade,
  versao       integer not null,
  resposta_id  text not null check (resposta_id ~ '^[a-z0-9-]{1,40}$'),
  util         boolean not null,
  dia          date not null default current_date,
  foreign key (evento_id, versao) references assistente_versao (evento_id, versao) on delete cascade
);
create index assistente_avaliacao_resposta on assistente_avaliacao (evento_id, versao, resposta_id);

alter table assistente_versao enable row level security;
alter table assistente_avaliacao enable row level security;

create policy assistente_ler on assistente_versao for select to app_api using (evento_visivel(evento_id));
create policy assistente_publicar on assistente_versao for insert to app_api
  with check (tem_papel(evento_id, array['admin', 'conteudo']) and publicado_por = app_pessoa_id());

create policy avaliacao_enviar on assistente_avaliacao for insert to app_api with check (evento_visivel(evento_id));
create policy avaliacao_organizacao on assistente_avaliacao for select to app_api using (tem_papel(evento_id, array['admin', 'conteudo']));

revoke all on assistente_versao, assistente_avaliacao from public;
grant select, insert on assistente_versao to app_api;
grant select, insert on assistente_avaliacao to app_api;

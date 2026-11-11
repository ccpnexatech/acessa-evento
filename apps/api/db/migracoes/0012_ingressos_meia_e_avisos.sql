-- Inscrição e comunicação na área do organizador (ADR 0027): modalidade do
-- ingresso, meia-entrada declarada (sem guardar documento), acompanhante,
-- taxa da plataforma no pedido e avisos por categoria.

alter table tipo_ingresso
  -- "modalidade" e não "categoria": categoria já é o que a pessoa é no evento (ADR 0026).
  add column modalidade text not null default 'inteira'
    check (modalidade in ('inteira', 'meia', 'acompanhante', 'cortesia')),
  -- Mostrar "restam 12" ao público é escolha do organizador.
  add column publico_ve_saldo boolean not null default true;
grant update (modalidade, publico_ve_saldo) on tipo_ingresso to app_api;

-- Quanto do valor do pedido é taxa da plataforma. Guardado no pedido para o
-- relatório não depender da regra de cobrança que estiver valendo depois.
alter table pedido add column taxa_centavos integer not null default 0 check (taxa_centavos >= 0);

-- Ingresso de acompanhante aponta para o ingresso de quem ele acompanha.
alter table ingresso
  add column acompanha_ingresso_id uuid references ingresso (id) on delete set null,
  add constraint ingresso_nao_acompanha_a_si check (acompanha_ingresso_id <> id);
create index ingresso_acompanha on ingresso (acompanha_ingresso_id) where acompanha_ingresso_id is not null;

alter table atividade
  add column tipo text not null default 'sessao' check (tipo in ('sessao', 'festa', 'paralela')),
  -- Atividade fora de sala (festa na área externa, por exemplo).
  add column zona_id uuid references zona (id) on delete set null;

-- Palestrante com conta: recebe credencial e vê a própria agenda.
alter table palestrante add column pessoa_id uuid references pessoa (id) on delete set null;
create index palestrante_pessoa on palestrante (pessoa_id) where pessoa_id is not null;

-- Meia-entrada: a pessoa declara o motivo ao comprar; a equipe confere o
-- documento na entrada e marca o resultado. Nenhum documento é enviado nem
-- guardado. O motivo pode revelar deficiência: some 30 dias após o evento.
create table elegibilidade_meia (
  id            uuid primary key default uuid_v7(),
  evento_id     uuid not null references evento (id) on delete cascade,
  pessoa_id     uuid not null references pessoa (id) on delete cascade,
  motivo        text not null check (motivo in (
                  'estudante', 'idoso', 'pcd', 'acompanhante_pcd', 'jovem_baixa_renda', 'professor', 'doador_sangue')),
  declarada_em  timestamptz not null default now(),
  conferida_em  timestamptz,
  conferida_por uuid references pessoa (id) on delete set null,
  resultado     text check (resultado in ('confirmada', 'recusada')),
  apagar_apos   date not null,
  unique (evento_id, pessoa_id),
  check ((conferida_em is null) = (resultado is null))
);
create index elegibilidade_meia_expurgo on elegibilidade_meia (apagar_apos);

create or replace function elegibilidade_meia_prazo() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  select (e.fim + interval '30 days')::date into new.apagar_apos from evento e where e.id = new.evento_id;
  return new;
end $$;
create trigger elegibilidade_meia_prazo before insert on elegibilidade_meia
  for each row execute function elegibilidade_meia_prazo();

alter table elegibilidade_meia enable row level security;
create policy meia_propria_ler on elegibilidade_meia for select to app_api using (pessoa_id = app_pessoa_id());
create policy meia_declarar on elegibilidade_meia for insert to app_api
  with check (pessoa_id = app_pessoa_id() and conferida_em is null and evento_visivel(evento_id));
-- Depois de conferida, a pessoa não apaga nem troca o motivo.
create policy meia_desistir on elegibilidade_meia for delete to app_api
  using (pessoa_id = app_pessoa_id() and conferida_em is null);
create policy meia_equipe_ler on elegibilidade_meia for select to app_api
  using (tem_papel(evento_id, array['admin', 'credenciamento']));
create policy meia_conferir on elegibilidade_meia for update to app_api
  using (tem_papel(evento_id, array['admin', 'credenciamento']))
  with check (tem_papel(evento_id, array['admin', 'credenciamento']) and conferida_por = app_pessoa_id());

revoke all on elegibilidade_meia from public;
grant select, delete on elegibilidade_meia to app_api;
grant insert (evento_id, pessoa_id, motivo) on elegibilidade_meia to app_api;
grant update (conferida_em, conferida_por, resultado) on elegibilidade_meia to app_api;

create or replace function expurgar_meia() returns integer
language sql security definer set search_path = public, pg_temp as $$
  with apagados as (delete from elegibilidade_meia where apagar_apos < current_date returning 1)
  select count(*)::integer from apagados
$$;
revoke all on function expurgar_meia() from public;
grant execute on function expurgar_meia() to app_api;

-- Aviso do organizador: para todos ou para algumas categorias, com hora de publicação.
create table aviso (
  id           uuid primary key default uuid_v7(),
  evento_id    uuid not null references evento (id) on delete cascade,
  titulo       text not null check (length(titulo) between 3 and 80),
  corpo        text not null check (length(corpo) between 3 and 1000),
  -- Nulo = todo mundo com credencial válida no evento.
  categorias   categoria_pessoa[] check (categorias is null or cardinality(categorias) between 1 and 11),
  urgente      boolean not null default false,
  publicar_em  timestamptz not null default now(),
  criado_por   uuid references pessoa (id) on delete set null,
  criado_em    timestamptz not null default now()
);
create index aviso_evento on aviso (evento_id, publicar_em desc);

alter table aviso enable row level security;
create policy aviso_equipe on aviso for select to app_api using (e_da_equipe(evento_id));
-- Quem tem credencial válida lê os avisos já publicados da sua categoria.
create policy aviso_destinatario on aviso for select to app_api
  using (publicar_em <= now() and exists (
    select 1 from credencial c
    where c.evento_id = aviso.evento_id and c.pessoa_id = app_pessoa_id() and c.revogada_em is null
      and (aviso.categorias is null or c.categoria = any (aviso.categorias))));
create policy aviso_gerir on aviso for all to app_api
  using (tem_papel(evento_id, array['admin', 'comunicacao']))
  with check (tem_papel(evento_id, array['admin', 'comunicacao']) and criado_por = app_pessoa_id());

revoke all on aviso from public;
grant select, insert, delete on aviso to app_api;
grant update (titulo, corpo, categorias, urgente, publicar_em) on aviso to app_api;

-- Inscrição e pagamento (feature 02): tipos de ingresso, pedidos, ingressos
-- e pedidos de recursos de acessibilidade.

alter table evento
  add column descricao text check (length(descricao) <= 2000),
  add column inscricoes_abertas boolean not null default false,
  -- O que o evento oferece, para o filtro "Com Libras" na lista de eventos.
  add column recursos_oferecidos text[] not null default '{}'
    check (recursos_oferecidos <@ array['libras', 'legenda', 'audiodescricao', 'acesso_sem_degraus']::text[]);

create table tipo_ingresso (
  id              uuid primary key default uuid_v7(),
  evento_id       uuid not null references evento (id) on delete cascade,
  nome            text not null check (length(nome) between 2 and 60),
  descricao       text check (length(descricao) <= 200),
  preco_centavos  integer not null check (preco_centavos >= 0),
  vagas           integer not null check (vagas >= 0),
  -- Vagas presas por pedidos pendentes ou aprovados. Só as funções abaixo mexem aqui.
  ocupadas        integer not null default 0 check (ocupadas between 0 and vagas),
  ordem           smallint not null default 1,
  unique (evento_id, nome)
);

-- Pedido é registro fiscal: sobrevive 5 anos à exclusão da conta, sem ligação com ela (ADR 0012).
create table pedido (
  id                  uuid primary key default uuid_v7(),
  pessoa_id           uuid references pessoa (id) on delete set null,
  evento_id           uuid not null references evento (id),
  tipo_ingresso_id    uuid not null references tipo_ingresso (id),
  valor_centavos      integer not null check (valor_centavos >= 0),
  metodo              text not null check (metodo in ('pix', 'cartao')),
  status              text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  chave_idempotencia  text not null check (chave_idempotencia ~ '^[A-Za-z0-9_-]{16,100}$'),
  referencia_provedor text,
  -- Cartão: só os 4 últimos dígitos, nunca o número.
  cartao_final        text check (cartao_final ~ '^[0-9]{4}$'),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  unique (pessoa_id, chave_idempotencia)
);
create index pedido_evento on pedido (evento_id, status);

create table ingresso (
  id                uuid primary key default uuid_v7(),
  pedido_id         uuid not null unique references pedido (id),
  pessoa_id         uuid not null references pessoa (id) on delete cascade,
  evento_id         uuid not null references evento (id) on delete cascade,
  tipo_ingresso_id  uuid not null references tipo_ingresso (id),
  emitido_em        timestamptz not null default now(),
  cancelado_em      timestamptz
);
-- Uma inscrição válida por pessoa e evento.
create unique index ingresso_unico_ativo on ingresso (pessoa_id, evento_id) where cancelado_em is null;

-- Dado sensível (pode revelar deficiência): só o necessário, apagado 30 dias após o evento (ADR 0012).
create table pedido_acessibilidade (
  pessoa_id    uuid not null references pessoa (id) on delete cascade,
  evento_id    uuid not null references evento (id) on delete cascade,
  recursos     text[] not null check (
                 cardinality(recursos) > 0 and
                 recursos <@ array['libras', 'legenda', 'audiodescricao', 'acesso_sem_degraus', 'acompanhante']::text[]),
  criado_em    timestamptz not null default now(),
  apagar_apos  date not null,
  primary key (pessoa_id, evento_id)
);

alter table tipo_ingresso enable row level security;
alter table pedido enable row level security;
alter table ingresso enable row level security;
alter table pedido_acessibilidade enable row level security;

create policy tipo_ingresso_ler on tipo_ingresso for select to app_api using (evento_visivel(evento_id));
create policy tipo_ingresso_gerir on tipo_ingresso for all to app_api
  using (tem_papel(evento_id, array['admin', 'financeiro'])) with check (tem_papel(evento_id, array['admin', 'financeiro']));

create policy pedido_proprio on pedido for select to app_api using (pessoa_id = app_pessoa_id());
create policy pedido_criar on pedido for insert to app_api
  with check (pessoa_id = app_pessoa_id() and status = 'pendente'
              and exists (select 1 from evento e where e.id = evento_id and e.publicado and e.inscricoes_abertas));
create policy pedido_atualizar on pedido for update to app_api
  using (pessoa_id = app_pessoa_id() and status = 'pendente') with check (pessoa_id = app_pessoa_id());
create policy pedido_financeiro on pedido for select to app_api using (tem_papel(evento_id, array['admin', 'financeiro']));

create policy ingresso_proprio on ingresso for select to app_api using (pessoa_id = app_pessoa_id());
create policy ingresso_emitir on ingresso for insert to app_api
  with check (pessoa_id = app_pessoa_id()
              and exists (select 1 from pedido p where p.id = pedido_id and p.pessoa_id = app_pessoa_id()
                          and p.status = 'aprovado' and p.evento_id = ingresso.evento_id and p.tipo_ingresso_id = ingresso.tipo_ingresso_id));
create policy ingresso_equipe on ingresso for select to app_api using (tem_papel(evento_id, array['admin', 'credenciamento']));

create policy acessibilidade_propria on pedido_acessibilidade for all to app_api
  using (pessoa_id = app_pessoa_id()) with check (pessoa_id = app_pessoa_id());
create policy acessibilidade_organizacao on pedido_acessibilidade for select to app_api using (tem_papel(evento_id, array['admin']));

-- Reserva atômica: dois pedidos pela última vaga não passam juntos.
create or replace function reservar_vaga(tipo uuid) returns boolean
language sql security definer set search_path = public, pg_temp as $$
  with r as (
    update tipo_ingresso t set ocupadas = ocupadas + 1
    where t.id = tipo and t.ocupadas < t.vagas and evento_visivel(t.evento_id)
    returning 1
  )
  select exists (select 1 from r)
$$;

-- Devolve a vaga de um pedido recusado; só do próprio pedido e só uma vez.
create or replace function liberar_vaga(pedido_recusado uuid) returns void
language sql security definer set search_path = public, pg_temp as $$
  update tipo_ingresso t set ocupadas = greatest(ocupadas - 1, 0)
  from pedido p
  where p.id = pedido_recusado and p.pessoa_id = app_pessoa_id() and p.status = 'recusado'
    and t.id = p.tipo_ingresso_id
$$;

-- Expurgo diário dos pedidos de acessibilidade vencidos; chamado pelo agendador.
create or replace function expurgar_acessibilidade() returns integer
language sql security definer set search_path = public, pg_temp as $$
  with apagados as (delete from pedido_acessibilidade where apagar_apos < current_date returning 1)
  select count(*)::integer from apagados
$$;

revoke all on function reservar_vaga(uuid), liberar_vaga(uuid), expurgar_acessibilidade() from public;
grant execute on function reservar_vaga(uuid), liberar_vaga(uuid), expurgar_acessibilidade() to app_api;

revoke all on tipo_ingresso, pedido, ingresso, pedido_acessibilidade from public;
grant select on tipo_ingresso to app_api;
grant insert, delete on tipo_ingresso to app_api;
-- "ocupadas" fica de fora: só reservar_vaga e liberar_vaga mexem nela.
grant update (nome, descricao, preco_centavos, vagas, ordem) on tipo_ingresso to app_api;
grant select, insert on pedido to app_api;
grant update (status, referencia_provedor, atualizado_em) on pedido to app_api;
grant select, insert on ingresso to app_api;
grant select, insert, update, delete on pedido_acessibilidade to app_api;
grant update (descricao, inscricoes_abertas, recursos_oferecidos) on evento to app_api;

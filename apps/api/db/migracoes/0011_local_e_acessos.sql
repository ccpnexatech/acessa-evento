-- Local, zonas e controle de acesso (ADR 0026): a credencial diz quem é a
-- pessoa no evento; a regra de cada zona diz quem entra. O QR não carrega zona,
-- então mudar uma regra não invalida nenhum QR já emitido.

-- Lista fechada de categorias: uma só definição para credencial, regra e convite.
create domain categoria_pessoa as text check (value in (
  'congressista', 'palestrante', 'convidado', 'expositor', 'equipe',
  'alimentacao', 'entretenimento', 'limpeza', 'seguranca', 'montagem', 'marketing'));

-- Evento de demonstração não vaza pela programação nem pelos tipos de ingresso:
-- tudo que usa evento_visivel passa a respeitar a marca (a 0010 só cobria a tabela evento).
create or replace function evento_visivel(evento uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from evento e where e.id = evento and e.publicado and not e.demonstracao)
         or e_da_equipe(evento)
$$;

-- Admin de algum evento da organização (além de dono e admin dela): quem cuida de local.
create or replace function gere_organizacao(org uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select tem_papel_org(org, array['dono', 'admin']) or exists (
    select 1 from evento e join membro_organizacao m on m.evento_id = e.id
    where e.organizacao_id = org and m.pessoa_id = app_pessoa_id() and m.papel = 'admin')
$$;
revoke all on function gere_organizacao(uuid) from public;
grant execute on function gere_organizacao(uuid) to app_api;

-- O local é da organização: o mesmo centro de eventos serve à edição do ano que vem.
create table local (
  id              uuid primary key default uuid_v7(),
  organizacao_id  uuid not null references organizacao (id) on delete cascade,
  nome            text not null check (length(nome) between 2 and 120),
  endereco        text check (length(endereco) <= 200),
  cidade          text check (length(cidade) <= 80),
  uf              text check (uf ~ '^[A-Z]{2}$'),
  -- Como chegar sem degraus, estacionamento reservado, banheiro acessível.
  acessibilidade  text check (length(acessibilidade) <= 2000),
  criado_em       timestamptz not null default now(),
  unique (organizacao_id, nome)
);
alter table evento add column local_id uuid references local (id) on delete set null;

create table zona (
  id         uuid primary key default uuid_v7(),
  evento_id  uuid not null references evento (id) on delete cascade,
  nome       text not null check (length(nome) between 1 and 80),
  descricao  text check (length(descricao) <= 500),
  -- Zona aberta: qualquer credencial válida entra, sem regra por categoria.
  aberta     boolean not null default false,
  -- Caminho sem degraus até a zona, escrito pela organização.
  rota_acessivel text check (length(rota_acessivel) <= 1000),
  ordem      integer not null default 0,
  unique (evento_id, nome),
  unique (id, evento_id)
);

alter table sala
  add column zona_id uuid references zona (id) on delete set null,
  add column capacidade integer check (capacidade > 0),
  -- Lugares guardados para cadeira de rodas, acompanhante e primeira fila de Libras.
  add column lugares_reservados integer not null default 0 check (lugares_reservados >= 0);

-- Quem entra em cada zona, por categoria. Sem linha, não entra.
create table regra_zona (
  zona_id    uuid not null,
  evento_id  uuid not null references evento (id) on delete cascade,
  categoria  categoria_pessoa not null,
  -- Janela opcional: montagem só entra antes da abertura, por exemplo.
  de         timestamptz,
  ate        timestamptz,
  primary key (zona_id, categoria),
  foreign key (zona_id, evento_id) references zona (id, evento_id) on delete cascade,
  check (de is null or ate is null or de < ate)
);

-- Ponto de leitura: um celular da equipe, uma catraca ou um totem.
-- Sem zona, é a entrada do evento.
create table ponto_leitura (
  id              uuid primary key default uuid_v7(),
  evento_id       uuid not null references evento (id) on delete cascade,
  zona_id         uuid,
  nome            text not null check (length(nome) between 1 and 40),
  tipo            text not null default 'celular' check (tipo in ('celular', 'catraca', 'totem')),
  -- entrada_unica: o primeiro vale e o resto é "já entrou". passagem_livre: toda leitura conta.
  modo            text not null default 'entrada_unica' check (modo in ('entrada_unica', 'passagem_livre')),
  ativo           boolean not null default true,
  ultima_sinc_em  timestamptz,
  unique (evento_id, nome),
  unique (id, evento_id),
  foreign key (zona_id, evento_id) references zona (id, evento_id) on delete cascade
);

-- Credencial: o que a pessoa é neste evento. Todo ingresso gera a sua.
create table credencial (
  id            uuid primary key default uuid_v7(),
  evento_id     uuid not null references evento (id) on delete cascade,
  pessoa_id     uuid not null references pessoa (id) on delete cascade,
  categoria     categoria_pessoa not null,
  ingresso_id   uuid unique references ingresso (id) on delete cascade,
  emitida_em    timestamptz not null default now(),
  emitida_por   uuid references pessoa (id) on delete set null,
  revogada_em   timestamptz,
  revogada_por  uuid references pessoa (id) on delete set null,
  motivo        text check (length(motivo) <= 200),
  unique (id, evento_id),
  -- Credencial de congressista só existe com ingresso; as outras, sem.
  check ((categoria = 'congressista') = (ingresso_id is not null))
);
create unique index credencial_unica_ativa on credencial (evento_id, pessoa_id, categoria) where revogada_em is null;
create index credencial_pessoa on credencial (pessoa_id);

-- Exceção pessoal: libera ou barra uma credencial numa zona, com motivo.
create table credencial_excecao (
  credencial_id  uuid not null,
  zona_id        uuid not null,
  evento_id      uuid not null references evento (id) on delete cascade,
  efeito         text not null check (efeito in ('permite', 'nega')),
  motivo         text not null check (length(motivo) between 3 and 200),
  criado_por     uuid references pessoa (id) on delete set null,
  criado_em      timestamptz not null default now(),
  primary key (credencial_id, zona_id),
  foreign key (credencial_id, evento_id) references credencial (id, evento_id) on delete cascade,
  foreign key (zona_id, evento_id) references zona (id, evento_id) on delete cascade
);

-- Ingressos da v1.0.0 ganham credencial de congressista, com a mesma data e situação.
insert into credencial (evento_id, pessoa_id, categoria, ingresso_id, emitida_em, revogada_em, motivo)
  select i.evento_id, i.pessoa_id, 'congressista', i.id, i.emitido_em, i.cancelado_em,
         case when i.cancelado_em is not null then 'ingresso cancelado' end
  from ingresso i;

create or replace function credencial_do_ingresso() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    insert into credencial (evento_id, pessoa_id, categoria, ingresso_id, emitida_em, revogada_em)
      values (new.evento_id, new.pessoa_id, 'congressista', new.id, new.emitido_em, new.cancelado_em);
  elsif new.cancelado_em is distinct from old.cancelado_em then
    update credencial set revogada_em = new.cancelado_em,
                          motivo = case when new.cancelado_em is not null then 'ingresso cancelado' end
      where ingresso_id = new.id;
  end if;
  return null;
end $$;
create trigger credencial_do_ingresso after insert or update of cancelado_em on ingresso
  for each row execute function credencial_do_ingresso();

-- Check-in passa a apontar para a credencial e para o ponto de leitura.
-- As colunas da v1 ficam: quem ainda envia ingresso_id e portao continua funcionando.
alter table checkin
  alter column ingresso_id drop not null,
  add column credencial_id uuid references credencial (id) on delete cascade,
  add column ponto_leitura_id uuid references ponto_leitura (id) on delete set null,
  add column sentido text not null default 'entrada' check (sentido in ('entrada', 'saida')),
  -- O leitor decide offline; a leitura barrada também sobe, para a organização enxergar.
  add column resultado text not null default 'liberado' check (resultado in ('liberado', 'negado'));

update checkin c set credencial_id = cr.id from credencial cr where cr.ingresso_id = c.ingresso_id;
alter table checkin add constraint checkin_tem_alvo check (ingresso_id is not null or credencial_id is not null);
create index checkin_credencial on checkin (credencial_id, feito_em, id);
create index checkin_ponto on checkin (ponto_leitura_id, feito_em);

-- Completa e confere a linha: credencial a partir do ingresso (e o contrário),
-- e tudo do mesmo evento. Roda como dono porque a equipe não lê todas as tabelas.
create or replace function checkin_conferir() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare cr credencial;
begin
  if new.credencial_id is null then
    select c.* into cr from credencial c where c.ingresso_id = new.ingresso_id;
  else
    select c.* into cr from credencial c where c.id = new.credencial_id;
  end if;
  if not found or cr.evento_id <> new.evento_id
     or (new.ingresso_id is not null and cr.ingresso_id is distinct from new.ingresso_id) then
    raise exception 'credencial não pertence a este evento' using errcode = '23514';
  end if;
  new.credencial_id := cr.id;
  new.ingresso_id := cr.ingresso_id;
  if new.ponto_leitura_id is not null and not exists (
       select 1 from ponto_leitura p where p.id = new.ponto_leitura_id and p.evento_id = new.evento_id) then
    raise exception 'ponto de leitura não pertence a este evento' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger checkin_conferir before insert on checkin
  for each row execute function checkin_conferir();

-- Entrada no evento: leitura liberada, de entrada, num ponto sem zona (ou da v1, sem ponto).
create or replace function checkin_e_entrada_do_evento(c checkin) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select c.resultado = 'liberado' and c.sentido = 'entrada' and not exists (
    select 1 from ponto_leitura p where p.id = c.ponto_leitura_id and p.zona_id is not null)
$$;
revoke all on function checkin_e_entrada_do_evento(checkin) from public;
grant execute on function checkin_e_entrada_do_evento(checkin) to app_api;

-- As visões da v1 continuam significando "entrou no evento": leitura de zona não conta.
create or replace view checkin_primeiro with (security_invoker = true) as
  select distinct on (ingresso_id) ingresso_id, id, portao, feito_em, metodo
  from checkin c where ingresso_id is not null and checkin_e_entrada_do_evento(c)
  order by ingresso_id, feito_em, id;

-- Mesma ideia, para qualquer categoria.
create view entrada_primeira with (security_invoker = true) as
  select distinct on (credencial_id) credencial_id, id, evento_id, ponto_leitura_id, portao, feito_em, metodo
  from checkin c where checkin_e_entrada_do_evento(c)
  order by credencial_id, feito_em, id;
grant select on entrada_primeira to app_api;

-- Entradas registradas por ponto. É contagem de leituras, não de pessoas presentes.
create view entradas_por_ponto with (security_invoker = true) as
  select c.evento_id, c.ponto_leitura_id, c.portao,
         count(*) filter (where c.resultado = 'liberado' and c.sentido = 'entrada')::int as entradas,
         count(distinct c.credencial_id) filter (where c.resultado = 'liberado' and c.sentido = 'entrada')::int as credenciais,
         count(*) filter (where c.resultado = 'liberado' and c.sentido = 'saida')::int as saidas,
         count(*) filter (where c.resultado = 'negado')::int as negadas,
         max(c.feito_em) as ultima_em
  from checkin c group by c.evento_id, c.ponto_leitura_id, c.portao;
grant select on entradas_por_ponto to app_api;

-- A regra, escrita uma vez: exceção pessoal ganha da regra da zona. Sem zona, basta a credencial valer.
create or replace function pode_entrar(credencial_alvo uuid, zona_alvo uuid, quando timestamptz default now()) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from credencial c
    where c.id = credencial_alvo and (c.revogada_em is null or c.revogada_em > quando)
      and (e_da_equipe(c.evento_id) or c.pessoa_id = app_pessoa_id())
      and (zona_alvo is null or coalesce(
        (select x.efeito = 'permite' from credencial_excecao x where x.credencial_id = c.id and x.zona_id = zona_alvo),
        exists (select 1 from zona z where z.id = zona_alvo and z.evento_id = c.evento_id and (
          z.aberta or exists (
            select 1 from regra_zona r where r.zona_id = z.id and r.categoria = c.categoria
              and (r.de is null or r.de <= quando) and (r.ate is null or r.ate > quando))))))
  )
$$;
revoke all on function pode_entrar(uuid, uuid, timestamptz) from public;
grant execute on function pode_entrar(uuid, uuid, timestamptz) to app_api;

-- Pacote do leitor: todas as credenciais do evento, inclusive as revogadas
-- (o QR delas ainda confere na assinatura; é esta lista que barra).
create or replace function lista_credenciais(evento uuid)
returns table (credencial_id uuid, ingresso_id uuid, nome text, categoria text, tipo text, recursos text[],
               revogada_em timestamptz, entrada_em timestamptz, entrada_portao text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not tem_papel(evento, array['admin', 'credenciamento', 'operacao']) then
    raise exception 'sem papel de credenciamento' using errcode = '42501';
  end if;
  return query
    select c.id, c.ingresso_id, coalesce(p.nome_cracha, 'Sem nome no crachá'), c.categoria::text, t.nome,
           coalesce(a.recursos, '{}'), c.revogada_em, e.feito_em, e.portao
    from credencial c
    join pessoa p on p.id = c.pessoa_id
    left join ingresso i on i.id = c.ingresso_id
    left join tipo_ingresso t on t.id = i.tipo_ingresso_id
    left join pedido_acessibilidade a on a.pessoa_id = c.pessoa_id and a.evento_id = c.evento_id
    left join lateral (
      select k.feito_em, k.portao from checkin k
      where k.credencial_id = c.id and checkin_e_entrada_do_evento(k) order by k.feito_em, k.id limit 1
    ) e on true
    where c.evento_id = evento
    order by 3, 1;
end $$;
revoke all on function lista_credenciais(uuid) from public;
grant execute on function lista_credenciais(uuid) to app_api;

-- O aparelho avisa que sincronizou. Função para a equipe de portão não precisar alterar o ponto.
create or replace function ponto_leitura_sincronizou(ponto uuid) returns timestamptz
language plpgsql security definer set search_path = public, pg_temp as $$
declare agora timestamptz := now();
begin
  update ponto_leitura set ultima_sinc_em = agora
    where id = ponto and tem_papel(evento_id, array['admin', 'credenciamento', 'operacao']);
  if not found then
    raise exception 'ponto de leitura não encontrado' using errcode = '42501';
  end if;
  return agora;
end $$;
revoke all on function ponto_leitura_sincronizou(uuid) from public;
grant execute on function ponto_leitura_sincronizou(uuid) to app_api;

alter table local enable row level security;
alter table zona enable row level security;
alter table regra_zona enable row level security;
alter table ponto_leitura enable row level security;
alter table credencial enable row level security;
alter table credencial_excecao enable row level security;

-- local: público quando algum evento visível acontece nele; gerido por quem cuida da organização.
create policy local_ler on local for select to app_api
  using (gere_organizacao(organizacao_id)
         or exists (select 1 from evento e where e.local_id = local.id and evento_visivel(e.id)));
create policy local_gerir on local for all to app_api
  using (gere_organizacao(organizacao_id)) with check (gere_organizacao(organizacao_id));

-- zona: o participante vê o mapa do evento; as regras são da equipe.
create policy zona_ler on zona for select to app_api using (evento_visivel(evento_id));
create policy zona_gerir on zona for all to app_api
  using (tem_papel(evento_id, array['admin', 'operacao'])) with check (tem_papel(evento_id, array['admin', 'operacao']));
create policy regra_zona_ler on regra_zona for select to app_api using (e_da_equipe(evento_id));
create policy regra_zona_gerir on regra_zona for all to app_api
  using (tem_papel(evento_id, array['admin', 'operacao'])) with check (tem_papel(evento_id, array['admin', 'operacao']));
create policy ponto_leitura_ler on ponto_leitura for select to app_api using (e_da_equipe(evento_id));
create policy ponto_leitura_gerir on ponto_leitura for all to app_api
  using (tem_papel(evento_id, array['admin', 'operacao'])) with check (tem_papel(evento_id, array['admin', 'operacao']));

-- credencial: a pessoa vê a sua; a equipe de portão vê as do evento.
-- Emitir à mão e revogar é de admin e operação; a de congressista nasce do ingresso.
create policy credencial_propria on credencial for select to app_api using (pessoa_id = app_pessoa_id());
create policy credencial_equipe on credencial for select to app_api
  using (tem_papel(evento_id, array['admin', 'credenciamento', 'operacao']));
create policy credencial_emitir on credencial for insert to app_api
  with check (emitida_por = app_pessoa_id() and ingresso_id is null and revogada_em is null
              and tem_papel(evento_id, array['admin', 'operacao']));
create policy credencial_revogar on credencial for update to app_api
  using (tem_papel(evento_id, array['admin', 'operacao']))
  with check (tem_papel(evento_id, array['admin', 'operacao']));

create policy credencial_excecao_ler on credencial_excecao for select to app_api
  using (tem_papel(evento_id, array['admin', 'credenciamento', 'operacao']));
create policy credencial_excecao_gerir on credencial_excecao for all to app_api
  using (tem_papel(evento_id, array['admin', 'operacao']))
  with check (tem_papel(evento_id, array['admin', 'operacao']) and criado_por = app_pessoa_id());

-- checkin: leitura por credencial (sem ingresso) e leitura pela operação.
create policy checkin_equipe_inserir_credencial on checkin for insert to app_api
  with check (equipe_id = app_pessoa_id() and credencial_id is not null
              and tem_papel(evento_id, array['admin', 'credenciamento', 'operacao']));
create policy checkin_operacao_ler on checkin for select to app_api using (tem_papel(evento_id, array['operacao']));
create policy checkin_dono_da_credencial on checkin for select to app_api
  using (exists (select 1 from credencial c where c.id = credencial_id and c.pessoa_id = app_pessoa_id()));

revoke all on local, zona, regra_zona, ponto_leitura, credencial, credencial_excecao from public;
grant select, insert, delete on local to app_api;
grant update (nome, endereco, cidade, uf, acessibilidade) on local to app_api;
grant update (local_id, local, nome, fuso) on evento to app_api;
grant select, insert, delete on zona to app_api;
grant update (nome, descricao, aberta, rota_acessivel, ordem) on zona to app_api;
grant select, insert, update, delete on regra_zona to app_api;
grant select, insert, delete on ponto_leitura to app_api;
grant update (nome, zona_id, tipo, modo, ativo) on ponto_leitura to app_api;
grant select on credencial to app_api;
grant insert (evento_id, pessoa_id, categoria, emitida_por) on credencial to app_api;
grant update (revogada_em, revogada_por, motivo) on credencial to app_api;
grant select, insert, delete on credencial_excecao to app_api;

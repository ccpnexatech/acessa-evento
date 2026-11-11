-- Parceiros, feira e contratos (ADR 0028). O expositor é um cliente que compra
-- espaço e visibilidade: escolhe estande no mapa, monta a marca, pede serviços,
-- assina o contrato e só então recebe credenciais.

-- ---------------------------------------------------------------- parceiros

create table parceiro (
  id              uuid primary key default uuid_v7(),
  organizacao_id  uuid not null references organizacao (id) on delete cascade,
  razao_social    text not null check (length(razao_social) between 2 and 160),
  nome_fantasia   text check (length(nome_fantasia) between 2 and 120),
  cnpj            text check (cnpj ~ '^[0-9]{14}$'),
  criado_em       timestamptz not null default now(),
  unique (organizacao_id, cnpj)
);

-- O parceiro num evento, com a categoria da lista única (expositor, alimentação, segurança...).
create table parceiro_evento (
  id           uuid primary key default uuid_v7(),
  parceiro_id  uuid not null references parceiro (id) on delete cascade,
  evento_id    uuid not null references evento (id) on delete cascade,
  categoria    categoria_pessoa not null default 'expositor'
               check (categoria not in ('congressista', 'palestrante', 'convidado', 'equipe')),
  situacao     text not null default 'convidado' check (situacao in ('convidado', 'ativo', 'encerrado')),
  criado_em    timestamptz not null default now(),
  unique (parceiro_id, evento_id, categoria),
  unique (id, evento_id)
);
create index parceiro_evento_evento on parceiro_evento (evento_id);

create table membro_parceiro (
  parceiro_evento_id  uuid not null,
  evento_id           uuid not null references evento (id) on delete cascade,
  pessoa_id           uuid not null references pessoa (id) on delete cascade,
  -- responsavel escolhe estande, assina e monta a equipe; equipe só trabalha no evento.
  papel               text not null default 'equipe' check (papel in ('responsavel', 'equipe')),
  criado_em           timestamptz not null default now(),
  primary key (parceiro_evento_id, pessoa_id),
  foreign key (parceiro_evento_id, evento_id) references parceiro_evento (id, evento_id) on delete cascade
);
create index membro_parceiro_pessoa on membro_parceiro (pessoa_id);

-- Portal do parceiro: toda política do lado de fora da organização passa por aqui.
create or replace function e_do_parceiro(alvo uuid, papeis text[] default array['responsavel', 'equipe']) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from membro_parceiro m
    where m.parceiro_evento_id = alvo and m.pessoa_id = app_pessoa_id() and m.papel = any (papeis))
$$;

-- Quem cuida de parceiros na organização: quem a gere, ou o comercial de algum evento dela.
create or replace function comercial_da_organizacao(org uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select gere_organizacao(org) or exists (
    select 1 from evento e join membro_organizacao m on m.evento_id = e.id
    where e.organizacao_id = org and m.pessoa_id = app_pessoa_id() and m.papel = 'comercial')
$$;

create or replace function ve_parceiro(alvo uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from parceiro_evento pe
    where pe.parceiro_id = alvo
      and (e_do_parceiro(pe.id) or tem_papel(pe.evento_id, array['admin', 'comercial', 'financeiro', 'operacao'])))
$$;

revoke all on function e_do_parceiro(uuid, text[]), comercial_da_organizacao(uuid), ve_parceiro(uuid) from public;
grant execute on function e_do_parceiro(uuid, text[]), comercial_da_organizacao(uuid), ve_parceiro(uuid) to app_api;

-- O parceiro tem de ser da mesma organização do evento.
create or replace function parceiro_evento_conferir() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from parceiro p join evento e on e.organizacao_id = p.organizacao_id
                 where p.id = new.parceiro_id and e.id = new.evento_id) then
    raise exception 'o parceiro não pertence à organização deste evento' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger parceiro_evento_conferir before insert on parceiro_evento
  for each row execute function parceiro_evento_conferir();

-- Credencial emitida para a equipe de um parceiro lembra de qual.
alter table credencial add column parceiro_evento_id uuid references parceiro_evento (id) on delete set null;
create index credencial_parceiro on credencial (parceiro_evento_id) where parceiro_evento_id is not null;

-- Convite também serve para o portal do parceiro.
alter table convite add column parceiro_evento_id uuid references parceiro_evento (id) on delete cascade;
alter table convite drop constraint convite_check;
alter table convite add constraint convite_check check (case
  when parceiro_evento_id is not null then evento_id is not null and papeis <@ array['responsavel', 'equipe']::text[]
  when evento_id is null then papeis <@ array['dono', 'admin']::text[]
  else papeis <@ papeis_de_evento() end);

create or replace function convite_conferir_evento() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.evento_id is not null and not exists (
       select 1 from evento e where e.id = new.evento_id and e.organizacao_id = new.organizacao_id) then
    raise exception 'o evento não pertence a esta organização' using errcode = '23514';
  end if;
  if new.parceiro_evento_id is not null and not exists (
       select 1 from parceiro_evento pe where pe.id = new.parceiro_evento_id and pe.evento_id = new.evento_id) then
    raise exception 'o parceiro não pertence a este evento' using errcode = '23514';
  end if;
  return new;
end $$;

-- Comercial convida o responsável; o responsável convida a própria equipe.
drop policy convite_ler on convite;
drop policy convite_criar on convite;
drop policy convite_revogar on convite;
create or replace function gere_convite(org uuid, evento uuid, parceiro_evento uuid, papeis text[]) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when parceiro_evento is not null then tem_papel(evento, array['admin', 'comercial'])
      or (e_do_parceiro(parceiro_evento, array['responsavel']) and papeis = array['equipe']::text[])
    when evento is null then tem_papel_org(org, array['dono'])
    else tem_papel(evento, array['admin']) end
$$;
revoke all on function gere_convite(uuid, uuid, uuid, text[]) from public;
grant execute on function gere_convite(uuid, uuid, uuid, text[]) to app_api;
create policy convite_ler on convite for select to app_api
  using (gere_convite(organizacao_id, evento_id, parceiro_evento_id, papeis)
         or (evento_id is null and tem_papel_org(organizacao_id, array['admin'])));
create policy convite_criar on convite for insert to app_api
  with check (criado_por = app_pessoa_id() and gere_convite(organizacao_id, evento_id, parceiro_evento_id, papeis));
create policy convite_revogar on convite for update to app_api
  using (gere_convite(organizacao_id, evento_id, parceiro_evento_id, papeis)) with check (true);
grant insert (parceiro_evento_id) on convite to app_api;

drop function meus_convites();
create function meus_convites()
returns table (id uuid, organizacao text, evento text, papeis text[], expira_em timestamptz, parceiro text)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.id, o.nome, e.nome, c.papeis, c.expira_em, coalesce(pa.nome_fantasia, pa.razao_social)
  from convite c
  join pessoa p on p.id = app_pessoa_id() and p.email_hash = c.email_hash
  join organizacao o on o.id = c.organizacao_id
  left join evento e on e.id = c.evento_id
  left join parceiro_evento pe on pe.id = c.parceiro_evento_id
  left join parceiro pa on pa.id = pe.parceiro_id
  where c.aceito_em is null and c.revogado_em is null and c.expira_em > now()
  order by c.criado_em
$$;
revoke all on function meus_convites() from public;
grant execute on function meus_convites() to app_api;

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
  if c.parceiro_evento_id is not null then
    -- Quem já é da equipe e recebe convite de responsável sobe de papel.
    insert into membro_parceiro (parceiro_evento_id, evento_id, pessoa_id, papel)
      values (c.parceiro_evento_id, c.evento_id, app_pessoa_id(),
              case when 'responsavel' = any (c.papeis) then 'responsavel' else 'equipe' end)
      on conflict (parceiro_evento_id, pessoa_id) do update
        set papel = case when excluded.papel = 'responsavel' then 'responsavel' else membro_parceiro.papel end;
  elsif c.evento_id is null then
    insert into organizacao_membro (organizacao_id, pessoa_id, papel)
      select c.organizacao_id, app_pessoa_id(), unnest(c.papeis) on conflict do nothing;
  else
    insert into membro_organizacao (evento_id, pessoa_id, papel)
      select c.evento_id, app_pessoa_id(), unnest(c.papeis) on conflict do nothing;
  end if;
  update convite set aceito_em = now(), aceito_por = app_pessoa_id() where id = c.id;
  return true;
end $$;

-- -------------------------------------------------------------------- feira

-- Uma credencial de expositor a cada N m² de estande vendido.
alter table evento add column feira_m2_por_credencial smallint not null default 3 check (feira_m2_por_credencial > 0);
grant update (feira_m2_por_credencial) on evento to app_api;

create table segmento (
  id         uuid primary key default uuid_v7(),
  evento_id  uuid not null references evento (id) on delete cascade,
  nome       text not null check (length(nome) between 2 and 60),
  unique (evento_id, nome),
  unique (id, evento_id)
);

-- Planta: a grade onde os estandes são desenhados. Uma por zona de exposição.
create table planta (
  id          uuid primary key default uuid_v7(),
  evento_id   uuid not null references evento (id) on delete cascade,
  zona_id     uuid,
  nome        text not null check (length(nome) between 2 and 80),
  colunas     smallint not null check (colunas between 1 and 60),
  linhas      smallint not null check (linhas between 1 and 60),
  imagem_url  text check (imagem_url ~ '^https://'),
  unique (evento_id, nome),
  unique (id, evento_id),
  foreign key (zona_id, evento_id) references zona (id, evento_id) on delete set null (zona_id)
);

create table tipo_estande (
  id              uuid primary key default uuid_v7(),
  evento_id       uuid not null references evento (id) on delete cascade,
  nome            text not null check (length(nome) between 2 and 60),
  largura_m       numeric(5, 2) not null check (largura_m > 0),
  profundidade_m  numeric(5, 2) not null check (profundidade_m > 0),
  preco_centavos  integer not null check (preco_centavos >= 0),
  unique (evento_id, nome),
  unique (id, evento_id)
);

create table estande (
  id                  uuid primary key default uuid_v7(),
  evento_id           uuid not null references evento (id) on delete cascade,
  planta_id           uuid not null,
  tipo_estande_id     uuid not null,
  codigo              text not null check (codigo ~ '^[A-Z0-9-]{1,8}$'),
  coluna              smallint not null check (coluna >= 1),
  linha               smallint not null check (linha >= 1),
  situacao            text not null default 'livre' check (situacao in ('livre', 'reservado', 'vendido')),
  -- Reserva vale 48 horas; sem contrato assinado, o estande volta a ficar livre.
  reservado_ate       timestamptz,
  parceiro_evento_id  uuid,
  -- Preço na hora da reserva: mudar a tabela depois não muda o que foi combinado.
  valor_centavos      integer check (valor_centavos >= 0),
  unique (planta_id, codigo),
  unique (planta_id, coluna, linha),
  foreign key (planta_id, evento_id) references planta (id, evento_id) on delete cascade,
  foreign key (tipo_estande_id, evento_id) references tipo_estande (id, evento_id),
  foreign key (parceiro_evento_id, evento_id) references parceiro_evento (id, evento_id),
  check ((situacao = 'livre') = (parceiro_evento_id is null)),
  check ((situacao = 'livre') = (valor_centavos is null)),
  check ((situacao = 'reservado') = (reservado_ate is not null))
);
create index estande_parceiro on estande (parceiro_evento_id) where parceiro_evento_id is not null;

-- Nível do expositor: definido pelo investimento em estandes, nunca digitado.
create table nivel_expositor (
  id          uuid primary key default uuid_v7(),
  evento_id   uuid not null references evento (id) on delete cascade,
  nome        text not null check (length(nome) between 2 and 40),
  investimento_minimo_centavos integer not null check (investimento_minimo_centavos >= 0),
  beneficios  text[] not null default '{}',
  unique (evento_id, nome),
  unique (evento_id, investimento_minimo_centavos)
);

-- A marca do expositor dentro do app.
create table perfil_expositor (
  parceiro_evento_id  uuid primary key,
  evento_id           uuid not null references evento (id) on delete cascade,
  nome_exibicao       text not null check (length(nome_exibicao) between 2 and 80),
  logo_url            text check (logo_url ~ '^https://'),
  -- O que o leitor de tela fala no lugar do logo. Sem descrição, não tem logo.
  logo_descricao      text check (length(logo_descricao) between 3 and 160),
  segmento_id         uuid,
  frase               text check (length(frase) <= 140),
  destaques           text[] not null default '{}' check (cardinality(destaques) <= 5),
  site                text check (site ~ '^https://'),
  contato             text check (length(contato) <= 120),
  publicado           boolean not null default false,
  foreign key (parceiro_evento_id, evento_id) references parceiro_evento (id, evento_id) on delete cascade,
  foreign key (segmento_id, evento_id) references segmento (id, evento_id) on delete set null (segmento_id),
  check (logo_url is null or logo_descricao is not null)
);

-- Catálogo de serviços da feira (energia por kVA, internet, limpeza, mobiliário...).
create table servico_feira (
  id              uuid primary key default uuid_v7(),
  evento_id       uuid not null references evento (id) on delete cascade,
  nome            text not null check (length(nome) between 2 and 80),
  descricao       text check (length(descricao) <= 500),
  unidade         text not null default 'unidade' check (length(unidade) between 1 and 20),
  preco_centavos  integer not null check (preco_centavos >= 0),
  obrigatorio     boolean not null default false,
  prazo           date,
  ativo           boolean not null default true,
  unique (evento_id, nome),
  unique (id, evento_id)
);

create table pedido_servico (
  id                  uuid primary key default uuid_v7(),
  evento_id           uuid not null references evento (id) on delete cascade,
  parceiro_evento_id  uuid not null,
  servico_feira_id    uuid not null,
  quantidade          integer not null check (quantidade between 1 and 999),
  valor_centavos      integer not null check (valor_centavos >= 0),
  situacao            text not null default 'pedido' check (situacao in ('pedido', 'confirmado', 'cancelado')),
  criado_em           timestamptz not null default now(),
  unique (parceiro_evento_id, servico_feira_id),
  foreign key (parceiro_evento_id, evento_id) references parceiro_evento (id, evento_id) on delete cascade,
  foreign key (servico_feira_id, evento_id) references servico_feira (id, evento_id)
);

-- O valor é sempre preço × quantidade; confirmar é da organização; o prazo vale para o parceiro.
create or replace function pedido_servico_conferir() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare s servico_feira; organiza boolean := tem_papel(new.evento_id, array['admin', 'comercial', 'operacao']);
begin
  select * into s from servico_feira where id = new.servico_feira_id;
  if tg_op = 'INSERT' and not organiza and (not s.ativo or s.prazo < current_date) then
    raise exception 'serviço fora do prazo' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.situacao is distinct from old.situacao and new.situacao <> 'cancelado' and not organiza then
    raise exception 'só a organização confirma o pedido' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.situacao <> 'pedido' and new.quantidade <> old.quantidade and not organiza then
    raise exception 'pedido já confirmado ou cancelado' using errcode = '42501';
  end if;
  new.valor_centavos := s.preco_centavos * new.quantidade;
  return new;
end $$;
create trigger pedido_servico_conferir before insert or update on pedido_servico
  for each row execute function pedido_servico_conferir();

-- Montagem: básica (da feira), montadora própria ou estande diferente. As duas
-- últimas pedem projeto, ART ou RRT e termo de responsabilidade antes de aprovar.
create table montagem (
  parceiro_evento_id  uuid primary key,
  evento_id           uuid not null references evento (id) on delete cascade,
  tipo                text not null default 'basica' check (tipo in ('basica', 'montadora_propria', 'estande_diferente')),
  montadora           text check (length(montadora) <= 120),
  projeto_url         text check (projeto_url ~ '^https://'),
  art_rrt             text check (length(art_rrt) <= 40),
  termo_aceito_em     timestamptz,
  situacao            text not null default 'pendente' check (situacao in ('pendente', 'em_analise', 'aprovada', 'recusada')),
  observacao          text check (length(observacao) <= 500),
  analisada_por       uuid references pessoa (id) on delete set null,
  analisada_em        timestamptz,
  foreign key (parceiro_evento_id, evento_id) references parceiro_evento (id, evento_id) on delete cascade,
  check (situacao <> 'aprovada' or tipo = 'basica'
         or (projeto_url is not null and art_rrt is not null and termo_aceito_em is not null))
);

-- Mexeu no que foi enviado, volta para análise. Montagem básica não tem o que analisar.
create or replace function montagem_situacao() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare mudou boolean := tg_op = 'INSERT';
begin
  if not mudou then
    mudou := (new.tipo, new.montadora, new.projeto_url, new.art_rrt, new.termo_aceito_em)
             is distinct from (old.tipo, old.montadora, old.projeto_url, old.art_rrt, old.termo_aceito_em);
  end if;
  if mudou then
    new.analisada_por := null;
    new.analisada_em := null;
    new.situacao := case
      when new.tipo = 'basica' then 'aprovada'
      when new.projeto_url is not null and new.art_rrt is not null and new.termo_aceito_em is not null then 'em_analise'
      else 'pendente' end;
  end if;
  return new;
end $$;
create trigger montagem_situacao before insert or update on montagem
  for each row execute function montagem_situacao();

create or replace function analisar_montagem(alvo uuid, aprovar boolean, nota text default null) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update montagem set situacao = case when aprovar then 'aprovada' else 'recusada' end,
                      observacao = nota, analisada_por = app_pessoa_id(), analisada_em = now()
    where parceiro_evento_id = alvo and situacao = 'em_analise'
      and tem_papel(evento_id, array['admin', 'comercial', 'operacao']);
  return found;
end $$;

-- Reserva atômica: dois expositores no mesmo estande, só um leva.
create or replace function reservar_estande(estande_alvo uuid, parceiro_evento_alvo uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare pe parceiro_evento;
begin
  select * into pe from parceiro_evento where id = parceiro_evento_alvo and categoria = 'expositor';
  if not found or not (e_do_parceiro(pe.id, array['responsavel']) or tem_papel(pe.evento_id, array['admin', 'comercial'])) then
    raise exception 'sem permissão para reservar' using errcode = '42501';
  end if;
  update estande e
    set situacao = 'reservado', parceiro_evento_id = pe.id, reservado_ate = now() + interval '48 hours',
        valor_centavos = (select t.preco_centavos from tipo_estande t where t.id = e.tipo_estande_id)
    where e.id = estande_alvo and e.evento_id = pe.evento_id
      and (e.situacao = 'livre' or (e.situacao = 'reservado' and e.reservado_ate < now()));
  return found;
end $$;

-- O responsável desiste da própria reserva; a organização libera qualquer estande.
create or replace function liberar_estande(estande_alvo uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update estande e set situacao = 'livre', parceiro_evento_id = null, reservado_ate = null, valor_centavos = null
    where e.id = estande_alvo and e.situacao <> 'livre'
      and (tem_papel(e.evento_id, array['admin', 'comercial'])
           or (e.situacao = 'reservado' and e_do_parceiro(e.parceiro_evento_id, array['responsavel'])));
  return found;
end $$;

-- Chamado pelo agendador: reserva vencida volta a ficar livre.
create or replace function liberar_reservas_vencidas() returns integer
language sql security definer set search_path = public, pg_temp as $$
  with soltos as (
    update estande set situacao = 'livre', parceiro_evento_id = null, reservado_ate = null, valor_centavos = null
    where situacao = 'reservado' and reservado_ate < now() returning 1)
  select count(*)::integer from soltos
$$;

-- Resumo do expositor: só estande vendido conta. Serviços não entram no nível.
create or replace function resumo_do_expositor(alvo uuid)
returns table (estandes integer, area_m2 numeric, investimento_centavos integer, nivel text, credenciais_direito integer)
language sql stable security definer set search_path = public, pg_temp as $$
  with s as (
    select pe.evento_id, count(e.id)::integer as estandes,
           coalesce(sum(t.largura_m * t.profundidade_m), 0) as area_m2,
           coalesce(sum(e.valor_centavos), 0)::integer as investimento
    from parceiro_evento pe
    left join estande e on e.parceiro_evento_id = pe.id and e.situacao = 'vendido'
    left join tipo_estande t on t.id = e.tipo_estande_id
    where pe.id = alvo
      and (evento_visivel(pe.evento_id) or e_do_parceiro(pe.id))
    group by pe.evento_id)
  select s.estandes, s.area_m2, s.investimento,
         (select n.nome from nivel_expositor n
          where n.evento_id = s.evento_id and n.investimento_minimo_centavos <= s.investimento and s.estandes > 0
          order by n.investimento_minimo_centavos desc limit 1),
         ceil(s.area_m2 / (select ev.feira_m2_por_credencial from evento ev where ev.id = s.evento_id))::integer
  from s
$$;

-- Lista pública de expositores. Ordem alfabética: nível é rótulo, não fura fila.
create or replace function expositores_publicos(evento uuid)
returns table (parceiro_evento_id uuid, nome_exibicao text, logo_url text, logo_descricao text, segmento text,
               frase text, destaques text[], site text, nivel text, estandes text[])
language sql stable security definer set search_path = public, pg_temp as $$
  select pf.parceiro_evento_id, pf.nome_exibicao, pf.logo_url, pf.logo_descricao, sg.nome, pf.frase, pf.destaques, pf.site,
         (select r.nivel from resumo_do_expositor(pf.parceiro_evento_id) r),
         coalesce((select array_agg(e.codigo order by e.codigo) from estande e
                   where e.parceiro_evento_id = pf.parceiro_evento_id and e.situacao = 'vendido'), '{}')
  from perfil_expositor pf
  left join segmento sg on sg.id = pf.segmento_id
  where pf.evento_id = evento and pf.publicado and evento_visivel(evento)
  order by pf.nome_exibicao
$$;

-- ---------------------------------------------------------------- contratos

create table modelo_contrato (
  id              uuid primary key default uuid_v7(),
  organizacao_id  uuid not null references organizacao (id) on delete cascade,
  nome            text not null check (length(nome) between 2 and 80),
  corpo           text not null check (length(corpo) between 20 and 50000),
  criado_em       timestamptz not null default now(),
  unique (organizacao_id, nome)
);

create table contrato (
  id                  uuid primary key default uuid_v7(),
  evento_id           uuid not null references evento (id) on delete cascade,
  -- Contrato é com um parceiro ou com um palestrante, nunca com os dois.
  parceiro_evento_id  uuid,
  palestrante_id      uuid references palestrante (id) on delete cascade,
  modelo_contrato_id  uuid references modelo_contrato (id) on delete set null,
  corpo               text not null check (length(corpo) between 20 and 50000),
  -- SHA-256 do corpo: prova de que o texto assinado é este.
  corpo_hash          bytea not null,
  valor_centavos      integer not null default 0 check (valor_centavos >= 0),
  -- Como se assina: aceite dentro do app, provedor de assinatura ou gov.br conferido à mão (ADR 0028).
  via                 text not null default 'aceite_no_app' check (via in ('aceite_no_app', 'provedor', 'govbr_manual')),
  situacao            text not null default 'rascunho' check (situacao in ('rascunho', 'enviado', 'assinado', 'cancelado')),
  criado_por          uuid references pessoa (id) on delete set null,
  criado_em           timestamptz not null default now(),
  enviado_em          timestamptz,
  assinado_em         timestamptz,
  assinado_por        uuid references pessoa (id) on delete set null,
  -- Identificador no provedor ou protocolo da assinatura gov.br.
  referencia_externa  text check (length(referencia_externa) <= 200),
  foreign key (parceiro_evento_id, evento_id) references parceiro_evento (id, evento_id) on delete cascade,
  check ((parceiro_evento_id is null) <> (palestrante_id is null)),
  check ((situacao = 'assinado') = (assinado_em is not null))
);
create index contrato_evento on contrato (evento_id, situacao);
create index contrato_parceiro on contrato (parceiro_evento_id) where parceiro_evento_id is not null;

-- Depois de enviado, o texto não muda: quem assina, assina o que leu.
create or replace function contrato_selar() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and old.situacao <> 'rascunho'
     and (new.corpo, new.valor_centavos, new.via) is distinct from (old.corpo, old.valor_centavos, old.via) then
    raise exception 'contrato enviado não pode ser alterado' using errcode = '23514';
  end if;
  new.corpo_hash := sha256(convert_to(new.corpo, 'UTF8'));
  return new;
end $$;
create trigger contrato_selar before insert or update on contrato
  for each row execute function contrato_selar();

create or replace function enviar_contrato(alvo uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update contrato set situacao = 'enviado', enviado_em = now()
    where id = alvo and situacao = 'rascunho' and tem_papel(evento_id, array['admin', 'comercial', 'financeiro']);
  return found;
end $$;

create or replace function cancelar_contrato(alvo uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update contrato set situacao = 'cancelado'
    where id = alvo and situacao in ('rascunho', 'enviado') and tem_papel(evento_id, array['admin', 'comercial', 'financeiro']);
  return found;
end $$;

-- Assinar: o responsável (ou o palestrante) aceita no app; assinatura por provedor
-- ou gov.br é registrada pela organização com a referência. Ao assinar, os
-- estandes reservados do parceiro viram vendidos e o parceiro fica ativo.
create or replace function assinar_contrato(alvo uuid, referencia text default null) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare c contrato; contratado boolean; organiza boolean;
begin
  select * into c from contrato where id = alvo and situacao = 'enviado' for update;
  if not found then
    return false;
  end if;
  contratado := (c.parceiro_evento_id is not null and e_do_parceiro(c.parceiro_evento_id, array['responsavel']))
             or exists (select 1 from palestrante p where p.id = c.palestrante_id and p.pessoa_id = app_pessoa_id());
  organiza := tem_papel(c.evento_id, array['admin', 'comercial', 'financeiro']);
  if not ((c.via = 'aceite_no_app' and contratado)
          or (c.via <> 'aceite_no_app' and organiza and coalesce(length(trim(referencia)), 0) > 0)) then
    raise exception 'sem permissão para assinar este contrato' using errcode = '42501';
  end if;
  update contrato set situacao = 'assinado', assinado_em = now(), assinado_por = app_pessoa_id(),
                      referencia_externa = referencia
    where id = c.id;
  if c.parceiro_evento_id is not null then
    update estande set situacao = 'vendido', reservado_ate = null
      where parceiro_evento_id = c.parceiro_evento_id and situacao = 'reservado';
    update parceiro_evento set situacao = 'ativo' where id = c.parceiro_evento_id and situacao = 'convidado';
  end if;
  return true;
end $$;

-- Credencial da equipe do parceiro: só com contrato assinado e, para expositor,
-- dentro do limite por metragem.
create or replace function emitir_credencial_parceiro(parceiro_evento_alvo uuid, pessoa uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare pe parceiro_evento; direito integer; usadas integer; nova uuid;
begin
  select * into pe from parceiro_evento where id = parceiro_evento_alvo;
  if not found or not (e_do_parceiro(pe.id, array['responsavel']) or tem_papel(pe.evento_id, array['admin', 'comercial', 'operacao'])) then
    raise exception 'sem permissão para emitir credencial' using errcode = '42501';
  end if;
  if not exists (select 1 from contrato c where c.parceiro_evento_id = pe.id and c.situacao = 'assinado') then
    raise exception 'contrato ainda não assinado' using errcode = '23514';
  end if;
  if not exists (select 1 from membro_parceiro m where m.parceiro_evento_id = pe.id and m.pessoa_id = pessoa) then
    raise exception 'a pessoa não é da equipe deste parceiro' using errcode = '23514';
  end if;
  if pe.categoria = 'expositor' then
    select r.credenciais_direito into direito from resumo_do_expositor(pe.id) r;
    select count(*) into usadas from credencial c where c.parceiro_evento_id = pe.id and c.revogada_em is null;
    if usadas >= coalesce(direito, 0) then
      raise exception 'limite de credenciais atingido' using errcode = '23514';
    end if;
  end if;
  insert into credencial (evento_id, pessoa_id, categoria, emitida_por, parceiro_evento_id)
    values (pe.evento_id, pessoa, pe.categoria, app_pessoa_id(), pe.id) returning id into nova;
  return nova;
end $$;

revoke all on function analisar_montagem(uuid, boolean, text), reservar_estande(uuid, uuid), liberar_estande(uuid),
  liberar_reservas_vencidas(), resumo_do_expositor(uuid), expositores_publicos(uuid), enviar_contrato(uuid),
  cancelar_contrato(uuid), assinar_contrato(uuid, text), emitir_credencial_parceiro(uuid, uuid) from public;
grant execute on function analisar_montagem(uuid, boolean, text), reservar_estande(uuid, uuid), liberar_estande(uuid),
  liberar_reservas_vencidas(), resumo_do_expositor(uuid), expositores_publicos(uuid), enviar_contrato(uuid),
  cancelar_contrato(uuid), assinar_contrato(uuid, text), emitir_credencial_parceiro(uuid, uuid) to app_api;

-- ---------------------------------------------------------------------- RLS

alter table parceiro enable row level security;
alter table parceiro_evento enable row level security;
alter table membro_parceiro enable row level security;
alter table segmento enable row level security;
alter table planta enable row level security;
alter table tipo_estande enable row level security;
alter table estande enable row level security;
alter table nivel_expositor enable row level security;
alter table perfil_expositor enable row level security;
alter table servico_feira enable row level security;
alter table pedido_servico enable row level security;
alter table montagem enable row level security;
alter table modelo_contrato enable row level security;
alter table contrato enable row level security;

create policy parceiro_ler on parceiro for select to app_api
  using (comercial_da_organizacao(organizacao_id) or ve_parceiro(id));
create policy parceiro_gerir on parceiro for all to app_api
  using (comercial_da_organizacao(organizacao_id)) with check (comercial_da_organizacao(organizacao_id));

create policy parceiro_evento_ler on parceiro_evento for select to app_api
  using (tem_papel(evento_id, array['admin', 'comercial', 'financeiro', 'operacao', 'credenciamento']) or e_do_parceiro(id));
create policy parceiro_evento_gerir on parceiro_evento for all to app_api
  using (tem_papel(evento_id, array['admin', 'comercial'])) with check (tem_papel(evento_id, array['admin', 'comercial']));

create policy membro_parceiro_ler on membro_parceiro for select to app_api
  using (tem_papel(evento_id, array['admin', 'comercial', 'operacao', 'credenciamento']) or e_do_parceiro(parceiro_evento_id));
create policy membro_parceiro_gerir on membro_parceiro for all to app_api
  using (tem_papel(evento_id, array['admin', 'comercial']) or e_do_parceiro(parceiro_evento_id, array['responsavel']))
  with check (tem_papel(evento_id, array['admin', 'comercial'])
              or (e_do_parceiro(parceiro_evento_id, array['responsavel']) and papel = 'equipe'));

-- O desenho da feira é público junto com o evento; montar é de admin e comercial.
create policy segmento_ler on segmento for select to app_api using (evento_visivel(evento_id));
create policy planta_ler on planta for select to app_api using (evento_visivel(evento_id));
create policy tipo_estande_ler on tipo_estande for select to app_api using (evento_visivel(evento_id));
create policy estande_ler on estande for select to app_api using (evento_visivel(evento_id));
create policy nivel_expositor_ler on nivel_expositor for select to app_api using (evento_visivel(evento_id));
create policy servico_feira_ler on servico_feira for select to app_api using (evento_visivel(evento_id));
create policy segmento_gerir on segmento for all to app_api
  using (tem_papel(evento_id, array['admin', 'comercial'])) with check (tem_papel(evento_id, array['admin', 'comercial']));
create policy planta_gerir on planta for all to app_api
  using (tem_papel(evento_id, array['admin', 'comercial'])) with check (tem_papel(evento_id, array['admin', 'comercial']));
create policy tipo_estande_gerir on tipo_estande for all to app_api
  using (tem_papel(evento_id, array['admin', 'comercial'])) with check (tem_papel(evento_id, array['admin', 'comercial']));
create policy nivel_expositor_gerir on nivel_expositor for all to app_api
  using (tem_papel(evento_id, array['admin', 'comercial'])) with check (tem_papel(evento_id, array['admin', 'comercial']));
create policy servico_feira_gerir on servico_feira for all to app_api
  using (tem_papel(evento_id, array['admin', 'comercial'])) with check (tem_papel(evento_id, array['admin', 'comercial']));
-- Estande: a organização desenha; ocupar é só pelas funções. Estande ocupado não se apaga nem se redesenha.
create policy estande_criar on estande for insert to app_api
  with check (tem_papel(evento_id, array['admin', 'comercial']) and situacao = 'livre');
create policy estande_redesenhar on estande for update to app_api
  using (tem_papel(evento_id, array['admin', 'comercial']) and situacao = 'livre')
  with check (tem_papel(evento_id, array['admin', 'comercial']));
create policy estande_apagar on estande for delete to app_api
  using (tem_papel(evento_id, array['admin', 'comercial']) and situacao = 'livre');

create policy perfil_expositor_ler on perfil_expositor for select to app_api
  using ((publicado and evento_visivel(evento_id)) or e_do_parceiro(parceiro_evento_id)
         or tem_papel(evento_id, array['admin', 'comercial', 'comunicacao']));
create policy perfil_expositor_gerir on perfil_expositor for all to app_api
  using (e_do_parceiro(parceiro_evento_id, array['responsavel']) or tem_papel(evento_id, array['admin', 'comercial']))
  with check (e_do_parceiro(parceiro_evento_id, array['responsavel']) or tem_papel(evento_id, array['admin', 'comercial']));

create policy pedido_servico_ler on pedido_servico for select to app_api
  using (e_do_parceiro(parceiro_evento_id) or tem_papel(evento_id, array['admin', 'comercial', 'operacao', 'financeiro']));
create policy pedido_servico_gerir on pedido_servico for all to app_api
  using (e_do_parceiro(parceiro_evento_id, array['responsavel']) or tem_papel(evento_id, array['admin', 'comercial', 'operacao']))
  with check (e_do_parceiro(parceiro_evento_id, array['responsavel']) or tem_papel(evento_id, array['admin', 'comercial', 'operacao']));

create policy montagem_ler on montagem for select to app_api
  using (e_do_parceiro(parceiro_evento_id) or tem_papel(evento_id, array['admin', 'comercial', 'operacao']));
create policy montagem_gerir on montagem for all to app_api
  using (e_do_parceiro(parceiro_evento_id, array['responsavel']) or tem_papel(evento_id, array['admin', 'comercial']))
  with check (e_do_parceiro(parceiro_evento_id, array['responsavel']) or tem_papel(evento_id, array['admin', 'comercial']));

create policy modelo_contrato_gerir on modelo_contrato for all to app_api
  using (comercial_da_organizacao(organizacao_id)) with check (comercial_da_organizacao(organizacao_id));

-- Contrato: a organização vê todos os do evento; o contratado só vê o seu, e só depois de enviado.
create policy contrato_organizacao on contrato for select to app_api
  using (tem_papel(evento_id, array['admin', 'comercial', 'financeiro']));
create policy contrato_contratado on contrato for select to app_api
  using (situacao <> 'rascunho' and (
    (parceiro_evento_id is not null and e_do_parceiro(parceiro_evento_id, array['responsavel']))
    or exists (select 1 from palestrante p where p.id = palestrante_id and p.pessoa_id = app_pessoa_id())));
create policy contrato_redigir on contrato for insert to app_api
  with check (tem_papel(evento_id, array['admin', 'comercial', 'financeiro']) and criado_por = app_pessoa_id()
              and (palestrante_id is null or exists (
                select 1 from palestrante p where p.id = palestrante_id and p.evento_id = contrato.evento_id)));
create policy contrato_editar on contrato for update to app_api
  using (tem_papel(evento_id, array['admin', 'comercial', 'financeiro']))
  with check (tem_papel(evento_id, array['admin', 'comercial', 'financeiro']));
create policy contrato_apagar on contrato for delete to app_api
  using (tem_papel(evento_id, array['admin', 'comercial', 'financeiro']) and situacao = 'rascunho');

revoke all on parceiro, parceiro_evento, membro_parceiro, segmento, planta, tipo_estande, estande, nivel_expositor,
  perfil_expositor, servico_feira, pedido_servico, montagem, modelo_contrato, contrato from public;
grant select, insert, delete on parceiro, parceiro_evento, membro_parceiro, segmento, planta, tipo_estande,
  nivel_expositor, servico_feira, modelo_contrato to app_api;
grant update (razao_social, nome_fantasia, cnpj) on parceiro to app_api;
grant update (situacao) on parceiro_evento to app_api;
grant update (papel) on membro_parceiro to app_api;
grant update (nome) on segmento to app_api;
grant update (nome, zona_id, colunas, linhas, imagem_url) on planta to app_api;
grant update (nome, largura_m, profundidade_m, preco_centavos) on tipo_estande to app_api;
grant update (nome, investimento_minimo_centavos, beneficios) on nivel_expositor to app_api;
grant update (nome, descricao, unidade, preco_centavos, obrigatorio, prazo, ativo) on servico_feira to app_api;
grant update (nome, corpo) on modelo_contrato to app_api;
grant select, delete on estande to app_api;
grant insert (evento_id, planta_id, tipo_estande_id, codigo, coluna, linha) on estande to app_api;
grant update (tipo_estande_id, codigo, coluna, linha) on estande to app_api;
grant select, insert, update, delete on perfil_expositor to app_api;
grant select, delete on pedido_servico to app_api;
grant insert (evento_id, parceiro_evento_id, servico_feira_id, quantidade) on pedido_servico to app_api;
grant update (quantidade, situacao) on pedido_servico to app_api;
grant select, delete on montagem to app_api;
grant insert (parceiro_evento_id, evento_id, tipo, montadora, projeto_url, art_rrt, termo_aceito_em) on montagem to app_api;
grant update (tipo, montadora, projeto_url, art_rrt, termo_aceito_em) on montagem to app_api;
grant select, delete on contrato to app_api;
grant insert (evento_id, parceiro_evento_id, palestrante_id, modelo_contrato_id, corpo, valor_centavos, via, criado_por) on contrato to app_api;
grant update (corpo, valor_centavos, via) on contrato to app_api;

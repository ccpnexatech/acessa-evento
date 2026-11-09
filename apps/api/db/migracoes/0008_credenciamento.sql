-- Credenciamento (feature 04): check-ins feitos offline pela equipe.
-- O id vem do aparelho, então reenviar a fila nunca duplica. Não guardamos
-- "válido" ou "repetido": é calculado pela ordem de horário (o primeiro vale),
-- assim dois portões offline chegam ao mesmo resultado em qualquer ordem de envio.

create table checkin (
  id               uuid primary key,
  ingresso_id      uuid not null references ingresso (id) on delete cascade,
  evento_id        uuid not null references evento (id) on delete cascade,
  equipe_id        uuid references pessoa (id) on delete set null,
  portao           text not null check (length(portao) between 1 and 40),
  metodo           text not null check (metodo in ('qr', 'manual')),
  -- Hora do aparelho no momento da leitura; recebido_em é a hora do servidor.
  feito_em         timestamptz not null,
  recebido_em      timestamptz not null default now()
);
create index checkin_ingresso on checkin (ingresso_id, feito_em, id);
create index checkin_evento on checkin (evento_id, feito_em);

alter table checkin enable row level security;

create policy checkin_equipe_inserir on checkin for insert to app_api
  with check (equipe_id = app_pessoa_id() and tem_papel(evento_id, array['admin', 'credenciamento'])
              and exists (select 1 from ingresso i where i.id = ingresso_id and i.evento_id = checkin.evento_id));
create policy checkin_equipe_ler on checkin for select to app_api using (tem_papel(evento_id, array['admin', 'credenciamento']));
create policy checkin_participante on checkin for select to app_api
  using (exists (select 1 from ingresso i where i.id = ingresso_id and i.pessoa_id = app_pessoa_id()));

revoke all on checkin from public;
grant select, insert on checkin to app_api;

-- Primeiro check-in de cada ingresso, pela ordem de horário (o que "vale").
create view checkin_primeiro with (security_invoker = true) as
  select distinct on (ingresso_id) ingresso_id, id, portao, feito_em, metodo
  from checkin order by ingresso_id, feito_em, id;
grant select on checkin_primeiro to app_api;

-- Lista do evento para o aparelho da equipe trabalhar sem internet.
-- Lê nomes e pedidos de acessibilidade de outras pessoas, então confere o papel antes.
create or replace function lista_credenciamento(evento uuid)
returns table (ingresso_id uuid, nome text, tipo text, recursos text[], checkin_em timestamptz, checkin_portao text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not tem_papel(evento, array['admin', 'credenciamento']) then
    raise exception 'sem papel de credenciamento' using errcode = '42501';
  end if;
  return query
    select i.id, coalesce(p.nome_cracha, 'Sem nome no crachá'), t.nome, coalesce(a.recursos, '{}'),
           c.feito_em, c.portao
    from ingresso i
    join pessoa p on p.id = i.pessoa_id
    join tipo_ingresso t on t.id = i.tipo_ingresso_id
    left join pedido_acessibilidade a on a.pessoa_id = i.pessoa_id and a.evento_id = i.evento_id
    left join lateral (
      select feito_em, portao from checkin c where c.ingresso_id = i.id order by feito_em, id limit 1
    ) c on true
    where i.evento_id = evento and i.cancelado_em is null
    order by 2;
end;
$$;
revoke all on function lista_credenciamento(uuid) from public;
grant execute on function lista_credenciamento(uuid) to app_api;

-- Relatório da organização: cada check-in com a situação calculada.
create view checkin_relatorio with (security_invoker = true) as
  select c.*, case when row_number() over (partition by c.ingresso_id order by c.feito_em, c.id) = 1
                   then 'valido' else 'repetido' end as situacao
  from checkin c;
grant select on checkin_relatorio to app_api;

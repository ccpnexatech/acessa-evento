-- Apoio à API da área do organizador (ADR 0029): amarra referências ao mesmo
-- evento e entrega, em funções, as leituras que cruzam dados de outras pessoas.

-- Sala e atividade só apontam para zona e sala do próprio evento. As chaves da
-- 0011 e da 0012 aceitavam qualquer zona; os testes pela API mostraram a brecha.
alter table sala add constraint sala_id_evento_id_key unique (id, evento_id);
alter table sala add constraint sala_zona_do_evento
  foreign key (zona_id, evento_id) references zona (id, evento_id) on delete set null (zona_id);
alter table atividade add constraint atividade_zona_do_evento
  foreign key (zona_id, evento_id) references zona (id, evento_id) on delete set null (zona_id);
alter table atividade add constraint atividade_sala_do_evento
  foreign key (sala_id, evento_id) references sala (id, evento_id) on delete set null (sala_id);

-- Local do evento tem de ser da organização do evento.
create or replace function evento_conferir_local() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.local_id is not null and not exists (
       select 1 from local l where l.id = new.local_id and l.organizacao_id = new.organizacao_id) then
    raise exception 'o local não pertence à organização deste evento' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger evento_conferir_local before insert or update of local_id on evento
  for each row execute function evento_conferir_local();

-- Equipe do evento com nome: pessoa só lê a si mesma, então a lista vem por função.
create or replace function equipe_do_evento(evento uuid)
returns table (pessoa_id uuid, nome text, papeis text[], cargo text, exibir_publico boolean, desde timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not e_da_equipe(evento) then
    raise exception 'só a equipe do evento vê a equipe' using errcode = '42501';
  end if;
  return query
    select m.pessoa_id, coalesce(p.nome_cracha, 'Ainda sem nome'), array_agg(m.papel order by m.papel),
           max(m.cargo), bool_or(m.exibir_publico), min(m.criado_em)
    from membro_organizacao m join pessoa p on p.id = m.pessoa_id
    where m.evento_id = evento
    group by m.pessoa_id, p.nome_cracha
    order by 2, 1;
end $$;

-- Mesa organizadora: só quem foi marcado para aparecer, e só de evento visível.
create or replace function mesa_organizadora(evento uuid) returns table (nome text, cargo text)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.nome_cracha, max(m.cargo)
  from membro_organizacao m join pessoa p on p.id = m.pessoa_id
  where m.evento_id = evento and m.exibir_publico and p.nome_cracha is not null and evento_visivel(evento)
  group by m.pessoa_id, p.nome_cracha
  order by 1
$$;

-- Papéis de quem pergunta num evento: é o que decide a visão do app.
create or replace function meus_papeis(evento uuid) returns text[]
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(array_agg(distinct papel order by papel), '{}') from (
    select m.papel from membro_organizacao m where m.evento_id = evento and m.pessoa_id = app_pessoa_id()
    union all
    select om.papel from organizacao_membro om join evento e on e.organizacao_id = om.organizacao_id
      where e.id = evento and om.pessoa_id = app_pessoa_id()
  ) x
$$;

-- Checklist de prontidão: é uma consulta, não uma tabela (decisão 10 do DER).
create or replace function prontidao_do_evento(evento uuid)
returns table (item text, feito boolean, quantidade integer)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not e_da_equipe(evento) then
    raise exception 'só a equipe do evento vê o checklist' using errcode = '42501';
  end if;
  return query
    select x.item, x.quantidade > 0, x.quantidade from (values
      ('local', (select count(*)::int from evento e where e.id = evento and e.local_id is not null)),
      ('acessibilidade', (select count(*)::int from evento e where e.id = evento and cardinality(e.recursos_oferecidos) > 0)),
      ('salas', (select count(*)::int from sala s where s.evento_id = evento)),
      ('programacao', (select count(*)::int from atividade a where a.evento_id = evento)),
      ('ingressos', (select count(*)::int from tipo_ingresso t where t.evento_id = evento)),
      ('equipe', (select count(distinct m.pessoa_id)::int from membro_organizacao m where m.evento_id = evento)),
      ('zonas', (select count(*)::int from zona z where z.evento_id = evento)),
      ('pontos_leitura', (select count(*)::int from ponto_leitura p where p.evento_id = evento and p.ativo)),
      ('publicado', (select count(*)::int from evento e where e.id = evento and e.publicado))
    ) as x (item, quantidade);
end $$;

-- Os números do painel e de "Chegou o dia". Entradas registradas, nunca lotação.
create or replace function numeros_do_evento(evento uuid)
returns table (inscritos integer, credenciais integer, entradas integer, leituras_negadas integer,
               estandes integer, estandes_vendidos integer, contratos_pendentes integer, convites_pendentes integer)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not e_da_equipe(evento) then
    raise exception 'só a equipe do evento vê os números' using errcode = '42501';
  end if;
  return query select
    (select count(*)::int from ingresso i where i.evento_id = evento and i.cancelado_em is null),
    (select count(*)::int from credencial c where c.evento_id = evento and c.revogada_em is null),
    (select count(distinct k.credencial_id)::int from checkin k where k.evento_id = evento and checkin_e_entrada_do_evento(k)),
    (select count(*)::int from checkin k where k.evento_id = evento and k.resultado = 'negado'),
    (select count(*)::int from estande s where s.evento_id = evento),
    (select count(*)::int from estande s where s.evento_id = evento and s.situacao = 'vendido'),
    (select count(*)::int from contrato c where c.evento_id = evento and c.situacao = 'enviado'),
    (select count(*)::int from convite c where c.evento_id = evento and c.aceito_em is null and c.revogado_em is null and c.expira_em > now());
end $$;

-- Conta para alguém que ainda não entrou no app (credencial ou equipe de parceiro
-- emitida pelo e-mail). Mesmo efeito do comando de papel da v1: a pessoa completa
-- o cadastro no primeiro login. Só quem organiza algum evento pode chamar.
create or replace function garantir_pessoa(cifrado bytea, indice bytea) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare achada uuid;
begin
  if not exists (select 1 from membro_organizacao m where m.pessoa_id = app_pessoa_id())
     and not exists (select 1 from organizacao_membro m where m.pessoa_id = app_pessoa_id())
     and not exists (select 1 from membro_parceiro m where m.pessoa_id = app_pessoa_id() and m.papel = 'responsavel') then
    raise exception 'sem permissão para cadastrar pessoas' using errcode = '42501';
  end if;
  insert into pessoa (email_cifrado, email_hash) values (cifrado, indice)
    on conflict (email_hash) do nothing returning id into achada;
  if achada is null then
    select id into achada from pessoa where email_hash = indice;
  end if;
  return achada;
end $$;

revoke all on function equipe_do_evento(uuid), mesa_organizadora(uuid), meus_papeis(uuid), prontidao_do_evento(uuid),
  numeros_do_evento(uuid), garantir_pessoa(bytea, bytea) from public;
grant execute on function equipe_do_evento(uuid), mesa_organizadora(uuid), meus_papeis(uuid), prontidao_do_evento(uuid),
  numeros_do_evento(uuid), garantir_pessoa(bytea, bytea) to app_api;

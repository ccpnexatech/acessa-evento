-- Auditoria só de inserção, com cadeia de hash SHA-256 (ADR 0005).
-- Cada linha guarda o hash da anterior; alterar ou apagar uma linha quebra a cadeia.

create table auditoria (
  id             bigint generated always as identity primary key,
  evento_id      uuid references evento (id),
  ator_id        uuid,
  acao           text not null check (acao ~ '^[a-z_]+(\.[a-z_]+)*$'),
  alvo           text,
  dados          jsonb not null default '{}'::jsonb,
  criado_em      timestamptz not null,
  hash_anterior  bytea not null,
  hash           bytea not null
);
create index auditoria_evento on auditoria (evento_id, id);

create or replace function auditoria_conteudo(a auditoria) returns bytea
language sql immutable as $$
  select convert_to(concat_ws('|',
    a.id::text, coalesce(a.evento_id::text, ''), coalesce(a.ator_id::text, ''),
    a.acao, coalesce(a.alvo, ''), a.dados::text,
    to_char(a.criado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  ), 'UTF8')
$$;

-- security definer: precisa ler a última linha mesmo quando a RLS a esconderia de quem insere.
create or replace function auditoria_encadear() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  anterior bytea;
begin
  -- Serializa as inserções para a cadeia não bifurcar.
  perform pg_advisory_xact_lock(hashtext('auditoria'));
  select hash into anterior from auditoria order by id desc limit 1;
  new.criado_em := clock_timestamp();
  new.hash_anterior := coalesce(anterior, '\x0000000000000000000000000000000000000000000000000000000000000000'::bytea);
  new.hash := sha256(new.hash_anterior || auditoria_conteudo(new));
  return new;
end $$;

create trigger auditoria_encadear before insert on auditoria
  for each row execute function auditoria_encadear();

create or replace function auditoria_imutavel() returns trigger
language plpgsql as $$
begin
  raise exception 'auditoria é só de inserção' using errcode = 'insufficient_privilege';
end $$;

create trigger auditoria_imutavel before update or delete on auditoria
  for each row execute function auditoria_imutavel();
create trigger auditoria_sem_truncate before truncate on auditoria
  for each statement execute function auditoria_imutavel();

-- Recalcula a cadeia inteira; devolve o id da primeira linha adulterada ou null.
create or replace function auditoria_verificar() returns bigint
language plpgsql stable as $$
declare
  linha auditoria;
  esperado bytea := '\x0000000000000000000000000000000000000000000000000000000000000000'::bytea;
begin
  for linha in select * from auditoria order by id loop
    if linha.hash_anterior <> esperado
       or linha.hash <> sha256(linha.hash_anterior || auditoria_conteudo(linha)) then
      return linha.id;
    end if;
    esperado := linha.hash;
  end loop;
  return null;
end $$;

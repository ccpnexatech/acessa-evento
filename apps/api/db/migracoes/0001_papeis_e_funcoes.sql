-- Papéis e funções base. Nada de extensão: só recursos nativos do PostgreSQL 16.

-- Papel da API em execução: sem login próprio, sem BYPASSRLS.
-- O usuário de login de cada ambiente é criado fora daqui e entra neste papel:
--   create role acessa_api login password '...' in role app_api;
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_api') then
    create role app_api nologin noinherit nobypassrls;
  end if;
end $$;

revoke all on schema public from public;
grant usage on schema public to app_api;

-- UUID v7 (RFC 9562): ordenável pelo tempo, bom para índices. O PostgreSQL 16
-- não tem uuidv7(); aqui ele é montado a partir do gen_random_uuid() nativo.
create or replace function uuid_v7() returns uuid
language plpgsql volatile parallel safe as $$
declare
  v bytea := uuid_send(gen_random_uuid());
  ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
begin
  v := overlay(v placing substring(int8send(ms) from 3) from 1 for 6);
  v := set_byte(v, 6, (get_byte(v, 6) & 15) | 112); -- versão 7
  return encode(v, 'hex')::uuid;
end $$;

-- Contexto de acesso definido por transação pela API (Banco.transacao).
create or replace function app_pessoa_id() returns uuid
language sql stable parallel safe as $$
  select nullif(current_setting('app.pessoa_id', true), '')::uuid
$$;

create or replace function app_evento_id() returns uuid
language sql stable parallel safe as $$
  select nullif(current_setting('app.evento_id', true), '')::uuid
$$;

grant execute on function uuid_v7(), app_pessoa_id(), app_evento_id() to app_api;

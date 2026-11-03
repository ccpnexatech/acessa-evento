-- Row Level Security (ADR 0002). A API nunca conecta como dono das tabelas:
-- usa o papel app_api, sempre sujeito às políticas. Sem FORCE, para que as
-- funções security definer abaixo (do dono) leiam o necessário.
-- Sem contexto (app.pessoa_id / app.evento_id), nenhuma política libera nada.

alter table evento enable row level security;
alter table pessoa enable row level security;
alter table membro_organizacao enable row level security;
alter table auditoria enable row level security;

-- Consulta de papel sem passar pela RLS da própria tabela (evita recursão).
-- security definer + search_path fixo: roda com os direitos do dono, só lê.
create or replace function tem_papel(evento uuid, papeis text[]) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from membro_organizacao m
    where m.evento_id = evento and m.pessoa_id = app_pessoa_id() and m.papel = any (papeis)
  )
$$;
revoke all on function tem_papel(uuid, text[]) from public;
grant execute on function tem_papel(uuid, text[]) to app_api;

-- evento: publicado é público; rascunho só para quem organiza. Só admin altera.
create policy evento_ler on evento for select to app_api
  using (publicado or tem_papel(id, array['admin', 'conteudo', 'credenciamento', 'financeiro']));
create policy evento_alterar on evento for update to app_api
  using (tem_papel(id, array['admin'])) with check (tem_papel(id, array['admin']));

-- pessoa: cada um só vê e altera a si mesmo. A API gera o id antes de inserir.
create policy pessoa_propria on pessoa for all to app_api
  using (id = app_pessoa_id()) with check (id = app_pessoa_id());

-- membro_organizacao: a pessoa vê os próprios vínculos; admin do evento vê e gere a equipe.
create policy membro_ler on membro_organizacao for select to app_api
  using (pessoa_id = app_pessoa_id() or tem_papel(evento_id, array['admin']));
create policy membro_gerir on membro_organizacao for all to app_api
  using (tem_papel(evento_id, array['admin'])) with check (tem_papel(evento_id, array['admin']));

-- auditoria: qualquer ação da API registra; só admin do evento lê o do seu evento.
create policy auditoria_registrar on auditoria for insert to app_api
  with check (ator_id is not distinct from app_pessoa_id());
create policy auditoria_ler on auditoria for select to app_api
  using (evento_id = app_evento_id() and tem_papel(evento_id, array['admin']));

-- Privilégios mínimos para a API.
revoke all on evento, pessoa, membro_organizacao, auditoria from public;
grant select, update (nome, local, fuso, publicado, tema) on evento to app_api;
grant select, insert, update (nome_cracha, excluida_em), delete on pessoa to app_api;
grant select, insert, update (papel), delete on membro_organizacao to app_api;
grant select, insert (evento_id, ator_id, acao, alvo, dados) on auditoria to app_api;

-- Apoio ao portal do expositor (ADR 0028): leituras que cruzam nomes de outras
-- pessoas vêm por função, com conferência de quem pergunta.

-- Equipe do parceiro com nome e a credencial de cada um, para o responsável e para a organização.
create or replace function equipe_do_parceiro(alvo uuid)
returns table (pessoa_id uuid, nome text, papel text, credencial_id uuid, credencial_revogada boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare evento uuid;
begin
  select pe.evento_id into evento from parceiro_evento pe where pe.id = alvo;
  if evento is null or not (e_do_parceiro(alvo) or tem_papel(evento, array['admin', 'comercial', 'operacao', 'credenciamento'])) then
    raise exception 'só o parceiro e a organização veem esta equipe' using errcode = '42501';
  end if;
  return query
    select m.pessoa_id, coalesce(p.nome_cracha, 'Ainda sem nome'), m.papel, c.id, c.revogada_em is not null
    from membro_parceiro m
    join pessoa p on p.id = m.pessoa_id
    left join lateral (
      select k.id, k.revogada_em from credencial k
      where k.parceiro_evento_id = alvo and k.pessoa_id = m.pessoa_id order by k.revogada_em nulls first, k.emitida_em desc limit 1
    ) c on true
    where m.parceiro_evento_id = alvo
    order by m.papel desc, 2;
end $$;

-- Os parceiros de um evento como a organização vê: empresa, situação e o resumo calculado.
create or replace function parceiros_do_evento(evento uuid)
returns table (parceiro_evento_id uuid, parceiro text, categoria text, situacao text, estandes integer, area_m2 numeric,
               investimento_centavos integer, nivel text, credenciais_direito integer, credenciais_emitidas integer,
               montagem text, contrato text, servicos_centavos integer)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not tem_papel(evento, array['admin', 'comercial', 'financeiro', 'operacao']) then
    raise exception 'sem permissão para ver os parceiros do evento' using errcode = '42501';
  end if;
  return query
    select pe.id, coalesce(pa.nome_fantasia, pa.razao_social), pe.categoria::text, pe.situacao,
           r.estandes, r.area_m2, r.investimento_centavos, r.nivel, r.credenciais_direito,
           (select count(*)::int from credencial c where c.parceiro_evento_id = pe.id and c.revogada_em is null),
           (select m.situacao from montagem m where m.parceiro_evento_id = pe.id),
           (select c.situacao from contrato c where c.parceiro_evento_id = pe.id and c.situacao <> 'cancelado' order by c.criado_em desc limit 1),
           (select coalesce(sum(s.valor_centavos), 0)::int from pedido_servico s where s.parceiro_evento_id = pe.id and s.situacao <> 'cancelado')
    from parceiro_evento pe
    join parceiro pa on pa.id = pe.parceiro_id
    left join lateral resumo_do_expositor(pe.id) r on true
    where pe.evento_id = evento
    order by 2;
end $$;

revoke all on function equipe_do_parceiro(uuid), parceiros_do_evento(uuid) from public;
grant execute on function equipe_do_parceiro(uuid), parceiros_do_evento(uuid) to app_api;

-- O expositor é convidado antes de o evento ser publicado: quem é de um parceiro
-- enxerga o evento e o desenho da feira mesmo em rascunho.
create or replace function e_parceiro_no_evento(evento uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from membro_parceiro m where m.evento_id = evento and m.pessoa_id = app_pessoa_id())
$$;
revoke all on function e_parceiro_no_evento(uuid) from public;
grant execute on function e_parceiro_no_evento(uuid) to app_api;

create policy evento_ler_parceiro on evento for select to app_api using (e_parceiro_no_evento(id));

create or replace function evento_visivel(evento uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from evento e where e.id = evento and e.publicado and not e.demonstracao)
         or e_da_equipe(evento) or e_parceiro_no_evento(evento)
$$;

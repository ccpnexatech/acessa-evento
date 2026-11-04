/** Adaptador Postgres da programação; a RLS decide o que é visível. */
import type { Banco, ContextoAcesso } from '../../../../shared/db/banco.ts';
import type { RepositorioProgramacao } from '../../application/casos-de-uso.ts';
import type { Atividade, Evento } from '../../domain/programacao.ts';

const ctx = (pessoaId: string | null, eventoId?: string): ContextoAcesso => ({
  ...(pessoaId ? { pessoaId } : {}),
  ...(eventoId ? { eventoId } : {}),
});

export function repositorioProgramacao(banco: Banco): RepositorioProgramacao {
  return {
    async eventoPorSlug(slug, pessoaId) {
      const [e] = await banco.transacao(ctx(pessoaId), (tx) =>
        tx.consultar<Evento>(
          `select id, slug, nome, to_char(inicio, 'YYYY-MM-DD') as inicio, to_char(fim, 'YYYY-MM-DD') as fim, local, fuso
           from evento where slug = $1`, [slug]));
      return e ?? null;
    },
    async versaoAgenda(eventoId, pessoaId) {
      const [v] = await banco.transacao(ctx(pessoaId, eventoId), (tx) =>
        tx.consultar<{ versao: string }>(
          `select md5(coalesce(string_agg(id::text || ':' || extract(epoch from atualizada_em)::text, ',' order by id), '')
                  || (select coalesce(string_agg(s.id::text || s.nome || s.local || coalesce(s.acessibilidade, ''), ',' order by s.id), '') from sala s where s.evento_id = $1)
                  || (select coalesce(string_agg(p.id::text || p.nome || coalesce(p.cargo, ''), ',' order by p.id), '') from palestrante p where p.evento_id = $1)
                  || (select count(*)::text from atividade_palestrante ap join atividade a on a.id = ap.atividade_id where a.evento_id = $1)
                 ) as versao
           from atividade where evento_id = $1`, [eventoId]));
      return v?.versao ?? '';
    },
    async agenda(eventoId, pessoaId) {
      return banco.transacao(ctx(pessoaId, eventoId), (tx) =>
        tx.consultar<Atividade>(
          `select a.id, a.titulo, a.resumo, a.inicio, a.fim, a.recursos,
                  case when s.id is null then null
                       else json_build_object('nome', s.nome, 'local', s.local, 'acessibilidade', s.acessibilidade) end as sala,
                  coalesce((select json_agg(json_build_object('nome', p.nome, 'cargo', p.cargo) order by ap.ordem, p.nome)
                            from atividade_palestrante ap join palestrante p on p.id = ap.palestrante_id
                            where ap.atividade_id = a.id), '[]'::json) as palestrantes
           from atividade a left join sala s on s.id = a.sala_id
           where a.evento_id = $1
           order by a.inicio, a.titulo`, [eventoId]));
    },
    async favoritos(pessoaId, eventoId) {
      const linhas = await banco.transacao(ctx(pessoaId, eventoId), (tx) =>
        tx.consultar<{ id: string }>(
          'select f.atividade_id as id from favorito f join atividade a on a.id = f.atividade_id where a.evento_id = $1 order by a.inicio', [eventoId]));
      return linhas.map((l) => l.id);
    },
    async favoritar(pessoaId, atividadeId) {
      return banco.transacao(ctx(pessoaId), async (tx) => {
        const [visivel] = await tx.consultar('select 1 from atividade where id = $1', [atividadeId]);
        if (!visivel) return false;
        await tx.consultar('insert into favorito (pessoa_id, atividade_id) values ($1, $2) on conflict do nothing', [pessoaId, atividadeId]);
        return true;
      });
    },
    async desfavoritar(pessoaId, atividadeId) {
      await banco.transacao(ctx(pessoaId), (tx) => tx.consultar('delete from favorito where atividade_id = $1', [atividadeId]));
    },
  };
}

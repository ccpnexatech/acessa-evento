/** Adaptador Postgres do assistente. */
import type { Banco } from '../../../../shared/db/banco.ts';
import type { RepositorioAssistente } from '../../application/casos-de-uso.ts';
import type { Assistente } from '../../domain/grafo.ts';

const CAMPOS = `versao, grafo, canais, to_char(publicado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "publicadoEm"`;

export function repositorioAssistente(banco: Banco): RepositorioAssistente {
  return {
    async eventoId(slug, pessoaId) {
      const [e] = await banco.transacao(pessoaId ? { pessoaId } : {}, (tx) => tx.consultar<{ id: string }>('select id from evento where slug = $1', [slug]));
      return e?.id ?? null;
    },
    async podePublicar(pessoaId, eventoId) {
      const [r] = await banco.transacao({ pessoaId }, (tx) => tx.consultar<{ ok: boolean }>("select tem_papel($1, array['admin', 'conteudo']) as ok", [eventoId]));
      return Boolean(r?.ok);
    },
    async atual(eventoId, pessoaId) {
      const [a] = await banco.transacao(pessoaId ? { pessoaId } : {}, (tx) =>
        tx.consultar<Assistente>(`select ${CAMPOS} from assistente_versao where evento_id = $1 order by versao desc limit 1`, [eventoId]));
      return a ?? null;
    },
    async versao(eventoId, versao) {
      const [a] = await banco.transacao({}, (tx) => tx.consultar<Assistente>(`select ${CAMPOS} from assistente_versao where evento_id = $1 and versao = $2`, [eventoId, versao]));
      return a ?? null;
    },
    publicar(pessoaId, eventoId, a) {
      return banco.transacao({ pessoaId, eventoId }, async (tx) => {
        // Trava a linha do evento para duas publicações simultâneas não pegarem o mesmo número.
        await tx.consultar('select pg_advisory_xact_lock(hashtext($1))', [`assistente:${eventoId}`]);
        const [r] = await tx.consultar<{ versao: number }>(
          `insert into assistente_versao (evento_id, versao, grafo, canais, publicado_por)
           select $1, coalesce(max(versao), 0) + 1, $2, $3, $4 from assistente_versao where evento_id = $1
           returning versao`, [eventoId, JSON.stringify(a.grafo), JSON.stringify(a.canais), pessoaId]);
        if (!r) throw new Error('Versão não gravada.');
        return r.versao;
      });
    },
    async avaliar(eventoId, versao, respostaId, util) {
      await banco.transacao({}, (tx) =>
        tx.consultar('insert into assistente_avaliacao (evento_id, versao, resposta_id, util) values ($1, $2, $3, $4)', [eventoId, versao, respostaId, util]));
    },
  };
}

/** Adaptador Postgres do credenciamento; a RLS confere o papel da equipe a cada escrita. */
import type { Banco } from '../../../../shared/db/banco.ts';
import type { RepositorioCredenciamento } from '../../application/casos-de-uso.ts';
import type { EventoEquipe, Participante, Situacao } from '../../domain/credenciamento.ts';

const CAMPOS_EVENTO = `e.id, e.slug, e.nome, to_char(e.inicio, 'YYYY-MM-DD') as inicio, to_char(e.fim, 'YYYY-MM-DD') as fim`;

export function repositorioCredenciamento(banco: Banco): RepositorioCredenciamento {
  return {
    async evento(pessoaId, slug) {
      const [e] = await banco.transacao({ pessoaId }, (tx) => tx.consultar<EventoEquipe>(`select ${CAMPOS_EVENTO} from evento e where e.slug = $1`, [slug]));
      return e ?? null;
    },
    async eDaEquipe(pessoaId, eventoId) {
      const [r] = await banco.transacao({ pessoaId }, (tx) =>
        tx.consultar<{ ok: boolean }>("select tem_papel($1, array['admin', 'credenciamento']) as ok", [eventoId]));
      return Boolean(r?.ok);
    },
    eventosDaEquipe(pessoaId) {
      return banco.transacao({ pessoaId }, (tx) =>
        tx.consultar<EventoEquipe>(
          `select ${CAMPOS_EVENTO} from evento e join membro_organizacao m on m.evento_id = e.id
           where m.pessoa_id = $1 and m.papel in ('admin', 'credenciamento') order by e.inicio`, [pessoaId]));
    },
    participantes(pessoaId, eventoId) {
      return banco.transacao({ pessoaId }, async (tx) => {
        const linhas = await tx.consultar<{ ingresso_id: string; nome: string; tipo: string; recursos: string[]; checkin_em: Date | null; checkin_portao: string | null }>(
          'select * from lista_credenciamento($1)', [eventoId]);
        return linhas.map((l): Participante => ({
          ingressoId: l.ingresso_id,
          nome: l.nome,
          tipo: l.tipo,
          recursos: l.recursos,
          checkin: l.checkin_em ? { em: l.checkin_em.toISOString(), portao: l.checkin_portao ?? '' } : null,
        }));
      });
    },
    registrar(pessoaId, eventoId, checkins) {
      return banco.transacao({ pessoaId, eventoId }, async (tx) => {
        // Só ingressos deste evento entram; os outros voltam como "ignorado".
        const validos = new Set((await tx.consultar<{ id: string }>(
          'select id from ingresso where evento_id = $1 and id = any ($2::uuid[])', [eventoId, checkins.map((c) => c.ingressoId)])).map((r) => r.id));
        const novos: string[] = [];
        for (const c of checkins.filter((x) => validos.has(x.ingressoId))) {
          const r = await tx.consultar<{ id: string }>(
            `insert into checkin (id, ingresso_id, evento_id, equipe_id, portao, metodo, feito_em)
             values ($1, $2, $3, $4, $5, $6, $7) on conflict (id) do nothing returning id`,
            [c.id, c.ingressoId, eventoId, pessoaId, c.portao, c.metodo, c.feitoEm]);
          if (r[0]) novos.push(r[0].id);
        }
        const situacao = new Map((await tx.consultar<{ id: string; situacao: Situacao }>(
          'select id, situacao from checkin_relatorio where evento_id = $1 and id = any ($2::uuid[])', [eventoId, checkins.map((c) => c.id)]))
          .map((r) => [r.id, r.situacao] as const));
        return { novos, situacao };
      });
    },
  };
}

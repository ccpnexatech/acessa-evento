/** Adaptador Postgres da inscrição; a RLS e as funções do banco garantem vagas e posse. */
import type { Banco, Executor } from '../../../../shared/db/banco.ts';
import type { RepositorioInscricao } from '../../application/casos-de-uso.ts';
import type { DetalheEvento, IngressoSalvo, Pedido, ResumoEvento } from '../../domain/inscricao.ts';

const CAMPOS_EVENTO = `e.id, e.slug, e.nome, to_char(e.inicio, 'YYYY-MM-DD') as inicio, to_char(e.fim, 'YYYY-MM-DD') as fim,
  e.local, e.recursos_oferecidos as "recursosOferecidos", e.inscricoes_abertas as "inscricoesAbertas"`;

const CAMPOS_PEDIDO = `id, status, metodo, valor_centavos as "valorCentavos", tipo_ingresso_id as "tipoIngressoId", evento_id as "eventoId"`;

const SELECT_INGRESSO = `select i.id, i.evento_id as "eventoId", t.nome as tipo, p.nome_cracha as nome, i.emitido_em as "emitidoEm",
  json_build_object('slug', e.slug, 'nome', e.nome, 'inicio', to_char(e.inicio, 'YYYY-MM-DD'),
                    'fim', to_char(e.fim, 'YYYY-MM-DD'), 'local', e.local) as evento,
  case when c.id is null then null else json_build_object('em', to_char(c.feito_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'portao', c.portao) end as checkin
  from ingresso i join evento e on e.id = i.evento_id join tipo_ingresso t on t.id = i.tipo_ingresso_id
  join pessoa p on p.id = i.pessoa_id
  left join checkin_primeiro c on c.ingresso_id = i.id`;

const ingressoDoPedido = async (tx: Executor, pedidoId: string): Promise<IngressoSalvo | null> =>
  (await tx.consultar<IngressoSalvo>(`${SELECT_INGRESSO} where i.pedido_id = $1 and i.cancelado_em is null`, [pedidoId]))[0] ?? null;

export function repositorioInscricao(banco: Banco): RepositorioInscricao {
  return {
    eventos(recurso) {
      return banco.transacao({}, (tx) =>
        tx.consultar<ResumoEvento>(
          `select ${CAMPOS_EVENTO} from evento e
           where e.publicado and ($1::text is null or $1 = any (e.recursos_oferecidos))
           order by e.inicio, e.nome`, [recurso]));
    },
    async evento(slug, pessoaId) {
      return banco.transacao(pessoaId ? { pessoaId } : {}, async (tx) => {
        const [e] = await tx.consultar<Omit<DetalheEvento, 'tipos' | 'destaques'>>(
          `select ${CAMPOS_EVENTO}, e.descricao, e.fuso from evento e where e.slug = $1`, [slug]);
        if (!e) return null;
        const tipos = await tx.consultar<DetalheEvento['tipos'][number]>(
          `select id, nome, descricao, preco_centavos as "precoCentavos", ocupadas >= vagas as esgotado
           from tipo_ingresso where evento_id = $1 order by ordem, nome`, [e.id]);
        const destaques = await tx.consultar<DetalheEvento['destaques'][number]>(
          'select titulo, inicio from atividade where evento_id = $1 and publicada order by inicio, titulo limit 4', [e.id]);
        return { ...e, tipos, destaques };
      });
    },
    async pedidoPorChave(pessoaId, chave) {
      const [p] = await banco.transacao({ pessoaId }, (tx) =>
        tx.consultar<Pedido>(`select ${CAMPOS_PEDIDO} from pedido where pessoa_id = $1 and chave_idempotencia = $2`, [pessoaId, chave]));
      return p ?? null;
    },
    async temIngresso(pessoaId, eventoId) {
      const [l] = await banco.transacao({ pessoaId }, (tx) =>
        tx.consultar('select 1 from ingresso where pessoa_id = $1 and evento_id = $2 and cancelado_em is null', [pessoaId, eventoId]));
      return Boolean(l);
    },
    reservar(pessoaId, r) {
      return banco.transacao({ pessoaId, eventoId: r.eventoId }, async (tx) => {
        const [{ reservou } = { reservou: false }] = await tx.consultar<{ reservou: boolean }>('select reservar_vaga($1) as reservou', [r.tipoIngressoId]);
        if (!reservou) return 'esgotado' as const;
        const [p] = await tx.consultar<Pedido>(
          `insert into pedido (pessoa_id, evento_id, tipo_ingresso_id, valor_centavos, metodo, chave_idempotencia, cartao_final)
           values ($1, $2, $3, $4, $5, $6, $7) returning ${CAMPOS_PEDIDO}`,
          [pessoaId, r.eventoId, r.tipoIngressoId, r.valorCentavos, r.metodo, r.chave, r.cartaoFinal]);
        if (r.recursos.length) {
          await tx.consultar(
            `insert into pedido_acessibilidade (pessoa_id, evento_id, recursos, apagar_apos) values ($1, $2, $3, $4)
             on conflict (pessoa_id, evento_id) do update set recursos = excluded.recursos, apagar_apos = excluded.apagar_apos`,
            [pessoaId, r.eventoId, r.recursos, r.apagarAcessibilidadeApos]);
        }
        if (!p) throw new Error('Pedido não criado.');
        return p;
      });
    },
    concluir(pessoaId, pedidoId, status, referencia) {
      return banco.transacao({ pessoaId }, async (tx) => {
        const [p] = await tx.consultar<{ evento_id: string; tipo_ingresso_id: string }>(
          `update pedido set status = $2, referencia_provedor = $3, atualizado_em = now()
           where id = $1 and status = 'pendente' returning evento_id, tipo_ingresso_id`, [pedidoId, status, referencia]);
        if (!p) return status === 'aprovado' ? ingressoDoPedido(tx, pedidoId) : null;
        if (status === 'recusado') {
          await tx.consultar('select liberar_vaga($1)', [pedidoId]);
          return null;
        }
        await tx.consultar('insert into ingresso (pedido_id, pessoa_id, evento_id, tipo_ingresso_id) values ($1, $2, $3, $4)',
          [pedidoId, pessoaId, p.evento_id, p.tipo_ingresso_id]);
        return ingressoDoPedido(tx, pedidoId);
      });
    },
    ingressoDoPedido(pessoaId, pedidoId) {
      return banco.transacao({ pessoaId }, (tx) => ingressoDoPedido(tx, pedidoId));
    },
    ingressos(pessoaId) {
      return banco.transacao({ pessoaId }, (tx) =>
        tx.consultar<IngressoSalvo>(`${SELECT_INGRESSO} where i.pessoa_id = $1 and i.cancelado_em is null order by e.inicio`, [pessoaId]));
    },
  };
}

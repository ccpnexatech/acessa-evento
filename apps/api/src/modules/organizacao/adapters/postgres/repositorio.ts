/** Adaptador Postgres de organização, evento, equipe e convite. A RLS e as funções da 0010 e 0014 decidem a permissão. */
import type { Banco } from '../../../../shared/db/banco.ts';
import { comErroDeBanco } from '../../../../shared/db/erro-banco.ts';
import { ErroDominio } from '../../../../shared/dominio/erro.ts';
import type {
  ConvitePendente, ConviteSalvo, EventoDetalhe, EventoResumo, ItemProntidao, Membro, OrganizacaoResumo, RepositorioOrganizacao,
} from '../../application/organizacao.ts';

const MENSAGENS = {
  evento_slug_key: 'Endereço do evento: já está em uso. Escolha outro.',
  organizacao_cnpj_key: 'CNPJ: já existe uma organização com esse CNPJ.',
} as const;

const RESUMO = `e.id, e.slug, e.nome, to_char(e.inicio, 'YYYY-MM-DD') as inicio, to_char(e.fim, 'YYYY-MM-DD') as fim,
  e.publicado, e.demonstracao, e.organizacao_id as "organizacaoId", meus_papeis(e.id) as papeis`;

const COLUNAS_EVENTO: Readonly<Record<string, string>> = {
  nome: 'nome', inicio: 'inicio', fim: 'fim', local: 'local', localId: 'local_id', descricao: 'descricao',
  inscricoesAbertas: 'inscricoes_abertas', recursosOferecidos: 'recursos_oferecidos', publicado: 'publicado',
  feiraM2PorCredencial: 'feira_m2_por_credencial', slug: 'slug', demonstracao: 'demonstracao',
};

export function repositorioOrganizacao(banco: Banco): RepositorioOrganizacao {
  const ler = <T extends Record<string, unknown>>(pessoaId: string, sql: string, valores: unknown[] = []) =>
    banco.transacao({ pessoaId }, (tx) => tx.consultar<T>(sql, valores));
  return {
    organizacoes: (pessoaId) => ler<OrganizacaoResumo & Record<string, unknown>>(pessoaId,
      `select o.id, o.nome, array_agg(m.papel order by m.papel) as papeis
       from organizacao o join organizacao_membro m on m.organizacao_id = o.id and m.pessoa_id = $1
       group by o.id order by o.nome`, [pessoaId]),
    eventos: (pessoaId) => ler<EventoResumo & Record<string, unknown>>(pessoaId,
      `select ${RESUMO} from evento e where cardinality(meus_papeis(e.id)) > 0 order by e.inicio desc, e.nome`),
    convitesPendentes: (pessoaId) => ler<ConvitePendente & Record<string, unknown>>(pessoaId,
      'select id, organizacao, evento, parceiro, papeis, expira_em as "expiraEm" from meus_convites()'),
    criarOrganizacao: (pessoaId, v) => comErroDeBanco(async () => {
      const [l] = await ler<{ id: string }>(pessoaId, 'select criar_organizacao($1, $2) as id', [v['nome'], v['cnpj'] ?? null]);
      return l?.id ?? '';
    }, MENSAGENS),
    async organizacao(pessoaId, id) {
      const [l] = await ler<{ id: string; nome: string }>(pessoaId, 'select id, nome from organizacao where id = $1', [id]);
      return l ?? null;
    },
    criarEvento: (pessoaId, organizacaoId, v) => comErroDeBanco(async () => {
      const campos = Object.keys(v);
      const [l] = await ler<{ id: string; slug: string }>(pessoaId,
        `insert into evento (organizacao_id, ${campos.map((c) => COLUNAS_EVENTO[c]).join(', ')})
         values ($1, ${campos.map((_, i) => `$${i + 2}`).join(', ')}) returning id, slug`, [organizacaoId, ...campos.map((c) => v[c])]);
      if (!l) throw new Error('insert sem linha devolvida');
      return l;
    }, MENSAGENS),
    async evento(pessoaId, slug) {
      const [l] = await ler<EventoDetalhe & Record<string, unknown>>(pessoaId,
        `select ${RESUMO}, e.local, e.local_id as "localId", e.descricao, e.fuso, e.inscricoes_abertas as "inscricoesAbertas",
                e.recursos_oferecidos as "recursosOferecidos", e.tema, e.feira_m2_por_credencial as "feiraM2PorCredencial",
                o.nome as organizacao
         from evento e join organizacao o on o.id = e.organizacao_id where e.slug = $1`, [slug]);
      return l ?? null;
    },
    prontidao: (pessoaId, eventoId) => ler<ItemProntidao & Record<string, unknown>>(pessoaId, 'select item, feito, quantidade from prontidao_do_evento($1)', [eventoId]),
    async numeros(pessoaId, eventoId) {
      const [l] = await ler<Record<string, number>>(pessoaId,
        `select inscritos, credenciais, entradas, leituras_negadas as "leiturasNegadas", estandes, estandes_vendidos as "estandesVendidos",
                contratos_pendentes as "contratosPendentes", convites_pendentes as "convitesPendentes" from numeros_do_evento($1)`, [eventoId]);
      return l ?? {};
    },
    alterarEvento: (pessoaId, eventoId, v, tema) => comErroDeBanco(async () => {
      const campos = Object.keys(v);
      const partes = campos.map((c, i) => `${COLUNAS_EVENTO[c]} = $${i + 2}`);
      const valores: unknown[] = [eventoId, ...campos.map((c) => v[c])];
      if (tema) {
        valores.push(JSON.stringify({
          cor_primaria: tema.corPrimaria, cor_destaque: tema.corDestaque, fonte: tema.fonte, arredondamento: tema.arredondamento,
          ...(tema.logoUrl ? { logo_url: tema.logoUrl, logo_descricao: tema.logoDescricao } : {}),
        }));
        partes.push(`tema = $${valores.length}::jsonb`);
      }
      return (await ler(pessoaId, `update evento set ${partes.join(', ')} where id = $1 returning id`, valores)).length > 0;
    }, MENSAGENS),
    equipe: (pessoaId, eventoId) => ler<Membro & Record<string, unknown>>(pessoaId,
      'select pessoa_id as "pessoaId", nome, papeis, cargo, exibir_publico as "exibirPublico" from equipe_do_evento($1)', [eventoId]),
    definirMembro: (pessoaId, eventoId, alvoId, d) => comErroDeBanco(() => banco.transacao({ pessoaId }, async (tx) => {
      // Sem permissão, apagar e atualizar não dão erro (a política só esconde as linhas): pergunta ao banco antes.
      const [papel] = await tx.consultar<{ ok: boolean }>("select tem_papel($1, array['admin']) as ok", [eventoId]);
      if (!papel?.ok) throw new ErroDominio('sem_permissao', 'Só a administração do evento monta a equipe.');
      await tx.consultar('delete from membro_organizacao where evento_id = $1 and pessoa_id = $2 and papel <> all ($3::text[])', [eventoId, alvoId, d.papeis]);
      await tx.consultar(
        `insert into membro_organizacao (evento_id, pessoa_id, papel) select $1, $2, unnest($3::text[])
         on conflict (evento_id, pessoa_id, papel) do nothing`, [eventoId, alvoId, d.papeis]);
      await tx.consultar('update membro_organizacao set cargo = $3, exibir_publico = $4 where evento_id = $1 and pessoa_id = $2', [eventoId, alvoId, d.cargo, d.exibirPublico]);
    })),
    removerMembro: async (pessoaId, eventoId, alvoId) =>
      (await ler(pessoaId, 'delete from membro_organizacao where evento_id = $1 and pessoa_id = $2 returning papel', [eventoId, alvoId])).length > 0,
    convites: (pessoaId, eventoId) => ler<ConviteSalvo & Record<string, unknown>>(pessoaId,
      `select id, email_cifrado as "emailCifrado", papeis, expira_em as "expiraEm",
              case when aceito_em is not null then 'aceito' when revogado_em is not null then 'cancelado'
                   when expira_em <= now() then 'vencido' else 'aguardando' end as situacao
       from convite where evento_id = $1 and parceiro_evento_id is null order by criado_em desc`, [eventoId]),
    criarConvite: (pessoaId, c) => comErroDeBanco(async () => {
      const [l] = await ler<{ id: string; expiraEm: string }>(pessoaId,
        `insert into convite (organizacao_id, evento_id, parceiro_evento_id, email_cifrado, email_hash, papeis, criado_por)
         values ($1, $2, $3, $4, $5, $6, $7) returning id, expira_em as "expiraEm"`,
        [c.organizacaoId, c.eventoId, c.parceiroEventoId ?? null, Buffer.from(c.emailCifrado), Buffer.from(c.emailHash), c.papeis, pessoaId]);
      if (!l) throw new Error('insert sem linha devolvida');
      return l;
    }),
    revogarConvite: async (pessoaId, id) =>
      (await ler(pessoaId, 'update convite set revogado_em = now() where id = $1 and aceito_em is null and revogado_em is null returning id', [id])).length > 0,
    async aceitarConvite(pessoaId, id) {
      const [l] = await ler<{ ok: boolean }>(pessoaId, 'select aceitar_convite($1) as ok', [id]);
      return Boolean(l?.ok);
    },
  };
}

/** Adaptador Postgres da feira, do portal e dos contratos. As funções da 0013 e 0015 guardam as regras; a RLS separa um expositor do outro. */
import type { Banco } from '../../../../shared/db/banco.ts';
import { comErroDeBanco } from '../../../../shared/db/erro-banco.ts';
import type { EventoFeira, Linha, Participacao, RepositorioFeira, Resumo } from '../../application/feira.ts';

const MENSAGENS = {
  perfil_expositor_check: 'Descrição do logo: descreva o logo para quem usa leitor de tela.',
  contrato_check: 'Contratado: escolha um parceiro ou um palestrante.',
} as const;

const PARTICIPACAO = `
  select pe.id, coalesce(pa.nome_fantasia, pa.razao_social) as parceiro, pe.categoria::text as categoria, pe.situacao,
         (select m.papel from membro_parceiro m where m.parceiro_evento_id = pe.id and m.pessoa_id = $1) as papel,
         e.id as evento_id, e.slug, e.nome as evento_nome, e.organizacao_id, coalesce(o.nome, e.nome) as organizacao
  from parceiro_evento pe
  join parceiro pa on pa.id = pe.parceiro_id
  join evento e on e.id = pe.evento_id
  left join organizacao o on o.id = e.organizacao_id`;

interface LinhaParticipacao {
  id: string; parceiro: string; categoria: string; situacao: string; papel: string | null;
  evento_id: string; slug: string; evento_nome: string; organizacao_id: string; organizacao: string;
}
const participacao = (l: LinhaParticipacao): Participacao => ({
  id: l.id, parceiro: l.parceiro, categoria: l.categoria, situacao: l.situacao, papel: l.papel,
  evento: { id: l.evento_id, slug: l.slug, nome: l.evento_nome, organizacaoId: l.organizacao_id, organizacao: l.organizacao },
});

const CONTRATO = `c.id, c.situacao, c.via, c.valor_centavos as "valorCentavos", c.corpo, c.criado_em as "criadoEm", c.enviado_em as "enviadoEm",
  c.assinado_em as "assinadoEm", c.referencia_externa as "referenciaExterna", c.parceiro_evento_id as "parceiroEventoId", c.palestrante_id as "palestranteId"`;

export function repositorioFeira(banco: Banco): RepositorioFeira {
  const ler = <T extends Record<string, unknown>>(pessoaId: string | null, sql: string, valores: unknown[] = []) =>
    banco.transacao(pessoaId ? { pessoaId } : {}, (tx) => tx.consultar<T>(sql, valores));
  const funcao = (pessoaId: string, sql: string, valores: unknown[]) => comErroDeBanco(async () => {
    const [l] = await ler<{ ok: boolean }>(pessoaId, sql, valores);
    return Boolean(l?.ok);
  });
  return {
    async evento(pessoaId, slug) {
      const [l] = await ler<EventoFeira & Record<string, unknown>>(pessoaId,
        `select e.id, e.slug, e.nome, e.organizacao_id as "organizacaoId", o.nome as organizacao
         from evento e join organizacao o on o.id = e.organizacao_id where e.slug = $1`, [slug]);
      return l ?? null;
    },
    parceirosDoEvento: (pessoaId, eventoId) => comErroDeBanco(() => ler<Linha & Record<string, unknown>>(pessoaId,
      `select parceiro_evento_id as "parceiroEventoId", parceiro, categoria, situacao, estandes, area_m2::float8 as "areaM2",
              investimento_centavos as "investimentoCentavos", nivel, credenciais_direito as "credenciaisDireito",
              credenciais_emitidas as "credenciaisEmitidas", montagem, contrato, servicos_centavos as "servicosCentavos"
       from parceiros_do_evento($1)`, [eventoId])),
    minhasParticipacoes: async (pessoaId) => (await ler<LinhaParticipacao & Record<string, unknown>>(pessoaId,
      `${PARTICIPACAO} where exists (select 1 from membro_parceiro m where m.parceiro_evento_id = pe.id and m.pessoa_id = $1) order by e.inicio desc, 2`, [pessoaId])).map(participacao),
    async participacao(pessoaId, id) {
      const [l] = await ler<LinhaParticipacao & Record<string, unknown>>(pessoaId, `${PARTICIPACAO} where pe.id = $2`, [pessoaId, id]);
      return l ? participacao(l) : null;
    },
    async resumo(pessoaId, id) {
      const [l] = await ler<Resumo & Record<string, unknown>>(pessoaId,
        `select estandes, area_m2::float8 as "areaM2", investimento_centavos as "investimentoCentavos", nivel,
                credenciais_direito as "credenciaisDireito" from resumo_do_expositor($1)`, [id]);
      return l ?? { estandes: 0, areaM2: 0, investimentoCentavos: 0, nivel: null, credenciaisDireito: 0 };
    },
    niveis: (pessoaId, eventoId) => ler(pessoaId,
      `select nome, investimento_minimo_centavos as "investimentoMinimoCentavos", beneficios
       from nivel_expositor where evento_id = $1 order by investimento_minimo_centavos`, [eventoId]),
    estandesDe: (pessoaId, id) => ler(pessoaId,
      `select s.id, s.codigo, s.situacao, s.reservado_ate as "reservadoAte", s.valor_centavos as "valorCentavos", t.nome as tipo,
              t.largura_m::float8 as "larguraM", t.profundidade_m::float8 as "profundidadeM"
       from estande s join tipo_estande t on t.id = s.tipo_estande_id where s.parceiro_evento_id = $1 order by s.codigo`, [id]),
    async perfil(pessoaId, id) {
      const [l] = await ler(pessoaId,
        `select nome_exibicao as "nomeExibicao", logo_url as "logoUrl", logo_descricao as "logoDescricao", segmento_id as "segmentoId",
                frase, destaques, site, contato, publicado from perfil_expositor where parceiro_evento_id = $1`, [id]);
      return l ?? null;
    },
    pedidos: (pessoaId, id) => ler(pessoaId,
      `select p.id, p.servico_feira_id as "servicoId", s.nome as servico, s.unidade, p.quantidade, p.valor_centavos as "valorCentavos", p.situacao
       from pedido_servico p join servico_feira s on s.id = p.servico_feira_id where p.parceiro_evento_id = $1 order by s.nome`, [id]),
    async montagem(pessoaId, id) {
      const [l] = await ler(pessoaId,
        `select tipo, montadora, projeto_url as "projetoUrl", art_rrt as "artRrt", termo_aceito_em as "termoAceitoEm", situacao, observacao
         from montagem where parceiro_evento_id = $1`, [id]);
      return l ?? null;
    },
    equipe: (pessoaId, id) => comErroDeBanco(() => ler(pessoaId,
      `select pessoa_id as "pessoaId", nome, papel, credencial_id as "credencialId", credencial_revogada as "credencialRevogada"
       from equipe_do_parceiro($1)`, [id])),
    contratosDe: (pessoaId, id) => ler(pessoaId, `select ${CONTRATO} from contrato c where c.parceiro_evento_id = $1 order by c.criado_em desc`, [id]),
    reservar: (pessoaId, estandeId, id) => funcao(pessoaId, 'select reservar_estande($1, $2) as ok', [estandeId, id]),
    liberar: (pessoaId, estandeId) => funcao(pessoaId, 'select liberar_estande($1) as ok', [estandeId]),
    salvarPerfil: (pessoaId, p, v) => comErroDeBanco(async () => {
      await ler(pessoaId,
        `insert into perfil_expositor (parceiro_evento_id, evento_id, nome_exibicao, logo_url, logo_descricao, segmento_id, frase, destaques, site, contato, publicado)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         on conflict (parceiro_evento_id) do update set nome_exibicao = excluded.nome_exibicao, logo_url = excluded.logo_url,
           logo_descricao = excluded.logo_descricao, segmento_id = excluded.segmento_id, frase = excluded.frase, destaques = excluded.destaques,
           site = excluded.site, contato = excluded.contato, publicado = excluded.publicado`,
        [p.id, p.evento.id, v['nomeExibicao'], v['logoUrl'], v['logoDescricao'], v['segmentoId'], v['frase'], v['destaques'], v['site'], v['contato'], v['publicado']]);
    }, MENSAGENS),
    pedirServico: (pessoaId, p, servicoId, quantidade) => comErroDeBanco(async () => {
      const [l] = await ler(pessoaId,
        `insert into pedido_servico (evento_id, parceiro_evento_id, servico_feira_id, quantidade) values ($1, $2, $3, $4)
         on conflict (parceiro_evento_id, servico_feira_id) do update set quantidade = excluded.quantidade
         returning id, quantidade, valor_centavos as "valorCentavos", situacao`, [p.evento.id, p.id, servicoId, quantidade]);
      if (!l) throw new Error('insert sem linha devolvida');
      return l;
    }),
    cancelarPedido: (pessoaId, id, servicoId) => comErroDeBanco(async () => (await ler(pessoaId,
      "update pedido_servico set situacao = 'cancelado' where parceiro_evento_id = $1 and servico_feira_id = $2 returning id", [id, servicoId])).length > 0),
    situacaoDoPedido: (pessoaId, eventoId, pedidoId, situacao) => comErroDeBanco(async () => (await ler(pessoaId,
      'update pedido_servico set situacao = $3 where id = $1 and evento_id = $2 returning id', [pedidoId, eventoId, situacao])).length > 0),
    salvarMontagem: (pessoaId, p, d) => comErroDeBanco(async () => {
      const [l] = await ler(pessoaId,
        `insert into montagem (parceiro_evento_id, evento_id, tipo, montadora, projeto_url, art_rrt, termo_aceito_em)
         values ($1, $2, $3, $4, $5, $6, case when $7 then now() end)
         on conflict (parceiro_evento_id) do update set tipo = excluded.tipo, montadora = excluded.montadora, projeto_url = excluded.projeto_url,
           art_rrt = excluded.art_rrt, termo_aceito_em = case when $7 then coalesce(montagem.termo_aceito_em, now()) end
         returning tipo, situacao`, [p.id, p.evento.id, d.tipo, d.montadora, d.projetoUrl, d.artRrt, d.termoAceito]);
      if (!l) throw new Error('insert sem linha devolvida');
      return l;
    }),
    analisarMontagem: (pessoaId, id, aprovar, observacao) => funcao(pessoaId, 'select analisar_montagem($1, $2, $3) as ok', [id, aprovar, observacao]),
    convidar: (pessoaId, p, cifrado, hash, papel) => comErroDeBanco(async () => {
      const [l] = await ler<{ id: string; expiraEm: string }>(pessoaId,
        `insert into convite (organizacao_id, evento_id, parceiro_evento_id, email_cifrado, email_hash, papeis, criado_por)
         values ($1, $2, $3, $4, $5, $6, $7) returning id, expira_em as "expiraEm"`,
        [p.evento.organizacaoId, p.evento.id, p.id, Buffer.from(cifrado), Buffer.from(hash), [papel], pessoaId]);
      if (!l) throw new Error('insert sem linha devolvida');
      return l;
    }),
    emitirCredencial: (pessoaId, id, alvoId) => comErroDeBanco(async () => {
      const [l] = await ler<{ id: string }>(pessoaId, 'select emitir_credencial_parceiro($1, $2) as id', [id, alvoId]);
      return l?.id ?? '';
    }, { credencial_unica_ativa: 'Esta pessoa já tem credencial ativa por este parceiro.' }),
    async expositores(pessoaId, slug) {
      return banco.transacao(pessoaId ? { pessoaId } : {}, async (tx) => {
        const [evento] = await tx.consultar<{ id: string }>('select id from evento where slug = $1', [slug]);
        if (!evento) return null;
        return {
          expositores: await tx.consultar<Linha & Record<string, unknown>>(
            `select parceiro_evento_id as id, nome_exibicao as "nomeExibicao", logo_url as "logoUrl", logo_descricao as "logoDescricao",
                    segmento, frase, destaques, site, nivel, estandes from expositores_publicos($1)`, [evento.id]),
          plantas: await tx.consultar<Linha & Record<string, unknown>>(
            'select id, nome, colunas, linhas, imagem_url as "imagemUrl" from planta where evento_id = $1 order by nome', [evento.id]),
          // O mapa mostra a situação de cada estande, nunca de quem é a reserva.
          estandes: await tx.consultar<Linha & Record<string, unknown>>(
            `select s.id, s.planta_id as "plantaId", s.codigo, s.coluna, s.linha,
                    case when s.situacao = 'reservado' and s.reservado_ate < now() then 'livre' else s.situacao end as situacao,
                    t.nome as tipo, t.largura_m::float8 as "larguraM", t.profundidade_m::float8 as "profundidadeM", t.preco_centavos as "precoCentavos"
             from estande s join tipo_estande t on t.id = s.tipo_estande_id where s.evento_id = $1 order by s.codigo`, [evento.id]),
          segmentos: await tx.consultar<Linha & Record<string, unknown>>('select id, nome from segmento where evento_id = $1 order by nome', [evento.id]),
        };
      });
    },
    contratos: (pessoaId, eventoId) => ler(pessoaId,
      `select ${CONTRATO}, coalesce(
                (select coalesce(pa.nome_fantasia, pa.razao_social) from parceiro_evento pe join parceiro pa on pa.id = pe.parceiro_id where pe.id = c.parceiro_evento_id),
                (select p.nome from palestrante p where p.id = c.palestrante_id)) as contratado
       from contrato c where c.evento_id = $1 order by c.criado_em desc`, [eventoId]),
    criarContrato: (pessoaId, eventoId, c) => comErroDeBanco(() => banco.transacao({ pessoaId }, async (tx) => {
      let corpo = c.corpo;
      if (c.modeloContratoId) {
        const [modelo] = await tx.consultar<{ corpo: string }>(
          'select m.corpo from modelo_contrato m join evento e on e.organizacao_id = m.organizacao_id where m.id = $1 and e.id = $2', [c.modeloContratoId, eventoId]);
        if (!modelo) return 'modelo_inexistente' as const;
        corpo = modelo.corpo;
      }
      const [l] = await tx.consultar<{ id: string }>(
        `insert into contrato (evento_id, parceiro_evento_id, palestrante_id, modelo_contrato_id, corpo, valor_centavos, via, criado_por)
         values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
        [eventoId, c.parceiroEventoId, c.palestranteId, c.modeloContratoId, corpo, c.valorCentavos, c.via, pessoaId]);
      if (!l) throw new Error('insert sem linha devolvida');
      return l;
    }), MENSAGENS),
    alterarContrato: (pessoaId, eventoId, id, v) => comErroDeBanco(async () => {
      const colunas: Record<string, string> = { corpo: 'corpo', valorCentavos: 'valor_centavos', via: 'via' };
      const campos = Object.keys(v);
      return (await ler(pessoaId,
        `update contrato set ${campos.map((c, i) => `${colunas[c]} = $${i + 3}`).join(', ')} where id = $1 and evento_id = $2 returning id`,
        [id, eventoId, ...campos.map((c) => v[c])])).length > 0;
    }),
    enviarContrato: (pessoaId, id) => funcao(pessoaId, 'select enviar_contrato($1) as ok', [id]),
    cancelarContrato: (pessoaId, id) => funcao(pessoaId, 'select cancelar_contrato($1) as ok', [id]),
    assinarContrato: (pessoaId, id, referencia) => funcao(pessoaId, 'select assinar_contrato($1, $2) as ok', [id, referencia]),
    meusContratos: (pessoaId) => ler(pessoaId,
      `select ${CONTRATO}, e.nome as evento, e.slug
       from contrato c join evento e on e.id = c.evento_id
       where c.situacao <> 'rascunho' and (
         (c.parceiro_evento_id is not null and e_do_parceiro(c.parceiro_evento_id, array['responsavel']))
         or exists (select 1 from palestrante p where p.id = c.palestrante_id and p.pessoa_id = $1))
       order by c.enviado_em desc`, [pessoaId]),
  };
}

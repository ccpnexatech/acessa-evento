/** Adaptador Postgres do controle de acesso. As funções e políticas da 0011, 0012 e 0014 decidem a permissão. */
import type { Banco } from '../../../../shared/db/banco.ts';
import { comErroDeBanco } from '../../../../shared/db/erro-banco.ts';
import { ErroDominio } from '../../../../shared/dominio/erro.ts';
import type {
  CredencialLista, EventoAcessos, MeiaLeitor, MinhaCredencial, PontoHoje, PontoLeitor, RepositorioAcessos, ZonaLeitor,
} from '../../application/acessos.ts';
import type { Excecao, Regra, SituacaoLeitura } from '../../domain/acessos.ts';

const MENSAGENS = {
  credencial_unica_ativa: 'Esta pessoa já tem uma credencial ativa dessa categoria neste evento.',
} as const;

export function repositorioAcessos(banco: Banco): RepositorioAcessos {
  const ler = <T extends Record<string, unknown>>(pessoaId: string, sql: string, valores: unknown[] = []) =>
    banco.transacao({ pessoaId }, (tx) => tx.consultar<T>(sql, valores));
  return {
    async evento(pessoaId, slug) {
      const [l] = await ler<EventoAcessos & Record<string, unknown>>(pessoaId,
        `select e.id, e.slug, e.nome, to_char(e.inicio, 'YYYY-MM-DD') as inicio, to_char(e.fim, 'YYYY-MM-DD') as fim,
                meus_papeis(e.id) as papeis from evento e where e.slug = $1`, [slug]);
      return l ?? null;
    },
    regras: (pessoaId, eventoId) => ler<Regra & Record<string, unknown>>(pessoaId,
      'select zona_id as "zonaId", categoria::text as categoria, de, ate from regra_zona where evento_id = $1 order by zona_id, categoria', [eventoId]),
    definirRegras: (pessoaId, eventoId, zonaId, regras) => comErroDeBanco(() => banco.transacao({ pessoaId }, async (tx) => {
      const [zona] = await tx.consultar('select 1 as ok from zona where id = $1 and evento_id = $2', [zonaId, eventoId]);
      if (!zona) return false;
      // Apagar sem permissão não dá erro (a política só esconde as linhas): pergunta ao banco antes, para não responder "feito" sem ter feito.
      const [papel] = await tx.consultar<{ ok: boolean }>("select tem_papel($1, array['admin', 'operacao']) as ok", [eventoId]);
      if (!papel?.ok) throw new ErroDominio('sem_permissao', 'Só a administração e a operação do evento mudam as regras de acesso.');
      await tx.consultar('delete from regra_zona where zona_id = $1', [zonaId]);
      for (const r of regras) {
        await tx.consultar('insert into regra_zona (zona_id, evento_id, categoria, de, ate) values ($1, $2, $3, $4, $5)', [zonaId, eventoId, r.categoria, r.de, r.ate]);
      }
      return true;
    })),
    credenciais: (pessoaId, eventoId) => comErroDeBanco(async () => {
      const linhas = await ler<{ credencial_id: string; ingresso_id: string | null; nome: string; categoria: string; tipo: string | null; recursos: string[]; revogada_em: Date | null; entrada_em: Date | null; entrada_portao: string | null }>(
        pessoaId, 'select * from lista_credenciais($1)', [eventoId]);
      return linhas.map((l): CredencialLista => ({
        id: l.credencial_id, ingressoId: l.ingresso_id, nome: l.nome, categoria: l.categoria as CredencialLista['categoria'], tipo: l.tipo,
        recursos: l.recursos, revogada: l.revogada_em !== null,
        entrada: l.entrada_em ? { em: l.entrada_em.toISOString(), portao: l.entrada_portao ?? '' } : null,
      }));
    }),
    garantirPessoa: (pessoaId, cifrado, hash) => comErroDeBanco(async () => {
      const [l] = await ler<{ id: string }>(pessoaId, 'select garantir_pessoa($1, $2) as id', [Buffer.from(cifrado), Buffer.from(hash)]);
      return l?.id ?? '';
    }),
    emitir: (pessoaId, eventoId, alvoId, categoria) => comErroDeBanco(async () => {
      const [l] = await ler<{ id: string }>(pessoaId,
        'insert into credencial (evento_id, pessoa_id, categoria, emitida_por) values ($1, $2, $3, $4) returning id', [eventoId, alvoId, categoria, pessoaId]);
      return l?.id ?? '';
    }, MENSAGENS),
    revogar: async (pessoaId, eventoId, credencialId, motivo) => (await ler(pessoaId,
      // Credencial de congressista se cancela pelo ingresso, não aqui.
      `update credencial set revogada_em = now(), revogada_por = $4, motivo = $3
       where id = $1 and evento_id = $2 and revogada_em is null and ingresso_id is null returning id`, [credencialId, eventoId, motivo, pessoaId])).length > 0,
    excecoes: (pessoaId, eventoId) => ler<Excecao & { motivo: string } & Record<string, unknown>>(pessoaId,
      'select credencial_id as "credencialId", zona_id as "zonaId", efeito, motivo from credencial_excecao where evento_id = $1 order by criado_em', [eventoId]),
    definirExcecao: (pessoaId, eventoId, credencialId, zonaId, efeito, motivo) => comErroDeBanco(() => banco.transacao({ pessoaId }, async (tx) => {
      await tx.consultar('delete from credencial_excecao where credencial_id = $1 and zona_id = $2', [credencialId, zonaId]);
      await tx.consultar(
        'insert into credencial_excecao (credencial_id, zona_id, evento_id, efeito, motivo, criado_por) values ($1, $2, $3, $4, $5, $6)',
        [credencialId, zonaId, eventoId, efeito, motivo, pessoaId]);
    })),
    removerExcecao: async (pessoaId, eventoId, credencialId, zonaId) => (await ler(pessoaId,
      'delete from credencial_excecao where credencial_id = $1 and zona_id = $2 and evento_id = $3 returning efeito', [credencialId, zonaId, eventoId])).length > 0,
    zonas: (pessoaId, eventoId) => ler<ZonaLeitor & Record<string, unknown>>(pessoaId, 'select id, nome, aberta from zona where evento_id = $1 order by ordem, nome', [eventoId]),
    pontos: (pessoaId, eventoId) => ler<PontoLeitor & Record<string, unknown>>(pessoaId,
      'select id, nome, zona_id as "zonaId", tipo, modo from ponto_leitura where evento_id = $1 and ativo order by nome', [eventoId]),
    meias: (pessoaId, eventoId) => ler<MeiaLeitor & Record<string, unknown>>(pessoaId,
      `select m.id, c.id as "credencialId", m.motivo, m.resultado
       from elegibilidade_meia m
       join credencial c on c.evento_id = m.evento_id and c.pessoa_id = m.pessoa_id and c.categoria = 'congressista' and c.revogada_em is null
       where m.evento_id = $1`, [eventoId]),
    conferirMeia: async (pessoaId, eventoId, id, resultado) => (await ler(pessoaId,
      'update elegibilidade_meia set conferida_em = now(), conferida_por = $4, resultado = $3 where id = $1 and evento_id = $2 returning id',
      [id, eventoId, resultado, pessoaId])).length > 0,
    registrar: (pessoaId, eventoId, leituras) => comErroDeBanco(() => banco.transacao({ pessoaId, eventoId }, async (tx) => {
      // Só o que é deste evento entra; o resto volta como "ignorada" em vez de derrubar o lote.
      const credenciais = new Set((await tx.consultar<{ id: string }>(
        'select id from credencial where evento_id = $1 and id = any ($2::uuid[])', [eventoId, leituras.flatMap((l) => l.credencialId ?? [])])).map((r) => r.id));
      const ingressos = new Set((await tx.consultar<{ id: string }>(
        'select id from ingresso where evento_id = $1 and id = any ($2::uuid[])', [eventoId, leituras.flatMap((l) => l.ingressoId ?? [])])).map((r) => r.id));
      const pontos = new Map((await tx.consultar<{ id: string; nome: string }>(
        'select id, nome from ponto_leitura where evento_id = $1 and id = any ($2::uuid[])', [eventoId, leituras.flatMap((l) => l.pontoId ?? [])])).map((r) => [r.id, r.nome]));
      const novas: string[] = [];
      for (const l of leituras) {
        const alvoOk = l.credencialId ? credenciais.has(l.credencialId) : ingressos.has(l.ingressoId ?? '');
        const portao = l.pontoId ? pontos.get(l.pontoId) : l.portao;
        if (!alvoOk || !portao) continue;
        const r = await tx.consultar<{ id: string }>(
          `insert into checkin (id, credencial_id, ingresso_id, evento_id, equipe_id, ponto_leitura_id, portao, sentido, resultado, metodo, feito_em)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) on conflict (id) do nothing returning id`,
          [l.id, l.credencialId, l.ingressoId, eventoId, pessoaId, l.pontoId, portao, l.sentido, l.resultado, l.metodo, l.feitoEm]);
        if (r[0]) novas.push(r[0].id);
      }
      // Repetida: já havia entrada liberada, mais antiga, da mesma credencial no mesmo lugar (evento ou zona) em ponto de entrada única.
      const situacao = new Map((await tx.consultar<{ id: string; situacao: SituacaoLeitura }>(
        `select c.id, case when c.resultado = 'liberado' and c.sentido = 'entrada' and coalesce(p.modo, 'entrada_unica') = 'entrada_unica'
                 and exists (
                   select 1 from checkin k left join ponto_leitura pk on pk.id = k.ponto_leitura_id
                   where k.credencial_id = c.credencial_id and k.resultado = 'liberado' and k.sentido = 'entrada'
                     and pk.zona_id is not distinct from p.zona_id and coalesce(pk.modo, 'entrada_unica') = 'entrada_unica'
                     and (k.feito_em, k.id) < (c.feito_em, c.id))
               then 'repetida' else 'registrada' end as situacao
         from checkin c left join ponto_leitura p on p.id = c.ponto_leitura_id
         where c.evento_id = $1 and c.id = any ($2::uuid[])`, [eventoId, leituras.map((l) => l.id)])).map((r) => [r.id, r.situacao] as const));
      return { novas, situacao };
    })),
    async marcarSincronizado(pessoaId, pontoId) {
      await ler(pessoaId, 'select ponto_leitura_sincronizou($1)', [pontoId]);
    },
    hoje: (pessoaId, eventoId) => ler<PontoHoje & Record<string, unknown>>(pessoaId,
      `select p.id, p.nome, p.zona_id as "zonaId", z.nome as zona, p.tipo, p.modo, p.ativo, p.ultima_sinc_em as "ultimaSincEm",
              coalesce(e.entradas, 0) as entradas, coalesce(e.credenciais, 0) as credenciais, coalesce(e.saidas, 0) as saidas,
              coalesce(e.negadas, 0) as negadas, e.ultima_em as "ultimaLeituraEm"
       from ponto_leitura p
       left join zona z on z.id = p.zona_id
       left join lateral (
         select sum(x.entradas)::int as entradas, sum(x.credenciais)::int as credenciais, sum(x.saidas)::int as saidas,
                sum(x.negadas)::int as negadas, max(x.ultima_em) as ultima_em
         from entradas_por_ponto x where x.ponto_leitura_id = p.id) e on true
       where p.evento_id = $1 order by p.nome`, [eventoId]),
    async numeros(pessoaId, eventoId) {
      const [l] = await ler<Record<string, number>>(pessoaId,
        'select inscritos, credenciais, entradas, leituras_negadas as "leiturasNegadas" from numeros_do_evento($1)', [eventoId]);
      return l ?? {};
    },
    async minhas(pessoaId) {
      const linhas = await ler<{ id: string; ingresso_id: string | null; categoria: string; revogada: boolean; evento_id: string; slug: string; nome: string; inicio: string; fim: string; local: string; parceiro: string | null }>(
        pessoaId,
        `select c.id, c.ingresso_id, c.categoria::text as categoria, c.revogada_em is not null as revogada, e.id as evento_id, e.slug, e.nome,
                to_char(e.inicio, 'YYYY-MM-DD') as inicio, to_char(e.fim, 'YYYY-MM-DD') as fim, e.local,
                (select coalesce(pa.nome_fantasia, pa.razao_social) from parceiro_evento pe join parceiro pa on pa.id = pe.parceiro_id where pe.id = c.parceiro_evento_id) as parceiro
         from credencial c join evento e on e.id = c.evento_id
         where c.pessoa_id = $1 order by e.inicio desc, c.emitida_em`, [pessoaId]);
      return linhas.map((l): MinhaCredencial => ({
        id: l.id, ingressoId: l.ingresso_id, categoria: l.categoria as MinhaCredencial['categoria'], revogada: l.revogada,
        evento: { id: l.evento_id, slug: l.slug, nome: l.nome, inicio: l.inicio, fim: l.fim, local: l.local }, parceiro: l.parceiro,
      }));
    },
  };
}

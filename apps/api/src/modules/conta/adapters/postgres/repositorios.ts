/**
 * Adaptadores Postgres das portas do módulo conta. Cada operação abre a
 * própria transação com o contexto mínimo que a RLS exige (ADR 0002).
 */
import type { Banco } from '../../../../shared/db/banco.ts';
import type { Auditoria, RepositorioCodigos, RepositorioPessoas, RepositorioSessoes } from '../../application/portas.ts';

const bytes = (b: Uint8Array): Buffer => Buffer.from(b.buffer, b.byteOffset, b.byteLength);

export function repositorioCodigos(banco: Banco): RepositorioCodigos {
  return {
    async contarDesde(emailHash, desde) {
      const [linha] = await banco.transacao({}, (tx) =>
        tx.consultar<{ total: string }>('select count(*) as total from codigo_acesso where email_hash = $1 and criado_em >= $2', [bytes(emailHash), desde]));
      return Number(linha?.total ?? 0);
    },
    async salvar(d) {
      await banco.transacao({}, (tx) =>
        tx.consultar('insert into codigo_acesso (email_hash, codigo_hash, expira_em) values ($1, $2, $3)', [bytes(d.emailHash), bytes(d.codigoHash), d.expiraEm]));
    },
    async ultimoNaoUsado(emailHash) {
      const [l] = await banco.transacao({}, (tx) =>
        tx.consultar<{ id: string; codigo_hash: Buffer; expira_em: Date; tentativas: number }>(
          `select id, codigo_hash, expira_em, tentativas from codigo_acesso
           where email_hash = $1 and usado_em is null order by criado_em desc, id desc limit 1`, [bytes(emailHash)]));
      return l ? { id: l.id, codigoHash: l.codigo_hash, expiraEm: l.expira_em, tentativas: l.tentativas } : null;
    },
    async registrarErro(id) {
      const [l] = await banco.transacao({}, (tx) =>
        tx.consultar<{ tentativas: number }>('update codigo_acesso set tentativas = least(tentativas + 1, 5) where id = $1 returning tentativas', [id]));
      return l?.tentativas ?? 0;
    },
    async marcarUsado(id) {
      await banco.transacao({}, (tx) => tx.consultar('update codigo_acesso set usado_em = now() where id = $1', [id]));
    },
  };
}

export function repositorioPessoas(banco: Banco): RepositorioPessoas {
  return {
    async idPorEmailHash(emailHash) {
      const [l] = await banco.transacao({}, (tx) => tx.consultar<{ id: string | null }>('select pessoa_por_email_hash($1) as id', [bytes(emailHash)]));
      return l?.id ?? null;
    },
    async criar(d) {
      await banco.transacao({ pessoaId: d.id }, (tx) =>
        tx.consultar('insert into pessoa (id, email_cifrado, email_hash) values ($1, $2, $3)', [d.id, bytes(d.emailCifrado), bytes(d.emailHash)]));
    },
    async obter(id) {
      const [l] = await banco.transacao({ pessoaId: id }, (tx) =>
        tx.consultar<{ id: string; email_cifrado: Buffer; nome_cracha: string | null; criada_em: Date; termos: string[] }>(
          `select p.id, p.email_cifrado, p.nome_cracha, p.criada_em,
                  coalesce(array_agg(c.versao_termos order by c.versao_termos) filter (where c.versao_termos is not null), '{}') as termos
           from pessoa p left join consentimento c on c.pessoa_id = p.id
           where p.id = $1 and p.excluida_em is null group by p.id`, [id]));
      return l ? { id: l.id, emailCifrado: l.email_cifrado, nomeCracha: l.nome_cracha, criadaEm: l.criada_em, termosAceitos: l.termos } : null;
    },
    async concluirPrimeiroAcesso(id, nome, versao) {
      await banco.transacao({ pessoaId: id }, async (tx) => {
        await tx.consultar('update pessoa set nome_cracha = $2 where id = $1', [id, nome]);
        await tx.consultar('insert into consentimento (pessoa_id, versao_termos) values ($1, $2) on conflict do nothing', [id, versao]);
      });
    },
    async dadosParaExportar(id) {
      return banco.transacao({ pessoaId: id }, async (tx) => ({
        consentimentos: await tx.consultar('select versao_termos as "versaoTermos", aceito_em as "aceitoEm" from consentimento where pessoa_id = $1 order by aceito_em', [id]),
        sessoes: await tx.consultar(
          'select criada_em as "criadaEm", ultimo_uso_em as "ultimoUsoEm", expira_em as "expiraEm", revogada_em as "revogadaEm" from sessao where pessoa_id = $1 order by criada_em', [id]),
        organizacao: await tx.consultar(
          'select e.nome as evento, m.papel, m.criado_em as "desde" from membro_organizacao m join evento e on e.id = m.evento_id where m.pessoa_id = $1', [id]),
      }));
    },
    async excluir(id) {
      await banco.transacao({ pessoaId: id }, (tx) => tx.consultar('delete from pessoa where id = $1', [id]));
    },
  };
}

export function repositorioSessoes(banco: Banco): RepositorioSessoes {
  return {
    async criar(d) {
      await banco.transacao({ pessoaId: d.pessoaId }, (tx) =>
        tx.consultar('insert into sessao (pessoa_id, token_hash, expira_em) values ($1, $2, $3)', [d.pessoaId, bytes(d.tokenHash), d.expiraEm]));
    },
    async validar(tokenHash) {
      const [l] = await banco.transacao({}, (tx) =>
        tx.consultar<{ sessao_id: string; pessoa_id: string }>('select sessao_id, pessoa_id from sessao_validar($1)', [bytes(tokenHash)]));
      return l ? { sessaoId: l.sessao_id, pessoaId: l.pessoa_id } : null;
    },
    async revogar(pessoaId, sessaoId) {
      await banco.transacao({ pessoaId }, (tx) =>
        tx.consultar('update sessao set revogada_em = now() where id = $1 and revogada_em is null', [sessaoId]));
    },
  };
}

export function auditoriaPostgres(banco: Banco): Auditoria {
  return {
    async registrar(e) {
      await banco.transacao(e.atorId ? { pessoaId: e.atorId } : {}, (tx) =>
        tx.consultar('insert into auditoria (ator_id, acao, dados) values ($1, $2, $3)', [e.atorId, e.acao, e.dados ?? {}]));
    },
  };
}

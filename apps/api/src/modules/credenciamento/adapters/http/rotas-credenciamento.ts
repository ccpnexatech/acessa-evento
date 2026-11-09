/** Rotas da equipe de credenciamento. Participante sem papel recebe 403. */
import type { Roteador } from '../../../../shared/http/roteador.ts';
import { ErroHttp } from '../../../../shared/http/tipos.ts';
import type { Requisicao, Resposta } from '../../../../shared/http/tipos.ts';
import { ErroCredenciamento } from '../../domain/credenciamento.ts';
import type { CodigoErroCredenciamento } from '../../domain/credenciamento.ts';
import type { CredenciamentoServico } from '../../application/casos-de-uso.ts';
import type { Identificacao } from '../../../programacao/adapters/http/rotas-programacao.ts';

const STATUS: Readonly<Record<CodigoErroCredenciamento, number>> = { evento_inexistente: 404, sem_papel: 403, dados_invalidos: 422 };

function traduzir(m: (req: Requisicao) => Promise<Resposta>) {
  return async (req: Requisicao): Promise<Resposta> => {
    try {
      return await m(req);
    } catch (erro) {
      if (erro instanceof ErroCredenciamento) throw new ErroHttp(STATUS[erro.codigo], erro.codigo, erro.message);
      throw erro;
    }
  };
}

// Lista com nomes e pedidos de acessibilidade: nunca em cache compartilhado.
const PRIVADO = { 'cache-control': 'private, no-store' };

export function registrarRotasCredenciamento(roteador: Roteador, servico: CredenciamentoServico, id: Identificacao): void {
  roteador
    .registrar('GET', '/credenciamento/eventos', traduzir(async (req) => {
      const { pessoaId } = await id.exigir(req);
      return { status: 200, cabecalhos: PRIVADO, corpo: { eventos: await servico.eventos(pessoaId) } };
    }))
    .registrar('GET', '/credenciamento/:slug/pacote', traduzir(async (req) => {
      const { pessoaId } = await id.exigir(req);
      return { status: 200, cabecalhos: PRIVADO, corpo: await servico.pacote(pessoaId, req.parametros['slug'] ?? '') };
    }))
    .registrar('POST', '/credenciamento/:slug/checkins', traduzir(async (req) => {
      const { pessoaId } = await id.exigir(req);
      return { status: 200, cabecalhos: PRIVADO, corpo: { resultado: await servico.sincronizar(pessoaId, req.parametros['slug'] ?? '', req.corpo) } };
    }));
}

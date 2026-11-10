/**
 * Rotas do assistente. Leitura e avaliação não exigem login; publicar exige
 * papel de admin ou conteudo. A leitura usa ETag com o número da versão.
 */
import type { Roteador } from '../../../../shared/http/roteador.ts';
import { ErroHttp } from '../../../../shared/http/tipos.ts';
import type { Requisicao, Resposta } from '../../../../shared/http/tipos.ts';
import { ErroAssistente } from '../../application/casos-de-uso.ts';
import type { AssistenteServico, CodigoErroAssistente } from '../../application/casos-de-uso.ts';
import type { Identificacao } from '../../../programacao/adapters/http/rotas-programacao.ts';

const STATUS: Readonly<Record<CodigoErroAssistente, number>> = { evento_inexistente: 404, sem_assistente: 404, sem_papel: 403, dados_invalidos: 422 };

function traduzir(m: (req: Requisicao) => Promise<Resposta>) {
  return async (req: Requisicao): Promise<Resposta> => {
    try {
      return await m(req);
    } catch (erro) {
      if (erro instanceof ErroAssistente) throw new ErroHttp(STATUS[erro.codigo], erro.codigo, erro.message);
      throw erro;
    }
  };
}

export function registrarRotasAssistente(roteador: Roteador, servico: AssistenteServico, id: Identificacao): void {
  roteador
    .registrar('GET', '/eventos/:slug/assistente', traduzir(async (req) => {
      const pessoa = await id.opcional(req);
      const a = await servico.atual(req.parametros['slug'] ?? '', pessoa?.pessoaId ?? null);
      const etag = `"v${a.versao}"`;
      const cabecalhos = { etag, 'cache-control': 'no-cache' };
      if (req.cabecalhos['if-none-match'] === etag) return { status: 304, cabecalhos };
      return { status: 200, cabecalhos, corpo: a };
    }))
    .registrar('PUT', '/eventos/:slug/assistente', traduzir(async (req) => {
      const { pessoaId } = await id.exigir(req);
      return { status: 201, corpo: { versao: await servico.publicar(pessoaId, req.parametros['slug'] ?? '', req.corpo) } };
    }))
    .registrar('POST', '/eventos/:slug/assistente/avaliacoes', traduzir(async (req) => {
      await servico.avaliar(req.parametros['slug'] ?? '', req.corpo);
      return { status: 204 };
    }));
}

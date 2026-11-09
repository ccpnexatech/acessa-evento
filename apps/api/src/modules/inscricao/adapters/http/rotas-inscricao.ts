/**
 * Rotas de descoberta, inscrição e ingressos.
 * POST de inscrição exige Idempotency-Key: repetir a mesma chave devolve o
 * mesmo resultado (200) em vez de criar outra cobrança (201).
 */
import type { Roteador } from '../../../../shared/http/roteador.ts';
import { ErroHttp } from '../../../../shared/http/tipos.ts';
import type { Requisicao, Resposta } from '../../../../shared/http/tipos.ts';
import { ErroInscricao } from '../../domain/inscricao.ts';
import type { CodigoErroInscricao } from '../../domain/inscricao.ts';
import type { InscricaoServico } from '../../application/casos-de-uso.ts';
import type { Identificacao } from '../../../programacao/adapters/http/rotas-programacao.ts';

const STATUS: Readonly<Record<CodigoErroInscricao, number>> = {
  evento_inexistente: 404,
  tipo_inexistente: 422,
  dados_invalidos: 422,
  chave_invalida: 400,
  inscricoes_fechadas: 409,
  esgotado: 409,
  ja_inscrito: 409,
  pagamento_recusado: 402,
};

function traduzir(m: (req: Requisicao) => Promise<Resposta>) {
  return async (req: Requisicao): Promise<Resposta> => {
    try {
      return await m(req);
    } catch (erro) {
      if (erro instanceof ErroInscricao) throw new ErroHttp(STATUS[erro.codigo], erro.codigo, erro.message);
      throw erro;
    }
  };
}

export function registrarRotasInscricao(roteador: Roteador, servico: InscricaoServico, id: Identificacao): void {
  roteador
    .registrar('GET', '/eventos', traduzir(async (req) => ({
      status: 200,
      cabecalhos: { 'cache-control': 'public, max-age=60' },
      corpo: { eventos: await servico.eventos(req.consulta.get('recurso')) },
    })))
    .registrar('GET', '/eventos/:slug', traduzir(async (req) => {
      const pessoa = await id.opcional(req);
      // Vagas mudam a todo momento: nada de cache aqui.
      return { status: 200, cabecalhos: { 'cache-control': 'no-store' }, corpo: await servico.evento(req.parametros['slug'] ?? '', pessoa?.pessoaId ?? null) };
    }))
    .registrar('POST', '/eventos/:slug/inscricoes', traduzir(async (req) => {
      const { pessoaId } = await id.exigir(req);
      const r = await servico.inscrever(pessoaId, req.parametros['slug'] ?? '', req.cabecalhos['idempotency-key'], req.corpo);
      return { status: r.novo ? 201 : 200, corpo: { pedido: r.pedido, ingresso: r.ingresso } };
    }))
    .registrar('GET', '/ingressos', traduzir(async (req) => {
      const { pessoaId } = await id.exigir(req);
      return { status: 200, cabecalhos: { 'cache-control': 'private, no-store' }, corpo: { ingressos: await servico.ingressos(pessoaId) } };
    }));
}

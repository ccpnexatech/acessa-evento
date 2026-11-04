/**
 * Rotas da agenda e dos favoritos.
 * A agenda usa ETag: o app manda If-None-Match e recebe 304 sem corpo
 * quando nada mudou, o que deixa a sincronização barata no evento.
 */
import type { Roteador } from '../../../../shared/http/roteador.ts';
import { ErroHttp } from '../../../../shared/http/tipos.ts';
import type { Requisicao, Resposta } from '../../../../shared/http/tipos.ts';
import { ErroProgramacao } from '../../domain/programacao.ts';
import type { ProgramacaoServico } from '../../application/casos-de-uso.ts';

/** Quem é a pessoa da requisição; injetado pela raiz de composição. */
export interface Identificacao {
  exigir(req: Requisicao): Promise<{ pessoaId: string }>;
  opcional(req: Requisicao): Promise<{ pessoaId: string } | null>;
}

function traduzir(m: (req: Requisicao) => Promise<Resposta>) {
  return async (req: Requisicao): Promise<Resposta> => {
    try {
      return await m(req);
    } catch (erro) {
      if (erro instanceof ErroProgramacao) throw new ErroHttp(404, erro.codigo, erro.message);
      throw erro;
    }
  };
}

const param = (req: Requisicao, nome: string): string => req.parametros[nome] ?? '';
const etag = (versao: string): string => `"${versao}"`;

export function registrarRotasProgramacao(roteador: Roteador, servico: ProgramacaoServico, id: Identificacao): void {
  roteador
    .registrar('GET', '/eventos/:slug/agenda', traduzir(async (req) => {
      const pessoa = await id.opcional(req);
      const conhecida = /^"([0-9a-f]{32})"$/.exec(req.cabecalhos['if-none-match'] ?? '')?.[1] ?? null;
      const r = await servico.agenda(param(req, 'slug'), pessoa?.pessoaId ?? null, conhecida);
      // Rascunho visto por quem organiza não pode ir para cache compartilhado.
      const cabecalhos = { etag: etag(r.versao), 'cache-control': pessoa ? 'private, no-cache' : 'public, no-cache' };
      if (!r.modificada) return { status: 304, cabecalhos };
      return { status: 200, cabecalhos, corpo: { evento: r.evento, atividades: r.atividades, versao: r.versao } };
    }))
    .registrar('GET', '/eventos/:slug/favoritos', traduzir(async (req) => {
      const { pessoaId } = await id.exigir(req);
      return { status: 200, corpo: { atividades: await servico.favoritos(param(req, 'slug'), pessoaId) } };
    }))
    .registrar('PUT', '/favoritos/:atividadeId', traduzir(async (req) => {
      const { pessoaId } = await id.exigir(req);
      await servico.favoritar(pessoaId, param(req, 'atividadeId'));
      return { status: 204 };
    }))
    .registrar('DELETE', '/favoritos/:atividadeId', traduzir(async (req) => {
      const { pessoaId } = await id.exigir(req);
      await servico.desfavoritar(pessoaId, param(req, 'atividadeId'));
      return { status: 204 };
    }));
}

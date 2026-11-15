/** Rotas de organização, evento, equipe e convite da área do organizador. */
import type { Roteador } from '../../../../shared/http/roteador.ts';
import { PRIVADO, param, traduzirDominio } from '../../../../shared/http/dominio.ts';
import type { Requisicao, Resposta } from '../../../../shared/http/tipos.ts';
import type { OrganizacaoServico } from '../../application/organizacao.ts';
import type { Identificacao } from '../../../programacao/adapters/http/rotas-programacao.ts';

export function registrarRotasOrganizacao(roteador: Roteador, s: OrganizacaoServico, id: Identificacao): void {
  /** Toda rota exige sessão; o manipulador recebe a pessoa e devolve status e corpo. */
  const rota = (m: (pessoaId: string, req: Requisicao) => Promise<[number, unknown?]>) => traduzirDominio(async (req): Promise<Resposta> => {
    const { pessoaId } = await id.exigir(req);
    const [status, corpo] = await m(pessoaId, req);
    return corpo === undefined ? { status } : { status, cabecalhos: PRIVADO, corpo };
  });
  roteador
    .registrar('GET', '/organizador/inicio', rota(async (p) => [200, await s.inicio(p)]))
    .registrar('POST', '/organizador/organizacoes', rota(async (p, req) => [201, await s.criarOrganizacao(p, req.corpo)]))
    .registrar('POST', '/organizador/organizacoes/:organizacaoId/eventos', rota(async (p, req) => [201, await s.criarEvento(p, param(req, 'organizacaoId'), req.corpo)]))
    .registrar('POST', '/organizador/organizacoes/:organizacaoId/convites', rota(async (p, req) => [201, await s.convidarParaOrganizacao(p, param(req, 'organizacaoId'), req.corpo)]))
    .registrar('GET', '/organizador/eventos/:slug', rota(async (p, req) => [200, await s.evento(p, param(req, 'slug'))]))
    .registrar('PATCH', '/organizador/eventos/:slug', rota(async (p, req) => {
      await s.alterarEvento(p, param(req, 'slug'), req.corpo);
      return [204];
    }))
    .registrar('GET', '/organizador/eventos/:slug/equipe', rota(async (p, req) => [200, await s.equipe(p, param(req, 'slug'))]))
    .registrar('PUT', '/organizador/eventos/:slug/equipe/:pessoaId', rota(async (p, req) => {
      await s.definirMembro(p, param(req, 'slug'), param(req, 'pessoaId'), req.corpo);
      return [204];
    }))
    .registrar('DELETE', '/organizador/eventos/:slug/equipe/:pessoaId', rota(async (p, req) => {
      await s.removerMembro(p, param(req, 'slug'), param(req, 'pessoaId'));
      return [204];
    }))
    .registrar('POST', '/organizador/eventos/:slug/convites', rota(async (p, req) => [201, await s.convidarParaEvento(p, param(req, 'slug'), req.corpo)]))
    .registrar('DELETE', '/organizador/convites/:id', rota(async (p, req) => {
      await s.revogarConvite(p, param(req, 'id'));
      return [204];
    }))
    .registrar('GET', '/convites', rota(async (p) => [200, { convites: await s.convites(p) }]))
    .registrar('POST', '/convites/:id/aceitar', rota(async (p, req) => {
      await s.aceitarConvite(p, param(req, 'id'));
      return [204];
    }));
}

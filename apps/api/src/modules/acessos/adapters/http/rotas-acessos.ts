/** Rotas do controle de acesso: organização (regras, credenciais, hoje), leitor (pacote, leituras, meia) e participante (minhas credenciais). */
import type { Roteador } from '../../../../shared/http/roteador.ts';
import { PRIVADO, param, traduzirDominio } from '../../../../shared/http/dominio.ts';
import type { Requisicao, Resposta } from '../../../../shared/http/tipos.ts';
import type { AcessosServico } from '../../application/acessos.ts';
import type { Identificacao } from '../../../programacao/adapters/http/rotas-programacao.ts';

export function registrarRotasAcessos(roteador: Roteador, s: AcessosServico, id: Identificacao): void {
  const rota = (m: (pessoaId: string, req: Requisicao) => Promise<[number, unknown?]>) => traduzirDominio(async (req): Promise<Resposta> => {
    const { pessoaId } = await id.exigir(req);
    const [status, corpo] = await m(pessoaId, req);
    return corpo === undefined ? { status } : { status, cabecalhos: PRIVADO, corpo };
  });
  const sem = (trabalho: Promise<void>): Promise<[number]> => trabalho.then(() => [204]);
  const EV = '/organizador/eventos/:slug';
  roteador
    .registrar('GET', `${EV}/regras-zona`, rota(async (p, req) => [200, await s.regras(p, param(req, 'slug'))]))
    .registrar('PUT', `${EV}/zonas/:zonaId/regras`, rota((p, req) => sem(s.definirRegras(p, param(req, 'slug'), param(req, 'zonaId'), req.corpo))))
    .registrar('GET', `${EV}/credenciais`, rota(async (p, req) => [200, await s.credenciais(p, param(req, 'slug'))]))
    .registrar('POST', `${EV}/credenciais`, rota(async (p, req) => [201, await s.emitir(p, param(req, 'slug'), req.corpo)]))
    .registrar('POST', `${EV}/credenciais/:id/revogar`, rota((p, req) => sem(s.revogar(p, param(req, 'slug'), param(req, 'id'), req.corpo))))
    .registrar('PUT', `${EV}/credenciais/:id/excecoes/:zonaId`, rota((p, req) => sem(s.definirExcecao(p, param(req, 'slug'), param(req, 'id'), param(req, 'zonaId'), req.corpo))))
    .registrar('DELETE', `${EV}/credenciais/:id/excecoes/:zonaId`, rota((p, req) => sem(s.removerExcecao(p, param(req, 'slug'), param(req, 'id'), param(req, 'zonaId')))))
    .registrar('GET', `${EV}/hoje`, rota(async (p, req) => [200, await s.hoje(p, param(req, 'slug'))]))
    .registrar('GET', '/acessos/:slug/pacote', rota(async (p, req) => [200, await s.pacote(p, param(req, 'slug'))]))
    .registrar('POST', '/acessos/:slug/leituras', rota(async (p, req) => [200, { resultado: await s.sincronizar(p, param(req, 'slug'), req.corpo) }]))
    .registrar('POST', '/acessos/:slug/meias/:id/conferir', rota((p, req) => sem(s.conferirMeia(p, param(req, 'slug'), param(req, 'id'), req.corpo))))
    .registrar('GET', '/credenciais', rota(async (p) => [200, await s.minhas(p)]));
}

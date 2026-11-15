/** Rotas da feira (organização), do portal do expositor, dos contratos e da lista pública de expositores. */
import type { Roteador } from '../../../../shared/http/roteador.ts';
import { PRIVADO, param, traduzirDominio } from '../../../../shared/http/dominio.ts';
import type { Requisicao, Resposta } from '../../../../shared/http/tipos.ts';
import type { FeiraServico } from '../../application/feira.ts';
import type { Identificacao } from '../../../programacao/adapters/http/rotas-programacao.ts';

export function registrarRotasFeira(roteador: Roteador, s: FeiraServico, id: Identificacao): void {
  const rota = (m: (pessoaId: string, req: Requisicao) => Promise<[number, unknown?]>) => traduzirDominio(async (req): Promise<Resposta> => {
    const { pessoaId } = await id.exigir(req);
    const [status, corpo] = await m(pessoaId, req);
    return corpo === undefined ? { status } : { status, cabecalhos: PRIVADO, corpo };
  });
  const sem = (trabalho: Promise<unknown>): Promise<[number]> => trabalho.then(() => [204]);
  const p = param;
  const EV = '/organizador/eventos/:slug';
  roteador
    // Organização
    .registrar('GET', `${EV}/feira`, rota(async (q, req) => [200, await s.feira(q, p(req, 'slug'))]))
    .registrar('POST', `${EV}/montagens/:parceiroEventoId/analisar`, rota((q, req) => sem(s.analisarMontagem(q, p(req, 'slug'), p(req, 'parceiroEventoId'), req.corpo))))
    .registrar('PATCH', `${EV}/pedidos-servico/:id`, rota((q, req) => sem(s.situacaoDoPedido(q, p(req, 'slug'), p(req, 'id'), req.corpo))))
    .registrar('GET', `${EV}/contratos`, rota(async (q, req) => [200, await s.contratos(q, p(req, 'slug'))]))
    .registrar('POST', `${EV}/contratos`, rota(async (q, req) => [201, await s.criarContrato(q, p(req, 'slug'), req.corpo)]))
    .registrar('PATCH', `${EV}/contratos/:id`, rota((q, req) => sem(s.alterarContrato(q, p(req, 'slug'), p(req, 'id'), req.corpo))))
    .registrar('POST', '/organizador/contratos/:id/enviar', rota((q, req) => sem(s.enviarContrato(q, p(req, 'id')))))
    .registrar('POST', '/organizador/contratos/:id/cancelar', rota((q, req) => sem(s.cancelarContrato(q, p(req, 'id')))))
    .registrar('POST', '/organizador/contratos/:id/registrar-assinatura', rota((q, req) => sem(s.assinarContrato(q, p(req, 'id'), req.corpo, true))))
    // Portal do parceiro (a organização também usa, em nome do parceiro)
    .registrar('GET', '/portal', rota(async (q) => [200, { participacoes: await s.portal(q) }]))
    .registrar('GET', '/portal/:id', rota(async (q, req) => [200, await s.participacao(q, p(req, 'id'))]))
    .registrar('PUT', '/portal/:id/estandes/:estandeId', rota((q, req) => sem(s.reservar(q, p(req, 'id'), p(req, 'estandeId')))))
    .registrar('DELETE', '/portal/:id/estandes/:estandeId', rota((q, req) => sem(s.liberar(q, p(req, 'id'), p(req, 'estandeId')))))
    .registrar('PUT', '/portal/:id/perfil', rota((q, req) => sem(s.salvarPerfil(q, p(req, 'id'), req.corpo))))
    .registrar('PUT', '/portal/:id/servicos/:servicoId', rota(async (q, req) => [200, await s.pedirServico(q, p(req, 'id'), p(req, 'servicoId'), req.corpo)]))
    .registrar('DELETE', '/portal/:id/servicos/:servicoId', rota((q, req) => sem(s.cancelarPedido(q, p(req, 'id'), p(req, 'servicoId')))))
    .registrar('PUT', '/portal/:id/montagem', rota(async (q, req) => [200, await s.salvarMontagem(q, p(req, 'id'), req.corpo)]))
    .registrar('POST', '/portal/:id/convites', rota(async (q, req) => [201, await s.convidar(q, p(req, 'id'), req.corpo)]))
    .registrar('POST', '/portal/:id/credenciais', rota(async (q, req) => [201, await s.emitirCredencial(q, p(req, 'id'), req.corpo)]))
    // Contratos de quem é contratado
    .registrar('GET', '/contratos', rota(async (q) => [200, await s.meusContratos(q)]))
    .registrar('POST', '/contratos/:id/assinar', rota((q, req) => sem(s.assinarContrato(q, p(req, 'id'), req.corpo, false))))
    // Público: lista de expositores e mapa da feira
    .registrar('GET', '/eventos/:slug/expositores', traduzirDominio(async (req) => {
      const pessoa = await id.opcional(req);
      return {
        status: 200,
        cabecalhos: { 'cache-control': pessoa ? 'private, no-cache' : 'public, max-age=60' },
        corpo: await s.expositores(pessoa?.pessoaId ?? null, p(req, 'slug')),
      };
    }));
}

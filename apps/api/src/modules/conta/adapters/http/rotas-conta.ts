/**
 * Rotas HTTP do acesso e da conta. Traduz a requisição para os casos de uso
 * e os ErroConta para status HTTP estáveis. Nenhuma regra de negócio aqui.
 */
import type { Roteador } from '../../../../shared/http/roteador.ts';
import { ErroHttp } from '../../../../shared/http/tipos.ts';
import type { Requisicao, Resposta } from '../../../../shared/http/tipos.ts';
import { ErroConta } from '../../domain/regras.ts';
import type { CodigoErroConta } from '../../domain/regras.ts';
import { Autenticar, Entrar, PedirCodigo } from '../../application/acesso.ts';
import type { Sessao } from '../../application/acesso.ts';
import { ConcluirPrimeiroAcesso, ExcluirConta, ExportarConta, ObterConta, Sair } from '../../application/conta.ts';
import type { DependenciasConta } from '../../application/portas.ts';

const STATUS: Readonly<Record<CodigoErroConta, number>> = {
  email_invalido: 422,
  nome_invalido: 422,
  codigo_invalido: 422,
  consentimento_obrigatorio: 422,
  codigo_vencido: 410,
  termos_desatualizados: 409,
  muitos_pedidos: 429,
  codigo_bloqueado: 429,
  sessao_invalida: 401,
  conta_inexistente: 404,
};

const campos = (corpo: unknown): Record<string, unknown> =>
  typeof corpo === 'object' && corpo !== null && !Array.isArray(corpo) ? (corpo as Record<string, unknown>) : {};

function traduzir(manipulador: (req: Requisicao) => Promise<Resposta>) {
  return async (req: Requisicao): Promise<Resposta> => {
    try {
      return await manipulador(req);
    } catch (erro) {
      if (erro instanceof ErroConta) throw new ErroHttp(STATUS[erro.codigo], erro.codigo, erro.message);
      throw erro;
    }
  };
}

export function registrarRotasConta(roteador: Roteador, d: DependenciasConta): void {
  const autenticar = new Autenticar(d);
  const sessaoDe = (req: Requisicao): Promise<Sessao> => {
    const [tipo, token] = (req.cabecalhos['authorization'] ?? '').split(' ');
    return autenticar.executar(tipo?.toLowerCase() === 'bearer' ? token : undefined);
  };
  const pedir = new PedirCodigo(d);
  const entrar = new Entrar(d);
  const obter = new ObterConta(d);
  const concluir = new ConcluirPrimeiroAcesso(d);
  const exportar = new ExportarConta(d);
  const excluir = new ExcluirConta(d);
  const sair = new Sair(d);

  roteador
    .registrar('POST', '/acesso/codigo', traduzir(async (req) => {
      const { expiraEm } = await pedir.executar({ email: campos(req.corpo)['email'] });
      return { status: 202, corpo: { expiraEm: expiraEm.toISOString() } };
    }))
    .registrar('POST', '/acesso/entrar', traduzir(async (req) => {
      const c = campos(req.corpo);
      const r = await entrar.executar({ email: c['email'], codigo: c['codigo'] });
      return { status: 200, corpo: { token: r.token, expiraEm: r.expiraEm.toISOString(), primeiroAcesso: r.primeiroAcesso } };
    }))
    .registrar('POST', '/acesso/sair', traduzir(async (req) => {
      await sair.executar(await sessaoDe(req));
      return { status: 204 };
    }))
    .registrar('GET', '/conta', traduzir(async (req) => ({ status: 200, corpo: await obter.executar(await sessaoDe(req)) })))
    .registrar('PUT', '/conta/primeiro-acesso', traduzir(async (req) => {
      const c = campos(req.corpo);
      const conta = await concluir.executar(await sessaoDe(req), { nomeCracha: c['nomeCracha'], aceitaTermos: c['aceitaTermos'], versaoTermos: c['versaoTermos'] });
      return { status: 200, corpo: conta };
    }))
    .registrar('GET', '/conta/exportacao', traduzir(async (req) => ({
      status: 200,
      corpo: await exportar.executar(await sessaoDe(req)),
      cabecalhos: { 'content-disposition': 'attachment; filename="meus-dados-acessa-evento.json"' },
    })))
    .registrar('DELETE', '/conta', traduzir(async (req) => {
      await excluir.executar(await sessaoDe(req));
      return { status: 204 };
    }));
}

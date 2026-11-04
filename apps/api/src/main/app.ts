/**
 * Raiz de composição: o único lugar que conhece todas as implementações
 * concretas e as liga às portas. Trocar uma peça = mudar só aqui.
 */
import type { Server } from 'node:http';
import { Roteador } from '../shared/http/roteador.ts';
import { criarServidor } from '../shared/http/servidor.ts';
import type { Logger } from '../shared/logger.ts';
import type { Banco } from '../shared/db/banco.ts';
import { CifradorAesGcm } from '../shared/cripto/aes-gcm.ts';
import { verificadorBanco } from '../shared/db/verificador-banco.ts';
import { ConsultarSaude } from '../modules/saude/application/consultar-saude.ts';
import type { Relogio, VerificadorDependencia } from '../modules/saude/application/ports.ts';
import { registrarRotasSaude } from '../modules/saude/adapters/http/rotas-saude.ts';
import type { DependenciasConta } from '../modules/conta/application/portas.ts';
import { registrarRotasConta } from '../modules/conta/adapters/http/rotas-conta.ts';
import { auditoriaPostgres, repositorioCodigos, repositorioPessoas, repositorioSessoes } from '../modules/conta/adapters/postgres/repositorios.ts';
import { enviadorDesenvolvimento, enviadorResend } from '../modules/conta/adapters/email.ts';
import { aleatorioSeguro } from '../modules/conta/adapters/aleatorio.ts';
import { Autenticar } from '../modules/conta/application/acesso.ts';
import { ProgramacaoServico } from '../modules/programacao/application/casos-de-uso.ts';
import type { RepositorioProgramacao } from '../modules/programacao/application/casos-de-uso.ts';
import { repositorioProgramacao } from '../modules/programacao/adapters/postgres/repositorio.ts';
import { registrarRotasProgramacao } from '../modules/programacao/adapters/http/rotas-programacao.ts';
import type { Identificacao } from '../modules/programacao/adapters/http/rotas-programacao.ts';
import { ErroHttp } from '../shared/http/tipos.ts';
import type { Requisicao } from '../shared/http/tipos.ts';
import { ErroConta } from '../modules/conta/domain/regras.ts';
import type { Config, ConfigBanco } from './config.ts';

export interface Dependencias {
  readonly config: Config;
  readonly logger: Logger;
  readonly relogio: Relogio;
  readonly versao: string;
  readonly verificadores?: readonly VerificadorDependencia[];
  /** Módulo conta; ausente quando a API sobe sem banco. */
  readonly conta?: DependenciasConta;
  /** Programação; exige o módulo conta para identificar a pessoa. */
  readonly programacao?: RepositorioProgramacao;
}

/** Identifica a pessoa pelo token Bearer, usando o caso de uso do módulo conta. */
export function identificacao(conta: DependenciasConta): Identificacao {
  const autenticar = new Autenticar(conta);
  const token = (req: Requisicao): string | undefined => {
    const [tipo, valor] = (req.cabecalhos['authorization'] ?? '').split(' ');
    return tipo?.toLowerCase() === 'bearer' ? valor : undefined;
  };
  const exigir = async (req: Requisicao) => {
    try {
      return { pessoaId: (await autenticar.executar(token(req))).pessoaId };
    } catch (erro) {
      if (erro instanceof ErroConta) throw new ErroHttp(401, erro.codigo, erro.message);
      throw erro;
    }
  };
  return {
    exigir,
    opcional: async (req) => (req.cabecalhos['authorization'] ? exigir(req) : null),
  };
}

export function criarApp(d: Dependencias): Server {
  const roteador = new Roteador();

  registrarRotasSaude(
    roteador,
    new ConsultarSaude(d.verificadores ?? [], d.relogio, { versao: d.versao, iniciadoEmMs: d.relogio.agoraMs(), limiteMs: 2_000 }),
  );
  if (d.conta) registrarRotasConta(roteador, d.conta);
  if (d.conta && d.programacao) {
    registrarRotasProgramacao(roteador, new ProgramacaoServico(d.programacao), identificacao(d.conta));
  }

  return criarServidor({
    roteador,
    logger: d.logger,
    corsOrigens: d.config.corsOrigens,
    producao: d.config.ambiente === 'producao',
  });
}

/** Liga as portas do módulo conta às implementações reais (Postgres, e-mail, node:crypto). */
export function dependenciasConta(banco: Banco, config: ConfigBanco, logger: Logger): DependenciasConta {
  return {
    codigos: repositorioCodigos(banco),
    pessoas: repositorioPessoas(banco),
    sessoes: repositorioSessoes(banco),
    auditoria: auditoriaPostgres(banco),
    email: config.email.provedor === 'resend'
      ? enviadorResend({ chave: config.email.chave, remetente: config.email.remetente })
      : enviadorDesenvolvimento(logger),
    protecao: new CifradorAesGcm(config.chaves),
    aleatorio: aleatorioSeguro,
    relogio: { agora: () => new Date() },
  };
}

export const dependenciasProgramacao = (banco: Banco): RepositorioProgramacao => repositorioProgramacao(banco);

export const verificadoresPadrao = (banco: Banco | undefined): VerificadorDependencia[] => (banco ? [verificadorBanco(banco)] : []);

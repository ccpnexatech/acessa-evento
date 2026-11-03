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
import type { Config, ConfigBanco } from './config.ts';

export interface Dependencias {
  readonly config: Config;
  readonly logger: Logger;
  readonly relogio: Relogio;
  readonly versao: string;
  readonly verificadores?: readonly VerificadorDependencia[];
  /** Módulo conta; ausente quando a API sobe sem banco. */
  readonly conta?: DependenciasConta;
}

export function criarApp(d: Dependencias): Server {
  const roteador = new Roteador();

  registrarRotasSaude(
    roteador,
    new ConsultarSaude(d.verificadores ?? [], d.relogio, { versao: d.versao, iniciadoEmMs: d.relogio.agoraMs(), limiteMs: 2_000 }),
  );
  if (d.conta) registrarRotasConta(roteador, d.conta);

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

export const verificadoresPadrao = (banco: Banco | undefined): VerificadorDependencia[] => (banco ? [verificadorBanco(banco)] : []);

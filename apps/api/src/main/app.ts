/**
 * Raiz de composição: o único lugar que conhece todas as implementações
 * concretas e as liga às portas. Trocar uma peça = mudar só aqui.
 */
import type { Server } from 'node:http';
import { Roteador } from '../shared/http/roteador.ts';
import { criarServidor } from '../shared/http/servidor.ts';
import type { Logger } from '../shared/logger.ts';
import { ConsultarSaude } from '../modules/saude/application/consultar-saude.ts';
import type { Relogio, VerificadorDependencia } from '../modules/saude/application/ports.ts';
import { registrarRotasSaude } from '../modules/saude/adapters/http/rotas-saude.ts';
import type { Config } from './config.ts';

export interface Dependencias {
  readonly config: Config;
  readonly logger: Logger;
  readonly relogio: Relogio;
  readonly versao: string;
  readonly verificadores?: readonly VerificadorDependencia[];
}

export function criarApp(d: Dependencias): Server {
  const roteador = new Roteador();

  registrarRotasSaude(
    roteador,
    new ConsultarSaude(d.verificadores ?? [], d.relogio, { versao: d.versao, iniciadoEmMs: d.relogio.agoraMs(), limiteMs: 2_000 }),
  );

  return criarServidor({
    roteador,
    logger: d.logger,
    corsOrigens: d.config.corsOrigens,
    producao: d.config.ambiente === 'producao',
  });
}

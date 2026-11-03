/** Adaptador da porta Aleatorio com o gerador criptográfico do Node. */
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import type { Aleatorio } from '../application/portas.ts';

export const aleatorioSeguro: Aleatorio = {
  codigoSeisDigitos: () => String(randomInt(0, 1_000_000)).padStart(6, '0'),
  token: () => randomBytes(32).toString('base64url'),
  uuid: () => randomUUID(),
};

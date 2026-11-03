import type { Roteador } from '../../../../shared/http/roteador.ts';
import type { ConsultarSaude } from '../../application/consultar-saude.ts';

/**
 * GET /saude — usado pelo monitor de disponibilidade (ADR 0010).
 * 200 quando ok ou degradado; 503 quando alguma dependência falhou.
 */
export function registrarRotasSaude(roteador: Roteador, consultar: ConsultarSaude): void {
  roteador.registrar('GET', '/saude', async () => {
    const relatorio = await consultar.executar();
    return { status: relatorio.estado === 'falha' ? 503 : 200, corpo: relatorio };
  });
}

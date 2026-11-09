/**
 * Provedor de pagamento simulado (ADR 0007): determinístico e idempotente.
 * Pix aprova. Cartão terminado em 0002 é recusado, como nos cartões de teste
 * dos gateways; os demais aprovam. Nenhum dinheiro é cobrado.
 */
import type { Cobranca, ProvedorPagamento } from '../application/casos-de-uso.ts';

export const CARTAO_RECUSADO_FINAL = '0002';

export function pagamentoSimulado(): ProvedorPagamento & { readonly cobrancas: number } {
  const resultados = new Map<string, { aprovado: boolean; referencia: string }>();
  let cobrancas = 0;
  return {
    get cobrancas() {
      return cobrancas;
    },
    async cobrar(c: Cobranca) {
      const anterior = resultados.get(c.chave);
      if (anterior) return anterior;
      cobrancas++;
      const aprovado = c.metodo === 'pix' || !c.cartao?.numero.endsWith(CARTAO_RECUSADO_FINAL);
      const r = { aprovado, referencia: `sim_${c.chave.slice(0, 24)}` };
      resultados.set(c.chave, r);
      return r;
    },
  };
}

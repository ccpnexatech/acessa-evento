/** Recibo da inscrição por e-mail. O endereço vem do módulo conta, já decifrado. */
import type { NotificadorInscricao, Recibo } from '../application/casos-de-uso.ts';

export interface Correio {
  emailDe(pessoaId: string): Promise<string | null>;
  enviar(para: string, assunto: string, texto: string): Promise<void>;
}

export const reais = (centavos: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);

export function textoRecibo(r: Recibo): { assunto: string; texto: string } {
  return {
    assunto: `Você está no ${r.evento}`,
    texto: [
      `Sua inscrição no ${r.evento} está confirmada.`,
      '',
      `Ingresso: ${r.tipo}`,
      `Valor: ${reais(r.valorCentavos)} (${r.metodo === 'pix' ? 'Pix' : 'cartão'})`,
      `Pedido: ${r.pedidoId}`,
      '',
      'Ambiente de teste: nenhum dinheiro foi cobrado.',
      'Seu ingresso está no app, na aba Ingresso, e funciona sem internet.',
    ].join('\n'),
  };
}

export function notificadorPorEmail(correio: Correio): NotificadorInscricao {
  return {
    async recibo(pessoaId, r) {
      const para = await correio.emailDe(pessoaId);
      if (!para) return;
      const { assunto, texto } = textoRecibo(r);
      await correio.enviar(para, assunto, texto);
    },
  };
}

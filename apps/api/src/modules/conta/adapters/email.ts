/**
 * Adaptadores da porta EnviadorEmail.
 * - dev: escreve o código no log local (nunca em produção);
 * - resend: API HTTP da Resend, chamada com o fetch nativo.
 */
import type { EnviadorEmail } from '../application/portas.ts';
import type { Logger } from '../../../shared/logger.ts';

export function assuntoECorpo(codigo: string): { assunto: string; texto: string } {
  return {
    assunto: `Seu código de acesso: ${codigo}`,
    texto: [
      `Seu código de acesso é ${codigo.split('').join(' ')}.`,
      '',
      'Ele vale por 10 minutos e só pode ser usado uma vez.',
      'Se você não pediu este código, ignore este e-mail. Ninguém entra na sua conta sem ele.',
    ].join('\n'),
  };
}

export function enviadorDesenvolvimento(logger: Logger): EnviadorEmail {
  return {
    async enviarCodigo(email, codigo) {
      // O logger censura "email" e "codigo"; aqui o código aparece de propósito, só em desenvolvimento.
      logger.log('info', 'email_dev', { para: email.replace(/^(.).*(@.*)$/, '$1***$2'), codigoDesenvolvimento: codigo });
    },
  };
}

export interface OpcoesResend {
  readonly chave: string;
  readonly remetente: string;
  readonly fetch?: typeof fetch;
}

export function enviadorResend(o: OpcoesResend): EnviadorEmail {
  const chamar = o.fetch ?? fetch;
  return {
    async enviarCodigo(email, codigo) {
      const { assunto, texto } = assuntoECorpo(codigo);
      const r = await chamar('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${o.chave}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: o.remetente, to: [email], subject: assunto, text: texto }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!r.ok) throw new Error(`Falha ao enviar e-mail (HTTP ${r.status}).`);
    },
  };
}

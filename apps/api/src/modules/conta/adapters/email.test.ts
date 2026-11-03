import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assuntoECorpo, enviadorDesenvolvimento, enviadorResend } from './email.ts';
import { aleatorioSeguro } from './aleatorio.ts';

test('o e-mail diz o código, a validade e o que fazer se não foi a pessoa', () => {
  const { assunto, texto } = assuntoECorpo('814233');
  assert.match(assunto, /814233/);
  assert.match(texto, /8 1 4 2 3 3/);
  assert.match(texto, /10 minutos/);
  assert.match(texto, /ignore este e-mail/);
});

test('Resend recebe remetente, destinatário e chave; erro HTTP vira exceção', async () => {
  const chamadas: { url: string; init: RequestInit }[] = [];
  const falso = (status: number) => (async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(url), init: init ?? {} });
    return new Response('{}', { status });
  }) as typeof fetch;
  await enviadorResend({ chave: 're_x', remetente: 'A <a@b.c>', fetch: falso(200) }).enviarCodigo('caio@exemplo.com.br', '123456');
  const corpo = JSON.parse(String(chamadas[0]?.init.body)) as { to: string[]; from: string };
  assert.equal(chamadas[0]?.url, 'https://api.resend.com/emails');
  assert.deepEqual(corpo.to, ['caio@exemplo.com.br']);
  assert.equal((chamadas[0]?.init.headers as Record<string, string>)['authorization'], 'Bearer re_x');
  await assert.rejects(enviadorResend({ chave: 'k', remetente: 'r', fetch: falso(500) }).enviarCodigo('a@b.c', '1'), /HTTP 500/);
});

test('em desenvolvimento, o código vai para o log com o e-mail mascarado', async () => {
  const linhas: Record<string, unknown>[] = [];
  await enviadorDesenvolvimento({ log: (_n, _m, c) => { linhas.push(c ?? {}); } }).enviarCodigo('caio@exemplo.com.br', '123456');
  assert.deepEqual(linhas[0], { para: 'c***@exemplo.com.br', codigoDesenvolvimento: '123456' });
});

test('o aleatório seguro gera códigos de 6 dígitos e tokens de 256 bits', () => {
  assert.match(aleatorioSeguro.codigoSeisDigitos(), /^\d{6}$/);
  assert.equal(Buffer.from(aleatorioSeguro.token(), 'base64url').length, 32);
  assert.notEqual(aleatorioSeguro.uuid(), aleatorioSeguro.uuid());
});

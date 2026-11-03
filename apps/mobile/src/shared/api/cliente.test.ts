import { criarClienteApi, ErroApi } from './cliente';

const resposta = (status: number, corpo?: unknown) =>
  new Response(corpo === undefined ? null : JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });

describe('criarClienteApi', () => {
  it('envia JSON e o token, e devolve o corpo', async () => {
    const fetchFalso = jest.fn(async () => resposta(200, { ok: true }));
    const chamar = criarClienteApi({ baseUrl: 'https://api.x', obterToken: async () => 'tok', fetch: fetchFalso as unknown as typeof fetch });
    await expect(chamar('POST', '/a', { b: 1 })).resolves.toEqual({ ok: true });
    const [url, init] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.x/a');
    expect(init.headers).toMatchObject({ authorization: 'Bearer tok', 'content-type': 'application/json' });
    expect(init.body).toBe('{"b":1}');
  });

  it('transforma Problem Details em ErroApi com a mensagem da API', async () => {
    const chamar = criarClienteApi({ baseUrl: '', fetch: (async () => resposta(422, { codigo: 'email_invalido', titulo: 'Confira o e-mail.' })) as unknown as typeof fetch });
    await expect(chamar('POST', '/x', {})).rejects.toMatchObject({ status: 422, codigo: 'email_invalido', message: 'Confira o e-mail.' });
  });

  it('esconde detalhes de erro 500 atrás de uma mensagem amigável', async () => {
    const chamar = criarClienteApi({ baseUrl: '', fetch: (async () => resposta(500, { titulo: 'stack trace' })) as unknown as typeof fetch });
    await expect(chamar('GET', '/x')).rejects.toMatchObject({ codigo: 'erro_desconhecido', message: 'Algo deu errado do nosso lado. Tente de novo em instantes.' });
  });

  it('sem rede, diz que está sem internet', async () => {
    const chamar = criarClienteApi({ baseUrl: '', fetch: (async () => { throw new TypeError('Network request failed'); }) as unknown as typeof fetch });
    const erro = await chamar('GET', '/x').catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    expect(erro).toMatchObject({ status: 0, codigo: 'sem_conexao' });
  });

  it('aceita resposta vazia (204) e corpo que não é JSON', async () => {
    const vazio = criarClienteApi({ baseUrl: '', fetch: (async () => new Response(null, { status: 204 })) as unknown as typeof fetch });
    await expect(vazio('POST', '/sair')).resolves.toBeUndefined();
    const html = criarClienteApi({ baseUrl: '', fetch: (async () => new Response('<html>', { status: 502 })) as unknown as typeof fetch });
    await expect(html('GET', '/x')).rejects.toMatchObject({ status: 502, codigo: 'erro_desconhecido' });
  });
});

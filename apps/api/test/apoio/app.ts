/**
 * Sobe a API inteira sobre um banco de teste novo, para os testes de
 * integração da área do organizador conversarem por HTTP como o app faz.
 */
import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type pg from 'pg';
import { criarBancoDeTeste } from './banco.ts';
import type { BancoDeTeste } from './banco.ts';
import { Banco } from '../../src/shared/db/banco.ts';
import { loggerSilencioso } from '../../src/shared/logger.ts';
import { criarApp, dependenciasAcessos, dependenciasCadastros, dependenciasConta, dependenciasCredenciamento, dependenciasFeira, dependenciasInscricao, dependenciasOrganizacao } from '../../src/main/app.ts';
import type { Dependencias } from '../../src/main/app.ts';
import { assinadorEd25519, novaChavePrivada } from '../../src/shared/qr/ed25519.ts';

export interface Resposta<T> {
  readonly status: number;
  readonly corpo: T;
}

export interface AppDeTeste {
  readonly b: BancoDeTeste;
  readonly banco: Banco;
  /** Cria a conta pelo fluxo real de código por e-mail e devolve o token da sessão. */
  entrar(email: string, nome: string): Promise<string>;
  /** E-mails de convite e aviso que a API "enviou". */
  readonly emails: { para: string; assunto: string; texto: string }[];
  /** Id da pessoa dona de um token, para montar dados como dono do esquema. */
  pessoaDe(email: string): Promise<string>;
  pedir<T = Record<string, unknown>>(metodo: string, caminho: string, token?: string | null, corpo?: unknown): Promise<Resposta<T>>;
  dono<T extends pg.QueryResultRow>(sql: string, valores?: unknown[]): Promise<T[]>;
  fechar(): Promise<void>;
}

export async function subirApp(extras: (banco: Banco, base: Pick<Dependencias, 'conta'>) => Partial<Dependencias> = () => ({})): Promise<AppDeTeste> {
  const b = await criarBancoDeTeste();
  const banco = new Banco({ url: b.url, papel: 'app_api' });
  const caixa: { email: string; codigo: string }[] = [];
  const config = { url: b.url, chaves: { cifra: new Map([[1, randomBytes(32)]]), atual: 1, indice: randomBytes(32) }, email: { provedor: 'dev' as const } };
  const conta = { ...dependenciasConta(banco, config, loggerSilencioso), email: { enviarCodigo: async (email: string, codigo: string) => void caixa.push({ email, codigo }) } };
  const assinador = assinadorEd25519('qr-teste', novaChavePrivada());
  const emails: AppDeTeste['emails'] = [];
  const enviarEmail = async (para: string, assunto: string, texto: string) => void emails.push({ para, assunto, texto });
  const app: Server = criarApp({
    config: { porta: 0, ambiente: 'teste', corsOrigens: [] },
    logger: loggerSilencioso,
    relogio: { agoraMs: () => Date.now() },
    versao: 'teste',
    conta,
    inscricao: { ...dependenciasInscricao(banco, conta, config, loggerSilencioso, assinador), notificador: { recibo: async () => undefined } },
    credenciamento: dependenciasCredenciamento(banco, conta, assinador),
    cadastros: dependenciasCadastros(banco, conta),
    acessos: dependenciasAcessos(banco, conta, assinador),
    organizacao: { ...dependenciasOrganizacao(banco, conta, config, loggerSilencioso), enviarEmail },
    feira: { ...dependenciasFeira(banco, conta, config, loggerSilencioso), enviarEmail },
    ...extras(banco, { conta }),
  });
  await new Promise<void>((ok) => app.listen(0, ok));
  const base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;

  const pedir: AppDeTeste['pedir'] = async (metodo, caminho, token, corpo) => {
    const r = await fetch(`${base}${caminho}`, {
      method: metodo,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(corpo === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    });
    const texto = await r.text();
    return { status: r.status, corpo: (texto ? JSON.parse(texto) : null) as never };
  };

  return {
    b,
    banco,
    emails,
    pedir,
    async entrar(email, nome) {
      await pedir('POST', '/acesso/codigo', null, { email });
      const codigo = caixa.filter((c) => c.email === email).at(-1)?.codigo;
      const { corpo } = await pedir<{ token: string }>('POST', '/acesso/entrar', null, { email, codigo });
      await pedir('PUT', '/conta/primeiro-acesso', corpo.token, { nomeCracha: nome, aceitaTermos: true, versaoTermos: '2026-11-03' });
      return corpo.token;
    },
    async pessoaDe(email) {
      const hash = conta.protecao.indice(email, 'pessoa.email');
      const { rows } = await b.dono.query<{ id: string }>('select id from pessoa where email_hash = $1', [hash]);
      if (!rows[0]) throw new Error(`pessoa ${email} não existe`);
      return rows[0].id;
    },
    dono: async (sql, valores = []) => (await b.dono.query(sql, valores)).rows as never,
    async fechar() {
      await new Promise<void>((ok) => app.close(() => ok()));
      await banco.fechar();
      await b.apagar();
    },
  };
}

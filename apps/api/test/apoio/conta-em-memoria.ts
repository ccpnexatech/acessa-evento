/**
 * Implementações em memória das portas do módulo conta, para testar os
 * casos de uso sem banco, e-mail ou rede. Usam a criptografia real.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { CifradorAesGcm } from '../../src/shared/cripto/aes-gcm.ts';
import type { CodigoAtivo, DependenciasConta, Pessoa } from '../../src/modules/conta/application/portas.ts';

const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex');

export interface ContaEmMemoria extends DependenciasConta {
  readonly emailsEnviados: { email: string; codigo: string }[];
  readonly eventos: { atorId: string | null; acao: string }[];
  readonly relogio: { agora(): Date; avancar(ms: number): void };
  readonly aleatorio: DependenciasConta['aleatorio'] & { proximoCodigo: string | null };
  readonly pessoasGuardadas: Map<string, Pessoa & { emailHash: string }>;
}

export function contaEmMemoria(): ContaEmMemoria {
  let agora = new Date('2026-07-01T08:00:00Z');
  const codigos: (CodigoAtivo & { emailHash: string; criadoEm: Date; usado: boolean })[] = [];
  const pessoas = new Map<string, Pessoa & { emailHash: string }>();
  const sessoes = new Map<string, { sessaoId: string; pessoaId: string; expiraEm: Date; revogada: boolean }>();
  const emailsEnviados: { email: string; codigo: string }[] = [];
  const eventos: { atorId: string | null; acao: string }[] = [];

  const aleatorio = {
    proximoCodigo: null as string | null,
    codigoSeisDigitos(): string {
      const c = this.proximoCodigo ?? String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
      this.proximoCodigo = null;
      return c;
    },
    token: () => randomBytes(32).toString('base64url'),
    uuid: () => randomUUID(),
  };

  return {
    emailsEnviados,
    eventos,
    pessoasGuardadas: pessoas,
    aleatorio,
    relogio: { agora: () => agora, avancar: (ms) => { agora = new Date(agora.getTime() + ms); } },
    protecao: new CifradorAesGcm({ cifra: new Map([[1, randomBytes(32)]]), atual: 1, indice: randomBytes(32) }),
    email: { enviarCodigo: async (email, codigo) => { emailsEnviados.push({ email, codigo }); } },
    auditoria: { registrar: async (e) => { eventos.push({ atorId: e.atorId, acao: e.acao }); } },
    codigos: {
      contarDesde: async (h, desde) => codigos.filter((c) => c.emailHash === hex(h) && c.criadoEm >= desde).length,
      salvar: async (d) => {
        codigos.push({ id: randomUUID(), emailHash: hex(d.emailHash), codigoHash: d.codigoHash, expiraEm: d.expiraEm, tentativas: 0, criadoEm: agora, usado: false });
      },
      ultimoNaoUsado: async (h) => [...codigos].reverse().find((c) => c.emailHash === hex(h) && !c.usado) ?? null,
      registrarErro: async (id) => {
        const i = codigos.findIndex((c) => c.id === id);
        const c = codigos[i];
        if (!c) return 0;
        codigos[i] = { ...c, tentativas: c.tentativas + 1 };
        return c.tentativas + 1;
      },
      marcarUsado: async (id) => {
        const i = codigos.findIndex((c) => c.id === id);
        const c = codigos[i];
        if (c) codigos[i] = { ...c, usado: true };
      },
    },
    pessoas: {
      idPorEmailHash: async (h) => [...pessoas.values()].find((p) => p.emailHash === hex(h))?.id ?? null,
      criar: async (d) => {
        pessoas.set(d.id, { id: d.id, emailCifrado: d.emailCifrado, emailHash: hex(d.emailHash), nomeCracha: null, criadaEm: agora, termosAceitos: [] });
      },
      obter: async (id) => pessoas.get(id) ?? null,
      concluirPrimeiroAcesso: async (id, nome, versao) => {
        const p = pessoas.get(id);
        if (p) pessoas.set(id, { ...p, nomeCracha: nome, termosAceitos: [...p.termosAceitos, versao] });
      },
      dadosParaExportar: async (id) => ({ consentimentos: pessoas.get(id)?.termosAceitos ?? [] }),
      excluir: async (id) => {
        pessoas.delete(id);
        for (const [k, s] of sessoes) if (s.pessoaId === id) sessoes.delete(k);
      },
    },
    sessoes: {
      criar: async (d) => {
        sessoes.set(hex(d.tokenHash), { sessaoId: randomUUID(), pessoaId: d.pessoaId, expiraEm: d.expiraEm, revogada: false });
      },
      validar: async (h) => {
        const s = sessoes.get(hex(h));
        return s && !s.revogada && s.expiraEm > agora ? { sessaoId: s.sessaoId, pessoaId: s.pessoaId } : null;
      },
      revogar: async (pessoaId, sessaoId) => {
        for (const s of sessoes.values()) if (s.pessoaId === pessoaId && s.sessaoId === sessaoId) s.revogada = true;
      },
    },
  };
}

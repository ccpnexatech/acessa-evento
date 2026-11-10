import { ErroApi } from '../../shared/api/cliente';
import type { Requisitor } from '../../shared/api/cliente';
import { cofreEmMemoria } from '../../shared/armazenamento/cofre';
import { AssistenteOffline } from './sincronizacao';
import { ASSISTENTE } from './fixtures';

function rede() {
  const estado = { online: true, versao: 1, chamadas: [] as { metodo: string; caminho: string; opcoes?: unknown }[], status: 204 };
  const requisitar = (async (metodo: string, caminho: string, opcoes?: { cabecalhos?: Record<string, string> }) => {
    estado.chamadas.push({ metodo, caminho, opcoes });
    if (!estado.online) throw new ErroApi(0, 'sem_conexao', 'x');
    if (metodo === 'POST') {
      if (estado.status >= 400) throw new ErroApi(estado.status, 'x', 'x');
      return { status: 204, dados: undefined, etag: null };
    }
    if (opcoes?.cabecalhos?.['if-none-match'] === `"v${estado.versao}"`) return { status: 304, dados: undefined, etag: null };
    return { status: 200, dados: { ...ASSISTENTE, versao: estado.versao }, etag: `"v${estado.versao}"` };
  }) as Requisitor;
  return { estado, requisitar };
}

describe('AssistenteOffline', () => {
  it('baixa, guarda e só baixa de novo quando a versão muda', async () => {
    const r = rede();
    const s = new AssistenteOffline(r.requisitar, cofreEmMemoria(), 'cocal-2026');
    expect(await s.salvo()).toBeNull();
    expect((await s.sincronizar()).versao).toBe(1);
    expect((await s.sincronizar()).versao).toBe(1);
    r.estado.versao = 2;
    expect((await s.sincronizar()).versao).toBe(2);
    expect((await s.salvo())?.versao).toBe(2);
  });

  it('avaliação sem internet fica na fila e sobe depois; 4xx é descartada', async () => {
    const r = rede();
    const cofre = cofreEmMemoria();
    const s = new AssistenteOffline(r.requisitar, cofre, 'cocal-2026');
    r.estado.online = false;
    await s.avaliar({ versao: 1, respostaId: 'r-libras', util: false });
    expect(await cofre.ler('assistente-cocal-2026-avaliacoes')).not.toBeNull();
    r.estado.online = true;
    expect(await s.enviarPendentes()).toBe(1);
    expect(await cofre.ler('assistente-cocal-2026-avaliacoes')).toBeNull();
    r.estado.status = 422;
    await s.avaliar({ versao: 9, respostaId: 'x', util: true });
    expect(await cofre.ler('assistente-cocal-2026-avaliacoes')).toBeNull();
    await expect(new AssistenteOffline((async () => ({ status: 200, dados: undefined, etag: null })) as Requisitor, cofreEmMemoria(), 'x').sincronizar()).rejects.toThrow('vazia');
  });
});

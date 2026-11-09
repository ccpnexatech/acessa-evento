import { avaliarLeitura, buscarPorNome, quando } from './modelo';
import { verificadorNoble } from './verificador';
import { AGORA, ANA, CAIO, NOVO, PACOTE, token } from './fixtures';

const v = verificadorNoble(PACOTE.chaves);

describe('avaliarLeitura', () => {
  it('ingresso autêntico que não entrou: pode entrar, com nome e recursos', () => {
    expect(avaliarLeitura(token(CAIO), PACOTE, v, [], AGORA)).toEqual({ tipo: 'valido', ingressoId: CAIO, participante: PACOTE.participantes[0] });
  });

  it('já entrou pela lista do servidor ou por este aparelho', () => {
    expect(avaliarLeitura(token(ANA), PACOTE, v, [], AGORA)).toMatchObject({ tipo: 'repetido', anterior: { portao: 'Portão 2' } });
    const local = [{ id: 'x', ingressoId: CAIO, portao: 'Portão 1', metodo: 'qr' as const, feitoEm: '2026-07-01T11:30:00.000Z' }];
    expect(avaliarLeitura(token(CAIO), PACOTE, v, local, AGORA)).toMatchObject({ tipo: 'repetido', anterior: { em: '2026-07-01T11:30:00.000Z' } });
  });

  it('inscrição depois do download da lista: autêntico, sem nome', () => {
    expect(avaliarLeitura(token(NOVO), PACOTE, v, [], AGORA)).toEqual({ tipo: 'valido', ingressoId: NOVO, participante: null });
  });

  it('assinatura falsa, outro evento, vencido e lixo', () => {
    expect(avaliarLeitura(token(CAIO, { privada: new Uint8Array(32).fill(9) }), PACOTE, v, [], AGORA)).toEqual({ tipo: 'invalido', motivo: 'assinatura' });
    expect(avaliarLeitura(token(CAIO, { evento: 'outro' }), PACOTE, v, [], AGORA)).toEqual({ tipo: 'invalido', motivo: 'outro_evento' });
    expect(avaliarLeitura(token(CAIO, { validade: AGORA / 1000 - 1 }), PACOTE, v, [], AGORA)).toEqual({ tipo: 'invalido', motivo: 'vencido' });
    expect(avaliarLeitura('https://site.com', PACOTE, v, [], AGORA)).toEqual({ tipo: 'invalido', motivo: 'formato' });
  });
});

describe('apoio', () => {
  it('busca por nome sem acento e com pelo menos 2 letras', () => {
    expect(buscarPorNome(PACOTE, 'caio').map((p) => p.nome)).toEqual(['Caio Ponte']);
    expect(buscarPorNome(PACOTE, 'LÍMA').map((p) => p.nome)).toEqual(['Ana Lima']);
    expect(buscarPorNome(PACOTE, 'a')).toEqual([]);
  });

  it('diz "hoje às" ou a data', () => {
    expect(quando('2026-07-01T11:12:00.000Z', AGORA)).toBe('hoje às 08:12');
    expect(quando('2026-06-30T11:12:00.000Z', AGORA)).toBe('em 30 de jun às 08:12');
  });
});

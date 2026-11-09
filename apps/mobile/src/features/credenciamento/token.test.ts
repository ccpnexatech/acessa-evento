/** Contrato com a API: mesmo vetor de apps/api/src/shared/qr/token.test.ts. */
import { deBase64url, lerToken, paraBase64url } from './token';
import { verificadorNoble } from './verificador';

const VETOR = {
  kid: 'teste-1',
  ingresso: '01900000-0000-7000-8000-000000000001',
  evento: '01900000-0000-7000-8000-0000000000e1',
  validade: 1_783_123_200,
  publica: '0EqyMnQrtKs6E2i9RhXk5tAiSrcaAWuvhSCjMsl3hzc', // segredo-permitido: vetor público de teste
  token: 'AE1.eyJrIjoidGVzdGUtMSIsImkiOiIwMTkwMDAwMC0wMDAwLTcwMDAtODAwMC0wMDAwMDAwMDAwMDEiLCJlIjoiMDE5MDAwMDAtMDAwMC03MDAwLTgwMDAtMDAwMDAwMDAwMGUxIiwieCI6MTc4MzEyMzIwMH0.erD5Zz3BC57MheA5-0CHH8a5CpnKv8DAlyLbBOmLGtqfmURvTnLs6uBTHT8Fb1ld73cw3vGftSMpkhdX37saCg', // segredo-permitido: vetor público de teste
};
const verificador = verificadorNoble([{ kid: VETOR.kid, publica: VETOR.publica }]);
const AGORA = 1_782_000_000;

describe('token do QR no aparelho da equipe', () => {
  it('aceita o token emitido pela API', () => {
    expect(lerToken(VETOR.token, verificador, VETOR.evento, AGORA)).toEqual({
      ok: true,
      conteudo: { k: VETOR.kid, i: VETOR.ingresso, e: VETOR.evento, x: VETOR.validade },
    });
  });

  it('recusa assinatura alterada, outra chave, outro evento e vencido', () => {
    const [p, c, s = ''] = VETOR.token.split('.');
    const trocada = `${p}.${c}.${s.startsWith('A') ? `B${s.slice(1)}` : `A${s.slice(1)}`}`;
    expect(lerToken(trocada, verificador, VETOR.evento, AGORA)).toEqual({ ok: false, motivo: 'assinatura' });
    expect(lerToken(VETOR.token, verificadorNoble([{ kid: 'outra', publica: VETOR.publica }]), VETOR.evento, AGORA)).toEqual({ ok: false, motivo: 'assinatura' });
    expect(lerToken(VETOR.token, verificadorNoble([{ kid: VETOR.kid, publica: 'curta' }]), VETOR.evento, AGORA)).toEqual({ ok: false, motivo: 'assinatura' });
    expect(lerToken(VETOR.token, verificador, 'outro', AGORA)).toEqual({ ok: false, motivo: 'outro_evento' });
    expect(lerToken(VETOR.token, verificador, VETOR.evento, VETOR.validade + 1)).toEqual({ ok: false, motivo: 'vencido' });
  });

  it('lixo, QR de outra coisa e texto não ASCII não passam', () => {
    for (const lixo of ['', 'https://exemplo.com', 'AE1.a.b', `AE1.${paraBase64url(Uint8Array.of(200, 201))}.${'A'.repeat(86)}`, `AE1.${paraBase64url(Uint8Array.from('{"k":1}', (x) => x.charCodeAt(0)))}.${'A'.repeat(86)}`]) {
      expect(lerToken(lixo, verificador, VETOR.evento, AGORA).ok).toBe(false);
    }
  });

  it('base64url ida e volta', () => {
    const bytes = Uint8Array.from({ length: 33 }, (_, i) => i * 7);
    expect(deBase64url(paraBase64url(bytes))).toEqual(bytes);
    expect(deBase64url('a+b')).toBeNull();
  });
});

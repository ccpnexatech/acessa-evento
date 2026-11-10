/**
 * Medição para o README: quanto tempo o aparelho da equipe leva para decidir
 * "pode entrar", sem internet (verificar a assinatura Ed25519 e consultar a
 * lista). Roda no CI como trava de regressão e imprime os números (npm run medir).
 */
import { avaliarLeitura } from '../features/credenciamento/modelo';
import type { Pacote, Participante } from '../features/credenciamento/modelo';
import { verificadorNoble } from '../features/credenciamento/verificador';
import { AGORA, CHAVE, EVENTO_ID, PACOTE, token } from '../features/credenciamento/fixtures';

const id = (n: number) => `01900000-0000-7000-8000-${String(n).padStart(12, '0')}`;

/** Lista do tamanho de um evento médio: 3.000 participantes. */
const participantes: Participante[] = Array.from({ length: 3000 }, (_, n) => ({ ingressoId: id(n), nome: `Pessoa ${n}`, tipo: 'Congressista', recursos: n % 10 === 0 ? ['libras'] : [], checkin: null }));
const pacote: Pacote = { ...PACOTE, chaves: [CHAVE], participantes, evento: { ...PACOTE.evento, id: EVENTO_ID } };

const percentil = (ordenados: number[], p: number) => ordenados[Math.min(ordenados.length - 1, Math.floor((p / 100) * ordenados.length))] ?? 0;

it('decide o check-in offline em bem menos de 1 segundo, com 3.000 participantes', () => {
  const verificador = verificadorNoble(pacote.chaves);
  const tokens = Array.from({ length: 200 }, (_, n) => token(id(n * 15)));
  avaliarLeitura(tokens[0] ?? '', pacote, verificador, [], AGORA); // aquece
  const tempos = tokens.map((t) => {
    const inicio = performance.now();
    const r = avaliarLeitura(t, pacote, verificador, [], AGORA);
    const ms = performance.now() - inicio;
    expect(r.tipo).toBe('valido');
    return ms;
  }).sort((a, b) => a - b);
  const mediana = percentil(tempos, 50);
  const p95 = percentil(tempos, 95);
  process.stdout.write(`\nCheck-in offline (decisão no aparelho, 3.000 participantes, 200 leituras): mediana ${mediana.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms\n`);
  // Meta do plano: abaixo de 2 s por pessoa. A decisão em si precisa ficar muito abaixo disso.
  expect(p95).toBeLessThan(250);
});

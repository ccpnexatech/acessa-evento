/**
 * Máscaras PNG do app (ADR 0031): toda máscara vem de um SVG do manifesto, está
 * em dia com ele e cabe no limite de peso da família.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { xilos } from './index.ts';

const RAIZ = join(import.meta.dirname, '..');
const LIMITE_KB = { cena: 120, estado: 60, objeto: 60, simbolo: 4 } as const;
const LARGURA = { cena: 960, estado: 640, objeto: 640, simbolo: 96 } as const;
type Familia = keyof typeof LIMITE_KB;
const indice = JSON.parse(readFileSync(join(RAIZ, 'png', 'mascaras.json'), 'utf8')) as Record<string, { largura: number; altura: number; familia: Familia; svg: string }>;
const noManifesto = new Map(Object.values(xilos).map((x) => [x.arquivo.replace('.svg', ''), x.familia]));

test('toda máscara no disco está no índice, e o contrário', () => {
  const noDisco = readdirSync(join(RAIZ, 'png')).filter((a) => a.endsWith('.png')).map((a) => a.replace('.png', '')).sort();
  assert.deepEqual(noDisco, Object.keys(indice).sort());
});

let total = 0;
for (const [nome, m] of Object.entries(indice)) {
  test(`${nome}: vem do manifesto, está em dia com o SVG e cabe no limite`, () => {
    assert.equal(noManifesto.get(nome), m.familia, 'família diferente da do manifesto');
    const svg = readFileSync(join(RAIZ, 'svg', `${nome}.svg`));
    assert.equal(createHash('sha256').update(svg).digest('hex').slice(0, 16), m.svg, 'SVG mudou: rode python3 tools/xilo/mascaras.py');
    assert.equal(m.largura, LARGURA[m.familia]);
    const bytes = statSync(join(RAIZ, 'png', `${nome}.png`)).size;
    total += bytes;
    assert.ok(bytes <= LIMITE_KB[m.familia] * 1024, `${bytes} bytes, limite ${LIMITE_KB[m.familia]} kB`);
    // Cabeçalho PNG com tipo de cor 4 (cinza com alfa): o app só lê o alfa.
    const png = readFileSync(join(RAIZ, 'png', `${nome}.png`));
    assert.deepEqual([...png.subarray(1, 4)], [0x50, 0x4e, 0x47]);
    assert.equal(png[25], 4);
  });
}

test('o peso somado das máscaras fica abaixo de 400 kB', () => {
  assert.ok(total > 0 && total <= 400 * 1024, `${Math.round(total / 1024)} kB`);
});

/**
 * Regras da carteira, em código: uma tinta só (currentColor), um traçado, sem tamanho fixo,
 * peso dentro do limite da família e texto alternativo em toda peça.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LIMITE_BYTES, xilos } from './index.ts';

const PASTA = join(import.meta.dirname, '..', 'svg');
const pecas = Object.entries(xilos);

test('toda peça do manifesto existe e todo arquivo está no manifesto', () => {
  const noDisco = readdirSync(PASTA).filter((a) => a.endsWith('.svg')).sort();
  const noManifesto = pecas.map(([, x]) => x.arquivo).sort();
  assert.deepEqual(noDisco, noManifesto);
});

for (const [nome, xilo] of pecas) {
  const svg = readFileSync(join(PASTA, xilo.arquivo), 'utf8');

  test(`${nome}: uma tinta só, herdada do tema`, () => {
    assert.equal(svg.match(/<path/g)?.length, 1, 'deve ter um único <path>');
    assert.match(svg, /<path fill="currentColor"/);
    const cores = svg.replace(/<!--[\s\S]*?-->/g, '').match(/(?:fill|stroke)="(?!currentColor)[^"]*"|#[0-9a-fA-F]{3,8}\b|rgb\(/g);
    assert.equal(cores, null, `cor fixa encontrada: ${String(cores)}`);
  });

  test(`${nome}: escala sozinha e fica fora do leitor de tela por padrão`, () => {
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 \d+ \d+" aria-hidden="true" focusable="false">/);
    assert.doesNotMatch(svg.slice(0, 200), /\s(?:width|height)=/);
    assert.doesNotMatch(svg, /<script|<image|<foreignObject|href=/);
  });

  test(`${nome}: cabe no limite de peso da família ${xilo.familia}`, () => {
    const bytes = Buffer.byteLength(svg);
    assert.ok(bytes <= LIMITE_BYTES[xilo.familia], `${bytes} bytes, limite ${LIMITE_BYTES[xilo.familia]}`);
  });

  test(`${nome}: tem uso e texto alternativo`, () => {
    assert.ok(xilo.uso.length >= 10);
    assert.ok(xilo.alt.length >= 3);
  });
}

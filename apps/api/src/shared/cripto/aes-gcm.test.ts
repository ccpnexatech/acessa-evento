import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { CifradorAesGcm, lerChaves, normalizarEmail } from './aes-gcm.ts';

const k1 = randomBytes(32);
const k2 = randomBytes(32);
const indice = randomBytes(32);
const cifrador = (atual = 1, cifra = new Map([[1, k1]])) => new CifradorAesGcm({ cifra, atual, indice });

test('cifra e decifra no mesmo contexto', () => {
  const c = cifrador();
  const cifrado = c.cifrar('caio@exemplo.com.br', 'pessoa.email');
  assert.equal(c.decifrar(cifrado, 'pessoa.email'), 'caio@exemplo.com.br');
  assert.ok(!cifrado.toString('utf8').includes('caio'));
});

test('o mesmo texto gera cifrados diferentes (IV aleatório)', () => {
  const c = cifrador();
  assert.notDeepEqual(c.cifrar('x', 'a'), c.cifrar('x', 'a'));
});

test('contexto errado, adulteração ou formato estranho não decifram', () => {
  const c = cifrador();
  const cifrado = c.cifrar('segredo', 'pessoa.email');
  assert.throws(() => c.decifrar(cifrado, 'pessoa.nome'), /Não foi possível decifrar/);
  const adulterado = Buffer.from(cifrado);
  adulterado[adulterado.length - 1] = (adulterado.at(-1) ?? 0) ^ 1;
  assert.throws(() => c.decifrar(adulterado, 'pessoa.email'), /Não foi possível decifrar/);
  assert.throws(() => c.decifrar(Buffer.from([9, 1]), 'pessoa.email'), /formato desconhecido/);
});

test('rotação: cifra com a chave nova e ainda decifra o que foi cifrado com a antiga', () => {
  const antigo = cifrador().cifrar('dado', 'ctx');
  const novo = cifrador(2, new Map([[1, k1], [2, k2]]));
  assert.equal(novo.decifrar(antigo, 'ctx'), 'dado');
  assert.equal(novo.cifrar('dado', 'ctx')[1], 2);
  assert.throws(() => cifrador().decifrar(novo.cifrar('d', 'ctx'), 'ctx'), /Chave 2 não registrada/);
});

test('índice é determinístico, depende do contexto e não revela o valor', () => {
  const c = cifrador();
  assert.deepEqual(c.indice('a@b.c', 'pessoa.email'), c.indice('a@b.c', 'pessoa.email'));
  assert.notDeepEqual(c.indice('a@b.c', 'pessoa.email'), c.indice('a@b.c', 'outro'));
  assert.equal(c.indice('a@b.c', 'pessoa.email').length, 32);
});

test('valida as chaves na criação', () => {
  assert.throws(() => new CifradorAesGcm({ cifra: new Map([[1, randomBytes(16)]]), atual: 1, indice }), /32 bytes/);
  assert.throws(() => new CifradorAesGcm({ cifra: new Map([[0, k1]]), atual: 0, indice }), /Id de chave inválido/);
  assert.throws(() => new CifradorAesGcm({ cifra: new Map([[1, k1]]), atual: 2, indice }), /não está registrada/);
  assert.throws(() => new CifradorAesGcm({ cifra: new Map([[1, k1]]), atual: 1, indice: randomBytes(8) }), /ao menos 32/);
  assert.throws(() => new CifradorAesGcm({ cifra: new Map([[1, k1]]), atual: 1, indice: k1 }), /não pode ser igual/);
});

test('lê as chaves do ambiente e usa a de maior id como atual', () => {
  const chaves = lerChaves({ CHAVES_CIFRA: `1:${k1.toString('base64')}, 3:${k2.toString('base64')}`, CHAVE_INDICE: indice.toString('base64') });
  assert.equal(chaves.atual, 3);
  assert.equal(chaves.cifra.size, 2);
  assert.throws(() => lerChaves({}), /Defina CHAVES_CIFRA/);
  assert.throws(() => lerChaves({ CHAVES_CIFRA: 'sem-dois-pontos', CHAVE_INDICE: 'x' }), /id:base64/);
});

test('normaliza e-mail antes do índice', () => {
  assert.equal(normalizarEmail('  Caio@Exemplo.COM.br '), 'caio@exemplo.com.br');
});

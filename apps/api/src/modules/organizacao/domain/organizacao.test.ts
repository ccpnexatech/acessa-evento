import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DESCRICAO_DOS_PAPEIS, PAPEIS_EVENTO, textoDoConvite, validarAlteracaoDeEvento, validarConvite, validarMembro,
  validarNovoEvento, validarOrganizacao, validarTema,
} from './organizacao.ts';

const invalido = (f: () => unknown, mensagem: RegExp) =>
  assert.throws(f, (e: { codigo?: string; message: string }) => e.codigo === 'dados_invalidos' && mensagem.test(e.message));
const TEMA = { corPrimaria: 'azul', corDestaque: 'laranja', fonte: 'padrao', arredondamento: 'suave' };

test('organização: nome obrigatório e CNPJ conferido', () => {
  assert.deepEqual(validarOrganizacao({ nome: ' Sociedade A ', cnpj: '11.222.333/0001-81' }), { nome: 'Sociedade A', cnpj: '11222333000181' });
  invalido(() => validarOrganizacao({ nome: 'S' }), /Nome da organização/);
});

test('evento novo: endereço em minúsculas com hífen e datas em ordem', () => {
  const base = { nome: 'Jornada 2027', slug: 'jornada-2027', inicio: '2027-03-01', fim: '2027-03-03', local: 'Fortaleza' };
  assert.deepEqual(validarNovoEvento({ ...base, demonstracao: true }), { ...base, demonstracao: true });
  invalido(() => validarNovoEvento({ ...base, slug: 'Jornada 2027' }), /Endereço do evento: formato inválido/);
  invalido(() => validarNovoEvento({ ...base, slug: '-jornada' }), /Endereço do evento/);
  invalido(() => validarNovoEvento({ ...base, fim: '2027-02-28' }), /Último dia: precisa ser igual ou depois/);
});

test('alterar evento: parte dos campos, só o tema ou os dois', () => {
  assert.deepEqual(validarAlteracaoDeEvento({ publicado: true }), { valores: { publicado: true } });
  assert.deepEqual(validarAlteracaoDeEvento({ tema: TEMA }), { valores: {}, tema: TEMA });
  assert.deepEqual(validarAlteracaoDeEvento({ nome: 'Novo nome', tema: TEMA }), { valores: { nome: 'Novo nome' }, tema: TEMA });
  invalido(() => validarAlteracaoDeEvento({}), /Nada para alterar/);
  invalido(() => validarAlteracaoDeEvento(null), /Envie os dados em JSON/);
  invalido(() => validarAlteracaoDeEvento({ slug: 'outro' }), /Campo desconhecido: slug/);
  invalido(() => validarAlteracaoDeEvento({ inicio: '2027-03-05', fim: '2027-03-01' }), /Último dia/);
  invalido(() => validarAlteracaoDeEvento({ publicado: null }), /Publicado: preencha/);
});

test('aparência: cores só da paleta, diferentes entre si, e logo só com descrição', () => {
  assert.deepEqual(validarTema({ ...TEMA, logoUrl: 'https://exemplo.com.br/logo.png', logoDescricao: 'Logo do congresso' }),
    { ...TEMA, logoUrl: 'https://exemplo.com.br/logo.png', logoDescricao: 'Logo do congresso' });
  assert.deepEqual(validarTema({ ...TEMA, logoUrl: null }), TEMA);
  invalido(() => validarTema({ ...TEMA, corPrimaria: '#ff0000' }), /Cor principal: escolha uma das opções/);
  invalido(() => validarTema({ ...TEMA, corDestaque: 'azul' }), /Cor de destaque: escolha uma cor diferente/);
  invalido(() => validarTema({ ...TEMA, logoUrl: 'https://exemplo.com.br/logo.png' }), /Descrição do logo: descreva a imagem/);
  invalido(() => validarTema({ corPrimaria: 'azul' }), /Cor de destaque: preencha/);
});

test('convite: e-mail normalizado e papéis da lista, sem repetição', () => {
  assert.deepEqual(validarConvite({ email: ' Bia@Exemplo.com.br ', papeis: ['credenciamento', 'credenciamento', 'acessibilidade'] }, PAPEIS_EVENTO),
    { email: 'bia@exemplo.com.br', papeis: ['credenciamento', 'acessibilidade'] });
  invalido(() => validarConvite({ email: 'bia', papeis: ['admin'] }, PAPEIS_EVENTO), /E-mail: confira/);
  invalido(() => validarConvite({ email: 5, papeis: ['admin'] }, PAPEIS_EVENTO), /E-mail: confira/);
  invalido(() => validarConvite({ email: 'bia@exemplo.com.br', papeis: [] }, PAPEIS_EVENTO), /Papéis: escolha/);
  invalido(() => validarConvite({ email: 'bia@exemplo.com.br', papeis: ['dono'] }, PAPEIS_EVENTO), /Papéis: escolha/);
  invalido(() => validarConvite({ email: 'bia@exemplo.com.br', papeis: 'admin' }, PAPEIS_EVENTO), /Papéis: escolha/);
  invalido(() => validarConvite(null, PAPEIS_EVENTO), /E-mail/);
});

test('membro: papéis obrigatórios; quem aparece na página do evento precisa de cargo', () => {
  assert.deepEqual(validarMembro({ papeis: ['conteudo'] }), { papeis: ['conteudo'], cargo: null, exibirPublico: false });
  assert.deepEqual(validarMembro({ papeis: ['conteudo'], cargo: ' Coordenação científica ', exibirPublico: true }),
    { papeis: ['conteudo'], cargo: 'Coordenação científica', exibirPublico: true });
  invalido(() => validarMembro({ papeis: ['conteudo'], exibirPublico: true }), /Cargo: informe o cargo/);
  invalido(() => validarMembro({ papeis: ['conteudo'], cargo: 'X' }), /Cargo: use de 2 a 80/);
  invalido(() => validarMembro(undefined), /Papéis/);
});

test('todo papel tem uma frase dizendo o que permite; o convite fala em português', () => {
  for (const p of PAPEIS_EVENTO) assert.ok(DESCRICAO_DOS_PAPEIS[p].endsWith('.'));
  const deEvento = textoDoConvite({ organizacao: 'Sociedade A', evento: 'COCAL 2026', papeis: ['credenciamento', 'acessibilidade'] });
  assert.equal(deEvento.assunto, 'Convite para a equipe: COCAL 2026');
  assert.match(deEvento.texto, /Papéis: Credenciamento, Acessibilidade\./);
  assert.match(textoDoConvite({ organizacao: 'Sociedade A', evento: null, papeis: ['admin'] }).assunto, /Sociedade A/);
  const deParceiro = textoDoConvite({ organizacao: 'Sociedade A', evento: 'COCAL 2026', parceiro: 'Xis Med', papeis: ['responsavel', 'outro'] });
  assert.match(deParceiro.assunto, /Xis Med no evento COCAL 2026/);
  assert.match(deParceiro.texto, /Responsável, outro/);
  assert.match(textoDoConvite({ organizacao: 'A', evento: null, parceiro: 'Xis Med', papeis: [] }).assunto, /Xis Med no evento$/);
});

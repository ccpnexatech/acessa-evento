/**
 * CLI: dá um papel de equipe a um e-mail num evento. Se a conta ainda não
 * existe, cria (a pessoa completa o cadastro no primeiro login).
 * Uma pessoa pode ter vários papéis no mesmo evento (ADR 0025): rodar de novo
 * com outro papel acrescenta, não troca. Pela tela, o caminho é o convite.
 *
 * Uso: DATABASE_URL_MIGRACAO=... CHAVES_CIFRA=... CHAVE_INDICE=... \
 *      node src/main/papel.ts <email> <papel> <slug-do-evento>
 */
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CifradorAesGcm, lerChaves } from '../shared/cripto/aes-gcm.ts';
import { validarEmail } from '../modules/conta/domain/regras.ts';
import { CONTEXTO } from '../modules/conta/application/acesso.ts';

const PAPEIS = ['admin', 'conteudo', 'credenciamento', 'financeiro', 'comercial', 'comunicacao', 'operacao', 'acessibilidade'];

export async function darPapel(cliente: pg.Client, cifrador: CifradorAesGcm, emailBruto: string, papel: string, slug: string): Promise<'criada' | 'existente'> {
  if (!PAPEIS.includes(papel)) throw new Error(`Papel inválido. Use: ${PAPEIS.join(', ')}.`);
  const email = validarEmail(emailBruto);
  const hash = cifrador.indice(email, CONTEXTO.email);
  const { rows: [evento] } = await cliente.query<{ id: string }>('select id from evento where slug = $1', [slug]);
  if (!evento) throw new Error(`Evento "${slug}" não encontrado.`);
  let { rows: [pessoa] } = await cliente.query<{ id: string }>('select id from pessoa where email_hash = $1', [hash]);
  const situacao = pessoa ? 'existente' : 'criada';
  if (!pessoa) {
    const id = randomUUID();
    await cliente.query('insert into pessoa (id, email_cifrado, email_hash) values ($1, $2, $3)', [id, cifrador.cifrar(email, CONTEXTO.email), hash]);
    pessoa = { id };
  }
  await cliente.query(
    'insert into membro_organizacao (evento_id, pessoa_id, papel) values ($1, $2, $3) on conflict (evento_id, pessoa_id, papel) do nothing',
    [evento.id, pessoa.id, papel]);
  return situacao;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [email = '', papel = '', slug = ''] = process.argv.slice(2);
  const url = process.env['DATABASE_URL_MIGRACAO'];
  if (!url || !email || !papel || !slug) {
    process.stderr.write('Uso: DATABASE_URL_MIGRACAO=... CHAVES_CIFRA=... CHAVE_INDICE=... node src/main/papel.ts <email> <papel> <slug>\n');
    process.exit(1);
  }
  const cliente = new pg.Client({ connectionString: url });
  try {
    await cliente.connect();
    const r = await darPapel(cliente, new CifradorAesGcm(lerChaves(process.env)), email, papel, slug);
    process.stdout.write(`${email} agora tem o papel ${papel} em ${slug} (conta ${r}).\n`);
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n`);
    process.exitCode = 1;
  } finally {
    await cliente.end();
  }
}

/**
 * npm run dev — sobe o ecossistema inteiro com um comando:
 *   banco → migrações e evento de referência → API → links públicos → Expo.
 *
 * Opções:
 *   --lan      sem túnel: usa o IP da rede local (mais rápido, exige rede sem isolamento)
 *   --sem-app  só banco, API e link público da API (para testar com curl ou Bruno)
 *   --resetar  apaga o banco e as chaves de desenvolvimento antes de subir
 *
 * Tudo o que é gerado fica em .dev/ (fora do git): chaves, senha do usuário
 * da API, dados do banco local e o binário do cloudflared.
 */
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { arch, networkInterfaces, platform, tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { acharBinariosPg, comoRoot, dockerDisponivel, executarPg, portaLivre, saida } from './lib/postgres.ts';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const DEV = join(RAIZ, '.dev');
const API = join(RAIZ, 'apps', 'api');
const MOBILE = join(RAIZ, 'apps', 'mobile');
const PORTA_PG = 54329;
const CONTEINER = 'acessa-evento-dev-pg';
const opcoes = new Set(process.argv.slice(2));

const filhos: ChildProcess[] = [];
let pararBanco: () => void = () => undefined;

const passo = (t: string): void => {
  process.stdout.write(`\n▶ ${t}\n`);
};
const ok = (t: string): void => {
  process.stdout.write(`  ✔ ${t}\n`);
};
const falhar = (t: string): never => {
  process.stderr.write(`\n✖ ${t}\n`);
  encerrar(1);
  process.exit(1);
};

function encerrar(codigo = 0): void {
  for (const f of filhos) f.kill('SIGTERM');
  pararBanco();
  if (codigo === 0) process.stdout.write('\nAmbiente encerrado. Os dados do banco continuam em .dev/ para a próxima vez.\n');
}
process.on('SIGINT', () => {
  encerrar();
  process.exit(0);
});
process.on('SIGTERM', () => {
  encerrar();
  process.exit(0);
});

// ---------- 1. Segredos de desenvolvimento (gerados uma vez) ----------

interface Segredos {
  readonly senhaApi: string;
  readonly chavesCifra: string;
  readonly chaveIndice: string;
}

function segredos(): Segredos {
  const arquivo = join(DEV, 'segredos.json');
  if (existsSync(arquivo)) return JSON.parse(readFileSync(arquivo, 'utf8')) as Segredos;
  const novos: Segredos = {
    senhaApi: randomBytes(18).toString('base64url'),
    chavesCifra: `1:${randomBytes(32).toString('base64')}`,
    chaveIndice: randomBytes(32).toString('base64'),
  };
  writeFileSync(arquivo, JSON.stringify(novos, null, 2), { mode: 0o600 });
  return novos;
}

// ---------- 2. Banco persistente ----------

async function subirBanco(): Promise<string> {
  const bin = acharBinariosPg((t) => process.stdout.write(`  ${t}\n`));
  if (bin) {
    // Como root (contêiner), o PostgreSQL roda como o usuário postgres e precisa de uma pasta dele.
    const dados = comoRoot() ? join(tmpdir(), 'acessa-evento-dev-pg') : join(DEV, 'pg');
    if (!existsSync(join(dados, 'PG_VERSION'))) {
      mkdirSync(dados, { recursive: true });
      if (comoRoot()) spawnSync('chown', ['-R', 'postgres', dados]);
      executarPg(bin, 'initdb', ['-D', dados, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--locale=C']);
    }
    const sock = comoRoot() ? tmpdir() : dados;
    const rodando = spawnSync(join(bin, 'pg_ctl'), ['-D', dados, 'status'], { stdio: 'ignore' }).status === 0;
    if (!rodando) {
      executarPg(bin, 'pg_ctl', ['-D', dados, '-w', '-t', '30', '-l', join(dados, 'log.txt'), '-o',
        `-p ${PORTA_PG} -k ${sock} -c listen_addresses=127.0.0.1`, 'start']);
      pararBanco = () => {
        try {
          executarPg(bin, 'pg_ctl', ['-D', dados, '-m', 'fast', 'stop']);
        } catch {
          /* já parado */
        }
      };
    }
    ok(`PostgreSQL local na porta ${PORTA_PG} (dados em ${dados})`);
    return `postgres://postgres@127.0.0.1:${PORTA_PG}/postgres`;
  }

  if (dockerDisponivel()) {
    const existe = saida('docker', ['ps', '-a', '--filter', `name=^${CONTEINER}$`, '--format', '{{.Names}}']) === CONTEINER;
    const r = existe
      ? spawnSync('docker', ['start', CONTEINER], { stdio: 'pipe' })
      : spawnSync('docker', ['run', '-d', '--name', CONTEINER, '-e', 'POSTGRES_PASSWORD=postgres',
          '-v', `${CONTEINER}:/var/lib/postgresql/data`, '-p', `127.0.0.1:${PORTA_PG}:5432`, 'postgres:16-alpine'], { stdio: 'pipe' });
    if (r.status !== 0) falhar(`Docker não subiu o banco: ${r.stderr.toString().trim()}`);
    const limite = Date.now() + 60_000;
    while (spawnSync('docker', ['exec', CONTEINER, 'pg_isready', '-U', 'postgres', '-h', '127.0.0.1']).status !== 0) {
      if (Date.now() > limite) falhar('O PostgreSQL no Docker não ficou pronto em 60 s.');
      await new Promise((r2) => setTimeout(r2, 500));
    }
    pararBanco = () => {
      spawnSync('docker', ['stop', CONTEINER], { stdio: 'ignore' });
    };
    ok(`PostgreSQL no Docker (contêiner ${CONTEINER}, porta ${PORTA_PG})`);
    return `postgres://postgres:postgres@127.0.0.1:${PORTA_PG}/postgres`;
  }

  return falhar('Preciso de um PostgreSQL 14+ instalado ou do Docker rodando. Instale um dos dois e rode de novo.');
}

function resetar(): void {
  if (dockerDisponivel()) {
    spawnSync('docker', ['rm', '-f', CONTEINER], { stdio: 'ignore' });
    spawnSync('docker', ['volume', 'rm', CONTEINER], { stdio: 'ignore' });
  }
  rmSync(join(tmpdir(), 'acessa-evento-dev-pg'), { recursive: true, force: true });
  for (const item of ['pg', 'segredos.json']) rmSync(join(DEV, item), { recursive: true, force: true });
  ok('Banco e chaves de desenvolvimento apagados');
}

// ---------- 3. Migrações, evento e usuário da API ----------

function rodarNode(script: string, env: NodeJS.ProcessEnv): void {
  const r = spawnSync(process.execPath, [script], { cwd: API, env: { ...process.env, ...env }, encoding: 'utf8' });
  if (r.status !== 0) falhar(`${script} falhou:\n${r.stdout}${r.stderr}`);
}

async function prepararBanco(urlDono: string, s: Segredos): Promise<string> {
  rodarNode('src/main/migrar.ts', { DATABASE_URL_MIGRACAO: urlDono });
  rodarNode('src/main/semear.ts', { DATABASE_URL_MIGRACAO: urlDono });
  const cliente = new pg.Client({ connectionString: urlDono });
  await cliente.connect();
  try {
    const existe = (await cliente.query("select 1 from pg_roles where rolname = 'acessa_api'")).rowCount === 1;
    const senha = cliente.escapeLiteral(s.senhaApi);
    await cliente.query(existe
      ? `alter role acessa_api login password ${senha}`
      : `create role acessa_api login password ${senha} in role app_api`);
  } finally {
    await cliente.end();
  }
  ok('Migrações aplicadas, evento COCAL 2026 criado e usuário da API pronto');
  return urlDono.replace(/^postgres:\/\/[^@]+@/, `postgres://acessa_api:${encodeURIComponent(s.senhaApi)}@`);
}

// ---------- 4. API ----------

async function subirApi(urlApi: string, s: Segredos): Promise<number> {
  const porta = await portaLivre(3333);
  const api = spawn(process.execPath, ['src/main/server.ts'], {
    cwd: API,
    env: { ...process.env, PORTA: String(porta), AMBIENTE: 'desenvolvimento', DATABASE_URL: urlApi,
      CHAVES_CIFRA: s.chavesCifra, CHAVE_INDICE: s.chaveIndice, EMAIL_PROVEDOR: 'dev' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  filhos.push(api);
  api.stderr?.pipe(process.stderr);
  return new Promise((resolver) => {
    createInterface({ input: api.stdout as NodeJS.ReadableStream }).on('line', (linha) => {
      let e: Record<string, unknown>;
      try {
        e = JSON.parse(linha) as Record<string, unknown>;
      } catch {
        return;
      }
      if (e['mensagem'] === 'ouvindo') resolver(porta);
      if (e['mensagem'] === 'email_dev') {
        process.stdout.write(`\n  📩 Código de acesso para ${String(e['para'])}:  ${String(e['codigoDesenvolvimento'])}\n\n`);
      }
      if (e['nivel'] === 'error') process.stderr.write(`  ✖ API: ${linha}\n`);
    });
    api.on('exit', (c) => falhar(`A API parou (código ${c}).`));
  });
}

// ---------- 5. Links públicos (Cloudflare quick tunnel) ----------

async function cloudflared(): Promise<string> {
  if (saida('cloudflared', ['--version'])) return 'cloudflared';
  const local = join(DEV, 'bin', 'cloudflared');
  if (existsSync(local)) return local;
  const so = platform();
  const cpu = arch() === 'arm64' ? 'arm64' : 'amd64';
  if (so !== 'linux' && so !== 'darwin') falhar('Instale o cloudflared (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) ou use --lan.');
  const nome = so === 'linux' ? `cloudflared-linux-${cpu}` : `cloudflared-darwin-${cpu}.tgz`;
  process.stdout.write('  Baixando o cloudflared (só na primeira vez)…\n');
  const r = await fetch(`https://github.com/cloudflare/cloudflared/releases/latest/download/${nome}`);
  if (!r.ok) falhar(`Não consegui baixar o cloudflared (HTTP ${r.status}). Use --lan ou instale manualmente.`);
  mkdirSync(join(DEV, 'bin'), { recursive: true });
  const destino = nome.endsWith('.tgz') ? join(DEV, 'bin', nome) : local;
  writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
  if (destino !== local) {
    spawnSync('tar', ['-xzf', destino, '-C', join(DEV, 'bin')]);
    rmSync(destino);
  }
  chmodSync(local, 0o755);
  if (!saida(local, ['--version'])) {
    rmSync(local, { force: true });
    falhar('O cloudflared baixado não executou. Rode de novo, use --lan ou instale o cloudflared manualmente.');
  }
  return local;
}

async function abrirTunel(bin: string, porta: number, nome: string): Promise<string> {
  const t = spawn(bin, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${porta}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  filhos.push(t);
  return new Promise((resolver, rejeitar) => {
    const limite = setTimeout(() => rejeitar(new Error(`o link público da ${nome} não saiu em 45 s`)), 45_000);
    const ler = (bloco: Buffer): void => {
      const url = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(bloco.toString())?.[0];
      if (url) {
        clearTimeout(limite);
        resolver(url);
      }
    };
    t.stdout?.on('data', ler);
    t.stderr?.on('data', ler);
    t.on('exit', (c) => rejeitar(new Error(`o cloudflared da ${nome} parou (código ${c})`)));
  });
}

async function esperarNoAr(url: string): Promise<void> {
  const limite = Date.now() + 60_000;
  while (Date.now() < limite) {
    try {
      if ((await fetch(`${url}/saude`, { signal: AbortSignal.timeout(5_000) })).ok) return;
    } catch {
      /* o DNS do link novo leva alguns segundos */
    }
    await new Promise((r) => setTimeout(r, 1_500));
  }
  process.stdout.write('  ⚠ O link público ainda não respondeu; pode levar mais alguns segundos.\n');
}

// ---------- 6. IP da rede local (modo --lan) ----------

function ipDaRede(): string {
  for (const [nome, enderecos] of Object.entries(networkInterfaces())) {
    if (/^(docker|br-|veth|virbr|tun|tailscale|wg|utun|lo)/.test(nome)) continue;
    const v4 = enderecos?.find((e) => e.family === 'IPv4' && !e.internal);
    if (v4) return v4.address;
  }
  return falhar('Não achei o IP da rede local. Rode sem --lan para usar o link público.');
}

// ---------- Execução ----------

if (!existsSync(join(RAIZ, 'node_modules'))) falhar('Rode npm install na raiz antes.');
mkdirSync(DEV, { recursive: true });
if (opcoes.has('--resetar')) {
  passo('Resetando');
  resetar();
}

passo('Banco');
const urlDono = await subirBanco();
const s = segredos();
const urlApi = await prepararBanco(urlDono, s);

passo('API');
const portaApi = await subirApi(urlApi, s);
ok(`API em http://localhost:${portaApi}/saude`);

let urlPublicaApi: string;
let ambienteExpo: NodeJS.ProcessEnv = {};
if (opcoes.has('--lan')) {
  urlPublicaApi = `http://${ipDaRede()}:${portaApi}`;
  ok(`App vai usar a API em ${urlPublicaApi} (mesma rede Wi-Fi)`);
} else {
  passo('Links públicos');
  const bin = await cloudflared();
  try {
    urlPublicaApi = await abrirTunel(bin, portaApi, 'API');
    await esperarNoAr(urlPublicaApi);
    ok(`API pública: ${urlPublicaApi}/saude`);
    if (!opcoes.has('--sem-app')) {
      const urlMetro = await abrirTunel(bin, 8081, 'app');
      ambienteExpo = { EXPO_PACKAGER_PROXY_URL: urlMetro };
      ok(`Metro público: ${urlMetro}`);
    }
  } catch (e) {
    urlPublicaApi = falhar(`${(e as Error).message}. Confira a internet ou rode com --lan.`);
  }
}

if (opcoes.has('--sem-app')) {
  process.stdout.write(`\nPronto. Teste com: curl ${urlPublicaApi}/saude\nCtrl+C encerra tudo.\n`);
} else {
  passo('App (Expo)');
  process.stdout.write('  Leia o QR com a câmera do iPhone (ou o app Expo Go no Android). Os códigos de acesso aparecem aqui.\n\n');
  const expo = spawn('npx', ['expo', 'start', '--clear', '--port', '8081', ...(opcoes.has('--lan') ? ['--lan'] : [])], {
    cwd: MOBILE,
    stdio: 'inherit',
    env: { ...process.env, ...ambienteExpo, EXPO_PUBLIC_API_URL: urlPublicaApi },
    shell: process.platform === 'win32',
  });
  filhos.push(expo);
  expo.on('exit', () => {
    encerrar();
    process.exit(0);
  });
}

# Teste manual

Roteiro para subir o ecossistema na sua máquina e passar pelo fluxo da fase 3: banco, API e app. Leva uns 10 minutos.

Pré-requisitos: Node 22.18 ou mais novo, Docker (ou PostgreSQL 16 instalado) e `npm ci` já rodado na raiz.

## 1. Banco

```bash
docker run -d --name acessa-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16-alpine
```

## 2. Migrações, evento de referência e usuário da API

A migração roda com o dono do esquema. A API usa outro usuário, membro do papel `app_api`, para que a RLS valha.

```bash
cd apps/api
export DATABASE_URL_MIGRACAO=postgres://postgres:postgres@127.0.0.1:5432/postgres
npm run migrar
npm run semear
docker exec acessa-pg psql -U postgres -c "create role acessa_api login password 'senha-local' in role app_api"
```

## 3. Subir a API

```bash
export DATABASE_URL=postgres://acessa_api:senha-local@127.0.0.1:5432/postgres
export CHAVES_CIFRA="1:$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
export CHAVE_INDICE="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
export EMAIL_PROVEDOR=dev
npm start
```

As chaves geradas assim valem só para esta sessão do terminal. Se reiniciar com chaves novas, o e-mail cifrado das contas criadas antes não decifra mais: apague o banco (`docker rm -f acessa-pg`) e recomece, ou guarde as chaves num `.env` local.

Confira: `curl -s localhost:3333/saude` deve responder `"estado":"ok"` com o banco `ok`.

## 4. Fluxo pela API (outro terminal)

```bash
curl -s -X POST localhost:3333/acesso/codigo -H 'content-type: application/json' -d '{"email":"voce@exemplo.com.br"}'
```

O código aparece no log da API, no campo `codigoDesenvolvimento`. Troque `123456` por ele:

```bash
TOKEN=$(curl -s -X POST localhost:3333/acesso/entrar -H 'content-type: application/json' \
  -d '{"email":"voce@exemplo.com.br","codigo":"123456"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

curl -s localhost:3333/conta -H "authorization: Bearer $TOKEN"
curl -s -X PUT localhost:3333/conta/primeiro-acesso -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"nomeCracha":"Seu Nome","aceitaTermos":true,"versaoTermos":"2026-11-03"}'
curl -s localhost:3333/conta/exportacao -H "authorization: Bearer $TOKEN"
```

Vale testar os erros também: código errado 5 vezes (o sexto é bloqueado), 4 pedidos de código seguidos (o quarto é recusado), `/conta` sem token (401).

## 5. App

```bash
cd apps/mobile
EXPO_PUBLIC_API_URL=http://SEU_IP_NA_REDE:3333 npx expo start
```

- **Celular com Expo Go:** leia o QR do terminal. Celular e computador na mesma rede; use o IP da máquina (`hostname -I`), não `localhost`.
- **Emulador Android:** tecla `a` no terminal do Expo; use `EXPO_PUBLIC_API_URL=http://10.0.2.2:3333`.

No app: e-mail → código do log da API → nome do crachá e aceite → "Olá, Seu Nome". Feche e abra o app: ele entra direto. "Sair" volta ao login.

Para testar a acessibilidade, ligue o TalkBack (Android) ou o VoiceOver (iOS), aumente a fonte do sistema e ative o tema escuro.

## 6. Olhar o banco por dentro

```bash
docker exec -it acessa-pg psql -U postgres
```

```sql
select id, email_cifrado, nome_cracha from pessoa;          -- e-mail ilegível
select acao, criado_em, encode(hash, 'hex') from auditoria;  -- trilha encadeada
select auditoria_verificar();                                -- null = cadeia íntegra
```

## Limpar

```bash
docker rm -f acessa-pg
```

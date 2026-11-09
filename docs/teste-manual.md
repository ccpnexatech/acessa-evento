# Teste manual

Um comando sobe tudo: banco, API, links públicos e o app.

```bash
npm install     # só na primeira vez
npm run dev
```

Pré-requisitos: Node 22.18 ou mais novo e **um** destes: Docker rodando ou PostgreSQL 14+ instalado. No celular, o app Expo Go.

## O que o comando faz

1. **Banco:** usa o PostgreSQL da máquina ou, se não houver, um contêiner Docker (`acessa-evento-dev-pg`). Os dados ficam guardados entre uma execução e outra.
2. **Migrações e evento:** aplica as migrações, cria o COCAL 2026 e um usuário próprio da API (papel `app_api`), para a RLS valer como em produção.
3. **Chaves:** gera uma vez as chaves de cifra e a senha do usuário da API e guarda em `.dev/segredos.json` (fora do git).
4. **API:** sobe na porta 3333 (ou na próxima livre). Os códigos de acesso aparecem no terminal assim: `📩 Código de acesso para c***@exemplo.com.br: 123456`.
5. **Links públicos:** abre dois links HTTPS aleatórios do Cloudflare (`*.trycloudflare.com`), um para a API e um para o app. O `cloudflared` é baixado sozinho para `.dev/bin` na primeira vez. Os links mudam a cada execução e só quem vê o terminal conhece.
6. **App:** abre o Expo já apontando para a API pública. Leia o QR com a câmera do iPhone ou com o Expo Go no Android.

Funciona em qualquer rede, inclusive Wi-Fi que isola os aparelhos, e sem descobrir IP.

## Opções

| Comando | Quando usar |
| --- | --- |
| `npm run dev -- --lan` | Rede local sem isolamento: mais rápido, sem túnel. O IP é descoberto sozinho. |
| `npm run dev -- --sem-app` | Só banco e API (com link público), para testar com curl ou Bruno. |
| `npm run dev -- --resetar` | Começa do zero: apaga o banco e as chaves de desenvolvimento. |
| `npm run dev -- --equipe voce@exemplo.com.br` | Dá ao e-mail o papel de credenciamento no COCAL 2026: aparece "Credenciamento" em Ajuda. |

`Ctrl+C` encerra tudo; os dados continuam para a próxima vez.

## Roteiro do teste

- **Caminho feliz:** e-mail → código (do terminal) → nome do crachá e aceite → "Olá, Seu Nome". Feche e abra o app: entra direto. "Sair" volta ao login.
- **Erros:** e-mail sem domínio; código errado 5 vezes (o código é bloqueado); 4 pedidos de código seguidos (o quarto é recusado).
- **Inscrição (fase 5):** "Ver eventos sem entrar" → COCAL 2026 → Inscrever-se. Cartão `4242 4242 4242 4242` aprova, `4000 0000 0000 0002` é recusado; Pix sempre aprova.
- **Ingresso e credenciamento (fase 6):** dois aparelhos (ou um aparelho e duas contas). No do participante, a aba Ingresso mostra o QR, também em modo avião. No da equipe (`--equipe`), Ajuda → Credenciamento → Ler QR. Teste em modo avião: as leituras ficam "na fila" e sobem quando a internet volta. Leia o mesmo QR de novo: "Já entrou hoje". O QR vale até 2 dias depois do fim do evento.
- **Acessibilidade:** VoiceOver ou TalkBack, fonte do sistema no máximo, tema escuro.

## Pela API, sem o app

```bash
npm run dev -- --sem-app
# em outro terminal, com a URL que o comando mostrar:
API=https://xxxx.trycloudflare.com
curl -s -X POST $API/acesso/codigo -H 'content-type: application/json' -d '{"email":"voce@exemplo.com.br"}'
TOKEN=$(curl -s -X POST $API/acesso/entrar -H 'content-type: application/json' \
  -d '{"email":"voce@exemplo.com.br","codigo":"CODIGO_DO_TERMINAL"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl -s $API/conta -H "authorization: Bearer $TOKEN"
```

## Olhar o banco por dentro

```bash
psql postgres://postgres:postgres@127.0.0.1:54329/postgres   # com Docker
psql postgres://postgres@127.0.0.1:54329/postgres            # com PostgreSQL local
```

```sql
select id, email_cifrado, nome_cracha from pessoa;          -- e-mail ilegível
select acao, criado_em from auditoria order by id;           -- trilha encadeada
select auditoria_verificar();                                -- null = cadeia íntegra
```

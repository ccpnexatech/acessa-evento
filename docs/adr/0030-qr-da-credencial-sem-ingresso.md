# 0030. QR da credencial sem ingresso: mesmo formato, campo `c`

- Status: Aceita
- Data: 2026-11-15
- Detalha: [0026](0026-credencial-e-regras-de-zona-fora-do-qr.md), [0022](0022-qr-assinado-e-credenciamento-offline.md)

## Contexto

O ADR 0026 criou credenciais para quem não compra ingresso (palestrante, segurança, montagem, equipe do expositor) e deixou em aberto como o QR delas se identifica. O QR da v1.0.0 é `AE1.<conteúdo>.<assinatura>`, com `k` (chave), `i` (ingresso), `e` (evento) e `x` (validade), e há um vetor de teste fixo compartilhado entre API e app.

## Decisão

1. **Mesmo prefixo, mesma assinatura, mesma validade.** O conteúdo passa a ter `i` (ingresso) **ou** `c` (credencial), nunca os dois.
2. **Quem tem ingresso continua recebendo `i`.** O QR do congressista não muda em nada: o vetor de teste da v1.0.0 permanece válido byte a byte, e o banco acha a credencial pelo ingresso.
3. **Credencial sem ingresso recebe `c`**, com um segundo vetor fixo de teste que o app também confere.
4. **O QR continua sem zona, sem categoria e sem dado pessoal.** O leitor acha a credencial pelo id na lista que baixou, e é a lista que diz categoria, revogação e regras.
5. **Leitura enviada à API aponta para `credencialId` ou `ingressoId`.** A rota nova (`/acessos/:slug/leituras`) aceita os dois; a rota da v1 (`/credenciamento/:slug/checkins`) continua igual.

## Alternativas descartadas

- **Prefixo novo (`AE2`) para tudo.** Obrigaria a reemitir os QR já entregues e quebraria o app da v1.0.0 na porta.
- **Pôr `c` em todos os QR, inclusive nos de ingresso.** Mudaria o vetor da v1 sem ganho: o ingresso já leva à credencial.
- **Categoria dentro do QR**, para o leitor decidir sem lista. A lista já é obrigatória para barrar revogados; a categoria no QR só criaria duas fontes para a mesma informação, e uma delas impressa.

## Consequências

- Um app na versão 1.0.0 que leia um QR com `c` responde "QR inválido": ele não conhece credencial sem ingresso. Congressistas não são afetados.
- O leitor novo trata `i` e `c` do mesmo jeito depois de achar a credencial.
- `shared/qr/token.ts` e a cópia do app precisam mudar juntos; os dois vetores de teste garantem isso.

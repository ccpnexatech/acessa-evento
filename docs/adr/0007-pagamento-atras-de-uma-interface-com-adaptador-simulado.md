# 0007. Pagamento atrás de uma interface, com adaptador simulado no MVP

- Status: Aceita
- Data: 2026-11-02

## Contexto

O MVP é um case de portfólio sem CNPJ de evento real e não pode prender o produto a um gateway.

## Decisão

Definir a interface `ProvedorPagamento` (criar cobrança, consultar, estornar, webhook) com chave de idempotência obrigatória. O MVP usa só o `AdaptadorSimulado`, que aprova ou recusa de forma determinística e mostra "Ambiente de teste" na tela.

## Consequências

**Ganhamos**
- Fluxo de compra completo e testável sem conta em gateway.
- Trocar de gateway é escrever um adaptador.

**Pagamos**
- Nenhuma receita real até existir um adaptador de produção.
- Webhooks reais (atraso, repetição) só são simulados.

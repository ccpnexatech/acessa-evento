# 0018. Cache offline e fila de favoritos próprios, atrás de portas

- Status: Aceita
- Data: 2026-11-04
- Substitui: a parte de estado e cache do briefing original (TanStack Query e Zustand)

## Contexto

O briefing previa TanStack Query para cache e Zustand para estado. A agenda precisa de três coisas: abrir sem rede com a última versão, atualizar barato quando há rede e guardar favoritos feitos offline para enviar depois. A regra do projeto é recursos nativos primeiro, com terceiros só atrás de portas (ADR 0013 e 0014).

## Decisão

- A API devolve a agenda com `ETag` (md5 do conteúdo) e responde `304` quando nada mudou.
- No app, `AgendaOffline` guarda a agenda num arquivo (porta `Cofre`, com `expo-file-system` como adaptador) e manda `If-None-Match` na próxima vez.
- `FavoritosOffline` aplica a mudança na hora, guarda uma fila com só a última intenção por atividade e a envia quando há rede. Sem conexão ou 5xx, a fila fica; 404 e outros 4xx descartam o pedido. Depois do envio vale a lista do servidor.
- O estado compartilhado fica em dois contextos do React (`ProvedorSessao` e `ProvedorAgenda`), que sincronizam ao abrir, ao voltar para o app e a cada 30 s enquanto offline.

## Consequências

- Nenhuma dependência nova para cache ou estado; as regras ficam em classes puras, testadas sem React e sem rede.
- Perdemos de graça o que o TanStack Query dá (deduplicação, retry com backoff, devtools). Com uma agenda e uma lista de favoritos, não fazem falta; se o app crescer, um adaptador com TanStack Query pode entrar atrás da mesma porta `Requisitor`.
- Conflito de favoritos é resolvido por "último a falar vence" no servidor, o que basta para uma marcação pessoal.

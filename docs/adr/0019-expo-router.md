# 0019. Navegação com Expo Router

- Status: Aceita
- Data: 2026-11-04

## Contexto

Com a agenda, o app passa de uma tela para várias: entrar, abas (agenda, ingresso, ajuda) e detalhe da palestra. O detalhe precisa de link direto (`acessaevento://atividade/<id>`) para notificações e para o assistente.

## Decisão

Expo Router, por arquivos em `src/app`. Os guardas `Stack.Protected` separam quem entrou de quem não entrou. Os arquivos de rota são finos: leem a sessão e passam a navegação por callback para as telas em `src/features`, que não importam o roteador.

## Consequências

- Links diretos e voltar do sistema funcionam sem código próprio.
- É uma dependência de framework, mas do próprio Expo, mantida junto com o SDK.
- As telas seguem testáveis com React Native Testing Library sem simular o roteador.
- Precisamos fixar `react` e `react-dom` na mesma versão (`overrides` na raiz), porque o `react-dom` trazido pelo roteador duplicava o React.

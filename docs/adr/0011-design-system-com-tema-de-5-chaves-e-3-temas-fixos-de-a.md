# 0011. Design system com tema de 5 chaves e 3 temas fixos de acessibilidade

- Status: Aceita
- Data: 2026-11-02

## Contexto

Cada evento quer a sua marca, mas configuração livre de cores quebra contraste e causa erro humano.

## Decisão

O contratante escolhe só 5 chaves (`cor_primaria`, `cor_destaque`, `fonte`, `arredondamento`, `logo_url`). O gerador calcula os tokens e recusa pares abaixo de WCAG AA. Superfícies, textos, estados e foco são fixos. Claro, escuro e alto contraste existem em todo evento; o alto contraste escolhido pelo participante sobrepõe a marca.

## Consequências

**Ganhamos**
- Marca do evento sem perder acessibilidade.
- Configuração difícil de errar.

**Pagamos**
- Menos liberdade visual para o contratante.

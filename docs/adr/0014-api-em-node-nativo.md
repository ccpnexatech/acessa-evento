# 0014. API em Node nativo: node:http, node:test e type stripping

- Status: Aceita
- Data: 2026-11-02

## Contexto

A API é pequena, precisa ser auditável e deve depender do mínimo possível de terceiros. O Node 22 já oferece servidor HTTP, executor de testes com cobertura, `fetch`, `crypto` (incluindo Ed25519) e execução direta de TypeScript por remoção de tipos.

## Decisão

- Servidor em `node:http`, com um adaptador próprio (`shared/http/servidor.ts`) que aplica id de requisição, cabeçalhos de segurança, CORS por lista, limite de corpo e erros em Problem Details (RFC 9457).
- Testes com `node:test` e `node:assert`, cobertura mínima de 90% em linhas e 85% em ramos; e2e sobe o processo real.
- TypeScript executado pelo Node (type stripping), com `erasableSyntaxOnly`; `tsc` só verifica tipos. Sem etapa de build.
- Camadas por módulo: `domain` (regras puras), `application` (casos de uso e portas), `adapters` (HTTP, Postgres), ligados só em `src/main`. O lint impede domínio e aplicação de importarem infraestrutura.

## Consequências

**Ganhamos**
- Zero dependência de produção na API até agora.
- O código que roda é o código escrito; nada de transpilação no deploy.

**Pagamos**
- Roteamento, validação e middlewares são código nosso, que precisa de teste.
- Sintaxe só apagável: sem `enum` nem propriedades no construtor.
- O app mobile segue com Jest e React Native Testing Library, padrão da plataforma Expo.

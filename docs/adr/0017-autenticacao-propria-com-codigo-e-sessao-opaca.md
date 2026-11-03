# 0017. Autenticação própria: código por e-mail e sessão opaca

- Status: Aceita
- Data: 2026-11-03
- Substitui: [0003](0003-supabase-como-banco-gerenciado-e-provedor-de-autenticac.md) (na parte de autenticação; o Supabase segue como PostgreSQL gerenciado)

## Contexto

O ADR 0003 previa o Supabase Auth. Depois, a regra do projeto passou a ser recursos nativos primeiro (ADR 0013 e 0014). O fluxo pedido é simples: login sem senha por código de 6 números, cadastro no primeiro login, sair, exportar e excluir conta. O Node já tem tudo o que isso exige: gerador criptográfico, HMAC e comparação em tempo constante.

## Decisão

- Código de 6 dígitos com `crypto.randomInt`, guardado só como HMAC, válido por 10 minutos, de uso único, bloqueado após 5 erros. Até 3 pedidos por e-mail a cada 10 minutos. A resposta ao pedido é a mesma com ou sem conta.
- Sessão opaca: token de 256 bits devolvido ao app; o banco guarda só o HMAC dele. Validade de 30 dias, revogável em "Sair" e apagada em cascata ao excluir a conta.
- O app guarda o token no Keychain/Keystore (`expo-secure-store`).
- Envio de e-mail atrás da porta `EnviadorEmail`: log em desenvolvimento, Resend via `fetch` em produção.
- Antes do login não há pessoa no contexto da RLS; duas funções `security definer` mínimas fazem a busca necessária (`pessoa_por_email_hash`, `sessao_validar`).

## Consequências

**Ganhamos**
- Nenhum provedor de identidade de terceiro; o fluxo é testado de ponta a ponta com Postgres real.
- Sessões revogáveis na hora, sem lista de bloqueio de JWT.
- Trocar o e-mail ou acrescentar outro método de login é escrever um adaptador.

**Pagamos**
- Segurança de autenticação passa a ser nossa responsabilidade: limites, expiração e auditoria precisam de teste (estão em `acesso.test.ts` e `conta.int.ts`).
- Ainda falta limite de taxa por IP na borda; hoje o limite é por e-mail.
- Cada requisição autenticada consulta o banco para validar a sessão.

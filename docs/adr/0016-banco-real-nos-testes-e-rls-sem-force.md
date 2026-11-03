# 0016. Testes contra PostgreSQL real e RLS sem FORCE

- Status: Aceita
- Data: 2026-11-03

## Contexto

As garantias mais importantes da fase 2 (isolamento por evento, privilégios por coluna, auditoria imutável) vivem no banco. Mock de banco não prova nenhuma delas. Ao mesmo tempo, as funções que consultam papéis e encadeiam a auditoria precisam ler linhas que a RLS esconderia de quem chama.

## Decisão

- Testes de integração rodam contra PostgreSQL 16 de verdade, um database novo por arquivo, com as migrações aplicadas. Localmente, `scripts/banco-teste.ts` sobe um cluster temporário com o `initdb` da máquina; no CI, um serviço `postgres:16`.
- Os testes de segurança usam o papel real da API (`set local role app_api`), nunca o superusuário.
- RLS fica habilitada sem `FORCE`. A API nunca conecta como dono das tabelas; as funções `tem_papel` e `auditoria_encadear` são `security definer` com `search_path` fixo e só leem.
- O papel `app_api` não tem login nem `BYPASSRLS`; cada ambiente cria seu usuário de login como membro dele.

## Consequências

**Ganhamos**
- Cada política de RLS e cada privilégio tem um teste que falha se for afrouxado.
- Nenhuma dependência de Docker para rodar os testes na máquina.

**Pagamos**
- Quem desenvolve precisa do PostgreSQL 16 instalado, ou definir `DATABASE_URL_TESTE`.
- Um erro de conexão como dono do esquema ignoraria a RLS: a configuração de produção precisa usar o usuário da API, e o README diz isso.

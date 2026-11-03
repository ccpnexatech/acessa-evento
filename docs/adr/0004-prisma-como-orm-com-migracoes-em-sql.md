# 0004. Prisma como ORM, com migrações em SQL

- Status: Substituída pela [0013](0013-sql-puro-com-pg-e-repositorios.md)
- Data: 2026-11-02

## Contexto

O ORM precisa ser confiável e conhecido, mas RLS, funções e a tabela de auditoria com cadeia de hash não são expressáveis no schema do ORM.

## Decisão

Usar Prisma para consultas e tipos. Migrações são arquivos SQL versionados (`prisma migrate` com SQL editado à mão quando necessário), incluindo RLS, gatilhos e permissões.

## Consequências

**Ganhamos**
- Tipos gerados para o TypeScript.
- Controle total do SQL onde importa.

**Pagamos**
- Duas fontes de verdade a manter alinhadas (schema e SQL).
- Consultas com RLS exigem definir o contexto (`set_config`) por transação.

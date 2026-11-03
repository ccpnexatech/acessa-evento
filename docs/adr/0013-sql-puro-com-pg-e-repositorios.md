# 0013. SQL puro com o driver pg, atrás de repositórios

- Status: Aceita
- Data: 2026-11-02
- Substitui: [0004](0004-prisma-como-orm-com-migracoes-em-sql.md)

## Contexto

A regra do projeto passou a ser: usar recursos nativos e evitar frameworks de terceiros; quando usar, isolar com SOLID e clean architecture. O Prisma traz um motor próprio, geração de código e uma segunda fonte de verdade, e as partes críticas (RLS, gatilhos, auditoria com cadeia de hash) já seriam escritas em SQL.

## Decisão

Usar só o driver oficial `pg`. Cada módulo define uma porta de repositório na camada de aplicação (por exemplo, `RepositorioIngressos`) e a implementa em `adapters/postgres/` com SQL parametrizado. Migrações são arquivos `.sql` numerados, aplicados por um script próprio que registra o que já rodou numa tabela de controle. O contexto de RLS (`set_config('app.evento_id', …)`) é definido por transação no adaptador.

## Consequências

**Ganhamos**
- Uma dependência pequena e estável no lugar de um ORM.
- O SQL que roda é o SQL que está no repositório; RLS e auditoria ficam visíveis.
- Casos de uso testados com repositórios em memória, sem banco.

**Pagamos**
- Tipos das linhas escritos à mão, verificados por testes de integração.
- Mais código de mapeamento linha → entidade.

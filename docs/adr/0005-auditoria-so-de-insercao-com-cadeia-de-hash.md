# 0005. Auditoria só de inserção com cadeia de hash

- Status: Aceita
- Data: 2026-11-02

## Contexto

Check-in manual, exclusão de conta, exportação de dados e mudanças de papel precisam de rastro confiável (LGPD, nível gov).

## Decisão

Tabela `auditoria` em que o papel da aplicação só pode inserir. Cada linha guarda o SHA-256 da linha anterior, formando uma cadeia; uma verificação periódica recalcula a cadeia.

## Consequências

**Ganhamos**
- Alteração ou remoção de registro é detectável.
- Sem serviço pago de log.

**Pagamos**
- Inserções ficam serializadas pela cadeia; aceitável no volume do MVP.

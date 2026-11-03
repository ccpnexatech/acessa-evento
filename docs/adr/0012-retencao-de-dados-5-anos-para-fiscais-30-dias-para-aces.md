# 0012. Retenção de dados: 5 anos para fiscais, 30 dias para acessibilidade

- Status: Aceita
- Data: 2026-11-02

## Contexto

Dados de acessibilidade são sensíveis (podem revelar deficiência) e só servem para o evento. Registros de compra têm obrigação fiscal.

## Decisão

Pedidos de recursos de acessibilidade são apagados 30 dias após o fim do evento. Registros fiscais ficam 5 anos, desvinculados da conta em caso de exclusão. Cadastro acontece no primeiro login; a pessoa pode exportar e excluir os dados pelo app.

## Consequências

**Ganhamos**
- Mínimo necessário (LGPD).
- Exclusão e exportação de autoatendimento.

**Pagamos**
- Rotina agendada de expurgo precisa de teste e auditoria.

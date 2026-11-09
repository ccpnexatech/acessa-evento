# 0021. Inscrição idempotente, vagas reservadas no banco e cartão só de passagem

- Status: Aceita
- Data: 2026-11-09
- Complementa: [0007](0007-pagamento-atras-de-uma-interface-com-adaptador-simulado.md) e [0012](0012-retencao-de-dados-5-anos-para-fiscais-30-dias-para-aces.md)

## Contexto

A feature 02 pede três garantias que não podem depender de cuidado na tela: não vender além das vagas, não cobrar duas vezes quando a internet cai no meio do pagamento e não guardar dado de cartão. Também pede o pedido de recursos de acessibilidade, dado sensível que precisa de prazo para sumir.

## Decisão

- **Idempotência pela chave do app.** Cada tentativa de pagar manda `Idempotency-Key` (UUID gerado com `expo-crypto`). O banco tem `unique (pessoa_id, chave_idempotencia)`. A mesma chave devolve o mesmo resultado (200) sem nova cobrança; a primeira resposta é 201. O app só troca de chave diante de uma resposta definitiva (aprovado, recusado, esgotado) ou se a pessoa mudar a forma de pagamento.
- **Vagas no banco.** `reservar_vaga` faz `update ... where ocupadas < vagas` numa só instrução, antes de cobrar; recusa devolve a vaga (`liberar_vaga`). A coluna `ocupadas` não pode ser alterada pela API, só pelas duas funções. O teste de integração dispara três pedidos pela última vaga ao mesmo tempo e só um passa.
- **Ordem:** reservar (pedido pendente) → cobrar → concluir. Se o provedor falhar, o pedido fica pendente e a mesma chave retoma da cobrança, sem nova reserva.
- **Cartão só de passagem.** O número vai do app ao adaptador e nunca é gravado nem registrado em log; o pedido guarda só os 4 últimos dígitos. O teste confere que o número não aparece em nenhuma coluna. O Luhn é checado no app e na API.
- **Acessibilidade com prazo.** `pedido_acessibilidade` guarda só a lista de recursos (sem texto livre) com `apagar_apos` = fim do evento + 30 dias; `expurgar_acessibilidade()` apaga os vencidos. Excluir a conta apaga o pedido de acessibilidade e o ingresso; o pedido fiscal fica, com `pessoa_id` nulo.
- **Recibo é cortesia.** Falha no e-mail não desfaz a inscrição.

## Consequências

- Duas garantias críticas (vaga e cobrança única) são provadas contra o Postgres real, não só em memória.
- Com um gateway real, o número do cartão não deveria passar pela nossa API: o SDK do gateway tokeniza no aparelho e a API recebe só o token. A porta `ProvedorPagamento` já recebe a cobrança inteira, então a troca fica no adaptador e no formulário.
- Pedido pendente prende a vaga até ser concluído. Ainda falta expirar pendentes antigos (tarefa agendada, junto com o expurgo).
- Trocar de Pix para cartão depois de uma falha de rede cria outro pedido; o anterior fica pendente até a expiração acima.

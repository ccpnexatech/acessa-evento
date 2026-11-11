# 0026. Credencial por categoria e regras de zona fora do QR

- Status: Aceita
- Data: 2026-11-11
- Amplia: [0022](0022-qr-assinado-e-credenciamento-offline.md)

## Contexto

Na v1.0.0 só existia congressista, e o QR respondia a uma pergunta: este ingresso vale? Um evento de verdade tem palestrante, expositor, montagem, segurança, limpeza, e lugares onde só alguns entram (bastidores, sala VIP, área de carga). O organizador quer decidir isso sozinho, e mudar de ideia na véspera.

Três restrições vêm da v1 e não se negociam: a leitura funciona sem internet, o QR não carrega dado pessoal, e os QR já emitidos continuam valendo.

## Decisão

1. **Credencial é entidade própria.** `credencial (evento, pessoa, categoria)` diz o que a pessoa é naquele evento. Todo ingresso gera a sua, de categoria `congressista`, por gatilho; cancelar o ingresso revoga a credencial. As outras categorias são emitidas sem ingresso, por admin ou operação. Uma pessoa pode ter mais de uma categoria no mesmo evento, e só uma ativa de cada.
2. **Categorias em lista fechada**, num `domain` do banco: congressista, palestrante, convidado, expositor, equipe, alimentação, entretenimento, limpeza, segurança, montagem e marketing.
3. **A zona fica fora do QR.** O QR identifica a credencial (e, na v1, o ingresso). Quem entra onde está em `regra_zona (zona, categoria, janela opcional)`, que o leitor baixa junto com a lista. Zona marcada como aberta aceita qualquer credencial válida. Sem regra, não entra.
4. **Exceção pessoal com motivo** (`credencial_excecao`): libera ou barra uma credencial numa zona, e ganha da regra. O motivo é obrigatório.
5. **Revogação chega pelo pacote do leitor**, não pelo QR. `lista_credenciais` devolve também as revogadas, porque a assinatura delas continua conferindo.
6. **Ponto de leitura** (`ponto_leitura`): celular, catraca ou totem, com modo `entrada_unica` (o primeiro vale) ou `passagem_livre` (toda leitura conta). Ponto sem zona é a entrada do evento.
7. **`checkin` ganha colunas, não perde.** `credencial_id`, `ponto_leitura_id`, `sentido` e `resultado` entram; `ingresso_id` e `portao` ficam. Um gatilho completa a credencial a partir do ingresso (e o contrário) e recusa linha que misture eventos. As visões da v1 passam a filtrar "entrada no evento", para uma leitura de zona não virar o primeiro check-in de ninguém.
8. **A regra tem uma única escrita no banco** (`pode_entrar`), usada pela API quando há internet e espelhada pelo leitor quando não há. Os testes de integração são a especificação que as duas implementações têm de cumprir.
9. **A tela fala em "entradas registradas"**, nunca em lotação: a visão `entradas_por_ponto` conta leituras, e leitura não é gente presente.

## Alternativas descartadas

- **Zonas dentro do QR.** O leitor não precisaria de regra nenhuma, mas mudar uma zona obrigaria a reemitir QR, e crachá impresso viraria lixo. Também faria o QR crescer e ficar mais difícil de ler em tela trincada.
- **Um QR por zona.** Multiplica o que a pessoa carrega e o que pode dar errado na porta.
- **Categoria como coluna do ingresso.** Segurança e montagem não compram ingresso. A v1 já exige pedido aprovado para emitir um; forçar pedido de valor zero para a equipe de limpeza é modelar errado para economizar uma tabela.
- **Categorias livres, criadas pelo organizador.** Flexível, mas cada organização inventaria a sua, a dica automática deixaria de fazer sentido e o crachá perderia padrão. A lista fechada cobre os eventos estudados; a exceção pessoal cobre o resto.
- **Tabela nova de leituras, deixando `checkin` só para a v1.** Dois lugares para a mesma pergunta ("quem passou por onde") e dois relatórios para somar.
- **Contar pessoas presentes.** Sem saída obrigatória, o número mente. Mostrar um número que mente como se fosse lotação é pior do que não mostrar.

## Consequências

- O QR `AE1` com `i` (ingresso) continua válido para sempre: o banco acha a credencial pelo ingresso. Credenciais sem ingresso precisam de um campo novo no conteúdo do QR; isso fica para o ADR do backend, sem mudar a assinatura.
- O leitor precisa sincronizar para saber de regra nova ou de revogação. `ponto_leitura.ultima_sinc_em` existe para a tela dizer há quanto tempo cada ponto está sem atualizar.
- Leituras barradas também sobem (`resultado = 'negado'`): a organização enxerga onde a regra está atrapalhando.
- Quem tem papel de operação passa a registrar e ler check-in, além de admin e credenciamento.
- Testes em `test/integracao/acessos.int.ts`, com negativos entre organizações e a migração aplicada sobre um banco no estado da v1.0.0.

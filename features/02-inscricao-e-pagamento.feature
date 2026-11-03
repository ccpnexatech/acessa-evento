# language: pt
@mvp @inscricao
Funcionalidade: Descobrir o evento, inscrever-se e pagar
  Como pessoa interessada no evento
  Quero me inscrever e pagar pelo app
  Para sair com o ingresso pronto no celular

  Contexto:
    Dado que o evento "COCAL 2026" está com inscrições abertas
    E o provedor de pagamento é o adaptador simulado

  Cenário: Ver o evento sem estar logado
    Dado que não estou logado
    Quando abro "COCAL 2026" em "Eventos"
    Então vejo datas, local, acessibilidade oferecida e programação resumida
    E vejo o botão "Inscrever-se"

  Cenário: Filtrar eventos com Libras
    Dado que estou em "Eventos"
    Quando ligo o filtro "Com Libras"
    Então só vejo eventos que oferecem intérprete de Libras

  Cenário: Inscrição cria a conta quando a pessoa não tem
    Dado que não estou logado
    Quando toco em "Inscrever-se"
    E escolho o ingresso "Congressista"
    E informo e-mail e nome no crachá
    Então a conta é criada no primeiro acesso, com o mesmo código por e-mail

  Cenário: Ingresso esgotado não pode ser escolhido
    Dado que o ingresso "Um dia" está esgotado
    Quando vejo os tipos de ingresso
    Então a opção "Um dia" aparece riscada com o texto "Esgotado"
    E não consigo selecioná-la

  Cenário: Pedir recursos de acessibilidade na inscrição
    Quando ligo "Intérprete de Libras" na inscrição
    Então a organização vê esse pedido no painel do evento
    E o pedido é apagado 30 dias depois do fim do evento

  Cenário: Pagamento por Pix aprovado
    Dado que estou no passo "Pagamento"
    Então vejo o aviso "Ambiente de teste. Nenhum dinheiro é cobrado."
    Quando escolho "Pix" e toco em "Gerar código Pix"
    E o adaptador simulado aprova o pagamento
    Então vejo "Você está no COCAL 2026"
    E o ingresso aparece na aba "Ingresso" e funciona sem internet
    E recebo o recibo por e-mail

  Cenário: Pagamento recusado
    Dado que estou no passo "Pagamento"
    Quando o adaptador simulado recusa o cartão
    Então vejo "Pagamento não aprovado. Tente outro cartão ou pague com Pix."
    E nenhum ingresso é emitido

  Cenário: Não cobrar duas vezes
    Dado que toquei em "Pagar" e a internet caiu
    Quando a conexão volta e toco em "Pagar" de novo
    Então o mesmo pedido é consultado pela chave de idempotência
    E não existe uma segunda cobrança

# language: pt
@mvp @credenciamento
Funcionalidade: Ingresso com QR offline e check-in na entrada
  Como participante, quero entrar no evento mostrando o celular, mesmo sem internet
  Como equipe de credenciamento, quero validar o ingresso em segundos, mesmo sem internet

  Contexto:
    Dado que o QR do ingresso é um token assinado com Ed25519 pela plataforma
    E o aparelho da equipe tem a chave pública do evento

  Cenário: Mostrar o ingresso sem internet
    Dado que sou participante e estou sem internet
    Quando abro a aba "Ingresso"
    Então vejo o QR, meu nome, o tipo de ingresso e "Disponível sem internet"
    E o brilho da tela aumenta enquanto o QR estiver aberto

  Cenário: Check-in válido
    Dado que sou da equipe no "Portão 1"
    Quando leio o QR de um ingresso válido que ainda não entrou
    Então vejo "Pode entrar" em até 1 segundo
    E sinto uma vibração curta
    E o participante vê "Check-in feito" no app quando tiver internet

  Cenário: Check-in repetido
    Dado que o ingresso já fez check-in às 08:12 no "Portão 2"
    Quando leio o QR de novo
    Então vejo "Já entrou hoje" com a hora e o portão do primeiro check-in
    E sinto uma vibração dupla

  Cenário: QR com assinatura inválida
    Quando leio um QR cuja assinatura não confere
    Então vejo "Ingresso não reconhecido"
    E a orientação "Peça para abrir o ingresso no app ou busque pelo nome."

  Cenário: Leitura sem internet na equipe
    Dado que o aparelho da equipe está sem internet
    Quando leio 12 ingressos válidos
    Então os 12 check-ins são aceitos
    E vejo "12 na fila" para sincronizar
    Quando a internet volta
    Então os check-ins são enviados e a fila zera

  Cenário: O mesmo ingresso em dois portões offline
    Dado que dois portões estão sem internet
    E o mesmo ingresso faz check-in nos dois
    Quando os aparelhos sincronizam
    Então vale o primeiro check-in pelo horário
    E o segundo fica marcado como "repetido" no relatório da organização

  Cenário: Check-in manual
    Dado que o participante não consegue mostrar o QR
    Quando busco pelo nome "Caio" e escolho "Caio Ponte"
    E confiro um documento com foto
    E toco em "Fazer check-in manual"
    Então o check-in é feito
    E fica registrado na auditoria quem da equipe fez o check-in manual

  Cenário: Equipe vê o recurso de acessibilidade pedido
    Dado que o participante pediu intérprete de Libras
    Quando o check-in é válido
    Então a equipe vê "Precisa de intérprete de Libras" e a orientação de onde indicar

  Cenário: Participante não pode usar o leitor
    Dado que sou participante, sem papel de equipe
    Então não vejo a área "Credenciamento"
    E a API recusa um check-in feito com o meu token

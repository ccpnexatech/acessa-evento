# language: pt
@organizador @inscricao
Funcionalidade: Ingressos, meia-entrada, acompanhante e avisos
  Como organizador, quero vender meia-entrada do jeito certo sem guardar documento de ninguém
  Como participante, quero saber o que levar e receber só os avisos que são para mim

  Cenário: Criar um tipo de ingresso de meia-entrada
    Quando crio o tipo "Meia" com a modalidade "Meia-entrada" e 40 vagas
    Então a compra desse tipo pede o motivo da meia-entrada
    E posso escolher se o público vê quantas vagas restam

  Cenário: Declarar o motivo na compra
    Dado que escolhi o ingresso "Meia"
    Quando informo o motivo "Estudante"
    Então vejo "Leve a carteira de estudante. Ela será conferida na entrada."
    E nenhuma tela me pede foto ou número de documento

  Cenário: Conferir na entrada
    Dado que sou da equipe de credenciamento
    Quando leio o QR de um ingresso de meia-entrada ainda não conferido
    Então vejo "Meia-entrada: conferir carteira de estudante"
    E, ao marcar "Conferido", meu nome e a hora ficam registrados

  Cenário: Documento não apresentado
    Quando marco "Não apresentou"
    Então vejo a orientação definida pelo organizador para esse caso
    E a entrada não é liberada por este aparelho sem essa decisão

  Cenário: Motivo protegido
    Dado que um participante declarou o motivo "Pessoa com deficiência"
    Quando alguém da equipe de comunicação abre a lista de inscritos
    Então não vê o motivo de ninguém
    E o motivo é apagado 30 dias depois do fim do evento

  Cenário: Ingresso de acompanhante
    Dado que comprei um ingresso e preciso de acompanhante
    Quando adiciono o acompanhante com o e-mail dele
    Então ele recebe um ingresso próprio, com QR próprio, ligado ao meu

  Cenário: Taxa no pedido
    Quando um pedido é aprovado
    Então o pedido guarda quanto do valor é taxa da plataforma
    E o relatório financeiro mostra valor, taxa e líquido

  Cenário: Aviso para uma categoria
    Dado que sou da equipe de comunicação
    Quando publico um aviso só para "Palestrante"
    Então palestrantes com credencial válida veem o aviso
    E congressistas não veem

  Cenário: Aviso agendado
    Quando agendo um aviso para amanhã às 8h
    Então a equipe vê o aviso como "Agendado"
    E os destinatários só veem a partir desse horário

  @acessibilidade
  Cenário: Aviso urgente pelo leitor de tela
    Dado que uso o leitor de tela
    Quando chega um aviso marcado como urgente
    Então o título é anunciado sem eu precisar procurar
    E o aviso não depende de cor para parecer urgente

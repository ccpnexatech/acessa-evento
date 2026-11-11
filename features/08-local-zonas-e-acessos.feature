# language: pt
@organizador @acessos
Funcionalidade: Local, zonas e controle de acesso
  Como organizador, quero dizer quem entra em cada lugar sem depender de suporte
  Como equipe de portão, quero uma resposta clara em um segundo, com ou sem internet

  Contexto:
    Dado que o evento "COCAL 2026" tem as zonas "Área geral", "Sala VIP" e "Bastidores"
    E "Área geral" é uma zona aberta

  Cenário: Cadastrar o local uma vez
    Quando cadastro o local "Centro de Eventos do Ceará" com a descrição de acessibilidade
    Então posso usar o mesmo local nos próximos eventos da organização
    E a página do evento mostra como chegar sem degraus

  Cenário: Dizer quem entra em cada zona
    Quando marco "Palestrante" e "Convidado" em "Sala VIP"
    Então palestrantes e convidados entram na Sala VIP
    E congressistas veem "Não entra aqui" na leitura

  Cenário: Mudar a regra na véspera
    Dado que os QR já foram emitidos
    Quando libero "Expositor" em "Sala VIP"
    Então nenhum QR precisa ser emitido de novo
    E os leitores passam a liberar expositores depois de sincronizar

  Cenário: Regra com horário
    Quando libero "Montagem" em "Bastidores" só até a abertura do evento
    Então a equipe de montagem entra antes da abertura
    E não entra depois dela

  Cenário: Exceção para uma pessoa
    Quando libero o congressista "Caio" na "Sala VIP" com o motivo "Homenageado da noite"
    Então só ele entra, e a regra dos outros congressistas não muda
    E o motivo fica registrado com meu nome

  Cenário: Credencial para quem não compra ingresso
    Quando emito uma credencial de "Segurança" para "duda@exemplo.com.br"
    Então ela recebe um QR próprio no app
    E entra pelas zonas liberadas para segurança

  Cenário: Revogar uma credencial
    Dado que a credencial de "Duda" foi revogada com o motivo "Fora da escala"
    Quando o QR dela é lido num ponto que já sincronizou
    Então a equipe vê "Credencial cancelada. Encaminhe à organização."

  Cenário: Criar um ponto de leitura
    Quando crio o ponto "Porta VIP" na zona "Sala VIP" com passagem livre
    Então quem for da equipe pode escolher esse ponto no leitor
    E cada leitura conta como passagem, sem "já entrou"

  Cenário: Entrada do evento continua valendo a primeira
    Dado que o ponto "Portão 1" é a entrada do evento
    Quando o mesmo QR é lido duas vezes
    Então a segunda leitura mostra "Já entrou hoje" com a hora e o ponto da primeira

  Cenário: QR da primeira versão do app
    Dado um ingresso emitido antes das zonas existirem
    Quando o QR é lido no "Portão 1"
    Então vejo "Pode entrar", como congressista

  Cenário: Ponto sem sincronizar há muito tempo
    Dado que o ponto "Portão 2" sincronizou pela última vez há mais de 30 minutos
    Quando abro "Chegou o dia"
    Então vejo "Portão 2 sem atualizar há 30 min" com o que fazer

  Cenário: Entradas registradas, não lotação
    Quando abro "Chegou o dia"
    Então vejo "Entradas registradas" por ponto, com a hora da última leitura
    E nenhuma tela chama esse número de lotação ou de pessoas presentes

  Cenário: Outra organização não enxerga meus acessos
    Dado que sou dona de outra organização
    Quando tento ver regras, credenciais ou leituras do "COCAL 2026"
    Então não vejo nenhuma

  @acessibilidade
  Cenário: Resposta do leitor por mais de um sentido
    Quando uma leitura é barrada
    Então a tela mostra texto e ícone, não só cor
    E o aparelho vibra de um jeito diferente do "Pode entrar"
    E o leitor de tela anuncia o motivo

  @acessibilidade
  Cenário: Lugares reservados na sala
    Quando informo 8 lugares reservados no "Auditório"
    Então o detalhe da sala mostra quantos lugares são para cadeira de rodas, acompanhante e Libras

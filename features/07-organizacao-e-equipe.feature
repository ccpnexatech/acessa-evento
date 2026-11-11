# language: pt
@organizador @equipe
Funcionalidade: Organização, equipe e convites
  Como organizador, quero montar minha equipe sem depender de suporte
  Como convidado, quero entrar na equipe com o mesmo login de sempre

  Contexto:
    Dado que a "Sociedade Cearense de Anestesiologia" é uma organização
    E eu sou dona dessa organização

  Cenário: Criar a organização no primeiro acesso
    Dado que acabei de entrar e não faço parte de nenhuma organização
    Quando escolho "Montar meu evento" e informo o nome da organização
    Então a organização é criada e eu sou a dona
    E vejo o começo de "Montar meu evento"

  Cenário: Convidar para a equipe de um evento
    Quando convido "bia@exemplo.com.br" para o evento com os papéis "Credenciamento" e "Acessibilidade"
    Então o convite fica "Aguardando" por 14 dias
    E ela recebe um e-mail com o nome do evento e os papéis

  Cenário: Aceitar o convite
    Dado que fui convidada como "bia@exemplo.com.br"
    Quando entro com esse e-mail
    Então vejo "Você foi convidada para a equipe do COCAL 2026"
    E, ao aceitar, passo a ter os dois papéis no evento

  Cenário: Convite não serve para outro e-mail
    Dado que o convite foi enviado para "bia@exemplo.com.br"
    Quando outra pessoa entra com "caio@exemplo.com.br" e tenta aceitar
    Então o convite não aparece para ela
    E nenhum papel é dado

  Cenário: Convite vencido ou cancelado
    Dado que o convite venceu ou foi cancelado por quem convidou
    Quando a convidada tenta aceitar
    Então vê "Este convite não vale mais. Peça um novo a quem convidou."

  Cenário: Uma pessoa com mais de um papel
    Dado que Caio já cuida de "Conteúdo" no evento
    Quando dou a ele também o papel "Operação"
    Então ele vê as áreas de conteúdo e de operação
    E continua sem ver o financeiro

  Cenário: Dono e admin da organização veem todos os eventos
    Dado que a organização tem os eventos "COCAL 2026" e "Jornada 2027"
    Quando abro "Meus eventos"
    Então vejo os dois, inclusive os que estão em rascunho

  Cenário: Uma organização não enxerga a outra
    Dado que existe outra organização com o evento "Congresso Vizinho" em rascunho
    Quando abro "Meus eventos"
    Então não vejo "Congresso Vizinho"
    E não consigo convidar ninguém para ele

  Cenário: Só o dono nomeia admin da organização
    Dado que Caio é admin da organização
    Quando ele tenta tornar outra pessoa admin da organização
    Então a ação é recusada
    E ele continua podendo montar a equipe de cada evento

  Cenário: Mesa organizadora na página do evento
    Quando marco "Mostrar na página do evento" para Caio com o cargo "Coordenação científica"
    Então a página pública do evento mostra o nome e o cargo dele
    E quem não foi marcado não aparece

  Cenário: Evento de demonstração
    Quando crio um evento de demonstração
    Então posso testar inscrição, leitura de QR e avisos nele
    E ele não aparece na lista pública de eventos

  @acessibilidade
  Cenário: Convidar usando só o leitor de tela
    Dado que uso o leitor de tela
    Quando abro "Convidar pessoa"
    Então cada papel é uma caixa de seleção com nome e uma frase dizendo o que ele permite
    E, ao enviar, ouço "Convite enviado para bia@exemplo.com.br"

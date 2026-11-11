# language: pt
@organizador @feira
Funcionalidade: Feira, expositores e contratos
  Como organizador, quero vender os estandes sem planilha e sem conflito
  Como expositor, quero escolher meu espaço, montar minha marca e resolver tudo num lugar só

  Contexto:
    Dado que o evento tem a planta "Pavilhão" com estandes de "Linha 3x3" e "Ilha 6x6"
    E os níveis "Bronze", "Prata" e "Ouro" definidos por investimento em estandes

  Cenário: Preparar a feira
    Quando desenho a planta, defino tipos de estande, níveis, segmentos e serviços
    Então a feira aparece no início do evento como "Pronta para convidar expositores"

  Cenário: Convidar um expositor
    Quando cadastro a empresa "Xis Med" e convido "rui@exemplo.com.br" como responsável
    Então ele recebe o convite com o nome do evento e da empresa
    E, ao aceitar, entra no portal do expositor

  Cenário: Escolher o estande no mapa
    Dado que sou responsável pela "Xis Med"
    Quando toco no estande livre "A1" no mapa
    Então vejo tamanho, preço e nível que ele ajuda a alcançar
    E, ao reservar, o estande fica "Reservado para você por 48 horas"

  Cenário: Dois expositores no mesmo estande
    Dado que outro expositor reservou o "A1" um instante antes
    Quando tento reservar o "A1"
    Então vejo "Este estande acabou de ser reservado. Escolha outro."

  Cenário: Reserva que vence
    Dado que reservei o "A2" e não assinei o contrato em 48 horas
    Então o "A2" volta a ficar livre no mapa
    E recebo um aviso dizendo que a reserva venceu

  Cenário: Nível calculado
    Dado que meus estandes vendidos somam R$ 36.000
    Quando abro o resumo
    Então vejo o nível "Ouro" e os benefícios dele
    E os serviços contratados não entram nessa conta

  Cenário: Marca no app
    Quando envio o logo sem descrever a imagem
    Então vejo "Descreva o logo para quem usa leitor de tela"
    E o perfil só é publicado com a descrição preenchida

  Cenário: Pedir serviços
    Quando peço 4 kVA de "Energia"
    Então vejo o valor calculado e a situação "Pedido"
    E, depois do prazo do serviço, só a organização consegue incluir

  Cenário: Montadora própria
    Quando escolho "Montadora própria"
    Então preciso enviar o projeto, a ART ou RRT e aceitar o termo de responsabilidade
    E a organização aprova ou recusa com uma observação

  Cenário: Assinar o contrato no app
    Dado que a organização enviou o contrato
    Quando leio e toco em "Assinar"
    Então o contrato fica "Assinado" com meu nome e a hora
    E meus estandes reservados passam a "Vendido"

  Cenário: Contrato enviado não muda
    Dado que o contrato foi enviado
    Quando a organização tenta alterar o texto
    Então a alteração é recusada
    E, para mudar, ela cancela e envia outro

  Cenário: Assinatura pelo gov.br
    Dado que o contrato pede assinatura pelo gov.br
    Quando a organização confere o documento assinado e informa o protocolo
    Então o contrato fica "Assinado" com a referência registrada

  Cenário: Credenciais só depois do contrato
    Dado que o contrato ainda não foi assinado
    Quando tento emitir a credencial da minha equipe
    Então vejo "As credenciais são liberadas quando o contrato for assinado."

  Cenário: Credenciais por metragem
    Dado que tenho 45 m² de estande e o evento dá 1 credencial a cada 3 m²
    Quando abro "Equipe"
    Então vejo "15 credenciais, 1 usada"
    E não consigo emitir a 16ª

  Cenário: Um expositor não enxerga o outro
    Dado que sou responsável pela "Ypsilon Farma"
    Quando abro o portal
    Então não vejo contrato, pedidos, montagem nem equipe da "Xis Med"

  Cenário: Lista de expositores no app
    Quando um participante abre "Expositores"
    Então vê os perfis publicados em ordem alfabética, com segmento, estande e nível
    E o nível aparece como rótulo, sem mudar a ordem

  @acessibilidade
  Cenário: Escolher estande sem enxergar o mapa
    Dado que uso o leitor de tela
    Quando abro a escolha de estande
    Então posso alternar para uma lista com código, tipo, tamanho, preço e situação de cada estande
    E reservar pela lista funciona igual ao mapa

# language: pt
@mvp @agenda
Funcionalidade: Agenda como tela inicial e detalhe da palestra
  Como participante inscrito
  Quero ver o que está acontecendo agora e o que vem a seguir
  Para decidir rápido aonde ir, inclusive com os recursos de que preciso

  Contexto:
    Dado que estou logado com um ingresso do "COCAL 2026"

  Cenário: Valor em 3 segundos
    Quando abro o app
    Então a primeira tela é a "Agenda"
    E vejo meu ingresso no topo com o botão "Mostrar QR"
    E vejo a seção "Agora" com a sessão em andamento

  Cenário: Trocar de dia
    Quando toco em "Qui 2 jul"
    Então vejo as sessões de quinta-feira
    E o leitor de tela anuncia "Qui 2 jul, aba selecionada"

  Esquema do Cenário: Filtrar por recurso de acessibilidade
    Quando ligo o filtro "<recurso>"
    Então só vejo sessões com o selo "<recurso>"

    Exemplos:
      | recurso        |
      | Libras         |
      | Legenda        |
      | Audiodescrição |

  Cenário: Busca sem resultado
    Quando busco "xyzabc"
    Então vejo "Nenhuma sessão encontrada" com a opção de limpar a busca

  Cenário: Favoritar uma sessão
    Quando toco em "Favoritar" numa sessão
    Então a estrela fica preenchida
    E o leitor de tela anuncia "Favoritar, selecionado"
    E sinto uma vibração leve
    E recebo um aviso 15 minutos antes da sessão

  Cenário: Favoritar sem internet
    Dado que estou sem internet
    Quando favorito uma sessão
    Então a estrela fica preenchida na hora
    E o favorito é enviado quando a internet voltar

  Cenário: Ver o detalhe da palestra
    Quando abro uma sessão
    Então vejo quando, onde, palestrantes, recursos de acessibilidade e o resumo
    E vejo como chegar à sala por um caminho sem degraus

  Cenário: Agenda mudou enquanto eu estava offline
    Dado que a organização mudou a sala de uma sessão favorita
    Quando a internet volta
    Então vejo "Atualizando a agenda."
    E recebo um aviso com a sala nova

# language: pt
@mvp @assistente
Funcionalidade: Assistente guiado sem IA
  Como participante com uma dúvida
  Quero chegar à resposta da organização em poucas perguntas
  Para não depender de fila de atendimento

  Contexto:
    Dado que a organização publicou o grafo de decisão do evento

  Cenário: Chegar a uma resposta
    Dado que estou em "Assistente do evento"
    Quando escolho "Acessibilidade"
    E escolho "Intérprete de Libras"
    Então vejo a resposta da organização com a data da última revisão
    E vejo "Isso respondeu sua dúvida?"

  Cenário: Voltar uma pergunta
    Dado que estou na pergunta 2 de 2
    Quando toco em "Voltar"
    Então vejo de novo a pergunta 1, com a escolha anterior marcada

  Cenário: Nenhuma opção serve
    Quando toco em "Não encontrei. Falar com a organização"
    Então vejo os canais de atendimento do evento

  Cenário: Funciona sem internet
    Dado que abri o assistente pelo menos uma vez com internet
    E agora estou sem internet
    Quando percorro o grafo até uma resposta
    Então vejo a resposta salva no aparelho

  Cenário: Avaliar a resposta
    Quando respondo "Não" em "Isso respondeu sua dúvida?"
    Então a avaliação é registrada para a organização, sem dados pessoais
    E vejo o caminho para falar com a organização

  Cenário: Leitor de tela no assistente
    Dado que uso o leitor de tela
    Quando abro uma pergunta
    Então ouço "Pergunta 1 de 2" e o texto da pergunta antes das opções
    E cada opção é um botão com o estado "selecionado" quando escolhida

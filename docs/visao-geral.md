# Visão geral

Leitura de 5 minutos, sem código.

## O problema

Um evento é uma sequência de pequenas barreiras. A inscrição pede um formulário que o leitor de tela não lê. A programação é um PDF. A fila do credenciamento depende de uma lista impressa e da internet do pavilhão. A pessoa surda descobre na hora que a palestra não tem intérprete. A pessoa em cadeira de rodas descobre na porta que a sala fica no primeiro andar.

Cada barreira, sozinha, parece pequena. Juntas, decidem quem consegue participar.

O Censo 2022 do IBGE contou **14,4 milhões de pessoas com deficiência no Brasil**, 7,3% da população com 2 anos ou mais. A dificuldade mais comum é enxergar (7,9 milhões); 5,2 milhões têm dificuldade para andar ou subir degraus e 2,6 milhões para ouvir ([IBGE, via CNN Brasil, 2025](https://www.cnnbrasil.com.br/saude/brasil-tem-144-milhoes-de-pessoas-com-deficiencia-diz-ibge/)). A Lei Brasileira de Inclusão garante a essas pessoas acesso a cultura e lazer em igualdade de oportunidades e lugares reservados em auditórios ([Lei 13.146/2015, arts. 42 e 44](https://planalto.gov.br/ccivil_03/_Ato2015-2018/2015/Lei/L13146.htm)).

## A ideia

Um app que acompanha a pessoa do começo ao fim do evento e trata acessibilidade como parte de cada tela, não como um item extra:

| Momento | O que o app faz | Para quem ajuda mais |
| --- | --- | --- |
| Descobrir | Lista de eventos com filtro "Com Libras" e o que cada um oferece | Quem precisa saber antes de comprar |
| Inscrever-se | Pergunta, de forma opcional, que recurso a pessoa precisa (Libras, legenda, audiodescrição, acesso sem degraus, acompanhante) | Quem hoje precisa ligar ou mandar e-mail para pedir |
| Agenda | Selos de Libras, legenda e audiodescrição em cada sessão; filtros; "Agora" e "A seguir" | Quem só quer ver as sessões que consegue acompanhar |
| Entrada | Ingresso com QR que funciona sem internet; brilho no máximo para a leitura | Todo mundo, principalmente quando a rede cai |
| Credenciamento | A equipe lê o QR sem internet e já vê "Precisa de intérprete de Libras" e onde indicar | A equipe, que passa a saber antes de a pessoa precisar explicar |
| Dúvidas | Assistente com respostas revisadas pela organização, uma pergunta por tela, funciona offline | Quem não quer ou não consegue enfrentar uma fila de atendimento |

## Para quem foi pensado

As decisões partem de pessoas, não de telas:

- **Ana, cega, usa VoiceOver.** Precisa que cada botão diga o que faz, que a agenda seja lida numa frase por sessão e que o QR do ingresso seja anunciado.
- **Bruno, surdo, usuário de Libras.** Precisa saber antes quais sessões têm intérprete e sentar perto dele.
- **Carla, cadeirante.** Precisa saber se a sala tem rampa ou elevador antes de atravessar o pavilhão.
- **Dora, baixa visão.** Usa fonte grande e alto contraste; nenhum texto pode ser cortado.
- **Equipe do credenciamento.** Precisa de uma resposta em menos de um segundo, mesmo sem internet, e de saber quem pediu qual recurso.
- **Organização.** Precisa cumprir a lei, publicar respostas oficiais e medir o que funcionou.

## O que este repositório entrega

- Um app (Expo/React Native) e uma API (Node) completos para a jornada acima, com dados de exemplo.
- Testes automáticos que provam acessibilidade, segurança e funcionamento sem internet.
- Cada decisão importante escrita, com o motivo e o que se perdeu ao escolher ([24 ADRs](adr/README.md)).
- Um [guia de estudo](estudo.md) com perguntas de pesquisa e propostas de extensão para trabalhos acadêmicos.

## O que ele ainda não é

- **Validado com pessoas com deficiência.** A acessibilidade está verificada em código e por roteiro, mas o teste com usuários reais é o próximo passo ([como fazer](estudo.md#pesquisa-com-pessoas)).
- **Um produto em produção.** O pagamento é simulado e os dados do evento são fictícios.

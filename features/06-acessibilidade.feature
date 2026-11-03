# language: pt
@mvp @a11y
Funcionalidade: Acessibilidade em todas as telas
  Como pessoa com deficiência visual, motora, auditiva ou cognitiva
  Quero usar o app inteiro do meu jeito
  Para participar do evento com autonomia

  Esquema do Cenário: Toda tela passa nos testes automáticos nos 3 temas
    Dado a tela "<tela>" no tema "<tema>"
    Então não há violações WCAG 2.2 AA nos testes automáticos
    E todo texto tem contraste de pelo menos 4,5:1
    E todo controle tem nome acessível e alvo de toque de pelo menos 48 pontos

    Exemplos:
      | tela                | tema           |
      | Agenda              | claro          |
      | Agenda              | escuro         |
      | Agenda              | alto-contraste |
      | Ingresso            | alto-contraste |
      | Pagamento           | escuro         |
      | Leitor de QR        | claro          |
      | Assistente do evento| alto-contraste |

  Cenário: Fonte em 200%
    Dado que a fonte do sistema está em 200%
    Quando abro a Agenda e o detalhe de uma palestra
    Então nenhum título é cortado com reticências
    E nada fica escondido atrás da barra inferior

  Cenário: Alto contraste escolhido pelo participante
    Quando ligo "Alto contraste" em Ajuda
    Então o app inteiro fica preto sobre branco com bordas em tudo
    E a escolha vale por cima das cores do evento

  Cenário: Reduzir movimento
    Dado que "reduzir movimento" está ligado no sistema
    Quando favorito uma sessão ou faço check-in
    Então nenhuma animação é exibida
    E a confirmação continua em texto e vibração

  Cenário: Cor nunca é o único sinal
    Então todo estado (erro, sucesso, offline, agora, esgotado) tem ícone e texto

  Cenário: Navegação por teclado e switch
    Dado que uso teclado externo ou switch
    Então consigo chegar a todos os controles na ordem visual
    E vejo o anel de foco de 3 pontos em cada um

# language: pt
@mvp @conta
Funcionalidade: Acesso sem senha, cadastro no primeiro acesso e conta
  Como participante
  Quero entrar só com o meu e-mail
  Para ver meu ingresso e a agenda sem criar e lembrar senha

  Contexto:
    Dado que o evento "COCAL 2026" está publicado

  Cenário: Pedir o código de acesso
    Dado que estou na tela "Entrar"
    Quando informo o e-mail "caio@exemplo.com.br"
    E toco em "Receber código"
    Então recebo um e-mail com um código de 6 números
    E vejo a tela "Digite o código" com o meu e-mail escrito

  Cenário: E-mail em formato inválido
    Dado que estou na tela "Entrar"
    Quando informo o e-mail "caio@exemplo"
    E toco em "Receber código"
    Então vejo o erro "Confira o e-mail. Ele precisa ter @ e um domínio, como nome@exemplo.com.br."
    E o leitor de tela anuncia o erro junto do campo

  Cenário: Primeiro acesso cria a conta
    Dado que "novo@exemplo.com.br" não tem conta
    Quando entro com o código correto enviado para "novo@exemplo.com.br"
    Então vejo a tela "Boas-vindas ao COCAL 2026"
    E preciso confirmar o nome no crachá
    E preciso marcar "Li e aceito os Termos de uso e a Política de privacidade"

  Cenário: Consentimento nunca vem marcado
    Dado que estou na tela de primeiro acesso
    Então a caixa de aceite dos termos está desmarcada
    Quando toco em "Continuar" sem marcar a caixa
    Então vejo o erro "Para continuar, aceite os termos."

  Esquema do Cenário: Código errado ou vencido
    Dado que pedi um código há <minutos> minutos
    Quando digito o código "<codigo>"
    Então vejo o erro "<mensagem>"

    Exemplos:
      | minutos | codigo | mensagem                                                    |
      | 2       | 000000 | Código inválido. Confira os 6 números do e-mail.            |
      | 11      | 814233 | Este código venceu. Toque em "Enviar outro código".         |

  Cenário: Limite de tentativas
    Dado que errei o código 5 vezes seguidas
    Quando tento a sexta vez
    Então vejo "Muitas tentativas. Peça um novo código daqui a 10 minutos."
    E a tentativa fica registrada na auditoria

  Cenário: Baixar meus dados
    Dado que estou logado
    Quando toco em "Baixar meus dados" em Ajuda
    Então recebo um arquivo com todos os dados que o sistema guarda sobre mim
    E o pedido fica registrado na auditoria

  Cenário: Excluir a conta
    Dado que estou logado e tenho um ingresso do "COCAL 2026"
    Quando toco em "Excluir minha conta" em Ajuda
    Então vejo o que será apagado agora e o que a lei manda guardar
    E vejo o aviso "Seu ingresso deixa de valer. Isso não pode ser desfeito."
    Quando confirmo em "Excluir conta"
    Então meus dados pessoais e de acessibilidade são apagados
    E os registros fiscais ficam guardados por 5 anos, sem ligação com a conta
    E recebo um e-mail de confirmação

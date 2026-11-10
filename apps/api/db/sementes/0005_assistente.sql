-- Assistente guiado de EXEMPLO para os dois eventos de demonstração.
-- Respostas fictícias até a organização enviar as oficiais. Publica a versão 1
-- só se o evento ainda não tem nenhuma (idempotente).

with grafo as (select $json${
  "inicio": "inicio",
  "nos": {
    "inicio": { "tipo": "pergunta", "texto": "Sobre o que é a sua dúvida?", "opcoes": [
      { "rotulo": "Acessibilidade", "destino": "acessibilidade" },
      { "rotulo": "Ingresso e entrada", "destino": "ingresso" },
      { "rotulo": "Local e horários", "destino": "local" },
      { "rotulo": "Certificado", "destino": "r-certificado" }
    ]},
    "acessibilidade": { "tipo": "pergunta", "texto": "Qual recurso você procura?", "opcoes": [
      { "rotulo": "Intérprete de Libras", "destino": "r-libras" },
      { "rotulo": "Audiodescrição", "destino": "r-audiodescricao" },
      { "rotulo": "Legenda ao vivo", "destino": "r-legenda" },
      { "rotulo": "Acesso sem degraus e cadeira de rodas", "destino": "r-sem-degraus" },
      { "rotulo": "Acompanhante", "destino": "r-acompanhante" }
    ]},
    "ingresso": { "tipo": "pergunta", "texto": "O que aconteceu com o ingresso?", "opcoes": [
      { "rotulo": "Não encontro meu ingresso", "destino": "r-sem-ingresso" },
      { "rotulo": "Vou ficar sem internet no evento", "destino": "r-offline" },
      { "rotulo": "Não consigo mostrar o QR", "destino": "r-sem-qr" }
    ]},
    "local": { "tipo": "pergunta", "texto": "O que você quer saber?", "opcoes": [
      { "rotulo": "Como chegar", "destino": "r-chegar" },
      { "rotulo": "Horário de abertura", "destino": "r-horario" }
    ]},
    "r-libras": { "tipo": "resposta", "titulo": "Intérprete de Libras", "revisadaEm": "2026-11-01",
      "texto": "As sessões com o selo Libras têm intérprete no palco. Há lugares reservados nas primeiras fileiras, à esquerda, perto do intérprete. Se você marcou Libras na inscrição, a equipe da entrada indica o caminho." },
    "r-audiodescricao": { "tipo": "resposta", "titulo": "Audiodescrição", "revisadaEm": "2026-11-01",
      "texto": "Nas sessões com o selo Audiodescrição, retire um fone no balcão de acessibilidade, ao lado da entrada principal. Leve um documento; o fone é devolvido no fim do dia." },
    "r-legenda": { "tipo": "resposta", "titulo": "Legenda ao vivo", "revisadaEm": "2026-11-01",
      "texto": "As sessões com o selo Legenda mostram a fala em texto no telão. Para acompanhar no celular, peça o link no balcão de informações." },
    "r-sem-degraus": { "tipo": "resposta", "titulo": "Acesso sem degraus", "revisadaEm": "2026-11-01",
      "texto": "Todas as salas têm entrada sem degraus ou elevador; o detalhe de cada sala está na tela da sessão. Há lugares para cadeira de rodas na frente de cada sala e banheiros acessíveis em todos os andares." },
    "r-acompanhante": { "tipo": "resposta", "titulo": "Acompanhante", "revisadaEm": "2026-11-01",
      "texto": "Uma pessoa de apoio entra junto com você, sem ingresso próprio. Se você marcou Acompanhante na inscrição, a equipe da entrada já sabe; se não marcou, avise no credenciamento." },
    "r-sem-ingresso": { "tipo": "resposta", "titulo": "Onde está meu ingresso", "revisadaEm": "2026-11-01",
      "texto": "O ingresso fica na aba Ingresso, com o mesmo e-mail usado na inscrição. Se entrou com outro e-mail, saia da conta em Ajuda e entre de novo com o e-mail da inscrição." },
    "r-offline": { "tipo": "resposta", "titulo": "Sem internet no evento", "revisadaEm": "2026-11-01",
      "texto": "Seu ingresso, a agenda e este assistente funcionam sem internet depois que você abriu o app uma vez conectado. Abra a aba Ingresso antes de sair de casa." },
    "r-sem-qr": { "tipo": "resposta", "titulo": "Sem o QR", "revisadaEm": "2026-11-01",
      "texto": "Sem problema: na entrada, a equipe busca pelo seu nome e confere um documento com foto." },
    "r-chegar": { "tipo": "resposta", "titulo": "Como chegar", "revisadaEm": "2026-11-01",
      "texto": "O endereço está na página do evento. A entrada principal tem rampa e piso tátil a partir do ponto de ônibus e do desembarque de táxi e aplicativo." },
    "r-horario": { "tipo": "resposta", "titulo": "Horário de abertura", "revisadaEm": "2026-11-01",
      "texto": "O credenciamento abre uma hora antes da primeira sessão do dia. Veja os horários das sessões na Agenda." },
    "r-certificado": { "tipo": "resposta", "titulo": "Certificado", "revisadaEm": "2026-11-01",
      "texto": "O certificado de participação é enviado por e-mail até 15 dias depois do fim do evento, para quem fez check-in na entrada." }
  }
}$json$::jsonb as g),
canais as (select $json$[
  { "tipo": "balcao", "rotulo": "Balcão de informações", "valor": "Ao lado da entrada principal" },
  { "tipo": "email", "rotulo": "E-mail da organização", "valor": "contato@exemplo.com.br" },
  { "tipo": "whatsapp", "rotulo": "WhatsApp (só mensagens)", "valor": "+55 85 90000-0000" }
]$json$::jsonb as c)
insert into assistente_versao (evento_id, versao, grafo, canais)
select e.id, 1, grafo.g, canais.c
from evento e, grafo, canais
where e.slug in ('cocal-2026', 'simulacao-2026')
  and not exists (select 1 from assistente_versao v where v.evento_id = e.id);

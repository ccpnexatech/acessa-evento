# 0028. Feira com estande reservado no banco, nível derivado e contrato que libera

- Status: Aceita
- Data: 2026-11-11
- Amplia: [0025](0025-organizacao-acima-do-evento-e-varios-papeis.md), [0026](0026-credencial-e-regras-de-zona-fora-do-qr.md)

## Contexto

O expositor não é um cadastro: é um cliente que compra espaço e visibilidade. Os manuais do expositor estudados (Fenasan, FIEMA, Festival das Cataratas, Expo CIEE) pedem sempre as mesmas coisas: escolher estande numa planta, cadastro para o catálogo com logo, energia em kVA, credenciais por metragem, projeto com ART ou RRT quando a montadora não é a oficial, e prazos. Hoje isso é feito por planilha, e-mail e formulário, e a organização descobre os conflitos na montagem.

Três riscos orientam a decisão: dois expositores no mesmo estande, alguém de uma empresa lendo o contrato de outra, e crachá na mão de quem ainda não assinou.

## Decisão

1. **Parceiro é da organização; `parceiro_evento` é a participação dele num evento**, com a categoria da lista única (expositor, alimentação, segurança, montagem...). O mesmo parceiro volta na próxima edição sem recadastro.
2. **Portal do parceiro por uma função só.** `membro_parceiro` guarda responsável e equipe; toda política do lado de fora da organização passa por `e_do_parceiro`. O responsável escolhe estande, pede serviço, assina e convida a própria equipe; a equipe só enxerga.
3. **Reserva de estande atômica, no banco** (`reservar_estande`), como a vaga de ingresso do ADR 0021. Vale 48 horas e guarda o preço do dia. Sem contrato assinado, o agendador devolve o estande. Ninguém muda a situação de um estande direto na tabela.
4. **Nível do expositor é calculado**, pela soma dos estandes vendidos (`resumo_do_expositor`). Serviços não contam. Não existe campo para digitar "Ouro".
5. **Nível é rótulo, não fila.** A lista pública (`expositores_publicos`) sai em ordem alfabética e só mostra perfil publicado. Benefício de nível nunca reordena resultado sem aviso nem passa por cima de filtro de acessibilidade.
6. **Logo exige descrição.** `perfil_expositor` recusa `logo_url` sem `logo_descricao`: é o que o leitor de tela fala.
7. **Serviço: valor é preço vezes quantidade**, calculado por gatilho. O prazo vale para o parceiro; a organização pode lançar depois dele. Só a organização confirma.
8. **Montagem básica nasce aprovada.** Montadora própria e estande diferente só entram em análise com projeto, ART ou RRT e termo aceito; mudar qualquer um desses devolve para análise.
9. **Contrato é selado ao enviar.** O corpo é copiado do modelo para o contrato, o banco guarda o SHA-256 do texto e recusa alteração depois do envio. O contratado só vê o contrato depois de enviado.
10. **Três vias de assinatura, uma porta.** `aceite_no_app` (o responsável ou o palestrante aceita logado), `provedor` e `govbr_manual` (a organização registra com a referência externa). A integração com um provedor fica atrás dessa porta; o estudo de caso entrega o aceite no app e o registro manual do gov.br.
11. **Assinar liga o resto**, na mesma transação: estandes reservados viram vendidos e o parceiro fica ativo.
12. **Credencial da equipe do parceiro só com contrato assinado**, e, para expositor, até o limite de uma a cada N m² de estande vendido (`evento.feira_m2_por_credencial`, padrão 3).

## Alternativas descartadas

- **Estande reservado pela API, com leitura seguida de escrita.** Duas requisições ao mesmo tempo passam; o banco resolve com uma instrução.
- **Nível escolhido pelo comercial.** Abre espaço para favor e para a lista do app divergir do que foi pago.
- **Nível somando serviços.** Quem gasta com energia não comprou visibilidade; misturar distorce o que o nível comunica.
- **Ordenar a lista de expositores por nível.** É anúncio disfarçado de resultado. Se um dia houver destaque pago, ele terá rótulo.
- **Assinatura digital obrigatória por provedor.** Serviço pago e barreira para o expositor pequeno. O aceite logado, com e-mail verificado, texto selado e trilha de auditoria, atende contratos privados simples; para o que exige mais, existe a via gov.br.
- **Upload de projeto e logo guardado no banco.** O banco guarda o endereço (`https`); onde o arquivo mora é decisão do backend.
- **Unir estandes vizinhos numa entidade nova.** Um expositor já pode ter vários estandes; a união é desenho da tela, não do modelo.
- **Portal do parceiro com políticas próprias por tabela, sem função comum.** Cada tabela reescreveria a regra e uma delas sairia errada.

## Consequências

- O agendador da API ganha duas tarefas: `liberar_reservas_vencidas` e o expurgo de meia-entrada do ADR 0027.
- A API registra na auditoria envio, assinatura e cancelamento de contrato, reserva e liberação de estande, e emissão de credencial de parceiro.
- Reduzir a metragem por credencial depois de credenciais emitidas não revoga nenhuma; só impede novas.
- Captura de contatos pelo expositor, rota de visitas e pontos ficam fora: o modelo deixa segmento, estande no mapa e nível como ganchos.
- Testes em `test/integracao/feira-e-contratos.int.ts`, com negativos entre dois expositores do mesmo evento e entre organizações.

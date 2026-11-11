# 0027. Meia-entrada declarada, sem guardar documento, e avisos por categoria

- Status: Aceita
- Data: 2026-11-11
- Amplia: [0012](0012-retencao-de-dados-5-anos-para-fiscais-30-dias-para-aces.md), [0021](0021-inscricao-idempotente-e-vagas-no-banco.md)

## Contexto

O organizador precisa vender meia-entrada e ingresso de acompanhante, e precisa falar com grupos diferentes (só palestrantes, só montagem). A meia-entrada é direito de quem tem (estudante, pessoa idosa, pessoa com deficiência e acompanhante, entre outros), e conferir esse direito costuma virar pedido de foto de documento, que é o dado mais arriscado que a plataforma poderia guardar. Um dos motivos, "pessoa com deficiência", é dado sensível por si só.

## Decisão

1. **A pessoa declara o motivo ao comprar; a equipe confere o documento com os olhos, na entrada.** `elegibilidade_meia` guarda motivo, quando foi declarada, quem conferiu, quando e o resultado. Nenhuma imagem, nenhum número de documento.
2. **O motivo é tratado como dado sensível:** só a própria pessoa e a equipe de portão (admin e credenciamento) leem; some 30 dias após o fim do evento, no mesmo expurgo dos pedidos de acessibilidade.
3. **Conferência assinada:** quem confere grava o próprio nome; a pessoa não troca o motivo nem apaga a declaração depois de conferida.
4. **`tipo_ingresso.modalidade`** (inteira, meia, acompanhante, cortesia) em vez de inferir pelo nome do tipo. O nome da coluna é "modalidade" porque "categoria" já significa o que a pessoa é no evento (ADR 0026).
5. **Acompanhante é ingresso próprio**, apontando para o ingresso de quem acompanha. Entra na contagem e tem QR, como qualquer pessoa.
6. **`pedido.taxa_centavos`** grava a taxa da plataforma no momento da compra, para o relatório financeiro não depender da regra que estiver valendo depois.
7. **`tipo_ingresso.publico_ve_saldo`:** mostrar "restam 12" é escolha do organizador.
8. **`aviso`** com lista opcional de categorias e hora de publicação. Quem tem credencial válida lê os avisos da sua categoria; credencial revogada para de receber. Publicar é de admin e comunicação.
9. `atividade` ganha `tipo` (sessão, festa, paralela) e zona opcional; `palestrante` ganha `pessoa_id` opcional para receber credencial e ver a própria agenda.

## Alternativas descartadas

- **Enviar foto do documento na compra.** Transforma a plataforma num cofre de documentos de identidade e laudos, com todo o risco e nenhum ganho: a conferência na entrada acontece do mesmo jeito.
- **Integrar com bases de carteira estudantil ou do governo.** Serviço pago ou convênio, fora do alcance de um estudo de caso, e não cobre todos os motivos.
- **Não registrar o motivo, só "tem meia".** A equipe não saberia qual documento pedir, e o organizador não teria como responder a uma fiscalização.
- **Acompanhante como campo do ingresso do titular.** Duas pessoas, um QR: a contagem erra e o acompanhante não consegue entrar depois.
- **Aviso por lista de pessoas.** Vira lista de e-mail para manter à mão. Categoria já diz quem é o público.

## Consequências

- A tela de compra precisa dizer, antes do pagamento, qual documento levar e que sem ele a diferença é cobrada na entrada (regra do evento, não do banco).
- "Meus dados" (exportação da conta) passa a incluir a declaração de meia e as credenciais.
- O envio do aviso por notificação é assunto do backend; o banco só diz quem pode ler o quê.
- Testes em `test/integracao/ingressos-meia-avisos.int.ts`.

# 0029. API do organizador: cadastros declarativos e o banco como autoridade

- Status: Aceita
- Data: 2026-11-15
- Amplia: [0013](0013-sql-puro-com-pg-e-repositorios.md), [0014](0014-api-em-node-nativo.md)

## Contexto

A área do organizador traz cerca de vinte cadastros (zonas, salas, tipos de ingresso, estandes, serviços...) e uma dúzia de operações com regra (convidar, emitir credencial, reservar estande, assinar contrato). No padrão da v1.0.0, cada módulo tem domínio, casos de uso, repositório, rotas e uma classe de erro própria. Repetir isso vinte vezes daria milhares de linhas iguais, e é em código repetido que uma checagem de permissão acaba esquecida.

As migrações 0010 a 0013 já puseram no banco quem pode o quê (RLS por papel, por organização e por parceiro) e as regras que não podem falhar (reserva atômica, contrato selado, limite de credenciais). A API não deve decidir permissão uma segunda vez, com outra lógica.

## Decisão

1. **Cadastro simples é declarado, não programado.** `cadastros/domain/catalogo.ts` descreve cada cadastro: a quem pertence (evento ou organização) e os campos, com tipo, limites e o rótulo que abre a mensagem de erro. Da mesma descrição saem a validação, as quatro rotas e, no adaptador, as colunas.
2. **Um caso de uso para todos** (`CadastrosServico`): valida, resolve o evento pelo slug, delega e audita. A auditoria guarda o que mudou (cadastro, id e nomes dos campos), nunca o conteúdo.
3. **O banco é a autoridade.** O repositório executa como a pessoa da sessão; a RLS aceita ou recusa. `shared/db/erro-banco.ts` traduz a resposta: violação de política vira `sem_permissao`, unicidade vira `conflito`, referência inexistente e `check` viram `dados_invalidos`, e o `raise` das funções vira `regra`, com a frase escrita na migração.
4. **Um erro de domínio só** (`ErroDominio`, cinco códigos) para os módulos novos, com uma tradução para HTTP. Os módulos da v1 ficam como estão.
5. **Nomes de tabela e coluna nunca vêm da requisição:** saem de constantes do adaptador e do catálogo, e campo desconhecido no corpo é recusado.
6. **Operação com regra tem caso de uso próprio** e não entra no catálogo: situação de estande, assinatura, credencial, convite, leitura.
7. **Leitura que cruza dados de outras pessoas vem por função** `security definer` com conferência de papel (migração 0014): equipe com nome, checklist de prontidão, números do painel. O checklist e os números são consultas, não tabelas.

## Alternativas descartadas

- **Um módulo completo por cadastro, como na v1.** Fiel ao padrão, mas multiplicaria código idêntico e o risco de divergência entre eles.
- **Conferir o papel na aplicação antes de cada escrita.** Duas fontes de verdade; quando divergem, vale a mais permissiva. A RLS já é testada com casos negativos.
- **Biblioteca de validação ou ORM.** O projeto evita dependências; a validação cabe em um arquivo e o SQL continua à vista.
- **Rota genérica com o nome do cadastro como parâmetro.** Esconde do roteador quais rotas existem e exigiria validar o nome a cada chamada. As rotas são registradas uma a uma, a partir do catálogo.
- **Devolver a mensagem crua do PostgreSQL.** Vaza nome de tabela e não ajuda ninguém. Restrições conhecidas têm frase própria; as outras, uma frase genérica.

## Consequências

- Cadastro novo é uma entrada no catálogo e uma linha no adaptador.
- Sem o papel, criar responde 403 e alterar ou apagar responde 404: a política esconde a linha, e a API não tem como distinguir "não existe" de "não é seu" sem perguntar de novo, o que seria conferir permissão fora do banco.
- Os testes pela API acharam uma brecha que os testes de política não viram: sala e atividade podiam apontar para zona de outro evento. A migração 0014 fecha com chave composta.
- A cobertura de unidade continua valendo para catálogo, validação, caso de uso e rotas; o adaptador é coberto pelos testes de integração, como os demais.

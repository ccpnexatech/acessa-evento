# 0025. Organização acima do evento, vários papéis por pessoa e convite

- Status: Aceita
- Data: 2026-11-11
- Amplia: [0002](0002-postgresql-com-isolamento-por-evento-via-rls.md)

## Contexto

A v1.0.0 nasceu com um evento só. A equipe era uma linha por pessoa em `membro_organizacao`, com um papel entre quatro, e o papel era dado por linha de comando. A área do organizador muda três coisas:

- Quem contrata a plataforma é uma entidade (sociedade, associação, empresa) que faz vários eventos. Local, parceiros e contratos pertencem a ela, não a cada edição.
- Em evento pequeno a mesma pessoa cuida de conteúdo e de credenciamento. Um papel por pessoa obriga a dar `admin` para quem não precisa.
- Organizador não abre terminal. Entrar na equipe tem de ser um convite por e-mail.

Tudo isso precisa acontecer sem apagar nem reinterpretar nenhum dado da v1.0.0.

## Decisão

1. **Tabela `organizacao`**, e `evento.organizacao_id` obrigatório. Na migração, cada evento existente ganha uma organização com o mesmo nome; o admin mais antigo vira `dono`, os outros admins viram `admin` da organização. Um gatilho cria a organização quando alguém insere evento sem informar (sementes e scripts da v1 seguem funcionando).
2. **Dois níveis de papel.** `organizacao_membro` guarda `dono` e `admin`; `membro_organizacao` continua guardando a equipe de cada evento. Dono e admin da organização valem como qualquer papel em todos os eventos dela: a regra mora em `tem_papel`, então as políticas da v1 passam a respeitá-la sem serem reescritas.
3. **Vários papéis por pessoa.** O papel entra na chave primária de `membro_organizacao`. A lista ganha `comercial`, `comunicacao`, `operacao` e `acessibilidade`. `cargo` e `exibir_publico` marcam a mesa organizadora que aparece na página do evento.
4. **Convite** em tabela própria, com e-mail cifrado e índice cego (mesmo padrão de `pessoa`), lista de papéis, validade de 14 dias e revogação. Convite sem evento é de organização. Aceitar é uma função `security definer` que confere o e-mail de quem está logado: o convidado ainda não tem papel nenhum, então nenhuma política o deixaria ler a tabela.
5. **`criar_organizacao`** também é função: quem cria vira dono na mesma transação.
6. **Evento de demonstração** (`evento.demonstracao`) nunca aparece na vitrine, mesmo publicado. É onde o organizador testa leitura de QR e avisos sem risco.
7. O comando `npm run papel` continua existindo para o primeiro acesso e para testes, mas agora acrescenta papel em vez de trocar.

## Alternativas descartadas

- **Organização como coluna de texto no evento.** Não dá para pendurar local, parceiro, contrato e equipe fixa numa coluna.
- **Um papel por pessoa, com mais papéis "combinados"** (`conteudo_credenciamento`...). A lista explode e toda política precisaria conhecer as combinações.
- **Permissão por tela, marcada uma a uma.** Flexível, mas ninguém consegue auditar quem pode o quê. Papel fechado é explicável numa frase.
- **Papéis de organização na mesma tabela da equipe do evento, com `evento_id` nulo.** Chave primária com nulo e políticas com dois sentidos na mesma linha. Duas tabelas pequenas são mais claras.
- **Convite por link aberto, sem e-mail.** Quem recebe o link encaminhado entra na equipe. Amarrar ao e-mail verificado no login custa nada, porque o login já é por código no e-mail.
- **Trocar a chave de `membro_organizacao` por um id.** Mudaria uma tabela da v1 mais do que o necessário; a chave composta já diz a regra.

## Consequências

- A consulta "eventos da minha equipe" deixa de fazer junção com a tabela de equipe (duplicaria a linha de quem tem dois papéis) e pergunta a `tem_papel`.
- Quem era admin de um evento da v1 passa a ser dono ou admin da organização daquele evento. É o mesmo alcance de antes enquanto a organização tiver um evento só; ao criar o segundo, ele já nasce visível para essas pessoas.
- O dono é o único que nomeia dono e admin. Admin de organização gerencia eventos, não a própria hierarquia.
- A política de leitura de `evento` olha `organizacao_id` direto, além de `tem_papel`: função `stable` não enxerga a linha que o próprio comando acabou de inserir, e sem isso o `insert ... returning` falharia.
- Testes em `test/integracao/organizacao.int.ts`, com casos negativos entre duas organizações e a migração aplicada sobre um banco no estado da v1.0.0.

# Guia de estudo

Para quem quer aprender com o projeto, usá-lo em disciplina ou partir dele num TCC, iniciação científica ou proposta nova.

## Trilha de leitura

Uma ordem que vai do problema ao código, com cerca de 1 hora por etapa:

1. [Visão geral](visao-geral.md): o problema, as pessoas, a jornada.
2. [`features/`](../features): o comportamento esperado em Gherkin. Ler os `.feature` antes do código mostra o que cada teste prova.
3. [Arquitetura](arquitetura.md) e os ADRs 0002, 0006, 0013 e 0021: as decisões com mais consequência.
4. Um módulo de ponta a ponta: [`apps/api/src/modules/assistente`](../apps/api/src/modules/assistente) é o menor; `credenciamento` é o mais rico.
5. [Acessibilidade](acessibilidade.md) e o [auditor](../apps/mobile/src/testes/auditoria.ts).
6. Rodar: [teste manual](teste-manual.md), com `npm run dev`.

## Conceitos que o projeto exercita

| Conceito | Onde ver |
| --- | --- |
| Clean architecture e portas/adaptadores | `apps/api/src/modules/*/{domain,application,adapters}` |
| Offline-first e sincronização | `apps/mobile/src/features/agenda/sincronizacao.ts`, `credenciamento/fila.ts` |
| Idempotência em pagamentos | `inscricao/application/casos-de-uso.ts`, ADR 0021 |
| Assinatura digital (Ed25519) e verificação offline | `apps/api/src/shared/qr/`, `apps/mobile/src/features/credenciamento/` |
| Segurança no banco (RLS, funções `security definer`) | `apps/api/db/migracoes/` |
| Privacidade por padrão (LGPD) | ADR 0012, `pedido_acessibilidade`, `assistente_avaliacao` |
| Testes por comportamento (BDD) e acessíveis por papel | `features/` + `*.test.tsx` com `getByRole` |
| Decisões registradas (ADR) | `docs/adr/` |
| Portão de qualidade sem dependências | `scripts/verify.ts`, `.githooks/` |

## Perguntas de pesquisa

Cada uma cabe num TCC, com o repositório como base experimental:

1. **Tempo de credenciamento.** O check-in por QR offline reduz o tempo médio por pessoa em relação à lista impressa? A diferença é maior para pessoas com deficiência? *Método:* cronometragem em evento real ou simulado, antes e depois; o app já mede a decisão do leitor (`npm run medir -w apps/mobile`).
2. **Pedir recurso na inscrição muda a experiência?** Saber antes ("Precisa de intérprete de Libras") reduz o constrangimento de explicar na porta? *Método:* entrevista semiestruturada com participantes e equipe.
3. **Assistente guiado ou chatbot de IA?** Para dúvidas de logística e acessibilidade, um grafo revisado pela organização ([ADR 0008](adr/0008-assistente-guiado-por-grafo-de-decisao-sem-ia.md)) responde com mais exatidão e confiança do que um modelo de linguagem? *Método:* comparação com as mesmas perguntas, avaliando exatidão, tempo e confiança percebida.
4. **Quanto da WCAG dá para verificar automaticamente num app nativo?** *Método:* aplicar o auditor a outros apps de código aberto e comparar com uma auditoria manual especializada.
5. **Offline-first em eventos de massa.** Qual o comportamento da fila de check-ins com dezenas de aparelhos e relógios desalinhados? *Método:* simulação com geração de leituras e atraso de rede.

## Propostas de extensão

Ideias que o projeto já preparou ou deixou espaço para:

- **Tempo real.** Confirmação de check-in na hora, avisos de mudança de sala. A direção técnica está anotada: SSE sobre `node:http`, o canal só avisa e o app busca pelas rotas existentes.
- **Audiodescrição e legenda ao vivo pelo celular**, com tradução para outros idiomas. Exige um serviço de mídia atrás de uma porta e muito cuidado com latência.
- **Libras no app.** Vídeos curtos em Libras nas respostas do assistente, gravados por intérpretes; evitar avatares automáticos sem validação da comunidade surda.
- **Gamificação inclusiva.** Desafios que não dependam de enxergar, correr ou ouvir.
- **Painel da organização.** Pedidos de acessibilidade por sessão, avaliações do assistente, relatório de check-ins repetidos.
- **Mapa acessível do local.** Rotas sem degraus, banheiros, balcões; descrito por texto, não só por imagem.

## Pesquisa com pessoas

Teste com usuários é o passo que valida tudo o que está aqui. Três cuidados:

- **Nada sobre nós sem nós.** Envolva pessoas com deficiência desde o planejamento, não só como testadoras. O lema do movimento das pessoas com deficiência está no espírito da Convenção sobre os Direitos das Pessoas com Deficiência, que pede a participação delas nas decisões que as afetam e, no Brasil, foi aprovada com equivalência de emenda constitucional ([Decreto 6.949/2009](https://planalto.gov.br/ccivil_03/_ato2007-2010/2009/decreto/d6949.htm)).
- **Ética.** Pesquisa acadêmica com pessoas no Brasil passa por Comitê de Ética em Pesquisa (CEP), via Plataforma Brasil. Fale com a orientação antes de recrutar.
- **Remuneração e acessibilidade da própria pesquisa.** Termo de consentimento em formato acessível (texto simples, Libras, leitura compatível com leitor de tela); deslocamento e tempo considerados.

Sugestão de protocolo mínimo: 5 participantes por perfil (leitor de tela, Libras, mobilidade, baixa visão), tarefas da jornada (inscrever-se pedindo um recurso, achar uma sessão com Libras, mostrar o ingresso sem internet, tirar uma dúvida no assistente), observação com pensar em voz alta e entrevista curta depois.

## Como citar

Use o arquivo [`CITATION.cff`](../CITATION.cff) na raiz (o GitHub mostra "Cite this repository"). O código é [MIT](../LICENSE): pode ser usado, adaptado e redistribuído, mantendo o aviso de autoria. Ao partir dele, cite também os ADRs que fundamentarem suas decisões.

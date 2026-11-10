# Referências

As fontes que sustentam as decisões, com onde cada uma aparece no projeto.

## Acessibilidade e direitos

| Fonte | O que diz | Onde aparece |
| --- | --- | --- |
| [W3C. *Web Content Accessibility Guidelines (WCAG) 2.2*. Recomendação, 5 out. 2023](https://www.w3.org/TR/WCAG22/) · [o que mudou](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) | Critérios de contraste, alvo de toque (2.5.8), foco visível (2.4.11, 2.4.13), autenticação acessível (3.3.8) | Tokens, auditor, anel de foco, login sem senha |
| [Brasil. Lei 13.146/2015, Lei Brasileira de Inclusão](https://planalto.gov.br/ccivil_03/_Ato2015-2018/2015/Lei/L13146.htm) | Acessibilidade como direito; barreiras de comunicação e atitudinais (art. 3º); cultura e lazer (art. 42); lugares reservados (art. 44); sites acessíveis (art. 63) | Visão do produto; pedido de recurso na inscrição |
| [Brasil. Decreto 6.949/2009, Convenção sobre os Direitos das Pessoas com Deficiência](https://planalto.gov.br/ccivil_03/_ato2007-2010/2009/decreto/d6949.htm) | Participação plena e consulta às pessoas com deficiência nas decisões que as afetam | Guia de estudo, pesquisa com pessoas |
| [Ministério dos Direitos Humanos e da Cidadania. *Manual de Acessibilidade em Eventos Presenciais*, 2ª ed.](https://www.gov.br/mdh/pt-br/navegue-por-temas/pessoa-com-deficiencia/publicacoes/manual-de-acessibilidade-em-eventos-presenciais/1Manual_Acessibilidade_Eventos_defesoeleitoralv21.pdf) | Perguntar o recurso na inscrição; posição do intérprete; audiodescrição com receptor; lugares reservados | Inscrição, orientações da equipe no credenciamento, assistente |
| ABNT NBR 9050 (acessibilidade em edificações) e NBR 16452 (audiodescrição) | Normas técnicas de espaço e de audiodescrição | Texto das orientações à equipe |
| [Android Developers. *Make apps more accessible*](https://developer.android.com/guide/topics/ui/accessibility/apps) | Alvo de toque de 48 dp, rótulos, foco | `tamanho.touchMin = 48` |
| [IBGE. Censo 2022: 14,4 milhões de pessoas com deficiência (via CNN Brasil, 23 mai. 2025)](https://www.cnnbrasil.com.br/saude/brasil-tem-144-milhoes-de-pessoas-com-deficiencia-diz-ibge/) | 7,3% da população de 2 anos ou mais; enxergar, andar e ouvir são as dificuldades mais frequentes | Visão geral |

## Privacidade

| Fonte | O que diz | Onde aparece |
| --- | --- | --- |
| [Brasil. Lei 13.709/2018, LGPD](https://planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm) | Dado de saúde é sensível (art. 5º, II) e exige cuidado reforçado (art. 11); direitos de acesso e eliminação (art. 18) | Cifra, retenção de 30 dias (ADR 0012), exportar e excluir conta |

## Engenharia

| Fonte | O que diz | Onde aparece |
| --- | --- | --- |
| [IETF. RFC 8032, *Edwards-Curve Digital Signature Algorithm (EdDSA)*](https://www.rfc-editor.org/rfc/rfc8032) | Ed25519: assinaturas curtas e verificação rápida | QR do ingresso (ADR 0006, 0022) |
| [IETF. *The Idempotency-Key HTTP Header Field* (Internet-Draft)](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/) | Repetir uma requisição não repete o efeito | Inscrição e pagamento (ADR 0021) |
| [IETF. RFC 9457, *Problem Details for HTTP APIs*](https://www.rfc-editor.org/rfc/rfc9457) | Formato padrão de erro | Toda a API |
| [Kleppmann, M. et al. *Local-first software*. Ink & Switch, 2019](https://inkandswitch.com/local-first/) | O dado vive no aparelho; a rede é opcional | Agenda, ingresso, check-in e assistente offline |
| [PostgreSQL. *Row Security Policies*](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) | Isolamento por linha no banco | ADR 0002, 0016 |
| [MADR, *Markdown Architectural Decision Records*](https://adr.github.io/madr) | Formato dos ADRs | `docs/adr/` |
| [Conventional Commits 1.0](https://www.conventionalcommits.org/pt-br/v1.0.0/) | Mensagens de commit legíveis por pessoas e máquinas | `.githooks/commit-msg` |
| [Cucumber. *Gherkin reference*](https://cucumber.io/docs/gherkin/reference/) | Comportamento descrito em linguagem natural | `features/` |
| [Testing Library. *Guiding principles*](https://testing-library.com/docs/guiding-principles/) | Testar como a pessoa usa: por papel e nome, não por detalhe interno | Todos os testes do app |

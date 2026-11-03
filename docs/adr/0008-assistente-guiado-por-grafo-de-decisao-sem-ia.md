# 0008. Assistente guiado por grafo de decisão, sem IA

- Status: Aceita
- Data: 2026-11-02

## Contexto

Respostas sobre acessibilidade e logística precisam ser exatas, aprovadas pela organização e disponíveis offline. Um modelo de linguagem pode inventar respostas e tem custo por uso.

## Decisão

O assistente percorre um grafo de decisão (estilo Akinator) com filtro por atributos, publicado pela organização. Cada folha é uma resposta revisada com data. O grafo é baixado e funciona offline. Padrão já validado no projeto OFIX.

## Consequências

**Ganhamos**
- Nenhuma resposta inventada; tudo é auditável.
- Custo zero e offline.
- Acessível: uma pergunta por tela, opções como botões.

**Pagamos**
- A organização precisa escrever e manter o grafo.
- Dúvidas fora do grafo vão para "Falar com a organização".

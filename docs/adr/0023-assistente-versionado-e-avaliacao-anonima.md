# 0023. Assistente publicado por versão, validado na API e avaliado sem dados pessoais

- Status: Aceita
- Data: 2026-11-10
- Detalha: [0008](0008-assistente-guiado-por-grafo-de-decisao-sem-ia.md)

## Contexto

O ADR 0008 decidiu o assistente por grafo de decisão, sem IA, offline. Faltava decidir como a organização publica o grafo, o que impede um grafo quebrado de chegar ao app e como medir se as respostas ajudam sem vigiar quem pergunta.

## Decisão

- **Versão imutável.** Cada publicação (`PUT /eventos/:slug/assistente`, papel `admin` ou `conteudo`) vira uma nova linha em `assistente_versao`, numerada sob trava. Nada é editado: a versão antiga fica para auditoria e para as avaliações que apontam para ela.
- **Validação na API, antes de gravar:**
  - ids `a-z0-9-`;
  - perguntas com 2 a 8 opções;
  - todo destino existe;
  - sem ciclos;
  - no máximo 6 perguntas seguidas;
  - todo nó alcançável a partir do início;
  - respostas com data de revisão;
  - 1 a 6 canais de atendimento com e-mail e telefone válidos.
- **Leitura pública com ETag `"v<versão>"`.** O app guarda a versão no aparelho e só baixa de novo quando muda. Se a versão muda no meio de um caminho, a pessoa termina na versão que estava usando.
- **"Pergunta n de m"** é calculado no app: n é a posição; m soma as perguntas já respondidas e o caminho mais longo que falta a partir dali.
- **Avaliação anônima.** `assistente_avaliacao` guarda só evento, versão, resposta, útil e o **dia** (sem hora, sem pessoa, sem aparelho). A rota não exige login. O participante não lê avaliações; a organização lê. Sem internet, a avaliação vai para uma fila no aparelho.
- **Canais** (balcão, e-mail, telefone, WhatsApp) viram links `mailto:`, `tel:` e `wa.me`, abertos pelo sistema.

## Consequências

- Um grafo com ciclo ou opção sem destino nunca chega a um participante.
- Não há editor visual: a organização publica JSON pela API. Um painel fica para depois do MVP.
- A avaliação anônima pode ser repetida pela mesma pessoa; falta limite de taxa por IP na borda (o mesmo ponto em aberto do ADR 0017).
- Medir "respostas que não ajudaram" é uma consulta simples por `resposta_id` e `versao`, pronta para o relatório da organização.

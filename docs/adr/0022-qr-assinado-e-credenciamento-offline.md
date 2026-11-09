# 0022. QR assinado e credenciamento offline: formato, chaves e fila

- Status: Aceita
- Data: 2026-11-09
- Detalha: [0006](0006-qr-do-ingresso-assinado-com-ed25519-e-validado-offline.md)

## Contexto

O ADR 0006 decidiu o princípio: QR assinado com Ed25519, validado sem internet, fila local e "vale o primeiro". Faltava decidir o formato, onde ficam os dados pessoais, como a chave chega ao aparelho e como dois portões offline chegam ao mesmo resultado.

## Decisão

- **Formato próprio e curto:** `AE1.<conteúdo>.<assinatura>`, em base64url. O conteúdo tem só `k` (id da chave), `i` (ingresso), `e` (evento) e `x` (validade: fim do evento + 2 dias). Nome e acessibilidade **não** vão no QR, que qualquer câmera lê.
- **Assinatura na API com o crypto nativo do Node** (`sign(null, …)` com Ed25519). A chave vem de `QR_CHAVE_PRIVADA` (PKCS#8) e `QR_CHAVE_ID`, obrigatória em produção. O `npm run dev` gera uma e guarda em `.dev/`.
- **Verificação no app com `@noble/curves`**, atrás da porta `Verificador`: o Hermes não tem WebCrypto com Ed25519. O formato existe nos dois lados, travado por um **vetor de teste igual** na API e no app: se um lado mudar, o teste do outro quebra.
- **Pacote da equipe:** `GET /credenciamento/:slug/pacote` traz chaves públicas e a lista (ingresso, nome, tipo, recursos de acessibilidade, primeiro check-in). Só para `admin` ou `credenciamento`, por uma função `security definer` que confere o papel. Fica no aparelho até sair da conta.
- **Check-in com id gerado no aparelho:** reenviar a fila nunca duplica (`on conflict do nothing`). O banco **não guarda** "válido" ou "repetido": calcula pela ordem de `feito_em` (desempate pelo id). Dois portões offline chegam ao mesmo relatório em qualquer ordem de envio.
- **Leitura no aparelho:** assinatura, evento e validade decidem "não reconhecido"; a lista e a fila local decidem "já entrou". Só leituras válidas entram na fila.
- **Check-in manual** exige "documento conferido" e fica na auditoria com quem da equipe fez.
- Câmera (`expo-camera`), vibração (`expo-haptics`) e brilho (`expo-brightness`) entram por portas; as telas são testadas sem aparelho.

## Consequências

- O leitor responde sem rede e sem esperar o servidor; o teste com 12 leituras offline e a sincronização posterior está automatizado.
- A hora do aparelho decide quem foi primeiro. Relógio muito errado pode inverter a ordem; a API recusa horários mais de 10 minutos no futuro.
- Ingresso cancelado só deixa de passar depois que o aparelho baixa a lista de novo (já previsto no 0006).
- Trocar a chave: publicar a nova junto com a anterior no pacote (`chaves` é uma lista) até os QRs antigos expirarem. Ainda não há rotação automática.
- Sair da conta apaga o pacote e a fila do aparelho; check-ins não enviados se perdem. A tela avisa, mas não bloqueia.

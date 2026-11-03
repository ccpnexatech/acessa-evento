# 0006. QR do ingresso assinado com Ed25519 e validado offline

- Status: Aceita
- Data: 2026-11-02

## Contexto

A entrada de um evento grande não pode parar quando a internet do pavilhão cai, e um QR copiável não pode valer como ingresso.

## Decisão

O QR carrega um token compacto (ingresso, evento, tipo, validade) assinado com Ed25519 pela plataforma. O app da equipe guarda a chave pública do evento e valida a assinatura sem rede. Check-ins ficam numa fila local e sincronizam depois; em conflito, vale o primeiro pelo horário.

## Consequências

**Ganhamos**
- Credenciamento funciona 100% offline.
- Falsificação exige a chave privada.

**Pagamos**
- Um mesmo QR pode entrar em dois portões offline; o conflito só aparece na sincronização (tratado como "repetido" no relatório).
- Revogação de ingresso só vale depois que o aparelho sincroniza.

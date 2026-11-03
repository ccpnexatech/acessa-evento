# 0002. PostgreSQL com isolamento por evento via RLS

- Status: Aceita
- Data: 2026-11-02

## Contexto

A plataforma atende vários eventos no mesmo banco (um só sistema com várias partes). Um vazamento entre eventos seria grave, e o MVP não pode pagar um banco por cliente.

## Decisão

Usar PostgreSQL. Toda tabela de dados de evento tem `evento_id`, e Row Level Security filtra por evento e papel. IDs em UUID v7. Dados pessoais sensíveis ficam em colunas `_cifrado` (AES-256-GCM, chave por envelope) com `_hash` (HMAC) para busca exata.

## Consequências

**Ganhamos**
- Isolamento garantido pelo banco, não só pela aplicação.
- Um único banco gratuito no MVP.
- UUID v7 ordenável por tempo, bom para índices.

**Pagamos**
- Políticas RLS precisam de testes próprios.
- Busca por dado cifrado só por igualdade (via hash).

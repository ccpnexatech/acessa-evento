# 0010. Infraestrutura gratuita com monitor de disponibilidade

- Status: Aceita
- Data: 2026-11-02

## Contexto

O case precisa estar no ar quando alguém o acessar, mas os planos gratuitos dormem por inatividade.

## Decisão

API Node em Render (plano gratuito), banco e Auth no Supabase, builds pelo EAS, erros no Sentry. Um monitor externo gratuito chama a rota `/saude` em intervalos para manter os serviços acordados e avisar quedas.

## Consequências

**Ganhamos**
- Custo zero.
- Queda vira alerta, não surpresa.

**Pagamos**
- Primeira requisição após uma pausa pode ser lenta.
- Limites dos planos gratuitos definem o teto de uso do case.

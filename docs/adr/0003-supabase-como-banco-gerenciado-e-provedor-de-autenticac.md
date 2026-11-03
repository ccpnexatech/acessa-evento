# 0003. Supabase como banco gerenciado e provedor de autenticação

- Status: Aceita
- Data: 2026-11-02

## Contexto

A infraestrutura precisa ser 100% gratuita no MVP, com login sem senha por e-mail, e o provedor de autenticação precisa ser substituível.

## Decisão

Usar Supabase (PostgreSQL gerenciado + Supabase Auth com código OTP por e-mail). O backend Node valida o JWT e nunca depende de recursos exclusivos do Supabase além do Auth; o acesso ao Auth fica atrás de uma interface `ProvedorIdentidade`.

## Consequências

**Ganhamos**
- Plano gratuito cobre o MVP.
- OTP por e-mail pronto, sem guardar senha.
- Trocar de provedor exige só um novo adaptador.

**Pagamos**
- Projeto gratuito pausa por inatividade: exige o monitor de disponibilidade (ADR 0010).
- Limites de envio de e-mail do plano gratuito.

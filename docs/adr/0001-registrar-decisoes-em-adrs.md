# 0001. Registrar decisões em ADRs

- Status: Aceita
- Data: 2026-11-02

## Contexto

O projeto é um case de portfólio e precisa mostrar o raciocínio por trás de cada escolha, não só o código. Decisões tomadas em conversa se perdem.

## Decisão

Toda decisão que muda arquitetura, dados, segurança ou experiência vira um ADR curto (formato MADR simplificado), numerado, em `docs/adr/`. ADR aceito não é editado: uma mudança gera um novo ADR que substitui o anterior.

## Consequências

**Ganhamos**
- Histórico verificável, que responde ao "não foi 100% IA".
- Custo baixo: uma página por decisão.

**Pagamos**
- Exige disciplina para escrever antes ou logo depois de decidir.

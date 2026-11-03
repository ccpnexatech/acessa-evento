# 0015. Commits direto na master, protegidos por um portão de qualidade local e no CI

- Status: Aceita
- Data: 2026-11-02

## Contexto

O projeto tem uma pessoa desenvolvendo e quer histórico linear e commits pequenos, sem pull requests. Sem revisão por PR, a proteção precisa vir de verificações automáticas.

## Decisão

- Todo commit segue Conventional Commits, validado pelo hook `commit-msg` (script próprio, sem husky ou commitlint).
- Todo push roda `npm run verify` pelo hook `pre-push`: lint, typecheck, testes, segurança e e2e, nessa ordem, parando no primeiro erro.
- A verificação de segurança é própria: `npm audit --audit-level=high` e varredura de segredos nos arquivos versionados.
- O CI no GitHub Actions roda o mesmo `npm run verify` a cada push na master.
- Os hooks ficam versionados em `.githooks/` e são ligados no `npm install`.

## Consequências

**Ganhamos**
- O mesmo portão na máquina e no CI; nada sobe vermelho.
- Histórico linear, fácil de ler no portfólio.

**Pagamos**
- O push fica mais lento à medida que os testes crescem.
- `git push --no-verify` ainda existe; o CI é a segunda linha de defesa.

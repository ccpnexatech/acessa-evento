import type { Rule } from 'eslint';

declare const plugin: {
  meta: { name: string };
  rules: Record<'toque-com-papel' | 'toque-com-nome' | 'campo-com-rotulo' | 'imagem-com-descricao', Rule.RuleModule>;
};
export default plugin;

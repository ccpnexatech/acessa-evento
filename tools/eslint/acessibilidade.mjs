/**
 * Regras próprias de acessibilidade para React Native (ADR 0020).
 * Pegam na escrita o que o leitor de tela não perdoa: toque sem papel ou sem nome,
 * campo sem rótulo e imagem sem descrição.
 */
const TOQUES = new Set(['Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback']);

const nome = (el) => (el.name.type === 'JSXIdentifier' ? el.name.name : null);
const atributo = (el, ...nomes) => el.attributes.find((a) => a.type === 'JSXAttribute' && nomes.includes(a.name.name));
const temEspalhamento = (el) => el.attributes.some((a) => a.type === 'JSXSpreadAttribute');
const falso = (a) => a?.value?.type === 'JSXExpressionContainer' && a.value.expression.type === 'Literal' && a.value.expression.value === false;

/** Há algum <Text> dentro (em qualquer nível, inclusive em ternários)? */
function temTexto(no) {
  if (!no || typeof no !== 'object') return false;
  if (no.type === 'JSXElement' && no.openingElement.name.type === 'JSXIdentifier' && no.openingElement.name.name === 'Text') return true;
  for (const [chave, valor] of Object.entries(no)) {
    if (chave === 'parent' || chave === 'loc' || chave === 'range') continue;
    if (Array.isArray(valor) ? valor.some(temTexto) : temTexto(valor)) return true;
  }
  return false;
}

const regra = (mensagens, verificar) => ({
  meta: { type: 'problem', schema: [], messages: mensagens },
  create: (ctx) => ({ JSXOpeningElement: (el) => verificar(ctx, el) }),
});

export default {
  meta: { name: 'acessibilidade' },
  rules: {
    'toque-com-papel': regra(
      { semPapel: '<{{el}}> precisa de accessibilityRole (botão, aba, togglebutton...) para o leitor de tela dizer o que ele faz.' },
      (ctx, el) => {
        if (!TOQUES.has(nome(el)) || temEspalhamento(el)) return;
        if (!atributo(el, 'accessibilityRole', 'role')) ctx.report({ node: el, messageId: 'semPapel', data: { el: nome(el) } });
      },
    ),
    'toque-com-nome': regra(
      { semNome: '<{{el}}> precisa de accessibilityLabel ou de um <Text> dentro, senão o leitor de tela anuncia só "botão".' },
      (ctx, el) => {
        if (!TOQUES.has(nome(el)) || temEspalhamento(el)) return;
        if (atributo(el, 'accessibilityLabel', 'aria-label') || temTexto(el.parent)) return;
        ctx.report({ node: el, messageId: 'semNome', data: { el: nome(el) } });
      },
    ),
    'campo-com-rotulo': regra(
      { semRotulo: '<TextInput> precisa de accessibilityLabel; o placeholder some ao digitar e nem todo leitor o lê.' },
      (ctx, el) => {
        if (nome(el) !== 'TextInput' || temEspalhamento(el)) return;
        if (!atributo(el, 'accessibilityLabel', 'aria-label', 'accessibilityLabelledBy', 'aria-labelledby')) ctx.report({ node: el, messageId: 'semRotulo' });
      },
    ),
    'imagem-com-descricao': regra(
      { semDescricao: '<{{el}}> precisa de accessibilityLabel, ou de accessible={false} se for só decoração.' },
      (ctx, el) => {
        if (!['Image', 'ImageBackground'].includes(nome(el)) || temEspalhamento(el)) return;
        if (atributo(el, 'accessibilityLabel', 'alt', 'aria-label') || falso(atributo(el, 'accessible'))) return;
        ctx.report({ node: el, messageId: 'semDescricao', data: { el: nome(el) } });
      },
    ),
  },
};

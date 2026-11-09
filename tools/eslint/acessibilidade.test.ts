import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import plugin from './acessibilidade.mjs';

RuleTester.describe = describe;
RuleTester.it = it;
const t = new RuleTester({ languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } } });
const r = (n: keyof typeof plugin.rules) => plugin.rules[n];

t.run('toque-com-papel', r('toque-com-papel'), {
  valid: ['<Pressable accessibilityRole="button"><Text>Ok</Text></Pressable>', '<Pressable {...props} />', '<View />'],
  invalid: [{ code: '<Pressable onPress={f}><Text>Ok</Text></Pressable>', errors: [{ messageId: 'semPapel' }] }],
});

t.run('toque-com-nome', r('toque-com-nome'), {
  valid: [
    '<Pressable accessibilityRole="button"><Text>Ok</Text></Pressable>',
    '<Pressable accessibilityRole="button" accessibilityLabel="Fechar"><Icone /></Pressable>',
    '<Pressable accessibilityRole="button"><View>{x ? <Text>A</Text> : null}</View></Pressable>',
  ],
  invalid: [{ code: '<Pressable accessibilityRole="button"><Icone /></Pressable>', errors: [{ messageId: 'semNome' }] }],
});

t.run('campo-com-rotulo', r('campo-com-rotulo'), {
  valid: ['<TextInput accessibilityLabel="E-mail" />', '<TextInput {...resto} />'],
  invalid: [{ code: '<TextInput placeholder="E-mail" />', errors: [{ messageId: 'semRotulo' }] }],
});

t.run('imagem-com-descricao', r('imagem-com-descricao'), {
  valid: ['<Image accessibilityLabel="Mapa do pavilhão" source={s} />', '<Image accessible={false} source={s} />'],
  invalid: [{ code: '<Image source={s} />', errors: [{ messageId: 'semDescricao' }] }],
});

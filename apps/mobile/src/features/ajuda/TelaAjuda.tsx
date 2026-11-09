/** Ajuda: conta, preferências de acessibilidade e sair. */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { espaco, raio, tamanho } from '@acessa-evento/tokens';
import { useTema } from '../../shared/tema/TemaProvider';
import type { PreferenciaContraste } from '../../shared/tema/TemaProvider';
import { Botao, Paragrafo, Tela } from '../../shared/ui/componentes';

const OPCOES: readonly { valor: PreferenciaContraste; rotulo: string; dica: string }[] = [
  { valor: 'sistema', rotulo: 'Como o sistema', dica: 'Segue o ajuste de contraste do aparelho.' },
  { valor: 'ligado', rotulo: 'Sempre ligado', dica: 'Preto e branco, bordas fortes.' },
  { valor: 'desligado', rotulo: 'Desligado', dica: 'Cores do evento.' },
];

export function TelaAjuda({ nome, onSair }: { nome: string; onSair: () => void }) {
  const { cores, contraste, definirContraste } = useTema();
  return (
    <Tela titulo="Ajuda">
      <Paragrafo>{nome ? `Você entrou como ${nome}.` : 'Você entrou.'}</Paragrafo>
      <Text accessibilityRole="header" style={[estilos.secao, { color: cores.ink900 }]}>Alto contraste</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Alto contraste" style={estilos.grupo}>
        {OPCOES.map((o) => {
          const on = o.valor === contraste;
          return (
            <Pressable
              key={o.valor}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={o.rotulo}
              accessibilityHint={o.dica}
              onPress={() => definirContraste(o.valor)}
              style={[estilos.opcao, { borderColor: on ? cores.primary600 : cores.borderControl, backgroundColor: on ? cores.primary050 : cores.surface000 }]}
            >
              <View style={[estilos.bolinha, { borderColor: on ? cores.primary600 : cores.borderControl }]}>
                {on ? <View style={[estilos.miolo, { backgroundColor: cores.primary600 }]} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[estilos.rotulo, { color: cores.ink900 }]}>{o.rotulo}</Text>
                <Text style={[estilos.dica, { color: cores.ink600 }]}>{o.dica}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Botao variante="secundario" rotulo="Sair" onPress={onSair} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  secao: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  grupo: { gap: espaco['2'] },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: espaco['3'], minHeight: tamanho.touchLg, padding: espaco['3'], borderWidth: 2, borderRadius: raio.md },
  bolinha: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  miolo: { width: 12, height: 12, borderRadius: 6 },
  rotulo: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
  dica: { fontSize: 16, lineHeight: 24 },
});

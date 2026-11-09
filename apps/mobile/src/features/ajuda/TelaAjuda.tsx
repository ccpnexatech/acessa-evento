/** Ajuda: conta, preferências de acessibilidade e sair. */
import { StyleSheet, Text, View } from 'react-native';
import { espaco } from '@acessa-evento/tokens';
import { useTema } from '../../shared/tema/TemaProvider';
import type { PreferenciaContraste } from '../../shared/tema/TemaProvider';
import { Botao, OpcaoRadio, Paragrafo, Tela } from '../../shared/ui/componentes';

const OPCOES: readonly { valor: PreferenciaContraste; rotulo: string; dica: string }[] = [
  { valor: 'sistema', rotulo: 'Como o sistema', dica: 'Segue o ajuste de contraste do aparelho.' },
  { valor: 'ligado', rotulo: 'Sempre ligado', dica: 'Preto e branco, bordas fortes.' },
  { valor: 'desligado', rotulo: 'Desligado', dica: 'Cores do evento.' },
];

interface Props {
  readonly nome: string;
  readonly onSair: () => void;
  readonly onVerEventos?: () => void;
}

export function TelaAjuda({ nome, onSair, onVerEventos }: Props) {
  const { cores, contraste, definirContraste } = useTema();
  return (
    <Tela titulo="Ajuda">
      <Paragrafo>{nome ? `Você entrou como ${nome}.` : 'Você entrou.'}</Paragrafo>
      {onVerEventos ? <Botao variante="texto" rotulo="Ver eventos e inscrições" onPress={onVerEventos} /> : null}
      <Text accessibilityRole="header" style={[estilos.secao, { color: cores.ink900 }]}>Alto contraste</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Alto contraste" style={estilos.grupo}>
        {OPCOES.map((o) => (
          <OpcaoRadio key={o.valor} rotulo={o.rotulo} dica={o.dica} marcado={o.valor === contraste} onPress={() => definirContraste(o.valor)} />
        ))}
      </View>
      <Botao variante="secundario" rotulo="Sair" onPress={onSair} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  secao: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  grupo: { gap: espaco['2'] },
});

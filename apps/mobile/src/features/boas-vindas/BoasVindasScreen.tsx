/**
 * Tela provisória pós-login: confirma que o acesso funciona de ponta a ponta.
 * Será substituída pela Agenda na fase 4.
 */
import { StyleSheet, Text, View } from 'react-native';
import { espaco, tipografia } from '@acessa-evento/tokens';
import { useTema } from '../../shared/tema/TemaProvider';
import { Botao } from '../../shared/ui/componentes';

interface Props {
  readonly nome?: string | null;
  readonly onSair?: () => void;
}

export function BoasVindasScreen({ nome, onSair }: Props) {
  const { cores } = useTema();
  return (
    <View style={[estilos.tela, { backgroundColor: cores.surface000 }]} testID="tela-boas-vindas">
      <Text accessibilityRole="header" style={[estilos.titulo, { color: cores.ink900 }]}>
        {nome ? `Olá, ${nome}` : 'Acessa Evento'}
      </Text>
      <Text style={[estilos.texto, { color: cores.ink600 }]}>
        Seu ingresso, a agenda e a ajuda do evento num lugar só, com ou sem internet.
      </Text>
      {onSair ? <Botao variante="secundario" rotulo="Sair" onPress={onSair} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: {
    flex: 1,
    justifyContent: 'center',
    gap: espaco['3'],
    paddingHorizontal: espaco['4'],
  },
  titulo: {
    fontSize: tipografia.display.tamanho,
    lineHeight: tipografia.display.alturaLinha,
    fontWeight: '700',
  },
  texto: {
    fontSize: 18,
    lineHeight: 28,
  },
});

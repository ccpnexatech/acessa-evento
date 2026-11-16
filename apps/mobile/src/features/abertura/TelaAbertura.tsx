/**
 * Abertura própria do app, antes de qualquer evento: quem somos e, com
 * transparência, o que o app pede e o que não pede. Nenhuma permissão é
 * solicitada aqui; cada uma é pedida na hora em que faz sentido.
 */
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { espaco, raio } from '@acessa-evento/tokens';
import { useTema } from '../../shared/tema/TemaProvider';
import { Botao, Paragrafo, Tela } from '../../shared/ui/componentes';
import { Xilo } from '../../shared/xilo/Xilo';
import type { NomeXilo } from '../../shared/xilo/Xilo';

/** O que o app usa do aparelho e da pessoa. Símbolo sempre com texto ao lado. */
export const PEDIDOS: readonly { readonly simbolo: NomeXilo; readonly titulo: string; readonly texto: string }[] = [
  { simbolo: 'simboloIngresso', titulo: 'Seu e-mail', texto: 'Para entrar sem senha: enviamos um código. Não vendemos nem compartilhamos.' },
  { simbolo: 'simboloCamera', titulo: 'Câmera', texto: 'Só para ler QR, e só se você for da equipe de um evento. Pedimos na hora de ler, nunca antes.' },
  { simbolo: 'simboloAviso', titulo: 'Notificações', texto: 'Não enviamos. Os avisos do evento aparecem dentro do app, quando você abre.' },
  { simbolo: 'simboloMapa', titulo: 'Localização, contatos e microfone', texto: 'Não pedimos.' },
  { simbolo: 'simboloLibras', titulo: 'Pedido de acessibilidade', texto: 'Você conta só se quiser, ao se inscrever. Só a equipe do evento vê, e apagamos 30 dias depois.' },
  { simbolo: 'simboloPrivacidade', titulo: 'Seus dados', texto: 'Você pode baixar tudo ou apagar a conta quando quiser, na aba Ajuda.' },
];

interface Props {
  readonly onComecar: () => void;
  readonly onExplorar: () => void;
}

export function TelaAbertura({ onComecar, onExplorar }: Props) {
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  const largura = Math.min(width - espaco['4'] * 2, 320);
  return (
    <Tela
      titulo="Acessa Evento"
      rodape={(
        <>
          <Botao rotulo="Entrar ou criar conta" onPress={onComecar} />
          <Botao variante="texto" rotulo="Ver eventos sem entrar" onPress={onExplorar} />
        </>
      )}
    >
      <View style={estilos.cena}><Xilo nome="boasVindas" largura={largura} /></View>
      <Paragrafo>Seu ingresso, a agenda e a ajuda do evento num lugar só, com ou sem internet. Feito para todo mundo chegar.</Paragrafo>
      <Text accessibilityRole="header" style={[estilos.secao, { color: cores.ink900 }]}>O que o app pede, e por quê</Text>
      {PEDIDOS.map((p) => (
        <View key={p.titulo} accessible style={[estilos.item, { backgroundColor: cores.surface100 }]}>
          <Xilo nome={p.simbolo} largura={28} cor={cores.primary700} decorativa />
          <View style={estilos.itemTexto}>
            <Text style={[estilos.itemTitulo, { color: cores.ink900 }]}>{p.titulo}</Text>
            <Text style={[estilos.itemLinha, { color: cores.ink900 }]}>{p.texto}</Text>
          </View>
        </View>
      ))}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cena: { alignItems: 'center' },
  secao: { fontSize: 22, lineHeight: 30, fontWeight: '700' },
  item: { flexDirection: 'row', gap: espaco['3'], padding: espaco['4'], borderRadius: raio.lg, alignItems: 'flex-start' },
  itemTexto: { flex: 1, gap: 2 },
  itemTitulo: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
  itemLinha: { fontSize: 18, lineHeight: 26 },
});

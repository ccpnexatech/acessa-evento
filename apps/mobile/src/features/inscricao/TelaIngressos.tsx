/**
 * Aba Ingresso: QR assinado que funciona sem internet (feature 04,
 * "Mostrar o ingresso sem internet"). Com o QR na tela, o brilho vai ao
 * máximo e volta ao sair; a porta `aumentarBrilho` vem da rota.
 */
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { espaco, raio } from '@acessa-evento/tokens';
import { useTema } from '../../shared/tema/TemaProvider';
import { DesenhoQr } from '../../shared/qr/DesenhoQr';
import { Botao, MensagemErro, Paragrafo, Tela } from '../../shared/ui/componentes';
import { useIngressos } from './ProvedorIngressos';
import { periodo } from './modelo';
import type { Ingresso } from './modelo';

/** Devolve a função que restaura o brilho anterior. */
export type AumentarBrilho = () => () => void;

const hora = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

function CartaoIngresso({ ingresso: i }: { ingresso: Ingresso }) {
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  const lado = Math.min(width - espaco['4'] * 4, 320);
  return (
    <View style={[estilos.cartao, { backgroundColor: cores.surface100, borderColor: cores.primary600 }]}>
      <Text accessibilityRole="header" style={[estilos.titulo, { color: cores.ink900 }]}>{i.evento.nome}</Text>
      {i.checkin ? (
        <View accessibilityLiveRegion="polite" style={[estilos.selo, { backgroundColor: cores.success100 }]}>
          <Text style={[estilos.seloTexto, { color: cores.success700 }]}>{`Check-in feito às ${hora(i.checkin.em)}, no ${i.checkin.portao}`}</Text>
        </View>
      ) : null}
      <View style={estilos.qr}>
        <DesenhoQr valor={i.qr} tamanho={lado} rotulo={`QR do ingresso de ${i.nome ?? 'participante'}. Mostre na entrada.`} />
      </View>
      <Text style={[estilos.nome, { color: cores.ink900 }]}>{i.nome ?? 'Complete seu nome no crachá'}</Text>
      <Text style={[estilos.linha, { color: cores.ink900 }]}>{i.tipo}</Text>
      <Text style={[estilos.linha, { color: cores.ink600 }]}>{`${periodo(i.evento.inicio, i.evento.fim)} · ${i.evento.local}`}</Text>
      <Text style={[estilos.linha, { color: cores.primary700, fontWeight: '700' }]}>Disponível sem internet</Text>
    </View>
  );
}

interface Props {
  readonly onVerEventos: () => void;
  readonly aumentarBrilho?: AumentarBrilho;
}

export function TelaIngressos({ onVerEventos, aumentarBrilho }: Props) {
  const { ingressos, carregando, offline } = useIngressos();
  const temQr = ingressos.length > 0;

  useEffect(() => {
    if (!temQr || !aumentarBrilho) return undefined;
    return aumentarBrilho();
  }, [temQr, aumentarBrilho]);

  if (carregando && !temQr) {
    return (
      <Tela titulo="Ingresso">
        <ActivityIndicator accessibilityLabel="Carregando seus ingressos" />
      </Tela>
    );
  }
  if (!temQr) {
    return (
      <Tela titulo="Ingresso">
        {offline ? <MensagemErro tom="info" texto="Sem internet. Não conseguimos conferir seus ingressos agora." /> : null}
        <Paragrafo>Você ainda não tem ingresso.</Paragrafo>
        <Botao rotulo="Ver eventos" onPress={onVerEventos} />
      </Tela>
    );
  }
  return (
    <Tela titulo={ingressos.length === 1 ? 'Ingresso' : 'Ingressos'}>
      {offline ? <MensagemErro tom="info" texto="Sem internet. Seu ingresso continua valendo." /> : null}
      {ingressos.map((i) => <CartaoIngresso key={i.id} ingresso={i} />)}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cartao: { padding: espaco['4'], borderRadius: raio.lg, borderWidth: 2, gap: espaco['2'], alignItems: 'center' },
  titulo: { fontSize: 22, lineHeight: 30, fontWeight: '700', textAlign: 'center' },
  qr: { padding: espaco['2'], backgroundColor: '#FFFFFF', borderRadius: raio.md },
  nome: { fontSize: 24, lineHeight: 32, fontWeight: '700', textAlign: 'center' },
  linha: { fontSize: 18, lineHeight: 26, textAlign: 'center' },
  selo: { paddingHorizontal: espaco['3'], paddingVertical: espaco['2'], borderRadius: raio.md },
  seloTexto: { fontSize: 18, lineHeight: 26, fontWeight: '700', textAlign: 'center' },
});

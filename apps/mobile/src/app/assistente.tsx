import { useMemo } from 'react';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { TelaAssistente } from '../features/assistente/TelaAssistente';
import { AssistenteOffline } from '../features/assistente/sincronizacao';
import { EVENTO_SLUG } from '../shared/config';
import { useSessao } from '../shared/sessao/ProvedorSessao';

export default function Assistente() {
  const { requisitar, cofre } = useSessao();
  const router = useRouter();
  const servico = useMemo(() => new AssistenteOffline(requisitar, cofre, EVENTO_SLUG), [requisitar, cofre]);
  return (
    <TelaAssistente
      servico={servico}
      abrirLink={(url) => void Linking.openURL(url).catch(() => undefined)}
      onFechar={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}

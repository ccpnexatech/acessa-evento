/** Carrega o evento e abre o fluxo de inscrição. */
import { ActivityIndicator } from 'react-native';
import { useCarga } from '../../shared/hooks/useCarga';
import { Botao, MensagemErro, Tela } from '../../shared/ui/componentes';
import type { ApiInscricao } from './api';
import { FluxoInscricao } from './FluxoInscricao';
import type { Ingresso } from './modelo';

interface Props {
  readonly slug: string;
  readonly api: ApiInscricao;
  readonly gerarChave: () => string;
  readonly onConcluido: (i: Ingresso) => void;
  readonly onVerIngresso: () => void;
  readonly onCancelar: () => void;
}

export function TelaInscricao({ slug, api, ...resto }: Props) {
  const { dados, carregando, erro, recarregar } = useCarga(() => api.evento(slug), [api, slug]);
  if (dados) return <FluxoInscricao evento={dados} api={api} {...resto} />;
  return (
    <Tela titulo={carregando ? 'Carregando' : 'Inscrição indisponível'}>
      {carregando ? <ActivityIndicator accessibilityLabel="Carregando a inscrição" /> : null}
      <MensagemErro texto={erro} />
      {erro ? <Botao variante="secundario" rotulo="Tentar de novo" onPress={recarregar} /> : null}
      <Botao variante="texto" rotulo="Voltar" onPress={resto.onCancelar} />
    </Tela>
  );
}

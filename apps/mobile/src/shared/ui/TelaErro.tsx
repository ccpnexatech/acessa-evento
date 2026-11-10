/** Tela mostrada quando algo quebra: diz o que fazer, sem detalhes técnicos. */
import { Botao, Paragrafo, Tela } from './componentes';

export function TelaErro({ onTentarDeNovo }: { onTentarDeNovo: () => void }) {
  return (
    <Tela titulo="Algo deu errado" rodape={<Botao rotulo="Tentar de novo" onPress={onTentarDeNovo} />}>
      <Paragrafo>O app encontrou um problema nesta tela. Seu ingresso e seus dados continuam salvos.</Paragrafo>
      <Paragrafo secundario>Se acontecer de novo, feche e abra o app. A equipe já foi avisada.</Paragrafo>
    </Tela>
  );
}

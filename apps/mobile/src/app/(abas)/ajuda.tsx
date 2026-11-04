import { Botao, Paragrafo, Tela } from '../../shared/ui/componentes';
import { useSessao } from '../../shared/sessao/ProvedorSessao';

export default function Ajuda() {
  const { estado, sair } = useSessao();
  const nome = estado.tipo === 'logado' ? (estado.conta.nomeCracha ?? estado.conta.email) : '';
  return (
    <Tela titulo="Ajuda">
      <Paragrafo>{nome ? `Você entrou como ${nome}.` : 'Você entrou.'}</Paragrafo>
      <Botao variante="secundario" rotulo="Sair" onPress={() => void sair()} />
    </Tela>
  );
}

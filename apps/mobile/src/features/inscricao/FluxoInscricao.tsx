/**
 * Inscrição em passos (protótipo Z3 a Z5): ingresso → acessibilidade → pagamento → pronto.
 *
 * A chave de idempotência nasce na primeira tentativa de pagar e é mantida
 * enquanto o resultado é desconhecido (sem internet): tocar em "Pagar" de novo
 * reaproveita a chave e o servidor não cobra duas vezes. Uma resposta
 * definitiva (recusado, esgotado) ou a troca de forma de pagamento gera outra.
 */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { espaco, raio } from '@acessa-evento/tokens';
import { useTema } from '../../shared/tema/TemaProvider';
import { ErroApi } from '../../shared/api/cliente';
import { Botao, CaixaMarcar, CampoTexto, MensagemErro, OpcaoRadio, Paragrafo, Tela } from '../../shared/ui/componentes';
import type { ApiInscricao } from './api';
import { PEDIDOS_ACESSIBILIDADE, formatarCartao, luhnValido, reais } from './modelo';
import type { DetalheEvento, Ingresso, Metodo, RecursoPedido } from './modelo';

type Passo = 'ingresso' | 'acessibilidade' | 'pagamento';
const PASSOS: readonly { id: Passo; nome: string }[] = [
  { id: 'ingresso', nome: 'Ingresso' },
  { id: 'acessibilidade', nome: 'Acessibilidade' },
  { id: 'pagamento', nome: 'Pagamento' },
];

interface Props {
  readonly evento: DetalheEvento;
  readonly api: ApiInscricao;
  readonly gerarChave: () => string;
  readonly onConcluido: (ingresso: Ingresso) => void;
  readonly onVerIngresso: () => void;
  readonly onCancelar: () => void;
}

export function FluxoInscricao({ evento, api, gerarChave, onConcluido, onVerIngresso, onCancelar }: Props) {
  const { cores } = useTema();
  const [passo, setPasso] = useState<Passo>('ingresso');
  const [tipoId, setTipoId] = useState<string | null>(null);
  const [recursos, setRecursos] = useState<RecursoPedido[]>([]);
  const [metodo, setMetodo] = useState<Metodo>('pix');
  const [cartao, setCartao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState<Ingresso | null>(null);
  const chave = useRef<string | null>(null);
  const primeira = useRef(true);

  const indice = PASSOS.findIndex((p) => p.id === passo);
  const tipo = evento.tipos.find((t) => t.id === tipoId) ?? null;

  // Mudar de passo não muda de tela: o leitor de tela precisa ouvir onde a pessoa está.
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    AccessibilityInfo.announceForAccessibility(pronto ? `Você está no ${evento.nome}` : `Passo ${indice + 1} de 3, ${PASSOS[indice]?.nome}`);
  }, [indice, pronto, evento.nome]);

  const ir = (p: Passo) => {
    setErro(null);
    setPasso(p);
  };
  const trocarMetodo = (m: Metodo) => {
    setMetodo(m);
    setErro(null);
    chave.current = null;
  };

  const pagar = async () => {
    if (!tipo) return ir('ingresso');
    if (metodo === 'cartao' && !luhnValido(cartao)) {
      setErro('Número de cartão inválido. Confira os dígitos.');
      return;
    }
    setErro(null);
    setEnviando(true);
    chave.current ??= gerarChave();
    try {
      const ingresso = await api.inscrever(evento.slug, chave.current, {
        tipoIngressoId: tipo.id,
        recursos,
        metodo,
        ...(metodo === 'cartao' ? { cartao: { numero: cartao.replace(/\D/g, '') } } : {}),
      });
      chave.current = null;
      setPronto(ingresso);
      onConcluido(ingresso);
    } catch (e) {
      if (e instanceof ErroApi && e.status === 0) {
        setErro('Sem internet. Seu pedido está guardado: toque de novo quando a conexão voltar. Não cobramos duas vezes.');
      } else {
        chave.current = null;
        setErro(e instanceof ErroApi ? e.message : 'Algo deu errado. Tente de novo.');
        if (e instanceof ErroApi && e.codigo === 'esgotado') setTipoId(null);
      }
    } finally {
      setEnviando(false);
    }
  };

  if (pronto) {
    return (
      <Tela titulo={`Você está no ${evento.nome}`} rodape={<Botao rotulo="Ver meu ingresso" onPress={onVerIngresso} />}>
        <Paragrafo>{`Ingresso ${pronto.tipo}. Ele já está na aba Ingresso e funciona sem internet.`}</Paragrafo>
        <Paragrafo secundario>Enviamos o recibo para o seu e-mail.</Paragrafo>
      </Tela>
    );
  }

  const cabecalho = (
    <>
      <Botao variante="texto" rotulo={indice === 0 ? 'Cancelar inscrição' : 'Voltar'} onPress={() => (indice === 0 ? onCancelar() : ir(PASSOS[indice - 1]?.id ?? 'ingresso'))} />
      <Text style={[estilos.passo, { color: cores.primary700 }]}>{`Passo ${indice + 1} de 3 · ${evento.nome}`}</Text>
    </>
  );

  if (passo === 'ingresso') {
    return (
      <Tela
        titulo="Escolha o ingresso"
        rodape={<Botao rotulo="Continuar" onPress={() => (tipo ? ir('acessibilidade') : setErro('Escolha um tipo de ingresso.'))} />}
      >
        {cabecalho}
        <MensagemErro texto={erro} />
        <View accessibilityRole="radiogroup" accessibilityLabel="Tipo de ingresso" style={estilos.grupo}>
          {evento.tipos.map((t) => (
            <OpcaoRadio
              key={t.id}
              rotulo={t.nome}
              dica={t.descricao}
              valor={reais(t.precoCentavos)}
              marcado={t.id === tipoId}
              desabilitado={t.esgotado}
              motivo="Esgotado"
              onPress={() => {
                setTipoId(t.id);
                setErro(null);
              }}
            />
          ))}
        </View>
      </Tela>
    );
  }

  if (passo === 'acessibilidade') {
    return (
      <Tela titulo="Precisa de algum recurso?" rodape={<Botao rotulo="Continuar" onPress={() => ir('pagamento')} />}>
        {cabecalho}
        <Paragrafo secundario>É opcional. Só a organização vê, para preparar o evento, e apagamos 30 dias depois que ele termina.</Paragrafo>
        {PEDIDOS_ACESSIBILIDADE.map((r) => (
          <CaixaMarcar
            key={r.valor}
            rotulo={r.rotulo}
            dica={r.dica}
            marcado={recursos.includes(r.valor)}
            onMudar={(v) => setRecursos((atual) => (v ? [...atual, r.valor] : atual.filter((x) => x !== r.valor)))}
          />
        ))}
      </Tela>
    );
  }

  const rotuloPagar = metodo === 'pix' ? 'Gerar código Pix' : `Pagar ${tipo ? reais(tipo.precoCentavos) : ''}`;
  return (
    <Tela titulo="Pagamento" rodape={<Botao rotulo={rotuloPagar} rotuloCarregando="Processando…" carregando={enviando} onPress={pagar} />}>
      {cabecalho}
      <MensagemErro tom="info" texto="Ambiente de teste. Nenhum dinheiro é cobrado." />
      <View accessible style={[estilos.resumo, { backgroundColor: cores.surface100 }]}>
        <Text style={[estilos.resumoLinha, { color: cores.ink600 }]}>Resumo</Text>
        <Text style={[estilos.resumoLinha, { color: cores.ink900 }]}>{`${tipo?.nome ?? ''} · ${tipo ? reais(tipo.precoCentavos) : ''}`}</Text>
        {recursos.length ? <Text style={[estilos.resumoLinha, { color: cores.ink600 }]}>{`${recursos.length === 1 ? '1 recurso de acessibilidade pedido' : `${recursos.length} recursos de acessibilidade pedidos`}`}</Text> : null}
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel="Forma de pagamento" style={estilos.grupo}>
        <OpcaoRadio rotulo="Pix" dica="Aprovação na hora." marcado={metodo === 'pix'} onPress={() => trocarMetodo('pix')} />
        <OpcaoRadio rotulo="Cartão de crédito" marcado={metodo === 'cartao'} onPress={() => trocarMetodo('cartao')} />
      </View>
      {metodo === 'cartao' ? (
        <CampoTexto
          rotulo="Número do cartão"
          dica="Teste: 4242 4242 4242 4242 aprova; um número terminado em 0002 é recusado."
          value={cartao}
          onChangeText={(t) => {
            setCartao(formatarCartao(t));
            chave.current = null;
          }}
          keyboardType="number-pad"
          autoComplete="cc-number"
          textContentType="creditCardNumber"
          maxLength={23}
        />
      ) : null}
      <MensagemErro texto={erro} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  passo: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  grupo: { gap: espaco['2'] },
  resumo: { padding: espaco['4'], borderRadius: raio.lg, gap: espaco['1'] },
  resumoLinha: { fontSize: 18, lineHeight: 26 },
});

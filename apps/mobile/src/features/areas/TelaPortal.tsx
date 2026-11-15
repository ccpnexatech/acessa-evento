/**
 * Espaço do expositor no celular (momento "Entrou um expositor"): o que falta
 * fazer, estandes (escolha por lista, que funciona com leitor de tela), nível
 * calculado, contrato para ler e assinar, equipe e credenciais.
 * Marca, serviços e montagem são editados na área web; aqui aparecem para conferência.
 */
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useCarga } from '../../shared/hooks/useCarga';
import { useTema } from '../../shared/tema/TemaProvider';
import { Botao, CaixaMarcar, MensagemErro, Paragrafo, Tela } from '../../shared/ui/componentes';
import { papeisPorExtenso, reais } from './api';
import type { ApiAreas, Portal } from './api';
import { Carregando, Cartao, Secao } from './telas';

const SITUACAO_ESTANDE: Readonly<Record<string, string>> = { reservado: 'Reservado para você', vendido: 'Vendido' };
const SITUACAO_MONTAGEM: Readonly<Record<string, string>> = { pendente: 'faltam documentos', em_analise: 'em análise pela organização', aprovada: 'aprovada', recusada: 'recusada' };
const TIPO_MONTAGEM: Readonly<Record<string, string>> = { basica: 'Montagem básica da feira', montadora_propria: 'Montadora própria', estande_diferente: 'Estande diferente' };

const ate = (iso: string) => new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Fortaleza' }).format(new Date(iso)).replace('.', '');

export function TelaPortal({ api, id, onVoltar }: { api: ApiAreas; id: string; onVoltar: () => void }) {
  const { cores } = useTema();
  const carga = useCarga(async () => {
    const portal = await api.portal(id);
    // O mapa é cortesia para escolher estande; sem ele, o resto do espaço abre igual.
    const livres = (await api.mapa(portal.participacao.evento.slug).catch(() => [])).filter((e) => e.situacao === 'livre');
    return { portal, livres };
  }, [api, id]);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [li, setLi] = useState(false);
  const [abrirTexto, setAbrirTexto] = useState(false);
  const [escolhendo, setEscolhendo] = useState(false);

  const fazer = async (chave: string, acao: () => Promise<void>, feito: string) => {
    setOcupado(chave);
    setErro(null);
    setAviso(null);
    try {
      await acao();
      setAviso(feito);
      carga.recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir.');
      carga.recarregar();
    } finally {
      setOcupado(null);
    }
  };

  const p: Portal | undefined = carga.dados?.portal;
  if (!p) {
    return (
      <Tela titulo="Meu espaço">
        <Botao variante="texto" rotulo="Voltar" onPress={onVoltar} />
        {carga.carregando ? <Carregando rotulo="Carregando o seu espaço" /> : null}
        <MensagemErro texto={carga.erro} />
      </Tela>
    );
  }
  const responsavel = p.participacao.papel === 'responsavel';
  const contrato = p.contratos.find((c) => c.situacao === 'enviado') ?? p.contratos.find((c) => c.situacao === 'assinado') ?? null;
  const emitidas = p.equipe.filter((m) => m.credencialId && !m.credencialRevogada).length;
  const livres = carga.dados?.livres ?? [];

  return (
    <Tela titulo={p.participacao.parceiro}>
      <Botao variante="texto" rotulo="Voltar" onPress={onVoltar} />
      <Paragrafo>{`${p.participacao.evento.nome} · você é ${papeisPorExtenso([p.participacao.papel ?? 'equipe']).toLowerCase()}`}</Paragrafo>
      <MensagemErro texto={erro} />
      <MensagemErro texto={aviso} tom="info" />

      <Secao titulo={p.pendencias.length ? 'O que fazer agora' : 'Tudo pronto'}>
        {p.pendencias.length === 0 ? <Paragrafo>Estande, marca, montagem e contrato estão em ordem.</Paragrafo> : null}
        {p.pendencias.map((t, i) => <Text key={t} style={[estilos.item, { color: cores.ink900 }]}>{`${i + 1}. ${t}`}</Text>)}
      </Secao>

      <Secao titulo="Estandes e nível">
        <Cartao
          titulo={p.resumo.nivel ? `Nível ${p.resumo.nivel}` : 'Ainda sem nível'}
          linhas={[
            p.resumo.estandes ? `${p.resumo.estandes} ${p.resumo.estandes === 1 ? 'estande vendido' : 'estandes vendidos'}, ${p.resumo.areaM2} m², ${reais(p.resumo.investimentoCentavos)}.` : 'O nível é calculado pelos estandes vendidos, depois do contrato assinado.',
            p.resumo.proximoNivel ? `Faltam ${reais(p.resumo.proximoNivel.faltamCentavos)} em estandes para o nível ${p.resumo.proximoNivel.nome}.` : null,
          ]}
        />
        {p.estandes.map((e) => (
          <Cartao key={e.id} titulo={`Estande ${e.codigo}`} linhas={[e.tipo, SITUACAO_ESTANDE[e.situacao] ?? e.situacao, e.situacao === 'reservado' && e.reservadoAte ? `Reserva vale até ${ate(e.reservadoAte)}. Sem contrato assinado, o estande volta a ficar livre.` : null, e.valorCentavos !== null ? reais(e.valorCentavos) : null]}>
            {responsavel && e.situacao === 'reservado' ? (
              <Botao variante="texto" rotulo={`Desistir do estande ${e.codigo}`} carregando={ocupado === e.id} onPress={() => void fazer(e.id, () => api.liberar(id, e.id), `Você desistiu do estande ${e.codigo}.`)} />
            ) : null}
          </Cartao>
        ))}
        {responsavel && !escolhendo ? <Botao variante="secundario" rotulo="Escolher estande" onPress={() => setEscolhendo(true)} /> : null}
        {escolhendo ? (
          <>
            <Paragrafo secundario>{livres.length ? 'Estandes livres agora. A reserva vale 48 horas.' : 'Nenhum estande livre no momento.'}</Paragrafo>
            {livres.map((e) => (
              <Cartao key={e.id} titulo={`Estande ${e.codigo}`} linhas={[`${e.tipo} · ${e.larguraM} × ${e.profundidadeM} m`, reais(e.precoCentavos)]}>
                <Botao rotulo={`Reservar o estande ${e.codigo}`} rotuloCarregando="Reservando…" carregando={ocupado === e.id} onPress={() => void fazer(e.id, () => api.reservar(id, e.id), `Estande ${e.codigo} reservado para você por 48 horas.`)} />
              </Cartao>
            ))}
            <Botao variante="texto" rotulo="Fechar a lista de estandes" onPress={() => setEscolhendo(false)} />
          </>
        ) : null}
      </Secao>

      <Secao titulo="Contrato">
        {!contrato ? <Paragrafo>A organização ainda não enviou o contrato.</Paragrafo> : null}
        {contrato ? (
          <Cartao titulo={contrato.situacao === 'assinado' ? 'Contrato assinado' : 'Contrato aguardando assinatura'} linhas={[reais(contrato.valorCentavos), contrato.via === 'aceite_no_app' ? null : 'A assinatura deste contrato é feita fora do app; a organização registra aqui.']}>
            <Botao variante="texto" rotulo={abrirTexto ? 'Esconder o texto do contrato' : 'Ler o contrato'} onPress={() => setAbrirTexto((v) => !v)} />
            {abrirTexto ? <Text style={[estilos.contrato, { color: cores.ink900 }]}>{contrato.corpo}</Text> : null}
            {responsavel && contrato.situacao === 'enviado' && contrato.via === 'aceite_no_app' ? (
              <>
                <CaixaMarcar rotulo="Li o contrato e concordo" marcado={li} onMudar={setLi} />
                <Botao rotulo="Assinar" rotuloCarregando="Assinando…" desabilitado={!li} carregando={ocupado === contrato.id} onPress={() => void fazer(contrato.id, () => api.assinar(contrato.id), 'Contrato assinado. Seus estandes reservados agora são seus.')} />
              </>
            ) : null}
          </Cartao>
        ) : null}
      </Secao>

      <Secao titulo="Equipe e credenciais">
        <Paragrafo>{p.resumo.credenciaisDireito ? `${p.resumo.credenciaisDireito} ${p.resumo.credenciaisDireito === 1 ? 'credencial' : 'credenciais'}, ${emitidas} ${emitidas === 1 ? 'usada' : 'usadas'}.` : 'As credenciais são liberadas quando o contrato for assinado.'}</Paragrafo>
        {p.equipe.map((m) => (
          <Cartao key={m.pessoaId} titulo={m.nome} linhas={[papeisPorExtenso([m.papel]), m.credencialId && !m.credencialRevogada ? 'Credencial emitida.' : 'Sem credencial.']}>
            {responsavel && !(m.credencialId && !m.credencialRevogada) ? (
              <Botao variante="secundario" rotulo={`Emitir credencial de ${m.nome}`} carregando={ocupado === m.pessoaId} onPress={() => void fazer(m.pessoaId, () => api.emitirCredencial(id, m.pessoaId), `Credencial de ${m.nome} emitida. O QR aparece no app dela.`)} />
            ) : null}
          </Cartao>
        ))}
      </Secao>

      <Secao titulo="Marca, serviços e montagem">
        <Cartao titulo="Marca no app" linhas={[p.perfil ? `${p.perfil.nomeExibicao} · ${p.perfil.publicado ? 'publicada' : 'ainda não publicada'}` : 'Ainda não montada.']} />
        <Cartao titulo="Montagem" linhas={[p.montagem ? `${TIPO_MONTAGEM[p.montagem.tipo] ?? p.montagem.tipo}: ${SITUACAO_MONTAGEM[p.montagem.situacao] ?? p.montagem.situacao}.` : 'Ainda não informada.', p.montagem?.observacao ? `Observação da organização: ${p.montagem.observacao}` : null]} />
        {p.pedidos.map((s) => <Cartao key={s.id} titulo={s.servico} linhas={[`${s.quantidade} ${s.unidade} · ${reais(s.valorCentavos)} · ${s.situacao}`]} />)}
        <Paragrafo secundario>Para editar a marca, pedir serviços e enviar o projeto de montagem, use a área web.</Paragrafo>
      </Secao>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  item: { fontSize: 18, lineHeight: 26 },
  contrato: { fontSize: 16, lineHeight: 24 },
});

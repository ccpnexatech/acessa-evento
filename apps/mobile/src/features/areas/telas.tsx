/**
 * Troca de visão por papel: a mesma pessoa pode ser congressista, equipe,
 * organizadora e expositora. "Minhas áreas" mostra só o que ela tem, com o que
 * fazer em cada uma. Também: "Chegou o dia" e "Minhas credenciais".
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { espaco, raio } from '@acessa-evento/tokens';
import { useCarga } from '../../shared/hooks/useCarga';
import { DesenhoQr } from '../../shared/qr/DesenhoQr';
import { useTema } from '../../shared/tema/TemaProvider';
import { Botao, MensagemErro, Paragrafo, Tela } from '../../shared/ui/componentes';
import { Xilo } from '../../shared/xilo/Xilo';
import { NOME_DA_CATEGORIA } from '../acessos/leitor';
import { papeisPorExtenso, periodo, podeLer } from './api';
import type { ApiAreas, Aviso, Convite } from './api';

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  const { cores } = useTema();
  return (
    <View style={estilos.secao}>
      <Text accessibilityRole="header" style={[estilos.secaoTitulo, { color: cores.ink900 }]}>{titulo}</Text>
      {children}
    </View>
  );
}

export function Cartao({ titulo, linhas, tom = 'neutro', children }: { titulo: string; linhas?: readonly (string | null | undefined)[]; tom?: 'neutro' | 'atencao'; children?: ReactNode }) {
  const { cores } = useTema();
  const atencao = tom === 'atencao';
  return (
    <View style={[estilos.cartao, { backgroundColor: atencao ? cores.warning100 : cores.surface100, borderColor: atencao ? cores.warning700 : cores.borderHairline }]}>
      <Text style={[estilos.cartaoTitulo, { color: atencao ? cores.warning700 : cores.ink900 }]}>{titulo}</Text>
      {(linhas ?? []).filter(Boolean).map((l) => <Text key={l} style={[estilos.linha, { color: cores.ink900 }]}>{l}</Text>)}
      {children}
    </View>
  );
}

export function Carregando({ rotulo }: { rotulo: string }) {
  return <ActivityIndicator accessibilityLabel={rotulo} />;
}

const tituloDoConvite = (c: Convite): string => (c.parceiro ? `${c.parceiro}, no ${c.evento ?? 'evento'}` : c.evento ?? c.organizacao);

interface PropsAreas {
  readonly api: ApiAreas;
  readonly onHoje: (slug: string) => void;
  readonly onLeitor: (slug: string) => void;
  readonly onPortal: (id: string) => void;
  readonly onCredenciais: () => void;
  readonly onVoltar: () => void;
}

export function TelaAreas({ api, onHoje, onLeitor, onPortal, onCredenciais, onVoltar }: PropsAreas) {
  const carga = useCarga(async () => {
    const [inicio, participacoes, credenciais] = await Promise.all([api.inicio(), api.participacoes(), api.credenciais()]);
    return { inicio, participacoes, credenciais };
  }, [api]);
  const [erro, setErro] = useState<string | null>(null);
  const [aceitando, setAceitando] = useState<string | null>(null);
  const aceitar = async (id: string) => {
    setAceitando(id);
    setErro(null);
    try {
      await api.aceitarConvite(id);
      carga.recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível aceitar o convite.');
    } finally {
      setAceitando(null);
    }
  };
  const d = carga.dados;
  const vazio = d && d.inicio.eventos.length === 0 && d.inicio.convites.length === 0 && d.participacoes.length === 0 && d.credenciais.length === 0;
  return (
    <Tela titulo="Minhas áreas">
      <Botao variante="texto" rotulo="Voltar" onPress={onVoltar} />
      {carga.carregando && !d ? <Carregando rotulo="Carregando suas áreas" /> : null}
      <MensagemErro texto={carga.erro ?? erro} />
      {carga.erro ? <Botao variante="secundario" rotulo="Tentar de novo" onPress={carga.recarregar} /> : null}
      {d?.inicio.convites.length ? (
        <Secao titulo="Convites">
          {d.inicio.convites.map((c) => (
            <Cartao key={c.id} tom="atencao" titulo={`Você foi convidado para a equipe: ${tituloDoConvite(c)}`} linhas={[`Papéis: ${papeisPorExtenso(c.papeis)}.`]}>
              <Botao rotulo={`Aceitar convite de ${tituloDoConvite(c)}`} rotuloCarregando="Aceitando…" carregando={aceitando === c.id} onPress={() => void aceitar(c.id)} />
            </Cartao>
          ))}
        </Secao>
      ) : null}
      {d?.inicio.eventos.length ? (
        <Secao titulo="Eventos em que você trabalha">
          {d.inicio.eventos.map((e) => (
            <Cartao key={e.slug} titulo={e.nome} linhas={[periodo(e.inicio, e.fim), `Seus papéis: ${papeisPorExtenso(e.papeis)}.`, e.demonstracao ? 'Evento de demonstração.' : e.publicado ? null : 'Ainda em rascunho.']}>
              <Botao rotulo={`Chegou o dia: ${e.nome}`} onPress={() => onHoje(e.slug)} />
              {podeLer(e.papeis) ? <Botao variante="secundario" rotulo={`Usar este celular como leitor: ${e.nome}`} onPress={() => onLeitor(e.slug)} /> : null}
            </Cartao>
          ))}
        </Secao>
      ) : null}
      {d?.participacoes.length ? (
        <Secao titulo="Como expositor ou parceiro">
          {d.participacoes.map((p) => (
            <Cartao key={p.id} titulo={p.parceiro} linhas={[p.evento.nome, p.papel ? `Você é ${papeisPorExtenso([p.papel]).toLowerCase()}.` : null]}>
              <Botao rotulo={`Abrir o espaço de ${p.parceiro}`} onPress={() => onPortal(p.id)} />
            </Cartao>
          ))}
        </Secao>
      ) : null}
      {d?.credenciais.length ? (
        <Secao titulo="Suas credenciais">
          <Paragrafo>{d.credenciais.length === 1 ? 'Você tem 1 credencial.' : `Você tem ${d.credenciais.length} credenciais.`}</Paragrafo>
          <Botao variante="secundario" rotulo="Ver credenciais e QR" onPress={onCredenciais} />
        </Secao>
      ) : null}
      {vazio ? <View style={estilos.qr}><Xilo nome="nadaPorAqui" largura={200} decorativa /></View> : null}
      {vazio ? (
        <Paragrafo>Você ainda não faz parte da equipe de nenhum evento. Quando alguém convidar o seu e-mail, o convite aparece aqui.</Paragrafo>
      ) : null}
    </Tela>
  );
}

const hora = (iso: string) => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Fortaleza' }).format(new Date(iso));

/** "Chegou o dia": o que pede atenção primeiro, depois as entradas registradas por ponto. Nunca chama o número de lotação. */
export function TelaHoje({ api, slug, onLeitor, onVoltar }: { api: ApiAreas; slug: string; onLeitor?: () => void; onVoltar: () => void }) {
  const carga = useCarga(() => api.hoje(slug), [api, slug]);
  const h = carga.dados;
  const atencao = h?.pontos.filter((p) => p.atencao) ?? [];
  return (
    <Tela titulo="Chegou o dia" rodape={onLeitor ? <Botao rotulo="Usar este celular como leitor" onPress={onLeitor} /> : undefined}>
      <Botao variante="texto" rotulo="Voltar" onPress={onVoltar} />
      {carga.carregando && !h ? <Carregando rotulo="Carregando as entradas" /> : null}
      <MensagemErro texto={carga.erro} />
      {h ? (
        <>
          <Cartao
            titulo={h.numeros.entradas === 1 ? '1 entrada registrada' : `${h.numeros.entradas} entradas registradas`}
            linhas={[
              `${h.numeros.credenciais} credenciais válidas, ${h.numeros.inscritos} inscritos.`,
              h.numeros.leiturasNegadas ? `${h.numeros.leiturasNegadas} ${h.numeros.leiturasNegadas === 1 ? 'leitura barrada' : 'leituras barradas'}.` : null,
              'Conta quem passou pela entrada, não quem está no local agora.',
            ]}
          />
          <Secao titulo={atencao.length ? 'Pede atenção' : 'Tudo em ordem'}>
            {atencao.length === 0 ? <View style={estilos.qr}><Xilo nome="tudoPronto" largura={160} decorativa /></View> : null}
            {atencao.length === 0 ? <Paragrafo>Nenhum ponto de leitura precisa de você agora.</Paragrafo> : null}
            {atencao.map((p) => <Cartao key={p.id} tom="atencao" titulo={p.nome} linhas={[p.atencao]} />)}
          </Secao>
          <Secao titulo="Pontos de leitura">
            {h.pontos.length === 0 ? <Paragrafo>Nenhum ponto criado ainda. Crie em "Pontos de leitura", na área web.</Paragrafo> : null}
            {h.pontos.map((p) => (
              <Cartao
                key={p.id}
                titulo={p.nome}
                linhas={[
                  p.zona ?? 'Entrada do evento',
                  p.ativo ? `${p.entradas} ${p.entradas === 1 ? 'entrada' : 'entradas'}${p.saidas ? `, ${p.saidas} ${p.saidas === 1 ? 'saída' : 'saídas'}` : ''}${p.negadas ? `, ${p.negadas} ${p.negadas === 1 ? 'barrada' : 'barradas'}` : ''}.` : 'Ponto desligado.',
                  p.ultimaLeituraEm ? `Última leitura às ${hora(p.ultimaLeituraEm)}.` : null,
                ]}
              />
            ))}
          </Secao>
          <Paragrafo secundario>{`Atualizado às ${hora(h.geradoEm)}.`}</Paragrafo>
          <Botao variante="secundario" rotulo="Atualizar" onPress={carga.recarregar} />
        </>
      ) : null}
    </Tela>
  );
}

/** Credenciais da pessoa, cada uma com o QR que funciona sem internet, e os avisos da organização. */
export function TelaCredenciais({ api, onVoltar }: { api: ApiAreas; onVoltar: () => void }) {
  const { width } = useWindowDimensions();
  const carga = useCarga(async () => {
    const credenciais = await api.credenciais();
    const eventos = [...new Set(credenciais.filter((c) => !c.revogada).map((c) => c.evento.slug))];
    // Aviso é cortesia: se falhar, o QR aparece do mesmo jeito.
    const avisos = (await Promise.all(eventos.map((slug) => api.avisos(slug).catch((): Aviso[] => [])))).flat();
    return { credenciais, avisos };
  }, [api]);
  const d = carga.dados;
  const lado = Math.min(width - espaco['8'] * 2, 300);
  return (
    <Tela titulo="Minhas credenciais">
      <Botao variante="texto" rotulo="Voltar" onPress={onVoltar} />
      {carga.carregando && !d ? <Carregando rotulo="Carregando suas credenciais" /> : null}
      <MensagemErro texto={carga.erro} />
      {d?.avisos.length ? (
        <Secao titulo="Avisos">
          {d.avisos.map((a) => <Cartao key={a.id} tom={a.urgente ? 'atencao' : 'neutro'} titulo={a.urgente ? `Urgente: ${a.titulo}` : a.titulo} linhas={[a.corpo]} />)}
        </Secao>
      ) : null}
      {d?.credenciais.length === 0 ? <Paragrafo>Você ainda não tem credencial em nenhum evento.</Paragrafo> : null}
      {d?.credenciais.map((c) => {
        const categoria = NOME_DA_CATEGORIA[c.categoria] ?? c.categoria;
        return (
          <Cartao key={c.id} titulo={`${categoria}${c.parceiro ? ` · ${c.parceiro}` : ''}`} linhas={[c.evento.nome, `${periodo(c.evento.inicio, c.evento.fim)} · ${c.evento.local}`, c.revogada ? 'Credencial cancelada. Procure a organização.' : 'Mostre este QR na entrada. Funciona sem internet.']}>
            {c.qr ? <View style={estilos.qr}><DesenhoQr valor={c.qr} tamanho={lado} rotulo={`QR da credencial de ${categoria} no ${c.evento.nome}. Mostre na entrada.`} /></View> : null}
          </Cartao>
        );
      })}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  secao: { gap: espaco['3'] },
  secaoTitulo: { fontSize: 22, lineHeight: 30, fontWeight: '700' },
  cartao: { padding: espaco['4'], borderRadius: raio.lg, borderWidth: 1, gap: espaco['2'] },
  cartaoTitulo: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  linha: { fontSize: 18, lineHeight: 26 },
  qr: { alignItems: 'center', paddingVertical: espaco['2'] },
});

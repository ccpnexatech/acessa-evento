/**
 * Telas do acesso sem senha (prototipo: 1 Entrar, 2 Código, 3 Primeiro acesso).
 * Cada tela recebe callbacks; quem decide o próximo passo é o FluxoAcesso.
 */
import { useState } from 'react';
import { Botao, CaixaMarcar, CampoTexto, MensagemErro, Paragrafo, Tela } from '../../shared/ui/componentes';
import { ErroApi } from '../../shared/api/cliente';

const mensagem = (e: unknown): string => (e instanceof ErroApi ? e.message : 'Algo deu errado. Tente de novo.');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/;

export function TelaEntrar({ onPedirCodigo }: { onPedirCodigo: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    const limpo = email.trim();
    if (!EMAIL.test(limpo)) {
      setErro('Confira o e-mail. Ele precisa ter @ e um domínio, como nome@exemplo.com.br.');
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await onPedirCodigo(limpo);
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Tela
      titulo="Entre para ver seu ingresso e a agenda"
      rodape={<Botao rotulo="Receber código" rotuloCarregando="Enviando…" carregando={enviando} onPress={enviar} />}
    >
      <Paragrafo secundario>Use o e-mail da sua inscrição. Vamos enviar um código de 6 números. Não precisa de senha.</Paragrafo>
      <CampoTexto
        rotulo="E-mail"
        dica="O mesmo e-mail usado na inscrição"
        erro={erro}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={enviar}
        placeholder="voce@exemplo.com.br"
      />
      <Paragrafo secundario>Primeira vez aqui? É o mesmo caminho: o código cria a sua conta.</Paragrafo>
    </Tela>
  );
}

interface PropsCodigo {
  readonly email: string;
  readonly onEntrar: (codigo: string) => Promise<void>;
  readonly onReenviar: () => Promise<void>;
  readonly onVoltar: () => void;
}

export function TelaCodigo({ email, onEntrar, onReenviar, onVoltar }: PropsCodigo) {
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const entrar = async () => {
    if (!/^\d{6}$/.test(codigo)) {
      setErro('Código inválido. Confira os 6 números do e-mail.');
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await onEntrar(codigo);
    } catch (e) {
      setErro(mensagem(e));
      setCodigo('');
    } finally {
      setEnviando(false);
    }
  };

  const reenviar = async () => {
    setErro(null);
    try {
      await onReenviar();
      setAviso('Enviamos um novo código.');
    } catch (e) {
      setErro(mensagem(e));
    }
  };

  return (
    <Tela titulo="Digite o código" rodape={<Botao rotulo="Entrar" rotuloCarregando="Entrando…" carregando={enviando} onPress={entrar} />}>
      <Botao variante="texto" rotulo="Voltar e trocar o e-mail" onPress={onVoltar} />
      <Paragrafo secundario>{`Enviamos 6 números para ${email}. O código vale por 10 minutos.`}</Paragrafo>
      <CampoTexto
        rotulo="Código de 6 números"
        dica="Confira também a caixa de spam"
        erro={erro}
        grande
        value={codigo}
        onChangeText={(t) => setCodigo(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        onSubmitEditing={entrar}
      />
      <Botao variante="texto" rotulo="Enviar outro código" onPress={reenviar} />
      <MensagemErro texto={aviso} tom="info" />
    </Tela>
  );
}

interface PropsPrimeiroAcesso {
  readonly nomeInicial: string;
  readonly onConcluir: (dados: { nomeCracha: string; aceitaTermos: boolean }) => Promise<void>;
}

export function TelaPrimeiroAcesso({ nomeInicial, onConcluir }: PropsPrimeiroAcesso) {
  const [nome, setNome] = useState(nomeInicial);
  const [aceite, setAceite] = useState(false);
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [erroAceite, setErroAceite] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const concluir = async () => {
    const limpo = nome.trim();
    const nomeOk = limpo.length >= 3 && limpo.length <= 60;
    setErroNome(nomeOk ? null : 'Escreva o nome do crachá com 3 a 60 letras.');
    setErroAceite(aceite ? null : 'Para continuar, aceite os termos.');
    if (!nomeOk || !aceite) return;
    setErroGeral(null);
    setEnviando(true);
    try {
      await onConcluir({ nomeCracha: limpo, aceitaTermos: true });
    } catch (e) {
      setErroGeral(mensagem(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Tela titulo="Boas-vindas" rodape={<Botao rotulo="Continuar" rotuloCarregando="Salvando…" carregando={enviando} onPress={concluir} />}>
      <Paragrafo secundario>Falta só confirmar duas coisas. Você pode mudar tudo depois em Ajuda.</Paragrafo>
      <CampoTexto rotulo="Nome no crachá" dica="Como você quer ser chamado no evento" erro={erroNome} value={nome} onChangeText={setNome} autoComplete="name" textContentType="name" />
      <CaixaMarcar
        rotulo="Li e aceito os Termos de uso e a Política de privacidade"
        marcado={aceite}
        onMudar={setAceite}
        erro={erroAceite}
      />
      <Paragrafo secundario>Você pode baixar ou apagar seus dados a qualquer momento, em Ajuda.</Paragrafo>
      <MensagemErro texto={erroGeral} />
    </Tela>
  );
}

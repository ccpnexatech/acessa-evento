import type { Assistente } from './modelo';

export const ASSISTENTE: Assistente = {
  versao: 1,
  publicadoEm: '2026-11-01T00:00:00Z',
  canais: [
    { tipo: 'balcao', rotulo: 'Balcão de informações', valor: 'Ao lado da entrada principal' },
    { tipo: 'email', rotulo: 'E-mail da organização', valor: 'contato@exemplo.com.br' },
    { tipo: 'whatsapp', rotulo: 'WhatsApp', valor: '+55 85 90000-0000' },
  ],
  grafo: {
    inicio: 'inicio',
    nos: {
      inicio: { tipo: 'pergunta', texto: 'Sobre o que é a sua dúvida?', opcoes: [{ rotulo: 'Acessibilidade', destino: 'acessibilidade' }, { rotulo: 'Certificado', destino: 'r-certificado' }] },
      acessibilidade: { tipo: 'pergunta', texto: 'Qual recurso você procura?', opcoes: [{ rotulo: 'Intérprete de Libras', destino: 'r-libras' }, { rotulo: 'Audiodescrição', destino: 'r-audio' }] },
      'r-libras': { tipo: 'resposta', titulo: 'Intérprete de Libras', texto: 'Lugares reservados perto do intérprete.', revisadaEm: '2026-11-01' },
      'r-audio': { tipo: 'resposta', titulo: 'Audiodescrição', texto: 'Retire o fone no balcão.', revisadaEm: '2026-11-01' },
      'r-certificado': { tipo: 'resposta', titulo: 'Certificado', texto: 'Enviado por e-mail.', revisadaEm: '2026-11-01' },
    },
  },
};

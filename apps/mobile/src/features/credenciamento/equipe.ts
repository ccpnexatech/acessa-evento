/** Eventos em que a pessoa é da equipe; guardado no aparelho para a Ajuda abrir offline. */
import type { Requisitor } from '../../shared/api/cliente';
import { lerJson } from '../../shared/armazenamento/cofre';
import type { Cofre } from '../../shared/armazenamento/cofre';

export interface EventoEquipe {
  readonly slug: string;
  readonly nome: string;
}

const CHAVE = 'equipe-eventos';

export async function eventosDaEquipe(requisitar: Requisitor, cofre: Cofre): Promise<EventoEquipe[]> {
  try {
    const r = await requisitar<{ eventos: EventoEquipe[] }>('GET', '/credenciamento/eventos');
    const eventos = r.dados?.eventos ?? [];
    await cofre.gravar(CHAVE, JSON.stringify(eventos));
    return eventos;
  } catch {
    return (await lerJson<EventoEquipe[]>(cofre, CHAVE)) ?? [];
  }
}

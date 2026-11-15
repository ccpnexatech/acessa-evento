/**
 * Rotas dos cadastros simples do organizador. Cada cadastro do catálogo ganha
 * as mesmas quatro rotas, sob o evento (pelo slug) ou sob a organização (pelo id).
 */
import type { Roteador } from '../../../../shared/http/roteador.ts';
import { PRIVADO, param, traduzirDominio } from '../../../../shared/http/dominio.ts';
import type { CadastrosServico } from '../../application/cadastros.ts';
import { NOMES_CADASTRO, cadastro } from '../../domain/catalogo.ts';
import type { Identificacao } from '../../../programacao/adapters/http/rotas-programacao.ts';

export function registrarRotasCadastros(roteador: Roteador, servico: CadastrosServico, id: Identificacao): void {
  for (const nome of NOMES_CADASTRO) {
    const { escopo, sem = [] } = cadastro(nome);
    const chave = escopo === 'evento' ? 'slug' : 'organizacaoId';
    const base = escopo === 'evento' ? `/organizador/eventos/:slug/${nome}` : `/organizador/organizacoes/:organizacaoId/${nome}`;
    roteador
      .registrar('GET', base, traduzirDominio(async (req) => {
        const { pessoaId } = await id.exigir(req);
        return { status: 200, cabecalhos: PRIVADO, corpo: { itens: await servico.listar(pessoaId, nome, param(req, chave)) } };
      }))
      .registrar('POST', base, traduzirDominio(async (req) => {
        const { pessoaId } = await id.exigir(req);
        return { status: 201, cabecalhos: PRIVADO, corpo: await servico.criar(pessoaId, nome, param(req, chave), req.corpo) };
      }));
    if (!sem.includes('alterar')) {
      roteador.registrar('PATCH', `${base}/:id`, traduzirDominio(async (req) => {
        const { pessoaId } = await id.exigir(req);
        return { status: 200, cabecalhos: PRIVADO, corpo: await servico.alterar(pessoaId, nome, param(req, chave), param(req, 'id'), req.corpo) };
      }));
    }
    if (!sem.includes('apagar')) {
      roteador.registrar('DELETE', `${base}/:id`, traduzirDominio(async (req) => {
        const { pessoaId } = await id.exigir(req);
        await servico.apagar(pessoaId, nome, param(req, chave), param(req, 'id'));
        return { status: 204 };
      }));
    }
  }
}

-- Inscrições do COCAL 2026 para desenvolvimento e demonstração. Preços e vagas de EXEMPLO.
-- "Um dia" nasce esgotado para mostrar o estado na tela. Idempotente.

update evento set
  descricao = 'Congresso de turismo e eventos do Nordeste. Três dias de palestras, oficinas e feira de negócios.',
  inscricoes_abertas = true,
  recursos_oferecidos = '{libras,legenda,audiodescricao,acesso_sem_degraus}'
where slug = 'cocal-2026';

with ev as (select id from evento where slug = 'cocal-2026')
insert into tipo_ingresso (evento_id, nome, descricao, preco_centavos, vagas, ocupadas, ordem)
select ev.id, t.nome, t.descricao, t.preco, t.vagas, t.ocupadas, t.ordem from ev, (values
  ('Congressista', 'Os três dias, todas as palestras e a feira.', 45000, 500, 0, 1),
  ('Estudante', 'Os três dias, com comprovante na entrada.', 18000, 200, 0, 2),
  ('Um dia', 'Um dia à escolha, palestras e feira.', 12000, 50, 50, 3)
) as t (nome, descricao, preco, vagas, ocupadas, ordem)
on conflict (evento_id, nome) do nothing;

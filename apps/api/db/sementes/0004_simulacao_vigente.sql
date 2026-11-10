-- Evento de SIMULAÇÃO, vigente em novembro e dezembro de 2026, para testar
-- inscrição, QR e credenciamento "ao vivo" (o COCAL 2026 de exemplo já passou
-- e o QR dele vence 2 dias depois do fim). Tudo fictício. Idempotente.
--
-- As sessões são criadas para hoje, amanhã e depois de amanhã (no fuso de
-- Fortaleza) no dia em que a semente roda; `npm run dev -- --resetar` recria
-- com as datas do dia.

insert into evento (slug, nome, inicio, fim, local, fuso, publicado, tema, descricao, inscricoes_abertas, recursos_oferecidos)
values (
  'simulacao-2026',
  'Simulação Acessa Evento',
  '2026-11-01',
  '2026-12-31',
  'Espaço de testes, Fortaleza',
  'America/Fortaleza',
  true,
  '{"cor_primaria": "#0a5c69", "cor_destaque": "#f2b23a", "fonte": "Lexend", "arredondamento": "medio", "logo_url": null}'::jsonb,
  'Evento fictício para simular inscrição, ingresso e credenciamento. Nenhum dinheiro é cobrado.',
  true,
  '{libras,legenda,audiodescricao,acesso_sem_degraus}'
)
on conflict (slug) do nothing;

with ev as (select id from evento where slug = 'simulacao-2026')
insert into tipo_ingresso (evento_id, nome, descricao, preco_centavos, vagas, ocupadas, ordem)
select ev.id, t.nome, t.descricao, t.preco, t.vagas, t.ocupadas, t.ordem from ev, (values
  ('Participante', 'Acesso a todas as sessões da simulação.', 1000, 1000, 0, 1),
  ('Cortesia', 'Ingresso sem custo, para testar o Pix de valor zero.', 0, 1000, 0, 2),
  ('Lote esgotado', 'Mostra como aparece um ingresso esgotado.', 5000, 10, 10, 3)
) as t (nome, descricao, preco, vagas, ocupadas, ordem)
on conflict (evento_id, nome) do nothing;

with ev as (select id from evento where slug = 'simulacao-2026')
insert into sala (evento_id, nome, local, acessibilidade)
select ev.id, s.nome, s.local, s.acessibilidade from ev, (values
  ('Auditório', 'Térreo', 'Entrada sem degraus. Lugares reservados perto do intérprete de Libras.'),
  ('Sala de oficinas', '1º andar', 'Elevador ao lado da recepção. Fones de audiodescrição no balcão.')
) as s (nome, local, acessibilidade)
on conflict (evento_id, nome) do nothing;

with ev as (select id from evento where slug = 'simulacao-2026'),
     hoje as (select (now() at time zone 'America/Fortaleza')::date as d)
insert into atividade (evento_id, sala_id, titulo, resumo, inicio, fim, recursos)
select ev.id, (select id from sala where evento_id = ev.id and nome = a.sala), a.titulo, a.resumo,
       ((hoje.d + a.dia) + a.de) at time zone 'America/Fortaleza',
       ((hoje.d + a.dia) + a.ate) at time zone 'America/Fortaleza',
       a.recursos::text[]
from ev, hoje, (values
  ('Auditório', 'Boas-vindas da simulação', 'Como testar inscrição, ingresso e entrada pelo app.', 0, time '08:00', time '12:00', '{libras,legenda}'),
  ('Sala de oficinas', 'Oficina: check-in sem internet', 'Leia QRs em modo avião e veja a fila subir quando a conexão volta.', 0, time '13:00', time '18:00', '{audiodescricao}'),
  ('Auditório', 'Roda de conversa: acessibilidade na entrada', 'O que a equipe precisa saber antes de o público chegar.', 1, time '09:00', time '11:00', '{libras}'),
  ('Sala de oficinas', 'Prática: busca pelo nome e check-in manual', 'Quando o participante não consegue mostrar o QR.', 2, time '14:00', time '16:00', '{}')
) as a (sala, titulo, resumo, dia, de, ate, recursos)
where not exists (select 1 from atividade x where x.evento_id = ev.id and x.titulo = a.titulo);

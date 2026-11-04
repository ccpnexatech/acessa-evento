-- Programação de EXEMPLO do COCAL 2026, para desenvolvimento e demonstração.
-- Títulos, nomes e salas são fictícios até a organização enviar a grade real.
-- Idempotente: rodar de novo não duplica nada.

with ev as (select id from evento where slug = 'cocal-2026')
insert into sala (evento_id, nome, local, acessibilidade)
select ev.id, s.nome, s.local, s.acessibilidade from ev, (values
  ('Auditório 1', 'Pavilhão Oeste, 1º andar', 'Elevador ao lado da escada principal. Fileiras A e B reservadas perto do intérprete de Libras.'),
  ('Sala 2', 'Pavilhão Oeste, térreo', 'Entrada sem degraus pelo corredor central.'),
  ('Sala 4', 'Pavilhão Leste, térreo', 'Entrada sem degraus. Fones de audiodescrição no balcão da sala.')
) as s (nome, local, acessibilidade)
on conflict (evento_id, nome) do nothing;

with ev as (select id from evento where slug = 'cocal-2026')
insert into palestrante (evento_id, nome, cargo)
select ev.id, p.nome, p.cargo from ev, (values
  ('Ana Ribeiro', 'Pesquisadora de turismo de eventos (exemplo)'),
  ('Bruno Maia', 'Gestor de centros de convenções (exemplo)'),
  ('Carla Nunes', 'Consultora de acessibilidade (exemplo)'),
  ('Diego Lopes', 'Produtor de eventos corporativos (exemplo)')
) as p (nome, cargo)
where not exists (select 1 from palestrante x where x.evento_id = ev.id and x.nome = p.nome);

with ev as (select id from evento where slug = 'cocal-2026')
insert into atividade (evento_id, sala_id, titulo, resumo, inicio, fim, recursos)
select ev.id, (select id from sala where evento_id = ev.id and nome = a.sala), a.titulo, a.resumo,
       a.inicio::timestamptz, a.fim::timestamptz, a.recursos::text[]
from ev, (values
  ('Auditório 1', 'Abertura: eventos como motor do desenvolvimento', 'Panorama do setor de eventos no Nordeste e o que esperar destes três dias.', '2026-07-01 09:00-03', '2026-07-01 10:00-03', '{libras,legenda}'),
  ('Sala 4', 'Turismo de eventos no Nordeste', 'Dados de ocupação, sazonalidade e o papel dos centros de convenções.', '2026-07-01 10:30-03', '2026-07-01 11:15-03', '{audiodescricao}'),
  ('Sala 2', 'Mesa: evento acessível do convite ao check-in', 'Como planejar acessibilidade em cada etapa da jornada do participante.', '2026-07-01 11:30-03', '2026-07-01 12:30-03', '{libras}'),
  ('Auditório 1', 'Credenciamento sem fila: tecnologia na entrada', 'Experiências de check-in por QR, inclusive sem internet.', '2026-07-02 09:00-03', '2026-07-02 10:00-03', '{libras,legenda,audiodescricao}'),
  ('Sala 4', 'Oficina: comunicação em linguagem simples', 'Prática de escrita para sinalização, e-mails e aplicativos de eventos.', '2026-07-02 14:00-03', '2026-07-02 16:00-03', '{}'),
  ('Auditório 1', 'Encerramento e próximos passos', 'Síntese do congresso e agenda para 2027.', '2026-07-03 16:00-03', '2026-07-03 17:00-03', '{libras,legenda}')
) as a (sala, titulo, resumo, inicio, fim, recursos)
where not exists (select 1 from atividade x where x.evento_id = ev.id and x.titulo = a.titulo);

insert into atividade_palestrante (atividade_id, palestrante_id, ordem)
select a.id, p.id, v.ordem
from (values
  ('Abertura: eventos como motor do desenvolvimento', 'Ana Ribeiro', 1),
  ('Abertura: eventos como motor do desenvolvimento', 'Bruno Maia', 2),
  ('Turismo de eventos no Nordeste', 'Ana Ribeiro', 1),
  ('Mesa: evento acessível do convite ao check-in', 'Carla Nunes', 1),
  ('Mesa: evento acessível do convite ao check-in', 'Diego Lopes', 2),
  ('Credenciamento sem fila: tecnologia na entrada', 'Diego Lopes', 1),
  ('Oficina: comunicação em linguagem simples', 'Carla Nunes', 1),
  ('Encerramento e próximos passos', 'Bruno Maia', 1)
) as v (titulo, nome, ordem)
join evento e on e.slug = 'cocal-2026'
join atividade a on a.evento_id = e.id and a.titulo = v.titulo
join palestrante p on p.evento_id = e.id and p.nome = v.nome
on conflict do nothing;

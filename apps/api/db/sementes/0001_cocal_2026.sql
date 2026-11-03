-- Evento de referência. Idempotente: rodar de novo não duplica nada.
insert into evento (slug, nome, inicio, fim, local, fuso, publicado, tema)
values (
  'cocal-2026',
  'COCAL 2026',
  '2026-07-01',
  '2026-07-03',
  'Centro de Eventos do Ceará, Fortaleza',
  'America/Fortaleza',
  true,
  '{"cor_primaria": "#0a5c69", "cor_destaque": "#f2b23a", "fonte": "Lexend", "arredondamento": "medio", "logo_url": null}'::jsonb
)
on conflict (slug) do nothing;

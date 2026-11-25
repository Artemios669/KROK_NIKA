alter table animals
  add column if not exists coat_details text,
  add column if not exists ear_shape text,
  add column if not exists shelter_story text,
  add column if not exists health_notes text,
  add column if not exists interesting_facts text[] not null default '{}';

alter table public.animal_questions
  add column if not exists source_animal_id text,
  add column if not exists source_animal_name text;

alter table public.adoption_requests
  add column if not exists source_animal_id text,
  add column if not exists source_animal_name text;

create index if not exists animal_questions_source_animal_id_idx
  on public.animal_questions(source_animal_id);

create index if not exists adoption_requests_source_animal_id_idx
  on public.adoption_requests(source_animal_id);

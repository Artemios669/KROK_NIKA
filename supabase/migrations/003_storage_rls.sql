-- Keep public submissions limited to new, pending records.
drop policy if exists "public read available animals" on public.animals;
create policy "public read available animals"
  on public.animals for select to anon, authenticated
  using (adoption_available = true);

drop policy if exists "public create question" on public.animal_questions;
create policy "public create question"
  on public.animal_questions for insert to anon, authenticated
  with check (
    char_length(btrim(question)) between 3 and 1000
    and status = 'pending'
    and answer is null
    and answered_at is null
  );

drop policy if exists "public read answered question" on public.animal_questions;
create policy "public read answered question"
  on public.animal_questions for select to anon, authenticated
  using (status = 'answered');

drop policy if exists "public create adoption request" on public.adoption_requests;
create policy "public create adoption request"
  on public.adoption_requests for insert to anon, authenticated
  with check (
    char_length(btrim(contact_name)) between 2 and 80
    and char_length(contact_email) between 3 and 120
    and request_type in ('adoption', 'guardianship')
    and coalesce(status, 'pending') = 'pending'
  );

drop policy if exists "public create reaction" on public.animal_reactions;
create policy "public create reaction"
  on public.animal_reactions for insert to anon, authenticated
  with check (
    reaction in ('like', 'dislike')
    and char_length(session_id) between 12 and 100
  );

grant select on public.animals to anon, authenticated;
grant select on public.animal_questions to anon, authenticated;
grant insert on public.animal_questions to anon, authenticated;
grant insert on public.adoption_requests to anon, authenticated;
grant insert on public.animal_reactions to anon, authenticated;

update public.adoption_requests
set status='pending'
where status is null;

alter table public.adoption_requests
  alter column status set default 'pending',
  alter column status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname='adoption_requests_status_check'
      and conrelid='public.adoption_requests'::regclass
  ) then
    alter table public.adoption_requests
      add constraint adoption_requests_status_check
      check (status in ('pending','in_progress','approved','rejected'));
  end if;
end;
$$;

grant select, update on public.animal_questions to service_role;
grant select, update on public.adoption_requests to service_role;

-- Rezzies — missing INSERT RLS policies (TYC-138 pilot-blocker fix)
--
-- Several tables had RLS enabled but NO INSERT policy, so the client could
-- never write to them. This blocked the entire onboarding path:
--   • profiles          → sign-up could not create the user's profile row
--   • habit_definitions → Create Program failed when inserting habits
--   • periods           → Create Program failed when inserting monthly periods
--   • monthly_bonuses   → Create Program failed when inserting bonus challenges
-- (programs + participants already had correct INSERT policies; daily_checks +
--  push_tokens too.)
--
-- All policies are idempotent (guarded by pg_policies existence check).

-- profiles: a signed-in user may insert their OWN profile row (id = their uid).
do $$
begin
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='Profiles insertable by self') then
    create policy "Profiles insertable by self" on profiles
      for insert to authenticated
      with check (id = auth.uid());
  end if;
end$$;

-- habit_definitions: only the sponsor of the parent program may add habits.
do $$
begin
  if not exists (select 1 from pg_policies where tablename='habit_definitions' and policyname='Habits insertable by program sponsor') then
    create policy "Habits insertable by program sponsor" on habit_definitions
      for insert to authenticated
      with check (exists (
        select 1 from programs p
        where p.id = habit_definitions.program_id and p.sponsor_id = auth.uid()
      ));
  end if;
end$$;

-- periods: only the sponsor of the parent program may add periods.
do $$
begin
  if not exists (select 1 from pg_policies where tablename='periods' and policyname='Periods insertable by program sponsor') then
    create policy "Periods insertable by program sponsor" on periods
      for insert to authenticated
      with check (exists (
        select 1 from programs p
        where p.id = periods.program_id and p.sponsor_id = auth.uid()
      ));
  end if;
end$$;

-- monthly_bonuses: only the sponsor of the parent program may add bonuses.
do $$
begin
  if not exists (select 1 from pg_policies where tablename='monthly_bonuses' and policyname='Bonuses insertable by program sponsor') then
    create policy "Bonuses insertable by program sponsor" on monthly_bonuses
      for insert to authenticated
      with check (exists (
        select 1 from programs p
        where p.id = monthly_bonuses.program_id and p.sponsor_id = auth.uid()
      ));
  end if;
end$$;

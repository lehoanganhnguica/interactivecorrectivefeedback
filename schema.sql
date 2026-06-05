-- Writing Feedback Cloud schema for Supabase.
-- Run this in the Supabase SQL editor before deploying account mode.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  account_role text not null default 'teacher' check (account_role in ('teacher', 'student')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists account_role text not null default 'teacher';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_account_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_account_role_check check (account_role in ('teacher', 'student'));
  end if;
end;
$$;

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  color text not null default '#2563eb',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.papers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  collection_id uuid references public.collections(id) on delete set null,
  title text not null default 'Untitled marked paper',
  student_name text not null default '',
  status text not null default 'draft' check (status in ('draft', 'review', 'completed')),
  word_count integer not null default 0 check (word_count >= 0),
  session_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid references auth.users(id) on delete set null,
  student_email text not null,
  student_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.paper_shares (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  teacher_email text not null default '',
  class_id uuid references public.classes(id) on delete set null,
  class_name text not null default '',
  student_id uuid references auth.users(id) on delete set null,
  student_email text not null,
  student_name text not null default '',
  paper_title text not null default 'Shared marked paper',
  paper_status text not null default 'draft',
  word_count integer not null default 0 check (word_count >= 0),
  session_json jsonb,
  export_html text,
  viewed_at timestamptz,
  shared_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists collections_owner_updated_idx on public.collections (owner_id, updated_at desc);

create index if not exists papers_owner_updated_idx on public.papers (owner_id, updated_at desc);

create index if not exists papers_owner_collection_updated_idx on public.papers (owner_id, collection_id, updated_at desc);

create index if not exists papers_session_json_gin_idx on public.papers using gin (session_json);

create index if not exists classes_owner_updated_idx on public.classes (owner_id, updated_at desc);

create unique index if not exists class_members_class_email_unique_idx on public.class_members (class_id, student_email);

create index if not exists class_members_teacher_idx on public.class_members (teacher_id, class_id);

create index if not exists class_members_student_email_idx on public.class_members (student_email);

create unique index if not exists paper_shares_paper_email_unique_idx on public.paper_shares (paper_id, student_email);

create index if not exists paper_shares_teacher_idx on public.paper_shares (teacher_id, shared_at desc);

create index if not exists paper_shares_student_email_idx on public.paper_shares (student_email, shared_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_collections_updated_at on public.collections;
create trigger set_collections_updated_at
before update on public.collections
for each row execute function public.set_updated_at();

drop trigger if exists set_papers_updated_at on public.papers;
create trigger set_papers_updated_at
before update on public.papers
for each row execute function public.set_updated_at();

drop trigger if exists set_classes_updated_at on public.classes;
create trigger set_classes_updated_at
before update on public.classes
for each row execute function public.set_updated_at();

drop trigger if exists set_paper_shares_updated_at on public.paper_shares;
create trigger set_paper_shares_updated_at
before update on public.paper_shares
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.collections enable row level security;
alter table public.papers enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.paper_shares enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can manage own collections" on public.collections;
create policy "Users can manage own collections"
on public.collections for all
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "Users can manage own papers" on public.papers;
create policy "Users can manage own papers"
on public.papers for all
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "Teachers can manage own classes" on public.classes;
create policy "Teachers can manage own classes"
on public.classes for all
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "Students can read their classes" on public.classes;
create policy "Students can read their classes"
on public.classes for select
to authenticated
using (
  exists (
    select 1 from public.class_members
    where class_members.class_id = classes.id
      and (
        class_members.student_id = auth.uid()
        or lower(class_members.student_email) = lower(auth.jwt() ->> 'email')
      )
  )
);

drop policy if exists "Teachers can manage class members" on public.class_members;
create policy "Teachers can manage class members"
on public.class_members for all
to authenticated
using (auth.uid() = teacher_id)
with check (auth.uid() = teacher_id);

drop policy if exists "Students can read own class memberships" on public.class_members;
create policy "Students can read own class memberships"
on public.class_members for select
to authenticated
using (
  student_id = auth.uid()
  or lower(student_email) = lower(auth.jwt() ->> 'email')
);

drop policy if exists "Teachers can manage own paper shares" on public.paper_shares;
create policy "Teachers can manage own paper shares"
on public.paper_shares for all
to authenticated
using (auth.uid() = teacher_id)
with check (auth.uid() = teacher_id);

drop policy if exists "Students can read paper shares addressed to them" on public.paper_shares;
create policy "Students can read paper shares addressed to them"
on public.paper_shares for select
to authenticated
using (
  student_id = auth.uid()
  or lower(student_email) = lower(auth.jwt() ->> 'email')
);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, account_role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    case
      when new.raw_user_meta_data->>'account_role' = 'student' then 'student'
      else 'teacher'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_profile_for_new_user on auth.users;
create trigger create_profile_for_new_user
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

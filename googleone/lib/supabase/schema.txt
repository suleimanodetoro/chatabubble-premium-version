-- Enable RLS (Row Level Security)
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;

-- Create custom types
create type user_level as enum ('beginner', 'intermediate', 'advanced');
create type scenario_category as enum ('shopping', 'dining', 'travel', 'business', 'casual');

-- Profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  username text unique,
  native_language jsonb not null,
  learning_languages jsonb[] not null default '{}',
  current_levels jsonb not null default '{}'::jsonb,
  daily_streak integer default 0,
  last_practice timestamp with time zone,
  settings jsonb default '{}'::jsonb,
  
  constraint username_length check (char_length(username) >= 3)
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Scenarios table
create table public.scenarios (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references auth.users on delete set null,
  title text not null,
  description text not null,
  category scenario_category not null,
  difficulty user_level not null,
  target_language jsonb not null,
  persona jsonb not null,
  is_public boolean default false,
  
  constraint title_length check (char_length(title) >= 3)
);

-- Chat sessions table
create table public.chat_sessions (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users on delete cascade not null,
  scenario_id uuid references public.scenarios on delete cascade not null,
  messages jsonb[] not null default '{}',
  source_language jsonb not null,
  target_language jsonb not null,
  
  constraint messages_limit check (array_length(messages, 1) <= 100)
);

-- Policies
create policy "Users can read their own profile"
  on profiles for select
  using ( auth.uid() = id );

create policy "Users can update their own profile"
  on profiles for update
  using ( auth.uid() = id );

create policy "Public scenarios are readable by everyone"
  on scenarios for select
  using ( is_public = true );

create policy "Users can read their private scenarios"
  on scenarios for select
  using ( auth.uid() = created_by );

create policy "Users can create scenarios"
  on scenarios for insert
  with check ( auth.uid() = created_by );

create policy "Users can read their chat sessions"
  on chat_sessions for select
  using ( auth.uid() = user_id );

create policy "Users can create chat sessions"
  on chat_sessions for insert
  with check ( auth.uid() = user_id );

-- Functions
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, native_language)
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    '{"code": "en", "name": "English", "direction": "ltr"}'::jsonb
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user creation
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
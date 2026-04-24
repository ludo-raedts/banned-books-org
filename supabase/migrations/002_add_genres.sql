alter table books add column if not exists genres text[] not null default '{}';

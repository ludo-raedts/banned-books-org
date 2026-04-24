CREATE TABLE countries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       char(2) UNIQUE NOT NULL,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE authors (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE books (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  author_id  uuid REFERENCES authors(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE bans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id     uuid REFERENCES books(id) ON DELETE CASCADE,
  country_id  uuid REFERENCES countries(id) ON DELETE CASCADE,
  action_type text NOT NULL DEFAULT 'banned',
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE ban_sources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ban_id      uuid REFERENCES bans(id) ON DELETE CASCADE,
  source_name text NOT NULL,
  url         text,
  created_at  timestamptz DEFAULT now()
);

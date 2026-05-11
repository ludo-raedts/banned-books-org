CREATE TABLE IF NOT EXISTS cover_search_attempts (
  book_id BIGINT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
  last_searched_at TIMESTAMPTZ DEFAULT NOW(),
  attempts INTEGER DEFAULT 1,
  sources_tried TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

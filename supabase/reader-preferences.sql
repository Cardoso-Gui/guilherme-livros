-- Migração aplicada: reader_anchor_and_font
alter table public.reading_progress
 add column if not exists paragraph_index integer check (paragraph_index >= 0),
 add column if not exists paragraph_offset double precision check (paragraph_offset >= 0 and paragraph_offset <= 1),
 add column if not exists font_size integer not null default 16 check (font_size between 16 and 28);

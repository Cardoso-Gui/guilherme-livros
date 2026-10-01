-- Migração aplicada: reader_anchor_and_font
alter table public.reading_progress
 add column if not exists paragraph_index integer check (paragraph_index >= 0),
 add column if not exists paragraph_offset double precision check (paragraph_offset >= 0 and paragraph_offset <= 1),
 add column if not exists font_size integer not null default 16 check (font_size between 16 and 28);

-- Migração aplicada: reader_font_sizes_12_to_20
alter table public.reading_progress drop constraint reading_progress_font_size_check;
update public.reading_progress set font_size=greatest(12,least(20,2*round(font_size::numeric/2)::integer)) where font_size not in (12,14,16,18,20);
alter table public.reading_progress alter column font_size set default 14;
alter table public.reading_progress add constraint reading_progress_font_size_check check (font_size in (12,14,16,18,20));

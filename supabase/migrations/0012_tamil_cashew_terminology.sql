-- 0012 — Tamil terminology (data only, idempotent).
-- The approved Tamil brand rendering is "அரும்பு முந்திரி" (Arumbu Cashews).
-- Admin-editable Tamil text seeded by 0007 used the Hindi loan word for
-- cashew. Replace it, with the correct Tamil case endings, only where it
-- is still present; rows already edited to other text are untouched.
-- (The old word is written with Unicode escapes:
--  U&'\0B95\0BBE\0B9C\0BC1' = the old word for "cashew".)
update public.content_blocks
set value_ta =
  replace(replace(replace(replace(value_ta,
    'அரும்பு ' || U&'\0B95\0BBE\0B9C\0BC1' || 'வுக்குப்', 'அரும்பு முந்திரிக்குப்'),
    'அரும்பு ' || U&'\0B95\0BBE\0B9C\0BC1' || 'விற்கு',   'அரும்பு முந்திரிக்கு'),
    'அரும்பு ' || U&'\0B95\0BBE\0B9C\0BC1' || 'வின்',     'அரும்பு முந்திரியின்'),
    'அரும்பு ' || U&'\0B95\0BBE\0B9C\0BC1',                'அரும்பு முந்திரி')
where value_ta like '%' || U&'\0B95\0BBE\0B9C\0BC1' || '%';

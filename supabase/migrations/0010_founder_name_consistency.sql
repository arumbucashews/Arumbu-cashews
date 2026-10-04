-- 0010 — Founder name consistency (data only, idempotent).
-- The approved founder name is "Sivakumar L". The original About seed
-- (0003) used "Mr. Shivakumar" / "Shivakumar's" in the admin-editable
-- about_content 'people' text. Only those exact spellings are replaced;
-- rows already edited to something else are left untouched.
update public.about_content
set body = replace(replace(body, 'Mr. Shivakumar', 'Sivakumar L'), 'Shivakumar''s', 'Sivakumar''s')
where section_key = 'people'
  and body like '%Shivakumar%';

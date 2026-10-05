-- ============================================================
-- ARUMBU CASHEWS — CATALOGUE & CMS CONTENT ALIGNMENT
-- Migration: 0007_seed_catalogue_and_content.sql
-- Run AFTER 0006. Data only, idempotent (on conflict do nothing /
-- only fills empty fields). Every text value below is copied from the
-- approved website copy already in the project (js/i18n-dictionary.js);
-- nothing is invented. No prices, stock, SKUs, coupons, FAQs or legal
-- text are created — those are entered by the admin.
-- ============================================================

-- 1. Product slugs + full grade names (EN/TA) where empty
update public.products set slug = coalesce(slug, 'ww180'), full_name = coalesce(full_name, 'White Wholes 180'), full_name_ta = coalesce(full_name_ta, 'வெள்ளை முழு பருப்பு 180') where lower(grade_name) = 'ww180';
update public.products set slug = coalesce(slug, 'ww210'), full_name = coalesce(full_name, 'White Wholes 210'), full_name_ta = coalesce(full_name_ta, 'வெள்ளை முழு பருப்பு 210') where lower(grade_name) = 'ww210';
update public.products set slug = coalesce(slug, 'ww240'), full_name = coalesce(full_name, 'White Wholes 240'), full_name_ta = coalesce(full_name_ta, 'வெள்ளை முழு பருப்பு 240') where lower(grade_name) = 'ww240';
update public.products set slug = coalesce(slug, 'ww320'), full_name = coalesce(full_name, 'White Wholes 320'), full_name_ta = coalesce(full_name_ta, 'வெள்ளை முழு பருப்பு 320') where lower(grade_name) = 'ww320';
update public.products set slug = coalesce(slug, 'ww400'), full_name = coalesce(full_name, 'White Wholes 400'), full_name_ta = coalesce(full_name_ta, 'வெள்ளை முழு பருப்பு 400') where lower(grade_name) = 'ww400';
update public.products set slug = coalesce(slug, 'sw'), full_name = coalesce(full_name, 'Scorched Wholes'), full_name_ta = coalesce(full_name_ta, 'வறுத்த முழு பருப்பு') where lower(grade_name) = 'sw';
update public.products set slug = coalesce(slug, 'ssw'), full_name = coalesce(full_name, 'Scorched Second Wholes'), full_name_ta = coalesce(full_name_ta, 'வறுத்த இரண்டாம் தர முழு பருப்பு') where lower(grade_name) = 'ssw';
update public.products set slug = coalesce(slug, 'lwp'), full_name = coalesce(full_name, 'Large White Pieces'), full_name_ta = coalesce(full_name_ta, 'பெரிய வெள்ளை துண்டுகள்') where lower(grade_name) = 'lwp';
update public.products set slug = coalesce(slug, 'csp'), full_name = coalesce(full_name, 'Cashew Small Pieces'), full_name_ta = coalesce(full_name_ta, 'சிறிய முந்திரி துண்டுகள்') where lower(grade_name) = 'csp';
update public.products set slug = coalesce(slug, 'bb'), full_name = coalesce(full_name, 'Baby Bits'), full_name_ta = coalesce(full_name_ta, 'சிறு துணுக்குகள்') where lower(grade_name) = 'bb';
update public.products set slug = coalesce(slug, 'jh'), full_name = coalesce(full_name, 'Jumbo Halves'), full_name_ta = coalesce(full_name_ta, 'ஜம்போ பாதி பருப்பு') where lower(grade_name) = 'jh';
update public.products set slug = coalesce(slug, 'sjh'), full_name = coalesce(full_name, 'Scorched Jumbo Halves'), full_name_ta = coalesce(full_name_ta, 'வறுத்த ஜம்போ பாதி பருப்பு') where lower(grade_name) = 'sjh';
update public.products set slug = coalesce(slug, 'jk'), full_name = coalesce(full_name, 'Jumbo Kudka'), full_name_ta = coalesce(full_name_ta, 'ஜம்போ குட்கா') where lower(grade_name) = 'jk';

-- 2. Pack sizes 250 g / 500 g / 1 kg for every grade — price NULL
--    (not for sale until the admin sets a price); inventory rows are
--    created automatically with stock 0.
insert into public.product_variants (product_id, pack_label, weight_grams, display_order)
select p.id, v.label, v.grams, v.ord
from public.products p
cross join (values ('250 g', 250, 1), ('500 g', 500, 2), ('1 kg', 1000, 3)) as v(label, grams, ord)
on conflict (product_id, weight_grams) do nothing;

-- 3. Site settings keys (empty = not configured). Values are entered in Admin -> Settings.
insert into public.site_settings (key, value) values
  ('site_url', 'https://arumbucashews.com'),
  ('delivery_fee', ''),
  ('free_delivery_threshold', ''),
  ('whatsapp_orders_enabled', 'true'),
  ('payments_razorpay_enabled', 'false'),
  ('razorpay_key_id', ''),
  ('gst_enabled', 'false'),
  ('gst_rate', ''),
  ('gst_prices_inclusive', 'true'),
  ('gstin', ''),
  ('invoice_business_name', 'Arumbu Cashews'),
  ('invoice_address', ''),
  ('invoice_footer', ''),
  ('notify_admin_email', ''),
  ('ga_measurement_id', ''),
  ('social_youtube_url', ''),
  ('social_linkedin_url', ''),
  ('social_x_url', '')
on conflict (key) do nothing;

-- 4. Hero: approved homepage text (replaces the older subheading that
--    contained removed claims) + Tamil, and the three approved slides.
update public.hero_settings set subheading = 'Thirteen cashew grades, from WW180 to Baby Bits, in 250 g, 500 g and 1 kg packs. Wholesale on enquiry.', subheading_ta = 'WW180 முதல் சிறு துணுக்குகள் வரை பதிமூன்று முந்திரி தரங்கள், 250 கி, 500 கி மற்றும் 1 கி.கி பொட்டலங்களில். மொத்த விற்பனை விசாரணையின் பேரில்.', heading_ta = coalesce(heading_ta, 'அக்கறையுடன் சேகரிக்கப்பட்டது. துல்லியமாக பதப்படுத்தப்பட்டது.'), cta_text_ta = coalesce(cta_text_ta, 'வாட்ஸ்அப்பில் ஆர்டர் செய்யுங்கள்'), is_video_enabled = false where is_active;
insert into public.hero_slides (image_url, alt_en, display_order, is_active)
select v.url, v.alt, v.ord, true
from (values ('images/hero/hero-1.jpg', 'Arumbu cashews', 1),
             ('images/hero/hero-2.jpg', 'Cashew tree with flowers and cashew apples', 2),
             ('images/hero/hero-3.jpg', 'Cashew cultivation and harvest', 3)) as v(url, alt, ord)
where not exists (select 1 from public.hero_slides);

-- 5. Homepage CMS text blocks (founder, Why Arumbu, wholesale, contact,
--    grades heading, footer tagline) — keys match the website's
--    translation keys (lower-case); value_en / value_ta copied verbatim.
insert into public.content_blocks (key, value_en, value_ta) values
  ('founder.eyebrow', 'The Founder', 'நிறுவனர்'),
  ('founder.heading.html', 'Rooted in Agriculture. <em>Built on Trust.</em>', 'விவசாயத்தில் வேரூன்றியது. <em>நம்பிக்கையின் மீது கட்டப்பட்டது.</em>'),
  ('founder.lede', 'The story behind Arumbu Cashews begins with hard work, agriculture and a commitment to doing things the right way.', 'அரும்பு முந்திரியின் கதை கடின உழைப்பு, விவசாயம், மற்றும் சரியான முறையில் செயல்படும் உறுதிப்பாட்டுடன் தொடங்குகிறது.'),
  ('founder.role', 'Founder, Arumbu Cashews', 'நிறுவனர், அரும்பு முந்திரி'),
  ('founder.tags', 'Farmer-Entrepreneur · Cashew & Jackfruit Cultivation', 'விவசாயி-தொழில்முனைவோர் · முந்திரி மற்றும் பலா சாகுபடி'),
  ('founder.p1', 'Sivakumar L comes from a farming family and has spent his life working the land — cultivating a range of crops, with jackfruit and cashew as his main areas of focus. Years of hands-on agricultural experience shaped the way he thinks about quality: nothing beats produce that''s grown, harvested and handled with genuine care.', 'சிவகுமார் L ஒரு விவசாயக் குடும்பத்தைச் சேர்ந்தவர், தனது வாழ்நாள் முழுவதும் நிலத்தில் உழைத்தவர் — பலா மற்றும் முந்திரியை முதன்மையாகக் கொண்டு பல்வேறு பயிர்களை சாகுபடி செய்தார். பல ஆண்டுகால நேரடி விவசாய அனுபவம் தரம் குறித்த அவரது சிந்தனையை வடிவமைத்தது: உண்மையான அக்கறையுடன் வளர்க்கப்பட்டு, அறுவடை செய்யப்பட்டு, கையாளப்படும் விளைபொருளுக்கு நிகரானது வேறெதுவும் இல்லை.'),
  ('founder.p2', 'His approach has always been simple — work hard, stay genuine, maintain transparency, and give customers exactly what the product actually is, without unnecessary claims or exaggeration. That same mindset became the foundation Arumbu Cashews was built on.', 'அவரது அணுகுமுறை எப்போதுமே எளிமையானது — கடினமாக உழைப்பது, உண்மையாக இருப்பது, வெளிப்படைத்தன்மையைப் பேணுவது, மற்றும் தேவையற்ற கூற்றுகள் இல்லாமல் பொருள் உண்மையில் என்னவோ அதையே வாடிக்கையாளர்களுக்கு வழங்குவது. அதே சிந்தனையே அரும்பு முந்திரி கட்டமைக்கப்பட்ட அடித்தளமாக மாறியது.'),
  ('founder.p3', 'The name Arumbu carries personal meaning. It is the name of his mother, Arumbu, and it now carries her name forward as the identity of the brand. His father, Late Lakshmanaperumal, was an important part of the family''s agricultural journey — and his legacy continues to shape the values behind the business.', 'அரும்பு என்ற பெயர் தனிப்பட்ட முக்கியத்துவம் வாய்ந்தது. இது அவரது தாயார் அரும்பு அவர்களின் பெயர், இப்போது அது பிராண்டின் அடையாளமாக அவரது பெயரை முன்னெடுத்துச் செல்கிறது. அவரது தந்தை, மறைந்த லக்ஷ்மணபெருமாள், குடும்பத்தின் விவசாயப் பயணத்தின் முக்கியப் பகுதியாக இருந்தார் — அவரது பாரம்பரியம் இந்த வணிகத்தின் பின்னணியிலுள்ள மதிப்புகளை தொடர்ந்து வடிவமைக்கிறது.'),
  ('founder.p4', 'Arumbu Cashews carries that legacy forward — rooted in family, grounded in agriculture, and built on the same honesty Sivakumar has practiced his entire working life.', 'அரும்பு முந்திரி அந்த பாரம்பரியத்தை முன்னெடுத்துச் செல்கிறது — குடும்பத்தில் வேரூன்றி, விவசாயத்தில் நிலைத்து, சிவகுமார் தனது முழு உழைப்பு வாழ்க்கையிலும் கடைப்பிடித்த அதே நேர்மையின் மீது கட்டப்பட்டது.'),
  ('why.eyebrow', 'The Arumbu Difference', 'அரும்பு வேறுபாடு'),
  ('wholesalecta.eyebrow', 'For Businesses & Retailers', 'வணிகங்கள் & சில்லறை விற்பனையாளர்களுக்கு'),
  ('wholesalecta.heading', 'Buying in bulk? Let''s talk rates.', 'மொத்தமாக வாங்குகிறீர்களா? விலைகளைப் பற்றி பேசலாம்.'),
  ('wholesalecta.button', 'Wholesale Enquiry', 'மொத்த விற்பனை விசாரணை'),
  ('grades.eyebrow', 'Our Grades', 'எங்கள் தரங்கள்'),
  ('grades.heading.html', 'Explore all <em>thirteen grades</em>', 'அனைத்து <em>பதிமூன்று தரங்களையும்</em> காண்க'),
  ('grades.viewall', 'View all grades', 'அனைத்து தரங்களையும் காண்க'),
  ('whyv2.heading.html', 'Why <em>Arumbu</em>', 'ஏன் <em>அரும்பு</em>'),
  ('whyv2.p1.title', 'Thirteen grades', 'பதிமூன்று தரங்கள்'),
  ('whyv2.p1.desc', 'From WW180 to Baby Bits — choose the grade that suits your kitchen, shop or gift box.', 'WW180 முதல் சிறு துணுக்குகள் வரை — உங்கள் சமையலறை, கடை அல்லது பரிசுப் பெட்டிக்கு ஏற்ற தரத்தைத் தேர்ந்தெடுங்கள்.'),
  ('whyv2.p2.title', 'Packs for every need', 'ஒவ்வொரு தேவைக்கும் பொட்டலங்கள்'),
  ('whyv2.p2.desc', 'Retail packs of 250 g, 500 g and 1 kg, and wholesale quantities on enquiry.', '250 கி, 500 கி மற்றும் 1 கி.கி சில்லறைப் பொட்டலங்கள்; மொத்த அளவுகள் விசாரணையின் பேரில்.'),
  ('whyv2.p3.title', 'Order directly', 'நேரடியாக ஆர்டர் செய்யுங்கள்'),
  ('whyv2.p3.desc', 'Message us on WhatsApp with the grade and pack size — you deal directly with the Arumbu team.', 'தரம் மற்றும் பொட்டல அளவுடன் வாட்ஸ்அப்பில் செய்தி அனுப்புங்கள் — நீங்கள் நேரடியாக அரும்பு குழுவுடன் தொடர்பு கொள்கிறீர்கள்.'),
  ('wholesalecta.descv2', 'Sweet shops, gifting companies, exporters and retailers — send us your grade and quantity for wholesale rates.', 'இனிப்பகங்கள், பரிசு நிறுவனங்கள், ஏற்றுமதியாளர்கள் மற்றும் சில்லறை விற்பனையாளர்கள் — மொத்த விலைக்கு உங்கள் தரம் மற்றும் அளவை எங்களுக்கு அனுப்புங்கள்.'),
  ('contactv2.eyebrow', 'Contact', 'தொடர்பு'),
  ('contactv2.heading.html', 'Talk to <em>Arumbu</em>', '<em>அரும்பு</em>வுடன் பேசுங்கள்'),
  ('contactv2.lede', 'Call or message us to place an order or ask about a grade.', 'ஆர்டர் செய்ய அல்லது ஒரு தரத்தைப் பற்றி கேட்க எங்களை அழையுங்கள் அல்லது செய்தி அனுப்புங்கள்.'),
  ('contactv2.phone', 'Phone', 'தொலைபேசி'),
  ('contactv2.email', 'Email', 'மின்னஞ்சல்'),
  ('contactv2.more', 'Contact page & enquiry form', 'தொடர்புப் பக்கம் & விசாரணைப் படிவம்'),
  ('founder.quote', 'It is the name of his mother, Arumbu, and it now carries her name forward as the identity of the brand.', 'இது அவரது தாயார் அரும்பு அவர்களின் பெயர், இப்போது அது பிராண்டின் அடையாளமாக அவரது பெயரை முன்னெடுத்துச் செல்கிறது.'),
  ('founder.steppeople', 'People', 'மனிதர்கள்'),
  ('founder.stepheritage', 'Heritage', 'பாரம்பரியம்'),
  ('founder.stepbrand', 'Brand', 'பிராண்ட்'),
  ('founder.stepproduct', 'Product', 'தயாரிப்பு'),
  ('founder.explore', 'Explore our grades', 'எங்கள் தரங்களைக் காண்க'),
  ('footer.taglinehomev2', 'Premium cashews from Tamil Nadu.', 'தமிழ்நாட்டின் பிரீமியம் முந்திரி.'),
  ('founder.name', 'Sivakumar L', 'Sivakumar L'),
  ('founder.image', 'images/founder-sivakumar.jpg', null)
on conflict (key) do nothing;

-- 6. Information pages — titles only; body text is written by the
--    business in Admin -> Pages (the site shows a neutral notice until then).
insert into public.pages (slug, title_en, title_ta, is_published) values
  ('privacy-policy', 'Privacy Policy', 'தனியுரிமைக் கொள்கை', true),
  ('terms', 'Terms & Conditions', 'விதிமுறைகள் & நிபந்தனைகள்', true),
  ('shipping-delivery', 'Shipping & Delivery', 'அனுப்புதல் & டெலிவரி', true),
  ('cancellation-refund', 'Cancellation & Refund', 'ரத்து & பணத்திருப்பம்', true),
  ('faq', 'Frequently Asked Questions', 'அடிக்கடி கேட்கப்படும் கேள்விகள்', true),
  ('gifting', 'Corporate & Festive Gifting', 'நிறுவன & பண்டிகைப் பரிசுகள்', true)
on conflict (slug) do nothing;

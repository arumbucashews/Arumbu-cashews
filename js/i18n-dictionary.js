/* ============================================================
   ARUMBU CASHEWS — TRANSLATION DICTIONARY
   ============================================================
   Centralized i18n dictionary. Every translatable string on the
   site lives here, keyed once, in both languages. Nothing about
   the interface text is hard-coded per page — script.js's i18n
   engine (applyTranslations()) walks the DOM for elements tagged
   with data-i18n / data-i18n-html / data-i18n-placeholder /
   data-i18n-aria / data-i18n-content and fills them in from here.

   TO ADD A THIRD LANGUAGE LATER:
   Add a third key (e.g. "hi") alongside "en" and "ta" on every
   entry below, then add a button for it in the language switcher
   markup in each page's header. No other code changes needed —
   the engine and switcher are language-count-agnostic.

   RULES THIS FILE FOLLOWS (per the brand's own instructions):
   - Cashew grade codes (WW180, WW210, WW240, WW320, WW400, SW, SSW,
     LWP, CSP, BB, JH, SJH, JK) are NEVER translated — they don't
     appear as translatable values anywhere in this file.
   - Prices, phone numbers, email addresses and URLs are never
     translated — same reason, they simply never appear here as
     translatable strings; they're written directly in the HTML.
   ============================================================ */

var ARUMBU_TRANSLATIONS = {

  /* ---------- <title> / meta ---------- */
  "meta.title.home": {
    en: "Arumbu Cashews | Farm-Fresh Premium Cashews from Tamil Nadu",
    ta: "அரும்பு காஜு | தமிழ்நாட்டின் பண்ணைப் புத்தம் புதிய பிரீமியம் முந்திரி"
  },
  "meta.title.about": {
    en: "About | Arumbu Cashews",
    ta: "எங்களைப் பற்றி | அரும்பு காஜு"
  },
  "meta.title.products": {
    en: "Products | Arumbu Cashews",
    ta: "பொருட்கள் | அரும்பு காஜு"
  },
  "meta.title.wholesale": {
    en: "Wholesale | Arumbu Cashews",
    ta: "மொத்த விற்பனை | அரும்பு காஜு"
  },
  "meta.title.contact": {
    en: "Contact | Arumbu Cashews",
    ta: "தொடர்பு கொள்ள | அரும்பு காஜு"
  },
  "meta.description.home": {
    en: "Arumbu Cashews — hand-sorted, farm-direct premium cashews from Tamil Nadu. Order retail packs or enquire for wholesale.",
    ta: "அரும்பு காஜு — தமிழ்நாட்டிலிருந்து நேரடியாக, கையால் தரம் பிரிக்கப்பட்ட பிரீமியம் முந்திரி. சில்லறை பொட்டலங்களை ஆர்டர் செய்யவும் அல்லது மொத்த விற்பனைக்கு விசாரிக்கவும்."
  },

  /* ---------- Splash screen ---------- */
  "splash.skip": { en: "Skip", ta: "தவிர்" },

  /* ---------- Header / navigation ---------- */
  "nav.home": { en: "Home", ta: "முகப்பு" },
  "nav.about": { en: "About", ta: "எங்களைப் பற்றி" },
  "nav.products": { en: "Products", ta: "பொருட்கள்" },
  "nav.wholesale": { en: "Wholesale", ta: "மொத்த விற்பனை" },
  "nav.contact": { en: "Contact", ta: "தொடர்பு" },
  "nav.allProducts": { en: "All Products", ta: "அனைத்து பொருட்களும்" },
  "nav.wholesaleEnquiry": { en: "Wholesale Enquiry", ta: "மொத்த விற்பனை விசாரணை" },

  "header.openMenu": { en: "Open menu", ta: "மெனுவைத் திற" },
  "header.closeMenu": { en: "Close menu", ta: "மெனுவை மூடு" },
  "header.search": { en: "Search", ta: "தேடு" },
  "header.account": { en: "Account", ta: "கணக்கு" },
  "header.cart": { en: "Cart", ta: "கார்ட்" },
  "header.wishlist": { en: "Wishlist", ta: "விருப்பப் பட்டியல்" },
  "header.chatWhatsapp": { en: "Chat on WhatsApp", ta: "வாட்ஸ்அப்பில் பேசுங்கள்" },
  "header.facebookPending": { en: "Facebook (link pending)", ta: "பேஸ்புக் (இணைப்பு விரைவில்)" },
  "header.instagramPending": { en: "Instagram (link pending)", ta: "இன்ஸ்டாகிராம் (இணைப்பு விரைவில்)" },

  "account.welcome": { en: "Welcome to Arumbu Cashews", ta: "அரும்பு காஜுவிற்கு வரவேற்கிறோம்" },
  "account.desc": {
    en: "Create an account to save your favourites and track enquiries. Customer accounts are launching soon.",
    ta: "உங்கள் விருப்பப் பொருட்களைச் சேமிக்கவும், விசாரணைகளைக் கண்காணிக்கவும் ஒரு கணக்கை உருவாக்குங்கள். வாடிக்கையாளர் கணக்குகள் விரைவில் தொடங்கப்படும்."
  },
  "account.login": { en: "Log In", ta: "உள்நுழைக" },
  "account.signup": { en: "Create Account", ta: "கணக்கு உருவாக்குக" },

  "cart.title": { en: "Your Cart", ta: "உங்கள் கார்ட்" },
  "cart.empty": {
    en: "Your cart is empty. Browse our cashew grades and add what you need.",
    ta: "உங்கள் கார்ட் காலியாக உள்ளது. எங்கள் முந்திரி தரங்களைப் பார்வையிட்டு தேவையானவற்றைச் சேர்க்கவும்."
  },
  "wishlist.title": { en: "Your Wishlist", ta: "உங்கள் விருப்பப் பட்டியல்" },
  "wishlist.empty": {
    en: "Save the grades you love here and come back to them anytime.",
    ta: "நீங்கள் விரும்பும் தரங்களை இங்கே சேமித்து எப்போது வேண்டுமானாலும் திரும்பிப் பாருங்கள்."
  },
  "products.browse": { en: "Browse Products", ta: "பொருட்களைப் பார்வையிடு" },

  "search.placeholder": {
    en: "Search cashew grades — e.g. WW180, JH, JK…",
    ta: "முந்திரி தரங்களைத் தேடுங்கள் — எ.கா. WW180, JH, JK…"
  },
  "search.close": { en: "Close", ta: "மூடு" },
  "search.noResults": { en: "No matching grade found.", ta: "பொருந்தும் தரம் எதுவும் கிடைக்கவில்லை." },

  /* ---------- Homepage: Hero ---------- */
  "hero.eyebrow": { en: "Est. in the cashew belt of Tamil Nadu", ta: "தமிழ்நாட்டின் முந்திரி பெல்ட்டில் தொடங்கப்பட்டது" },
  "hero.title.html": {
    en: "Sourced with care. <em>Processed with precision.</em>",
    ta: "அக்கறையுடன் சேகரிக்கப்பட்டது. <em>துல்லியமாக பதப்படுத்தப்பட்டது.</em>"
  },
  "hero.sub": {
    en: "From the orchard to the sorting floor, every batch under the Arumbu name is handled with the same attention to detail — sorted, roasted and sealed within days of harvest.",
    ta: "தோட்டத்திலிருந்து தரம் பிரிக்கும் தளம் வரை, அரும்பு பெயரில் வரும் ஒவ்வொரு தொகுப்பும் ஒரே அக்கறையுடன் கையாளப்படுகிறது — அறுவடை செய்த சில நாட்களுக்குள் தரம் பிரிக்கப்பட்டு, வறுக்கப்பட்டு, சீல் வைக்கப்படுகிறது."
  },
  "hero.ctaWhatsapp": { en: "Order on WhatsApp", ta: "வாட்ஸ்அப்பில் ஆர்டர் செய்யுங்கள்" },
  "hero.ctaViewProducts": { en: "View Products", ta: "பொருட்களைப் பார்க்க" },
  "hero.stat1": { en: "Preservatives Added", ta: "சேர்க்கப்பட்ட பாதுகாப்புப் பொருட்கள்" },
  "hero.stat2": { en: "Harvest to Pack", ta: "அறுவடையிலிருந்து பொட்டலம் வரை" },
  "hero.stat3": { en: "Tamil Nadu Sourced", ta: "தமிழ்நாட்டிலிருந்து சேகரிக்கப்பட்டது" },

  /* ---------- Homepage: Founder story ---------- */
  "founder.eyebrow": { en: "The Founder", ta: "நிறுவனர்" },
  "founder.heading.html": {
    en: "Rooted in Agriculture. <em>Built on Trust.</em>",
    ta: "விவசாயத்தில் வேரூன்றியது. <em>நம்பிக்கையின் மீது கட்டப்பட்டது.</em>"
  },
  "founder.lede": {
    en: "The story behind Arumbu Cashews begins with hard work, agriculture and a commitment to doing things the right way.",
    ta: "அரும்பு காஜுவின் கதை கடின உழைப்பு, விவசாயம், மற்றும் சரியான முறையில் செயல்படும் உறுதிப்பாட்டுடன் தொடங்குகிறது."
  },
  "founder.role": { en: "Founder, Arumbu Cashews", ta: "நிறுவனர், அரும்பு காஜு" },
  "founder.tags": { en: "Farmer-Entrepreneur · Cashew & Jackfruit Cultivation", ta: "விவசாயி-தொழில்முனைவோர் · முந்திரி மற்றும் பலா சாகுபடி" },
  "founder.p1": {
    en: "Sivakumar L comes from a farming family and has spent his life working the land — cultivating a range of crops, with jackfruit and cashew as his main areas of focus. Years of hands-on agricultural experience shaped the way he thinks about quality: nothing beats produce that's grown, harvested and handled with genuine care.",
    ta: "சிவகுமார் L ஒரு விவசாயக் குடும்பத்தைச் சேர்ந்தவர், தனது வாழ்நாள் முழுவதும் நிலத்தில் உழைத்தவர் — பலா மற்றும் முந்திரியை முதன்மையாகக் கொண்டு பல்வேறு பயிர்களை சாகுபடி செய்தார். பல ஆண்டுகால நேரடி விவசாய அனுபவம் தரம் குறித்த அவரது சிந்தனையை வடிவமைத்தது: உண்மையான அக்கறையுடன் வளர்க்கப்பட்டு, அறுவடை செய்யப்பட்டு, கையாளப்படும் விளைபொருளுக்கு நிகரானது வேறெதுவும் இல்லை."
  },
  "founder.p2": {
    en: "His approach has always been simple — work hard, stay genuine, maintain transparency, and give customers exactly what the product actually is, without unnecessary claims or exaggeration. That same mindset became the foundation Arumbu Cashews was built on.",
    ta: "அவரது அணுகுமுறை எப்போதுமே எளிமையானது — கடினமாக உழைப்பது, உண்மையாக இருப்பது, வெளிப்படைத்தன்மையைப் பேணுவது, மற்றும் தேவையற்ற கூற்றுகள் இல்லாமல் பொருள் உண்மையில் என்னவோ அதையே வாடிக்கையாளர்களுக்கு வழங்குவது. அதே சிந்தனையே அரும்பு காஜு கட்டமைக்கப்பட்ட அடித்தளமாக மாறியது."
  },
  "founder.p3": {
    en: "The name Arumbu carries personal meaning. It is the name of his mother, Arumbu, and it now carries her name forward as the identity of the brand. His father, Late Lakshmanaperumal, was an important part of the family's agricultural journey — and his legacy continues to shape the values behind the business.",
    ta: "அரும்பு என்ற பெயர் தனிப்பட்ட முக்கியத்துவம் வாய்ந்தது. இது அவரது தாயார் அரும்பு அவர்களின் பெயர், இப்போது அது பிராண்டின் அடையாளமாக அவரது பெயரை முன்னெடுத்துச் செல்கிறது. அவரது தந்தை, மறைந்த லக்ஷ்மணபெருமாள், குடும்பத்தின் விவசாயப் பயணத்தின் முக்கியப் பகுதியாக இருந்தார் — அவரது பாரம்பரியம் இந்த வணிகத்தின் பின்னணியிலுள்ள மதிப்புகளை தொடர்ந்து வடிவமைக்கிறது."
  },
  "founder.p4": {
    en: "Arumbu Cashews carries that legacy forward — rooted in family, grounded in agriculture, and built on the same honesty Sivakumar has practiced his entire working life.",
    ta: "அரும்பு காஜு அந்த பாரம்பரியத்தை முன்னெடுத்துச் செல்கிறது — குடும்பத்தில் வேரூன்றி, விவசாயத்தில் நிலைத்து, சிவகுமார் தனது முழு உழைப்பு வாழ்க்கையிலும் கடைப்பிடித்த அதே நேர்மையின் மீது கட்டப்பட்டது."
  },

  /* ---------- Homepage: Why choose us ---------- */
  "why.eyebrow": { en: "The Arumbu Difference", ta: "அரும்பு வேறுபாடு" },
  "why.heading": { en: "Why buyers trust the Arumbu mark", ta: "வாங்குபவர்கள் ஏன் அரும்பு அடையாளத்தை நம்புகிறார்கள்" },
  "why.card1.title": { en: "Farm Direct", ta: "நேரடி பண்ணை" },
  "why.card1.desc": {
    en: "Sourced straight from growers in the Tamil Nadu cashew belt — no middle-layer traders, no ageing stock.",
    ta: "தமிழ்நாட்டு முந்திரி பெல்ட்டில் உள்ள விவசாயிகளிடமிருந்து நேரடியாக சேகரிக்கப்படுகிறது — இடைத்தரகர்கள் இல்லை, பழைய கையிருப்பு இல்லை."
  },
  "why.card2.title": { en: "Hand-Sorted Grading", ta: "கையால் தரம் பிரிக்கப்படுதல்" },
  "why.card2.desc": {
    en: "Every batch is sorted by hand for size and quality — WW180, WW240 and every grade sorted separately.",
    ta: "ஒவ்வொரு தொகுப்பும் அளவு மற்றும் தரத்திற்காக கையால் தரம் பிரிக்கப்படுகிறது — WW180, WW240 மற்றும் ஒவ்வொரு தரமும் தனித்தனியாக பிரிக்கப்படுகிறது."
  },
  "why.card3.title": { en: "Fresh, Never Stockpiled", ta: "புதியது, ஒருபோதும் குவிக்கப்படாதது" },
  "why.card3.desc": {
    en: "We pack in small batches so what reaches you was roasted days — not months — before it arrived.",
    ta: "நாங்கள் சிறிய தொகுப்புகளாக பொட்டலமிடுகிறோம், எனவே உங்களை வந்தடையும் பொருள் மாதங்களுக்கு முன் அல்ல, சில நாட்களுக்கு முன்பே வறுக்கப்பட்டதாக இருக்கும்."
  },
  "why.card4.title": { en: "Sealed for Freshness", ta: "புத்தம் புதிதாக இருக்க சீல் வைக்கப்பட்டது" },
  "why.card4.desc": {
    en: "Vacuum-sealed, tamper-proof packaging keeps every kernel crisp from our unit to your kitchen.",
    ta: "வெற்றிடமாக சீல் வைக்கப்பட்ட, பாதுகாப்பான பொட்டலம் எங்கள் யூனிட்டிலிருந்து உங்கள் சமையலறை வரை ஒவ்வொரு பருப்பையும் மொறுமொறுப்பாக வைத்திருக்கும்."
  },

  /* ---------- Homepage: Our Cashew Range ---------- */
  "products.eyebrow": { en: "Premium grades currently available", ta: "தற்போது கிடைக்கும் பிரீமியம் தரங்கள்" },
  "products.heading": { en: "OUR CASHEW RANGE", ta: "எங்கள் முந்திரி வரம்பு" },
  "products.cta": { en: "See Full Product Range", ta: "முழு பொருட் வரம்பையும் காண்க" },
  "productCard.orderWhatsapp": { en: "Order on WhatsApp", ta: "வாட்ஸ்அப்பில் ஆர்டர் செய்க" },

  /* ---------- Homepage: Story ---------- */
  "story.eyebrow": { en: "Our Story", ta: "எங்கள் கதை" },
  "story.heading": { en: "A family name, a standard to live up to", ta: "ஒரு குடும்பப் பெயர், நிலைநிறுத்த வேண்டிய தரம்" },
  "story.p1": {
    en: "Arumbu started with a simple frustration — most \"premium\" cashews on shelves were anything but fresh. We set out to shorten the distance between farm and family, working directly with growers across Tamil Nadu who share our obsession with quality.",
    ta: "அரும்பு ஒரு எளிய அதிருப்தியுடன் தொடங்கியது — அலமாரிகளில் இருந்த பெரும்பாலான \"பிரீமியம்\" முந்திரி எதுவும் புத்தம் புதிதாக இல்லை. பண்ணைக்கும் குடும்பத்திற்கும் இடையிலான தூரத்தைக் குறைக்க நாங்கள் முனைந்தோம், தரத்தில் எங்கள் அதே ஆர்வத்தைப் பகிரும் தமிழ்நாடு முழுவதும் உள்ள விவசாயிகளுடன் நேரடியாகப் பணியாற்றுகிறோம்."
  },
  "story.p2": {
    en: "Every sack that reaches our sorting floor is inspected by hand before it earns the Arumbu name. It's slower than buying in bulk from traders — but it's the only way we know how to do this properly.",
    ta: "எங்கள் தரம் பிரிக்கும் தளத்தை அடையும் ஒவ்வொரு சாக்கும் அரும்பு பெயரைப் பெறுவதற்கு முன் கையால் ஆய்வு செய்யப்படுகிறது. வியாபாரிகளிடமிருந்து மொத்தமாக வாங்குவதை விட இது மெதுவானது — ஆனால் இதைச் சரியாகச் செய்ய எங்களுக்குத் தெரிந்த ஒரே வழி இதுவே."
  },
  "story.readMore": { en: "Read our full story →", ta: "எங்கள் முழு கதையையும் படிக்க →" },

  /* ---------- Homepage: Quality ---------- */
  "quality.eyebrow": { en: "Quality & Sourcing", ta: "தரம் & சேகரிப்பு" },
  "quality.heading": { en: "From orchard to your kitchen", ta: "தோட்டத்திலிருந்து உங்கள் சமையலறை வரை" },
  "quality.step1.index": { en: "Sourcing", ta: "சேகரிப்பு" },
  "quality.step1.title": { en: "Selected Farms", ta: "தேர்ந்தெடுக்கப்பட்ட பண்ணைகள்" },
  "quality.step1.desc": {
    en: "We partner with trusted growers across the Tamil Nadu cashew belt, chosen for soil, harvest practice and consistency.",
    ta: "மண், அறுவடை முறை மற்றும் நிலைத்தன்மைக்காக தேர்ந்தெடுக்கப்பட்ட தமிழ்நாடு முந்திரி பெல்ட் முழுவதும் உள்ள நம்பகமான விவசாயிகளுடன் நாங்கள் இணைந்து பணியாற்றுகிறோம்."
  },
  "quality.step2.index": { en: "Grading", ta: "தரம் பிரித்தல்" },
  "quality.step2.title": { en: "Hand-Sorted", ta: "கையால் தரம் பிரிக்கப்பட்டது" },
  "quality.step2.desc": {
    en: "Every kernel passes through hand-grading — size, colour and breakage checked before anything is packed.",
    ta: "ஒவ்வொரு பருப்பும் கையால் தரம் பிரிக்கப்படுகிறது — பொட்டலமிடுவதற்கு முன் அளவு, நிறம் மற்றும் உடைவு சரிபார்க்கப்படுகிறது."
  },
  "quality.step3.index": { en: "Packing", ta: "பொட்டலமிடுதல்" },
  "quality.step3.title": { en: "Sealed Fresh", ta: "புதியதாக சீல் வைக்கப்பட்டது" },
  "quality.step3.desc": {
    en: "Vacuum-sealed within days of processing, locking in crunch and flavour until it reaches you.",
    ta: "பதப்படுத்திய சில நாட்களுக்குள் வெற்றிடமாக சீல் வைக்கப்படுகிறது, அது உங்களை வந்தடையும் வரை மொறுமொறுப்பையும் சுவையையும் பூட்டி வைக்கிறது."
  },
  "quality.badge1": { en: "FSSAI Licensed", ta: "FSSAI உரிமம் பெற்றது" },
  "quality.badge2": { en: "Lab Tested Batches", ta: "ஆய்வகத்தில் சோதிக்கப்பட்ட தொகுப்புகள்" },
  "quality.badge3": { en: "No Preservatives", ta: "பாதுகாப்புப் பொருட்கள் இல்லை" },

  /* ---------- Homepage: Testimonials ---------- */
  "testimonials.eyebrow": { en: "What Customers Say", ta: "வாடிக்கையாளர்கள் கூறுவது" },
  "testimonials.heading": { en: "Trusted by homes and businesses", ta: "வீடுகள் மற்றும் வணிகங்களால் நம்பப்படுகிறது" },
  "testimonial1.text": {
    en: "\"The freshest cashews I've bought in years. You can actually taste the difference — no staleness at all.\"",
    ta: "\"பல ஆண்டுகளில் நான் வாங்கிய மிகவும் புத்தம் புதிய முந்திரி. வித்தியாசத்தை உண்மையிலேயே சுவைக்க முடியும் — பழமை என்பதே இல்லை.\""
  },
  "testimonial1.author": { en: "— Priya R., Chennai", ta: "— பிரியா R., சென்னை" },
  "testimonial2.text": {
    en: "\"We order our festive gift boxes from Arumbu every year now. Packaging and quality are both excellent.\"",
    ta: "\"இப்போது ஒவ்வொரு ஆண்டும் எங்கள் பண்டிகை பரிசுப் பெட்டிகளை அரும்புவிடமிருந்து ஆர்டர் செய்கிறோம். பொட்டலமும் தரமும் இரண்டும் சிறப்பாக உள்ளன.\""
  },
  "testimonial2.author": { en: "— Karthik S., Coimbatore", ta: "— கார்த்திக் S., கோயம்புத்தூர்" },
  "testimonial3.text": {
    en: "\"As a sweet shop owner, consistency matters most. Arumbu's bulk batches have never let me down.\"",
    ta: "\"ஒரு இனிப்பு கடை உரிமையாளராக, நிலைத்தன்மையே மிக முக்கியம். அரும்புவின் மொத்த தொகுப்புகள் என்னை ஒருபோதும் ஏமாற்றியதில்லை.\""
  },
  "testimonial3.author": { en: "— Meena Stores, Madurai", ta: "— மீனா ஸ்டோர்ஸ், மதுரை" },

  /* ---------- Homepage: Wholesale CTA banner ---------- */
  "wholesaleCta.eyebrow": { en: "For Businesses & Retailers", ta: "வணிகங்கள் & சில்லறை விற்பனையாளர்களுக்கு" },
  "wholesaleCta.heading": { en: "Buying in bulk? Let's talk rates.", ta: "மொத்தமாக வாங்குகிறீர்களா? விலைகளைப் பற்றி பேசலாம்." },
  "wholesaleCta.desc": {
    en: "Sweet shops, gifting companies, exporters and retailers — get wholesale pricing, GST invoicing and consistent batch supply.",
    ta: "இனிப்பு கடைகள், பரிசுப் பொருள் நிறுவனங்கள், ஏற்றுமதியாளர்கள் மற்றும் சில்லறை விற்பனையாளர்கள் — மொத்த விலை, GST பில் மற்றும் நிலையான தொகுப்பு விநியோகத்தைப் பெறுங்கள்."
  },
  "wholesaleCta.button": { en: "Wholesale Enquiry", ta: "மொத்த விற்பனை விசாரணை" },

  /* ---------- Footer ---------- */
  "footer.taglineHome": {
    en: "Premium, farm-fresh cashews from Tamil Nadu.",
    ta: "தமிழ்நாட்டின் பிரீமியம், பண்ணைப் புத்தம் புதிய முந்திரி."
  },
  "footer.taglineOther": {
    en: "Premium, farm-fresh cashews from Tamil Nadu — sorted by hand, sealed for freshness.",
    ta: "தமிழ்நாட்டின் பிரீமியம், பண்ணைப் புத்தம் புதிய முந்திரி — கையால் தரம் பிரிக்கப்பட்டு, புத்தம் புதிதாக சீல் வைக்கப்பட்டது."
  },
  "footer.followUs": { en: "Follow Us", ta: "எங்களைப் பின்தொடருங்கள்" },
  "footer.explore": { en: "Explore", ta: "உலாவுக" },
  "footer.getInTouch": { en: "Get in Touch", ta: "தொடர்பு கொள்ளுங்கள்" },
  "footer.whatsappUs": { en: "WhatsApp Us", ta: "வாட்ஸ்அப் செய்யுங்கள்" },
  "footer.findUs": { en: "Find Us", ta: "எங்களைக் கண்டறியுங்கள்" },
  "footer.copyright": { en: "© 2026 Arumbu Cashews. All rights reserved.", ta: "© 2026 அரும்பு காஜு. அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை." },
  "footer.credit.html": {
    en: "Website created by <span class=\"footer-heart\">&#10084;&#65039;</span> Sanjay Gandhi",
    ta: "இணையதளம் உருவாக்கியவர் <span class=\"footer-heart\">&#10084;&#65039;</span> சஞ்சய் காந்தி"
  },
  "footer.adminLogin": { en: "Admin Login", ta: "நிர்வாகி உள்நுழைவு" },

  "whatsappFloat.aria": { en: "Chat on WhatsApp", ta: "வாட்ஸ்அப்பில் பேசுங்கள்" },
  "backToTop.aria": { en: "Back to top", ta: "மேலே செல்ல" },

  /* ---------- About page ---------- */
  "about.hero.eyebrow": { en: "Our Story", ta: "எங்கள் கதை" },
  "about.hero.title": { en: "From the Cashew Tree to Arumbu Cashews", ta: "முந்திரி மரத்திலிருந்து அரும்பு காஜு வரை" },
  "about.hero.desc": {
    en: "A family journey that began with cashew cultivation and raw cashews, and gradually grew into full-fledged cashew processing.",
    ta: "முந்திரி சாகுபடி மற்றும் பச்சை முந்திரியுடன் தொடங்கிய ஒரு குடும்பப் பயணம், படிப்படியாக முழுமையான முந்திரி பதப்படுத்துதலாக வளர்ந்தது."
  },
  "about.story.eyebrow": { en: "Our Story", ta: "எங்கள் கதை" },
  "about.story.heading": { en: "Roots in cashew cultivation", ta: "முந்திரி சாகுபடியில் வேர்கள்" },
  "about.story.p1": {
    en: "Arumbu Cashews did not begin as a brand entering the cashew business. It began at the cultivation level, with a family that grew cashews and harvested raw cashews directly from the trees.",
    ta: "அரும்பு காஜு முந்திரி வணிகத்தில் நுழையும் ஒரு பிராண்டாகத் தொடங்கவில்லை. இது சாகுபடி மட்டத்தில் தொடங்கியது, முந்திரியை வளர்த்து மரங்களிலிருந்து நேரடியாக பச்சை முந்திரியை அறுவடை செய்த ஒரு குடும்பத்துடன்."
  },
  "about.story.p2": {
    en: "In the early years, the family sold the harvested cashews as raw produce, without processing them into finished kernels. That raw-cashew trade was the foundation of the family's relationship with cashews — years spent understanding the crop before ever processing a single kernel.",
    ta: "ஆரம்ப ஆண்டுகளில், குடும்பம் அறுவடை செய்யப்பட்ட முந்திரியை முடிக்கப்பட்ட பருப்பாக பதப்படுத்தாமல், பச்சை விளைபொருளாக விற்றது. அந்த பச்சை முந்திரி வர்த்தகமே முந்திரியுடனான குடும்பத்தின் உறவின் அடித்தளமாக இருந்தது — ஒரு பருப்பை கூட பதப்படுத்துவதற்கு முன் பயிரைப் புரிந்துகொள்ள செலவழித்த ஆண்டுகள்."
  },
  "about.story.p3": {
    en: "Over time, the business gradually evolved. Arumbu Cashews was started as the family moved towards processing cashews themselves, rather than only selling them raw. Today, that evolution continues — Arumbu Cashews is focused on processing cashews and providing good-quality cashew products.",
    ta: "காலப்போக்கில், வணிகம் படிப்படியாக வளர்ந்தது. குடும்பம் பச்சையாக மட்டும் விற்பதற்குப் பதிலாக, முந்திரியை தாங்களே பதப்படுத்தும் நிலைக்கு நகர்ந்ததால் அரும்பு காஜு தொடங்கப்பட்டது. இன்று, அந்த வளர்ச்சி தொடர்கிறது — அரும்பு காஜு முந்திரியை பதப்படுத்துவதிலும் நல்ல தரமான முந்திரி பொருட்களை வழங்குவதிலும் கவனம் செலுத்துகிறது."
  },
  "about.journey.eyebrow": { en: "The Journey", ta: "பயணம்" },
  "about.journey.heading": { en: "Cultivation to processing", ta: "சாகுபடியிலிருந்து பதப்படுத்துதல் வரை" },
  "about.journey.step1.title": { en: "Roots in Cashew Cultivation", ta: "முந்திரி சாகுபடியில் வேர்கள்" },
  "about.journey.step1.desc": {
    en: "The family's journey began with cashew cultivation and harvesting raw cashews from their own agricultural experience.",
    ta: "குடும்பத்தின் பயணம் முந்திரி சாகுபடி மற்றும் அவர்களது சொந்த விவசாய அனுபவத்திலிருந்து பச்சை முந்திரியை அறுவடை செய்வதுடன் தொடங்கியது."
  },
  "about.journey.step2.title": { en: "Raw Cashew Trade", ta: "பச்சை முந்திரி வர்த்தகம்" },
  "about.journey.step2.desc": {
    en: "The harvested raw cashews were sold as raw produce, without processing them into finished kernels.",
    ta: "அறுவடை செய்யப்பட்ட பச்சை முந்திரி, முடிக்கப்பட்ட பருப்பாக பதப்படுத்தாமல் பச்சை விளைபொருளாக விற்கப்பட்டது."
  },
  "about.journey.step3.title": { en: "A New Beginning", ta: "ஒரு புதிய தொடக்கம்" },
  "about.journey.step3.desc": {
    en: "With the establishment of Arumbu Cashews, the family began moving into cashew processing.",
    ta: "அரும்பு காஜு நிறுவப்பட்டதுடன், குடும்பம் முந்திரி பதப்படுத்துதலுக்கு நகரத் தொடங்கியது."
  },
  "about.journey.step4.title": { en: "Learning & Growing", ta: "கற்றல் & வளர்ச்சி" },
  "about.journey.step4.desc": {
    en: "The transition from raw cashew sales to processing happened gradually, building experience at every stage.",
    ta: "பச்சை முந்திரி விற்பனையிலிருந்து பதப்படுத்துதலுக்கான மாற்றம் படிப்படியாக நடந்தது, ஒவ்வொரு கட்டத்திலும் அனுபவத்தை உருவாக்கியது."
  },
  "about.journey.step5.title": { en: "Processing Today", ta: "இன்றைய பதப்படுத்துதல்" },
  "about.journey.step5.desc": {
    en: "Today, Arumbu Cashews is focused on full-fledged cashew processing and supplying quality cashew grades.",
    ta: "இன்று, அரும்பு காஜு முழுமையான முந்திரி பதப்படுத்துதலிலும், தரமான முந்திரி வகைகளை வழங்குவதிலும் கவனம் செலுத்துகிறது."
  },
  "about.people.eyebrow": { en: "The People Behind Arumbu", ta: "அரும்புவின் பின்னணியில் உள்ளவர்கள்" },
  "about.people.heading": { en: "A family name", ta: "ஒரு குடும்பப் பெயர்" },
  "about.people.card1.title": { en: "Mr. Shivakumar", ta: "திரு. சிவகுமார்" },
  "about.people.card1.desc": {
    en: "Founder of Arumbu Cashews, carrying forward the family's journey with cashews — from cultivation to processing.",
    ta: "அரும்பு காஜுவின் நிறுவனர், முந்திரியுடனான குடும்பத்தின் பயணத்தை — சாகுபடியிலிருந்து பதப்படுத்துதல் வரை — முன்னெடுத்துச் செல்கிறார்."
  },
  "about.people.card2.title": { en: "Mr. Lakshmanaperumal", ta: "திரு. லக்ஷ்மணபெருமாள்" },
  "about.people.card2.desc": {
    en: "Shivakumar's father, part of the family's early journey with cashew cultivation and raw cashews.",
    ta: "சிவகுமாரின் தந்தை, முந்திரி சாகுபடி மற்றும் பச்சை முந்திரியுடனான குடும்பத்தின் ஆரம்ப பயணத்தின் ஒரு பகுதி."
  },
  "about.people.card3.title": { en: "The name Arumbu", ta: "அரும்பு என்ற பெயர்" },
  "about.people.card3.desc": {
    en: "The name \"Arumbu\" comes from Shivakumar's mother. The business is named Arumbu Cashews in her memory.",
    ta: "\"அரும்பு\" என்ற பெயர் சிவகுமாரின் தாயாரிடமிருந்து வந்தது. அவரது நினைவாக இந்த வணிகம் அரும்பு காஜு என பெயரிடப்பட்டுள்ளது."
  },
  "about.raw.eyebrow": { en: "From Raw to Processed", ta: "பச்சையிலிருந்து பதப்படுத்தப்பட்டது வரை" },
  "about.raw.heading": { en: "A gradual transition", ta: "ஒரு படிப்படியான மாற்றம்" },
  "about.raw.p1": {
    en: "The move from raw cashew trading to processing did not happen overnight. It happened gradually, one stage at a time — learning how the cashew behaves at every step, from harvest to the finished kernel.",
    ta: "பச்சை முந்திரி வர்த்தகத்திலிருந்து பதப்படுத்துதலுக்கான மாற்றம் ஒரே இரவில் நடக்கவில்லை. இது படிப்படியாக, ஒரு கட்டத்திற்குப் பிறகு ஒரு கட்டமாக நடந்தது — அறுவடையிலிருந்து முடிக்கப்பட்ட பருப்பு வரை ஒவ்வொரு படியிலும் முந்திரி எப்படி நடந்துகொள்கிறது என்பதைக் கற்றுக்கொள்வது."
  },
  "about.raw.p2": {
    en: "That gradual approach means Arumbu Cashews understands cashews from their origin through to processing, not just from the processing floor.",
    ta: "அந்த படிப்படியான அணுகுமுறை என்பது, அரும்பு காஜு முந்திரியை பதப்படுத்தும் தளத்திலிருந்து மட்டுமல்ல, அதன் தோற்றம் முதல் பதப்படுத்துதல் வரை புரிந்துகொள்கிறது என்பதாகும்."
  },
  "about.philosophy.eyebrow": { en: "Our Philosophy", ta: "எங்கள் தத்துவம்" },
  "about.philosophy.heading": { en: "From the tree to the finished kernel", ta: "மரத்திலிருந்து முடிக்கப்பட்ட பருப்பு வரை" },
  "about.philosophy.p1": {
    en: "We believe quality begins with understanding the raw cashew. Because the family has been connected with cashew cultivation and raw cashews, the business understands that good finished cashews begin with good raw material and careful processing.",
    ta: "தரம் என்பது பச்சை முந்திரியைப் புரிந்துகொள்வதிலிருந்து தொடங்குகிறது என நாங்கள் நம்புகிறோம். குடும்பம் முந்திரி சாகுபடி மற்றும் பச்சை முந்திரியுடன் தொடர்புடையதாக இருந்ததால், நல்ல முடிக்கப்பட்ட முந்திரி நல்ல மூலப்பொருள் மற்றும் கவனமான பதப்படுத்துதலில் தொடங்குகிறது என்பதை இந்த வணிகம் புரிந்துகொள்கிறது."
  },
  "about.commitment.eyebrow": { en: "Our Commitment", ta: "எங்கள் உறுதிப்பாடு" },
  "about.commitment.heading": { en: "A good product should speak for itself", ta: "ஒரு நல்ல பொருள் தானாகவே பேச வேண்டும்" },
  "about.commitment.p1": {
    en: "Arumbu Cashews is being built with a simple intention: to provide properly processed, carefully handled and good-quality cashew products.",
    ta: "அரும்பு காஜு ஒரு எளிய நோக்கத்துடன் கட்டமைக்கப்படுகிறது: முறையாக பதப்படுத்தப்பட்ட, கவனமாக கையாளப்பட்ட, நல்ல தரமான முந்திரி பொருட்களை வழங்குவது."
  },
  "about.commitment.p2": {
    en: "The focus is not only on selling cashews, but on continuously improving the product and giving customers a quality product they can trust.",
    ta: "கவனம் முந்திரியை விற்பதில் மட்டும் இல்லை, மாறாக தொடர்ந்து பொருளை மேம்படுத்தி வாடிக்கையாளர்களுக்கு நம்பக்கூடிய தரமான பொருளை வழங்குவதிலும் உள்ளது."
  },
  "about.why.eyebrow": { en: "Why Arumbu Cashews", ta: "ஏன் அரும்பு காஜு" },
  "about.why.heading": { en: "What sets us apart", ta: "எங்களை வேறுபடுத்துவது என்ன" },
  "about.why.card1.title": { en: "Rooted in Cultivation", ta: "சாகுபடியில் வேரூன்றியது" },
  "about.why.card1.desc": { en: "Our journey began with cashew cultivation and raw cashews.", ta: "எங்கள் பயணம் முந்திரி சாகுபடி மற்றும் பச்சை முந்திரியுடன் தொடங்கியது." },
  "about.why.card2.title": { en: "From Raw to Processed", ta: "பச்சையிலிருந்து பதப்படுத்தப்பட்டது வரை" },
  "about.why.card2.desc": { en: "We gradually moved from selling raw cashews to processing cashews ourselves.", ta: "பச்சை முந்திரியை விற்பதிலிருந்து அதை நாங்களே பதப்படுத்துவதற்கு படிப்படியாக நகர்ந்தோம்." },
  "about.why.card3.title": { en: "Family-Led Journey", ta: "குடும்பம் வழிநடத்தும் பயணம்" },
  "about.why.card3.desc": { en: "Arumbu Cashews carries forward a family journey built around cashews.", ta: "அரும்பு காஜு முந்திரியை மையமாகக் கொண்ட ஒரு குடும்பப் பயணத்தை முன்னெடுத்துச் செல்கிறது." },
  "about.why.card4.title": { en: "Quality First", ta: "தரமே முதன்மை" },
  "about.why.card4.desc": { en: "Our focus is on giving customers a properly processed and good-quality product.", ta: "முறையாக பதப்படுத்தப்பட்ட, நல்ல தரமான பொருளை வாடிக்கையாளர்களுக்கு வழங்குவதே எங்கள் கவனம்." },
  "about.cta.heading": { en: "Explore Our Cashew Range", ta: "எங்கள் முந்திரி வரம்பை ஆராயுங்கள்" },
  "about.cta.button": { en: "See Our Products", ta: "எங்கள் பொருட்களைக் காண்க" },

  /* ---------- Products page ---------- */
  "products.page.eyebrow": { en: "Full Range", ta: "முழு வரம்பு" },
  "products.page.heading": { en: "Every Arumbu Cashews grade", ta: "ஒவ்வொரு அரும்பு காஜு தரமும்" },
  "products.page.desc": {
    en: "Hand-sorted at source in Panruti, Tamil Nadu. Choose your grade below and order directly on WhatsApp.",
    ta: "தமிழ்நாடு பன்ருட்டியில் மூலத்திலேயே கையால் தரம் பிரிக்கப்படுகிறது. கீழே உங்கள் தரத்தைத் தேர்ந்தெடுத்து நேரடியாக வாட்ஸ்அப்பில் ஆர்டர் செய்யுங்கள்."
  },

  /* ---------- Wholesale page ---------- */
  "wholesale.eyebrow": { en: "For Businesses & Retailers", ta: "வணிகங்கள் & சில்லறை விற்பனையாளர்களுக்கு" },
  "wholesale.heading": { en: "WHOLESALE ENQUIRY", ta: "மொத்த விற்பனை விசாரணை" },
  "wholesale.desc": {
    en: "Looking to buy cashews in bulk? Send us a short enquiry and our team will get in touch with you.",
    ta: "முந்திரியை மொத்தமாக வாங்க விரும்புகிறீர்களா? எங்களுக்கு ஒரு சிறிய விசாரணையை அனுப்புங்கள், எங்கள் குழு உங்களைத் தொடர்பு கொள்ளும்."
  },
  "wholesale.form.name": { en: "Full Name", ta: "முழுப் பெயர்" },
  "wholesale.form.namePlaceholder": { en: "Your full name", ta: "உங்கள் முழுப் பெயர்" },
  "wholesale.form.company": { en: "Company / Business Name", ta: "நிறுவனம் / வணிகப் பெயர்" },
  "wholesale.form.optional": { en: "Optional", ta: "விருப்பத்தேர்வு" },
  "wholesale.form.phone": { en: "Phone Number", ta: "தொலைபேசி எண்" },
  "wholesale.form.whatsapp": { en: "WhatsApp Number", ta: "வாட்ஸ்அப் எண்" },
  "wholesale.form.whatsappPlaceholder": { en: "If different from phone", ta: "தொலைபேசியிலிருந்து வேறுபட்டால்" },
  "wholesale.form.email": { en: "Email Address", ta: "மின்னஞ்சல் முகவரி" },
  "wholesale.form.grade": { en: "Cashew Grade / Product", ta: "முந்திரி தரம் / பொருள்" },
  "wholesale.form.gradeOther": { en: "Other / Multiple Grades", ta: "மற்றவை / பல தரங்கள்" },
  "wholesale.form.quantity": { en: "Quantity Required", ta: "தேவையான அளவு" },
  "wholesale.form.quantityPlaceholder": { en: "e.g. 500 kg / month", ta: "எ.கா. 500 கிலோ / மாதம்" },
  "wholesale.form.message": { en: "Message / Requirement", ta: "செய்தி / தேவை" },
  "wholesale.form.messagePlaceholder": { en: "Tell us a bit about what you need", ta: "உங்களுக்கு என்ன தேவை என்பதைப் பற்றி எங்களிடம் கூறுங்கள்" },
  "wholesale.form.submit": { en: "SEND WHOLESALE ENQUIRY", ta: "மொத்த விற்பனை விசாரணையை அனுப்பு" },
  "wholesale.success.heading": { en: "Thank you for your enquiry.", ta: "உங்கள் விசாரணைக்கு நன்றி." },
  "wholesale.success.desc": { en: "Our team will get in touch with you shortly.", ta: "எங்கள் குழு விரைவில் உங்களைத் தொடர்பு கொள்ளும்." },
  "form.phonePlaceholder": { en: "+91", ta: "+91" },
  "form.required": { en: "*", ta: "*" },

  /* ---------- Contact page ---------- */
  "contact.hero.eyebrow": { en: "Contact", ta: "தொடர்பு" },
  "contact.hero.title": { en: "Get in Touch", ta: "தொடர்பு கொள்ளுங்கள்" },
  "contact.hero.desc": {
    en: "Questions about our cashews, an order, or anything else — reach us directly or send a message below.",
    ta: "எங்கள் முந்திரி, ஒரு ஆர்டர் அல்லது வேறு எதைப் பற்றியும் கேள்விகள் — எங்களை நேரடியாக அணுகவும் அல்லது கீழே ஒரு செய்தியை அனுப்பவும்."
  },
  "contact.method.callNow": { en: "Call Now", ta: "இப்போது அழைக்கவும்" },
  "contact.method.additionalNumber": { en: "Additional Number", ta: "கூடுதல் எண்" },
  "contact.method.whatsapp": { en: "WhatsApp", ta: "வாட்ஸ்அப்" },
  "contact.method.whatsappUs": { en: "WhatsApp Us", ta: "வாட்ஸ்அப் செய்யுங்கள்" },
  "contact.method.emailUs": { en: "Email Us", ta: "மின்னஞ்சல் அனுப்புங்கள்" },
  "contact.form.name": { en: "Name", ta: "பெயர்" },
  "contact.form.namePlaceholder": { en: "Your name", ta: "உங்கள் பெயர்" },
  "contact.form.phone": { en: "Phone", ta: "தொலைபேசி" },
  "contact.form.email": { en: "Email", ta: "மின்னஞ்சல்" },
  "contact.form.message": { en: "Message", ta: "செய்தி" },
  "contact.form.messagePlaceholder": { en: "How can we help?", ta: "நாங்கள் எப்படி உதவ முடியும்?" },
  "contact.form.submit": { en: "SEND MESSAGE", ta: "செய்தியை அனுப்பு" },
  "contact.success.heading": { en: "Thank you for reaching out.", ta: "தொடர்பு கொண்டதற்கு நன்றி." },
  "contact.success.desc": { en: "Our team will get in touch with you shortly.", ta: "எங்கள் குழு விரைவில் உங்களைத் தொடர்பு கொள்ளும்." },

  /* ---------- Cashew grade full names (used in search predictions) ----------
     Grade CODES themselves (WW180, SW, JK, etc.) are never translated —
     only the descriptive full name next to them. */
  "grade.WW180": { en: "White Wholes 180", ta: "வெள்ளை முழு பருப்பு 180" },
  "grade.WW210": { en: "White Wholes 210", ta: "வெள்ளை முழு பருப்பு 210" },
  "grade.WW240": { en: "White Wholes 240", ta: "வெள்ளை முழு பருப்பு 240" },
  "grade.WW320": { en: "White Wholes 320", ta: "வெள்ளை முழு பருப்பு 320" },
  "grade.WW400": { en: "White Wholes 400", ta: "வெள்ளை முழு பருப்பு 400" },
  "grade.SW": { en: "Scorched Wholes", ta: "வறுத்த முழு பருப்பு" },
  "grade.SSW": { en: "Scorched Second Wholes", ta: "வறுத்த இரண்டாம் தர முழு பருப்பு" },
  "grade.LWP": { en: "Large White Pieces", ta: "பெரிய வெள்ளை துண்டுகள்" },
  "grade.CSP": { en: "Cashew Small Pieces", ta: "சிறிய முந்திரி துண்டுகள்" },
  "grade.BB": { en: "Baby Bits", ta: "சிறு துணுக்குகள்" },
  "grade.JH": { en: "Jumbo Halves", ta: "ஜம்போ பாதி பருப்பு" },
  "grade.SJH": { en: "Scorched Jumbo Halves", ta: "வறுத்த ஜம்போ பாதி பருப்பு" },
  "grade.JK": { en: "Jumbo Kudka", ta: "ஜம்போ குட்கா" }

};

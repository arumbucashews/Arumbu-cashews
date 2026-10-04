/* Arumbu Cashews — admin-managed pages: legal pages (`pages` table)
   and the FAQ (`faqs` table). Body text is plain text: paragraphs are
   separated by blank lines, and a line starting with "## " is a
   heading. No HTML from the database is ever injected. */
(function () {
  'use strict';
  var S = window.ArumbuStore;
  if (!S) return;
  var esc = S.esc;
  var pageData = null, faqData = null;

  function toHtml(text) {
    return String(text || '').replace(/\r\n/g, '\n').split(/\n{2,}/).map(function (block) {
      block = block.trim();
      if (!block) return '';
      if (/^##\s+/.test(block)) return '<h2>' + esc(block.replace(/^##\s+/, '')) + '</h2>';
      if (/^[-•]\s+/m.test(block) && block.split('\n').every(function (l) { return /^[-•]\s+/.test(l.trim()); })) {
        return '<ul>' + block.split('\n').map(function (l) { return '<li>' + esc(l.trim().replace(/^[-•]\s+/, '')) + '</li>'; }).join('') + '</ul>';
      }
      return '<p>' + esc(block) + '</p>';
    }).join('');
  }

  var body = document.getElementById('pgBody');
  function renderPage() {
    if (!body) return;
    var ta = S.lang() === 'ta';
    var d = pageData;
    var text = d && ((ta && d.body_ta) || d.body_en);
    var pending = document.getElementById('pgPending');
    if (text) {
      body.innerHTML = toHtml(text) + (d.updated_at ? '<p class="updated">' + esc(S.t('legal.updated', 'Last updated')) + ': ' + esc(String(d.updated_at).slice(0, 10)) + '</p>' : '');
      if (pending) pending.hidden = true;
    } else {
      body.innerHTML = '';
      if (pending) pending.hidden = false;
    }
    var title = document.getElementById('pgTitle');
    if (title && d && (d.title_en || d.title_ta)) title.textContent = (ta && d.title_ta) || d.title_en;
    if (d && d.seo_title) document.title = d.seo_title;
  }

  function renderFaq() {
    var box = document.getElementById('faqList');
    if (!box) return;
    var ta = S.lang() === 'ta';
    var list = faqData || [];
    document.getElementById('faqEmpty').hidden = list.length > 0;
    box.innerHTML = list.map(function (f) {
      return '<details><summary>' + esc((ta && f.question_ta) || f.question_en) + '</summary><p>' + esc((ta && f.answer_ta) || f.answer_en) + '</p></details>';
    }).join('');
    // FAQPage structured data — only from real, published FAQs.
    var old = document.getElementById('faqLd');
    if (old) old.remove();
    if (list.length) {
      var s = document.createElement('script');
      s.type = 'application/ld+json'; s.id = 'faqLd';
      s.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: list.map(function (f) {
        return { '@type': 'Question', name: f.question_en, acceptedAnswer: { '@type': 'Answer', text: f.answer_en } };
      }) });
      document.head.appendChild(s);
    }
  }

  if (!S.client) { renderPage(); if (document.getElementById('faqList')) { faqData = []; renderFaq(); } return; }

  if (body) {
    S.client.from('pages').select('slug, title_en, title_ta, body_en, body_ta, seo_title, seo_description, updated_at')
      .eq('slug', body.getAttribute('data-page-slug')).maybeSingle()
      .then(function (res) { pageData = res.data || null; renderPage(); }, function () { renderPage(); });
  }
  if (document.getElementById('faqList')) {
    S.client.from('faqs').select('question_en, question_ta, answer_en, answer_ta, display_order').order('display_order')
      .then(function (res) { faqData = res.data || []; renderFaq(); }, function () { faqData = []; renderFaq(); });
  }
  document.addEventListener('arumbu:lang', function () { if (body) renderPage(); if (faqData) renderFaq(); });
})();

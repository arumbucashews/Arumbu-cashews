/* Arumbu Cashews — Admin: Website text, founder, legal pages & FAQ.
   - content_blocks: homepage text keyed by the site's translation keys.
     Saved text replaces the built-in wording on the live site, in
     English and Tamil. Empty = keep the built-in wording.
   - pages: Privacy, Terms, Shipping, Refund, Gifting intro (plain text;
     blank line = new paragraph, "## " = heading, "- " = bullet).
   - faqs: questions & answers (EN/TA), ordered, publish toggle. */
(function () {
  'use strict';
  var A = window.ArumbuAdmin;
  var root = document.getElementById('cmsRoot');
  if (!A || !root) return;
  var esc = A.esc;
  var state = { tab: 'text', blocks: [], pages: [], faqs: [] };

  var GROUPS = [
    ['Our Grades', /^grades\./],
    ['Founder', /^founder\./],
    ['Why Arumbu', /^why/],
    ['Wholesale banner', /^wholesalecta\./],
    ['Contact section', /^contactv2\./],
    ['Footer', /^footer\./]
  ];
  var NICE = {
    'founder.p1': 'Journey step 1 — People', 'founder.p3': 'Journey step 2 — Heritage', 'founder.p2': 'Journey step 3 — Brand',
    'founder.p4': 'Journey step 4 — Product', 'founder.quote': 'Pull quote', 'founder.lede': 'Intro line', 'founder.image': 'Founder photo (storage path)'
  };

  function shell() {
    var tabs = [['text', 'Homepage text'], ['founder', 'Founder photo'], ['pages', 'Policy pages'], ['faqs', 'FAQ']];
    root.innerHTML = '<div class="content-subtabs">' + tabs.map(function (t) {
      return '<button type="button" class="content-subtab' + (state.tab === t[0] ? ' is-active' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div><div id="cmsPanel"><div class="products-message">Loading…</div></div>';
    root.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); shell(); render(); }); });
  }

  function render() {
    var p = document.getElementById('cmsPanel');
    if (state.tab === 'text') return renderText(p);
    if (state.tab === 'founder') return renderFounder(p);
    if (state.tab === 'pages') return renderPages(p);
    if (state.tab === 'faqs') return renderFaqs(p);
  }

  /* ---------- homepage text ---------- */
  function renderText(p) {
    var blocks = state.blocks.filter(function (b) { return b.key !== 'founder.image'; });
    var html = '<p class="cell-muted admin-help">Changes appear on the live homepage after saving (refresh the page). For headings ending in “.html”, wrap words in &lt;em&gt;…&lt;/em&gt; for the gold italic accent — no other HTML is allowed. Leave Tamil empty to show the English text.</p>';
    GROUPS.forEach(function (g) {
      var items = blocks.filter(function (b) { return g[1].test(b.key); });
      if (!items.length) return;
      html += '<div class="content-card"><h3>' + g[0] + '</h3>' + items.map(function (b) {
        var long = String(b.value_en || '').length > 70;
        var tag = function (id, v) { return long ? '<textarea id="' + id + '" rows="3">' + esc(v || '') + '</textarea>' : '<input id="' + id + '" value="' + esc(v || '') + '">'; };
        var safe = b.key.replace(/[^a-z0-9]/gi, '_');
        return '<div class="cms-block" data-key="' + esc(b.key) + '"><div class="cms-block-head"><strong>' + esc(NICE[b.key] || A.label(b.key.split('.').slice(1).join(' '))) + '</strong> <code>' + esc(b.key) + '</code></div>' +
          '<div class="product-form-grid"><div class="form-field"><label for="en_' + safe + '">English</label>' + tag('en_' + safe, b.value_en) + '</div>' +
          '<div class="form-field"><label for="ta_' + safe + '">தமிழ்</label>' + tag('ta_' + safe, b.value_ta) + '</div></div>' +
          '<div class="content-save-bar"><button type="button" class="social-link-save-btn" data-save>Save</button><span class="upload-status" data-st></span></div></div>';
      }).join('') + '</div>';
    });
    p.innerHTML = html;
    p.querySelectorAll('.cms-block').forEach(function (el) {
      el.querySelector('[data-save]').addEventListener('click', function () {
        var key = el.getAttribute('data-key'), safe = key.replace(/[^a-z0-9]/gi, '_');
        var en = el.querySelector('#en_' + safe).value.trim(), ta = el.querySelector('#ta_' + safe).value.trim();
        if (/\.html$/.test(key) && /<(?!\/?em>)[^>]*>/i.test(en + ta)) return status(el, 'Only <em>…</em> is allowed here.', true);
        if (!en) return status(el, 'English text cannot be empty.', true);
        var btn = this; btn.disabled = true;
        A.client().from('content_blocks').update({ value_en: en, value_ta: ta || null }).eq('key', key).then(function (res) {
          btn.disabled = false;
          status(el, res.error ? A.errMsg(res.error) : 'Saved.', !!res.error);
        });
      });
    });
  }
  function status(el, msg, err) { var s = el.querySelector('[data-st]'); s.textContent = msg; s.className = 'upload-status ' + (err ? 'is-error' : 'is-success'); }

  /* ---------- founder photo ---------- */
  function renderFounder(p) {
    var b = state.blocks.filter(function (x) { return x.key === 'founder.image'; })[0];
    var path = b && b.value_en;
    var src = path ? (/^images\//.test(path) ? '../' + path : A.client().storage.from('media').getPublicUrl(path).data.publicUrl) : '../images/founder-sivakumar.jpg';
    p.innerHTML = '<div class="content-card"><h3>Founder photo</h3><p class="cell-muted admin-help">The photo is shown uncropped in its frame on the homepage. Use a portrait JPEG/PNG/WebP under 5 MB.</p>' +
      '<div class="upload-field"><img class="upload-preview is-product-photo" style="width:120px;height:140px;object-fit:contain" id="fdPrev" src="' + esc(src) + '" alt="Current founder photo">' +
      '<div><input type="file" id="fdFile" accept="image/jpeg,image/png,image/webp"><div class="upload-status" id="fdSt"></div>' +
      (path && !/^images\//.test(path) ? '<button type="button" class="product-form-cancel" id="fdReset" style="margin-top:.6rem">Use the original photo</button>' : '') + '</div></div></div>';
    document.getElementById('fdFile').addEventListener('change', function (e) {
      var f = e.target.files[0]; var st = document.getElementById('fdSt');
      if (!f) return;
      if (['image/jpeg', 'image/png', 'image/webp'].indexOf(f.type) === -1 || f.size > 5 * 1024 * 1024) { st.textContent = 'Use a JPEG, PNG or WebP under 5 MB.'; st.className = 'upload-status is-error'; return; }
      var path2 = 'founder/founder-' + Date.now() + '.' + (f.type.split('/')[1] === 'jpeg' ? 'jpg' : f.type.split('/')[1]);
      st.textContent = 'Uploading…'; st.className = 'upload-status';
      A.client().storage.from('media').upload(path2, f, { contentType: f.type }).then(function (up) {
        if (up.error) { st.textContent = 'Upload failed: ' + up.error.message; st.className = 'upload-status is-error'; return; }
        return saveFounder(path2).then(function () { st.textContent = 'Updated.'; st.className = 'upload-status is-success'; });
      });
    });
    var r = document.getElementById('fdReset');
    if (r) r.addEventListener('click', function () { saveFounder('images/founder-sivakumar.jpg'); });
  }
  function saveFounder(path) {
    return A.client().from('content_blocks').upsert({ key: 'founder.image', value_en: path, value_ta: null }, { onConflict: 'key' }).then(function (res) {
      if (res.error) return A.toast(A.errMsg(res.error), true);
      return load().then(render);
    });
  }

  /* ---------- policy pages ---------- */
  function renderPages(p) {
    p.innerHTML = '<p class="cell-muted admin-help">Plain text only. Leave a blank line between paragraphs; start a line with “## ” for a heading or “- ” for a bullet. Until a page has text, the site shows a “being finalised — contact us” note. Please have policy text reviewed before publishing.</p>' +
      state.pages.map(function (pg) {
        return '<div class="content-card" data-slug="' + esc(pg.slug) + '"><h3>' + esc(pg.title_en) + ' <code>/' + esc(pg.slug) + '</code></h3>' +
          '<div class="product-form-grid">' +
            '<div class="form-field"><label>Title (English)</label><input data-f="title_en" value="' + esc(pg.title_en) + '"></div>' +
            '<div class="form-field"><label>Title (தமிழ்)</label><input data-f="title_ta" value="' + esc(pg.title_ta || '') + '"></div>' +
            '<div class="form-field form-field-full"><label>Text (English)</label><textarea data-f="body_en" rows="8">' + esc(pg.body_en || '') + '</textarea></div>' +
            '<div class="form-field form-field-full"><label>Text (தமிழ்)</label><textarea data-f="body_ta" rows="6">' + esc(pg.body_ta || '') + '</textarea></div>' +
            '<div class="form-field"><label>SEO title</label><input data-f="seo_title" maxlength="70" value="' + esc(pg.seo_title || '') + '"></div>' +
            '<div class="form-field"><label>SEO description</label><input data-f="seo_description" maxlength="160" value="' + esc(pg.seo_description || '') + '"></div>' +
            '<div class="product-form-checks"><label class="product-form-check"><input type="checkbox" data-f="is_published"' + (pg.is_published ? ' checked' : '') + '> Published</label></div>' +
          '</div><div class="content-save-bar"><button type="button" class="social-link-save-btn" data-save>Save page</button><span class="upload-status" data-st></span>' +
          '<a class="cell-muted" href="../' + esc(pg.slug) + '.html" target="_blank" rel="noopener">View page ↗</a></div></div>';
      }).join('');
    p.querySelectorAll('[data-slug]').forEach(function (card) {
      card.querySelector('[data-save]').addEventListener('click', function () {
        var v = function (f) { var el = card.querySelector('[data-f="' + f + '"]'); return el.type === 'checkbox' ? el.checked : el.value.trim(); };
        if (!v('title_en')) return status(card, 'English title is required.', true);
        A.client().from('pages').update({ title_en: v('title_en'), title_ta: v('title_ta') || null, body_en: v('body_en') || null, body_ta: v('body_ta') || null,
          seo_title: v('seo_title') || null, seo_description: v('seo_description') || null, is_published: v('is_published') })
          .eq('slug', card.getAttribute('data-slug')).then(function (res) { status(card, res.error ? A.errMsg(res.error) : 'Saved.', !!res.error); });
      });
    });
  }

  /* ---------- FAQ ---------- */
  function renderFaqs(p) {
    p.innerHTML = '<div class="products-toolbar"><span class="products-count">' + state.faqs.length + ' questions</span><button type="button" class="products-add-btn" id="faqAdd">Add question</button></div>' +
      (state.faqs.length ? '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>#</th><th>Question</th><th>Published</th><th></th></tr></thead><tbody>' +
        state.faqs.map(function (f) {
          return '<tr><td>' + esc(f.display_order) + '</td><td>' + esc(f.question_en) + (f.question_ta ? '<div class="cell-muted">' + esc(f.question_ta) + '</div>' : '') + '</td><td>' + (f.is_published ? 'Yes' : 'No') + '</td>' +
            '<td class="cell-actions"><button type="button" class="product-form-cancel" data-edit="' + esc(f.id) + '">Edit</button> <button type="button" class="product-form-cancel" data-del="' + esc(f.id) + '">Delete</button></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="products-message">No questions yet. Only add answers you have confirmed — they are shown publicly and in search results.</div>');
    document.getElementById('faqAdd').addEventListener('click', function () { faqForm(null); });
    p.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { faqForm(state.faqs.filter(function (f) { return f.id === b.getAttribute('data-edit'); })[0]); }); });
    p.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!window.confirm('Delete this question?')) return;
        A.client().from('faqs').delete().eq('id', b.getAttribute('data-del')).then(function (res) { if (res.error) return A.toast(A.errMsg(res.error), true); load().then(render); });
      });
    });
  }
  function faqForm(f) {
    f = f || { question_en: '', question_ta: '', answer_en: '', answer_ta: '', display_order: state.faqs.length + 1, is_published: true };
    var m = A.modal({ title: f.id ? 'Edit question' : 'Add question', body:
      '<p class="product-form-error" id="fqErr"></p><div class="product-form-grid">' +
      '<div class="form-field form-field-full"><label>Question (English)</label><input id="fqQe" value="' + esc(f.question_en) + '" maxlength="300"></div>' +
      '<div class="form-field form-field-full"><label>Answer (English)</label><textarea id="fqAe" rows="4" maxlength="3000">' + esc(f.answer_en) + '</textarea></div>' +
      '<div class="form-field form-field-full"><label>Question (தமிழ்)</label><input id="fqQt" value="' + esc(f.question_ta || '') + '" maxlength="300"></div>' +
      '<div class="form-field form-field-full"><label>Answer (தமிழ்)</label><textarea id="fqAt" rows="4" maxlength="3000">' + esc(f.answer_ta || '') + '</textarea></div>' +
      '<div class="form-field"><label>Order</label><input id="fqOrd" type="number" value="' + esc(f.display_order) + '"></div>' +
      '<div class="product-form-checks"><label class="product-form-check"><input type="checkbox" id="fqPub"' + (f.is_published ? ' checked' : '') + '> Published</label></div>' +
      '<div class="product-form-actions"><button type="button" class="product-form-cancel" data-close>Cancel</button><button type="button" class="product-form-submit" id="fqSave">Save</button></div></div>' });
    m.querySelector('#fqSave').addEventListener('click', function () {
      var row = { question_en: m.querySelector('#fqQe').value.trim(), answer_en: m.querySelector('#fqAe').value.trim(), question_ta: m.querySelector('#fqQt').value.trim() || null,
        answer_ta: m.querySelector('#fqAt').value.trim() || null, display_order: parseInt(m.querySelector('#fqOrd').value, 10) || 0, is_published: m.querySelector('#fqPub').checked };
      if (!row.question_en || !row.answer_en) { var e = m.querySelector('#fqErr'); e.textContent = 'English question and answer are required.'; e.classList.add('is-visible'); return; }
      (f.id ? A.client().from('faqs').update(row).eq('id', f.id) : A.client().from('faqs').insert(row)).then(function (res) {
        if (res.error) { var e2 = m.querySelector('#fqErr'); e2.textContent = A.errMsg(res.error); e2.classList.add('is-visible'); return; }
        A.closeModal(); A.toast('Saved'); load().then(render);
      });
    });
  }

  function load() {
    return Promise.all([
      A.client().from('content_blocks').select('*').order('key'),
      A.client().from('pages').select('*').order('slug'),
      A.client().from('faqs').select('*').order('display_order')
    ]).then(function (r) {
      state.blocks = r[0].data || []; state.pages = r[1].data || []; state.faqs = r[2].data || [];
      var err = r[0].error || r[1].error || r[2].error;
      if (err) document.getElementById('cmsPanel').innerHTML = '<div class="products-message is-error">' + esc(A.errMsg(err)) + '</div>';
    });
  }

  var started = false;
  A.onSection('cms', function () { if (!started) { started = true; shell(); } load().then(render); });
})();

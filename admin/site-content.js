/* Arumbu Cashews — Admin Site Content CMS
   ---------------------------------------------------------------
   Real reads/writes against:
     public.hero_settings   (singleton — one active row)
     public.about_content   (6 fixed section_key rows, edit only)
     public.social_links    (4 fixed platform rows, edit only)
     public.site_settings   (9 fixed key/value rows, edit only)
   Storage: the "media" bucket (public read, admin write — same
   bucket already created by 0004_storage_buckets.sql).

   None of these tables support arbitrary add/delete from this CMS —
   the schema seeds a fixed shape for each (fixed section_keys,
   fixed platforms, fixed setting keys), so this file only ever
   edits existing rows. That matches "use the existing structure",
   not a new one.

   Reuses the same authenticated Supabase client via
   window.ArumbuAdminAuth. */

(function () {
  'use strict';

  var root = document.getElementById('siteContentRoot');
  if (!root) { return; }

  var SETTINGS_ORDER = [
    'business_name', 'primary_phone', 'secondary_phone', 'whatsapp_number',
    'email', 'address', 'google_maps_url', 'working_hours', 'footer_credit'
  ];
  var SETTINGS_LABELS = {
    business_name: 'Business name', primary_phone: 'Primary phone', secondary_phone: 'Secondary phone',
    whatsapp_number: 'WhatsApp number', email: 'Email', address: 'Address',
    google_maps_url: 'Google Maps URL', working_hours: 'Working hours', footer_credit: 'Footer credit'
  };

  var IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  var VIDEO_TYPES = ['video/mp4'];

  var state = {
    loading: true,
    error: null,
    activePanel: 'hero',
    currentUserId: null,
    hero: null,
    about: [],
    social: [],
    settings: []
  };

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function client() { return window.ArumbuAdminAuth.getClient(); }

  function publicMediaUrl(path) {
    if (!path) { return null; }
    return client().storage.from('media').getPublicUrl(path).data.publicUrl;
  }

  function extFromFile(file) {
    var m = /\.([a-zA-Z0-9]+)$/.exec(file.name);
    return m ? m[1].toLowerCase() : 'bin';
  }

  function recordMedia(file, storagePath, category) {
    client().from('media').insert({
      file_name: file.name,
      file_type: file.type,
      storage_path: storagePath,
      bucket: 'media',
      category: category,
      uploaded_by: state.currentUserId
    }).then(function (res) {
      if (res.error) { console.warn('media library record failed:', res.error.message); }
    });
  }

  // ---------------------------------------------------------------
  // Root render — loading / error / subtabs + panels
  // ---------------------------------------------------------------

  function renderRoot() {
    if (state.loading) {
      root.innerHTML = '<div class="products-message">Loading site content…</div>';
      return;
    }
    if (state.error) {
      root.innerHTML =
        '<div class="products-message is-error">' + escapeHtml(state.error) +
        '<br><button type="button" class="retry-btn" id="contentRetryBtn">Try again</button></div>';
      document.getElementById('contentRetryBtn').addEventListener('click', loadAll);
      return;
    }

    root.innerHTML =
      '<div class="content-subtabs">' +
        subtabBtn('hero', 'Hero') + subtabBtn('about', 'About Page') +
        subtabBtn('social', 'Social Links') + subtabBtn('settings', 'Site Settings') +
      '</div>' +
      '<div class="content-panel" id="panel-hero" data-panel="hero"></div>' +
      '<div class="content-panel" id="panel-about" data-panel="about"></div>' +
      '<div class="content-panel" id="panel-social" data-panel="social"></div>' +
      '<div class="content-panel" id="panel-settings" data-panel="settings"></div>';

    root.querySelectorAll('.content-subtab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.activePanel = btn.getAttribute('data-panel');
        applyActivePanel();
      });
    });

    renderHeroPanel();
    renderAboutPanel();
    renderSocialPanel();
    renderSettingsPanel();
    applyActivePanel();
  }

  function subtabBtn(key, label) {
    return '<button type="button" class="content-subtab' + (state.activePanel === key ? ' is-active' : '') + '" data-panel="' + key + '">' + label + '</button>';
  }

  function applyActivePanel() {
    root.querySelectorAll('.content-subtab').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-panel') === state.activePanel);
    });
    root.querySelectorAll('.content-panel').forEach(function (panel) {
      panel.classList.toggle('is-active', panel.getAttribute('data-panel') === state.activePanel);
    });
  }

  // ---------------------------------------------------------------
  // HERO
  // ---------------------------------------------------------------

  function renderHeroPanel() {
    var panel = document.getElementById('panel-hero');
    var h = state.hero || { heading: '', heading_ta: '', subheading: '', subheading_ta: '', cta_text: '', cta_text_ta: '', cta_link: '', is_active: true };
    var field = function (id, label, val, area) {
      return '<div class="form-field' + (area ? ' form-field-full' : '') + '"><label for="' + id + '">' + label + '</label>' +
        (area ? '<textarea id="' + id + '" rows="2">' + escapeHtml(val || '') + '</textarea>' : '<input type="text" id="' + id + '" value="' + escapeHtml(val || '') + '">') + '</div>';
    };
    panel.innerHTML =
      '<div class="content-card">' +
        '<h3>Hero text</h3>' +
        '<p class="cell-muted admin-help">Wrap words in &lt;em&gt;…&lt;/em&gt; in the heading for the gold italic accent. Leave Tamil empty to use the built-in Tamil wording.</p>' +
        '<p class="product-form-error" id="heroFormError"></p>' +
        '<div class="product-form-grid">' +
          field('heroHeading', 'Heading (English)', h.heading, true) + field('heroHeadingTa', 'Heading (தமிழ்)', h.heading_ta, true) +
          field('heroSubheading', 'Subheading (English)', h.subheading, true) + field('heroSubheadingTa', 'Subheading (தமிழ்)', h.subheading_ta, true) +
          field('heroCtaText', 'Button text (English)', h.cta_text) + field('heroCtaTextTa', 'Button text (தமிழ்)', h.cta_text_ta) +
          '<div class="form-field form-field-full"><label for="heroCtaLink">Button link (WhatsApp link, page, or https:// URL)</label><input type="text" id="heroCtaLink" value="' + escapeHtml(h.cta_link || '') + '"></div>' +
          '<div class="product-form-checks"><label class="product-form-check"><input type="checkbox" id="heroActive" ' + (h.is_active ? 'checked' : '') + '> Use this text on the site</label></div>' +
          '<div class="product-form-actions"><button type="button" class="product-form-submit" id="heroSaveBtn">Save Hero Text</button></div>' +
        '</div>' +
      '</div>' +
      '<div class="content-card"><h3>Hero images (rotating)</h3>' +
        '<p class="cell-muted admin-help">The homepage hero rotates these three images. Use landscape photos (JPEG/PNG/WebP, under 5 MB). The processing video stays in the project files and is not used in the hero.</p>' +
        '<div id="heroSlides"><div class="products-message">Loading images…</div></div>' +
      '</div>';
    document.getElementById('heroSaveBtn').addEventListener('click', saveHero);
    loadSlides();
  }

  function slideUrl(s) {
    if (s.storage_path) { return publicMediaUrl(s.storage_path); }
    return s.image_url ? (/^https?:/.test(s.image_url) ? s.image_url : '../' + s.image_url) : '';
  }

  function loadSlides() {
    client().from('hero_slides').select('*').order('display_order').then(function (res) {
      var box = document.getElementById('heroSlides');
      if (!box) { return; }
      if (res.error) { box.innerHTML = '<div class="products-message is-error">' + escapeHtml(res.error.message) + '</div>'; return; }
      var slides = res.data || [];
      box.innerHTML = slides.map(function (s, i) {
        return '<div class="slide-card content-card" data-id="' + s.id + '" style="padding:1rem">' +
          '<img class="upload-preview" src="' + escapeHtml(slideUrl(s)) + '" alt="">' +
          '<div><strong>Image ' + (i + 1) + '</strong>' +
            '<div class="product-form-grid" style="margin-top:.5rem">' +
              '<div class="form-field"><label>Description (English, for accessibility)</label><input type="text" data-f="alt_en" value="' + escapeHtml(s.alt_en || '') + '"></div>' +
              '<div class="form-field"><label>Description (தமிழ்)</label><input type="text" data-f="alt_ta" value="' + escapeHtml(s.alt_ta || '') + '"></div>' +
            '</div>' +
            '<div class="upload-field"><input type="file" data-f="file" accept="image/jpeg,image/png,image/webp"><button type="button" class="social-link-save-btn" data-save>Save</button><span class="upload-status" data-st></span></div>' +
          '</div></div>';
      }).join('') || '<div class="products-message">No hero images configured.</div>';
      box.querySelectorAll('.slide-card').forEach(function (card) {
        card.querySelector('[data-save]').addEventListener('click', function () { saveSlide(card); });
      });
    });
  }

  function saveSlide(card) {
    var id = card.getAttribute('data-id');
    var st = card.querySelector('[data-st]');
    var file = card.querySelector('[data-f="file"]').files[0];
    var payload = { alt_en: card.querySelector('[data-f="alt_en"]').value.trim() || null, alt_ta: card.querySelector('[data-f="alt_ta"]').value.trim() || null };
    var done = function (path) {
      if (path) { payload.storage_path = path; payload.image_url = null; }
      client().from('hero_slides').update(payload).eq('id', id).then(function (res) {
        if (res.error) { st.textContent = res.error.message; st.className = 'upload-status is-error'; return; }
        st.textContent = 'Saved.'; st.className = 'upload-status is-success';
        if (path) { card.querySelector('img').src = publicMediaUrl(path); }
      });
    };
    if (!file) { done(null); return; }
    if (IMAGE_TYPES.indexOf(file.type) === -1 || file.size > 5 * 1024 * 1024) { st.textContent = 'Use a JPEG, PNG or WebP under 5 MB.'; st.className = 'upload-status is-error'; return; }
    var path = 'hero/slide-' + Date.now() + '.' + extFromFile(file);
    st.textContent = 'Uploading…'; st.className = 'upload-status';
    client().storage.from('media').upload(path, file, { contentType: file.type }).then(function (up) {
      if (up.error) { st.textContent = 'Upload failed: ' + up.error.message; st.className = 'upload-status is-error'; return; }
      recordMedia(file, path, 'hero_image');
      done(path);
    });
  }

  function saveHero() {
    var errorEl = document.getElementById('heroFormError');
    var saveBtn = document.getElementById('heroSaveBtn');
    errorEl.classList.remove('is-visible');
    errorEl.textContent = '';
    var val = function (id) { return document.getElementById(id).value.trim(); };
    var payload = {
      heading: val('heroHeading'), heading_ta: val('heroHeadingTa') || null,
      subheading: val('heroSubheading') || null, subheading_ta: val('heroSubheadingTa') || null,
      cta_text: val('heroCtaText') || null, cta_text_ta: val('heroCtaTextTa') || null,
      cta_link: val('heroCtaLink') || null,
      is_active: document.getElementById('heroActive').checked
    };
    var bad = /<(?!\/?em>)[^>]*>/i;
    if (!payload.heading) { errorEl.textContent = 'Heading is required.'; errorEl.classList.add('is-visible'); return; }
    if (bad.test(payload.heading) || bad.test(payload.heading_ta || '')) { errorEl.textContent = 'Only <em>…</em> is allowed in the heading.'; errorEl.classList.add('is-visible'); return; }
    if (payload.cta_link && !/^(https:\/\/|\/|#|[a-z0-9\-]+\.html)/i.test(payload.cta_link)) { errorEl.textContent = 'The button link must start with https://, /, # or be a page like products.html.'; errorEl.classList.add('is-visible'); return; }
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    var query = state.hero
      ? client().from('hero_settings').update(payload).eq('id', state.hero.id).select().single()
      : client().from('hero_settings').insert(payload).select().single();
    query.then(function (res) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Hero Text';
      if (res.error) {
        errorEl.textContent = res.error.message || 'Could not save. Please try again.';
        errorEl.classList.add('is-visible');
        return;
      }
      state.hero = res.data;
    });
  }

  // ---------------------------------------------------------------
  // ABOUT
  // ---------------------------------------------------------------

  function renderAboutPanel() {
    var panel = document.getElementById('panel-about');
    if (state.about.length === 0) {
      panel.innerHTML = '<div class="products-message">No About sections found.</div>';
      return;
    }
    panel.innerHTML = state.about.map(renderAboutCard).join('');

    state.about.forEach(function (section) {
      var saveBtn = document.getElementById('aboutSave-' + section.id);
      if (saveBtn) { saveBtn.addEventListener('click', function () { saveAboutSection(section.id); }); }
      var fileInput = document.getElementById('aboutImageInput-' + section.id);
      if (fileInput) { fileInput.addEventListener('change', function (e) { handleAboutImageUpload(e, section); }); }
    });
  }

  function renderAboutCard(section) {
    var idSuffix = section.id;
    return (
      '<div class="content-card">' +
        '<h3>' + escapeHtml(prettify(section.section_key)) + '</h3>' +
        '<p class="product-form-error" id="aboutError-' + idSuffix + '"></p>' +
        '<div class="product-form-grid">' +
          '<div class="form-field form-field-full">' +
            '<label for="aboutHeading-' + idSuffix + '">Heading</label>' +
            '<input type="text" id="aboutHeading-' + idSuffix + '" value="' + escapeHtml(section.heading || '') + '">' +
          '</div>' +
          '<div class="form-field form-field-full">' +
            '<label for="aboutBody-' + idSuffix + '">Body</label>' +
            '<textarea id="aboutBody-' + idSuffix + '" rows="4">' + escapeHtml(section.body || '') + '</textarea>' +
          '</div>' +
          '<div class="form-field">' +
            '<label for="aboutOrder-' + idSuffix + '">Display order</label>' +
            '<input type="number" id="aboutOrder-' + idSuffix + '" value="' + section.display_order + '" step="1">' +
          '</div>' +
          '<div class="product-form-checks">' +
            '<label class="product-form-check"><input type="checkbox" id="aboutVisible-' + idSuffix + '" ' + (section.is_visible ? 'checked' : '') + '> Visible</label>' +
          '</div>' +
          '<div class="form-field form-field-full">' +
            '<label>Image</label>' +
            '<div class="upload-field">' +
              (section.image_path
                ? '<img class="upload-preview" id="aboutImagePreview-' + idSuffix + '" src="' + publicMediaUrl(section.image_path) + '" alt="">'
                : '<div class="upload-preview" id="aboutImagePreview-' + idSuffix + '"></div>') +
              '<div>' +
                '<input type="file" id="aboutImageInput-' + idSuffix + '" accept="image/jpeg,image/png,image/webp">' +
                '<div class="upload-status" id="aboutImageStatus-' + idSuffix + '"></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="product-form-actions">' +
            '<button type="button" class="product-form-submit" id="aboutSave-' + idSuffix + '">Save Section</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function prettify(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function saveAboutSection(id) {
    var section = state.about.find(function (s) { return s.id === id; });
    if (!section) { return; }

    var errorEl = document.getElementById('aboutError-' + id);
    var saveBtn = document.getElementById('aboutSave-' + id);
    errorEl.classList.remove('is-visible'); errorEl.textContent = '';

    var orderRaw = document.getElementById('aboutOrder-' + id).value;
    var order = orderRaw === '' ? section.display_order : parseInt(orderRaw, 10);
    if (isNaN(order)) { order = section.display_order; }

    var payload = {
      heading: document.getElementById('aboutHeading-' + id).value.trim() || null,
      body: document.getElementById('aboutBody-' + id).value.trim() || null,
      display_order: order,
      is_visible: document.getElementById('aboutVisible-' + id).checked
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    client().from('about_content').update(payload).eq('id', id).select().single().then(function (res) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Section';
      if (res.error) {
        errorEl.textContent = res.error.message || 'Could not save. Please try again.';
        errorEl.classList.add('is-visible');
        return;
      }
      Object.assign(section, res.data);
    });
  }

  function handleAboutImageUpload(e, section) {
    var file = e.target.files && e.target.files[0];
    if (!file) { return; }
    var statusEl = document.getElementById('aboutImageStatus-' + section.id);

    if (IMAGE_TYPES.indexOf(file.type) === -1) {
      statusEl.textContent = 'Unsupported file type.';
      statusEl.className = 'upload-status is-error';
      return;
    }

    var path = 'about/' + section.section_key + '-' + Date.now() + '.' + extFromFile(file);
    statusEl.textContent = 'Uploading…';
    statusEl.className = 'upload-status';

    client().storage.from('media').upload(path, file, { upsert: true, contentType: file.type }).then(function (uploadRes) {
      if (uploadRes.error) {
        statusEl.textContent = 'Upload failed: ' + uploadRes.error.message;
        statusEl.className = 'upload-status is-error';
        return;
      }
      client().from('about_content').update({ image_path: path }).eq('id', section.id).select().single().then(function (res) {
        if (res.error) {
          statusEl.textContent = 'Saved file, but could not update the site: ' + res.error.message;
          statusEl.className = 'upload-status is-error';
          return;
        }
        section.image_path = path;
        recordMedia(file, path, 'about_image');
        var previewEl = document.getElementById('aboutImagePreview-' + section.id);
        if (previewEl) { previewEl.src = publicMediaUrl(path); }
        statusEl.textContent = 'Updated.';
        statusEl.className = 'upload-status is-success';
      });
    });
  }

  // ---------------------------------------------------------------
  // SOCIAL LINKS
  // ---------------------------------------------------------------

  function renderSocialPanel() {
    var panel = document.getElementById('panel-social');
    if (state.social.length === 0) {
      panel.innerHTML = '<div class="products-message">No social links found.</div>';
      return;
    }
    panel.innerHTML =
      '<div class="content-card">' +
        '<h3>Social &amp; contact links</h3>' +
        '<p class="product-form-error" id="socialFormError"></p>' +
        state.social.map(renderSocialRow).join('') +
      '</div>';

    state.social.forEach(function (link) {
      var btn = document.getElementById('socialSave-' + link.id);
      if (btn) { btn.addEventListener('click', function () { saveSocialLink(link.id); }); }
    });
  }

  function renderSocialRow(link) {
    return (
      '<div class="social-link-row">' +
        '<span class="social-link-platform">' + escapeHtml(link.platform) + '</span>' +
        '<input type="text" id="socialUrl-' + link.id + '" value="' + escapeHtml(link.url || '') + '" placeholder="Leave blank to hide">' +
        '<label class="product-form-check"><input type="checkbox" id="socialVisible-' + link.id + '" ' + (link.is_visible ? 'checked' : '') + '> Visible</label>' +
        '<button type="button" class="social-link-save-btn" id="socialSave-' + link.id + '">Save</button>' +
      '</div>'
    );
  }

  function saveSocialLink(id) {
    var link = state.social.find(function (s) { return s.id === id; });
    if (!link) { return; }
    var btn = document.getElementById('socialSave-' + id);
    var errorEl = document.getElementById('socialFormError');
    errorEl.classList.remove('is-visible'); errorEl.textContent = '';

    var payload = {
      url: document.getElementById('socialUrl-' + id).value.trim() || null,
      is_visible: document.getElementById('socialVisible-' + id).checked
    };

    btn.disabled = true;
    btn.textContent = 'Saving…';

    client().from('social_links').update(payload).eq('id', id).select().single().then(function (res) {
      btn.disabled = false;
      btn.textContent = 'Save';
      if (res.error) {
        errorEl.textContent = res.error.message || 'Could not save. Please try again.';
        errorEl.classList.add('is-visible');
        return;
      }
      Object.assign(link, res.data);
    });
  }

  // ---------------------------------------------------------------
  // SITE SETTINGS
  // ---------------------------------------------------------------

  function renderSettingsPanel() {
    var panel = document.getElementById('panel-settings');
    if (state.settings.length === 0) {
      panel.innerHTML = '<div class="products-message">No site settings found.</div>';
      return;
    }

    var sorted = state.settings.slice().sort(function (a, b) {
      var ia = SETTINGS_ORDER.indexOf(a.key); var ib = SETTINGS_ORDER.indexOf(b.key);
      if (ia === -1 && ib === -1) { return a.key.localeCompare(b.key); }
      if (ia === -1) { return 1; }
      if (ib === -1) { return -1; }
      return ia - ib;
    });

    panel.innerHTML =
      '<div class="content-card">' +
        '<h3>Business &amp; site settings</h3>' +
        '<p class="product-form-error" id="settingsFormError"></p>' +
        sorted.map(function (s) {
          return (
            '<div class="settings-row">' +
              '<label for="setting-' + escapeHtml(s.key) + '">' + escapeHtml(SETTINGS_LABELS[s.key] || prettify(s.key)) + '</label>' +
              '<input type="text" id="setting-' + escapeHtml(s.key) + '" value="' + escapeHtml(s.value || '') + '">' +
            '</div>'
          );
        }).join('') +
        '<div class="content-save-bar">' +
          '<button type="button" class="product-form-submit" id="settingsSaveBtn">Save All Settings</button>' +
          '<span class="upload-status" id="settingsSaveStatus"></span>' +
        '</div>' +
      '</div>';

    document.getElementById('settingsSaveBtn').addEventListener('click', saveAllSettings);
  }

  function saveAllSettings() {
    var btn = document.getElementById('settingsSaveBtn');
    var statusEl = document.getElementById('settingsSaveStatus');
    var errorEl = document.getElementById('settingsFormError');
    errorEl.classList.remove('is-visible'); errorEl.textContent = '';

    var updates = state.settings.map(function (s) {
      var input = document.getElementById('setting-' + s.key);
      var newValue = input ? input.value.trim() : s.value;
      return { key: s.key, value: newValue };
    });

    btn.disabled = true;
    btn.textContent = 'Saving…';
    statusEl.textContent = '';
    statusEl.className = 'upload-status';

    Promise.all(updates.map(function (u) {
      return client().from('site_settings').update({ value: u.value }).eq('key', u.key);
    })).then(function (results) {
      btn.disabled = false;
      btn.textContent = 'Save All Settings';
      var failed = results.filter(function (r) { return r.error; });
      if (failed.length > 0) {
        errorEl.textContent = failed[0].error.message || 'Some settings could not be saved.';
        errorEl.classList.add('is-visible');
        return;
      }
      state.settings.forEach(function (s) {
        var u = updates.find(function (x) { return x.key === s.key; });
        if (u) { s.value = u.value; }
      });
      statusEl.textContent = 'Saved.';
      statusEl.className = 'upload-status is-success';
    });
  }

  // ---------------------------------------------------------------
  // Load + init
  // ---------------------------------------------------------------

  function loadAll() {
    state.loading = true;
    state.error = null;
    renderRoot();

    var c = client();
    Promise.all([
      c.from('hero_settings').select('*').limit(1).maybeSingle(),
      c.from('about_content').select('*').order('display_order', { ascending: true }),
      c.from('social_links').select('*').order('display_order', { ascending: true }),
      c.from('site_settings').select('*')
    ]).then(function (results) {
      var heroRes = results[0], aboutRes = results[1], socialRes = results[2], settingsRes = results[3];
      var firstError = [heroRes, aboutRes, socialRes, settingsRes].find(function (r) { return r.error; });

      state.loading = false;
      if (firstError) {
        state.error = 'Could not load site content: ' + firstError.error.message;
        renderRoot();
        return;
      }

      state.hero = heroRes.data || null;
      state.about = aboutRes.data || [];
      state.social = socialRes.data || [];
      state.settings = settingsRes.data || [];
      renderRoot();
    });
  }

  async function init() {
    try {
      var result = await window.ArumbuAdminAuth.getAuthorisedSession();
      if (!result.session || !result.profile) { return; }
      state.currentUserId = result.profile.id;
      loadAll();
    } catch (err) {
      state.loading = false;
      state.error = err.message || 'Could not connect to Supabase.';
      renderRoot();
    }
  }

  init();
})();

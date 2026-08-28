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
    var h = state.hero || {
      heading: '', subheading: '', cta_text: '', cta_link: '',
      is_video_enabled: true, is_active: true, video_storage_path: null, poster_storage_path: null
    };

    panel.innerHTML =
      '<div class="content-card">' +
        '<h3>Hero content</h3>' +
        '<p class="product-form-error" id="heroFormError"></p>' +
        '<div class="product-form-grid">' +
          '<div class="form-field form-field-full">' +
            '<label for="heroHeading">Heading</label>' +
            '<input type="text" id="heroHeading" value="' + escapeHtml(h.heading) + '">' +
          '</div>' +
          '<div class="form-field form-field-full">' +
            '<label for="heroSubheading">Subheading</label>' +
            '<textarea id="heroSubheading" rows="3">' + escapeHtml(h.subheading || '') + '</textarea>' +
          '</div>' +
          '<div class="form-field">' +
            '<label for="heroCtaText">Button text</label>' +
            '<input type="text" id="heroCtaText" value="' + escapeHtml(h.cta_text || '') + '">' +
          '</div>' +
          '<div class="form-field">' +
            '<label for="heroCtaLink">Button link</label>' +
            '<input type="text" id="heroCtaLink" value="' + escapeHtml(h.cta_link || '') + '">' +
          '</div>' +
          '<div class="product-form-checks">' +
            '<label class="product-form-check"><input type="checkbox" id="heroVideoEnabled" ' + (h.is_video_enabled ? 'checked' : '') + '> Video enabled</label>' +
            '<label class="product-form-check"><input type="checkbox" id="heroActive" ' + (h.is_active ? 'checked' : '') + '> Active on site</label>' +
          '</div>' +
          '<div class="product-form-actions">' +
            '<button type="button" class="product-form-submit" id="heroSaveBtn">Save Hero Content</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="content-card">' +
        '<h3>Hero video</h3>' +
        '<div class="upload-field">' +
          (h.video_storage_path
            ? '<video class="upload-preview is-video" id="heroVideoPreview" src="' + publicMediaUrl(h.video_storage_path) + '" muted></video>'
            : '<div class="upload-preview is-video" id="heroVideoPreview"></div>') +
          '<div>' +
            '<input type="file" id="heroVideoInput" accept="video/mp4">' +
            '<div class="upload-status" id="heroVideoStatus"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="content-card">' +
        '<h3>Hero poster image</h3>' +
        '<div class="upload-field">' +
          (h.poster_storage_path
            ? '<img class="upload-preview" id="heroPosterPreview" src="' + publicMediaUrl(h.poster_storage_path) + '" alt="">'
            : '<div class="upload-preview" id="heroPosterPreview"></div>') +
          '<div>' +
            '<input type="file" id="heroPosterInput" accept="image/jpeg,image/png,image/webp">' +
            '<div class="upload-status" id="heroPosterStatus"></div>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.getElementById('heroSaveBtn').addEventListener('click', saveHero);
    document.getElementById('heroVideoInput').addEventListener('change', function (e) { handleHeroUpload(e, 'video'); });
    document.getElementById('heroPosterInput').addEventListener('change', function (e) { handleHeroUpload(e, 'poster'); });
  }

  function saveHero() {
    var errorEl = document.getElementById('heroFormError');
    var saveBtn = document.getElementById('heroSaveBtn');
    errorEl.classList.remove('is-visible');
    errorEl.textContent = '';

    var payload = {
      heading: document.getElementById('heroHeading').value.trim(),
      subheading: document.getElementById('heroSubheading').value.trim() || null,
      cta_text: document.getElementById('heroCtaText').value.trim() || null,
      cta_link: document.getElementById('heroCtaLink').value.trim() || null,
      is_video_enabled: document.getElementById('heroVideoEnabled').checked,
      is_active: document.getElementById('heroActive').checked
    };

    if (!payload.heading) {
      errorEl.textContent = 'Heading is required.';
      errorEl.classList.add('is-visible');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    var query = state.hero
      ? client().from('hero_settings').update(payload).eq('id', state.hero.id).select().single()
      : client().from('hero_settings').insert(payload).select().single();

    query.then(function (res) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Hero Content';
      if (res.error) {
        errorEl.textContent = res.error.message || 'Could not save. Please try again.';
        errorEl.classList.add('is-visible');
        return;
      }
      state.hero = res.data;
    });
  }

  function handleHeroUpload(e, kind) {
    var file = e.target.files && e.target.files[0];
    if (!file) { return; }

    var allowed = kind === 'video' ? VIDEO_TYPES : IMAGE_TYPES;
    var statusEl = document.getElementById(kind === 'video' ? 'heroVideoStatus' : 'heroPosterStatus');

    if (allowed.indexOf(file.type) === -1) {
      statusEl.textContent = 'Unsupported file type.';
      statusEl.className = 'upload-status is-error';
      return;
    }

    var path = 'hero/' + kind + '-' + Date.now() + '.' + extFromFile(file);
    statusEl.textContent = 'Uploading…';
    statusEl.className = 'upload-status';

    client().storage.from('media').upload(path, file, { upsert: true, contentType: file.type }).then(function (uploadRes) {
      if (uploadRes.error) {
        statusEl.textContent = 'Upload failed: ' + uploadRes.error.message;
        statusEl.className = 'upload-status is-error';
        return;
      }

      var column = kind === 'video' ? 'video_storage_path' : 'poster_storage_path';
      var updatePayload = {}; updatePayload[column] = path;

      var query = state.hero
        ? client().from('hero_settings').update(updatePayload).eq('id', state.hero.id).select().single()
        : client().from('hero_settings').insert(Object.assign({ heading: 'Sourced with care.' }, updatePayload)).select().single();

      query.then(function (res) {
        if (res.error) {
          statusEl.textContent = 'Saved file, but could not update the site: ' + res.error.message;
          statusEl.className = 'upload-status is-error';
          return;
        }
        state.hero = res.data;
        recordMedia(file, path, kind === 'video' ? 'hero_video' : 'hero_image');

        var previewEl = document.getElementById(kind === 'video' ? 'heroVideoPreview' : 'heroPosterPreview');
        if (previewEl) { previewEl.src = publicMediaUrl(path); }

        statusEl.textContent = 'Updated.';
        statusEl.className = 'upload-status is-success';
      });
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

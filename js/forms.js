/* Arumbu Cashews — enquiry forms (wholesale, contact, gifting).
   Each submission is saved to Supabase (wholesale_enquiries,
   contact_messages, gifting_enquiries — insert-only for the public,
   readable only by admins) and the customer is also offered a
   pre-filled WhatsApp message. If the database can't be reached the
   form falls back to WhatsApp, as before, so no enquiry is lost. */
(function () {
  'use strict';
  var S = window.ArumbuStore;
  var openedAt = Date.now();
  var WA_SALES = '919976055524';

  function t(k, f) { return S ? S.t(k, f) : f; }
  function val(form, name) { var el = form.elements[name]; return el ? String(el.value || '').trim() : ''; }
  function digits(s) { return String(s || '').replace(/[^0-9+]/g, ''); }
  function waUrl(text) { return S ? S.whatsappUrl(text) : 'https://wa.me/' + WA_SALES + '?text=' + encodeURIComponent(text); }

  function errorBox(form) {
    var el = form.querySelector('[data-form-error]');
    if (!el) {
      el = document.createElement('p');
      el.className = 'form-error';
      el.setAttribute('data-form-error', '');
      el.setAttribute('role', 'alert');
      var btn = form.querySelector('button[type="submit"]');
      (btn ? btn.parentNode : form).insertBefore(el, btn && btn.parentNode === form ? btn : null);
    }
    return el;
  }

  function isSpam(form) {
    var hp = form.elements.website;
    return (hp && hp.value) || Date.now() - openedAt < 2500;
  }

  function validPhone(p) { var d = p.replace(/[^0-9]/g, ''); return d.length >= 10 && d.length <= 13; }

  function handle(form, cfg) {
    form.setAttribute('novalidate', '');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = errorBox(form);
      err.textContent = '';
      var data = cfg.collect(form);
      var problem = cfg.validate(data);
      if (problem) { err.textContent = problem; return; }
      var text = cfg.whatsapp(data);
      var btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;

      function success(saved) {
        form.style.display = 'none';
        form.hidden = true;
        var ok = document.getElementById(cfg.successId);
        if (ok) {
          ok.classList.add('is-visible');
          ok.hidden = false;
          var link = ok.querySelector('[data-wa-followup]');
          if (!link) {
            link = document.createElement('a');
            link.className = 'btn btn-outline';
            link.target = '_blank'; link.rel = 'noopener';
            link.setAttribute('data-wa-followup', '');
            link.style.marginTop = '1rem';
            ok.appendChild(link);
          }
          link.href = waUrl(text);
          link.textContent = saved ? t('forms.alsoWhatsapp', 'Also send on WhatsApp') : t('forms.sendWhatsapp', 'Send on WhatsApp');
          ok.setAttribute('tabindex', '-1');
          ok.focus();
        }
        if (S) S.track('generate_lead', { form: cfg.table });
      }

      if (isSpam(form)) { success(true); return; }

      if (!S || !S.client) { window.open(waUrl(text), '_blank', 'noopener'); success(false); return; }
      S.client.from(cfg.table).insert(cfg.row(data)).then(function (res) {
        if (res.error) throw res.error;
        success(true);
      }).catch(function () {
        // Database unavailable — keep the old WhatsApp behaviour.
        window.open(waUrl(text), '_blank', 'noopener');
        success(false);
      }).then(function () { if (btn) btn.disabled = false; });
    });
  }

  var NEED_NAME = function () { return t('err.invalidName', 'Please enter your name.'); };
  var NEED_PHONE = function () { return t('err.invalidPhoneLoose', 'Please enter a valid phone number.'); };
  var BAD_EMAIL = function () { return t('err.invalidEmail', 'Please enter a valid email address.'); };
  function emailOk(e) { return !e || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); }

  var wholesale = document.getElementById('wholesaleForm');
  if (wholesale) handle(wholesale, {
    table: 'wholesale_enquiries', successId: 'wholesaleSuccess',
    collect: function (f) {
      return { name: val(f, 'name'), company: val(f, 'company'), phone: val(f, 'phone'), whatsapp: val(f, 'whatsapp'),
               email: val(f, 'email'), location: val(f, 'location'), grade: val(f, 'grade'), quantity: val(f, 'quantity'), message: val(f, 'message') };
    },
    validate: function (d) {
      if (!d.name) return NEED_NAME();
      if (!validPhone(d.phone)) return NEED_PHONE();
      if (!emailOk(d.email)) return BAD_EMAIL();
      return null;
    },
    row: function (d) {
      return { name: d.name.slice(0, 120), company: d.company.slice(0, 160) || null, phone: digits(d.phone).slice(0, 20),
               whatsapp: digits(d.whatsapp).slice(0, 20) || null, email: d.email.slice(0, 160) || null, location: d.location.slice(0, 120) || null,
               grade_requested: d.grade.slice(0, 60) || null, quantity: d.quantity.slice(0, 80) || null, message: d.message.slice(0, 2000) || null,
               pipeline_status: 'new' };
    },
    whatsapp: function (d) {
      var l = ['Hi, I\'d like to make a wholesale enquiry.', 'Name: ' + d.name];
      if (d.company) l.push('Company: ' + d.company);
      l.push('Phone: ' + d.phone);
      if (d.whatsapp) l.push('WhatsApp: ' + d.whatsapp);
      if (d.email) l.push('Email: ' + d.email);
      if (d.location) l.push('Location: ' + d.location);
      if (d.grade) l.push('Grade: ' + d.grade);
      if (d.quantity) l.push('Quantity: ' + d.quantity);
      if (d.message) l.push('Message: ' + d.message);
      return l.join('\n');
    }
  });

  var contact = document.getElementById('contactForm');
  if (contact) handle(contact, {
    table: 'contact_messages', successId: 'contactSuccess',
    collect: function (f) { return { name: val(f, 'name'), phone: val(f, 'phone'), email: val(f, 'email'), subject: val(f, 'subject'), message: val(f, 'message') }; },
    validate: function (d) {
      if (!d.name) return NEED_NAME();
      if (!validPhone(d.phone)) return NEED_PHONE();
      if (!emailOk(d.email)) return BAD_EMAIL();
      if (!d.message) return t('err.messageRequired', 'Please enter a message.');
      return null;
    },
    row: function (d) {
      return { name: d.name.slice(0, 120), phone: digits(d.phone).slice(0, 20), email: d.email.slice(0, 160) || null,
               subject: d.subject.slice(0, 160) || null, message: d.message.slice(0, 4000), status: 'new', is_read: false };
    },
    whatsapp: function (d) {
      var l = ['Hi, I have a question for Arumbu Cashews.', 'Name: ' + d.name, 'Phone: ' + d.phone];
      if (d.email) l.push('Email: ' + d.email);
      if (d.subject) l.push('Subject: ' + d.subject);
      l.push('Message: ' + d.message);
      return l.join('\n');
    }
  });

  var gifting = document.getElementById('giftingForm');
  if (gifting) handle(gifting, {
    table: 'gifting_enquiries', successId: 'giftingSuccess',
    collect: function (f) {
      return { name: val(f, 'name'), company: val(f, 'company'), phone: val(f, 'phone'), email: val(f, 'email'), occasion: val(f, 'occasion'),
               quantity: val(f, 'quantity'), required_by: val(f, 'required_by'), location: val(f, 'location'), message: val(f, 'message') };
    },
    validate: function (d) {
      if (!d.name) return NEED_NAME();
      if (!validPhone(d.phone)) return NEED_PHONE();
      if (!emailOk(d.email)) return BAD_EMAIL();
      return null;
    },
    row: function (d) {
      return { name: d.name.slice(0, 120), company: d.company.slice(0, 160) || null, phone: digits(d.phone).slice(0, 20), email: d.email.slice(0, 160) || null,
               occasion: ['corporate','wedding','festival','bulk','other'].indexOf(d.occasion) > -1 ? d.occasion : 'other', quantity: d.quantity.slice(0, 80) || null,
               required_by: /^\d{4}-\d{2}-\d{2}$/.test(d.required_by) ? d.required_by : null, location: d.location.slice(0, 120) || null,
               message: d.message.slice(0, 2000) || null, status: 'new' };
    },
    whatsapp: function (d) {
      var l = ['Hi Arumbu Cashews, I\'d like to ask about gifting.', 'Name: ' + d.name];
      if (d.company) l.push('Company: ' + d.company);
      l.push('Phone: ' + d.phone);
      if (d.occasion) l.push('Occasion: ' + d.occasion);
      if (d.quantity) l.push('Quantity: ' + d.quantity);
      if (d.required_by) l.push('Needed by: ' + d.required_by);
      if (d.location) l.push('Location: ' + d.location);
      if (d.message) l.push('Message: ' + d.message);
      return l.join('\n');
    }
  });
})();

/* ARUMBU CASHEWS — Homepage interactions (index.html only)
   ---------------------------------------------------------------
   1. Header: in normal flow at the top of the hero. Once scrolled
      past, it hides while scrolling down and slides back in while
      scrolling up. Never permanently fixed.
   2. Hero: up to three photos crossfade (6.5 s each). Slides whose
      image is missing remove themselves; one photo = no rotation.
   3. Pack-size pills rewrite each grade's WhatsApp link with the
      grade + selected pack size (to +91 99760 55524).
   4. Grades row previous / next arrows.
   5. One gentle fade-in per section block ([data-reveal]).
   Progressive enhancement only — without JS every link still works
   (500 g by default) and everything is visible. */

(function () {
  'use strict';

  /* ---------- 1. Header hide / reveal ---------- */
  var header = document.getElementById('siteHeader');
  var heroWrap = document.getElementById('heroWrap');
  if (header && heroWrap) {
    var headerH = header.offsetHeight;
    var lastY = window.scrollY;
    var ticking = false;

    var menuOpen = function () {
      return !!document.querySelector('#mainNav.is-open, #searchPanel.is-open, .action-panel.is-open');
    };
    var pin = function () {
      headerH = header.offsetHeight;
      header.style.setProperty('--header-h', headerH + 'px');
      heroWrap.style.paddingTop = headerH + 'px'; // keep the page from jumping when the header leaves the flow
      header.classList.add('is-pinned');
    };
    var unpin = function () {
      header.classList.remove('is-pinned', 'is-shown');
      heroWrap.style.paddingTop = '';
    };
    var onScroll = function () {
      ticking = false;
      var y = window.scrollY;
      var dy = y - lastY;
      lastY = y;
      var pinned = header.classList.contains('is-pinned');
      var shown = header.classList.contains('is-shown');

      if (y <= 0) { unpin(); return; }
      if (!pinned) {
        if (y > headerH + 40) pin();
        return;
      }
      if (dy < -4) header.classList.add('is-shown');
      else if (dy > 4 && !menuOpen()) header.classList.remove('is-shown');
      if (!shown && y < headerH) unpin();
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
    }, { passive: true });
  }

  /* ---------- 2. Hero rotation ---------- */
  var slider = document.querySelector('[data-hero-slider]');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var startHero = function () {
    if (!slider) return;
    var slides = slider.querySelectorAll('.hero-slide');
    var dotsWrap = slider.querySelector('.hero-dots');
    if (slides.length < 2) return;                 // only one photo available: static hero
    var current = 0, timer = null, dots = [];

    var show = function (i) {
      slides[current].classList.remove('is-active');
      if (dots[current]) dots[current].classList.remove('is-active');
      current = (i + slides.length) % slides.length;
      slides[current].classList.add('is-active');
      if (dots[current]) dots[current].classList.add('is-active');
    };
    var play = function () {
      clearInterval(timer);
      if (!reduceMotion) timer = setInterval(function () { show(current + 1); }, 6500);
    };

    slides.forEach(function (slide, i) {
      slide.classList.toggle('is-active', i === 0);
      if (!dotsWrap) return;
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'hero-dot' + (i === 0 ? ' is-active' : '');
      dot.setAttribute('aria-label', 'Show image ' + (i + 1));
      dot.addEventListener('click', function () { show(i); play(); });
      dotsWrap.appendChild(dot);
      dots.push(dot);
    });
    if (dotsWrap) dotsWrap.removeAttribute('aria-hidden');

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) clearInterval(timer); else play();
    });
    play();
  };
  // Wait for every hero image to load or fail (missing slides remove themselves).
  if (document.readyState === 'complete') startHero(); else window.addEventListener('load', startHero);

  /* ---------- 3–4. Grades ---------- */
  function orderUrl(grade, pack) {
    var text = "Hi Arumbu Cashews, I'd like to order " + grade + ' cashews — ' + pack + ' pack.';
    return 'https://wa.me/919976055524?text=' + encodeURIComponent(text);
  }

  var items = document.querySelectorAll('.grade-item[data-grade]');
  items.forEach(function (item) {
    var link = item.querySelector('.grade-order');
    var pills = item.querySelectorAll('.pack-pill');
    pills.forEach(function (pill) {
      pill.addEventListener('click', function () {
        pills.forEach(function (p) {
          p.classList.toggle('is-active', p === pill);
          p.setAttribute('aria-pressed', p === pill ? 'true' : 'false');
        });
        if (link) link.href = orderUrl(item.getAttribute('data-grade'), pill.getAttribute('data-pack'));
      });
    });
  });

  var rail = document.querySelector('[data-rail]');
  var arrows = document.querySelectorAll('.rail-arrow');
  var updateArrows = function () {
    if (!rail) return;
    var max = rail.scrollWidth - rail.clientWidth - 2;
    arrows.forEach(function (btn) {
      btn.disabled = btn.getAttribute('data-dir') === '-1' ? rail.scrollLeft <= 2 : rail.scrollLeft >= max;
    });
  };
  if (rail && arrows.length) {
    arrows.forEach(function (btn) {
      btn.addEventListener('click', function () {
        rail.scrollBy({ left: Number(btn.getAttribute('data-dir')) * rail.clientWidth * 0.9, behavior: 'smooth' });
      });
    });
    rail.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    updateArrows();
  }

  /* ---------- 5. Section reveal ---------- */
  var blocks = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window)) {
    blocks.forEach(function (el) { el.classList.add('is-revealed'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  blocks.forEach(function (el) { io.observe(el); });
})();

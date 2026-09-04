(function () {
  'use strict';

  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  ready(function () {
    var root = document.documentElement;
    if (root.dataset.homeReferenceReady === 'true') return;
    root.dataset.homeReferenceReady = 'true';
    root.classList.add('js');

    var body = document.body;
    var reduceQuery = window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    var finePointerQuery = window.matchMedia
      ? window.matchMedia('(hover: hover) and (pointer: fine)')
      : null;
    var reducedMotion = Boolean(reduceQuery && reduceQuery.matches);

    var BOOT_LINES = [
      { prompt: '>', text: 'muzi-li.dev 启动中……', accent: true },
      { prompt: '[OK]', text: '载入个人资料 ...........' },
      { prompt: '[OK]', text: '挂载 ./projects ........' },
      { prompt: '[OK]', text: '挂载 ./articles ........' },
      { prompt: '[OK]', text: '挂载 ./about ...........' },
      { prompt: '[OK]', text: '应用主题  paper + ink' },
      { prompt: '>', text: '欢迎来到 MUZI-LI 的数字空间', accent: true }
    ];

    var BOOT_SESSION_KEY = 'muzi-li:boot-played';

    var bootTimer = 0;
    var bootActive = false;
    var revealObserver = null;
    var scrollFrame = 0;

    function addMediaListener(query, listener) {
      if (!query) return;
      if (typeof query.addEventListener === 'function') {
        query.addEventListener('change', listener);
      } else if (typeof query.addListener === 'function') {
        query.addListener(listener);
      }
    }

    function buildTerminalRows(container, lines, includeCursor) {
      if (!container) return [];
      container.textContent = '';

      var rows = lines.map(function (line) {
        var row = document.createElement('div');
        var prompt = document.createElement('span');
        var content = document.createElement('span');

        row.className = 'line';
        prompt.className = 'p';
        prompt.textContent = line.prompt;
        content.className = line.accent ? 'c g' : 'c';
        row.appendChild(prompt);
        row.appendChild(content);
        container.appendChild(row);

        return { content: content, text: line.text };
      });

      if (includeCursor) {
        var cursorRow = document.createElement('div');
        var cursorPrompt = document.createElement('span');
        var cursorContent = document.createElement('span');
        var cursor = document.createElement('span');

        cursorRow.className = 'line';
        cursorPrompt.className = 'p';
        cursorPrompt.textContent = '$';
        cursorContent.className = 'c';
        cursor.className = 'term-cursor';
        cursor.setAttribute('aria-hidden', 'true');
        cursorContent.appendChild(cursor);
        cursorRow.appendChild(cursorPrompt);
        cursorRow.appendChild(cursorContent);
        container.appendChild(cursorRow);
      }

      return rows;
    }

    function finishRows(rows) {
      rows.forEach(function (row) {
        row.content.textContent = row.text;
      });
    }

    function claimBootAnimation() {
      try {
        var storage = window.sessionStorage;
        if (!storage || storage.getItem(BOOT_SESSION_KEY) !== null) {
          return false;
        }
        storage.setItem(BOOT_SESSION_KEY, '1');
        return true;
      } catch (error) {
        // If storage is unavailable, keep navigation usable and avoid replaying
        // the full-screen intro on every visit.
        return false;
      }
    }

    function skipBoot() {
      if (!bootActive) return;
      bootActive = false;
      if (bootTimer) window.clearTimeout(bootTimer);
      bootTimer = 0;

      var boot = document.getElementById('boot');
      if (!boot) return;
      boot.classList.add('hide', 'is-complete');
      boot.classList.remove('is-active');
      boot.setAttribute('aria-hidden', 'true');
    }

    function runBoot() {
      var boot = document.getElementById('boot');
      var bootBody = document.getElementById('bootBody');
      if (!boot || !bootBody) return;

      if (!claimBootAnimation()) {
        boot.classList.add('hide', 'is-complete');
        boot.classList.remove('is-active');
        boot.setAttribute('aria-hidden', 'true');
        return;
      }

      body.classList.add('ef-boot');
      boot.classList.remove('hide', 'is-complete');
      boot.classList.add('is-active');
      boot.setAttribute('aria-hidden', 'false');
      bootRows = buildTerminalRows(bootBody, BOOT_LINES, false);
      bootActive = true;

      if (reducedMotion) {
        finishRows(bootRows);
        skipBoot();
        return;
      }

      var lineIndex = 0;
      var characterIndex = 0;

      function typeBootCharacter() {
        if (!bootActive) return;
        if (reducedMotion) {
          finishRows(bootRows);
          skipBoot();
          return;
        }
        if (lineIndex >= bootRows.length) {
          bootTimer = window.setTimeout(skipBoot, 380);
          return;
        }

        var row = bootRows[lineIndex];
        var characters = Array.from(row.text);
        if (characterIndex < characters.length) {
          row.content.textContent += characters[characterIndex];
          characterIndex += 1;
          bootTimer = window.setTimeout(typeBootCharacter, 14);
        } else {
          lineIndex += 1;
          characterIndex = 0;
          bootTimer = window.setTimeout(typeBootCharacter, 90);
        }
      }

      bootTimer = window.setTimeout(typeBootCharacter, 180);
      boot.addEventListener('click', skipBoot);
      document.addEventListener('keydown', function skipBootWithKeyboard(event) {
        if (!bootActive) return;
        event.preventDefault();
        skipBoot();
      });
    }

    var bootRows = [];

    function forceReveal() {
      document.querySelectorAll('.reveal').forEach(function (element) {
        element.classList.add('in', 'is-visible');
      });
    }

    function initReveal() {
      if (revealObserver) revealObserver.disconnect();
      revealObserver = null;

      var reveals = Array.from(document.querySelectorAll('.reveal'));
      if (!reveals.length) return;

      if (reducedMotion || !('IntersectionObserver' in window)) {
        body.classList.remove('ef-reveal');
        forceReveal();
        return;
      }

      body.classList.add('ef-reveal');
      reveals.forEach(function (element) {
        if (!element.classList.contains('in') && !element.classList.contains('is-visible')) {
          element.classList.add('will-reveal');
        }
      });

      revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('in', 'is-visible');
          revealObserver.unobserve(entry.target);
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

      reveals.forEach(function (element) {
        if (!element.classList.contains('in') && !element.classList.contains('is-visible')) {
          revealObserver.observe(element);
        }
      });
    }

    var tiltCards = Array.from(document.querySelectorAll('.proj-card'));
    var tiltStates = new WeakMap();

    function resetCardTilt(card) {
      var state = tiltStates.get(card);
      if (state && state.frame) window.cancelAnimationFrame(state.frame);
      if (state) state.frame = 0;
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
      card.classList.remove('is-scanning');
    }

    function tiltEnabled() {
      return !reducedMotion && Boolean(finePointerQuery && finePointerQuery.matches);
    }

    function updateTiltMode() {
      var enabled = tiltEnabled();
      body.classList.toggle('ef-tilt', enabled);
      tiltCards.forEach(function (card) {
        card.classList.toggle('is-tiltable', enabled);
        if (!enabled) resetCardTilt(card);
      });
    }

    function initTilt() {
      tiltCards.forEach(function (card) {
        var scanline = card.querySelector('.scanline');
        if (!scanline) {
          var media = card.querySelector('.proj-cover, .project-cover, .project-image, figure');
          if (media) {
            scanline = document.createElement('span');
            scanline.className = 'scanline';
            scanline.setAttribute('aria-hidden', 'true');
            media.appendChild(scanline);
          }
        }

        var state = { frame: 0, clientX: 0, clientY: 0 };
        tiltStates.set(card, state);

        card.addEventListener('pointerenter', function () {
          if (tiltEnabled()) card.classList.add('is-scanning');
        }, { passive: true });

        card.addEventListener('pointermove', function (event) {
          if (!tiltEnabled()) return;
          state.clientX = event.clientX;
          state.clientY = event.clientY;
          if (state.frame) return;

          state.frame = window.requestAnimationFrame(function () {
            state.frame = 0;
            if (!tiltEnabled()) {
              resetCardTilt(card);
              return;
            }

            var rect = card.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            var x = Math.max(0, Math.min(1, (state.clientX - rect.left) / rect.width));
            var y = Math.max(0, Math.min(1, (state.clientY - rect.top) / rect.height));
            var rotateX = (0.5 - y) * 10;
            var rotateY = (x - 0.5) * 10;
            card.style.setProperty('--rx', rotateX.toFixed(2) + 'deg');
            card.style.setProperty('--ry', rotateY.toFixed(2) + 'deg');
          });
        }, { passive: true });

        card.addEventListener('pointerleave', function () {
          resetCardTilt(card);
        }, { passive: true });
      });

      updateTiltMode();
    }

    var navLinks = Array.from(document.querySelectorAll('[data-nav-link]'));
    var sections = Array.from(document.querySelectorAll('main section[id]'));

    function linkTargetId(link) {
      var explicitTarget = link.getAttribute('data-nav-link');
      if (explicitTarget) return explicitTarget.replace(/^#/, '');
      var href = link.getAttribute('href') || '';
      return href.charAt(0) === '#' ? href.slice(1) : '';
    }

    function setActiveNavigation(sectionId) {
      navLinks.forEach(function (link) {
        var active = linkTargetId(link) === sectionId;
        link.classList.toggle('active', active);
        link.classList.toggle('is-active', active);
        if (active) {
          link.setAttribute('aria-current', 'location');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }

    function updateScrollSpy() {
      if (!sections.length || !navLinks.length) return;
      var marker = window.scrollY + window.innerHeight * 0.28;
      var activeId = sections[0].id;

      sections.forEach(function (section) {
        var top = section.getBoundingClientRect().top + window.scrollY;
        if (top <= marker) activeId = section.id;
      });

      if (window.scrollY + window.innerHeight >= root.scrollHeight - 2) {
        activeId = sections[sections.length - 1].id;
      }

      setActiveNavigation(activeId);
    }

    var progressBar = document.getElementById('progressBar');
    var toTop = document.getElementById('toTop');

    function updateProgress() {
      if (!progressBar) return;
      var scrollable = Math.max(0, root.scrollHeight - window.innerHeight);
      var percent = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
      percent = Math.max(0, Math.min(100, percent));
      progressBar.style.width = percent.toFixed(2) + '%';
      progressBar.style.setProperty('--progress', percent.toFixed(2) + '%');
      progressBar.setAttribute('aria-valuenow', String(Math.round(percent)));
    }

    function updateToTop() {
      if (!toTop) return;
      var visible = window.scrollY > 480;
      toTop.classList.toggle('show', visible);
      toTop.classList.toggle('is-visible', visible);
      toTop.setAttribute('aria-hidden', visible ? 'false' : 'true');
      toTop.tabIndex = visible ? 0 : -1;
    }

    function updateScrollUI() {
      scrollFrame = 0;
      updateProgress();
      updateToTop();
      updateScrollSpy();
    }

    function requestScrollUpdate() {
      if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateScrollUI);
    }

    if (progressBar) {
      body.classList.add('ef-progress');
      progressBar.classList.add('is-visible');
      progressBar.style.display = 'block';
      progressBar.setAttribute('role', 'progressbar');
      progressBar.setAttribute('aria-label', '页面阅读进度');
      progressBar.setAttribute('aria-valuemin', '0');
      progressBar.setAttribute('aria-valuemax', '100');
    }

    if (toTop) {
      toTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
      });
    }

    window.addEventListener('scroll', requestScrollUpdate, { passive: true });
    window.addEventListener('resize', requestScrollUpdate, { passive: true });

    var burger = document.getElementById('burger');
    var mobileMenu = document.getElementById('mobileMenu');

    function menuIsOpen() {
      return Boolean(mobileMenu && mobileMenu.classList.contains('open'));
    }

    function setMenuOpen(open, returnFocus) {
      if (!burger || !mobileMenu) return;
      mobileMenu.classList.toggle('open', open);
      mobileMenu.classList.toggle('is-open', open);
      burger.classList.toggle('is-active', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      mobileMenu.setAttribute('aria-hidden', open ? 'false' : 'true');
      body.classList.toggle('menu-open', open);
      if (!open && returnFocus) burger.focus();
    }

    if (burger && mobileMenu) {
      setMenuOpen(false, false);
      burger.addEventListener('click', function () {
        setMenuOpen(!menuIsOpen(), false);
      });

      mobileMenu.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
          setMenuOpen(false, false);
        });
      });

      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && menuIsOpen()) {
          setMenuOpen(false, true);
        }
      });

      document.addEventListener('click', function (event) {
        if (!menuIsOpen()) return;
        if (mobileMenu.contains(event.target) || burger.contains(event.target)) return;
        setMenuOpen(false, false);
      });

      addMediaListener(
        window.matchMedia ? window.matchMedia('(min-width: 721px)') : null,
        function (event) {
          if (event.matches) setMenuOpen(false, false);
        }
      );
    }

    document.querySelectorAll('[data-year]').forEach(function (year) {
      year.textContent = String(new Date().getFullYear());
    });

    function applyMotionPreference(matches) {
      reducedMotion = Boolean(matches);
      root.classList.toggle('reduce-motion', reducedMotion);
      body.classList.toggle('reduce-motion', reducedMotion);
      body.classList.toggle('ef-holo', !reducedMotion);

      if (reducedMotion) {
        if (bootActive) {
          finishRows(bootRows);
          skipBoot();
        }
        if (revealObserver) revealObserver.disconnect();
        revealObserver = null;
        body.classList.remove('ef-reveal');
        forceReveal();
      } else {
        initReveal();
      }

      updateTiltMode();
    }

    addMediaListener(reduceQuery, function (event) {
      applyMotionPreference(event.matches);
    });
    addMediaListener(finePointerQuery, updateTiltMode);

    initReveal();
    initTilt();
    runBoot();
    applyMotionPreference(reducedMotion);
    updateScrollUI();
  });
})();

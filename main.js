const menuButton = document.querySelector('[data-menu]');
const navigation = document.querySelector('[data-nav]');

menuButton?.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  navigation?.classList.toggle('is-open', !isOpen);
});

navigation?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    menuButton?.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
  });
});

const reveals = document.querySelectorAll('.reveal');

[
  '.hero > .reveal',
  '.project-grid > .reveal',
  '.article-list > .reveal'
].forEach((selector) => {
  document.querySelectorAll(selector).forEach((item, index) => {
    item.style.setProperty('--reveal-delay', `${index * 65}ms`);
  });
});

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px' });
  reveals.forEach((item) => observer.observe(item));
} else {
  reveals.forEach((item) => item.classList.add('is-visible'));
}

const header = document.querySelector('[data-header]');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const isLowEndDevice = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
const gridSections = [...document.querySelectorAll('.hero, .work-section, .writing-section, .about-section')];
let motionFrame = 0;

if (isLowEndDevice) document.documentElement.classList.add('motion-lite');

const updateScrollMotion = () => {
  header?.classList.toggle('is-scrolled', window.scrollY > 18);

  if (!prefersReducedMotion.matches && !isLowEndDevice) {
    const viewportCenter = window.innerHeight / 2;
    gridSections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      const sectionCenter = rect.top + rect.height / 2;
      const offset = Math.max(-12, Math.min(12, (sectionCenter - viewportCenter) * .018));
      section.style.setProperty('--grid-y', `${offset.toFixed(2)}px`);
    });
  }

  motionFrame = 0;
};

const requestScrollMotion = () => {
  if (!motionFrame) motionFrame = window.requestAnimationFrame(updateScrollMotion);
};

window.addEventListener('scroll', requestScrollMotion, { passive: true });
window.addEventListener('resize', requestScrollMotion);
prefersReducedMotion.addEventListener?.('change', requestScrollMotion);
updateScrollMotion();

const year = document.querySelector('[data-year]');
if (year) year.textContent = String(new Date().getFullYear());

const sections = [...document.querySelectorAll('main section[id]')];
const navLinks = [...document.querySelectorAll('.site-nav a[href^="#"]')];

if ('IntersectionObserver' in window) {
  const sectionObserver = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    navLinks.forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('href') === `#${visible.target.id}`);
    });
  }, { rootMargin: '-28% 0px -60% 0px', threshold: [0, .2, .6] });
  sections.forEach((section) => sectionObserver.observe(section));
}

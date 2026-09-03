const root = document.documentElement;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const menuButton = document.querySelector('[data-menu]');
const navigation = document.querySelector('[data-nav]');

root.classList.add('js');

const closeMenu = (returnFocus = false) => {
  menuButton?.setAttribute('aria-expanded', 'false');
  navigation?.classList.remove('is-open');
  if (returnFocus) menuButton?.focus();
};

menuButton?.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  navigation?.classList.toggle('is-open', !isOpen);
});

navigation?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => closeMenu());
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') closeMenu(true);
});

const desktopMenuQuery = window.matchMedia('(min-width: 821px)');
desktopMenuQuery.addEventListener?.('change', (event) => {
  if (event.matches) closeMenu();
});

const header = document.querySelector('[data-header], .site-header');
let headerFrame = 0;
const updateHeader = () => {
  header?.classList.toggle('is-scrolled', window.scrollY > 16);
  headerFrame = 0;
};
window.addEventListener('scroll', () => {
  if (!headerFrame) headerFrame = window.requestAnimationFrame(updateHeader);
}, { passive: true });
updateHeader();

document.querySelectorAll('[data-year]').forEach((year) => {
  year.textContent = String(new Date().getFullYear());
});

const reveals = [...document.querySelectorAll('.reveal')];
if ('IntersectionObserver' in window && !prefersReducedMotion.matches) {
  reveals.forEach((item) => item.classList.add('will-reveal'));
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: .08, rootMargin: '0px 0px -28px' });
  reveals.forEach((item) => revealObserver.observe(item));
} else {
  reveals.forEach((item) => item.classList.add('is-visible'));
}

const sections = [...document.querySelectorAll('main section[id]')];
const navLinks = [...document.querySelectorAll('.site-nav a[href^="#"]')];
const setActiveNav = (sectionId) => {
  navLinks.forEach((link) => {
    const isActive = link.getAttribute('href') === `#${sectionId}`;
    link.classList.toggle('is-active', isActive);
    if (isActive) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
};

if ('IntersectionObserver' in window && navLinks.length) {
  const sectionObserver = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) setActiveNav(visible.target.id);
  }, { rootMargin: '-25% 0px -62% 0px', threshold: [0, .2, .6] });
  sections.forEach((section) => sectionObserver.observe(section));
}

prefersReducedMotion.addEventListener?.('change', (event) => {
  if (!event.matches) return;
  reveals.forEach((item) => item.classList.add('is-visible'));
});

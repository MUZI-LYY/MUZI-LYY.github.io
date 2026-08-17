/* ===== 打字机效果 ===== */
(function () {
  const phrases = [
    "AI 产品经理",
    "AI 研究学习者",
    "产品创新实践者",
    "终身学习者",
    "问题解决者",
  ];
  const el = document.getElementById("typewriter");
  let phraseIndex = 0;
  let charIndex = 0;
  let deleting = false;

  function type() {
    const current = phrases[phraseIndex];
    if (!deleting) {
      charIndex++;
      el.textContent = current.slice(0, charIndex);
      if (charIndex === current.length) {
        deleting = true;
        setTimeout(type, 1800);
        return;
      }
      setTimeout(type, 90);
    } else {
      charIndex--;
      el.textContent = current.slice(0, charIndex);
      if (charIndex === 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        setTimeout(type, 400);
        return;
      }
      setTimeout(type, 45);
    }
  }
  type();
})();

/* ===== 数字滚动计数 ===== */
(function () {
  const nums = document.querySelectorAll("[data-count]");
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        const target = parseInt(el.dataset.count, 10);
        const duration = 1500;
        const start = performance.now();
        function tick(now) {
          const progress = Math.min((now - start) / duration, 1);
          // 缓出
          const eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.round(target * eased);
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        observer.unobserve(el);
      }
    },
    { threshold: 0.5 }
  );
  nums.forEach((n) => observer.observe(n));
})();

/* ===== 滚动淡入 ===== */
(function () {
  const items = document.querySelectorAll(".reveal");
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12 }
  );
  items.forEach((item) => observer.observe(item));
})();

/* ===== 导航高亮 ===== */
(function () {
  const sections = document.querySelectorAll("main section[id]");
  const links = document.querySelectorAll(".nav-link");
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          links.forEach((l) => l.classList.remove("active"));
          const active = document.querySelector(
            `.nav-link[href="#${entry.target.id}"]`
          );
          if (active) active.classList.add("active");
        }
      }
    },
    { rootMargin: "-45% 0px -45% 0px" }
  );
  sections.forEach((s) => observer.observe(s));
})();

/* ===== 移动端菜单 ===== */
(function () {
  const btn = document.getElementById("menu-btn");
  const links = document.getElementById("nav-links");
  btn.addEventListener("click", () => {
    btn.classList.toggle("open");
    links.classList.toggle("open");
  });
  // 点击链接后收起
  links.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      btn.classList.remove("open");
      links.classList.remove("open");
    }
  });
})();

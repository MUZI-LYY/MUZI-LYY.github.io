/* ===== 粒子背景 ===== */
(function () {
  const canvas = document.getElementById("particles");
  const ctx = canvas.getContext("2d");
  let particles = [];
  let W = 0, H = 0; // 逻辑（CSS）尺寸
  const DENSITY = 0.00009; // 每像素粒子数
  const MAX = 90;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    // 物理像素 = CSS 像素 × DPR，保证高分屏清晰
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    init();
  }

  function init() {
    const count = Math.min(MAX, Math.floor(W * H * DENSITY));
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 0.4,
        o: Math.random() * 0.5 + 0.15,
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // 连线
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 130) {
          const alpha = (1 - dist / 130) * 0.16;
          ctx.strokeStyle = `rgba(77, 208, 255, ${alpha})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
    // 粒子
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(140, 180, 220, ${p.o})`;
      ctx.fill();

      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
    }
    requestAnimationFrame(draw);
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 200);
  });

  resize();
  draw();
})();

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

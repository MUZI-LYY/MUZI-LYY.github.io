/* ===== 移动端菜单 ===== */
(function () {
  const btn = document.getElementById("menu-btn");
  const links = document.getElementById("nav-links");
  if (!btn || !links) return;
  btn.addEventListener("click", () => {
    btn.classList.toggle("open");
    links.classList.toggle("open");
  });
  links.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      btn.classList.remove("open");
      links.classList.remove("open");
    }
  });
})();

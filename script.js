
(() => {
  "use strict";

  const root = document.documentElement;
  const themeButton = document.querySelector(".theme-toggle");
  const themeIcon = document.querySelector("[data-theme-icon]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem("site-theme");
  } catch (_) {}

  root.dataset.theme = savedTheme ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  function updateThemeButton() {
    if (!themeIcon) return;
    const dark = root.dataset.theme === "dark";
    themeIcon.textContent = dark ? "☼" : "◐";
    themeButton?.setAttribute(
      "aria-label",
      dark ? "Switch to light theme" : "Switch to dark theme"
    );
  }

  updateThemeButton();

  themeButton?.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("site-theme", root.dataset.theme);
    } catch (_) {}
    updateThemeButton();
  });

  document.querySelectorAll("[data-year]").forEach(el => {
    el.textContent = new Date().getFullYear();
  });

  // Find the root-relative URL prefix based on the current page.
  function getPageDepth() {
    const path = location.pathname;
    const segments = path.split("/").filter(Boolean);
    if (path.endsWith("/")) return Math.max(0, segments.length);
    return Math.max(0, segments.length - 1);
  }

  // The root homepage has depth 0; /apps/ has depth 1.
  // For /apps/absencium/ the depth is 2.
  function rootRelative(path) {
    return "../".repeat(getPageDepth()) + path.replace(/^\/+/, "");
  }

  // Scroll down: compact. Scroll up: expand.
  const nav = document.querySelector("[data-bottom-nav]");
  let previousY = window.scrollY;
  let ticking = false;

  function handleScroll() {
    const currentY = window.scrollY;
    const delta = currentY - previousY;

    if (currentY < 45) {
      nav?.classList.remove("is-compact");
    } else if (Math.abs(delta) > 4) {
      if (delta > 0) nav?.classList.add("is-compact");
      else nav?.classList.remove("is-compact");
    }

    previousY = currentY;
    ticking = false;
  }

  window.addEventListener("scroll", () => {
    if (!ticking) {
      window.requestAnimationFrame(handleScroll);
      ticking = true;
    }
  }, { passive: true });

  nav?.addEventListener("focusin", () => nav.classList.remove("is-compact"));
  nav?.addEventListener("pointerdown", () => nav.classList.remove("is-compact"));

  // Mark the navigation item for the current page.
  const currentPath = location.pathname.replace(/index\.html$/, "").replace(/\/?$/, "/");
  document.querySelectorAll("[data-nav-link]").forEach(link => {
    const url = new URL(link.href, location.href);
    const targetPath = url.pathname.replace(/index\.html$/, "").replace(/\/?$/, "/");

    if (targetPath === currentPath) {
      link.classList.add("is-active");
    } else {
      link.classList.remove("is-active");
    }
  });

  // Render project cards from data/projects.json.
  const grids = [...document.querySelectorAll("[data-project-grid]")];
  const search = document.querySelector("[data-project-search]");
  const count = document.querySelector("[data-result-count]");
  const empty = document.querySelector("[data-empty-state]");
  let projects = [];

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function makeCard(project, index) {
    const destination = project.url === "#"
      ? (project.links?.source || "#")
      : rootRelative(project.url || "apps/");

    const iconURL = project.icon ? rootRelative(project.icon) : "";
    const icon = iconURL
      ? `<img class="project-icon" src="${escapeHTML(iconURL)}" alt="" loading="lazy"
             onerror="this.style.display='none'">`
      : `<span class="project-icon" aria-hidden="true">✳</span>`;

    const category = project.category || "Explore project";

    return `
      <a class="project-card" href="${escapeHTML(destination)}"
         style="animation-delay:${Math.min(index * 55, 250)}ms">
        <div class="project-card-top">
          ${icon}
          <span class="project-status">${escapeHTML(project.status || "Project")}</span>
        </div>
        <h3>${escapeHTML(project.name)}</h3>
        <p>${escapeHTML(project.description || project.tagline || "")}</p>
        <div class="project-card-bottom">
          <span>${escapeHTML(category)}</span>
          <span class="arrow-bubble" aria-hidden="true">↗</span>
        </div>
      </a>`;
  }

  function renderProjects() {
    const term = (search?.value || "").trim().toLowerCase();

    const filtered = projects.filter(project => {
      const content = [
        project.name,
        project.tagline,
        project.description,
        project.status,
        project.category,
        ...(project.features || [])
      ].join(" ").toLowerCase();

      return content.includes(term);
    });

    grids.forEach(grid => {
      const limit = Number(grid.dataset.limit || 0);
      const shown = limit ? filtered.slice(0, limit) : filtered;

      grid.innerHTML = shown.length
        ? shown.map(makeCard).join("")
        : `<p class="loading-note">No matching projects yet.</p>`;
    });

    if (count) {
      count.textContent = `${filtered.length} ${
        filtered.length === 1 ? "project" : "projects"
      }`;
    }

    if (empty) empty.hidden = filtered.length > 0;
  }

  if (grids.length) {
    fetch(rootRelative("data/projects.json"))
      .then(response => {
        if (!response.ok) throw new Error("Project catalogue unavailable");
        return response.json();
      })
      .then(data => {
        projects = Array.isArray(data) ? data : [];
        renderProjects();
      })
      .catch(error => {
        console.error(error);
        grids.forEach(grid => {
          grid.innerHTML = `
            <p class="loading-note">
              Project data could not be loaded. Open this website through
              GitHub Pages, Cloudflare Pages, or a local web server.
            </p>`;
        });
      });

    search?.addEventListener("input", renderProjects);
  }

  // Keep page transitions native and lightweight. The CSS View Transitions
  // rule activates where supported; ordinary navigation remains the fallback.
  if (!reduceMotion && "startViewTransition" in document) {
    root.classList.add("supports-view-transitions");
  }
})();

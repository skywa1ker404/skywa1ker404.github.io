
(() => {
  "use strict";

  const CONFIG = {
    projectsFile: "/data/projects.json",
    githubApi: "https://api.github.com",
    supportUrl: "https://www.buymeachai.in/skywa1ker404",
    releaseCacheMs: 300000
  };

  const state = {
    projects: [],
    app: null,
    releases: [],
    apks: [],
    theme: "system",
    lastY: 0,
    ticking: false
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

  const array = value => Array.isArray(value) ? value : [];

  function safeURL(value, fallback = "#") {
    try {
      const url = new URL(value, location.href);
      return ["https:", "http:"].includes(url.protocol)
        ? url.href
        : fallback;
    } catch {
      return fallback;
    }
  }

  function repoName(value) {
    return String(value || "")
      .trim()
      .replace(/^https?:\/\/github\.com\//i, "")
      .replace(/\/+$/, "")
      .replace(/\.git$/i, "");
  }

  function siteURL(path = "") {
    return new URL(String(path).replace(/^\/+/, ""), location.origin + "/").href;
  }

  function setText(selector, value) {
    const element = $(selector);
    if (element && value != null) element.textContent = String(value);
  }

  function formatDate(value) {
    if (!value) return "Date unavailable";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date unavailable";
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    }).format(date);
  }

  function formatBytes(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes < 0) return "Size unavailable";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  /* Theme: remembers the preference but applies a real light/dark palette. */
  function applyTheme(preference, save = true) {
    state.theme = ["system", "light", "dark"].includes(preference)
      ? preference : "system";

    const dark = state.theme === "dark" ||
      (state.theme === "system" &&
       window.matchMedia("(prefers-color-scheme: dark)").matches);

    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";

    $$("[data-theme-toggle], .theme-toggle, #theme-toggle").forEach(button => {
      button.setAttribute(
        "aria-label",
        dark ? "Switch to light theme" : "Switch to dark theme"
      );
      button.setAttribute("aria-pressed", String(dark));
    });

    if (save) {
      try {
        localStorage.setItem("studio-theme", state.theme);
      } catch {
        // The website remains usable if storage is unavailable.
      }
    }
  }

  function initTheme() {
    let preference = "system";
    try {
      preference = localStorage.getItem("studio-theme") || "system";
    } catch {
      // Use system preference.
    }

    applyTheme(preference);

    document.addEventListener("click", event => {
      const button = event.target.closest(
        "[data-theme-toggle], .theme-toggle, #theme-toggle"
      );
      if (!button) return;

      event.preventDefault();
      const next = state.theme === "system"
        ? "dark"
        : state.theme === "dark" ? "light" : "system";

      applyTheme(next);
    });

    window.matchMedia("(prefers-color-scheme: dark)")
      .addEventListener?.("change", () => {
        if (state.theme === "system") applyTheme("system", false);
      });
  }

  /* Project catalogue */
  async function loadProjects() {
    const response = await fetch(siteURL(CONFIG.projectsFile), {
      cache: "no-cache"
    });

    if (!response.ok) {
      throw new Error(`Could not load projects (${response.status})`);
    }

    const data = await response.json();
    const projects = Array.isArray(data)
      ? data
      : array(data.projects || data.apps);

    state.projects = projects.filter(project =>
      project && project.name && project.slug
    );

    return state.projects;
  }

  function projectURL(project) {
    return siteURL(`apps/${encodeURIComponent(project.slug)}/`);
  }

  function projectIcon(project) {
    const icon = String(project.icon || "").trim();
    return icon ? safeURL(siteURL(icon)) : siteURL("assets/favicon.svg");
  }

  function projectCard(project) {
    const name = esc(project.name);
    const tagline = esc(project.tagline || project.description || "");
    const status = esc(project.status || "In development");

    return `
      <article class="project-card">
        <a class="project-card-link" href="${esc(projectURL(project))}"
           aria-label="View ${name}">
          <div class="project-card-top">
            <img class="project-icon" src="${esc(projectIcon(project))}"
                 alt="" loading="lazy" width="54" height="54"
                 onerror="this.onerror=null;this.src='${esc(siteURL("assets/favicon.svg"))}'">
            <span class="project-status">${status}</span>
          </div>
          <p class="eyebrow">${esc(project.category || "Application")}</p>
          <h3>${name}</h3>
          <p>${tagline}</p>
          <span class="project-card-bottom">Explore app ↗</span>
        </a>
      </article>`;
  }

  function renderProjects(query = "") {
    const term = query.trim().toLowerCase();
    const filtered = state.projects.filter(project =>
      [
        project.name, project.tagline, project.description,
        project.category, project.status
      ].filter(Boolean).join(" ").toLowerCase().includes(term)
    );

    $$("[data-project-grid], #project-grid, [data-project-list]")
      .forEach(container => {
        const limit = Number(container.dataset.limit) || filtered.length;
        const visible = filtered.slice(0, limit);

        container.innerHTML = visible.length
          ? visible.map(projectCard).join("")
          : `<p class="empty-state">No projects match your search.</p>`;
      });

    const count = $("[data-result-count]");
    if (count) {
      count.textContent = `${filtered.length} project${filtered.length === 1 ? "" : "s"}`;
    }

    $$("[data-featured-project]").forEach(container => {
      const featured = state.projects.find(project => project.featured)
        || state.projects[0];

      container.innerHTML = featured
        ? `<div class="featured-card">
             <img class="project-icon" src="${esc(projectIcon(featured))}"
                  alt="" width="88" height="88">
             <div>
               <span class="eyebrow">${esc(featured.category || "Application")}</span>
               <h3>${esc(featured.name)}</h3>
               <p>${esc(featured.tagline || featured.description || "")}</p>
             </div>
             <a class="button button-primary" href="${esc(projectURL(featured))}">
               Explore ↗
             </a>
           </div>`
        : `<p class="empty-state">Projects will appear here when available.</p>`;
    });
  }

  function initProjectSearch() {
    $$("[data-project-search], #project-search").forEach(input => {
      input.addEventListener("input", () => renderProjects(input.value));
    });
  }

  /* Scroll-responsive bottom navigation */
  function initBottomNavigation() {
    const nav = $("[data-bottom-nav], .bottom-nav");
    if (!nav) return;

    state.lastY = window.scrollY;

    window.addEventListener("scroll", () => {
      if (state.ticking) return;
      state.ticking = true;

      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - state.lastY;

        if (y < 40 || delta < -5) {
          nav.classList.remove("is-compact", "compact");
        } else if (delta > 5) {
          nav.classList.add("is-compact", "compact");
        }

        state.lastY = y;
        state.ticking = false;
      });
    }, { passive: true });

    const current = location.pathname.replace(/\/+$/, "") || "/";
    $$("a[href]", nav).forEach(link => {
      try {
        const path = new URL(link.href).pathname.replace(/\/+$/, "") || "/";
        if (path === current) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      } catch {
        // Ignore invalid links.
      }
    });
  }

  function initFooter() {
    $$("[data-year], [data-current-year], #current-year").forEach(element => {
      element.textContent = String(new Date().getFullYear());
    });
  }

  /* Dialogs */
  function closeDialog(dialog) {
    if (!dialog) return;
    if (dialog.open && typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function openDialog(title, content, className = "") {
    let dialog = $("#site-dialog");

    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "site-dialog";
      dialog.innerHTML = `
        <div class="dialog-inner">
          <div class="dialog-heading">
            <h2 data-dialog-title></h2>
            <button class="dialog-close" type="button"
                    data-dialog-close aria-label="Close">×</button>
          </div>
          <div data-dialog-content></div>
        </div>`;
      document.body.appendChild(dialog);
    }

    dialog.className = className;
    setText("[data-dialog-title]", title, dialog);
    $("[data-dialog-content]", dialog).innerHTML = content;

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");

    return dialog;
  }

  document.addEventListener("click", event => {
    const close = event.target.closest("[data-dialog-close]");
    if (close) closeDialog(close.closest("dialog"));

    if (event.target instanceof HTMLDialogElement &&
        event.target.open && event.target === event.target) {
      // Native dialog backdrop handling is browser-managed.
    }
  });

  /* App details */
  function getSlug() {
    const match = location.pathname.match(/\/apps\/([^/]+)\/?$/);
    if (!match) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }

  function detailList(items, className = "app-disclosure") {
    if (!array(items).length) {
      return `<p class="muted-text">No additional information provided yet.</p>`;
    }

    return items.map(item => {
      const data = typeof item === "string"
        ? { title: item, content: "" }
        : item;

      return `<details class="${className}">
        <summary>${esc(data.title || data.name || "More information")}</summary>
        <div class="disclosure-content"><p>${esc(data.content || "")}</p></div>
      </details>`;
    }).join("");
  }

  function renderApp(app) {
    state.app = app;
    document.title = `${app.name} — Skywa1ker404's Studio`;

    const repo = repoName(app.repo);
    const repoURL = repo ? `https://github.com/${repo}` : "#";
    const main = $("main");
    if (!main) return;

    main.innerHTML = `
      <div class="app-banner" data-app-banner></div>
      <section class="container app-overview">
        <div class="app-identity">
          <div class="app-icon-large">
            <img data-app-icon src="${esc(projectIcon(app))}"
                 alt="${esc(app.name)} icon">
          </div>
          <div>
            <span class="eyebrow">${esc(app.category || "Application")}</span>
            <h1>${esc(app.name)}</h1>
            <p class="app-tagline">${esc(app.tagline || "")}</p>
            <div class="app-status-row">
              <span class="metadata-pill">${esc(app.status || "In development")}</span>
            </div>
          </div>
        </div>

        <div class="app-actions-row">
          <button class="button button-primary button-wide"
                  type="button" data-download-app>
            Download
          </button>

          <a class="support-round"
             href="${esc(CONFIG.supportUrl)}"
             target="_blank" rel="noopener noreferrer"
             aria-label="Support with Buy Me a Chai"
             title="Buy Me a Chai">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 8h12v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8Z"/>
              <path d="M17 10h1a2.5 2.5 0 0 1 0 5h-2"/>
              <path d="M9 4v2m4-3v3"/>
            </svg>
          </a>

          <button class="star-round" type="button" data-star-app
                  aria-label="Star this project on GitHub"
                  title="Star on GitHub">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>
            </svg>
          </button>
        </div>

        <div class="app-meta-grid">
          <div class="app-meta"><span>Latest version</span><strong data-app-version>Checking…</strong></div>
          <div class="app-meta"><span>APK variants</span><strong data-app-size>Checking…</strong></div>
          <div class="app-meta"><span>Platform</span><strong>${esc(array(app.platforms).join(", ") || "Not specified")}</strong></div>
          <div class="app-meta"><span>Licence</span><strong>${esc(app.license || "Not specified")}</strong></div>
        </div>

        <p data-app-description>${esc(app.description || "")}</p>
        <a class="text-link" href="${esc(repoURL)}"
           target="_blank" rel="noopener noreferrer">View source code ↗</a>
      </section>

      <section class="container app-section" data-screenshots-section>
        <h2>Screenshots</h2><div class="screenshot-row" data-app-screenshots></div>
      </section>
      <section class="container app-section">
        <h2>About this app</h2><div class="detail-list">${detailList(app.details)}</div>
      </section>
      <section class="container app-section">
        <h2>Features</h2><div class="detail-list">${detailList(app.features)}</div>
      </section>
      <section class="container app-section">
        <h2>Data safety</h2>
        <p class="muted-text">Developer-provided information; not an independent security audit.</p>
        <div class="data-safety-grid">
          ${array(app.dataSafety).map(item => `
            <article class="safety-card">
              <h3>${esc(item.title || "Information")}</h3>
              <p>${esc(item.content || "")}</p>
            </article>`).join("")}
        </div>
      </section>
      <section class="container app-section">
        <h2>Latest releases and changelogs</h2>
        <div class="detail-list" data-release-list>
          <p class="loading-note">Loading releases from GitHub…</p>
        </div>
      </section>
      <section class="container app-section">
        <h2>More apps</h2><div class="related-grid" data-related-apps></div>
      </section>`;

    if (app.banner) {
      const banner = safeURL(app.banner);
      if (banner !== "#") {
        const element = $("[data-app-banner]");
        element.style.backgroundImage = `url("${banner.replace(/["\\]/g, "")}")`;
        element.dataset.hasImage = "true";
      }
    }

    renderScreenshots(app);
    renderRelated(app);
    loadReleases(app);
  }

  function renderScreenshots(app) {
    const container = $("[data-app-screenshots]");
    const section = $("[data-screenshots-section]");
    const shots = array(app.screenshots);

    if (!shots.length) {
      if (section) section.hidden = true;
      return;
    }

    container.innerHTML = shots.map((shot, index) => {
      const src = typeof shot === "string" ? shot : shot.src || shot.url;
      const url = safeURL(src);
      if (url === "#") return "";

      const alt = typeof shot === "string"
        ? `${app.name} screenshot ${index + 1}`
        : shot.alt || `${app.name} screenshot ${index + 1}`;

      return `<button class="screenshot-item" type="button"
          data-shot="${esc(url)}" data-alt="${esc(alt)}"
          aria-label="View ${esc(alt)}">
          <img src="${esc(url)}" alt="${esc(alt)}" loading="lazy">
        </button>`;
    }).join("");
  }

  function renderRelated(app) {
    const container = $("[data-related-apps]");
    if (!container) return;

    const related = state.projects.filter(project =>
      project.slug !== app.slug &&
      (!array(app.relatedApps).length || array(app.relatedApps).includes(project.slug))
    ).slice(0, 3);

    container.innerHTML = related.length
      ? related.map(projectCard).join("")
      : `<p class="muted-text">More apps will appear here as they become available.</p>`;
  }

  /* GitHub release and APK asset loading */
  const releaseCache = new Map();

  async function fetchJSON(url) {
    const cached = releaseCache.get(url);
    if (cached && Date.now() - cached.time < CONFIG.releaseCacheMs) {
      return cached.data;
    }

    const response = await fetch(url, {
      headers: { Accept: "application/vnd.github+json" }
    });

    if (!response.ok) throw new Error(`GitHub request failed (${response.status})`);

    const data = await response.json();
    releaseCache.set(url, { time: Date.now(), data });
    return data;
  }

  function apkVariant(name) {
    const lower = name.toLowerCase();
    if (lower.includes("universal")) return "Universal";
    if (/arm64[-_]?v8a/.test(lower)) return "arm64-v8a";
    if (/armeabi[-_]?v7a|armv7/.test(lower)) return "armeabi-v7a";
    if (/x86[-_]?64/.test(lower)) return "x86_64";
    if (/(^|[-_.])x86([-. _]|\.apk|$)/.test(lower)) return "x86";
    return "APK";
  }

  async function loadReleases(app) {
    const releaseContainer = $("[data-release-list]");
    const size = $("[data-app-size]");
    const version = $("[data-app-version]");
    const download = $("[data-download-app]");

    if (!app.repo) {
      if (size) size.textContent = "No repository configured";
      if (version) version.textContent = app.version || "Not released";
      if (download) download.disabled = true;
      if (releaseContainer) releaseContainer.innerHTML =
        `<p class="muted-text">No GitHub repository is configured.</p>`;
      return;
    }

    try {
      const repo = repoName(app.repo);
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
        throw new Error("Invalid GitHub repository address");
      }

      const releases = await fetchJSON(
        `${CONFIG.githubApi}/repos/${repo}/releases?per_page=10`
      );

      state.releases = array(releases).filter(release => !release.draft);
      const latest = state.releases[0] || null;

      state.apks = array(latest?.assets)
        .filter(asset => /\.apk$/i.test(asset.name || ""))
        .map(asset => ({
          name: asset.name,
          size: asset.size,
          url: safeURL(asset.browser_download_url),
          variant: apkVariant(asset.name)
        }))
        .filter(asset => asset.url !== "#");

      if (version) version.textContent =
        latest?.tag_name || latest?.name || app.version || "Not released";

      if (size) size.textContent = `${state.apks.length} APK variant${state.apks.length === 1 ? "" : "s"}`;

      if (download) download.disabled = state.apks.length === 0;

      if (!state.releases.length) {
        releaseContainer.innerHTML =
          `<p class="muted-text">No published GitHub releases are available yet.</p>`;
      } else {
        releaseContainer.innerHTML = state.releases.map(release => `
          <details class="disclosure">
            <summary>${esc(release.tag_name || release.name || "Release")}
              · ${esc(formatDate(release.published_at || release.created_at))}</summary>
            <div class="disclosure-content">
              <p class="release-note">${esc(release.body || "No release notes provided.")}</p>
              ${array(release.assets).length ? `
                <div class="release-asset-list">
                  ${release.assets.map(asset => `
                    <div class="asset-row">
                      <div><strong>${esc(asset.name)}</strong>
                        <small>${esc(formatBytes(asset.size))}</small></div>
                      <a class="button button-soft" href="${esc(safeURL(asset.browser_download_url))}"
                         target="_blank" rel="noopener noreferrer">Download</a>
                    </div>`).join("")}
                </div>` : ""}
              <p><a class="text-link" href="${esc(safeURL(release.html_url))}"
                target="_blank" rel="noopener noreferrer">View release on GitHub ↗</a></p>
            </div>
          </details>`).join("");
      }
    } catch (error) {
      console.error("Release loading failed:", error);
      if (size) size.textContent = "Unavailable";
      if (version) version.textContent = app.version || "Unavailable";
      if (download) download.disabled = true;
      if (releaseContainer) releaseContainer.innerHTML = `
        <p class="muted-text">Release information could not be loaded.
        Check your connection or open the GitHub Releases page directly.</p>
        <a class="text-link" href="${esc(`https://github.com/${repoName(app.repo)}/releases`)}"
           target="_blank" rel="noopener noreferrer">GitHub Releases ↗</a>`;
    }
  }

  /* User actions */
  document.addEventListener("click", event => {
    const download = event.target.closest("[data-download-app]");
    if (download) {
      if (!state.app) return;

      const rows = state.apks.map(apk => `
        <div class="asset-row">
          <div><strong>${esc(apk.variant)}</strong>
            <small>${esc(apk.name)} · ${esc(formatBytes(apk.size))}</small></div>
          <a class="button button-primary" href="${esc(apk.url)}" download>Download</a>
        </div>`).join("");

      const obtainium = state.app.obtainium && state.app.repo
        ? `<a class="button button-soft" href="obtainium://add?url=${encodeURIComponent(
            `https://github.com/${repoName(state.app.repo)}`
          )}">Add to Obtainium ↗</a>`
        : "";

      const repoURL = `https://github.com/${repoName(state.app.repo)}/releases`;

      openDialog("Download app", `
        <p class="dialog-description">Choose a published APK variant for your device.</p>
        <p><strong>Available APKs (${state.apks.length})</strong></p>
        <div class="release-asset-list">
          ${rows || `<p class="muted-text">No APK assets are available in the latest published release.</p>`}
        </div>
        <div class="dialog-actions">
          ${obtainium}
          <a class="button button-soft" href="${esc(repoURL)}"
             target="_blank" rel="noopener noreferrer">GitHub Releases ↗</a>
        </div>`);
    }

    const star = event.target.closest("[data-star-app]");
    if (star && state.app?.repo) {
      openDialog("Star this project", `
        <p>If this app is useful to you, you can support its development by starring the repository on GitHub.</p>
        <p>You will need to press the Star button on GitHub yourself.</p>
        <a class="button button-primary" href="${esc(`https://github.com/${repoName(state.app.repo)}`)}"
           target="_blank" rel="noopener noreferrer">Open GitHub repository ↗</a>`);
    }

    const shot = event.target.closest("[data-shot]");
    if (shot) {
      openDialog(shot.dataset.alt || "Screenshot", `
        <img class="screenshot-large" src="${esc(shot.dataset.shot)}"
             alt="${esc(shot.dataset.alt || "App screenshot")}">`,
        "screenshot-dialog");
    }
  });

  document.addEventListener("click", event => {
    const dialog = event.target;
    if (dialog instanceof HTMLDialogElement &&
        dialog.open && dialog.id === "site-dialog" &&
        event.clientX >= dialog.getBoundingClientRect().left &&
        event.clientX <= dialog.getBoundingClientRect().right &&
        event.clientY >= dialog.getBoundingClientRect().top &&
        event.clientY <= dialog.getBoundingClientRect().bottom) {
      // The close button handles normal dismissal.
    }
  });

  async function init() {
    initTheme();
    initBottomNavigation();
    initFooter();

    try {
      await loadProjects();
      const slug = getSlug();

      if (slug) {
        const app = state.projects.find(project => project.slug === slug);
        if (app) {
          renderApp(app);
        } else {
          const main = $("main");
          if (main) main.innerHTML = `
            <section class="container page-heading">
              <h1>Project not found</h1>
              <p>This project may have been moved or removed.</p>
              <a class="button button-primary" href="${esc(siteURL("apps/"))}">Browse apps</a>
            </section>`;
        }
      } else {
        renderProjects();
        initProjectSearch();
      }
    } catch (error) {
      console.error("Website initialisation failed:", error);
      const containers = $$(
        "[data-project-grid], [data-featured-project], [data-project-list]"
      );
      containers.forEach(container => {
        container.innerHTML =
          `<p class="empty-state">Content could not be loaded. Refresh the page to try again.</p>`;
      });

      const main = $("main");
      if (getSlug() && main) {
        main.innerHTML = `
          <section class="container page-heading">
            <h1>Could not load app information</h1>
            <p>Check your connection and refresh this page.</p>
            <a class="button button-primary" href="${esc(siteURL("apps/"))}">Browse apps</a>
          </section>`;
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
 


(() => {
  "use strict";

  /* Skywa1ker404's Studio — clean, root-safe website controller */

  const ROOT = "/";
  const PROJECTS_URL = "/data/projects.json";
  const GITHUB_API = "https://api.github.com";
  const SUPPORT_URL = "https://www.buymeachai.in/skywa1ker404";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  const state = {
    projects: [],
    app: null,
    releases: [],
    apks: [],
    theme: "light",
    lastY: window.scrollY,
    scrolling: false
  };

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  function rootURL(path = "") {
    return new URL(String(path).replace(/^\/+/, ""), location.origin + ROOT).href;
  }

  function assetURL(path, fallback = "/assets/project-icon.svg") {
    if (!path) return rootURL(fallback);

    try {
      const url = new URL(path, location.origin + ROOT);
      if (url.protocol === "https:" || url.protocol === "http:") {
        return url.href;
      }
    } catch {
      // Use the fallback icon for invalid paths.
    }

    return rootURL(fallback);
  }

  function repoName(repo = "") {
    return String(repo)
      .trim()
      .replace(/^https?:\/\/github\.com\//i, "")
      .replace(/\/+$/, "")
      .replace(/\.git$/i, "");
  }

  function validExternalURL(value) {
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) ? url.href : "#";
    } catch {
      return "#";
    }
  }

  function formatBytes(bytes) {
    const size = Number(bytes) || 0;
    if (size < 1024) return `${size} B`;
    if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 ** 3) return `${(size / 1024 ** 2).toFixed(1)} MB`;
    return `${(size / 1024 ** 3).toFixed(2)} GB`;
  }

  function formatDate(date) {
    if (!date) return "Date unavailable";
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "Date unavailable";

    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    }).format(parsed);
  }

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  /* ---------------------------------------------------------
     Theme — CSS uses html[data-theme="dark"]
     --------------------------------------------------------- */

  function systemTheme() {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(theme, save = true) {
    state.theme = theme === "dark" ? "dark" : "light";

    document.documentElement.dataset.theme = state.theme;
    document.documentElement.style.colorScheme = state.theme;

    $$("[data-theme-toggle], .theme-toggle, #theme-toggle").forEach(button => {
      button.setAttribute(
        "aria-label",
        state.theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      );
      button.setAttribute("aria-pressed", String(state.theme === "dark"));
    });

    $$("[data-theme-icon]").forEach(icon => {
      icon.textContent = state.theme === "dark" ? "☀" : "☾";
    });

    if (save) {
      try {
        localStorage.setItem("studio-theme", state.theme);
      } catch {
        // Continue if browser storage is unavailable.
      }
    }
  }

  function initTheme() {
    let saved = null;

    try {
      saved = localStorage.getItem("studio-theme");
    } catch {
      // Storage might be disabled.
    }

    applyTheme(saved === "dark" || saved === "light" ? saved : systemTheme(), false);

    document.addEventListener("click", event => {
      const button = event.target.closest(
        "[data-theme-toggle], .theme-toggle, #theme-toggle"
      );

      if (!button) return;

      event.preventDefault();
      applyTheme(state.theme === "dark" ? "light" : "dark");
    });

    window.matchMedia?.("(prefers-color-scheme: dark)")
      .addEventListener?.("change", () => {
        let saved = null;
        try {
          saved = localStorage.getItem("studio-theme");
        } catch {}

        if (saved !== "dark" && saved !== "light") {
          applyTheme(systemTheme(), false);
        }
      });
  }

  /* ---------------------------------------------------------
     Project data — always load from the website root
     --------------------------------------------------------- */

  async function loadProjects() {
    const response = await fetch(
      `${PROJECTS_URL}?v=${encodeURIComponent("1")}`,
      { cache: "no-cache" }
    );

    if (!response.ok) {
      throw new Error(`projects.json returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const projects = Array.isArray(data) ? data : data.projects || data.apps;

    if (!Array.isArray(projects)) {
      throw new Error("projects.json must contain an array of projects.");
    }

    state.projects = projects.filter(project =>
      project &&
      typeof project.slug === "string" &&
      typeof project.name === "string"
    );

    return state.projects;
  }

  function projectURL(project) {
    return rootURL(`apps/${encodeURIComponent(project.slug)}/`);
  }

  function projectCard(project) {
    const icon = assetURL(project.icon);
    const status = project.status || "In development";
    const description = project.tagline || project.description || "";
    const url = projectURL(project);

    return `
      <article class="project-card">
        <a class="project-card-link" href="${escapeHTML(url)}">
          <div class="project-card-top">
            <img class="project-icon"
                 src="${escapeHTML(icon)}"
                 alt="${escapeHTML(project.name)} icon"
                 width="64" height="64" loading="lazy"
                 onerror="this.onerror=null;this.src='/assets/project-icon.svg'">
            <span class="project-status">${escapeHTML(status)}</span>
          </div>
          <p class="eyebrow">${escapeHTML(project.category || "Application")}</p>
          <h3>${escapeHTML(project.name)}</h3>
          <p>${escapeHTML(description)}</p>
          <div class="project-card-bottom">
            <span>Explore project</span><span class="arrow-bubble">↗</span>
          </div>
        </a>
      </article>
    `;
  }

  function renderProjects() {
    const query = ($("[data-project-search]")?.value || "").trim().toLowerCase();

    const matching = state.projects.filter(project => {
      const searchable = [
        project.name,
        project.tagline,
        project.description,
        project.category,
        project.status
      ].filter(Boolean).join(" ").toLowerCase();

      return searchable.includes(query);
    });

    const count = $$("[data-result-count]");
    count.forEach(element => {
      element.textContent = `${matching.length} project${matching.length === 1 ? "" : "s"}`;
    });

    // Catalogue grid and homepage grid.
    $$("[data-project-grid]").forEach(container => {
      const limit = Number(container.dataset.limit) || matching.length;
      const shown = matching.slice(0, limit);

      container.innerHTML = shown.length
        ? shown.map(projectCard).join("")
        : `<p class="empty-state">No projects match your search.</p>`;
    });

    // Existing homepage uses singular data-featured-project.
    const featuredContainer = $("[data-featured-project]");
    if (featuredContainer) {
      const featured = state.projects.find(project => project.featured)
        || state.projects[0];

      featuredContainer.innerHTML = featured
        ? `
          <article class="featured-card">
            <img class="project-icon"
                 src="${escapeHTML(assetURL(featured.icon))}"
                 alt="${escapeHTML(featured.name)} icon"
                 width="88" height="88"
                 onerror="this.onerror=null;this.src='/assets/project-icon.svg'">
            <div>
              <p class="eyebrow">${escapeHTML(featured.category || "Application")}</p>
              <h3>${escapeHTML(featured.name)}</h3>
              <p>${escapeHTML(featured.tagline || featured.description || "")}</p>
            </div>
            <a class="button button-primary" href="${escapeHTML(projectURL(featured))}">
              Explore ↗
            </a>
          </article>
        `
        : `<p class="empty-state">Projects will appear here when available.</p>`;
    }
  }

  function initProjectCatalogue() {
    const hasProjectGrid = $("[data-project-grid]");
    const hasFeatured = $("[data-featured-project]");

    if (!hasProjectGrid && !hasFeatured) return;

    loadProjects()
      .then(renderProjects)
      .catch(error => {
        console.error("Project catalogue failed:", error);

        $$("[data-project-grid]").forEach(container => {
          container.innerHTML = `
            <p class="empty-state">
              Projects couldn't be loaded. Check the project data file and refresh.
            </p>
          `;
        });

        const featured = $("[data-featured-project]");
        if (featured) {
          featured.innerHTML = `
            <p class="empty-state">
              Featured project couldn't be loaded. Please refresh the page.
            </p>
          `;
        }
      });

    $$("[data-project-search]").forEach(input => {
      input.addEventListener("input", renderProjects);
    });
  }

  /* ---------------------------------------------------------
     Floating navigation pill — matches .bottom-nav CSS
     --------------------------------------------------------- */

  function initBottomNavigation() {
    const nav = $("[data-bottom-nav], .bottom-nav");
    if (!nav) return;

    const currentPath = location.pathname.replace(/\/+$/, "") || "/";

    $$("a", nav).forEach(link => {
      try {
        const linkPath = new URL(link.href).pathname.replace(/\/+$/, "") || "/";
        if (linkPath === currentPath) {
          link.classList.add("is-active");
          link.setAttribute("aria-current", "page");
        }
      } catch {}
    });

    state.lastY = window.scrollY;

    window.addEventListener("scroll", () => {
      if (state.scrolling) return;
      state.scrolling = true;

      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - state.lastY;

        if (y < 40 || delta < -4) {
          nav.classList.remove("is-compact", "compact");
          nav.dataset.compact = "false";
        } else if (delta > 4) {
          nav.classList.add("is-compact");
          nav.dataset.compact = "true";
        }

        state.lastY = y;
        state.scrolling = false;
      });
    }, { passive: true });
  }

  /* ---------------------------------------------------------
     Dialog helpers
     --------------------------------------------------------- */

  function openDialog(title, content, id = "studio-dialog") {
    let dialog = document.getElementById(id);

    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = id;
      dialog.className = "site-dialog";
      document.body.appendChild(dialog);
    }

    dialog.innerHTML = `
      <div class="dialog-inner">
        <div class="dialog-heading">
          <h2>${escapeHTML(title)}</h2>
          <button class="dialog-close" type="button" data-close-dialog
                  aria-label="Close dialog">×</button>
        </div>
        <div class="dialog-body">${content}</div>
      </div>
    `;

    if (dialog.open) dialog.close();
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }

    return dialog;
  }

  document.addEventListener("click", event => {
    const close = event.target.closest("[data-close-dialog]");
    if (close) {
      const dialog = close.closest("dialog");
      if (dialog?.open) dialog.close();
      else dialog?.removeAttribute("open");
      return;
    }

    if (event.target instanceof HTMLDialogElement &&
        event.target.open &&
        event.target === event.target) {
      // Backdrop handling is provided by the dialog's native Escape behavior.
    }
  });

  /* ---------------------------------------------------------
     GitHub releases and APKs
     --------------------------------------------------------- */

  async function getReleases(repo) {
    const clean = repoName(repo);

    if (!/^[\w.-]+\/[\w.-]+$/.test(clean)) {
      throw new Error("Invalid GitHub repository name.");
    }

    const response = await fetch(
      `${GITHUB_API}/repos/${clean}/releases?per_page=10`,
      { headers: { Accept: "application/vnd.github+json" } }
    );

    if (!response.ok) {
      throw new Error(`GitHub Releases returned HTTP ${response.status}`);
    }

    return (await response.json()).filter(release => !release.draft);
  }

  function apkVariant(filename) {
    const name = filename.toLowerCase();

    if (name.includes("universal")) return "Universal";
    if (/arm64[-_]?v8a/.test(name)) return "arm64-v8a";
    if (/armeabi[-_]?v7a|armv7/.test(name)) return "armeabi-v7a";
    if (/x86[-_]?64/.test(name)) return "x86_64";
    if (/(^|[-_.])x86([-. _]|\.apk|$)/.test(name)) return "x86";

    return filename;
  }

  function renderAPKRows(apks) {
    if (!apks.length) {
      return `<p class="empty-state">No APK files were found in the latest published release.</p>`;
    }

    return apks.map(apk => `
      <div class="asset-row apk-row">
        <div>
          <strong>${escapeHTML(apk.variant)}</strong>
          <small>${escapeHTML(apk.name)} · ${escapeHTML(formatBytes(apk.size))}</small>
        </div>
        <a class="button button-primary"
           href="${escapeHTML(apk.url)}">Download</a>
      </div>
    `).join("");
  }

  async function loadAppReleases(app) {
    const size = $("[data-app-size]");
    const version = $("[data-app-version]");
    const releaseList = $("[data-release-list]");

    if (size) size.textContent = "Checking…";
    if (version) version.textContent = "Checking…";

    try {
      const releases = await getReleases(app.repo);
      state.releases = releases;

      const latest = releases[0] || null;
      state.apks = (latest?.assets || [])
        .filter(asset => /\.apk$/i.test(asset.name || ""))
        .map(asset => ({
          name: asset.name,
          size: asset.size,
          variant: apkVariant(asset.name),
          url: validExternalURL(asset.browser_download_url)
        }))
        .filter(asset => asset.url !== "#");

      if (size) {
        size.textContent = state.apks.length
          ? `${state.apks.length} variant${state.apks.length === 1 ? "" : "s"}`
          : "No APK assets";
      }

      if (version) {
        version.textContent = latest?.tag_name || latest?.name || app.version || "Not released";
      }

      if (releaseList) {
        releaseList.innerHTML = releases.length
          ? releases.map(release => `
              <details class="disclosure">
                <summary>
                  ${escapeHTML(release.tag_name || release.name || "Release")}
                  <span class="muted">${escapeHTML(formatDate(release.published_at))}</span>
                </summary>
                <div class="disclosure-content">
                  <p class="release-note">${escapeHTML(release.body || "No release notes provided.")}</p>
                  <a class="text-link"
                     href="${escapeHTML(validExternalURL(release.html_url))}"
                     target="_blank" rel="noopener noreferrer">
                    View release on GitHub ↗
                  </a>
                </div>
              </details>
            `).join("")
          : `<p class="empty-state">No published releases yet.</p>`;
      }
    } catch (error) {
      console.error("Release lookup failed:", error);
      if (size) size.textContent = "Unavailable";
      if (version) version.textContent = app.version || "Not released";
      if (releaseList) {
        releaseList.innerHTML = `
          <p class="empty-state">
            Release information couldn't be loaded.
            You can still visit the GitHub repository.
          </p>
        `;
      }
    }
  }

  /* ---------------------------------------------------------
     App detail page — generated from projects.json
     --------------------------------------------------------- */

  function currentAppSlug() {
    const match = location.pathname.match(/\/apps\/([^/]+)\/?$/);
    if (!match) return null;

    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }

  function renderDisclosure(items, className = "disclosure") {
    if (!items?.length) return `<p class="muted-text">No information has been added yet.</p>`;

    return items.map(item => {
      const title = typeof item === "string" ? item : item.title || item.name || "Details";
      const content = typeof item === "string" ? "" : item.content || "";

      return `
        <details class="${className}">
          <summary>${escapeHTML(title)}</summary>
          <div class="disclosure-content">
            <p>${escapeHTML(content)}</p>
          </div>
        </details>
      `;
    }).join("");
  }

  function renderAppPage(app) {
    state.app = app;
    document.title = `${app.name} — Skywa1ker404's Studio`;

    const main = $("main");
    if (!main) return;

    const icon = assetURL(app.icon);
    const repo = repoName(app.repo);
    const repoURL = validExternalURL(`https://github.com/${repo}`);
    const status = app.status || "In development";
    const platforms = list(app.platforms);
    const storeLinks = [
      app.playStore ? `<a class="button button-soft" href="${escapeHTML(validExternalURL(app.playStore))}" target="_blank" rel="noopener noreferrer">Google Play ↗</a>` : "",
      app.appStore ? `<a class="button button-soft" href="${escapeHTML(validExternalURL(app.appStore))}" target="_blank" rel="noopener noreferrer">App Store ↗</a>` : ""
    ].filter(Boolean).join("");

    main.innerHTML = `
      <div class="app-banner" data-app-banner></div>

      <section class="container app-overview">
        <div class="app-identity">
          <div class="app-icon-large">
            <img src="${escapeHTML(icon)}" alt="${escapeHTML(app.name)} icon"
                 onerror="this.onerror=null;this.src='/assets/project-icon.svg'">
          </div>
          <div>
            <h1>${escapeHTML(app.name)}</h1>
            <p class="app-tagline">${escapeHTML(app.tagline || "")}</p>
            <div class="app-status-row">
              <span class="metadata-pill">${escapeHTML(status)}</span>
              <span class="metadata-pill">${escapeHTML(app.category || "Application")}</span>
            </div>
          </div>
        </div>

        <div class="app-actions-row">
          <button class="button button-primary button-wide" type="button" data-download-app>
            Download
          </button>
         
<a class="support-round"
   href="https://www.buymeachai.in/skywa1ker404"
   target="_blank"
   rel="noopener noreferrer"
   aria-label="Support me with Buy Me a Chai"
   title="Buy Me a Chai">
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 8h11v8a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4V8Z"/>
    <path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17M9 4v2M13 3v3"/>
  </svg>
</a>

<button class="star-round"
        type="button"
        data-star-app
        aria-label="Star this project on GitHub"
        title="Star on GitHub">
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>
  </svg>
</button>

        </div>

        <div class="app-meta-grid">
          <div class="app-meta">
            <span>Latest version</span>
            <strong data-app-version>Checking…</strong>
          </div>
          <div class="app-meta">
            <span>Available APKs</span>
            <strong data-app-size>Checking…</strong>
          </div>
          <div class="app-meta">
            <span>Platform</span>
            <strong>${escapeHTML(platforms.join(", ") || "Not specified")}</strong>
          </div>
          <div class="app-meta">
            <span>Licence</span>
            <strong>${escapeHTML(app.license || "See repository")}</strong>
          </div>
        </div>

        ${storeLinks ? `<div class="dialog-actions">${storeLinks}</div>` : ""}
      </section>

      <section class="container app-section" data-screenshots-section>
        <h2>Screenshots</h2>
        <div class="screenshot-row" data-screenshot-row></div>
      </section>

      <section class="container app-section">
        <h2>About this app</h2>
        <p>${escapeHTML(app.description || "")}</p>
        <div class="detail-list">${renderDisclosure(app.details)}</div>
      </section>

      <section class="container app-section">
        <h2>Features</h2>
        <div class="detail-list">
          ${list(app.features).map(feature => `
            <article class="safety-card">
              <h3>${escapeHTML(typeof feature === "string" ? feature : feature.title || feature.name || "Feature")}</h3>
              ${typeof feature === "object" && feature.content
                ? `<p>${escapeHTML(feature.content)}</p>` : ""}
            </article>
          `).join("") || `<p class="empty-state">Feature details will be added as the project develops.</p>`}
        </div>
      </section>

      <section class="container app-section">
        <h2>Data safety</h2>
        <p class="muted-text">Developer-provided information, not an independent security audit.</p>
        <div class="data-safety-grid">
          ${list(app.dataSafety).map(item => `
            <article class="safety-card">
              <h3>${escapeHTML(item.title || "Privacy")}</h3>
              <p>${escapeHTML(item.content || "")}</p>
            </article>
          `).join("") || `<p class="muted-text">No additional details provided.</p>`}
        </div>
      </section>

      <section class="container app-section">
        <h2>Latest releases & changelogs</h2>
        <div class="detail-list" data-release-list>
          <p class="loading-note">Loading releases from GitHub…</p>
        </div>
      </section>

      <section class="container app-section">
        <div class="section-heading">
          <div><span class="eyebrow">More to explore</span><h2>Other projects</h2></div>
          <a class="text-link" href="/apps/">All apps ↗</a>
        </div>
        <div class="related-grid">
          ${state.projects.filter(project => project.slug !== app.slug)
            .slice(0, 3).map(projectCard).join("")}
        </div>
      </section>

      <section class="container app-section">
        <h2>Source code</h2>
        <p>Read the code, report issues, and follow development on GitHub.</p>
        <a class="button button-soft" href="${escapeHTML(repoURL)}"
           target="_blank" rel="noopener noreferrer">Open GitHub repository ↗</a>
      </section>
    `;

    // Add the banner image only if a real banner is configured.
    if (app.banner) {
      const banner = $("[data-app-banner]", main);
      banner.style.backgroundImage = `url("${assetURL(app.banner)}")`;
      banner.dataset.hasImage = "true";
    }

    // Screenshots are optional; hide their section when none are configured.
    const screenshots = list(app.screenshots);
    const screenshotSection = $("[data-screenshots-section]", main);
    const screenshotRow = $("[data-screenshot-row]", main);

    if (!screenshots.length) {
      screenshotSection.hidden = true;
    } else {
      screenshotRow.innerHTML = screenshots.map((item, index) => {
        const src = typeof item === "string" ? item : item.src || item.url;
        const alt = typeof item === "string"
          ? `${app.name} screenshot ${index + 1}`
          : item.alt || `${app.name} screenshot ${index + 1}`;

        return `
          <button class="screenshot-item" type="button"
                  data-image-view="${escapeHTML(assetURL(src))}"
                  data-image-alt="${escapeHTML(alt)}">
            <img src="${escapeHTML(assetURL(src))}"
                 alt="${escapeHTML(alt)}" loading="lazy">
          </button>
        `;
      }).join("");
    }

    if (status.toLowerCase().includes("planned") ||
        status.toLowerCase().includes("coming soon")) {
      $("[data-download-app]", main).hidden = true;
    }

    loadAppReleases(app);
  }

  async function initAppPage() {
    const slug = currentAppSlug();
    if (!slug) return;

    try {
      await loadProjects();
      const app = state.projects.find(project => project.slug === slug);

      if (!app) {
        const main = $("main");
        if (main) {
          main.innerHTML = `
            <section class="container page-heading">
              <h1>Project not found</h1>
              <p>This project is not listed in the current project catalogue.</p>
              <a class="button button-primary" href="/apps/">Browse projects</a>
            </section>
          `;
        }
        return;
      }

      renderAppPage(app);
    } catch (error) {
      console.error("App page failed:", error);

      const main = $("main");
      if (main) {
        main.innerHTML = `
          <section class="container page-heading">
            <h1>Couldn't load app information</h1>
            <p>Check the project data file, then refresh this page.</p>
            <a class="button button-primary" href="/apps/">Browse projects</a>
          </section>
        `;
      }
    }
  }

  /* ---------------------------------------------------------
     App actions
     --------------------------------------------------------- */

  document.addEventListener("click", event => {
    const download = event.target.closest("[data-download-app]");

    if (download) {
      if (!state.app) return;

      const repo = repoName(state.app.repo);
      const repoURL = validExternalURL(`https://github.com/${repo}`);

      const obtainium = state.app.obtainium
        ? `<a class="button button-soft" href="obtainium://add?url=${encodeURIComponent(repoURL)}">Add to Obtainium ↗</a>`
        : "";

      openDialog(
        `Download ${state.app.name}`,
        `
          <p class="dialog-description">
            Choose a published APK for your device. Each variant shows its own file size.
          </p>
          <div class="release-asset-list">
            ${renderAPKRows(state.apks)}
          </div>
          <div class="dialog-actions">
            ${obtainium}
            <a class="button button-soft"
               href="${escapeHTML(repoURL + "/releases")}"
               target="_blank" rel="noopener noreferrer">All releases ↗</a>
          </div>
        `,
        "download-dialog"
      );

      return;
    }

    const star = event.target.closest("[data-star-app]");

    if (star && state.app) {
      const repoURL = validExternalURL(
        `https://github.com/${repoName(state.app.repo)}`
      );

      openDialog(
        "Star this project",
        `
          <p>To support this project, open its GitHub repository and tap <strong>Star</strong>.</p>
          <p>This website cannot star a repository automatically.</p>
          <a class="button button-primary" href="${escapeHTML(repoURL)}"
             target="_blank" rel="noopener noreferrer">Open GitHub ↗</a>
        `,
        "star-dialog"
      );

      return;
    }

    const image = event.target.closest("[data-image-view]");

    if (image) {
      openDialog(
        image.dataset.imageAlt || "Screenshot",
        `<img src="${escapeHTML(image.dataset.imageView)}"
              alt="${escapeHTML(image.dataset.imageAlt || "App screenshot")}"
              style="width:100%;max-height:75dvh;object-fit:contain">`,
        "image-dialog"
      );
    }
  });

  /* ---------------------------------------------------------
     Footer year
     --------------------------------------------------------- */

  function initFooter() {
    $$("[data-year], [data-current-year], #current-year").forEach(element => {
      element.textContent = String(new Date().getFullYear());
    });
  }

  /* ---------------------------------------------------------
     Start the correct page
     --------------------------------------------------------- */

  async function init() {
    initTheme();
    initBottomNavigation();
    initFooter();

    if (currentAppSlug()) {
      await initAppPage();
    } else {
      initProjectCatalogue();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

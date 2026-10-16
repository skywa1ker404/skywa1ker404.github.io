
(() => {
  "use strict";

  /* =========================================================
     SKYWA1KER404'S STUDIO
     Static app-store website
     GitHub Pages + Cloudflare Pages compatible
     No build step, backend, API key, or tracking scripts
     ========================================================= */

  const CONFIG = {
    projectsFile: "data/projects.json",
    githubApi: "https://api.github.com",
    supportUrl: "https://www.buymeachai.in/skywa1ker404",
    githubUser: "skywa1ker404",
    releaseCacheMs: 5 * 60 * 1000,
    projectsCacheMs: 5 * 60 * 1000
  };

  const state = {
    projects: [],
    currentApp: null,
    releases: [],
    latestAPKs: [],
    theme: "system",
    lastScrollY: 0,
    scrollTicking: false
  };

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  const escapeHTML = (value = "") =>
    String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const normaliseRepo = repo =>
    String(repo || "")
      .trim()
      .replace(/^https?:\/\/github\.com\//i, "")
      .replace(/\/+$/, "")
      .replace(/\.git$/i, "");

  function getBasePath() {
    const path = location.pathname;
    const appMatch = path.match(/^(.*\/)(?:apps\/[^/]+\/?)$/);
    const sectionMatch = path.match(/^(.*\/)(?:about|support|privacy)\/?$/);

    if (appMatch) return appMatch[1];
    if (sectionMatch) return sectionMatch[1];

    return path.endsWith("/")
      ? path
      : path.slice(0, path.lastIndexOf("/") + 1);
  }

  function siteURL(path = "") {
    const base = getBasePath();
    return new URL(String(path).replace(/^\/+/, ""), location.origin + base).href;
  }

  function safeURL(value, fallback = "#") {
    if (!value) return fallback;

    try {
      const url = new URL(value, location.href);

      if (["https:", "http:"].includes(url.protocol)) {
        return url.href;
      }

      return fallback;
    } catch {
      return fallback;
    }
  }

  function externalLink(url, label, className = "button button-soft") {
    const href = safeURL(url);

    if (href === "#") return "";

    return `
      <a class="${escapeHTML(className)}"
         href="${escapeHTML(href)}"
         target="_blank"
         rel="noopener noreferrer">
        ${escapeHTML(label)}
      </a>
    `;
  }

  function setText(selector, value, root = document) {
    const element = $(selector, root);
    if (element && value !== undefined && value !== null) {
      element.textContent = String(value);
    }
  }

  function setHTML(selector, value, root = document) {
    const element = $(selector, root);
    if (element) element.innerHTML = value;
  }

  function setHidden(element, hidden) {
    if (element) element.hidden = hidden;
  }

  function slugify(value = "") {
    return String(value)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function formatBytes(bytes = 0) {
    const size = Number(bytes);

    if (!Number.isFinite(size) || size < 0) return "Size unavailable";
    if (size < 1024) return `${size} B`;
    if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 ** 3) return `${(size / 1024 ** 2).toFixed(1)} MB`;

    return `${(size / 1024 ** 3).toFixed(2)} GB`;
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

  function normaliseArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /* =========================================================
     THEME
     Supports system, light, and dark themes
     ========================================================= */

  function getStoredTheme() {
    try {
      return localStorage.getItem("studio-theme") || "system";
    } catch {
      return "system";
    }
  }

  function applyTheme(theme = "system") {
    const validThemes = ["system", "light", "dark"];

    state.theme = validThemes.includes(theme) ? theme : "system";

    const root = document.documentElement;

    root.dataset.theme = state.theme;
    root.style.colorScheme =
      state.theme === "system" ? "light dark" : state.theme;

    try {
      localStorage.setItem("studio-theme", state.theme);
    } catch {
      // The site still works if storage is unavailable.
    }

    $$("[data-theme-toggle], #theme-toggle, .theme-toggle").forEach(button => {
      button.setAttribute(
        "aria-label",
        state.theme === "dark"
          ? "Switch to light theme"
          : state.theme === "light"
            ? "Use system theme"
            : "Switch to dark theme"
      );

      button.setAttribute("aria-pressed", String(state.theme === "dark"));
    });

    $$("[data-theme-option]").forEach(option => {
      const selected = option.dataset.themeOption === state.theme;
      option.setAttribute("aria-pressed", String(selected));
    });
  }

  function cycleTheme() {
    const themes = ["system", "light", "dark"];
    const next = (themes.indexOf(state.theme) + 1) % themes.length;
    applyTheme(themes[next]);
  }

  function initTheme() {
    applyTheme(getStoredTheme());

    document.addEventListener("click", event => {
      const toggle = event.target.closest(
        "[data-theme-toggle], #theme-toggle, .theme-toggle"
      );

      if (toggle) {
        event.preventDefault();
        cycleTheme();
        return;
      }

      const option = event.target.closest("[data-theme-option]");

      if (option) {
        event.preventDefault();
        applyTheme(option.dataset.themeOption);
      }
    });

    const systemPreference = window.matchMedia?.("(prefers-color-scheme: dark)");

    systemPreference?.addEventListener?.("change", () => {
      if (state.theme === "system") {
        document.documentElement.dataset.theme = "system";
      }
    });
  }

  /* =========================================================
     DIALOGS
     Uses native dialog elements where available
     ========================================================= */

  function closeDialog(dialog) {
    if (!dialog) return;

    if (typeof dialog.close === "function" && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
      dialog.hidden = true;
    }
  }

  function openDialog(dialog) {
    if (!dialog) return;

    dialog.hidden = false;

    if (typeof dialog.showModal === "function" && !dialog.open) {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function createDialog(id, title, content) {
    let dialog = document.getElementById(id);

    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = id;
      dialog.className = "site-dialog";
      dialog.innerHTML = `
        <div class="dialog-inner">
          <div class="dialog-heading">
            <h2>${escapeHTML(title)}</h2>
            <button class="icon-button"
                    type="button"
                    data-dialog-close
                    aria-label="Close dialog">
              ✕
            </button>
          </div>
          <div class="dialog-content"></div>
        </div>
      `;

      document.body.appendChild(dialog);
    }

    const heading = $("h2", dialog);
    const body = $(".dialog-content", dialog);

    if (heading) heading.textContent = title;
    if (body) body.innerHTML = content;

    openDialog(dialog);
    return dialog;
  }

  document.addEventListener("click", event => {
    const closeButton = event.target.closest("[data-dialog-close]");

    if (closeButton) {
      closeDialog(closeButton.closest("dialog"));
      return;
    }

    const backdropDialog = event.target;

    if (
      backdropDialog instanceof HTMLDialogElement &&
      backdropDialog.open &&
      event.target === backdropDialog
    ) {
      closeDialog(backdropDialog);
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      $$("dialog[open]").forEach(closeDialog);
    }
  });

  /* =========================================================
     PROJECT DATA
     ========================================================= */

  async function loadProjects() {
    const url = siteURL(CONFIG.projectsFile);

    try {
      const response = await fetch(url, { cache: "no-cache" });

      if (!response.ok) {
        throw new Error(`Project data request failed: ${response.status}`);
      }

      const data = await response.json();
      const projects = Array.isArray(data)
        ? data
        : normaliseArray(data.projects || data.apps);

      state.projects = projects.filter(project =>
        project &&
        typeof project === "object" &&
        project.name &&
        project.slug
      );

      return state.projects;
    } catch (error) {
      console.error("Could not load project catalogue:", error);

      state.projects = [];

      $$("[data-project-list], [data-project-grid], #project-grid").forEach(
        element => {
          element.innerHTML = `
            <p class="empty-state">
              Projects could not be loaded. Please try again later.
            </p>
          `;
        }
      );

      return [];
    }
  }

  function getProjectURL(project) {
    return siteURL(`apps/${encodeURIComponent(project.slug)}/`);
  }

  function getProjectIcon(project) {
    return safeURL(project.icon, siteURL("assets/project-icon.svg"));
  }

  function getProjectStatus(project) {
    return project.status || "In development";
  }

  function projectCard(project) {
    const name = escapeHTML(project.name);
    const tagline = escapeHTML(project.tagline || project.description || "");
    const category = escapeHTML(project.category || "Application");
    const status = escapeHTML(getProjectStatus(project));
    const icon = escapeHTML(getProjectIcon(project));
    const url = escapeHTML(getProjectURL(project));

    return `
      <article class="project-card">
        <a class="project-card-link" href="${url}" aria-label="View ${name}">
          <div class="project-card-top">
            <img class="project-icon"
                 src="${icon}"
                 alt=""
                 loading="lazy"
                 width="64"
                 height="64"
                 onerror="this.onerror=null;this.src='${escapeHTML(siteURL("assets/project-icon.svg"))}'">
            <span class="status-label">${status}</span>
          </div>
          <p class="eyebrow">${category}</p>
          <h3>${name}</h3>
          <p class="project-tagline">${tagline}</p>
          <span class="text-link">Explore app ↗</span>
        </a>
      </article>
    `;
  }

  function renderProjectLists() {
    const projects = state.projects;

    const listSelectors = [
      "[data-project-list]",
      "[data-project-grid]",
      "#project-grid",
      ".project-grid"
    ];

    listSelectors.forEach(selector => {
      $$(selector).forEach(container => {
        if (container.dataset.projectsRendered === "true") return;

        container.innerHTML = projects.length
          ? projects.map(projectCard).join("")
          : `<p class="empty-state">Projects will appear here when available.</p>`;

        container.dataset.projectsRendered = "true";
      });
    });

    const featured = $$("[data-featured-projects]");

    featured.forEach(container => {
      const featuredProjects = projects.filter(project => project.featured);

      container.innerHTML = featuredProjects.length
        ? featuredProjects.map(projectCard).join("")
        : projects.slice(0, 3).map(projectCard).join("");
    });

    initProjectSearch();
  }

  function initProjectSearch() {
    const searchInputs = $$(
      "[data-project-search], #project-search, .project-search"
    );

    searchInputs.forEach(input => {
      input.addEventListener("input", () => {
        const query = input.value.trim().toLowerCase();

        $$("[data-project-list], [data-project-grid], #project-grid, .project-grid")
          .forEach(container => {
            const filtered = state.projects.filter(project => {
              const text = [
                project.name,
                project.tagline,
                project.description,
                project.category,
                project.status
              ].filter(Boolean).join(" ").toLowerCase();

              return text.includes(query);
            });

            container.innerHTML = filtered.length
              ? filtered.map(projectCard).join("")
              : `<p class="empty-state">No projects match your search.</p>`;
          });
      });
    });
  }

  /* =========================================================
     BOTTOM PILL NAVIGATION
     Shrinks on scroll down and expands on scroll up
     ========================================================= */

  function initBottomNavigation() {
    const nav = $(
      "[data-bottom-nav], .bottom-nav, .floating-nav, .navigation-pill"
    );

    if (!nav) return;

    state.lastScrollY = window.scrollY;

    window.addEventListener("scroll", () => {
      if (state.scrollTicking) return;

      state.scrollTicking = true;

      window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const difference = currentY - state.lastScrollY;

        if (currentY < 40) {
          nav.classList.remove("is-compact", "compact");
          nav.setAttribute("data-compact", "false");
        } else if (difference > 5) {
          nav.classList.add("is-compact", "compact");
          nav.setAttribute("data-compact", "true");
        } else if (difference < -5) {
          nav.classList.remove("is-compact", "compact");
          nav.setAttribute("data-compact", "false");
        }

        state.lastScrollY = currentY;
        state.scrollTicking = false;
      });
    }, { passive: true });

    const currentPath = location.pathname.replace(/\/+$/, "") || "/";

    $$("a[href]", nav).forEach(link => {
      try {
        const linkURL = new URL(link.href, location.href);
        const linkPath = linkURL.pathname.replace(/\/+$/, "") || "/";

        if (linkPath === currentPath) {
          link.setAttribute("aria-current", "page");
        } else {
          link.removeAttribute("aria-current");
        }
      } catch {
        // Ignore invalid navigation links.
      }
    });
  }

  /* =========================================================
     GITHUB RELEASES
     ========================================================= */

  const memoryCache = new Map();

  async function fetchJSON(url, cacheMs = CONFIG.releaseCacheMs) {
    const cached = memoryCache.get(url);

    if (cached && Date.now() - cached.time < cacheMs) {
      return cached.data;
    }

    const response = await fetch(url, {
      headers: { Accept: "application/vnd.github+json" }
    });

    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    const data = await response.json();

    memoryCache.set(url, {
      time: Date.now(),
      data
    });

    return data;
  }

  async function getReleases(repo) {
    const cleanRepo = normaliseRepo(repo);

    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(cleanRepo)) {
      throw new Error("The project's GitHub repository is not configured correctly.");
    }

    const url = `${CONFIG.githubApi}/repos/${cleanRepo}/releases?per_page=10`;
    const releases = await fetchJSON(url);

    return normaliseArray(releases).filter(release => !release.draft);
  }

  function isAPK(asset) {
    return /\.apk$/i.test(asset.name || "");
  }

  function getAPKVariant(filename) {
    const name = String(filename || "").toLowerCase();

    if (/universal|universal\.apk/.test(name)) return "Universal";
    if (/arm64[-_]v8a|arm64v8a/.test(name)) return "arm64-v8a";
    if (/armeabi[-_]v7a|armeabiv7a|armv7/.test(name)) return "armeabi-v7a";
    if (/x86[-_]64|x86_64/.test(name)) return "x86_64";
    if (/(^|[-_.])x86([-. _]|\.apk|$)/.test(name)) return "x86";

    return filename || "APK";
  }

  function getAPKAssets(release) {
    return normaliseArray(release?.assets)
      .filter(isAPK)
      .map(asset => ({
        name: asset.name || "Application.apk",
        size: Number(asset.size) || 0,
        downloadUrl: safeURL(asset.browser_download_url),
        updatedAt: asset.updated_at,
        variant: getAPKVariant(asset.name)
      }))
      .filter(asset => asset.downloadUrl !== "#");
  }

  function releaseTag(release) {
    return release.tag_name || release.name || "Latest release";
  }

  function renderReleaseRows(releases) {
    if (!releases.length) {
      return `<p class="empty-state">No published releases are available yet.</p>`;
    }

    return releases.map(release => {
      const tag = escapeHTML(releaseTag(release));
      const date = escapeHTML(formatDate(release.published_at || release.created_at));
      const url = escapeHTML(safeURL(release.html_url));
      const notes = escapeHTML(
        String(release.body || "No release notes provided.")
          .replace(/<[^>]*>/g, "")
          .slice(0, 500)
      );

      return `
        <details class="release-item">
          <summary>
            <span class="release-summary">
              <strong>${tag}</strong>
              <span>${date}</span>
            </span>
          </summary>
          <div class="release-notes">
            <p>${notes || "No release notes provided."}</p>
            ${url !== "#" ? `
              <a href="${url}"
                 target="_blank"
                 rel="noopener noreferrer">
                View release on GitHub ↗
              </a>` : ""}
          </div>
        </details>
      `;
    }).join("");
  }

  function renderAPKRows(apks) {
    if (!apks.length) {
      return `
        <p class="empty-state">
          No APK files were found in the latest published release.
        </p>
      `;
    }

    return apks.map(apk => `
      <div class="apk-row">
        <div class="apk-row-info">
          <strong>${escapeHTML(apk.variant)}</strong>
          <span>${escapeHTML(apk.name)}</span>
          <small>${escapeHTML(formatBytes(apk.size))}</small>
        </div>
        <a class="button button-primary apk-download"
           href="${escapeHTML(apk.downloadUrl)}"
           download>
          Download
        </a>
      </div>
    `).join("");
  }

  function renderDownloadDialog(app, release, apks) {
    const releaseURL = safeURL(release?.html_url);
    const repo = normaliseRepo(app.repo);
    const repoURL = safeURL(`https://github.com/${repo}`);

    const obtainiumLink = app.obtainium && repoURL !== "#"
      ? `
        <a class="button button-soft"
           href="obtainium://add?url=${encodeURIComponent(repoURL)}">
          Add to Obtainium ↗
        </a>
      `
      : "";

    const releaseLink = releaseURL !== "#"
      ? externalLink(releaseURL, "View release on GitHub ↗", "text-link")
      : "";

    const content = `
      <p class="dialog-description">
        Choose the APK that matches your device. Each variant is listed
        separately with its own file size.
      </p>

      <div class="release-current">
        <span>Latest release</span>
        <strong>${escapeHTML(release ? releaseTag(release) : "No release yet")}</strong>
        <small>${escapeHTML(
          release ? formatDate(release.published_at || release.created_at) : ""
        )}</small>
      </div>

      <details class="apk-dropdown" open>
        <summary>
          Available APKs (${apks.length})
        </summary>
        <div class="apk-list">
          ${renderAPKRows(apks)}
        </div>
      </details>

      <div class="dialog-actions">
        ${obtainiumLink}
        ${releaseLink}
        ${repoURL !== "#" ? externalLink(repoURL, "Source code ↗") : ""}
      </div>
    `;

    createDialog("download-dialog", "Download app", content);
  }

  async function loadAppReleases(app) {
    const sizeElement = $("[data-app-size]");
    const downloadButtons = $$(
      "[data-download-app], #download-app, .download-app"
    );

    state.releases = [];
    state.latestAPKs = [];

    if (sizeElement) sizeElement.textContent = "Checking…";

    downloadButtons.forEach(button => {
      button.disabled = false;
      button.setAttribute("aria-disabled", "false");
    });

    if (!app.repo) {
      if (sizeElement) sizeElement.textContent = "No repository configured";

      downloadButtons.forEach(button => {
        button.disabled = true;
        button.setAttribute("aria-disabled", "true");
      });

      return;
    }

    try {
      const releases = await getReleases(app.repo);
      state.releases = releases;

      const latest = releases[0] || null;
      state.latestAPKs = getAPKAssets(latest);

      if (sizeElement) {
        sizeElement.textContent = state.latestAPKs.length
          ? `${state.latestAPKs.length} variant${state.latestAPKs.length === 1 ? "" : "s"}`
          : "No APK assets";
      }

      const releaseContainer = $(
        "[data-release-list], #release-list, .release-list"
      );

      if (releaseContainer) {
        releaseContainer.innerHTML = renderReleaseRows(releases);
      }

      const latestVersion = latest
        ? releaseTag(latest)
        : (app.version || "Not released");

      setText("[data-app-version]", latestVersion);
      setText("[data-latest-version]", latestVersion);

      const date = latest
        ? formatDate(latest.published_at || latest.created_at)
        : "Not released";

      setText("[data-release-date]", date);

      downloadButtons.forEach(button => {
        button.disabled = !state.latestAPKs.length;
        button.setAttribute(
          "aria-disabled",
          String(!state.latestAPKs.length)
        );

        if (!state.latestAPKs.length) {
          button.title = "No APK assets are available in the latest release yet.";
        } else {
          button.removeAttribute("title");
        }
      });
    } catch (error) {
      console.error("Could not load GitHub releases:", error);

      if (sizeElement) sizeElement.textContent = "Unavailable";

      const releaseContainer = $(
        "[data-release-list], #release-list, .release-list"
      );

      if (releaseContainer) {
        releaseContainer.innerHTML = `
          <p class="empty-state">
            Release information could not be loaded.
            Please check the project's GitHub Releases page.
          </p>
        `;
      }

      downloadButtons.forEach(button => {
        button.disabled = true;
        button.setAttribute("aria-disabled", "true");
      });
    }
  }

  /* =========================================================
     APP DETAIL PAGE
     ========================================================= */

  function getAppSlugFromPath() {
    const match = location.pathname.match(/\/apps\/([^/]+)/);
    if (!match) return null;

    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }

  function renderKeyValue(selector, value) {
    const element = $(selector);

    if (element && value !== undefined && value !== null && value !== "") {
      element.textContent = String(value);
    }
  }

  function renderScreenshots(app) {
    const container = $(
      "[data-app-screenshots], #app-screenshots, .app-screenshots"
    );

    if (!container) return;

    const screenshots = normaliseArray(app.screenshots);

    if (!screenshots.length) {
      container.hidden = true;
      return;
    }

    container.hidden = false;

    container.innerHTML = screenshots.map((item, index) => {
      const src = typeof item === "string" ? item : item.src || item.url;
      const alt = typeof item === "string"
        ? `${app.name} screenshot ${index + 1}`
        : item.alt || `${app.name} screenshot ${index + 1}`;

      const safeSrc = safeURL(src);

      if (safeSrc === "#") return "";

      return `
        <button class="screenshot-item"
                type="button"
                data-screenshot-open="${escapeHTML(safeSrc)}"
                data-screenshot-alt="${escapeHTML(alt)}"
                aria-label="View ${escapeHTML(alt)}">
          <img src="${escapeHTML(safeSrc)}"
               alt="${escapeHTML(alt)}"
               loading="lazy">
        </button>
      `;
    }).join("");
  }

  function renderFeatureList(app) {
    const container = $("[data-app-features], #app-features, .app-features");
    if (!container) return;

    const features = normaliseArray(app.features);

    if (!features.length) {
      container.hidden = true;
      return;
    }

    container.hidden = false;

    container.innerHTML = features.map(feature => {
      const item = typeof feature === "string"
        ? { title: feature, content: "" }
        : feature;

      return `
        <article class="feature-item">
          <h3>${escapeHTML(item.title || item.name || "Feature")}</h3>
          ${item.content ? `<p>${escapeHTML(item.content)}</p>` : ""}
        </article>
      `;
    }).join("");
  }

  function renderDetails(app) {
    const container = $("[data-app-details], #app-details, .app-details");
    if (!container) return;

    const details = normaliseArray(app.details);

    if (!details.length) {
      container.hidden = true;
      return;
    }

    container.hidden = false;

    container.innerHTML = details.map((detail, index) => `
      <details class="app-disclosure" ${index === 0 ? "open" : ""}>
        <summary>${escapeHTML(detail.title || "More information")}</summary>
        <div class="disclosure-content">
          <p>${escapeHTML(detail.content || "")}</p>
        </div>
      </details>
    `).join("");
  }

  function renderDataSafety(app) {
    const container = $(
      "[data-app-data-safety], #app-data-safety, .app-data-safety"
    );

    if (!container) return;

    const items = normaliseArray(app.dataSafety);

    if (!items.length) {
      container.hidden = true;
      return;
    }

    container.hidden = false;

    container.innerHTML = items.map(item => `
      <details class="app-disclosure">
        <summary>${escapeHTML(item.title || "Data and privacy")}</summary>
        <div class="disclosure-content">
          <p>${escapeHTML(item.content || "")}</p>
        </div>
      </details>
    `).join("");
  }

  function renderRelatedApps(app) {
    const container = $(
      "[data-related-apps], #related-apps, .related-apps"
    );

    if (!container) return;

    const related = state.projects
      .filter(project => project.slug !== app.slug)
      .filter(project => {
        if (!app.relatedApps) return true;

        return normaliseArray(app.relatedApps).includes(project.slug);
      })
      .slice(0, 4);

    container.innerHTML = related.length
      ? related.map(projectCard).join("")
      : `<p class="empty-state">More projects will appear here as they become available.</p>`;
  }

  function populateAppPage(app) {
    state.currentApp = app;

    document.title = `${app.name} — Skywa1ker404's Studio`;

    renderKeyValue("[data-app-name]", app.name);
    renderKeyValue("[data-app-tagline]", app.tagline || "");
    renderKeyValue("[data-app-description]", app.description || "");
    renderKeyValue("[data-app-category]", app.category || "Application");
    renderKeyValue("[data-app-status]", app.status || "In development");
    renderKeyValue("[data-app-license]", app.license || "Not specified");
    renderKeyValue("[data-app-platforms]", normaliseArray(app.platforms).join(", "));
    renderKeyValue("[data-app-version]", app.version || "Not released");

    const iconURL = getProjectIcon(app);
    const iconSelectors = [
      "[data-app-icon]",
      "#app-icon",
      ".app-detail-icon"
    ];

    iconSelectors.forEach(selector => {
      $$(selector).forEach(img => {
        img.src = iconURL;
        img.alt = `${app.name} icon`;
      });
    });

    const banner = $("[data-app-banner], #app-banner, .app-banner");

    if (banner && app.banner) {
      const bannerURL = safeURL(app.banner);

      if (bannerURL !== "#") {
        banner.style.backgroundImage =
          `url("${bannerURL.replace(/["\\]/g, "")}")`;
      }
    }

    const sourceLink = $("[data-app-source], #app-source");

    if (sourceLink && app.repo) {
      sourceLink.href = safeURL(`https://github.com/${normaliseRepo(app.repo)}`);
      sourceLink.hidden = false;
    }

    const websiteLink = $("[data-app-website], #app-website");

    if (websiteLink) {
      if (app.website) {
        websiteLink.href = safeURL(app.website);
        websiteLink.hidden = websiteLink.href === "#";
      } else {
        websiteLink.hidden = true;
      }
    }

    const playStoreLink = $("[data-app-play-store]");
    if (playStoreLink) {
      playStoreLink.hidden = !app.playStore;
      if (app.playStore) playStoreLink.href = safeURL(app.playStore);
    }

    const appStoreLink = $("[data-app-app-store]");
    if (appStoreLink) {
      appStoreLink.hidden = !app.appStore;
      if (app.appStore) appStoreLink.href = safeURL(app.appStore);
    }

    const supportButton = $("[data-app-support]");
    if (supportButton) {
      supportButton.href = CONFIG.supportUrl;
      supportButton.target = "_blank";
      supportButton.rel = "noopener noreferrer";
    }

    renderScreenshots(app);
    renderFeatureList(app);
    renderDetails(app);
    renderDataSafety(app);
    renderRelatedApps(app);

    const status = getProjectStatus(app).toLowerCase();

    $$("[data-download-app], #download-app, .download-app").forEach(button => {
      button.hidden = Boolean(
        status.includes("planned") ||
        status.includes("coming soon")
      );
    });

    loadAppReleases(app);
  }

  async function initAppPage() {
    const slug = getAppSlugFromPath();

    if (!slug) return;

    const projects = await loadProjects();
    const app = projects.find(project => project.slug === slug);

    if (!app) {
      const main = $("main");

      if (main) {
        main.innerHTML = `
          <section class="empty-state-page">
            <h1>Project not found</h1>
            <p>This project may have been moved or removed.</p>
            <a class="button button-primary" href="${escapeHTML(siteURL("apps/"))}">
              Browse projects
            </a>
          </section>
        `;
      }

      return;
    }

    populateAppPage(app);
  }

  /* =========================================================
     DOWNLOAD, OBTAINIUM, STAR AND SUPPORT ACTIONS
     ========================================================= */

  document.addEventListener("click", event => {
    const downloadButton = event.target.closest(
      "[data-download-app], #download-app, .download-app"
    );

    if (downloadButton) {
      event.preventDefault();

      if (!state.currentApp) return;

      if (!state.latestAPKs.length) {
        createDialog(
          "download-unavailable-dialog",
          "Downloads unavailable",
          `
            <p>No APK files are currently available in the latest published
            GitHub release.</p>
            <p>Check the source repository or come back when a release is published.</p>
            ${externalLink(
              `https://github.com/${normaliseRepo(state.currentApp.repo)}/releases`,
              "View GitHub Releases ↗"
            )}
          `
        );

        return;
      }

      renderDownloadDialog(
        state.currentApp,
        state.releases[0] || null,
        state.latestAPKs
      );

      return;
    }

    const starButton = event.target.closest(
      "[data-star-app], #star-app, .star-app"
    );

    if (starButton) {
      event.preventDefault();

      const app = state.currentApp;
      if (!app?.repo) return;

      const repoURL = safeURL(`https://github.com/${normaliseRepo(app.repo)}`);

      const dialog = createDialog(
        "star-dialog",
        "Support this project",
        `
          <p>
            If you like this app, you can support its development by starring
            the GitHub repository.
          </p>
          <p>
            You must press the <strong>Star</strong> button on GitHub yourself.
            This website cannot star a repository on your behalf.
          </p>
          ${externalLink(repoURL, "Open GitHub repository ↗", "button button-primary")}
        `
      );

      const link = $("a.button-primary", dialog);

      if (link) {
        link.addEventListener("click", () => closeDialog(dialog), { once: true });
      }

      return;
    }

    const supportButton = event.target.closest(
      "[data-support-button], #support-button, .support-button"
    );

    if (supportButton) {
      event.preventDefault();

      createDialog(
        "support-dialog",
        "Support independent development",
        `
          <p>
            If you find these projects useful, you can support their development
            through Buy Me a Chai. Support is optional.
          </p>
          ${externalLink(
            CONFIG.supportUrl,
            "Support on Buy Me a Chai ↗",
            "button button-primary"
          )}
        `
      );

      return;
    }

    const screenshotButton = event.target.closest("[data-screenshot-open]");

    if (screenshotButton) {
      event.preventDefault();

      const src = safeURL(screenshotButton.dataset.screenshotOpen);
      const alt = screenshotButton.dataset.screenshotAlt || "App screenshot";

      if (src === "#") return;

      createDialog(
        "screenshot-dialog",
        alt,
        `
          <img class="screenshot-large"
               src="${escapeHTML(src)}"
               alt="${escapeHTML(alt)}">
        `
      );
    }
  });

  /* =========================================================
     FOOTER YEAR
     ========================================================= */

  function initFooterYear() {
    $$("[data-current-year], #current-year, .current-year").forEach(element => {
      element.textContent = String(new Date().getFullYear());
    });
  }

  /* =========================================================
     MOBILE MENU
     Works with common data attributes and IDs
     ========================================================= */

  function initMobileMenu() {
    document.addEventListener("click", event => {
      const toggle = event.target.closest(
        "[data-menu-toggle], #menu-toggle, .menu-toggle"
      );

      if (toggle) {
        event.preventDefault();

        const targetId = toggle.getAttribute("aria-controls");
        const menu = targetId
          ? document.getElementById(targetId)
          : $("[data-mobile-menu], #mobile-menu, .mobile-menu");

        if (!menu) return;

        const opening = menu.hidden || !menu.classList.contains("is-open");

        menu.hidden = !opening;
        menu.classList.toggle("is-open", opening);
        toggle.setAttribute("aria-expanded", String(opening));
      }

      const menuLink = event.target.closest(
        "[data-mobile-menu] a, #mobile-menu a, .mobile-menu a"
      );

      if (menuLink) {
        const menu = menuLink.closest(
          "[data-mobile-menu], #mobile-menu, .mobile-menu"
        );

        if (menu) {
          menu.classList.remove("is-open");
          menu.hidden = true;
        }
      }
    });
  }

  /* =========================================================
     ACCESSIBILITY AND LINK SAFETY
     ========================================================= */

  function initExternalLinks() {
    $$('a[target="_blank"]').forEach(link => {
      const rel = new Set((link.getAttribute("rel") || "").split(/\s+/).filter(Boolean));
      rel.add("noopener");
      rel.add("noreferrer");
      link.setAttribute("rel", [...rel].join(" "));
    });
  }

  /* =========================================================
     STARTUP
     ========================================================= */

  async function init() {
    initTheme();
    initBottomNavigation();
    initFooterYear();
    initMobileMenu();
    initExternalLinks();

    const appSlug = getAppSlugFromPath();

    if (appSlug) {
      await initAppPage();
    } else {
      await loadProjects();
      renderProjectLists();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
atform)}</span>`).join("")}
            </div>
          </div>
        </div>

        <div class="app-actions-row">
          <button class="button button-primary button-wide" type="button" data-open-download>
            ${icon("download")} <span>Download</span>
          </button>
          <a class="support-round" href="${escapeHTML(supportURL)}" aria-label="Support this project" title="Support this project">${icon("cup")}</a>
          <button class="star-round" type="button" data-open-star aria-label="Star this project on GitHub" title="Star on GitHub">${icon("heart")}</button>
        </div>

        <div class="app-meta-grid">
          <div class="app-meta"><span>Latest version</span><strong data-app-version>Checking…</strong></div>
          <div class="app-meta"><span>Download size</span><strong data-app-size>From release assets</strong></div>
          <div class="app-meta"><span>Platform</span><strong>${escapeHTML((app.platforms || []).join(", ") || "Not specified")}</strong></div>
          <div class="app-meta"><span>Licence</span><strong>${escapeHTML(app.license || "See repository")}</strong></div>
        </div>

        <div class="store-links">${storeLinks}</div>
      </section>

      <section class="container app-section">
        <h2>Screenshots</h2>
        <div class="screenshot-row" data-screenshot-row></div>
      </section>

      <section class="container app-section">
        <h2>About this app</h2>
        <p>${escapeHTML(app.description || "")}</p>
        <div class="detail-list" data-app-details></div>
      </section>

      <section class="container app-section">
        <h2>Features</h2>
        <div class="detail-list" data-app-features></div>
      </section>

      <section class="container app-section">
        <h2>Data safety</h2>
        <p class="muted-text">Developer-provided summary. This is not an independent security audit or a store certification.</p>
        <div class="data-safety-grid" data-app-safety></div>
      </section>

      <section class="container app-section">
        <h2>Latest releases & changelogs</h2>
        <div class="detail-list" data-release-list><p class="loading-note">Loading releases from GitHub…</p></div>
      </section>

      <section class="container app-section">
        <div class="section-heading">
          <div><span class="eyebrow">More to explore</span><h2>Other apps from me</h2></div>
          <a class="text-link" href="${escapeHTML(rootURL("apps/"))}">All apps ↗</a>
        </div>
        <div class="related-grid" data-related-grid></div>
      </section>

      <section class="container app-section">
        <h2>Source code</h2>
        <p>Read the code, report issues, and follow development on GitHub.</p>
        <a class="button button-soft" href="${escapeHTML(repoURL)}" target="_blank" rel="noopener noreferrer">Open GitHub repository ${icon("external")}</a>
      </section>

      <dialog data-download-dialog>
        <div class="dialog-inner">
          <div class="dialog-heading">
            <div><h2>Download ${escapeHTML(app.name)}</h2><p class="dialog-description">Choose a published APK or use Obtainium to follow future releases.</p></div>
            <button class="dialog-close" type="button" data-close-dialog aria-label="Close">×</button>
          </div>
          <div class="release-asset-list" data-download-assets><p class="loading-note">Loading available APKs…</p></div>
          <div class="dialog-actions">
            ${app.obtainium ? `<a class="button button-soft" href="obtainium://add/${encodeURIComponent(repoURL)}">Add to Obtainium ↗</a>` : ""}
            <a class="button button-quiet" href="${escapeHTML(repoURL + "/releases")}" target="_blank" rel="noopener noreferrer">All releases ↗</a>
          </div>
          <p class="dialog-description">Install only releases you trust. Android may ask you to allow installation from your browser or file manager.</p>
        </div>
      </dialog>

      <dialog data-star-dialog>
        <div class="dialog-inner">
          <div class="dialog-heading">
            <div><h2>Show this project some love?</h2><p class="confirm-copy">A GitHub star helps people discover the project. This website cannot star it for you.</p></div>
            <button class="dialog-close" type="button" data-close-dialog aria-label="Close">×</button>
          </div>
          <div class="dialog-actions">
            <button class="button button-soft" type="button" data-close-dialog>Not now</button>
            <a class="button button-primary" href="${escapeHTML(repoURL)}" target="_blank" rel="noopener noreferrer">Open repository ↗</a>
          </div>
        </div>
      </dialog>

      <dialog class="screenshot-dialog" data-screenshot-dialog>
        <div class="dialog-inner">
          <button class="dialog-close" type="button" data-close-dialog aria-label="Close screenshot">×</button>
          <img data-screenshot-large alt="App screenshot enlarged">
        </div>
      </dialog>
    `;

    // Screenshot gallery
    const screenshotRow = $("[data-screenshot-row]", appRoot);
    const screenshots = Array.isArray(app.screenshots) ? app.screenshots : [];

    if (!screenshots.length) {
      screenshotRow.innerHTML = `<div class="screenshot-placeholder">Screenshots will appear here when you add them to the project data.</div>`;
    } else {
      screenshotRow.innerHTML = screenshots.map((source, index) => {
        const src = safeURL(rootURL(source), "");
        return `<button class="screenshot-item" type="button" data-screenshot-src="${escapeHTML(src)}" aria-label="View screenshot ${index + 1}">
          <img src="${escapeHTML(src)}" alt="${escapeHTML(app.name)} screenshot ${index + 1}" loading="lazy">
        </button>`;
      }).join("");
    }

    $$("[data-screenshot-src]", screenshotRow).forEach(button => {
      button.addEventListener("click", () => {
        const dialog = $("[data-screenshot-dialog]", appRoot);
        const image = $("[data-screenshot-large]", dialog);
        image.src = button.dataset.screenshotSrc;
        image.alt = `${app.name} screenshot`;
        showDialog(dialog);
      });
    });

    // About and feature accordions
    const renderDisclosures = items => (items || []).map(item => `
      <details class="disclosure">
        <summary>${escapeHTML(item.title || "Details")}</summary>
        <div class="disclosure-content"><p>${escapeHTML(item.content || "")}</p></div>
      </details>
    `).join("");

    $("[data-app-details]", appRoot).innerHTML = renderDisclosures(app.details);
    $("[data-app-features]", appRoot).innerHTML = renderDisclosures(app.features);

    $("[data-app-safety]", appRoot).innerHTML = (app.dataSafety || []).map(item => `
      <article class="safety-card">
        <h3>${escapeHTML(item.title || "Information")}</h3>
        <p>${escapeHTML(item.content || "")}</p>
      </article>
    `).join("") || `<p class="muted-text">Data-safety information has not been provided.</p>`;

    // Related apps (never fabricate dummy projects)
    const related = projects.filter(project => project.slug !== app.slug);
    $("[data-related-grid]", appRoot).innerHTML = related.length
      ? related.map(project => `
        <a class="project-card" href="${escapeHTML(rootURL("apps/" + project.slug + "/"))}">
          <div class="project-card-top"><span class="project-icon">${escapeHTML((project.name || "?").slice(0,1))}</span><span class="project-status">${escapeHTML(project.status || "Project")}</span></div>
          <h3>${escapeHTML(project.name)}</h3><p>${escapeHTML(project.description || "")}</p>
          <div class="project-card-bottom"><span>${escapeHTML(project.category || "App")}</span><span class="arrow-bubble">↗</span></div>
        </a>
      `).join("")
      : `<div class="screenshot-placeholder">More apps will appear here when you add them to the project catalogue.</div>`;

    // Download and GitHub-star dialogs
    const downloadDialog = $("[data-download-dialog]", appRoot);
    const starDialog = $("[data-star-dialog]", appRoot);
    $("[data-open-download]", appRoot).addEventListener("click", () => showDialog(downloadDialog));
    $("[data-open-star]", appRoot).addEventListener("click", () => showDialog(starDialog));

    // Release details, versions, APK sizes and changelogs
    const releaseList = $("[data-release-list]", appRoot);
    const assetList = $("[data-download-assets]", appRoot);
    const versionElement = $("[data-app-version]", appRoot);
    const sizeElement = $("[data-app-size]", appRoot);

    try {
      const releases = await getReleases(app.repo);
      const latest = releases[0];

      if (!latest) {
        versionElement.textContent = "Not released";
        sizeElement.textContent = "Not available";
        assetList.innerHTML = `<p class="loading-note">No published release is available yet. Check back later or view the repository's release page.</p>`;
        releaseList.innerHTML = `<div class="screenshot-placeholder">No published release notes are available yet.</div>`;
      } else {
        versionElement.textContent = versionLabel(latest);
        const latestAPKs = (latest.assets || []).filter(isAPK);
        sizeElement.textContent = latestAPKs.length
          ? sizeLabel(latestAPKs.reduce((sum, asset) => sum + asset.size, 0)) + " total APK assets"
          : "No APK assets";

        assetList.innerHTML = latestAPKs.length
          ? latestAPKs.map(asset => `
            <div class="asset-row">
              <div><strong>${escapeHTML(variantLabel(asset.name))}</strong><small>${escapeHTML(asset.name)} · ${sizeLabel(asset.size)}</small></div>
              <a class="button button-primary" href="${escapeHTML(safeURL(asset.browser_download_url))}" target="_blank" rel="noopener noreferrer">Download</a>
            </div>
          `).join("")
          : `<p class="loading-note">This release has no APK files attached yet.</p>`;

        releaseList.innerHTML = releases.map((release, index) => `
          <details class="disclosure" ${index === 0 ? "open" : ""}>
            <summary>${escapeHTML(versionLabel(release))} · ${dateLabel(release.published_at)}</summary>
            <div class="disclosure-content">
              <p class="release-note">${escapeHTML(release.body || "No changelog provided for this release.")}</p>
              <a class="text-link" href="${escapeHTML(safeURL(release.html_url))}" target="_blank" rel="noopener noreferrer">View release on GitHub ↗</a>
            </div>
          </details>
        `).join("");
      }
    } catch (error) {
      versionElement.textContent = "Unavailable";
      sizeElement.textContent = "Unavailable";
      assetList.innerHTML = `<p class="loading-note">${escapeHTML(error.message)} <a class="text-link" href="${escapeHTML(repoURL + "/releases")}" target="_blank" rel="noopener noreferrer">Open GitHub Releases ↗</a></p>`;
      releaseList.innerHTML = `<div class="screenshot-placeholder">Release notes could not be loaded. You can still view them on the GitHub release page.</div>`;
    }
  }

  // Project catalogue and homepage cards
  async function initProjectLists() {
    const grids = $$("[data-project-grid]");
    const featured = $("[data-featured-project]");
    const search = $("[data-project-search]");
    const count = $("[data-result-count]");
    if (!grids.length && !featured) return;

    let projects = [];
    try {
      const response = await fetch(rootURL("data/projects.json"));
      if (!response.ok) throw new Error("Project catalogue unavailable");
      projects = await response.json();
      if (!Array.isArray(projects)) projects = [];
    } catch {
      grids.forEach(grid => grid.innerHTML = `<p class="loading-note">Project catalogue could not be loaded. Please try again later.</p>`);
      if (featured) featured.innerHTML = `<p class="loading-note">Featured project unavailable.</p>`;
      return;
    }

    function card(project, index = 0) {
      const url = rootURL(`apps/${project.slug}/`);
      const iconURL = project.icon ? safeURL(rootURL(project.icon), "") : "";
      return `<a class="project-card" href="${escapeHTML(url)}" style="animation-delay:${Math.min(index * 45, 240)}ms">
        <div class="project-card-top">
          ${iconURL
            ? `<img class="project-icon" src="${escapeHTML(iconURL)}" alt="" loading="lazy" onerror="this.style.display='none'">`
            : `<span class="project-icon" aria-hidden="true">✳</span>`}
          <span class="project-status">${escapeHTML(project.status || "Project")}</span>
        </div>
        <h3>${escapeHTML(project.name)}</h3>
        <p>${escapeHTML(project.description || project.tagline || "")}</p>
        <div class="project-card-bottom"><span>${escapeHTML(project.category || "Explore project")}</span><span class="arrow-bubble" aria-hidden="true">↗</span></div>
      </a>`;
    }

    if (featured) {
      const project = projects[0];
      featured.innerHTML = project
        ? `<div class="featured-card">
             ${project.icon ? `<img class="project-icon" src="${escapeHTML(safeURL(rootURL(project.icon), ""))}" alt="" onerror="this.style.display='none'">` : `<span class="project-icon">✳</span>`}
             <div><span class="metadata-pill">${escapeHTML(project.status || "Project")}</span><h3>${escapeHTML(project.name)}</h3><p>${escapeHTML(project.tagline || project.description || "")}</p></div>
             <a class="button button-primary" href="${escapeHTML(rootURL("apps/" + project.slug + "/"))}">View app ↗</a>
           </div>`
        : `<p class="loading-note">Add your first project in data/projects.json.</p>`;
    }

    function render() {
      const term = (search?.value || "").trim().toLowerCase();
      const filtered = projects.filter(project => [
        project.name, project.tagline, project.description,
        project.category, project.status, ...(project.features || []).map(item => typeof item === "string" ? item : item.title)
      ].join(" ").toLowerCase().includes(term));

      grids.forEach(grid => {
        const limit = Number(grid.dataset.limit || 0);
        const shown = limit ? filtered.slice(0, limit) : filtered;
        grid.innerHTML = shown.length
          ? shown.map(card).join("")
          : `<p class="loading-note">No matching projects yet.</p>`;
      });

      if (count) count.textContent = `${filtered.length} ${filtered.length === 1 ? "project" : "projects"}`;
    }

    render();
    search?.addEventListener("input", render);
  }

  initAppPage();
  initProjectLists();
})();


(() => {
  "use strict";

  const root = document.documentElement;
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

  const depth = () => {
    const path = location.pathname;
    const segments = path.split("/").filter(Boolean);
    return path.endsWith("/")
      ? segments.length
      : Math.max(0, segments.length - 1);
  };

  const rootURL = path => "../".repeat(depth()) + path.replace(/^\/+/, "");

  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  const safeURL = (value, fallback = "#") => {
    try {
      const url = new URL(String(value || fallback), location.href);
      return ["https:", "http:"].includes(url.protocol) ? url.href : fallback;
    } catch {
      return fallback;
    }
  };

  const icon = name => {
    const paths = {
      download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
      heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
      cup: '<path d="M4 8h12v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z"/><path d="M16 10h2a2 2 0 0 1 0 4h-2"/><path d="M8 3c-1 1 1 2 0 3"/><path d="M12 3c-1 1 1 2 0 3"/>',
      close: '<path d="m18 6-12 12"/><path d="m6 6 12 12"/>',
      external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
      moon: '<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>'
    };
    return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ""}</svg>`;
  };

  // Theme preference
  let savedTheme = null;
  try { savedTheme = localStorage.getItem("site-theme"); } catch {}

  root.dataset.theme =
    savedTheme === "light" || savedTheme === "dark"
      ? savedTheme
      : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  function updateThemeButton() {
    const dark = root.dataset.theme === "dark";
    const button = $(".theme-toggle");
    const themeIcon = $("[data-theme-icon]");
    if (themeIcon) themeIcon.innerHTML = icon(dark ? "sun" : "moon");
    button?.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    button?.setAttribute("aria-pressed", String(dark));
  }

  updateThemeButton();

  $(".theme-toggle")?.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("site-theme", root.dataset.theme); } catch {}
    updateThemeButton();
  });

  $$("[data-year]").forEach(el => el.textContent = String(new Date().getFullYear()));

  // Root-relative navigation links
  $$("[data-root-link]").forEach(link => {
    link.href = rootURL(link.dataset.rootLink);
  });

  // Active navigation
  const currentPath = location.pathname.replace(/index\.html$/, "").replace(/\/?$/, "/");

  $$("[data-nav-link]").forEach(link => {
    const url = new URL(link.href, location.href);
    const targetPath = url.pathname.replace(/index\.html$/, "").replace(/\/?$/, "/");
    const isProjectPage = currentPath.startsWith("/apps/") && targetPath === "/apps/";
    link.classList.toggle("is-active", targetPath === currentPath || isProjectPage);
  });

  // Floating pill: compact down, expand up
  const nav = $("[data-bottom-nav]");
  let previousY = window.scrollY;
  let ticking = false;

  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      const delta = y - previousY;
      if (y < 45) nav?.classList.remove("is-compact");
      else if (Math.abs(delta) > 4) nav?.classList.toggle("is-compact", delta > 0);
      previousY = y;
      ticking = false;
    });
  }, { passive: true });

  nav?.addEventListener("focusin", () => nav.classList.remove("is-compact"));
  nav?.addEventListener("pointerdown", () => nav.classList.remove("is-compact"));

  // Dialog helpers
  function showDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  $$("[data-close-dialog]").forEach(button => {
    button.addEventListener("click", () => closeDialog(button.closest("dialog")));
  });

  $$("dialog").forEach(dialog => {
    dialog.addEventListener("click", event => {
      if (event.target === dialog) closeDialog(dialog);
    });
  });

  // GitHub release helpers
  const sizeLabel = bytes => {
    if (!Number.isFinite(Number(bytes))) return "Size unavailable";
    const size = Number(bytes);
    if (size < 1024) return `${size} B`;
    if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 ** 2).toFixed(2)} MB`;
  };

  const dateLabel = value => {
    if (!value) return "Date unavailable";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Date unavailable"
      : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
  };

  const versionLabel = release => release?.name || release?.tag_name || "Version unavailable";

  const variantLabel = filename => {
    const name = filename.toLowerCase();
    if (name.includes("universal")) return "Universal APK";
    if (name.includes("arm64-v8a") || name.includes("arm64")) return "ARM64 · arm64-v8a";
    if (name.includes("armeabi-v7a") || name.includes("armv7")) return "ARM 32-bit · armeabi-v7a";
    if (name.includes("x86_64") || name.includes("x64")) return "x86 64-bit · x86_64";
    if (name.includes("x86")) return "x86 32-bit · x86";
    return filename;
  };

  const isAPK = asset => /\.apk$/i.test(asset.name) && asset.state !== "starter";

  async function getReleases(repo) {
    const cleanRepo = String(repo || "").trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(cleanRepo)) {
      throw new Error("A valid public GitHub repository is not configured.");
    }

    const response = await fetch(
      `https://api.github.com/repos/${cleanRepo}/releases?per_page=10`,
      { headers: { Accept: "application/vnd.github+json" } }
    );

    if (!response.ok) {
      if (response.status === 404) throw new Error("No public releases were found.");
      if (response.status === 403) throw new Error("GitHub's public API rate limit may have been reached. Try again later.");
      throw new Error("Release information could not be loaded from GitHub.");
    }

    const data = await response.json();
    return Array.isArray(data)
      ? data.filter(release => !release.draft)
      : [];
  }

  // App page renderer
  const appRoot = $("[data-app-page]");

  async function initAppPage() {
    if (!appRoot) return;

    let projects;
    try {
      const response = await fetch(rootURL("data/projects.json"));
      if (!response.ok) throw new Error("Project catalogue unavailable");
      projects = await response.json();
    } catch {
      appRoot.innerHTML = `<section class="container page-heading"><h1>App information unavailable</h1><p>Could not load the project catalogue. Please try again later.</p></section>`;
      return;
    }

    const slug = location.pathname.split("/").filter(Boolean).pop();
    const app = projects.find(project => project.slug === slug);

    if (!app) {
      appRoot.innerHTML = `<section class="container page-heading"><h1>Project not found</h1><p>This app is not listed in the catalogue.</p><a class="button button-primary" href="${escapeHTML(rootURL("apps/"))}">Browse apps</a></section>`;
      return;
    }

    document.title = `${app.name} — Skywa1ker404's Studio`;

    const repoURL = safeURL(`https://github.com/${app.repo}`);
    const supportURL = safeURL(rootURL("support/"));
    const storeLinks = [
      app.playStore ? `<a class="button button-soft" href="${escapeHTML(safeURL(app.playStore))}" target="_blank" rel="noopener noreferrer">Google Play ${icon("external")}</a>` : "",
      app.appStore ? `<a class="button button-soft" href="${escapeHTML(safeURL(app.appStore))}" target="_blank" rel="noopener noreferrer">App Store ${icon("external")}</a>` : "",
      app.website ? `<a class="button button-soft" href="${escapeHTML(safeURL(app.website))}" target="_blank" rel="noopener noreferrer">Official website ${icon("external")}</a>` : ""
    ].filter(Boolean).join("");

    const bannerStyle = app.banner
      ? `style="background-image:linear-gradient(90deg,rgba(30,34,24,.14),rgba(30,34,24,.02)),url('${escapeHTML(safeURL(rootURL(app.banner)))}')"`
      : "";

    appRoot.innerHTML = `
      <div class="app-banner" ${bannerStyle}></div>
      <section class="container app-overview">
        <div class="app-identity">
          <div class="app-icon-large">
            <img src="${escapeHTML(rootURL(app.icon || ""))}" alt="${escapeHTML(app.name)} app icon"
                 onerror="this.remove();this.parentElement.innerHTML='<span class=&quot;app-icon-fallback&quot; aria-hidden=&quot;true&quot;>${escapeHTML((app.name || "?").slice(0,1))}</span>'">
          </div>
          <div>
            <h1>${escapeHTML(app.name)}</h1>
            <p class="app-tagline">${escapeHTML(app.tagline || "")}</p>
            <div class="app-status-row">
              <span class="metadata-pill">${escapeHTML(app.status || "Project")}</span>
              ${(app.platforms || []).map(platform => `<span class="metadata-pill">${escapeHTML(platform)}</span>`).join("")}
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

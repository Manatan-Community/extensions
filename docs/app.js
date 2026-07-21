const mediaTypes = ["manga", "video", "novel"];
const siteBaseUrl = window.location.protocol === "file:"
  ? "https://manatan-community.github.io/extensions"
  : window.location.href.replace(/\/(?:index\.html)?(?:[?#].*)?$/, "");
const cacheKey = Date.now().toString();
const state = {
  activeMedia: "all",
  language: "all",
  query: "",
  loading: true,
  summaryCounts: {},
  entries: []
};

const catalog = document.querySelector("#catalog-list");
const resultCount = document.querySelector("#result-count");
const search = document.querySelector("#search");
const languageFilter = document.querySelector("#language-filter");

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => setMedia(button.dataset.media));
});

document.querySelectorAll("[data-jump-media]").forEach((link) => {
  link.addEventListener("click", () => setMedia(link.dataset.jumpMedia));
});

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", () => copyText(button, button.dataset.copy));
});

search.addEventListener("input", () => {
  state.query = search.value.trim().toLowerCase();
  render();
});

languageFilter.addEventListener("change", () => {
  state.language = languageFilter.value;
  render();
});

loadIndexes();

async function loadIndexes() {
  try {
    if (await loadCatalog()) return;

    const indexes = await loadIndexSummary();
    setStatsFromSummary(indexes);
    const listCacheKey = indexes.map((entry) => `${entry.media}-${entry.count ?? 0}`).join(".");
    const groups = await Promise.all(
      indexes.map(async ({ media, index }) => {
        const items = await fetchJson(index, listCacheKey);
        return items.map((item) => normalizeEntry(item, media));
      })
    );
    state.entries = groups.flat().sort((a, b) => a.name.localeCompare(b.name));
    state.loading = false;
    setStats();
    setLanguages();
    render();
  } catch (error) {
    state.loading = false;
    catalog.innerHTML = `<div class="empty">Could not load extension indexes. ${escapeHtml(error.message)}</div>`;
    resultCount.textContent = "Index loading failed";
  }
}

async function loadCatalog() {
  try {
    const entries = await fetchJson("catalog.min.json", cacheKey, "no-store");
    if (!Array.isArray(entries)) return false;
    state.entries = entries.map((entry) => normalizeEntry(entry)).sort((a, b) => a.name.localeCompare(b.name));
    state.loading = false;
    setStats();
    setLanguages();
    render();
    return true;
  } catch {
    return false;
  }
}

async function loadIndexSummary() {
  try {
    const indexRoot = await fetchJson("index.json", cacheKey, "no-store");
    if (Array.isArray(indexRoot.indexes)) {
      return indexRoot.indexes.filter((entry) => mediaTypes.includes(entry.media));
    }
  } catch {
    // Some Pages configurations only serve the media indexes. Fall back cleanly.
  }
  return mediaTypes.map((media) => ({ media, index: `${media}.min.json` }));
}

async function fetchJson(path, version, cache = "default") {
  const response = await fetch(`${siteBaseUrl}/${path}?v=${encodeURIComponent(version)}`, { cache });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}

function normalizeEntry(entry, media) {
  return {
    ...entry,
    media: entry.media || media || entry.mediaKind,
    lang: entry.lang || entry.language || "all",
    version: entry.version || entry.versionName || "",
    packageId: entry.packageId || entry.id
  };
}

function setMedia(media) {
  state.activeMedia = media;
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.media === media);
  });
  render();
}

function setStats() {
  document.querySelector("#total-count").textContent = state.entries.length;
  for (const media of mediaTypes) {
    document.querySelector(`#${media}-count`).textContent = state.entries.filter((entry) => entry.media === media).length;
  }
}

function setStatsFromSummary(indexes) {
  state.summaryCounts = Object.fromEntries(
    indexes.map((entry) => [entry.media, Number.isFinite(entry.count) ? entry.count : 0])
  );
  const total = mediaTypes.reduce((sum, media) => sum + (state.summaryCounts[media] || 0), 0);
  document.querySelector("#total-count").textContent = total;
  for (const media of mediaTypes) {
    document.querySelector(`#${media}-count`).textContent = state.summaryCounts[media] || 0;
  }
  resultCount.textContent = `${total} extensions`;
}

function setLanguages() {
  languageFilter.querySelectorAll("option:not([value='all'])").forEach((option) => option.remove());
  const languages = [...new Set(state.entries.map((entry) => entry.lang))].sort();
  for (const language of languages) {
    const option = document.createElement("option");
    option.value = language;
    option.textContent = language;
    languageFilter.append(option);
  }
}

function render() {
  if (state.loading) {
    const count = state.activeMedia === "all"
      ? mediaTypes.reduce((sum, media) => sum + (state.summaryCounts[media] || 0), 0)
      : state.summaryCounts[state.activeMedia] || 0;
    resultCount.textContent = `${count} ${count === 1 ? "extension" : "extensions"}`;
    catalog.innerHTML = '<div class="empty">Loading catalog...</div>';
    return;
  }

  const entries = state.entries.filter((entry) => {
    const mediaMatch = state.activeMedia === "all" || entry.media === state.activeMedia;
    const languageMatch = state.language === "all" || entry.lang === state.language;
    const haystack = [
      entry.name,
      entry.id,
      entry.packageId,
      entry.lang,
      entry.version,
      ...(entry.sourceIds || []),
      ...(entry.sources || []).flatMap((source) => [source.id, source.name])
    ]
      .join(" ")
      .toLowerCase();
    return mediaMatch && languageMatch && (!state.query || haystack.includes(state.query));
  });

  resultCount.textContent = `${entries.length} ${entries.length === 1 ? "extension" : "extensions"}`;

  if (entries.length === 0) {
    catalog.innerHTML = '<div class="empty">No extensions match the current filters.</div>';
    return;
  }

  catalog.innerHTML = entries.map(renderCard).join("");
  catalog.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", () => copyText(button, button.dataset.copy));
  });
}

function renderCard(entry) {
  const packageId = entry.packageId || entry.id;
  const subtitle = getSubtitle(entry, packageId);
  const size = formatBytes(entry.sizeBytes ?? entry.size);
  const rating = entry.contentRating ? `<span class="pill">${escapeHtml(entry.contentRating)}</span>` : "";
  const icon = renderIcon(entry);
  const packageUrl = toRawUrl(entry.packageUrl);
  const jsonUrl = `${siteBaseUrl}/${entry.media}.json`;
  return `
    <article class="card">
      <div class="card-main">
        ${icon}
        <div class="card-body">
          <div class="card-title">
            <h3>${escapeHtml(entry.name)}</h3>
            <span class="pill ${entry.media}">${escapeHtml(entry.media)}</span>
          </div>
          <div class="card-subtitle">${escapeHtml(subtitle)}</div>
          <div class="meta">
            <span class="pill">${escapeHtml(entry.lang)}</span>
            <span class="pill">v${escapeHtml(entry.version)} (${entry.versionCode})</span>
            <span class="pill">${size}</span>
            ${rating}
          </div>
          <div class="hash">sha256 ${escapeHtml(entry.sha256)}</div>
        </div>
      </div>
      <div class="actions">
        <a href="${escapeAttribute(packageUrl)}">Download</a>
        <button type="button" data-copy="${escapeAttribute(packageUrl)}">Copy URL</button>
        <a href="${escapeAttribute(jsonUrl)}">Install JSON</a>
      </div>
    </article>
  `;
}

function getSubtitle(entry, packageId) {
  const labels = [packageId, ...getSourceLabels(entry)];
  const seen = new Set();
  const unique = labels
    .map((label) => String(label || "").trim())
    .filter((label) => {
      if (!label) return false;
      const key = label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return unique.join(" · ") || "Unknown source";
}

function renderIcon(entry) {
  const initial = Array.from(String(entry.name || entry.id || "?").trim())[0] || "?";
  const iconUrl = entry.iconUrl ? toRawUrl(entry.iconUrl) : "";
  const image = iconUrl
    ? `<img src="${escapeAttribute(iconUrl)}" alt="" loading="lazy" onerror="this.closest('.extension-icon').classList.add('missing'); this.remove();">`
    : "";
  return `
    <div class="extension-icon ${escapeAttribute(entry.media)}${iconUrl ? "" : " missing"}" aria-hidden="true">
      ${image}
      <span>${escapeHtml(initial.toUpperCase())}</span>
    </div>
  `;
}

function getSourceLabels(entry) {
  if (Array.isArray(entry.sources) && entry.sources.length) {
    return entry.sources.map((source) => source.name || source.id).filter(Boolean);
  }
  if (Array.isArray(entry.sourceIds) && entry.sourceIds.length) {
    return entry.sourceIds;
  }
  return [];
}

function toRawUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteBaseUrl}/${String(path).replace(/^\/+/, "")}`;
}

async function copyText(button, text) {
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied";
  } catch {
    button.textContent = "Copy failed";
  }
  window.setTimeout(() => {
    button.textContent = original;
  }, 1200);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

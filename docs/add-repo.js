const repoUrls = {
  manga: "https://manatan-community.github.io/extensions/manga.min.json",
  video: "https://manatan-community.github.io/extensions/video.min.json",
  novel: "https://manatan-community.github.io/extensions/novel.min.json",
  mihonManga: "https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.pb",
  aniyomiVideo: "https://raw.githubusercontent.com/yuzono/anime-repo/repo/index.min.json"
};

const reposByMedia = {
  manga: [
    { label: "Manatan manga", url: repoUrls.manga },
    { label: "Mihon Manga Extensions", url: repoUrls.mihonManga }
  ],
  video: [
    { label: "Manatan video", url: repoUrls.video },
    { label: "Aniyomi Video Extensions", url: repoUrls.aniyomiVideo }
  ],
  novel: [
    { label: "Manatan novel", url: repoUrls.novel }
  ]
};

const repoLabels = {
  bundle: "All Repositories",
  manga: "Manga Repositories",
  video: "Video Repositories",
  novel: "Novel Repository"
};

const validRepos = ["bundle", "manga", "video", "novel"];
const params = new URLSearchParams(window.location.search);
const initialRepo = validRepos.includes(params.get("repo")) ? params.get("repo") : "bundle";
const autoOpen = params.get("open") !== "0";

const callbackUrl = document.querySelector("#callback-url");
const schemeLink = document.querySelector("#scheme-link");
const androidIntent = document.querySelector("#android-intent");
const fallbackLink = document.querySelector("#fallback-link");
const autoOpenLink = document.querySelector("#auto-open");
const copyCallback = document.querySelector("#copy-callback");
const status = document.querySelector("#status");

let selectedRepo = initialRepo;
let currentSchemeUrl = "";
let currentIntentUrl = "";

for (const [key, url] of Object.entries(repoUrls)) {
  const target = document.querySelector(`[data-url="${key}"]`);
  if (target) target.textContent = url;
}

document.querySelectorAll(".repo-option").forEach((button) => {
  button.addEventListener("click", () => {
    selectedRepo = button.dataset.repo;
    setRepo(selectedRepo, false);
  });
});

document.querySelectorAll("[data-copy-url]").forEach((button) => {
  button.addEventListener("click", () => copyText(button, repoUrls[button.dataset.copyUrl]));
});

document.querySelector("[data-copy-all]").addEventListener("click", (event) => {
  copyText(event.currentTarget, allRepositoryLines().join("\n"));
});

copyCallback.addEventListener("click", () => copyText(copyCallback, currentSchemeUrl));

autoOpenLink.addEventListener("click", (event) => {
  event.preventDefault();
  openManatan();
});

setRepo(selectedRepo, autoOpen);

function setRepo(repo, shouldOpen) {
  selectedRepo = repo;
  document.querySelectorAll(".repo-option").forEach((button) => {
    button.classList.toggle("active", button.dataset.repo === repo);
  });

  currentSchemeUrl = buildSchemeUrl(repo);
  currentIntentUrl = buildIntentUrl(currentSchemeUrl);
  callbackUrl.textContent = currentSchemeUrl;
  schemeLink.href = currentSchemeUrl;
  androidIntent.href = currentIntentUrl;
  autoOpenLink.href = currentSchemeUrl;

  const url = new URL(window.location.href);
  url.searchParams.set("repo", repo);
  if (!shouldOpen) url.searchParams.set("open", "0");
  window.history.replaceState(null, "", url);
  fallbackLink.href = buildFallbackUrl(repo);

  status.textContent = `Ready to add ${repoLabels[repo]}.`;
  if (shouldOpen) window.setTimeout(openManatan, 200);
}

function buildSchemeUrl(repo) {
  const query = new URLSearchParams();
  query.set("name", repoLabels[repo]);
  query.set("source", "manatan-community");

  if (repo === "bundle" || repoUrlsFor(repo).length > 1) {
    for (const [media, repos] of Object.entries(reposForCallback(repo))) {
      for (const item of repos) {
        query.append(`${media}Url`, item.url);
      }
    }
    return `manatan://add-repos?${query.toString()}`;
  }

  query.set("media", repo);
  query.set("url", repoUrlsFor(repo)[0].url);
  return `manatan://add-repo?${query.toString()}`;
}

function reposForCallback(repo) {
  if (repo === "bundle") return reposByMedia;
  return { [repo]: reposByMedia[repo] ?? [] };
}

function repoUrlsFor(repo) {
  return reposByMedia[repo] ?? [];
}

function allRepositoryLines() {
  return Object.values(reposByMedia)
    .flat()
    .map((item) => `${item.label}: ${item.url}`);
}

function buildIntentUrl(schemeUrl) {
  const callback = new URL(schemeUrl);
  return `intent://${callback.host}${callback.pathname}${callback.search}#Intent;scheme=manatan;package=com.mangatan.app;S.browser_fallback_url=${encodeURIComponent(buildFallbackUrl(selectedRepo))};end`;
}

function buildFallbackUrl(repo) {
  const fallback = new URL(window.location.href);
  fallback.searchParams.set("repo", repo);
  fallback.searchParams.set("open", "0");
  return fallback.toString();
}

function openManatan() {
  status.textContent = "Opening Manatan...";
  const isAndroid = /Android/i.test(navigator.userAgent);
  window.location.href = isAndroid ? currentIntentUrl : currentSchemeUrl;
  window.setTimeout(() => {
    status.textContent = "If Manatan did not open, use a manual URL below.";
  }, 1400);
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

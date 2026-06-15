# Manatan Repository Callback

The add page uses Manatan custom URL callbacks so Android, iOS, and desktop clients can share repository install entry points.

```text
manatan://add-repos?name=All+Repositories&mangaUrl=...&mangaUrl=...&mangaUrl=...&videoUrl=...&videoUrl=...&novelUrl=...&source=manatan-community
```

Bulk add uses `manatan://add-repos` with media-specific repository URLs. A media can appear more than once by repeating its query parameter, such as multiple `mangaUrl` or `videoUrl` values. It does not use a synthetic `all` media kind.

Single repository add uses:

```text
manatan://add-repo?name=Manatan+Community+Manga&media=manga&url=...&source=manatan-community
```

Supported `media` values for `manatan://add-repo`:

- `manga`
- `video`
- `novel`

Recommended client behavior:

1. Accept `manatan://add-repos` and add every `mangaUrl`, `videoUrl`, and `novelUrl` value to its matching media repository store.
2. Accept `manatan://add-repo`, then read `media`, `name`, and `url`.
3. For a single repository callback, add `url` to that media repository store.
4. De-duplicate existing repository URLs.
5. Open the extension repository/settings screen after import.

Android browsers also receive an intent URL:

```text
intent://add-repos?...#Intent;scheme=manatan;package=com.mangatan.app;S.browser_fallback_url=...;end
```

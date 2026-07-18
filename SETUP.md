# Setup — Fresh Instance

This covers getting the site and the Spotify "now playing" backend running from a clean clone. There are two independent parts: the static site (Parcel) and the Cloudflare Worker (Spotify backend).

## 1. Static site

```bash
npm install
npm start        # dev server at http://localhost:1234/, hot reload
npm run build    # production build to dist/
```

Node version is pinned in `.nvmrc` (16.14.2) — run `nvm use` if you use nvm. No `.env`/secrets needed for this part; it just fetches from the deployed Spotify worker over the network.

## 2. Spotify worker (`spotify-worker/`)

This is a separate Cloudflare Worker project — its own `package.json`, deployed independently of the static site.

```bash
cd spotify-worker
npm install
```

### 2a. Get Spotify credentials

You need three values: a Spotify app's **Client ID** and **Client Secret**, and a **refresh token** authorized for your Spotify account.

1. Create an app at the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) to get the Client ID/Secret. Add a redirect URI (e.g. `http://127.0.0.1:8888/callback`) in the app settings.
2. Run the OAuth **Authorization Code Flow** once to get a refresh token, requesting at least the `user-read-currently-playing` and `user-read-recently-played` scopes. Spotify's [Authorization Code flow guide](https://developer.spotify.com/documentation/web-api/tutorials/code-flow) walks through this — the short version: open an authorize URL in a browser, capture the `code` param from the redirect, then exchange it for tokens at `https://accounts.spotify.com/api/token`. The `refresh_token` in that response is a long-lived credential — save it, you only need to do this once.

### 2b. Cloudflare auth

```bash
npx wrangler login
```

This opens a browser to authorize Wrangler against your Cloudflare account.

### 2c. Configure secrets

For production (`wrangler deploy` reads these from Cloudflare, not from any local file):

```bash
npx wrangler secret put SPOTIFY_CLIENT_ID
npx wrangler secret put SPOTIFY_CLIENT_SECRET
npx wrangler secret put SPOTIFY_REFRESH_TOKEN
```

Each prompts for the value interactively.

For local dev (`npm run dev` / `wrangler dev`), copy `.dev.vars.example` to `.dev.vars` and fill in the same three values — this file is gitignored and never deployed.

### 2d. Deploy

```bash
npm test          # run the worker's test suite (vitest, fully mocked — no live credentials needed)
npx wrangler deploy
```

This publishes to `https://<name>.<your-account-subdomain>.workers.dev`, where `<name>` is `wrangler.jsonc`'s `"name"` field (currently `spotify-now-playing`).

**Important:** the static site's `src/data/nowPlayingConfig.js` has the worker URL hardcoded (`jsonEndpoint`). If you deploy to a different Cloudflare account, the subdomain will differ from what's currently configured — update `jsonEndpoint` in that file to match your actual deployed URL, then rebuild the site.

### 2e. Verify

```bash
curl -s https://<your-worker-url>/
```

Should return JSON like `{"title":"...","artist":"...","isPlaying":true,...}` (or `{"error":"no_track_available"}` if nothing's played recently). If you get an error about the token refresh, double check the three secrets and that the refresh token's scopes include `user-read-currently-playing`/`user-read-recently-played`.

## Deployment of the static site

`.github/workflows/gh-pages.yml` builds and publishes `dist/` to GitHub Pages automatically — but only on push/PR to a branch literally named `main`. This repo's default branch is `master`, so that workflow won't fire unless you push to `main` specifically.

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_NOW_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing';
const SPOTIFY_RECENTLY_PLAYED_URL = 'https://api.spotify.com/v1/me/player/recently-played?limit=1';

const SPOTIFY_GLYPH_PATH =
	'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z';

function corsHeaders() {
	return {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
	};
}

function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'no-store',
			'CDN-Cache-Control': 'no-store',
			'Cloudflare-CDN-Cache-Control': 'no-store',
			...corsHeaders(),
		},
	});
}

function svgResponse(svg) {
	return new Response(svg, {
		headers: {
			'Content-Type': 'image/svg+xml',
			'Cache-Control': 'no-store',
			'CDN-Cache-Control': 'no-store',
			'Cloudflare-CDN-Cache-Control': 'no-store',
			...corsHeaders(),
		},
	});
}

async function getAccessToken(env) {
	const basicAuth = btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
	const res = await fetch(SPOTIFY_TOKEN_URL, {
		method: 'POST',
		headers: {
			Authorization: `Basic ${basicAuth}`,
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: env.SPOTIFY_REFRESH_TOKEN,
		}),
	});

	if (!res.ok) {
		throw new Error(`spotify token refresh failed: ${res.status}`);
	}

	const data = await res.json();
	return data.access_token;
}

function trackPayload(track, isPlaying, progressMs) {
	const images = (track.album && track.album.images) || [];
	const image = images[1] || images[0];

	return {
		title: track.name,
		artist: track.artists.map((artist) => artist.name).join(', '),
		trackUrl: track.external_urls.spotify,
		isPlaying,
		albumImageUrl: image && image.url,
		durationMs: track.duration_ms,
		progressMs: isPlaying ? progressMs : null,
	};
}

async function fetchNowPlaying(accessToken) {
	const res = await fetch(SPOTIFY_NOW_PLAYING_URL, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});

	if (res.status === 204) return null;
	if (!res.ok) throw new Error(`spotify now-playing failed: ${res.status}`);

	const data = await res.json();
	if (!data || !data.item) return null;

	return trackPayload(data.item, data.is_playing, data.progress_ms);
}

async function fetchRecentlyPlayed(accessToken) {
	const res = await fetch(SPOTIFY_RECENTLY_PLAYED_URL, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});

	if (!res.ok) throw new Error(`spotify recently-played failed: ${res.status}`);

	const data = await res.json();
	const track = data.items && data.items[0] && data.items[0].track;
	if (!track) return null;

	return trackPayload(track, false, null);
}

async function fetchCurrentOrRecent(env) {
	const accessToken = await getAccessToken(env);
	const nowPlaying = await fetchNowPlaying(accessToken);
	return nowPlaying || (await fetchRecentlyPlayed(accessToken));
}

async function fetchImageAsBase64(url) {
	if (!url) return null;
	const res = await fetch(url);
	if (!res.ok) return null;

	const bytes = new Uint8Array(await res.arrayBuffer());
	let binary = '';
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
	}
	return btoa(binary);
}

function escapeXml(value) {
	return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function formatTime(ms) {
	if (ms == null || Number.isNaN(ms)) return '0:00';
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function renderSpotifyEmbedSvg(payload, options) {
	const mode = options.mode === 'light' ? 'light' : 'dark';
	const borderRadius = Number(options.borderRadius) || 10;
	const isDark = mode === 'dark';
	const isPlaying = Boolean(payload && payload.isPlaying);

	const colors = {
		bg: isDark ? '#181818' : '#ffffff',
		coverBg: isDark ? '#282828' : '#f0f0f0',
		track: isDark ? '#ffffff' : '#000000',
		artist: isDark ? '#b3b3b3' : '#6a6a6a',
		barBg: isDark ? '#404040' : '#d9dadc',
		barIdleFill: isDark ? '#535353' : '#949494',
		time: isDark ? '#a7a7a7' : '#6a6a6a',
		offline: isDark ? '#b3b3b3' : '#6a6a6a',
		icon: isDark ? '#ffffff' : '#000000',
		status: isPlaying ? '#1db954' : '#b3b3b3',
	};

	const style = `
		* { margin: 0; padding: 0; box-sizing: border-box; }
		.container {
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
			background-color: ${colors.bg};
			border-radius: ${borderRadius}px;
			padding: 16px;
			display: flex;
			align-items: center;
			gap: 16px;
			width: 460px;
			height: 152px;
		}
		.cover-container {
			flex-shrink: 0;
			width: 120px;
			height: 120px;
			border-radius: 4px;
			overflow: hidden;
			background-color: ${colors.coverBg};
			display: flex;
			align-items: center;
			justify-content: center;
		}
		.cover { width: 100%; height: 100%; object-fit: cover; }
		.info { flex: 1; display: flex; flex-direction: column; justify-content: space-between; min-width: 0; height: 120px; }
		.details { flex: 1; display: flex; flex-direction: column; justify-content: center; }
		.track-name {
			color: ${colors.track};
			font-size: 18px;
			font-weight: 700;
			line-height: 24px;
			margin-bottom: 4px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.artist-name {
			color: ${colors.artist};
			font-size: 14px;
			line-height: 20px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.logo-row { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
		.logo { width: 20px; height: 20px; }
		.status { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: ${colors.status}; }
		.progress-wrap { width: 100%; margin-top: auto; }
		.progress-bg { width: 100%; height: 4px; background-color: ${colors.barBg}; border-radius: 2px; overflow: hidden; margin-bottom: 6px; }
		.progress-fill { height: 100%; background-color: ${isPlaying ? '#1db954' : colors.barIdleFill}; border-radius: 2px; }
		.times { display: flex; justify-content: space-between; color: ${colors.time}; font-size: 11px; }
		.offline { color: ${colors.offline}; font-size: 14px; text-align: center; }
		.icon { fill: ${colors.icon}; }
	`;

	let body;
	if (payload && payload.title) {
		const progressMs = payload.progressMs || 0;
		const progressPercent = payload.durationMs ? Math.min(100, Math.max(0, (progressMs / payload.durationMs) * 100)) : 0;
		const currentTime = payload.isPlaying ? formatTime(progressMs) : '0:00';
		const remainingTime =
			payload.isPlaying && payload.durationMs ? `-${formatTime(payload.durationMs - progressMs)}` : `-${formatTime(payload.durationMs)}`;
		const statusText = payload.isPlaying ? 'NOW PLAYING' : 'LAST PLAYED';

		const coverMarkup = payload.imageBase64
			? `<img class="cover" src="data:image/jpeg;base64,${payload.imageBase64}" alt="Album cover" />`
			: `<svg class="icon" width="48" height="48" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="${SPOTIFY_GLYPH_PATH}"/></svg>`;

		body = `
			<div class="cover-container">${coverMarkup}</div>
			<div class="info">
				<div class="details">
					<div class="track-name">${escapeXml(payload.title)}</div>
					<div class="artist-name">${escapeXml(payload.artist)}</div>
					<div class="logo-row">
						<svg class="logo" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#1db954" d="${SPOTIFY_GLYPH_PATH}"/></svg>
						<span class="status">${statusText}</span>
					</div>
				</div>
				<div class="progress-wrap">
					<div class="progress-bg"><div class="progress-fill" style="width:${progressPercent}%"></div></div>
					<div class="times"><span>${currentTime}</span><span>${remainingTime}</span></div>
				</div>
			</div>
		`;
	} else {
		body = `
			<div class="cover-container">
				<svg class="icon" width="48" height="48" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="${SPOTIFY_GLYPH_PATH}"/></svg>
			</div>
			<div class="info">
				<div class="offline">Not currently playing on Spotify</div>
			</div>
		`;
	}

	return `<svg width="460" height="152" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-labelledby="cardTitle" role="img">
	<title id="cardTitle">Now playing on Spotify</title>
	<foreignObject width="460" height="152">
		<style>${style}</style>
		<div xmlns="http://www.w3.org/1999/xhtml" class="container">${body}</div>
	</foreignObject>
</svg>`;
}

async function handleJsonRequest(env) {
	try {
		const payload = await fetchCurrentOrRecent(env);
		if (!payload) return jsonResponse({ error: 'no_track_available' });
		return jsonResponse(payload);
	} catch (err) {
		return jsonResponse({ error: err.message }, 502);
	}
}

async function handleEmbedRequest(url, env) {
	const options = {
		mode: url.searchParams.get('mode'),
		borderRadius: url.searchParams.get('border_radius'),
	};

	let payload = null;
	try {
		payload = await fetchCurrentOrRecent(env);
	} catch (err) {
		payload = null;
	}

	let imageBase64 = null;
	if (payload && payload.albumImageUrl) {
		imageBase64 = await fetchImageAsBase64(payload.albumImageUrl);
	}

	const svg = renderSpotifyEmbedSvg(payload ? { ...payload, imageBase64 } : null, options);

	return svgResponse(svg);
}

export default {
	async fetch(request, env, ctx) {
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders() });
		}

		const url = new URL(request.url);
		if (url.pathname === '/embed.svg') {
			return handleEmbedRequest(url, env);
		}

		return handleJsonRequest(env);
	},
};

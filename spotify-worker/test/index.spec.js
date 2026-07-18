import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, vi, afterEach } from 'vitest';
import worker from '../src';

const TEST_ENV = {
	SPOTIFY_CLIENT_ID: 'id',
	SPOTIFY_CLIENT_SECRET: 'secret',
	SPOTIFY_REFRESH_TOKEN: 'refresh',
};

function mockFetchSequence(responses) {
	let call = 0;
	return vi.fn(async () => responses[call++]);
}

async function run(request, env = TEST_ENV) {
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

const TOKEN_RESPONSE = () => new Response(JSON.stringify({ access_token: 'token' }), { status: 200 });

const NOW_PLAYING_RESPONSE = () =>
	new Response(
		JSON.stringify({
			is_playing: true,
			progress_ms: 30000,
			item: {
				name: 'Brick by Boring Brick',
				duration_ms: 210000,
				artists: [{ name: 'Paramore' }],
				external_urls: { spotify: 'https://open.spotify.com/track/abc' },
				album: { images: [{ url: 'https://img/large.jpg' }, { url: 'https://img/med.jpg' }] },
			},
		}),
		{ status: 200 }
	);

describe('spotify now-playing worker', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('responds to CORS preflight requests', async () => {
		const response = await run(new Request('http://example.com', { method: 'OPTIONS' }));

		expect(response.status).toBe(200);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
	});

	it('returns the currently playing track as JSON', async () => {
		vi.stubGlobal('fetch', mockFetchSequence([TOKEN_RESPONSE(), NOW_PLAYING_RESPONSE()]));

		const response = await run(new Request('http://example.com'));
		const data = await response.json();

		expect(data).toEqual({
			title: 'Brick by Boring Brick',
			artist: 'Paramore',
			trackUrl: 'https://open.spotify.com/track/abc',
			isPlaying: true,
			albumImageUrl: 'https://img/med.jpg',
			durationMs: 210000,
			progressMs: 30000,
		});
	});

	it('falls back to recently played when nothing is active', async () => {
		vi.stubGlobal(
			'fetch',
			mockFetchSequence([
				TOKEN_RESPONSE(),
				new Response(null, { status: 204 }),
				new Response(
					JSON.stringify({
						items: [
							{
								track: {
									name: 'Misery Business',
									duration_ms: 200000,
									artists: [{ name: 'Paramore' }],
									external_urls: { spotify: 'https://open.spotify.com/track/def' },
									album: { images: [{ url: 'https://img/large2.jpg' }] },
								},
							},
						],
					}),
					{ status: 200 }
				),
			])
		);

		const response = await run(new Request('http://example.com'));
		const data = await response.json();

		expect(data).toEqual({
			title: 'Misery Business',
			artist: 'Paramore',
			trackUrl: 'https://open.spotify.com/track/def',
			isPlaying: false,
			albumImageUrl: 'https://img/large2.jpg',
			durationMs: 200000,
			progressMs: null,
		});
	});

	it('returns an error payload when the token refresh fails', async () => {
		vi.stubGlobal('fetch', mockFetchSequence([new Response('invalid_grant', { status: 400 })]));

		const response = await run(new Request('http://example.com'));

		expect(response.status).toBe(502);
		const data = await response.json();
		expect(data.error).toContain('spotify token refresh failed');
	});

	describe('/embed.svg', () => {
		it('renders an SVG card with the track info and album art', async () => {
			vi.stubGlobal(
				'fetch',
				mockFetchSequence([TOKEN_RESPONSE(), NOW_PLAYING_RESPONSE(), new Response(new Uint8Array([1, 2, 3]).buffer, { status: 200 })])
			);

			const response = await run(new Request('http://example.com/embed.svg'));

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('image/svg+xml');

			const svg = await response.text();
			expect(svg).toContain('Brick by Boring Brick');
			expect(svg).toContain('Paramore');
			expect(svg).toContain('NOW PLAYING');
			expect(svg).toContain('data:image/jpeg;base64,');
		});

		it('renders the offline card when nothing is playing or available', async () => {
			vi.stubGlobal(
				'fetch',
				mockFetchSequence([
					TOKEN_RESPONSE(),
					new Response(null, { status: 204 }),
					new Response(JSON.stringify({ items: [] }), { status: 200 }),
				])
			);

			const response = await run(new Request('http://example.com/embed.svg'));
			const svg = await response.text();

			expect(svg).toContain('Not currently playing on Spotify');
		});

		it('escapes special characters in track/artist names', async () => {
			vi.stubGlobal(
				'fetch',
				mockFetchSequence([
					TOKEN_RESPONSE(),
					new Response(
						JSON.stringify({
							is_playing: true,
							progress_ms: 0,
							item: {
								name: 'Rock & Roll <encore>',
								duration_ms: 100000,
								artists: [{ name: 'AC & DC' }],
								external_urls: { spotify: 'https://open.spotify.com/track/xyz' },
								album: { images: [] },
							},
						}),
						{ status: 200 }
					),
				])
			);

			const response = await run(new Request('http://example.com/embed.svg'));
			const svg = await response.text();

			expect(svg).toContain('Rock &amp; Roll &lt;encore&gt;');
			expect(svg).toContain('AC &amp; DC');
		});
	});
});

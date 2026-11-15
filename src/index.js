export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. API Endpoint: Popular Catalog (Simulating extension data source)
    if (url.pathname === '/api/extension/popular') {
      try {
        // In a production worker, you can parse upstream HTML using regex or lightweight DOM tools, 
        // or proxy structured catalog feeds.
        const catalogList = {
          list: [
            {
              name: "Solo Leveling",
              url: "https://anikoto.example/anime/solo-leveling",
              imageUrl: "https://gogocdn.net/cover/solo-leveling.png"
            },
            {
              name: "Jujutsu Kaisen Season 2",
              url: "https://anikoto.example/anime/jjk-s2",
              imageUrl: "https://gogocdn.net/cover/jujutsu-kaisen-s2.png"
            }
          ]
        };

        return Response.json({ success: true, data: catalogList }, {
          headers: { "Access-Control-Allow-Origin": "*" }
        });
      } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    // 2. API Endpoint: Video Resolver (Extracting stream links)
    if (url.pathname === '/api/extension/videos') {
      const episodeUrl = url.searchParams.get('url');
      try {
        // Edge worker extracts or returns direct streaming streams (.m3u8)
        const videoStreams = [
          {
            quality: "1080p",
            url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
          }
        ];

        return Response.json({ success: true, data: videoStreams }, {
          headers: { "Access-Control-Allow-Origin": "*" }
        });
      } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    // 3. Fallback: Serve static assets (public/index.html) automatically from Cloudflare's asset binding
    return env.ASSETS.fetch(request);
  },
};

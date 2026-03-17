export interface Env {
  APP_NAME?: string;
  PUBLIC_GOOGLE_MAPS_API_KEY?: string;
  ASSETS?: Fetcher;
}

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");

  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        app: env.APP_NAME ?? "SeaThrough",
        timestamp: new Date().toISOString(),
      });
    }

    if (url.pathname === "/api/config") {
      return json({
        appName: env.APP_NAME ?? "SeaThrough",
        publicGoogleMapsApiKey: env.PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
      });
    }

    if (url.pathname === "/api/forecast") {
      return json(
        {
          ok: false,
          message: "Forecast engine not ported yet.",
        },
        { status: 501 },
      );
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
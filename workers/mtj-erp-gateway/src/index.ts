export interface Env {
  UPSTREAM_TUNNEL_URL: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const upstreamBase = env.UPSTREAM_TUNNEL_URL || "https://ppm-annotation-herself-prayer.trycloudflare.com";
    const upstreamUrl = new URL(upstreamBase);

    url.hostname = upstreamUrl.hostname;
    url.protocol = upstreamUrl.protocol;
    url.port = upstreamUrl.port;

    const modifiedRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: "follow",
    });

    try {
      const response = await fetch(modifiedRequest);
      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (err: any) {
      return new Response(`MTJ ERP Gateway Error: ${err.message}`, { status: 502 });
    }
  },
};

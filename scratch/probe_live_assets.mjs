import fetch from "node-fetch";

async function run() {
  const res = await fetch("https://erp.arivahly.in/");
  const text = await res.text();
  const match = text.match(/src="([^"]+assets\/[^"]+\.js)"/);
  if (match) {
    const assetUrl = new URL(match[1], "https://erp.arivahly.in/").href;
    const t0 = performance.now();
    const assetRes = await fetch(assetUrl);
    const t1 = performance.now();
    console.log("Live JS Asset probe:", {
      url: assetUrl,
      status: assetRes.status,
      durationMs: Math.round(t1 - t0),
      contentType: assetRes.headers.get("content-type"),
      contentLength: assetRes.headers.get("content-length"),
      cacheControl: assetRes.headers.get("cache-control"),
    });
  } else {
    console.log("No asset link found in HTML");
  }
}

run();

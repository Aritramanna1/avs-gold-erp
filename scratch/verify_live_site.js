async function verify() {
  const resp = await fetch('https://erp.arivahly.in');
  console.log('Landing page HTTP status:', resp.status, resp.statusText);
  const html = await resp.text();
  const match = html.match(/src="(\/assets\/[^"]+)"/);
  if (match) {
    const assetUrl = 'https://erp.arivahly.in' + match[1];
    console.log('Asset URL found:', assetUrl);
    const assetResp = await fetch(assetUrl);
    console.log('Asset HTTP status:', assetResp.status, assetResp.statusText, 'Size:', assetResp.headers.get('content-length'), 'bytes');
  } else {
    console.log('HTML preview:', html.slice(0, 300));
  }
}
verify().catch(console.error);

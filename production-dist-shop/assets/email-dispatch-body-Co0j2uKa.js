import{t as e}from"./data-provider-CkH2PLtZ.js";import{d as t}from"./settings-store-CA-ODQEu.js";import{t as n}from"./tenant-email-store-CIoEIUI_.js";var r=`/assets/ornexa-logo-full.png`,i={productName:`AVS ERP`,productLine:`AVS ERP by Arivahly Venture Sphere`,supportEmail:`sales@arivahly.in`,primaryColor:`#0F172A`,goldAccent:`#C8A24B`,ink:`#1E293B`,muted:`#64748B`};function a(e){return(e||`https://maatarajewellers.shop`).trim().replace(/\/$/,``)||`https://maatarajewellers.shop`}function o(e){let t=(e?.logoUrl??``).trim();return t.startsWith(`https://`)||t.startsWith(`http://`)?t:t.startsWith(`/`)?`${a(e?.appOrigin)}${t}`:t||`${a(e?.appOrigin)}${r}`}function s(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}function c(){let e=t.getState(),n=e.firm,r=e.branding??{},a=e.developer??{},s=n.shopName||r.printHeader||r.companyName||r.applicationName||`Your Jewellery Firm`,c=typeof a.avsName==`string`&&a.avsName||r.applicationName||i.productLine;return{firmName:s,logoUrl:o({logoUrl:n.logoUrl||r.logoUrl||``}),phone:n.phone||r.supportPhone||``,email:n.email||r.supportEmail||``,address:n.address||``,tagline:n.tagline||r.tagline||``,website:n.website||r.website||``,primaryColor:r.primaryColor||i.primaryColor,goldAccent:r.goldAccent||i.goldAccent,productFooter:`Powered by ${c}`}}function l(e){let t=c(),n=e.firmName||t.firmName,r=o({logoUrl:e.logoUrl||t.logoUrl}),i=e.phone??t.phone,a=e.email??t.email,l=e.address??t.address,u=e.tagline??t.tagline,d=e.website??t.website,f=t.primaryColor,p=t.goldAccent,m=s(e.title),h=[i&&`Phone: ${s(i)}`,a&&`Email: ${s(a)}`].filter(Boolean).join(` · `);return`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${m}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;color:#1E293B;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:600px;margin:24px auto;background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
    <div style="background:${s(f)};padding:28px 24px;text-align:center;border-bottom:4px solid ${s(p)};">
      <img src="${s(r)}" alt="${s(n)}" width="180" style="display:block;margin:0 auto 10px;max-height:64px;max-width:180px;object-fit:contain;border:0;" />
      <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.02em;">${s(n)}</div>
      ${u?`<div style="color:#94A3B8;font-size:12px;margin-top:4px;letter-spacing:0.08em;text-transform:uppercase;">${s(u)}</div>`:``}
    </div>
    <div style="padding:28px 24px;">
      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="margin:0 0 8px;font-size:18px;color:${s(f)};">${m}</h2>
        <div style="height:3px;width:40px;margin:0 auto;background:${s(p)};border-radius:2px;"></div>
      </div>
      ${e.innerHtml}
    </div>
    <div style="background:#F1F5F9;padding:20px 24px;text-align:center;border-top:1px solid #E2E8F0;font-size:11px;color:#64748B;line-height:1.6;">
      <div style="font-weight:600;color:#334155;">${s(n)}</div>
      ${l?`<div>${s(l)}</div>`:``}
      ${h?`<div>${h}</div>`:``}
      ${d?`<div><a href="${s(d)}" style="color:#64748B;">${s(d)}</a></div>`:``}
      <div style="margin-top:12px;font-style:italic;">${s(t.productFooter)}</div>
      <div style="margin-top:10px;font-size:10px;color:#64748B;line-height:1.5;">
        This message was sent by ${s(n)} using AVS ERP / AVS. Arivahly Venture Sphere (AVS)
        is not responsible for activities or content sent by the firm.
      </div>
      ${e.purpose===`promotional`&&e.unsubscribeUrl?`<div style="margin-top:10px;"><a href="${s(e.unsubscribeUrl)}" style="color:#64748B;text-decoration:underline;">Unsubscribe from promotional emails</a></div>`:``}
    </div>
  </div>
</body>
</html>`}async function u(t){let r;try{let{data:t}=await e.rpc(`my_firm_id`);t&&(r=String(t))}catch{}let i=t.metadata??{},a=t.forcePlatform===!0||i.forcePlatform===!0;!a&&r?a=!(await n({firmId:r})).some(e=>e.isActive&&!!e.fromEmail.trim()):!a&&!r&&(a=!0);let o=typeof i.inviteActionUrl==`string`?i.inviteActionUrl:typeof i.action_url==`string`?i.action_url:void 0;return{to:t.to,subject:t.subject,htmlBody:t.htmlBody,textBody:t.textBody,branchId:t.branchId,firmId:r,preferPlatformEmail:a,inviteActionUrl:o,verifyOnly:t.verifyOnly,metadata:t.metadata,attachments:t.attachments}}export{o as a,i,c as n,l as r,u as t};
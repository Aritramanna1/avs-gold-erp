import{n as e}from"./rolldown-runtime-aKtaBQYM.js";import{f as t}from"./settings-store-BchJ0sn1.js";import"./dist-DsyeVslx.js";var n=`/assets/ornexa-logo-full.png`,r={productName:`AVS ERP`,productLine:`AVS ERP by Arivahly Venture Sphere`,supportEmail:`sales@arivahly.in`,primaryColor:`#0F172A`,goldAccent:`#C8A24B`,ink:`#1E293B`,muted:`#64748B`};function i(e){return(e||`https://erp.arivahly.in`).trim().replace(/\/$/,``)||`https://erp.arivahly.in`}function a(e){let t=(e?.logoUrl??``).trim();return t.startsWith(`https://`)||t.startsWith(`http://`)?t:t.startsWith(`/`)?`${i(e?.appOrigin)}${t}`:t||`${i(e?.appOrigin)}${n}`}function o(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}function s(){let e=t.getState(),n=e.firm,i=e.branding??{},o=e.developer??{},s=n.shopName||i.printHeader||i.companyName||i.applicationName||`Your Jewellery Firm`,c=typeof o.avsName==`string`&&o.avsName||i.applicationName||r.productLine;return{firmName:s,logoUrl:a({logoUrl:n.logoUrl||i.logoUrl||``}),phone:n.phone||i.supportPhone||``,email:n.email||i.supportEmail||``,address:n.address||``,tagline:n.tagline||i.tagline||``,website:n.website||i.website||``,primaryColor:i.primaryColor||r.primaryColor,goldAccent:i.goldAccent||r.goldAccent,productFooter:`Powered by ${c}`}}function c(e){let t=s(),n=e.firmName||t.firmName,r=a({logoUrl:e.logoUrl||t.logoUrl}),i=e.phone??t.phone,c=e.email??t.email,l=e.address??t.address,u=e.tagline??t.tagline,d=e.website??t.website,f=t.primaryColor,p=t.goldAccent,m=o(e.title),h=[i&&`Phone: ${o(i)}`,c&&`Email: ${o(c)}`].filter(Boolean).join(` · `);return`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${m}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;color:#1E293B;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:600px;margin:24px auto;background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
    <div style="background:${o(f)};padding:28px 24px;text-align:center;border-bottom:4px solid ${o(p)};">
      <img src="${o(r)}" alt="${o(n)}" width="180" style="display:block;margin:0 auto 10px;max-height:64px;max-width:180px;object-fit:contain;border:0;" />
      <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.02em;">${o(n)}</div>
      ${u?`<div style="color:#94A3B8;font-size:12px;margin-top:4px;letter-spacing:0.08em;text-transform:uppercase;">${o(u)}</div>`:``}
    </div>
    <div style="padding:28px 24px;">
      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="margin:0 0 8px;font-size:18px;color:${o(f)};">${m}</h2>
        <div style="height:3px;width:40px;margin:0 auto;background:${o(p)};border-radius:2px;"></div>
      </div>
      ${e.innerHtml}
    </div>
    <div style="background:#F1F5F9;padding:20px 24px;text-align:center;border-top:1px solid #E2E8F0;font-size:11px;color:#64748B;line-height:1.6;">
      <div style="font-weight:600;color:#334155;">${o(n)}</div>
      ${l?`<div>${o(l)}</div>`:``}
      ${h?`<div>${h}</div>`:``}
      ${d?`<div><a href="${o(d)}" style="color:#64748B;">${o(d)}</a></div>`:``}
      <div style="margin-top:12px;font-style:italic;">${o(t.productFooter)}</div>
      <div style="margin-top:10px;font-size:10px;color:#64748B;line-height:1.5;">
        This message was sent by ${o(n)} using AVS ERP / AVS. Arivahly Venture Sphere (AVS)
        is not responsible for activities or content sent by the firm.
      </div>
      ${e.purpose===`promotional`&&e.unsubscribeUrl?`<div style="margin-top:10px;"><a href="${o(e.unsubscribeUrl)}" style="color:#64748B;text-decoration:underline;">Unsubscribe from promotional emails</a></div>`:``}
    </div>
  </div>
</body>
</html>`}var l=e({sendGenericEmail:()=>d});async function u(e){let t=await fetch(`/api/email/send.php`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({to:e.to,subject:e.subject,htmlBody:e.htmlBody,textBody:e.textBody,attachments:e.attachments,metadata:e.metadata})});if(!t.ok){let e=await t.text().catch(()=>``),n=`Hostinger mail engine error (HTTP ${t.status})`;try{let t=JSON.parse(e);t.error&&(n=t.error)}catch{e&&(n=e)}throw Error(n)}let n=await t.json().catch(()=>({success:!0}));if(n&&n.success===!1)throw Error(n.error||`Hostinger email dispatch failed.`)}async function d(e){let n=t.getState();n.smtp;try{return await u(e),n.addSecurityLog(`permission changed`,`Email sent to ${e.to}. Subject: "${e.subject}".`,e.to),{success:!0}}catch(t){let r=t?.message||String(t);return n.addSecurityLog(`failed login`,`Email dispatch failed to ${e.to}. Error: ${r}`,e.to),{success:!1,error:r}}}export{r as a,c as i,d as n,s as r,l as t};
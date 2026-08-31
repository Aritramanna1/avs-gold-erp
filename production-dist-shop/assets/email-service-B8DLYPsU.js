import{n as e}from"./rolldown-runtime-aKtaBQYM.js";import{t}from"./data-provider-BiPx7OEV.js";import{f as n}from"./settings-store-BXUarrxy.js";import"./dist-DsyeVslx.js";import{t as r}from"./edge-function-error-ClCFvwO6.js";import{t as i}from"./tenant-email-store-C8qlIebA.js";var a=`/assets/ornexa-logo-full.png`,o={productName:`AVS ERP`,productLine:`AVS ERP by Arivahly Venture Sphere`,supportEmail:`sales@arivahly.in`,primaryColor:`#0F172A`,goldAccent:`#C8A24B`,ink:`#1E293B`,muted:`#64748B`};function s(e){return(e||`https://maatarajewellers.shop`).trim().replace(/\/$/,``)||`https://maatarajewellers.shop`}function c(e){let t=(e?.logoUrl??``).trim();return t.startsWith(`https://`)||t.startsWith(`http://`)?t:t.startsWith(`/`)?`${s(e?.appOrigin)}${t}`:t||`${s(e?.appOrigin)}${a}`}function l(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}function u(){let e=n.getState(),t=e.firm,r=e.branding??{},i=e.developer??{},a=t.shopName||r.printHeader||r.companyName||r.applicationName||`Your Jewellery Firm`,s=typeof i.avsName==`string`&&i.avsName||r.applicationName||o.productLine;return{firmName:a,logoUrl:c({logoUrl:t.logoUrl||r.logoUrl||``}),phone:t.phone||r.supportPhone||``,email:t.email||r.supportEmail||``,address:t.address||``,tagline:t.tagline||r.tagline||``,website:t.website||r.website||``,primaryColor:r.primaryColor||o.primaryColor,goldAccent:r.goldAccent||o.goldAccent,productFooter:`Powered by ${s}`}}function d(e){let t=u(),n=e.firmName||t.firmName,r=c({logoUrl:e.logoUrl||t.logoUrl}),i=e.phone??t.phone,a=e.email??t.email,o=e.address??t.address,s=e.tagline??t.tagline,d=e.website??t.website,f=t.primaryColor,p=t.goldAccent,m=l(e.title),h=[i&&`Phone: ${l(i)}`,a&&`Email: ${l(a)}`].filter(Boolean).join(` · `);return`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${m}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;color:#1E293B;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:600px;margin:24px auto;background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
    <div style="background:${l(f)};padding:28px 24px;text-align:center;border-bottom:4px solid ${l(p)};">
      <img src="${l(r)}" alt="${l(n)}" width="180" style="display:block;margin:0 auto 10px;max-height:64px;max-width:180px;object-fit:contain;border:0;" />
      <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.02em;">${l(n)}</div>
      ${s?`<div style="color:#94A3B8;font-size:12px;margin-top:4px;letter-spacing:0.08em;text-transform:uppercase;">${l(s)}</div>`:``}
    </div>
    <div style="padding:28px 24px;">
      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="margin:0 0 8px;font-size:18px;color:${l(f)};">${m}</h2>
        <div style="height:3px;width:40px;margin:0 auto;background:${l(p)};border-radius:2px;"></div>
      </div>
      ${e.innerHtml}
    </div>
    <div style="background:#F1F5F9;padding:20px 24px;text-align:center;border-top:1px solid #E2E8F0;font-size:11px;color:#64748B;line-height:1.6;">
      <div style="font-weight:600;color:#334155;">${l(n)}</div>
      ${o?`<div>${l(o)}</div>`:``}
      ${h?`<div>${h}</div>`:``}
      ${d?`<div><a href="${l(d)}" style="color:#64748B;">${l(d)}</a></div>`:``}
      <div style="margin-top:12px;font-style:italic;">${l(t.productFooter)}</div>
      <div style="margin-top:10px;font-size:10px;color:#64748B;line-height:1.5;">
        This message was sent by ${l(n)} using AVS ERP / AVS. Arivahly Venture Sphere (AVS)
        is not responsible for activities or content sent by the firm.
      </div>
      ${e.purpose===`promotional`&&e.unsubscribeUrl?`<div style="margin-top:10px;"><a href="${l(e.unsubscribeUrl)}" style="color:#64748B;text-decoration:underline;">Unsubscribe from promotional emails</a></div>`:``}
    </div>
  </div>
</body>
</html>`}async function f(e){let n;try{let{data:e}=await t.rpc(`my_firm_id`);e&&(n=String(e))}catch{}let r=e.metadata??{},a=e.forcePlatform===!0||r.forcePlatform===!0;!a&&n?a=!(await i({firmId:n})).some(e=>e.isActive&&!!e.fromEmail.trim()):!a&&!n&&(a=!0);let o=typeof r.inviteActionUrl==`string`?r.inviteActionUrl:typeof r.action_url==`string`?r.action_url:void 0;return{to:e.to,subject:e.subject,htmlBody:e.htmlBody,textBody:e.textBody,branchId:e.branchId,firmId:n,preferPlatformEmail:a,inviteActionUrl:o,verifyOnly:e.verifyOnly,metadata:e.metadata,attachments:e.attachments}}var p=e({sendGenericEmail:()=>h});async function m(e){let n=await f({to:e.to,subject:e.subject,htmlBody:e.htmlBody,textBody:e.textBody,metadata:e.metadata,attachments:e.attachments?.map(e=>({filename:e.filename,content:e.contentBase64,contentType:e.contentType}))}),{data:i,error:a}=await t.functions.invoke(`send-email`,{body:n});if(a)throw Error(await r(a,`SMTP relay error.`));if(i?.error)throw Error(i.error)}async function h(e){let t=n.getState();t.smtp;try{return await m(e),t.addSecurityLog(`permission changed`,`Email sent to ${e.to}. Subject: "${e.subject}".`,e.to),{success:!0}}catch(n){let r=n?.message||String(n);return t.addSecurityLog(`failed login`,`Email dispatch failed to ${e.to}. Error: ${r}`,e.to),{success:!1,error:r}}}export{o as a,d as i,h as n,u as r,p as t};
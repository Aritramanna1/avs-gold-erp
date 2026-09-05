import{i as e}from"./rolldown-runtime-aKtaBQYM.js";import{m as t}from"./vendor-charts-Bv77YuA6.js";import{i as n}from"./vendor-react-BbySHAOQ.js";import{f as r}from"./settings-store-BchJ0sn1.js";import{t as i}from"./Logo-C6RhHAef.js";import{t as a}from"./print-qr-Cdlusmpv.js";import{t as o}from"./print-setup-store-Cm9YeMS4.js";import{t as s}from"./AvsPrintFooter-2ewFssjq.js";var c=e(t(),1),l=n(),u={a4:`A4 (210 × 297mm)`,a5:`A5 (148 × 210mm)`,a5l:`Half A4 / A5 Landscape (210 × 148mm)`,a6:`A6 (105 × 148mm)`,thermal:`Thermal 80mm`,thermal58:`Thermal 58mm`,tag:`Tag / Label (50 × 30mm)`},d={a4:`A4 portrait`,a5:`A5 portrait`,a5l:`A5 landscape`,a6:`A6 portrait`,thermal:`80mm auto`,thermal58:`58mm auto`,tag:`50mm 30mm`},f=[`a4`,`a5`,`a5l`,`a6`];function p(e){return e===`a5l`?`landscape`:`portrait`}function m(e,t){let n=d[e];return!t||!f.includes(e)?n:`${n.split(` `)[0]} ${t}`}var h=96/25.4,g={a4:{width:210,height:297},a5:{width:148,height:210},a5l:{width:210,height:148},a6:{width:105,height:148}};function _(e,t){let n=g[e];if(!n)return;let r=t===`landscape`,i=Math.max(n.width,n.height),a=Math.min(n.width,n.height);return r?{width:i,height:a}:{width:a,height:i}}var v={a4:{top:12,right:15,bottom:15,left:15},a5:{top:10,right:12,bottom:12,left:12},a5l:{top:8,right:10,bottom:12,left:10},a6:{top:8,right:10,bottom:10,left:10},thermal:{top:2,right:2,bottom:2,left:2},thermal58:{top:1,right:1,bottom:1,left:1},tag:{top:1,right:1,bottom:1,left:1}};function y(e){return`${e.top}mm ${e.right}mm ${e.bottom}mm ${e.left}mm`}var b=.75;function x({children:e,title:t,docNumber:n,docType:u,recordId:d,createdAt:g,size:x=`a4`,showQR:S=!1,qrLabel:C=`Verify`,qrPosition:w=`header`,footerLine:ee,autoFit:te=!0,branchId:ne,verificationPublicToken:T,partyLabel:E,totalPaise:D}){let{firm:O,branding:k,branches:A,selectedBranchId:j}=r(),M=o(e=>e.sizeOverride),N=o(e=>e.orientation),P=o(e=>e.margins),F=o(e=>e.scalePct),I=o(e=>e.fitToPage),L=M??x,R=f.includes(L)?N??p(L):p(L),z=P??v[L],B=_(L,R),V=F/100,H=ne||j||`MAIN`,U=A.find(e=>e.id===H),W=U?.address||O.address,G=U?.phone||O.phone,K=U?.gstin||O.gstin,q=(0,c.useRef)(null),[J,re]=(0,c.useState)(1),Y=B?(B.height-z.top-z.bottom)*h:void 0,X=B?(B.width-z.left-z.right)*h:void 0,Z=te&&I&&Y!==void 0&&X!==void 0;(0,c.useLayoutEffect)(()=>{if(!Z||!Y||!X||!q.current)return;let e=()=>{let e=q.current;if(!e)return;e.style.zoom=``;let t=e.scrollHeight,n=Math.max(e.scrollWidth,e.clientWidth),r=t>Y?Y/t:1,i=n>X?X/n:1,a=Math.min(r,i);re(a<1?Math.max(i<r?.4:b,a):1)};e();let t=new ResizeObserver(e);return t.observe(q.current),()=>t.disconnect()},[Z,Y,X,e]);let ie={a4:`w-[210mm] p-8 mx-auto bg-white text-black border border-stone-200 shadow-md print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0`,a5:`w-[148mm] p-6 mx-auto bg-white text-black border border-stone-200 shadow-sm print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0`,a5l:`w-[210mm] p-5 mx-auto bg-white text-black border border-stone-200 shadow-sm print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0`,a6:`w-[105mm] p-4 mx-auto bg-white text-black border border-stone-200 shadow-sm print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0`,thermal:`w-[80mm] p-4 mx-auto bg-white text-black border border-stone-200 print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0`,thermal58:`w-[58mm] p-2 mx-auto bg-white text-black border border-stone-200 print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0`,tag:`w-[50mm] p-2 mx-auto bg-white text-black border border-stone-100 print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0`},Q=L===`thermal`||L===`thermal58`||L===`tag`,$=`print-root-${(0,c.useId)().replace(/:/g,``)}`;return(0,l.jsxs)(`div`,{id:$,className:ie[L],"data-testid":`print-layout-root`,"data-print-size":L,"data-print-orientation":R,style:{...V===1?{}:{zoom:V},...B?{width:`${B.width}mm`,minHeight:`${B.height}mm`}:{}},children:[(0,l.jsx)(`style`,{children:`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          }
          .no-print, [data-testid="print-toolbar"] {
            display: none !important;
          }
          /* App chrome only — never the document's own semantic header/footer,
             which is what these selectors would hit inside the print window. */
          header:not(#${$} *),
          footer:not(#${$} *),
          nav:not(#${$} *),
          aside:not(#${$} *) {
            display: none !important;
          }
          /* The on-screen sheet is sized in mm so the preview is physically
             true; on paper the page box already IS that sheet, so the root
             fills it instead of overflowing it by its own margins. */
          #${$} {
            width: 100% !important;
            min-height: 0 !important;
          }
          /* The real page: the size and margins the user actually chose.
             printToPDF runs with preferCSSPageSize, and printDocument()
             carries this very rule into the print window — so this is what
             the printer is told, not a decorative default. */
          @page {
            size: ${m(L,R)};
            margin: ${y(z)};
          }
          /* High-Contrast Table Border Enforcement */
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td {
            border: 1px solid #78716c !important; /* stone-500 deep gray border */
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          thead {
            display: table-header-group !important;
            background-color: #f5f5f4 !important; /* stone-100 */
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          /* Text clipping and spacing fixes */
          h1, h2, h3, h4, p, span, div, td {
            word-break: break-word !important;
            overflow-wrap: break-word !important;
          }
        }
      `}),Q?(0,l.jsxs)(`div`,{className:`text-center border-b border-dashed border-stone-400 pb-2 mb-3`,children:[(0,l.jsx)(`h2`,{className:`font-serif text-sm font-bold tracking-tight text-stone-900`,children:O.shopName||k.printHeader||k.companyName||k.applicationName}),(0,l.jsxs)(`div`,{className:`text-[9px] font-mono text-stone-600 leading-tight`,children:[t,` · `,(0,l.jsx)(`span`,{className:`font-semibold`,children:n})]}),g&&(0,l.jsx)(`div`,{className:`text-[8px] text-stone-500 font-mono`,children:new Date(g).toLocaleString(`en-IN`,{dateStyle:`short`,timeStyle:`short`})})]}):(0,l.jsxs)(`div`,{className:`flex justify-between items-start border-b-2 border-stone-300 pb-4 mb-6`,children:[(0,l.jsxs)(`div`,{className:`space-y-1`,children:[(0,l.jsxs)(`div`,{className:`flex items-center gap-3 mb-1`,children:[(0,l.jsx)(i,{variant:`png`,className:`h-12 w-12 object-contain flex-shrink-0`}),(0,l.jsx)(`h1`,{className:`font-serif text-2xl font-bold tracking-tight text-stone-900 leading-none`,children:k.printHeader||O.shopName||k.applicationName})]}),(O.tagline||k.tagline)&&(0,l.jsx)(`p`,{className:`text-[10px] italic font-medium text-stone-600 uppercase tracking-wider`,children:O.tagline||k.tagline}),(0,l.jsx)(`p`,{className:`text-xs text-stone-600 font-mono mt-1 max-w-sm leading-relaxed`,children:W}),U&&U.id!==`MAIN`&&(0,l.jsxs)(`p`,{className:`text-[10px] font-semibold text-stone-700`,children:[`(`,U.name,`)`]}),G&&(0,l.jsxs)(`p`,{className:`text-xs text-stone-500 font-mono`,children:[`Phone: `,(0,l.jsx)(`span`,{className:`font-semibold`,children:G}),O.email&&(0,l.jsxs)(`span`,{children:[` · `,O.email]})]}),O.website&&(0,l.jsxs)(`p`,{className:`text-xs text-stone-500 font-mono`,children:[`Web: `,(0,l.jsx)(`span`,{className:`font-semibold`,children:O.website})]})]}),(0,l.jsxs)(`div`,{className:`text-right flex flex-col items-end gap-2`,children:[(0,l.jsx)(`div`,{className:`inline-block bg-stone-100 border border-stone-300 px-3 py-1.5 rounded`,children:(0,l.jsx)(`span`,{className:`font-serif text-sm font-bold uppercase tracking-wider text-black`,children:t})}),(0,l.jsxs)(`div`,{className:`font-mono text-xs text-stone-800 space-y-0.5`,children:[(0,l.jsxs)(`div`,{children:[`Doc No: `,(0,l.jsx)(`strong`,{className:`font-semibold`,children:n})]}),g&&(0,l.jsxs)(`div`,{children:[`Date: `,new Date(g).toLocaleString(`en-IN`,{dateStyle:`medium`})]}),K&&(0,l.jsxs)(`div`,{className:`text-[10px] font-semibold text-stone-600`,children:[`GST: `,K]})]}),S&&w===`header`&&u&&d&&(0,l.jsx)(`div`,{className:`mt-1`,children:(0,l.jsx)(a,{docType:u,docNumber:n,recordId:d,createdAt:g,size:64,label:C,verificationPublicToken:T,partyLabel:E,totalPaise:D})})]})]}),(0,l.jsx)(`div`,{ref:q,className:`flex-1 min-h-[1.5in]`,style:Z&&J<1?{zoom:J}:void 0,children:e}),Q?(0,l.jsxs)(`div`,{className:`mt-4 pt-1.5 border-t border-dashed border-stone-400 text-center text-[8px] font-mono text-stone-600 space-y-1`,children:[(0,l.jsx)(`div`,{children:`Thank you for your valued custom.`}),(0,l.jsx)(`div`,{className:`text-[7px] text-stone-500 uppercase`,children:`Verified Transaction Copy`}),S&&u&&d&&(0,l.jsx)(`div`,{className:`pt-2 flex justify-center`,children:(0,l.jsx)(a,{docType:u,docNumber:n,recordId:d,createdAt:g,size:56,label:C})}),(0,l.jsx)(s,{className:`mt-2 text-[7px]`})]}):(0,l.jsxs)(`div`,{className:`mt-12`,children:[(0,l.jsxs)(`div`,{className:`border-t border-dashed border-stone-300 pt-4 text-center`,children:[(0,l.jsx)(`p`,{className:`text-[10px] text-stone-600 font-serif italic`,children:ee||O.footerLine||`Official transaction record. Handcrafted quality and guaranteed purity.`}),(0,l.jsx)(`div`,{className:`text-[8px] font-mono text-stone-400 mt-1 tracking-wider uppercase`,children:`SYSTEM VERIFIED ORIGINAL COPY · HIGH-CONTRAST INKJET/LASER OPTIMIZED`})]}),(0,l.jsxs)(`div`,{className:`flex items-center justify-between mt-4`,children:[S&&w===`footer`&&u&&d&&(0,l.jsx)(`div`,{className:`shrink-0`,children:(0,l.jsx)(a,{docType:u,docNumber:n,recordId:d,createdAt:g,size:64,label:C,verificationPublicToken:T,partyLabel:E,totalPaise:D})}),(0,l.jsx)(`div`,{className:`flex-1 min-w-0`,children:(0,l.jsx)(s,{className:`mt-0`})})]})]})]})}export{p as a,_ as c,x as i,v as n,y as o,u as r,m as s,f as t};
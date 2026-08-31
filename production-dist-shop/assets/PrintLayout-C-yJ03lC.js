import{i as e}from"./rolldown-runtime-aKtaBQYM.js";import{m as t}from"./vendor-charts-Bv77YuA6.js";import{i as n}from"./vendor-react-BbySHAOQ.js";import{d as r}from"./settings-store-CA-ODQEu.js";import{Qi as i,qi as a}from"./index-CVsE73i6.js";import{t as o}from"./print-qr-nZH3aZYJ.js";import{t as s}from"./print-setup-store-Cm9YeMS4.js";import{t as c}from"./AvsPrintFooter-C0GXmkKR.js";var l=e(t(),1),u=n(),d={a4:`A4 (210 × 297mm)`,a5:`A5 (148 × 210mm)`,a5l:`Half A4 / A5 Landscape (210 × 148mm)`,a6:`A6 (105 × 148mm)`,thermal:`Thermal 80mm`,thermal58:`Thermal 58mm`,tag:`Tag / Label (50 × 30mm)`},f={a4:`A4 portrait`,a5:`A5 portrait`,a5l:`A5 landscape`,a6:`A6 portrait`,thermal:`80mm auto`,thermal58:`58mm auto`,tag:`50mm 30mm`},p=[`a4`,`a5`,`a5l`,`a6`];function m(e){return e===`a5l`?`landscape`:`portrait`}function h(e,t){let n=f[e];return!t||!p.includes(e)?n:`${n.split(` `)[0]} ${t}`}var g=96/25.4,_={a4:{width:210,height:297},a5:{width:148,height:210},a5l:{width:210,height:148},a6:{width:105,height:148}};function v(e,t){let n=_[e];if(!n)return;let r=t===`landscape`,i=Math.max(n.width,n.height),a=Math.min(n.width,n.height);return r?{width:i,height:a}:{width:a,height:i}}var y={a4:{top:12,right:15,bottom:15,left:15},a5:{top:10,right:12,bottom:12,left:12},a5l:{top:8,right:10,bottom:12,left:10},a6:{top:8,right:10,bottom:10,left:10},thermal:{top:2,right:2,bottom:2,left:2},thermal58:{top:1,right:1,bottom:1,left:1},tag:{top:1,right:1,bottom:1,left:1}};function b(e){return`${e.top}mm ${e.right}mm ${e.bottom}mm ${e.left}mm`}var x=.75;function S({children:e,title:t,docNumber:n,docType:d,recordId:f,createdAt:_,size:S=`a4`,showQR:C=!1,qrLabel:w=`Verify`,qrPosition:T=`header`,footerLine:E,autoFit:D=!0,branchId:O}){let{firm:k,branding:A,branches:ee,selectedBranchId:j}=r(),M=a(t,!0),N=s(e=>e.sizeOverride),P=s(e=>e.orientation),F=s(e=>e.margins),I=s(e=>e.scalePct),L=s(e=>e.fitToPage),R=N??S,z=p.includes(R)?P??m(R):m(R),B=F??y[R],V=v(R,z),H=I/100,U=O||j||`MAIN`,W=ee.find(e=>e.id===U),te=W?.address||k.address,G=W?.phone||k.phone,K=W?.gstin||k.gstin,q=(0,l.useRef)(null),[J,ne]=(0,l.useState)(1),Y=V?(V.height-B.top-B.bottom)*g:void 0,X=V?(V.width-B.left-B.right)*g:void 0,Z=D&&L&&Y!==void 0&&X!==void 0;(0,l.useLayoutEffect)(()=>{if(!Z||!Y||!X||!q.current)return;let e=!1,t=0,n=()=>{let t=q.current;if(!t||e)return;let n=t.style.zoom;t.style.zoom=`1`;let r=t.scrollHeight,i=Math.max(t.scrollWidth,t.clientWidth);t.style.zoom=n;let a=r>Y?Y/r:1,o=i>X?X/i:1,s=Math.min(a,o),c=s<1?Math.max(x,s):1;ne(e=>Math.abs(e-c)<.002?e:c)};n();let r=new ResizeObserver(()=>{cancelAnimationFrame(t),t=requestAnimationFrame(n)});return r.observe(q.current),()=>{e=!0,cancelAnimationFrame(t),r.disconnect()}},[Z,Y,X]);let re={a4:`w-[210mm] p-8 mx-auto bg-white text-black border border-stone-200 shadow-md print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0`,a5:`w-[148mm] p-6 mx-auto bg-white text-black border border-stone-200 shadow-sm print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0`,a5l:`w-[210mm] p-5 mx-auto bg-white text-black border border-stone-200 shadow-sm print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0`,a6:`w-[105mm] p-4 mx-auto bg-white text-black border border-stone-200 shadow-sm print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0`,thermal:`w-[80mm] p-4 mx-auto bg-white text-black border border-stone-200 print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0`,thermal58:`w-[58mm] p-2 mx-auto bg-white text-black border border-stone-200 print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0`,tag:`w-[50mm] p-2 mx-auto bg-white text-black border border-stone-100 print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0`},Q=R===`thermal`||R===`thermal58`||R===`tag`,$=`print-root-${(0,l.useId)().replace(/:/g,``)}`;return(0,u.jsxs)(`div`,{id:$,className:re[R],"data-testid":`print-layout-root`,"data-print-size":R,"data-print-orientation":z,style:{...H===1?{}:{zoom:H},...V?{width:`${V.width}mm`,minHeight:`${V.height}mm`}:{}},children:[(0,u.jsx)(`style`,{children:`
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
            size: ${h(R,z)};
            margin: ${b(B)};
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
      `}),Q?(0,u.jsxs)(`div`,{className:`text-center border-b border-dashed border-stone-400 pb-2 mb-3`,children:[(0,u.jsx)(`h2`,{className:`font-serif text-sm font-bold tracking-tight text-stone-900`,children:k.shopName||A.printHeader||A.companyName||A.applicationName}),(0,u.jsxs)(`div`,{className:`text-[9px] font-mono text-stone-600 leading-tight`,children:[M,` · `,(0,u.jsx)(`span`,{className:`font-semibold`,children:n})]}),_&&(0,u.jsx)(`div`,{className:`text-[8px] text-stone-500 font-mono`,children:new Date(_).toLocaleString(`en-IN`,{dateStyle:`short`,timeStyle:`short`})})]}):(0,u.jsxs)(`div`,{className:`flex justify-between items-start border-b-2 border-stone-300 pb-4 mb-6`,children:[(0,u.jsxs)(`div`,{className:`space-y-1`,children:[(0,u.jsxs)(`div`,{className:`flex items-center gap-3 mb-1`,children:[(0,u.jsx)(i,{variant:`png`,className:`h-12 w-12 object-contain flex-shrink-0`}),(0,u.jsx)(`h1`,{className:`font-serif text-2xl font-bold tracking-tight text-stone-900 leading-none`,children:A.printHeader||k.shopName||A.applicationName})]}),(k.tagline||A.tagline)&&(0,u.jsx)(`p`,{className:`text-[10px] italic font-medium text-stone-600 uppercase tracking-wider`,children:k.tagline||A.tagline}),(0,u.jsx)(`p`,{className:`text-xs text-stone-600 font-mono mt-1 max-w-sm leading-relaxed`,children:te}),W&&W.id!==`MAIN`&&(0,u.jsxs)(`p`,{className:`text-[10px] font-semibold text-stone-700`,children:[`(`,W.name,`)`]}),G&&(0,u.jsxs)(`p`,{className:`text-xs text-stone-500 font-mono`,children:[`Phone: `,(0,u.jsx)(`span`,{className:`font-semibold`,children:G}),k.email&&(0,u.jsxs)(`span`,{children:[` · `,k.email]})]}),k.website&&(0,u.jsxs)(`p`,{className:`text-xs text-stone-500 font-mono`,children:[`Web: `,(0,u.jsx)(`span`,{className:`font-semibold`,children:k.website})]})]}),(0,u.jsxs)(`div`,{className:`text-right flex flex-col items-end gap-2`,children:[(0,u.jsx)(`div`,{className:`inline-block bg-stone-100 border border-stone-300 px-3 py-1.5 rounded`,children:(0,u.jsx)(`span`,{className:`font-serif text-sm font-bold uppercase tracking-wider text-black`,children:M})}),(0,u.jsxs)(`div`,{className:`font-mono text-xs text-stone-800 space-y-0.5`,children:[(0,u.jsxs)(`div`,{children:[`Doc No: `,(0,u.jsx)(`strong`,{className:`font-semibold`,children:n})]}),_&&(0,u.jsxs)(`div`,{children:[`Date: `,new Date(_).toLocaleString(`en-IN`,{dateStyle:`medium`})]}),K&&(0,u.jsxs)(`div`,{className:`text-[10px] font-semibold text-stone-600`,children:[`GST: `,K]})]}),C&&T===`header`&&d&&f&&(0,u.jsx)(`div`,{className:`mt-1`,children:(0,u.jsx)(o,{docType:d,docNumber:n,recordId:f,createdAt:_,size:64,label:w})})]})]}),(0,u.jsx)(`div`,{ref:q,className:`flex-1 min-h-[1.5in]`,style:Z&&J<1?{zoom:J}:void 0,children:e}),Q?(0,u.jsxs)(`div`,{className:`mt-4 pt-1.5 border-t border-dashed border-stone-400 text-center text-[8px] font-mono text-stone-600 space-y-1`,children:[(0,u.jsx)(`div`,{children:`Thank you for your valued custom.`}),(0,u.jsx)(`div`,{className:`text-[7px] text-stone-500 uppercase`,children:`Verified Transaction Copy`}),C&&d&&f&&(0,u.jsx)(`div`,{className:`pt-2 flex justify-center`,children:(0,u.jsx)(o,{docType:d,docNumber:n,recordId:f,createdAt:_,size:56,label:w})}),(0,u.jsx)(c,{className:`mt-2 text-[7px]`})]}):(0,u.jsxs)(`div`,{className:`mt-12`,children:[(0,u.jsxs)(`div`,{className:`border-t border-dashed border-stone-300 pt-4 text-center`,children:[(0,u.jsx)(`p`,{className:`text-[10px] text-stone-600 font-serif italic`,children:E||k.footerLine||`Official transaction record. Handcrafted quality and guaranteed purity.`}),(0,u.jsx)(`div`,{className:`text-[8px] font-mono text-stone-400 mt-1 tracking-wider uppercase`,children:`SYSTEM VERIFIED ORIGINAL COPY · HIGH-CONTRAST INKJET/LASER OPTIMIZED`})]}),(0,u.jsxs)(`div`,{className:`flex items-center justify-between mt-4`,children:[C&&T===`footer`&&d&&f&&(0,u.jsx)(`div`,{className:`shrink-0`,children:(0,u.jsx)(o,{docType:d,docNumber:n,recordId:f,createdAt:_,size:64,label:w})}),(0,u.jsx)(`div`,{className:`flex-1 min-w-0`,children:(0,u.jsx)(c,{className:`mt-0`})})]})]})]})}export{m as a,v as c,S as i,y as n,b as o,d as r,h as s,p as t};
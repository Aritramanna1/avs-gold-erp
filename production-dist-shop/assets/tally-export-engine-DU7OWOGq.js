function e(e,n=`Ornexa Jewellery ERP`){let r=e.map(e=>{let n=e.dateStr.replace(/[^0-9]/g,``),r=e.fineGoldMg?(e.fineGoldMg/1e3).toFixed(3):`0.000`,i=(e.amountPaise/100).toFixed(2),a=``;if(e.customEntries&&e.customEntries.length>0)a=e.customEntries.map(e=>{let n=(e.amountPaise/100).toFixed(2),r=e.isDebit?`-${n}`:n;return`
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${t(e.ledgerName)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>${e.isDebit?`Yes`:`No`}</ISDEEMEDPOSITIVE>
        <AMOUNT>${r}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`}).join(``);else if(e.voucherType===`Sales`){let n=e.taxDetails?.cgstPaise||0,r=e.taxDetails?.sgstPaise||0,o=e.taxDetails?.igstPaise||0,s=e.makingChargesPaise||0,c=Math.max(0,e.amountPaise-(n+r+o+s));a=`
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${t(e.partyName)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${i}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Gold Jewellery Sales Account</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${(c/100).toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`,s>0&&(a+=`
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Making Charges Collected</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${(s/100).toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`),n>0&&(a+=`
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Output CGST (1.5%)</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${(n/100).toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`),r>0&&(a+=`
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Output SGST (1.5%)</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${(r/100).toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`),o>0&&(a+=`
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Output IGST (3%)</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${(o/100).toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`)}else if(e.voucherType===`Purchase`){let n=e.taxDetails?.cgstPaise||0,r=e.taxDetails?.sgstPaise||0,o=Math.max(0,e.amountPaise-(n+r));a=`
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${t(e.partyName)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${i}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Bullion & Gold Purchase Account</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${(o/100).toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`,n>0&&(a+=`
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Input CGST (1.5%)</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${(n/100).toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`),r>0&&(a+=`
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Input SGST (1.5%)</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${(r/100).toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`)}else a=e.voucherType===`Receipt`?`
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Main Cash / Bank Account</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${i}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${t(e.partyName)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${i}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`:e.voucherType===`Payment`?`
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${t(e.partyName)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${i}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Main Cash / Bank Account</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${i}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`:`
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${t(e.partyName)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${i}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Gold Inventory Adjustment Account</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${i}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;return`
    <VOUCHER VCHTYPE="${e.voucherType}" ACTION="Create">
      <DATE>${n}</DATE>
      <VOUCHERTYPENAME>${e.voucherType}</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${t(e.voucherNumber)}</VOUCHERNUMBER>
      <NARRATION>${t(e.narration)} (Fine Gold Equivalent: ${r}g)</NARRATION>
      ${a}
    </VOUCHER>`}).join(`
`);return`<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${t(n)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        ${r}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`}function t(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&apos;`)}export{e as t};
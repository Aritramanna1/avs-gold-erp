/**
 * Ornexa ERP — Tally-Compatible XML & Accounting Export Engine
 * Master Reference: docs/ACCOUNTING_AND_PERIOD_CONTROL.md
 * Generates valid Tally ERP 9 / Tally Prime XML import payloads with statutory tax splits and making charge ledgers.
 */

export interface TallyLedgerEntry {
  ledgerName: string;
  isDebit: boolean;
  amountPaise: number;
}

export interface TallyVoucher {
  voucherNumber: string;
  dateStr: string; // YYYY-MM-DD or YYYYMMDD
  voucherType: "Sales" | "Purchase" | "Receipt" | "Payment" | "Journal";
  partyName: string;
  amountPaise: number;
  fineGoldMg?: number;
  taxDetails?: {
    cgstPaise?: number;
    sgstPaise?: number;
    igstPaise?: number;
  };
  makingChargesPaise?: number;
  narration: string;
  customEntries?: TallyLedgerEntry[];
}

/**
 * Encodes vouchers into Tally Prime XML Import Payload with complete tax & ledger breakdown.
 */
export function generateTallyXML(
  vouchers: TallyVoucher[],
  companyName = "AVS ERP",
): string {
  const xmlVouchers = vouchers
    .map((v) => {
      const cleanDate = v.dateStr.replace(/[^0-9]/g, "");
      const fineGrams = v.fineGoldMg ? (v.fineGoldMg / 1000).toFixed(3) : "0.000";
      const totalRupees = (v.amountPaise / 100).toFixed(2);

      let ledgerEntriesXML = "";

      if (v.customEntries && v.customEntries.length > 0) {
        ledgerEntriesXML = v.customEntries
          .map((e) => {
            const amt = (e.amountPaise / 100).toFixed(2);
            const formattedAmt = e.isDebit ? `-${amt}` : amt;
            return `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${escapeXml(e.ledgerName)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>${e.isDebit ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
        <AMOUNT>${formattedAmt}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;
          })
          .join("");
      } else if (v.voucherType === "Sales") {
        // Sales Voucher: Debit Customer, Credit Gold Sales, Credit Making Charges, Credit Output Taxes
        const cgst = v.taxDetails?.cgstPaise || 0;
        const sgst = v.taxDetails?.sgstPaise || 0;
        const igst = v.taxDetails?.igstPaise || 0;
        const making = v.makingChargesPaise || 0;
        const netMetalSalesPaise = Math.max(0, v.amountPaise - (cgst + sgst + igst + making));

        ledgerEntriesXML = `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${escapeXml(v.partyName)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${totalRupees}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Gold Jewellery Sales Account</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${(netMetalSalesPaise / 100).toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;

        if (making > 0) {
          ledgerEntriesXML += `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Making Charges Collected</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${(making / 100).toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;
        }
        if (cgst > 0) {
          ledgerEntriesXML += `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Output CGST (1.5%)</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${(cgst / 100).toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;
        }
        if (sgst > 0) {
          ledgerEntriesXML += `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Output SGST (1.5%)</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${(sgst / 100).toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;
        }
        if (igst > 0) {
          ledgerEntriesXML += `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Output IGST (3%)</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${(igst / 100).toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;
        }
      } else if (v.voucherType === "Purchase") {
        // Purchase Voucher: Credit Vendor, Debit Bullion Purchase, Debit Input Taxes
        const cgst = v.taxDetails?.cgstPaise || 0;
        const sgst = v.taxDetails?.sgstPaise || 0;
        const netPurchasePaise = Math.max(0, v.amountPaise - (cgst + sgst));

        ledgerEntriesXML = `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${escapeXml(v.partyName)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${totalRupees}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Bullion & Gold Purchase Account</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${(netPurchasePaise / 100).toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;

        if (cgst > 0) {
          ledgerEntriesXML += `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Input CGST (1.5%)</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${(cgst / 100).toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;
        }
        if (sgst > 0) {
          ledgerEntriesXML += `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Input SGST (1.5%)</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${(sgst / 100).toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;
        }
      } else if (v.voucherType === "Receipt") {
        // Receipt Voucher: Debit Cash/Bank, Credit Party
        ledgerEntriesXML = `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Main Cash / Bank Account</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${totalRupees}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${escapeXml(v.partyName)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${totalRupees}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;
      } else if (v.voucherType === "Payment") {
        // Payment Voucher: Debit Party, Credit Cash/Bank
        ledgerEntriesXML = `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${escapeXml(v.partyName)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${totalRupees}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Main Cash / Bank Account</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${totalRupees}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;
      } else {
        // Journal Voucher: Standard balancing
        ledgerEntriesXML = `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${escapeXml(v.partyName)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${totalRupees}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>Gold Inventory Adjustment Account</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${totalRupees}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;
      }

      return `
    <VOUCHER VCHTYPE="${v.voucherType}" ACTION="Create">
      <DATE>${cleanDate}</DATE>
      <VOUCHERTYPENAME>${v.voucherType}</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${escapeXml(v.voucherNumber)}</VOUCHERNUMBER>
      <NARRATION>${escapeXml(v.narration)} (Fine Gold Equivalent: ${fineGrams}g)</NARRATION>
      ${ledgerEntriesXML}
    </VOUCHER>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        ${xmlVouchers}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Minimal mobile print bridge stub — web uses window.print / print engine. */
export async function printPdfBlob(_blob: Blob, _title?: string): Promise<void> {
  window.print();
}

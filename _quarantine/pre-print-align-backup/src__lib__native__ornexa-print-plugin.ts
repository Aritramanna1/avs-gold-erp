/** Ornexa native print plugin stub (web no-op). */
export async function ornexaPrintPdf(_opts: {
  filePath?: string;
  title?: string;
}): Promise<void> {
  window.print();
}

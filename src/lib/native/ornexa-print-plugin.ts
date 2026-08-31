/**
 * Capacitor bridge for OrnexaPrint (Android PrintManager).
 * Web builds do not depend on @capacitor/core — plugin is a native-only no-op stub.
 */
export interface OrnexaPrintOptions {
  jobName?: string;
  fileUri?: string;
  base64?: string;
  fileName?: string;
  mediaSize?: string;
}

export interface OrnexaPrintHtmlOptions {
  jobName?: string;
  html: string;
  mediaSize?: string;
}

export interface OrnexaHtmlToPdfOptions {
  html: string;
  jobName?: string;
  fileName?: string;
  mediaSize?: string;
}

export interface OrnexaPrintPlugin {
  printPdf(options: OrnexaPrintOptions): Promise<{ ok: boolean; jobName: string }>;
  printHtml(options: OrnexaPrintHtmlOptions): Promise<{ ok: boolean; jobName: string }>;
  htmlToPdf(
    options: OrnexaHtmlToPdfOptions,
  ): Promise<{ ok: boolean; fileUri: string; fileName: string }>;
}

const webStub: OrnexaPrintPlugin = {
  async printPdf() {
    throw new Error("OrnexaPrint is only available on native Android");
  },
  async printHtml() {
    throw new Error("OrnexaPrint is only available on native Android");
  },
  async htmlToPdf() {
    throw new Error("OrnexaPrint is only available on native Android");
  },
};

export const OrnexaPrint: OrnexaPrintPlugin = webStub;

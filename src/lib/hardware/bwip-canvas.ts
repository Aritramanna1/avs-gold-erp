/** Thin bwip-js browser wrapper for DataMatrix / GS1 DataMatrix encode. */
import bwipjs from "bwip-js/browser";

export async function renderBwipToCanvas(
  canvas: HTMLCanvasElement,
  opts: { bcid: string; text: string; scale?: number; height?: number; includetext?: boolean },
): Promise<void> {
  await bwipjs.toCanvas(canvas, {
    bcid: opts.bcid,
    text: opts.text,
    scale: opts.scale ?? 2,
    height: opts.height ?? 12,
    includetext: opts.includetext ?? false,
  });
}

declare module "bwip-js/browser" {
  const bwipjs: {
    toCanvas(canvas: HTMLCanvasElement, opts: Record<string, unknown>): void;
  };
  export default bwipjs;
}

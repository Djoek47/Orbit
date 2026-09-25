/**
 * Moji shape vocabulary. Every Moji is a list of filled shapes on a 24×24 grid,
 * painted in order (first = back). No strokes — that is what keeps Moji visually
 * distinct from the approved task Icon set (duotone outlines, stroke 1.75).
 */
type Common = {
  /** Fill colour (from the Moji palette). */
  f: string;
  /** Opacity 0..1. */
  o?: number;
  /** SVG transform, e.g. 'rotate(20 12 12)'. */
  tr?: string;
};

export type MojiShape =
  | ({ t: 'p'; d: string } & Common)
  | ({ t: 'c'; cx: number; cy: number; r: number } & Common)
  | ({ t: 'e'; cx: number; cy: number; rx: number; ry: number } & Common)
  | ({ t: 'r'; x: number; y: number; w: number; h: number; rx?: number } & Common);

export type MojiArt = readonly MojiShape[];

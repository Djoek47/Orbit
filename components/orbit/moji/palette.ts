/**
 * ChoreMaxx Moji palette — the fixed colours our custom emojis are drawn in.
 *
 * Like real emoji, a Moji keeps its own colours on every theme (an apple is always red).
 * Each hue has three tones: `b` base, `s` shade (the side turned away from the light),
 * `l` light (the lit face / gloss). Colours are mid-saturated so they read on both the
 * dark navy grounds and the light ones.
 */
export const M = {
  red: { b: '#E5484D', s: '#B6343A', l: '#FF8C90' },
  tomato: { b: '#EF5B3F', s: '#BE402A', l: '#FF9C84' },
  orange: { b: '#F39A45', s: '#C9722A', l: '#FFC68D' },
  yellow: { b: '#F5C451', s: '#CF9A24', l: '#FFE29B' },
  lime: { b: '#9CCB46', s: '#6F9A2B', l: '#CBEA8C' },
  green: { b: '#4CAF6E', s: '#2F8A50', l: '#8FDDA8' },
  leaf: { b: '#5DB85A', s: '#3B8E3A', l: '#9FE08F' },
  teal: { b: '#2EB8A6', s: '#1E8A7C', l: '#7FE0D2' },
  sky: { b: '#5FB8EC', s: '#3689BD', l: '#B3E1FF' },
  blue: { b: '#4C86F0', s: '#2F5EC2', l: '#9EC0FF' },
  indigo: { b: '#6B6EE8', s: '#4A4CBC', l: '#AEB0FF' },
  violet: { b: '#9B7CF0', s: '#6F52C8', l: '#CDBBFF' },
  pink: { b: '#F07FAF', s: '#C9558A', l: '#FFC0DB' },
  brown: { b: '#A5693F', s: '#7B4A28', l: '#D6A073' },
  bread: { b: '#D99A55', s: '#AD6F33', l: '#F4C98E' },
  cream: { b: '#F4E3C1', s: '#D6BE91', l: '#FFF6E3' },
  white: { b: '#EEF2F8', s: '#C4CDDB', l: '#FFFFFF' },
  gray: { b: '#8E9AAE', s: '#5F6B80', l: '#C6CEDB' },
  steel: { b: '#B7C1D1', s: '#8792A6', l: '#E3E9F2' },
  gold: { b: '#F2B940', s: '#C98C1C', l: '#FFE08A' },
  purple: { b: '#8456D6', s: '#5E36A8', l: '#BB98F5' },
  /** Ink for small details (eyes, stitches, numerals). */
  ink: '#2A2F3D',
  /** Pure highlight for gloss marks. */
  gloss: '#FFFFFF',
} as const;

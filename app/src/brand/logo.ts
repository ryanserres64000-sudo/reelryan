import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { convertIndexedToRgb, decode } from "fast-png";
import { paletteFromPixels } from "../../../core/brand";

export type Logo = { uri: string; colors: string[]; forAi: string };
const SAMPLE = 64, AI_WIDTH = 192;

const bytes = (b64: string) => Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));

// Any decoded PNG (grey, grey + alpha, RGB, RGBA, indexed, 8 or 16 bits) as 8-bit RGBA.
function toRgba8(png: ReturnType<typeof decode>): Uint8ClampedArray {
  const n = png.width * png.height, out = new Uint8ClampedArray(n * 4);
  const src = png.palette ? convertIndexedToRgb(png) : png.data;
  const ch = png.palette ? png.palette[0].length : png.channels, scale = !png.palette && png.depth === 16 ? 257 : 1;
  for (let i = 0; i < n; i++) {
    const v = (k: number) => Number(src[i * ch + k]) / scale;
    const [r, g, b, a] = ch >= 3 ? [v(0), v(1), v(2), ch === 4 ? v(3) : 255] : [v(0), v(0), v(0), ch === 2 ? v(1) : 255];
    out.set([r, g, b, a], i * 4);
  }
  return out;
}

// The logo is read on the iPhone: a 64 × 64 copy gives the colours, without AI (étude, ch. 7
// « Remplir depuis mon logo »). A 192 px copy goes with the one AI analysis, so it sees the style.
export async function readLogo(uri: string): Promise<Logo> {
  const small = await (await ImageManipulator.manipulate(uri).resize({ width: SAMPLE, height: SAMPLE }).renderAsync()).saveAsync({ format: SaveFormat.PNG, base64: true });
  const png = decode(bytes(small.base64 ?? ""));
  const colors = paletteFromPixels(toRgba8(png), png.width, png.height);
  const ai = await (await ImageManipulator.manipulate(uri).resize({ width: AI_WIDTH }).renderAsync()).saveAsync({ format: SaveFormat.PNG, base64: true });
  return { uri, colors, forAi: ai.base64 ?? "" };
}

export async function pickLogo(): Promise<Logo | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: false, quality: 1 });
  if (res.canceled || !res.assets[0]) return null;
  return readLogo(res.assets[0].uri);
}

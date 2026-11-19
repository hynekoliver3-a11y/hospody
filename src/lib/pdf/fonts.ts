import "server-only";
import path from "node:path";
import { Font } from "@react-pdf/renderer";

let registered = false;

/** Noto Sans (pokrývá českou diakritiku – vestavěná Helvetica ne). */
export function registerFonts() {
  if (registered) return;
  const dir = path.join(process.cwd(), "assets", "fonts");
  Font.register({
    family: "Noto Sans",
    fonts: [
      { src: path.join(dir, "NotoSans-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "NotoSans-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

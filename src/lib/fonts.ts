// URLs of the font files each page preloads, so text renders in its final
// font on first paint and does not shift when the font arrives.
import archivo from '@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2?url';
import garamond500 from '@fontsource/eb-garamond/files/eb-garamond-latin-500-normal.woff2?url';
import garamond600 from '@fontsource/eb-garamond/files/eb-garamond-latin-600-normal.woff2?url';
import crimson400 from '@fontsource/crimson-text/files/crimson-text-latin-400-normal.woff2?url';

export const archivoFonts = [archivo];
export const serifFonts = [garamond500, garamond600, crimson400];

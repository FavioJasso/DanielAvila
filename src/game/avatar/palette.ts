/**
 * Daniel 64 — colours. One palette feeds both the vertex colours and the
 * canvas textures so textured and untextured faces meet without a seam.
 * All values are sRGB hex strings.
 */
export const PAL = {
  // skin (medium brown, warm)
  skin: "#c48a5e",
  skinHi: "#d69d71",
  skinShade: "#ac744b",
  skinDark: "#8d5b3a",
  blush: "#cd8663",
  // hair, brows, moustache (near-black brown; kept off pure black so the
  // facets still catch light)
  hair: "#231a16",
  hairHi: "#3a2b23",
  hairDark: "#150f0d",
  beard: "#8b5b3e",
  beardDark: "#5c3927",
  // face details
  eyeWhite: "#f6f1e7",
  iris: "#4b2c16",
  pupil: "#120b08",
  mouth: "#6b2f25",
  lip: "#b5705a",
  // navy blazer, light shirt
  navy: "#22326b",
  navyHi: "#34499a",
  navyDark: "#131c40",
  shirt: "#bcd4f6",
  shirtWhite: "#f2f6fd",
  shirtShade: "#93b1e0",
  gold: "#e6bb48",
  brand: "#3970eb",
  // grey-khaki trousers, dark shoes
  trouser: "#968d79",
  trouserShade: "#7a7262",
  shoe: "#3b2b23",
  shoeHi: "#523c30",
  sole: "#17110e",
} as const;

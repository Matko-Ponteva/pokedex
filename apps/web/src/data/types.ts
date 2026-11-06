import type { PokemonType } from "@pokedex/shared";

export const TYPE_COLORS: Record<PokemonType, string> = {
  normal: "#9fa19f", fire: "#e62829", water: "#2980ef", electric: "#fac000",
  grass: "#3fa129", ice: "#3dcef3", fighting: "#ff8000", poison: "#9141cb",
  ground: "#915121", flying: "#81b9ef", psychic: "#ef4179", bug: "#91a119",
  rock: "#afa981", ghost: "#704170", dragon: "#5060e1", dark: "#624d4e",
  steel: "#60a1b8", fairy: "#ef70ef",
};
const relativeLuminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Whether dark text reads better than white text on this type's color (WCAG contrast) */
export const isLightType = (type: PokemonType) => {
  const l = relativeLuminance(TYPE_COLORS[type]);
  const darkText = relativeLuminance("#1a1d29");
  return (l + 0.05) / (darkText + 0.05) > 1.05 / (l + 0.05);
};

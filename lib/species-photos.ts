/**
 * Wildlife photography (PRD FR-1.2).
 *
 * One credited, freely licensed Wikimedia Commons photograph per catalogued
 * species, stored locally as an optimized WebP under `/images/species/`.
 * Each record keeps the author, licence and source page so attribution travels
 * with the image instead of living only in a markdown file.
 *
 * These are **illustrative** photographs: most were taken elsewhere in the
 * Philippines or in the species' wider range, not at Naujan Lake. The species
 * themselves are the ones the park office has recorded — the pictures are not
 * field evidence. Full attribution is in `public/images/CREDITS.md`.
 *
 * The `species` table already has a `featured_image` column; this map is
 * keyed by slug so both the seed rows and live Supabase rows resolve to the
 * same credited photograph without a schema change.
 */

import type { SpeciesPhoto } from "@/lib/species-meta";

export const speciesPhotos: Record<string, SpeciesPhoto> = {
  "philippine-duck": {
    src: "/images/species/philippine-duck.webp",
    alt: "Illustrative photograph of Philippine duck (Anas luzonica)",
    credit: "Ken Billington",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Philippine_Duck_(Anas_luzonica)_(10).JPG",
  },
  "little-egret": {
    src: "/images/species/little-egret.webp",
    alt: "Illustrative photograph of Little egret (Egretta garzetta)",
    credit: "Shantanu Kuveskar",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Little_egret_(Egretta_garzetta)_Photograph_by_Shantanu_Kuveskar.jpg",
  },
  "purple-heron": {
    src: "/images/species/purple-heron.webp",
    alt: "Illustrative photograph of Purple heron (Ardea purpurea)",
    credit: "Pierre Dalous",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Ardpur2_(cropped).jpg",
  },
  "wandering-whistling-duck": {
    src: "/images/species/wandering-whistling-duck.webp",
    alt: "Illustrative photograph of Wandering whistling duck (Dendrocygna arcuata)",
    credit: "Lip Kee",
    license: "CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Wandering_Whistling_Duck,_Nusa_Dua,_Bali,_Indonesia_1.jpg",
  },
  "great-egret": {
    src: "/images/species/great-egret.webp",
    alt: "Illustrative photograph of Great egret (Ardea alba)",
    credit: "Chuck Homler",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Great_Egret_(Ardea_alba)_in_Breeding_Plumage,_Cape_May_County,_New_Jersey,_USA_(cropped).png",
  },
  "milkfish": {
    src: "/images/species/milkfish.webp",
    alt: "Illustrative photograph of Milkfish (Chanos chanos)",
    credit: "Elisabeth Morcel",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Chanos_chanos.jpg",
  },
  "mudfish": {
    src: "/images/species/mudfish.webp",
    alt: "Illustrative photograph of Mudfish (Channa striata)",
    credit: "Ian Dugdale",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0",
    sourceUrl: "https://www.inaturalist.org/observations/78794768",
  },
  "nile-tilapia": {
    src: "/images/species/nile-tilapia.webp",
    alt: "Illustrative photograph of Nile tilapia (Oreochromis niloticus)",
    credit: "Germano Roberto Schüür",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Til%C3%A1pia_ou_Sarotherodon_niloticus_2.jpg",
  },
  "flathead-goby": {
    src: "/images/species/flathead-goby.webp",
    alt: "Illustrative photograph of Flathead goby (Glossogobius giuris)",
    credit: "Wibowo Djatmiko",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Glossogo_giur_160312-57258_rwg.JPG",
  },
  "common-green-frog": {
    src: "/images/species/common-green-frog.webp",
    alt: "Illustrative photograph of Common green frog (Hoplobatrachus rugulosus)",
    credit: "Arvin Diesmos",
    license: "Public domain",
    licenseUrl: "https://commons.wikimedia.org/wiki/Commons:Licensing",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Hoplobatrachus_rugulosus_2.jpg",
  },
  "water-monitor": {
    src: "/images/species/water-monitor.webp",
    alt: "Illustrative photograph of Water monitor (Varanus salvator)",
    credit: "Carlos Delgado",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Varanus_salvator_-_01.jpg",
  },
  "common-sunken-eyed-skink": {
    src: "/images/species/common-sunken-eyed-skink.webp",
    alt: "Illustrative photograph of Many-lined sun skink (Eutropis multifasciata)",
    credit: "Charles J. Sharp",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Common_sun_skink_(Eutropis_multifasciata).jpg",
  },
  "large-flying-fox": {
    src: "/images/species/large-flying-fox.webp",
    alt: "Illustrative photograph of Large flying fox (Pteropus vampyrus)",
    credit: "Len Worthington",
    license: "CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Philippine_Giant_Fruit_Bat_Pteropus_vampyrus_lanensis_(16338445247).jpg",
  },
  "common-fruit-bat": {
    src: "/images/species/common-fruit-bat.webp",
    alt: "Illustrative photograph of Common fruit bat (Rousettus amplexicaudatus)",
    credit: "James Eaton",
    license: "CC0",
    licenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Rousettus_amplexicaudatus.jpg",
  },
  "blue-water-lily": {
    src: "/images/species/blue-water-lily.webp",
    alt: "Illustrative photograph of Blue water lily (Nymphaea nouchali)",
    credit: "Nguyễn Tấn Phát",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:South_Vietnam%27s_Water_Lily.JPG",
  },
  "common-reed": {
    src: "/images/species/common-reed.webp",
    alt: "Illustrative photograph of Common reed (Phragmites australis)",
    credit: "Leonhard Lenz",
    license: "CC0",
    licenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Reedbed_in_Kalkvitz_2021-09-11_02.jpg",
  },
  "water-hyacinth": {
    src: "/images/species/water-hyacinth.webp",
    alt: "Illustrative photograph of Water hyacinth (Eichhornia crassipes)",
    credit: "Wouter Hagens",
    license: "Public domain",
    licenseUrl: "https://commons.wikimedia.org/wiki/Commons:Licensing",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Eichhornia_crassipes_C.jpg",
  },
  "freshwater-mangrove": {
    src: "/images/species/freshwater-mangrove.webp",
    alt: "Illustrative photograph of Freshwater mangrove (Barringtonia racemosa)",
    credit: "Tom Hulse",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Barringtonia_racemosa1.JPG",
  },
};

/** Fallback for a species row whose slug is not in the curated map. */
const GENERIC_CREDIT = "Wikimedia Commons contributors";

export function photoFor(
  slug: string,
  fallbackSrc?: string | null,
): SpeciesPhoto | undefined {
  const curated = speciesPhotos[slug];
  if (curated) return curated;
  if (!fallbackSrc) return undefined;

  return {
    src: fallbackSrc,
    alt: "Illustrative photograph of this species",
    credit: GENERIC_CREDIT,
    license: "See image credits",
    licenseUrl: "/images/CREDITS.md",
    sourceUrl: "/images/CREDITS.md",
  };
}

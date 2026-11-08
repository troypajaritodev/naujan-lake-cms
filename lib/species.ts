/**
 * Wildlife catalogue (PRD FR-1.1 / FR-1.2).
 *
 * Mirrors the `categories` and `species` tables in `supabase/schema.sql` so the
 * page can be swapped onto Supabase rows without changing its shape. Records
 * are deliberately limited to species documented for Naujan Lake and the
 * Oriental Mindoro wetlands — no aquarium or zoo additions.
 */

export type ConservationStatus = "CR" | "EN" | "VU" | "NT" | "LC" | "DD";

export type Seasonality = "RESIDENT" | "MIGRATORY" | "SEASONAL";

export type WildlifeGroup = {
  slug: string;
  name: string;
  shortName: string;
  description: string;
};

export type Species = {
  slug: string;
  /** Matches `WildlifeGroup.slug` — the `categories` foreign key. */
  group: string;
  commonName: string;
  localName?: string;
  scientificName: string;
  status: ConservationStatus;
  seasonality: Seasonality;
  habitat: string;
  description: string;
};

export const conservationLabels: Record<ConservationStatus, string> = {
  CR: "Critically endangered",
  EN: "Endangered",
  VU: "Vulnerable",
  NT: "Near threatened",
  LC: "Least concern",
  DD: "Data deficient",
};

export const seasonalityLabels: Record<Seasonality, string> = {
  RESIDENT: "Resident year-round",
  MIGRATORY: "Migratory visitor",
  SEASONAL: "Seasonal",
};

export const wildlifeGroups: WildlifeGroup[] = [
  {
    slug: "waterbirds",
    name: "Waterbirds & migratory birds",
    shortName: "Waterbirds",
    description:
      "Herons, egrets, ducks and shorebirds recorded on the lake. Numbers peak between October and March, when birds on the East Asian–Australasian flyway drop onto the eastern marsh.",
  },
  {
    slug: "freshwater-fish",
    name: "Freshwater fishes",
    shortName: "Fish",
    description:
      "Native and introduced species of the open water and the river mouths that feed the lake. Several are the basis of the lakeside catch that supplies Naujan's markets.",
  },
  {
    slug: "amphibians-reptiles",
    name: "Amphibians & reptiles",
    shortName: "Reptiles",
    description:
      "Frogs, skinks and water snakes of the marsh edge — most active after rain, and almost all of them heard rather than seen.",
  },
  {
    slug: "mammals",
    name: "Mammals",
    shortName: "Mammals",
    description:
      "Bats and small mammals of the shoreline forest. The lake edge is a commuting corridor for fruit bats roosting in the remaining lowland trees.",
  },
  {
    slug: "wetland-flora",
    name: "Wetland flora",
    shortName: "Flora",
    description:
      "Reeds, lilies and submerged vegetation. The floating and emergent beds are the nursery for fish and the nesting cover for waterbirds.",
  },
];

export const species: Species[] = [
  // ── Waterbirds ────────────────────────────────────────────────────────────
  {
    slug: "philippine-duck",
    group: "waterbirds",
    commonName: "Philippine duck",
    localName: "Papan",
    scientificName: "Anas luzonica",
    status: "VU",
    seasonality: "RESIDENT",
    habitat: "Shallow lake margins and flooded grassland",
    description:
      "A Philippine endemic and the park's flagship waterbird. Pairs nest in the reeds on the eastern shore; the lake holds one of the few stable populations left in Mindoro.",
  },
  {
    slug: "little-egret",
    group: "waterbirds",
    commonName: "Little egret",
    localName: "Tagak",
    scientificName: "Egretta garzetta",
    status: "LC",
    seasonality: "MIGRATORY",
    habitat: "Mudflats, fishpond edges and the river mouths",
    description:
      "Arrives with the northeast monsoon and hunts by shuffling its feet to flush small fish. The white flocks on the northern flats from November onward are mostly this species.",
  },
  {
    slug: "purple-heron",
    group: "waterbirds",
    commonName: "Purple heron",
    scientificName: "Ardea purpurea",
    status: "LC",
    seasonality: "RESIDENT",
    habitat: "Tall reed beds and densely vegetated marsh",
    description:
      "Secretive and easily overlooked — it freezes with its neck vertical when a boat approaches. Best located by its harsh, grating call at dawn.",
  },
  {
    slug: "wandering-whistling-duck",
    group: "waterbirds",
    commonName: "Wandering whistling duck",
    scientificName: "Dendrocygna arcuata",
    status: "LC",
    seasonality: "RESIDENT",
    habitat: "Open water and floating vegetation beds",
    description:
      "Highly gregarious, often counted in flocks of fifty or more. The whistling call carries across the lake well before the birds are visible.",
  },
  {
    slug: "great-egret",
    group: "waterbirds",
    commonName: "Great egret",
    scientificName: "Ardea alba",
    status: "LC",
    seasonality: "MIGRATORY",
    habitat: "Open shallows and drained fishponds",
    description:
      "The largest white heron on the lake. A winter visitor that arrives thin after the flight from East Asia and spends the first weeks feeding almost continuously.",
  },

  // ── Freshwater fish ───────────────────────────────────────────────────────
  {
    slug: "milkfish",
    group: "freshwater-fish",
    commonName: "Milkfish",
    localName: "Bangus",
    scientificName: "Chanos chanos",
    status: "LC",
    seasonality: "SEASONAL",
    habitat: "Lake shallows, river mouths and brackish outlets",
    description:
      "Runs into the lake from coastal waters and is the mainstay of lakeside aquaculture. Juveniles shelter in the flooded margins before returning downstream.",
  },
  {
    slug: "mudfish",
    group: "freshwater-fish",
    commonName: "Mudfish",
    localName: "Dalag",
    scientificName: "Channa striata",
    status: "LC",
    seasonality: "RESIDENT",
    habitat: "Slow water, mud bottoms and flooded grass",
    description:
      "An obligate air-breather, which is how it survives the low-oxygen shallows in the dry season. A staple of the local catch and a favourite of herons.",
  },
  {
    slug: "nile-tilapia",
    group: "freshwater-fish",
    commonName: "Nile tilapia",
    scientificName: "Oreochromis niloticus",
    status: "LC",
    seasonality: "RESIDENT",
    habitat: "Open water and warm shallows",
    description:
      "Introduced and now widespread. Included here because it is what most visitors actually see at the boat landing — and because it competes with native species for nesting cover.",
  },
  {
    slug: "flathead-goby",
    group: "freshwater-fish",
    commonName: "Flathead goby",
    localName: "Biya",
    scientificName: "Glossogobius giuris",
    status: "LC",
    seasonality: "RESIDENT",
    habitat: "Sand and gravel runs near the inlets",
    description:
      "A small, bottom-dwelling native that sits motionless on the substrate. Common in the clear water where the eastern streams enter the lake.",
  },

  // ── Amphibians & reptiles ─────────────────────────────────────────────────
  {
    slug: "common-green-frog",
    group: "amphibians-reptiles",
    commonName: "Common green frog",
    localName: "Palaka",
    scientificName: "Hoplobatrachus rugulosus",
    status: "LC",
    seasonality: "RESIDENT",
    habitat: "Flooded grass and the marsh edge",
    description:
      "The loudest voice on the lake after heavy rain. Choruses start within an hour of the first downpour and continue well into the night.",
  },
  {
    slug: "water-monitor",
    group: "amphibians-reptiles",
    commonName: "Water monitor",
    localName: "Bayawak",
    scientificName: "Varanus salvator",
    status: "LC",
    seasonality: "RESIDENT",
    habitat: "Shoreline forest, marsh edge and floating logs",
    description:
      "Regularly seen swimming between the reed beds. Despite the size, it avoids boats and is more often heard crashing into the water than watched.",
  },
  {
    slug: "common-sunken-eyed-skink",
    group: "amphibians-reptiles",
    commonName: "Many-lined sun skink",
    scientificName: "Eutropis multifasciata",
    status: "LC",
    seasonality: "RESIDENT",
    habitat: "Dry banks, paths and cleared ground",
    description:
      "The small brown lizard on every sunlit track. Fast, common, and the main reason the park asks visitors to keep to marked paths.",
  },

  // ── Mammals ───────────────────────────────────────────────────────────────
  {
    slug: "large-flying-fox",
    group: "mammals",
    commonName: "Large flying fox",
    localName: "Kabag",
    scientificName: "Pteropus vampyrus",
    status: "EN",
    seasonality: "RESIDENT",
    habitat: "Remaining lowland forest along the shoreline",
    description:
      "A fruit bat with a two-metre wingspan that commutes over the lake at dusk. Roost trees are the limiting factor, which is why the shoreline forest is closed to clearing.",
  },
  {
    slug: "common-fruit-bat",
    group: "mammals",
    commonName: "Common fruit bat",
    scientificName: "Rousettus amplexicaudatus",
    status: "LC",
    seasonality: "RESIDENT",
    habitat: "Caves and dense shoreline trees",
    description:
      "The smaller, more numerous fruit bat of the lakeside. Unlike the insect-eating bats it is easily seen at dusk, flying a direct line rather than fluttering.",
  },

  // ── Flora ─────────────────────────────────────────────────────────────────
  {
    slug: "blue-water-lily",
    group: "wetland-flora",
    commonName: "Blue water lily",
    localName: "Lawa-lawaan",
    scientificName: "Nymphaea nouchali",
    status: "LC",
    seasonality: "RESIDENT",
    habitat: "Still, shallow water over mud",
    description:
      "Opens in the morning and closes by early afternoon. The floating leaves are the platform small frogs and insects use to cross open water.",
  },
  {
    slug: "common-reed",
    group: "wetland-flora",
    commonName: "Common reed",
    localName: "Tambô",
    scientificName: "Phragmites australis",
    status: "LC",
    seasonality: "RESIDENT",
    habitat: "Lake margin and the eastern marsh",
    description:
      "Forms the tall wall of vegetation that makes the eastern marsh impassable by boat. It is also the nesting cover that keeps the Philippine duck population viable.",
  },
  {
    slug: "water-hyacinth",
    group: "wetland-flora",
    commonName: "Water hyacinth",
    scientificName: "Eichhornia crassipes",
    status: "LC",
    seasonality: "SEASONAL",
    habitat: "Nutrient-rich shallows and slow inlets",
    description:
      "An introduced floating plant that mats over sheltered water in the wet season. The park office clears it from access channels before each tour season.",
  },
  {
    slug: "freshwater-mangrove",
    group: "wetland-flora",
    commonName: "Freshwater mangrove",
    localName: "Putat",
    scientificName: "Barringtonia racemosa",
    status: "LC",
    seasonality: "RESIDENT",
    habitat: "Waterlogged banks and the lake edge",
    description:
      "Leans out over the water with its roots in the flood line. The pendulous pink flower spikes are the easiest way to identify it from a boat.",
  },
];

/** Species grouped in `wildlifeGroups` order, ready for section rendering. */
export function speciesByGroup(): { group: WildlifeGroup; species: Species[] }[] {
  return wildlifeGroups.map((group) => ({
    group,
    species: species.filter((entry) => entry.group === group.slug),
  }));
}

export function speciesCountByStatus(status: ConservationStatus): number {
  return species.filter((entry) => entry.status === status).length;
}

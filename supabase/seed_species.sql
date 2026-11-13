-- Idempotently seed the 18 catalogue records from lib/species.ts.
--
-- The source catalogue has no species UUID or image fields. These stable UUIDs
-- preserve each imported row's identity on later runs; only the Philippine
-- duck has a species-specific photo in public/images, so other rows use the
-- lake shoreline image until park-owned species photos are available.
--
-- Run after supabase/schema.sql in the Supabase SQL editor or with psql.
-- ON CONFLICT (slug) DO NOTHING deliberately preserves any existing edits.

-- The public read policies also need SQL privileges for the anon API role.
grant select on public.categories, public.species to anon, authenticated;

insert into public.species (
  id,
  category_id,
  common_name,
  local_name,
  scientific_name,
  conservation_status,
  seasonality,
  habitat,
  description,
  featured_image,
  slug
)
values
  ('e1e92bfa-7efb-5ce4-a73a-b0493d6d30a1', 'c1000000-0000-4000-8000-000000000001', 'Philippine duck', 'Papan', 'Anas luzonica', 'VU', 'RESIDENT', 'Shallow lake margins and flooded grassland', 'A Philippine endemic and the park''s flagship waterbird. Pairs nest in the reeds on the eastern shore; the lake holds one of the few stable populations left in Mindoro.', '/images/ducklings.jpg', 'philippine-duck'),
  ('47df4cfa-6742-53fe-a77c-c0469055a5d3', 'c1000000-0000-4000-8000-000000000001', 'Little egret', 'Tagak', 'Egretta garzetta', 'LC', 'MIGRATORY', 'Mudflats, fishpond edges and the river mouths', 'Arrives with the northeast monsoon and hunts by shuffling its feet to flush small fish. The white flocks on the northern flats from November onward are mostly this species.', '/images/shoreline.jpg', 'little-egret'),
  ('e1a3dd30-2954-5505-ab11-1e563508f85d', 'c1000000-0000-4000-8000-000000000001', 'Purple heron', null, 'Ardea purpurea', 'LC', 'RESIDENT', 'Tall reed beds and densely vegetated marsh', 'Secretive and easily overlooked — it freezes with its neck vertical when a boat approaches. Best located by its harsh, grating call at dawn.', '/images/shoreline.jpg', 'purple-heron'),
  ('ca5c40a1-7b90-529a-a36d-e741ec1cf7b1', 'c1000000-0000-4000-8000-000000000001', 'Wandering whistling duck', null, 'Dendrocygna arcuata', 'LC', 'RESIDENT', 'Open water and floating vegetation beds', 'Highly gregarious, often counted in flocks of fifty or more. The whistling call carries across the lake well before the birds are visible.', '/images/shoreline.jpg', 'wandering-whistling-duck'),
  ('5c73bea9-1054-5db7-a54f-820eae3ee47c', 'c1000000-0000-4000-8000-000000000001', 'Great egret', null, 'Ardea alba', 'LC', 'MIGRATORY', 'Open shallows and drained fishponds', 'The largest white heron on the lake. A winter visitor that arrives thin after the flight from East Asia and spends the first weeks feeding almost continuously.', '/images/shoreline.jpg', 'great-egret'),
  ('04148090-3801-5488-ae00-bdf8a0ab9b76', 'c1000000-0000-4000-8000-000000000002', 'Milkfish', 'Bangus', 'Chanos chanos', 'LC', 'SEASONAL', 'Lake shallows, river mouths and brackish outlets', 'Runs into the lake from coastal waters and is the mainstay of lakeside aquaculture. Juveniles shelter in the flooded margins before returning downstream.', '/images/shoreline.jpg', 'milkfish'),
  ('e51ade12-2588-55e7-a715-41adad81de98', 'c1000000-0000-4000-8000-000000000002', 'Mudfish', 'Dalag', 'Channa striata', 'LC', 'RESIDENT', 'Slow water, mud bottoms and flooded grass', 'An obligate air-breather, which is how it survives the low-oxygen shallows in the dry season. A staple of the local catch and a favourite of herons.', '/images/shoreline.jpg', 'mudfish'),
  ('bac02fb8-9d19-5df2-af2f-1b7f53e9150a', 'c1000000-0000-4000-8000-000000000002', 'Nile tilapia', null, 'Oreochromis niloticus', 'LC', 'RESIDENT', 'Open water and warm shallows', 'Introduced and now widespread. Included here because it is what most visitors actually see at the boat landing — and because it competes with native species for nesting cover.', '/images/shoreline.jpg', 'nile-tilapia'),
  ('3aaebb8c-72ef-5161-a536-7b33ecbcfd01', 'c1000000-0000-4000-8000-000000000002', 'Flathead goby', 'Biya', 'Glossogobius giuris', 'LC', 'RESIDENT', 'Sand and gravel runs near the inlets', 'A small, bottom-dwelling native that sits motionless on the substrate. Common in the clear water where the eastern streams enter the lake.', '/images/shoreline.jpg', 'flathead-goby'),
  ('dc303218-df0b-554f-af32-17ec4e278a12', 'c1000000-0000-4000-8000-000000000003', 'Common green frog', 'Palaka', 'Hoplobatrachus rugulosus', 'LC', 'RESIDENT', 'Flooded grass and the marsh edge', 'The loudest voice on the lake after heavy rain. Choruses start within an hour of the first downpour and continue well into the night.', '/images/shoreline.jpg', 'common-green-frog'),
  ('9fdefa05-be5b-59bc-a709-16e611299f2c', 'c1000000-0000-4000-8000-000000000003', 'Water monitor', 'Bayawak', 'Varanus salvator', 'LC', 'RESIDENT', 'Shoreline forest, marsh edge and floating logs', 'Regularly seen swimming between the reed beds. Despite the size, it avoids boats and is more often heard crashing into the water than watched.', '/images/shoreline.jpg', 'water-monitor'),
  ('ab95dcac-3966-552f-a6d5-42f5d0fcd732', 'c1000000-0000-4000-8000-000000000003', 'Many-lined sun skink', null, 'Eutropis multifasciata', 'LC', 'RESIDENT', 'Dry banks, paths and cleared ground', 'The small brown lizard on every sunlit track. Fast, common, and the main reason the park asks visitors to keep to marked paths.', '/images/shoreline.jpg', 'common-sunken-eyed-skink'),
  ('372b5308-2f17-5e0a-a194-e0a1b7d22b55', 'c1000000-0000-4000-8000-000000000004', 'Large flying fox', 'Kabag', 'Pteropus vampyrus', 'EN', 'RESIDENT', 'Remaining lowland forest along the shoreline', 'A fruit bat with a two-metre wingspan that commutes over the lake at dusk. Roost trees are the limiting factor, which is why the shoreline forest is closed to clearing.', '/images/shoreline.jpg', 'large-flying-fox'),
  ('a3b22133-a7d8-55bb-acc3-cef62d1b11e1', 'c1000000-0000-4000-8000-000000000004', 'Common fruit bat', null, 'Rousettus amplexicaudatus', 'LC', 'RESIDENT', 'Caves and dense shoreline trees', 'The smaller, more numerous fruit bat of the lakeside. Unlike the insect-eating bats it is easily seen at dusk, flying a direct line rather than fluttering.', '/images/shoreline.jpg', 'common-fruit-bat'),
  ('c6f29d67-26d1-54b8-ac85-30990543303e', 'c1000000-0000-4000-8000-000000000005', 'Blue water lily', 'Lawa-lawaan', 'Nymphaea nouchali', 'LC', 'RESIDENT', 'Still, shallow water over mud', 'Opens in the morning and closes by early afternoon. The floating leaves are the platform small frogs and insects use to cross open water.', '/images/shoreline.jpg', 'blue-water-lily'),
  ('56af6b44-1f62-57b5-acb6-ce51acf3a3e0', 'c1000000-0000-4000-8000-000000000005', 'Common reed', 'Tambô', 'Phragmites australis', 'LC', 'RESIDENT', 'Lake margin and the eastern marsh', 'Forms the tall wall of vegetation that makes the eastern marsh impassable by boat. It is also the nesting cover that keeps the Philippine duck population viable.', '/images/shoreline.jpg', 'common-reed'),
  ('4680553c-8b25-5992-abaf-5e2db6684669', 'c1000000-0000-4000-8000-000000000005', 'Water hyacinth', null, 'Eichhornia crassipes', 'LC', 'SEASONAL', 'Nutrient-rich shallows and slow inlets', 'An introduced floating plant that mats over sheltered water in the wet season. The park office clears it from access channels before each tour season.', '/images/shoreline.jpg', 'water-hyacinth'),
  ('1a318cdd-4cee-5cde-aebe-4e5e93c5a6f7', 'c1000000-0000-4000-8000-000000000005', 'Freshwater mangrove', 'Putat', 'Barringtonia racemosa', 'LC', 'RESIDENT', 'Waterlogged banks and the lake edge', 'Leans out over the water with its roots in the flood line. The pendulous pink flower spikes are the easiest way to identify it from a boat.', '/images/shoreline.jpg', 'freshwater-mangrove')
on conflict (slug) do nothing;

"use client";

import { useState } from "react";
import { ArrowUpRight, Compass, MapPin } from "lucide-react";
import SectionHeading from "@/components/section-heading";

type ParkWaypoint = {
  id: string;
  name: string;
  zone: string;
  lat: number;
  lon: number;
  summary: string;
};

const WAYPOINTS: ParkWaypoint[] = [
  {
    id: "bayani",
    name: "Brgy. Bayani / Buhangin Boat Jetty",
    zone: "Buffer & Main Boarding Point",
    lat: 13.184,
    lon: 121.344,
    summary:
      "Primary visitor check-in dock. Present booking reference and QR Entry Pass for ranger briefing and life-jacket issue.",
  },
  {
    id: "sanctuary",
    name: "Eastern Marsh Bird Sanctuary",
    zone: "Strict Protection Zone (Core)",
    lat: 13.166,
    lon: 121.373,
    summary:
      "Critical habitat for resident Philippine ducks and wintering migratory herons. Motorized landing is prohibited.",
  },
  {
    id: "basin",
    name: "Central Open Lake Corridor",
    zone: "Sustainable Use Zone",
    lat: 13.155,
    lon: 121.345,
    summary:
      "Marked accredited eco-tour route with scenic views of Mount Halcon and regulated community hook-and-line fishing.",
  },
  {
    id: "office",
    name: "PAMB / Park Ranger Station (Victoria–Pola)",
    zone: "Management & Emergency Hub",
    lat: 13.136,
    lon: 121.339,
    summary:
      "Park administrative post handling environmental clearances, research permits, and emergency boat dispatch.",
  },
];

function osmEmbedUrl(lat: number, lon: number): string {
  const delta = 0.032;
  const bbox = `${(lon - delta).toFixed(4)},${(lat - delta).toFixed(4)},${(lon + delta).toFixed(4)},${(lat + delta).toFixed(4)}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lon}`;
}

export default function LakeMap() {
  const [selectedId, setSelectedId] = useState<string>(WAYPOINTS[0].id);
  const active =
    WAYPOINTS.find((point) => point.id === selectedId) ?? WAYPOINTS[0];

  return (
    <section className="border-t border-ink/8 bg-sand-50 py-16 lg:py-20">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
        <SectionHeading
          eyebrow="Park map & access"
          title="Navigate the boarding jetties"
          description="Select a park zone or jetty pin to preview its coordinates on OpenStreetMap or launch turn-by-turn directions in Google Maps."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_1.45fr]">
          <div className="space-y-3">
            {WAYPOINTS.map((point) => {
              const isSelected = point.id === active.id;
              return (
                <button
                  key={point.id}
                  type="button"
                  onClick={() => setSelectedId(point.id)}
                  className={`w-full rounded-2xl p-4 text-left transition ring-1 ${
                    isSelected
                      ? "bg-lake-950 text-sand-50 ring-lake-900 shadow-sm"
                      : "bg-white text-ink ring-ink/10 hover:bg-sand-100/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p
                        className={`text-[10px] font-semibold tracking-[0.14em] uppercase ${
                          isSelected ? "text-reed-300" : "text-lake-700"
                        }`}
                      >
                        {point.zone}
                      </p>
                      <p className="mt-1 font-display text-[17px] leading-snug">
                        {point.name}
                      </p>
                    </div>
                    <MapPin
                      className={`mt-0.5 size-4 shrink-0 ${
                        isSelected ? "text-reed-300" : "text-sand-500"
                      }`}
                    />
                  </div>
                  <p
                    className={`mt-2 text-[12.5px] leading-relaxed ${
                      isSelected ? "text-sand-200/85" : "text-ink-soft/75"
                    }`}
                  >
                    {point.summary}
                  </p>
                  <p
                    className={`mt-2 font-mono text-[11px] ${
                      isSelected ? "text-sand-300/70" : "text-sand-600"
                    }`}
                  >
                    {point.lat.toFixed(3)}° N, {point.lon.toFixed(3)}° E
                  </p>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-ink/10">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/8 bg-sand-100/70 px-5 py-3.5">
              <div className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
                <Compass className="size-4 text-lake-800" />
                <span>{active.name}</span>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${active.lat},${active.lon}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-lake-800 px-3.5 py-1.5 text-[11.5px] font-semibold text-sand-50 transition hover:bg-lake-700"
              >
                Open in Google Maps
                <ArrowUpRight className="size-3.5" />
              </a>
            </div>

            <div className="relative min-h-[360px] flex-1 bg-sand-100">
              <iframe
                key={active.id}
                title={`Map of ${active.name}`}
                src={osmEmbedUrl(active.lat, active.lon)}
                className="h-full min-h-[360px] w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            <div className="border-t border-ink/8 px-5 py-3 text-[11.5px] text-ink-soft/70">
              Map data © OpenStreetMap contributors · Naujan Lake Ramsar Site No. 1008
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

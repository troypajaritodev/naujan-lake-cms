import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import SectionHeading from "@/components/section-heading";
import { exploreCards } from "@/lib/site";

export default function ExploreCards() {
  return (
    <section className="border-y border-ink/5 bg-sand-100/70 py-20 lg:py-24">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
        <SectionHeading
          eyebrow="Start here"
          title="Three ways into the park"
          description="Whether you are planning a boat trip, cataloguing species or checking the rules before you arrive, start with one of these."
          action={{ label: "Browse the catalog", href: "/wildlife" }}
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {exploreCards.map((card, index) => (
            <Link
              key={card.href}
              href={card.href}
              className="group flex flex-col overflow-hidden rounded-[1.5rem] bg-sand-50 ring-1 ring-ink/8 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_28px_60px_-32px_rgba(8,33,31,0.45)]"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-lake-900">
                <Image
                  src={card.image}
                  alt={card.imageAlt}
                  fill
                  sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />
                <span className="absolute top-4 left-4 rounded-full bg-sand-50/90 px-3 py-1 text-[10px] font-semibold tracking-[0.16em] text-ink uppercase backdrop-blur-sm">
                  {card.tag}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-display text-[21px] leading-tight font-normal text-ink">
                    {card.title}
                  </h3>
                  <span className="font-mono text-[11px] text-sand-600">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>

                <p className="mt-2.5 flex-1 text-[14px] leading-relaxed text-ink-soft/80">
                  {card.description}
                </p>

                <span className="mt-6 inline-flex items-center gap-2 text-[13px] font-medium text-lake-700">
                  {card.cta}
                  <ArrowRight
                    className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                    strokeWidth={1.9}
                  />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

type Tone = "lake" | "reed" | "moss" | "alert" | "ink";

const dots: Record<Tone, string> = {
  lake: "bg-lake-500",
  reed: "bg-reed-400",
  moss: "bg-moss-500",
  alert: "bg-alert-500",
  ink: "bg-ink/40",
};

export default function StatCard({
  label,
  value,
  hint,
  tone = "lake",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-ink/8">
      <div className="flex items-center gap-2">
        <span className={`size-1.5 shrink-0 rounded-full ${dots[tone]}`} />
        <p className="text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
          {label}
        </p>
      </div>
      <p className="mt-3 font-display text-[30px] leading-none font-light text-ink">
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-soft/60">{hint}</p>
      ) : null}
    </div>
  );
}

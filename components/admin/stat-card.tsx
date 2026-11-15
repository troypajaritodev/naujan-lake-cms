type Tone = "lake" | "reed" | "moss" | "alert" | "ink";

const dots: Record<Tone, string> = {
  lake: "bg-lake-500 ring-4 ring-lake-500/15",
  reed: "bg-reed-400 ring-4 ring-reed-400/20",
  moss: "bg-moss-500 ring-4 ring-moss-500/15",
  alert: "bg-alert-500 ring-4 ring-alert-500/15",
  ink: "bg-ink/40 ring-4 ring-ink/10",
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
    <div className="surface-card rounded-2xl p-5 ring-1 ring-ink/8">
      <div className="flex items-center gap-2.5">
        <span className={`size-2 shrink-0 rounded-full ${dots[tone]}`} />
        <p className="text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
          {label}
        </p>
      </div>
      <p className="mt-3 font-display text-[32px] leading-none font-light text-ink tabular-nums">
        {value}
      </p>
      {hint ? (
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-soft/65">{hint}</p>
      ) : null}
    </div>
  );
}

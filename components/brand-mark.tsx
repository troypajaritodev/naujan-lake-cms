import Image from "next/image";

type BrandMarkProps = {
  className?: string;
};

/**
 * Official Naujan Lake, Oriental Mindoro circular park emblem.
 */
export default function BrandMark({ className = "size-10" }: BrandMarkProps) {
  return (
    <span
      className={`relative inline-block shrink-0 overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-ink/10 ${className}`}
      aria-hidden="true"
    >
      <Image
        src="/images/naujan-logo.png"
        alt="Naujan Lake Oriental Mindoro logo"
        fill
        sizes="96px"
        className="object-cover"
        priority
      />
    </span>
  );
}

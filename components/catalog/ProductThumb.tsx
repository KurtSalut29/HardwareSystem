import Image from "next/image";
import CategoryGlyph from "@/components/catalog/CategoryGlyph";

/**
 * A product's picture on a soft studio-grey well, the way catalogues shoot
 * hardware. Without a photo, the category's icon stands in, drawn the same
 * way for every product so a mixed catalogue still looks deliberate.
 */
export default function ProductThumb({
  image, name, category, subcategory, sizes = "(max-width: 640px) 50vw, 240px", size = "card", className = "",
}: {
  image: string | null;
  name: string;
  category?: string | null;
  subcategory?: string | null;
  sizes?: string;
  /** card: fills its box; row: a small square for lists. */
  size?: "card" | "row";
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-recess ${size === "row" ? "size-11 shrink-0 rounded-lg" : "w-full"} ${className}`}>
      {image ? (
        <Image src={image} alt={name} fill sizes={size === "row" ? "44px" : sizes}
          className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]" />
      ) : (
        <div aria-hidden className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_30%_20%,var(--bg-card),transparent_70%)]">
          <CategoryGlyph category={category} subcategory={subcategory} className={`text-brand/35 ${size === "row" ? "size-5" : "size-12"}`} strokeWidth={1.4} />
        </div>
      )}
    </div>
  );
}

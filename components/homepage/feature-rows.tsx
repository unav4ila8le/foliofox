import Image, { type StaticImageData } from "next/image";

interface FeatureRow {
  eyebrow?: string;
  title: string;
  description: string;
  image: StaticImageData;
  alt: string;
  imageClassName?: string;
}

interface FeatureRowsProps {
  rows: FeatureRow[];
}

// Alternating text/image rows; even rows put the image on the left on desktop.
export function FeatureRows({ rows }: FeatureRowsProps) {
  return (
    <div className="space-y-20 md:space-y-28">
      {rows.map((row) => (
        <div
          key={row.title}
          className="group grid items-center gap-8 md:grid-cols-2 md:gap-14"
        >
          <div className="max-w-lg md:group-even:order-2">
            {row.eyebrow && (
              <p className="text-brand mb-3 text-sm font-semibold">
                {row.eyebrow}
              </p>
            )}
            <h3 className="text-2xl font-semibold">{row.title}</h3>
            <p className="text-muted-foreground mt-4 leading-7">
              {row.description}
            </p>
          </div>
          <div className="relative aspect-[1080/666] overflow-hidden rounded-lg md:group-even:order-1">
            <Image
              fill
              src={row.image}
              alt={row.alt}
              className={row.imageClassName ?? "object-cover"}
              sizes="(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

import Image from "next/image";

import sandyAvatar from "@/public/images/testimonials/sandy-avatar.jpg";
import fwaszAvatar from "@/public/images/testimonials/fwasz-avatar.png";
import nathanAvatar from "@/public/images/testimonials/nathan-avatar.png";

const testimonials = [
  {
    name: "Sandy",
    image: sandyAvatar,
    quote:
      "FolioFox helped my husband and I feel much more confident about our plans for retirement. Having everything laid out gives us real peace of mind.",
  },
  {
    name: "Fwasz",
    image: fwaszAvatar,
    quote:
      "Foliofox has been a lifesaver in helping me reach my investment goals.",
  },
  {
    name: "Nathan, CPA",
    image: nathanAvatar,
    quote:
      "FolioFox has made it extremely easy to monitor investments, understand where I stand towards my financial goals…",
  },
];

export function HomepageTestimonials() {
  return (
    <section className="border-t py-20 md:py-28">
      <h2 className="text-3xl tracking-tight text-balance md:text-4xl">
        What investors say about FolioFox
      </h2>
      <div className="mt-12 grid gap-10 md:grid-cols-3">
        {testimonials.map((testimonial, index) => (
          <blockquote
            key={testimonial.name}
            className="flex flex-col border-l pl-5"
          >
            <p
              className={
                index === 1
                  ? "flex flex-1 items-center text-lg leading-8 italic"
                  : "text-lg leading-8 italic"
              }
            >
              {testimonial.quote}
            </p>
            <footer className="text-muted-foreground mt-auto flex items-center gap-2 pt-4 text-sm font-medium">
              <Image
                src={testimonial.image}
                alt=""
                width={32}
                height={32}
                className="ring-border size-8 rounded-full object-cover ring-1"
              />
              <span>{testimonial.name}</span>
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}

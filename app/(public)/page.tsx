import Link from "next/link";
import Image from "next/image";

import { Hero } from "@/components/homepage/hero";

export default function HomePage() {
  return (
    <div className="relative mx-auto mt-12 max-w-7xl p-3">
      <Hero />

      {/* BMC Button */}
      <Link
        href="https://buymeacoffee.com/leonardofromfoliofox"
        target="_blank"
        className="fixed right-4 bottom-6 transition-all duration-100 hover:scale-105 md:right-8 md:bottom-8"
      >
        <Image
          src="/images/homepage/bmc-button.svg"
          alt="Buy me a Milk Tea"
          width={164}
          height={46}
        />
      </Link>
    </div>
  );
}

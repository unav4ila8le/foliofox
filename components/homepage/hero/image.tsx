import Image from "next/image";

import heroLight from "@/public/images/homepage/foliofox-preview-light.png";
import heroDark from "@/public/images/homepage/foliofox-preview-dark.png";

export function HeroImage() {
  return (
    <>
      <Image
        src={heroLight}
        alt="Foliofox preview"
        fetchPriority="high"
        className="mx-auto h-auto w-full max-w-5xl rounded-sm border lg:rounded-lg dark:hidden"
      />
      <Image
        src={heroDark}
        alt="Foliofox preview"
        fetchPriority="high"
        className="mx-auto hidden h-auto w-full max-w-5xl rounded-sm border lg:rounded-lg dark:block"
      />
    </>
  );
}

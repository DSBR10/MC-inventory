"use client";

import Image from "next/image";
import { useState } from "react";

const LOGO_PATH = "/branding/ux-technology-logo.png";

export default function BrandLogo() {
  const [logoUnavailable, setLogoUnavailable] = useState(false);

  if (logoUnavailable) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-bold text-white shadow-lg">
        UX
      </div>
    );
  }

  return (
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1 shadow-lg">
      <Image
        src={LOGO_PATH}
        alt="UX Technology"
        fill
        sizes="44px"
        className="object-contain p-1"
        onError={() => setLogoUnavailable(true)}
      />
    </div>
  );
}

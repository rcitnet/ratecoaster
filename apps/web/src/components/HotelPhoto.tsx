"use client";

import Image from "next/image";
import { useState } from "react";
import hotelImages from "@/lib/hotel-images.json";

export function HotelPhoto({ slug, name }: { slug: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="hotel-browse-photo">
      {Object.hasOwn(hotelImages, slug) && !failed ? (
        <Image src={`/hotels/${slug}.webp`} alt={name} fill sizes="(max-width: 700px) 80vw, 300px" onError={() => setFailed(true)} />
      ) : <div className="refresh-photo-fallback"><span aria-hidden="true">⌂</span><span>{name}</span></div>}
    </div>
  );
}

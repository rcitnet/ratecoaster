"use client";

import { useState } from "react";

export function RideImage({ src }: { src: string | null }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  return (
    <div className="wait-image" aria-hidden="true">
      {src && failedSrc !== src ? (
        <img
          src={src}
          alt=""
          width={72}
          height={72}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <svg viewBox="0 0 48 48" fill="none" focusable="false">
          <path d="M7 34V15a3 3 0 0 1 3-3h28a3 3 0 0 1 3 3v19a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3Z" />
          <circle cx="17" cy="20" r="3" />
          <path d="m8 33 10-8 7 5 7-10 9 13" />
        </svg>
      )}
    </div>
  );
}

import Image from "next/image";
import type { ReactNode } from "react";

export function PageIntro({ eyebrow, title, children, image, action }: {
  eyebrow: string;
  title: ReactNode;
  children: ReactNode;
  image?: { src: string; alt: string; label?: string };
  action?: { href: string; label: string };
}) {
  return (
    <header className={`page-intro${image ? " page-intro-photo" : ""}`}>
      <div className="page-intro-copy">
        <p className="refresh-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <div className="page-intro-description">{children}</div>
        {action ? <a className="refresh-text-link page-intro-action" href={action.href}>{action.label} <span aria-hidden="true">→</span></a> : null}
      </div>
      {image ? (
        <figure className="page-intro-image">
          <Image src={image.src} alt={image.alt} fill sizes="(max-width: 700px) 100vw, 40vw" priority />
          {image.label ? <figcaption>{image.label}</figcaption> : null}
        </figure>
      ) : null}
    </header>
  );
}

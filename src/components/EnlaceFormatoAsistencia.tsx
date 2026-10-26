"use client";

import type { ReactNode } from "react";

export default function EnlaceFormatoAsistencia({ href, className, children }: { href: string; className?: string; target?: string; children: ReactNode }) {
  return <a href={href} className={className} onClick={(e) => {
    e.currentTarget.href = `${href}?volver=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}`;
  }}>{children}</a>;
}

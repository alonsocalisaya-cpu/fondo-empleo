import type { Metadata } from "next";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Fondoempleo · Gestión de Capacitaciones", template: "%s · Fondoempleo" },
  description: "Plataforma para gestionar capacitaciones, sedes, horarios y asistencia.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full font-sans">{children}</body>
    </html>
  );
}

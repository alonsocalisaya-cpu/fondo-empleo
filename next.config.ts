import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// IPs de este equipo en la red local (para abrir la app desde otros equipos: http://<IP>:4000)
const ipsLocales = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === "IPv4" && !i.internal)
  .map((i) => i!.address);

const nextConfig: NextConfig = {
  // OneDrive puede bloquear la caché predeterminada `.next`; usar una carpeta
  // de compilación nueva evita reutilizar archivos que quedaron bloqueados.
  distDir: "build",

  // En modo desarrollo, Next.js solo acepta "localhost"; así también acepta la IP del equipo.
  allowedDevOrigins: ipsLocales,

  // Sin compresión gzip: en red local no hace falta y evita el aviso
  // "MaxListenersExceededWarning ... drain listeners added to [Gzip]" en npm start.
  compress: false,

  // No revisar los archivos subidos (archivos/) al compilar: son datos, no código. Además, si OneDrive los
  // deja «solo en la nube», leerlos durante la compilación falla (error 380).
  outputFileTracingExcludes: {
    "**": ["./archivos/**/*", "./plantillas/**/ORIGINAL*", "./.next/**/*"],
  },

  // Permite subir archivos: documentos hasta 50 MB y videos de la sesión hasta 300 MB
  experimental: {
    serverActions: { bodySizeLimit: "320mb" },
  },

  // Direcciones antiguas (antes del menú Estratégico / Operativo / Soporte)
  async redirects() {
    return [
      { source: "/capacitaciones", destination: "/estrategico/cronograma/estructura", permanent: false },
      { source: "/programacion", destination: "/estrategico/cronograma", permanent: false },
      { source: "/programacion/:ruta*", destination: "/estrategico/cronograma/:ruta*", permanent: false },
      { source: "/asistencia", destination: "/operativo/capacitacion", permanent: false },
      { source: "/asistencia/:ruta*", destination: "/operativo/capacitacion/:ruta*", permanent: false },
      { source: "/participantes", destination: "/operativo/capacitaciones/participantes", permanent: false },
      { source: "/capacitadores", destination: "/personal", permanent: false },
      { source: "/operativo/pre-capacitacion", destination: "/operativo/capacitaciones", permanent: false },
      { source: "/operativo/pre-capacitacion/:ruta*", destination: "/operativo/capacitaciones/:ruta*", permanent: false },
      { source: "/sedes", destination: "/soporte/logistica/sedes", permanent: false },
      { source: "/soporte/usuarios", destination: "/personal", permanent: false },
      { source: "/usuarios", destination: "/personal", permanent: false },
      { source: "/soporte/recursos-humanos", destination: "/personal", permanent: false },
    ];
  },
};

export default nextConfig;

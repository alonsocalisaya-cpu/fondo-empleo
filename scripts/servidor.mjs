// Arranca Next.js en el puerto 4000 para toda la red y muestra el link real para compartir.
// Uso: npm run dev   (desarrollo)   ·   npm start   (producción, tras npm run build)
import { spawn } from "node:child_process";
import { imprimirResumen, prepararRed, PUERTO } from "./red.mjs";

const modo = process.argv[2] === "start" ? "start" : "dev";
const red = prepararRed();

const next = spawn(`npx next ${modo} -H 0.0.0.0 -p ${PUERTO}`, {
  shell: true,
  stdio: ["inherit", "pipe", "pipe"],
  env: { ...process.env, FORCE_COLOR: "1" },
});

let listo = false;
next.stdout.on("data", (datos) => {
  let texto = String(datos);
  // Next muestra "0.0.0.0" (todas las redes); lo cambiamos por el link real
  if (red.link) texto = texto.replaceAll(`http://0.0.0.0:${PUERTO}`, red.link);
  process.stdout.write(texto);
  if (!listo && /Ready in/.test(texto)) {
    listo = true;
    imprimirResumen(red);
  }
});
next.stderr.on("data", (d) => process.stderr.write(d));
next.on("exit", (codigo) => process.exit(codigo ?? 0));
for (const senal of ["SIGINT", "SIGTERM"]) process.on(senal, () => next.kill(senal));

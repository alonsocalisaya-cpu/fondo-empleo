// Abre Drizzle Studio en el navegador para ver y editar las tablas. Uso: npm run db:ver
import { spawn, exec } from "node:child_process";

const URL = "https://local.drizzle.studio";
let abierto = false;
const abrir = () => {
  if (abierto) return;
  abierto = true;
  const cmd = process.platform === "win32" ? `start "" "${URL}"` : process.platform === "darwin" ? `open ${URL}` : `xdg-open ${URL}`;
  exec(cmd);
  console.log(`\nAbriendo ${URL} … (cierra con Ctrl + C)\n`);
};

const studio = spawn("npx", ["drizzle-kit", "studio"], { shell: true, stdio: ["inherit", "pipe", "inherit"] });
studio.stdout.on("data", (d) => {
  process.stdout.write(d);
  if (String(d).includes("local.drizzle.studio")) abrir();
});
setTimeout(abrir, 8000); // por si el mensaje cambia
studio.on("exit", (code) => process.exit(code ?? 0));

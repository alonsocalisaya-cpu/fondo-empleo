/** Bloque aún no definido: muestra qué podría incluir, para acordarlo con el equipo. */
export default function EnConstruccion({ ideas, titulo = "Este bloque está listo para definirse" }: { ideas: string[]; titulo?: string }) {
  return (
    <section className="card flex flex-col gap-4 border-dashed p-8">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-[#fef3c7] px-3 py-1 text-xs font-semibold text-[#92400e]">Por definir</span>
        <h2 className="text-lg font-semibold text-marino">{titulo}</h2>
      </div>
      <p className="max-w-2xl text-sm text-texto-2">
        El espacio ya está reservado en el menú. Estas son funciones habituales para este bloque; confirma cuáles necesitas
        (o agrega otras) y se construyen sobre la misma base de datos.
      </p>
      <ul className="grid max-w-3xl grid-cols-1 gap-2 sm:grid-cols-2">
        {ideas.map((i) => (
          <li key={i} className="flex items-start gap-2 rounded-lg bg-fondo px-3 py-2.5 text-sm">
            <span aria-hidden="true" className="mt-0.5 size-4 shrink-0 rounded border border-borde-fuerte bg-white" />
            {i}
          </li>
        ))}
      </ul>
    </section>
  );
}

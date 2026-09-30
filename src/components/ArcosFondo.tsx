/** Arcos del logo de Fondoempleo, muy tenues, como decoración del área de trabajo. */
export default function ArcosFondo() {
  // Segmentos del arco: el de arriba verde y los demás grises, como en el logo
  const segmentos = [
    { desde: -100, hasta: -40, color: "#28927c" },
    { desde: -134, hasta: -106, color: "#7d7c7c" },
    { desde: -160, hasta: -140, color: "#7d7c7c" },
    { desde: -180, hasta: -166, color: "#9a9a9a" },
    { desde: -196, hasta: -186, color: "#b0b0b0" },
    { desde: -208, hasta: -201, color: "#c4c4c4" },
  ];
  const cx = 300;
  const cy = 300;
  const arco = (r1: number, r2: number, a1: number, a2: number) => {
    const p = (r: number, a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
    const [x1, y1] = p(r2, a1);
    const [x2, y2] = p(r2, a2);
    const [x3, y3] = p(r1, a2);
    const [x4, y4] = p(r1, a1);
    const g = a2 - a1 > 180 ? 1 : 0;
    return `M${x1} ${y1} A${r2} ${r2} 0 ${g} 1 ${x2} ${y2} L${x3} ${y3} A${r1} ${r1} 0 ${g} 0 ${x4} ${y4}Z`;
  };
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden">
    <svg
      viewBox="0 0 600 600"
      className="absolute -right-40 -top-40 size-[420px] opacity-[0.12] sm:size-[620px]"
    >
      {segmentos.map((s) => (
        <path key={s.desde} d={arco(190, 270, s.desde, s.hasta)} fill={s.color} />
      ))}
    </svg>
    </div>
  );
}

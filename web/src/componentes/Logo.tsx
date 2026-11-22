/** Logotipo «tc | TelcoCore MVNO» con la estructura del de la UTS (verde lima y gris). */
export function Logo({ ancho = 150 }: { ancho?: number }) {
  return (
    <svg width={ancho} height={ancho * (56 / 210)} viewBox="0 0 210 56" role="img" aria-label="TelcoCore MVNO">
      <text x="0" y="46" fontFamily="Montserrat, Inter, sans-serif" fontWeight="800" fontSize="54" letterSpacing="-3" fill="#C7D309">tc</text>
      <rect x="66" y="4" width="2" height="48" fill="#808286" />
      <text x="78" y="26" fontFamily="Montserrat, Inter, sans-serif" fontWeight="500" fontSize="21" fill="#808286">TelcoCore</text>
      <text x="78" y="49" fontFamily="Montserrat, Inter, sans-serif" fontWeight="500" fontSize="21" fill="#808286">MVNO</text>
    </svg>
  );
}

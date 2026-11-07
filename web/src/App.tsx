import { useEffect, useState } from 'react';
import { CircleCheck, TriangleAlert, LoaderCircle } from 'lucide-react';
import './styles.css';

type Salud = { estado: string; servicio: string; hora: string };

function Logo() {
  return (
    <svg width="170" height="44" viewBox="0 0 210 56" role="img" aria-label="TelcoCore MVNO">
      <text x="0" y="46" fontFamily="Montserrat, Inter, sans-serif" fontWeight="800" fontSize="54" letterSpacing="-3" fill="#C7D309">tc</text>
      <rect x="66" y="4" width="2" height="48" fill="#808286" />
      <text x="78" y="26" fontFamily="Montserrat, Inter, sans-serif" fontWeight="500" fontSize="21" fill="#808286">TelcoCore</text>
      <text x="78" y="49" fontFamily="Montserrat, Inter, sans-serif" fontWeight="500" fontSize="21" fill="#808286">MVNO</text>
    </svg>
  );
}

export default function App() {
  const [salud, setSalud] = useState<Salud | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setSalud)
      .catch(() => setError(true));
  }, []);

  return (
    <>
      <header className="cabecera"><Logo /></header>
      <main className="contenido">
        <h1>Panel de operación</h1>
        <section className="tarjeta">
          {error ? (
            <p className="estado error"><TriangleAlert /> La API no responde</p>
          ) : salud ? (
            <>
              <p className="estado ok"><CircleCheck /> API operativa</p>
              <p className="detalle">{salud.servicio} · {new Date(salud.hora).toLocaleTimeString('es-CO')}</p>
            </>
          ) : (
            <p className="estado"><LoaderCircle className="girar" /> Conectando…</p>
          )}
        </section>
      </main>
    </>
  );
}

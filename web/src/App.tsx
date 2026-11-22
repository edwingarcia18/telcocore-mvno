import { BookOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import './styles.css';
import { api } from './api';
import { Logo } from './componentes/Logo';
import { Navegacion } from './componentes/Navegacion';
import { Pantalla, useRuta } from './lib/ruta';
import { Facturas } from './pantallas/Facturas';
import { Lotes } from './pantallas/Lotes';
import { Planes } from './pantallas/Planes';
import { Rechazos } from './pantallas/Rechazos';

const TITULOS: Record<Pantalla, string> = { lotes: 'Lotes', rechazos: 'Rechazos', facturas: 'Facturas', planes: 'Planes' };

/** Punto de color que indica si la API responde (se comprueba cada 15 segundos). */
function EstadoApi() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    let vigente = true;
    const probar = () => api.salud().then(() => vigente && setOk(true), () => vigente && setOk(false));
    probar();
    const temporizador = setInterval(probar, 15000);
    return () => {
      vigente = false;
      clearInterval(temporizador);
    };
  }, []);
  const texto = ok === null ? 'Comprobando…' : ok ? 'API operativa' : 'Sin conexión';
  return (
    <span className="estado-api" role="status" aria-label={`Estado de la API: ${texto}`}>
      <span className={`punto ${ok === null ? 'punto-neutro' : ok ? 'punto-ok' : 'punto-error'}`} aria-hidden="true" />
      <span className="estado-api-texto">{texto}</span>
    </span>
  );
}

export default function App() {
  const { pantalla, params } = useRuta();
  useEffect(() => {
    document.title = `${TITULOS[pantalla]} · TelcoCore MVNO`;
  }, [pantalla]);

  return (
    <div className="app">
      <a
        className="saltar"
        href="#contenido"
        onClick={(e) => {
          e.preventDefault(); // el hash lo usa el enrutador: no se puede dejar que cambie
          document.getElementById('contenido')?.focus();
        }}
      >
        Saltar al contenido
      </a>
      <header className="cabecera">
        <Logo ancho={140} />
        <div className="cabecera-acciones">
          <EstadoApi />
          <a className="docs" href="/api/docs/" target="_blank" rel="noopener noreferrer" aria-label="Documentación de la API (se abre en otra pestaña)">
            <BookOpen aria-hidden="true" />
            <span>Documentación de la API</span>
          </a>
        </div>
      </header>
      <Navegacion actual={pantalla} />
      <main id="contenido" className="contenido" tabIndex={-1}>
        {pantalla === 'lotes' && <Lotes />}
        {pantalla === 'rechazos' && <Rechazos params={params} />}
        {pantalla === 'facturas' && <Facturas params={params} />}
        {pantalla === 'planes' && <Planes />}
      </main>
    </div>
  );
}

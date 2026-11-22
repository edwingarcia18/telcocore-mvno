import { Layers, Receipt, TriangleAlert, Upload } from 'lucide-react';
import { enlace, Pantalla } from '../lib/ruta';

const ITEMS = [
  { pantalla: 'lotes', texto: 'Lotes', Icono: Upload },
  { pantalla: 'rechazos', texto: 'Rechazos', Icono: TriangleAlert },
  { pantalla: 'facturas', texto: 'Facturas', Icono: Receipt },
  { pantalla: 'planes', texto: 'Planes', Icono: Layers },
] as const;

export function Navegacion({ actual }: { actual: Pantalla }) {
  return (
    <nav className="nav" aria-label="Secciones del panel">
      {ITEMS.map(({ pantalla, texto, Icono }) => (
        <a key={pantalla} href={enlace(pantalla)} className="nav-enlace" aria-current={actual === pantalla ? 'page' : undefined}>
          <Icono aria-hidden="true" />
          <span>{texto}</span>
        </a>
      ))}
    </nav>
  );
}

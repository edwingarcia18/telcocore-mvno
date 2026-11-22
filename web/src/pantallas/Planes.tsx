import { CircleCheck, Layers, Plus, UserPlus } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { api, ApiError, comoApiError, Plan } from '../api';
import { Cargando, CajaError, Chip, Vacio } from '../componentes/Estados';
import { EJEMPLOS, ejemploJson, leerJson, msisdnValido, resumenPlan, TIPOS_CONOCIDOS } from '../lib/format';
import { useCarga } from '../lib/useCarga';

export function Planes() {
  const planes = useCarga(() => api.planes(), []);
  const suscriptores = useCarga(() => api.suscriptores(), []);
  return (
    <>
      <h1 className="titulo-pantalla">Planes y suscriptores</h1>
      <p className="subtitulo">Un plan nuevo se crea solo con datos, sin programar. Después se asigna a un suscriptor y ya se cobra con sus reglas.</p>

      <section aria-labelledby="t-catalogo">
        <h2 id="t-catalogo">Catálogo</h2>
        {planes.cargando && !planes.datos && <Cargando texto="Cargando planes…" />}
        {planes.error && <CajaError error={planes.error} />}
        {planes.datos && planes.datos.length === 0 && <Vacio icono={<Layers />} titulo="No hay planes">Crea el primero con el formulario de abajo.</Vacio>}
        {planes.datos && planes.datos.length > 0 && (
          <ul className="catalogo">
            {planes.datos.map((p) => (
              <li key={p.id} className="tarjeta plan">
                <div className="plan-cabecera"><strong>{p.nombre}</strong><Chip tono={p.activo ? 'ok' : 'neutro'}>{p.activo ? 'Activo' : 'Inactivo'}</Chip></div>
                <p className="meta">{p.tipoEstrategia}</p>
                <ul className="plan-resumen">{resumenPlan(p).map((l) => <li key={l}>{l}</li>)}</ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <FormularioPlan planes={planes.datos ?? []} alCrear={planes.recargar} />
      <FormularioSuscriptor planes={planes.datos ?? []} alGuardar={suscriptores.recargar} />

      <section aria-labelledby="t-susc">
        <h2 id="t-susc">Suscriptores</h2>
        {suscriptores.cargando && !suscriptores.datos && <Cargando texto="Cargando suscriptores…" />}
        {suscriptores.error && <CajaError error={suscriptores.error} />}
        {suscriptores.datos && suscriptores.datos.length === 0 && <Vacio icono={<UserPlus />} titulo="Aún no hay suscriptores">Agrega el primero con el formulario de arriba.</Vacio>}
        {suscriptores.datos && suscriptores.datos.length > 0 && (
          <div className="tabla-envoltura tarjeta">
            <table className="tabla-simple">
              <thead><tr><th scope="col">Número</th><th scope="col">Nombre</th><th scope="col">Plan</th></tr></thead>
              <tbody>{suscriptores.datos.map((s) => <tr key={s.msisdn}><td>{s.msisdn}</td><td>{s.nombre}</td><td>{s.plan}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

type Resultado = { tipo: 'ocioso' } | { tipo: 'enviando' } | { tipo: 'ok'; texto: string } | { tipo: 'error'; error: ApiError } | { tipo: 'local'; texto: string };

function Mensaje({ r }: { r: Resultado }) {
  return (
    <div aria-live="polite">
      {r.tipo === 'ok' && <p className="mensaje-ok"><CircleCheck aria-hidden="true" /> {r.texto}</p>}
      {r.tipo === 'local' && <p className="error-campo" role="alert">{r.texto}</p>}
      {r.tipo === 'error' && <CajaError error={r.error} />}
    </div>
  );
}

function FormularioPlan({ planes, alCrear }: { planes: Plan[]; alCrear: () => void }) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('POSTPAGO_MIX');
  const [json, setJson] = useState(ejemploJson('POSTPAGO_MIX'));
  const [resultado, setResultado] = useState<Resultado>({ tipo: 'ocioso' });
  const tipos = Array.from(new Set([...TIPOS_CONOCIDOS, ...planes.map((p) => p.tipoEstrategia)]));

  function cambiarTipo(nuevo: string) {
    setTipo(nuevo);
    if (nuevo in EJEMPLOS) setJson(ejemploJson(nuevo));
  }
  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !tipo.trim()) return setResultado({ tipo: 'local', texto: 'Escribe el nombre del plan y elige su tipo.' });
    const parametros = leerJson(json);
    if (!parametros.ok) return setResultado({ tipo: 'local', texto: parametros.mensaje });
    setResultado({ tipo: 'enviando' });
    try {
      const creado = await api.crearPlan({ nombre: nombre.trim(), tipoEstrategia: tipo.trim(), parametros: parametros.valor });
      setResultado({ tipo: 'ok', texto: `Plan «${creado.nombre}» creado. Ya puedes asignarlo a un suscriptor.` });
      setNombre('');
      alCrear();
    } catch (err) {
      setResultado({ tipo: 'error', error: comoApiError(err) });
    }
  }

  return (
    <form className="tarjeta" onSubmit={enviar} aria-labelledby="t-crear">
      <h2 id="t-crear"><Plus aria-hidden="true" /> Crear un plan</h2>
      <div className="campo">
        <label htmlFor="plan-nombre">Nombre</label>
        <input id="plan-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} placeholder="Ejemplo: Plan-Roaming" autoComplete="off" />
      </div>
      <div className="campo">
        <label htmlFor="plan-tipo">Tipo de plan (estrategia de cobro)</label>
        <input id="plan-tipo" list="tipos-plan" value={tipo} onChange={(e) => cambiarTipo(e.target.value)} autoComplete="off" />
        <datalist id="tipos-plan">{tipos.map((t) => <option key={t} value={t} />)}</datalist>
        <p className="ayuda-campo">Un tipo nuevo (por ejemplo ROAMING) solo funciona si su archivo *.strategy.ts está en el servidor.</p>
      </div>
      <div className="campo">
        <label htmlFor="plan-parametros">Parámetros (JSON)</label>
        <textarea id="plan-parametros" rows={9} value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
        {tipo in EJEMPLOS && <button type="button" className="boton-secundario boton-chico" onClick={() => setJson(ejemploJson(tipo))}>Restablecer el ejemplo</button>}
      </div>
      <button type="submit" className="boton" disabled={resultado.tipo === 'enviando'}>{resultado.tipo === 'enviando' ? 'Creando…' : 'Crear plan'}</button>
      <Mensaje r={resultado} />
    </form>
  );
}

function FormularioSuscriptor({ planes, alGuardar }: { planes: Plan[]; alGuardar: () => void }) {
  const [msisdn, setMsisdn] = useState('');
  const [nombre, setNombre] = useState('');
  const [plan, setPlan] = useState('');
  const [resultado, setResultado] = useState<Resultado>({ tipo: 'ocioso' });
  const elegido = plan || planes[0]?.nombre || '';

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!msisdnValido(msisdn)) return setResultado({ tipo: 'local', texto: 'El número debe tener exactamente 10 dígitos.' });
    if (!nombre.trim() || !elegido) return setResultado({ tipo: 'local', texto: 'Escribe el nombre y elige un plan.' });
    setResultado({ tipo: 'enviando' });
    try {
      const s = await api.asignarPlan(msisdn.trim(), nombre.trim(), elegido);
      setResultado({ tipo: 'ok', texto: `${s.msisdn} quedó con el plan ${s.plan}.` });
      alGuardar();
    } catch (err) {
      setResultado({ tipo: 'error', error: comoApiError(err) });
    }
  }

  return (
    <form className="tarjeta" onSubmit={enviar} aria-labelledby="t-asignar">
      <h2 id="t-asignar"><UserPlus aria-hidden="true" /> Asignar un plan a un suscriptor</h2>
      <p className="ayuda-campo">Si el número no existe se crea; si ya existe, cambia de plan.</p>
      <div className="campo">
        <label htmlFor="s-msisdn">Número de línea</label>
        <input id="s-msisdn" value={msisdn} onChange={(e) => setMsisdn(e.target.value)} inputMode="numeric" maxLength={10} placeholder="3008000008" autoComplete="off" />
      </div>
      <div className="campo">
        <label htmlFor="s-nombre">Nombre</label>
        <input id="s-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} autoComplete="off" />
      </div>
      <div className="campo">
        <label htmlFor="s-plan">Plan</label>
        <select id="s-plan" value={elegido} onChange={(e) => setPlan(e.target.value)}>
          {planes.map((p) => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
        </select>
      </div>
      <button type="submit" className="boton" disabled={resultado.tipo === 'enviando' || planes.length === 0}>{resultado.tipo === 'enviando' ? 'Guardando…' : 'Guardar suscriptor'}</button>
      <Mensaje r={resultado} />
    </form>
  );
}

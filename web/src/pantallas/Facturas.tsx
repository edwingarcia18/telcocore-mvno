import { Receipt, Users } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError, comoApiError, Factura } from '../api';
import { Cargando, CajaError, Chip, Vacio } from '../componentes/Estados';
import { cantidad, mes, nombreMes, peso, unidad } from '../lib/format';
import { enlace } from '../lib/ruta';
import { useCarga } from '../lib/useCarga';

type Consulta = { tipo: 'ocioso' } | { tipo: 'cargando' } | { tipo: 'ok'; factura: Factura } | { tipo: 'error'; error: ApiError };

export function Facturas({ params }: { params: URLSearchParams }) {
  const suscriptores = useCarga(() => api.suscriptores(), []);
  const [msisdn, setMsisdn] = useState(params.get('suscriptor') ?? '');
  const [periodo, setPeriodo] = useState(params.get('mes') ?? mes(-1));
  const [consulta, setConsulta] = useState<Consulta>({ tipo: 'ocioso' });

  useEffect(() => {
    if (!msisdn && suscriptores.datos && suscriptores.datos.length > 0) setMsisdn(suscriptores.datos[0].msisdn);
  }, [suscriptores.datos, msisdn]);

  async function consultar(e: FormEvent) {
    e.preventDefault();
    setConsulta({ tipo: 'cargando' });
    try {
      setConsulta({ tipo: 'ok', factura: await api.factura(msisdn, periodo) });
    } catch (err) {
      setConsulta({ tipo: 'error', error: comoApiError(err) });
    }
  }

  return (
    <>
      <h1 className="titulo-pantalla">Factura mensual</h1>
      <p className="subtitulo">Cuota fija del plan más lo consumido en el mes. Si consultas la misma factura varias veces, siempre es la misma.</p>

      {suscriptores.cargando && !suscriptores.datos && <Cargando texto="Cargando suscriptores…" />}
      {suscriptores.error && <CajaError error={suscriptores.error} />}
      {suscriptores.datos && suscriptores.datos.length === 0 && (
        <Vacio icono={<Users />} titulo="Todavía no hay suscriptores">Créalos en la pantalla <a href={enlace('planes')}>Planes</a>.</Vacio>
      )}

      {suscriptores.datos && suscriptores.datos.length > 0 && (
        <form className="tarjeta" onSubmit={consultar}>
          <div className="campo">
            <label htmlFor="suscriptor">Suscriptor</label>
            <select id="suscriptor" value={msisdn} onChange={(e) => setMsisdn(e.target.value)}>
              {suscriptores.datos.map((s) => (
                <option key={s.msisdn} value={s.msisdn}>{s.msisdn} · {s.nombre} ({s.plan})</option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="mes">Mes a facturar</label>
            <input id="mes" type="month" value={periodo} max={mes(0)} pattern="\d{4}-\d{2}" placeholder="AAAA-MM" onChange={(e) => setPeriodo(e.target.value)} required />
            <div className="atajos">
              <button type="button" className="boton-secundario boton-chico" onClick={() => setPeriodo(mes(0))}>Este mes</button>
              <button type="button" className="boton-secundario boton-chico" onClick={() => setPeriodo(mes(-1))}>Mes anterior</button>
            </div>
          </div>
          <button type="submit" className="boton" disabled={consulta.tipo === 'cargando' || !msisdn || !periodo}>
            {consulta.tipo === 'cargando' ? 'Consultando…' : 'Consultar factura'}
          </button>
        </form>
      )}

      <div aria-live="polite">
        {consulta.tipo === 'error' && <CajaError error={consulta.error} />}
        {consulta.tipo === 'ok' && <TarjetaFactura factura={consulta.factura} />}
      </div>
    </>
  );
}

function TarjetaFactura({ factura: f }: { factura: Factura }) {
  const cuota = Number(f.cuotaFija);
  const sinConsumo = f.lineas.length === 0;
  return (
    <article className="tarjeta factura">
      <header className="factura-cabecera">
        <div>
          <p className="sobre">Factura de {nombreMes(f.periodo)}</p>
          <h2><Receipt aria-hidden="true" /> {f.suscriptor}</h2>
        </div>
        <Chip>{f.plan}</Chip>
      </header>
      <div className="tabla-envoltura">
        <table className="lineas">
          <caption className="solo-lectores">Detalle de la factura de {f.suscriptor}</caption>
          <thead>
            <tr><th scope="col">Concepto</th><th scope="col">Cantidad</th><th scope="col">Monto</th></tr>
          </thead>
          <tbody>
            {cuota > 0 && (
              <tr className="fila-cuota"><td>Cuota fija mensual</td><td>1 mes</td><td>{peso(cuota)}</td></tr>
            )}
            {f.lineas.map((l) => (
              <tr key={`${l.concepto}-${l.unidad}`}>
                <td>{l.concepto}</td>
                <td>{cantidad(l.cantidad)} {unidad(l.unidad)}</td>
                <td>{Number(l.monto) === 0 ? <span className="incluido">incluido</span> : peso(l.monto)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><th scope="row" colSpan={2}>Total a pagar</th><td className="total">{peso(f.total)}</td></tr>
          </tfoot>
        </table>
      </div>
      {sinConsumo && <p className="nota">No hay consumo registrado en este mes{cuota > 0 ? ': solo se cobra la cuota fija.' : '.'}</p>}
      <p className="nota">Cuota fija {peso(f.cuotaFija)} + consumo {peso(f.totalVariable)} · pesos colombianos, sin IVA.</p>
    </article>
  );
}

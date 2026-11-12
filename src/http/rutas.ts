import { Router } from 'express';
import multer from 'multer';
import { LoteNoEncontrado } from '../domain/errores';
import { Dependencias } from './dependencias';
import { facturaDto, loteDto, planDto, rechazoDto, suscriptorDto } from './dto';
import { SolicitudInvalida } from './errores';
import { consultaFactura, consultaRechazos, cuerpoPlan, cuerpoSuscriptor, parametrosSuscriptor, validar } from './validacion';

const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10 MB: sobra para los 10.000 registros permitidos por lote

export function crearRutas({ ingesta, facturacion, suscriptores, uow, registro }: Dependencias): Router {
  const router = Router();
  const subida = multer({ storage: multer.memoryStorage(), limits: { fileSize: TAMANO_MAXIMO, files: 1 } });

  // Carga de un lote de CDR (CSV o JSON)
  router.post('/lotes/cdr', subida.single('archivo'), async (req, res) => {
    if (!req.file) {
      throw new SolicitudInvalida('Falta el archivo: envíelo como multipart/form-data en el campo "archivo"', undefined, 'ARCHIVO_FALTANTE');
    }
    const resultado = await ingesta.ingestar({ nombre: req.file.originalname, contenido: req.file.buffer });
    res.status(201).json(resultado);
  });

  router.get('/lotes', async (_req, res) => {
    res.json((await uow.repos.lotes.listar(50)).map(loteDto));
  });

  // Cuarentena: filas rechazadas de un lote
  router.get('/rechazos', async (req, res) => {
    const { lote: loteId, page, size } = validar(consultaRechazos, req.query);
    const lote = await uow.repos.lotes.buscarPorId(loteId);
    if (!lote) throw new LoteNoEncontrado(loteId);
    const { total, items } = await uow.repos.rechazos.listarPorLote(loteId, page, size);
    res.json({ lote: loteDto(lote), total, page, size, items: items.map(rechazoDto) });
  });

  // Factura mensual de un suscriptor
  router.get('/facturas', async (req, res) => {
    const { suscriptor, mes } = validar(consultaFactura, req.query);
    res.json(facturaDto(await facturacion.generar(suscriptor, mes)));
  });

  // Catálogo de planes
  router.get('/planes', async (_req, res) => {
    res.json((await uow.repos.planes.listar()).map(planDto));
  });

  router.post('/planes', async (req, res) => {
    const { nombre, tipoEstrategia, parametros } = validar(cuerpoPlan, req.body);
    registro.crear(tipoEstrategia, parametros, nombre); // valida tipo y parámetros ANTES de guardar
    res.status(201).json(planDto(await uow.repos.planes.crear({ nombre, tipoEstrategia, parametros })));
  });

  // Suscriptores
  router.get('/suscriptores', async (_req, res) => {
    res.json((await suscriptores.listar()).map(suscriptorDto));
  });

  router.put('/suscriptores/:msisdn', async (req, res) => {
    const { msisdn } = validar(parametrosSuscriptor, req.params);
    const { nombre, plan } = validar(cuerpoSuscriptor, req.body);
    res.json(suscriptorDto(await suscriptores.asignar(msisdn, nombre, plan)));
  });

  return router;
}

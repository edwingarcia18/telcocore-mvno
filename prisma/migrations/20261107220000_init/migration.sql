-- CreateEnum
CREATE TYPE "TipoServicio" AS ENUM ('VOZ', 'SMS', 'DATOS');

-- CreateEnum
CREATE TYPE "EstadoLote" AS ENUM ('PROCESADO', 'PROCESADO_CON_RECHAZOS', 'FALLIDO');

-- CreateEnum
CREATE TYPE "CausaRechazo" AS ENUM ('CDR_INVALIDO', 'PLAN_NO_EXISTE', 'TARIFA_NO_APLICABLE');

-- CreateTable
CREATE TABLE "Plan" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoEstrategia" TEXT NOT NULL,
    "parametros" JSONB NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suscriptor" (
    "id" SERIAL NOT NULL,
    "msisdn" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "planId" INTEGER NOT NULL,

    CONSTRAINT "Suscriptor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lote" (
    "id" SERIAL NOT NULL,
    "hashSha256" TEXT NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "formato" TEXT NOT NULL,
    "estado" "EstadoLote" NOT NULL,
    "total" INTEGER NOT NULL,
    "aceptados" INTEGER NOT NULL,
    "rechazados" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cdr" (
    "id" BIGSERIAL NOT NULL,
    "idExterno" TEXT NOT NULL,
    "tipo" "TipoServicio" NOT NULL,
    "suscriptorId" INTEGER NOT NULL,
    "loteId" INTEGER NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "periodo" TEXT NOT NULL,
    "duracionSeg" INTEGER,
    "cantidadSms" INTEGER,
    "bytes" BIGINT,

    CONSTRAINT "Cdr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineaFactura" (
    "id" BIGSERIAL NOT NULL,
    "cdrId" BIGINT NOT NULL,
    "concepto" TEXT NOT NULL,
    "cantidad" DECIMAL(38,20) NOT NULL,
    "unidad" TEXT NOT NULL,
    "monto" DECIMAL(14,0) NOT NULL,

    CONSTRAINT "LineaFactura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumoAcumulado" (
    "suscriptorId" INTEGER NOT NULL,
    "periodo" TEXT NOT NULL,
    "servicio" "TipoServicio" NOT NULL,
    "cantidad" DECIMAL(38,20) NOT NULL,

    CONSTRAINT "ConsumoAcumulado_pkey" PRIMARY KEY ("suscriptorId","periodo","servicio")
);

-- CreateTable
CREATE TABLE "FacturaMensual" (
    "id" SERIAL NOT NULL,
    "suscriptorId" INTEGER NOT NULL,
    "periodo" TEXT NOT NULL,
    "cuotaFija" DECIMAL(14,0) NOT NULL,
    "totalVariable" DECIMAL(14,0) NOT NULL,
    "total" DECIMAL(14,0) NOT NULL,
    "generadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacturaMensual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rechazo" (
    "id" SERIAL NOT NULL,
    "loteId" INTEGER NOT NULL,
    "numeroFila" INTEGER NOT NULL,
    "idExterno" TEXT,
    "causa" "CausaRechazo" NOT NULL,
    "detalle" TEXT NOT NULL,
    "crudo" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rechazo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_nombre_key" ON "Plan"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Suscriptor_msisdn_key" ON "Suscriptor"("msisdn");

-- CreateIndex
CREATE UNIQUE INDEX "Lote_hashSha256_key" ON "Lote"("hashSha256");

-- CreateIndex
CREATE UNIQUE INDEX "Cdr_idExterno_key" ON "Cdr"("idExterno");

-- CreateIndex
CREATE INDEX "Cdr_suscriptorId_periodo_tipo_idx" ON "Cdr"("suscriptorId", "periodo", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "FacturaMensual_suscriptorId_periodo_key" ON "FacturaMensual"("suscriptorId", "periodo");

-- AddForeignKey
ALTER TABLE "Suscriptor" ADD CONSTRAINT "Suscriptor_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cdr" ADD CONSTRAINT "Cdr_suscriptorId_fkey" FOREIGN KEY ("suscriptorId") REFERENCES "Suscriptor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cdr" ADD CONSTRAINT "Cdr_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaFactura" ADD CONSTRAINT "LineaFactura_cdrId_fkey" FOREIGN KEY ("cdrId") REFERENCES "Cdr"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumoAcumulado" ADD CONSTRAINT "ConsumoAcumulado_suscriptorId_fkey" FOREIGN KEY ("suscriptorId") REFERENCES "Suscriptor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaMensual" ADD CONSTRAINT "FacturaMensual_suscriptorId_fkey" FOREIGN KEY ("suscriptorId") REFERENCES "Suscriptor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rechazo" ADD CONSTRAINT "Rechazo_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restricción manual (Prisma no modela CHECK): cada CDR solo puede traer los campos de su tipo.
-- Se exige IS NOT NULL de forma explícita: en SQL, "NULL > 0" no es falso sino desconocido,
-- y un CHECK solo rechaza la fila cuando la condición es FALSA.
ALTER TABLE "Cdr" ADD CONSTRAINT "cdr_campos_por_tipo" CHECK (
  ("tipo" = 'VOZ'   AND "duracionSeg" IS NOT NULL AND "duracionSeg" > 0 AND "cantidadSms" IS NULL AND "bytes" IS NULL) OR
  ("tipo" = 'SMS'   AND "cantidadSms" IS NOT NULL AND "cantidadSms" > 0 AND "duracionSeg" IS NULL AND "bytes" IS NULL) OR
  ("tipo" = 'DATOS' AND "bytes" IS NOT NULL AND "bytes" > 0 AND "duracionSeg" IS NULL AND "cantidadSms" IS NULL)
);

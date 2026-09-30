/**
 * El catálogo de proveedores, que es la misma fuente que usan los portales.
 *
 * Lo que se fija aquí es el contrato compartido: la regla de resolución y las
 * cifras del caso validado. Si una cambia sin que cambie el otro lado, la Parte
 * 1 y la Parte 2 del taller describen mercados distintos.
 *
 *     npm test -- suppliers
 */

import { describe, expect, it } from "vitest";

import {
  quoteFor,
  readSupplierCatalog,
  resolveProduct,
  supplierByName,
} from "../../src/domain/suppliers.js";

const CATALOG = readSupplierCatalog();

function supplier(name: string) {
  const found = supplierByName(CATALOG, name);
  if (found === null) throw new Error(`'${name}' no está en el catálogo`);
  return found;
}

describe("la regla de resolución", () => {
  // El catálogo trae sus propios casos porque la regla la implementan dos
  // programas: este y `catalogo.js` de los portales. Comprobarla contra el
  // vector del contrato es lo que impide que se separen en silencio.
  it.each(CATALOG.casosDeResolucion.map((c) => [c.texto, c.esperado] as const))(
    "«%s» resuelve a %s",
    (texto, esperado) => {
      expect(resolveProduct(CATALOG, texto)?.id ?? null).toBe(esperado);
    },
  );

  it("gana el sinónimo más largo cuando coinciden varios", () => {
    // «monitor» y «monitor de 24» coinciden los dos; el específico manda.
    expect(resolveProduct(CATALOG, "monitor de 24 pulgadas")?.id).toBe("monitor-24");
  });
});

describe("las cifras del caso validado", () => {
  it.each([
    ["Tecnoimport", 168, 6805],
    ["GlobalStock", 149, 5960],
    ["Suministros Delta", 164, 6620],
    ["MayoristaZeta", 159, 6360],
  ])("%s cotiza 40 monitores a %d y totaliza %d", (name, unit, total) => {
    const response = quoteFor(CATALOG, supplier(name), 'Monitor 24" Full HD', 40);

    expect(response.kind).toBe("quoted");
    if (response.kind !== "quoted") return;
    expect(response.unitUsd).toBe(unit);
    expect(response.totalUsd).toBeCloseTo(total, 2);
  });
});

describe("una ausencia es un resultado", () => {
  it("un proveedor que identifica el producto y no lo maneja lo dice", () => {
    const response = quoteFor(CATALOG, supplier("Tecnoimport"), "sillas ergonomicas", 10);

    expect(response.kind).toBe("not-carried");
    if (response.kind !== "not-carried") return;
    expect(response.product.id).toBe("silla-ergonomica");
  });

  it("un producto fuera del catálogo no se identifica", () => {
    expect(quoteFor(CATALOG, supplier("GlobalStock"), "camiones Hino", 5).kind).toBe(
      "unrecognized",
    );
  });

  it("ImportAndina no cotiza, y eso no depende del producto", () => {
    for (const texto of ['Monitor 24" Full HD', "sillas", "camiones"]) {
      expect(quoteFor(CATALOG, supplier("ImportAndina"), texto, 40).kind).toBe("no-quotes");
    }
  });

  it("MayoristaZeta se limita a monitores, porque su respuesta es un PDF fijo", () => {
    expect(quoteFor(CATALOG, supplier("MayoristaZeta"), "teclados", 20).kind).toBe("not-carried");
  });
});

describe("cada proveedor cobra su propio precio", () => {
  it("la misma estación de acople cuesta distinto en cada uno", () => {
    const tecno = quoteFor(CATALOG, supplier("Tecnoimport"), "docking station", 10);
    const global = quoteFor(CATALOG, supplier("GlobalStock"), "docking station", 10);

    expect(tecno.kind === "quoted" && tecno.unitUsd).toBe(210);
    expect(global.kind === "quoted" && global.unitUsd).toBe(195);
  });

  it("solo Suministros Delta ofrece garantía extendida, y solo en monitores", () => {
    const monitor = quoteFor(CATALOG, supplier("Suministros Delta"), "monitores", 40);
    const silla = quoteFor(CATALOG, supplier("Suministros Delta"), "sillas", 40);

    expect(monitor.kind === "quoted" && monitor.extendedWarrantyUsd).toBe(179);
    expect(silla.kind === "quoted" && silla.extendedWarrantyUsd).toBeNull();
  });
});

describe("MayoristaZeta despacha cajas completas", () => {
  it("noventa y cinco unidades se facturan como diez cajas", () => {
    const response = quoteFor(CATALOG, supplier("MayoristaZeta"), "monitores", 95);

    expect(response.kind).toBe("quoted");
    if (response.kind !== "quoted") return;
    expect(response.boxes).toBe(10);
    expect(response.totalUsd).toBeCloseTo(15900, 2);
  });
});

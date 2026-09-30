/**
 * Rastreo de una cita hasta su fuente.
 *
 * Lo usan dos verificaciones: la que comprueba que la evidencia de una
 * cotización venga del texto que devolvió la herramienta, y la que comprueba
 * que lo extraído de una petición esté de verdad en la petición.
 *
 * Las dos responden la misma pregunta —¿esto salió de ahí o se inventó?— y por
 * eso comparten cómo se compara.
 */

/**
 * Reduce un texto a su contenido, descartando toda la forma.
 *
 * Deliberadamente agresivo. Cada forma de citar que el modelo inventa
 * —entrecomillar fragmentos, escapar saltos de línea al copiar una tabla—
 * produciría un hallazgo sobre una cita legítima, y una verificación que salta
 * sobre salida correcta enseña a ignorarla.
 */
export function normalize(text: string): string {
  return (
    text
      .replace(/\\[nrt]/g, " ")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      // Los separadores entre dígitos son formato: unen la cifra en vez de
      // partirla. Sin esto «1.590,00» daría «1 590 00» y «1590,00» daría
      // «1590 00», que es la misma cifra escrita de dos maneras.
      .replace(/(\d)[.,  '](?=\d)/g, "$1")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
  );
}

/**
 * Longitud mínima para que un fragmento sea evidencia y no coincidencia.
 *
 * Un trozo de seis caracteres aparece en cualquier texto por casualidad, y una
 * verificación que se satisface con eso no verifica nada.
 */
const MIN_FRAGMENT_LENGTH = 14;

/**
 * Parte la cita en los tramos que hay que encontrar en la fuente.
 *
 * El modelo suele entrecomillar dos o tres trozos de líneas distintas y
 * unirlos. Se separa antes de normalizar, porque los caracteres que marcan el
 * corte son los que la normalización descarta.
 */
export function fragments(quotation: string): string[] {
  const pieces = quotation
    .split(/["'`“”‘’]|\s*[/|]\s*|\.{3,}|…|\n|\\n/)
    .map(normalize)
    .filter((piece) => piece.length >= MIN_FRAGMENT_LENGTH);

  return pieces.length > 0 ? pieces : [normalize(quotation)];
}

/** Los tramos de la cita que no aparecen en la fuente. Vacío si todo se rastrea. */
export function untraceable(quotation: string, source: string): string[] {
  const normalized = normalize(source);
  return fragments(quotation).filter((fragment) => !normalized.includes(fragment));
}

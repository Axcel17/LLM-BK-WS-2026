import type { NextConfig } from "next";

/**
 * El panel no importa código del taller: habla MCP con su servidor, lee sus
 * archivos y ejecuta sus comandos. Por eso no hace falta `externalDir` ni
 * alias fuera de la raíz — la frontera se sostiene sola.
 */
const nextConfig: NextConfig = {};

export default nextConfig;

import { CaseBank } from "@/components/case-bank";
import { readCases } from "@/lib/workshop";

export const dynamic = "force-dynamic";

export default async function Evaluacion() {
  // El banco lo declara el taller, en `src/domain/cases.ts`. El panel lo pide;
  // no guarda una copia que pudiera quedar diciendo otra cosa.
  return <CaseBank cases={await readCases()} />;
}

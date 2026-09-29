"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ClipboardCheck, MessagesSquare } from "lucide-react";

import { cn } from "@/lib/utils";

const SECCIONES = [
  { href: "/chat", nombre: "Conversación", icono: MessagesSquare },
  { href: "/evaluacion", nombre: "Evaluación", icono: ClipboardCheck },
  { href: "/monitoreo", nombre: "Monitoreo", icono: Activity },
] as const;

export function Navegacion() {
  const ruta = usePathname();

  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-20 border-b backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
        <Link href="/chat" className="flex items-center gap-2.5 shrink-0">
          <span
            aria-hidden
            className="bg-foreground text-background grid size-6 place-items-center rounded-[7px] text-[11px] font-semibold"
          >
            A
          </span>
          <span className="text-sm font-semibold tracking-tight">Abastecimiento</span>
        </Link>

        <nav className="flex items-center gap-1">
          {SECCIONES.map(({ href, nombre, icono: Icono }) => {
            const activa = ruta === href || ruta.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={activa ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                  activa
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                <Icono className="size-4" aria-hidden />
                {nombre}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

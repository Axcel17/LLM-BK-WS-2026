"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ClipboardCheck, MessagesSquare, Scale } from "lucide-react";

import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/chat", name: "Conversación", Icon: MessagesSquare },
  // Dos evaluaciones distintas, y separarlas es el punto: una pregunta si el
  // agente sigue resolviendo lo que resolvía, la otra si el evaluador sigue
  // coincidiendo con las etiquetas. Bajo un solo nombre se confundían.
  { href: "/evaluacion", name: "Casos probados", Icon: ClipboardCheck },
  { href: "/evaluador", name: "Evaluador", Icon: Scale },
  { href: "/monitoreo", name: "Historial", Icon: Activity },
] as const;

export function Navigation() {
  const path = usePathname();

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
          {SECTIONS.map(({ href, name, Icon: Icono }) => {
            const active = path === href || path.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                <Icono className="size-4" aria-hidden />
                {name}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

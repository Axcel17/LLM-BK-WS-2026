import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Navegacion } from "@/components/navegacion";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Consola de abastecimiento",
  description:
    "Conversación, evaluación y monitoreo del agente de abastecimiento del taller Innova-T Latam 2026.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <Navegacion />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
      </body>
    </html>
  );
}

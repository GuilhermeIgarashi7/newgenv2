import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "NewGenST — Gestão Inteligente de Estoque",
  description:
    "NewGenST — Software de controle de estoque organizado pelos códigos de barras individuais de cada item.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[#120d1d] text-[#f6f3ff] antialiased">
        {children}
      </body>
    </html>
  );
}

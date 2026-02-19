import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "QA Debug UI",
  description: "URL Targets, entrada de escenarios IA y flujo de specs Playwright",
};

const navLinks = [
  { href: "/", label: "Inicio" },
  { href: "/targets", label: "URL Targets" },
  { href: "/ai", label: "IA" },
  { href: "/specs", label: "Configuraciones" },
  { href: "/tests-viewers", label: "Visor de Tests" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <div className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-sm font-semibold tracking-wide text-slate-900">
              QA Debug UI
            </Link>
            <nav className="flex flex-wrap items-center justify-end gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full border border-transparent px-3 py-1.5 text-sm text-slate-700 transition hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}

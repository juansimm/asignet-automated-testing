import type { Metadata } from "next";
import Image from "next/image";
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
      <body className="min-h-screen bg-background text-foreground">
        <div className="sticky top-0 z-30 border-b border-[#bfd8eb]/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,250,255,0.92))] shadow-[0_12px_28px_-22px_rgba(6,69,110,0.85)] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-3.5">
            <Link href="/" className="inline-flex items-center">
              <Image
                src="/wayfastlogo.png"
                alt="Wayfast"
                width={220}
                height={48}
                priority
                className="h-11 w-auto object-contain md:h-12"
              />
              <span className="sr-only">QA Debug UI</span>
            </Link>
            <nav className="flex flex-wrap items-center justify-end gap-2.5">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full border border-transparent bg-white/80 px-4 py-2 text-[0.95rem] font-medium text-[#1f4c6d] shadow-[0_4px_18px_-16px_rgba(4,56,91,0.9)] transition hover:-translate-y-0.5 hover:border-[#9dc3de] hover:bg-[#e8f4fc] hover:text-[#072d4c]"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
        <main className="mx-auto w-full max-w-7xl px-5 py-8 md:py-10">{children}</main>
      </body>
    </html>
  );
}

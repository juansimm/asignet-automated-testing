import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "QA Debug UI",
  description: "Targets, AI scenario input, and Playwright specs workflow",
};

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/targets", label: "Targets" },
  { href: "/ai", label: "AI" },
  { href: "/specs", label: "Specs" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-sm font-semibold tracking-wide text-slate-900">
              QA Debug UI
            </Link>
            <nav className="flex items-center gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900"
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

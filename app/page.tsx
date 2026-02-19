import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const pages = [
  {
    href: "/targets",
    title: "URL Targets",
    kicker: "Base de entornos",
    description: "Creá y administrá base URLs de referencia para QA y contexto de agentes.",
    action: "Abrir URL Targets",
    tag: "Datos Base",
  },
  {
    href: "/ai",
    title: "IA",
    kicker: "Escenarios guiados",
    description: "Ingerí logs sin depender de DBO y generá solicitudes de agentes orientadas a escenarios.",
    action: "Abrir IA",
    tag: "Generación",
  },
  {
    href: "/specs",
    title: "Configuraciones",
    kicker: "Flujo de agentes",
    description: "Visualizá Configuraciones generadas y tests actuales para el flujo planner/generator/healer.",
    action: "Abrir Configuraciones",
    tag: "Operación",
  },
  {
    href: "/tests-viewers",
    title: "Visor de Tests",
    kicker: "Trazabilidad",
    description:
      "Inspeccioná las últimas corridas con salida por test, estado, respuestas y capturas.",
    action: "Abrir Visor de Tests",
    tag: "Debug",
  },
];

export default function Home() {
  return (
    <div className="space-y-6 md:space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-[#bfd8eb] bg-[linear-gradient(132deg,#ffffff_0%,#f4faff_40%,#ecf6ff_100%)] p-7 shadow-[0_24px_50px_-34px_rgba(3,63,103,0.85)] md:p-9">
        <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(20,171,211,0.3)_0%,rgba(20,171,211,0)_70%)]" />
        <div className="pointer-events-none absolute -left-14 -bottom-20 h-60 w-60 rounded-full bg-[radial-gradient(circle,rgba(11,127,177,0.2)_0%,rgba(11,127,177,0)_70%)]" />
        <p className="text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-[#346382]">
          QA Workspace
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight text-[#07263f] md:text-4xl">
          QA Debug UI
        </h1>
        <p className="mt-3 max-w-3xl text-[1.02rem] text-[#315674] md:text-[1.08rem]">
          Espacio de trabajo para URL Targets, preparación de escenarios con IA y specs.
        </p>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        {pages.map((page) => (
          <Card key={page.href} className="group overflow-hidden">
            <CardHeader>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#3f6786]">
                {page.kicker}
              </p>
              <CardTitle className="text-[1.35rem]">{page.title}</CardTitle>
              <CardDescription>{page.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <Link
                href={page.href}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[#0b4f7f] px-5 text-[0.95rem] font-semibold text-white shadow-[0_10px_24px_-16px_rgba(4,58,92,1)] transition-all hover:-translate-y-0.5 hover:bg-[#0d639e]"
              >
                {page.action}
              </Link>
              <span className="rounded-full border border-[#b9d3e8] bg-[#eff7fd] px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[#31597a]">
                {page.tag}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

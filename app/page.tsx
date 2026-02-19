import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const pages = [
  {
    href: "/targets",
    title: "URL Targets",
    description: "Creá y administrá base URLs de referencia para QA y contexto de agentes.",
  },
  {
    href: "/ai",
    title: "IA",
    description: "Ingerí logs sin depender de DBO y generá solicitudes de agentes orientadas a escenarios.",
  },
  {
    href: "/specs",
    title: "Configuraciones",
    description: "Visualizá Configuraciones generadas y tests actuales para el flujo planner/generator/healer.",
  },
  {
    href: "/tests-viewers",
    title: "Visor de Tests",
    description:
      "Inspeccioná las últimas corridas con salida por test, estado, respuestas y capturas.",
  },
];

export default function Home() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">QA Debug UI</h1>
        <p className="mt-1 text-sm text-slate-600">
          Espacio de trabajo para URL Targets, preparación de escenarios con IA y specs.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {pages.map((page) => (
          <Card key={page.href}>
            <CardHeader>
              <CardTitle>{page.title}</CardTitle>
              <CardDescription>{page.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href={page.href}
                className="inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Abrir {page.title}
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

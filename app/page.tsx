import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const pages = [
  {
    href: "/targets",
    title: "Targets",
    description: "Create and manage base URLs for environments and test contexts.",
  },
  {
    href: "/ai",
    title: "AI",
    description: "Ingest logs without DBO dependency and create scenario-driven agent requests.",
  },
  {
    href: "/specs",
    title: "Specs",
    description: "View generated specs and current test files for planner/generator/healer flow.",
  },
  {
    href: "/tests-viewers",
    title: "Tests Viewers",
    description:
      "Inspect the latest runs with per-test outputs, status, responses, and screenshots.",
  },
];

export default function Home() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">QA Debug UI</h1>
        <p className="mt-1 text-sm text-slate-600">
          Focused workspace for targets, AI-driven scenario prep, and specs.
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
                Open {page.title}
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

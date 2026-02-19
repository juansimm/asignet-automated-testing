import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const pages = [
  {
    href: "/targets",
    title: "Targets",
    description: "Create and manage base URLs you run suites against.",
  },
  {
    href: "/suites",
    title: "Suites",
    description: "Discover Playwright test suites from playwright/tests.",
  },
  {
    href: "/runs",
    title: "Runs",
    description: "Trigger runs, monitor live logs, and inspect reports.",
  },
  {
    href: "/ai",
    title: "AI",
    description: "Build scenario input from Wayfast logs and generate Playwright agent requests.",
  },
  {
    href: "/specs",
    title: "Specs",
    description: "View generated specs and current test files for planner/generator/healer flow.",
  },
];

export default function Home() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">QA Debug UI</h1>
        <p className="mt-1 text-sm text-slate-600">
          Local MVP for running Playwright suites and collecting debugging artifacts.
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

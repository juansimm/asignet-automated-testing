import { NextResponse } from "next/server";
import { getViewerRunDetails } from "@/lib/tests-viewer-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const linesRaw = Number(searchParams.get("lines") ?? "600");
  const lines = Number.isFinite(linesRaw) ? Math.min(Math.max(linesRaw, 20), 5000) : 600;

  try {
    const details = await getViewerRunDetails(id, lines);

    if (!details) {
      return NextResponse.json({ error: "no se encontró la corrida en artefactos" }, { status: 404 });
    }

    return NextResponse.json(details);
  } catch {
    return NextResponse.json(
      { error: "No se pudo leer el detalle de la corrida desde artefactos locales." },
      { status: 500 },
    );
  }
}

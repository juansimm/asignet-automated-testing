import { NextResponse } from "next/server";
import { RunStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { runService } from "@/lib/run-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const cancelled = await runService.cancelRun(id);

  if (!cancelled) {
    return NextResponse.json({ error: "el proceso de ejecución no está activo" }, { status: 404 });
  }

  await prisma.run.updateMany({
    where: {
      id,
      status: RunStatus.RUNNING,
    },
    data: {
      status: RunStatus.FAILED,
      exitCode: 130,
      finishedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}

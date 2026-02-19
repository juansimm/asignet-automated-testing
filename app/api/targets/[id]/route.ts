import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    baseUrl?: string;
  };

  const name = body.name?.trim();
  const baseUrl = body.baseUrl?.trim();

  if (!name || !baseUrl) {
    return NextResponse.json(
      { error: "name y baseUrl son obligatorios" },
      { status: 400 },
    );
  }

  if (!isValidUrl(baseUrl)) {
    return NextResponse.json({ error: "baseUrl debe ser una URL válida" }, { status: 400 });
  }

  try {
    const target = await prisma.target.update({
      where: { id },
      data: { name, baseUrl },
    });

    return NextResponse.json({ target });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "no se encontró el entorno" }, { status: 404 });
    }

    throw error;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    await prisma.target.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "no se encontró el entorno" }, { status: 404 });
    }

    throw error;
  }

  return NextResponse.json({ ok: true });
}

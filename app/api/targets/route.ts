import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const targets = await prisma.target.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ targets });
}

export async function POST(request: Request) {
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

  const target = await prisma.target.create({
    data: {
      name,
      baseUrl,
    },
  });

  return NextResponse.json({ target }, { status: 201 });
}

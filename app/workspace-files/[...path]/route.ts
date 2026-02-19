import path from "node:path";
import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { ROOT_DIR } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME_TYPES = new Map<string, string>([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".svg", "image/svg+xml"],
  [".json", "application/json; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".log", "text/plain; charset=utf-8"],
]);

const ALLOWED_ROOTS = [
  path.join(ROOT_DIR, "playwright", "tests", "screenshots"),
  path.join(ROOT_DIR, "playwright", "artifacts"),
  path.join(ROOT_DIR, "artifacts"),
];

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function isAllowedFilePath(targetPath: string) {
  const absolute = path.resolve(targetPath);
  return ALLOWED_ROOTS.some((allowedRoot) => {
    const normalizedAllowedRoot = path.resolve(allowedRoot);

    if (absolute === normalizedAllowedRoot) {
      return false;
    }

    return absolute.startsWith(`${normalizedAllowedRoot}${path.sep}`);
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const { path: pathSegments } = await context.params;

  if (!pathSegments?.length) {
    return NextResponse.json({ error: "missing file path" }, { status: 400 });
  }

  const decodedPath = pathSegments.map((segment) => decodeURIComponent(segment));
  const candidatePath = path.resolve(ROOT_DIR, ...decodedPath);

  if (!isAllowedFilePath(candidatePath)) {
    return NextResponse.json({ error: "invalid file path" }, { status: 400 });
  }

  try {
    const stat = await fs.stat(candidatePath);

    if (!stat.isFile()) {
      return NextResponse.json({ error: "file not found" }, { status: 404 });
    }

    const file = await fs.readFile(candidatePath);
    const extension = path.extname(candidatePath).toLowerCase();
    const contentType = MIME_TYPES.get(extension) ?? "application/octet-stream";

    return new NextResponse(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }
}

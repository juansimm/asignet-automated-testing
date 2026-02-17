import path from "node:path";
import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { ARTIFACTS_DIR } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME_TYPES = new Map<string, string>([
  [".html", "text/html; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".log", "text/plain; charset=utf-8"],
  [".zip", "application/zip"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webm", "video/webm"],
  [".mp4", "video/mp4"],
  [".svg", "image/svg+xml"],
  [".css", "text/css; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
]);

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function resolveSafeArtifactPath(pathSegments: string[]) {
  const decoded = pathSegments.map((segment) => decodeURIComponent(segment));
  const candidate = path.resolve(ARTIFACTS_DIR, ...decoded);
  const normalizedRoot = path.resolve(ARTIFACTS_DIR);

  if (candidate === normalizedRoot) {
    return null;
  }

  if (!candidate.startsWith(`${normalizedRoot}${path.sep}`)) {
    return null;
  }

  return candidate;
}

export async function GET(_request: Request, context: RouteContext) {
  const { path: pathSegments } = await context.params;

  if (!pathSegments?.length) {
    return NextResponse.json({ error: "missing artifact path" }, { status: 400 });
  }

  const safePath = resolveSafeArtifactPath(pathSegments);

  if (!safePath) {
    return NextResponse.json({ error: "invalid artifact path" }, { status: 400 });
  }

  try {
    const stat = await fs.stat(safePath);

    if (!stat.isFile()) {
      return NextResponse.json({ error: "artifact not found" }, { status: 404 });
    }

    const file = await fs.readFile(safePath);
    const extension = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES.get(extension) ?? "application/octet-stream";

    return new NextResponse(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "artifact not found" }, { status: 404 });
  }
}

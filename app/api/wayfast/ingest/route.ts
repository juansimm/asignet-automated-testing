import net from "node:net";
import { NextResponse } from "next/server";
import { buildScenarioFromWayfastEntries, normalizeWayfastEntries } from "@/lib/wayfast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WayfastIngestRequest = {
  rawJson?: string;
  url?: string;
};

function parseJson(raw: string) {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isPrivateIpv4(host: string) {
  const octets = host.split(".").map((piece) => Number(piece));
  if (octets.length !== 4 || octets.some((piece) => !Number.isInteger(piece) || piece < 0 || piece > 255)) {
    return false;
  }

  if (octets[0] === 10) return true;
  if (octets[0] === 127) return true;
  if (octets[0] === 169 && octets[1] === 254) return true;
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
  if (octets[0] === 192 && octets[1] === 168) return true;
  return false;
}

function isPrivateHostname(hostname: string) {
  const lowerHost = hostname.toLowerCase();

  if (!lowerHost || lowerHost === "localhost" || lowerHost.endsWith(".local")) {
    return true;
  }

  const ipType = net.isIP(lowerHost);
  if (ipType === 4) {
    return isPrivateIpv4(lowerHost);
  }

  if (ipType === 6) {
    return lowerHost === "::1" || lowerHost.startsWith("fc") || lowerHost.startsWith("fd") || lowerHost.startsWith("fe80");
  }

  return !lowerHost.includes(".");
}

export async function POST(request: Request) {
  let body: WayfastIngestRequest;
  try {
    body = (await request.json()) as WayfastIngestRequest;
  } catch {
    return NextResponse.json({ error: "JSON de entrada inválido" }, { status: 400 });
  }

  const rawJson = body.rawJson?.trim() ?? "";
  const sourceUrl = body.url?.trim() ?? "";
  if (!rawJson && !sourceUrl) {
    return NextResponse.json(
      { error: "Debes enviar rawJson o url." },
      { status: 400 },
    );
  }

  let payload: unknown;
  let source = "manual";

  if (rawJson) {
    payload = parseJson(rawJson);
    if (payload === null) {
      return NextResponse.json({ error: "rawJson no es un JSON válido." }, { status: 400 });
    }
  } else {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(sourceUrl);
    } catch {
      return NextResponse.json({ error: "url no es una URL válida." }, { status: 400 });
    }

    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return NextResponse.json({ error: "Solo se soportan URLs http/https." }, { status: 400 });
    }

    if (isPrivateHostname(parsedUrl.hostname)) {
      return NextResponse.json(
        { error: "La URL debe usar un hostname DNS público o una IP pública." },
        { status: 400 },
      );
    }

    const response = await fetch(parsedUrl, {
      headers: {
        Accept: "application/json",
      },
    });
    const text = await response.text();
    const parsed = parseJson(text);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "No se pudieron obtener logs desde la URL",
          status: response.status,
          details: parsed ?? text,
        },
        { status: 502 },
      );
    }

    if (parsed === null) {
      return NextResponse.json(
        { error: "La respuesta de la URL no es un JSON válido." },
        { status: 400 },
      );
    }

    source = parsedUrl.origin;
    payload = parsed;
  }

  const entries = normalizeWayfastEntries(payload);
  const scenarioDraft = buildScenarioFromWayfastEntries(entries);

  return NextResponse.json({
    source,
    data: payload,
    entries,
    scenarioDraft,
  });
}

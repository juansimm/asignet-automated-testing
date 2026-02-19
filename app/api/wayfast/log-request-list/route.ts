import { NextResponse } from "next/server";
import { buildScenarioFromWayfastEntries, normalizeWayfastEntries } from "@/lib/wayfast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LogRequestListRequest = {
  email?: string;
  startDate?: string;
  endDate?: string;
  host?: string;
};

const TOKEN_KEYS = ["token", "Token", "access_token", "accessToken", "jwt", "Jwt"];

function safeParseJson(raw: string) {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function extractToken(raw: string) {
  let token = "";
  const data = safeParseJson(raw);

  if (data && typeof data === "object") {
    for (const key of TOKEN_KEYS) {
      if (typeof (data as Record<string, unknown>)[key] === "string") {
        token = (data as Record<string, string>)[key];
        break;
      }
    }
  }
  if (!token && typeof data === "string") {
    token = data;
  }

  if (!token) {
    const match =
      raw.match(/"token"\s*:\s*"([^"]+)"/i) ||
      raw.match(/"access_token"\s*:\s*"([^"]+)"/i) ||
      raw.match(/"jwt"\s*:\s*"([^"]+)"/i);
    if (match) {
      token = match[1];
    }
  }

  return token.replace(/^"+|"+$/g, "");
}

function parseJson(raw: string) {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

export async function POST(request: Request) {
  let body: LogRequestListRequest;
  try {
    body = (await request.json()) as LogRequestListRequest;
  } catch {
    return NextResponse.json({ error: "JSON de entrada inválido" }, { status: 400 });
  }

  const email = body.email?.trim();
  const startDate = body.startDate?.trim();
  const endDate = body.endDate?.trim();
  const host = body.host?.trim() ?? "";

  if (!email || !startDate || !endDate) {
    return NextResponse.json(
      { error: "email, startDate y endDate son obligatorios" },
      { status: 400 },
    );
  }

  const baseUrl = (process.env.ASIGNET_BASE_URL ?? "https://dbo.asignet.com/asignetrestapi").replace(
    /\/+$/,
    "",
  );
  const username = process.env.ASIGNET_USERNAME;
  const password = process.env.ASIGNET_PASSWORD;

  if (!username || !password) {
    return NextResponse.json(
      { error: "ASIGNET_USERNAME y ASIGNET_PASSWORD son obligatorios" },
      { status: 500 },
    );
  }

  const loginResponse = await fetch(`${baseUrl}/api/login/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Username: username, Password: password }),
  });

  const loginText = await loginResponse.text();
  if (!loginResponse.ok) {
    return NextResponse.json(
      {
        error: "Falló la autenticación contra Wayfast",
        status: loginResponse.status,
        details: parseJson(loginText),
      },
      { status: 502 },
    );
  }

  const token = extractToken(loginText);
  if (!token) {
    return NextResponse.json(
      { error: "No se pudo extraer el token de autenticación de la respuesta de Wayfast" },
      { status: 502 },
    );
  }

  const logUrl = new URL(`${baseUrl}/api/Wayfast/LogRequestList`);
  logUrl.searchParams.set("Email", email);
  logUrl.searchParams.set("StartDate", startDate);
  logUrl.searchParams.set("EndDate", endDate);
  logUrl.searchParams.set("Host", host);

  const logsResponse = await fetch(logUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const logsText = await logsResponse.text();
  const logsPayload = parseJson(logsText);
  const entries = normalizeWayfastEntries(logsPayload);
  const scenarioDraft = buildScenarioFromWayfastEntries(entries);

  if (!logsResponse.ok) {
    return NextResponse.json(
      {
        error: "No se pudo obtener la lista LogRequestList de Wayfast",
        status: logsResponse.status,
        details: logsPayload,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    request: {
      email,
      startDate,
      endDate,
      host,
    },
    data: logsPayload,
    entries,
    scenarioDraft,
  });
}

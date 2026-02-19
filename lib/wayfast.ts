export type WayfastEntry = {
  id: number;
  date: string;
  host: string;
  projectName: string;
  pageName: string;
  eventType: string;
  key: string;
  value: string;
  duration: number | null;
  parameters: string;
  raw: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function pickNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function toSortableDateValue(input: string) {
  if (!input) {
    return 0;
  }

  const parsed = Date.parse(input);
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  return 0;
}

function extractFirstArray(input: unknown): unknown[] {
  if (Array.isArray(input)) {
    return input;
  }

  const root = asRecord(input);
  if (!root) {
    return [];
  }

  const arrayKeys = ["data", "items", "results", "rows", "logs", "value"];

  for (const key of arrayKeys) {
    if (Array.isArray(root[key])) {
      return root[key] as unknown[];
    }
  }

  for (const value of Object.values(root)) {
    if (Array.isArray(value)) {
      return value as unknown[];
    }
  }

  return [];
}

export function normalizeWayfastEntries(payload: unknown): WayfastEntry[] {
  const rows = extractFirstArray(payload);
  const entries: WayfastEntry[] = [];

  for (const [index, row] of rows.entries()) {
    const record = asRecord(row);
    if (!record) {
      continue;
    }

    entries.push({
      id: index,
      date: pickString(record, ["Date", "date", "CreatedAt", "createdAt"]),
      host: pickString(record, ["Host", "host"]),
      projectName: pickString(record, ["ProjectName", "projectName", "Project", "project"]),
      pageName: pickString(record, ["PageName", "pageName", "Page", "page"]),
      eventType: pickString(record, ["Type1", "Type", "type", "EventType", "eventType"]),
      key: pickString(record, ["Key", "key", "Action", "action"]),
      value: pickString(record, ["Value", "value", "Message", "message"]),
      duration: pickNumber(record, ["Duration", "duration"]),
      parameters: pickString(record, ["Parameters", "parameters", "Detail", "detail"]),
      raw: record,
    });
  }

  return entries.sort((a, b) => toSortableDateValue(a.date) - toSortableDateValue(b.date));
}

function compactValue(input: string, limit = 120) {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 3)}...`;
}

export function buildScenarioFromWayfastEntries(entries: WayfastEntry[]) {
  if (!entries.length) {
    return "";
  }

  const lines = [
    "# Contexto del Escenario (Logs Wayfast)",
    "",
    `- Fuente: LogRequestList`,
    `- Entradas: ${entries.length}`,
    "",
    "## Flujo Observado",
  ];

  for (const [index, entry] of entries.entries()) {
    const titleBits = [entry.eventType || "Evento", entry.key || "operación"].filter(Boolean).join(" - ");
    const locationBits = [entry.projectName, entry.pageName].filter(Boolean).join(" / ");
    const metadata = [
      entry.date ? `date=${entry.date}` : "",
      entry.host ? `host=${entry.host}` : "",
      locationBits ? `location=${locationBits}` : "",
      entry.duration !== null ? `duration=${entry.duration}` : "",
    ]
      .filter(Boolean)
      .join(", ");

    lines.push(`### ${index + 1}. ${titleBits || "Acción observada"}`);
    if (metadata) {
      lines.push(`- Meta: ${metadata}`);
    }
    if (entry.value) {
      lines.push(`- Señal: ${compactValue(entry.value)}`);
    }
    if (entry.parameters) {
      lines.push(`- Parámetros: ${compactValue(entry.parameters)}`);
    }
    lines.push("- Esperado: Verificar que el paso complete sin errores backend y que la UI refleje el resultado.");
    lines.push("");
  }

  lines.push("## Notas para el Agente");
  lines.push("- Convertir cada acción observada en pasos de navegador visibles para el usuario cuando sea posible.");
  lines.push("- Agregar assertions después de cada paso crítico.");
  lines.push("- Si una entrada de log es solo backend, validar mediante resultado visible en UI.");

  return lines.join("\n").trim();
}

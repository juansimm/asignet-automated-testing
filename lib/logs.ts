import { promises as fs } from "node:fs";

export async function tailFile(filePath: string | null | undefined, maxLines = 200) {
  if (!filePath) {
    return "";
  }

  try {
    const content = await fs.readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    return lines.slice(Math.max(lines.length - maxLines, 0)).join("\n");
  } catch {
    return "";
  }
}

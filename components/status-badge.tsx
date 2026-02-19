import { Badge } from "@/components/ui/badge";
import type { RunStatusDto } from "@/lib/api-types";

export function StatusBadge({ status }: { status: RunStatusDto }) {
  if (status === "PASSED") {
    return <Badge variant="success">APROBADO</Badge>;
  }

  if (status === "FAILED") {
    return <Badge variant="destructive">FALLIDO</Badge>;
  }

  if (status === "RUNNING") {
    return <Badge variant="warning">EJECUTANDO</Badge>;
  }

  return <Badge variant="secondary">EN ESPERA</Badge>;
}

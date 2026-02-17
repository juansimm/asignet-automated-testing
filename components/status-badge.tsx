import { Badge } from "@/components/ui/badge";
import type { RunStatusDto } from "@/lib/api-types";

export function StatusBadge({ status }: { status: RunStatusDto }) {
  if (status === "PASSED") {
    return <Badge variant="success">PASSED</Badge>;
  }

  if (status === "FAILED") {
    return <Badge variant="destructive">FAILED</Badge>;
  }

  if (status === "RUNNING") {
    return <Badge variant="warning">RUNNING</Badge>;
  }

  return <Badge variant="secondary">QUEUED</Badge>;
}

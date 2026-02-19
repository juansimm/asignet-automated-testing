import * as React from "react";
import { cn } from "@/lib/utils";

function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-lg border border-[#afcde3] bg-white px-3.5 py-2 text-[0.96rem] shadow-[0_6px_18px_-16px_rgba(5,55,86,0.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0188c9] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export { Select };

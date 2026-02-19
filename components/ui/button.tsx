import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[0.95rem] font-semibold tracking-[0.01em] transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0188c9] focus-visible:ring-offset-2 focus-visible:ring-offset-white",
  {
    variants: {
      variant: {
        default: "bg-[#0b4f7f] text-white shadow-[0_10px_24px_-16px_rgba(4,58,92,1)] hover:-translate-y-0.5 hover:bg-[#0d639e]",
        destructive: "bg-red-600 text-white hover:bg-red-500",
        new: "bg-red-600/70 text-white hover:bg-red-500/95",
        outline: "border border-[#a9c7df] bg-white text-[#0b223a] hover:bg-[#eef6fb]",
        secondary: "bg-[#e6f3fb] text-[#0a3f63] hover:bg-[#d7ebf9]",
        ghost: "hover:bg-[#eaf4fb]",
        link: "text-[#00558f] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-lg px-3.5 text-[0.88rem]",
        lg: "h-12 rounded-lg px-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? "span" : "button";

  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };

import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-emerald-700 text-white hover:bg-emerald-800 active:bg-emerald-900",
  secondary:
    "bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 active:bg-slate-100",
  danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }
>(({ className, variant = "primary", size = "md", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1",
      variantClasses[variant],
      sizeClasses[size],
      className,
    )}
    {...props}
  />
));
Button.displayName = "Button";

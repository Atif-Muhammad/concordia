import * as React from "react";
import { cn } from "@/lib/utils";
import { INPUT_LIMITS } from "@/lib/inputValidation";
const Textarea = React.forwardRef(({
  className,
  maxLength,
  noMaxLength = false,
  ...props
}, ref) => {
  const effectiveMaxLength = noMaxLength ? undefined : (maxLength ?? INPUT_LIMITS.longText);
  return <textarea className={cn("flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", className)} ref={ref} maxLength={effectiveMaxLength} {...props} />;
});
Textarea.displayName = "Textarea";
export { Textarea };

import * as React from "react";
import { cn } from "@/lib/utils";
import { getDefaultMaxLength } from "@/lib/inputValidation";
const Input = React.forwardRef(({
  className,
  type,
  value,
  defaultValue,
  placeholder,
  maxLength,
  ...props
}, ref) => {
  const isNumberInput = type === "number";
  const numberPlaceholder = isNumberInput ? (placeholder ?? "0") : placeholder;
  const normalizedValue = isNumberInput && (value === 0 || value === "0") ? "" : value;
  const normalizedDefaultValue = isNumberInput && (defaultValue === 0 || defaultValue === "0") ? "" : defaultValue;
  const inferredMaxLength = maxLength ?? getDefaultMaxLength({ ...props, type, placeholder });

  return <input type={type} className={cn("flex h-8 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", className)} ref={ref} placeholder={numberPlaceholder} value={normalizedValue} defaultValue={normalizedDefaultValue} maxLength={inferredMaxLength} min={type === "number" ? (props.min ?? 0) : props.min} {...props} />;
});
Input.displayName = "Input";
export { Input };

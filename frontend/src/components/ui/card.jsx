import * as React from "react";
import { cn } from "@/lib/utils";
const Card = React.forwardRef(({
  className,
  ...props
}, ref) => <div ref={ref} className={cn("rounded-md border bg-card text-card-foreground shadow-sm", className)} {...props} />);
Card.displayName = "Card";
const CardHeader = React.forwardRef(({
  className,
  ...props
}, ref) => <div ref={ref} className={cn("flex flex-col space-y-1 p-2.5 sm:p-3 pb-1 sm:pb-1.5", className)} {...props} />);
CardHeader.displayName = "CardHeader";
const CardTitle = React.forwardRef(({
  className,
  ...props
}, ref) => <h3 ref={ref} className={cn("text-xs sm:text-sm font-semibold leading-tight tracking-tight", className)} {...props} />);
CardTitle.displayName = "CardTitle";
const CardDescription = React.forwardRef(({
  className,
  ...props
}, ref) => <p ref={ref} className={cn("text-[11px] text-muted-foreground", className)} {...props} />);
CardDescription.displayName = "CardDescription";
const CardContent = React.forwardRef(({
  className,
  ...props
}, ref) => <div ref={ref} className={cn("p-2.5 sm:p-3 pt-0", className)} {...props} />);
CardContent.displayName = "CardContent";
const CardFooter = React.forwardRef(({
  className,
  ...props
}, ref) => <div ref={ref} className={cn("flex items-center p-2.5 sm:p-3 pt-0", className)} {...props} />);
CardFooter.displayName = "CardFooter";
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
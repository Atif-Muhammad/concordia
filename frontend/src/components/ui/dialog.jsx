import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

// Light backdrop
const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/25",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
      "duration-300",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * Full-height right-side drawer.
 *
 * Pages pass className like "max-w-5xl max-h-[90vh] overflow-y-auto" which
 * were written for the old centered modal. We strip those here so they don't
 * fight the drawer layout.
 */
const DialogContent = React.forwardRef(({ className, bodyClassName, children, ...props }, ref) => {
  // Remove modal-era classes that break the drawer
  const stripped = (className || "")
    .replace(/max-w-\S+/g, "")
    .replace(/max-h-\S+/g, "")
    .replace(/overflow-y-auto/g, "")
    .replace(/overflow-auto/g, "")
    .trim();

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          // Full-height right panel
          "fixed top-0 right-0 z-50",
          "h-dvh min-h-screen w-full sm:w-[80dvw]",
          "bg-background border-l border-border",
          "flex flex-col overflow-y-auto",
          // Slide from right
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
          "duration-300 ease-in-out",
          "shadow-[-2px_0_16px_rgba(0,0,0,0.07)]",
          stripped
        )}
        {...props}
        style={{ height: '100dvh', minHeight: '100vh', maxHeight: '100dvh', ...props.style }}
      >
        {/* Close button */}
        <DialogPrimitive.Close className="absolute right-3 top-3 z-20 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-1 focus:ring-ring">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>

        {/*
          Inject horizontal padding on the body content.
          DialogHeader and DialogFooter already have px-6.
          All other children (form body) are collected into one padded wrapper.
        */}
        {(() => {
          const headerFooter = [];
          const body = [];

          React.Children.forEach(children, (child) => {
            if (!React.isValidElement(child)) {
              body.push(child);
              return;
            }
            const displayName = child.type?.displayName || child.type?.name || "";
            if (displayName === "DialogHeader" || displayName === "DialogFooter") {
              headerFooter.push({ child, displayName });
            } else {
              body.push(child);
            }
          });

          // Find header and footer positions
          const header = headerFooter.find(x => x.displayName === "DialogHeader")?.child;
          const footer = headerFooter.find(x => x.displayName === "DialogFooter")?.child;

          return (
            <>
              {header}
              {body.length > 0 && (
                <div className={cn("px-6 py-5 flex-1 flex flex-col gap-4", bodyClassName || (className?.includes('p-0') ? 'p-0 gap-2' : undefined))}>
                  {body}
                </div>
              )}
              {footer}
            </>
          );
        })()}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }) => (
  <div
    className={cn(
      "px-6 pt-5 pb-4 border-b border-border flex flex-col gap-1 shrink-0",
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }) => (
  <div
    className={cn(
      "px-6 py-4 border-t border-border flex items-center justify-end gap-2 shrink-0 mt-auto",
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-sm font-semibold leading-snug text-foreground pr-6", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-xs text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};

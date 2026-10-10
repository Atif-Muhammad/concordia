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

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

/**
 * Full-height right-side drawer.
 *
 * Pages pass className like "max-w-5xl max-h-[90vh] overflow-y-auto" which
 * were written for the old centered modal. We strip those here so they don't
 * fight the drawer layout.
 */
const DialogContent = React.forwardRef(({
  className,
  bodyClassName,
  children,
  skipDirtyConfirmation = false,
  onPointerDownOutside,
  onInteractOutside,
  onEscapeKeyDown,
  ...props
}, ref) => {
  // Remove modal-era classes that break the drawer
  const stripped = (className || "")
    .replace(/max-w-\S+/g, "")
    .replace(/max-h-\S+/g, "")
    .replace(/overflow-y-auto/g, "")
    .replace(/overflow-auto/g, "")
    .trim();

  const contentNodeRef = React.useRef(null);
  const hiddenCloseRef = React.useRef(null);
  const isDirtyRef = React.useRef(false);
  const [showConfirmClose, setShowConfirmClose] = React.useState(false);

  // Check if any form fields have been filled with text or modified
  const hasPartiallyFilledData = React.useCallback(() => {
    if (!contentNodeRef.current) return false;
    const inputs = contentNodeRef.current.querySelectorAll(
      "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled])"
    );
    for (const input of inputs) {
      if (input.type === "checkbox" || input.type === "radio") {
        if (input.checked && !input.defaultChecked) return true;
      } else if (input.value && input.value.trim().length > 0) {
        return true;
      }
    }
    const selects = contentNodeRef.current.querySelectorAll("select:not([disabled])");
    for (const select of selects) {
      if (select.value && select.value !== "" && select.value !== "none") {
        return true;
      }
    }
    return false;
  }, []);

  const isFormDirty = React.useCallback(() => {
    if (skipDirtyConfirmation) return false;
    return isDirtyRef.current || hasPartiallyFilledData();
  }, [skipDirtyConfirmation, hasPartiallyFilledData]);

  const handleRef = React.useCallback((node) => {
    contentNodeRef.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  }, [ref]);

  const handleAttemptClose = React.useCallback((e) => {
    if (showConfirmClose) {
      if (e?.preventDefault) e.preventDefault();
      return;
    }

    // Ignore clicks inside portaled popovers / selects (Radix portals, daypickers)
    if (e?.target && e.target instanceof Element) {
      const isPortal =
        e.target.closest("[data-radix-portal]") ||
        e.target.closest("[data-radix-popper-content-wrapper]") ||
        e.target.closest('[role="listbox"]') ||
        e.target.closest('[role="menu"]') ||
        e.target.closest(".rdp");
      if (isPortal) return;
    }

    if (isFormDirty()) {
      if (e?.preventDefault) e.preventDefault();
      if (e?.stopPropagation) e.stopPropagation();
      setShowConfirmClose(true);
    }
  }, [showConfirmClose, isFormDirty]);

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={handleRef}
        className={cn(
          // Full-height right panel
          "fixed top-0 right-0 z-50",
          "h-[100dvh] max-h-[100dvh] w-full sm:w-[80dvw]",
          "bg-background border-l border-border",
          "flex flex-col overflow-hidden",
          // Slide from right
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
          "duration-300 ease-in-out",
          "shadow-[-2px_0_16px_rgba(0,0,0,0.07)]",
          stripped
        )}
        onPointerDownOutside={(e) => {
          onPointerDownOutside?.(e);
          if (!e.defaultPrevented) {
            handleAttemptClose(e);
          }
        }}
        onInteractOutside={(e) => {
          onInteractOutside?.(e);
          if (!e.defaultPrevented) {
            handleAttemptClose(e);
          }
        }}
        onEscapeKeyDown={(e) => {
          onEscapeKeyDown?.(e);
          if (!e.defaultPrevented) {
            handleAttemptClose(e);
          }
        }}
        onInput={(e) => {
          isDirtyRef.current = true;
          props.onInput?.(e);
        }}
        onChange={(e) => {
          isDirtyRef.current = true;
          props.onChange?.(e);
        }}
        onSubmit={(e) => {
          isDirtyRef.current = false;
          props.onSubmit?.(e);
        }}
        {...props}
        style={{ height: '100dvh', maxHeight: '100dvh', ...props.style }}
      >
        {/* Close button with dirty check */}
        <button
          type="button"
          onClick={(e) => {
            if (isFormDirty()) {
              e.preventDefault();
              e.stopPropagation();
              setShowConfirmClose(true);
            } else {
              hiddenCloseRef.current?.click();
            }
          }}
          className="absolute right-3 top-3 z-20 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        {/* Hidden native Radix close button */}
        <DialogPrimitive.Close ref={hiddenCloseRef} className="hidden" tabIndex={-1} aria-hidden="true" />

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
                <div className={cn("px-4 py-3 sm:px-6 sm:py-5 flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto", bodyClassName || (className?.includes('p-0') ? 'p-0 gap-2' : undefined))}>
                  {body}
                </div>
              )}
              {footer}
            </>
          );
        })()}

        {/* Unsaved changes confirmation dialog */}
        <AlertDialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
          <AlertDialogContent className="z-[70] max-w-sm sm:max-w-md bg-background border border-border shadow-2xl p-6">
            <AlertDialogHeader className="mb-2">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <AlertDialogTitle className="text-base font-bold text-foreground">
                    Unsaved Changes
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    You have unsaved changes in this form. If you close now, all the filled data will be lost.
                  </AlertDialogDescription>
                </div>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-5 flex flex-row justify-end gap-2">
              <AlertDialogCancel
                onClick={() => setShowConfirmClose(false)}
                className="text-xs h-9 px-4 font-medium"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  isDirtyRef.current = false;
                  setShowConfirmClose(false);
                  setTimeout(() => {
                    hiddenCloseRef.current?.click();
                  }, 0);
                }}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-semibold h-9 px-4"
              >
                Confirm Close
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
      "px-4 py-3 sm:px-6 sm:py-4 border-t border-border flex items-center justify-end gap-2 shrink-0 bg-background/95 backdrop-blur-xs z-30",
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

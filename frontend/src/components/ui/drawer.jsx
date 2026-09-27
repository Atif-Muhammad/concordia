import * as React from "react";
import { cn } from "@/lib/utils";

const DrawerContext = React.createContext({});

const Drawer = ({ open = false, onOpenChange, children }) => {
  return (
    <DrawerContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DrawerContext.Provider>
  );
};
Drawer.displayName = "Drawer";

const DrawerTrigger = ({ children, asChild, ...props }) => {
  const { onOpenChange } = React.useContext(DrawerContext);
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      onClick: (e) => {
        children.props.onClick?.(e);
        onOpenChange?.(true);
      },
    });
  }
  return (
    <button type="button" onClick={() => onOpenChange?.(true)} {...props}>
      {children}
    </button>
  );
};
DrawerTrigger.displayName = "DrawerTrigger";

const DrawerContent = ({ className, children, ...props }) => {
  const { open, onOpenChange } = React.useContext(DrawerContext);

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onOpenChange?.(false);
    };
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={() => onOpenChange?.(false)}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        className={cn(
          "fixed bottom-0 left-0 w-full z-50 rounded-t-xl bg-background",
          "sm:max-w-lg sm:left-1/2 sm:-translate-x-1/2",
          "transition-transform duration-300 ease-in-out",
          open ? "translate-y-0" : "translate-y-full",
          className
        )}
        {...props}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-3 mt-3" />
        {children}
      </div>
    </>
  );
};
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({ className, ...props }) => (
  <div className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)} {...props} />
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ({ className, ...props }) => (
  <div className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = ({ className, ...props }) => (
  <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
);
DrawerTitle.displayName = "DrawerTitle";

const DrawerDescription = ({ className, ...props }) => (
  <p className={cn("text-sm text-muted-foreground", className)} {...props} />
);
DrawerDescription.displayName = "DrawerDescription";

const DrawerClose = ({ children, asChild, ...props }) => {
  const { onOpenChange } = React.useContext(DrawerContext);
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      onClick: (e) => {
        children.props.onClick?.(e);
        onOpenChange?.(false);
      },
    });
  }
  return (
    <button type="button" onClick={() => onOpenChange?.(false)} {...props}>
      {children}
    </button>
  );
};
DrawerClose.displayName = "DrawerClose";

export {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
  DrawerTrigger,
};

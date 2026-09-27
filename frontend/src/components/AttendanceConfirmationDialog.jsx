import { format } from "date-fns";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function buildConfirmationMessage(actionType, date) {
  if (!date || isNaN(new Date(date).getTime())) {
    return actionType === "generate" ? "Attendance generated" : "Marked as holiday";
  }
  const formatted = format(date, "PPP");
  if (actionType === "generate") {
    return `Attendance generated for ${formatted}`;
  }
  return `${formatted} marked as holiday`;
}

export default function AttendanceConfirmationDialog({
  open,
  actionType,
  date,
  holidayId,
  onUndo,
  onClose,
  isUndoing,
}) {
  if (!open || !date) return null;

  const message = buildConfirmationMessage(actionType, date);

  return (
    <div className="fixed bottom-6 left-0 right-0 flex justify-center pointer-events-none z-50 px-4">
      <div className="pointer-events-auto flex items-center gap-3 bg-popover border shadow-lg rounded-2xl px-4 py-3 text-sm max-w-full">
        <span className="text-foreground font-medium truncate">{message}</span>
        <Button size="sm" variant="secondary" onClick={onUndo} disabled={isUndoing} className="h-7 px-3 text-xs shrink-0">
          {isUndoing && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          Undo
        </Button>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

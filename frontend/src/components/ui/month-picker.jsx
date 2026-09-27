import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export const MonthPicker = ({
  value,
  onChange,
  className,
  placeholder = "Select month",
  minYear = 2020,
  maxYear = 2035,
  disabled = false,
}) => {
  const [open, setOpen] = React.useState(false);

  // Parse value format "YYYY-MM"
  const [selectedYear, selectedMonth] = React.useMemo(() => {
    if (!value || typeof value !== "string" || !value.includes("-")) {
      const now = new Date();
      return [now.getFullYear(), now.getMonth()];
    }
    const parts = value.split("-").map(Number);
    return [parts[0] || new Date().getFullYear(), (parts[1] || 1) - 1];
  }, [value]);

  const [viewYear, setViewYear] = React.useState(selectedYear);

  React.useEffect(() => {
    if (selectedYear) {
      setViewYear(selectedYear);
    }
  }, [selectedYear, open]);

  const displayLabel = React.useMemo(() => {
    if (!value || typeof value !== "string" || !value.includes("-")) return "";
    const parts = value.split("-").map(Number);
    if (!parts[0] || !parts[1]) return value;
    try {
      return format(new Date(parts[0], parts[1] - 1, 1), "MMMM yyyy");
    } catch (e) {
      return value;
    }
  }, [value]);

  const handleSelectMonth = (monthIndex) => {
    const formatted = `${viewYear}-${String(monthIndex + 1).padStart(2, "0")}`;
    onChange?.(formatted);
    setOpen(false);
  };

  const years = React.useMemo(() => {
    const list = [];
    for (let y = minYear; y <= maxYear; y++) {
      list.push(y);
    }
    return list;
  }, [minYear, maxYear]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{displayLabel || placeholder}</span>
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-50 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="flex items-center justify-between pb-2 border-b mb-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewYear((y) => Math.max(minYear, y - 1))}
            disabled={viewYear <= minYear}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select
            value={String(viewYear)}
            onValueChange={(val) => setViewYear(Number(val))}
          >
            <SelectTrigger className="h-7 w-24 text-xs font-semibold px-2">
              <SelectValue>{viewYear}</SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-48">
              {years.map((y) => (
                <SelectItem key={y} value={String(y)} className="text-xs">
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewYear((y) => Math.min(maxYear, y + 1))}
            disabled={viewYear >= maxYear}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MONTHS.map((monthName, idx) => {
            const isSelected = selectedYear === viewYear && selectedMonth === idx;
            const now = new Date();
            const isCurrentMonth =
              now.getFullYear() === viewYear && now.getMonth() === idx;

            return (
              <Button
                key={monthName}
                type="button"
                variant={isSelected ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-8 text-xs font-normal transition-colors",
                  isSelected && "font-semibold bg-primary text-primary-foreground",
                  !isSelected && isCurrentMonth && "border-primary text-primary font-medium"
                )}
                onClick={() => handleSelectMonth(idx)}
              >
                {monthName}
              </Button>
            );
          })}
        </div>
        <div className="pt-2 mt-2 border-t flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
            onClick={() => {
              const now = new Date();
              setViewYear(now.getFullYear());
              handleSelectMonth(now.getMonth());
            }}
          >
            This Month
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

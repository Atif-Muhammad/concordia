import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * MultiSelectFilter — a compact multi-select dropdown with checkboxes.
 *
 * Props:
 *  - options: Array<{ value: string, label: string }>
 *  - selected: string[]           — currently selected values
 *  - onChange: (values: string[]) => void
 *  - placeholder?: string         — e.g. "Programs"
 *  - allLabel?: string            — label when nothing selected (default: "All {placeholder}")
 *  - disabled?: boolean
 *  - className?: string           — extra classes on the trigger button
 *  - triggerClassName?: string     — classes on the trigger button
 */
const MultiSelectFilter = React.memo(function MultiSelectFilter({
  options = [],
  selected = [],
  onChange,
  placeholder = "Select",
  allLabel,
  defaultSelectedAll = true,
  disabled = false,
  className,
  triggerClassName,
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const effectiveAllLabel = allLabel || `All ${placeholder}`;

  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const isAllSelected = defaultSelectedAll
    ? selected.length === 0 || (options.length > 0 && selected.length === options.length)
    : options.length > 0 && selected.length === options.length;

  const toggleValue = React.useCallback(
    (val) => {
      if (selected.includes(val)) {
        onChange(selected.filter((v) => v !== val));
      } else {
        onChange([...selected, val]);
      }
    },
    [selected, onChange]
  );

  const selectAll = React.useCallback(() => {
    if (defaultSelectedAll) {
      onChange([]);
    } else {
      onChange(options.map((o) => o.value));
    }
  }, [defaultSelectedAll, onChange, options]);

  const clearAll = React.useCallback(() => {
    onChange([]);
  }, [onChange]);

  const triggerLabel = React.useMemo(() => {
    if (defaultSelectedAll) {
      if (selected.length === 0) return effectiveAllLabel;
      if (selected.length === 1) {
        const match = options.find((o) => o.value === selected[0]);
        return match ? match.label : selected[0];
      }
      if (options.length > 0 && selected.length === options.length) return effectiveAllLabel;
      return `${selected.length} ${placeholder}`;
    } else {
      if (selected.length === 0) return placeholder;
      if (isAllSelected) return effectiveAllLabel;
      if (selected.length === 1) {
        const match = options.find((o) => o.value === selected[0]);
        return match ? match.label : selected[0];
      }
      return `${selected.length} ${placeholder}`;
    }
  }, [defaultSelectedAll, isAllSelected, selected, options, effectiveAllLabel, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal text-xs",
            triggerClassName,
            isAllSelected && "text-muted-foreground"
          )}
          disabled={disabled}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("p-0 w-[220px]", className)} align="start">
        {/* Search */}
        {options.length > 5 && (
          <div className="px-2 pt-2 pb-1">
            <input
              type="text"
              placeholder={`Search ${placeholder.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-7 px-2 text-xs border rounded-md bg-background outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b">
          <button
            type="button"
            onClick={selectAll}
            className={cn(
              "text-[11px] font-medium hover:underline",
              isAllSelected ? "text-primary" : "text-muted-foreground"
            )}
          >
            All
          </button>
          {!isAllSelected && (
            <button
              type="button"
              onClick={clearAll}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        {/* Option list */}
        <div className="max-h-48 overflow-y-auto py-1">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground text-center">No options</div>
          ) : (
            filteredOptions.map((option) => {
              const isChecked = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleValue(option.value)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer"
                >
                  <Checkbox
                    checked={isChecked}
                    className="h-3.5 w-3.5 rounded-[3px]"
                    tabIndex={-1}
                    onCheckedChange={() => {}}
                  />
                  <span className="truncate">{option.label}</span>
                  {isChecked && <Check className="ml-auto h-3 w-3 text-primary shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
});

MultiSelectFilter.displayName = "MultiSelectFilter";

export { MultiSelectFilter };

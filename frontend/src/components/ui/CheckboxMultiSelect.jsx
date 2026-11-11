import React, { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * CheckboxMultiSelect — Dropdown with Checkbox for each option, Select All, Deselect All, Clear, Search.
 */
export const CheckboxMultiSelect = ({
  title = "Item",
  placeholder = "Select...",
  options = [],
  selected = [],
  onChange,
  disabled = false,
  allLabel,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((o) => (o.label || "").toLowerCase().includes(q));
  }, [options, search]);

  const isAll = options.length > 0 && selected.length === options.length;

  const handleToggle = (val) => {
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const handleToggleAll = () => {
    if (isAll) {
      onChange([]);
    } else {
      onChange(options.map((o) => o.value));
    }
  };

  const displayText = useMemo(() => {
    if (selected.length === 0) return placeholder;
    if (isAll) return allLabel || `All ${title} (${options.length})`;
    if (selected.length === 1) {
      const match = options.find((o) => o.value === selected[0]);
      return match ? match.label : selected[0];
    }
    return `${selected.length} ${title} Selected`;
  }, [selected, options, placeholder, isAll, allLabel, title]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-between text-xs font-normal px-2.5 bg-background border-input hover:bg-muted/30",
            disabled && "cursor-not-allowed opacity-60",
            className
          )}
        >
          <span className="truncate">{displayText}</span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[240px]" align="start">
        {options.length > 5 && (
          <div className="p-2 border-b">
            <input
              type="text"
              placeholder={`Search ${title.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-7 px-2 text-xs border rounded bg-background outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        )}
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b bg-muted/20">
          <button
            type="button"
            onClick={handleToggleAll}
            className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
          >
            {isAll ? "Deselect All" : "Select All"}
          </button>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-0.5"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
        <div className="max-h-52 overflow-y-auto p-1 space-y-0.5">
          {filtered.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground text-center">No options available</div>
          ) : (
            filtered.map((opt) => {
              const isChecked = selected.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  onClick={() => handleToggle(opt.value)}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-muted cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => handleToggle(opt.value)}
                    className="h-3.5 w-3.5 rounded-[3px]"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="truncate flex-1 font-medium">{opt.label}</span>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default CheckboxMultiSelect;

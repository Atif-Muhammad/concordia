import React, { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, X, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Case-insensitive multi-token matcher across option label and optional keywords.
 */
export function filterSearchableOptions(options = [], search = "") {
  const tokens = String(search || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return options;
  return (Array.isArray(options) ? options : []).filter((opt) => {
    const haystack = `${opt?.label ?? ""} ${opt?.keywords ?? ""}`.toLowerCase();
    return tokens.every((tok) => haystack.includes(tok));
  });
}

/**
 * SearchableSelect — Single-selection dropdown with always-visible search input.
 */
export const SearchableSelect = ({
  options = [],
  value = "",
  onChange,
  placeholder = "Select...",
  allLabel = "All",
  searchPlaceholder = "Search...",
  emptyMessage = "No matching options",
  disabled = false,
  isLoading = false,
  allowAll = true,
  className,
  popoverClassName,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const normalizedValue = String(value ?? "");
  const selectedOption = useMemo(
    () => options.find((opt) => String(opt.value) === normalizedValue) || null,
    [options, normalizedValue]
  );

  const filteredOptions = useMemo(
    () => filterSearchableOptions(options, search),
    [options, search]
  );

  const handleSelect = (nextValue) => {
    onChange?.(nextValue);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSearch("");
      }}
    >
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-between text-xs font-normal px-2.5 bg-background border-input hover:bg-muted/30",
            !selectedOption && "text-muted-foreground",
            disabled && "cursor-not-allowed opacity-60",
            className
          )}
        >
          <span className="truncate text-left">
            {isLoading ? "Loading..." : (selectedOption ? selectedOption.label : placeholder)}
          </span>
          {isLoading ? (
            <Loader2 className="ml-1 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("p-0 w-[340px] max-w-[90vw]", popoverClassName)}
      >
        <div className="flex items-center gap-1.5 px-2.5 py-2 border-b">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-6 text-xs bg-transparent outline-none placeholder:text-muted-foreground"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="max-h-60 overflow-y-auto p-1 space-y-0.5">
          {allowAll && !isLoading && (
            <button
              type="button"
              onClick={() => handleSelect("")}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded text-left hover:bg-muted cursor-pointer transition-colors",
                !normalizedValue && "bg-muted/60 font-semibold"
              )}
            >
              <Check
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-[#F7941E]",
                  !normalizedValue ? "opacity-100" : "opacity-0"
                )}
              />
              <span className="truncate">{allLabel}</span>
            </button>
          )}
          {isLoading ? (
            <div className="py-6 px-2 text-xs text-muted-foreground text-center flex items-center justify-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-500" />
              <span>Loading...</span>
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="py-4 px-2 text-xs text-muted-foreground text-center">
              {emptyMessage}
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const optVal = String(opt.value);
              const isSelected = optVal === normalizedValue;
              return (
                <button
                  type="button"
                  key={optVal}
                  onClick={() => handleSelect(optVal)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded text-left hover:bg-muted cursor-pointer transition-colors",
                    isSelected && "bg-orange-50/70 font-medium text-slate-900"
                  )}
                >
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 text-[#F7941E]",
                      isSelected ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate flex-1">{opt.label}</span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default SearchableSelect;

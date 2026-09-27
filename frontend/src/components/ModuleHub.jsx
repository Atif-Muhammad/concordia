import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search, ShieldAlert, X } from "lucide-react";
import { getAllowedSubmodules } from "@/lib/navigation.jsx";
import { userWho, refreshTokens } from "../../config/apis";
import { Input } from "@/components/ui/input";

const ModuleHub = ({ module }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      try {
        return await userWho();
      } catch (error) {
        if (error.response?.status === 401) {
          try {
            await refreshTokens();
            return await userWho();
          } catch {
            return null;
          }
        }
        return null;
      }
    },
    retry: false,
  });

  const allowedSubmodules = useMemo(() => {
    return getAllowedSubmodules(currentUser, module);
  }, [currentUser, module]);

  const filteredSubmodules = useMemo(() => {
    if (!searchTerm.trim()) return allowedSubmodules;
    const q = searchTerm.toLowerCase().trim();
    return allowedSubmodules.filter(
      (sub) =>
        sub.label.toLowerCase().includes(q) ||
        (sub.description && sub.description.toLowerCase().includes(q))
    );
  }, [allowedSubmodules, searchTerm]);

  const ModuleIcon = module?.icon;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Module Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border/80 shadow-xs">
        <div className="flex items-center gap-4 min-w-0">
          {ModuleIcon && (
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-inner">
              <ModuleIcon className="w-7 h-7" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">
              {module.label}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
              {module.description || "Select a section below to get started"}
            </p>
          </div>
        </div>

        {/* Counter and quick filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          {allowedSubmodules.length > 3 && (
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Find section..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-8 h-9 text-xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          <div className="text-xs text-muted-foreground bg-muted/60 px-3 py-2 rounded-lg font-medium text-center self-start sm:self-auto shrink-0">
            {allowedSubmodules.length} {allowedSubmodules.length === 1 ? "Section" : "Sections"}
          </div>
        </div>
      </div>

      {/* Submodule Cards Grid */}
      {allowedSubmodules.length === 0 ? (
        <div className="p-12 text-center border rounded-2xl bg-card">
          <ShieldAlert className="w-10 h-10 mx-auto text-muted-foreground/60 mb-3" />
          <h3 className="text-base font-semibold text-foreground">No sections available</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            You currently do not have permission to view or manage any sections under {module.label}.
          </p>
        </div>
      ) : filteredSubmodules.length === 0 ? (
        <div className="p-10 text-center border rounded-2xl bg-card">
          <Search className="w-8 h-8 mx-auto text-muted-foreground/60 mb-2" />
          <h3 className="text-sm font-semibold text-foreground">No matching sections found</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Try adjusting your search term "{searchTerm}".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredSubmodules.map((sub) => {
            const SubIcon = sub.icon || ModuleIcon;
            return (
              <Link
                key={sub.path}
                to={sub.path}
                className="group relative flex flex-col justify-between p-5 bg-card hover:bg-accent/40 rounded-xl border border-border shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200">
                      {SubIcon && <SubIcon className="w-5 h-5" />}
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-1 transition-all duration-200" />
                  </div>
                  <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors">
                    {sub.label}
                  </h3>
                  {sub.description && (
                    <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {sub.description}
                    </p>
                  )}
                </div>
                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs font-medium text-primary">
                  <span>Open Section</span>
                  <span className="text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ModuleHub;

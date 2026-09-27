import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search, ShieldAlert, X } from "lucide-react";
import { getAllowedSubmodules } from "@/lib/navigation.jsx";
import { userWho, refreshTokens } from "../../config/apis";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Rotating earthy squircle colors matching Image 2
const SQUIRCLE_BG_CLASSES = [
  "bg-[#c85a17]", // Burnt orange
  "bg-[#3d5a45]", // Deep sage / forest green
  "bg-[#b88628]", // Ochre / amber mustard
  "bg-[#2d4d3a]", // Pine green
  "bg-[#3b5943]", // Forest green
  "bg-[#9e4317]", // Rust terracotta
  "bg-[#335c4b]", // Spruce green
  "bg-[#ab7022]", // Rich amber
];

// Distinct organic pastel watercolor SVG blobs for card top-right corners
const CORNER_BLOBS = [
  // 1: Warm Peach / Amber
  (
    <svg viewBox="0 0 100 100" fill="none" className="absolute -top-3 -right-3 w-28 h-28 pointer-events-none opacity-80 dark:opacity-20 z-0">
      <path d="M40 0 C65 5 95 25 100 60 C100 80 85 95 65 90 C40 85 15 65 10 40 C5 15 20 -5 40 0 Z" fill="#fbeee3" />
    </svg>
  ),
  // 2: Soft Sage Green
  (
    <svg viewBox="0 0 100 100" fill="none" className="absolute -top-3 -right-3 w-28 h-28 pointer-events-none opacity-80 dark:opacity-20 z-0">
      <path d="M30 0 C60 10 90 20 100 50 C105 75 80 100 55 95 C30 90 10 70 5 45 C0 20 10 -5 30 0 Z" fill="#e8f0ea" />
    </svg>
  ),
  // 3: Warm Ochre
  (
    <svg viewBox="0 0 100 100" fill="none" className="absolute -top-3 -right-3 w-28 h-28 pointer-events-none opacity-80 dark:opacity-20 z-0">
      <path d="M50 0 C75 10 95 35 100 65 C95 85 70 95 45 90 C25 85 5 60 0 35 C-5 10 25 -5 50 0 Z" fill="#fbf4e6" />
    </svg>
  ),
  // 4: Mint / Teal
  (
    <svg viewBox="0 0 100 100" fill="none" className="absolute -top-3 -right-3 w-28 h-28 pointer-events-none opacity-80 dark:opacity-20 z-0">
      <path d="M35 0 C65 5 90 30 100 55 C100 80 75 90 50 85 C25 80 5 65 0 40 C-5 15 15 -5 35 0 Z" fill="#eaf2ec" />
    </svg>
  ),
  // 5: Warm Sand / Biscuit
  (
    <svg viewBox="0 0 100 100" fill="none" className="absolute -top-3 -right-3 w-28 h-28 pointer-events-none opacity-80 dark:opacity-20 z-0">
      <path d="M45 0 C70 15 95 30 100 60 C90 85 65 95 40 85 C15 75 5 50 0 25 C-5 5 20 -10 45 0 Z" fill="#f8efe6" />
    </svg>
  ),
  // 6: Soft Olive
  (
    <svg viewBox="0 0 100 100" fill="none" className="absolute -top-3 -right-3 w-28 h-28 pointer-events-none opacity-80 dark:opacity-20 z-0">
      <path d="M25 0 C55 10 85 25 100 55 C95 80 75 95 50 90 C25 85 10 65 5 35 C0 10 5 -5 25 0 Z" fill="#ebf1ec" />
    </svg>
  ),
];

// Center illustration vector graphic for Welcome Banner
const BannerIllustration = ({ moduleLabel }) => {
  const isFinance =
    moduleLabel?.toLowerCase().includes("fee") ||
    moduleLabel?.toLowerCase().includes("finance") ||
    moduleLabel?.toLowerCase().includes("payroll");

  return (
    <div className="relative w-44 h-32 shrink-0 select-none pointer-events-none">
      <svg viewBox="0 0 240 180" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Background pastel blobs */}
        <circle cx="170" cy="65" r="50" fill="#f8ede1" />
        <circle cx="95" cy="115" r="32" fill="#8ba895" fillOpacity="0.65" />
        <circle cx="78" cy="85" r="9" fill="#6f8f7c" fillOpacity="0.8" />
        <circle cx="185" cy="125" r="7" fill="#edd8be" />

        {/* Paper Document */}
        <g filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.04))">
          <rect
            x="105"
            y="32"
            width="82"
            height="112"
            rx="9"
            fill="white"
            stroke="#dfddd5"
            strokeWidth="2.5"
          />
          {/* Header line on document */}
          <line x1="120" y1="52" x2="162" y2="52" stroke="#d5d3ca" strokeWidth="2.5" strokeLinecap="round" />

          {/* Central Coin / Badge */}
          <circle cx="146" cy="82" r="16" fill="#f6b856" />
          {/* Symbol inside coin */}
          {isFinance ? (
            <text
              x="146"
              y="88"
              textAnchor="middle"
              fontSize="16"
              fontWeight="bold"
              fill="#ffffff"
              fontFamily="sans-serif"
            >
              ₹
            </text>
          ) : (
            <circle cx="146" cy="82" r="6" fill="#ffffff" fillOpacity="0.9" />
          )}

          {/* Footer lines on document */}
          <line x1="120" y1="112" x2="172" y2="112" stroke="#d5d3ca" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="120" y1="122" x2="152" y2="122" stroke="#d5d3ca" strokeWidth="2.5" strokeLinecap="round" />
        </g>

        {/* Plant Stem & Leaves growing on right */}
        <path
          d="M 178 144 C 184 116 190 92 198 62"
          stroke="#3b5943"
          strokeWidth="2.8"
          fill="none"
          strokeLinecap="round"
        />
        {/* Leaves */}
        <ellipse cx="174" cy="122" rx="14" ry="7" transform="rotate(-30 174 122)" fill="#476b50" />
        <ellipse cx="199" cy="102" rx="14" ry="7.5" transform="rotate(35 199 102)" fill="#3d5a45" />
        <ellipse cx="185" cy="82" rx="12" ry="6.5" transform="rotate(-25 185 82)" fill="#476b50" />
        <ellipse cx="201" cy="64" rx="11" ry="6" transform="rotate(40 201 64)" fill="#3d5a45" />

        {/* Ground Base Line */}
        <line x1="75" y1="144" x2="215" y2="144" stroke="#dcd9ce" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
};

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
    <div className="relative space-y-4 w-full">
      {/* Ambient background pastel shapes on empty spaces (Image 2 style) */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none">
        {/* Prominent bottom-right overlapping pastel circular arcs (matching Image 2) */}
        <svg
          className="absolute bottom-0 right-0 w-[540px] h-[460px] opacity-80 dark:opacity-20 pointer-events-none"
          viewBox="0 0 540 460"
          fill="none"
        >
          {/* Warm Peach/Amber large arc */}
          <circle cx="540" cy="460" r="390" fill="#f8ede1" />
          {/* Sage green overlapping arc */}
          <circle cx="350" cy="460" r="270" fill="#8ba895" fillOpacity="0.32" />
          {/* Warm biscuit accent arc */}
          <circle cx="540" cy="280" r="200" fill="#edd8be" fillOpacity="0.45" />
          {/* Soft sage dot arc */}
          <circle cx="270" cy="420" r="140" fill="#7d9d87" fillOpacity="0.22" />
        </svg>

        {/* Floating organic shapes on middle empty space */}
        <svg
          className="absolute top-[45%] right-[22%] w-80 h-72 opacity-40 dark:opacity-10 pointer-events-none"
          viewBox="0 0 320 280"
          fill="none"
        >
          <path
            d="M60 20 C120 -10 200 15 250 65 C300 115 320 185 270 230 C220 275 130 290 75 250 C20 210 -10 150 5 95 C20 40 40 30 60 20 Z"
            fill="#fbeee3"
          />
          <circle cx="160" cy="140" r="65" fill="#e8f0ea" fillOpacity="0.5" />
        </svg>

        {/* Floating subtle pastel accent ring & dots on middle-left empty space */}
        <svg
          className="absolute top-[62%] left-[25%] w-60 h-60 opacity-35 dark:opacity-10 pointer-events-none"
          viewBox="0 0 240 240"
          fill="none"
        >
          <circle cx="120" cy="120" r="75" stroke="#e0ddd2" strokeWidth="2" strokeDasharray="6 6" fill="none" />
          <circle cx="120" cy="120" r="42" fill="#f6ece0" />
          <circle cx="185" cy="80" r="8" fill="#8ba895" fillOpacity="0.4" />
          <circle cx="65" cy="160" r="6" fill="#edd8be" />
        </svg>
      </div>

      {/* Module Header Banner (Image 2 style, no quotes) */}
      <div className="relative overflow-hidden rounded-2xl bg-[#fdfcf8] dark:bg-card border border-[#eae8df] dark:border-border p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left Column: Welcome text, Title, Description, Accent bar */}
          <div className="min-w-0 max-w-2xl">
            <p className="text-[10px] sm:text-[10.5px] font-bold tracking-[0.2em] text-[#8c887b] dark:text-muted-foreground uppercase mb-1">
              WELCOME BACK
            </p>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#22211f] dark:text-foreground">
              {module?.label}
            </h1>
            <p className="text-xs sm:text-[13px] text-[#66645d] dark:text-muted-foreground mt-1.5 leading-relaxed">
              {module?.description || "Manage settings, generate records, and monitor institutional operations — all in one place."}
            </p>
            <div className="w-10 h-1 bg-[#d97c38] rounded-full mt-2.5" />
          </div>

          {/* Right Column: Vector Illustration */}
          <div className="hidden md:flex items-center justify-end shrink-0">
            <BannerIllustration moduleLabel={module?.label} />
          </div>
        </div>

        {/* Filter bar if sections exist */}
        {allowedSubmodules.length > 4 && (
          <div className="mt-4 pt-3 border-t border-[#f0eee6] dark:border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Find section..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-8 h-8 text-xs bg-white dark:bg-background border-[#eae8df] dark:border-border rounded-xl"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="text-[11px] text-[#8c887b] dark:text-muted-foreground font-medium self-end sm:self-auto">
              {allowedSubmodules.length} {allowedSubmodules.length === 1 ? "Section" : "Sections"}
            </div>
          </div>
        )}
      </div>

      {/* Submodule Cards Grid */}
      {allowedSubmodules.length === 0 ? (
        <div className="p-10 text-center border border-[#eae8df] dark:border-border rounded-2xl bg-[#fdfcf8] dark:bg-card">
          <ShieldAlert className="w-10 h-10 mx-auto text-muted-foreground/60 mb-3" />
          <h3 className="text-base font-semibold text-foreground">No sections available</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            You currently do not have permission to view or manage any sections under {module?.label}.
          </p>
        </div>
      ) : filteredSubmodules.length === 0 ? (
        <div className="p-8 text-center border border-[#eae8df] dark:border-border rounded-2xl bg-[#fdfcf8] dark:bg-card">
          <Search className="w-8 h-8 mx-auto text-muted-foreground/60 mb-2" />
          <h3 className="text-sm font-semibold text-foreground">No matching sections found</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Try adjusting your search term "{searchTerm}".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {filteredSubmodules.map((sub, index) => {
            const SubIcon = sub.icon || ModuleIcon;
            const CornerBlob = CORNER_BLOBS[index % CORNER_BLOBS.length];
            const squircleBg = SQUIRCLE_BG_CLASSES[index % SQUIRCLE_BG_CLASSES.length];
            const isFirst = index === 0;

            return (
              <Link
                key={sub.path}
                to={sub.path}
                className={cn(
                  "group relative overflow-hidden rounded-2xl bg-[#fdfcf8] dark:bg-card border p-4 flex flex-col justify-between min-h-[180px] shadow-xs hover:shadow-md transition-all duration-200",
                  isFirst
                    ? "border-amber-500/80 hover:border-amber-600"
                    : "border-[#eae8df] dark:border-border hover:border-amber-400/80"
                )}
              >
                {/* Random / varied pastel SVG blob in top-right background */}
                {CornerBlob}

                {/* Submodule Icon as faint watermark background graphic */}
                {SubIcon && (
                  <div className="absolute -right-3 -bottom-3 w-28 h-28 pointer-events-none opacity-[0.05] dark:opacity-[0.08] text-foreground group-hover:opacity-[0.10] transition-opacity duration-200 select-none z-0">
                    <SubIcon className="w-full h-full" strokeWidth={1.5} />
                  </div>
                )}

                {/* Card Content */}
                <div className="relative z-10">
                  {/* Squircle icon badge */}
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0 mb-3",
                      squircleBg
                    )}
                  >
                    {SubIcon && <SubIcon className="w-5 h-5 text-white" strokeWidth={2.2} />}
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-sm sm:text-base text-[#22211f] dark:text-foreground tracking-tight group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                    {sub.label}
                  </h3>

                  {/* Description */}
                  {sub.description && (
                    <p className="mt-1 text-xs text-[#6e6b62] dark:text-muted-foreground line-clamp-3 leading-relaxed">
                      {sub.description}
                    </p>
                  )}
                </div>

                {/* Card Footer */}
                <div className="relative z-10 mt-4 pt-2.5 border-t border-[#f0eee6] dark:border-border/60 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#8c531b] dark:text-amber-400 flex items-center gap-1 group-hover:gap-1.5 transition-all">
                    Open Section &rarr;
                  </span>
                  <div className="w-7 h-7 rounded-full bg-[#f6eee4] dark:bg-amber-950/40 text-[#7a4214] dark:text-amber-300 flex items-center justify-center shrink-0 group-hover:bg-[#eddccb] dark:group-hover:bg-amber-900/50 transition-colors">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
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

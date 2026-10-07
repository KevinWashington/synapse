import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

function SearchInput({ className, type = "search", ...props }) {
  return (
    <div className="relative w-full">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--syn-text-secondary)]"
      />
      <Input
        type={type}
        className={cn(
          "h-11 rounded-lg border-[#dfe4ef] bg-white pl-10 text-sm shadow-none",
          className
        )}
        {...props}
      />
    </div>
  );
}

export { SearchInput };

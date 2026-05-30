import { FilterIcon, SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function ArticleListFilters({
  filterStatus,
  searchTerm,
  setFilterStatus,
  setSearchTerm,
  statusList,
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--syn-text-secondary)]" />
        <Input
          type="text"
          placeholder="Pesquisar artigos..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="h-9 pl-10"
        />
      </div>

      <div className="flex items-center gap-2">
        <FilterIcon className="h-4 w-4 text-[var(--syn-text-secondary)]" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue placeholder="Filtrar por..." />
          </SelectTrigger>
          <SelectContent>
            {statusList.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default ArticleListFilters;

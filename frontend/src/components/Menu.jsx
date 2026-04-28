import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  FileText,
  Folder,
  Menu as MenuIcon,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/Sheet";
import ThemeToggle from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import { projectService } from "@/features/projects/services/projectService";

const NAV_ITEMS = [
  {
    path: "/projetos",
    label: "Projetos",
    icon: Folder,
  },
  {
    path: "/artigos",
    label: "Biblioteca",
    icon: BookOpen,
  },
  {
    path: "/artigos?status=excluido",
    label: "Lixeira",
    icon: Trash2,
  },
];

const PROJECT_STYLES = [
  "bg-[#eeeaff] text-[#6259ff]",
  "bg-[#eaf8f0] text-[#3bad68]",
  "bg-[#e9f2ff] text-[#2478ff]",
  "bg-[#eefaf2] text-[#36b66b]",
  "bg-[#fff7e8] text-[#ff9f1c]",
  "bg-[#f0edff] text-[#7b61ff]",
];

function isActivePath(pathname, search, path) {
  const basePath = path.split("?")[0];
  if (path.includes("?")) {
    return `${pathname}${search}` === path;
  }
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

function NavItem({ item, onItemClick }) {
  const location = useLocation();
  const active = isActivePath(location.pathname, location.search, item.path);

  return (
    <Link
      to={item.path}
      onClick={onItemClick}
      className={cn(
        "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
        active
          ? "bg-[#eeefff] text-[#0f1734]"
          : "text-[#56627f] hover:bg-[#f5f7fc] hover:text-[#0f1734]"
      )}
    >
      <item.icon className="h-[18px] w-[18px]" />
      <span>{item.label}</span>
    </Link>
  );
}

function ProjectNavItem({ project, index, onItemClick }) {
  const location = useLocation();
  const active = location.pathname === `/projetos/${project.id}`;
  const iconClass = PROJECT_STYLES[index % PROJECT_STYLES.length];

  return (
    <Link
      to={`/projetos/${project.id}`}
      onClick={onItemClick}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
        active ? "bg-[#f5f6ff]" : "hover:bg-[#f7f8fc]"
      )}
    >
      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", iconClass)}>
        <FileText className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold leading-5 text-[#2c3658]">
          {project.title}
        </span>
        <span className="block truncate text-xs text-[#74809d]">
          {project.articleCount} artigos
        </span>
      </span>
      {active && <span className="h-1.5 w-1.5 rounded-full bg-[#6259ff]" />}
    </Link>
  );
}

function SidebarContent({ onItemClick }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    let ignore = false;

    async function loadProjects() {
      const response = await projectService.getAllProjects({ page: 1, limit: 6 });
      if (!ignore) {
        setProjects(response.projects);
      }
    }

    loadProjects().catch(() => {
      if (!ignore) {
        setProjects([]);
      }
    });

    return () => {
      ignore = true;
    };
  }, []);

  const visibleProjects = useMemo(() => projects.slice(0, 6), [projects]);

  return (
    <div className="flex h-full flex-col bg-[#fbfcff]">
      <div className="px-6 pb-6 pt-5">
        <Link
          to="/projetos"
          onClick={onItemClick}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#6259ff] text-white shadow-[0_10px_24px_rgba(98,89,255,0.22)]"
          aria-label="Synapse"
        >
          <FileText className="h-5 w-5" />
        </Link>
      </div>

      <nav className="space-y-1 px-4">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.label} item={item} onItemClick={onItemClick} />
        ))}
      </nav>

      <div className="mx-6 my-6 h-px bg-[#edf0f7]" />

      <section className="min-h-0 flex-1 px-4">
        <div className="mb-4 flex items-center justify-between px-1">
          <p className="text-xs font-medium text-[#56627f]">Seus projetos</p>
          <button
            type="button"
            onClick={() => {
              onItemClick?.();
              navigate("/projetos");
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#edf0f7] bg-white text-[#253252] transition-colors hover:bg-[#f5f7fc]"
            aria-label="Novo projeto"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 overflow-y-auto">
          {visibleProjects.map((project, index) => (
            <ProjectNavItem
              key={project.id}
              project={project}
              index={index}
              onItemClick={onItemClick}
            />
          ))}
        </div>
      </section>

      <div className="space-y-4 px-5 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[#56627f]">
            <Sparkles className="h-4 w-4" />
            <span>Tema</span>
          </div>
          <ThemeToggle className="h-8 w-10 rounded-full border-[#dfe4ef] bg-[#eef1f7] text-[#68748f] shadow-none hover:bg-[#e8ecf4]" />
        </div>
      </div>
    </div>
  );
}

function Menu() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      <div className="fixed left-4 top-4 z-50 md:hidden">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="rounded-full bg-white">
              <MenuIcon size={20} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[240px] border-0 bg-[#fbfcff] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu de navegacao</SheetTitle>
            </SheetHeader>
            <SidebarContent onItemClick={() => setIsMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      <aside className="fixed left-0 top-0 z-40 hidden h-full w-[240px] border-r border-[#edf0f7] bg-[#fbfcff] md:block">
        <SidebarContent />
      </aside>
    </>
  );
}

export default Menu;

import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  FileText,
  Folder,
  Home,
  Menu as MenuIcon,
  Plus,
  Sparkles,
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
    path: "/",
    label: "Início",
    icon: Home,
  },
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
  if (path === "/") {
    return pathname === "/" || pathname === "/dashboard";
  }
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
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff]/40",
        active
          ? "bg-[#eeefff] text-[#0f1734] dark:bg-[#312e68] dark:text-[#f4f3ff]"
          : "text-[var(--syn-text-secondary)] hover:bg-[var(--syn-sidebar-hover)] hover:text-[var(--syn-text-primary)]"
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
        "group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff]/40",
        active ? "bg-[#f5f6ff] dark:bg-[#292744]" : "hover:bg-[var(--syn-sidebar-hover)]"
      )}
    >
      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", iconClass)}>
        <FileText className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold leading-5 text-[var(--syn-text-primary)]">
          {project.title}
        </span>
        <span className="block truncate text-xs text-[var(--syn-text-secondary)]">
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
    <div className="flex h-full flex-col bg-[var(--syn-sidebar-bg)]">
      <div className="px-6 pb-6 pt-5">
        <Link
          to="/"
          onClick={onItemClick}
          className="inline-flex cursor-pointer rounded-md text-xl font-semibold tracking-tight text-[var(--syn-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff]/40"
        >
          Synapse
        </Link>
      </div>

      <nav className="space-y-1 px-4">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.label} item={item} onItemClick={onItemClick} />
        ))}
      </nav>

      <div className="mx-6 my-6 h-px bg-[var(--syn-border)]" />

      <section className="min-h-0 flex-1 px-4">
        <div className="mb-4 flex items-center justify-between px-1">
          <p className="text-xs font-medium text-[var(--syn-text-secondary)]">Seus projetos</p>
          <button
            type="button"
            onClick={() => {
              onItemClick?.();
              navigate("/projetos");
            }}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] text-[var(--syn-text-primary)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff]/40"
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
          <div className="flex items-center gap-2 text-sm text-[var(--syn-text-secondary)]">
            <Sparkles className="h-4 w-4" />
            <span>Tema</span>
          </div>
          <ThemeToggle className="h-8 w-10 rounded-full border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] text-[var(--syn-text-secondary)] shadow-none hover:bg-[var(--accent)]" />
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
            <Button variant="outline" size="icon" className="rounded-full bg-[var(--syn-bg-primary)]" aria-label="Abrir menu">
              <MenuIcon size={20} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[240px] border-0 bg-[var(--syn-sidebar-bg)] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu de navegação</SheetTitle>
            </SheetHeader>
            <SidebarContent onItemClick={() => setIsMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      <aside className="fixed left-0 top-0 z-40 hidden h-full w-[240px] border-r border-[var(--syn-border)] bg-[var(--syn-sidebar-bg)] md:block">
        <SidebarContent />
      </aside>
    </>
  );
}

export default Menu;

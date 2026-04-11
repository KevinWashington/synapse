import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Bot,
  Settings,
  ChevronDown,
  ChevronRight,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/Sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth";

const NAV_ITEMS = [
  {
    path: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    path: "/projetos",
    label: "Projetos",
    icon: FolderKanban,
  },
  {
    path: "/artigos",
    label: "Artigos",
    icon: FileText,
  },
  {
    path: "/ia/chat",
    label: "Inteligência Artificial",
    icon: Bot,
  },
  {
    label: "Configurações",
    icon: Settings,
    children: [
      { path: "/Settings", label: "Provedores de IA" },
      { path: "/Settings/preferencias", label: "Preferências" },
    ],
  },
];

function NavItem({ item, isCollapsed, onItemClick }) {
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);

  const hasChildren = item.children && item.children.length > 0;

  const isActive = (path) => {
    if (!path) return false;
    const basePath = path.split("?")[0];
    return location.pathname === basePath || location.pathname.startsWith(basePath + "/");
  };

  const isGroupActive = hasChildren && item.children.some((child) => isActive(child.path));

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
            isGroupActive
              ? "text-[var(--syn-sidebar-active)] bg-[var(--syn-sidebar-hover)]"
              : "text-[var(--syn-sidebar-text)] hover:text-[var(--syn-sidebar-active)] hover:bg-[var(--syn-sidebar-hover)]",
            isCollapsed && "justify-center px-2"
          )}
        >
          <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
          {!isCollapsed && (
            <>
              <span className="flex-1 text-left">{item.label}</span>
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 opacity-50" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 opacity-50" />
              )}
            </>
          )}
        </button>

        {!isCollapsed && isExpanded && (
          <div className="mt-1 ml-4 pl-3 border-l border-white/10 space-y-0.5">
            {item.children.map((child) => (
              <Link
                key={child.path}
                to={child.path}
                onClick={onItemClick}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200",
                  isActive(child.path)
                    ? "text-[var(--syn-sidebar-active)] bg-[var(--syn-sidebar-hover)]"
                    : "text-[var(--syn-sidebar-text)] hover:text-[var(--syn-sidebar-active)] hover:bg-[var(--syn-sidebar-hover)]"
                )}
              >
                {isActive(child.path) && (
                  <span className="w-1 h-1 rounded-full bg-[var(--syn-sidebar-accent)]" />
                )}
                <span>{child.label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      to={item.path}
      onClick={onItemClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative",
        isActive(item.path)
          ? "text-[var(--syn-sidebar-active)] bg-[var(--syn-sidebar-hover)]"
          : "text-[var(--syn-sidebar-text)] hover:text-[var(--syn-sidebar-active)] hover:bg-[var(--syn-sidebar-hover)]",
        isCollapsed && "justify-center px-2"
      )}
    >
      {isActive(item.path) && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[var(--syn-sidebar-accent)]" />
      )}
      <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
      {!isCollapsed && <span>{item.label}</span>}
    </Link>
  );
}

function Menu({ isMenuOpen, setIsMenuOpen }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user } = useAuth();

  const handleMinimizeMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const SidebarContent = ({ onItemClick }) => (
    <div className="flex flex-col h-full">
      {/* User profile section */}
      <div className={cn("px-4 pt-5 pb-4", !isMenuOpen && "px-2 flex justify-center")}>
        {isMenuOpen ? (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src="/avatar.png" alt={user?.name} />
              <AvatarFallback className="bg-[var(--syn-sidebar-accent)] text-white text-xs">
                {user?.name?.slice(0, 2).toUpperCase() || "SY"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--syn-sidebar-active)] truncate">
                {user?.name || "Synapse"}
              </p>
              <p className="text-xs text-[var(--syn-sidebar-text)] truncate">
                {user?.email || "synapse@app.com"}
              </p>
            </div>
          </div>
        ) : (
          <Avatar className="h-8 w-8">
            <AvatarImage src="/avatar.png" alt={user?.name} />
            <AvatarFallback className="bg-[var(--syn-sidebar-accent)] text-white text-[10px]">
              {user?.name?.slice(0, 2).toUpperCase() || "S"}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.label}
            item={item}
            isCollapsed={!isMenuOpen}
            onItemClick={onItemClick}
          />
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="px-3 py-3 border-t border-white/10">
        <button
          onClick={handleMinimizeMenu}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--syn-sidebar-text)] hover:text-[var(--syn-sidebar-active)] hover:bg-[var(--syn-sidebar-hover)] transition-all duration-200"
        >
          {isMenuOpen ? (
            <>
              <PanelLeftClose className="h-[18px] w-[18px]" />
              <span>Recolher</span>
            </>
          ) : (
            <PanelLeftOpen className="h-[18px] w-[18px]" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile trigger */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <MenuIcon size={20} />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[240px] border-0 bg-[var(--syn-sidebar-bg)] p-0"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Menu de Navegação</SheetTitle>
            </SheetHeader>
            <SidebarContent onItemClick={() => setIsMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-full flex-col bg-[var(--syn-sidebar-bg)] transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] md:flex",
          isMenuOpen ? "w-[220px]" : "w-16"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}

export default Menu;



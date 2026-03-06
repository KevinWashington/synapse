import Menu from "../components/Menu";
import ThemeToggle from "../components/ThemeToggle";
import { Outlet, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserIcon, LogOut, Bell, ArrowLeft } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth";
import { PageTitleProvider, usePageTitleValue } from "@/context/pageTitleContext";

const Layout = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(true);

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "var(--syn-sidebar-bg)" }}>
      <Menu setIsMenuOpen={setIsMenuOpen} isMenuOpen={isMenuOpen} />

      {/* Main content area */}
      <div
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-all",
          isMenuOpen ? "md:ml-[220px]" : "md:ml-16"
        )}
        style={{ transition: "margin var(--syn-transition)" }}
      >
        {/* Content card wrapper */}
        <div className="flex-1 flex flex-col m-0 md:m-2 md:ml-0 rounded-none md:rounded-xl bg-[var(--syn-bg-secondary)] dark:bg-[var(--syn-bg-secondary)] overflow-hidden">
          <PageTitleProvider>
            <HeaderBar navigate={navigate} logout={logout} user={user} />

            {/* Page content */}
            <div className="flex-1 overflow-y-auto p-6">
              <Outlet />
            </div>
          </PageTitleProvider>
        </div>
      </div>
    </div>
  );
};

function HeaderBar({ navigate, logout, user }) {
  const { title, backUrl, actions, badge } = usePageTitleValue();

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-[var(--syn-bg-primary)] dark:bg-[var(--syn-bg-primary)] border-b border-[var(--syn-border)]">
      <div className="flex items-center gap-3 min-w-0">
        {backUrl && (
          <button
            onClick={() => navigate(backUrl)}
            className="h-8 w-8 rounded-lg border border-[var(--syn-border)] flex items-center justify-center text-[var(--syn-text-secondary)] hover:bg-[var(--syn-bg-secondary)] transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        {title && (
          <h1 className="text-lg font-semibold text-[var(--syn-text-primary)] truncate">
            {title}
          </h1>
        )}
        {badge}
      </div>

      <div className="flex items-center gap-3">
        {actions && (
          <div className="flex items-center gap-2">{actions}</div>
        )}
        <ThemeToggle />
        <Button variant="ghost" size="icon" className="h-9 w-9 text-[var(--syn-text-secondary)]">
          <Bell className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-9 px-2">
              <Avatar className="h-7 w-7">
                <AvatarImage src="/avatar.png" alt="Perfil" />
                <AvatarFallback className="text-[10px]">
                  <UserIcon className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-[var(--syn-text-primary)] hidden sm:block">
                {user?.name || "Usuário"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              <LogOut size={16} />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default Layout;

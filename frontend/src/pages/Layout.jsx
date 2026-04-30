import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Menu from "@components/Menu";
import ThemeToggle from "@components/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { UserIcon, LogOut, ArrowLeft, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { useAuth } from "@/features/auth";
import { PageTitleProvider } from "@/context/pageTitleContext";
import { usePageTitleValue } from "@hooks/usePageTitleValue";

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const isArticleWorkspace = /^\/projetos\/[^/]+\/artigos\/[^/]+/.test(location.pathname);

  return (
    <div className="flex min-h-screen bg-[#fbfcff] text-[#0f1734]">
      {!isArticleWorkspace ? <Menu /> : null}

      <div className={`flex min-h-screen flex-1 flex-col ${isArticleWorkspace ? "" : "md:ml-[240px]"}`}>
        <PageTitleProvider>
          {!isArticleWorkspace ? (
            <HeaderBar navigate={navigate} logout={logout} user={user} />
          ) : null}

          <main
            className={
              isArticleWorkspace
                ? "h-screen flex-1 overflow-hidden p-0"
                : "flex-1 overflow-y-auto px-5 pb-8 pt-4 md:px-10 lg:px-14"
            }
          >
            <Outlet />
          </main>
        </PageTitleProvider>
      </div>
    </div>
  );
};

function HeaderBar({ navigate, logout, user }) {
  const { title, backUrl, actions, badge } = usePageTitleValue();

  return (
    <header className="flex h-[72px] items-center justify-between bg-[#fbfcff] px-5 pt-3 md:px-10 lg:px-14">
      <div className="flex min-w-0 items-center gap-3">
        {backUrl && (
          <button
            onClick={() => navigate(backUrl)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e8ebf4] bg-white text-[#56627f] transition-colors hover:bg-[#f4f6fb]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        {title && (
          <h1 className="truncate text-lg font-semibold text-[#101936]">
            {title}
          </h1>
        )}
        {badge}
      </div>

      <div className="flex items-center gap-3">
        {actions && <div className="flex items-center gap-2">{actions}</div>}
        <ThemeToggle className="h-10 w-10 rounded-full border-[#edf0f7] bg-white text-[#182344] shadow-none hover:bg-[#f6f7fb]" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex h-10 items-center gap-2 rounded-full px-1.5 text-[#182344] hover:bg-[#f6f7fb]"
            >
              <Avatar className="h-9 w-9">
                <AvatarImage src="/avatar.png" alt="Perfil" />
                <AvatarFallback className="bg-[#eef1ff] text-[10px] text-[#6259ff]">
                  <UserIcon className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="h-4 w-4" />
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

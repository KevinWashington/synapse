import { Link, useNavigate } from "react-router-dom";
import { ArrowLeftIcon, ChevronDownIcon, ChevronRightIcon, LogOutIcon, SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { useAuth } from "@/features/auth";
import { UserInbox } from "@features/inbox/public/components";

function getInitials(name, email) {
  const source = name?.trim() || email?.split("@")[0] || "Conta";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function AppHeader({ actions, backUrl, breadcrumbs = [], compact = false, title }) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const hasBreadcrumbs = breadcrumbs.length > 0;

  async function handleLogout() {
    const result = await logout();
    if (result?.success) {
      navigate("/login");
    }
  }

  return (
    <header
      data-density={compact ? "compact" : "regular"}
      className="flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] pl-20 pr-5 md:px-10"
    >
      <div className="flex min-w-0 items-center gap-3">
        {backUrl ? (
          <button
            type="button"
            aria-label="Voltar"
            onClick={() => navigate(backUrl)}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] text-[var(--syn-text-secondary)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff]/40"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </button>
        ) : null}

        {hasBreadcrumbs ? (
          <nav aria-label="Navegação estrutural" className="flex min-w-0 items-center gap-2 text-sm font-medium">
            {breadcrumbs.map((item, index) => (
              <span key={`${item.label}-${index}`} className="contents">
                {index ? (
                  <ChevronRightIcon
                    aria-hidden="true"
                    data-testid="breadcrumb-separator"
                    className="h-3.5 w-3.5 shrink-0 text-[var(--syn-text-secondary)]"
                  />
                ) : null}
                {item.href ? (
                  <Link to={item.href} className="cursor-pointer truncate rounded-sm text-[#6259ff] hover:text-[#5148ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff]/40">
                    {item.label}
                  </Link>
                ) : (
                  <span className="truncate text-[var(--syn-text-secondary)]" aria-current="page">
                    {item.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        ) : title ? (
          <h1 className="truncate text-lg font-semibold text-[var(--syn-text-primary)]">{title}</h1>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        <UserInbox />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              aria-label="Abrir menu da conta"
              className="flex h-10 items-center gap-2 rounded-full px-1.5 text-[var(--syn-text-primary)] hover:bg-[var(--accent)]"
            >
              <Avatar className="h-9 w-9">
                {user?.avatar ? <AvatarImage src={user.avatar} alt={user?.name || "Perfil"} /> : null}
                <AvatarFallback className="bg-[#eef1ff] text-[11px] font-semibold text-[#6259ff] dark:bg-[#312e68] dark:text-[#c7c4ff]">
                  {getInitials(user?.name, user?.email)}
                </AvatarFallback>
              </Avatar>
              <ChevronDownIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="max-w-56">
              <span className="block truncate">{user?.name || "Minha conta"}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <SettingsIcon size={16} />
              <span>Configurações</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout}>
              <LogOutIcon size={16} />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default AppHeader;

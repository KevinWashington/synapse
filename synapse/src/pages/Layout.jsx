import Menu from "../components/Menu";
import Breadcrumbs from "../components/Breadcrumbs";
import ThemeToggle from "../components/ThemeToggle";
import { Outlet, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeftIcon, UserIcon, LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const Layout = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(true);

  return (
    <div className="flex min-h-screen bg-sidebar">
      <Menu
        className=""
        setIsMenuOpen={setIsMenuOpen}
        isMenuOpen={isMenuOpen}
      />
      <Card
        className={cn(
          "bg-background flex-1 flex flex-col transition-all duration-300 my-2 mr-2 p-4 rounded-xl shadow-lg gap-2",
          isMenuOpen ? "ml-63" : "ml-16"
        )}
      >
        <header className="flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(-1)}
              className="flex items-center gap-2"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </Button>
            <Breadcrumbs />
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {user?.name || "Usuário"}
                  </span>
                  <Avatar>
                    <AvatarImage src="/avatar.png" alt="Perfil" />
                    <AvatarFallback>
                      <UserIcon className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
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
                  <LogOut size={18} />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <Separator className="py-0" />

        <div className="flex-1 rounded-b-xl pt-2">
          <Outlet />
        </div>
      </Card>
    </div>
  );
};

export default Layout;

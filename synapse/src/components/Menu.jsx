import { Link, useLocation } from "react-router-dom";
import {
  Home,
  User,
  Settings,
  LogOut,
  Folder,
  Menu as MenuIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function Menu({ isMenuOpen, setIsMenuOpen }) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { path: "/", label: "Dashboard", icon: Home },
    { path: "/projetos", label: "Projetos", icon: Folder },
    { path: "/perfil", label: "Perfil", icon: User },
    { path: "/configuracoes", label: "Configurações", icon: Settings },
  ];

  const isActive = (path) => location.pathname === path;

  const handleMinimizeMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const MenuContent = ({ onItemClick }) => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4">
        <h2 className="text-xl font-bold text-sidebar-foreground text-center">
          {isMenuOpen ? "Synapse" : "S"}
        </h2>
      </div>

      {/* Menu Items */}
      <div className="flex-1">
        <nav className="space-y-1 px-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onItemClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive(item.path)
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  !isMenuOpen && "px-2 justify-center"
                )}
              >
                <Icon size={18} />
                {isMenuOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      <Separator />

      {/* Footer */}
      <div className="p-4 flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleMinimizeMenu}
          aria-label="Minimizar menu"
        >
          <MenuIcon className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Menu Mobile */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <MenuIcon size={20} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu de Navegação</SheetTitle>
            </SheetHeader>
            <MenuContent onItemClick={() => setIsOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Menu Desktop */}
      <aside
        className={
          `hidden md:flex flex-col fixed left-0 top-0 z-40 h-full border-r-0 ` +
          (isMenuOpen ? "w-62" : "w-16") +
          " transition-width duration-300"
        }
      >
        <MenuContent />
      </aside>
    </>
  );
}

export default Menu;

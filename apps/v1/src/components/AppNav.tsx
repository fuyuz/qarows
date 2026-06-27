import { useEffect, useMemo, useRef, useState } from "react";
import { Compass } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { isValidSession } from "@qarows/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApp } from "@/context/AppContext";

interface NavLinkItem {
  label: string;
  to: string;
}

export function AppNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { definition, session } = useApp();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const links = useMemo(() => {
    const items: NavLinkItem[] = [];

    if (location.pathname === "/run") {
      items.push({ label: "セッション設定", to: "/session" });
      items.push({ label: "ファイル読み込み", to: "/load" });
    } else if (location.pathname === "/session") {
      items.push({ label: "ファイル読み込み", to: "/load" });
      if (session && isValidSession(session)) {
        items.push({ label: "テスト実行", to: "/run" });
      }
    } else if (location.pathname === "/load" && definition) {
      items.push({ label: "セッション設定", to: "/session" });
      if (session && isValidSession(session)) {
        items.push({ label: "テスト実行", to: "/run" });
      }
    }

    return items;
  }, [definition, location.pathname, session]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  if (links.length === 0) return null;

  return (
    <div ref={rootRef} className="fixed top-3.5 right-5 z-40">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-full shadow-sm"
            aria-label="ナビゲーション"
          >
            <Compass className="size-4.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
            移動
          </DropdownMenuLabel>
          {links.map((link) => (
            <DropdownMenuItem
              key={link.to}
              onSelect={() => {
                setOpen(false);
                navigate(link.to);
              }}
            >
              {link.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

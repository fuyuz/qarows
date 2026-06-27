import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isValidSession } from "@qarows/shared";
import { useApp } from "@/context/AppContext";

interface NavLinkItem {
  label: string;
  to: string;
}

function NavIcon() {
  return (
    <svg className="app-nav__icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 5.5 13.8 13.2 12 12 10.2 13.2Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.35"
        strokeLinejoin="round"
      />
    </svg>
  );
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

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (links.length === 0) return null;

  return (
    <div ref={rootRef} className={`app-nav${open ? " app-nav--open" : ""}`}>
      <button
        type="button"
        className="app-nav__trigger"
        aria-label="ナビゲーション"
        aria-expanded={open}
        aria-controls="app-nav-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <NavIcon />
      </button>
      <nav id="app-nav-panel" className="app-nav__panel" aria-label="ページ移動">
        <p className="app-nav__title">移動</p>
        <ul className="app-nav__list">
          {links.map((link) => (
            <li key={link.to}>
              <button
                type="button"
                className="app-nav__link"
                onClick={() => {
                  setOpen(false);
                  navigate(link.to);
                }}
              >
                {link.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

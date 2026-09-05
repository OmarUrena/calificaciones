"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { CurrentUser } from "@/types/auth";
import { AppSidebar } from "./AppSidebar";

export function MobileNav({ user }: { user?: CurrentUser | null }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const closeMenu = () => dialogRef.current?.close();

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const onResize = () => {
      if (desktop.matches) dialogRef.current?.close();
    };
    desktop.addEventListener("change", onResize);
    return () => desktop.removeEventListener("change", onResize);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isOpen]);

  return (
    <>
      <Button
        className="md:hidden"
        variant="outline"
        size="icon"
        aria-label="Abrir menú de navegación"
        aria-haspopup="dialog"
        aria-controls="mobile-navigation"
        aria-expanded={isOpen}
        onClick={() => {
          dialogRef.current?.showModal();
          setIsOpen(true);
        }}
      >
        <Menu aria-hidden="true" />
      </Button>
      <dialog
        ref={dialogRef}
        id="mobile-navigation"
        aria-label="Menú de navegación"
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-80 max-w-[85vw] border-0 bg-white p-0 text-institutional-gray-dark backdrop:bg-black/40"
        onClose={() => setIsOpen(false)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right ||
              event.clientY < bounds.top || event.clientY > bounds.bottom) closeMenu();
        }}
      >
        <div className="relative min-h-full">
          <Button
            className="absolute top-4 right-3"
            variant="ghost"
            size="icon"
            aria-label="Cerrar menú de navegación"
            onClick={closeMenu}
          >
            <X aria-hidden="true" />
          </Button>
          <AppSidebar user={user} mobile onNavigate={closeMenu} />
        </div>
      </dialog>
    </>
  );
}

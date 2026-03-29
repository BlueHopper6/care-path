"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, LayoutDashboard, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AuthModal } from "./auth-modal";
import { UserDropdown } from "./user-dropdown";

interface User {
  email: string;
  name?: string;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/history", label: "History", icon: History },
];

export function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"signin" | "signup">("signin");

  const openSignIn = () => {
    setAuthModalMode("signin");
    setAuthModalOpen(true);
  };

  const openSignUp = () => {
    setAuthModalMode("signup");
    setAuthModalOpen(true);
  };

  // Placeholder auth functions - ready for backend integration
  const handleSignIn = async (email: string, password: string) => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // Mock validation - replace with real auth later
    if (password.length < 6) {
      throw new Error("Invalid credentials");
    }
    
    // Simulate successful login
    setUser({ email, name: email.split("@")[0] });
  };

  const handleSignUp = async (email: string, password: string) => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // Mock validation - replace with real auth later
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    
    // Simulate successful signup
    setUser({ email, name: email.split("@")[0] });
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          {/* Left: Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Heart className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold tracking-tight">CarePath</span>
          </Link>

          {/* Center: Navigation */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                    isActive && "bg-accent text-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right: Auth section */}
          <div className="flex items-center gap-2">
            {/* Mobile nav items */}
            <nav className="flex items-center gap-1 md:hidden">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg p-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                      isActive && "bg-accent text-accent-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </Link>
                );
              })}
            </nav>

            {user ? (
              <UserDropdown user={user} onLogout={handleLogout} />
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={openSignIn}>
                  Sign In
                </Button>
                <Button size="sm" onClick={openSignUp}>
                  Sign Up
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        defaultMode={authModalMode}
      />
    </>
  );
}

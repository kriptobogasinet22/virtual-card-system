"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Users, CreditCard, DollarSign, RefreshCcw, LogOut, LayoutDashboard, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AdminLayoutProps {
  children: ReactNode
  title: string
}

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" })
      router.push("/admin/login")
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-md">
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold">Admin Panel</h2>
        </div>
        <nav className="p-4 space-y-2">
          <Link
            href="/admin/dashboard"
            className={`flex items-center p-2 rounded-lg ${
              isActive("/admin/dashboard") ? "bg-gray-100 text-gray-900" : "hover:bg-gray-100 text-gray-700"
            }`}
          >
            <LayoutDashboard className="mr-2 h-5 w-5" />
            Dashboard
          </Link>
          <Link
            href="/admin/payments"
            className={`flex items-center p-2 rounded-lg ${
              isActive("/admin/payments") ? "bg-gray-100 text-gray-900" : "hover:bg-gray-100 text-gray-700"
            }`}
          >
            <DollarSign className="mr-2 h-5 w-5" />
            Ödemeler
          </Link>
          <Link
            href="/admin/redemptions"
            className={`flex items-center p-2 rounded-lg ${
              isActive("/admin/redemptions") ? "bg-gray-100 text-gray-900" : "hover:bg-gray-100 text-gray-700"
            }`}
          >
            <RefreshCcw className="mr-2 h-5 w-5" />
            Kart Bozumları
          </Link>
          <Link
            href="/admin/cards"
            className={`flex items-center p-2 rounded-lg ${
              isActive("/admin/cards") ? "bg-gray-100 text-gray-900" : "hover:bg-gray-100 text-gray-700"
            }`}
          >
            <CreditCard className="mr-2 h-5 w-5" />
            Sanal Kartlar
          </Link>
          <Link
            href="/admin/users"
            className={`flex items-center p-2 rounded-lg ${
              isActive("/admin/users") ? "bg-gray-100 text-gray-900" : "hover:bg-gray-100 text-gray-700"
            }`}
          >
            <Users className="mr-2 h-5 w-5" />
            Kullanıcılar
          </Link>
          <Link
            href="/admin/settings"
            className={`flex items-center p-2 rounded-lg ${
              isActive("/admin/settings") ? "bg-gray-100 text-gray-900" : "hover:bg-gray-100 text-gray-700"
            }`}
          >
            <Settings className="mr-2 h-5 w-5" />
            Ayarlar
          </Link>
          <Button
            variant="ghost"
            className="flex items-center w-full p-2 rounded-lg hover:bg-gray-100 text-gray-700 justify-start"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-5 w-5" />
            Çıkış Yap
          </Button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-6">{title}</h1>
        {children}
      </div>
    </div>
  )
}

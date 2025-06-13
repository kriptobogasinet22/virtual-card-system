"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, CreditCard, DollarSign, RefreshCcw, LogOut, LayoutDashboard, Settings } from "lucide-react"

interface DashboardProps {
  stats: {
    usersCount: number
    cardsCount: number
    pendingPaymentsCount: number
    pendingRedemptionsCount: number
  }
}

export default function AdminDashboard({ stats }: DashboardProps) {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)

    try {
      await fetch("/api/admin/logout", { method: "POST" })
      router.push("/admin/login")
    } catch (error) {
      console.error("Logout error:", error)
      setLoggingOut(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-md">
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold">Admin Panel</h2>
        </div>
        <nav className="p-4 space-y-2">
          <Link href="/admin/dashboard" className="flex items-center p-2 rounded-lg bg-gray-100 text-gray-900">
            <LayoutDashboard className="mr-2 h-5 w-5" />
            Dashboard
          </Link>
          <Link href="/admin/payments" className="flex items-center p-2 rounded-lg hover:bg-gray-100 text-gray-700">
            <DollarSign className="mr-2 h-5 w-5" />
            Ödemeler
            {stats.pendingPaymentsCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                {stats.pendingPaymentsCount}
              </span>
            )}
          </Link>
          <Link href="/admin/redemptions" className="flex items-center p-2 rounded-lg hover:bg-gray-100 text-gray-700">
            <RefreshCcw className="mr-2 h-5 w-5" />
            Kart Bozumları
            {stats.pendingRedemptionsCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                {stats.pendingRedemptionsCount}
              </span>
            )}
          </Link>
          <Link href="/admin/cards" className="flex items-center p-2 rounded-lg hover:bg-gray-100 text-gray-700">
            <CreditCard className="mr-2 h-5 w-5" />
            Sanal Kartlar
          </Link>
          <Link href="/admin/users" className="flex items-center p-2 rounded-lg hover:bg-gray-100 text-gray-700">
            <Users className="mr-2 h-5 w-5" />
            Kullanıcılar
          </Link>
          <Link href="/admin/settings" className="flex items-center p-2 rounded-lg hover:bg-gray-100 text-gray-700">
            <Settings className="mr-2 h-5 w-5" />
            Ayarlar
          </Link>
          <Button
            variant="ghost"
            className="flex items-center w-full p-2 rounded-lg hover:bg-gray-100 text-gray-700 justify-start"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <LogOut className="mr-2 h-5 w-5" />
            {loggingOut ? "Çıkış Yapılıyor..." : "Çıkış Yap"}
          </Button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Toplam Kullanıcı</CardTitle>
              <Users className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.usersCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Toplam Kart</CardTitle>
              <CreditCard className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.cardsCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Bekleyen Ödemeler</CardTitle>
              <DollarSign className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingPaymentsCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Bekleyen Bozumlar</CardTitle>
              <RefreshCcw className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingRedemptionsCount}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Son İşlemler</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">Henüz işlem bulunmamaktadır.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sistem Durumu</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Telegram Bot</span>
                  <span className="text-sm font-medium text-green-500">Aktif</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Veritabanı</span>
                  <span className="text-sm font-medium text-green-500">Bağlı</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Son Güncelleme</span>
                  <span className="text-sm font-medium">{new Date().toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

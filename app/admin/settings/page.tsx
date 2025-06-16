"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle, RefreshCw } from "lucide-react"
import AdminLayout from "@/components/admin/admin-layout"

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [settings, setSettings] = useState({
    trx_wallet_address: "TXYourTronWalletAddressHere",
    card_price: "50",
  })
  const router = useRouter()

  const loadSettings = async () => {
    try {
      setLoading(true)
      setError("")

      // Oturum kontrolü
      const sessionResponse = await fetch("/api/admin/check-session")
      const sessionData = await sessionResponse.json()

      if (!sessionData.authenticated) {
        router.push("/admin/login")
        return
      }

      // Ayarları yükle
      console.log("Loading settings from database...")
      const settingsResponse = await fetch("/api/admin/settings")
      const settingsData = await settingsResponse.json()

      console.log("Settings response:", settingsData)

      if (settingsData.success) {
        console.log("Settings loaded successfully:", settingsData.settings)
        setSettings(settingsData.settings)
      } else {
        console.error("Failed to load settings:", settingsData.message)
        setError(settingsData.message || "Ayarlar yüklenemedi")
        // Hata durumunda da varsayılan ayarları kullan
        if (settingsData.settings) {
          setSettings(settingsData.settings)
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error)
      setError("Ayarlar yüklenirken bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSuccess(false)
    setError("")

    try {
      console.log("Submitting settings:", settings)

      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      })

      const data = await response.json()
      console.log("Settings update response:", data)

      if (data.success) {
        setSuccess(true)
        // Başarılı güncelleme sonrası ayarları yenile
        if (data.settings) {
          setSettings(data.settings)
        }
        // 3 saniye sonra success mesajını kaldır
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError(data.message || "Ayarlar kaydedilirken bir hata oluştu")
      }
    } catch (err) {
      console.error("Settings update error:", err)
      setError("Bir hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setSaving(false)
    }
  }

  const handleRefresh = () => {
    loadSettings()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Ayarlar yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <AdminLayout title="Ayarlar">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Sistem Ayarları</h2>
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Yenile
          </Button>
        </div>

        <Card className="max-w-2xl">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Temel Ayarlar</CardTitle>
              <CardDescription>Sanal kart satış sisteminin temel ayarlarını yapılandırın.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert className="bg-green-50 text-green-800 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription>Ayarlar başarıyla kaydedildi ve veritabanında güncellendi.</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="trx_wallet_address">TRX Cüzdan Adresi</Label>
                <Input
                  id="trx_wallet_address"
                  value={settings.trx_wallet_address}
                  onChange={(e) => setSettings({ ...settings, trx_wallet_address: e.target.value })}
                  placeholder="TXYourTronWalletAddressHere"
                  required
                />
                <p className="text-sm text-gray-500">
                  Kullanıcıların ödeme yapacağı TRX cüzdan adresi. Bu adres botda gösterilecektir.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="card_price">Kart Fiyatı (TRX)</Label>
                <Input
                  id="card_price"
                  type="number"
                  min="1"
                  step="0.01"
                  value={settings.card_price}
                  onChange={(e) => setSettings({ ...settings, card_price: e.target.value })}
                  placeholder="50"
                  required
                />
                <p className="text-sm text-gray-500">Sanal kartların satış fiyatı (TRX cinsinden).</p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <div className="text-sm text-gray-500">Son güncelleme: {new Date().toLocaleString("tr-TR")}</div>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Kaydediliyor...
                  </>
                ) : (
                  "Kaydet"
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </AdminLayout>
  )
}

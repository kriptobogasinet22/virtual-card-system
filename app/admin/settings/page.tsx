"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
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

  useEffect(() => {
    async function checkSessionAndLoadData() {
      try {
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
        }
      } catch (error) {
        console.error("Error loading settings:", error)
        setError("Ayarlar yüklenirken bir hata oluştu")
      } finally {
        setLoading(false)
      }
    }

    checkSessionAndLoadData()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSuccess(false)
    setError("")

    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(true)
      } else {
        setError(data.message || "Ayarlar kaydedilirken bir hata oluştu")
      }
    } catch (err) {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p>Yükleniyor...</p>
      </div>
    )
  }

  return (
    <AdminLayout title="Ayarlar">
      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Sistem Ayarları</CardTitle>
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
                <AlertDescription>Ayarlar başarıyla kaydedildi.</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="trx_wallet_address">TRX Cüzdan Adresi</Label>
              <Input
                id="trx_wallet_address"
                value={settings.trx_wallet_address}
                onChange={(e) => setSettings({ ...settings, trx_wallet_address: e.target.value })}
                required
              />
              <p className="text-sm text-gray-500">Kullanıcıların ödeme yapacağı TRX cüzdan adresi.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="card_price">Kart Fiyatı (TRX)</Label>
              <Input
                id="card_price"
                type="number"
                value={settings.card_price}
                onChange={(e) => setSettings({ ...settings, card_price: e.target.value })}
                required
              />
              <p className="text-sm text-gray-500">Sanal kartların satış fiyatı (TRX cinsinden).</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </AdminLayout>
  )
}

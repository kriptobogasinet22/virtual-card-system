"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, AlertCircle, CheckCircle } from "lucide-react"
import AdminLayout from "./admin-layout"

interface Card {
  id: string
  card_number: string
  cvv: string
  expiry_date: string
  balance: number
  is_assigned: boolean
  is_used: boolean
  assigned_at: string | null
  created_at: string
  user_id: string | null
  users?: {
    id: string
    telegram_id: number
    username: string | null
    first_name: string | null
    last_name: string | null
  }
}

interface CardsTableProps {
  cards: Card[]
}

export default function CardsTable({ cards }: CardsTableProps) {
  const router = useRouter()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newCard, setNewCard] = useState({
    card_number: "",
    cvv: "",
    expiry_date: "",
    balance: 0,
  })
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const handleAddCard = async () => {
    setProcessing(true)
    setError("")
    setSuccess("")

    try {
      // Client-side validation
      if (!newCard.card_number.trim()) {
        setError("Kart numarası gereklidir")
        setProcessing(false)
        return
      }
      if (!newCard.cvv.trim()) {
        setError("CVV gereklidir")
        setProcessing(false)
        return
      }
      if (!newCard.expiry_date.trim()) {
        setError("Son kullanma tarihi gereklidir")
        setProcessing(false)
        return
      }
      if (!newCard.balance || newCard.balance <= 0) {
        setError("Geçerli bir bakiye girin")
        setProcessing(false)
        return
      }

      const response = await fetch("/api/admin/add-card", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newCard),
      })

      // Handle non-JSON responses
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("API yanıtı JSON formatında değil")
      }

      const result = await response.json()

      if (response.ok && result.success) {
        setSuccess(result.message || "Kart başarıyla eklendi")
        setNewCard({
          card_number: "",
          cvv: "",
          expiry_date: "",
          balance: 0,
        })

        // Close dialog after a short delay
        setTimeout(() => {
          setIsAddDialogOpen(false)
          setSuccess("")
          router.refresh()
        }, 1500)
      } else {
        setError(result.message || "Kart eklenirken bir hata oluştu")
      }
    } catch (error) {
      console.error("Error adding card:", error)
      setError("İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setProcessing(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    try {
      const date = new Date(dateString)
      return date.toLocaleString("tr-TR")
    } catch {
      return "-"
    }
  }

  const getUserDisplayName = (user?: Card["users"]) => {
    if (!user) return "-"
    const name = `${user.first_name || ""} ${user.last_name || ""}`.trim()
    return name || "Bilinmeyen Kullanıcı"
  }

  const getUserSubtext = (user?: Card["users"]) => {
    if (!user?.username) return null
    return <div className="text-sm text-gray-500">@{user.username}</div>
  }

  const getStatusBadge = (card: Card) => {
    if (card.is_used) {
      return (
        <Badge variant="outline" className="bg-gray-100 text-gray-800">
          Kullanıldı
        </Badge>
      )
    } else if (card.is_assigned) {
      return (
        <Badge variant="outline" className="bg-blue-100 text-blue-800">
          Atandı
        </Badge>
      )
    } else {
      return (
        <Badge variant="outline" className="bg-green-100 text-green-800">
          Kullanılabilir
        </Badge>
      )
    }
  }

  const formatCardNumber = (cardNumber: string) => {
    // Add spaces every 4 digits for display
    return cardNumber.replace(/(.{4})/g, "$1 ").trim()
  }

  return (
    <AdminLayout title="Sanal Kartlar">
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Yeni Kart Ekle
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kart Numarası</TableHead>
              <TableHead>CVV</TableHead>
              <TableHead>Son Kullanma</TableHead>
              <TableHead>Bakiye</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Kullanıcı</TableHead>
              <TableHead>Atanma Tarihi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cards.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-4">
                  Henüz kart bulunmamaktadır.
                </TableCell>
              </TableRow>
            ) : (
              cards.map((card) => (
                <TableRow key={card.id}>
                  <TableCell className="font-mono">{formatCardNumber(card.card_number)}</TableCell>
                  <TableCell>{card.cvv}</TableCell>
                  <TableCell>{card.expiry_date}</TableCell>
                  <TableCell>{card.balance} TL</TableCell>
                  <TableCell>{getStatusBadge(card)}</TableCell>
                  <TableCell>
                    {getUserDisplayName(card.users)}
                    {getUserSubtext(card.users)}
                  </TableCell>
                  <TableCell>{formatDate(card.assigned_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Kart Ekleme Dialog */}
      <Dialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          setIsAddDialogOpen(open)
          if (!open) {
            setError("")
            setSuccess("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Sanal Kart Ekle</DialogTitle>
            <DialogDescription>Sisteme yeni bir sanal kart ekleyin.</DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="card_number">Kart Numarası</Label>
              <Input
                id="card_number"
                value={newCard.card_number}
                onChange={(e) => setNewCard({ ...newCard, card_number: e.target.value })}
                placeholder="1234 5678 9012 3456"
                maxLength={19}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cvv">CVV</Label>
                <Input
                  id="cvv"
                  value={newCard.cvv}
                  onChange={(e) => setNewCard({ ...newCard, cvv: e.target.value })}
                  placeholder="123"
                  maxLength={4}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiry_date">Son Kullanma Tarihi</Label>
                <Input
                  id="expiry_date"
                  value={newCard.expiry_date}
                  onChange={(e) => setNewCard({ ...newCard, expiry_date: e.target.value })}
                  placeholder="MM/YY"
                  maxLength={5}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="balance">Bakiye (TL)</Label>
              <Input
                id="balance"
                type="number"
                min="1"
                step="0.01"
                value={newCard.balance || ""}
                onChange={(e) => setNewCard({ ...newCard, balance: Number.parseFloat(e.target.value) || 0 })}
                placeholder="100"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false)
                setError("")
                setSuccess("")
              }}
              disabled={processing}
            >
              İptal
            </Button>
            <Button onClick={handleAddCard} disabled={processing}>
              {processing ? "Ekleniyor..." : "Ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}

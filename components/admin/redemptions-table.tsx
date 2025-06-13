"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Check, X } from "lucide-react"
import AdminLayout from "./admin-layout"

interface Redemption {
  id: string
  remaining_balance: number
  trx_wallet_address: string
  status: string
  created_at: string
  users?: {
    id: string
    telegram_id: number
    username: string | null
    first_name: string | null
    last_name: string | null
  } | null
  virtual_cards?: {
    id: string
    card_number: string
    expiry_date: string
    balance: number
  } | null
}

interface RedemptionsTableProps {
  redemptions: Redemption[]
}

export default function RedemptionsTable({ redemptions }: RedemptionsTableProps) {
  const router = useRouter()
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [selectedRedemption, setSelectedRedemption] = useState<Redemption | null>(null)
  const [processing, setProcessing] = useState(false)

  const getUserDisplayName = (user?: Redemption["users"]) => {
    if (!user) return "Bilinmeyen Kullanıcı"
    const firstName = user.first_name || ""
    const lastName = user.last_name || ""
    return `${firstName} ${lastName}`.trim() || "Bilinmeyen Kullanıcı"
  }

  const getUserSubtext = (user?: Redemption["users"]) => {
    if (!user || !user.username) return null
    return `@${user.username}`
  }

  const getCardNumber = (card?: Redemption["virtual_cards"]) => {
    if (!card || !card.card_number) return "****"
    return card.card_number.slice(-4)
  }

  const handleComplete = async () => {
    if (!selectedRedemption) return

    setProcessing(true)

    try {
      const response = await fetch("/api/admin/complete-redemption", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          redemptionId: selectedRedemption.id,
          telegramId: selectedRedemption.users?.telegram_id || 0,
        }),
      })

      if (response.ok) {
        setIsCompleteDialogOpen(false)
        router.refresh()
      } else {
        console.error("Error completing redemption")
      }
    } catch (error) {
      console.error("Error completing redemption:", error)
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedRedemption) return

    setProcessing(true)

    try {
      const response = await fetch("/api/admin/reject-redemption", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          redemptionId: selectedRedemption.id,
          telegramId: selectedRedemption.users?.telegram_id || 0,
        }),
      })

      if (response.ok) {
        setIsRejectDialogOpen(false)
        router.refresh()
      } else {
        console.error("Error rejecting redemption")
      }
    } catch (error) {
      console.error("Error rejecting redemption:", error)
    } finally {
      setProcessing(false)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString("tr-TR")
    } catch {
      return "Geçersiz tarih"
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
            Bekliyor
          </Badge>
        )
      case "completed":
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800">
            Tamamlandı
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="outline" className="bg-red-100 text-red-800">
            Reddedildi
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <AdminLayout title="Kart Bozumları">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kullanıcı</TableHead>
              <TableHead>Kart Numarası</TableHead>
              <TableHead>Kalan Bakiye</TableHead>
              <TableHead>TRX Adresi</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Tarih</TableHead>
              <TableHead>İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {redemptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-4">
                  Henüz kart bozum talebi bulunmamaktadır.
                </TableCell>
              </TableRow>
            ) : (
              redemptions.map((redemption) => (
                <TableRow key={redemption.id}>
                  <TableCell>
                    <div>{getUserDisplayName(redemption.users)}</div>
                    {getUserSubtext(redemption.users) && (
                      <div className="text-sm text-gray-500">{getUserSubtext(redemption.users)}</div>
                    )}
                  </TableCell>
                  <TableCell>****{getCardNumber(redemption.virtual_cards)}</TableCell>
                  <TableCell>{redemption.remaining_balance || 0} TL</TableCell>
                  <TableCell className="font-mono text-xs">{redemption.trx_wallet_address || "N/A"}</TableCell>
                  <TableCell>{getStatusBadge(redemption.status)}</TableCell>
                  <TableCell>{formatDate(redemption.created_at)}</TableCell>
                  <TableCell>
                    {redemption.status === "pending" && (
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700"
                          onClick={() => {
                            setSelectedRedemption(redemption)
                            setIsCompleteDialogOpen(true)
                          }}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Tamamla
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700"
                          onClick={() => {
                            setSelectedRedemption(redemption)
                            setIsRejectDialogOpen(true)
                          }}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reddet
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Tamamlama Dialog */}
      <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kart Bozum Tamamlama</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Kullanıcı</Label>
              <div>
                {getUserDisplayName(selectedRedemption?.users)}
                {getUserSubtext(selectedRedemption?.users) && (
                  <span className="text-sm text-gray-500"> ({getUserSubtext(selectedRedemption?.users)})</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Kart Numarası</Label>
              <div>****{getCardNumber(selectedRedemption?.virtual_cards)}</div>
            </div>
            <div className="space-y-2">
              <Label>Kalan Bakiye</Label>
              <div>{selectedRedemption?.remaining_balance || 0} TL</div>
            </div>
            <div className="space-y-2">
              <Label>TRX Adresi</Label>
              <div className="font-mono text-xs break-all">{selectedRedemption?.trx_wallet_address || "N/A"}</div>
            </div>
            <div className="text-sm text-gray-500">
              Bu işlemi tamamladığınızda, kullanıcıya ödeme yapıldığı bildirilecektir. Lütfen önce TRX transferini
              gerçekleştirin.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCompleteDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleComplete} disabled={processing}>
              {processing ? "İşleniyor..." : "Tamamla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reddetme Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kart Bozum Reddi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Kullanıcı</Label>
              <div>
                {getUserDisplayName(selectedRedemption?.users)}
                {getUserSubtext(selectedRedemption?.users) && (
                  <span className="text-sm text-gray-500"> ({getUserSubtext(selectedRedemption?.users)})</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Kart Numarası</Label>
              <div>****{getCardNumber(selectedRedemption?.virtual_cards)}</div>
            </div>
            <div className="space-y-2">
              <Label>Kalan Bakiye</Label>
              <div>{selectedRedemption?.remaining_balance || 0} TL</div>
            </div>
            <div className="text-sm text-gray-500">
              Bu işlem geri alınamaz. Kullanıcıya kart bozum talebi reddedildi bildirimi gönderilecektir.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing}>
              {processing ? "İşleniyor..." : "Reddet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Check, X } from "lucide-react"
import AdminLayout from "./admin-layout"

interface Payment {
  id: string
  card_balance: number
  service_fee: number
  total_amount: number
  status: string
  created_at: string
  users?: {
    id: string
    telegram_id: number
    username: string | null
    first_name: string | null
    last_name: string | null
  } | null
}

interface VirtualCard {
  id: string
  card_number: string
  cvv: string
  expiry_date: string
  balance: number
}

interface PaymentsTableProps {
  payments: Payment[]
  availableCards: VirtualCard[]
}

export default function PaymentsTable({ payments, availableCards }: PaymentsTableProps) {
  const router = useRouter()
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [selectedCard, setSelectedCard] = useState<string>("")
  const [processing, setProcessing] = useState(false)

  const handleApprove = async () => {
    if (!selectedPayment || !selectedCard) return

    setProcessing(true)

    try {
      const response = await fetch("/api/admin/approve-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentId: selectedPayment.id,
          cardId: selectedCard,
          userId: selectedPayment.users?.id || "unknown",
          telegramId: selectedPayment.users?.telegram_id || 0,
          cardBalance: selectedPayment.card_balance,
        }),
      })

      if (response.ok) {
        setIsApproveDialogOpen(false)
        router.refresh()
      } else {
        console.error("Error approving payment")
      }
    } catch (error) {
      console.error("Error approving payment:", error)
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedPayment) return

    setProcessing(true)

    try {
      const response = await fetch("/api/admin/reject-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentId: selectedPayment.id,
          telegramId: selectedPayment.users?.telegram_id || 0,
        }),
      })

      if (response.ok) {
        setIsRejectDialogOpen(false)
        router.refresh()
      } else {
        console.error("Error rejecting payment")
      }
    } catch (error) {
      console.error("Error rejecting payment:", error)
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
      case "approved":
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800">
            Onaylandı
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

  const getUserDisplayName = (payment: Payment) => {
    if (!payment.users) {
      return "Bilinmeyen Kullanıcı"
    }

    const firstName = payment.users.first_name || ""
    const lastName = payment.users.last_name || ""
    const username = payment.users.username

    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim()
    }

    if (username) {
      return `@${username}`
    }

    return `Kullanıcı #${payment.users.telegram_id || "unknown"}`
  }

  const getUserSubtext = (payment: Payment) => {
    if (!payment.users?.username) return null
    return `@${payment.users.username}`
  }

  // Uygun kartları filtrele (bakiyesi istenen bakiyeye eşit olanlar)
  const getFilteredCards = () => {
    if (!selectedPayment) return []
    return availableCards.filter((card) => card.balance === selectedPayment.card_balance)
  }

  const filteredCards = getFilteredCards()

  return (
    <AdminLayout title="Ödemeler">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kullanıcı</TableHead>
              <TableHead>Kart Bakiyesi</TableHead>
              <TableHead>Hizmet Bedeli</TableHead>
              <TableHead>Toplam Tutar</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Tarih</TableHead>
              <TableHead>İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-4">
                  Henüz ödeme talebi bulunmamaktadır.
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <div>
                      {getUserDisplayName(payment)}
                      {getUserSubtext(payment) && (
                        <div className="text-sm text-gray-500">{getUserSubtext(payment)}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{payment.card_balance} TL</TableCell>
                  <TableCell>{payment.service_fee} TL</TableCell>
                  <TableCell>{payment.total_amount} TRX</TableCell>
                  <TableCell>{getStatusBadge(payment.status)}</TableCell>
                  <TableCell>{formatDate(payment.created_at)}</TableCell>
                  <TableCell>
                    {payment.status === "pending" && (
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700"
                          onClick={() => {
                            setSelectedPayment(payment)
                            setSelectedCard("")
                            setIsApproveDialogOpen(true)
                          }}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Onayla
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700"
                          onClick={() => {
                            setSelectedPayment(payment)
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

      {/* Onaylama Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ödeme Onayı</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Kullanıcı</Label>
              <div>
                {selectedPayment ? getUserDisplayName(selectedPayment) : "Bilinmeyen"}
                {selectedPayment && getUserSubtext(selectedPayment) && (
                  <span className="text-sm text-gray-500"> ({getUserSubtext(selectedPayment)})</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>İstenen Kart Bakiyesi</Label>
              <div>{selectedPayment?.card_balance} TL</div>
            </div>
            <div className="space-y-2">
              <Label>Toplam Ödeme Tutarı</Label>
              <div>{selectedPayment?.total_amount} TRX</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="card">Atanacak Sanal Kart</Label>
              <Select value={selectedCard} onValueChange={setSelectedCard}>
                <SelectTrigger id="card">
                  <SelectValue placeholder="Kart seçin" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCards.length === 0 ? (
                    <SelectItem value="no-card" disabled>
                      {selectedPayment
                        ? `${selectedPayment.card_balance} TL bakiyeli kart bulunmamaktadır`
                        : "Kart seçin"}
                    </SelectItem>
                  ) : (
                    filteredCards.map((card) => (
                      <SelectItem key={card.id} value={card.id}>
                        {card.card_number.slice(-4)} - {card.balance} TL
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {filteredCards.length === 0 && (
                <p className="text-sm text-red-500">
                  İstenen bakiyeye uygun kart bulunamadı. Lütfen önce {selectedPayment?.card_balance} TL bakiyeli bir
                  kart ekleyin.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleApprove} disabled={!selectedCard || processing || filteredCards.length === 0}>
              {processing ? "İşleniyor..." : "Onayla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reddetme Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ödeme Reddi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Kullanıcı</Label>
              <div>
                {selectedPayment ? getUserDisplayName(selectedPayment) : "Bilinmeyen"}
                {selectedPayment && getUserSubtext(selectedPayment) && (
                  <span className="text-sm text-gray-500"> ({getUserSubtext(selectedPayment)})</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>İstenen Kart Bakiyesi</Label>
              <div>{selectedPayment?.card_balance} TL</div>
            </div>
            <div className="space-y-2">
              <Label>Toplam Ödeme Tutarı</Label>
              <div>{selectedPayment?.total_amount} TRX</div>
            </div>
            <div className="text-sm text-gray-500">
              Bu işlem geri alınamaz. Kullanıcıya ödeme reddedildi bildirimi gönderilecektir.
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

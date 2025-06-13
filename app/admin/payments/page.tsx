"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import PaymentsTable from "@/components/admin/payments-table"

export default function PaymentsPage() {
  const [payments, setPayments] = useState([])
  const [availableCards, setAvailableCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const router = useRouter()

  useEffect(() => {
    async function checkSessionAndLoadData() {
      try {
        console.log("Checking session and loading payments data...")

        // Oturum kontrolü
        const sessionResponse = await fetch("/api/admin/check-session")
        const sessionData = await sessionResponse.json()

        if (!sessionData.authenticated) {
          router.push("/admin/login")
          return
        }

        // Ödemeleri ve kartları paralel olarak yükle
        const [paymentsResponse, cardsResponse] = await Promise.all([
          fetch("/api/admin/payments"),
          fetch("/api/admin/available-cards"),
        ])

        const paymentsData = await paymentsResponse.json()
        const cardsData = await cardsResponse.json()

        console.log("Payments data:", paymentsData)
        console.log("Cards data:", cardsData)

        if (paymentsData.success) {
          setPayments(paymentsData.payments)
          console.log(`Loaded ${paymentsData.payments.length} payments`)
        } else {
          console.error("Failed to load payments:", paymentsData.message)
          setError(paymentsData.message)
        }

        if (cardsData.success) {
          setAvailableCards(cardsData.cards)
          console.log(`Loaded ${cardsData.cards.length} available cards`)
        }
      } catch (error) {
        console.error("Error loading data:", error)
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }

    checkSessionAndLoadData()
  }, [router])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch("/api/admin/payments")
        const data = await response.json()
        if (data.success) {
          setPayments(data.payments)
          console.log(`Auto-refreshed: ${data.payments.length} payments`)
        }
      } catch (error) {
        console.error("Auto-refresh error:", error)
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Ödemeler yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <p className="text-red-500 mb-4">Hata: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Yeniden Yükle
        </button>
      </div>
    )
  }

  return <PaymentsTable payments={payments} availableCards={availableCards} />
}

"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import CardsTable from "@/components/admin/cards-table"

export default function CardsPage() {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const router = useRouter()

  useEffect(() => {
    async function checkSessionAndLoadData() {
      try {
        // Oturum kontrolü
        const sessionResponse = await fetch("/api/admin/check-session")

        if (!sessionResponse.ok) {
          const errorData = await sessionResponse.json()
          console.error("Session check failed:", errorData)
          router.push("/admin/login")
          return
        }

        const sessionData = await sessionResponse.json()

        if (!sessionData.authenticated) {
          router.push("/admin/login")
          return
        }

        // Kartları yükle
        const cardsResponse = await fetch("/api/admin/cards")

        if (!cardsResponse.ok) {
          const errorData = await cardsResponse.json()
          throw new Error(`Cards fetch failed: ${errorData.message || cardsResponse.statusText}`)
        }

        const cardsData = await cardsResponse.json()

        if (cardsData.success) {
          console.log("Cards loaded:", cardsData.cards.length)
          setCards(cardsData.cards)
        } else {
          throw new Error(cardsData.message || "Failed to load cards")
        }
      } catch (error) {
        console.error("Error:", error)
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }

    checkSessionAndLoadData()
  }, [router])

  // Kart eklendikten sonra listeyi yenile
  const refreshCards = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/admin/cards")

      if (!response.ok) {
        throw new Error(`Failed to refresh cards: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.success) {
        console.log("Cards refreshed:", data.cards.length)
        setCards(data.cards)
      } else {
        throw new Error(data.message || "Failed to refresh cards")
      }
    } catch (error) {
      console.error("Error refreshing cards:", error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p>Yükleniyor...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <p className="text-red-500 mb-4">Hata: {error}</p>
        <button onClick={refreshCards} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          Yeniden Dene
        </button>
      </div>
    )
  }

  return <CardsTable cards={cards} onCardAdded={refreshCards} />
}

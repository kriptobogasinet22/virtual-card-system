import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import CardsTable from "@/components/admin/cards-table"

async function getCards() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/admin/cards`, {
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error("Failed to fetch cards")
    }

    const result = await response.json()
    return result.cards || []
  } catch (error) {
    console.error("Error fetching cards:", error)
    return []
  }
}

export default async function CardsPage() {
  const session = await getSession()

  if (!session) {
    redirect("/admin/login")
  }

  const cards = await getCards()

  return <CardsTable cards={cards} />
}

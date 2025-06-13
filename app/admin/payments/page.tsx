import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import PaymentsTable from "@/components/admin/payments-table"

async function getPaymentsAndCards() {
  try {
    const [paymentsResponse, cardsResponse] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/admin/payments`, {
        cache: "no-store",
      }),
      fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/admin/available-cards`, {
        cache: "no-store",
      }),
    ])

    const paymentsResult = await paymentsResponse.json()
    const cardsResult = await cardsResponse.json()

    return {
      payments: paymentsResult.payments || [],
      availableCards: cardsResult.cards || [],
    }
  } catch (error) {
    console.error("Error fetching data:", error)
    return {
      payments: [],
      availableCards: [],
    }
  }
}

export default async function PaymentsPage() {
  const session = await getSession()

  if (!session) {
    redirect("/admin/login")
  }

  const { payments, availableCards } = await getPaymentsAndCards()

  return <PaymentsTable payments={payments} availableCards={availableCards} />
}

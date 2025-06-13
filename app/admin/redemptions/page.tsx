"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import RedemptionsTable from "@/components/admin/redemptions-table"

export default function RedemptionsPage() {
  const [redemptions, setRedemptions] = useState([])
  const [loading, setLoading] = useState(true)
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

        // Kart bozumlarını yükle
        const redemptionsResponse = await fetch("/api/admin/redemptions")
        const redemptionsData = await redemptionsResponse.json()

        if (redemptionsData.success) {
          setRedemptions(redemptionsData.redemptions)
        }
      } catch (error) {
        console.error("Error:", error)
      } finally {
        setLoading(false)
      }
    }

    checkSessionAndLoadData()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p>Yükleniyor...</p>
      </div>
    )
  }

  return <RedemptionsTable redemptions={redemptions} />
}

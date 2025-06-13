"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import UsersTable from "@/components/admin/users-table"

export default function UsersPage() {
  const [users, setUsers] = useState([])
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

        // Kullanıcıları yükle
        const usersResponse = await fetch("/api/admin/users")
        const usersData = await usersResponse.json()

        if (usersData.success) {
          setUsers(usersData.users)
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

  return <UsersTable users={users} />
}

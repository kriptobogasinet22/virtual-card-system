"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import AdminLayout from "./admin-layout"

interface User {
  id: string
  telegram_id: number
  username: string | null
  first_name: string | null
  last_name: string | null
  created_at: string
}

interface UsersTableProps {
  users: User[]
}

export default function UsersTable({ users }: UsersTableProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("tr-TR")
  }

  return (
    <AdminLayout title="Kullanıcılar">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Telegram ID</TableHead>
              <TableHead>Kullanıcı Adı</TableHead>
              <TableHead>Ad</TableHead>
              <TableHead>Soyad</TableHead>
              <TableHead>Kayıt Tarihi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4">
                  Henüz kullanıcı bulunmamaktadır.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.telegram_id}</TableCell>
                  <TableCell>{user.username ? `@${user.username}` : "-"}</TableCell>
                  <TableCell>{user.first_name || "-"}</TableCell>
                  <TableCell>{user.last_name || "-"}</TableCell>
                  <TableCell>{formatDate(user.created_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  )
}

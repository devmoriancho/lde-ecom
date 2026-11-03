import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const session = await auth();

  // 1. Check whether the user is logged in.
  if (!session?.user) {
    redirect("/login");
  }

  // 2. Check whether the logged-in user is an admin.
  if (session.user.role !== "admin") {
    redirect("/");
  }

  // 3. Only admins can reach this content.
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>

      <p>Welcome, {session.user.name}.</p>
      <p>Your role: {session.user.role}</p>
    </main>
  );
}

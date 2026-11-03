import { requireAdmin } from "@/lib/auth-guard";
import { logoutUser } from "../actions/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <>
      <header className="p-4 border-b flex justify-end">
        <form action={logoutUser}>
          <button
            type="submit"
            className="bg-red-600 text-white px-4 py-2 rounded"
          >
            Logout
          </button>
        </form>
      </header>

      {children}
    </>
  );
}

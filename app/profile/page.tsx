import { auth } from "@/auth";
import { logoutUser } from "@/app/actions/auth";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="p-8">
        <h1>You are not logged in.</h1>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Welcome, {session.user.name}!</h1>

      <p>Email: {session.user.email}</p>
      <p>User ID: {session.user.id}</p>
      <p>Role: {session.user.role}</p>
      <form action={logoutUser}>
        <button
          type="submit"
          className="bg-red-600 text-white px-6 py-2 rounded mt-4"
        >
          Logout
        </button>
      </form>
    </main>
  );
}

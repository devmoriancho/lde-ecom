"use client";

import { useActionState } from "react";
import { loginUser, type LoginState } from "@/app/actions/auth";

const initialState: LoginState = {
  success: false,
  message: "",
};

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    loginUser,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label>Email</label>
        <input
          type="email"
          name="email"
          required
          className="border p-2 w-full rounded"
        />
      </div>

      <div>
        <label>Password</label>
        <input
          type="password"
          name="password"
          required
          className="border p-2 w-full rounded"
        />
      </div>

      {state.message && <p className="text-red-600 text-sm">{state.message}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="bg-black text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {isPending ? "Logging in..." : "Login"}
      </button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { registerUser, type RegisterState } from "@/app/actions/auth";

const initialState: RegisterState = {
  success: false,
  message: "",
  errors: {},
};

export default function RegisterForm() {
  const [state, formAction, isPending] = useActionState(
    registerUser,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label>Name</label>
        <input
          type="text"
          name="name"
          required
          className="border p-2 w-full rounded"
        />
        {state.errors?.name?.[0] && (
          <p className="text-red-600 text-sm">{state.errors.name[0]}</p>
        )}
      </div>

      <div>
        <label>Email</label>
        <input
          type="email"
          name="email"
          required
          className="border p-2 w-full rounded"
        />
        {state.errors?.email?.[0] && (
          <p className="text-red-600 text-sm">{state.errors.email[0]}</p>
        )}
      </div>

      <div>
        <label>Password</label>
        <input
          type="password"
          name="password"
          required
          className="border p-2 w-full rounded"
        />
        {state.errors?.password?.[0] && (
          <p className="text-red-600 text-sm">{state.errors.password[0]}</p>
        )}
      </div>

      {state.message && (
        <p className={state.success ? "text-green-600" : "text-red-600"}>
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="bg-black text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {isPending ? "Creating account..." : "Register"}
      </button>
    </form>
  );
}

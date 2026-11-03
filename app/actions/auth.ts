"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { registerSchema } from "@/lib/validations/auth";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";

export type RegisterState = {
  success: boolean;
  message: string;
  errors?: {
    name?: string[];
    email?: string[];
    password?: string[];
  };
};

export async function registerUser(
  previousState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const rawData = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const validation = registerSchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      message: "Please correct the errors below.",
      errors: validation.error.flatten().fieldErrors,
    };
  }

  const { name, email, password } = validation.data;

  try {
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return {
        success: false,
        message: "An account with this email already exists.",
      };
    }

    const passwordHash = await hash(password, 12);

    await db.insert(users).values({
      name,
      email,
      passwordHash,
    });

    return {
      success: true,
      message: "Account created successfully!",
    };
  } catch (error) {
    console.error("Registration error:", error);

    return {
      success: false,
      message: "Something went wrong. Please try again.",
    };
  }
}

export type LoginState = {
  success: boolean;
  message: string;
};

export async function loginUser(
  previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });

    return {
      success: true,
      message: "Login successful!",
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        success: false,
        message: "Invalid email or password.",
      };
    }

    throw error;
  }
}

export async function logoutUser() {
  await signOut({
    redirectTo: "/login",
  });
}

"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/supabase/server";
import { checkUsernameAvailability } from "@/server/profile/actions";

// Sign up
export async function signUp(formData: FormData) {
  const supabase = await createClient();

  // Data is already validated in the form component
  const data = {
    email: String(formData.get("email")).trim().toLowerCase(),
    password: String(formData.get("password")),
    options: {
      data: {
        username: String(formData.get("username")).trim(),
      },
    },
  };

  const usernameCheck = await checkUsernameAvailability(
    data.options.data.username,
  );

  if (usernameCheck.error) {
    return {
      success: false,
      code: "username_check_error",
      message: "Failed to verify username availability. Please try again.",
    };
  }

  if (!usernameCheck.available) {
    return {
      success: false,
      code: "username_already_exists",
      message:
        "This username is already taken. Please choose a different username.",
    };
  }

  const { error } = await supabase.auth.signUp(data);

  // Check if user already exists
  if (error?.code === "user_already_exists") {
    return {
      success: false,
      code: "user_already_exists",
      message: "This email is already registered. Please log in instead.",
    };
  }

  // Return Supabase errors
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

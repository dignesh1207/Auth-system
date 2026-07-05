// WHY a route group `(auth)`?
// The parentheses make this a "route group" — it groups related pages
// without affecting the URL. /register stays /register, not /(auth)/register.
// We use it so auth pages can share a layout (centered card UI) without
// affecting the rest of the app.

import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata = {
  title: "Create Account",
};

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <RegisterForm />
    </main>
  );
}

import Image from "next/image";
import { loginAction } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-gray-900">
      <div className="bg-white border border-gray-200 rounded-xl p-8 w-full max-w-sm space-y-6">
        <div className="space-y-3">
          <Image src="/logo.png" alt="CVZN Studios" height={120} width={510} className="h-[120px] w-auto" />
          <p className="text-sm text-gray-500">Dashboard access</p>
        </div>

        <form action={loginAction} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm text-gray-600">Password</label>
            <input
              type="password"
              name="password"
              required
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-3.5 py-3 text-sm focus:outline-none focus:border-gray-900 transition-colors"
              placeholder="Enter your password"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-gray-600">
              Authenticator code <span className="text-gray-400">(6 digits)</span>
            </label>
            <input
              type="text"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              className="w-full border border-gray-200 rounded-lg px-3.5 py-3 text-sm tracking-[0.3em] focus:outline-none focus:border-gray-900 transition-colors"
              placeholder="123456"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gray-900 text-white py-3 rounded-lg text-sm font-medium hover:bg-gray-700 active:bg-gray-800 transition-colors touch-manipulation"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}

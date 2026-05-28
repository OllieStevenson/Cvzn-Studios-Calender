import Image from "next/image";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center space-y-5">
        <Image src="/logo.png" alt="CVZN Studios" height={144} width={600} className="h-36 w-auto mx-auto" />
        <p className="text-gray-400 text-sm">Visual Property Marketing</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <a
            href="/book"
            className="px-6 py-3 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
          >
            Book a shoot
          </a>
          <a
            href="/dashboard"
            className="px-6 py-3 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            Dashboard
          </a>
        </div>
      </div>
    </main>
  );
}

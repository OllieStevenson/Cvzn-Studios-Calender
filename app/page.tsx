'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [scrollY, setScrollY] = useState(0)
  const router = useRouter()

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  function navigateToBook(e: React.MouseEvent) {
    const overlay = document.getElementById('pt-overlay')
    if (!overlay) { router.push('/book'); return }

    // Set iris origin to where the user clicked
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    overlay.style.setProperty('--cx', `${rect.left + rect.width / 2}px`)
    overlay.style.setProperty('--cy', `${rect.top + rect.height / 2}px`)

    overlay.classList.remove('pt-out')
    overlay.classList.add('pt-in')

    setTimeout(() => router.push('/book'), 330)
  }

  return (
    <main className="bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5">
        <div className="relative inline-block" style={{ height: '160px', width: '280px' }}>
          <Image src="/logo.png" alt="CVZN Studios" height={160} width={280} className="h-[160px] w-auto brightness-0 invert" />
          <Image src="/icon.png" alt="" width={47} height={47} className="absolute" style={{ left: '20.7px', top: '56.45px' }} />
        </div>
        <button
          onClick={(e) => navigateToBook(e)}
          className="text-[11px] tracking-[0.25em] uppercase border border-white/25 px-5 py-2.5 hover:bg-white hover:text-black transition-all duration-300"
        >
          Book a Shoot
        </button>
      </nav>

      {/* Full-screen hero */}
      <section className="relative h-screen overflow-hidden">
        <div
          className="absolute inset-[-10%]"
          style={{ transform: `translateY(${scrollY * 0.3}px)` }}
        >
          <Image
            src="/bg.jpg"
            alt="CVZN Studios property"
            fill
            className="object-cover"
            priority
            quality={95}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/50 to-black/85" />
        </div>

        <div className="relative h-full flex flex-col items-center justify-center text-center px-8">
          <h1
            className="font-extralight tracking-[0.08em] uppercase leading-[1.05] mb-6"
            style={{
              fontSize: 'clamp(2.6rem, 8vw, 6.5rem)',
              animation: 'fadeUp 1s ease 0.3s both',
            }}
          >
            CVZN Studios<br />
            <span className="font-thin text-white/80 italic">Booking System</span>
          </h1>
          <p
            className="text-[13px] text-white/55 leading-[1.85] mb-14"
            style={{ animation: 'fadeUp 1s ease 0.5s both' }}
          >
            Properties deserve to stand out.
          </p>
          <div style={{ animation: 'fadeUp 1s ease 0.7s both' }}>
            <button
              onClick={(e) => navigateToBook(e)}
              className="px-10 py-4 bg-white text-black text-[11px] tracking-[0.3em] uppercase font-medium hover:bg-[#c8a96e] hover:text-white transition-all duration-500"
            >
              Book a Shoot
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

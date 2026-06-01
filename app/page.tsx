'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

function RevealSection({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(40px)',
        transition: `opacity 0.8s ease ${delay}ms, transform 0.8s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

const services = [
  {
    label: '01',
    title: 'Photography',
    desc: 'Professional stills that stop the scroll. Every angle crafted to show the property at its finest.',
  },
  {
    label: '02',
    title: 'Videography',
    desc: 'Cinematic walkthroughs that let buyers experience the property before they walk through the door.',
  },
  {
    label: '03',
    title: 'Drone Showcases',
    desc: 'Aerial perspectives that reveal scale, setting, and surroundings — the full picture, from above.',
  },
]

export default function Home() {
  const [scrollY, setScrollY] = useState(0)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
      setScrolled(window.scrollY > 80)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <main className="bg-[#0a0a0a] text-white overflow-x-hidden">
      {/* Nav */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 transition-all duration-500 ${
          scrolled
            ? 'py-4 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/5'
            : 'py-7'
        }`}
      >
        <Image
          src="/logo-light.png"
          alt="CVZN Studios"
          width={600}
          height={144}
          className="h-8 w-auto"
        />
        <Link
          href="/book"
          className="text-[11px] tracking-[0.25em] uppercase border border-white/25 px-5 py-2.5 hover:bg-white hover:text-black transition-all duration-300"
        >
          Book a Shoot
        </Link>
      </nav>

      {/* Hero */}
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
          <p
            className="text-[11px] tracking-[0.45em] uppercase text-white/45 mb-8"
            style={{ animation: 'fadeUp 1s ease 0.3s both' }}
          >
            Visual Property Marketing
          </p>
          <h1
            className="font-extralight tracking-[0.08em] uppercase leading-[1.05] mb-8"
            style={{
              fontSize: 'clamp(2.6rem, 8vw, 6.5rem)',
              animation: 'fadeUp 1s ease 0.5s both',
            }}
          >
            Properties<br />
            <span className="font-thin text-white/80 italic">That Captivate</span>
          </h1>
          <p
            className="text-[13px] text-white/55 max-w-[380px] leading-[1.85] mb-14"
            style={{ animation: 'fadeUp 1s ease 0.7s both' }}
          >
            Cinematic videography, drone showcases, and professional photography — for properties that deserve to stand out.
          </p>
          <div style={{ animation: 'fadeUp 1s ease 0.9s both' }}>
            <Link
              href="/book"
              className="px-10 py-4 bg-white text-black text-[11px] tracking-[0.3em] uppercase font-medium hover:bg-[#c8a96e] hover:text-white transition-all duration-500"
            >
              Book a Shoot
            </Link>
          </div>
        </div>

        {/* Scroll line */}
        <div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          style={{ animation: 'fadeUp 1s ease 1.3s both' }}
        >
          <span className="text-[10px] tracking-[0.35em] uppercase text-white/25">Scroll</span>
          <div className="w-px h-10 bg-gradient-to-b from-white/30 to-transparent" />
        </div>
      </section>

      {/* Services */}
      <section className="py-28 px-8">
        <div className="max-w-5xl mx-auto">
          <RevealSection className="mb-16">
            <p className="text-[11px] tracking-[0.4em] uppercase text-[#c8a96e] mb-4">Our Services</p>
            <h2 className="text-3xl md:text-4xl font-extralight tracking-wide">Every property, told visually</h2>
          </RevealSection>

          <div className="grid md:grid-cols-3 gap-px bg-white/[0.06]">
            {services.map((service, i) => (
              <RevealSection
                key={service.title}
                delay={i * 130}
                className="bg-[#0a0a0a] p-10 hover:bg-[#111] transition-colors duration-300 group cursor-default"
              >
                <span className="block text-[11px] tracking-[0.3em] text-white/20 mb-8 font-mono">
                  {service.label}
                </span>
                <h3 className="text-[13px] tracking-[0.18em] uppercase font-light mb-5 group-hover:text-[#c8a96e] transition-colors duration-300">
                  {service.title}
                </h3>
                <p className="text-[13px] text-white/45 leading-[1.85]">{service.desc}</p>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* Quote banner */}
      <section className="relative h-[42vh] overflow-hidden">
        <div
          className="absolute inset-[-10%]"
          style={{ transform: `translateY(${scrollY * 0.15}px)` }}
        >
          <Image src="/bg.jpg" alt="" fill className="object-cover" />
          <div className="absolute inset-0 bg-black/75" />
        </div>
        <RevealSection className="relative h-full flex flex-col items-center justify-center text-center px-8">
          <p className="text-[11px] tracking-[0.4em] uppercase text-[#c8a96e] mb-6">Our Philosophy</p>
          <blockquote className="font-extralight italic max-w-2xl leading-[1.65] text-white/85" style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.7rem)' }}>
            &ldquo;We don&rsquo;t just photograph properties &mdash; we create the first impression that sells them.&rdquo;
          </blockquote>
        </RevealSection>
      </section>

      {/* CTA */}
      <section className="py-36 px-8 text-center">
        <RevealSection className="max-w-lg mx-auto">
          <p className="text-[11px] tracking-[0.4em] uppercase text-white/25 mb-6">Ready to start?</p>
          <h2
            className="font-extralight tracking-wide mb-5"
            style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
          >
            Showcase your property
          </h2>
          <p className="text-[13px] text-white/40 mb-12 leading-[1.85]">
            Book a shoot and let us handle the rest.<br />Fast turnaround, premium results.
          </p>
          <Link
            href="/book"
            className="inline-block px-12 py-5 border border-white/20 text-[11px] tracking-[0.3em] uppercase hover:bg-white hover:text-black hover:border-white transition-all duration-500"
          >
            Book a Shoot
          </Link>
        </RevealSection>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8 px-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <Image
          src="/logo-light.png"
          alt="CVZN Studios"
          width={600}
          height={144}
          className="h-6 w-auto opacity-40"
        />
        <p className="text-[10px] tracking-[0.2em] uppercase text-white/20">
          © 2025 CVZN Studios. Visual Property Marketing.
        </p>
        <Link
          href="/book"
          className="text-[10px] tracking-[0.2em] uppercase text-white/20 hover:text-white/60 transition-colors duration-300"
        >
          Book a Shoot ↗
        </Link>
      </footer>
    </main>
  )
}

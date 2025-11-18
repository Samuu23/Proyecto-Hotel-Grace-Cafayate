import React, { useEffect, useRef, useState } from 'react'
import comida from '../assets/comida.jpg'
import picsina from '../assets/picsina.jpg'
import spa from '../assets/spa.jpg'
import habitacion from '../assets/habitacion.jpg'

function Slide({ title, subtitle, image }) {
  return (
    <div
      className="shrink-0 w-screen h-[calc(100vh-4rem)] relative flex items-center justify-center"
      style={{ backgroundImage: `url(${image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 hero-overlay" />
      <div className="absolute left-0 bottom-0 z-10 p-12 text-left">
        <h3 className="text-6xl md:text-8xl xl:text-9xl leading-[0.95] tracking-tight font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,.6)]">{title}</h3>
        <p className="mt-2 text-3xl md:text-4xl xl:text-5xl text-muted drop-shadow-[0_1px_2px_rgba(0,0,0,.6)]">{subtitle}</p>
      </div>
    </div>
  )
}

export default function ServicesFixed() {
  const sectionRef = useRef(null)
  const trackRef = useRef(null)
  const [hover, setHover] = useState(false)
  const touchStartY = useRef(0)

  useEffect(() => {
    const section = sectionRef.current
    const track = trackRef.current
    if (!section || !track) return

    const updateSize = () => {
      // Asegurar altura/anchos correctos por si cambia el viewport
      // No requiere cálculo especial, pero podemos forzar reflow si hiciera falta
      // eslint-disable-next-line no-unused-expressions
      track.offsetWidth
    }

    const onWheel = (e) => {
      if (!hover) return // si no está el mouse encima, dejar que el Home scrollee
      const maxScroll = track.scrollWidth - section.clientWidth
      const atStart = track.scrollLeft <= 0
      const atEnd = Math.ceil(track.scrollLeft) >= maxScroll
      if ((e.deltaY > 0 && !atEnd) || (e.deltaY < 0 && !atStart)) {
        e.preventDefault()
        track.scrollTo({ left: track.scrollLeft + e.deltaY, behavior: 'auto' })
      }
      // si está en los bordes, no prevenimos el default para que el padre continúe
    }

    const onTouchStart = (e) => {
      touchStartY.current = e.touches[0].clientY
    }
    const onTouchMove = (e) => {
      const dy = touchStartY.current - e.touches[0].clientY
      // en mobile no hay hover, asumimos control horizontal solo si hay desplazamiento y no estamos en bordes
      const maxScroll = track.scrollWidth - section.clientWidth
      const atStart = track.scrollLeft <= 0
      const atEnd = Math.ceil(track.scrollLeft) >= maxScroll
      if ((dy > 0 && !atEnd) || (dy < 0 && !atStart)) {
        e.preventDefault()
        track.scrollTo({ left: track.scrollLeft + dy, behavior: 'auto' })
      }
    }

    section.addEventListener('wheel', onWheel, { passive: false })
    section.addEventListener('touchstart', onTouchStart, { passive: true })
    section.addEventListener('touchmove', onTouchMove, { passive: false })
    const ro = new ResizeObserver(updateSize)
    ro.observe(track)
    updateSize()

    return () => {
      section.removeEventListener('wheel', onWheel)
      section.removeEventListener('touchstart', onTouchStart)
      section.removeEventListener('touchmove', onTouchMove)
      ro.disconnect()
    }
  }, [hover])

  return (
    <div
      ref={sectionRef}
      className="relative h-full w-full overflow-hidden flex items-center"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        ref={trackRef}
        className="flex will-change-transform no-scrollbar"
        style={{ overflowX: 'auto' }}
      >
        <Slide title="Desayuno" subtitle="Artesanal" image={comida} />
        <Slide title="Piscina" subtitle="Climatizada" image={picsina} />
        <Slide title="Spa" subtitle="Relax" image={spa} />
        <Slide title="Habitaciones" subtitle="Confort" image={habitacion} />
      </div>
    </div>
  )
}

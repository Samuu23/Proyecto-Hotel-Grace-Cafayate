import { useEffect, useRef, useState } from 'react'
import bgS3 from '../assets/bg-s3.jpg'

export default function Location() {
  const mapWrapRef = useRef(null)
  const infoWrapRef = useRef(null)
  const sectionRef = useRef(null)
  const [dots, setDots] = useState('')

  // Animación de "..." en el título
  useEffect(() => {
    const seq = ['', '.', '..', '...']
    let i = 0
    const id = setInterval(() => {
      i = (i + 1) % seq.length
      setDots(seq[i])
    }, 400)
    return () => clearInterval(id)
  }, [])

  // Animaciones de entrada/salida: ambos emergen desde el centro y vuelven al centro al salir
  useEffect(() => {
    const root = document.querySelector('#scroller') || null
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          if (mapWrapRef.current) {
            mapWrapRef.current.style.transitionDelay = '0ms'
            mapWrapRef.current.classList.add('show')
          }
          if (infoWrapRef.current) {
            infoWrapRef.current.style.transitionDelay = '120ms'
            infoWrapRef.current.classList.add('show')
          }
        } else {
          if (mapWrapRef.current) {
            mapWrapRef.current.classList.remove('show')
            mapWrapRef.current.style.transitionDelay = '0ms'
          }
          if (infoWrapRef.current) {
            infoWrapRef.current.classList.remove('show')
            infoWrapRef.current.style.transitionDelay = '0ms'
          }
        }
      })
    }, { root, threshold: 0.2 })
    if (sectionRef.current) io.observe(sectionRef.current)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={sectionRef} className="relative h-full flex items-center justify-center">
      {/* Fondo y overlay */}
      <div
        className="absolute inset-0 -z-10"
        style={{ backgroundImage: `url(${bgS3})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
      <div className="absolute inset-0 -z-10 bg-black/40" />

      <div className="relative w-full max-w-6xl px-6 z-10">
        <h2 className="text-4xl md:text-6xl xl:text-7xl leading-tight tracking-tight font-semibold mb-8 text-center drop-shadow-[0_1px_2px_rgba(0,0,0,.6)]">Nos podés encontrar en{dots}</h2>

        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Ambos emergen desde el centro y se separan */}
          <div ref={mapWrapRef} className="from-center left">
            <div className="aspect-video w-full rounded-xl overflow-hidden border border-white/10">
              <iframe
                title="Mapa"
                src={`https://www.google.com/maps?q=${encodeURIComponent('Grace Cafayate Hotel, Salta')}&output=embed`}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>

          {/* Info a la derecha */}
          <div ref={infoWrapRef} className="from-center right">
            <div className="space-y-5 px-1 py-1">
              <p className="text-2xl md:text-3xl xl:text-4xl">
                <span className="font-semibold">Dirección:</span>{' '}
                Grace Cafayate Hotel, Salta
              </p>
              <p>
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Grace Cafayate Hotel, Salta')}`} target="_blank" rel="noreferrer" className="underline hover:opacity-80 text-base md:text-lg">
                  Ver en Google Maps
                </a>
              </p>
              <p className="text-2xl md:text-3xl xl:text-4xl">
                <span className="font-semibold">Horarios de recepción:</span> 08:00 a 22:00
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

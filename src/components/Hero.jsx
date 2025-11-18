import React from 'react'
import bgS3 from '../assets/bg-s3.jpg'

export default function Hero() {
  return (
    <div
      className="relative h-full flex items-center justify-center"
      style={{
        backgroundImage: `url(${bgS3})`,
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundColor: '#0b0b0b',
      }}
    >
      <div className="absolute inset-0 hero-overlay" />
      <div className="relative z-10 max-w-5xl text-center px-6">
        <h1 className="display text-6xl md:text-7xl xl:text-8xl leading-[1.05] tracking-tight font-semibold drop-shadow-[0_2px_4px_rgba(0,0,0,.5)]">Descansá en el corazón de Cafayate</h1>
        <p className="mt-4 text-xl md:text-2xl text-muted drop-shadow-[0_1px_2px_rgba(0,0,0,.5)]">Elegancia minimalista, confort y la esencia de los Valles Calchaquíes.</p>
      </div>
    </div>
  )
}

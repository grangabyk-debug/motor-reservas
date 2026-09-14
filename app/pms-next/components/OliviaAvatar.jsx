"use client"

import { useEffect, useRef } from "react"
import { OLIVIA_SIZE, OLIVIA_PALETTE_B64, OLIVIA_INDEX_B64 } from "./oliviaAvatarData"

let oliviaPixelCache = null

function decodeBase64Bytes(value) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function getOliviaPixels() {
  if (oliviaPixelCache) return oliviaPixelCache
  const palette = decodeBase64Bytes(OLIVIA_PALETTE_B64)
  const indexes = decodeBase64Bytes(OLIVIA_INDEX_B64)
  const rgba = new Uint8ClampedArray(OLIVIA_SIZE * OLIVIA_SIZE * 4)
  for (let i = 0; i < indexes.length; i += 1) {
    const paletteOffset = indexes[i] * 4
    const pixelOffset = i * 4
    rgba[pixelOffset] = palette[paletteOffset]
    rgba[pixelOffset + 1] = palette[paletteOffset + 1]
    rgba[pixelOffset + 2] = palette[paletteOffset + 2]
    rgba[pixelOffset + 3] = palette[paletteOffset + 3]
  }
  oliviaPixelCache = rgba
  return rgba
}

function paintFallback(canvas) {
  const ctx = canvas?.getContext?.("2d")
  if (!ctx) return
  canvas.width = OLIVIA_SIZE
  canvas.height = OLIVIA_SIZE
  ctx.clearRect(0, 0, OLIVIA_SIZE, OLIVIA_SIZE)
  ctx.fillStyle = "#f2e8f8"
  ctx.beginPath()
  ctx.arc(48, 48, 46, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#7c3aed"
  ctx.font = "700 28px system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("IA", 48, 49)
}

export default function OliviaAvatar({ className = "", alt = "OlivIA" }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext?.("2d")
    if (!canvas || !ctx) return
    try {
      canvas.width = OLIVIA_SIZE
      canvas.height = OLIVIA_SIZE
      ctx.clearRect(0, 0, OLIVIA_SIZE, OLIVIA_SIZE)
      ctx.putImageData(new ImageData(new Uint8ClampedArray(getOliviaPixels()), OLIVIA_SIZE, OLIVIA_SIZE), 0, 0)
    } catch (error) {
      console.error("OlivIA avatar render failed", error)
      paintFallback(canvas)
    }
  }, [])

  return <canvas ref={canvasRef} className={className} role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : "true"} />
}

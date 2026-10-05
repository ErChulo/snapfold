import { useEffect, useRef } from 'react'
import { getLetterTransform, LETTER } from '../utils/unfolder.js'

const PX_PER_IN = 96

export default function NetCanvas({ net, scalePercent, projectName }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const width = Math.round(LETTER.widthIn * PX_PER_IN)
    const height = Math.round(LETTER.heightIn * PX_PER_IN)
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawPreview(ctx, net, scalePercent, projectName, width, height)
  }, [net, scalePercent, projectName])

  return (
    <canvas
      ref={canvasRef}
      className="paper-grid aspect-[8.5/11] w-full bg-white shadow-panel"
      aria-label="Letter-size SnapFold flattened layout preview"
    />
  )
}

function drawPreview(ctx, net, scalePercent, projectName, width, height) {
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  const t = getLetterTransform(net, scalePercent)
  const p = (point) => {
    const q = t.point(point)
    return { x: q.x * PX_PER_IN, y: q.y * PX_PER_IN }
  }

  ctx.fillStyle = '#334155'
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillText(`SnapFold — ${projectName.trim() || 'Untitled project'}`, LETTER.marginIn * PX_PER_IN, (LETTER.marginIn + 0.14) * PX_PER_IN)
  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(LETTER.marginIn * PX_PER_IN, (LETTER.marginIn + 0.23) * PX_PER_IN)
  ctx.lineTo((LETTER.widthIn - LETTER.marginIn) * PX_PER_IN, (LETTER.marginIn + 0.23) * PX_PER_IN)
  ctx.stroke()

  net.tabs.forEach((tab) => {
    const points = tab.points.map(p)
    ctx.save()
    ctx.fillStyle = 'rgba(34, 197, 94, 0.18)'
    ctx.strokeStyle = '#16803a'
    ctx.lineWidth = 1.5
    ctx.setLineDash([8, 5])
    polygon(ctx, points)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  })

  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 1.8
  ctx.setLineDash([])
  net.cutEdges.forEach((line) => drawLine(ctx, p(line.a), p(line.b)))

  net.folds.forEach((line) => {
    ctx.save()
    if (line.type === 'mountain') {
      ctx.strokeStyle = '#d22323'
      ctx.setLineDash([11, 7])
    } else {
      ctx.strokeStyle = '#235bd2'
      ctx.setLineDash([2, 6])
      ctx.lineCap = 'round'
    }
    ctx.lineWidth = 1.6
    drawLine(ctx, p(line.a), p(line.b))
    ctx.restore()
  })

  drawLegend(ctx, height)
}

function polygon(ctx, points) {
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y))
  ctx.closePath()
}

function drawLine(ctx, a, b) {
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
}

function drawLegend(ctx, height) {
  const y = height - (LETTER.marginIn + 0.16) * PX_PER_IN
  let x = LETTER.marginIn * PX_PER_IN
  ctx.font = '10px system-ui, sans-serif'
  ctx.fillStyle = '#334155'

  x = legendStroke(ctx, x, y, '#000000', [], 'Cut')
  x = legendStroke(ctx, x + 18, y, '#d22323', [11, 7], 'Mountain')
  x = legendStroke(ctx, x + 18, y, '#235bd2', [2, 6], 'Valley')

  ctx.fillStyle = 'rgba(34, 197, 94, 0.18)'
  ctx.strokeStyle = '#16803a'
  ctx.setLineDash([7, 4])
  ctx.fillRect(x + 18, y - 8, 25, 12)
  ctx.strokeRect(x + 18, y - 8, 25, 12)
  ctx.setLineDash([])
  ctx.fillStyle = '#334155'
  ctx.fillText('Glue tab', x + 50, y + 2)
}

function legendStroke(ctx, x, y, color, dash, label) {
  ctx.strokeStyle = color
  ctx.setLineDash(dash)
  ctx.lineWidth = 1.5
  drawLine(ctx, { x, y }, { x: x + 27, y })
  ctx.setLineDash([])
  ctx.fillStyle = '#334155'
  ctx.fillText(label, x + 34, y + 2)
  return x + 34 + ctx.measureText(label).width
}

import { jsPDF } from 'jspdf'
import { getLetterTransform, LETTER } from './unfolder.js'

export function exportNetPdf({ projectName, net, scalePercent }) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter', compress: true })
  const transform = getLetterTransform(net, scalePercent)
  const safeName = projectName.trim() || 'Untitled SnapFold Project'

  drawHeader(pdf, safeName)
  drawTabs(pdf, net, transform)
  drawCutLines(pdf, net, transform)
  drawFolds(pdf, net, transform)
  drawLegend(pdf)

  pdf.save(`${sanitizeFilename(safeName)}-snapfold.pdf`)
}

function drawHeader(pdf, projectName) {
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(45, 55, 72)
  pdf.text(`SnapFold — ${projectName}`, LETTER.marginIn, LETTER.marginIn + 0.13)
  pdf.setDrawColor(200, 205, 212)
  pdf.setLineWidth(0.006)
  pdf.line(LETTER.marginIn, LETTER.marginIn + 0.23, LETTER.widthIn - LETTER.marginIn, LETTER.marginIn + 0.23)
}

function drawTabs(pdf, net, transform) {
  pdf.setFillColor(220, 245, 225)
  pdf.setDrawColor(35, 135, 70)
  pdf.setLineWidth(0.012)
  pdf.setLineDashPattern([0.08, 0.05], 0)

  net.tabs.forEach((tab) => {
    const points = tab.points.map(transform.point)
    const [first, ...rest] = points
    const vectors = rest.map((p, index) => {
      const previous = index === 0 ? first : rest[index - 1]
      return [p.x - previous.x, p.y - previous.y]
    })
    vectors.push([first.x - rest.at(-1).x, first.y - rest.at(-1).y])
    pdf.lines(vectors, first.x, first.y, [1, 1], 'FD', true)
  })
  pdf.setLineDashPattern([], 0)
}

function drawCutLines(pdf, net, transform) {
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.016)
  pdf.setLineDashPattern([], 0)
  net.cutEdges.forEach((edge) => drawLine(pdf, edge, transform))
}

function drawFolds(pdf, net, transform) {
  net.folds.forEach((fold) => {
    if (fold.type === 'mountain') {
      pdf.setDrawColor(210, 35, 35)
      pdf.setLineWidth(0.014)
      pdf.setLineDashPattern([0.12, 0.07], 0)
    } else {
      pdf.setDrawColor(35, 90, 210)
      pdf.setLineWidth(0.014)
      pdf.setLineDashPattern([0.025, 0.055], 0)
    }
    drawLine(pdf, fold, transform)
  })
  pdf.setLineDashPattern([], 0)
}

function drawLegend(pdf) {
  const y = LETTER.heightIn - LETTER.marginIn - 0.16
  let x = LETTER.marginIn
  pdf.setFontSize(7.5)
  pdf.setTextColor(45, 55, 72)

  legendLine(pdf, x, y, [0, 0, 0], [], 'Cut')
  x += 1.25
  legendLine(pdf, x, y, [210, 35, 35], [0.12, 0.07], 'Mountain')
  x += 1.65
  legendLine(pdf, x, y, [35, 90, 210], [0.025, 0.055], 'Valley')
  x += 1.35

  pdf.setFillColor(220, 245, 225)
  pdf.setDrawColor(35, 135, 70)
  pdf.setLineDashPattern([0.08, 0.05], 0)
  pdf.rect(x, y - 0.08, 0.26, 0.12, 'FD')
  pdf.setLineDashPattern([], 0)
  pdf.text('Glue tab', x + 0.34, y + 0.01)
}

function legendLine(pdf, x, y, color, dash, label) {
  pdf.setDrawColor(...color)
  pdf.setLineDashPattern(dash, 0)
  pdf.setLineWidth(0.014)
  pdf.line(x, y, x + 0.28, y)
  pdf.setLineDashPattern([], 0)
  pdf.text(label, x + 0.36, y + 0.01)
}

function drawLine(pdf, line, transform) {
  const a = transform.point(line.a)
  const b = transform.point(line.b)
  pdf.line(a.x, a.y, b.x, b.y)
}

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'snapfold-project'
}

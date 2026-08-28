// Report export — PDF via jsPDF/jspdf-autotable, CSV via papaparse.
// PDF is intentionally formatted as a printable school report:
// - school name is always visible in the header
// - summary is compact and aligned
// - class details are grouped by session
// - table headers repeat on page breaks
// - page numbers are added to every page

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Papa from 'papaparse'

const MAX_PDF_PHOTOS = 24
const LOGO_MAX_SIZE = 42
const PAGE_MARGIN = 40
const NAVY = [30, 58, 95]
const TEXT = [35, 35, 35]
const MUTED = [95, 95, 95]
const LIGHT = [244, 246, 248]
const BORDER = [220, 224, 228]

/** Fetch an image URL and return it as a data URL for jsPDF. */
async function loadImageAsDataUrl(url) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()

    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** Natural image dimensions so logos retain their aspect ratio. */
function loadImageDimensions(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({
      width: img.naturalWidth,
      height: img.naturalHeight,
    })
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

function drawPageHeader(doc, { schoolName, title }) {
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.text(String(schoolName || 'School').toUpperCase(), PAGE_MARGIN, 30)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...TEXT)
  doc.text(title || 'ROBOTICS REPORT', PAGE_MARGIN, 43)

  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.6)
  doc.line(PAGE_MARGIN, 56, pageWidth - PAGE_MARGIN, 56)

  doc.setTextColor(...TEXT)
}

function addPageNumbers(doc, { schoolName, title, logoDataUrl }) {
  const pageCount = doc.getNumberOfPages()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)

    // Repeat a compact identity header on pages after the first.
    if (page > 1) {
      drawPageHeader(doc, { schoolName, title })
    }

    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.5)
    doc.line(PAGE_MARGIN, pageHeight - 27, pageWidth - PAGE_MARGIN, pageHeight - 27)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)

    doc.text(
      String(schoolName || '').trim(),
      PAGE_MARGIN,
      pageHeight - 14
    )

    doc.text(
      `Page ${page} of ${pageCount}`,
      pageWidth - PAGE_MARGIN,
      pageHeight - 14,
      { align: 'right' }
    )

    doc.setTextColor(...TEXT)
  }
}

/**
 * Build a clean, printable robotics report.
 *
 * `tableRows` can contain either:
 *   - normal arrays: [time, grade, program, activity, attendance, toolkit, status]
 *   - grouped objects: { type: 'date'|'session'|'class', cells: [...] }
 *
 * Date and session rows are rendered as full-width visual separators.
 */
export async function exportReportPdf({
  title,
  schoolName,
  subtitle,
  logoUrl,
  metaLines,
  summaryRows,
  tableTitle,
  tableHead,
  tableRows,
  extraTables,
  photos,
  fileName,
}) {
  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: 'portrait',
  })

  const pageWidth = doc.internal.pageSize.getWidth()

  const logoDataUrl = logoUrl
    ? await loadImageAsDataUrl(logoUrl)
    : null

  // ---------------- Header ----------------
  let titleX = PAGE_MARGIN
  let logoW = 0
  let logoH = 0

  if (logoDataUrl) {
    const dims = await loadImageDimensions(logoDataUrl)

    logoW = LOGO_MAX_SIZE
    logoH = LOGO_MAX_SIZE

    if (dims?.width && dims?.height) {
      const scale = Math.min(LOGO_MAX_SIZE / dims.width, LOGO_MAX_SIZE / dims.height)
      logoW = dims.width * scale
      logoH = dims.height * scale
    }

    try {
      doc.addImage(
        logoDataUrl,
        'AUTO',
        PAGE_MARGIN,
        24 + Math.max(0, (LOGO_MAX_SIZE - logoH) / 2),
        logoW,
        logoH,
        undefined,
        'FAST'
      )
      titleX = PAGE_MARGIN + LOGO_MAX_SIZE + 12
    } catch {
      // Continue without the logo.
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text(
    String(schoolName || 'School').toUpperCase(),
    titleX,
    31
  )

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...TEXT)
  doc.text(title || 'ROBOTICS REPORT', titleX, 50)

  let headerY = 66

  if (metaLines?.length) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...MUTED)
    doc.text(metaLines.join('   ·   '), titleX, headerY)
    headerY += 15
  }

  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.7)
  doc.line(PAGE_MARGIN, Math.max(headerY + 4, 80), pageWidth - PAGE_MARGIN, Math.max(headerY + 4, 80))

  let y = Math.max(
    98,
    logoH > 0 ? 24 + logoH + 20 : headerY + 20
  )

  // ---------------- Report period ----------------
  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.text(subtitle, PAGE_MARGIN, y)
    y += 20
  }

  // ---------------- Summary ----------------
  if (summaryRows?.length) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...TEXT)
    doc.text('Report Summary', PAGE_MARGIN, y)
    y += 9

    const summaryBody = summaryRows.map(([label, value]) => [
      label,
      String(value ?? '—'),
    ])

    autoTable(doc, {
      startY: y + 7,
      margin: {
        left: PAGE_MARGIN,
        right: PAGE_MARGIN,
        top: 68,
        bottom: 38,
      },
      body: summaryBody,
      theme: 'grid',
      tableWidth: pageWidth - PAGE_MARGIN * 2,
      styles: {
        font: 'helvetica',
        fontSize: 9,
        textColor: TEXT,
        cellPadding: { top: 5, right: 7, bottom: 5, left: 7 },
        lineColor: BORDER,
        lineWidth: 0.4,
        valign: 'middle',
      },
      columnStyles: {
        0: {
          fontStyle: 'bold',
          textColor: MUTED,
          cellWidth: 220,
        },
        1: {
          fontStyle: 'bold',
          halign: 'right',
        },
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      pageBreak: 'avoid',
      rowPageBreak: 'avoid',
    })

    y = doc.lastAutoTable.finalY + 18
  }

  // ---------------- Class details ----------------
  if (tableRows?.length) {
    if (tableTitle) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(...TEXT)
      doc.text(tableTitle, PAGE_MARGIN, y)
      y += 10
    }

    const normalizedRows = tableRows.map((row) => {
      if (Array.isArray(row)) {
        return { type: 'class', cells: row }
      }
      return row
    })

    const body = normalizedRows.map((row) => row.cells)

    autoTable(doc, {
      startY: y + 6,
      margin: {
        left: PAGE_MARGIN,
        right: PAGE_MARGIN,
        top: 68,
        bottom: 38,
      },
      head: [tableHead],
      body,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8.2,
        textColor: TEXT,
        cellPadding: { top: 5, right: 5, bottom: 5, left: 5 },
        lineColor: BORDER,
        lineWidth: 0.35,
        valign: 'middle',
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: NAVY,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.2,
        halign: 'left',
        cellPadding: { top: 6, right: 5, bottom: 6, left: 5 },
      },
      columnStyles: {
        0: { cellWidth: 62, fontStyle: 'bold' },
        1: { cellWidth: 78, fontStyle: 'bold' },
        2: { cellWidth: 38, halign: 'center' },
        3: { cellWidth: 52, halign: 'center' },
        4: { cellWidth: 143 },
        5: { cellWidth: 55, halign: 'center' },
        6: { cellWidth: 62, halign: 'center' },
        7: { cellWidth: 65, halign: 'center' },
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      didParseCell: (data) => {
        const row = normalizedRows[data.row.index]

        if (row?.type === 'date') {
          data.cell.styles.fillColor = [232, 237, 243]
          data.cell.styles.textColor = NAVY
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fontSize = 9
          data.cell.styles.halign = data.column.index === 0 ? 'left' : 'left'
          data.cell.styles.cellPadding = {
            top: 7,
            right: 8,
            bottom: 7,
            left: 8,
          }
          data.cell.styles.lineWidth = 0.5
        }

        if (row?.type === 'session') {
          data.cell.styles.fillColor = LIGHT
          data.cell.styles.textColor = NAVY
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fontSize = 8.5
          data.cell.styles.halign = 'left'
          data.cell.styles.cellPadding = {
            top: 5,
            right: 7,
            bottom: 5,
            left: data.column.index === 1 ? 8 : 4,
          }
        }

        if (row?.type === 'class' && (data.column.index === 0 || data.column.index === 1)) {
          data.cell.styles.textColor = MUTED
        }

        if (
          row?.type === 'class' &&
          data.column.index === 7 &&
          String(data.cell.raw).toLowerCase() === 'completed'
        ) {
          data.cell.styles.textColor = [48, 110, 75]
          data.cell.styles.fontStyle = 'bold'
        }
      },
      didDrawCell: (data) => {
        const row = normalizedRows[data.row.index]

        if (row?.type === 'date' && data.column.index === 0) {
          doc.setFillColor(...NAVY)
          doc.rect(data.cell.x, data.cell.y, 3, data.cell.height, 'F')
        }

        if (row?.type === 'session' && data.column.index === 1) {
          doc.setFillColor(...NAVY)
          doc.rect(data.cell.x, data.cell.y, 3, data.cell.height, 'F')
        }
      },
      showHead: 'everyPage',
      rowPageBreak: 'avoid',
    })

    y = doc.lastAutoTable.finalY + 18
  }

  // ---------------- Extra tables ----------------
  if (extraTables?.length) {
    for (const extra of extraTables) {
      if (!extra.rows?.length) continue

      if (y > doc.internal.pageSize.getHeight() - 110) {
        doc.addPage()
        y = 85
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(...TEXT)
      doc.text(extra.title, PAGE_MARGIN, y)
      y += 10

      autoTable(doc, {
        startY: y + 6,
        margin: {
          left: PAGE_MARGIN,
          right: PAGE_MARGIN,
          top: 68,
          bottom: 38,
        },
        head: [extra.head],
        body: extra.rows,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 8.5,
          textColor: TEXT,
          cellPadding: 5,
          lineColor: BORDER,
          lineWidth: 0.35,
          overflow: 'linebreak',
          valign: 'middle',
        },
        headStyles: {
          fillColor: extra.accentColor || NAVY,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251],
        },
        showHead: 'everyPage',
        rowPageBreak: 'avoid',
      })

      y = doc.lastAutoTable.finalY + 18
    }
  }

  // ---------------- Photo appendix ----------------
  if (photos?.length) {
    await addPhotoAppendix(doc, photos, PAGE_MARGIN)
  }

  // ---------------- Footer + page identity ----------------
  addPageNumbers(doc, {
    schoolName,
    title,
  })

  doc.save(`${fileName || 'report'}.pdf`)
}

/** Small thumbnail grid, added as a new page. */
async function addPhotoAppendix(doc, photos, margin) {
  const shown = photos.slice(0, MAX_PDF_PHOTOS)
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  const cols = 3
  const cell = (pageWidth - margin * 2) / cols
  const imgSize = cell - 14
  const rowHeight = imgSize + 26

  doc.addPage()
  let y = 82

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...TEXT)
  doc.text('Class Photos', margin, y)
  y += 16

  let col = 0

  for (const photo of shown) {
    if (y + rowHeight > pageHeight - 45) {
      doc.addPage()
      y = 82
      col = 0
    }

    const x = margin + col * cell
    const dataUrl = await loadImageAsDataUrl(photo.thumbUrl || photo.url)

    if (dataUrl) {
      try {
        doc.addImage(
          dataUrl,
          'AUTO',
          x,
          y,
          imgSize,
          imgSize,
          undefined,
          'FAST'
        )
      } catch {
        // Ignore a single bad photo.
      }
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)

    const label = photo.classLabel || ''
    doc.text(label, x, y + imgSize + 10, {
      maxWidth: imgSize,
    })

    doc.setTextColor(...TEXT)

    col += 1

    if (col >= cols) {
      col = 0
      y += rowHeight
    }
  }

  if (photos.length > MAX_PDF_PHOTOS) {
    y += col > 0 ? rowHeight : 0

    if (y + 14 > pageHeight - 45) {
      doc.addPage()
      y = 82
    }

    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text(
      `+${photos.length - MAX_PDF_PHOTOS} more photos — view in the app.`,
      margin,
      y + 14
    )
    doc.setTextColor(...TEXT)
  }
}

/** Generic CSV/Excel export — Excel opens CSV natively. */
export function exportReportCsv({ rows, columns, fileName }) {
  const csv = Papa.unparse({
    fields: columns,
    data: rows,
  })

  const blob = new Blob(
    [csv],
    { type: 'text/csv;charset=utf-8;' }
  )

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.setAttribute(
    'download',
    `${fileName || 'report'}.csv`
  )

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

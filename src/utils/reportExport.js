// Report export — PDF via jspdf/jspdf-autotable, CSV via papaparse.
// Both libraries are already project dependencies (see package.json);
// nothing new was added for Phase 4.

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Papa from 'papaparse'

const MAX_PDF_PHOTOS = 24 // keep export fast and the file small (spec section 21)

/** Fetch a (small, pre-resized) image URL and return it as a data URL for jsPDF. */
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

/**
 * Build a clean, printable summary PDF for a report, with small thumbnail
 * photos appended at the end (spec section 14 — thumbnails only, capped,
 * so the export stays quick and the file stays small).
 */
export async function exportReportPdf({
  title,
  subtitle,
  summaryRows,
  tableTitle,
  tableHead,
  tableRows,
  photos,
  fileName,
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 40
  let y = margin

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(title, margin, y)
  y += 20

  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(90)
    doc.text(subtitle, margin, y)
    doc.setTextColor(0)
    y += 24
  }

  if (summaryRows?.length) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      body: summaryRows.map(([label, value]) => [label, String(value)]),
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: 'bold', textColor: [80, 80, 80] } },
    })
    y = doc.lastAutoTable.finalY + 20
  }

  if (tableRows?.length) {
    if (tableTitle) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text(tableTitle, margin, y)
      y += 10
    }
    autoTable(doc, {
      startY: y + 6,
      margin: { left: margin, right: margin },
      head: [tableHead],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: [30, 58, 95] },
      styles: { fontSize: 9, cellPadding: 4 },
    })
  }

  if (photos?.length) {
    await addPhotoAppendix(doc, photos, margin)
  }

  doc.save(`${fileName || 'report'}.pdf`)
}

/** Small thumbnail grid, added as a new page — captions/class labels included, originals excluded. */
async function addPhotoAppendix(doc, photos, margin) {
  const shown = photos.slice(0, MAX_PDF_PHOTOS)
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const cols = 3
  const cell = (pageWidth - margin * 2) / cols
  const imgSize = cell - 14
  const rowHeight = imgSize + 26

  doc.addPage()
  let y = margin
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Class Photos', margin, y)
  y += 16

  let col = 0
  for (const photo of shown) {
    if (y + rowHeight > pageHeight - margin) {
      doc.addPage()
      y = margin
      col = 0
    }
    const x = margin + col * cell
    // eslint-disable-next-line no-await-in-loop
    const dataUrl = await loadImageAsDataUrl(photo.thumbUrl || photo.url)
    if (dataUrl) {
      try {
        doc.addImage(dataUrl, 'JPEG', x, y, imgSize, imgSize, undefined, 'FAST')
      } catch {
        // A single bad image shouldn't break the whole export.
      }
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(90)
    const label = photo.classLabel || ''
    doc.text(label, x, y + imgSize + 10, { maxWidth: imgSize })
    doc.setTextColor(0)

    col += 1
    if (col >= cols) {
      col = 0
      y += rowHeight
    }
  }

  if (photos.length > MAX_PDF_PHOTOS) {
    y += col > 0 ? rowHeight : 0
    if (y + 14 > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(90)
    doc.text(`+${photos.length - MAX_PDF_PHOTOS} more photos — view in the app.`, margin, y + 14)
    doc.setTextColor(0)
  }
}

/** Generic tabular CSV/Excel export — Excel opens CSV natively. */
export function exportReportCsv({ rows, columns, fileName }) {
  const csv = Papa.unparse({ fields: columns, data: rows })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `${fileName || 'report'}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

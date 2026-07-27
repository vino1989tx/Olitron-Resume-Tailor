import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const UNSPLITTABLE_SELECTOR =
  ".resume-bullets li, .job-role, .job-meta, .project-heading, .skills-row, .education-line, .section-header";
const KEEP_WITH_NEXT_SELECTOR = ".section-header";
const HEADER_LOOKAHEAD_MAX_PX = 150;
const HEADER_LOOKAHEAD_BUFFER_PX = 60;
const PAGE_MARGIN_PT = 24;

function waitForBrowserPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function getUnsplittableRanges(element: HTMLElement, canvasToCssRatio: number) {
  const containerRect = element.getBoundingClientRect();
  const ranges: Array<{ top: number; bottom: number }> = [];

  element.querySelectorAll<HTMLElement>(UNSPLITTABLE_SELECTOR).forEach((el) => {
    const rect = el.getBoundingClientRect();
    let top = rect.top - containerRect.top;
    let bottom = rect.bottom - containerRect.top;

    if (el.matches(KEEP_WITH_NEXT_SELECTOR)) {
      const nextSibling = el.nextElementSibling;
      if (nextSibling) {
        const nextRect = nextSibling.getBoundingClientRect();
        const nextHeight = nextRect.height;
        const lookahead = nextHeight <= HEADER_LOOKAHEAD_MAX_PX ? nextHeight : HEADER_LOOKAHEAD_BUFFER_PX;
        bottom = Math.max(bottom, bottom + lookahead);
      }
    }

    ranges.push({ top: top * canvasToCssRatio, bottom: bottom * canvasToCssRatio });
  });

  return ranges;
}

function computePageBreaks(canvasHeight: number, pageHeightPx: number, ranges: Array<{ top: number; bottom: number }>) {
  const breaks: Array<[number, number]> = [];
  let cursor = 0;
  let guard = 0;

  while (cursor < canvasHeight && guard < 500) {
    guard += 1;
    const naiveEnd = Math.min(cursor + pageHeightPx, canvasHeight);
    let adjustedEnd = naiveEnd;

    for (const range of ranges) {
      if (range.top < naiveEnd && range.bottom > naiveEnd && range.top > cursor) {
        adjustedEnd = Math.min(adjustedEnd, range.top);
      }
    }

    if (adjustedEnd <= cursor) adjustedEnd = naiveEnd;
    breaks.push([cursor, adjustedEnd]);
    cursor = adjustedEnd;
  }

  return breaks;
}

function cropCanvas(sourceCanvas: HTMLCanvasElement, top: number, bottom: number) {
  const sliceHeight = Math.max(1, Math.round(bottom - top));
  const cropped = document.createElement("canvas");
  cropped.width = sourceCanvas.width;
  cropped.height = sliceHeight;
  const ctx = cropped.getContext("2d");
  ctx?.drawImage(
    sourceCanvas,
    0,
    Math.round(top),
    sourceCanvas.width,
    sliceHeight,
    0,
    0,
    sourceCanvas.width,
    sliceHeight
  );
  return cropped;
}

export async function exportElementToPdf(element: HTMLElement, filename: string): Promise<void> {
  window.getSelection()?.removeAllRanges();
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  const exportElement = element.cloneNode(true) as HTMLElement;
  exportElement.classList.add('pdf-export-mode');
  exportElement.style.position = 'absolute';
  exportElement.style.left = '-100000px';
  exportElement.style.top = '0';
  exportElement.style.margin = '0';
  exportElement.style.boxShadow = 'none';
  exportElement.style.width = `${element.getBoundingClientRect().width}px`;

  exportElement.querySelectorAll<HTMLElement>('.tailored-line').forEach((line) => {
    line.classList.remove('tailored-line');
    line.style.setProperty('background', 'transparent', 'important');
    line.style.setProperty('background-color', 'transparent', 'important');
    line.style.setProperty('border', 'none', 'important');
    line.style.setProperty('box-shadow', 'none', 'important');
    line.style.setProperty('outline', 'none', 'important');
  });
  exportElement.querySelectorAll<HTMLElement>('.tailored-badge').forEach((badge) => badge.remove());
  exportElement.querySelectorAll<HTMLElement>('[contenteditable]').forEach((editable) => {
    editable.removeAttribute('contenteditable');
    editable.style.setProperty('background', 'transparent', 'important');
    editable.style.setProperty('background-color', 'transparent', 'important');
    editable.style.setProperty('box-shadow', 'none', 'important');
    editable.style.setProperty('outline', 'none', 'important');
  });

  document.body.appendChild(exportElement);

  try {
    await waitForBrowserPaint();

    const canvas = await html2canvas(exportElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      onclone: (clonedDocument) => {
        const clonedResume = clonedDocument.querySelector<HTMLElement>('.pdf-export-mode');
        if (!clonedResume) return;

        clonedResume.querySelectorAll<HTMLElement>('.tailored-line').forEach((line) => {
          line.classList.remove('tailored-line');
          line.style.setProperty('background', 'transparent', 'important');
          line.style.setProperty('background-color', 'transparent', 'important');
          line.style.setProperty('border-left', 'none', 'important');
          line.style.setProperty('padding', '0', 'important');
          line.style.setProperty('box-shadow', 'none', 'important');
          line.style.setProperty('outline', 'none', 'important');
        });

        clonedResume.querySelectorAll<HTMLElement>('.tailored-badge').forEach((badge) => {
          badge.remove();
        });

        clonedResume.querySelectorAll<HTMLElement>('[contenteditable="true"]').forEach((editable) => {
          editable.style.setProperty('background', 'transparent', 'important');
          editable.style.setProperty('background-color', 'transparent', 'important');
          editable.style.setProperty('box-shadow', 'none', 'important');
          editable.style.setProperty('outline', 'none', 'important');
        });
      },
    });

    const canvasToCssRatio = canvas.width / exportElement.getBoundingClientRect().width;

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "letter",
      compress: true,
    });

    const pageWidthPt = pdf.internal.pageSize.getWidth();
    const pageHeightPt = pdf.internal.pageSize.getHeight();
    const ptToCanvasPx = canvas.width / pageWidthPt;
    const contentHeightPt = pageHeightPt - PAGE_MARGIN_PT * 2;
    const pageHeightPx = contentHeightPt * ptToCanvasPx;

    const ranges = getUnsplittableRanges(exportElement, canvasToCssRatio);
    const pageBreaks = computePageBreaks(canvas.height, pageHeightPx, ranges);

    pageBreaks.forEach(([top, bottom], index) => {
      const slice = cropCanvas(canvas, top, bottom);
      const sliceHeightPt = (bottom - top) / ptToCanvasPx;
      const imgData = slice.toDataURL("image/jpeg", 0.92);

      if (index > 0) pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, PAGE_MARGIN_PT, pageWidthPt, sliceHeightPt);
    });

    pdf.save(filename);
  } finally {
    exportElement.remove();
  }
}

import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export async function extractArticlePdfContent(pdfData) {
  if (!(pdfData instanceof ArrayBuffer)) throw new Error("Dados do PDF inválidos");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  // PDF.js may transfer ownership of its input to the worker. Keep the viewer's copy.
  const task = pdfjs.getDocument({ data: pdfData.slice(0) });
  try {
    const pdf = await task.promise;
    const pagesRead = Math.min(pdf.numPages, 10);
    let text = "";
    for (let number = 1; number <= pagesRead; number += 1) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str).join(" ").trim();
      if (pageText) text += `[Página ${number}]\n${pageText}\n\n`;
    }
    return { text: text.slice(0, 8000).trim(), pagesRead, totalPages: pdf.numPages,
      partial: pagesRead < pdf.numPages || text.length > 8000 };
  } finally {
    await task.destroy().catch(() => {});
  }
}

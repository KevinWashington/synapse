import { beforeEach, expect, it, vi } from "vitest";
import { extractArticlePdfContent } from "./articlePdfContent";

const pdf = vi.hoisted(() => ({ getDocument: vi.fn(), GlobalWorkerOptions: {} }));
vi.mock("pdfjs-dist", () => pdf);
beforeEach(() => { pdf.getDocument.mockReset(); });

it("keeps the viewer buffer intact and labels the pages actually supplied", async () => {
  const source = new ArrayBuffer(8);
  const pages = [];
  pdf.getDocument.mockImplementation(({ data }) => {
    structuredClone(data, { transfer: [data] });
    return { destroy: async () => {}, promise: Promise.resolve({
      numPages: 30,
      getPage: async (number) => {
        pages.push(number);
        return { getTextContent: async () => ({ items: [{ str: `Texto ${number}` }] }) };
      },
    }) };
  });
  const result = await extractArticlePdfContent(source);
  expect(source.byteLength).toBe(8);
  expect(pages).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  expect(result.text).toContain("[Página 10]");
  expect(result.totalPages).toBe(30);
  expect(result.pagesRead).toBe(10);
  expect(result.partial).toBe(true);
});

it("reports text truncation rather than implying the complete PDF was read", async () => {
  pdf.getDocument.mockReturnValue({ destroy: async () => {}, promise: Promise.resolve({
    numPages: 1,
    getPage: async () => ({ getTextContent: async () => ({ items: [{ str: "a".repeat(9000) }] }) }),
  }) });
  const result = await extractArticlePdfContent(new ArrayBuffer(8));
  expect(result.text.length).toBeLessThanOrEqual(8000);
  expect(result.partial).toBe(true);
});

import * as pdfjs from 'pdfjs-dist';

// Use the local worker from the package for better reliability in Vite
// Using the legacy build path if needed, but modern Vite usually handles this well
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    if (!fullText.trim()) {
      throw new Error('No text content found in the PDF. It might be an image-only PDF.');
    }

    return fullText;
  } catch (error) {
    console.error('PDF Extraction Error:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
    throw new Error('Failed to extract text from PDF. The file might be corrupted or in an unsupported format.');
  }
}

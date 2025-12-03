import * as pdfjsLib from 'pdfjs-dist';

// Handle module structure differences in CDN environments (ESM vs CJS wrapper)
// @ts-ignore
const pdfLib = pdfjsLib.default || pdfjsLib;

// Set the worker source safely.
// Use specific stable version 3.11.174 to match import map
try {
    if (pdfLib && pdfLib.GlobalWorkerOptions) {
        pdfLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    }
} catch (e) {
    console.warn("Failed to initialize PDF Worker. PDF processing may fail.", e);
}

/**
 * Converts the first page of a PDF file to a Base64 image string (PNG).
 * This allows us to use the existing Image-based AI pipeline and UI previews.
 */
export const convertPdfToImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();

        fileReader.onload = async function() {
            try {
                const typedarray = new Uint8Array(this.result as ArrayBuffer);

                // Load the PDF document using the resolved library object
                const loadingTask = pdfLib.getDocument(typedarray);
                const pdfDocument = await loadingTask.promise;
                
                // Get the first page
                const page = await pdfDocument.getPage(1);

                // Determine scale (we want a decent resolution for OCR)
                // 1.5 scale is usually a good balance between quality and size
                const scale = 1.5; 
                const viewport = page.getViewport({ scale: scale });

                // Prepare canvas
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                if (!context) {
                    reject(new Error("Could not get canvas context"));
                    return;
                }

                // Render PDF page into canvas context
                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };
                
                await page.render(renderContext).promise;

                // Convert canvas to Data URL (Base64 PNG)
                const dataUrl = canvas.toDataURL('image/png');
                resolve(dataUrl);

            } catch (error) {
                console.error('Error parsing PDF: ', error);
                reject(error);
            }
        };

        fileReader.onerror = (error) => reject(error);
        fileReader.readAsArrayBuffer(file);
    });
};
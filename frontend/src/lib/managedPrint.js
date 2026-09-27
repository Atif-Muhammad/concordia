export const preparePrintHtml = (html = "") => {
  if (!html) return "";

  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?window\.print\([\s\S]*?<\/script>/gi, "")
    .replace(/window\.onload\s*=\s*[^<;]+;?/gi, "")
    .replace(/window\.print\s*\(\s*\)\s*;?/gi, "");
};

const writePreparingDocument = (printWindow, title) => {
  printWindow.document.open();
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Arial, sans-serif; color: #334155; background: #f8fafc; }
          .box { border: 1px solid #e2e8f0; background: white; padding: 24px 28px; border-radius: 12px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); text-align: center; }
          .title { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
          .muted { font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="box">
          <div class="title">Preparing print view...</div>
          <div class="muted">Please wait while the challan is rendered.</div>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
};

const waitForPrintAssets = async (printWindow, timeoutMs = 2500) => {
  const doc = printWindow.document;
  const imagePromises = Array.from(doc.images || []).map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  });

  const fontPromise = doc.fonts?.ready?.catch?.(() => undefined) || Promise.resolve();
  const assetPromise = Promise.allSettled([...imagePromises, fontPromise]);
  const timeoutPromise = new Promise((resolve) => setTimeout(resolve, timeoutMs));

  await Promise.race([assetPromise, timeoutPromise]);
};

export const openManagedPrintWindow = async ({ html, title = "Print Challan", toast, printWindow = null }) => {
  const targetWindow = printWindow || window.open("", "_blank");

  if (!targetWindow) {
    toast?.({
      title: "Pop-up blocked",
      description: "Please allow pop-ups to print challans.",
      variant: "destructive",
    });
    return false;
  }

  writePreparingDocument(targetWindow, title);
  const preparedHtml = preparePrintHtml(html);

  await new Promise((resolve) => setTimeout(resolve, 50));

  targetWindow.document.open();
  targetWindow.document.write(preparedHtml);
  targetWindow.document.close();

  await new Promise((resolve) => setTimeout(resolve, 100));
  await waitForPrintAssets(targetWindow);

  try {
    targetWindow.focus?.();
    targetWindow.print?.();
  } catch (error) {
    console.error("Print failed:", error);
    toast?.({ title: "Print error", description: "Failed to open browser print dialog.", variant: "destructive" });
    return false;
  }

  return true;
};

export const buildBulkPrintHtml = (htmlParts = []) => `
  <!DOCTYPE html>
  <html>
    <head>
      <style>
        @media print {
          .page-break { page-break-after: always; }
          @page { margin: 0; }
          body { margin: 0; }
        }
      </style>
    </head>
    <body>
      ${htmlParts.map((html, index) => `<div class="${index < htmlParts.length - 1 ? "page-break" : ""}">${html}</div>`).join("")}
    </body>
  </html>
`;

export const renderAndPrintChallans = async ({ renderers = [], title = "Print Challans", toast }) => {
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    toast?.({
      title: "Pop-up blocked",
      description: "Please allow pop-ups to print challans.",
      variant: "destructive",
    });
    return false;
  }

  writePreparingDocument(printWindow, title);

  const htmlParts = [];
  for (const render of renderers) {
    htmlParts.push(await render());
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return openManagedPrintWindow({
    html: buildBulkPrintHtml(htmlParts),
    title,
    toast,
    printWindow,
  });
};

export function chunkPdfMarkdown(markdown = "", options = {}) {
  const chunkSize = options.chunkSize || 1200;
  const overlap = options.overlap || 150;
  const normalized = String(markdown || "").replace(/\r\n/g, "\n").trim();

  if (!normalized) return [];

  const sections = normalized
    .split(/\n(?=#{1,6}\s)/g)
    .map((section) => section.trim())
    .filter(Boolean);

  const chunks = [];

  for (const section of sections.length ? sections : [normalized]) {
    let start = 0;

    while (start < section.length) {
      const end = Math.min(start + chunkSize, section.length);
      const content = section.slice(start, end).trim();

      if (content) {
        chunks.push({
          id: `chunk_${chunks.length + 1}`,
          content,
          sourceType: "pdf_markdown",
          tokenEstimate: Math.ceil(content.length / 4),
        });
      }

      if (end >= section.length) break;
      start = Math.max(0, end - overlap);
    }
  }

  return chunks;
}

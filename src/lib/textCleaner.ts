/**
 * Decodes Quoted-Printable encoded strings.
 * This is crucial for MHTML files which often use this encoding.
 */
function decodeQuotedPrintable(text: string): string {
  // 1. Remove soft line breaks (equals sign at the end of a line)
  let decoded = text.replace(/=\r?\n/g, '');
  
  // 2. Replace hex codes like =20 with their characters
  decoded = decoded.replace(/=([0-9A-F]{2})/gi, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  
  return decoded;
}

/**
 * Cleans article text by removing common noise from HTML/MHTML/TXT files.
 * This helps stay within token limits and focuses the AI on actual content.
 */
export function cleanArticleText(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // 1. Robust MHTML Handling
  if (text.includes('multipart/related') || text.includes('MIME-Version:') || text.includes('Content-Type: text/html')) {
    // Try to find the boundary
    const boundaryMatch = text.match(/boundary="?([^"\s;]+)"?/i);
    const boundary = boundaryMatch ? boundaryMatch[1] : null;

    if (boundary) {
      // Boundaries can be prefixed with -- and suffixed with -- for the end
      const parts = text.split(`--${boundary}`);
      // Find the first part that looks like HTML or significant text
      const htmlPart = parts.find(part => 
        part.toLowerCase().includes('content-type: text/html') || 
        part.toLowerCase().includes('<html') ||
        part.toLowerCase().includes('<!doctype html') ||
        (part.toLowerCase().includes('content-type: text/plain') && part.length > 500)
      );
      
      if (htmlPart) {
        // Check for Quoted-Printable encoding
        if (htmlPart.toLowerCase().includes('content-transfer-encoding: quoted-printable')) {
          // Extract just the body of this part (after the headers)
          // Headers and body are separated by a double newline
          const bodyStart = htmlPart.search(/\r?\n\r?\n/);
          const body = bodyStart !== -1 ? htmlPart.substring(bodyStart).trim() : htmlPart;
          cleaned = decodeQuotedPrintable(body);
        } else {
          // Just strip headers if possible
          const bodyStart = htmlPart.search(/\r?\n\r?\n/);
          cleaned = bodyStart !== -1 ? htmlPart.substring(bodyStart).trim() : htmlPart;
        }
      }
    } else {
      // Fallback if no boundary found: try to find the first HTML block
      const htmlStart = text.search(/<html|<!doctype html/i);
      if (htmlStart !== -1) {
        cleaned = text.substring(htmlStart);
      } else {
        const contentTypeStart = text.indexOf('Content-Type: text/html');
        if (contentTypeStart !== -1) {
          const bodyStart = text.indexOf('\n\n', contentTypeStart);
          cleaned = bodyStart !== -1 ? text.substring(bodyStart) : text.substring(contentTypeStart);
        }
      }
      
      if (cleaned.toLowerCase().includes('quoted-printable')) {
        cleaned = decodeQuotedPrintable(cleaned);
      }
    }
  }

  // 2. Remove common noise patterns
  // Remove base64 data (very common in MHTML/HTML)
  cleaned = cleaned.replace(/data:[^;]+;base64,[a-zA-Z0-9+/=]+/g, '[IMAGE_DATA]');
  
  // Remove large blocks of base64 that might not be prefixed with data:
  cleaned = cleaned.replace(/[a-zA-Z0-9+/]{500,}/g, '[ENCODED_DATA]');

  // 3. Strip HTML tags to get just the text
  cleaned = cleaned.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '');
  cleaned = cleaned.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, '');
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');

  // 4. Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // 5. Final safety truncation - 50k characters is better for long articles with MHTML overhead
  return cleaned.substring(0, 50000);
}

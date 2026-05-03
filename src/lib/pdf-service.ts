export function validatePDFFile(
  file: File | Buffer,
  maxSizeMB = 10
): { valid: boolean; error?: string } {
  const size = file instanceof File ? file.size : file.length;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (size > maxSizeBytes) {
    return {
      valid: false,
      error: `PDF file size exceeds ${maxSizeMB}MB limit`,
    };
  }

  return { valid: true };
}

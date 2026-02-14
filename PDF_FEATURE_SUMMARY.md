# PDF Support Feature Implementation

## Overview

Added comprehensive PDF upload, storage, and viewing support to the web-annotator application. Users can now upload PDF files, which are stored in Firebase Storage, and view them with a dedicated PDF viewer alongside the existing web article functionality.

## Changes Made

### 1. Data Model Updates

#### `/src/types.ts`

- Added `type?: 'article' | 'pdf'` to distinguish between articles and PDFs
- Added `pdfUrl?: string` for Firebase Storage location
- Added `extractedText?: string` for searchable PDF content (used by AI chat)
- Added `pdfMetadata?: { pageCount?: number; fileSize?: number }` for PDF information
- Updated `NoteAnchor` to include `pageNumber?: number` for future PDF annotation support

### 2. Backend Services

#### `/src/lib/pdf-service.ts` (NEW)

- Created service for PDF text extraction using `pdf-parse`
- Implemented `extractTextFromPDF()` to extract text and metadata
- Added `validatePDFFile()` for file size validation (10MB limit)
- Returns page count and metadata (title, author) from PDF

#### `/src/lib/articles-service.ts`

- Updated `sanitizeArticlePayload()` to handle PDF-specific fields
- Updated `createArticleRecord()` to accept PDF metadata
- Updated `fetchArticleSummaries()` to include PDF fields
- Updated `fetchArticleById()` to return PDF data

#### `/src/app/api/pdf/upload/route.ts` (NEW)

- Created POST endpoint for PDF file uploads
- Validates file type and size
- Extracts text using pdf-parse
- Uploads to Firebase Storage with proper metadata
- Makes file publicly accessible
- Creates article record with extracted text for AI chat

### 3. Frontend Components

#### `/src/components/PDFViewer.tsx` (NEW)

- React component using `react-pdf` library
- Features:
  - Page navigation (previous/next)
  - Zoom controls (in/out/reset)
  - Responsive scaling
  - Theme integration with app settings
  - Loading and error states
  - Text layer rendering for text selection

#### `/src/components/PDFReaderClient.tsx` (NEW)

- Dedicated reader for PDF documents
- Simplified interface (no annotation markers yet)
- Integrated AI chat for PDF content
- Uses extracted text for AI queries
- Matches existing app design patterns

#### `/src/components/HomeClient.tsx`

- Added PDF upload button with file input
- Added upload progress tracking
- Updated UI to show "Add New Content" instead of just "Add New Article"
- Added PDF type indicator (FileText icon) on article cards
- Display page count badge for PDFs
- Shows "PDF Document" instead of URL for PDF items
- Updated delete modal to differentiate between PDFs and articles

### 4. Router Updates

#### `/src/app/reader/[id]/page.tsx`

- Added conditional rendering based on article type
- Routes to `PDFReaderClient` for PDFs
- Routes to existing `ReaderClient` for articles

### 5. Dependencies Added

```json
{
  "pdfjs-dist": "^latest",
  "react-pdf": "^latest",
  "pdf-parse": "^latest"
}
```

## Features Implemented

### Upload Flow

1. User selects PDF file from file input or drag-and-drop
2. Client validates file type and size (< 10MB)
3. File is uploaded to `/api/pdf/upload`
4. Server extracts text using pdf-parse
5. PDF is stored in Firebase Storage at `pdfs/{userId}/{timestamp}_{filename}`
6. File is made publicly accessible
7. Article record created with extracted text
8. User is redirected to PDF viewer

### PDF Viewing

- Full PDF rendering with react-pdf
- Page-by-page navigation
- Zoom controls (50% to 250%)
- Maintains aspect ratio
- Theme-aware (dark/light/sepia)
- Loading states and error handling

### AI Chat Integration

- Uses extracted text from PDF
- Works with existing NotesAIChat component
- Allows questions about PDF content
- No code changes needed to AI chat component

### UI Enhancements

- PDF documents show FileText icon badge
- Page count displayed on cards
- "PDF Document" label instead of URL
- Separate delete confirmation text for PDFs
- Upload progress indication

## Limitations & Future Enhancements

### Current Limitations

1. **Annotations**: PDF annotations are not yet supported (marked as "coming soon" in UI)
2. **OCR**: Only works with text-based PDFs, not scanned documents
3. **File Size**: Limited to 10MB per PDF
4. **Page Anchoring**: Notes cannot be anchored to specific PDF pages yet

### Future Enhancements

1. **PDF Annotations**:
   - Implement page-based note anchoring
   - Add highlight/markup tools
   - Persist annotations with page numbers

2. **Advanced Features**:
   - OCR support for scanned PDFs
   - PDF thumbnail generation
   - Search within PDF
   - Download original PDF
   - Print functionality

3. **Performance**:
   - Lazy loading for multi-page PDFs
   - Caching strategy for faster loads
   - Progressive loading indicators

4. **Collaboration**:
   - Share PDFs with other users
   - Collaborative annotations
   - Comments on specific pages

## File Structure

```
src/
├── types.ts (updated)
├── lib/
│   ├── pdf-service.ts (new)
│   └── articles-service.ts (updated)
├── components/
│   ├── PDFViewer.tsx (new)
│   ├── PDFReaderClient.tsx (new)
│   └── HomeClient.tsx (updated)
└── app/
    ├── api/
    │   └── pdf/
    │       └── upload/
    │           └── route.ts (new)
    └── reader/
        └── [id]/
            └── page.tsx (updated)
```

## Testing Checklist

- [ ] Upload small PDF (< 1MB)
- [ ] Upload large PDF (5-10MB)
- [ ] Verify PDF appears in library
- [ ] Open PDF and verify rendering
- [ ] Test page navigation
- [ ] Test zoom controls
- [ ] Test AI chat with PDF content
- [ ] Verify theme changes apply to PDF viewer
- [ ] Test delete PDF functionality
- [ ] Verify extracted text is searchable by AI
- [ ] Test error handling for invalid files
- [ ] Test error handling for oversized files

## Environment Variables Required

Existing Firebase configuration should work:

- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (or derived from project ID)
- `FIREBASE_SERVICE_ACCOUNT_KEY` (for Storage admin access)

## API Endpoints

### New Endpoints

- `POST /api/pdf/upload` - Upload and process PDF file

### Updated Endpoints

- `GET /api/articles` - Now returns PDF metadata
- `GET /api/articles/[id]` - Now returns PDF data
- `POST /api/articles` - Supports PDF type creation (used internally)

## Migration Notes

No database migration required. Existing articles continue to work as before.
New fields are optional and only populated for PDF documents.

## Security Considerations

1. **File Validation**: Strict PDF MIME type checking
2. **Size Limits**: 10MB maximum to prevent abuse
3. **Access Control**: PDFs associated with user ID
4. **Storage**: Files are public but unguessable URLs
5. **Sanitization**: Text extraction is sandboxed

## Performance Considerations

1. **Client-side**: PDF rendering uses web workers (via pdfjs)
2. **Server-side**: Text extraction runs synchronously (consider queue for large files)
3. **Storage**: Firebase Storage CDN for fast delivery
4. **Caching**: React Query caches article data including PDFs

## Known Issues

1. PDF worker URL uses unpkg CDN - consider self-hosting for production
2. Large PDFs (> 50 pages) may have slower initial render
3. Text extraction quality depends on PDF structure

## Deployment Notes

1. Ensure Firebase Storage bucket exists and is configured
2. Verify service account has Storage admin permissions
3. Consider implementing cleanup job for orphaned PDFs
4. Monitor storage usage and costs
5. Test with various PDF types before production deploy

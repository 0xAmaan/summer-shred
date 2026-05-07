"use client";

import * as React from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export default function PdfViewer({ url }: { url: string }) {
  return <PdfViewerInner key={url} url={url} />;
}

function PdfViewerInner({ url }: { url: string }) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [numPages, setNumPages] = React.useState<number | null>(null);
  const [pageWidth, setPageWidth] = React.useState<number>(0);
  const [errored, setErrored] = React.useState(false);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      setPageWidth(Math.max(0, w - 16));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fileProp = React.useMemo(() => ({ url }), [url]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto overscroll-contain bg-muted/40 p-2 sm:p-4"
      style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
    >
      <Document
        file={fileProp}
        loading={
          <div className="text-center py-12 text-sm text-muted-foreground">
            Loading PDF…
          </div>
        }
        error={
          <div className="text-center py-12 text-sm text-destructive">
            Couldn&apos;t load PDF.
          </div>
        }
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        onLoadError={() => setErrored(true)}
      >
        {!errored && pageWidth > 0 && numPages !== null
          ? Array.from({ length: numPages }, (_, i) => (
              <Page
                key={i + 1}
                pageNumber={i + 1}
                width={pageWidth}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="mx-auto mb-3 shadow-sm bg-white"
              />
            ))
          : null}
      </Document>
    </div>
  );
}

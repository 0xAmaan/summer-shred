"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PdfViewer = dynamic(() => import("./pdf-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
      Loading PDF…
    </div>
  ),
});

export interface PreviewState {
  url: string;
  label: string;
}

export function useScanPreview() {
  const [preview, setPreview] = React.useState<PreviewState | null>(null);
  const open = React.useCallback(
    (url: string, label: string) => setPreview({ url, label }),
    []
  );
  const close = React.useCallback(() => setPreview(null), []);
  return { preview, open, close };
}

export function ScanPreviewDialog({
  preview,
  onClose,
}: {
  preview: PreviewState | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={preview !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="w-full max-w-full sm:max-w-3xl h-[100dvh] sm:h-[85vh] flex flex-col p-0 gap-0 overflow-hidden rounded-none sm:rounded-xl"
        showCloseButton={false}
      >
        <DialogHeader className="px-4 py-3 border-b border-border flex-row items-center justify-between space-y-0 shrink-0">
          <DialogTitle className="text-sm truncate pr-3">{preview?.label}</DialogTitle>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>
        {preview && <PdfViewer url={preview.url} />}
      </DialogContent>
    </Dialog>
  );
}

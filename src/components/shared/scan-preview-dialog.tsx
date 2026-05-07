"use client";

import * as React from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
      <DialogContent className="sm:max-w-3xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-border flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-sm">{preview?.label}</DialogTitle>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>
        {preview && (
          <iframe
            src={preview.url}
            title={preview.label}
            className="flex-1 w-full border-0"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

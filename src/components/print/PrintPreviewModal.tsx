import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  printUrl: string;
}

function previewUrl(url: string): string {
  return url.startsWith("#") ? url : url;
}

export function PrintPreviewModal({ isOpen, onClose, title, printUrl }: PrintPreviewModalProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) setLoading(true);
  }, [isOpen, printUrl]);

  const printFrame = () => {
    frameRef.current?.contentWindow?.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="h-[min(90vh,900px)] max-w-6xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Review the document, then use the browser print dialog.
          </DialogDescription>
        </DialogHeader>
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border bg-muted/30">
          {loading && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-background/80 text-sm text-muted-foreground">
              Loading preview…
            </div>
          )}
          <iframe
            ref={frameRef}
            title={title}
            src={previewUrl(printUrl)}
            className="h-full min-h-[60vh] w-full border-0 bg-white"
            onLoad={() => setLoading(false)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={printFrame} className="gap-2">
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { PrintPreviewModal } from "@/components/print/PrintPreviewModal";

interface PrintDialogProps {
  isOpen: boolean;
  onClose: () => void;
  printUrl: string;
  title?: string;
}

export function PrintDialog({
  isOpen,
  onClose,
  printUrl,
  title = "Print Document",
}: PrintDialogProps) {
  return <PrintPreviewModal isOpen={isOpen} onClose={onClose} printUrl={printUrl} title={title} />;
}

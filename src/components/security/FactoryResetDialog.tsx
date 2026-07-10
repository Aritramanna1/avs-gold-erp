import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { clearAllLocalData } from "@/lib/settings-store";

interface FactoryResetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firmName: string;
}

export function FactoryResetDialog({ open, onOpenChange, firmName }: FactoryResetDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    if (confirmText !== firmName || resetting) return;
    setResetting(true);
    // Same reset path as Settings > Danger Zone > "Clear local pilot data":
    // wipes the pilot localStorage cache, session storage, and the encrypted
    // local SQLite database (which also clears the IndexedDB crypto store,
    // i.e. encrypted-storage keys). Awaited so the reload below only happens
    // once everything has actually been cleared.
    await clearAllLocalData();
    window.location.href = "/";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] border-red-200">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <DialogTitle className="text-center text-xl text-red-600">Factory Reset</DialogTitle>
          <DialogDescription className="text-center pt-2 font-medium text-neutral-800">
            This action cannot be undone. This will permanently delete all local ERP data, including
            billing, inventory, job cards, people, and settings, and return the system to the
            First-Time Setup state.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-red-50 text-red-800 p-3 rounded-md text-sm border border-red-200">
            <p className="font-bold mb-1">Warning: Irreversible Data Loss!</p>
            <p>
              Ensure you have downloaded an encrypted backup before proceeding if you wish to keep
              your data.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-700">
              Please type{" "}
              <span className="font-bold text-black select-all bg-neutral-100 px-1 py-0.5 rounded">
                {firmName}
              </span>{" "}
              to confirm.
            </label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={firmName}
              className="border-red-200 focus-visible:ring-red-500"
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleReset()}
            disabled={confirmText !== firmName || resetting}
            className="w-full sm:w-auto bg-red-600 hover:bg-red-700"
          >
            {resetting ? "Erasing…" : "Erase All Data"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

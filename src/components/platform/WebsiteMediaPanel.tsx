import { useRef, useState } from "react";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { uploadFileToSupabase } from "@/lib/supabase-storage";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type MediaRow = {
  id: string;
  page_key: string | null;
  slot_key: string;
  storage_path: string;
  alt_text: string | null;
  sort_order: number;
};

export function WebsiteMediaPanel() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pageKey, setPageKey] = useState("home");
  const [slotKey, setSlotKey] = useState("hero");
  const [alt, setAlt] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: media = [] } = useQuery({
    queryKey: ["website-media"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_website_media" as never)
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) return [];
      return data as MediaRow[];
    },
  });

  async function onUpload(file: File) {
    setUploading(true);
    try {
      const { filePath } = await uploadFileToSupabase(
        "firm-assets",
        file,
        "website_assets",
        `${pageKey}_${slotKey}`,
      );
      const { error } = await supabase.from("public_website_media" as never).insert({
        page_key: pageKey,
        slot_key: slotKey,
        storage_path: filePath,
        alt_text: alt || file.name,
        sort_order: media.length,
      } as never);
      if (error) throw error;
      toast.success("Screenshot uploaded.");
      void qc.invalidateQueries({ queryKey: ["website-media"] });
      void qc.invalidateQueries({ queryKey: ["public-website-bundle"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    await supabase
      .from("public_website_media" as never)
      .update({ is_active: false } as never)
      .eq("id", id);
    void qc.invalidateQueries({ queryKey: ["website-media"] });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Product screenshots & media</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Page</Label>
            <Input
              value={pageKey}
              onChange={(e) => setPageKey(e.target.value)}
              placeholder="home"
            />
          </div>
          <div>
            <Label>Slot</Label>
            <Input
              value={slotKey}
              onChange={(e) => setSlotKey(e.target.value)}
              placeholder="hero"
            />
          </div>
          <div>
            <Label>Alt text</Label>
            <Input value={alt} onChange={(e) => setAlt(e.target.value)} />
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Upload image (R2)
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onUpload(f);
          }}
        />
        <ul className="space-y-2">
          {media.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 rounded border p-2 text-sm"
            >
              <span className="flex items-center gap-2 truncate">
                <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                {m.page_key}/{m.slot_key} — {m.storage_path}
              </span>
              <Button type="button" size="icon" variant="ghost" onClick={() => void remove(m.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
          {media.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No media yet. Upload ERP screenshots for the homepage hero.
            </p>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

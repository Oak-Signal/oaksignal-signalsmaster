"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Pencil, Trash2 } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useHydrated } from "@/hooks/use-hydrated";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { STAGE_BADGE_COLORS } from "@/lib/content/badge-colors";
import type { Stage } from "@/lib/content/types";
import { cn } from "@/lib/utils";

const STAGE_VALUES = Object.keys(STAGE_BADGE_COLORS) as Stage[];

interface DevlogDraft {
  version: string;
  date: string;
  title: string;
  stage: Stage;
  category: string;
  body: string;
}

function buildDefaultDraft(): DevlogDraft {
  return {
    version: "",
    date: new Date().toISOString().slice(0, 10),
    title: "",
    stage: "Pre-Alpha",
    category: "improvement",
    body: "",
  };
}

function hydrateDraftFromDevlog(devlog: Doc<"devlogs">): DevlogDraft {
  return {
    version: devlog.version,
    date: devlog.date,
    title: devlog.title,
    stage: devlog.stage,
    category: devlog.category,
    body: devlog.body,
  };
}

/**
 * Minimal admin CRUD UI for `devlogs` (the public "Latest Updates" changelog data), per FR-031.
 * Auth is already enforced by `proxy.ts` at the route level — no additional gating needed here.
 */
export function AdminDevlogsPanel() {
  // Convex query results are always undefined during SSR; gate until after mount so the first
  // client render matches the server markup exactly (see `components/admin/admin-header.tsx`).
  const hasMounted = useHydrated();
  const devlogs = useQuery(api.devlogs.listDevlogs, {});
  const createDevlog = useMutation(api.devlogs.createDevlog);
  const updateDevlog = useMutation(api.devlogs.updateDevlog);
  const deleteDevlog = useMutation(api.devlogs.deleteDevlog);
  const { toast } = useToast();

  const [draft, setDraft] = useState<DevlogDraft>(buildDefaultDraft);
  const [editingId, setEditingId] = useState<Id<"devlogs"> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Doc<"devlogs"> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isLoading = !hasMounted || devlogs === undefined;
  const isEditing = editingId !== null;
  const canSubmit =
    draft.version.trim().length > 0 &&
    draft.date.trim().length > 0 &&
    draft.title.trim().length > 0 &&
    draft.category.trim().length > 0 &&
    !isSaving;

  function resetDraft() {
    setDraft(buildDefaultDraft());
    setEditingId(null);
  }

  function startEditing(devlog: Doc<"devlogs">) {
    setDraft(hydrateDraftFromDevlog(devlog));
    setEditingId(devlog._id);
  }

  async function handleSubmit() {
    setIsSaving(true);

    try {
      const payload = {
        version: draft.version.trim(),
        date: draft.date.trim(),
        title: draft.title.trim(),
        stage: draft.stage,
        category: draft.category.trim(),
        body: draft.body,
      };

      if (isEditing && editingId) {
        await updateDevlog({ devlogId: editingId, ...payload });
        toast({ title: "Devlog updated" });
      } else {
        await createDevlog(payload);
        toast({ title: "Devlog created" });
      }

      resetDraft();
    } catch (error) {
      toast({
        title: isEditing ? "Unable to update devlog" : "Unable to create devlog",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteDevlog({ devlogId: deleteTarget._id });
      toast({ title: "Devlog deleted" });
      if (editingId === deleteTarget._id) {
        resetDraft();
      }
      setDeleteTarget(null);
    } catch (error) {
      toast({
        title: "Unable to delete devlog",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-xl">{isEditing ? "Edit Devlog" : "New Devlog"}</CardTitle>
          <CardDescription>
            Authors the entries shown in the public Latest Updates tab at /updates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="devlog-title">Title</Label>
              <Input
                id="devlog-title"
                value={draft.title}
                onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="devlog-version">Version</Label>
              <Input
                id="devlog-version"
                value={draft.version}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, version: event.target.value }))
                }
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="devlog-date">Date</Label>
              <Input
                id="devlog-date"
                type="date"
                value={draft.date}
                onChange={(event) => setDraft((prev) => ({ ...prev, date: event.target.value }))}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="devlog-stage">Stage</Label>
              <Select
                value={draft.stage}
                disabled={isSaving}
                onValueChange={(value) =>
                  setDraft((prev) => ({ ...prev, stage: value as Stage }))
                }
              >
                <SelectTrigger id="devlog-stage" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_VALUES.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="devlog-category">Category</Label>
              <Input
                id="devlog-category"
                value={draft.category}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, category: event.target.value }))
                }
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="devlog-body">Body (Markdown)</Label>
            <Textarea
              id="devlog-body"
              rows={6}
              value={draft.body}
              onChange={(event) => setDraft((prev) => ({ ...prev, body: event.target.value }))}
              disabled={isSaving}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {isEditing ? "Save Changes" : "Create Devlog"}
            </Button>
            {isEditing ? (
              <Button variant="outline" onClick={resetDraft} disabled={isSaving}>
                Cancel
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-xl">Devlogs</CardTitle>
          <CardDescription>All entries, newest-first.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border" aria-busy={isLoading}>
            <table className="w-full min-w-200 text-sm" aria-label="Devlogs">
              <thead className="bg-muted/50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-medium">
                    Title
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">
                    Version
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">
                    Stage
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <tr key={`loading-row-${index}`} className="border-b last:border-b-0">
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-40" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-16" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-6 w-24 rounded-full" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-8 w-32" />
                      </td>
                    </tr>
                  ))
                ) : devlogs.length > 0 ? (
                  devlogs.map((devlog) => (
                    <tr key={devlog._id} className="border-b last:border-b-0">
                      <td className="px-4 py-3 font-medium">{devlog.title}</td>
                      <td className="px-4 py-3 font-mono">{devlog.version}</td>
                      <td className="px-4 py-3">{devlog.date}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={cn("border-transparent", STAGE_BADGE_COLORS[devlog.stage])}
                        >
                          {devlog.stage}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => startEditing(devlog)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(devlog)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      No devlogs yet — create one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete devlog?</DialogTitle>
            <DialogDescription>
              This permanently removes {deleteTarget?.title ?? "this devlog"} from the public
              Latest Updates tab. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

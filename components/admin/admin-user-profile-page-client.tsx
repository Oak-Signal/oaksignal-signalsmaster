"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useCallback, useEffect, useState } from "react";

import {
  AdminUserNoteCreateRequest,
  AdminUserNoteCreateResponse,
  AdminUserProfilePayload,
  AdminUserProfileResponse,
  AdminUserRole,
  AdminUserRoleUpdateRequest,
  AdminUserRoleUpdateResponse,
  AdminUserStatus,
  AdminUserStatusUpdateRequest,
  AdminUserStatusUpdateResponse,
  AdminUsersApiErrorResponse,
} from "@/lib/admin-user-management-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AdminUserProfilePageClientProps {
  userId: string;
}

function formatDate(value: number | undefined): string {
  if (!value) {
    return "N/A";
  }

  return format(value, "PP p");
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "N/A";
  }

  const totalMinutes = Math.floor(ms / 1000 / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

function statusBadgeClass(status: string): string {
  if (status === "active") {
    return "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
  }

  if (status === "suspended") {
    return "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200";
  }

  if (status === "banned") {
    return "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200";
  }

  return "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200";
}

export function AdminUserProfilePageClient({ userId }: AdminUserProfilePageClientProps) {
  const [profileState, setProfileState] = useState<AdminUserProfilePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [roleNextValue, setRoleNextValue] = useState<AdminUserRole>("cadet");
  const [roleReason, setRoleReason] = useState("");
  const [roleNotifyUser, setRoleNotifyUser] = useState(false);
  const [isRoleSubmitting, setIsRoleSubmitting] = useState(false);

  const [statusNextValue, setStatusNextValue] = useState<AdminUserStatus>("active");
  const [statusReason, setStatusReason] = useState("");
  const [statusDurationUntil, setStatusDurationUntil] = useState("");
  const [statusInternalNotes, setStatusInternalNotes] = useState("");
  const [statusNotifyUser, setStatusNotifyUser] = useState(false);
  const [isStatusSubmitting, setIsStatusSubmitting] = useState(false);

  const [newAdminNote, setNewAdminNote] = useState("");
  const [newAdminNotePinned, setNewAdminNotePinned] = useState(false);
  const [isNoteSubmitting, setIsNoteSubmitting] = useState(false);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      });

      const body = (await response.json()) as AdminUserProfileResponse | AdminUsersApiErrorResponse;

      if (!response.ok) {
        const message =
          body && "error" in body && body.error?.message
            ? body.error.message
            : "Unable to load user profile.";
        throw new Error(message);
      }

      if (!body || !("success" in body) || !body.success || !("data" in body)) {
        throw new Error("Unexpected user profile response.");
      }

      setProfileState(body.data);
      setRoleNextValue(body.data.profile.role === "admin" ? "cadet" : "admin");
      setStatusNextValue(body.data.profile.status);
      setErrorMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load user profile.";
      setErrorMessage(message);
      setProfileState(null);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const handleSubmitRoleChange = async () => {
    if (roleReason.trim().length === 0) {
      setActionMessage("Role change reason is required.");
      return;
    }

    const confirmed = window.confirm("Confirm role update for this user?");
    if (!confirmed) {
      return;
    }

    const payload: AdminUserRoleUpdateRequest = {
      nextRole: roleNextValue,
      reason: roleReason.trim(),
      notifyUser: roleNotifyUser,
    };

    setIsRoleSubmitting(true);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as AdminUserRoleUpdateResponse | AdminUsersApiErrorResponse;
      if (!response.ok || !("success" in body) || !body.success) {
        const message =
          body && "error" in body && body.error?.message
            ? body.error.message
            : "Failed to update role.";
        throw new Error(message);
      }

      setRoleReason("");
      setActionMessage("Role updated successfully.");
      await fetchProfile();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update role.";
      setActionMessage(message);
    } finally {
      setIsRoleSubmitting(false);
    }
  };

  const handleSubmitStatusChange = async () => {
    if (statusReason.trim().length === 0) {
      setActionMessage("Status change reason is required.");
      return;
    }

    const confirmed = window.confirm("Confirm account status update for this user?");
    if (!confirmed) {
      return;
    }

    const durationMs = statusDurationUntil ? new Date(statusDurationUntil).getTime() : undefined;

    const payload: AdminUserStatusUpdateRequest = {
      nextStatus: statusNextValue,
      reason: statusReason.trim(),
      durationUntil: statusNextValue === "suspended" ? durationMs : undefined,
      internalNotes: statusInternalNotes.trim() || undefined,
      notifyUser: statusNotifyUser,
    };

    setIsStatusSubmitting(true);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as AdminUserStatusUpdateResponse | AdminUsersApiErrorResponse;
      if (!response.ok || !("success" in body) || !body.success) {
        const message =
          body && "error" in body && body.error?.message
            ? body.error.message
            : "Failed to update status.";
        throw new Error(message);
      }

      setStatusReason("");
      setStatusInternalNotes("");
      setStatusDurationUntil("");
      setActionMessage("Status updated successfully.");
      await fetchProfile();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update status.";
      setActionMessage(message);
    } finally {
      setIsStatusSubmitting(false);
    }
  };

  const handleSubmitNote = async () => {
    if (newAdminNote.trim().length === 0) {
      setActionMessage("Admin note cannot be empty.");
      return;
    }

    const payload: AdminUserNoteCreateRequest = {
      note: newAdminNote.trim(),
      isPinned: newAdminNotePinned,
    };

    setIsNoteSubmitting(true);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}/notes`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as AdminUserNoteCreateResponse | AdminUsersApiErrorResponse;
      if (!response.ok || !("success" in body) || !body.success) {
        const message =
          body && "error" in body && body.error?.message
            ? body.error.message
            : "Failed to add admin note.";
        throw new Error(message);
      }

      setNewAdminNote("");
      setNewAdminNotePinned(false);
      setActionMessage("Admin note added.");
      await fetchProfile();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add admin note.";
      setActionMessage(message);
    } finally {
      setIsNoteSubmitting(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading user profile...</p>;
  }

  if (errorMessage) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{errorMessage}</p>
        <Button type="button" variant="outline" onClick={() => void fetchProfile()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!profileState) {
    return <p className="text-sm text-muted-foreground">User profile unavailable.</p>;
  }

  const { profile, activitySummary, progress, history, activityMonitoring } = profileState;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{profile.name ?? "Unnamed User"}</h2>
          <p className="text-muted-foreground">{profile.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={profile.role === "admin" ? "default" : "secondary"}>
            {profile.role === "admin" ? "Administrator" : "Cadet"}
          </Badge>
          <Badge className={statusBadgeClass(profile.status)}>{profile.status}</Badge>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/users">Back to Users</Link>
          </Button>
        </div>
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Account Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="space-y-2 rounded-md border p-3">
              <Label htmlFor="profile-next-role">Role Assignment</Label>
              <select
                id="profile-next-role"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={roleNextValue}
                onChange={(event) => setRoleNextValue(event.target.value as AdminUserRole)}
                disabled={isRoleSubmitting}
                aria-label="Select next role"
              >
                <option value="admin">Administrator</option>
                <option value="cadet">Cadet</option>
              </select>
              <Input
                value={roleReason}
                onChange={(event) => setRoleReason(event.target.value)}
                placeholder="Reason for role change"
                disabled={isRoleSubmitting}
                aria-label="Role change reason"
              />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={roleNotifyUser}
                  onCheckedChange={(checked) => setRoleNotifyUser(checked === true)}
                  disabled={isRoleSubmitting}
                  aria-label="Notify user for role change"
                />
                Notify user
              </label>
              <Button
                type="button"
                onClick={() => void handleSubmitRoleChange()}
                disabled={isRoleSubmitting}
                aria-label="Submit role change"
              >
                {isRoleSubmitting ? "Updating..." : "Update Role"}
              </Button>
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <Label htmlFor="profile-next-status">Status Management</Label>
              <select
                id="profile-next-status"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={statusNextValue}
                onChange={(event) => setStatusNextValue(event.target.value as AdminUserStatus)}
                disabled={isStatusSubmitting}
                aria-label="Select next status"
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
                <option value="pending_verification">Pending verification</option>
              </select>
              <Input
                value={statusReason}
                onChange={(event) => setStatusReason(event.target.value)}
                placeholder="Reason for status update"
                disabled={isStatusSubmitting}
                aria-label="Status change reason"
              />
              <Input
                type="datetime-local"
                value={statusDurationUntil}
                onChange={(event) => setStatusDurationUntil(event.target.value)}
                disabled={isStatusSubmitting || statusNextValue !== "suspended"}
                aria-label="Suspension duration end date"
              />
              <Input
                value={statusInternalNotes}
                onChange={(event) => setStatusInternalNotes(event.target.value)}
                placeholder="Internal notes"
                disabled={isStatusSubmitting}
                aria-label="Internal status notes"
              />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={statusNotifyUser}
                  onCheckedChange={(checked) => setStatusNotifyUser(checked === true)}
                  disabled={isStatusSubmitting}
                  aria-label="Notify user for status change"
                />
                Notify user
              </label>
              <Button
                type="button"
                onClick={() => void handleSubmitStatusChange()}
                disabled={isStatusSubmitting}
                aria-label="Submit status update"
              >
                {isStatusSubmitting ? "Updating..." : "Update Status"}
              </Button>
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <Label htmlFor="profile-new-note">Add Admin Note</Label>
              <Input
                id="profile-new-note"
                value={newAdminNote}
                onChange={(event) => setNewAdminNote(event.target.value)}
                placeholder="Private admin note"
                disabled={isNoteSubmitting}
                aria-label="New admin note"
              />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={newAdminNotePinned}
                  onCheckedChange={(checked) => setNewAdminNotePinned(checked === true)}
                  disabled={isNoteSubmitting}
                  aria-label="Pin note"
                />
                Pin note
              </label>
              <Button
                type="button"
                onClick={() => void handleSubmitNote()}
                disabled={isNoteSubmitting}
                aria-label="Submit admin note"
              >
                {isNoteSubmitting ? "Saving..." : "Add Note"}
              </Button>
            </div>
          </div>

          {actionMessage ? (
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
              {actionMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Registered: {formatDate(profile.createdAt)}</p>
            <p>Last Login: {formatDate(profile.lastLoginAt)}</p>
            <p>Last Active: {formatDate(profile.lastActiveAt)}</p>
            <p>Email Verified: {profile.emailVerifiedAt ? "Yes" : "No"}</p>
            <p>Contact Email: {profile.contactEmail ?? "N/A"}</p>
            <p>Phone: {profile.phone ?? "N/A"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Total Practice Sessions: {activitySummary.totalPracticeSessions}</p>
            <p>Practice Average Score: {activitySummary.practiceAverageScore.toFixed(2)}%</p>
            <p>Exam Attempts: {activitySummary.examAttemptsCount}</p>
            <p>Exam Passes: {activitySummary.examPassCount}</p>
            <p>Ranked Runs: {activitySummary.rankedRunsCount}</p>
            <p>Time Spent: {formatDuration(activitySummary.totalTimeSpentMs)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Learning Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Flags Mastered: {progress.flagsMasteredCount}</p>
            <p>Learning Streak: {progress.learningStreakDays} days</p>
            <p>Session Frequency: {progress.sessionFrequencyPerWeek}/week</p>
            <p>Weak Areas:</p>
            {progress.weakAreas.length > 0 ? (
              <ul className="list-disc pl-5 text-muted-foreground">
                {progress.weakAreas.map((weakArea) => (
                  <li key={weakArea.category}>
                    {weakArea.category}: {weakArea.incorrectRatePercent}% incorrect
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No weak areas identified yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Role Change History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {history.roleChanges.length > 0 ? (
              history.roleChanges.map((entry) => (
                <div key={entry._id} className="rounded-md border p-2">
                  <p>
                    {entry.previousRole} → {entry.newRole}
                  </p>
                  <p className="text-muted-foreground">{entry.reason}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No role changes recorded.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {history.statusChanges.length > 0 ? (
              history.statusChanges.map((entry) => (
                <div key={entry._id} className="rounded-md border p-2">
                  <p>
                    {entry.previousStatus} → {entry.newStatus}
                  </p>
                  <p className="text-muted-foreground">{entry.reason}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No status changes recorded.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Admin Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {history.adminNotes.length > 0 ? (
              history.adminNotes.map((entry) => (
                <div key={entry._id} className="rounded-md border p-2">
                  <p>{entry.note}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No notes added yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {activityMonitoring.activityTimeline.length > 0 ? (
              activityMonitoring.activityTimeline.map((entry) => (
                <div key={entry._id} className="rounded-md border p-2">
                  <p className="font-medium">{entry.eventType}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No timeline events available.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Login History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {activityMonitoring.loginHistory.length > 0 ? (
            activityMonitoring.loginHistory.map((entry) => (
              <div key={entry._id} className="rounded-md border p-2">
                <p className="font-medium">{entry.eventType}</p>
                <p className="text-muted-foreground">IP: {entry.ipAddress ?? "N/A"}</p>
                <p className="text-muted-foreground">Device: {entry.device ?? "N/A"}</p>
                <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">No login history available.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

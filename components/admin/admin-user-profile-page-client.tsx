"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useCallback, useEffect, useState } from "react";

import {
  AdminUserProfilePayload,
  AdminUserProfileResponse,
  AdminUsersApiErrorResponse,
} from "@/lib/admin-user-management-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

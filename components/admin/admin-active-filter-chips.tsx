"use client";

import { X } from "lucide-react";

import { AdminExamActiveFilterChip } from "@/lib/admin-exams-filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AdminActiveFilterChipsProps {
  chips: AdminExamActiveFilterChip[];
  onClearChip: (chipKey: AdminExamActiveFilterChip["key"]) => void;
}

export function AdminActiveFilterChips({
  chips,
  onClearChip,
}: AdminActiveFilterChipsProps) {
  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((chip) => (
        <Badge key={chip.key} variant="secondary" className="gap-1 pl-2 pr-1">
          <span>{chip.label}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5 rounded-full p-0"
            onClick={() => onClearChip(chip.key)}
            aria-label={`Clear ${chip.label}`}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </Badge>
      ))}
    </div>
  );
}

"use client";

import { type LucideIcon, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComparisonCardProps {
  icon: LucideIcon;
  heading: string;
  items: { text: string; icon?: LucideIcon }[];
  variant: "old" | "new";
}

export function ComparisonCard({ 
  icon: Icon, 
  heading, 
  items, 
  variant
}: ComparisonCardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl p-8 border transition-all duration-300 h-full",
        variant === "old"
          ? "bg-gray-50/50 border-gray-200/60 dark:bg-card/30 dark:border-border/30"
          : "bg-muted border-border shadow-sm"
      )}
    >
      <div className="flex flex-col items-center text-center space-y-8 h-full">
        {/* Header Section */}
        <div className="flex flex-col items-center space-y-4">
          <div className={cn(
            "flex h-16 w-16 items-center justify-center rounded-2xl",
            variant === "old" ? "bg-gray-200/60 dark:bg-muted" : "bg-primary/10"
          )}>
            <Icon
              className={cn(
                "h-8 w-8",
                variant === "old" ? "text-gray-400 dark:text-muted-foreground" : "text-primary"
              )}
            />
          </div>

          <h3 className={cn(
            "text-2xl font-bold",
            variant === "old" ? "text-gray-600 dark:text-gray-200" : "text-foreground"
          )}>
            {heading}
          </h3>
        </div>
        
        {/* Items List */}
        <div className="w-full space-y-3 grow flex flex-col justify-center">
          {items.map((item, index) => {
            const ItemIcon = item.icon || (variant === "old" ? X : Check);
            
            if (variant === "new") {
              return (
                <div 
                  key={index}
                  className="group flex items-center gap-4 p-4 rounded-xl bg-background border border-border/50 shadow-sm transition-all hover:shadow-md hover:border-primary/20"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <ItemIcon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-left font-medium text-foreground">
                    {item.text}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={index}
                className="flex items-center gap-3 p-2 text-muted-foreground opacity-80 dark:opacity-100"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200/50 dark:bg-muted">
                  <ItemIcon className="h-3.5 w-3.5 text-gray-500 dark:text-muted-foreground" />
                </div>
                <span className="text-left font-medium text-gray-700 dark:text-gray-300">
                  {item.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

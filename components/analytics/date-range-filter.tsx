import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRange, DATE_RANGE_LABELS } from "@/lib/results-types";

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
  className?: string;
}

export function DateRangeFilter({ value, onChange, className }: DateRangeFilterProps) {
  return (
    <Tabs 
      value={value} 
      onValueChange={(val) => onChange(val as DateRange)}
      className={className}
    >
      <TabsList className="grid w-full grid-cols-3 md:w-auto">
        {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map((range) => (
          <TabsTrigger key={range} value={range}>
            {DATE_RANGE_LABELS[range]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

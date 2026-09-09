import { cn } from "@/lib/utils";

interface TallyProps {
  active: boolean;
  label?: string;
  className?: string;
}

export function Tally({ active, label = "ON AIR", className }: TallyProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div 
        className={cn(
          "w-12 h-12 rounded-full border-2 border-house",
          active ? "tally-light" : "tally-off"
        )} 
      />
      <div className={cn(
        "font-system text-sm tracking-[0.15em] transition-colors duration-1000",
        active ? "text-tally" : "text-sepia"
      )}>
        {label}
      </div>
    </div>
  );
}

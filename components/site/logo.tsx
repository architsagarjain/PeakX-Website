import { cn } from "@/lib/utils";

/** PeakX wordmark. Swap /public/brand/peakx-logo.svg for the designer's master file if you have one. */
export default function Logo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/peakx-logo.svg" alt="PeakX" width={744} height={214} className={cn("h-8 w-auto", className)} />
  );
}

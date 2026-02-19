import { useMemo } from "react";
import { Clock3, Plane, Radio } from "lucide-react";
import type { AircraftState } from "../hooks/useAircraftUpdates";
import type { WebSocketStatus } from "../hooks/useWebSocket";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { cn } from "@/lib/utils";

interface AircraftSidebarProps {
  aircraft: AircraftState[];
  selectedIcao24: string | null;
  onSelectAircraft: (icao24: string) => void;
  status: WebSocketStatus;
  isSubscribed: boolean;
  lastUpdate: number | null;
}

const STATUS_DOT_STYLE: Record<WebSocketStatus, string> = {
  connecting: "bg-amber-400",
  connected: "bg-emerald-400",
  disconnected: "bg-rose-400",
};

export function AircraftSidebar({
  aircraft,
  selectedIcao24,
  onSelectAircraft,
  status,
  isSubscribed,
  lastUpdate,
}: AircraftSidebarProps) {
  const sortedAircraft = useMemo(
    () => [...aircraft].sort((a, b) => a.icao24.localeCompare(b.icao24)),
    [aircraft]
  );

  const lastUpdateLabel = useMemo(() => {
    if (lastUpdate === null) return "Waiting for updates";

    return new Date(lastUpdate).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [lastUpdate]);

  return (
    <div className="pointer-events-none absolute top-4 left-4 z-20 w-[min(22rem,calc(100vw-2rem))]">
      <Card className="pointer-events-auto gap-0 overflow-hidden border-white/30 bg-background/85 py-0 shadow-xl backdrop-blur-md">
        <CardHeader className="gap-3 border-b bg-linear-to-r from-slate-950/95 via-slate-900/90 to-slate-950/95 text-slate-50">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-sm tracking-wide uppercase">
              <Plane className="size-4" />
              Aircraft
            </CardTitle>
            <span className="rounded-full border border-slate-500/60 bg-slate-800/70 px-2 py-0.5 text-xs font-medium text-slate-100">
              {sortedAircraft.length}
            </span>
          </div>
          <CardDescription className="space-y-1 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <Radio className="size-3.5" />
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    STATUS_DOT_STYLE[status]
                  )}
                />
                {status}
                {isSubscribed ? " / subscribed" : " / unsubscribed"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock3 className="size-3.5" />
              <span>{lastUpdateLabel}</span>
            </div>
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <div className="max-h-[calc(100vh-11rem)] space-y-1 overflow-y-auto p-2">
            {sortedAircraft.length === 0 ? (
              <div className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                No aircraft entities available.
              </div>
            ) : (
              sortedAircraft.map((aircraftItem) => {
                const isSelected = selectedIcao24 === aircraftItem.icao24;

                return (
                  <Button
                    key={aircraftItem.icao24}
                    variant="ghost"
                    className={cn(
                      "h-auto w-full items-start justify-start rounded-lg border border-transparent px-3 py-2 text-left",
                      "hover:border-sky-300/60 hover:bg-sky-50/80",
                      isSelected &&
                        "border-sky-300 bg-sky-100/80 text-sky-950 hover:bg-sky-100/90"
                    )}
                    onClick={() => onSelectAircraft(aircraftItem.icao24)}
                  >
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="font-mono text-xs tracking-wide uppercase">
                        {aircraftItem.icao24}
                      </span>
                      <span className="rounded-md border bg-background/80 px-2 py-0.5 font-mono text-[11px]">
                        {aircraftItem.iconType}
                      </span>
                    </div>
                  </Button>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

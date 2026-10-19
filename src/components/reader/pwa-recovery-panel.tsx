import { useEffect, useState } from "react"
import {
  ArchiveIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { usePwaLifecycle } from "@/hooks/use-pwa-lifecycle"

type PwaRecoveryPanelProps = {
  canRefreshCore: boolean
  isRefreshingCore: boolean
  onRefreshCore: () => void | Promise<void>
  onExportNotes?: () => void
  onExportBookmarks?: () => void
}

const PHASE_LABELS = {
  unsupported: "Unsupported",
  disabled: "Disabled in development",
  idle: "Starting",
  registering: "Registering",
  installing: "Preparing update",
  ready: "Ready",
  "update-ready": "Update ready",
  activating: "Activating update",
  error: "Needs attention",
} as const

function formatUpdateCheck(timestamp: number | null) {
  if (timestamp === null) {
    return "Not checked this session"
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp)
}

export function PwaRecoveryPanel({
  canRefreshCore,
  isRefreshingCore,
  onRefreshCore,
  onExportNotes,
  onExportBookmarks,
}: PwaRecoveryPanelProps) {
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const {
    status,
    activateUpdate,
    checkForUpdate,
    refreshStatus,
    resetApplication,
  } = usePwaLifecycle()

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  const pwaAvailable = status.phase !== "unsupported" && status.phase !== "disabled"
  const activeCacheLabel = status.activeCacheName ?? "Not active"

  return (
    <>
      <Card className="border-border/70 bg-card/70 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <ShieldCheckIcon className="size-4 text-muted-foreground" />
            App Updates and Recovery
          </CardTitle>
          <CardDescription>
            Check the offline shell, install waiting updates deliberately, and repair only this app&apos;s cache when needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-background/50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Connection
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant={status.isOnline ? "default" : "outline"}>
                  {status.isOnline ? "Online" : "Offline"}
                </Badge>
                <Badge variant={status.isControlled ? "secondary" : "outline"}>
                  {status.isControlled ? "Offline service active" : "Not controlled"}
                </Badge>
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Worker State
              </p>
              <p className="mt-2 font-medium text-foreground">
                {PHASE_LABELS[status.phase]}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Last check: {formatUpdateCheck(status.lastUpdateCheck)}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Cache Version
              </p>
              <p className="mt-2 break-all font-medium text-foreground">
                {activeCacheLabel}
              </p>
              <p className="mt-1 break-all text-xs text-muted-foreground">
                Configured: {status.configuredCacheName ?? "Unavailable"}
              </p>
              {status.waitingCacheName ? (
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  Waiting: {status.waitingCacheName}
                </p>
              ) : null}
            </div>
          </div>

          {status.updateAvailable ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
              <div className="min-w-48 flex-1">
                <p className="font-medium text-foreground">A new version is ready.</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  Updating reloads open KJV Only tabs after the complete shell has been cached.
                </p>
              </div>
              <Button
                type="button"
                disabled={status.phase === "activating"}
                onClick={activateUpdate}
              >
                <RefreshCwIcon data-icon="inline-start" />
                {status.phase === "activating" ? "Updating…" : "Update and Reload"}
              </Button>
            </div>
          ) : null}

          {status.error ? (
            <p role="status" className="text-sm text-destructive">
              {status.error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={!pwaAvailable || !status.isOnline || status.isCheckingForUpdate}
              onClick={() => {
                void checkForUpdate()
              }}
            >
              <RefreshCwIcon data-icon="inline-start" />
              {status.isCheckingForUpdate ? "Checking…" : "Check for Updates"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!canRefreshCore || isRefreshingCore || !status.isOnline}
              onClick={() => {
                void onRefreshCore()
              }}
            >
              <ArchiveIcon data-icon="inline-start" />
              {isRefreshingCore ? "Refreshing Core…" : "Refresh Core Files"}
            </Button>
          </div>

          <div className="flex flex-col gap-3 border-t border-border/70 pt-4">
            <div>
              <p className="font-medium text-foreground">Export before recovery</p>
              <p className="text-xs leading-5 text-muted-foreground">
                Cache repair does not target notes or bookmarks, but keeping a current export protects your local work before troubleshooting browser storage.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={!onExportNotes}
                onClick={onExportNotes}
              >
                Export Notes
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!onExportBookmarks}
                onClick={onExportBookmarks}
              >
                Export Bookmarks
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!pwaAvailable || !status.isOnline || status.isResetting}
                onClick={() => setResetDialogOpen(true)}
              >
                <Trash2Icon data-icon="inline-start" />
                Repair App Cache
              </Button>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              {status.appCacheNames.length > 0
                ? `${status.appCacheNames.length} app-owned cache${status.appCacheNames.length === 1 ? " is" : "s are"} currently present.`
                : "No app-owned cache is currently visible."}
              {" "}Repair is available only while online and never removes caches or service workers owned by other applications.
            </p>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Repair the app cache?</AlertDialogTitle>
            <AlertDialogDescription className="flex flex-col gap-2">
              <span>
                This unregisters only the KJV Only service worker, removes only caches beginning with the KJV Only cache prefix, and reloads the app online.
              </span>
              <span>
                Notes and bookmarks are not targeted. Export them first if you have not already made a current backup.
              </span>
              <span>
                Downloaded Bible data, maps, and audio in the downloads cache are preserved.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={status.isResetting || !status.isOnline}
              onClick={() => {
                setResetDialogOpen(false)
                void resetApplication()
              }}
            >
              {status.isResetting ? "Repairing…" : "Repair and Reload"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

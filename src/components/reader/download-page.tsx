import { bundleFreshness, describeOfflineBundle, loadOfflineInventory, readSavedOfflineInventory, readBundleReceipt, saveBundleReceipt, type OfflineInventory, type BundleReceipt } from '@/lib/offline-inventory';
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AudioLinesIcon,
  DownloadIcon,
  HardDriveDownloadIcon,
  MapIcon,
  RotateCwIcon,
  Trash2Icon,
} from "lucide-react";

import type { Book } from "@/types/bible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Progress,
  ProgressLabel,
} from "@/components/ui/progress";
import { PwaRecoveryPanel } from "@/components/reader/pwa-recovery-panel";
import {
  GENEALOGY_ASSET_VERSION,
  STRONGS_ASSET_VERSION,
  loadAncientMap,
} from "@/lib/reader-data";
import {
  buildAudioUrls,
  deleteOfflineAssetBatch,
  downloadOfflineAssetBatch,
  formatOfflineBytes,
  getCachedOfflineAssetKeys,
  loadCoreOfflineUrls,
} from "@/lib/offline-downloads";

type DownloadPageProps = {
  books: Book[];
  canInstallPwa?: boolean;
  isPwaInstalled?: boolean;
  onInstallPwa?: () => void | Promise<void>;
  onExportNotes?: () => void;
  onExportBookmarks?: () => void;
};

type BundleId = "core" | "maps" | "audio-ot" | "audio-nt";

type BundleDefinition = {
  id: BundleId;
  title: string;
  description: string;
  icon: typeof HardDriveDownloadIcon;
  urls: string[];
  preparationError?: string | null;
};

type BundleStatus = {
  total: number;
  cached: number;
  completed: number;
  downloading: boolean;
  error: string | null;
};


function bundleCachedPercent(status: BundleStatus) {
  return status.total > 0 ? Math.round((status.cached / status.total) * 100) : 0;
}

function bundleDownloadPercent(status: BundleStatus) {
  return status.total > 0 ? Math.round((status.completed / status.total) * 100) : 0;
}

function bundleStatusLabel(status: BundleStatus) {
  if (status.downloading) {
    return "Downloading";
  }
  if (status.cached === 0) {
    return "Not downloaded";
  }
  if (status.cached >= status.total && status.total > 0) {
    return "Fully cached";
  }
  return "Partially cached";
}

export function DownloadPage({
  books,
  canInstallPwa = false,
  isPwaInstalled = false,
  onInstallPwa,
  onExportNotes,
  onExportBookmarks,
}: DownloadPageProps) {
  const [inventory, setInventory] = useState<OfflineInventory | null>(null);
  const [inventoryChecked, setInventoryChecked] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [bundleDetails, setBundleDetails] = useState<Record<string, { bytes: number; version: string } | null>>({});
  const [receipts, setReceipts] = useState<Record<string, BundleReceipt | null>>(() => Object.fromEntries(['core', 'maps', 'audio-ot', 'audio-nt'].map((id) => [id, readBundleReceipt(id)])));
  const [cacheError, setCacheError] = useState<string | null>(null);
  const [mapPreparationError, setMapPreparationError] = useState<string | null>(null);
  const reloadInventory = useCallback(async () => {
    setInventoryLoading(true);
    try {
      const nextInventory = await loadOfflineInventory();
      const nextCoreUrls = await loadCoreOfflineUrls();
      setInventory(nextInventory);
      setCoreUrls(nextCoreUrls);
      setCorePreparationError(null);
      setInventoryChecked(true);
      setInventoryError(null);
    } catch {
      const savedInventory = await readSavedOfflineInventory();
      if (savedInventory) setInventory(savedInventory);
      setInventoryChecked(false);
      setInventoryError('Could not check the latest bundle information. Connect to the internet and try again.');
    } finally { setInventoryLoading(false); }
  }, []);
  useEffect(() => { void reloadInventory(); }, [reloadInventory]);
  const [coreUrls, setCoreUrls] = useState<string[] | null>(null);
  const [corePreparationError, setCorePreparationError] = useState<string | null>(
    null,
  );
  const [mapUrls, setMapUrls] = useState<string[] | null>(null);
  const [storageEstimate, setStorageEstimate] = useState<{
    usage: number;
    quota: number;
  } | null>(null);
  const [bundleStatuses, setBundleStatuses] = useState<Record<BundleId, BundleStatus>>({
    core: { total: 0, cached: 0, completed: 0, downloading: false, error: null },
    maps: { total: 0, cached: 0, completed: 0, downloading: false, error: null },
    "audio-ot": { total: 0, cached: 0, completed: 0, downloading: false, error: null },
    "audio-nt": { total: 0, cached: 0, completed: 0, downloading: false, error: null },
  });
  const [activeBundleId, setActiveBundleId] = useState<BundleId | null>(null);
  const [clearingBundleId, setClearingBundleId] = useState<BundleId | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadCoreOfflineUrls()
      .then((urls) => {
        if (cancelled) {
          return;
        }
        setCoreUrls(urls);
        setCorePreparationError(null);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setCoreUrls([]);
        setCorePreparationError("Could not prepare the production app shell.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadAncientMap().then((entries) => {
      if (cancelled) {
        return;
      }
      const geometryUrls = Array.from(
        new Set(entries.map((entry) => `/maps/geometry/${entry.geojson_file}`)),
      );
      setMapUrls(["/maps/data/map.json", ...geometryUrls]);
    }).catch(() => { if (!cancelled) { setMapUrls([]); setMapPreparationError("Could not prepare the map download. Reload this page to try again."); } });

    return () => {
      cancelled = true;
    };
  }, []);

  const bundleDefinitions = useMemo<BundleDefinition[]>(() => {
    const definitions: BundleDefinition[] = [
      {
        id: "core",
        title: "Core Bible Data",
        description:
          "Bible text, summaries, concordance, cross references, dictionaries, genealogy, and the app shell needed for offline study.",
        icon: HardDriveDownloadIcon,
        urls: coreUrls
          ? [
              ...coreUrls,
              `/references/genealogy.compact.min.json?v=${GENEALOGY_ASSET_VERSION}`,
              `/references/strongs-greek.compact.min.json?v=${STRONGS_ASSET_VERSION}`,
              `/references/strongs-hebrew.compact.min.json?v=${STRONGS_ASSET_VERSION}`,
            ]
          : [],
        preparationError: corePreparationError,
      },
      {
        id: "maps",
        title: "Maps",
        description:
          "Map index plus referenced GeoJSON geometry for offline place and geography lookup.",
        icon: MapIcon,
        urls: inventory?.mapUrls ?? mapUrls ?? [],
        preparationError: inventory?.mapUrls ? null : mapPreparationError,
      },
      {
        id: "audio-ot",
        title: "Old Testament Audio",
        description: "All Old Testament chapter audio files for offline playback.",
        icon: AudioLinesIcon,
        urls: buildAudioUrls(books, "old"),
      },
      {
        id: "audio-nt",
        title: "New Testament Audio",
        description: "All New Testament chapter audio files for offline playback.",
        icon: AudioLinesIcon,
        urls: buildAudioUrls(books, "new"),
      },
    ];

    return definitions;
  }, [books, corePreparationError, coreUrls, mapUrls, mapPreparationError, inventory]);

  useEffect(() => {
    let cancelled = false;
    if (!inventory) return;
    void Promise.all(bundleDefinitions.map(async (bundle) => [bundle.id, await describeOfflineBundle(bundle.urls, inventory)] as const))
      .then((entries) => { if (!cancelled) setBundleDetails(Object.fromEntries(entries)); })
      .catch(() => { if (!cancelled) setInventoryError('Could not read bundle sizes and versions.'); });
    return () => { cancelled = true; };
  }, [bundleDefinitions, inventory]);

  const totalCachedFiles = useMemo(
    () =>
      Object.values(bundleStatuses).reduce((count, status) => count + status.cached, 0),
    [bundleStatuses],
  );

  const totalBundleFiles = useMemo(
    () =>
      Object.values(bundleStatuses).reduce((count, status) => count + status.total, 0),
    [bundleStatuses],
  );

  const refreshStorageEstimate = useCallback(async () => {
    if (!("storage" in navigator) || typeof navigator.storage.estimate !== "function") {
      setStorageEstimate(null);
      return;
    }

    const estimate = await navigator.storage.estimate().catch(() => null);
    if (!estimate) { setStorageEstimate(null); return; }
    setStorageEstimate({
      usage: estimate.usage ?? 0,
      quota: estimate.quota ?? 0,
    });
  }, []);

  const refreshBundleStatuses = useCallback(async () => {
    const cachedKeys = await getCachedOfflineAssetKeys().catch(() => null);
    if (!cachedKeys) { setCacheError("Offline storage is unavailable. Check your browser storage settings and try again."); return; }
    setCacheError(null);
    setBundleStatuses((current) => {
      const next = { ...current };
      for (const bundle of bundleDefinitions) {
        const cached = bundle.urls.reduce((count, url) => {
          const normalized = new URL(url, window.location.origin);
          return count + Number(cachedKeys.has(`${normalized.pathname}${normalized.search}`));
        }, 0);
        next[bundle.id] = {
          ...next[bundle.id],
          total: bundle.urls.length,
          cached,
          completed: next[bundle.id].downloading ? next[bundle.id].completed : cached,
        };
      }
      return next;
    });
  }, [bundleDefinitions]);

  useEffect(() => {
    void refreshBundleStatuses();
    void refreshStorageEstimate();
  }, [refreshBundleStatuses, refreshStorageEstimate]);

  const runBundleDownload = useCallback(
    async (bundle: BundleDefinition, forceRefresh = false) => {
      if (bundle.urls.length === 0 || activeBundleId !== null || clearingBundleId !== null) {
        return;
      }

      setActiveBundleId(bundle.id);
      setBundleStatuses((current) => ({
        ...current,
        [bundle.id]: {
          ...current[bundle.id],
          total: bundle.urls.length,
          completed: 0,
          downloading: true,
          error: null,
        },
      }));

      try {
        const { failures, verified } = await downloadOfflineAssetBatch(
          bundle.urls,
          { forceRefresh, inventory },
          (completed, total) => {
            setBundleStatuses((current) => ({
              ...current,
              [bundle.id]: {
                ...current[bundle.id],
                total,
                completed,
                downloading: true,
                error: null,
              },
            }));
          },
        );

        setBundleStatuses((current) => ({
          ...current,
          [bundle.id]: {
            ...current[bundle.id],
            downloading: false,
            error:
              failures.length > 0
                ? `${failures.length} file${failures.length === 1 ? "" : "s"} failed to download or verify. Check your connection and storage; check for bundle updates before retrying.`
                : null,
          },
        }));
        const detail = inventory ? await describeOfflineBundle(bundle.urls, inventory) : null;
        if (!failures.length && detail && verified === bundle.urls.length && inventoryChecked) {
          const receipt = { version: detail.version, refreshedAt: Date.now() };
          saveBundleReceipt(bundle.id, receipt);
          setReceipts((current) => ({ ...current, [bundle.id]: receipt }));
        }
      } catch {
        setBundleStatuses((current) => ({ ...current, [bundle.id]: { ...current[bundle.id], downloading: false, error: 'Download failed. Check your connection and available browser storage, then try again.' } }));
      } finally {
        setActiveBundleId(null);
        await refreshBundleStatuses();
        await refreshStorageEstimate();
      }
    },
    [activeBundleId, clearingBundleId, refreshBundleStatuses, refreshStorageEstimate, inventory, inventoryChecked],
  );

  const clearBundleCache = useCallback(async (bundle: BundleDefinition) => {
    if (activeBundleId !== null || clearingBundleId !== null) {
      return;
    }

    setClearingBundleId(bundle.id);
    try {
      await deleteOfflineAssetBatch(bundle.urls);
      saveBundleReceipt(bundle.id, null);
      setReceipts((current) => ({ ...current, [bundle.id]: null }));
      setBundleStatuses((current) => ({
        ...current,
        [bundle.id]: {
          ...current[bundle.id],
          cached: 0,
          completed: 0,
          downloading: false,
          error: null,
        },
      }));
      await refreshBundleStatuses();
      await refreshStorageEstimate();
    } catch {
      setBundleStatuses((current) => ({ ...current, [bundle.id]: { ...current[bundle.id], error: "Could not clear this bundle. Try again." } }));
    } finally {
      setClearingBundleId(null);
    }
  }, [activeBundleId, clearingBundleId, refreshBundleStatuses, refreshStorageEstimate]);

  const coreBundle = bundleDefinitions.find((bundle) => bundle.id === "core") ?? null;
  const refreshCoreBundle = useCallback(async () => {
    if (!coreBundle) {
      return;
    }
    await runBundleDownload(coreBundle, true);
  }, [coreBundle, runBundleDownload]);

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-border/70 bg-card/70 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <DownloadIcon className="size-4 text-muted-foreground" />
            Install the app on this device
          </CardTitle>
          <CardDescription>
            Installing adds the app shell to this device. Bible data, maps, and audio are managed separately below.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={!canInstallPwa || isPwaInstalled}
              onClick={() => {
                void onInstallPwa?.();
              }}
            >
              Install App
            </Button>
            <Badge variant="outline" className="font-normal">
              {isPwaInstalled
                ? "Installed"
                : canInstallPwa
                  ? "Ready to install"
                  : "Prompt unavailable"}
            </Badge>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
              {isPwaInstalled
                ? "Already installed on this device."
                : canInstallPwa
                  ? "Install is available in this browser."
                  : "This browser has not exposed an install prompt for this session. On Android or Brave, use the browser menu and choose Install app or Add to Home screen."}
          </p>
        </CardContent>
      </Card>

      <PwaRecoveryPanel
        canRefreshCore={
          coreBundle !== null &&
          coreBundle.urls.length > 0 &&
          !coreBundle.preparationError &&
          activeBundleId === null &&
          clearingBundleId === null
        }
        isRefreshingCore={activeBundleId === "core"}
        onRefreshCore={refreshCoreBundle}
        onExportNotes={onExportNotes}
        onExportBookmarks={onExportBookmarks}
      />

      <Card className="border-border/70 bg-card/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Offline Library</CardTitle>
          <CardDescription>
            Download only the bundles you want available without a network connection.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-background/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Browser Storage
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {storageEstimate
                ? `Using ${formatOfflineBytes(storageEstimate.usage)} of ${formatOfflineBytes(storageEstimate.quota)} available browser storage.`
                : "Browser storage usage is not available in this environment."}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Cached Files
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {totalCachedFiles}
            </p>
            <p className="text-sm text-muted-foreground">
              of {totalBundleFiles} known files currently cached
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Bundle Actions
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Use download for first-time caching, check for missing files to fill gaps, refresh to replace cached files, and clear to free space.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" disabled={inventoryLoading || activeBundleId !== null || clearingBundleId !== null} onClick={() => { void reloadInventory(); void refreshBundleStatuses(); }}> {inventoryLoading ? 'Checking bundle information…' : 'Check for Bundle Updates'} </Button>
        <p className="text-xs text-muted-foreground">Sizes reflect uncompressed bundle files. Browser storage use and network transfer sizes can differ.</p>
        {inventoryError && <p role="status" className="text-sm text-muted-foreground">{inventoryError}</p>}
        {cacheError && <p role="alert" className="text-sm text-destructive">{cacheError}</p>}
      </div>
      <div className="grid gap-4">
        {bundleDefinitions.map((bundle) => {
          const status = bundleStatuses[bundle.id];
          const percent = bundleCachedPercent(status);
          const downloadPercent = bundleDownloadPercent(status);
          const Icon = bundle.icon;
          const isReady = bundle.urls.length > 0 && !bundle.preparationError;
          const statusLabel = bundleStatusLabel(status);
          const detail = bundleDetails[bundle.id];
          const receipt = receipts[bundle.id];
          const isFullyCached = status.cached === status.total && status.total > 0;

          return (
            <Card key={bundle.id} className="border-border/70 bg-card/70 shadow-sm">
              <CardHeader className="gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-2">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Icon className="size-4 text-muted-foreground" />
                      {bundle.title}
                    </CardTitle>
                    <CardDescription>{bundle.description}</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={isFullyCached ? "default" : "outline"}>
                      {statusLabel}
                    </Badge>
                    <Badge variant="outline" className="font-normal">
                      {detail ? formatOfflineBytes(detail.bytes) : "Size unavailable"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                  <div className="rounded-lg border border-border/60 bg-background/50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Cached
                    </p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {status.cached}/{status.total}
                    </p>
                    <p className="text-xs">files available offline</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Current State
                    </p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {status.downloading ? `${downloadPercent}%` : `${percent}%`}
                    </p>
                    <p className="text-xs">
                      {status.downloading ? "download progress" : "cache coverage"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Bundle Version
                    </p>
                    <p className="mt-1 text-sm leading-6">
                      {bundleFreshness(detail?.version, receipt, isFullyCached, inventoryChecked)}
                      <span className="block text-xs">Last verified download: {receipt ? new Date(receipt.refreshedAt).toLocaleString() : 'Not recorded'}</span>
                      <span className="block text-xs">Refresh Bundle verifies and replaces every file. Checking missing files only fills gaps.</span>
                    </p>
                  </div>
                </div>
                <Progress value={status.downloading ? downloadPercent : percent}>
                  <ProgressLabel>
                    {status.downloading ? "Downloading" : "Cached"}
                  </ProgressLabel>
                  <span className="ml-auto text-sm text-muted-foreground tabular-nums">
                    {status.downloading ? `${downloadPercent}%` : `${percent}%`}
                  </span>
                </Progress>
                {status.error || bundle.preparationError ? (
                  <p className="text-xs text-destructive">
                    {status.error ?? bundle.preparationError}
                  </p>
                ) : null}
                {!isReady && !bundle.preparationError ? (
                  <p className="text-xs text-muted-foreground">Preparing asset list…</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant={isFullyCached ? "outline" : "default"}
                    disabled={!isReady || activeBundleId !== null || clearingBundleId !== null}
                    onClick={() => {
                      void runBundleDownload(bundle, false);
                    }}
                  >
                    {isFullyCached
                      ? "Check for Missing Files"
                      : `Download ${bundle.title}`}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!isReady || activeBundleId !== null || clearingBundleId !== null}
                    onClick={() => {
                      void runBundleDownload(bundle, true);
                    }}
                  >
                    <RotateCwIcon />
                    Refresh Bundle
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!isReady || activeBundleId !== null || clearingBundleId !== null}
                    onClick={() => {
                      void clearBundleCache(bundle);
                    }}
                  >
                    <Trash2Icon />
                    {clearingBundleId === bundle.id ? "Clearing..." : "Clear Bundle"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

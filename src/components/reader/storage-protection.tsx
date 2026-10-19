import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  checkStorageProtection, requestStorageProtection, type StorageProtection,
} from "@/lib/storage-persistence"

const messages: Record<StorageProtection | "checking", string> = {
  checking: "Checking offline storage protection…",
  protected: "Protected from automatic browser storage cleanup. Clearing site data yourself still removes saved data.",
  unprotected: "The browser may clear offline data when storage is low. Request protection to help keep it available.",
  unsupported: "This browser does not offer storage protection here. Offline downloads can still be used.",
  declined: "The browser did not grant protection. Downloads still work, but may be cleared when storage is low. You can try again later.",
  error: "Could not check or request storage protection. Your downloads have not been changed. Try again.",
}

export function StorageProtectionControl() {
  const [status, setStatus] = useState<StorageProtection | "checking">("checking")
  const [pending, setPending] = useState(false)
  useEffect(() => {
    let cancelled = false
    void checkStorageProtection().then(next => { if (!cancelled) setStatus(next) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="mt-3 flex flex-col items-start gap-2">
      <p role="status" className="text-xs text-muted-foreground">{messages[status]}</p>
      {status !== "protected" && status !== "unsupported" && status !== "checking" && (
        <Button type="button" variant="outline" size="sm" disabled={pending}
          onClick={async () => {
            setPending(true)
            try { setStatus(await requestStorageProtection()) }
            finally { setPending(false) }
          }}>
          {pending ? "Requesting Protection…" : "Protect Offline Data"}
        </Button>
      )}
    </div>
  )
}

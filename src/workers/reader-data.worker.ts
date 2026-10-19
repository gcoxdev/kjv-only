/// <reference lib="webworker" />

import { parseBooks } from "@/lib/bible-payload"
import { isCompactBiblePayload } from "@/lib/compact-bible"

self.addEventListener(
  "message",
  async (event: MessageEvent<{ url: string }>) => {
    try {
      const response = await fetch(event.data.url, { cache: "no-cache" })
      if (!response.ok) {
        throw new Error(`Could not load ${event.data.url}`)
      }
      const payload: unknown = await response.json()
      // Transfer the dictionary and IDs, not an expanded token object tree.
      // Validation and immutable sharing happen once, in the receiving thread.
      if (isCompactBiblePayload(payload)) {
        self.postMessage({ payload })
        return
      }
      const books = parseBooks(payload)
      if (!books || books.length === 0) {
        throw new Error(`Invalid reader data format in ${event.data.url}`)
      }
      self.postMessage({ books })
    } catch (error) {
      self.postMessage({
        error: error instanceof Error ? error.message : "Bible data worker failed",
      })
    }
  },
)

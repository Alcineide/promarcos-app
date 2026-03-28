import { useEffect } from "react";

import { useScanQueue } from "@/contexts/ScanQueue";
import { setSyncRefs } from "@/lib/upload-sync";

export function SyncWatcher() {
  const { queue, updateDocStatus } = useScanQueue();

  useEffect(() => {
    setSyncRefs(queue, updateDocStatus);
  }, [queue, updateDocStatus]);

  return null;
}

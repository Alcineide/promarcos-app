import { useEffect } from "react";
import { WifiOff, CloudOff, RefreshCw } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useSyncQueue } from "@/lib/sync-context";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { pendingCount, isSyncing } = useSyncQueue();
  const { toast } = useToast();

  useEffect(() => {
    const handler = (e: Event) => {
      const { succeeded, failed } = (e as CustomEvent).detail as {
        succeeded: number;
        failed: number;
      };
      if (succeeded > 0 && failed === 0) {
        toast({
          title: "Sincronização concluída",
          description: `${succeeded} cadastro(s) enviado(s) com sucesso.`,
        });
      } else if (succeeded > 0 && failed > 0) {
        toast({
          title: "Sincronização parcial",
          description: `${succeeded} enviado(s), ${failed} falhou(aram). Verifique a fila.`,
          variant: "destructive",
        });
      } else if (failed > 0) {
        toast({
          title: "Falha na sincronização",
          description: `${failed} cadastro(s) não puderam ser enviados. Serão tentados novamente.`,
          variant: "destructive",
        });
      }
    };
    window.addEventListener("sync-result", handler);
    return () => window.removeEventListener("sync-result", handler);
  }, [toast]);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-amber-500 text-white overflow-hidden z-[100]"
        >
          <div className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium">
            <WifiOff className="w-4 h-4" />
            <span>
              Você está offline — os dados serão salvos localmente
              {pendingCount > 0 && ` (${pendingCount} pendente${pendingCount > 1 ? "s" : ""})`}
            </span>
          </div>
        </motion.div>
      )}
      {isOnline && pendingCount > 0 && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-blue-500 text-white overflow-hidden z-[100]"
        >
          <div className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium">
            {isSyncing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CloudOff className="w-4 h-4" />
            )}
            <span>
              {isSyncing
                ? "Sincronizando dados pendentes..."
                : `${pendingCount} cadastro(s) pendente(s) de envio`}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

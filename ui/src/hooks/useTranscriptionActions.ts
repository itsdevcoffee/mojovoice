import { useAppStore } from '../stores/appStore';
import { useToast } from '../components/ui/Toast';

/**
 * Shared copy/delete handlers for transcription entries.
 * @param reloadLimit - How many entries to reload after undo (5 for main page, 1000 for history modal)
 */
export function useTranscriptionActions(reloadLimit: number = 5) {
  const { historyEntries, loadHistory, deleteHistoryEntry } = useAppStore();
  const { toast } = useToast();

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ message: 'Copied to clipboard', variant: 'success' });
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      toast({ message: 'Failed to copy', variant: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    const entry = historyEntries.find((e) => e.id === id);
    if (!entry) return;

    let undone = false;

    toast({
      message: 'Transcription deleted',
      variant: 'undo',
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          undone = true;
          loadHistory(reloadLimit, 0);
        },
      },
      onExpire: () => {
        if (!undone) {
          deleteHistoryEntry(id);
        }
      },
    });

    // Optimistically remove from UI
    useAppStore.setState((state) => ({
      historyEntries: state.historyEntries.filter((e) => e.id !== id),
    }));
  };

  return { handleCopy, handleDelete };
}

import { useAppStore } from '../stores/appStore';
import { useToast } from '../components/ui/Toast';

/**
 * Shared copy/delete handlers for transcription entries.
 */
export function useTranscriptionActions(_reloadLimit: number = 5) {
  const { deleteHistoryEntry } = useAppStore();
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
    // Optimistically remove from UI immediately
    useAppStore.setState((state) => ({
      historyEntries: state.historyEntries.filter((e) => e.id !== id),
    }));

    try {
      await deleteHistoryEntry(id);
      toast({ message: 'Transcription deleted', variant: 'success' });
    } catch (err) {
      console.error('Failed to delete transcription:', err);
      // Reload to restore the entry if delete failed
      useAppStore.getState().loadHistory();
      toast({ message: 'Failed to delete transcription', variant: 'error' });
    }
  };

  return { handleCopy, handleDelete };
}

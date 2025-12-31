import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, RefreshCw, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface RestartBannerProps {
  show: boolean;
  isRecording: boolean;
  restarting: boolean;
  success: boolean;
  error: string | null;
  onRestart: () => void;
  onDismiss: () => void;
}

export default function RestartBanner({
  show,
  isRecording,
  restarting,
  success,
  error,
  onRestart,
  onDismiss,
}: RestartBannerProps) {
  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={cn(
          'glass-panel p-4 mb-6 border-l-4',
          success
            ? 'border-green-500 bg-green-500/10'
            : error
            ? 'border-red-500 bg-red-500/10'
            : isRecording
            ? 'border-yellow-500 bg-yellow-500/10'
            : 'border-cyan-500 bg-cyan-500/10'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {success ? (
              <Check className="w-5 h-5 text-green-400" />
            ) : error ? (
              <X className="w-5 h-5 text-red-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-cyan-400" />
            )}

            <div>
              <p className="text-white font-medium text-sm">
                {success
                  ? '✓ Daemon restarted successfully!'
                  : error
                  ? '✗ Failed to restart daemon'
                  : isRecording
                  ? '⚠ Cannot restart while recording'
                  : '⚡ Restart needed to apply changes'}
              </p>
              <p className="text-gray-400 text-xs mt-0.5">
                {success
                  ? 'New settings are now active'
                  : error
                  ? error
                  : isRecording
                  ? 'Stop recording first, then restart manually or click Apply'
                  : 'Changes saved to disk. Click Apply to reload daemon.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!success && !isRecording && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onRestart}
                disabled={restarting}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2',
                  'backdrop-blur-md border-2 transition-all duration-200',
                  error
                    ? 'bg-red-500/20 border-red-500 text-red-400 hover:bg-red-500/30'
                    : 'bg-cyan-500/20 border-cyan-500 text-cyan-400 hover:bg-cyan-500/30'
                )}
              >
                {restarting ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </motion.div>
                    Restarting...
                  </>
                ) : error ? (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Retry
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Apply Changes
                  </>
                )}
              </motion.button>
            )}

            <button
              onClick={onDismiss}
              className="glass-button p-2 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

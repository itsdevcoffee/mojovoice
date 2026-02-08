import { useState } from 'react';
import { invoke } from '../lib/ipc';
import { motion } from 'framer-motion';
import { Mic, Square, Zap, Cpu, Database, Loader2, Play, StopCircle, RotateCcw } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import SectionHeader from './ui/SectionHeader';
import { Card } from './ui/Card';

export default function Dashboard() {
  const { daemonStatus, isRecording, isProcessing, setRecording, setProcessing, refreshDaemonStatus } = useAppStore();
  const [lastTranscription, setLastTranscription] = useState<string>('');
  const [daemonLoading, setDaemonLoading] = useState<'start' | 'stop' | 'restart' | null>(null);

  const handleStartRecording = async () => {
    try {
      setRecording(true);
      await invoke('start_recording');
    } catch (error) {
      console.error('Failed to start recording:', error);
      setRecording(false);
    }
  };

  const handleStopRecording = async () => {
    try {
      setProcessing(true);
      const result = await invoke('stop_recording') as string;
      setLastTranscription(result);
      setRecording(false);
      setProcessing(false);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setRecording(false);
      setProcessing(false);
    }
  };

  const handleStartDaemon = async () => {
    try {
      setDaemonLoading('start');
      await invoke('start_daemon');
      await refreshDaemonStatus();
    } catch (error) {
      console.error('Failed to start daemon:', error);
    } finally {
      setDaemonLoading(null);
    }
  };

  const handleStopDaemon = async () => {
    try {
      setDaemonLoading('stop');
      await invoke('stop_daemon');
      await refreshDaemonStatus();
    } catch (error) {
      console.error('Failed to stop daemon:', error);
    } finally {
      setDaemonLoading(null);
    }
  };

  const handleRestartDaemon = async () => {
    try {
      setDaemonLoading('restart');
      await invoke('restart_daemon');
      await refreshDaemonStatus();
    } catch (error) {
      console.error('Failed to restart daemon:', error);
    } finally {
      setDaemonLoading(null);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold text-white mb-2">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
            Mojo Voice
          </span>
        </h1>
        <p className="text-gray-400">GPU-Accelerated Voice Dictation</p>
      </motion.div>

      {/* Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatusCard
          icon={<Zap className="w-6 h-6" />}
          title="Daemon Status"
          value={daemonStatus.running ? 'Running' : 'Stopped'}
          status={daemonStatus.running ? 'active' : 'inactive'}
        />
        <StatusCard
          icon={<Cpu className="w-6 h-6" />}
          title="GPU"
          value={daemonStatus.gpuName || 'CPU Mode'}
          status={daemonStatus.gpuEnabled ? 'active' : 'inactive'}
        />
        <StatusCard
          icon={<Database className="w-6 h-6" />}
          title="Model"
          value={daemonStatus.modelLoaded ? 'Loaded' : 'Not Loaded'}
          status={daemonStatus.modelLoaded ? 'active' : 'inactive'}
        />
      </div>

      {/* Daemon Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass-card p-4 mb-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-medium">Daemon Control</h3>
            <p className="text-gray-400 text-sm">Start, stop, or restart the transcription daemon</p>
          </div>
          <div className="flex gap-2">
            <DaemonButton
              onClick={handleStartDaemon}
              disabled={daemonStatus.running || daemonLoading !== null}
              loading={daemonLoading === 'start'}
              variant="start"
              icon={<Play className="w-4 h-4" />}
              label="Start"
            />
            <DaemonButton
              onClick={handleStopDaemon}
              disabled={!daemonStatus.running || daemonLoading !== null}
              loading={daemonLoading === 'stop'}
              variant="stop"
              icon={<StopCircle className="w-4 h-4" />}
              label="Stop"
            />
            <DaemonButton
              onClick={handleRestartDaemon}
              disabled={!daemonStatus.running || daemonLoading !== null}
              loading={daemonLoading === 'restart'}
              variant="restart"
              icon={<RotateCcw className="w-4 h-4" />}
              label="Restart"
            />
          </div>
        </div>
      </motion.div>

      {/* Main Control Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="glass-panel p-8 mb-8"
      >
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-white mb-6">
            {isRecording ? 'Recording...' : isProcessing ? 'Processing...' : 'Ready to Record'}
          </h2>

          {/* Record Button */}
          <motion.button
            whileHover={!isProcessing ? { scale: 1.05 } : {}}
            whileTap={!isProcessing ? { scale: 0.95 } : {}}
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            disabled={isProcessing}
            className={cn(
              'relative w-24 h-24 rounded-full flex items-center justify-center',
              'backdrop-blur-md border-2 transition-all duration-300',
              isProcessing
                ? 'bg-purple-500/20 border-purple-500 cursor-wait'
                : isRecording
                ? 'bg-red-500/20 border-red-500 animate-pulse-glow'
                : 'bg-cyan-500/20 border-cyan-500 hover:bg-cyan-500/30'
            )}
          >
            {isProcessing ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 className="w-10 h-10 text-purple-400" />
              </motion.div>
            ) : isRecording ? (
              <Square className="w-10 h-10 text-red-500" />
            ) : (
              <Mic className="w-10 h-10 text-cyan-500" />
            )}

            {/* Pulsing ring effect while processing */}
            {isProcessing && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-purple-400"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.6, 0, 0.6],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            )}
          </motion.button>

          <p className="mt-4 text-gray-400 text-sm">
            {isProcessing
              ? 'Transcribing...'
              : isRecording
              ? 'Click to stop'
              : 'Click to start recording'}
          </p>

          {/* Last Transcription */}
          {lastTranscription && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 glass-card p-4"
            >
              <p className="text-sm text-gray-400 mb-2">Last Transcription:</p>
              <p className="text-white">{lastTranscription}</p>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickStat label="Latency" value="<500ms" />
        <QuickStat label="Accuracy" value="98%" />
        <QuickStat label="Sessions" value="24" />
        <QuickStat label="Total Time" value="2.4h" />
      </div>

      {/* Button Component Demo */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-card p-6 mt-8"
      >
        <SectionHeader title="Button Component Demo" />
        <div className="flex flex-wrap gap-4">
          <Button variant="primary" size="md">
            Primary Button
          </Button>
          <Button variant="secondary" size="md">
            Secondary Button
          </Button>
          <Button variant="ghost" size="md">
            Ghost Button
          </Button>
          <Button variant="primary" size="sm">
            Small
          </Button>
          <Button variant="primary" size="lg">
            Large Button
          </Button>
          <Button variant="primary" loading>
            Loading State
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
      </motion.div>

      {/* Card Component Demo */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-8"
      >
        <SectionHeader title="Card Component Demo" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <Card>
            <h3 className="text-lg font-semibold text-slate-100 mb-2 font-[family-name:var(--font-mono)]">
              Basic Card
            </h3>
            <p className="text-sm text-slate-400 font-[family-name:var(--font-ui)]">
              This is a card without a badge. Hover to see the electric blue glow effect.
            </p>
          </Card>
          <Card badge="[ACTIVE]">
            <h3 className="text-lg font-semibold text-slate-100 mb-2 font-[family-name:var(--font-mono)]">
              Large V3 Turbo
            </h3>
            <p className="text-sm text-slate-400 font-[family-name:var(--font-ui)]">
              1.5 GB • English • GPU Accelerated
            </p>
          </Card>
          <Card badge="[READY]">
            <h3 className="text-lg font-semibold text-slate-100 mb-2 font-[family-name:var(--font-mono)]">
              Recording Settings
            </h3>
            <p className="text-sm text-slate-400 font-[family-name:var(--font-ui)]">
              Max Duration: 120s • Device: Default Microphone
            </p>
          </Card>
          <Card>
            <h3 className="text-lg font-semibold text-slate-100 mb-2 font-[family-name:var(--font-mono)]">
              System Status
            </h3>
            <p className="text-sm text-slate-400 font-[family-name:var(--font-ui)]">
              GPU: RTX 4090 • Memory: 2.3 GB / 24 GB
            </p>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}

interface StatusCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  status: 'active' | 'inactive';
}

function StatusCard({ icon, title, value, status }: StatusCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="glass-card p-6 cursor-default"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          'p-2 rounded-lg',
          status === 'active' ? 'bg-cyan-500/20 text-cyan-500' : 'bg-gray-500/20 text-gray-500'
        )}>
          {icon}
        </div>
        <div className={cn(
          'w-2 h-2 rounded-full',
          status === 'active' ? 'bg-cyan-500 animate-pulse' : 'bg-gray-500'
        )} />
      </div>
      <p className="text-gray-400 text-sm mb-1">{title}</p>
      <p className="text-white text-lg font-semibold">{value}</p>
    </motion.div>
  );
}

interface QuickStatProps {
  label: string;
  value: string;
}

function QuickStat({ label, value }: QuickStatProps) {
  return (
    <div className="glass-card p-4 text-center">
      <p className="text-2xl font-bold text-white mb-1">{value}</p>
      <p className="text-gray-400 text-xs">{label}</p>
    </div>
  );
}

interface DaemonButtonProps {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  variant: 'start' | 'stop' | 'restart';
  icon: React.ReactNode;
  label: string;
}

function DaemonButton({ onClick, disabled, loading, variant, icon, label }: DaemonButtonProps) {
  const variantStyles = {
    start: 'bg-green-500/20 border-green-500/50 hover:bg-green-500/30 text-green-400',
    stop: 'bg-red-500/20 border-red-500/50 hover:bg-red-500/30 text-red-400',
    restart: 'bg-yellow-500/20 border-yellow-500/50 hover:bg-yellow-500/30 text-yellow-400',
  };

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-4 py-2 rounded-lg border flex items-center gap-2 transition-all duration-200',
        disabled ? 'opacity-50 cursor-not-allowed bg-gray-500/10 border-gray-500/30 text-gray-500' : variantStyles[variant]
      )}
    >
      {loading ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="w-4 h-4" />
        </motion.div>
      ) : (
        icon
      )}
      <span className="text-sm font-medium">{label}</span>
    </motion.button>
  );
}

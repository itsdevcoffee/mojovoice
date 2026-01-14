import { motion } from 'framer-motion';
import { LayoutDashboard, Settings, History, Wrench, Package } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { cn } from '../lib/utils';

type View = 'dashboard' | 'settings' | 'history' | 'devtools' | 'models';

interface NavItem {
  id: View;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'history', label: 'History', icon: <History className="w-5 h-5" /> },
  { id: 'models', label: 'Models', icon: <Package className="w-5 h-5" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
  { id: 'devtools', label: 'Dev Tools', icon: <Wrench className="w-5 h-5" /> },
];

export default function Navigation() {
  const { activeView, setActiveView } = useAppStore();

  return (
    <nav className="glass-panel p-2 mb-6">
      <div className="flex gap-2">
        {navItems.map((item) => (
          <motion.button
            key={item.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveView(item.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200',
              'backdrop-blur-sm border',
              activeView === item.id
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
            )}
          >
            {item.icon}
            <span className="text-sm font-medium">{item.label}</span>
          </motion.button>
        ))}
      </div>
    </nav>
  );
}

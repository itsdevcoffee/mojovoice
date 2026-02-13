import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const ANIMATION_MS = 300;

export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, children }) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Internal state: keep the component mounted while the exit animation plays
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  // Opening: mount first, then trigger the visible state on next frame
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // Allow one frame for the DOM to paint at initial (hidden) state
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisible(true);
        });
      });
    } else if (mounted) {
      // Closing: start exit animation, then unmount after it finishes
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), ANIMATION_MS);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!mounted) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mounted, onClose]);

  // Prevent scroll when drawer is open
  useEffect(() => {
    if (mounted) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mounted]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement as HTMLElement;

    const focusableElements = drawerRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements && focusableElements.length > 0) {
      (focusableElements[0] as HTMLElement).focus();
    }

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusables = drawerRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (!focusables || focusables.length === 0) return;

      const firstFocusable = focusables[0] as HTMLElement;
      const lastFocusable = focusables[focusables.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          lastFocusable.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          firstFocusable.focus();
          e.preventDefault();
        }
      }
    };

    document.addEventListener('keydown', handleTab);

    return () => {
      document.removeEventListener('keydown', handleTab);
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen]);

  if (!mounted) return null;

  return (
    <>
      {/* Backdrop — fades in/out via opacity transition */}
      <div
        className={`
          fixed inset-0 bg-[rgba(10,14,26,0.95)] backdrop-blur-[8px] z-40
          transition-opacity duration-300 ease-out
          ${visible ? 'opacity-100' : 'opacity-0'}
        `}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel — slides in/out via transform transition */}
      <div
        ref={drawerRef}
        className={`
          fixed top-0 right-0 h-screen w-[400px] bg-[#151B2E]
          border-l-2 border-[#334155] z-50 shadow-2xl overflow-y-auto
          transition-transform duration-300
          ${visible ? 'translate-x-0' : 'translate-x-full'}
        `}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-all duration-150 focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 focus-visible:shadow-[0_0_20px_rgba(59,130,246,0.5)]"
          aria-label="Close settings"
        >
          <X size={20} />
        </button>

        {/* Drawer content */}
        <div className="p-8 pt-16">
          {children}
        </div>
      </div>
    </>
  );
};

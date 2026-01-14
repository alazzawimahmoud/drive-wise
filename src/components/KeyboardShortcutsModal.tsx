import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutSection {
  title: string;
  shortcuts: ShortcutItem[];
}

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Simple flat list of shortcuts */
  shortcuts?: ShortcutItem[];
  /** Grouped shortcuts by section */
  sections?: ShortcutSection[];
}

/**
 * Reusable keyboard shortcuts modal component.
 * Can display shortcuts as a flat list or grouped by sections.
 */
export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  shortcuts,
  sections,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                    <Keyboard size={20} className="text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Keyboard Shortcuts</h3>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X size={18} className="text-slate-400" />
                </button>
              </div>

              {/* Content */}
              <div className="space-y-3">
                {/* Render sections if provided */}
                {sections?.map((section, sectionIndex) => (
                  <div key={section.title}>
                    {sectionIndex > 0 && <div className="border-t border-slate-100 pt-3 mt-3" />}
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      {section.title}
                    </div>
                    <div className="space-y-1.5">
                      {section.shortcuts.map((shortcut, index) => (
                        <ShortcutRow key={index} keys={shortcut.keys} description={shortcut.description} />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Render flat list if no sections */}
                {!sections && shortcuts && (
                  <div className="space-y-1.5">
                    {shortcuts.map((shortcut, index) => (
                      <ShortcutRow key={index} keys={shortcut.keys} description={shortcut.description} />
                    ))}
                  </div>
                )}
              </div>

              {/* Footer hint */}
              <p className="text-xs text-slate-400 mt-4 text-center">
                Press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-mono">?</kbd> to toggle this panel
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

/** Single shortcut row with keys and description */
const ShortcutRow: React.FC<{ keys: string[]; description: string }> = ({ keys, description }) => (
  <div className="flex items-center justify-between">
    <span className="text-sm text-slate-600">{description}</span>
    <div className="flex gap-1">
      {keys.map((key, i) => (
        <kbd 
          key={i} 
          className="px-2 py-1 bg-slate-100 rounded-lg text-xs font-mono font-bold text-slate-700 min-w-[28px] text-center"
        >
          {key}
        </kbd>
      ))}
    </div>
  </div>
);

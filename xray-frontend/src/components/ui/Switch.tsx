// src/components/ui/Switch.tsx
import { motion } from "framer-motion";

export const Switch = ({ checked, onChange }: { checked: boolean, onChange: (val: boolean) => void }) => {
  return (
    <div 
      onClick={() => onChange(!checked)}
      className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-300 ${
        checked ? 'bg-indigo-500' : 'bg-card border border-line'
      }`}
    >
      <motion.div 
        animate={{ x: checked ? 24 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="w-4 h-4 bg-white rounded-full shadow-sm"
      />
    </div>
  );
};
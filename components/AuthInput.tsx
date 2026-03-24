"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { motion } from "framer-motion";

export default function AuthInput({
  icon,
  type = "text",
  placeholder,
  value,
  onChange,
  name,
  autoComplete
}: {
  icon: any;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  name?: string;
  autoComplete?: string;
}) {
  return (
    <motion.label
      className="block"
      initial={{ y: 8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 250, damping: 22 }}
    >
      <div className="relative">
        <FontAwesomeIcon icon={icon} className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          className="surface-field w-full rounded-xl py-3 pl-9 pr-3 outline-none focus:ring-2 focus:ring-brand3"
          type={type}
          placeholder={placeholder}
          value={value}
          name={name}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          required
        />
      </div>
    </motion.label>
  );
}

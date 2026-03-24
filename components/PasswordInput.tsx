"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash, faLock } from "@fortawesome/free-solid-svg-icons";
import { motion } from "framer-motion";

export default function PasswordInput({
  placeholder,
  value,
  onChange,
  name,
  autoComplete
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  name?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <motion.label
      className="block"
      initial={{ y: 8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 250, damping: 22 }}
    >
      <div className="relative">
        <FontAwesomeIcon icon={faLock} className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          className="surface-field w-full rounded-xl py-3 pl-9 pr-10 outline-none focus:ring-2 focus:ring-brand3"
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          name={name}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          required
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:opacity-100"
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        >
          <FontAwesomeIcon icon={show ? faEyeSlash : faEye} className="h-4 w-4" />
        </button>
      </div>
    </motion.label>
  );
}

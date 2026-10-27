// src/components/AuthRequiredModal.tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Shield, LogIn, UserPlus, X } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

interface AuthRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  onSignup: () => void;
}

export const AuthRequiredModal: React.FC<AuthRequiredModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  onSignup,
}) => {
  const { t } = useTranslations("auth");

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
            }}
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 backdrop-blur-xl max-w-md w-full overflow-hidden text-slate-900 dark:text-slate-100"
          >
            {/* Header */}
            <div className="relative p-6 border-b border-slate-200/50 dark:border-slate-800/80 bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 dark:from-indigo-700 dark:via-blue-700 dark:to-purple-700">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{
                      rotate: [0, 10, 0, -10, 0],
                      scale: [1, 1.1, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <Shield className="h-6 w-6 text-white" />
                  </motion.div>
                  <h2 className="text-xl font-bold text-white">
                    {t("modal.title")}
                  </h2>
                </div>
                <motion.button
                  onClick={onClose}
                  aria-label={t("modal.close")}
                  className="p-1 text-white/80 hover:text-white transition-colors rounded-lg hover:bg-white/20"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X size={20} />
                </motion.button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-center mb-6"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20">
                  <UserPlus className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                  {t("modal.joinCommunity")}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t("modal.description")}
                </p>
              </motion.div>

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col gap-3"
              >
                <motion.button
                  onClick={onLogin}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white py-3 px-4 rounded-xl font-semibold shadow-lg shadow-indigo-500/25 transition-all duration-200 flex items-center justify-center gap-2"
                  whileHover={{
                    scale: 1.01,
                    y: -1,
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  <LogIn size={18} />
                  <span>{t("modal.signIn")}</span>
                </motion.button>

                <motion.button
                  onClick={onSignup}
                  className="w-full border-2 border-indigo-500/80 dark:border-indigo-400/80 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/60 py-3 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2"
                  whileHover={{
                    scale: 1.01,
                    y: -1,
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  <UserPlus size={18} />
                  <span>{t("modal.createAccount")}</span>
                </motion.button>
              </motion.div>

              {/* Footer */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-center text-xs text-slate-500 dark:text-slate-400 mt-4"
              >
                {t("modal.footer")}
              </motion.p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, Clock, Shield, ChevronRight, Menu } from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import {
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  PodaciumDrawer,
} from "@/components/design-system";

interface Section {
  id: string;
  title: string;
  level: number;
}

interface LegalTableOfContentsProps {
  sections: Section[];
  activeSection: string;
  pageNamespace: "terms" | "privacy" | "cookies" | "refund";
  icon?: React.ReactNode;
  direction?: "rtl" | "ltr";
}

const LegalTableOfContents: React.FC<LegalTableOfContentsProps> = ({
  sections,
  activeSection,
  pageNamespace,
  icon = <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
  direction: propDirection,
}) => {
  const t = useTranslations(pageNamespace);
  const tl = useTranslations("legal");
  const { dir: bidiDirection } = useBidi();
  const direction = propDirection || bidiDirection;
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      setIsOpen(false);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const windowHeight =
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight;
      const scrolled = (window.scrollY / windowHeight) * 100;
      setScrollProgress(scrolled);

      // Also handle visibility based on scroll
      setIsVisible(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* Desktop Fixed TOC */}
      <motion.div
        key={`toc-${direction}`}
        className={`fixed top-32 hidden lg:block w-72 z-30 start-6`}
        initial={{ opacity: 0, x: direction === "rtl" ? 20 : -20 }}
        animate={{ opacity: isVisible ? 1 : 0, x: 0 }}
        transition={{ duration: 0.3 }}
        dir={direction}
      >
        <div className="bg-white dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-slate-800/80 shadow-xl overflow-hidden hover:shadow-2xl transition-shadow duration-300">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 p-5 border-b border-gray-200/50 dark:border-slate-800/50">
            <div className={`flex items-center gap-3`}>
              <div
                className={`p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex-shrink-0`}
              >
                <div className="rtl:-scale-x-100">{icon}</div>
              </div>
              <div className={`flex-1 text-start`}>
                <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm">
                  {tl("toc.title")}
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {tl("toc.sectionsCount", {
                    count: sections.length.toString(),
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Scroll Progress Bar */}
          <div className="h-1 bg-gradient-to-r from-blue-200 to-indigo-200 dark:from-slate-800 dark:to-slate-700">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-600"
              initial={{ width: 0 }}
              animate={{ width: `${scrollProgress}%` }}
              style={{ originX: direction === "rtl" ? 1 : 0 }}
              transition={{ duration: 0.1 }}
            />
          </div>

          {/* Navigation */}
          <nav className="overflow-y-auto max-h-[calc(100vh-22rem)] p-3 space-y-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {sections.map((section, index) => (
              <motion.button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                initial={{ opacity: 0, x: direction === "rtl" ? 10 : -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02 }}
                className={`block w-full py-2.5 px-3.5 rounded-xl transition-all duration-200 text-sm relative overflow-hidden group text-start ${
                  activeSection === section.id
                    ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold"
                    : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-800/60"
                }`}
              >
                {/* Active indicator */}
                {activeSection === section.id && (
                  <motion.div
                    layoutId="activeSection"
                    className="absolute inset-0 bg-blue-100 dark:bg-blue-900/50 rounded-xl -z-10"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  />
                )}

                {/* Start accent bar for active */}
                {activeSection === section.id && (
                  <motion.div
                    className={`absolute top-0 w-1 h-full bg-blue-600 start-0`}
                    layoutId="activeBar"
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.2 }}
                  />
                )}

                {/* Section title with number */}
                <div className={`flex items-center gap-2 relative z-10`}>
                  <span
                    className="text-xs font-bold opacity-60 flex-shrink-0"
                    dir="ltr"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1">{section.title}</span>
                </div>
              </motion.button>
            ))}
          </nav>

          {/* Footer */}
          <div className="border-t border-gray-200/50 dark:border-slate-800/50 bg-gradient-to-b from-white/50 to-white/30 dark:from-slate-900/50 dark:to-slate-950/50 p-4 space-y-3">
            <div className={`flex items-center gap-2 text-xs`}>
              <Clock
                className={`w-4 h-4 text-gray-400 flex-shrink-0 rtl:-scale-x-100`}
              />
              <span className={`text-gray-600 dark:text-slate-400 text-start`}>
                <span className="font-semibold">{t("lastUpdated")}</span>{" "}
                {t("dates.lastUpdated")}
              </span>
            </div>
            <div className={`flex items-center gap-2 text-xs`}>
              <Shield className={`w-4 h-4 text-green-500 flex-shrink-0`} />
              <span className={`text-gray-600 dark:text-slate-400 text-start`}>
                <span className="font-semibold">{t("version")}:</span>{" "}
                {t("dates.version")}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Mobile Floating Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-8 end-8 lg:hidden z-40 p-4 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center gap-2`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        aria-label={tl("toc.open")}
      >
        <Menu className="w-6 h-6 rtl:-scale-x-100" />
        <span className="font-semibold text-sm pe-2">{tl("toc.sections")}</span>
      </motion.button>

      {/* Mobile TOC Drawer */}
      <PodaciumDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        position="bottom"
        size="auto"
      >
        <DrawerContent
          className="rounded-t-3xl lg:hidden"
          overlayClassName="bg-black/40 lg:hidden"
        >
          <DrawerHeader className="items-center border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-5 dark:border-slate-800 dark:from-slate-900 dark:to-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <div className="rtl:-scale-x-100">{icon}</div>
              </div>
              <DrawerTitle className="font-bold text-gray-900 dark:text-slate-100">
                {tl("toc.title")}
              </DrawerTitle>
            </div>
            <DrawerClose
              aria-label={tl("toc.close")}
              className="rounded-lg p-2 text-gray-500 dark:text-slate-400"
            />
          </DrawerHeader>

          <DrawerBody className="flex-1 space-y-2 p-4 pb-10">
            {sections.map((section) => (
              <motion.button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`block w-full py-4 px-4 rounded-xl transition-all duration-200 text-sm text-start flex items-center justify-between ${
                  activeSection === section.id
                    ? `bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold border-start-4 border-blue-600`
                    : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-800/60"
                }`}
                whileHover={{ x: direction === "rtl" ? -4 : 4 }}
                whileTap={{ x: 0 }}
              >
                <span>{section.title}</span>
                <ChevronRight
                  className={`w-5 h-5 transition-transform ${activeSection === section.id ? "opacity-100 translate-x-1 rtl:-translate-x-1 rtl:rotate-180" : "opacity-0"}`}
                />
              </motion.button>
            ))}
          </DrawerBody>
        </DrawerContent>
      </PodaciumDrawer>
    </>
  );
};

export default LegalTableOfContents;

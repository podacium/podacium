import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

// Enhanced Loading Screen with Podacium Design System
interface LoadingScreenProps {
  message?: string;
}

const PodaciumLoadingScreen: React.FC<LoadingScreenProps> = ({ message }) => {
  const t = useTranslations("common");
  const [isClient, setIsClient] = useState(false);
  const [currentQuote, setCurrentQuote] = useState(0);

  const quotes = [
    {
      text: "Learning never exhausts the mind.",
      author: "Leonardo da Vinci",
    },
    {
      text: "Every skill you learn rewrites the limits of what you can achieve.",
      author: "Podacium",
    },
    {
      text: "An investment in knowledge pays the best interest.",
      author: "Benjamin Franklin",
    },
    {
      text: "Progress begins the moment you decide to improve — not when you already know how.",
      author: "Podacium",
    },
    {
      text: "The future belongs to those who learn more skills and combine them creatively.",
      author: "Robert Greene",
    },
    {
      text: "Your potential expands with every lesson you complete.",
      author: "Podacium",
    },
    {
      text: "The expert in anything was once a beginner.",
      author: "Helen Hayes",
    },
    {
      text: "Small, consistent learning becomes unstoppable transformation.",
      author: "Podacium",
    },
    {
      text: "In a world that’s changing quickly, the only strategy guaranteed to fail is not taking risks.",
      author: "Mark Zuckerberg",
    },
    {
      text: "Knowledge builds confidence. Practice builds mastery.",
      author: "Podacium",
    },
  ];

  useEffect(() => {
    setIsClient(true);

    // Auto-rotate quotes every 5 seconds
    const quoteInterval = setInterval(() => {
      setCurrentQuote((prev) => (prev + 1) % quotes.length);
    }, 5000);

    return () => clearInterval(quoteInterval);
  }, [quotes.length]);

  // Don't render the animated particles during SSR
  if (!isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-6"
          />
          <p className="text-white text-xl">{t("loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        {/* Floating Particles - Optimized quantity and size */}
        {[...Array(25)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-3 h-3 bg-blue-400/25 rounded-full"
            initial={{
              x:
                Math.random() *
                (typeof window !== "undefined" ? window.innerWidth : 2000),
              y:
                Math.random() *
                (typeof window !== "undefined" ? window.innerHeight : 2000),
              scale: Math.random() * 0.8 + 0.7,
            }}
            animate={{
              y: [null, -50, 0],
              x: [null, Math.random() * 80 - 40, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: Math.random() * 5 + 4,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: "easeInOut",
            }}
          />
        ))}

        {/* Enhanced Animated Grid */}
        <div className="absolute inset-0 opacity-20">
          <div
            className="absolute inset-0 bg-[linear-gradient(90deg,transparent_48px,rgba(59,130,246,0.15)_49px,transparent_50px),linear-gradient(180deg,transparent_48px,rgba(59,130,246,0.15)_49px,transparent_50px)] bg-[size:80px_80px]"
            style={{
              animation: "pan 20s linear infinite",
            }}
          />
        </div>

        {/* Gradient Orbs - Better proportions */}
        <motion.div
          className="absolute top-1/4 -left-48 w-96 h-96 bg-gradient-to-r from-blue-500/20 to-cyan-400/20 rounded-full blur-4xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-1/4 -right-48 w-96 h-96 bg-gradient-to-r from-purple-500/20 to-pink-400/20 rounded-full blur-4xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.5, 0.3, 0.5],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 3,
          }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-8 w-full">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center space-y-12 mx-auto w-full"
        >
          {/* Enhanced Animated Logo/Brand */}
          <motion.div
            className="flex items-center justify-center gap-5 mb-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.7 }}
          >
            <motion.div
              className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center shadow-xl"
              animate={{
                rotate: [0, 5, -5, 0],
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <BookOpen className="w-10 h-10 text-white" />
            </motion.div>
            <motion.span
              className="text-4xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              {t("loadingScreen.brand")}
            </motion.span>
          </motion.div>

          {/* Enhanced Main Loading Animation */}
          <div className="relative mb-4">
            {/* Outer Glow */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-blue-500/25 to-cyan-400/25 rounded-full blur-xl"
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.4, 0.7, 0.4],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            {/* Main Spinner - Better proportions */}
            <motion.div
              className="relative w-48 h-48 mx-auto"
              animate={{
                rotate: 360,
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              {/* Orbiting Dots - Better spacing */}
              {[...Array(10)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-5 h-5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full shadow-lg"
                  style={{
                    top: "50%",
                    left: "50%",
                    transform: `rotate(${i * 36}deg) translateX(70px) rotate(-${i * 36}deg)`,
                  }}
                  animate={{
                    scale: [0.8, 1.3, 0.8],
                    opacity: [0.6, 1, 0.6],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.08,
                    ease: "easeInOut",
                  }}
                />
              ))}

              {/* Center Core */}
              <div className="absolute inset-10 bg-gradient-to-br from-slate-800 to-slate-900 rounded-full flex items-center justify-center shadow-xl border border-slate-700">
                <motion.div
                  className="w-14 h-14 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 180, 360],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </div>
            </motion.div>
          </div>

          {/* Enhanced Loading Text with Typing Animation */}
          <div className="space-y-4">
            <motion.h1
              className="text-3xl font-bold bg-gradient-to-r from-white via-blue-200 to-cyan-200 bg-clip-text text-transparent"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              {message ?? t("loading")}
            </motion.h1>

            <motion.p
              className="text-xl text-gray-300 font-light"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              {t("loadingScreen.preparingJourney")}
            </motion.p>
          </div>

          {/* Enhanced Progress Indicator */}
          <motion.div
            className="space-y-4 max-w-xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            {/* Enhanced Animated Progress Bar */}
            <div className="h-3 bg-gray-800/50 rounded-full overflow-hidden backdrop-blur-sm border border-gray-700/30">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 rounded-full relative"
                initial={{ width: "0%" }}
                animate={{ width: ["0%", "25%", "50%", "75%", "100%"] }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <motion.div
                  className="absolute top-0 right-0 w-6 h-3 bg-white/30 rounded-full blur-sm"
                  animate={{
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </motion.div>
            </div>

            {/* Enhanced Loading Steps */}
            <motion.div
              className="flex justify-between text-base text-gray-400 px-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4 }}
            >
              {["Initializing", "Loading", "Preparing", "Ready"].map(
                (step, index) => (
                  <motion.span
                    key={step}
                    className="flex items-center gap-2 flex-col"
                    animate={{
                      opacity: [0.4, 1, 0.4],
                      color: ["#6B7280", "#60A5FA", "#6B7280"],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      delay: index * 0.8,
                    }}
                  >
                    <motion.div
                      className="w-2 h-2 bg-blue-500 rounded-full"
                      animate={{ scale: [0.6, 1.2, 0.6] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        delay: index * 0.4,
                      }}
                    />
                    <span className="whitespace-nowrap text-sm">{step}</span>
                  </motion.span>
                ),
              )}
            </motion.div>
          </motion.div>

          {/* Enhanced Quote Carousel */}
          <motion.div
            className="mt-12 p-6 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 max-w-2xl mx-auto relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.6 }}
          >
            {/* Quote Navigation Dots */}
            <div className="flex justify-center gap-1 mb-4">
              {quotes.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentQuote(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentQuote
                      ? "bg-cyan-400 scale-125"
                      : "bg-gray-500/50 hover:bg-gray-400"
                  }`}
                />
              ))}
            </div>

            {/* Animated Quotes */}
            <div className="relative h-20 overflow-hidden">
              {quotes.map((quote, index) => (
                <motion.div
                  key={index}
                  className="absolute inset-0 p-2"
                  initial={{ opacity: 0, x: 80 }}
                  animate={{
                    opacity: index === currentQuote ? 1 : 0,
                    x:
                      index === currentQuote
                        ? 0
                        : index > currentQuote
                          ? 80
                          : -80,
                  }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                >
                  <motion.p
                    className="text-gray-200 italic text-center leading-relaxed"
                    animate={{
                      opacity: [0.8, 1, 0.8],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    &ldquo;{quote.text}&rdquo;
                  </motion.p>
                  <motion.p
                    className="text-cyan-400/70 mt-2 text-center font-medium text-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    - {quote.author}
                  </motion.p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Enhanced Bottom Wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          className="w-full h-20 text-slate-900 dark:text-slate-100"
        >
          <motion.path
            d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z"
            opacity=".25"
            className="fill-current"
            animate={{
              d: [
                "M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z",
                "M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z",
              ],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </svg>
      </div>
    </div>
  );
};

export default PodaciumLoadingScreen;

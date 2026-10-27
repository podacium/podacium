"use client";

import React, { useState, useCallback, useEffect, Suspense, lazy } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ChevronLeft,
  Loader2,
  Sparkles,
  CheckCircle2,
  X,
  Search,
} from "lucide-react";
import { useAuth, hasOnboardingDoneCookie } from "@/contexts/AuthContext";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api, OnboardingSubmitData } from "@/lib/api";
import {
  PodaciumButton,
  PodaciumInput,
  PodaciumTextarea,
} from "@/components/design-system";
import {
  PasswordStrengthIndicator,
  PasswordMatchIndicator,
} from "@/components/auth/AuthComponents";

const Navbar = lazy(() => import("@/components/Navbar"));

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? ((current + 1) / total) * 100 : 0;
  return (
    <div className="w-full">
      <div className="h-2 bg-background border border-border rounded-full overflow-hidden shadow-sm">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_0_10px_rgba(37,99,235,0.3)]"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>
    </div>
  );
}

function OptionCard({
  label,
  selected,
  onClick,
  delay = 0,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  delay?: number;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1], delay }}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={`group relative w-full text-left p-6 rounded-2xl border transition-all duration-300 overflow-hidden
        ${
          selected
            ? "border-blue-600 bg-background shadow-lg shadow-blue-600/5 ring-1 ring-blue-600"
            : "border-border bg-background hover:border-blue-200 hover:shadow-xl"
        }`}
    >
      <div className="relative flex items-center justify-between">
        <span
          className={`font-bold text-lg transition-colors duration-200 ${selected ? "text-primary" : "text-foreground"}`}
        >
          {label}
        </span>
        <div
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 
                    ${selected ? "bg-primary border-blue-600" : "border-border group-hover:border-blue-300 dark:border-blue-700"}`}
        >
          {selected && (
            <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
          )}
        </div>
      </div>
    </motion.button>
  );
}

function SkillChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all duration-200
                ${
                  selected
                    ? "bg-blue-600 text-white border-blue-600 shadow-md"
                    : "bg-background text-foreground border-border hover:border-blue-300 hover:bg-blue-50/50"
                }`}
    >
      {label}
      {selected && <X className="inline w-3 h-3 ml-1.5 rtl:mr-1.5 rtl:ml-0" />}
    </motion.button>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading, updateOnboardingStatus } = useAuth();
  const { t } = useTranslations("onboarding");
  const { t: tAuth } = useTranslations("auth");
  const { dir } = useBidi();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [answers, setAnswers] = useState<Partial<OnboardingSubmitData>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleConfig, setRoleConfig] = useState<any>(null);
  const [categorySkills, setCategorySkills] = useState<
    Record<string, string[]>
  >({});
  const [skillSearch, setSkillSearch] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>(
    {},
  );

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    api
      .getOnboardingConfig()
      .then((cfg) => {
        setRoleConfig(cfg.roles);
        setCategorySkills(cfg.category_skills);
      })
      .catch(() => {});
  }, [mounted]);

  const selectedRole = answers.role as string | undefined;

  const roleSteps = React.useMemo(() => {
    if (!roleConfig || !selectedRole) return null;
    return roleConfig[selectedRole]?.steps || null;
  }, [roleConfig, selectedRole]);

  const totalSteps = roleSteps ? roleSteps.length : 1;
  const isRoleSelected = !!selectedRole;

  const currentStepKey = roleSteps?.[step]?.key;
  const currentStepType = roleSteps?.[step]?.type;
  const currentStepOptions = roleSteps?.[step]?.optionKeys;

  const canProceed =
    currentStepType === "text" ||
    currentStepType === "multi-select" ||
    (currentStepKey && !!answers[currentStepKey]);
  const isLastStep = roleSteps ? step >= roleSteps.length - 1 : false;
  const showRoleStep = !isRoleSelected || !roleSteps;

  useEffect(() => {
    if (!mounted) return;
    if (hasOnboardingDoneCookie()) {
      router.replace("/dashboard");
      return;
    }
    if (!authLoading && user?.onboardingCompleted) {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router, mounted]);

  const goNext = useCallback(() => {
    if (roleSteps && step < roleSteps.length - 1) {
      setDirection(1);
      setStep((s) => s + 1);
    }
  }, [step, roleSteps]);

  const goBack = useCallback(() => {
    if (showRoleStep && isRoleSelected) {
      setDirection(-1);
      setAnswers((prev) => {
        const copy = { ...prev };
        delete copy.role;
        return copy;
      });
      setStep(0);
      return;
    }
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  }, [step, showRoleStep, isRoleSelected]);

  const selectOption = useCallback((key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleSkill = useCallback((skill: string) => {
    setAnswers((prev) => {
      const current = (prev.skills as string[]) || [];
      const lower = skill.toLowerCase().trim();
      if (current.some((s) => s.toLowerCase().trim() === lower)) {
        return {
          ...prev,
          skills: current.filter((s) => s.toLowerCase().trim() !== lower),
        };
      }
      return { ...prev, skills: [...current, skill.trim()] };
    });
  }, []);

  const handleRoleSelect = useCallback((role: string) => {
    setAnswers((prev) => ({ ...prev, role }));
    setStep(0);
    setDirection(1);
  }, []);

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPasswordErrors({});

    if (user && !user.hasPassword && (password || confirmPassword)) {
      const newPasswordErrors: Record<string, string> = {};
      const hasUppercase = /[A-Z]/.test(password);
      const hasLowercase = /[a-z]/.test(password);
      const hasDigit = /[0-9]/.test(password);
      const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?`~]/.test(
        password,
      );

      if (password.length < 8) {
        newPasswordErrors.password = tAuth("signup.form.errors.passwordLength");
      } else if (!hasUppercase || !hasLowercase || !hasDigit || !hasSpecial) {
        newPasswordErrors.password = tAuth(
          "signup.form.errors.passwordRequired",
        );
      }
      if (password !== confirmPassword) {
        newPasswordErrors.confirmPassword = tAuth(
          "signup.form.errors.passwordsMismatch",
        );
      }
      if (Object.keys(newPasswordErrors).length > 0) {
        setPasswordErrors(newPasswordErrors);
        setLoading(false);
        return;
      }
    }

    try {
      const submitData: OnboardingSubmitData = {
        role: answers.role || undefined,
        primaryGoal: answers.primaryGoal || undefined,
        experienceLevel: answers.experienceLevel || undefined,
        fieldOfInterest: answers.fieldOfInterest || undefined,
        weeklyTime: answers.weeklyTime || undefined,
        discoverySource: answers.discoverySource || undefined,
        openAnswer: answers.openAnswer || undefined,
        skills: (answers.skills as string[])?.length
          ? (answers.skills as string[])
          : undefined,
      };
      if (user && !user.hasPassword && password) {
        submitData.password = password;
      }
      await api.submitOnboarding(submitData);
      await updateOnboardingStatus(true);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || t("onboarding.errors.submitFailed"));
    } finally {
      setLoading(false);
    }
  }, [
    answers,
    router,
    updateOnboardingStatus,
    t,
    tAuth,
    user,
    password,
    confirmPassword,
  ]);

  const handleSkip = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await api.skipOnboarding();
      await updateOnboardingStatus(true);
      router.push("/dashboard");
    } catch {
      setError(t("onboarding.errors.skipFailed"));
    } finally {
      setLoading(false);
    }
  }, [router, updateOnboardingStatus, t]);

  if (
    !mounted ||
    authLoading ||
    (mounted && hasOnboardingDoneCookie()) ||
    user?.onboardingCompleted
  ) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const renderStepContent = () => {
    if (showRoleStep) {
      return (
        <div>
          <h2 className="text-xl font-bold text-foreground leading-tight mb-2">
            {t("onboarding.questions.role.title")}
          </h2>
          <p className="text-base text-muted-foreground mb-8 leading-relaxed">
            {t("onboarding.questions.role.subtitle")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              "student",
              "professional",
              "freelancer",
              "entrepreneur",
              "researcher",
              "instructor",
              "other",
            ].map((optKey, i) => (
              <OptionCard
                key={optKey}
                label={t(`onboarding.questions.role.options.${optKey}`)}
                selected={answers.role === optKey}
                onClick={() => handleRoleSelect(optKey)}
                delay={i * 0.04}
              />
            ))}
          </div>
        </div>
      );
    }

    if (!currentStepKey) return null;

    if (currentStepType === "multi-select" && currentStepKey === "skills") {
      const selectedSkills = (answers.skills as string[]) || [];
      const activeCategory = (answers.fieldOfInterest as string) || "software";
      const suggested =
        categorySkills[activeCategory] || categorySkills["software"] || [];

      const filtered = skillSearch
        ? suggested.filter((s) =>
            s.toLowerCase().includes(skillSearch.toLowerCase()),
          )
        : suggested;

      return (
        <div>
          <h2 className="text-xl font-bold text-foreground leading-tight mb-2">
            {t("onboarding.questions.skills.title")}
          </h2>
          <p className="text-base text-muted-foreground mb-6 leading-relaxed">
            {t("onboarding.questions.skills.subtitle")}
          </p>

          <PodaciumInput
            value={skillSearch}
            onChange={(e) => setSkillSearch(e.target.value)}
            placeholder={t("onboarding.questions.skills.placeholder")}
            leftIcon={<Search className="w-4 h-4" />}
          />

          <div className="flex flex-wrap gap-2 mt-4 max-h-48 overflow-y-auto">
            {filtered.map((skill) => (
              <SkillChip
                key={skill}
                label={skill}
                selected={selectedSkills.some(
                  (s) => s.toLowerCase().trim() === skill.toLowerCase(),
                )}
                onClick={() => toggleSkill(skill)}
              />
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground italic py-4">
                {t("onboarding.questions.skills.placeholder")}
              </p>
            )}
          </div>

          {selectedSkills.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground font-bold mb-2 uppercase tracking-wider">
                {t("onboarding.questions.skills.selected", {
                  count: String(selectedSkills.length),
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedSkills.map((skill) => (
                  <SkillChip
                    key={skill}
                    label={skill}
                    selected={true}
                    onClick={() => toggleSkill(skill)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div>
        <h2 className="text-xl font-bold text-foreground leading-tight mb-2">
          {t(`onboarding.questions.${currentStepKey}.title`)}
        </h2>
        <p className="text-base text-muted-foreground mb-8 leading-relaxed">
          {t(`onboarding.questions.${currentStepKey}.subtitle`)}
        </p>

        {currentStepType === "mcq" && currentStepOptions && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentStepOptions.map((optKey: string, i: number) => (
              <OptionCard
                key={optKey}
                label={t(
                  `onboarding.questions.${currentStepKey}.options.${optKey}`,
                )}
                selected={answers[currentStepKey] === optKey}
                onClick={() => selectOption(currentStepKey, optKey)}
                delay={i * 0.04}
              />
            ))}
          </div>
        )}

        {currentStepType === "text" && (
          <div className="flex-1 flex flex-col gap-4">
            <PodaciumTextarea
              value={answers[currentStepKey] || ""}
              onChange={(e) => selectOption(currentStepKey, e.target.value)}
              placeholder={t(
                `onboarding.questions.${currentStepKey}.placeholder`,
              )}
              rows={answers[currentStepKey] ? 3 : 5}
              className="min-h-[100px]"
            />

            {user && !user.hasPassword && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4 pt-4 border-t border-border"
              >
                <div className="text-sm font-bold text-foreground mb-1">
                  {tAuth("signup.form.fields.password.label")}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <PodaciumInput
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={tAuth(
                      "signup.form.fields.password.placeholder",
                    )}
                    error={passwordErrors.password}
                  />
                  <div className="space-y-1">
                    <PodaciumInput
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={tAuth(
                        "signup.form.fields.confirmPassword.placeholder",
                      )}
                      error={passwordErrors.confirmPassword}
                    />
                    <AnimatePresence>
                      {confirmPassword && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <PasswordMatchIndicator
                            value={confirmPassword}
                            comparisonValue={password}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="mt-4">
                  <PasswordStrengthIndicator password={password} />
                </div>

                <p className="text-xs text-muted-foreground italic mt-3">
                  {tAuth("signup.form.fields.password.tooltip")}
                </p>
              </motion.div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Suspense fallback={null}>
        <Navbar />
      </Suspense>

      <main className="pt-24 sm:pt-28 pb-12 px-4 sm:px-6 flex justify-center">
        <div className="w-full max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 mt-6 rounded-full bg-background border border-border text-muted-foreground text-[11px] font-black uppercase tracking-wider mb-4 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              {t("onboarding.progress", {
                current: String(isRoleSelected ? step + 1 : 0),
                total: String(totalSteps),
              })}
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
              {t("onboarding.title")}
            </h1>
          </motion.div>

          {isRoleSelected && roleSteps && (
            <div className="mb-4">
              <ProgressBar current={step} total={totalSteps} />
            </div>
          )}

          <div className="bg-background rounded-2xl border border-border shadow-sm p-8 sm:p-10 min-h-[360px] flex flex-col">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={showRoleStep ? "role" : currentStepKey}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                className="flex-1 flex flex-col"
              >
                {renderStepContent()}
              </motion.div>
            </AnimatePresence>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-500 dark:text-red-400 text-sm text-center mt-4"
              >
                {error}
              </motion.p>
            )}

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <div className="flex items-center gap-3">
                {(step > 0 || showRoleStep) && (
                  <PodaciumButton
                    variant="outline"
                    onClick={goBack}
                    disabled={loading}
                    icon={<ChevronLeft className="w-4 h-4" />}
                    iconPosition="left"
                  >
                    {t("onboarding.buttons.back")}
                  </PodaciumButton>
                )}
              </div>

              <div className="flex items-center gap-3">
                <PodaciumButton
                  variant="outline"
                  onClick={handleSkip}
                  disabled={loading}
                >
                  {t("onboarding.buttons.skip")}
                </PodaciumButton>

                {showRoleStep ? (
                  <PodaciumButton
                    variant="gradient"
                    disabled={loading}
                    icon={<ChevronRight className="w-4 h-4" />}
                    iconPosition="right"
                  >
                    {t("onboarding.buttons.next")}
                  </PodaciumButton>
                ) : isLastStep ? (
                  <PodaciumButton
                    variant="gradient"
                    onClick={handleSubmit}
                    disabled={loading}
                    loading={loading}
                    icon={
                      !loading ? <Sparkles className="w-4 h-4" /> : undefined
                    }
                    iconPosition="right"
                  >
                    {loading
                      ? t("onboarding.buttons.submitting")
                      : t("onboarding.buttons.submit")}
                  </PodaciumButton>
                ) : (
                  <PodaciumButton
                    variant="gradient"
                    onClick={goNext}
                    disabled={!canProceed || loading}
                    icon={<ChevronRight className="w-4 h-4" />}
                    iconPosition="right"
                  >
                    {t("onboarding.buttons.next")}
                  </PodaciumButton>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

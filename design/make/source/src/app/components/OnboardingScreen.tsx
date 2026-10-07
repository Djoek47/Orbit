import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Check } from "lucide-react";
import { ChoremaxxLogo } from "./ChoremaxxLogo";

export type UserRole = "parent" | "caregiver" | "child" | "roommate";

type MotivationMode =
  | "none" | "allowance" | "xp" | "xp_rewards" | "allowance_xp"
  | "allowance_rewards" | "custom";

const roles: { id: UserRole; emoji: string; title: string; subtitle: string; color: string; gradient: string; perks: string[] }[] = [
  {
    id: "parent", emoji: "👑", title: "Parent", subtitle: "Full household admin",
    color: "#3BB5F0", gradient: "linear-gradient(135deg, #3BB5F0, #0EA5E9)",
    perks: ["Assign & approve tasks", "Manage allowance & rewards", "See all analytics", "Invite members"],
  },
  {
    id: "caregiver", emoji: "🤝", title: "Caregiver", subtitle: "Assign & approve tasks",
    color: "#2DD4BF", gradient: "linear-gradient(135deg, #2DD4BF, #0891B2)",
    perks: ["Assign tasks to anyone", "Complete & approve chores", "View household progress"],
  },
  {
    id: "child", emoji: "⭐", title: "Child", subtitle: "Earn XP & rewards",
    color: "#34D399", gradient: "linear-gradient(135deg, #34D399, #059669)",
    perks: ["See my tasks clearly", "Earn XP & level up", "Unlock rewards", "Build good habits"],
  },
  {
    id: "roommate", emoji: "🏠", title: "Roommate", subtitle: "Shared living, simplified",
    color: "#A78BFA", gradient: "linear-gradient(135deg, #A78BFA, #7C3AED)",
    perks: ["Shared chores & bills", "Rotation schedules", "Shared groceries", "No parenting language"],
  },
];

const motivationOptions: { id: MotivationMode; emoji: string; label: string; desc: string }[] = [
  { id: "none",             emoji: "🧘", label: "No rewards",         desc: "Just get things done" },
  { id: "xp",              emoji: "⚡", label: "XP only",             desc: "Level up with points" },
  { id: "xp_rewards",      emoji: "🎁", label: "XP + Rewards",        desc: "Points unlock fun prizes" },
  { id: "allowance",       emoji: "💰", label: "Allowance",           desc: "Earn real money for chores" },
  { id: "allowance_xp",    emoji: "🌟", label: "Allowance + XP",      desc: "Money & levels combined" },
  { id: "allowance_rewards",emoji: "🏆", label: "Full System",        desc: "Allowance, XP & rewards" },
  { id: "custom",          emoji: "✏️", label: "Custom",              desc: "Build your own system" },
];

interface OnboardingScreenProps {
  onComplete: (role: UserRole, motivation: MotivationMode) => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState<"splash" | "role" | "motivation" | "ready">("splash");
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [selectedMotivation, setSelectedMotivation] = useState<MotivationMode | null>(null);

  const handleRoleContinue = () => {
    if (!selectedRole) return;
    if (selectedRole === "child" || selectedRole === "roommate") {
      setStep("ready");
    } else {
      setStep("motivation");
    }
  };

  const handleComplete = () => {
    onComplete(selectedRole ?? "parent", selectedMotivation ?? "xp");
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "#070D1C" }}>
      <AnimatePresence mode="wait">

        {/* ── Splash ── */}
        {step === "splash" && (
          <motion.div
            key="splash"
            className="flex flex-col items-center justify-center flex-1 px-8 text-center gap-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
          >
            {/* Ambient glow */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: "radial-gradient(ellipse at 50% 40%, rgba(59,181,240,0.08) 0%, transparent 65%)",
            }} />

            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 260, damping: 20 }}
            >
              <ChoremaxxLogo size="xl" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <p className="text-lg" style={{ color: "#EEF2FF", fontWeight: 600, lineHeight: 1.4 }}>
                Your AI-powered
              </p>
              <p className="text-lg" style={{ color: "#7C9CC0", fontWeight: 400 }}>
                Household Operating System
              </p>
            </motion.div>

            <motion.div
              className="flex flex-col gap-2 w-full"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75 }}
            >
              {["Zero clutter. Maximum harmony.", "AI that manages your home.", "Family-first. Always."].map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: i === 0 ? "#3BB5F0" : i === 1 ? "#2DD4BF" : "#F59E0B" }} />
                  <span className="text-sm" style={{ color: "#7C9CC0" }}>{t}</span>
                </div>
              ))}
            </motion.div>

            <motion.button
              className="w-full py-4 rounded-3xl text-base"
              style={{ background: "linear-gradient(135deg, #3BB5F0, #0EA5E9)", fontWeight: 700, color: "#fff", boxShadow: "0 8px 24px rgba(59,181,240,0.35)" }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setStep("role")}
            >
              Get Started
            </motion.button>
          </motion.div>
        )}

        {/* ── Role picker ── */}
        {step === "role" && (
          <motion.div
            key="role"
            className="flex flex-col flex-1 px-5 pt-4 pb-6 overflow-y-auto"
            style={{ scrollbarWidth: "none" }}
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center justify-between mb-5">
              <ChoremaxxLogo size="sm" />
              <div className="flex gap-1.5">
                {[0,1,2].map((i) => (
                  <div key={i} className="h-1 rounded-full" style={{ width: i === 0 ? 20 : 8, background: i === 0 ? "#3BB5F0" : "rgba(255,255,255,0.15)" }} />
                ))}
              </div>
            </div>

            <h2 className="text-2xl mb-1" style={{ fontWeight: 800, color: "#EEF2FF" }}>Who are you?</h2>
            <p className="text-sm mb-5" style={{ color: "#7C9CC0" }}>Choremaxx adapts to your role in the household.</p>

            <div className="flex flex-col gap-3 flex-1">
              {roles.map((role, i) => (
                <motion.button
                  key={role.id}
                  className="rounded-3xl p-4 text-left relative overflow-hidden"
                  style={{
                    background: selectedRole === role.id
                      ? `linear-gradient(135deg, ${role.color}22, ${role.color}0A)`
                      : "rgba(255,255,255,0.05)",
                    border: `2px solid ${selectedRole === role.id ? role.color + "55" : "rgba(255,255,255,0.08)"}`,
                    boxShadow: selectedRole === role.id ? `0 0 20px ${role.color}20` : "none",
                  }}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedRole(role.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: `${role.color}18`, border: `1px solid ${role.color}33` }}>
                      {role.emoji}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-base" style={{ color: "#EEF2FF", fontWeight: 700 }}>{role.title}</p>
                          <p className="text-xs" style={{ color: role.color, fontWeight: 500 }}>{role.subtitle}</p>
                        </div>
                        <div
                          className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                          style={{
                            borderColor: selectedRole === role.id ? role.color : "rgba(255,255,255,0.2)",
                            background: selectedRole === role.id ? role.color : "transparent",
                          }}
                        >
                          {selectedRole === role.id && <Check size={11} color="#070D1C" strokeWidth={3} />}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {role.perks.map((p) => (
                          <span key={p} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "#7C9CC0" }}>
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>

            <motion.button
              className="w-full py-4 rounded-3xl text-sm mt-5 flex items-center justify-center gap-2"
              style={{
                background: selectedRole ? "linear-gradient(135deg, #3BB5F0, #0EA5E9)" : "rgba(255,255,255,0.06)",
                color: selectedRole ? "#fff" : "#4B6080",
                fontWeight: 700,
                boxShadow: selectedRole ? "0 8px 24px rgba(59,181,240,0.3)" : "none",
              }}
              whileTap={{ scale: 0.97 }}
              onClick={handleRoleContinue}
            >
              Continue <ChevronRight size={16} />
            </motion.button>
          </motion.div>
        )}

        {/* ── Motivation ── */}
        {step === "motivation" && (
          <motion.div
            key="motivation"
            className="flex flex-col flex-1 px-5 pt-4 pb-6 overflow-y-auto"
            style={{ scrollbarWidth: "none" }}
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center justify-between mb-5">
              <ChoremaxxLogo size="sm" />
              <div className="flex gap-1.5">
                {[0,1,2].map((i) => (
                  <div key={i} className="h-1 rounded-full" style={{ width: i === 1 ? 20 : 8, background: i <= 1 ? "#3BB5F0" : "rgba(255,255,255,0.15)" }} />
                ))}
              </div>
            </div>

            <h2 className="text-2xl mb-1" style={{ fontWeight: 800, color: "#EEF2FF" }}>How do you motivate your household?</h2>
            <p className="text-sm mb-5" style={{ color: "#7C9CC0" }}>You can change this anytime in Settings.</p>

            <div className="grid grid-cols-2 gap-3 flex-1">
              {motivationOptions.map((opt, i) => (
                <motion.button
                  key={opt.id}
                  className="rounded-3xl p-4 text-left"
                  style={{
                    background: selectedMotivation === opt.id ? "rgba(59,181,240,0.15)" : "rgba(255,255,255,0.05)",
                    border: `2px solid ${selectedMotivation === opt.id ? "#3BB5F055" : "rgba(255,255,255,0.08)"}`,
                    gridColumn: opt.id === "allowance_rewards" || opt.id === "custom" ? "span 2" : "span 1",
                  }}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setSelectedMotivation(opt.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span style={{ fontSize: 24 }}>{opt.emoji}</span>
                    {selectedMotivation === opt.id && (
                      <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#3BB5F0" }}>
                        <Check size={9} color="#070D1C" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <p className="text-sm mt-2" style={{ color: "#EEF2FF", fontWeight: 600, lineHeight: 1.2 }}>{opt.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#4B6080" }}>{opt.desc}</p>
                </motion.button>
              ))}
            </div>

            <motion.button
              className="w-full py-4 rounded-3xl text-sm mt-5 flex items-center justify-center gap-2"
              style={{
                background: selectedMotivation ? "linear-gradient(135deg, #3BB5F0, #0EA5E9)" : "rgba(255,255,255,0.06)",
                color: selectedMotivation ? "#fff" : "#4B6080",
                fontWeight: 700,
                boxShadow: selectedMotivation ? "0 8px 24px rgba(59,181,240,0.3)" : "none",
              }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setStep("ready")}
            >
              Continue <ChevronRight size={16} />
            </motion.button>
          </motion.div>
        )}

        {/* ── Ready ── */}
        {step === "ready" && (
          <motion.div
            key="ready"
            className="flex flex-col items-center justify-center flex-1 px-8 text-center gap-6"
            initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="absolute inset-0 pointer-events-none" style={{
              background: "radial-gradient(ellipse at 50% 40%, rgba(59,181,240,0.12) 0%, transparent 65%)",
            }} />

            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
              className="w-24 h-24 rounded-3xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #3BB5F0, #0EA5E9)", boxShadow: "0 0 40px rgba(59,181,240,0.4)" }}
            >
              <span style={{ fontSize: 48 }}>
                {roles.find((r) => r.id === selectedRole)?.emoji ?? "🏠"}
              </span>
            </motion.div>

            <div>
              <p className="text-2xl" style={{ color: "#EEF2FF", fontWeight: 800 }}>You're all set!</p>
              <p className="text-sm mt-1" style={{ color: "#7C9CC0" }}>
                Welcome to Choremaxx,{" "}
                <span style={{ color: "#3BB5F0", fontWeight: 600 }}>
                  {roles.find((r) => r.id === selectedRole)?.title ?? "Parent"}
                </span>
              </p>
            </div>

            <motion.button
              className="w-full py-4 rounded-3xl text-base"
              style={{ background: "linear-gradient(135deg, #3BB5F0, #0EA5E9)", fontWeight: 700, color: "#fff", boxShadow: "0 8px 24px rgba(59,181,240,0.35)" }}
              whileTap={{ scale: 0.97 }}
              onClick={handleComplete}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              Enter Choremaxx →
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

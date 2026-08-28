import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Check, Bell, Shield, ChevronRight, Pencil, Moon, Zap } from "lucide-react";
import { ACCENT_THEMES, type Member } from "../data/gameData";

const AVATAR_EMOJIS = ["👩","👨","🌟","🦋","🌙","⭐","🦊","🐬","🌺","🎯","🚀","🎸","🌈","🦁","🐧","🎨"];

interface AdminScreenProps {
  open: boolean;
  onClose: () => void;
  householdName: string;
  onHouseholdNameChange: (name: string) => void;
  accentThemeId: string;
  onThemeChange: (id: string) => void;
  members: Member[];
  onAvatarChange: (memberId: string, emoji: string) => void;
}

export function AdminScreen({
  open, onClose, householdName, onHouseholdNameChange, accentThemeId, onThemeChange, members, onAvatarChange,
}: AdminScreenProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(householdName);
  const [pickingAvatarFor, setPickingAvatarFor] = useState<string | null>(null);
  const [notifications, setNotifications] = useState({ tasks: true, homework: true, momentum: false, nova: true });
  const [section, setSection] = useState<"main" | "members" | "notifications">("main");

  const saveHouseholdName = () => {
    if (nameInput.trim()) onHouseholdNameChange(nameInput.trim());
    setEditingName(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="absolute inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 z-50 rounded-t-3xl flex flex-col"
            style={{
              background: "#0A1525",
              border: "1px solid rgba(255,255,255,0.1)",
              borderBottom: "none",
              maxHeight: "92%",
            }}
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 40 }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
              {section !== "main" ? (
                <button onClick={() => setSection("main")} className="flex items-center gap-2">
                  <span style={{ color: "#38BDF8", fontSize: 18 }}>‹</span>
                  <span className="text-sm" style={{ color: "#38BDF8", fontWeight: 600 }}>Back</span>
                </button>
              ) : (
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #38BDF8, #0EA5E9)" }}>
                    <Zap size={16} color="#070D1C" />
                  </div>
                  <h2 className="text-lg" style={{ color: "#EEF2FF", fontWeight: 700 }}>Settings</h2>
                </div>
              )}
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
                <X size={16} color="#7C9CC0" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-8" style={{ scrollbarWidth: "none" }}>
              <AnimatePresence mode="wait">

                {/* MAIN section */}
                {section === "main" && (
                  <motion.div key="main" className="flex flex-col gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

                    {/* Household name */}
                    <SectionCard title="Household">
                      <div className="flex items-center justify-between">
                        {editingName ? (
                          <input
                            className="flex-1 bg-transparent text-base outline-none mr-3"
                            style={{ color: "#EEF2FF", fontWeight: 600, borderBottom: "1px solid rgba(56,189,248,0.4)" }}
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && saveHouseholdName()}
                            autoFocus
                          />
                        ) : (
                          <span className="text-base" style={{ color: "#EEF2FF", fontWeight: 600 }}>{householdName}</span>
                        )}
                        <button
                          className="w-8 h-8 rounded-xl flex items-center justify-center"
                          style={{ background: "rgba(56,189,248,0.12)" }}
                          onClick={editingName ? saveHouseholdName : () => { setEditingName(true); setNameInput(householdName); }}
                        >
                          {editingName ? <Check size={14} color="#34D399" /> : <Pencil size={14} color="#38BDF8" />}
                        </button>
                      </div>
                    </SectionCard>

                    {/* Theme / Accent */}
                    <SectionCard title="App Theme">
                      <div className="flex gap-3 flex-wrap">
                        {ACCENT_THEMES.map((theme) => (
                          <button
                            key={theme.id}
                            className="flex flex-col items-center gap-1.5"
                            onClick={() => onThemeChange(theme.id)}
                          >
                            <div
                              className="w-12 h-12 rounded-2xl relative"
                              style={{
                                background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
                                border: accentThemeId === theme.id ? `2px solid ${theme.primary}` : "2px solid transparent",
                                boxShadow: accentThemeId === theme.id ? `0 0 14px ${theme.primary}55` : "none",
                              }}
                            >
                              {accentThemeId === theme.id && (
                                <div className="absolute inset-0 rounded-2xl flex items-center justify-center">
                                  <Check size={16} color="#fff" strokeWidth={3} />
                                </div>
                              )}
                            </div>
                            <span className="text-xs" style={{ color: accentThemeId === theme.id ? theme.primary : "#4B6080", fontWeight: accentThemeId === theme.id ? 600 : 400 }}>
                              {theme.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </SectionCard>

                    {/* Members shortcut */}
                    <SettingsRow
                      icon="👥" label="Manage Members"
                      subtitle={`${members.length} family members`}
                      onPress={() => setSection("members")}
                    />

                    {/* Notifications shortcut */}
                    <SettingsRow
                      icon={<Bell size={16} color="#A78BFA" />} label="Notifications"
                      subtitle="4 alerts enabled"
                      onPress={() => setSection("notifications")}
                    />

                    {/* Privacy */}
                    <SettingsRow
                      icon={<Shield size={16} color="#34D399" />} label="Privacy & Data"
                      subtitle="Manage your data"
                      onPress={() => {}}
                    />

                    {/* Appearance */}
                    <SectionCard title="Appearance">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Moon size={16} color="#A78BFA" />
                          <span className="text-sm" style={{ color: "#EEF2FF" }}>Dark Mode</span>
                        </div>
                        <div
                          className="w-12 h-7 rounded-full flex items-center px-1"
                          style={{ background: "linear-gradient(135deg, #38BDF8, #0EA5E9)" }}
                        >
                          <div className="w-5 h-5 rounded-full bg-white ml-auto" />
                        </div>
                      </div>
                    </SectionCard>

                    {/* App version */}
                    <div className="flex flex-col items-center gap-1 pt-2 pb-4">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #38BDF8, #0EA5E9)" }}>
                        <span style={{ fontSize: 20 }}>🏠</span>
                      </div>
                      <span className="text-sm" style={{ color: "#EEF2FF", fontWeight: 700 }}>Orbit</span>
                      <span className="text-xs" style={{ color: "#4B6080" }}>Version 1.0.0 · AI Household OS</span>
                    </div>
                  </motion.div>
                )}

                {/* MEMBERS section */}
                {section === "members" && (
                  <motion.div key="members" className="flex flex-col gap-3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                    <p className="text-sm pt-1" style={{ color: "#7C9CC0" }}>Tap an avatar to customize it</p>
                    {members.map((m) => (
                      <div key={m.id} className="rounded-3xl p-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div className="flex items-center gap-4">
                          <button
                            className="w-14 h-14 rounded-full flex items-center justify-center text-2xl relative"
                            style={{ background: m.gradient, border: `2px solid ${m.color}66`, fontSize: 28 }}
                            onClick={() => setPickingAvatarFor(pickingAvatarFor === m.id ? null : m.id)}
                          >
                            {m.avatarEmoji}
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#0A1525", border: "1px solid rgba(255,255,255,0.1)" }}>
                              <Pencil size={10} color="#38BDF8" />
                            </div>
                          </button>
                          <div>
                            <p className="text-sm" style={{ color: "#EEF2FF", fontWeight: 600 }}>{m.name}</p>
                            <p className="text-xs" style={{ color: "#4B6080" }}>{m.role}</p>
                            <p className="text-xs mt-0.5" style={{ color: m.color, fontWeight: 600 }}>{m.xp} XP total</p>
                          </div>
                        </div>
                        <AnimatePresence>
                          {pickingAvatarFor === m.id && (
                            <motion.div
                              className="mt-4"
                              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                            >
                              <p className="text-xs mb-2" style={{ color: "#7C9CC0" }}>Choose avatar</p>
                              <div className="flex flex-wrap gap-2">
                                {AVATAR_EMOJIS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                                    style={{
                                      background: m.avatarEmoji === emoji ? `${m.color}22` : "rgba(255,255,255,0.06)",
                                      border: `1px solid ${m.avatarEmoji === emoji ? m.color + "55" : "rgba(255,255,255,0.08)"}`,
                                      fontSize: 22,
                                    }}
                                    onClick={() => { onAvatarChange(m.id, emoji); setPickingAvatarFor(null); }}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </motion.div>
                )}

                {/* NOTIFICATIONS section */}
                {section === "notifications" && (
                  <motion.div key="notifs" className="flex flex-col gap-3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                    {(Object.entries(notifications) as [keyof typeof notifications, boolean][]).map(([key, val]) => {
                      const labels: Record<string, { label: string; sub: string; emoji: string }> = {
                        tasks:    { label: "Task Reminders",    sub: "Get nudged before tasks are due",        emoji: "✅" },
                        homework: { label: "Homework Alerts",   sub: "Reminders for kids' assignments",       emoji: "📚" },
                        momentum: { label: "Momentum Updates",  sub: "Daily household health summary",        emoji: "🔥" },
                        nova:     { label: "Nova Messages",     sub: "AI insights and household briefings",   emoji: "🤖" },
                      };
                      const info = labels[key];
                      return (
                        <div key={key} className="flex items-center gap-4 rounded-3xl p-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <span style={{ fontSize: 22 }}>{info.emoji}</span>
                          <div className="flex-1">
                            <p className="text-sm" style={{ color: "#EEF2FF", fontWeight: 600 }}>{info.label}</p>
                            <p className="text-xs" style={{ color: "#4B6080" }}>{info.sub}</p>
                          </div>
                          <button
                            className="w-12 h-7 rounded-full flex items-center px-1 transition-all"
                            style={{ background: val ? "linear-gradient(135deg, #38BDF8, #0EA5E9)" : "rgba(255,255,255,0.1)" }}
                            onClick={() => setNotifications((n) => ({ ...n, [key]: !n[key] }))}
                          >
                            <motion.div
                              className="w-5 h-5 rounded-full bg-white"
                              animate={{ x: val ? 20 : 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl p-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <p className="text-xs mb-3" style={{ color: "#7C9CC0", fontWeight: 600, letterSpacing: "0.05em" }}>{title.toUpperCase()}</p>
      {children}
    </div>
  );
}

function SettingsRow({ icon, label, subtitle, onPress }: { icon: React.ReactNode | string; label: string; subtitle: string; onPress: () => void }) {
  return (
    <button
      className="w-full flex items-center gap-4 rounded-3xl p-4"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
      onClick={onPress}
    >
      <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
        {typeof icon === "string" ? <span style={{ fontSize: 18 }}>{icon}</span> : icon}
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm" style={{ color: "#EEF2FF", fontWeight: 600 }}>{label}</p>
        <p className="text-xs" style={{ color: "#4B6080" }}>{subtitle}</p>
      </div>
      <ChevronRight size={16} color="#4B6080" />
    </button>
  );
}

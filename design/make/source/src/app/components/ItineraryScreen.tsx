import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MapPin, Clock, Navigation, ChevronRight, Sparkles, Zap, Route,
  Plus, X, ShoppingCart, Dumbbell, GraduationCap, Home, Star,
  Coffee, Car, Package, ChevronDown, Edit3, Trash2, Check
} from "lucide-react";
import { SMART_TRIPS, type SmartTrip } from "../data/calendarData";
import { NovaOrb } from "./NovaOrb";

// ─── Types ───────────────────────────────────────────────────────────────────

type PlaceCategory = "grocery" | "activity" | "school" | "home" | "cafe" | "pickup" | "other";

interface Place {
  id: string;
  name: string;
  address: string;
  category: PlaceCategory;
  emoji: string;
  pickupItems: string[];
  isFavorite: boolean;
}

// ─── Category config ─────────────────────────────────────────────────────────

const CATEGORIES: { id: PlaceCategory; label: string; icon: typeof MapPin; color: string; emoji: string }[] = [
  { id: "grocery",  label: "Grocery",  icon: ShoppingCart,  color: "#34D399", emoji: "🛒" },
  { id: "activity", label: "Activity", icon: Dumbbell,      color: "#F59E0B", emoji: "⚽" },
  { id: "school",   label: "School",   icon: GraduationCap, color: "#A78BFA", emoji: "🏫" },
  { id: "home",     label: "Home",     icon: Home,           color: "#38BDF8", emoji: "🏠" },
  { id: "cafe",     label: "Café",     icon: Coffee,         color: "#FB923C", emoji: "☕" },
  { id: "pickup",   label: "Pickup",   icon: Package,        color: "#EC4899", emoji: "📦" },
  { id: "other",    label: "Other",    icon: MapPin,         color: "#7C9CC0", emoji: "📍" },
];

const getCat = (id: PlaceCategory) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[6];

// ─── Default places ───────────────────────────────────────────────────────────

const DEFAULT_PLACES: Place[] = [
  {
    id: "p1", name: "Whole Foods Market", address: "850 Main St", category: "grocery",
    emoji: "🛒", pickupItems: ["Almond milk", "Organic apples"], isFavorite: true,
  },
  {
    id: "p2", name: "Lincoln Soccer Field", address: "2200 Park Ave", category: "activity",
    emoji: "⚽", pickupItems: [], isFavorite: true,
  },
  {
    id: "p3", name: "Riverside Elementary", address: "450 Oak Lane", category: "school",
    emoji: "🏫", pickupItems: [], isFavorite: true,
  },
  {
    id: "p4", name: "Target", address: "1400 Commerce Blvd", category: "grocery",
    emoji: "🎯", pickupItems: ["Toothpaste", "Paper towels"], isFavorite: false,
  },
];

// ─── Glass helpers ────────────────────────────────────────────────────────────

const glass = (alpha = 0.07) =>
  `rgba(255,255,255,${alpha})`;
const glassBorder = (alpha = 0.12) =>
  `1px solid rgba(255,255,255,${alpha})`;

// ─── Add Place Sheet ──────────────────────────────────────────────────────────

function AddPlaceSheet({
  onClose, onAdd,
}: {
  onClose: () => void;
  onAdd: (p: Place) => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [category, setCategory] = useState<PlaceCategory>("grocery");
  const [itemInput, setItemInput] = useState("");
  const [pickupItems, setPickupItems] = useState<string[]>([]);

  const cat = getCat(category);

  const addItem = () => {
    const v = itemInput.trim();
    if (v) { setPickupItems((p) => [...p, v]); setItemInput(""); }
  };

  const submit = () => {
    if (!name.trim()) return;
    onAdd({
      id: `p-${Date.now()}`,
      name: name.trim(),
      address: address.trim() || "No address",
      category,
      emoji: cat.emoji,
      pickupItems,
      isFavorite: false,
    });
    onClose();
  };

  return (
    <motion.div
      className="absolute inset-0 z-40 flex flex-col justify-end"
      style={{ background: "rgba(3,8,16,0.7)", backdropFilter: "blur(8px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="rounded-t-3xl flex flex-col overflow-hidden"
        style={{
          background: "linear-gradient(160deg, rgba(15,26,48,0.98) 0%, rgba(7,13,28,0.98) 100%)",
          border: glassBorder(0.15),
          borderBottom: "none",
          backdropFilter: "blur(40px)",
          maxHeight: "85%",
        }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: glass(0.2) }} />
        </div>

        <div className="px-5 pb-6 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-5 pt-1">
            <h2 className="text-lg" style={{ color: "#EEF2FF", fontWeight: 700 }}>Add a Place</h2>
            <button className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: glass(0.08) }} onClick={onClose}>
              <X size={16} color="#7C9CC0" />
            </button>
          </div>

          {/* Category picker */}
          <p className="text-xs mb-2" style={{ color: "#4B6080", fontWeight: 600, letterSpacing: "0.06em" }}>CATEGORY</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {CATEGORIES.map((c) => {
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl"
                  style={{
                    background: active ? `${c.color}20` : glass(0.05),
                    border: active ? `1px solid ${c.color}44` : glassBorder(0.08),
                    color: active ? c.color : "#4B6080",
                    fontWeight: active ? 700 : 400,
                    fontSize: 12,
                    transition: "all 0.15s",
                  }}
                  onClick={() => setCategory(c.id)}
                >
                  <span>{c.emoji}</span>
                  {c.label}
                </button>
              );
            })}
          </div>

          {/* Name */}
          <p className="text-xs mb-1.5" style={{ color: "#4B6080", fontWeight: 600, letterSpacing: "0.06em" }}>PLACE NAME</p>
          <input
            className="w-full px-4 py-3 rounded-2xl mb-4 text-sm outline-none"
            style={{
              background: glass(0.06),
              border: glassBorder(0.1),
              color: "#EEF2FF",
              caretColor: cat.color,
            }}
            placeholder={`e.g. ${cat.id === "grocery" ? "Whole Foods" : cat.id === "activity" ? "Lincoln Soccer Field" : "Riverside Elementary"}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          {/* Address */}
          <p className="text-xs mb-1.5" style={{ color: "#4B6080", fontWeight: 600, letterSpacing: "0.06em" }}>ADDRESS (optional)</p>
          <input
            className="w-full px-4 py-3 rounded-2xl mb-4 text-sm outline-none"
            style={{
              background: glass(0.06),
              border: glassBorder(0.1),
              color: "#EEF2FF",
              caretColor: cat.color,
            }}
            placeholder="123 Main St, City"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />

          {/* Pickup items */}
          <p className="text-xs mb-1.5" style={{ color: "#4B6080", fontWeight: 600, letterSpacing: "0.06em" }}>ITEMS TO PICK UP (optional)</p>
          <div className="flex gap-2 mb-2">
            <input
              className="flex-1 px-4 py-3 rounded-2xl text-sm outline-none"
              style={{
                background: glass(0.06),
                border: glassBorder(0.1),
                color: "#EEF2FF",
                caretColor: cat.color,
              }}
              placeholder="e.g. Milk, Bread…"
              value={itemInput}
              onChange={(e) => setItemInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
            />
            <button
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${cat.color}22`, border: `1px solid ${cat.color}33` }}
              onClick={addItem}
            >
              <Plus size={18} color={cat.color} />
            </button>
          </div>
          {pickupItems.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {pickupItems.map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                  style={{ background: `${cat.color}18`, border: `1px solid ${cat.color}30` }}>
                  <span style={{ fontSize: 12, color: cat.color }}>{item}</span>
                  <button onClick={() => setPickupItems((p) => p.filter((_, j) => j !== i))}>
                    <X size={11} color={cat.color} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Nova hint */}
          <div className="rounded-2xl p-3 mb-5"
            style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.18)" }}>
            <div className="flex items-start gap-2">
              <Sparkles size={13} color="#06B6D4" className="flex-shrink-0 mt-0.5" />
              <p className="text-xs" style={{ color: "#7C9CC0", lineHeight: 1.5 }}>
                <span style={{ color: "#06B6D4", fontWeight: 700 }}>Nova uses this</span> to bundle errands, suggest pickup reminders, and build smart itineraries around your schedule.
              </p>
            </div>
          </div>

          <button
            className="w-full py-4 rounded-3xl text-sm"
            style={{
              background: name.trim() ? `linear-gradient(135deg, ${cat.color}, ${cat.color}BB)` : glass(0.08),
              color: name.trim() ? "#070D1C" : "#4B6080",
              fontWeight: 700,
              transition: "all 0.2s",
            }}
            onClick={submit}
          >
            Save Place
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Place card ───────────────────────────────────────────────────────────────

function PlaceCard({ place, onDelete, onToggleFav, onAddItem }: {
  place: Place;
  onDelete: () => void;
  onToggleFav: () => void;
  onAddItem: (item: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [itemInput, setItemInput] = useState("");
  const cat = getCat(place.category);

  const submit = () => {
    const v = itemInput.trim();
    if (v) { onAddItem(v); setItemInput(""); }
  };

  return (
    <motion.div
      className="rounded-2xl overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${glass(0.07)} 0%, ${glass(0.04)} 100%)`,
        border: glassBorder(expanded ? 0.16 : 0.1),
        backdropFilter: "blur(20px)",
        boxShadow: expanded ? `0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 ${glass(0.12)}` : `0 2px 12px rgba(0,0,0,0.2), inset 0 1px 0 ${glass(0.08)}`,
      }}
      layout
      transition={{ layout: { duration: 0.3, ease: "easeInOut" } }}
    >
      <button className="w-full px-4 py-3 text-left" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${cat.color}28, ${cat.color}14)`,
              border: `1px solid ${cat.color}30`,
              backdropFilter: "blur(8px)",
              fontSize: 18,
            }}>
            {place.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate" style={{ color: "#EEF2FF", fontWeight: 600 }}>{place.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin size={9} color="#4B6080" />
              <span className="text-xs truncate" style={{ color: "#4B6080" }}>{place.address}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {place.pickupItems.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                style={{ background: "rgba(236,72,153,0.15)", border: "1px solid rgba(236,72,153,0.25)" }}>
                <ShoppingCart size={9} color="#EC4899" />
                <span style={{ fontSize: 9, color: "#EC4899", fontWeight: 700 }}>{place.pickupItems.length}</span>
              </div>
            )}
            <button
              className="w-6 h-6 flex items-center justify-center"
              onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
            >
              <Star size={13} color={place.isFavorite ? "#F59E0B" : "#4B6080"} fill={place.isFavorite ? "#F59E0B" : "none"} />
            </button>
            <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={14} color="#4B6080" />
            </motion.div>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              <div className="h-px mb-3" style={{ background: glassBorder(0.08).replace("1px solid ", "") }} />

              {/* Category badge */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <cat.icon size={11} color={cat.color} />
                  <span className="text-xs" style={{ color: cat.color, fontWeight: 600 }}>{cat.label}</span>
                </div>
                <button
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)" }}
                  onClick={onDelete}
                >
                  <Trash2 size={10} color="#EF4444" />
                  <span style={{ fontSize: 10, color: "#EF4444", fontWeight: 600 }}>Remove</span>
                </button>
              </div>

              {/* Pickup items */}
              <p className="text-xs mb-2" style={{ color: "#4B6080", fontWeight: 600, letterSpacing: "0.05em" }}>PICKUP LIST</p>
              {place.pickupItems.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-3">
                  {place.pickupItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                      style={{ background: "rgba(236,72,153,0.12)", border: "1px solid rgba(236,72,153,0.22)" }}>
                      <span style={{ fontSize: 11, color: "#F0ABFC" }}>{item}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs mb-3" style={{ color: "#2A3A54" }}>No items yet — Nova will remind you when passing by.</p>
              )}

              {/* Add item inline */}
              <div className="flex gap-2">
                <input
                  className="flex-1 px-3 py-2 rounded-xl text-xs outline-none"
                  style={{
                    background: glass(0.05),
                    border: glassBorder(0.08),
                    color: "#EEF2FF",
                    caretColor: cat.color,
                  }}
                  placeholder="Add item to pick up…"
                  value={itemInput}
                  onChange={(e) => setItemInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />
                <button
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${cat.color}20`, border: `1px solid ${cat.color}30` }}
                  onClick={submit}
                >
                  <Plus size={14} color={cat.color} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Route visualization ──────────────────────────────────────────────────────

function RouteVisualization({ trip, active }: { trip: SmartTrip; active: boolean }) {
  return (
    <div className="relative">
      <div className="relative flex flex-col">
        {trip.stops.map((stop, i) => {
          const isLast = i === trip.stops.length - 1;
          return (
            <div key={stop.id} className="flex gap-4">
              <div className="flex flex-col items-center" style={{ width: 36 }}>
                <motion.div
                  className="w-9 h-9 rounded-2xl flex items-center justify-center text-lg flex-shrink-0 z-10"
                  style={{
                    background: active
                      ? `linear-gradient(135deg, ${trip.color}30, ${trip.color}16)`
                      : glass(0.06),
                    border: `1.5px solid ${active ? trip.color + "55" : "rgba(255,255,255,0.09)"}`,
                    backdropFilter: "blur(12px)",
                    boxShadow: active && i === 0 ? `0 0 20px ${trip.color}44, inset 0 1px 0 ${glass(0.15)}` : `inset 0 1px 0 ${glass(0.08)}`,
                    fontSize: 18,
                  }}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 + i * 0.08, type: "spring", stiffness: 300 }}
                >
                  {stop.emoji}
                </motion.div>
                {!isLast && (
                  <div className="flex flex-col items-center flex-1 py-1 gap-1">
                    {[0, 1, 2].map((d) => (
                      <motion.div
                        key={d}
                        className="w-0.5 rounded-full"
                        style={{ height: 5, background: active ? trip.color + "99" : "rgba(255,255,255,0.1)" }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 + i * 0.08 + d * 0.03 }}
                      />
                    ))}
                    <div className="px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(0,0,0,0.35)", border: glassBorder(0.07), backdropFilter: "blur(8px)" }}>
                      <span style={{ fontSize: 9, color: "#4B6080", fontWeight: 600 }}>{stop.driveMinutes}m</span>
                    </div>
                    {[0, 1, 2].map((d) => (
                      <motion.div
                        key={d}
                        className="w-0.5 rounded-full"
                        style={{ height: 5, background: active ? trip.color + "99" : "rgba(255,255,255,0.1)" }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.25 + i * 0.08 + d * 0.03 }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1 pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm" style={{ color: "#EEF2FF", fontWeight: 600 }}>{stop.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <MapPin size={10} color="#4B6080" />
                      <span className="text-xs" style={{ color: "#4B6080" }}>{stop.address}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: `${trip.color}18`, color: trip.color, fontWeight: 700, fontSize: 10, backdropFilter: "blur(8px)" }}>
                      {stop.category}
                    </span>
                    <div className="flex items-center gap-1">
                      <Clock size={10} color="#4B6080" />
                      <span className="text-xs" style={{ color: "#7C9CC0" }}>~{stop.estimatedMinutes}m</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Trip card ────────────────────────────────────────────────────────────────

function TripCard({ trip, index }: { trip: SmartTrip; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);
  const [activated, setActivated] = useState(false);

  return (
    <motion.div
      className="rounded-3xl overflow-hidden"
      style={{
        background: expanded
          ? `linear-gradient(160deg, ${trip.color}14 0%, ${glass(0.05)} 100%)`
          : glass(0.05),
        border: `1px solid ${expanded ? trip.color + "30" : "rgba(255,255,255,0.09)"}`,
        backdropFilter: "blur(24px)",
        boxShadow: expanded
          ? `0 12px 40px rgba(0,0,0,0.35), inset 0 1px 0 ${glass(0.14)}, 0 0 0 0.5px ${trip.color}20`
          : `0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 ${glass(0.08)}`,
      }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
    >
      <button className="w-full px-4 pt-4 pb-3 text-left" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${trip.color}28, ${trip.color}12)`,
              border: `1px solid ${trip.color}30`,
              backdropFilter: "blur(12px)",
              boxShadow: `inset 0 1px 0 ${glass(0.15)}`,
            }}>
            <Route size={18} color={trip.color} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm" style={{ color: "#EEF2FF", fontWeight: 700 }}>{trip.title}</p>
            <p className="text-xs mt-0.5" style={{ color: trip.color, fontWeight: 600 }}>{trip.dayLabel}</p>
          </div>
          <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronRight size={16} color="#4B6080" />
          </motion.div>
        </div>

        <div className="flex gap-4 mt-3">
          {[
            { icon: Clock,      val: trip.totalTime,        label: "Total",       isAccent: false },
            { icon: Navigation, val: trip.totalDistance,    label: "Distance",    isAccent: false },
            { icon: Zap,        val: `Save ${trip.savedTime}`, label: "vs. separate", isAccent: true },
          ].map(({ icon: Icon, val, label, isAccent }) => (
            <div key={label} className="flex items-center gap-1.5">
              <Icon size={12} color={isAccent ? "#34D399" : "#4B6080"} />
              <div>
                <p className="text-xs" style={{ color: isAccent ? "#34D399" : "#EEF2FF", fontWeight: 700, lineHeight: 1 }}>{val}</p>
                <p style={{ fontSize: 9, color: "#4B6080" }}>{label}</p>
              </div>
            </div>
          ))}
          <div className="ml-auto">
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "rgba(52,211,153,0.12)", color: "#34D399", fontWeight: 700, fontSize: 10, backdropFilter: "blur(8px)" }}>
              {trip.stops.length} stops
            </span>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              <div className="rounded-2xl p-3 mb-4"
                style={{
                  background: "linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(6,182,212,0.05) 100%)",
                  border: "1px solid rgba(6,182,212,0.2)",
                  backdropFilter: "blur(12px)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                }}>
                <div className="flex items-start gap-2">
                  <Sparkles size={13} color="#06B6D4" className="flex-shrink-0 mt-0.5" />
                  <p className="text-xs" style={{ color: "#C8D8F0", lineHeight: 1.5 }}>
                    <span style={{ color: "#06B6D4", fontWeight: 700 }}>Nova: </span>
                    {trip.novaReason}
                  </p>
                </div>
              </div>

              <RouteVisualization trip={trip} active={!activated} />

              <div className="flex gap-2 mt-4">
                <motion.button
                  className="flex-1 py-3.5 rounded-3xl flex items-center justify-center gap-2"
                  style={{
                    background: activated
                      ? "rgba(52,211,153,0.14)"
                      : `linear-gradient(135deg, ${trip.color}, ${trip.color}CC)`,
                    border: activated ? "1px solid rgba(52,211,153,0.28)" : `1px solid ${trip.color}66`,
                    backdropFilter: "blur(12px)",
                    boxShadow: activated ? "none" : `0 4px 20px ${trip.color}44`,
                  }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setActivated(true)}
                >
                  {activated ? (
                    <>
                      <Check size={15} color="#34D399" />
                      <span className="text-sm" style={{ color: "#34D399", fontWeight: 700 }}>Trip Activated</span>
                    </>
                  ) : (
                    <>
                      <Navigation size={16} color="#070D1C" />
                      <span className="text-sm" style={{ color: "#070D1C", fontWeight: 700 }}>Start Trip in Maps</span>
                    </>
                  )}
                </motion.button>
                <button
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{
                    background: glass(0.07),
                    border: glassBorder(0.1),
                    backdropFilter: "blur(12px)",
                    boxShadow: `inset 0 1px 0 ${glass(0.1)}`,
                  }}
                >
                  <span style={{ fontSize: 16 }}>📋</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

type Section = "trips" | "places";

export function ItineraryScreen() {
  const [section, setSection] = useState<Section>("trips");
  const [places, setPlaces] = useState<Place[]>(DEFAULT_PLACES);
  const [addOpen, setAddOpen] = useState(false);
  const [filterCat, setFilterCat] = useState<PlaceCategory | "all">("all");

  const addPlace = (p: Place) => setPlaces((prev) => [...prev, p]);
  const deletePlace = (id: string) => setPlaces((prev) => prev.filter((p) => p.id !== id));
  const toggleFav = (id: string) => setPlaces((prev) => prev.map((p) => p.id === id ? { ...p, isFavorite: !p.isFavorite } : p));
  const addItem = (placeId: string, item: string) =>
    setPlaces((prev) => prev.map((p) => p.id === placeId ? { ...p, pickupItems: [...p.pickupItems, item] } : p));

  const filtered = places.filter((p) => filterCat === "all" || p.category === filterCat);
  const totalPickups = places.reduce((acc, p) => acc + p.pickupItems.length, 0);

  return (
    <div className="flex flex-col h-full relative">
      {/* Section toggle */}
      <div className="px-4 pb-3 flex-shrink-0">
        <div className="flex rounded-2xl p-1"
          style={{
            background: glass(0.05),
            border: glassBorder(0.09),
            backdropFilter: "blur(16px)",
          }}>
          {(["trips", "places"] as Section[]).map((s) => (
            <button
              key={s}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl"
              style={{
                background: section === s
                  ? `linear-gradient(135deg, ${s === "trips" ? "rgba(56,189,248,0.18)" : "rgba(167,139,250,0.18)"}, ${glass(0.08)})`
                  : "transparent",
                border: section === s
                  ? `1px solid ${s === "trips" ? "rgba(56,189,248,0.3)" : "rgba(167,139,250,0.3)"}`
                  : "1px solid transparent",
                color: section === s ? (s === "trips" ? "#38BDF8" : "#A78BFA") : "#4B6080",
                fontWeight: section === s ? 700 : 400,
                backdropFilter: section === s ? "blur(8px)" : "none",
                boxShadow: section === s ? `inset 0 1px 0 ${glass(0.12)}` : "none",
                transition: "all 0.2s",
              }}
              onClick={() => setSection(s)}
            >
              {s === "trips" ? <Route size={13} /> : <MapPin size={13} />}
              <span className="text-sm">{s === "trips" ? "Smart Trips" : "My Places"}</span>
              {s === "places" && totalPickups > 0 && (
                <div className="w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: "#EC4899", fontSize: 9, color: "#fff", fontWeight: 800 }}>
                  {totalPickups}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6" style={{ scrollbarWidth: "none" }}>
        <AnimatePresence mode="wait">
          {section === "trips" ? (
            <motion.div key="trips" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
              {/* Nova hero */}
              <motion.div
                className="rounded-3xl p-4 relative overflow-hidden mb-4"
                style={{
                  background: "linear-gradient(135deg, rgba(6,182,212,0.14) 0%, rgba(56,189,248,0.07) 60%, rgba(129,140,248,0.07) 100%)",
                  border: "1px solid rgba(56,189,248,0.22)",
                  backdropFilter: "blur(28px)",
                  boxShadow: `0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 ${glass(0.12)}`,
                }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Glow orb bg */}
                <div className="absolute pointer-events-none"
                  style={{ top: -60, right: -40, width: 180, height: 180, background: "radial-gradient(circle, rgba(56,189,248,0.1) 0%, transparent 70%)" }} />
                <div className="absolute pointer-events-none"
                  style={{ bottom: -40, left: -20, width: 140, height: 140, background: "radial-gradient(circle, rgba(129,140,248,0.08) 0%, transparent 70%)" }} />

                <div className="flex items-start gap-4 relative">
                  <div className="flex-shrink-0"><NovaOrb size={52} /></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#34D399", boxShadow: "0 0 6px #34D399" }} />
                      <span className="text-xs" style={{ color: "#34D399", fontWeight: 700, letterSpacing: "0.06em" }}>NOVA SMART ROUTING</span>
                    </div>
                    <p className="text-sm" style={{ color: "#C8D8F0", lineHeight: 1.5 }}>
                      I've analysed your upcoming tasks and errands. I've bundled{" "}
                      <span style={{ color: "#38BDF8", fontWeight: 700 }}>3 optimised trips</span> that save you{" "}
                      <span style={{ color: "#34D399", fontWeight: 700 }}>2h 07m</span> this week.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 mt-4 relative">
                  {[
                    { val: "3",      label: "Smart trips",   color: "#38BDF8" },
                    { val: "2h 07m", label: "Time saved",    color: "#34D399" },
                    { val: "10",     label: "Stops bundled", color: "#A78BFA" },
                  ].map((s) => (
                    <div key={s.label} className="flex-1 rounded-2xl py-2.5 px-2 text-center"
                      style={{
                        background: "rgba(0,0,0,0.25)",
                        border: glassBorder(0.08),
                        backdropFilter: "blur(12px)",
                        boxShadow: `inset 0 1px 0 ${glass(0.08)}`,
                      }}>
                      <p className="text-base" style={{ color: s.color, fontWeight: 800, lineHeight: 1 }}>{s.val}</p>
                      <p style={{ fontSize: 9, color: "#4B6080", marginTop: 2 }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Trip cards */}
              <div className="flex flex-col gap-3">
                {SMART_TRIPS.map((trip, i) => (
                  <TripCard key={trip.id} trip={trip} index={i} />
                ))}
              </div>

              {/* Completed archive */}
              <motion.div
                className="rounded-3xl p-4 mt-3"
                style={{
                  background: glass(0.04),
                  border: glassBorder(0.07),
                  backdropFilter: "blur(16px)",
                  boxShadow: `inset 0 1px 0 ${glass(0.06)}`,
                }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h3 className="text-sm mb-3" style={{ color: "#7C9CC0", fontWeight: 600 }}>Completed Trips</h3>
                {[
                  { title: "Monday Evening Loop",    date: "2 days ago", stops: 3, saved: "28m" },
                  { title: "Weekend Grocery Circuit", date: "5 days ago", stops: 4, saved: "52m" },
                ].map((t, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5"
                    style={{ borderTop: i > 0 ? `1px solid ${glass(0.05)}` : "none" }}>
                    <span style={{ fontSize: 16 }}>✅</span>
                    <div className="flex-1">
                      <p className="text-sm" style={{ color: "#4B6080", textDecoration: "line-through" }}>{t.title}</p>
                      <p className="text-xs" style={{ color: "#2A3A54" }}>{t.date} · {t.stops} stops</p>
                    </div>
                    <span className="text-xs" style={{ color: "#2A3A54" }}>Saved {t.saved}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>

          ) : (
            <motion.div key="places" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
              {/* Nova training card */}
              <motion.div
                className="rounded-3xl p-4 mb-4 relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, rgba(167,139,250,0.13) 0%, rgba(56,189,248,0.07) 100%)",
                  border: "1px solid rgba(167,139,250,0.22)",
                  backdropFilter: "blur(28px)",
                  boxShadow: `0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 ${glass(0.12)}`,
                }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="absolute pointer-events-none"
                  style={{ top: -50, right: -30, width: 150, height: 150, background: "radial-gradient(circle, rgba(167,139,250,0.1) 0%, transparent 70%)" }} />
                <div className="flex items-center gap-3 relative">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "linear-gradient(135deg, rgba(167,139,250,0.25), rgba(167,139,250,0.12))",
                      border: "1px solid rgba(167,139,250,0.35)",
                      backdropFilter: "blur(12px)",
                    }}>
                    <Sparkles size={18} color="#A78BFA" />
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: "#EEF2FF", fontWeight: 700 }}>Train Nova</p>
                    <p className="text-xs mt-0.5" style={{ color: "#7C9CC0", lineHeight: 1.4 }}>
                      Add your stores, schools & activities so Nova can plan optimised routes and pickup reminders.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 relative">
                  {[
                    { icon: "🛒", label: "Grocery runs", color: "#34D399" },
                    { icon: "⚽", label: "School pickups", color: "#A78BFA" },
                    { icon: "📦", label: "Errand bundles", color: "#F59E0B" },
                  ].map((s) => (
                    <div key={s.label} className="flex-1 rounded-xl py-2 px-1.5 text-center"
                      style={{
                        background: "rgba(0,0,0,0.22)",
                        border: glassBorder(0.07),
                        backdropFilter: "blur(8px)",
                      }}>
                      <div style={{ fontSize: 16 }}>{s.icon}</div>
                      <p style={{ fontSize: 9, color: s.color, fontWeight: 600, marginTop: 3 }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Category filter chips */}
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                <button
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs"
                  style={{
                    background: filterCat === "all" ? "rgba(56,189,248,0.18)" : glass(0.05),
                    border: filterCat === "all" ? "1px solid rgba(56,189,248,0.3)" : glassBorder(0.08),
                    color: filterCat === "all" ? "#38BDF8" : "#4B6080",
                    fontWeight: filterCat === "all" ? 700 : 400,
                    backdropFilter: "blur(8px)",
                    transition: "all 0.15s",
                  }}
                  onClick={() => setFilterCat("all")}
                >
                  All ({places.length})
                </button>
                {CATEGORIES.filter((c) => places.some((p) => p.category === c.id)).map((c) => {
                  const count = places.filter((p) => p.category === c.id).length;
                  const active = filterCat === c.id;
                  return (
                    <button
                      key={c.id}
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
                      style={{
                        background: active ? `${c.color}1E` : glass(0.05),
                        border: active ? `1px solid ${c.color}35` : glassBorder(0.08),
                        color: active ? c.color : "#4B6080",
                        fontWeight: active ? 700 : 400,
                        backdropFilter: "blur(8px)",
                        transition: "all 0.15s",
                      }}
                      onClick={() => setFilterCat(active ? "all" : c.id)}
                    >
                      <span>{c.emoji}</span>
                      {c.label} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Places list */}
              <div className="flex flex-col gap-2.5">
                <AnimatePresence>
                  {filtered.map((place, i) => (
                    <motion.div
                      key={place.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20, height: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.22 }}
                    >
                      <PlaceCard
                        place={place}
                        onDelete={() => deletePlace(place.id)}
                        onToggleFav={() => toggleFav(place.id)}
                        onAddItem={(item) => addItem(place.id, item)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>

                {filtered.length === 0 && (
                  <div className="text-center py-10">
                    <p style={{ fontSize: 32, marginBottom: 8 }}>📍</p>
                    <p className="text-sm" style={{ color: "#4B6080" }}>No places yet</p>
                    <p className="text-xs mt-1" style={{ color: "#2A3A54" }}>Tap + Add Place to get started</p>
                  </div>
                )}
              </div>

              {/* Pickup summary */}
              {totalPickups > 0 && (
                <motion.div
                  className="rounded-3xl p-4 mt-4"
                  style={{
                    background: "linear-gradient(135deg, rgba(236,72,153,0.12), rgba(236,72,153,0.05))",
                    border: "1px solid rgba(236,72,153,0.22)",
                    backdropFilter: "blur(20px)",
                    boxShadow: `0 4px 20px rgba(0,0,0,0.2), inset 0 1px 0 ${glass(0.1)}`,
                  }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <ShoppingCart size={14} color="#EC4899" />
                    <span className="text-sm" style={{ color: "#EC4899", fontWeight: 700 }}>Pickup Summary</span>
                    <div className="ml-auto px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(236,72,153,0.2)", border: "1px solid rgba(236,72,153,0.3)" }}>
                      <span style={{ fontSize: 10, color: "#EC4899", fontWeight: 800 }}>{totalPickups} items</span>
                    </div>
                  </div>
                  {places.filter((p) => p.pickupItems.length > 0).map((p, i) => {
                    const cat = getCat(p.category);
                    return (
                      <div key={p.id} className="py-2.5"
                        style={{ borderTop: i > 0 ? `1px solid rgba(236,72,153,0.1)` : "none" }}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span style={{ fontSize: 13 }}>{p.emoji}</span>
                          <span className="text-xs" style={{ color: "#EEF2FF", fontWeight: 600 }}>{p.name}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pl-5">
                          {p.pickupItems.map((item, j) => (
                            <span key={j} className="px-2 py-0.5 rounded-full text-xs"
                              style={{ background: "rgba(236,72,153,0.12)", color: "#F0ABFC", fontWeight: 500 }}>
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* FAB — only on places tab */}
      <AnimatePresence>
        {section === "places" && (
          <motion.button
            className="absolute flex items-center gap-2 px-4 py-3 rounded-full"
            style={{
              bottom: 16,
              right: 16,
              background: "linear-gradient(135deg, #A78BFA, #7C3AED)",
              boxShadow: "0 8px 28px rgba(167,139,250,0.45), inset 0 1px 0 rgba(255,255,255,0.2)",
              border: "1px solid rgba(167,139,250,0.4)",
              backdropFilter: "blur(12px)",
            }}
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => setAddOpen(true)}
          >
            <Plus size={16} color="#fff" strokeWidth={2.5} />
            <span className="text-sm" style={{ color: "#fff", fontWeight: 700 }}>Add Place</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Add place sheet */}
      <AnimatePresence>
        {addOpen && <AddPlaceSheet onClose={() => setAddOpen(false)} onAdd={addPlace} />}
      </AnimatePresence>
    </div>
  );
}

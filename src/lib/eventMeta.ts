import type { EventType } from "../types/core.ts";

export const EVENT_DISPLAY: Record<
  EventType,
  { label: string; colourClass: string; dot: string }
> = {
  feed: {
    label: "Fed",
    colourClass: "bg-amber-50 text-amber-800",
    dot: "bg-amber-400",
  },
  walk: {
    label: "Walked",
    colourClass: "bg-green-50 text-green-800",
    dot: "bg-green-400",
  },
  toilet: {
    label: "Toilet",
    colourClass: "bg-yellow-50 text-yellow-800",
    dot: "bg-yellow-400",
  },
  meds: {
    label: "Meds",
    colourClass: "bg-rose-50 text-rose-800",
    dot: "bg-rose-400",
  },
  sick: {
    label: "Sick",
    colourClass: "bg-red-50 text-red-800",
    dot: "bg-red-400",
  },
  nap_time: {
    label: "Nap Time",
    colourClass: "bg-purple-50 text-purple-800",
    dot: "bg-purple-400",
  },
  play_time: {
    label: "Play Time",
    colourClass: "bg-blue-50 text-blue-800",
    dot: "bg-blue-400",
  },
  water: {
    label: "Water",
    colourClass: "bg-cyan-50 text-cyan-800",
    dot: "bg-cyan-400",
  },
  grooming: {
    label: "Grooming",
    colourClass: "bg-orange-50 text-orange-800",
    dot: "bg-orange-400",
  },
};

export type EventOption = {
  value: EventType;
  label: string;
  emoji: string;
  bg: string;
  border: string;
  text: string;
};

export const EVENT_OPTIONS: EventOption[] = [
  {
    value: "feed",
    label: "Fed",
    emoji: "🍖",
    bg: "#fef3c7",
    border: "#92400e",
    text: "#92400e",
  },
  {
    value: "walk",
    label: "Walked",
    emoji: "🦮",
    bg: "#d1fae5",
    border: "#065f46",
    text: "#065f46",
  },
  {
    value: "toilet",
    label: "Toilet",
    emoji: "🌿",
    bg: "#fef9c3",
    border: "#78350f",
    text: "#78350f",
  },
  {
    value: "meds",
    label: "Meds",
    emoji: "💊",
    bg: "#ffe4e6",
    border: "#9f1239",
    text: "#9f1239",
  },
  {
    value: "sick",
    label: "Sick",
    emoji: "🤒",
    bg: "#fee2e2",
    border: "#b91c1c",
    text: "#b91c1c",
  },
  {
    value: "nap_time",
    label: "Nap Time",
    emoji: "😴",
    bg: "#fce7f3",
    border: "#4c0519",
    text: "#4c0519",
  },
  {
    value: "play_time",
    label: "Play Time",
    emoji: "🎾",
    bg: "#dbeafe",
    border: "#1d4ed8",
    text: "#1d4ed8",
  },
  {
    value: "water",
    label: "Water",
    emoji: "💧",
    bg: "#cffafe",
    border: "#0e7490",
    text: "#0e7490",
  },
  {
    value: "grooming",
    label: "Grooming",
    emoji: "✂️",
    bg: "#ffedd5",
    border: "#9a3412",
    text: "#9a3412",
  },
];

export const EVENT_COLOURS: Record<
  EventType,
  { bg: string; text: string; emoji: string }
> = {
  feed: { bg: "bg-amber-50", text: "text-amber-800", emoji: "🍖" },
  walk: { bg: "bg-green-50", text: "text-green-800", emoji: "🦮" },
  toilet: { bg: "bg-yellow-50", text: "text-yellow-800", emoji: "🌿" },
  meds: { bg: "bg-rose-50", text: "text-rose-800", emoji: "💊" },
  sick: { bg: "bg-red-50", text: "text-red-800", emoji: "🤒" },
  nap_time: { bg: "bg-purple-50", text: "text-purple-800", emoji: "😴" },
  play_time: { bg: "bg-blue-50", text: "text-blue-800", emoji: "🎾" },
  water: { bg: "bg-cyan-50", text: "text-cyan-800", emoji: "💧" },
  grooming: { bg: "bg-orange-50", text: "text-orange-800", emoji: "✂️" },
};

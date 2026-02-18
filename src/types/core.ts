export type EventType = "feed" | "walk" | "toilet" | "meds";

export interface Dog {
  id: string;
  name: string;
  age?: number;
  weight?: number;
  notes?: string;
}

export interface CareEvent {
  id: string;
  dogId: string;
  type: EventType;
  timestamp: string;
  userId: string;
  note?: string;
}

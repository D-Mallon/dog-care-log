export type EventType = "feed" | "walk" | "toilet" | "meds";

export interface Dog {
  dogId: string;
  dogName: string;
  dogOwner: string;
  age?: number;
  weight?: number;
  notes?: string;
  dogImage: string;
}

export interface CareEvent {
  id: string;
  dogId: string;
  type: EventType;
  timestamp: string;
  userId: string;
  note?: string;
}

// need to refactor the dog interface so that it only have dog attributes. logging feeding etc should be moved to CareEvent

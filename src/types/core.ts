export type EventType = "feed" | "walk" | "toilet" | "meds";

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  createdBy: string;
  createdAt?: string;
}

export interface HouseholdMember {
  householdId: string;
  userId: string;
  role: "owner" | "member";
  status: "active" | "pending";
  joinedAt?: string;
}

export interface Dog {
  dogId: string;
  dogName: string;
  householdId: string;
  age?: number;
  weight?: number;
  notes?: string;
  dogImage: string;
}

export interface WeightLog {
  id: string;
  dogId: string;
  weight: number;
  recordedAt: string;
}

export interface CareEvent {
  id: string;
  dogId: string;
  type: EventType;
  timestamp: string;
  userId: string;
  note?: string;
}

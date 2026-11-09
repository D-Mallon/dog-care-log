export type EventType =
  | "feed"
  | "walk"
  | "toilet"
  | "meds"
  | "sick"
  | "nap_time"
  | "play_time"
  | "water"
  | "grooming";

export type DogSex = "male" | "female" | "unknown";
export type DogSize = "toy" | "small" | "medium" | "large" | "giant" | "unknown";
export type ActivityLevel = "low" | "moderate" | "high" | "very_high";
export type TrainingStage =
  | "puppy"
  | "adolescent"
  | "adult"
  | "senior"
  | "unknown";

export type PottyOutcome = "success" | "accident";
export type PottyLocation =
  | "outside"
  | "pad"
  | "indoor"
  | "crate"
  | "garden"
  | "other";
export type PottyCue = "asked" | "unprompted" | "none";

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
  displayName?: string;
}

export interface Dog {
  dogId: string;
  dogName: string;
  householdId: string;
  breed?: string;
  breedId?: string;
  sex?: DogSex;
  neutered?: boolean;
  dateOfBirth?: string;
  age?: number;
  weight?: number;
  adultWeightKg?: number;
  sizeCategory?: DogSize;
  activityLevel?: ActivityLevel;
  foodType?: string;
  feedingSchedule?: string;
  allergies?: string;
  medications?: string;
  medicalNotes?: string;
  temperamentNotes?: string;
  trainingStage?: TrainingStage;
  coatType?: string;
  notes?: string;
  dogImage: string;
}

export interface WeightLog {
  id: string;
  dogId: string;
  weight: number;
  recordedAt: string;
  userId?: string;
}

export interface CareEvent {
  id: string;
  dogId: string;
  type: EventType;
  subtype?: "pee" | "poo" | "other";
  isAccident?: boolean;
  pottyOutcome?: PottyOutcome;
  pottyLocation?: PottyLocation;
  pottyCue?: PottyCue;
  timestamp: string;
  userId: string;
  note?: string;
}

export type ScheduleRecurrence =
  | "daily"
  | "weekdays"
  | "weekends"
  | "weekly"
  | "once";

export interface CareSchedule {
  id: string;
  householdId: string;
  dogId: string;
  type: EventType;
  title: string;
  timeOfDay: string;
  recurrence: ScheduleRecurrence;
  active: boolean;
  assignedTo?: string;
  createdBy: string;
  createdAt?: string;
  startDate?: string;
  endDate?: string;
}

export interface CareTaskCompletion {
  id: string;
  scheduleId: string;
  dueDate: string;
  completedBy: string;
  completedAt: string;
  eventId?: string;
}

export interface EventReaction {
  eventId: string;
  userId: string;
  emoji: string;
  createdAt?: string;
}

export interface EventComment {
  id: string;
  eventId: string;
  userId: string;
  body: string;
  createdAt: string;
}

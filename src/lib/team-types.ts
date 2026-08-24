// Shared types used by client components. Keep in sync with team-service.serialize().

export type TeamMemberView = {
  id: string;
  role: "LEADER" | "MEMBER";
  student: {
    id: string;
    fullName: string;
    rollNumber: string;
    branch: string;
    gender: "MALE" | "FEMALE" | "OTHER";
    email: string;
    cohort: { id: string; displayName: string; batchYear: number };
  };
};

export type TeamPsView = {
  id: string;
  psNumber: string;
  title: string;
  organization: string;
  theme: string;
  category: string;
};

export type TeamView = {
  id: string;
  teamCode: string;
  teamName: string;
  status: string;
  guidelinesAcceptedAt: string | null;
  submittedAt: string | null;
  lockedAt: string | null;
  version: number;
  leader: {
    id: string;
    fullName: string;
    rollNumber: string;
    branch: string;
    gender: string;
    cohort: { id: string; displayName: string; batchYear: number };
  };
  members: TeamMemberView[];
  ps: TeamPsView | null;
};

export type ValidationView = {
  ok: boolean;
  checks: Array<{ key: string; label: string; pass: boolean; message?: string }>;
  errors: string[];
};

export type MeResponse = {
  student: {
    id: string;
    fullName: string;
    email: string;
    rollNumber: string;
    branch: string;
    cohort: { id: string; displayName: string; batchYear: number; yearOfStudy: number };
  };
  activeTeamId: string | null;
  ledTeamId: string | null;
  role: "LEADER" | "MEMBER" | null;
};

export type CohortView = { id: string; batchYear: number; displayName: string; yearOfStudy: number };

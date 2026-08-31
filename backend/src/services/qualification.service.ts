import * as qualificationRepository from "../db/qualificationRepository.js";

type QualificationQuestion = {
  id: string;
  prompt: string;
  options: string[];
};

const DEFAULT_QUESTIONS: QualificationQuestion[] = [
  {
    id: "q1",
    prompt: "What is your current role or study level?",
    options: ["School student", "University student", "Professional", "Other"],
  },
  {
    id: "q2",
    prompt: "What is your main goal with this platform?",
    options: [
      "Prepare for exams",
      "Improve general knowledge",
      "Practice daily",
      "Other",
    ],
  },
];

function normalizeQuestions(input: unknown): QualificationQuestion[] {
  if (!Array.isArray(input)) {
    throw new Error("questions must be an array");
  }
  const questions = input
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const candidate = item as {
        id?: unknown;
        prompt?: unknown;
        options?: unknown;
      };
      const id =
        typeof candidate.id === "string" && candidate.id.trim().length > 0
          ? candidate.id.trim()
          : `q${index + 1}`;
      const prompt =
        typeof candidate.prompt === "string" ? candidate.prompt.trim() : "";
      if (!prompt || !Array.isArray(candidate.options)) {
        return null;
      }
      const options = candidate.options
        .map((opt) => (typeof opt === "string" ? opt.trim() : ""))
        .filter((opt) => opt.length > 0)
        .slice(0, 10);
      if (options.length < 2) {
        return null;
      }
      return { id, prompt, options };
    })
    .filter((item): item is QualificationQuestion => item !== null);
  if (questions.length === 0) {
    throw new Error("at least one question is required");
  }
  return questions.slice(0, 30);
}

export async function getQualificationTemplate() {
  const stored = await qualificationRepository.selectQualificationTemplate();
  return {
    ok: true as const,
    questions: stored?.questions.length ? stored.questions : DEFAULT_QUESTIONS,
    defaultQuestions: DEFAULT_QUESTIONS,
  };
}

export async function updateQualificationTemplate(input: {
  questions?: unknown;
}) {
  const questions = normalizeQuestions(input.questions);
  await qualificationRepository.upsertQualificationTemplate(questions);
  return { ok: true as const, questions };
}

type AdminQualificationAnswer = {
  questionId: string;
  prompt: string;
  selectedOption: string | null;
  freeText: string;
};

type AdminQualificationSubmission = {
  id: string;
  userId: number;
  userName: string;
  email: string;
  status: "completed" | "skipped";
  submittedAt: string;
  completedAt: string | null;
  deferredUntil: string | null;
  answers: AdminQualificationAnswer[];
};

function parseSubmissionAnswers(raw: unknown): {
  status: "completed" | "skipped";
  deferredUntil: string | null;
  answers: AdminQualificationAnswer[];
} {
  if (Array.isArray(raw)) {
    const answers = raw
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const obj = item as {
          questionId?: unknown;
          prompt?: unknown;
          selectedOption?: unknown;
          freeText?: unknown;
        };
        const questionId =
          typeof obj.questionId === "string" ? obj.questionId.trim() : "";
        const prompt = typeof obj.prompt === "string" ? obj.prompt.trim() : "";
        const selectedOption =
          typeof obj.selectedOption === "string" && obj.selectedOption.trim().length > 0
            ? obj.selectedOption.trim()
            : null;
        const freeText =
          typeof obj.freeText === "string" ? obj.freeText.trim() : "";
        if (!questionId || !prompt) {
          return null;
        }
        return { questionId, prompt, selectedOption, freeText };
      })
      .filter((item): item is AdminQualificationAnswer => item !== null);
    return { status: "completed", deferredUntil: null, answers };
  }

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const meta = (raw as { meta?: unknown }).meta;
    if (meta && typeof meta === "object") {
      const status = (meta as { status?: unknown }).status;
      const deferredUntilRaw = (meta as { deferredUntil?: unknown }).deferredUntil;
      const deferredUntil =
        typeof deferredUntilRaw === "string" && deferredUntilRaw.trim().length > 0
          ? deferredUntilRaw
          : null;
      if (status === "skipped") {
        return { status: "skipped", deferredUntil, answers: [] };
      }
    }
  }

  return { status: "skipped", deferredUntil: null, answers: [] };
}

export async function listQualificationSubmissionsForAdmin(input: {
  page: number;
  pageSize: number;
  search?: string;
  status?: "completed" | "skipped";
}) {
  const result = await qualificationRepository.selectQualificationSubmissions(input);
  const totalPages = Math.max(1, Math.ceil(result.total / input.pageSize));
  const items: AdminQualificationSubmission[] = result.items.map((row) => {
    const parsed = parseSubmissionAnswers(row.answers);
    return {
      id: row.id,
      userId: row.userId,
      userName: row.userName,
      email: row.email,
      status: parsed.status,
      submittedAt: row.submittedAt.toISOString(),
      completedAt: row.qualificationCompletedAt
        ? row.qualificationCompletedAt.toISOString()
        : null,
      deferredUntil: parsed.deferredUntil,
      answers: parsed.answers,
    };
  });

  return {
    ok: true as const,
    items,
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total: result.total,
      totalPages,
    },
  };
}

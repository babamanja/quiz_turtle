import type { Request, Response } from "express";

import * as dictionaryService from "../services/dictionary.service.js";
import * as userService from "../services/user.service.js";
import * as vocabService from "../services/vocab.service.js";
import { isValidReviewCardDirection } from "@language-turtle/shared";
import {
  getRequiredUserId,
  sendServiceFailure,
  sendUnauthorized,
} from "./helpers.js";

function extractRequestId(req: Request): string | undefined {
  const header = req.headers?.["x-request-id"];
  if (typeof header === "string" && header.trim()) {
    return header.trim();
  }
  if (Array.isArray(header) && header.length > 0 && typeof header[0] === "string") {
    const candidate = header[0].trim();
    return candidate || undefined;
  }
  return undefined;
}

export async function getCurrentUser(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const result = await userService.getCurrentUser(userId);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json(result.user);
}

export async function listLanguageOptions(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const result = await userService.listLanguageOptions();
  return res.status(200).json(result.languages);
}

export async function updateCurrentUser(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const result = await userService.updateCurrentUser(userId, req.body ?? {});
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json(result.user);
}

export async function listMyWords(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const page = Math.max(1, Number(req.query?.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query?.pageSize) || 20));
  const sortByRaw =
    typeof req.query?.sortBy === "string" ? req.query.sortBy : "nextReviewMs";
  const sortBy = ["nextReviewMs", "pimsleurLevel", "primaryWord"].includes(sortByRaw)
    ? (sortByRaw as "nextReviewMs" | "pimsleurLevel" | "primaryWord")
    : "nextReviewMs";
  const sortOrderRaw =
    typeof req.query?.sortOrder === "string" ? req.query.sortOrder.toLowerCase() : "desc";
  const sortOrder = sortOrderRaw === "asc" ? "asc" : "desc";
  const searchRaw = typeof req.query?.search === "string" ? req.query.search.trim() : "";
  const search = searchRaw.length > 0 ? searchRaw : undefined;

  const result = await userService.listMyWords(userId, {
    page,
    pageSize,
    sortBy,
    sortOrder,
    search,
  });
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json({ items: result.items, pagination: result.pagination });
}

export async function getMyWord(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const vocabPairId = Number(req.params?.vocabPairId);
  const result = await vocabService.getMyWordDetail(userId, vocabPairId);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json(result.word);
}

export async function updateMyWord(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const vocabPairId = Number(req.params?.vocabPairId);
  const body = req.body ?? {};
  const result = await vocabService.updateMyWord(userId, vocabPairId, {
    partOfSpeech: body.partOfSpeech,
    example: body.example,
  });
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json(result.word);
}

export async function addMyWordNestMember(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const vocabPairId = Number(req.params?.vocabPairId);
  const body = req.body ?? {};
  const side = body.side === "primary" || body.side === "learning" ? body.side : null;
  const form = typeof body.form === "string" ? body.form : "";
  if (!side) {
    return res.status(400).json({ error: "invalid_nest_side" });
  }
  const result = await vocabService.addNestMemberToMyWord(userId, vocabPairId, { side, form });
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json(result.word);
}

export async function removeMyWordNestMember(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const vocabPairId = Number(req.params?.vocabPairId);
  const memberWordId = Number(req.params?.memberWordId);
  const result = await vocabService.removeNestMemberFromMyWord(userId, vocabPairId, memberWordId);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json(result.word);
}

export async function getVocabLanguages(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const result = await vocabService.getVocabLanguages(userId);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json(result.languages);
}

export async function lookupPrimaryWord(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const primaryWord =
    typeof req.body?.primaryWord === "string" ? req.body.primaryWord : "";
  const result = await vocabService.lookupPrimaryWord(userId, primaryWord);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json({
    primaryWordId: result.primaryWordId,
    primaryText: result.primaryText,
    suggestions: result.suggestions,
    learningLangName: result.learningLangName,
  });
}

export async function addMyWord(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const body = req.body ?? {};
  const result = await vocabService.addWordForUser(userId, {
    vocabPairId: typeof body.vocabPairId === "number" ? body.vocabPairId : undefined,
    primaryWordId: typeof body.primaryWordId === "number" ? body.primaryWordId : undefined,
    learningWord: typeof body.learningWord === "string" ? body.learningWord : undefined,
  });
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(201).json(result.word);
}

export async function getDueReviewWords(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const result = await vocabService.getDueWordsForReview(userId);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json({ words: result.words });
}

export async function submitReviewResult(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const vocabPairId = Number(req.params?.vocabPairId);
  const answerRaw = typeof req.body?.answer === "string" ? req.body.answer.trim() : "";
  const resultRaw = typeof req.body?.result === "string" ? req.body.result : "";
  const directionRaw = req.body?.direction;
  const direction = isValidReviewCardDirection(directionRaw) ? directionRaw : undefined;

  if (answerRaw) {
    const checkResult = await vocabService.checkReviewAnswer(
      userId,
      vocabPairId,
      answerRaw,
      direction,
    );
    if (checkResult.ok === false) {
      return sendServiceFailure(res, checkResult);
    }
    return res.status(200).json({
      direction: checkResult.direction,
      promptWord: checkResult.promptWord,
      expectedWord: checkResult.expectedWord,
      primaryWord: checkResult.primaryWord,
      learningWord: checkResult.learningWord,
      correct: checkResult.correct,
      match: checkResult.match,
      userAnswer: checkResult.userAnswer,
      pimsleurLevel: checkResult.pimsleurLevel,
      nextReviewMs: checkResult.nextReviewMs,
    });
  }

  if (resultRaw !== "know" && resultRaw !== "dont") {
    return res.status(400).json({ error: "invalid_review_result" });
  }

  const reviewResult = await vocabService.applyReviewResult(
    userId,
    vocabPairId,
    resultRaw,
    direction,
  );
  if (reviewResult.ok === false) {
    return sendServiceFailure(res, reviewResult);
  }
  return res.status(200).json({
    direction: reviewResult.direction,
    promptWord:
      reviewResult.direction === "learning_to_primary"
        ? reviewResult.learningWord
        : reviewResult.primaryWord,
    expectedWord:
      reviewResult.direction === "learning_to_primary"
        ? reviewResult.primaryWord
        : reviewResult.learningWord,
    primaryWord: reviewResult.primaryWord,
    learningWord: reviewResult.learningWord,
    correct: resultRaw === "know",
    match: resultRaw === "know" ? "exact" : "wrong",
    pimsleurLevel: reviewResult.pimsleurLevel,
    nextReviewMs: reviewResult.nextReviewMs,
  });
}

export async function listMyDictionaries(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const result = await dictionaryService.listMyDictionaries(userId);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json({ items: result.items });
}

export async function getDashboardStats(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const result = await userService.getUserDashboardStats(userId);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json(result.stats);
}

export async function deleteCurrentUser(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const result = await userService.deleteCurrentUser(userId, extractRequestId(req));
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(204).send();
}

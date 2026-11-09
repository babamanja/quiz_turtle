import type { Request, Response } from "express";

import * as publicationService from "../services/publication.service.js";
import {
  getRequiredUserId,
  getTaughtLanguageIds,
  sendServiceFailure,
  sendUnauthorized,
} from "./helpers.js";

export async function setMyDictionaryPublic(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId == null) return sendUnauthorized(res);
  const dictionaryId = Number(req.params?.dictionaryId);
  const isPublic = req.body?.isPublic === true;
  const result = await publicationService.setDictionaryPublic(userId, dictionaryId, isPublic);
  if (result.ok === false) return sendServiceFailure(res, result);
  return res.status(200).json(result.dictionary);
}

export async function listPublicDictionaries(_req: Request, res: Response) {
  const result = await publicationService.listPublicDictionaries();
  return res.status(200).json({ items: result.items });
}

export async function publishMyWord(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId == null) return sendUnauthorized(res);
  const vocabPairId = Number(req.params?.vocabPairId);
  const result = await publicationService.publishMyWord(userId, vocabPairId);
  if (result.ok === false) return sendServiceFailure(res, result);
  return res.status(200).json(result.word);
}

export async function publishMyStory(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId == null) return sendUnauthorized(res);
  const result = await publicationService.publishMyStory(userId, req.body ?? {});
  if (result.ok === false) return sendServiceFailure(res, result);
  return res.status(201).json(result);
}

export async function listReview(req: Request, res: Response) {
  const result = await publicationService.listReview(getTaughtLanguageIds(req));
  return res.status(200).json(result);
}

export async function verifyStory(req: Request, res: Response) {
  const result = await publicationService.verifyStory(
    Number(req.params?.storyId),
    getTaughtLanguageIds(req),
  );
  if (result.ok === false) return sendServiceFailure(res, result);
  return res.status(204).send();
}

export async function verifyDictionary(req: Request, res: Response) {
  const result = await publicationService.verifyDictionary(
    Number(req.params?.dictionaryId),
    getTaughtLanguageIds(req),
  );
  if (result.ok === false) return sendServiceFailure(res, result);
  return res.status(204).send();
}

export async function verifyWord(req: Request, res: Response) {
  const result = await publicationService.verifyWord(
    Number(req.params?.vocabPairId),
    getTaughtLanguageIds(req),
  );
  if (result.ok === false) return sendServiceFailure(res, result);
  return res.status(204).send();
}

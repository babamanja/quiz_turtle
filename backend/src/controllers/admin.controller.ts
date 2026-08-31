import type { Request, Response } from "express";

import { getRouteParam } from "../utils/routeParams.js";
import * as adminService from "../services/admin.service.js";
import * as languageService from "../services/language.service.js";
import * as tagService from "../services/tag.service.js";
import * as translationService from "../services/translation.service.js";
import * as vocabWordService from "../services/vocabWord.service.js";
import {
  getRequiredUserId,
  sendServiceFailure,
  sendUnauthorized,
} from "./helpers.js";

export async function listUsers(_req: Request, res: Response) {
  const page = Math.max(1, Number(_req.query?.page) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(_req.query?.pageSize) || 10),
  );
  const sortByRaw =
    typeof _req.query?.sortBy === "string" ? _req.query.sortBy : "id";
  const sortBy = ["id", "userName", "email", "role"].includes(sortByRaw)
    ? (sortByRaw as "id" | "userName" | "email" | "role")
    : "id";
  const sortOrderRaw =
    typeof _req.query?.sortOrder === "string"
      ? _req.query.sortOrder.toLowerCase()
      : "asc";
  const sortOrder = sortOrderRaw === "desc" ? "desc" : "asc";
  const roleRaw = typeof _req.query?.role === "string" ? _req.query.role : "";
  const role: "admin" | "user" | undefined =
    roleRaw === "admin" || roleRaw === "user" ? roleRaw : undefined;
  const searchRaw =
    typeof _req.query?.search === "string" ? _req.query.search.trim() : "";
  const search = searchRaw.length > 0 ? searchRaw : undefined;

  const result = await adminService.listUsers({
    page,
    pageSize,
    sortBy,
    sortOrder,
    role,
    search,
  });
  return res
    .status(200)
    .json({ items: result.users, pagination: result.pagination });
}

export async function getUserDetails(req: Request, res: Response) {
  const userId = Number(req.params?.userId);
  if (!Number.isInteger(userId) || userId < 1) {
    return res.status(400).json({ error: "invalid user id" });
  }
  const result = await adminService.getUserDetails(userId);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json(result.user);
}

export async function grantPremiumSubscription(req: Request, res: Response) {
  const userId = Number(req.params?.userId);
  if (!Number.isInteger(userId) || userId < 1) {
    return res.status(400).json({ error: "invalid user id" });
  }

  const result = await adminService.grantPremiumSubscriptionByAdmin({
    userId,
    currentPeriodEnd: req.body?.currentPeriodEnd,
  });

  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json({ subscription: result.subscription });
}

export async function listPayments(_req: Request, res: Response) {
  const page = Math.max(1, Number(_req.query?.page) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(_req.query?.pageSize) || 10),
  );
  const sortByRaw =
    typeof _req.query?.sortBy === "string" ? _req.query.sortBy : "date";
  const sortBy = ["date", "amount", "status", "transactionType"].includes(
    sortByRaw,
  )
    ? (sortByRaw as "date" | "amount" | "status" | "transactionType")
    : "date";
  const sortOrderRaw =
    typeof _req.query?.sortOrder === "string"
      ? _req.query.sortOrder.toLowerCase()
      : "desc";
  const sortOrder = sortOrderRaw === "asc" ? "asc" : "desc";
  const statusRaw =
    typeof _req.query?.status === "string" ? _req.query.status : "";
  const status =
    statusRaw === "pending" ||
    statusRaw === "succeeded" ||
    statusRaw === "failed" ||
    statusRaw === "refunded"
      ? statusRaw
      : undefined;
  const transactionTypeRaw =
    typeof _req.query?.transactionType === "string"
      ? _req.query.transactionType
      : "";
  const transactionType =
    transactionTypeRaw === "payment" || transactionTypeRaw === "refund"
      ? transactionTypeRaw
      : undefined;
  const searchRaw =
    typeof _req.query?.search === "string" ? _req.query.search.trim() : "";
  const search = searchRaw.length > 0 ? searchRaw : undefined;

  const result = await adminService.listPayments({
    page,
    pageSize,
    sortBy,
    sortOrder,
    status,
    transactionType,
    search,
  });
  return res
    .status(200)
    .json({ items: result.payments, pagination: result.pagination });
}

export async function refundPayment(req: Request, res: Response) {
  const paymentId = getRouteParam(req, "paymentId");
  const adminUserId = getRequiredUserId(req);
  if (adminUserId === null) {
    return sendUnauthorized(res);
  }

  const result = await adminService.refundPaymentByAdmin({
    paymentId,
    adminUserId,
    reason: req.body?.reason,
  });
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json({
    originalPaymentId: result.originalPaymentId,
    refundPaymentId: result.refundPaymentId,
  });
}

export async function getAiUsage(req: Request, res: Response) {
  const result = await adminService.getAiUsage({
    days: req.query?.days,
    page: req.query?.page,
    pageSize: req.query?.pageSize,
    sortBy: req.query?.sortBy,
    sortOrder: req.query?.sortOrder,
    status: req.query?.status,
    userId: req.query?.userId,
    search: req.query?.search,
  });
  return res.status(200).json(result.usage);
}

export async function listUserPairs(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query?.page) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(req.query?.pageSize) || 20),
  );
  const sortByRaw =
    typeof req.query?.sortBy === "string" ? req.query.sortBy : "nextReviewMs";
  const sortBy = ["nextReviewMs", "pimsleurLevel"].includes(sortByRaw)
    ? (sortByRaw as "nextReviewMs" | "pimsleurLevel")
    : "nextReviewMs";
  const sortOrderRaw =
    typeof req.query?.sortOrder === "string"
      ? req.query.sortOrder.toLowerCase()
      : "desc";
  const sortOrder = sortOrderRaw === "asc" ? "asc" : "desc";
  const searchRaw =
    typeof req.query?.search === "string" ? req.query.search.trim() : "";
  const search = searchRaw.length > 0 ? searchRaw : undefined;

  const result = await adminService.listUserPairs({
    page,
    pageSize,
    sortBy,
    sortOrder,
    search,
  });
  return res
    .status(200)
    .json({ items: result.userPairs, pagination: result.pagination });
}

export async function listVocabWords(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query?.page) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(req.query?.pageSize) || 20),
  );
  const sortByRaw = typeof req.query?.sortBy === "string" ? req.query.sortBy : "id";
  const sortBy = ["id", "text", "language"].includes(sortByRaw)
    ? (sortByRaw as "id" | "text" | "language")
    : "id";
  const sortOrderRaw =
    typeof req.query?.sortOrder === "string"
      ? req.query.sortOrder.toLowerCase()
      : "asc";
  const sortOrder = sortOrderRaw === "desc" ? "desc" : "asc";
  const searchRaw =
    typeof req.query?.search === "string" ? req.query.search.trim() : "";
  const search = searchRaw.length > 0 ? searchRaw : undefined;
  const languageIdRaw = Number(req.query?.languageId);
  const languageId =
    Number.isInteger(languageIdRaw) && languageIdRaw > 0 ? languageIdRaw : undefined;

  const result = await adminService.listVocabWords({
    page,
    pageSize,
    sortBy,
    sortOrder,
    search,
    languageId,
  });
  return res
    .status(200)
    .json({ items: result.words, pagination: result.pagination });
}

export async function createVocabWord(req: Request, res: Response) {
  const body = req.body ?? {};
  const result = await vocabWordService.createVocabWord({
    text: body.text,
    languageId: body.languageId,
  });
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(201).json(result.word);
}

export async function getVocabWord(req: Request, res: Response) {
  const wordId = Number(req.params?.wordId);
  const result = await vocabWordService.getVocabWordDetail(wordId);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json(result.word);
}

export async function updateVocabWord(req: Request, res: Response) {
  const wordId = Number(req.params?.wordId);
  if (!Number.isInteger(wordId) || wordId < 1) {
    return res.status(400).json({ error: "invalid word id" });
  }
  const body = req.body ?? {};
  const result = await vocabWordService.updateVocabWord(wordId, {
    text: body.text,
    languageId: body.languageId,
    partOfSpeech: body.partOfSpeech,
    tagIds: body.tagIds,
  });
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json(result.word);
}

export async function deleteVocabWord(req: Request, res: Response) {
  const wordId = Number(req.params?.wordId);
  if (!Number.isInteger(wordId) || wordId < 1) {
    return res.status(400).json({ error: "invalid word id" });
  }
  const result = await vocabWordService.deleteVocabWord(wordId);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(204).send();
}

export async function addVocabWordNestMember(req: Request, res: Response) {
  const wordId = Number(req.params?.wordId);
  const body = req.body ?? {};
  const result = await vocabWordService.addNestMemberToVocabWord(wordId, body.form);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json(result.word);
}

export async function removeVocabWordNestMember(req: Request, res: Response) {
  const wordId = Number(req.params?.wordId);
  const memberWordId = Number(req.params?.memberWordId);
  const result = await vocabWordService.removeNestMemberFromVocabWord(wordId, memberWordId);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json(result.word);
}

export async function listDictionaries(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query?.page) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(req.query?.pageSize) || 20),
  );
  const sortByRaw = typeof req.query?.sortBy === "string" ? req.query.sortBy : "id";
  const sortBy = ["id", "primaryWord", "learningWord", "userPairCount"].includes(sortByRaw)
    ? (sortByRaw as "id" | "primaryWord" | "learningWord" | "userPairCount")
    : "id";
  const sortOrderRaw =
    typeof req.query?.sortOrder === "string"
      ? req.query.sortOrder.toLowerCase()
      : "asc";
  const sortOrder = sortOrderRaw === "desc" ? "desc" : "asc";
  const searchRaw =
    typeof req.query?.search === "string" ? req.query.search.trim() : "";
  const search = searchRaw.length > 0 ? searchRaw : undefined;

  const result = await adminService.listDictionaries({
    page,
    pageSize,
    sortBy,
    sortOrder,
    search,
  });
  return res
    .status(200)
    .json({ items: result.dictionaries, pagination: result.pagination });
}

export async function listTranslations(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query?.page) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(req.query?.pageSize) || 20),
  );
  const searchRaw =
    typeof req.query?.search === "string" ? req.query.search.trim() : "";
  const search = searchRaw.length > 0 ? searchRaw : undefined;

  const primaryLanguageIdRaw = Number(req.query?.primaryLanguageId);
  const primaryLanguageId =
    Number.isInteger(primaryLanguageIdRaw) && primaryLanguageIdRaw > 0
      ? primaryLanguageIdRaw
      : undefined;

  const tagIdRaw = Number(req.query?.tagId);
  const tagId = Number.isInteger(tagIdRaw) && tagIdRaw > 0 ? tagIdRaw : undefined;

  const result = await adminService.listDictionaries({
    page,
    pageSize,
    sortBy: "id",
    sortOrder: "asc",
    search,
    primaryLanguageId,
    tagId,
  });
  return res
    .status(200)
    .json({ items: result.dictionaries, pagination: result.pagination });
}

export async function getTranslation(req: Request, res: Response) {
  const translationId = Number(req.params?.translationId);
  if (!Number.isInteger(translationId) || translationId < 1) {
    return res.status(400).json({ error: "invalid translation id" });
  }
  const result = await translationService.getTranslation(translationId);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json(result.translation);
}

export async function createTranslation(req: Request, res: Response) {
  const body = req.body ?? {};
  const payload = {
    primaryLanguageId: body.primaryLanguageId,
    primaryText: body.primaryText,
    learningLanguageId: body.learningLanguageId,
    learningText: body.learningText,
    learningTexts: body.learningTexts,
    tagIds: body.tagIds,
    partOfSpeech: body.partOfSpeech,
  };

  if (Array.isArray(body.rows)) {
    const result = await translationService.createTranslationRows({
      primaryLanguageId: body.primaryLanguageId,
      learningLanguageId: body.learningLanguageId,
      rows: body.rows,
    });
    if (result.ok === false) {
      return sendServiceFailure(res, result);
    }
    return res.status(201).json({
      created: result.created,
      skipped: result.skipped,
    });
  }

  if (Array.isArray(body.learningTexts)) {
    const result = await translationService.createTranslations(payload);
    if (result.ok === false) {
      return sendServiceFailure(res, result);
    }
    return res.status(201).json({
      created: result.created,
      skipped: result.skipped,
    });
  }

  const result = await translationService.createTranslation(payload);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(201).json(result.translation);
}

export async function deleteTranslation(req: Request, res: Response) {
  const translationId = Number(req.params?.translationId);
  if (!Number.isInteger(translationId) || translationId < 1) {
    return res.status(400).json({ error: "invalid translation id" });
  }
  const result = await translationService.deleteTranslation(translationId);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(204).send();
}

export async function updateTranslation(req: Request, res: Response) {
  const translationId = Number(req.params?.translationId);
  if (!Number.isInteger(translationId) || translationId < 1) {
    return res.status(400).json({ error: "invalid translation id" });
  }
  const body = req.body ?? {};
  const result = await translationService.updateTranslation(translationId, {
    primaryLanguageId: body.primaryLanguageId,
    primaryText: body.primaryText,
    learningLanguageId: body.learningLanguageId,
    learningText: body.learningText,
    tagIds: body.tagIds,
    partOfSpeech: body.partOfSpeech,
  });
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json(result.translation);
}

export async function listTags(_req: Request, res: Response) {
  const result = await tagService.listTags();
  return res.status(200).json({ items: result.tags });
}

export async function createTag(req: Request, res: Response) {
  const body = req.body ?? {};
  const result = await tagService.createTag({
    name: body.name,
    parentId: body.parentId,
  });
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(201).json(result.tag);
}

export async function updateTag(req: Request, res: Response) {
  const tagId = Number(req.params?.tagId);
  if (!Number.isInteger(tagId) || tagId < 1) {
    return res.status(400).json({ error: "invalid tag id" });
  }
  const body = req.body ?? {};
  const result = await tagService.updateTag(tagId, {
    name: body.name,
    parentId: body.parentId,
  });
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json(result.tag);
}

export async function deleteTag(req: Request, res: Response) {
  const tagId = Number(req.params?.tagId);
  if (!Number.isInteger(tagId) || tagId < 1) {
    return res.status(400).json({ error: "invalid tag id" });
  }
  const result = await tagService.deleteTag(tagId);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(204).send();
}

export async function listLanguages(_req: Request, res: Response) {
  const result = await languageService.listLanguages();
  return res.status(200).json({ items: result.languages });
}

export async function createLanguage(req: Request, res: Response) {
  const body = req.body ?? {};
  const result = await languageService.createLanguage({ name: body.name });
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(201).json(result.language);
}

export async function updateLanguage(req: Request, res: Response) {
  const languageId = Number(req.params?.languageId);
  if (!Number.isInteger(languageId) || languageId < 1) {
    return res.status(400).json({ error: "invalid language id" });
  }
  const body = req.body ?? {};
  const result = await languageService.updateLanguage(languageId, { name: body.name });
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json(result.language);
}

export async function deleteLanguage(req: Request, res: Response) {
  const languageId = Number(req.params?.languageId);
  if (!Number.isInteger(languageId) || languageId < 1) {
    return res.status(400).json({ error: "invalid language id" });
  }
  const result = await languageService.deleteLanguage(languageId);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(204).send();
}

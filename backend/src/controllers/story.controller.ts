import type { Request, Response } from "express";

import * as storyService from "../services/story.service.js";
import {
  getRequiredUserId,
  sendServiceFailure,
  sendUnauthorized,
} from "./helpers.js";

function parseStoryId(req: Request): number {
  return Number(req.params?.storyId);
}

export async function listAdminStories(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query?.page) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(req.query?.pageSize) || 20),
  );
  const status =
    typeof req.query?.status === "string" ? req.query.status : undefined;

  const result = await storyService.listAdminStories({ status, page, pageSize });
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res
    .status(200)
    .json({ items: result.items, pagination: result.pagination });
}

export async function createAdminStory(req: Request, res: Response) {
  const body = req.body ?? {};
  const result = await storyService.createAdminStory({
    title: body.title,
    primaryLanguageId: body.primaryLanguageId,
    learningLanguageId: body.learningLanguageId,
    status: body.status,
    slug: body.slug,
  });
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(201).json(result.story);
}

export async function getAdminStory(req: Request, res: Response) {
  const storyId = parseStoryId(req);
  if (!Number.isInteger(storyId) || storyId < 1) {
    return res.status(400).json({ error: "invalid story id" });
  }
  const result = await storyService.getAdminStory(storyId);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json(result.story);
}

export async function updateAdminStory(req: Request, res: Response) {
  const storyId = parseStoryId(req);
  if (!Number.isInteger(storyId) || storyId < 1) {
    return res.status(400).json({ error: "invalid story id" });
  }
  const body = req.body ?? {};
  const result = await storyService.updateAdminStory(storyId, {
    title: body.title,
    primaryLanguageId: body.primaryLanguageId,
    learningLanguageId: body.learningLanguageId,
    status: body.status,
    slug: body.slug,
  });
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json(result.story);
}

export async function deleteAdminStory(req: Request, res: Response) {
  const storyId = parseStoryId(req);
  if (!Number.isInteger(storyId) || storyId < 1) {
    return res.status(400).json({ error: "invalid story id" });
  }
  const result = await storyService.deleteAdminStory(storyId);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(204).send();
}

export async function replaceAdminStoryContent(req: Request, res: Response) {
  const storyId = parseStoryId(req);
  if (!Number.isInteger(storyId) || storyId < 1) {
    return res.status(400).json({ error: "invalid story id" });
  }
  const result = await storyService.replaceAdminStoryContent(storyId, req.body);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json(result.story);
}

export async function listMyStories(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const result = await storyService.listMyStories(userId);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json({ items: result.items });
}

export async function getMyStory(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const storyId = parseStoryId(req);
  if (!Number.isInteger(storyId) || storyId < 1) {
    return res.status(400).json({ error: "invalid story id" });
  }
  const result = await storyService.getMyStory(userId, storyId);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json(result.story);
}

export async function advanceMyStoryLevel(req: Request, res: Response) {
  const userId = getRequiredUserId(req);
  if (userId === null) {
    return sendUnauthorized(res);
  }
  const storyId = parseStoryId(req);
  if (!Number.isInteger(storyId) || storyId < 1) {
    return res.status(400).json({ error: "invalid story id" });
  }
  const result = await storyService.advanceMyStoryLevel(userId, storyId);
  if (result.ok === false) {
    return sendServiceFailure(res, result);
  }
  return res.status(200).json(result.story);
}

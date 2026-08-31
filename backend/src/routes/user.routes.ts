import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import * as storyController from "../controllers/story.controller.js";
import * as userController from "../controllers/user.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/me", requireAuth, asyncHandler(userController.getCurrentUser));
router.get("/me/language-options", requireAuth, asyncHandler(userController.listLanguageOptions));
router.get("/me/dashboard-stats", requireAuth, asyncHandler(userController.getDashboardStats));
router.get("/me/review/due", requireAuth, asyncHandler(userController.getDueReviewWords));
router.post("/me/review/:vocabPairId", requireAuth, asyncHandler(userController.submitReviewResult));
router.get("/me/dictionaries", requireAuth, asyncHandler(userController.listMyDictionaries));
router.get("/me/words", requireAuth, asyncHandler(userController.listMyWords));
router.get("/me/words/:vocabPairId", requireAuth, asyncHandler(userController.getMyWord));
router.patch("/me/words/:vocabPairId", requireAuth, asyncHandler(userController.updateMyWord));
router.post(
  "/me/words/:vocabPairId/nest-members",
  requireAuth,
  asyncHandler(userController.addMyWordNestMember),
);
router.delete(
  "/me/words/:vocabPairId/nest-members/:memberWordId",
  requireAuth,
  asyncHandler(userController.removeMyWordNestMember),
);
router.get("/me/vocab-languages", requireAuth, asyncHandler(userController.getVocabLanguages));
router.post("/me/words/lookup-primary", requireAuth, asyncHandler(userController.lookupPrimaryWord));
router.post("/me/words", requireAuth, asyncHandler(userController.addMyWord));
router.get("/me/stories", requireAuth, asyncHandler(storyController.listMyStories));
router.get("/me/stories/:storyId", requireAuth, asyncHandler(storyController.getMyStory));
router.post(
  "/me/stories/:storyId/next-level",
  requireAuth,
  asyncHandler(storyController.advanceMyStoryLevel),
);
router.patch("/me", requireAuth, asyncHandler(userController.updateCurrentUser));
router.delete("/me", requireAuth, asyncHandler(userController.deleteCurrentUser));

export default router;

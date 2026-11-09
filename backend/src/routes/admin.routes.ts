import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import * as adminController from "../controllers/admin.controller.js";
import * as feedbackController from "../controllers/feedback.controller.js";
import * as qualificationController from "../controllers/qualification.controller.js";
import * as storyController from "../controllers/story.controller.js";
import * as publicationController from "../controllers/publication.controller.js";
import {
  requireAdmin,
  requireTeacher,
  requireTeacherOrAdmin,
} from "../middleware/requireAdmin.js";

const router = Router();

router.get("/users", requireAdmin, asyncHandler(adminController.listUsers));
router.get("/users/:userId", requireAdmin, asyncHandler(adminController.getUserDetails));
router.put(
  "/users/:userId/taught-languages",
  requireAdmin,
  asyncHandler(adminController.setUserTaughtLanguages),
);
router.post(
  "/users/:userId/subscription/grant-premium",
  requireAdmin,
  asyncHandler(adminController.grantPremiumSubscription),
);
router.get("/payments", requireAdmin, asyncHandler(adminController.listPayments));
router.post(
  "/payments/:paymentId/refund",
  requireAdmin,
  asyncHandler(adminController.refundPayment),
);
router.get("/ai-usage", requireAdmin, asyncHandler(adminController.getAiUsage));
router.get(
  "/qualification-template",
  requireAdmin,
  asyncHandler(qualificationController.getQualificationTemplate),
);
router.put(
  "/qualification-template",
  requireAdmin,
  asyncHandler(qualificationController.updateQualificationTemplate),
);
router.get(
  "/qualification-submissions",
  requireAdmin,
  asyncHandler(qualificationController.listQualificationSubmissions),
);
router.get("/feedback", requireAdmin, asyncHandler(feedbackController.listFeedbackForAdmin));
router.get("/user-pairs", requireAdmin, asyncHandler(adminController.listUserPairs));
router.get("/words", requireTeacher, asyncHandler(adminController.listVocabWords));
router.post("/words", requireTeacher, asyncHandler(adminController.createVocabWord));
router.get("/words/:wordId", requireTeacher, asyncHandler(adminController.getVocabWord));
router.patch("/words/:wordId", requireTeacher, asyncHandler(adminController.updateVocabWord));
router.delete("/words/:wordId", requireTeacher, asyncHandler(adminController.deleteVocabWord));
router.post(
  "/words/:wordId/nest-members",
  requireTeacher,
  asyncHandler(adminController.addVocabWordNestMember),
);
router.delete(
  "/words/:wordId/nest-members/:memberWordId",
  requireTeacher,
  asyncHandler(adminController.removeVocabWordNestMember),
);
router.get("/dictionaries", requireTeacher, asyncHandler(adminController.listDictionaries));
router.get("/translations", requireTeacher, asyncHandler(adminController.listTranslations));
router.get(
  "/translations/:translationId",
  requireTeacher,
  asyncHandler(adminController.getTranslation),
);
router.post("/translations", requireTeacher, asyncHandler(adminController.createTranslation));
router.patch(
  "/translations/:translationId",
  requireTeacher,
  asyncHandler(adminController.updateTranslation),
);
router.delete(
  "/translations/:translationId",
  requireTeacher,
  asyncHandler(adminController.deleteTranslation),
);
router.get("/tags", requireTeacherOrAdmin, asyncHandler(adminController.listTags));
router.post("/tags", requireAdmin, asyncHandler(adminController.createTag));
router.patch("/tags/:tagId", requireAdmin, asyncHandler(adminController.updateTag));
router.delete("/tags/:tagId", requireAdmin, asyncHandler(adminController.deleteTag));
router.get("/languages", requireTeacherOrAdmin, asyncHandler(adminController.listLanguages));
router.post("/languages", requireAdmin, asyncHandler(adminController.createLanguage));
router.patch(
  "/languages/:languageId",
  requireAdmin,
  asyncHandler(adminController.updateLanguage),
);
router.delete(
  "/languages/:languageId",
  requireAdmin,
  asyncHandler(adminController.deleteLanguage),
);
router.get("/review", requireTeacher, asyncHandler(publicationController.listReview));
router.post(
  "/review/stories/:storyId/verify",
  requireTeacher,
  asyncHandler(publicationController.verifyStory),
);
router.post(
  "/review/dictionaries/:dictionaryId/verify",
  requireTeacher,
  asyncHandler(publicationController.verifyDictionary),
);
router.post(
  "/review/words/:vocabPairId/verify",
  requireTeacher,
  asyncHandler(publicationController.verifyWord),
);
router.post("/stories", requireTeacher, asyncHandler(storyController.createAdminStory));
router.get("/stories/:storyId", requireTeacher, asyncHandler(storyController.getAdminStory));
router.patch("/stories/:storyId", requireTeacher, asyncHandler(storyController.updateAdminStory));
router.delete(
  "/stories/:storyId",
  requireTeacher,
  asyncHandler(storyController.deleteAdminStory),
);
router.put(
  "/stories/:storyId/content",
  requireTeacher,
  asyncHandler(storyController.replaceAdminStoryContent),
);

export default router;

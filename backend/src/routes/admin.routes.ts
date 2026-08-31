import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import * as adminController from "../controllers/admin.controller.js";
import * as feedbackController from "../controllers/feedback.controller.js";
import * as qualificationController from "../controllers/qualification.controller.js";
import * as storyController from "../controllers/story.controller.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

router.use(requireAdmin);
router.get("/users", asyncHandler(adminController.listUsers));
router.get("/users/:userId", asyncHandler(adminController.getUserDetails));
router.post(
  "/users/:userId/subscription/grant-premium",
  asyncHandler(adminController.grantPremiumSubscription),
);
router.get("/payments", asyncHandler(adminController.listPayments));
router.post("/payments/:paymentId/refund", asyncHandler(adminController.refundPayment));
router.get("/ai-usage", asyncHandler(adminController.getAiUsage));
router.get("/qualification-template", asyncHandler(qualificationController.getQualificationTemplate));
router.put(
  "/qualification-template",
  asyncHandler(qualificationController.updateQualificationTemplate),
);
router.get(
  "/qualification-submissions",
  asyncHandler(qualificationController.listQualificationSubmissions),
);
router.get("/feedback", asyncHandler(feedbackController.listFeedbackForAdmin));
router.get("/user-pairs", asyncHandler(adminController.listUserPairs));
router.get("/words", asyncHandler(adminController.listVocabWords));
router.post("/words", asyncHandler(adminController.createVocabWord));
router.get("/words/:wordId", asyncHandler(adminController.getVocabWord));
router.patch("/words/:wordId", asyncHandler(adminController.updateVocabWord));
router.delete("/words/:wordId", asyncHandler(adminController.deleteVocabWord));
router.post("/words/:wordId/nest-members", asyncHandler(adminController.addVocabWordNestMember));
router.delete(
  "/words/:wordId/nest-members/:memberWordId",
  asyncHandler(adminController.removeVocabWordNestMember),
);
router.get("/dictionaries", asyncHandler(adminController.listDictionaries));
router.get("/translations", asyncHandler(adminController.listTranslations));
router.get("/translations/:translationId", asyncHandler(adminController.getTranslation));
router.post("/translations", asyncHandler(adminController.createTranslation));
router.patch("/translations/:translationId", asyncHandler(adminController.updateTranslation));
router.delete("/translations/:translationId", asyncHandler(adminController.deleteTranslation));
router.get("/tags", asyncHandler(adminController.listTags));
router.post("/tags", asyncHandler(adminController.createTag));
router.patch("/tags/:tagId", asyncHandler(adminController.updateTag));
router.delete("/tags/:tagId", asyncHandler(adminController.deleteTag));
router.get("/languages", asyncHandler(adminController.listLanguages));
router.post("/languages", asyncHandler(adminController.createLanguage));
router.patch("/languages/:languageId", asyncHandler(adminController.updateLanguage));
router.delete("/languages/:languageId", asyncHandler(adminController.deleteLanguage));
router.get("/stories", asyncHandler(storyController.listAdminStories));
router.post("/stories", asyncHandler(storyController.createAdminStory));
router.get("/stories/:storyId", asyncHandler(storyController.getAdminStory));
router.patch("/stories/:storyId", asyncHandler(storyController.updateAdminStory));
router.delete("/stories/:storyId", asyncHandler(storyController.deleteAdminStory));
router.put(
  "/stories/:storyId/content",
  asyncHandler(storyController.replaceAdminStoryContent),
);

export default router;

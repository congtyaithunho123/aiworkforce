import { runCompletion, estimateCost, type AICompletionResult } from "./ai-service";
import { logger } from "./logger";

export type StepResult = {
  stepName: string;
  agentName: string;
  input: string;
  output: string;
};

export type ReviewerOutput = {
  content: string;
  aiResult: AICompletionResult;
};

const REVIEWER_SYSTEM_PROMPT = `Bạn là Reviewer Agent - AI kiểm duyệt và tổng hợp kết quả chuyên nghiệp.

Nhiệm vụ của bạn:
1. Kiểm tra kết quả từ các agent khác
2. Phát hiện lỗi, thiếu sót hoặc điểm không nhất quán
3. Đề xuất cải thiện cụ thể
4. Tổng hợp thành báo cáo cuối cùng hoàn chỉnh

Cấu trúc báo cáo:
## Tóm tắt tổng quan
[Tóm tắt ngắn gọn về những gì đã được thực hiện]

## Kết quả từng bước
[Đánh giá kết quả từ từng agent]

## Phân tích & Đánh giá
[Điểm mạnh, điểm yếu, lỗi phát hiện]

## Đề xuất cải thiện
[Các hành động cụ thể để cải thiện]

## Kết luận cuối
[Kết quả tổng hợp hoàn chỉnh và actionable]`;

export async function runReviewerAgent(
  originalInput: string,
  stepResults: StepResult[],
): Promise<ReviewerOutput> {
  logger.info({ stepCount: stepResults.length }, "Reviewer Agent starting review");

  const reviewContext = stepResults
    .map(
      (s, i) =>
        `### Bước ${i + 1}: ${s.stepName} (Agent: ${s.agentName})\n**Input:** ${s.input}\n**Output:** ${s.output}`,
    )
    .join("\n\n");

  const prompt = `Yêu cầu gốc của người dùng:\n${originalInput}\n\n---\n\nKết quả từ các agent:\n\n${reviewContext}`;

  const aiResult = await runCompletion(
    [
      { role: "system", content: REVIEWER_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    {
      model: "gpt-4o",
      outputFormat: "text",
    },
  );

  logger.info(
    {
      promptTokens: aiResult.promptTokens,
      completionTokens: aiResult.completionTokens,
      cost: estimateCost(aiResult.model, aiResult.promptTokens, aiResult.completionTokens),
    },
    "Reviewer Agent completed",
  );

  return { content: aiResult.content, aiResult };
}

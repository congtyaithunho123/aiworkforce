import { runCompletion } from "./ai-service";
import { logger } from "./logger";

export type PlannerTask = {
  agent: string;
  instruction: string;
};

export type PlannerOutput = {
  tasks: PlannerTask[];
};

const PLANNER_SYSTEM_PROMPT = `Bạn là Planner Agent - một AI điều phối viên chuyên nghiệp.

Nhiệm vụ của bạn:
1. Phân tích yêu cầu từ người dùng
2. Chia thành các nhiệm vụ nhỏ phù hợp với từng agent chuyên biệt
3. Mỗi nhiệm vụ phải rõ ràng, cụ thể và có thể thực thi được

Các agent có sẵn:
- "sales": Xử lý các tác vụ về bán hàng, tìm khách hàng, tư vấn sản phẩm, theo dõi deal
- "marketing": Xử lý nội dung marketing, chiến lược quảng cáo, content creation, SEO
- "reviewer": Kiểm tra, đánh giá và tổng hợp kết quả cuối cùng

Quy tắc:
- Luôn kết thúc workflow bằng reviewer agent
- Instruction phải bằng tiếng Việt, cụ thể và actionable
- Mỗi agent chỉ xuất hiện một lần (trừ trường hợp đặc biệt)

Trả về JSON hợp lệ theo định dạng:
{
  "tasks": [
    { "agent": "sales", "instruction": "..." },
    { "agent": "marketing", "instruction": "..." },
    { "agent": "reviewer", "instruction": "..." }
  ]
}`;

export async function runPlannerAgent(userInput: string): Promise<PlannerOutput> {
  logger.info({ inputLength: userInput.length }, "Planner Agent starting analysis");

  const result = await runCompletion(
    [
      { role: "system", content: PLANNER_SYSTEM_PROMPT },
      { role: "user", content: userInput },
    ],
    {
      model: "gpt-4o",
      outputFormat: "json",
    },
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.content);
  } catch {
    throw new Error(`Planner Agent returned invalid JSON: ${result.content.slice(0, 300)}`);
  }

  const output = parsed as PlannerOutput;
  if (!Array.isArray(output.tasks) || output.tasks.length === 0) {
    throw new Error("Planner Agent returned no tasks");
  }

  logger.info(
    {
      taskCount: output.tasks.length,
      agents: output.tasks.map((t) => t.agent),
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    },
    "Planner Agent completed",
  );

  return output;
}

import { Router } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  usersTable,
  organizationsTable,
  emailSequenceLogsTable,
} from "@workspace/db";

const router = Router();

// GET /email-automation/sequences — list all scheduled/sent emails
router.get("/email-automation/sequences", async (req, res): Promise<void> => {
  try {
    const logs = await db
      .select()
      .from(emailSequenceLogsTable)
      .orderBy(emailSequenceLogsTable.scheduledAt);

    res.json(logs);
  } catch (err) {
    console.error("[email-automation] error:", err);
    res.status(500).json({ error: "Failed to load sequences" });
  }
});

// POST /email-automation/trigger — manually trigger an email sequence for an org
const TriggerBody = z.object({
  organizationId: z.number().int(),
  sequenceDay: z.enum(["day0", "day1", "day3", "day7"]),
});

router.post("/email-automation/trigger", async (req, res): Promise<void> => {
  const parsed = TriggerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const { organizationId, sequenceDay } = parsed.data;

    const [org] = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, organizationId));

    if (!org) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.organizationId, organizationId));

    if (!user) {
      res.status(404).json({ error: "No user found for this organization" });
      return;
    }

    const subject = EMAIL_SEQUENCES[sequenceDay].subject;
    const body = EMAIL_SEQUENCES[sequenceDay].body(user.name ?? user.email, org.name);

    const [log] = await db
      .insert(emailSequenceLogsTable)
      .values({
        organizationId,
        userId: user.id,
        sequenceDay,
        email: user.email,
        subject,
        status: "sent",
        sentAt: new Date(),
        scheduledAt: new Date(),
      })
      .returning();

    res.json({ success: true, log, preview: { subject, body } });
  } catch (err) {
    console.error("[email-automation/trigger] error:", err);
    res.status(500).json({ error: "Failed to trigger email" });
  }
});

// GET /email-automation/preview/:day — preview email template
router.get("/email-automation/preview/:day", async (req, res): Promise<void> => {
  const day = req.params.day as keyof typeof EMAIL_SEQUENCES;
  if (!EMAIL_SEQUENCES[day]) {
    res.status(404).json({ error: "Sequence not found" });
    return;
  }

  const seq = EMAIL_SEQUENCES[day];
  res.json({
    day,
    subject: seq.subject,
    body: seq.body("Anh/Chị", "Công ty của bạn"),
    description: seq.description,
  });
});

// ── Email sequence templates ─────────────────────────────────────────────────

const EMAIL_SEQUENCES = {
  day0: {
    description: "Welcome Email — gửi ngay khi đăng ký",
    subject: "🎉 Chào mừng bạn đến với AI Workforce!",
    body: (name: string, orgName: string) => `Xin chào ${name},

Chào mừng ${orgName} đến với AI Workforce! 🚀

Bạn vừa mở ra một kỷ nguyên mới cho đội sales của mình. AI SDR của chúng tôi sẽ làm việc 24/7 để:

✅ Phân tích ICP (Ideal Customer Profile) của bạn
✅ Tìm kiếm và tạo leads phù hợp
✅ Viết email outreach cá nhân hóa
✅ Theo dõi và follow-up tự động

BẮT ĐẦU NGAY:
👉 Truy cập dashboard: https://aiworkforce.vn/dashboard
👉 Chạy demo đầu tiên: https://aiworkforce.vn/demo

Bạn có 7 ngày trial với đầy đủ tính năng — hoàn toàn miễn phí.

Nếu cần hỗ trợ, reply email này hoặc liên hệ support@aiworkforce.vn

Chúc bạn thành công!
Team AI Workforce`,
  },

  day1: {
    description: "Giới thiệu AI SDR — gửi sau 1 ngày",
    subject: "💡 AI SDR hoạt động như thế nào? (Hướng dẫn 5 phút)",
    body: (name: string, orgName: string) => `Xin chào ${name},

Hôm nay, hãy để tôi hướng dẫn bạn cách AI SDR biến website của bất kỳ công ty nào thành leads đủ điều kiện.

🔍 CÁCH HOẠT ĐỘNG:

Bước 1: Nhập website công ty target
→ AI phân tích ngành, sản phẩm, đối thủ

Bước 2: AI tạo ICP (Ideal Customer Profile)
→ Xác định chính xác ai nên mua sản phẩm của bạn

Bước 3: Tạo 5 leads mẫu
→ Tên, chức danh, email, lý do phù hợp

Bước 4: Viết email cá nhân hóa
→ Đề cập cụ thể đến pain points của từng lead

🎯 THỬ NGAY:
Nhập website của một khách hàng tiềm năng: https://aiworkforce.vn/demo

Bạn sẽ thấy kết quả trong vòng 30 giây!

Trân trọng,
Team AI Workforce`,
  },

  day3: {
    description: "Case Study — gửi sau 3 ngày",
    subject: "📈 Case Study: TechVN tăng 300% qualified leads trong 2 tuần",
    body: (name: string, orgName: string) => `Xin chào ${name},

Hôm nay tôi muốn chia sẻ một case study thực tế từ khách hàng của chúng tôi.

─────────────────────────────
📊 TECHVN STARTUP
Ngành: B2B SaaS
Vấn đề: Đội sales 3 người, không đủ thời gian tìm leads
─────────────────────────────

TRƯỚC KHI DÙNG AI WORKFORCE:
• 20 leads/tuần (manual)
• 5-10 giờ/ngày tìm kiếm + viết email
• Tỷ lệ reply: 2-3%

SAU 2 TUẦN VỚI AI SDR:
• 80+ leads qualified/tuần (+300%)
• Email tự động 24/7
• Tỷ lệ reply: 8-12% (cá nhân hóa cao)
• Tiết kiệm 40 giờ/tuần

"AI SDR viết email hay hơn cả sales rep của chúng tôi vì nó thực sự nghiên cứu từng công ty trước khi viết."
— Nguyễn Minh Tuấn, CEO TechVN

─────────────────────────────

${orgName} có thể đạt kết quả tương tự.
👉 Bắt đầu ngay: https://aiworkforce.vn/sales

Trân trọng,
Team AI Workforce`,
  },

  day7: {
    description: "Upgrade Reminder — gửi vào ngày 7 (hết trial)",
    subject: "⏰ Trial của bạn sắp hết — Giữ lại AI SDR không?",
    body: (name: string, orgName: string) => `Xin chào ${name},

Trial 7 ngày của ${orgName} sắp kết thúc.

Bạn có muốn tiếp tục dùng AI SDR để tăng trưởng sales không?

─────────────────────────────
CHỌN GÓI PHÙ HỢP:

🟢 STARTER — $49/tháng
• 5 AI Agents
• 500 Tasks/tháng
• Phù hợp: Freelancer, Startup nhỏ

🔥 GROWTH — $149/tháng (Phổ biến nhất)
• 20 AI Agents
• 5.000 Tasks/tháng
• AI SDR đầy đủ tính năng
• Phù hợp: Team sales đang scale

💎 ENTERPRISE — $499/tháng
• Unlimited AI Agents
• Unlimited Tasks
• Custom AI Models
• Dedicated Support
─────────────────────────────

👉 NÂNG CẤP NGAY: https://aiworkforce.vn/billing

Nếu bạn cần thêm thời gian để đánh giá, hãy reply email này — chúng tôi có thể gia hạn trial thêm 7 ngày miễn phí.

Trân trọng,
Team AI Workforce`,
  },
};

export { EMAIL_SEQUENCES };
export default router;

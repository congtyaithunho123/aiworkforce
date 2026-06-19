# Tiến Trình Hệ Thống — AI Workforce Roadmap 2026–2032

## Tổng quan dự án

Dự án xây dựng nền tảng **AI Workforce** — cho phép doanh nghiệp thuê 10–100 nhân viên AI thay vì tuyển dụng nhân sự thực.

---

## Giai đoạn 1: AI Employee đơn lẻ (0–6 tháng)

**Mục tiêu:** Có 10–50 khách hàng trả tiền đầu tiên.

| Hạng mục | Chi tiết |
|---|---|
| Phạm vi | 1 nhân viên AI giải quyết 1 vấn đề đau đớn |
| Ví dụ A | AI Sales: tìm khách hàng, thu thập email, gửi email cá nhân hóa, theo dõi phản hồi, đặt lịch hẹn |
| Ví dụ B | AI Marketing: nghiên cứu thị trường, viết content, tạo hình ảnh, đăng bài tự động |

**Công nghệ:**
- LLM: OpenAI / Claude / Gemini
- Workflow: n8n
- Database: PostgreSQL
- Vector DB: Qdrant
- Frontend: Next.js
- Backend: FastAPI

---

## Giai đoạn 2: AI Team (6–12 tháng)

**Mục tiêu:** Khách hàng thuê "đội sales AI" thay vì mua chatbot đơn lẻ.

**AI Sales Team:**
- SDR Agent
- Lead Research Agent
- CRM Agent
- Follow-up Agent
- Analytics Agent

**Luồng hoạt động:** Research → Outreach → Follow-up → Meeting → CRM

---

## Giai đoạn 3: Multi-Agent Operating System (1–2 năm)

| Thành phần | Mô tả |
|---|---|
| Agent Registry | Danh sách nhân viên AI (Marketing Manager, Sales Manager, Recruiter, Accountant, Customer Support) |
| Shared Memory | Toàn bộ agent dùng chung bộ nhớ |
| Task Router | Tự động phân công việc dựa trên yêu cầu |

---

## Giai đoạn 4: AI Department (2–4 năm)

| Phòng ban | Các Agent |
|---|---|
| Phòng Marketing | SEO Agent, Facebook Agent, TikTok Agent, Email Agent, Content Agent |
| Phòng Sales | Lead Agent, Outreach Agent, Negotiation Agent |
| Phòng HR | CV Screening Agent, Interview Agent, Onboarding Agent |
| Phòng Kế Toán | Invoice Agent, Expense Agent, Tax Agent |

---

## Giai đoạn 5: AI Workforce Platform (4–6 năm)

**Định vị:** "AWS của nhân viên AI"

**Tính năng:**
- Thêm / xóa / đào tạo nhân viên AI
- Quản lý đa doanh nghiệp

**Mô hình doanh thu:**
- Theo tháng
- Theo nhiệm vụ
- Theo số lượng agent

---

## Giai đoạn 6: AI Workforce Marketplace (5–8 năm)

**Định vị:** Giống Apple App Store / Google Play — nhưng dành cho AI Workers.

**Cơ chế:**
- Bên thứ ba (chuyên gia, doanh nghiệp) tạo nhân viên AI chuyên biệt
- Người dùng mua và triển khai ngay
- Nền tảng thu 20–30% phí giao dịch

---

## Kiến trúc kỹ thuật dài hạn

```
                CEO AI
                    |
    --------------------------------
    |             |               |
Marketing      Sales            HR
    |             |               |
  Agent         Agent           Agent
    |             |               |
-------------------------------------
         Shared Memory Layer
-------------------------------------
      Workflow / Task Router
-------------------------------------
        LLM + Tools Layer
-------------------------------------
 CRM | ERP | Email | WhatsApp | Ads
```

---

## Stack công nghệ

### Bắt buộc
- Python, FastAPI, PostgreSQL, Redis, Docker, Linux

### AI
- OpenAI API, Claude API, Gemini API
- MCP, RAG, Vector Database

### Agent Framework
- LangGraph, CrewAI, AutoGen, n8n

### Scale
- Kubernetes, Kafka, Ray, Temporal

---

## Lộ trình thực tế (ngắn nhất)

```
1 AI Sales
    → Đội Sales AI
        → AI Workforce cho SME
            → AI Workforce Marketplace
                → Hệ điều hành doanh nghiệp AI
```

---

## Cơ hội tại Việt Nam

**Mục tiêu:** AI Workforce cho SME (doanh nghiệp vừa và nhỏ)

**Gói sản phẩm:**
- Sales AI
- Marketing AI
- CSKH AI
- Kế toán AI

**Lý do:** Hàng trăm nghìn SME tại Việt Nam, nhu cầu rõ ràng, dễ bán hơn so với việc xây "AI CEO" ngay từ đầu.

---

## Trạng thái xây dựng

### ✅ Đã hoàn thành

| Chức năng | Tên kỹ thuật | Mô tả |
|---|---|---|
| **Database Schema** | `@workspace/db` | Drizzle ORM — organizations, agents, tasks, memories, executions, refresh_tokens, password_reset_tokens |
| **API Spec & Codegen** | `@workspace/api-spec` | OpenAPI 3.1 spec + Orval — tự động sinh Zod schemas & React Query hooks |
| **AI Workforce Roadmap (Frontend)** | `@workspace/ai-workforce-roadmap` | React + Vite — lộ trình 6 giai đoạn 2026–2032, checklist, notes, localStorage |
| **API Server Core** | `@workspace/api-server` v1 | Express 5 — organizations, agents, tasks, memories — REST API + OpenAI integration |
| **Background Worker** | `@workspace/api-server` v2 | Background worker — structured JSON output, memory summarization, executions table |
| **Authentication System** | `routes/auth` + `middleware/authenticate` | JWT + bcrypt — đăng ký, đăng nhập, refresh token, quên mật khẩu |
| **Role-Based Access Control** | `middleware/require-role` | Roles: Owner / Admin / Member — bảo vệ routes theo quyền |
| **Multi-Tenant Isolation** | DB schema + middleware | organizationId bắt buộc trên: agents, workflows, tasks, executions, campaigns, leads, memories |
| **Usage Tracking** | `executions` table + `analytics` routes | Theo dõi prompt_tokens, completion_tokens, estimated_cost theo từng execution |
| **Workspace Dashboard** | `pages/dashboard.tsx` | Tổng quan AI Employees, Workflows, Campaigns, Leads, chi phí AI |
| **Analytics (Cost & Token)** | `routes/analytics` + Dashboard tab | Biểu đồ token sử dụng, chi phí ước tính — tích hợp trong Workspace Dashboard |
| **AI Sales Team — SDR** | `routes/sales-*` + `/sales` page | 4 bảng DB, 4 agents (Lead Research, Outreach, Follow-up, CRM), 12 API routes |
| **AI Marketing Team** | `routes/marketing-*` + `/marketing` page | 4 bảng DB, 5 agents (Research, Content, Image, Scheduler, Analytics), 11 routes |

### ⚠️ Xây một phần

| Chức năng | Tên kỹ thuật | Còn thiếu |
|---|---|---|
| **Billing Dashboard** | Dashboard tab "Analytics" | Có hiển thị token/cost nhưng chưa có quản lý gói, thanh toán, quota limit |

### ❌ Chưa xây dựng (SaaS roadmap)

| # | Chức năng | Tên kỹ thuật dự kiến | Mô tả |
|---|---|---|---|
| 1 | **Subscription System** | `plans` + `subscriptions` + `usage_records` tables | Gói Starter / Growth / Enterprise, giới hạn quota |
| 2 | **API Key Management** | `provider_keys` table + `/settings/api-keys` | Người dùng nhập OpenAI key riêng hoặc dùng key hệ thống |
| 3 | **Audit Log** | `audit_logs` table + middleware | Ghi lại user action, agent action, workflow action |
| 4 | **Notifications** | `notifications` table + SSE/WebSocket | Thông báo workflow hoàn thành, task thất bại, quota sắp hết |
| 5 | **Onboarding Wizard** | `pages/onboarding.tsx` | 4 bước: chọn ngành → nhập website → chọn AI Team → tạo workspace |
| 6 | **AI HR Team** | `routes/hr-*` + `/hr` page | CV Screening, Interview, Onboarding agents |
| 7 | **AI Accounting Team** | `routes/accounting-*` + `/accounting` page | Invoice, Expense, Tax agents |
| 8 | **AI Customer Support Team** | `routes/support-*` + `/support` page | Ticket, FAQ, Escalation agents |
| 9 | **Task Router tự động** | `lib/task-router` | Tự động phân công việc dựa trên yêu cầu |
| 10 | **Agent Registry (Marketplace)** | `pages/marketplace.tsx` | Mua và triển khai AI Workers từ bên thứ ba |

### 🔄 Dịch vụ đang chạy

| Dịch vụ | Cổng | Trạng thái |
|---|---|---|
| API Server | 8080 | ✅ Running |
| Frontend (React Vite) | 5173 | ✅ Running |
| PostgreSQL Database | — | ✅ Connected |

---

*Cập nhật lần cuối: 20/06/2026*

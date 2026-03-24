# ClawX Web Platform — MVP 开发计划

## 项目定位

Agent 管理平台 + 执行引擎 + 计费中心，同时也是 GarageClaw Desktop 的嵌入式 Web Surface。Web 端负责登录、Profile、Credits、Marketplace 等平台能力；Desktop 保留原生 OpenClaw 工作流，并通过嵌入式 webview 和 host routes 复用这些页面与 API。

## 技术栈

| 层 | 选型 | 原因 |
|---|------|------|
| 框架 | Next.js 14+ App Router | SSR + API Routes一体，部署Vercel零配置 |
| UI | Tailwind + shadcn/ui | 快速出页面，不纠结设计 |
| 数据库 | Supabase (Postgres + pgvector + Auth + Storage) | 一站式，已有经验 |
| LLM调用 | 直接调各家API（OpenAI SDK格式） | MVP不引入LiteLLM，减少依赖 |
| Embedding | OpenAI text-embedding-3-small (1536维) | 便宜，效果够用 |
| 部署 | Vercel | Next.js天然适配 |
| 包管理 | pnpm workspace | monorepo内web + shared |

## Monorepo 结构

```
claw-platform/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (auth)/
│       │   │   ├── login/page.tsx
│       │   │   └── register/page.tsx
│       │   ├── (dashboard)/
│       │   │   ├── layout.tsx                 # 侧边栏导航
│       │   │   ├── agents/
│       │   │   │   ├── page.tsx               # 我的agent列表
│       │   │   │   ├── new/page.tsx            # 创建agent（表单）
│       │   │   │   └── [id]/
│       │   │   │       ├── page.tsx            # agent详情/编辑
│       │   │   │       ├── knowledge/page.tsx  # 知识库管理
│       │   │   │       ├── skills/page.tsx     # 技能配置
│       │   │   │       ├── test/page.tsx       # 测试对话
│       │   │   │       └── analytics/page.tsx  # 使用统计
│       │   │   ├── store/page.tsx              # agent商店
│       │   │   ├── credits/page.tsx            # 余额 + 充值 + 账单
│       │   │   └── settings/page.tsx           # API token管理
│       │   └── api/
│       │       ├── agents/
│       │       │   ├── route.ts                # GET列表 / POST创建
│       │       │   ├── installed/route.ts      # GET已安装列表
│       │       │   └── [id]/
│       │       │       ├── route.ts            # GET / PUT / DELETE
│       │       │       ├── config/route.ts     # GET完整配置（ClawX拉取）
│       │       │       ├── invoke/route.ts     # POST执行（核心）
│       │       │       └── install/route.ts    # POST安装 / DELETE卸载
│       │       ├── credits/
│       │       │   ├── balance/route.ts
│       │       │   ├── check/route.ts
│       │       │   ├── deduct/route.ts
│       │       │   └── history/route.ts
│       │       ├── knowledge/
│       │       │   ├── upload/route.ts
│       │       │   └── [id]/route.ts
│       │       └── auth/
│       │           └── token/route.ts          # 生成API token
│       ├── lib/
│       │   ├── supabase/
│       │   │   ├── client.ts                   # 浏览器端client
│       │   │   ├── server.ts                   # 服务端client
│       │   │   └── admin.ts                    # service_role client（API用）
│       │   ├── llm.ts                          # LLM调用封装
│       │   ├── embedding.ts                    # embedding生成
│       │   ├── knowledge.ts                    # 知识库检索（pgvector）
│       │   ├── billing.ts                      # 计费逻辑
│       │   ├── prompt-renderer.ts              # 模板渲染
│       │   └── auth-guard.ts                   # API认证中间件
│       ├── prompts/                            # prompt模板（版本化）
│       │   ├── base.md                         # 所有agent共用的base prompt
│       │   └── templates/
│       │       ├── cognitive-coach.md
│       │       └── financial-monitor.md
│       ├── contracts/                          # 契约文档
│       │   ├── api-contract.md                 # API接口契约
│       │   ├── agent-schema.json               # agent配置JSON Schema
│       │   ├── skill-interface.json             # skill统一接口定义
│       │   └── error-codes.md                  # 错误码表
│       ├── package.json
│       ├── next.config.js
│       └── tsconfig.json
│
├── packages/
│   └── shared/
│       ├── types.ts                            # 核心类型定义
│       ├── api-types.ts                        # API请求/响应类型
│       ├── constants.ts                        # 模型列表、价格表、限制
│       ├── agent-schema.json                   # JSON Schema（双边共用）
│       └── package.json
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_create_profiles.sql
│   │   ├── 002_create_agents.sql
│   │   ├── 003_create_skills.sql
│   │   ├── 004_create_agent_skills.sql
│   │   ├── 005_create_agent_knowledge.sql
│   │   ├── 006_create_user_agents.sql
│   │   ├── 007_create_credit_ledger.sql
│   │   ├── 008_create_api_tokens.sql
│   │   └── 009_create_invoke_logs.sql
│   └── seed.sql
│
├── pnpm-workspace.yaml
├── turbo.json
├── CHANGELOG-agents.md                         # agent行为变更日志
└── README.md
```

---

## 数据库 Migration

### 001: profiles

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'creator', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 自动创建profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_own ON public.profiles FOR ALL USING (id = auth.uid());
CREATE POLICY profiles_read ON public.profiles FOR SELECT USING (true);
```

### 002: agents

```sql
CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  avatar_url TEXT,
  system_prompt TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'gpt-4o',
  temperature FLOAT DEFAULT 0.7,
  max_tokens INT DEFAULT 4096,
  pricing_type TEXT DEFAULT 'per_token'
    CHECK (pricing_type IN ('free', 'per_call', 'per_token')),
  price_per_call NUMERIC(10,4) DEFAULT 0,
  token_markup FLOAT DEFAULT 1.5,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused')),
  is_public BOOLEAN DEFAULT false,
  total_calls BIGINT DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agents_owner ON public.agents(owner_id);
CREATE INDEX idx_agents_public ON public.agents(is_public, status);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY agents_owner ON public.agents
  FOR ALL USING (owner_id = auth.uid());
CREATE POLICY agents_public_read ON public.agents
  FOR SELECT USING (is_public = true AND status = 'active');
```

### 003: skills

```sql
CREATE TABLE public.skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  config_schema JSONB DEFAULT '{}',
  is_builtin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 004: agent_skills

```sql
CREATE TABLE public.agent_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES public.skills(id),
  config JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  UNIQUE(agent_id, skill_id)
);

ALTER TABLE public.agent_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_skills_owner ON public.agent_skills
  FOR ALL USING (
    agent_id IN (SELECT id FROM public.agents WHERE owner_id = auth.uid())
  );
```

### 005: agent_knowledge

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.agent_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding vector(1536),
  source TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_knowledge_agent ON public.agent_knowledge(agent_id);
CREATE INDEX idx_knowledge_embedding ON public.agent_knowledge
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE public.agent_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY knowledge_owner ON public.agent_knowledge
  FOR ALL USING (
    agent_id IN (SELECT id FROM public.agents WHERE owner_id = auth.uid())
  );
```

### 006: user_agents

```sql
CREATE TABLE public.user_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  installed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, agent_id)
);

ALTER TABLE public.user_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_agents_own ON public.user_agents
  FOR ALL USING (user_id = auth.uid());
```

### 007: credit_ledger

```sql
CREATE TABLE public.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  agent_id UUID REFERENCES public.agents(id),
  type TEXT NOT NULL CHECK (type IN ('topup', 'deduct', 'refund', 'earning')),
  amount NUMERIC(12,4) NOT NULL,
  balance_after NUMERIC(12,4) NOT NULL,
  tokens_used INT,
  model TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ledger_user ON public.credit_ledger(user_id, created_at DESC);
CREATE INDEX idx_ledger_agent ON public.credit_ledger(agent_id, created_at DESC);

-- 余额查询函数（比视图更可靠）
CREATE OR REPLACE FUNCTION public.get_balance(p_user_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(
    (SELECT balance_after FROM public.credit_ledger
     WHERE user_id = p_user_id
     ORDER BY created_at DESC LIMIT 1),
    0
  );
$$ LANGUAGE sql STABLE;

ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY ledger_own ON public.credit_ledger
  FOR SELECT USING (user_id = auth.uid());
-- deduct操作走service_role，不走RLS
```

### 008: api_tokens

```sql
CREATE TABLE public.api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT DEFAULT 'default',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY tokens_own ON public.api_tokens
  FOR ALL USING (user_id = auth.uid());
```

### 009: invoke_logs（宽表）

```sql
CREATE TABLE public.invoke_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  model TEXT NOT NULL,
  input_tokens INT,
  output_tokens INT,
  total_tokens INT,
  latency_ms INT,
  credits_charged NUMERIC(10,4),
  skills_used TEXT[],
  knowledge_chunks_retrieved INT DEFAULT 0,
  channel TEXT,
  error_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_logs_agent ON public.invoke_logs(agent_id, created_at DESC);
CREATE INDEX idx_logs_user ON public.invoke_logs(user_id, created_at DESC);
```

### seed.sql

```sql
-- 预置技能
INSERT INTO public.skills (id, name, description, category, is_builtin) VALUES
('cognitive-coach', '认知迭代教练', '帮助用户拆解行业认知、生成迭代报告', 'productivity', true),
('link-summary', '链接摘要', '抓取URL内容并生成中文摘要', 'productivity', true),
('financial-monitor', '财经监控', '监控财经快讯，筛选高价值信息', 'research', true),
('industry-analysis', '行业拆解', '拆解公司战略、行业格局、竞争分析', 'research', true),
('writing-assistant', '写作助手', '帮助撰写文章、报告、邮件', 'productivity', true);
```

---

## 契约文件

### contracts/api-contract.md

```markdown
# ClawX Platform API Contract v1

Base URL: `https://{platform-domain}/api`

## 认证

所有API请求通过Bearer Token认证：
Header: `Authorization: Bearer {api_token}`

Token通过 POST /api/auth/token 生成，存储在api_tokens表（hash后）。

## 端点

### POST /api/agents/:id/invoke
执行agent，核心接口。

Request:
{
  "messages": [{"role": "user", "content": "string"}],
  "user_id": "uuid",
  "stream": false,
  "context": {
    "channel": "feishu|wechat|telegram|web",
    "group_id": "string?",
    "message_id": "string?"
  }
}

Response 200:
{
  "content": "agent回复内容",
  "usage": {
    "input_tokens": 150,
    "output_tokens": 300,
    "total_tokens": 450,
    "credits_charged": 0.045
  },
  "agent_id": "uuid",
  "model": "gpt-4o"
}

Response 402: {"error": "insufficient_credits", "balance": 0.5, "required": 1.2}
Response 403: {"error": "agent_not_installed"}
Response 404: {"error": "agent_not_found"}
Response 429: {"error": "rate_limited", "retry_after": 60}
Response 503: {"error": "llm_unavailable", "model": "gpt-4o"}

### GET /api/agents/installed?user_id={uuid}
返回用户已安装的agent列表。

Response 200:
{
  "agents": [
    {"id": "uuid", "name": "认知迭代教练", "slug": "cognitive-coach", "model": "gpt-4o"}
  ]
}

### GET /api/agents/:id/config
返回agent完整配置（ClawX拉取缓存用）。

Response 200:
{
  "id": "uuid",
  "name": "认知迭代教练",
  "system_prompt": "...",
  "model": "gpt-4o",
  "temperature": 0.7,
  "skills": ["cognitive-coach", "industry-analysis"],
  "pricing_type": "per_token",
  "token_markup": 1.5
}

### POST /api/credits/check
预检余额是否足够。

Request: {"user_id": "uuid", "estimated_tokens": 1000}
Response 200: {"allowed": true, "balance": 50.0}
Response 402: {"allowed": false, "balance": 0.5}

### GET /api/credits/balance?user_id={uuid}
Response 200: {"balance": 50.0, "currency": "credits"}
```

### contracts/error-codes.md

```markdown
# 错误码表 v1

| HTTP | error code | 含义 | ClawX展示文案 |
|------|-----------|------|--------------|
| 400 | invalid_request | 请求参数错误 | ⚠️ 请求格式有误，请重试 |
| 401 | unauthorized | token无效或过期 | 🔑 请重新绑定账号 |
| 402 | insufficient_credits | 余额不足 | 💰 余额不足，充值后继续：{url} |
| 403 | agent_not_installed | 未安装该agent | 📦 你还没有安装这个Agent，去商店看看：{url} |
| 404 | agent_not_found | agent不存在 | ❓ 没找到这个Agent，请检查名称 |
| 429 | rate_limited | 调用频率超限 | ⏳ 调用太频繁，请{retry_after}秒后重试 |
| 500 | internal_error | 服务器内部错误 | ⚠️ 系统异常，请稍后重试 |
| 503 | llm_unavailable | 模型服务不可用 | 🔧 AI服务暂时不可用，请稍后重试 |
```

### contracts/skill-interface.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Skill Interface",
  "description": "所有skill统一的输入输出契约",
  "definitions": {
    "SkillInput": {
      "type": "object",
      "properties": {
        "query": { "type": "string", "description": "用户输入/任务描述" },
        "context": {
          "type": "object",
          "properties": {
            "agent_id": { "type": "string" },
            "user_id": { "type": "string" },
            "channel": { "type": "string" },
            "config": { "type": "object", "description": "agent_skills.config里的个性化配置" }
          }
        }
      },
      "required": ["query"]
    },
    "SkillOutput": {
      "type": "object",
      "properties": {
        "result": { "type": "string", "description": "skill执行结果，会拼入prompt" },
        "metadata": {
          "type": "object",
          "properties": {
            "source": { "type": "string" },
            "confidence": { "type": "number" },
            "tokens_used": { "type": "integer" }
          }
        }
      },
      "required": ["result"]
    }
  }
}
```

---

## 核心模块实现要点

### lib/llm.ts

```typescript
// 统一LLM调用封装，按model路由到不同provider
// MVP只支持OpenAI格式的API（覆盖OpenAI、DeepSeek、Qwen）

interface LLMRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

interface LLMResponse {
  content: string;
  input_tokens: number;
  output_tokens: number;
  model: string;
  latency_ms: number;
}

// 模型 → API基础URL映射
const MODEL_ROUTES: Record<string, { baseUrl: string; apiKey: string }> = {
  'gpt-4o': { baseUrl: 'https://api.openai.com/v1', apiKey: process.env.OPENAI_API_KEY },
  'deepseek-chat': { baseUrl: 'https://api.deepseek.com/v1', apiKey: process.env.DEEPSEEK_API_KEY },
  // 按需增加
};
```

### lib/billing.ts

```typescript
// 计费核心逻辑

// 模型token成本表（每1K token的credits成本）
const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
  'gpt-4o':        { input: 0.0025, output: 0.01 },
  'gpt-4o-mini':   { input: 0.00015, output: 0.0006 },
  'deepseek-chat': { input: 0.0001, output: 0.0002 },
};

function calculateCost(agent, usage): number {
  const baseCost = TOKEN_COSTS[agent.model];
  const rawCost = (usage.input_tokens * baseCost.input + usage.output_tokens * baseCost.output) / 1000;
  // agent owner设置的加价倍率
  return rawCost * agent.token_markup;
}
```

### lib/prompt-renderer.ts

```typescript
// 从prompts/目录加载模板，渲染变量

function renderPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '');
}

// invoke时的完整prompt组装
function assembleSystemPrompt(agent, skills, knowledgeChunks): string {
  const parts = [
    agent.system_prompt,
    skills.length > 0 ? `\n\n你可以使用以下技能：\n${skills.map(s => `- ${s.name}: ${s.description}`).join('\n')}` : '',
    knowledgeChunks.length > 0 ? `\n\n参考知识：\n${knowledgeChunks.map(c => c.chunk_text).join('\n---\n')}` : '',
  ];
  return parts.filter(Boolean).join('');
}
```

### api/agents/[id]/invoke/route.ts 伪代码

```typescript
export async function POST(req, { params }) {
  // 1. 认证
  const user = await authenticateToken(req);
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  // 2. 加载agent
  const agent = await supabase.from('agents').select('*').eq('id', params.id).single();
  if (!agent) return Response.json({ error: 'agent_not_found' }, { status: 404 });

  // 3. 检查安装
  const installed = await supabase.from('user_agents')
    .select('id').eq('user_id', user.id).eq('agent_id', agent.id).single();
  if (!installed && agent.owner_id !== user.id)
    return Response.json({ error: 'agent_not_installed' }, { status: 403 });

  // 4. 预检余额（非free agent）
  if (agent.pricing_type !== 'free') {
    const balance = await getBalance(user.id);
    if (balance < 0.01)
      return Response.json({ error: 'insufficient_credits', balance }, { status: 402 });
  }

  // 5. 并行加载知识库 + 技能
  const [knowledgeChunks, skills] = await Promise.all([
    searchKnowledge(agent.id, body.messages.at(-1).content, 5),
    getAgentSkills(agent.id),
  ]);

  // 6. 组装prompt
  const systemPrompt = assembleSystemPrompt(agent, skills, knowledgeChunks);

  // 7. 调LLM
  const startTime = Date.now();
  const llmResponse = await callLLM({
    model: agent.model,
    messages: [{ role: 'system', content: systemPrompt }, ...body.messages],
    temperature: agent.temperature,
    max_tokens: agent.max_tokens,
  });
  const latencyMs = Date.now() - startTime;

  // 8. 计费扣减
  let creditsCharged = 0;
  if (agent.pricing_type !== 'free') {
    creditsCharged = calculateCost(agent, llmResponse);
    await deductCredits(user.id, agent.id, creditsCharged, llmResponse);
  }

  // 9. 写invoke_log（宽表）
  await supabase.from('invoke_logs').insert({
    agent_id: agent.id,
    user_id: user.id,
    model: llmResponse.model,
    input_tokens: llmResponse.input_tokens,
    output_tokens: llmResponse.output_tokens,
    total_tokens: llmResponse.input_tokens + llmResponse.output_tokens,
    latency_ms: latencyMs,
    credits_charged: creditsCharged,
    skills_used: skills.map(s => s.skill_id),
    knowledge_chunks_retrieved: knowledgeChunks.length,
    channel: body.context?.channel || 'api',
  });

  // 10. 更新agent统计
  await supabase.rpc('increment_agent_stats', {
    p_agent_id: agent.id,
    p_tokens: llmResponse.input_tokens + llmResponse.output_tokens,
  });

  // 11. 返回
  return Response.json({
    content: llmResponse.content,
    usage: {
      input_tokens: llmResponse.input_tokens,
      output_tokens: llmResponse.output_tokens,
      total_tokens: llmResponse.input_tokens + llmResponse.output_tokens,
      credits_charged: creditsCharged,
    },
    agent_id: agent.id,
    model: llmResponse.model,
  });
}
```

---

## 分周执行计划

### Week 1：地基

**Day 1：项目初始化**
- [ ] `mkdir claw-platform && cd claw-platform`
- [ ] `pnpm init` + `pnpm-workspace.yaml`
- [ ] `npx create-next-app@latest apps/web` (App Router, TS, Tailwind)
- [ ] `mkdir -p packages/shared && pnpm init` in shared
- [ ] `turbo.json` 配置
- [ ] 验证 `pnpm dev` 跑起来，shared被web引用成功

**Day 2：Supabase**
- [ ] 创建Supabase项目
- [ ] 执行 migration 001-009
- [ ] 执行 seed.sql
- [ ] 配置环境变量 `.env.local`
- [ ] `lib/supabase/client.ts` + `server.ts` + `admin.ts`
- [ ] 验证：能连接，能查询skills表

**Day 3：Auth**
- [ ] Supabase Auth 配置（Email登录）
- [ ] `@supabase/ssr` 接入
- [ ] login / register 页面（最简表单）
- [ ] middleware.ts 路由保护
- [ ] profiles表自动创建trigger验证
- [ ] 验证：注册→登录→跳转dashboard

**Day 4：API Token**
- [ ] `POST /api/auth/token` → 生成token，bcrypt hash后存表
- [ ] `lib/auth-guard.ts` → 从Bearer header解析token，查表验证
- [ ] settings页面 → 展示已有token，生成新token（只显示一次）
- [ ] 验证：生成token → 用curl带token访问API → 401/200正确

**Day 5：契约文件 + shared类型**
- [ ] 写 `contracts/api-contract.md`
- [ ] 写 `contracts/error-codes.md`
- [ ] 写 `contracts/skill-interface.json`
- [ ] 写 `contracts/agent-schema.json`
- [ ] `packages/shared/types.ts` 定义所有表的TS类型
- [ ] `packages/shared/api-types.ts` 定义请求/响应类型
- [ ] `packages/shared/constants.ts` 模型列表 + token成本表

### Week 2：Agent CRUD + Invoke

**Day 1：Agent CRUD API**
- [ ] `GET /api/agents` → 列表（owner自己的 + public的）
- [ ] `POST /api/agents` → 创建（校验JSON Schema）
- [ ] `GET /api/agents/:id` → 详情
- [ ] `PUT /api/agents/:id` → 更新（仅owner）
- [ ] 测试全部CRUD

**Day 2：Agent管理页面**
- [ ] Dashboard layout（侧边栏：Agents / Store / Credits / Settings）
- [ ] `/agents` 页面 → 卡片列表展示我的agent
- [ ] `/agents/new` 页面 → 创建表单（name, description, system_prompt, model下拉, pricing）
- [ ] `/agents/[id]` 页面 → 编辑表单
- [ ] 验证：创建agent后列表能看到

**Day 3：Invoke接口 — 核心**
- [ ] `lib/llm.ts` 实现（先只接OpenAI）
- [ ] `lib/prompt-renderer.ts` 实现
- [ ] `POST /api/agents/:id/invoke` 实现（不含知识库和技能，纯prompt+LLM）
- [ ] invoke_logs写入
- [ ] curl测试：发消息 → 收到LLM回复 → log写入成功

**Day 4：Credit系统**
- [ ] `lib/billing.ts` 计费逻辑
- [ ] `GET /api/credits/balance`
- [ ] `POST /api/credits/check`
- [ ] `POST /api/credits/deduct`（内部调用，带事务）
- [ ] invoke流程接入credit检查和扣减
- [ ] 手动SQL给测试用户充值100 credits
- [ ] 验证：invoke扣费 → 余额减少 → 余额为0时返回402

**Day 5：Credit页面 + 安装流程**
- [ ] `/credits` 页面 → 余额展示 + 历史账单列表
- [ ] `POST /api/agents/:id/install` + `DELETE`
- [ ] `GET /api/agents/installed`
- [ ] `/store` 页面 → 展示public agent + 安装按钮
- [ ] invoke加安装检查
- [ ] 验证：安装agent → invoke成功 / 未安装 → 403

### Week 3：知识库 + 技能 + 测试

**Day 1：知识库上传**
- [ ] `lib/embedding.ts` → 调OpenAI embedding API
- [ ] `POST /api/knowledge/upload` → 接收文件 → 切chunk(512 token) → embedding → 写入
- [ ] Supabase Storage存原始文件
- [ ] `/agents/[id]/knowledge` 页面 → 上传文件 + 已有条目列表 + 删除

**Day 2：知识库检索接入invoke**
- [ ] `lib/knowledge.ts` → pgvector相似度搜索
- [ ] invoke流程中并行检索top_5 chunks
- [ ] 拼入system prompt的"参考知识"部分
- [ ] 验证：上传文档 → 提问相关问题 → 回答引用了文档内容

**Day 3：技能系统**
- [ ] `/agents/[id]/skills` 页面 → 勾选启用技能 + 个性化config
- [ ] invoke流程中加载agent_skills → 拼入prompt技能说明
- [ ] 验证：启用不同skill组合 → agent回答行为变化

**Day 4：Agent测试页面**
- [ ] `/agents/[id]/test` → 简单的聊天界面
- [ ] 直接调invoke API，展示回复 + usage信息
- [ ] owner可以在这里测试自己的agent不扣费（owner豁免）
- [ ] 验证：在web上能和自己的agent对话

**Day 5：Analytics**
- [ ] `/agents/[id]/analytics` → 调用次数 / token消耗 / 收入
- [ ] 从invoke_logs聚合（按天分组）
- [ ] 简单的图表（用recharts）
- [ ] `/usage` 页面 → 我作为用户的使用统计
- [ ] 验证：数据准确

### Week 4：打磨 + 部署

**Day 1-2：UI打磨**
- [ ] Dashboard整体布局优化
- [ ] Agent卡片设计（头像、状态标签、调用量）
- [ ] Store页面优化（搜索、分类筛选）
- [ ] 移动端适配（关键页面）
- [ ] Loading状态 + Error边界

**Day 3：部署**
- [ ] Vercel项目创建，连接git repo
- [ ] 环境变量配置
- [ ] Supabase生产环境配置（如果需要单独项目）
- [ ] 域名配置
- [ ] 验证：线上能访问，CRUD + invoke全流程通过

**Day 4：安全加固**
- [ ] API rate limiting（Vercel Edge Middleware或Upstash）
- [ ] invoke接口token用量上限（单次max_tokens硬上限）
- [ ] CORS配置（只允许ClawX域名）
- [ ] API token过期机制
- [ ] RLS策略复查

**Day 5：文档 + 预置Agent**
- [ ] README.md 写清楚项目说明和部署步骤
- [ ] 创建2-3个正式的预置agent：认知迭代教练、行业分析师、写作助手
- [ ] 每个agent配好prompt模板 + 测试用例
- [ ] CHANGELOG-agents.md 开始记录
- [ ] 交付：平台可用，等ClawX对接

---

## 验收标准

以下全部通过 = Web平台MVP完成：

1. ✅ 用户注册登录，自动创建profile
2. ✅ 创建agent（prompt + 模型 + 定价）
3. ✅ 上传知识库文件，chunk+embedding自动处理
4. ✅ 配置agent技能组合
5. ✅ Agent设为public，商店可见
6. ✅ 其他用户安装agent
7. ✅ 通过API invoke agent，返回LLM回复
8. ✅ invoke自动扣减credits，余额不足返回402
9. ✅ Owner查看agent调用统计和收入
10. ✅ 生成API token供ClawX使用
11. ✅ invoke_logs宽表记录完整调用信息
12. ✅ Vercel线上部署可访问

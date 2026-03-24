# LiteLLM 计费集成设计

## 概述

通过 LiteLLM proxy（部署在 fly.io）作为统一 AI API 网关，实现平台额度计费。用户无需自己配 API key，使用平台 credits 付费调用 LLM。

## 架构

```
Electron App
    │
    ├─ 聊天请求 (OpenClaw Gateway → LiteLLM proxy)
    │  API key = 用户的 litellm virtual key
    │
    ▼
LiteLLM Proxy (garage-litellm.fly.dev)
    │
    ├─ 请求前：检查 virtual key budget → 超额返回 403
    ├─ 转发到 OpenAI / Anthropic / DeepSeek
    ├─ 请求后：自动写入 LiteLLM_SpendLogs (LiteLLM 独立 DB)
    │
    ▼
两个独立数据库：
    │
    ├─ LiteLLM DB (znbkhngkicblbavnalwz.supabase.co)
    │   └─ LiteLLM_SpendLogs, LiteLLM_VerificationToken, etc.
    │
    └─ GarageClaw DB (aztmthbcqcxweaveeuus.supabase.co)
        ├─ credit_ledger (计费记录)
        ├─ profiles (用户资料 + litellm_key)
        └─ _spend_sync_state (同步水位)
            │
            ▼
        Supabase Edge Function (每分钟 cron 触发)
            → GET LiteLLM /spend/logs API 读新记录
            → 写入 credit_ledger → 扣减余额
```

## 为什么两个库分开

- LiteLLM 创建 60+ 张表，会污染 GarageClaw 的命名空间
- LiteLLM Prisma migrations 可能和 GarageClaw migrations 冲突
- LiteLLM 实例未来会服务多个项目，应作为独立基础设施

## 数据层 (GarageClaw DB)

### profiles 表新增字段

- `litellm_key` (text, nullable) — 用户的 LiteLLM virtual key

### _spend_sync_state 表（新建）

| 字段 | 类型 | 说明 |
|------|------|------|
| key | text PK | 同步任务标识 |
| last_synced_at | timestamptz | 上次同步水位 |

### Supabase Edge Function: sync-litellm-spend

每分钟由 cron 触发：

1. 读 `_spend_sync_state` 获取上次同步时间
2. 调 LiteLLM API `GET /spend/logs?start_date=...` 获取新的 spend 记录
3. 通过 `api_key` hash → `profiles.litellm_key` 关联 user_id
4. 插入 `credit_ledger`（type='deduct'，amount=负值）
5. 更新用户余额
6. 更新 `_spend_sync_state.last_synced_at`

幂等保证：靠 SpendLogs 的 `request_id` 去重（credit_ledger 加 unique constraint on request_id）。

### Budget 同步 trigger

`credit_ledger` INSERT 时，如果 `type = 'topup'`：
- 查询用户新余额
- 调 LiteLLM API `POST /key/update` 更新 `max_budget`

## Electron 客户端

### Virtual Key 创建（登录时）

`src/stores/platform.ts` signIn 流程：

1. Supabase 登录成功 → loadProfile()
2. 检查 `profile.litellm_key`
3. 不存在 → `POST garage-litellm.fly.dev/key/generate`
   - `user_id`: Supabase user ID
   - `max_budget`: 当前余额
4. 返回的 key 写入 `profiles.litellm_key`

### Provider 配置

新增内置 provider "GarageClaw Platform"：
- baseURL: `https://garage-litellm.fly.dev`
- apiKey: 来自 `profiles.litellm_key`
- Settings 页开关："使用平台额度"

开启时 OpenClaw Gateway 用此 provider，关闭时走用户自己的 key。

### 错误处理

| 场景 | 处理 |
|------|------|
| LiteLLM 403 (budget exceeded) | 显示 "额度不足，请充值" |
| LiteLLM 不可达 | 显示 "平台服务暂时不可用" |
| sync 失败 | Edge Function 下次重试，幂等去重 |

## 完整请求链路

1. 用户发消息 → OpenClaw Gateway 检查当前 provider
2. "GarageClaw Platform" → baseURL=LiteLLM, apiKey=litellm_key
3. LiteLLM 检查 budget → 够则转发 → 不够则 403
4. LLM 返回 → LiteLLM 写 SpendLogs (LiteLLM DB) → 用户看到回复
5. ≤1分钟 → Edge Function sync → credit_ledger 扣费 → 余额更新 (GarageClaw DB)
6. 用户查看 Profile → 最新余额和账单

## 实施步骤

1. **Supabase SQL** — profiles 加字段、建 _spend_sync_state 表
2. **Electron platform store** — 登录时创建 virtual key
3. **Electron provider** — 新增 "GarageClaw Platform" 内置 provider + Settings 开关
4. **Supabase Edge Function** — sync-litellm-spend 定时同步
5. **测试** — 端到端：登录 → 发消息 → 扣费 → Profile 查看余额

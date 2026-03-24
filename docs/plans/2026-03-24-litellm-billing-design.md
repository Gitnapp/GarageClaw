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
LiteLLM Proxy (garage-litellm.fly.dev:4000)
    │
    ├─ 请求前：检查 virtual key budget → 超额返回 403
    ├─ 转发到 OpenAI / Anthropic / DeepSeek
    ├─ 请求后：自动写入 LiteLLM_SpendLogs
    │
    ▼
Supabase PostgreSQL
    │
    ├─ LiteLLM_SpendLogs (LiteLLM 自动写入)
    ├─ credit_ledger (计费记录)
    ├─ profiles (用户资料 + litellm_key)
    └─ _sync_state (同步水位)
        │
        ▼
    pg_cron (每分钟)
        → 读 SpendLogs 新记录 → 写 credit_ledger → 扣余额
```

## 数据层

### profiles 表新增字段

- `litellm_key` (text, nullable) — 用户的 LiteLLM virtual key

### _sync_state 表（新建）

| 字段 | 类型 | 说明 |
|------|------|------|
| key | text PK | 同步任务标识 |
| last_synced_at | timestamptz | 上次同步水位 |

### sync_litellm_spend() 函数

每分钟执行：

1. 读 `_sync_state` 获取上次同步时间
2. 查 `LiteLLM_SpendLogs` 中 `startTime > last_synced_at` 的记录
3. 通过 `api_key` 关联 `profiles.litellm_key` → `user_id`
4. 插入 `credit_ledger`（type='deduct'，amount=负值）
5. 更新用户余额（`get_balance` 或直接 SQL）
6. 更新 `_sync_state.last_synced_at`

幂等保证：靠水位时间戳 + SpendLogs 的 `request_id` 去重。

### pg_cron 定时任务

```sql
SELECT cron.schedule('sync-litellm-spend', '* * * * *', 'SELECT sync_litellm_spend()');
```

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
| sync 失败 | pg_cron 下次重试，幂等去重 |

## 完整请求链路

1. 用户发消息 → OpenClaw Gateway 检查当前 provider
2. "GarageClaw Platform" → baseURL=LiteLLM, apiKey=litellm_key
3. LiteLLM 检查 budget → 够则转发 → 不够则 403
4. LLM 返回 → LiteLLM 写 SpendLogs → 用户看到回复
5. ≤1分钟 → pg_cron sync → credit_ledger 扣费 → 余额更新
6. 用户查看 Profile → 最新余额和账单

## 实施步骤

1. **Supabase SQL** — profiles 加字段、建 _sync_state 表、写 sync 函数、配 pg_cron
2. **Electron platform store** — 登录时创建 virtual key
3. **Electron provider** — 新增 "GarageClaw Platform" 内置 provider + Settings 开关
4. **LiteLLM config** — 确认模型列表和 budget 功能开启（已配置）
5. **测试** — 端到端：登录 → 发消息 → 扣费 → Profile 查看余额

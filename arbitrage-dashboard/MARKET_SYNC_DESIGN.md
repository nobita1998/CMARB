# 市场动态同步功能设计

## 功能概述

当 Opinion 或 Polymarket 上的市场新增子市场时，自动获取并匹配双方的共同子市场。

## 数据源

- **Opinion**: `https://opinionhud.xyz/data.json`
- **Polymarket**: `https://gamma-api.polymarket.com/events?slug={slug}`

## 实现方案

### 1. 市场映射配置

维护一个市场映射表，记录已知的市场对应关系：

```javascript
const MARKET_MAPPINGS = [
  {
    id: 'australian-open-2026',
    name: "2026 Men's Australian Open Winner",
    type: 'Sports',
    opinionTopicId: 222,      // Opinion 的 topicId
    polySlug: '2026-mens-australian-open-winner'  // Polymarket 的 slug
  }
];
```

### 2. 同步流程

```
用户点击"同步"按钮
        ↓
并行获取 Opinion 和 Polymarket 数据
        ↓
遍历每个市场映射：
  - 从 Opinion data.json 获取 markets[topicId].subMarkets
  - 从 Polymarket API 获取 event.markets
        ↓
按名称匹配子市场（忽略大小写、特殊字符）
        ↓
生成匹配结果，存入 localStorage
        ↓
更新 UI 显示
```

### 3. 名称匹配算法

```javascript
function normalizeName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')  // 移除特殊字符
    .replace(/\s+/g, ' ');         // 合并空格
}

// 匹配逻辑：完全匹配 或 包含关系
const isMatch = (a, b) => {
  const normA = normalizeName(a);
  const normB = normalizeName(b);
  return normA === normB ||
         normA.includes(normB) ||
         normB.includes(normA);
};
```

### 4. UI 组件

在 Header 中添加同步按钮：

```jsx
<button onClick={handleSync} disabled={syncing}>
  {syncing ? '同步中...' : '🔄 同步市场'}
</button>

{lastSync && (
  <span>上次同步: {formatTime(lastSync)}</span>
)}

{syncResult && (
  <span>匹配: {matchedCount}/{totalCount}</span>
)}
```

### 5. 数据存储

同步结果存入 localStorage：

```javascript
{
  markets: [...],           // 匹配后的市场配置
  timestamp: "2026-01-02T...",
  errors: []                // 同步错误信息
}
```

页面加载时优先使用 localStorage 中的配置，若无则使用静态配置。

## 已创建的文件

- `src/utils/marketSync.js` - 同步逻辑（已创建，可删除或保留）
- `src/hooks/useMarketSync.js` - React Hook（已创建，可删除或保留）

## 待实现

1. Header 中添加同步按钮
2. 显示同步状态和结果
3. 错误处理和重试机制
4. 可选：添加新市场映射的 UI

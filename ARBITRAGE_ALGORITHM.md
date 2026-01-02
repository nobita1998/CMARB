# 跨平台套利算法文档

## 概述

这是一个跨平台预测市场套利计算器，通过在多个预测市场平台同时购买 YES 和 NO 合约，实现无风险套利。

## 支持的平台

| 平台 | 手续费 |
|------|--------|
| Polymarket | 无 |
| Opinion | 有 (动态费率) |

---

## 核心算法

### 1. 套利成立的四个必要条件

```javascript
const hasArbitrage = hasYes && hasNo && guaranteedProfit > 0 && sharesMatch;
```

1. **hasYes > 0** - 必须持有 YES 仓位
2. **hasNo > 0** - 必须持有 NO 仓位
3. **guaranteedProfit > 0** - 保证利润为正
4. **sharesMatch** - 各平台持股数量必须相同

### 2. 利润计算公式

```javascript
// YES 赢时的利润
const payoutIfYes = yesCount * shares;      // 赢得的金额
const profitIfYes = payoutIfYes - totalCost; // 减去总成本

// NO 赢时的利润
const payoutIfNo = noCount * shares;
const profitIfNo = payoutIfNo - totalCost;

// 保证利润 = 两种情况中的最小值
const guaranteedProfit = Math.min(profitIfYes, profitIfNo);
```

**核心思想**：无论事件结果是 YES 还是 NO，都能获得 `guaranteedProfit` 的利润。

---

## 计算流程

### 步骤 1: 加权平均价计算

对于每个仓位，支持多个挂单：

```javascript
function calculatePositionStats(position) {
    let totalValue = 0;
    let totalShares = 0;

    orders.forEach(order => {
        totalValue += order.price * order.quantity;  // 加权求和
        totalShares += order.quantity;               // 总数量
    });

    const avgPrice = totalShares > 0 ? totalValue / totalShares : 0;  // 加权平均价
    const totalCost = (avgPrice / 100) * totalShares;                  // 总成本 ($)
}
```

**示例**：
- 3 份 @ 50¢ + 2 份 @ 60¢
- 总份数 = 5
- 加权平均价 = (150 + 120) / 5 = 54¢
- 总成本 = 54¢ × 5 / 100 = $2.70

### 步骤 2: Opinion 平台手续费计算

```javascript
const FEE_K = 0.02;    // 费率系数
const MIN_FEE = 0.5;   // 最低手续费 $0.50

function calculateOpinionFee(avgPrice, totalShares) {
    const p = avgPrice / 100;                    // 价格转为小数
    const effectiveFeeRate = FEE_K * p * (1 - p); // 二次函数费率
    const calculatedFee = totalShares * effectiveFeeRate;
    return Math.max(calculatedFee, MIN_FEE);     // 取最大值
}
```

**费率特性**：
- 当 p = 0.5 时，费率最高 = 0.02 × 0.5 × 0.5 = 0.5%
- 当 p 接近 0 或 1 时，费率趋近于 0
- 最低收取 $0.50

### 步骤 3: 总成本汇总

```javascript
let totalCost = 0;
let totalFees = 0;
let yesCount = 0, noCount = 0;

positionStats.forEach(pos => {
    totalCost += pos.totalCost + pos.fee;  // 仓位成本 + 手续费
    totalFees += pos.fee;
    if (pos.type === 'YES') yesCount++;
    else noCount++;
});
```

### 步骤 4: 套利检测

```javascript
// 判断逻辑
if (!sharesMatch) {
    status = '各平台数量不一致';  // 警告
} else if (hasArbitrage) {
    status = '存在套利机会!';      // 成功
} else if (hasYes && hasNo) {
    status = '无套利机会';          // 无利润
} else {
    status = '需要同时持有 YES 和 NO';
}
```

---

## 套利条件数学推导

### 简化模型（无手续费）

设：
- YES 价格为 `p_yes` (¢)
- NO 价格为 `p_no` (¢)
- 购买数量为 `n` 份

**成本**：
```
总成本 = (p_yes + p_no) × n / 100
```

**收益**：
- 无论结果如何，赢方获得 `n × $1`

**套利条件**：
```
n × $1 > (p_yes + p_no) × n / 100
→ p_yes + p_no < 100¢
```

**结论**：当 YES 和 NO 价格之和小于 100¢ 时，存在套利机会。

### 多平台模型

当有多个平台时（如 3 个 YES 平台，2 个 NO 平台）：

**收益**：
- YES 赢: `yesCount × shares × $1`
- NO 赢: `noCount × shares × $1`

**保证利润**：
```
guaranteedProfit = min(yesCount, noCount) × shares - totalCost
```

---

## 数据结构

```javascript
// 仓位结构
positions = [
    {
        platform: 'polymarket',  // 平台标识
        type: 'YES',             // YES 或 NO
        orders: [
            { price: 45, quantity: 100 },  // 价格(¢)，数量
            { price: 46, quantity: 50 }
        ]
    }
]

// 计算结果结构
result = {
    totalCost: number,       // 总成本 ($)
    totalFees: number,       // 总手续费 ($)
    shares: number,          // 持仓数量
    yesCount: number,        // YES 平台数
    noCount: number,         // NO 平台数
    profitIfYes: number,     // YES 赢时利润
    profitIfNo: number,      // NO 赢时利润
    guaranteedProfit: number, // 保证利润
    hasArbitrage: boolean    // 是否存在套利
}
```

---

## 实际案例分析

### 案例 1: 有套利机会

```
配置:
┌─────────────────────────────────────┐
│ Polymarket YES: 42¢ × 100 份        │
│ Opinion NO:     55¢ × 100 份        │
└─────────────────────────────────────┘

计算:
Opinion 手续费 = max(0.02 × 0.55 × 0.45 × 100, $0.50) = $0.50
总成本 = $42 + $55 + $0.50 = $97.50
数量匹配 = 100 = 100 ✓

YES 赢: $100 - $97.50 = $2.50
NO 赢:  $100 - $97.50 = $2.50

保证利润 = $2.50 (2.56% ROI)
→ 存在套利机会!
```

### 案例 2: 无套利机会

```
配置:
┌─────────────────────────────────────┐
│ Polymarket YES: 48¢ × 100 份        │
│ Opinion NO:     55¢ × 100 份        │
└─────────────────────────────────────┘

计算:
Opinion 手续费 = max(0.02 × 0.55 × 0.45 × 100, $0.50) = $0.50
总成本 = $48 + $55 + $0.50 = $103.50

YES 赢: $100 - $103.50 = -$3.50
NO 赢:  $100 - $103.50 = -$3.50

保证利润 = -$3.50
→ 无套利机会
```

---

## 算法流程图

```
┌──────────────┐
│   输入数据    │
│ (平台/价格/量) │
└──────┬───────┘
       ↓
┌──────────────┐
│   数据验证    │
│ (价格0-100,  │
│  数量>0)     │
└──────┬───────┘
       ↓
┌──────────────┐
│  加权平均价   │
│   计算       │
└──────┬───────┘
       ↓
┌──────────────┐
│   手续费     │
│   计算       │
│ (Opinion)   │
└──────┬───────┘
       ↓
┌──────────────┐
│  总成本汇总   │
└──────┬───────┘
       ↓
┌──────────────┐
│  利润计算    │
│ (两种场景)   │
└──────┬───────┘
       ↓
┌──────────────┐
│  套利检测    │
│ (四个条件)   │
└──────┬───────┘
       ↓
┌──────────────┐
│   结果展示    │
│ (利润/ROI)   │
└──────────────┘
```

---

## 关键代码位置

| 功能 | 文件位置 |
|------|----------|
| 平台配置 | `index.html:397-403` |
| 加权平均计算 | `index.html:422-438` |
| Opinion 手续费 | `index.html:440-452` |
| 利润计算 | `index.html:656-660` |
| 套利检测 | `index.html:663-677` |
| 结果渲染 | `index.html:687-725` |

---

## 总结

本套利算法的核心是：

1. **跨平台价差捕捉** - 不同平台对同一事件的定价可能存在差异
2. **双向对冲** - 同时持有 YES 和 NO，消除方向性风险
3. **保证利润** - 取两种结果利润的最小值作为保证收益
4. **实时计算** - 输入变化即时反馈套利机会

**套利公式**：
```
保证利润 = min(yesCount × shares, noCount × shares) - totalCost
当保证利润 > 0 时，存在套利机会
```

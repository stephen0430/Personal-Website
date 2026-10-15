---
title: 机器视觉学习笔记：先把问题说清楚
titleEn: Computer Vision Notes: Define the Problem First
date: 2026-10-14
category: 学习
categoryEn: Learning
tags: [AI, 机器学习, 深度学习]
tagsEn: [AI, Machine Learning, Deep Learning]
cover: /assets/cover.webp
excerpt: 学习视觉模型时，先把输入、输出、评价指标和失败边界写清楚，往往比记住网络结构更重要。
excerptEn: When learning vision models, defining inputs, outputs, metrics and failure boundaries matters more than memorizing architectures.
---

机器视觉的学习经常从模型名字开始，但真正决定项目能不能落地的，通常是问题定义。

## 四个先行问题

1. 输入是什么：图片、视频、点云，还是多模态数据？
2. 输出是什么：分类、检测、分割、检索，还是一段可解释的文字？
3. 怎样评价：准确率、召回率、延迟、显存，还是人工验收？
4. 失败时怎么办：跳过、重试、交给人工，还是保留原始结果？

## 一个最小的实验记录

```python
experiment = {
    "task": "visual inspection",
    "input": "rgb image",
    "output": "defect boxes",
    "metric": "precision / recall",
    "fallback": "manual review",
}
```

把这些问题写在实验开始之前，后面的数据清洗、模型选择和部署方式才有比较稳定的依据。

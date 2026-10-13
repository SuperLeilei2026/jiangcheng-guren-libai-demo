# 链上共创合约

`JiangchengCoCreationRegistry.sol` 是“江城故人”面向普通参与者的共创谱系合约，与项目原有的“授权 issuer 签发记忆”合约分离。

## 权限边界

- 无 owner、无白名单；任何 EVM 钱包都能发布自己的作品或回应。
- 上联作者不能使用同一钱包自己对下联。
- 曲目创作者不能使用同一钱包给自己提交知音评价。
- 同一钱包对同一曲目只能提交一次知音评价；这能减少单地址刷屏，但不能防止多钱包 Sybil。
- 只有曲目创作者可追加“认定知音”状态，但无法改写原评价。

## 两条路线

| 路线 | 主网写入 | 链上关系 |
| --- | --- | --- |
| 李白·诗句唱和 | `publishPoemUpper` / `respondPoem` | 上联 `workId` 与下联 `parentId` 组成不可覆盖的父子关系 |
| 伯牙子期·知音评价 | `publishMusic` / `attestMusic` / `recognizeAttestation` | 曲目指纹、评价证言与创作者认定 |

## 数据取舍

- 诗句、曲名和短评会保存为公开合约数据并同步发出事件，前端在签名前明示提醒。
- 音乐配方 JSON 不写入合约；主网仅保存 `keccak256(recipeJson)`。
- 分享链接将配方放在 URL fragment，页面会在允许评价前重算 Hash 并与链上记录对比。
- 下联 ID 和知音评价 ID 都有合约内索引；前端通过 getter 回读，不依赖公共 RPC 上可能被禁用的 `eth_getLogs`。
- 这些记录只能证明某钱包在某时做了某次发布或回应，不等同于现实身份或作品质量认证。

## 编译基线

- Solidity `0.8.24`
- EVM target `paris`
- Optimizer enabled, `runs = 200`
- SPDX `MIT`

主网部署前，`dist/botchain-config.js` 中的 `coCreationRegistry.address` 、runtime hash 和部署区块保持为空。前端会停用交易并显示“等待主网部署”，不会伪造成功状态。

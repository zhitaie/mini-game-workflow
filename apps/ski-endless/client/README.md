# ski-endless client

这个目录预留给 `Cocos Creator 3.8 LTS` 项目。

当前阶段只先建立项目边界，不直接把现有样例壳复制过来。

建议约定：

- `assets/`：场景、Prefab、图片、音频、脚本
- `settings/`：项目设置
- `extensions/`：后续如有编辑器扩展再放这里

不要提交的生成目录：

- `build/`
- `library/`
- `local/`
- `temp/`
- `profiles/`

当前建议的第一批内容：

1. 在 `assets/scenes/` 下建立启动场景
2. 在 `assets/scripts/` 下建立 `Boot` 脚本
3. 从 `Boot` 脚本里接入现有 `auth/config/save` runtime

当前目录骨架存在的目的，是把第一款真实游戏与 `game-sample` 正式分开。

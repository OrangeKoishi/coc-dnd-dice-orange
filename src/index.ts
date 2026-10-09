import { Context, Schema, Random } from 'koishi'
import { CharacterManager } from './character'
import { COC7GameLogic } from './coc7th'
import { DND5EGameLogic } from './dnd5e'
import { Template } from './template'

export const name = 'coc-dnd-dice'

export const usage = `
<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #e08a4a;">🍊 关于本修改版</h2>
  <p>本插件是 <a href="https://github.com/YisRime/koishi-plugin-coc-dnd-dice" style="color:#e08a4a;text-decoration:none;">YisRime 原版</a> 的修改版：掷出成功等级时，会在检定结果之后追加 <code>success_levels.json</code> 中对应的文本。</p>
  <p>📦 <strong>本修改版仓库</strong>：<a href="https://github.com/OrangeKoishi/coc-dnd-dice-orange" style="color:#e08a4a;text-decoration:none;">OrangeKoishi/coc-dnd-dice-orange</a>（问题反馈请提交到这里）</p>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">📌 插件说明（原作者 YisRime）</h2>
  <p>📖 <strong>使用文档</strong>：请点击左上角的 <strong>插件主页</strong> 查看插件使用文档</p>
  <p>🔍 <strong>更多插件</strong>：可访问 <a href="https://github.com/YisRime" style="color:#4a6ee0;text-decoration:none;">苡淞的 GitHub</a> 查看本人的所有插件</p>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #e0574a;">❤️ 支持与反馈</h2>
  <p>🌟 喜欢这个插件？请在 <a href="https://github.com/YisRime" style="color:#e0574a;text-decoration:none;">GitHub</a> 上给我一个 Star！</p>
  <p>🐛 遇到问题？请通过 <strong>Issues</strong> 提交反馈，或加入 QQ 群 <a href="https://qm.qq.com/q/PdLMx9Jowq" style="color:#e0574a;text-decoration:none;"><strong>855571375</strong></a> 进行交流</p>
</div>
`

export interface Config {}

export const Config: Schema<Config> = Schema.object({})

// 掷骰函数
function rollDice(count: number, size: number): { results: number[], total: number } {
  const results: number[] = []
  for (let i = 0; i < count; i++) {
    results.push(Random.int(1, size + 1))
  }
  return { results, total: results.reduce((sum, val) => sum + val, 0) }
}

// 解析骰子表达式
function parseDiceExpression(expr: string, defaultSize: number = 100): { count: number, size: number } | null {
  // 支持格式: d20, 3d6, d, 20等
  const match = expr.match(/^(\d*)d(\d*)$/i)
  if (match) {
    const count = match[1] ? parseInt(match[1]) : 1
    const size = match[2] ? parseInt(match[2]) : defaultSize
    return { count, size }
  }

  // 单纯数字表示面数
  const numMatch = expr.match(/^\d+$/)
  if (numMatch) {
    return { count: 1, size: parseInt(expr) }
  }

  return null
}

// 检定成功度计算
function getSuccessLevel(result: number, target: number): string {
  // 大成功
  if (result === 1) return '大成功';

  // 大失败
  if (result === 100 || (target < 50 && result >= 96)) {
    return '大失败';
  }

  // 成功等级判断
  if (result <= target) {
    if (result <= Math.floor(target / 5)) {
      return '极难成功';
    } else if (result <= Math.floor(target / 2)) {
      return '困难成功';
    } else {
      return '常规成功';
    }
  }

  // 失败
  return '失败';
}

// 全局角色卡管理器
const characterManager = new CharacterManager()
// 全局 COC7 游戏逻辑
const coc7Logic = new COC7GameLogic()
// 全局 DND5E 游戏逻辑
const dnd5eLogic = new DND5EGameLogic()

export function apply(ctx: Context, config: Config) {
  // 初始化模板系统
  Template.init(ctx.baseDir)

  const dice = ctx.command('dice', '掷骰')

  // 基础掷骰命令 .r
  dice.subcommand('r [expression]', '掷骰子')
    .usage('进行一次或多次掷骰。\n支持多种表达式格式，如 d20, 3d6, d (默认d100), 20 (默认1d20)。')
    .example('.r d20  掷一个20面骰')
    .example('.r 3d6  掷三个6面骰')
    .example('.r 20   掷一个20面骰')
    .action(async ({ session }, expression = 'd') => {
      const parsed = parseDiceExpression(expression, 100)
      if (!parsed) {
        const errorMsg = Template.getTemplate('system_messages', 'dice_format_error') || '骰子表达式格式错误！请使用如 d20、3d6 等格式'
        return errorMsg
      }

      const { count, size } = parsed

      if (count > 100) {
        const limitMsg = Template.getTemplate('system_messages', 'dice_count_limit') || '骰子数量超过限制（最大100个）'
        return limitMsg
      }
      if (size > 1000) {
        const limitMsg = Template.getTemplate('system_messages', 'dice_size_limit') || '骰子面数超过限制（最大1000面）'
        return limitMsg
      }

      const result = rollDice(count, size)

      if (count === 1) {
        return `${session.username} 掷出了 d${size}=${result.total}`
      } else {
        return `${session.username} 掷出了 ${count}d${size}=[${result.results.join('+')}]=${result.total}`
      }
    })

  // 检定命令 .ra
  dice.subcommand('ra <skill> [target]', '进行技能检定')
    .usage('进行一次通用的技能检定，并根据结果和目标值判断成功等级。若不指定目标值，默认为70。')
    .example('.ra 侦查 70  进行侦查检定，目标值70')
    .example('.ra 侦查     进行侦查检定，使用默认d100')
    .action(async ({ session }, skill, target) => {
      if (!skill) {
        const msg = Template.getTemplate('system_messages', 'skill_name_required') || '请指定技能名称！'
        return msg
      }

      const targetValue = target ? parseInt(target) : 70 // 默认目标值
      if (isNaN(targetValue) || targetValue < 1 || targetValue > 100) {
        const msg = Template.getTemplate('system_messages', 'target_value_range') || '目标值必须在1-100之间！'
        return msg
      }

      const result = rollDice(1, 100)
      const rollValue = result.total
      const successLevel = getSuccessLevel(rollValue, targetValue)

      const format = Template.getTemplate('check_results', 'format') || '{player} 进行{skill}检定：d100={roll}/{target} {result}'
      const output = format
        .replace('{player}', session.username)
        .replace('{skill}', skill)
        .replace('{roll}', rollValue.toString())
        .replace('{target}', targetValue.toString())
        .replace('{result}', successLevel)

      // 追加当前成功等级对应的文本
      return output + Template.getSuccessLevelSuffix(successLevel)
    })

  // 代替检定命令
  dice.subcommand('ra <skill> <target> <substitute>', '代替他人进行检定')
    .usage('代替另一位用户（或NPC）进行技能检定。需要提供技能、目标值和代替目标。')
    .example('.ra 侦查 70 @张三  代替张三进行侦查检定')
    .action(async ({ session }, skill, target, substitute) => {
      if (!skill || !target || !substitute) {
        return '请指定技能名称、目标值和代替目标！'
      }

      const targetValue = parseInt(target)
      if (isNaN(targetValue) || targetValue < 1 || targetValue > 100) {
        const msg = Template.getTemplate('system_messages', 'target_value_range') || '目标值必须在1-100之间！'
        return msg
      }

      const result = rollDice(1, 100)
      const rollValue = result.total
      const successLevel = getSuccessLevel(rollValue, targetValue)

      // 清理@符号
      const cleanSubstitute = substitute.replace(/^@/, '')

      const format = Template.getTemplate('check_results', 'format_proxy') || '{player} 代替 {target} 进行{skill}检定：d100={roll}/{targetValue} {result}'
      const output = format
        .replace('{player}', session.username)
        .replace('{target}', cleanSubstitute)
        .replace('{skill}', skill)
        .replace('{roll}', rollValue.toString())
        .replace('{targetValue}', targetValue.toString())
        .replace('{result}', successLevel)

      // 追加当前成功等级对应的文本
      return output + Template.getSuccessLevelSuffix(successLevel)
    })

  // 设置默认骰子面数
  dice.subcommand('set <size>', '设置默认骰子面数')
    .usage('设置 .r 命令在未指定骰子面数时（如.r d）的默认面数。注意：此功能当前仅为占位，未完全实现。')
    .example('.set 20  设置默认骰子为20面')
    .action(async ({ session }, size) => {
      const diceSize = parseInt(size)
      if (isNaN(diceSize) || diceSize < 2 || diceSize > 1000) {
        return `骰子面数必须在2-1000之间！`
      }

      return `已设置默认骰子面数为 ${diceSize}`
    })

  // 注册角色卡相关命令
  characterManager.registerCommands(dice)

  // 注册 COC7 相关命令
  coc7Logic.registerCommands(dice, characterManager)

  // 注册 DND5E 相关命令
  dnd5eLogic.registerCommands(dice, characterManager)

  // 注册模板管理命令
  Template.registerCommands(dice)
}

/**
 * 🤖 训练AI Agent示例
 *
 * 展示如何使用 WarehouseTrainingEnv 训练AI
 */

const { WarehouseTrainingEnv } = require('./warehouse-training-env');
const { WarehouseManager } = require('../core/warehouseManager');
const { WarehouserBot } = require('../bots/warehouserBot');
const { WarehouseScheduler } = require('../ai/warehouseScheduler');

/**
 * 示例Agent: 基于规则的简单Agent
 * 实际训练时应该使用强化学习算法（Q-Learning, DQN, PPO等）
 */
class RuleBasedAgent {
  constructor() {
    this.name = 'RuleBasedAgent';
  }

  /**
   * 根据观察选择动作
   * @param {Object} observation - 环境状态
   * @returns {Array} action - 任务序列
   */
  selectAction(observation) {
    const actions = [];

    // 策略1: 如果输入仓库有物品，搬运到分类仓库
    const inputWarehouses = observation.warehouses.filter(wh => wh.type === 'input');

    for (const inputWh of inputWarehouses) {
      if (inputWh.items.length > 0) {
        const sortingWarehouse = observation.warehouses.find(wh => wh.type === 'sorting');

        if (sortingWarehouse) {
          actions.push({
            type: 'transfer',
            source: inputWh.id,
            destination: sortingWarehouse.id,
            items: inputWh.items.slice(0, 3).map(i => i.item) // 每次最多搬运3种物品
          });
        }
      }
    }

    // 策略2: 如果分类仓库有物品，调度到输出仓库
    const sortingWarehouse = observation.warehouses.find(wh => wh.type === 'sorting');
    const outputWarehouse = observation.warehouses.find(wh => wh.type === 'output');

    if (sortingWarehouse && outputWarehouse && sortingWarehouse.items.length > 0) {
      const requiredItems = [
        { item: 'oak_planks', quantity: 192 },
        { item: 'cobblestone', quantity: 256 }
      ];

      actions.push({
        type: 'dispatch',
        destination: outputWarehouse.id,
        requiredItems
      });
    }

    return actions;
  }
}

/**
 * 随机Agent（作为baseline）
 */
class RandomAgent {
  constructor() {
    this.name = 'RandomAgent';
  }

  selectAction(observation) {
    // 随机选择一个仓库搬运
    const warehouses = observation.warehouses;
    const inputWh = warehouses.find(wh => wh.type === 'input');
    const sortingWh = warehouses.find(wh => wh.type === 'sorting');

    if (!inputWh || !sortingWh) {
      return [];
    }

    // 随机选择物品
    const randomItems = inputWh.items
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(Math.random() * 3) + 1)
      .map(i => i.item);

    if (randomItems.length === 0) {
      return [];
    }

    return [{
      type: 'transfer',
      source: inputWh.id,
      destination: sortingWh.id,
      items: randomItems
    }];
  }
}

/**
 * 训练循环
 */
async function trainAgent(agent, env, episodes) {
  console.log('\n' + '='.repeat(80));
  console.log(`🎯 Training ${agent.name} for ${episodes} episodes`);
  console.log('='.repeat(80) + '\n');

  const rewards = [];

  for (let episode = 1; episode <= episodes; episode++) {
    // 重置环境
    const observation = env.reset();

    // Episode循环
    let step = 0;
    let episodeReward = 0;

    while (!env.isDone && step < env.maxSteps) {
      // Agent选择动作
      const action = agent.selectAction(observation);

      if (action.length === 0) {
        break; // 没有动作可执行
      }

      // 执行动作
      const result = await env.step(action);

      episodeReward += result.reward;
      step++;

      // 可选：渲染环境
      // env.render();
    }

    rewards.push(episodeReward);

    console.log(`\n📊 Episode ${episode}/${episodes} - Reward: ${episodeReward.toFixed(2)}`);
  }

  // 训练结束
  env.close();

  // 统计
  const avgReward = rewards.reduce((a, b) => a + b, 0) / rewards.length;
  const maxReward = Math.max(...rewards);
  const minReward = Math.min(...rewards);

  console.log('\n' + '='.repeat(80));
  console.log(`📈 Training Summary for ${agent.name}`);
  console.log('='.repeat(80));
  console.log(`Episodes: ${episodes}`);
  console.log(`Average Reward: ${avgReward.toFixed(2)}`);
  console.log(`Max Reward: ${maxReward.toFixed(2)}`);
  console.log(`Min Reward: ${minReward.toFixed(2)}`);
  console.log('='.repeat(80) + '\n');

  return rewards;
}

/**
 * 对比不同Agent
 */
async function compareAgents() {
  console.log('🎮 模拟训练环境\n');

  // 创建模拟环境
  const warehouseManager = new WarehouseManager();
  const mockBot = {
    username: 'TrainingBot',
    entity: { position: { x: 0, y: 64, z: 0 } },
    inventory: { items: () => [] }
  };

  // 创建仓库
  warehouseManager.createWarehouse({
    id: 'input_1',
    type: 'input',
    location: { x: 0, y: 64, z: 0 },
    direction: 'east',
    chestPositions: [{ x: 0, y: 64, z: 0 }]
  });

  warehouseManager.createWarehouse({
    id: 'sorting_1',
    type: 'sorting',
    location: { x: 20, y: 64, z: 0 },
    direction: 'east',
    chestPositions: [{ x: 20, y: 64, z: 0 }],
    categories: { 'wood': { chestId: 'chest_1' }, 'stone': { chestId: 'chest_2' } }
  });

  warehouseManager.createWarehouse({
    id: 'output_1',
    type: 'output',
    location: { x: 40, y: 64, z: 0 },
    direction: 'east',
    chestPositions: [{ x: 40, y: 64, z: 0 }],
    materials: { 'oak_planks': { chestId: 'chest_1' }, 'cobblestone': { chestId: 'chest_2' } }
  });

  // 添加物品到输入仓库
  const inputWarehouse = warehouseManager.getWarehouse('input_1');
  const mockItems = [
    { item: 'oak_log', quantity: 64 },
    { item: 'birch_log', quantity: 32 },
    { item: 'cobblestone', quantity: 128 },
    { item: 'stone', quantity: 64 },
    { item: 'coal', quantity: 32 }
  ];

  for (const { item, quantity } of mockItems) {
    inputWarehouse.depositItem(item, quantity);
  }

  const warehouserBot = new WarehouserBot(mockBot, warehouseManager);
  const scheduler = new WarehouseScheduler(warehouseManager, warehouserBot);

  // 创建训练环境
  const env = new WarehouseTrainingEnv(warehouseManager, warehouserBot, scheduler);
  env.maxSteps = 10; // 每个episode最多10步

  // 对比Agent
  console.log('🔄 对比不同Agent的性能...\n');

  const ruleBasedAgent = new RuleBasedAgent();
  const randomAgent = new RandomAgent();

  const ruleBasedRewards = await trainAgent(ruleBasedAgent, env, 5);
  env.episodeHistory = []; // 清空历史
  const randomRewards = await trainAgent(randomAgent, env, 5);

  // 对比结果
  console.log('\n' + '='.repeat(80));
  console.log('🏆 Agent Comparison');
  console.log('='.repeat(80));
  console.log(`RuleBasedAgent Average: ${(ruleBasedRewards.reduce((a,b) => a+b, 0) / ruleBasedRewards.length).toFixed(2)}`);
  console.log(`RandomAgent Average: ${(randomRewards.reduce((a,b) => a+b, 0) / randomRewards.length).toFixed(2)}`);
  console.log(`Improvement: ${((ruleBasedRewards.reduce((a,b) => a+b, 0) / ruleBasedRewards.length) - (randomRewards.reduce((a,b) => a+b, 0) / randomRewards.length)).toFixed(2)} points`);
  console.log('='.repeat(80) + '\n');
}

/**
 * 真实环境训练（需要Minecraft服务器）
 */
async function trainInRealEnv() {
  const mineflayer = require('mineflayer');

  const bot = mineflayer.createBot({
    host: 'localhost',
    port: 25565,
    username: 'TrainingBot'
  });

  bot.on('spawn', () => {
    console.log('✅ Bot 已连接到服务器\n');

    const warehouseManager = new WarehouseManager();
    const warehouserBot = new WarehouserBot(bot, warehouseManager);
    const scheduler = new WarehouseScheduler(warehouseManager, warehouserBot);
    const env = new WarehouseTrainingEnv(warehouseManager, warehouserBot, scheduler);
    const agent = new RuleBasedAgent();

    // 训练
    trainAgent(agent, env, 100);
  });

  bot.on('error', (err) => {
    console.error('❌ Bot 连接错误:', err);
  });
}

// ============ 主入口 ============

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--real')) {
    trainInRealEnv();
  } else {
    // 默认：模拟环境对比
    compareAgents();
  }
}

module.exports = { trainAgent, RuleBasedAgent, RandomAgent };

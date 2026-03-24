/**
 * 仓库员机器人 (纯执行器)
 * 只负责基础动作：移动、取物、放物
 * 所有智能决策由 AI 调度器完成
 */
class WarehouserBot {
  constructor(mineflayerBot, warehouseManager) {
    this.bot = mineflayerBot;
    this.warehouseManager = warehouseManager;
    this.isBusy = false;
    this.currentAction = null;

    // 加载 pathfinder 插件（仅在真实bot环境中）
    if (this.bot.loadPlugin && typeof this.bot.loadPlugin === 'function') {
      try {
        this.bot.loadPlugin(require('mineflayer-pathfinder').pathfinder);
        this.goals = require('mineflayer-pathfinder').goals;
      } catch (error) {
        console.warn('[Warehouser] ⚠️  Failed to load pathfinder plugin:', error.message);
      }
    }

    console.log(`[Warehouser] ${this.bot.username} initialized (executor only)`);
  }

  // ============ 统一执行接口 ============

  /**
   * 统一执行接口 - 解析参数并调用相应方法
   * @param {Object|string} action - 动作对象或动作名称
   * @param {Object} options - 参数选项
   * @returns {Promise<Object>} 执行结果
   *
   * 支持的格式：
   * 1. execute('moveTo', { x, y, z })
   * 2. execute('withdraw', { chestPosition, itemType, quantity })
   * 3. execute({ type: 'moveTo', x, y, z })
   * 4. execute({ type: 'withdraw', chestPosition, itemType, quantity })
   */
  async execute(action, options = {}) {
    try {
      // 解析动作和参数
      const { actionType, params } = this._parseAction(action, options);

      console.log(`[Warehouser] 🎯 Executing: ${actionType}`);
      console.log(`[Warehouser] 📋 Params:`, JSON.stringify(params).substring(0, 100));

      // 调用对应方法
      const result = await this._dispatchAction(actionType, params);

      console.log(`[Warehouser] ✅ Action completed: ${actionType}`);
      return { success: true, actionType, result };

    } catch (error) {
      console.error(`[Warehouser] ❌ Action failed:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 批量执行动作
   * @param {Array} actions - 动作数组
   * @returns {Promise<Array>} 执行结果数组
   */
  async executeBatch(actions) {
    console.log(`[Warehouser] 📦 Executing batch: ${actions.length} actions`);

    const results = [];
    for (let i = 0; i < actions.length; i++) {
      console.log(`[Warehouser] 🔄 Action ${i + 1}/${actions.length}`);
      const result = await this.execute(actions[i]);
      results.push(result);

      // 如果失败且不是最后一步，可以选择停止或继续
      if (!result.success && i < actions.length - 1) {
        console.warn(`[Warehouser] ⚠️  Action failed, continuing with next action`);
      }
    }

    return results;
  }

  // ============ 参数解析 ============

  /**
   * 解析动作和参数
   * @private
   */
  _parseAction(action, options) {
    let actionType, params;

    // 格式1: execute('moveTo', { x, y, z })
    if (typeof action === 'string') {
      actionType = action;
      params = options;
    }
    // 格式2: execute({ type: 'moveTo', x, y, z })
    else if (typeof action === 'object' && action.type) {
      actionType = action.type;
      params = { ...action };
      delete params.type; // 移除type字段，保留其他参数
    }
    // 格式3: execute({ type: 'withdraw', chestPosition: {...}, ... })
    else if (typeof action === 'object') {
      // 如果没有明确的type字段，尝试推断
      actionType = this._inferActionType(action);
      params = action;
    }
    else {
      throw new Error(`Invalid action format: ${JSON.stringify(action)}`);
    }

    // 参数验证和归一化
    params = this._normalizeParams(actionType, params);

    return { actionType, params };
  }

  /**
   * 推断动作类型
   * @private
   */
  _inferActionType(action) {
    if (action.x !== undefined && action.y !== undefined && action.z !== undefined) {
      return 'moveTo';
    }
    if (action.chestPosition && action.itemType && action.withdraw) {
      return 'withdrawFromChest';
    }
    if (action.chestPosition && action.itemType && action.deposit) {
      return 'depositToChest';
    }
    if (action.source && action.destination && action.items) {
      return 'transfer';
    }
    if (action.destination && action.requiredItems) {
      return 'dispatch';
    }

    throw new Error(`Cannot infer action type from: ${JSON.stringify(action)}`);
  }

  /**
   * 归一化参数
   * @private
   */
  _normalizeParams(actionType, params) {
    switch (actionType) {
      case 'moveTo':
        // 支持多种位置格式
        if (params.position) {
          return params.position;
        }
        if (params.location) {
          return params.location;
        }
        if (params.x !== undefined) {
          return { x: params.x, y: params.y, z: params.z };
        }
        throw new Error('Missing position parameters');

      case 'withdrawFromChest':
      case 'depositToChest':
        // 确保必需参数存在
        if (!params.chestPosition) throw new Error('Missing chestPosition');
        if (!params.itemType) throw new Error('Missing itemType');
        if (!params.quantity) throw new Error('Missing quantity');
        return params;

      case 'transfer':
        // 传递给调度器
        return params;

      case 'dispatch':
        // 传递给调度器
        return params;

      default:
        return params;
    }
  }

  /**
   * 分发动作到对应方法
   * @private
   */
  async _dispatchAction(actionType, params) {
    switch (actionType) {
      case 'moveTo':
        return await this.moveTo(params);

      case 'withdrawFromChest':
      case 'withdraw':
        return await this.withdrawFromChest(params.chestPosition, params.itemType, params.quantity);

      case 'depositToChest':
      case 'deposit':
        return await this.depositToChest(params.chestPosition, params.itemType, params.quantity);

      case 'moveInventoryToChest':
        return await this.moveInventoryToChest(params.itemType, params.quantity, params.chestPosition);

      case 'moveChestToInventory':
        return await this.moveChestToInventory(params.chestPosition, params.itemType, params.quantity);

      case 'wait':
        if (params.duration) {
          await this.sleep(params.duration);
          return { waited: params.duration };
        }
        return await this.waitUntilIdle();

      case 'getStatus':
        return this.getStatus();

      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
  }

  // ============ 基础动作方法 ============

  /**
   * 移动到指定位置
   * @param {Object} location - 目标位置 {x, y, z}
   */
  async moveTo(location) {
    const { x, y, z } = location;

    console.log(`[Warehouser] 🚶 Moving to ${x}, ${y}, ${z}`);

    const goal = new this.goals.GoalBlock(x, y, z);

    try {
      await this.bot.pathfinder.goto(goal);
      console.log(`[Warehouser] ✅ Arrived at ${x}, ${y}, ${z}`);
      return { success: true, position: { x, y, z } };
    } catch (error) {
      console.error(`[Warehouser] ❌ Navigation failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 从指定箱子取出物品
   * @param {Object} chestPosition - 箱子位置 {x, y, z}
   * @param {string} itemType - 物品类型
   * @param {number} quantity - 数量
   */
  async withdrawFromChest(chestPosition, itemType, quantity) {
    this.isBusy = true;
    this.currentAction = {
      type: 'withdraw',
      chestPosition,
      itemType,
      quantity
    };

    try {
      console.log(`[Warehouser] 📤 Withdrawing ${quantity}x ${itemType} from chest at ${JSON.stringify(chestPosition)}`);

      // 移动到箱子位置
      await this.moveTo(chestPosition);

      // 打开箱子
      const chest = await this.openChest(chestPosition);
      if (!chest) {
        throw new Error('Failed to open chest');
      }

      // 取出物品
      const item = chest.items().find(item => item && item.name === itemType);
      if (!item) {
        chest.close();
        throw new Error(`Item ${itemType} not found in chest`);
      }

      // 计算实际可取数量
      const toWithdraw = Math.min(quantity, item.count);
      await chest.withdraw(item.type, null, toWithdraw);

      // 关闭箱子
      chest.close();

      console.log(`[Warehouser] ✅ Withdrew ${toWithdraw}x ${itemType}`);
      return { success: true, itemType, quantity: toWithdraw };

    } catch (error) {
      console.error(`[Warehouser] ❌ Withdraw failed: ${error.message}`);
      return { success: false, error: error.message };
    } finally {
      this.isBusy = false;
      this.currentAction = null;
    }
  }

  /**
   * 将物品放入指定箱子
   * @param {Object} chestPosition - 箱子位置 {x, y, z}
   * @param {string} itemType - 物品类型
   * @param {number} quantity - 数量
   */
  async depositToChest(chestPosition, itemType, quantity) {
    this.isBusy = true;
    this.currentAction = {
      type: 'deposit',
      chestPosition,
      itemType,
      quantity
    };

    try {
      console.log(`[Warehouser] 📥 Depositing ${quantity}x ${itemType} to chest at ${JSON.stringify(chestPosition)}`);

      // 移动到箱子位置
      await this.moveTo(chestPosition);

      // 打开箱子
      const chest = await this.openChest(chestPosition);
      if (!chest) {
        throw new Error('Failed to open chest');
      }

      // 放入物品
      const item = this.bot.inventory.items().find(item => item.name === itemType);
      if (!item) {
        chest.close();
        throw new Error(`Item ${itemType} not found in bot inventory`);
      }

      const toDeposit = Math.min(quantity, item.count);
      await chest.deposit(item.type, null, toDeposit);

      // 关闭箱子
      chest.close();

      console.log(`[Warehouser] ✅ Deposited ${toDeposit}x ${itemType}`);
      return { success: true, itemType, quantity: toDeposit };

    } catch (error) {
      console.error(`[Warehouser] ❌ Deposit failed: ${error.message}`);
      return { success: false, error: error.message };
    } finally {
      this.isBusy = false;
      this.currentAction = null;
    }
  }

  /**
   * 从背包中移动物品到箱子
   * @param {string} itemType - 物品类型
   * @param {number} quantity - 数量
   * @param {Object} chestPosition - 箱子位置
   */
  async moveInventoryToChest(itemType, quantity, chestPosition) {
    return await this.depositToChest(chestPosition, itemType, quantity);
  }

  /**
   * 从箱子移动物品到背包
   * @param {Object} chestPosition - 箱子位置
   * @param {string} itemType - 物品类型
   * @param {number} quantity - 数量
   */
  async moveChestToInventory(chestPosition, itemType, quantity) {
    return await this.withdrawFromChest(chestPosition, itemType, quantity);
  }

  // ============ 辅助方法 ============

  /**
   * 打开箱子
   */
  async openChest(chestPosition) {
    // 将普通对象转换为 Vec3 对象
    const { x, y, z } = chestPosition;
    const pos = this.bot.vec3(x, y, z);
    const chestBlock = this.bot.blockAt(pos);

    if (!chestBlock || chestBlock.name !== 'chest') {
      console.error(`[Warehouser] No chest at ${JSON.stringify(chestPosition)}`);
      return null;
    }

    try {
      const chest = await this.bot.openChest(chestBlock);
      return chest;
    } catch (error) {
      console.error(`[Warehouser] Failed to open chest: ${error.message}`);
      return null;
    }
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      username: this.bot.username,
      isBusy: this.isBusy,
      currentAction: this.currentAction,
      position: this.bot.entity.position,
      inventory: this.bot.inventory.items()
    };
  }

  /**
   * 等待空闲
   */
  async waitUntilIdle() {
    while (this.isBusy) {
      await this.sleep(100);
    }
    return { success: true };
  }

  /**
   * 等待指定时间
   */
  async wait(duration) {
    await this.sleep(duration);
    return { success: true, waited: duration };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { WarehouserBot };

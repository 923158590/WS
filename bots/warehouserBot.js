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
      return true;
    } catch (error) {
      console.error(`[Warehouser] ❌ Navigation failed: ${error.message}`);
      return false;
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
      return { itemType, quantity: toWithdraw };

    } catch (error) {
      console.error(`[Warehouser] ❌ Withdraw failed: ${error.message}`);
      return null;
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
      return { itemType, quantity: toDeposit };

    } catch (error) {
      console.error(`[Warehouser] ❌ Deposit failed: ${error.message}`);
      return null;
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
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { WarehouserBot };

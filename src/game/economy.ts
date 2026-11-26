import {
  BATTLE_PASS_PREMIUM_COST_GEMS,
  BATTLE_PASS_TIERS,
  CHARACTER_BOOSTERS,
  CHARACTERS,
  COMPANION_DRONES,
  COSMETICS,
  DISTRICTS,
  GEM_EXCHANGE_PACKS,
  getAllActiveMissions,
  getBattlePassXpForTier,
  MISSIONS,
  PROFILE_AVATARS,
  SKILL_TREE,
  SPECIAL_SHOP_ITEMS,
  VEHICLES,
} from './data';
import {
  BattlePassReward,
  BattlePassState,
  DistrictId,
  PlayerSaveData,
  SpecialItemId,
  UnlockRequirement,
  VehicleId,
  VehicleStats,
} from './types';

export interface EconomyResult {
  ok: boolean;
  reason?: string;
  nextSave: PlayerSaveData;
}

const MAX_HISTORY = 40;

function nowLabel(): string {
  try {
    return new Date().toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Ahora';
  }
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

export function checkUnlockRequirement(
  save: PlayerSaveData,
  req?: UnlockRequirement,
): { met: boolean; current: number; target: number; reason?: string } {
  if (!req) return { met: true, current: 1, target: 1 };
  let current = 0;
  switch (req.type) {
    case 'missions':
      current = save.stats.missionsCompleted;
      break;
    case 'bosses':
      current = save.defeatedBosses.length;
      break;
    case 'distance':
      current = save.stats.totalDistance;
      break;
    case 'level':
      current = save.level;
      break;
    case 'parkourChains':
      current = save.stats.parkourChains ?? 0;
      break;
    case 'achievement':
      current =
        req.achievementId && save.unlockedAchievements.includes(req.achievementId)
          ? 1
          : 0;
      break;
  }
  const met = current >= req.target;
  return {
    met,
    current,
    target: req.target,
    reason: met ? undefined : `Requisito pendiente: ${req.label} (${Math.min(current, req.target)}/${req.target}).`,
  };
}

/**
 * Exponential progressive Revive Token cost within a run:
 * 1st crash -> 1, 2nd -> 2, 3rd -> 4, 4th -> 8, 5th -> 16 ...
 */
export function getReviveCostForAttempt(revivesAlreadyUsedInRun: number): number {
  const safeCount = Math.max(0, Math.floor(revivesAlreadyUsedInRun));
  return Math.pow(2, safeCount);
}

export function getSkillCoinCost(skillId: string, currentLevel: number): number {
  const node = SKILL_TREE.find((s) => s.id === skillId);
  if (!node) return 99999;
  return Math.floor(node.baseCost * Math.pow(1.6, currentLevel));
}

export function getSkillTicketCost(skillId: string, currentLevel: number): number {
  const node = SKILL_TREE.find((s) => s.id === skillId);
  if (!node) return 99;
  return Math.max(1, node.ticketCostPerLevel + Math.floor(currentLevel / 2));
}

export function getVehicleUpgradeCoinCost(
  vehicleId: VehicleId,
  currentLevel: number,
): number {
  const v = VEHICLES.find((x) => x.id === vehicleId);
  const base = v ? Math.max(420, Math.min(1800, Math.floor(v.unlockCostCoins * 0.14))) : 480;
  return Math.floor(base * Math.pow(1.42, currentLevel));
}

export function getVehicleUpgradeTicketCost(currentLevel: number): number {
  return Math.max(1, 1 + Math.floor(currentLevel / 2));
}

export function getEffectiveVehicleStats(
  vehicleId: VehicleId,
  upgradeLevel: number,
): VehicleStats {
  const v = VEHICLES.find((x) => x.id === vehicleId) ?? VEHICLES[0];
  const lvl = Math.max(0, Math.min(v.maxUpgradeLevel, upgradeLevel));
  return {
    speed: Math.min(13, v.baseStats.speed + lvl * 0.45),
    handling: Math.min(13, v.baseStats.handling + lvl * 0.45),
    shield: Math.min(13, v.baseStats.shield + lvl * 0.5),
    boostDuration: Number((v.baseStats.boostDuration + lvl * 0.75).toFixed(1)),
  };
}

export function addBattlePassXp(
  bp: BattlePassState,
  xpDelta: number,
): { nextBp: BattlePassState; leveledUp: boolean } {
  const maxTier = BATTLE_PASS_TIERS.length;
  let level = Math.max(1, Math.min(maxTier, bp.level));
  let xp = Math.max(0, bp.xp + Math.max(0, Math.floor(xpDelta)));
  let leveledUp = false;

  while (level < maxTier) {
    const req = getBattlePassXpForTier(level);
    if (xp < req) break;
    xp -= req;
    level += 1;
    leveledUp = true;
  }
  if (level >= maxTier) {
    xp = Math.min(xp, getBattlePassXpForTier(maxTier));
  }

  return {
    nextBp: {
      ...bp,
      level,
      xp,
    },
    leveledUp,
  };
}

function logTransaction(
  save: PlayerSaveData,
  item: string,
  category: string,
  costText: string,
): void {
  save.transactions = [
    { id: makeId('tx'), date: nowLabel(), item, category, costText },
    ...save.transactions,
  ].slice(0, MAX_HISTORY);
}

function logUpgrade(
  save: PlayerSaveData,
  targetName: string,
  newLevel: number,
  costText: string,
): void {
  save.upgradeHistory = [
    { id: makeId('upg'), date: nowLabel(), targetName, newLevel, costText },
    ...save.upgradeHistory,
  ].slice(0, MAX_HISTORY);
}

export function purchaseCharacter(
  save: PlayerSaveData,
  characterId: string,
  currency: 'coins' | 'gems' = 'coins',
): EconomyResult {
  const ch = CHARACTERS.find((c) => c.id === characterId);
  if (!ch) return { ok: false, reason: 'Personaje inválido.', nextSave: save };

  const next = structuredClone(save);
  if (next.unlockedCharacters.includes(characterId)) {
    next.selectedCharacterId = characterId;
    next.avatarId = characterId;
    return { ok: true, nextSave: next };
  }

  const reqCheck = checkUnlockRequirement(next, ch.unlockRequirement);
  if (!reqCheck.met) {
    return {
      ok: false,
      reason: reqCheck.reason ?? 'Aún no cumples el requisito de desbloqueo.',
      nextSave: save,
    };
  }

  if (currency === 'gems' && ch.unlockCostGems > 0) {
    if (next.gems < ch.unlockCostGems) {
      return { ok: false, reason: 'Moneda G (Gemas) insuficiente.', nextSave: save };
    }
    next.gems -= ch.unlockCostGems;
    logTransaction(next, ch.name, 'Personaje', `${ch.unlockCostGems} G`);
  } else {
    if (next.coins < ch.unlockCostCoins) {
      return { ok: false, reason: 'Monedas insuficientes.', nextSave: save };
    }
    next.coins -= ch.unlockCostCoins;
    next.stats.coinsSpent += ch.unlockCostCoins;
    logTransaction(next, ch.name, 'Personaje', `${ch.unlockCostCoins} M`);
  }

  next.unlockedCharacters.push(characterId);
  next.selectedCharacterId = characterId;
  next.avatarId = characterId;
  return { ok: true, nextSave: next };
}

export function purchaseOrEquipCosmetic(
  save: PlayerSaveData,
  cosmeticId: string,
): EconomyResult {
  const item = COSMETICS.find((c) => c.id === cosmeticId);
  if (!item) return { ok: false, reason: 'Artículo no encontrado.', nextSave: save };

  const next = structuredClone(save);
  if (next.ownedCosmetics.includes(item.id)) {
    next.equippedCosmetics[item.slot] = item.id;
    return { ok: true, nextSave: next };
  }

  if (next.coins < item.costCoins || next.gems < item.costGems) {
    return { ok: false, reason: 'Saldo insuficiente.', nextSave: save };
  }

  next.coins -= item.costCoins;
  next.gems -= item.costGems;
  next.stats.coinsSpent += item.costCoins;
  next.ownedCosmetics.push(item.id);
  next.equippedCosmetics[item.slot] = item.id;

  const costParts: string[] = [];
  if (item.costCoins > 0) costParts.push(`${item.costCoins} M`);
  if (item.costGems > 0) costParts.push(`${item.costGems} G`);
  logTransaction(next, item.name, 'Traje / Aspecto', costParts.join(' + ') || 'Gratis');
  return { ok: true, nextSave: next };
}

export function purchaseSpecialItem(
  save: PlayerSaveData,
  itemId: SpecialItemId,
): EconomyResult {
  const item = SPECIAL_SHOP_ITEMS.find((s) => s.id === itemId);
  if (!item) return { ok: false, reason: 'Objeto especial inválido.', nextSave: save };

  if (save.coins < item.costCoins || save.gems < item.costGems) {
    return { ok: false, reason: 'Saldo insuficiente para comprar este artículo.', nextSave: save };
  }

  const next = structuredClone(save);
  next.coins -= item.costCoins;
  next.gems -= item.costGems;
  next.stats.coinsSpent += item.costCoins;

  if (item.grantCoins) next.coins += item.grantCoins;
  if (item.grantTickets) next.tickets += item.grantTickets;
  if (item.grantReviveTokens) next.reviveTokens += item.grantReviveTokens;
  if (item.grantTalismans) next.talismans += item.grantTalismans;

  const costParts: string[] = [];
  if (item.costCoins > 0) costParts.push(`${item.costCoins} M`);
  if (item.costGems > 0) costParts.push(`${item.costGems} G`);
  logTransaction(next, item.name, 'Objeto Especial', costParts.join(' + '));
  return { ok: true, nextSave: next };
}

export function purchaseOrEquipDrone(
  save: PlayerSaveData,
  droneId: string,
): EconomyResult {
  const drone = COMPANION_DRONES.find((d) => d.id === droneId);
  if (!drone) return { ok: false, reason: 'Dron no encontrado.', nextSave: save };

  const next = structuredClone(save);
  next.ownedDrones = Array.from(new Set(next.ownedDrones ?? ['drone_aegis_mk1']));
  if (next.ownedDrones.includes(drone.id)) {
    next.equippedDroneId = next.equippedDroneId === drone.id ? null : drone.id;
    return { ok: true, nextSave: next };
  }

  if (next.coins < drone.costCoins || next.gems < drone.costGems) {
    return { ok: false, reason: 'Saldo insuficiente para adquirir este Dron.', nextSave: save };
  }
  next.coins -= drone.costCoins;
  next.gems -= drone.costGems;
  next.stats.coinsSpent += drone.costCoins;
  next.ownedDrones.push(drone.id);
  next.equippedDroneId = drone.id;

  const costParts: string[] = [];
  if (drone.costCoins > 0) costParts.push(`${drone.costCoins} M`);
  if (drone.costGems > 0) costParts.push(`${drone.costGems} G`);
  logTransaction(next, drone.name, 'Dron Acompañante', costParts.join(' + ') || 'Gratis');
  return { ok: true, nextSave: next };
}

export function purchaseOrEquipBooster(
  save: PlayerSaveData,
  boosterId: string,
): EconomyResult {
  const booster = CHARACTER_BOOSTERS.find((b) => b.id === boosterId);
  if (!booster) return { ok: false, reason: 'Potenciador no encontrado.', nextSave: save };

  const next = structuredClone(save);
  next.ownedBoosters = Array.from(new Set(next.ownedBoosters ?? []));
  if (next.ownedBoosters.includes(booster.id)) {
    next.equippedBoosterId = next.equippedBoosterId === booster.id ? null : booster.id;
    return { ok: true, nextSave: next };
  }

  if (next.coins < booster.costCoins || next.gems < booster.costGems) {
    return { ok: false, reason: 'Saldo insuficiente para adquirir este Potenciador.', nextSave: save };
  }
  next.coins -= booster.costCoins;
  next.gems -= booster.costGems;
  next.stats.coinsSpent += booster.costCoins;
  next.ownedBoosters.push(booster.id);
  next.equippedBoosterId = booster.id;

  const costParts: string[] = [];
  if (booster.costCoins > 0) costParts.push(`${booster.costCoins} M`);
  if (booster.costGems > 0) costParts.push(`${booster.costGems} G`);
  logTransaction(next, booster.name, 'Potenciador de Personaje', costParts.join(' + ') || 'Gratis');
  return { ok: true, nextSave: next };
}

export function purchaseOrEquipAvatar(
  save: PlayerSaveData,
  avatarId: string,
): EconomyResult {
  const avatar = PROFILE_AVATARS.find((a) => a.id === avatarId);
  if (!avatar) return { ok: false, reason: 'Avatar no encontrado.', nextSave: save };

  const next = structuredClone(save);
  next.ownedAvatars = Array.from(new Set(['av_runner_core', ...(next.ownedAvatars ?? [])]));
  if (next.ownedAvatars.includes(avatar.id)) {
    next.equippedAvatarId = avatar.id;
    return { ok: true, nextSave: next };
  }

  if (avatar.source === 'pass' || avatar.source === 'mission') {
    return {
      ok: false,
      reason:
        avatar.source === 'pass'
          ? 'Se desbloquea exclusivamente en el Pase de Corredor Skyline 8.0.'
          : 'Se desbloquea completando misiones del Protocolo Skyline.',
      nextSave: save,
    };
  }

  if (next.coins < avatar.costCoins || next.gems < avatar.costGems) {
    return { ok: false, reason: 'Saldo insuficiente para comprar este Avatar.', nextSave: save };
  }
  next.coins -= avatar.costCoins;
  next.gems -= avatar.costGems;
  next.stats.coinsSpent += avatar.costCoins;
  next.ownedAvatars.push(avatar.id);
  next.equippedAvatarId = avatar.id;

  const costParts: string[] = [];
  if (avatar.costCoins > 0) costParts.push(`${avatar.costCoins} M`);
  if (avatar.costGems > 0) costParts.push(`${avatar.costGems} G`);
  logTransaction(next, avatar.name, 'Avatar Perfil', costParts.join(' + ') || 'Gratis');
  return { ok: true, nextSave: next };
}

export function exchangeGemsForCoins(
  save: PlayerSaveData,
  packId: string,
): EconomyResult {
  const pack = GEM_EXCHANGE_PACKS.find((p) => p.id === packId);
  if (!pack) return { ok: false, reason: 'Paquete de cambio inválido.', nextSave: save };
  if (save.gems < pack.costGems) {
    return {
      ok: false,
      reason: `Moneda G insuficiente (${save.gems}/${pack.costGems} G).`,
      nextSave: save,
    };
  }
  const next = structuredClone(save);
  next.gems -= pack.costGems;
  next.coins += pack.grantCoins;
  logTransaction(next, `${pack.grantCoins} Monedas`, 'Banco G -> M', `${pack.costGems} G`);
  return { ok: true, nextSave: next };
}

export function purchaseOrSelectVehicle(
  save: PlayerSaveData,
  vehicleId: VehicleId,
): EconomyResult {
  const v = VEHICLES.find((x) => x.id === vehicleId);
  if (!v) return { ok: false, reason: 'Vehículo inválido.', nextSave: save };

  const next = structuredClone(save);
  if (next.ownedVehicles.includes(vehicleId)) {
    next.selectedVehicleId = vehicleId;
    return { ok: true, nextSave: next };
  }

  const reqCheck = checkUnlockRequirement(next, v.unlockRequirement);
  if (!reqCheck.met) {
    return {
      ok: false,
      reason: reqCheck.reason ?? 'Requisito previo no cumplido.',
      nextSave: save,
    };
  }

  if (next.coins < v.unlockCostCoins || next.gems < v.unlockCostGems) {
    return { ok: false, reason: 'Saldo insuficiente para desbloquear vehículo.', nextSave: save };
  }

  next.coins -= v.unlockCostCoins;
  next.gems -= v.unlockCostGems;
  next.stats.coinsSpent += v.unlockCostCoins;
  next.ownedVehicles.push(vehicleId);
  next.selectedVehicleId = vehicleId;
  if (next.vehicleUpgrades[vehicleId] === undefined) {
    next.vehicleUpgrades[vehicleId] = 0;
  }
  if (!next.vehiclePaints[vehicleId]) {
    next.vehiclePaints[vehicleId] = v.defaultPaint;
  }

  const costParts: string[] = [];
  if (v.unlockCostCoins > 0) costParts.push(`${v.unlockCostCoins} M`);
  if (v.unlockCostGems > 0) costParts.push(`${v.unlockCostGems} G`);
  logTransaction(next, v.name, 'Vehículo Garaje', costParts.join(' + ') || 'Gratis');
  return { ok: true, nextSave: next };
}

export function upgradeVehicle(
  save: PlayerSaveData,
  vehicleId: VehicleId,
  payWith: 'coins' | 'tickets',
): EconomyResult {
  const v = VEHICLES.find((x) => x.id === vehicleId);
  if (!v) return { ok: false, reason: 'Vehículo no encontrado.', nextSave: save };
  if (!save.ownedVehicles.includes(vehicleId)) {
    return { ok: false, reason: 'Debes desbloquear el vehículo primero.', nextSave: save };
  }

  const curLvl = save.vehicleUpgrades[vehicleId] ?? 0;
  if (curLvl >= v.maxUpgradeLevel) {
    return { ok: false, reason: 'Vehículo ya en nivel máximo.', nextSave: save };
  }

  const next = structuredClone(save);
  if (payWith === 'tickets') {
    const tCost = getVehicleUpgradeTicketCost(curLvl);
    if (next.tickets < tCost) {
      return { ok: false, reason: 'Tiques de mejora insuficientes.', nextSave: save };
    }
    next.tickets -= tCost;
    next.vehicleUpgrades[vehicleId] = curLvl + 1;
    logUpgrade(next, v.name, curLvl + 1, `${tCost} Tiques`);
  } else {
    const cCost = getVehicleUpgradeCoinCost(vehicleId, curLvl);
    if (next.coins < cCost) {
      return { ok: false, reason: 'Monedas insuficientes.', nextSave: save };
    }
    next.coins -= cCost;
    next.stats.coinsSpent += cCost;
    next.vehicleUpgrades[vehicleId] = curLvl + 1;
    logUpgrade(next, v.name, curLvl + 1, `${cCost} M`);
  }

  return { ok: true, nextSave: next };
}

export function setVehiclePaint(
  save: PlayerSaveData,
  vehicleId: VehicleId,
  paintHex: string,
): PlayerSaveData {
  const next = structuredClone(save);
  next.vehiclePaints[vehicleId] = paintHex;
  return next;
}

export function upgradeSkill(
  save: PlayerSaveData,
  skillId: string,
  payWith: 'coins' | 'tickets',
): EconomyResult {
  const node = SKILL_TREE.find((s) => s.id === skillId);
  if (!node) return { ok: false, reason: 'Habilidad no encontrada.', nextSave: save };

  const curLvl = save.skillLevels[skillId] ?? 0;
  if (curLvl >= node.maxLevel) {
    return { ok: false, reason: 'Habilidad ya al nivel máximo.', nextSave: save };
  }

  const next = structuredClone(save);
  if (payWith === 'tickets') {
    const tCost = getSkillTicketCost(skillId, curLvl);
    if (next.tickets < tCost) {
      return { ok: false, reason: 'Tiques de mejora insuficientes.', nextSave: save };
    }
    next.tickets -= tCost;
    next.skillLevels[skillId] = curLvl + 1;
    logUpgrade(next, node.name, curLvl + 1, `${tCost} Tiques`);
  } else {
    const cCost = getSkillCoinCost(skillId, curLvl);
    if (next.coins < cCost) {
      return { ok: false, reason: 'Monedas insuficientes.', nextSave: save };
    }
    next.coins -= cCost;
    next.stats.coinsSpent += cCost;
    next.skillLevels[skillId] = curLvl + 1;
    logUpgrade(next, node.name, curLvl + 1, `${cCost} M`);
  }
  return { ok: true, nextSave: next };
}

export function unlockOrSelectDistrict(
  save: PlayerSaveData,
  districtId: DistrictId,
): EconomyResult {
  const dist = DISTRICTS.find((d) => d.id === districtId);
  if (!dist) return { ok: false, reason: 'Distrito no encontrado.', nextSave: save };

  const next = structuredClone(save);
  if (next.unlockedDistricts.includes(districtId)) {
    next.selectedDistrictId = districtId;
    return { ok: true, nextSave: next };
  }

  if (next.coins < dist.unlockCostCoins) {
    return { ok: false, reason: 'Monedas insuficientes.', nextSave: save };
  }
  next.coins -= dist.unlockCostCoins;
  next.stats.coinsSpent += dist.unlockCostCoins;
  next.unlockedDistricts.push(districtId);
  next.selectedDistrictId = districtId;
  logTransaction(next, dist.name, 'Distrito', `${dist.unlockCostCoins} M`);
  return { ok: true, nextSave: next };
}

/**
 * 3.0.1 Rule: Premium Battle Pass MUST ONLY be purchased with Moneda G (Gems).
 */
export function unlockPremiumBattlePass(
  save: PlayerSaveData,
  payWith: 'coins' | 'gems' = 'gems',
): EconomyResult {
  if (save.battlePass.premiumUnlocked) {
    return { ok: false, reason: 'Pase de Corredor Premium ya desbloqueado.', nextSave: save };
  }
  if (payWith !== 'gems') {
    return {
      ok: false,
      reason: 'El Pase de Corredor Premium solo puede adquirirse exclusivamente con Moneda G (Gemas).',
      nextSave: save,
    };
  }
  const next = structuredClone(save);
  if (next.gems < BATTLE_PASS_PREMIUM_COST_GEMS) {
    return {
      ok: false,
      reason: `Moneda G insuficiente (${next.gems}/${BATTLE_PASS_PREMIUM_COST_GEMS} G requeridos).`,
      nextSave: save,
    };
  }
  next.gems -= BATTLE_PASS_PREMIUM_COST_GEMS;
  logTransaction(
    next,
    'Pase de Corredor Premium 8.0',
    'Pase de Corredor',
    `${BATTLE_PASS_PREMIUM_COST_GEMS} G`,
  );
  next.battlePass.premiumUnlocked = true;
  return { ok: true, nextSave: next };
}

function grantBattlePassRewardToSave(
  save: PlayerSaveData,
  reward: BattlePassReward,
): void {
  switch (reward.type) {
    case 'coins':
      save.coins += reward.amount ?? 0;
      break;
    case 'gems':
      save.gems += reward.amount ?? 0;
      break;
    case 'tickets':
      save.tickets += reward.amount ?? 0;
      break;
    case 'reviveTokens':
      save.reviveTokens += reward.amount ?? 0;
      break;
    case 'talismans':
      save.talismans += reward.amount ?? 0;
      break;
    case 'cosmetic':
      if (reward.itemId && !save.ownedCosmetics.includes(reward.itemId)) {
        save.ownedCosmetics.push(reward.itemId);
      } else {
        save.coins += 500;
      }
      if (reward.amount && reward.amount > 0) {
        save.talismans += reward.amount;
      }
      break;
    case 'vehicle':
      if (
        reward.itemId &&
        !save.ownedVehicles.includes(reward.itemId as VehicleId)
      ) {
        const vid = reward.itemId as VehicleId;
        const vDef = VEHICLES.find((v) => v.id === vid);
        save.ownedVehicles.push(vid);
        save.vehicleUpgrades[vid] = save.vehicleUpgrades[vid] ?? 0;
        if (vDef && !save.vehiclePaints[vid]) {
          save.vehiclePaints[vid] = vDef.defaultPaint;
        }
      } else {
        save.coins += 1200;
      }
      break;
    case 'character':
      if (reward.itemId && !save.unlockedCharacters.includes(reward.itemId)) {
        save.unlockedCharacters.push(reward.itemId);
      } else {
        save.gems += 20;
      }
      break;
    case 'avatar':
      if (reward.itemId) {
        save.ownedAvatars = Array.from(new Set([...(save.ownedAvatars ?? []), reward.itemId]));
      }
      break;
    case 'drone':
      if (reward.itemId) {
        save.ownedDrones = Array.from(new Set([...(save.ownedDrones ?? []), reward.itemId]));
      }
      break;
    case 'booster':
      if (reward.itemId) {
        save.ownedBoosters = Array.from(new Set([...(save.ownedBoosters ?? []), reward.itemId]));
      }
      break;
  }
}

export function claimBattlePassReward(
  save: PlayerSaveData,
  tier: number,
  track: 'free' | 'premium',
): EconomyResult {
  const tierDef = BATTLE_PASS_TIERS.find((t) => t.tier === tier);
  if (!tierDef) return { ok: false, reason: 'Nivel de pase inválido.', nextSave: save };
  if (save.battlePass.level < tier) {
    return { ok: false, reason: 'Aún no has alcanzado este nivel.', nextSave: save };
  }
  if (track === 'premium' && !save.battlePass.premiumUnlocked) {
    return { ok: false, reason: 'Requiere Pase Premium (Moneda G).', nextSave: save };
  }

  const claimedArr =
    track === 'free'
      ? save.battlePass.claimedFreeTiers
      : save.battlePass.claimedPremiumTiers;
  if (claimedArr.includes(tier)) {
    return { ok: false, reason: 'Recompensa ya reclamada.', nextSave: save };
  }

  const next = structuredClone(save);
  if (track === 'free') {
    next.battlePass.claimedFreeTiers.push(tier);
    grantBattlePassRewardToSave(next, tierDef.freeReward);
  } else {
    next.battlePass.claimedPremiumTiers.push(tier);
    grantBattlePassRewardToSave(next, tierDef.premiumReward);
  }
  return { ok: true, nextSave: next };
}

export function claimAllBattlePassRewards(save: PlayerSaveData): EconomyResult {
  let current = save;
  let claimedAny = false;
  for (const tierDef of BATTLE_PASS_TIERS) {
    if (current.battlePass.level < tierDef.tier) break;
    if (!current.battlePass.claimedFreeTiers.includes(tierDef.tier)) {
      const r = claimBattlePassReward(current, tierDef.tier, 'free');
      if (r.ok) {
        current = r.nextSave;
        claimedAny = true;
      }
    }
    if (
      current.battlePass.premiumUnlocked &&
      !current.battlePass.claimedPremiumTiers.includes(tierDef.tier)
    ) {
      const r = claimBattlePassReward(current, tierDef.tier, 'premium');
      if (r.ok) {
        current = r.nextSave;
        claimedAny = true;
      }
    }
  }
  return { ok: claimedAny, nextSave: current };
}

export function claimMissionReward(
  save: PlayerSaveData,
  missionId: string,
): EconomyResult {
  const m = MISSIONS.find((x) => x.id === missionId);
  if (!m) return { ok: false, reason: 'Misión no encontrada.', nextSave: save };
  if (save.completedMissions.includes(missionId)) {
    return { ok: false, reason: 'Misión ya reclamada.', nextSave: save };
  }
  const progress = save.missionProgress[missionId] ?? 0;
  if (progress < m.target && !save.claimableMissions.includes(missionId)) {
    return { ok: false, reason: 'Misión aún incompleta.', nextSave: save };
  }

  const next = structuredClone(save);
  next.claimableMissions = next.claimableMissions.filter((id) => id !== missionId);
  next.completedMissions.push(missionId);
  next.coins += m.rewardCoins;
  next.gems += m.rewardGems;
  next.xp += m.rewardXp;
  if (m.rewardTickets) next.tickets += m.rewardTickets;
  if (m.rewardReviveTokens) next.reviveTokens += m.rewardReviveTokens;
  if (m.rewardTalismans) next.talismans += m.rewardTalismans;
  if (m.rewardBpXp) {
    next.battlePass = addBattlePassXp(next.battlePass, m.rewardBpXp).nextBp;
  }

  next.stats.missionsCompleted += 1;
  if (m.category === 'season' || m.category === 'special') {
    next.stats.challengesCompleted += 1;
  }
  if (m.id === 'weekly_w6_norevive') {
    next.ownedAvatars = Array.from(new Set([...(next.ownedAvatars ?? []), 'av_mission_rookie']));
  }
  if (m.category === 'story' && m.chapter && m.chapter >= next.storyChapter) {
    next.storyChapter = Math.min(5, m.chapter + 1);
  }

  return { ok: true, nextSave: next };
}

export function claimAllMissions(save: PlayerSaveData): EconomyResult {
  let current = save;
  let claimedAny = false;
  const active = getAllActiveMissions(current.seasonStartAtMs);
  for (const m of active) {
    if (current.completedMissions.includes(m.id)) continue;
    if (
      current.claimableMissions.includes(m.id) ||
      (current.missionProgress[m.id] ?? 0) >= m.target
    ) {
      const r = claimMissionReward(current, m.id);
      if (r.ok) {
        current = r.nextSave;
        claimedAny = true;
      }
    }
  }
  return { ok: claimedAny, nextSave: current };
}

export function consumeReviveTokens(
  save: PlayerSaveData,
  cost: number,
): EconomyResult {
  const safeCost = Math.max(1, Math.floor(cost));
  if (save.reviveTokens < safeCost) {
    return { ok: false, reason: 'Tokens de revivir insuficientes.', nextSave: save };
  }
  const next = structuredClone(save);
  next.reviveTokens -= safeCost;
  next.stats.revivesUsed += 1;
  return { ok: true, nextSave: next };
}

export function consumeTalisman(save: PlayerSaveData): EconomyResult {
  if (save.talismans < 1) {
    return { ok: false, reason: 'Sin talismanes disponibles.', nextSave: save };
  }
  const next = structuredClone(save);
  next.talismans -= 1;
  next.stats.revivesUsed += 1;
  return { ok: true, nextSave: next };
}

export function getPendingRewardCount(save: PlayerSaveData): {
  missions: number;
  battlePass: number;
  total: number;
} {
  const activeMissions = getAllActiveMissions(save.seasonStartAtMs);
  const missions = activeMissions.filter(
    (m) =>
      !save.completedMissions.includes(m.id) &&
      (save.claimableMissions.includes(m.id) ||
        (save.missionProgress[m.id] ?? 0) >= m.target),
  ).length;

  let battlePass = 0;
  for (const tierDef of BATTLE_PASS_TIERS) {
    if (save.battlePass.level < tierDef.tier) break;
    if (!save.battlePass.claimedFreeTiers.includes(tierDef.tier)) battlePass++;
    if (
      save.battlePass.premiumUnlocked &&
      !save.battlePass.claimedPremiumTiers.includes(tierDef.tier)
    ) {
      battlePass++;
    }
  }

  return { missions, battlePass, total: missions + battlePass };
}

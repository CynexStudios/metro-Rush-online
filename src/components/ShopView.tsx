import React, { useState } from 'react';
import {
  Check,
  Coins,
  Gem,
  Lock,
  Receipt,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Ticket,
  UserCheck,
  Zap,
} from 'lucide-react';
import { audioEngine } from '../game/audio';
import {
  CHARACTERS,
  COSMETICS,
  getCharacterById,
  SKILL_TREE,
  SPECIAL_SHOP_ITEMS,
} from '../game/data';
import {
  checkUnlockRequirement,
  getSkillCoinCost,
  getSkillTicketCost,
  purchaseCharacter,
  purchaseOrEquipCosmetic,
  purchaseSpecialItem,
  upgradeSkill,
} from '../game/economy';
import { ExtraGlbId } from '../game/gltfAssets';
import {
  CosmeticSlot,
  PlayerSaveData,
  SpecialItemId,
} from '../game/types';
import { ModelPreview3D, ModelPreview3DProps } from './ModelPreview3D';

type ShopTab = 'characters' | 'cosmetics' | 'upgrades' | 'specials';

interface ShopViewProps {
  save: PlayerSaveData;
  onUpdateSave: (next: PlayerSaveData) => void;
}

interface PendingConfirm {
  title: string;
  subtitle: string;
  costLabel: string;
  onConfirm: () => { ok: boolean; reason?: string; nextSave: PlayerSaveData };
}

const SLOT_LABELS: Record<CosmeticSlot, string> = {
  jacket: 'Chaquetas',
  visor: 'Visores',
  sneakers: 'Calzado',
  backpack: 'Mochilas',
  hair: 'Estilos / Cascos',
  trail: 'Estelas Neón',
};

const GLB_RELIC_CATALOG: { id: ExtraGlbId; name: string; desc: string; accent: string }[] = [
  { id: 'fox', name: 'Zorro Cyber (.GLB)', desc: 'Acompañante animado real integrado en pista.', accent: '#f97316' },
  { id: 'helmet', name: 'Casco Battle-Damaged (.GLB)', desc: 'Reliquia PBR metálica de alta fidelidad.', accent: '#22d3ee' },
  { id: 'ion_drive', name: 'Propulsor Iónico (.GLB)', desc: 'Núcleo energético de alta potencia.', accent: '#a855f7' },
  { id: 'milk_truck', name: 'Unidad Logística (.GLB)', desc: 'Vehículo pesado de tráfico urbano.', accent: '#eab308' },
];

export const ShopView: React.FC<ShopViewProps> = ({ save, onUpdateSave }) => {
  const [subTab, setSubTab] = useState<ShopTab>('characters');
  const [slotFilter, setSlotFilter] = useState<CosmeticSlot | 'all'>('all');
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'ok' | 'err';
    msg: string;
  } | null>(null);

  const [inspected, setInspected] = useState<ModelPreview3DProps>(() => ({
    kind: 'character',
    itemId: save.selectedCharacterId,
    characterId: save.selectedCharacterId,
    title: getCharacterById(save.selectedCharacterId).name,
    subtitle: getCharacterById(save.selectedCharacterId).title,
    accentColor: getCharacterById(save.selectedCharacterId).colors.accent,
  }));

  const notify = (type: 'ok' | 'err', msg: string) => {
    setFeedback({ type, msg });
  };

  const executeConfirm = () => {
    if (!pending) return;
    const res = pending.onConfirm();
    if (res.ok) {
      audioEngine.playPurchaseConfirm();
      onUpdateSave(res.nextSave);
      notify('ok', `Adquisición completada: ${pending.title}`);
    } else {
      audioEngine.playUiClick();
      notify('err', res.reason ?? 'No se pudo completar la compra.');
    }
    setPending(null);
  };

  const subTabs: { id: ShopTab; label: string; count?: string }[] = [
    {
      id: 'characters',
      label: 'Personajes',
      count: `${save.unlockedCharacters.length}/${CHARACTERS.length}`,
    },
    {
      id: 'cosmetics',
      label: 'Trajes y Aspectos',
      count: `${save.ownedCosmetics.length}/${COSMETICS.length}`,
    },
    { id: 'upgrades', label: 'Tiques y Mejoras' },
    { id: 'specials', label: 'Objetos Especiales' },
  ];

  const switchSubTab = (next: ShopTab) => {
    audioEngine.playUiClick();
    setSubTab(next);
    if (next === 'characters') {
      const ch = getCharacterById(save.selectedCharacterId);
      setInspected({
        kind: 'character',
        itemId: ch.id,
        characterId: ch.id,
        title: ch.name,
        subtitle: ch.title,
        accentColor: ch.colors.accent,
      });
    } else if (next === 'cosmetics') {
      const firstCos = COSMETICS[0];
      setInspected({
        kind: 'cosmetic',
        itemId: firstCos.id,
        title: firstCos.name,
        subtitle: `${SLOT_LABELS[firstCos.slot]} · ${firstCos.rarity}`,
        accentColor: firstCos.color,
      });
    } else if (next === 'upgrades') {
      const node = SKILL_TREE[0];
      setInspected({
        kind: 'skill',
        itemId: node.id,
        title: node.name,
        subtitle: node.effectPerLevel,
        accentColor: '#22d3ee',
      });
    } else {
      const sp = SPECIAL_SHOP_ITEMS[0];
      setInspected({
        kind: 'special',
        itemId: sp.id,
        title: sp.name,
        subtitle: sp.rarity,
        accentColor: '#f59e0b',
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Store Header + Currencies */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-3.5">
        <div>
          <div className="text-[11px] font-bold tracking-wider text-amber-400">
            Mercado Cibernético Oficial
          </div>
          <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-400" />
            Tienda 3D de Neon City
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-[#0b1224] border border-white/15 rounded-xl px-4 py-2 text-xs font-mono-num">
          <span className="text-amber-400 font-bold">
            {save.coins.toLocaleString('es-ES')} M
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-fuchsia-400 font-bold">{save.gems} G</span>
          <span className="text-slate-600">·</span>
          <span className="text-cyan-300 font-bold">{save.tickets} Tiques</span>
          <span className="text-slate-600">·</span>
          <span className="text-emerald-300 font-bold">
            {save.reviveTokens} Revivir
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-amber-200 font-bold">
            {save.talismans} Talismanes
          </span>
        </div>
      </div>

      {/* Store Category Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {subTabs.map((tItem) => {
            const active = subTab === tItem.id;
            return (
              <button
                key={tItem.id}
                onClick={() => switchSubTab(tItem.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-amber-400 text-slate-950 border-amber-400'
                    : 'bg-[#0b1224] text-slate-300 border-white/10 hover:border-white/30 hover:text-white'
                }`}
              >
                {tItem.label}
                {tItem.count ? ` (${tItem.count})` : ''}
              </button>
            );
          })}
        </div>

        {feedback && (
          <div
            className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold ${
              feedback.type === 'ok'
                ? 'bg-emerald-950/50 border-emerald-400/50 text-emerald-200'
                : 'bg-rose-950/50 border-rose-400/50 text-rose-200'
            }`}
          >
            {feedback.msg}
          </div>
        )}
      </div>

      {/* Main Split: Catalog + Sticky 3D Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5 items-start">
        <div className="space-y-4">
          {/* TAB 1: CHARACTERS */}
          {subTab === 'characters' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {CHARACTERS.map((ch) => {
                const unlocked = save.unlockedCharacters.includes(ch.id);
                const selected = save.selectedCharacterId === ch.id;
                const reqCheck = checkUnlockRequirement(save, ch.unlockRequirement);
                const canCoins = reqCheck.met && save.coins >= ch.unlockCostCoins;
                const canGems =
                  reqCheck.met && ch.unlockCostGems > 0 && save.gems >= ch.unlockCostGems;
                const isInspected = inspected.itemId === ch.id && inspected.kind === 'character';

                return (
                  <div
                    key={ch.id}
                    onClick={() =>
                      setInspected({
                        kind: 'character',
                        itemId: ch.id,
                        characterId: ch.id,
                        title: ch.name,
                        subtitle: `${ch.origin} · ${ch.title}`,
                        accentColor: ch.colors.accent,
                      })
                    }
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 cursor-pointer transition-colors ${
                      selected
                        ? 'bg-[#0d192f] border-cyan-400/70'
                        : isInspected
                          ? 'bg-[#0e1529] border-amber-400/50'
                          : 'bg-[#0b1224] border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-cyan-300">
                          {ch.origin} · {ch.title}
                        </span>
                        <span
                          className="w-4 h-4 rounded-full border border-white/30"
                          style={{ backgroundColor: ch.colors.jacket }}
                        />
                      </div>
                      <div className="font-display text-lg font-bold text-white">
                        {ch.name}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2">{ch.bio}</p>
                      <div className="text-[11px] text-fuchsia-300 font-semibold pt-1">
                        Activa: {ch.abilityName} (CD {ch.abilityCooldown}s)
                      </div>
                      {ch.passiveName && (
                        <div className="text-[11px] text-emerald-300">
                          Pasiva: {ch.passiveName}
                        </div>
                      )}
                      {!unlocked && ch.unlockRequirement && (
                        <div
                          className={`mt-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center justify-between gap-2 ${
                            reqCheck.met
                              ? 'bg-emerald-950/35 border-emerald-400/40 text-emerald-200'
                              : 'bg-amber-950/35 border-amber-400/40 text-amber-200'
                          }`}
                        >
                          <span className="flex items-center gap-1 truncate">
                            <Lock className="w-3 h-3 shrink-0" />
                            {ch.unlockRequirement.label}
                          </span>
                          <span className="font-mono-num shrink-0">
                            {Math.min(reqCheck.current, reqCheck.target)}/{reqCheck.target}
                          </span>
                        </div>
                      )}
                    </div>

                    <div
                      className="pt-2.5 border-t border-white/10 flex items-center justify-between gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {unlocked ? (
                        <button
                          onClick={() => {
                            const res = purchaseCharacter(save, ch.id);
                            if (res.ok) {
                              audioEngine.playUiClick(true);
                              onUpdateSave(res.nextSave);
                            }
                          }}
                          className={`w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                            selected
                              ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-200'
                              : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                        >
                          {selected ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> Equipado en Lobby
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5" /> Equipar Corredor
                            </>
                          )}
                        </button>
                      ) : (
                        <>
                          <button
                            disabled={!canCoins}
                            onClick={() =>
                              setPending({
                                title: ch.name,
                                subtitle: `Desbloquear corredor ${ch.title}`,
                                costLabel: `${ch.unlockCostCoins.toLocaleString('es-ES')} Monedas`,
                                onConfirm: () => purchaseCharacter(save, ch.id, 'coins'),
                              })
                            }
                            className="flex-1 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold font-mono-num cursor-pointer disabled:cursor-not-allowed"
                          >
                            {!reqCheck.met
                              ? `Req. (${Math.min(reqCheck.current, reqCheck.target)}/${reqCheck.target})`
                              : `${ch.unlockCostCoins.toLocaleString('es-ES')} M`}
                          </button>
                          {ch.unlockCostGems > 0 && (
                            <button
                              disabled={!canGems}
                              onClick={() =>
                                setPending({
                                  title: ch.name,
                                  subtitle: `Desbloquear corredor ${ch.title}`,
                                  costLabel: `${ch.unlockCostGems} Gemas`,
                                  onConfirm: () => purchaseCharacter(save, ch.id, 'gems'),
                                })
                              }
                              className="px-3 py-2 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold font-mono-num cursor-pointer disabled:cursor-not-allowed"
                            >
                              {ch.unlockCostGems} G
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: COSMETICS */}
          {subTab === 'cosmetics' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSlotFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                    slotFilter === 'all'
                      ? 'bg-cyan-400 text-slate-950 border-cyan-400'
                      : 'bg-[#0b1224] text-slate-300 border-white/10'
                  }`}
                >
                  Todo
                </button>
                {(Object.keys(SLOT_LABELS) as CosmeticSlot[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSlotFilter(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                      slotFilter === s
                        ? 'bg-cyan-400 text-slate-950 border-cyan-400'
                        : 'bg-[#0b1224] text-slate-300 border-white/10'
                    }`}
                  >
                    {SLOT_LABELS[s]}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {COSMETICS.filter(
                  (c) => slotFilter === 'all' || c.slot === slotFilter,
                ).map((item) => {
                  const owned = save.ownedCosmetics.includes(item.id);
                  const equipped = save.equippedCosmetics[item.slot] === item.id;
                  const canAfford =
                    save.coins >= item.costCoins && save.gems >= item.costGems;
                  const costLabel = `${item.costCoins} M${
                    item.costGems > 0 ? ` + ${item.costGems} G` : ''
                  }`;
                  const isInspected = inspected.itemId === item.id;

                  return (
                    <div
                      key={item.id}
                      onClick={() =>
                        setInspected({
                          kind: 'cosmetic',
                          itemId: item.id,
                          title: item.name,
                          subtitle: `${SLOT_LABELS[item.slot]} · ${item.rarity}`,
                          accentColor: item.color,
                        })
                      }
                      className={`p-4 rounded-xl bg-[#0b1224] border flex flex-col justify-between gap-3 cursor-pointer transition-colors ${
                        isInspected ? 'border-cyan-400/70' : 'border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-cyan-300">
                            {SLOT_LABELS[item.slot]} · {item.rarity}
                          </span>
                          <span
                            className="w-4 h-4 rounded-full border border-white/30"
                            style={{ backgroundColor: item.color }}
                          />
                        </div>
                        <div className="font-display font-bold text-base text-white">
                          {item.name}
                        </div>
                        <p className="text-xs text-slate-400">{item.description}</p>
                      </div>

                      <div
                        className="flex items-center justify-between pt-2.5 border-t border-white/10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="font-mono-num text-xs text-amber-300 font-bold">
                          {owned ? 'En Propiedad' : costLabel}
                        </span>
                        <button
                          disabled={!owned && !canAfford}
                          onClick={() => {
                            if (owned) {
                              const res = purchaseOrEquipCosmetic(save, item.id);
                              if (res.ok) {
                                audioEngine.playUiClick(true);
                                onUpdateSave(res.nextSave);
                              }
                            } else {
                              setPending({
                                title: item.name,
                                subtitle: `${SLOT_LABELS[item.slot]} (${item.rarity})`,
                                costLabel,
                                onConfirm: () => purchaseOrEquipCosmetic(save, item.id),
                              });
                            }
                          }}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                            equipped
                              ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-200'
                              : owned
                                ? 'bg-white/10 hover:bg-white/20 text-white'
                                : canAfford
                                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {equipped ? 'Equipado' : owned ? 'Equipar' : 'Comprar'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: TICKETS & SKILL UPGRADES */}
          {subTab === 'upgrades' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#0b1224] border border-cyan-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                    <Ticket className="w-4 h-4" /> Mejoras de Corredor y Packs de Tiques
                  </div>
                  <p className="text-slate-300">
                    Mejora tus 6 habilidades pasivas usando Monedas o Tiques de Mejora (también válidos en el Garaje 3D).
                  </p>
                </div>
                <button
                  onClick={() => switchSubTab('specials')}
                  className="px-3.5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold cursor-pointer whitespace-nowrap"
                >
                  Comprar Tiques
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {SKILL_TREE.map((node) => {
                  const lvl = save.skillLevels[node.id] ?? 0;
                  const maxed = lvl >= node.maxLevel;
                  const coinCost = getSkillCoinCost(node.id, lvl);
                  const ticketCost = getSkillTicketCost(node.id, lvl);

                  return (
                    <div
                      key={node.id}
                      onClick={() =>
                        setInspected({
                          kind: 'skill',
                          itemId: node.id,
                          title: node.name,
                          subtitle: `Nv. ${lvl}/${node.maxLevel} · ${node.effectPerLevel}`,
                          accentColor: '#22d3ee',
                        })
                      }
                      className="p-4 rounded-xl bg-[#0b1224] border border-white/10 hover:border-cyan-400/50 space-y-3 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-display font-bold text-base text-white flex items-center gap-2">
                            <Zap className="w-4 h-4 text-cyan-400" />
                            {node.name}
                          </div>
                          <div className="text-[11px] text-emerald-300 font-semibold mt-0.5">
                            {node.effectPerLevel}
                          </div>
                        </div>
                        <span className="font-mono-num text-xs font-bold text-cyan-300">
                          Nv. {lvl}/{node.maxLevel}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300">{node.description}</p>

                      <div className="grid grid-cols-5 gap-1">
                        {Array.from({ length: node.maxLevel }).map((_, i) => (
                          <div
                            key={i}
                            className={`h-1.5 rounded ${
                              i < lvl ? 'bg-cyan-400' : 'bg-slate-800'
                            }`}
                          />
                        ))}
                      </div>

                      <div
                        className="flex items-center gap-2 pt-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {maxed ? (
                          <div className="w-full py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-xs font-bold text-center">
                            Nivel Máximo Alcanzado
                          </div>
                        ) : (
                          <>
                            <button
                              disabled={save.coins < coinCost}
                              onClick={() =>
                                setPending({
                                  title: `${node.name} (Nv. ${lvl + 1})`,
                                  subtitle: 'Mejora de habilidad pasiva',
                                  costLabel: `${coinCost.toLocaleString('es-ES')} Monedas`,
                                  onConfirm: () => upgradeSkill(save, node.id, 'coins'),
                                })
                              }
                              className="flex-1 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold font-mono-num cursor-pointer disabled:cursor-not-allowed"
                            >
                              Mejorar · {coinCost} M
                            </button>
                            <button
                              disabled={save.tickets < ticketCost}
                              onClick={() =>
                                setPending({
                                  title: `${node.name} (Nv. ${lvl + 1})`,
                                  subtitle: 'Mejora usando Tiques Técnicos',
                                  costLabel: `${ticketCost} Tiques`,
                                  onConfirm: () => upgradeSkill(save, node.id, 'tickets'),
                                })
                              }
                              className="flex-1 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold font-mono-num cursor-pointer disabled:cursor-not-allowed"
                            >
                              Usar {ticketCost} {ticketCost === 1 ? 'Tique' : 'Tiques'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: SPECIAL ITEMS */}
          {subTab === 'specials' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {SPECIAL_SHOP_ITEMS.map((item) => {
                const canAfford =
                  save.coins >= item.costCoins && save.gems >= item.costGems;
                const costLabel = `${item.costCoins.toLocaleString('es-ES')} M${
                  item.costGems > 0 ? ` + ${item.costGems} G` : ''
                }`;
                const accent =
                  item.category === 'talisman'
                    ? 'border-amber-400/45'
                    : item.category === 'revive'
                      ? 'border-emerald-400/35'
                      : 'border-cyan-400/30';

                return (
                  <div
                    key={item.id}
                    onClick={() =>
                      setInspected({
                        kind: 'special',
                        itemId: item.id,
                        title: item.name,
                        subtitle: `${item.rarity} · ${item.category}`,
                        accentColor:
                          item.category === 'talisman'
                            ? '#f59e0b'
                            : item.category === 'revive'
                              ? '#10b981'
                              : '#22d3ee',
                      })
                    }
                    className={`p-4 rounded-xl bg-[#0b1224] border ${accent} flex flex-col justify-between gap-3 cursor-pointer`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-cyan-300">
                          {item.category === 'talisman'
                            ? 'Reliquia Automática'
                            : item.category === 'revive'
                              ? 'Token Continuar'
                              : item.category === 'tickets'
                                ? 'Ingeniería'
                                : 'Kit Táctico'}
                        </span>
                        <span className="text-amber-300">{item.rarity}</span>
                      </div>
                      <div className="font-display text-lg font-bold text-white flex items-center gap-2">
                        {item.category === 'talisman' ? (
                          <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                        ) : item.category === 'revive' ? (
                          <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Ticket className="w-4 h-4 text-cyan-400 shrink-0" />
                        )}
                        {item.name}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div
                      className="pt-2.5 border-t border-white/10 flex items-center justify-between gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="font-mono-num text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5" />
                        {item.costCoins.toLocaleString('es-ES')} M
                        {item.costGems > 0 && (
                          <span className="text-fuchsia-300 flex items-center gap-0.5 ml-1">
                            <Gem className="w-3 h-3" /> {item.costGems}
                          </span>
                        )}
                      </div>
                      <button
                        disabled={!canAfford}
                        onClick={() =>
                          setPending({
                            title: item.name,
                            subtitle: item.description,
                            costLabel,
                            onConfirm: () =>
                              purchaseSpecialItem(save, item.id as SpecialItemId),
                          })
                        }
                        className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold cursor-pointer disabled:cursor-not-allowed"
                      >
                        Comprar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sticky Right 3D Inspector + GLB Relics Showcase */}
        <div className="space-y-3 xl:sticky xl:top-0">
          <ModelPreview3D
            {...inspected}
            save={save}
            heightClass="h-64"
          />

          <div className="p-3.5 rounded-xl bg-[#0b1224] border border-white/10 space-y-2">
            <div className="text-xs font-bold text-white">
              Inspeccionar Modelos .GLB de Neon City
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {GLB_RELIC_CATALOG.map((rel) => (
                <button
                  key={rel.id}
                  onClick={() => {
                    audioEngine.playUiClick();
                    setInspected({
                      kind: 'relic',
                      itemId: rel.id,
                      extraGlbId: rel.id,
                      title: rel.name,
                      subtitle: rel.desc,
                      accentColor: rel.accent,
                    });
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border text-left truncate cursor-pointer ${
                    inspected.kind === 'relic' && inspected.extraGlbId === rel.id
                      ? 'bg-cyan-500/20 border-cyan-400 text-white'
                      : 'bg-[#070b17] border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                >
                  {rel.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions Ledger */}
      {save.transactions.length > 0 && (
        <div className="rounded-xl bg-[#0b1224] border border-white/10 p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-200">
            <span className="flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-cyan-400" />
              Historial Reciente de Compras
            </span>
            <span className="text-slate-400 font-mono-num">
              Total gastado: {save.stats.coinsSpent.toLocaleString('es-ES')} M
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {save.transactions.slice(0, 6).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#070b17] border border-white/5"
              >
                <div className="truncate pr-2">
                  <span className="font-semibold text-white">{tx.item}</span>
                  <span className="text-slate-400"> · {tx.category}</span>
                </div>
                <span className="font-mono-num text-amber-300 font-bold shrink-0">
                  {tx.costText}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Purchase Confirmation Modal */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md bg-[#0a0f1f] border border-amber-400/50 rounded-xl p-5 space-y-4">
            <div>
              <div className="text-[11px] font-bold tracking-wider text-amber-400">
                Confirmar Transacción
              </div>
              <h3 className="font-display text-xl font-bold text-white mt-0.5">
                {pending.title}
              </h3>
              <p className="text-xs text-slate-300 mt-1">{pending.subtitle}</p>
            </div>
            <div className="p-3 rounded-lg bg-[#0f172a] border border-white/10 flex items-center justify-between text-xs">
              <span className="text-slate-400">Coste total:</span>
              <span className="font-mono-num font-bold text-amber-300 text-sm">
                {pending.costLabel}
              </span>
            </div>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => {
                  audioEngine.playUiClick();
                  setPending(null);
                }}
                className="px-4 py-2 rounded-lg border border-white/15 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={executeConfirm}
                className="px-5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-xs cursor-pointer"
              >
                Confirmar Compra
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

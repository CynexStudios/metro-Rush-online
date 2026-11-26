import React, { useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Bot,
  Car,
  Check,
  Coins,
  Gem,
  Lock,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Ticket,
  UserCheck,
  X,
  Zap,
} from 'lucide-react';
import { audioEngine } from '../game/audio';
import {
  CHARACTERS,
  CHARACTER_BOOSTERS,
  COMPANION_DRONES,
  COSMETICS,
  GEM_EXCHANGE_PACKS,
  getSeasonWeekIndex,
  getWeeklyShopRotation,
  PROFILE_AVATARS,
  SPECIAL_SHOP_ITEMS,
  VEHICLES,
} from '../game/data';
import {
  checkUnlockRequirement,
  EconomyResult,
  exchangeGemsForCoins,
  purchaseCharacter,
  purchaseOrEquipAvatar,
  purchaseOrEquipBooster,
  purchaseOrEquipCosmetic,
  purchaseOrEquipDrone,
  purchaseOrSelectVehicle,
  purchaseSpecialItem,
} from '../game/economy';
import { PlayerSaveData } from '../game/types';
import { ModelPreview3D, ModelPreview3DProps } from './ModelPreview3D';

type ShopTab =
  | 'all'
  | 'characters'
  | 'vehicles'
  | 'boosters'
  | 'drones'
  | 'avatars'
  | 'cosmetics'
  | 'exchange'
  | 'specials';

interface ShopViewProps {
  save: PlayerSaveData;
  onUpdateSave: (next: PlayerSaveData) => void;
}

interface InspectedItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  categoryLabel: string;
  rarity?: string;
  accentColor: string;
  preview3D?: ModelPreview3DProps;
  glyph?: string;
  badgeGradient?: string;
  details: string[];
  owned?: boolean;
  equipped?: boolean;
  lockedReason?: string;
  priceCoins?: number;
  priceGems?: number;
  onBuyCoins?: () => EconomyResult;
  onBuyGems?: () => EconomyResult;
  onEquip?: () => EconomyResult;
}

export const ShopView: React.FC<ShopViewProps> = ({ save, onUpdateSave }) => {
  const [subTab, setSubTab] = useState<ShopTab>('all');
  const [inspected, setInspected] = useState<InspectedItem | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const weekIdx = useMemo(() => getSeasonWeekIndex(save.seasonStartAtMs), [save.seasonStartAtMs]);
  const rotation = useMemo(() => getWeeklyShopRotation(weekIdx), [weekIdx]);
  const rotatingSet = useMemo(() => new Set(rotation.rotatingCosmeticIds), [rotation]);

  const runEconomyAction = (action: () => EconomyResult, successTitle: string) => {
    const res = action();
    if (res.ok) {
      audioEngine.playPurchaseConfirm();
      onUpdateSave(res.nextSave);
      setFeedback({ type: 'ok', msg: `${successTitle} completado.` });
      setInspected(null);
    } else {
      audioEngine.playUiClick();
      setFeedback({ type: 'err', msg: res.reason ?? 'No se pudo completar la operación.' });
    }
  };

  const tabs: { id: ShopTab; label: string }[] = [
    { id: 'all', label: 'Todo' },
    { id: 'characters', label: 'Personajes' },
    { id: 'vehicles', label: 'Vehículos' },
    { id: 'boosters', label: 'Potenciadores' },
    { id: 'drones', label: 'Drones' },
    { id: 'avatars', label: 'Avatares' },
    { id: 'cosmetics', label: 'Trajes' },
    { id: 'exchange', label: 'Gemas → Monedas' },
    { id: 'specials', label: 'Especiales' },
  ];

  const showSection = (id: ShopTab) => subTab === 'all' || subTab === id;

  return (
    <div className="space-y-5">
      {/* Header & Currencies */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-3.5">
        <div>
          <div className="text-[11px] font-bold tracking-wider uppercase text-amber-400">
            Semana {rotation.weekNumber}/6 · {rotation.label}
          </div>
          <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-400" />
            Tienda de Neon City
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-[#0b1224] border border-white/15 rounded-xl px-4 py-2 text-xs font-mono-num">
          <span className="text-amber-400 font-bold flex items-center gap-1">
            <Coins className="w-3.5 h-3.5" /> {save.coins.toLocaleString('es-ES')} M
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-fuchsia-400 font-bold flex items-center gap-1">
            <Gem className="w-3.5 h-3.5" /> {save.gems.toLocaleString('es-ES')} G
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-cyan-400 font-bold flex items-center gap-1">
            <Ticket className="w-3.5 h-3.5" /> {save.tickets} Tiques
          </span>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              audioEngine.playUiClick();
              setSubTab(tab.id);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              subTab === tab.id
                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                : 'bg-slate-900/70 border-white/10 text-slate-300 hover:border-white/25'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {feedback && (
        <div
          className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs font-medium ${
            feedback.type === 'ok'
              ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
              : 'bg-rose-500/15 border-rose-400/40 text-rose-200'
          }`}
        >
          <span>{feedback.msg}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-white/70 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Scrollable Store Catalog (Cards First, 3D/2D Modal on Click) */}
      <div className="space-y-7 max-h-[62vh] overflow-y-auto pr-1">
        {/* 1. CHARACTERS */}
        {showSection('characters') && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4" /> Personajes ({save.unlockedCharacters.length}/{CHARACTERS.length})
              </h3>
              <span className="text-[11px] text-slate-400">Toca una tarjeta para vista 3D y habilidades</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {CHARACTERS.map((ch) => {
                const owned = save.unlockedCharacters.includes(ch.id);
                const equipped = save.selectedCharacterId === ch.id;
                const req = checkUnlockRequirement(save, ch.unlockRequirement);
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      audioEngine.playUiClick();
                      setInspected({
                        id: ch.id,
                        title: ch.name,
                        subtitle: ch.title,
                        description: ch.bio,
                        categoryLabel: 'Personaje 3D',
                        accentColor: ch.colors.accent,
                        preview3D: {
                          kind: 'character',
                          itemId: ch.id,
                          characterId: ch.id,
                          title: ch.name,
                          subtitle: ch.title,
                          accentColor: ch.colors.accent,
                        },
                        details: [
                          `Pasiva: ${ch.passiveName} — ${ch.passiveDesc}`,
                          `Activa: ${ch.abilityName} — ${ch.abilityDesc} (CD ${ch.abilityCooldown}s)`,
                          `Vehículo: ${ch.vehicleAbilityName} — ${ch.vehicleAbilityDesc}`,
                        ],
                        owned,
                        equipped,
                        lockedReason: !req.met ? req.reason : undefined,
                        priceCoins: ch.unlockCostCoins,
                        priceGems: ch.unlockCostGems,
                        onBuyCoins: () => purchaseCharacter(save, ch.id, 'coins'),
                        onBuyGems: () => purchaseCharacter(save, ch.id, 'gems'),
                        onEquip: () => ({
                          ok: true,
                          nextSave: { ...save, selectedCharacterId: ch.id },
                        }),
                      });
                    }}
                    className={`text-left p-3.5 rounded-xl border transition cursor-pointer group ${
                      equipped
                        ? 'bg-cyan-500/15 border-cyan-400'
                        : 'bg-slate-900/75 border-white/10 hover:border-cyan-400/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: ch.colors.accent }}
                      />
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/10 text-slate-200">
                        {equipped ? 'Equipado' : owned ? 'Tuyo' : `${ch.unlockCostCoins.toLocaleString('es-ES')} M`}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-white group-hover:text-cyan-200 truncate">
                      {ch.name}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{ch.title}</div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 2. VEHICLES */}
        {showSection('vehicles') && (
          <section className="space-y-2.5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <Car className="w-4 h-4" /> Vehículos ({save.ownedVehicles.length}/{VEHICLES.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {VEHICLES.map((v) => {
                const owned = save.ownedVehicles.includes(v.id);
                const equipped = save.selectedVehicleId === v.id;
                const req = checkUnlockRequirement(save, v.unlockRequirement);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      audioEngine.playUiClick();
                      setInspected({
                        id: v.id,
                        title: v.name,
                        subtitle: `${v.category} · ${v.isShip ? 'Volador' : 'Terrestre'}`,
                        description: v.description,
                        categoryLabel: 'Vehículo 3D',
                        accentColor: v.accentColor,
                        preview3D: {
                          kind: 'vehicle',
                          itemId: v.id,
                          title: v.name,
                          subtitle: v.category,
                          accentColor: v.accentColor,
                        },
                        details: [
                          `Velocidad base: ${v.baseStats.speed} · Manejo: ${v.baseStats.handling}`,
                          `Escudo: ${v.baseStats.shield} · Duración Boost: ${v.baseStats.boostDuration}s`,
                          v.isShip
                            ? 'Vehículo aéreo: despega sobre la pista y sortea obstáculos en altura.'
                            : 'Vehículo terrestre de alta tracción.',
                        ],
                        owned,
                        equipped,
                        lockedReason: !req.met ? req.reason : undefined,
                        priceCoins: v.unlockCostCoins,
                        priceGems: v.unlockCostGems,
                        onBuyCoins: () => purchaseOrSelectVehicle(save, v.id),
                        onBuyGems: () => purchaseOrSelectVehicle(save, v.id),
                        onEquip: () => purchaseOrSelectVehicle(save, v.id),
                      });
                    }}
                    className={`text-left p-3.5 rounded-xl border transition cursor-pointer ${
                      equipped
                        ? 'bg-amber-500/15 border-amber-400'
                        : 'bg-slate-900/75 border-white/10 hover:border-amber-400/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-amber-200">
                        {v.isShip ? 'Aéreo' : 'Tierra'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-200">
                        {equipped ? 'Equipado' : owned ? 'Tuyo' : `${v.unlockCostCoins.toLocaleString('es-ES')} M`}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-white truncate">{v.name}</div>
                    <div className="text-[11px] text-slate-400 truncate">{v.category}</div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 3. CHARACTER BOOSTERS */}
        {showSection('boosters') && (
          <section className="space-y-2.5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-fuchsia-300 flex items-center gap-1.5">
              <Zap className="w-4 h-4" /> Potenciadores de Personaje ({save.ownedBoosters.length}/{CHARACTER_BOOSTERS.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {CHARACTER_BOOSTERS.map((b) => {
                const owned = save.ownedBoosters.includes(b.id);
                const equipped = save.equippedBoosterId === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      audioEngine.playUiClick();
                      setInspected({
                        id: b.id,
                        title: b.name,
                        subtitle: `Potenciador · ${b.rarity}`,
                        description: b.description,
                        categoryLabel: 'Potenciador 2D',
                        rarity: b.rarity,
                        accentColor: '#e879f9',
                        glyph: '⚡',
                        details: [
                          'Se puede equipar 1 potenciador activo por corredor.',
                          `Rareza: ${b.rarity}`,
                        ],
                        owned,
                        equipped,
                        priceCoins: b.costCoins,
                        priceGems: b.costGems,
                        onBuyCoins: () => purchaseOrEquipBooster(save, b.id),
                        onBuyGems: () => purchaseOrEquipBooster(save, b.id),
                        onEquip: () => purchaseOrEquipBooster(save, b.id),
                      });
                    }}
                    className={`text-left p-3.5 rounded-xl border transition cursor-pointer ${
                      equipped
                        ? 'bg-fuchsia-500/15 border-fuchsia-400'
                        : 'bg-slate-900/75 border-white/10 hover:border-fuchsia-400/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] mb-2">
                      <span className="px-1.5 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-200 font-bold">
                        {b.rarity}
                      </span>
                      <span className="text-slate-200 font-bold">
                        {equipped ? 'Equipado' : owned ? 'Tuyo' : `${b.costCoins} M`}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-white truncate">{b.name}</div>
                    <div className="text-[11px] text-slate-400 truncate">{b.description}</div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 4. COMPANION DRONES */}
        {showSection('drones') && (
          <section className="space-y-2.5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
              <Bot className="w-4 h-4" /> Drones de Ayuda ({save.ownedDrones.length}/{COMPANION_DRONES.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {COMPANION_DRONES.map((d) => {
                const owned = save.ownedDrones.includes(d.id);
                const equipped = save.equippedDroneId === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      audioEngine.playUiClick();
                      setInspected({
                        id: d.id,
                        title: d.name,
                        subtitle: `${d.title} · ${d.rarity}`,
                        description: d.description,
                        categoryLabel: 'Dron Aliado 3D',
                        rarity: d.rarity,
                        accentColor: d.accentColor,
                        preview3D: {
                          kind: 'relic',
                          itemId:
                            d.modelKey === 'bomber'
                              ? 'kenney_bomber'
                              : d.modelKey === 'speeder'
                                ? 'kenney_speeder'
                                : 'kenney_turret',
                          title: d.name,
                          subtitle: d.title,
                          accentColor: d.accentColor,
                        },
                        details: [
                          `Duración activo: ${d.activeDurationSec}s · Enfriamiento: ${d.cooldownSec}s`,
                          'Invocable en partida para asistirte en pista.',
                        ],
                        owned,
                        equipped,
                        priceCoins: d.costCoins,
                        priceGems: d.costGems,
                        onBuyCoins: () => purchaseOrEquipDrone(save, d.id),
                        onBuyGems: () => purchaseOrEquipDrone(save, d.id),
                        onEquip: () => purchaseOrEquipDrone(save, d.id),
                      });
                    }}
                    className={`text-left p-3.5 rounded-xl border transition cursor-pointer ${
                      equipped
                        ? 'bg-sky-500/15 border-sky-400'
                        : 'bg-slate-900/75 border-white/10 hover:border-sky-400/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] mb-2">
                      <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-200 font-bold">
                        {d.rarity}
                      </span>
                      <span className="text-slate-200 font-bold">
                        {equipped ? 'Equipado' : owned ? 'Tuyo' : `${d.costCoins} M`}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-white truncate">{d.name}</div>
                    <div className="text-[11px] text-slate-400 truncate">{d.title}</div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 5. PROFILE AVATARS */}
        {showSection('avatars') && (
          <section className="space-y-2.5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> Avatares de Perfil
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {PROFILE_AVATARS.map((av) => {
                const owned = save.ownedAvatars.includes(av.id);
                const equipped = save.equippedAvatarId === av.id || save.avatarId === av.id;
                const shopAllowed = av.source === 'shop' || av.source === 'default';
                return (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => {
                      audioEngine.playUiClick();
                      setInspected({
                        id: av.id,
                        title: av.name,
                        subtitle: `Avatar · ${av.rarity}`,
                        description: av.description,
                        categoryLabel: 'Avatar de Perfil',
                        rarity: av.rarity,
                        accentColor: av.accentColor,
                        glyph: av.glyph,
                        badgeGradient: av.badgeGradient,
                        details: [av.description],
                        owned,
                        equipped,
                        lockedReason: !owned && !shopAllowed ? av.description : undefined,
                        priceCoins: shopAllowed ? av.costCoins : 0,
                        priceGems: shopAllowed ? av.costGems : 0,
                        onBuyCoins: shopAllowed
                          ? () => purchaseOrEquipAvatar(save, av.id)
                          : undefined,
                        onBuyGems: shopAllowed
                          ? () => purchaseOrEquipAvatar(save, av.id)
                          : undefined,
                        onEquip: () => purchaseOrEquipAvatar(save, av.id),
                      });
                    }}
                    className={`text-left p-3.5 rounded-xl border transition cursor-pointer ${
                      equipped
                        ? 'bg-emerald-500/15 border-emerald-400'
                        : 'bg-slate-900/75 border-white/10 hover:border-emerald-400/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white"
                        style={{ background: av.badgeGradient }}
                      >
                        {av.glyph}
                      </span>
                      <span className="text-[10px] font-bold text-slate-200">
                        {equipped
                          ? 'Equipado'
                          : owned
                            ? 'Tuyo'
                            : shopAllowed
                              ? `${av.costCoins} M`
                              : av.source === 'pass'
                                ? 'Pase'
                                : 'Misión'}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-white truncate">{av.name}</div>
                    <div className="text-[11px] text-slate-400 truncate">{av.rarity}</div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 6. COSMETICS (6-Week Rotation + Permanents) */}
        {showSection('cosmetics') && (
          <section className="space-y-2.5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-300">
              Trajes y Estelas (Rotación Semana {rotation.weekNumber}/6)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {COSMETICS.map((cos) => {
                const owned = save.ownedCosmetics.includes(cos.id);
                const equipped = save.equippedCosmetics[cos.slot] === cos.id;
                const isRotating = rotatingSet.has(cos.id);
                return (
                  <button
                    key={cos.id}
                    type="button"
                    onClick={() => {
                      audioEngine.playUiClick();
                      setInspected({
                        id: cos.id,
                        title: cos.name,
                        subtitle: `${cos.slot.toUpperCase()} · ${cos.rarity}`,
                        description: cos.description,
                        categoryLabel: isRotating ? `Rotación Semana ${rotation.weekNumber}` : 'Catálogo Fijo',
                        rarity: cos.rarity,
                        accentColor: cos.color,
                        preview3D: {
                          kind: 'cosmetic',
                          itemId: cos.id,
                          title: cos.name,
                          subtitle: cos.rarity,
                          accentColor: cos.color,
                        },
                        details: [
                          `Ranura: ${cos.slot}`,
                          isRotating
                            ? 'Cosmético destacado de la rotación semanal actual.'
                            : 'Disponible de forma permanente en la tienda.',
                        ],
                        owned,
                        equipped,
                        priceCoins: cos.costCoins,
                        priceGems: cos.costGems,
                        onBuyCoins: () => purchaseOrEquipCosmetic(save, cos.id),
                        onEquip: () => purchaseOrEquipCosmetic(save, cos.id),
                      });
                    }}
                    className={`text-left p-3.5 rounded-xl border transition cursor-pointer ${
                      equipped
                        ? 'bg-indigo-500/15 border-indigo-400'
                        : 'bg-slate-900/75 border-white/10 hover:border-indigo-400/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] mb-2">
                      <span
                        className={`px-1.5 py-0.5 rounded font-bold ${
                          isRotating ? 'bg-amber-500/20 text-amber-200' : 'bg-white/10 text-slate-300'
                        }`}
                      >
                        {isRotating ? 'Rotación' : cos.rarity}
                      </span>
                      <span className="text-slate-200 font-bold">
                        {equipped ? 'Equipado' : owned ? 'Tuyo' : `${cos.costCoins} M`}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-white truncate">{cos.name}</div>
                    <div className="text-[11px] text-slate-400 truncate">{cos.description}</div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 7. GEM TO COIN EXCHANGE */}
        {showSection('exchange') && (
          <section className="space-y-2.5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-fuchsia-300 flex items-center gap-1.5">
              <ArrowRightLeft className="w-4 h-4" /> Cambio de Moneda Morada (Gemas → Monedas)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {GEM_EXCHANGE_PACKS.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => {
                    audioEngine.playUiClick();
                    setInspected({
                      id: pack.id,
                      title: pack.name,
                      subtitle: pack.bonusLabel,
                      description: `Convierte ${pack.costGems} Gemas moradas en ${pack.grantCoins.toLocaleString('es-ES')} Monedas del juego.`,
                      categoryLabel: 'Cambio de Divisa',
                      accentColor: '#d946ef',
                      glyph: '💎→🪙',
                      details: [pack.bonusLabel, 'Tasa equilibrada para mantener la economía del juego.'],
                      priceGems: pack.costGems,
                      onBuyGems: () => exchangeGemsForCoins(save, pack.id),
                    });
                  }}
                  className="text-left p-4 rounded-xl bg-fuchsia-950/25 border border-fuchsia-400/25 hover:border-fuchsia-400 transition cursor-pointer"
                >
                  <div className="text-xs font-bold text-fuchsia-300">{pack.bonusLabel}</div>
                  <div className="font-bold text-sm text-white mt-1">{pack.name}</div>
                  <div className="text-xs text-amber-300 font-mono-num mt-2">
                    +{pack.grantCoins.toLocaleString('es-ES')} Monedas
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 8. SPECIALS */}
        {showSection('specials') && (
          <section className="space-y-2.5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">
              Objetos Especiales y Tiques
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {SPECIAL_SHOP_ITEMS.map((sp) => (
                <button
                  key={sp.id}
                  type="button"
                  onClick={() => {
                    audioEngine.playUiClick();
                    setInspected({
                      id: sp.id,
                      title: sp.name,
                      subtitle: sp.rarity,
                      description: sp.description,
                      categoryLabel: 'Objeto Especial',
                      rarity: sp.rarity,
                      accentColor: '#f59e0b',
                      glyph: '✦',
                      details: [sp.description],
                      priceCoins: sp.costCoins,
                      priceGems: sp.costGems,
                      onBuyCoins: () => purchaseSpecialItem(save, sp.id),
                      onBuyGems: () => purchaseSpecialItem(save, sp.id),
                    });
                  }}
                  className="text-left p-3.5 rounded-xl bg-slate-900/75 border border-white/10 hover:border-amber-400/50 transition cursor-pointer"
                >
                  <div className="text-[10px] font-bold text-amber-300 mb-1.5">{sp.rarity}</div>
                  <div className="font-bold text-sm text-white truncate">{sp.name}</div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    {sp.costCoins > 0 ? `${sp.costCoins} M` : `${sp.costGems} G`}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* 3D / 2D Inspection & Purchase Modal (Opens only when an item is clicked) */}
      {inspected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-[#0a1124] border border-white/20 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-slate-900/70">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                  {inspected.categoryLabel}
                </div>
                <h3 className="font-display text-lg font-bold text-white">{inspected.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setInspected(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
              {/* Left: 3D Preview OR 2D Visual Card */}
              <div className="rounded-xl overflow-hidden border border-white/10 bg-[#050914] min-h-[240px] flex items-center justify-center">
                {inspected.preview3D ? (
                  <ModelPreview3D {...inspected.preview3D} />
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                    <div
                      className="w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-lg border border-white/20"
                      style={{
                        background:
                          inspected.badgeGradient ??
                          `linear-gradient(135deg, ${inspected.accentColor}, #0f172a)`,
                      }}
                    >
                      {inspected.glyph ?? '★'}
                    </div>
                    <div className="text-xs font-semibold text-slate-300">{inspected.subtitle}</div>
                  </div>
                )}
              </div>

              {/* Right: Details & Purchase Actions */}
              <div className="flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <p className="text-xs text-slate-300 leading-relaxed">{inspected.description}</p>
                  <ul className="space-y-1.5 text-[11px] text-slate-300 bg-slate-900/70 border border-white/10 rounded-xl p-3">
                    {inspected.details.map((d, i) => (
                      <li key={i} className="leading-snug">
                        • {d}
                      </li>
                    ))}
                  </ul>

                  {inspected.lockedReason && (
                    <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-400/30 rounded-lg p-2.5">
                      <Lock className="w-4 h-4 shrink-0" />
                      <span>Requisito: {inspected.lockedReason}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-2">
                  {inspected.equipped ? (
                    <div className="w-full py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5">
                      <Check className="w-4 h-4" /> Equipado actualmente
                    </div>
                  ) : inspected.owned && inspected.onEquip ? (
                    <button
                      type="button"
                      onClick={() => runEconomyAction(inspected.onEquip!, inspected.title)}
                      className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold cursor-pointer"
                    >
                      Equipar ahora
                    </button>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {inspected.priceCoins && inspected.priceCoins > 0 && inspected.onBuyCoins && (
                        <button
                          type="button"
                          disabled={Boolean(inspected.lockedReason) || save.coins < inspected.priceCoins}
                          onClick={() => runEconomyAction(inspected.onBuyCoins!, inspected.title)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Coins className="w-3.5 h-3.5" />
                          {inspected.priceCoins.toLocaleString('es-ES')} M
                        </button>
                      )}
                      {inspected.priceGems && inspected.priceGems > 0 && inspected.onBuyGems && (
                        <button
                          type="button"
                          disabled={Boolean(inspected.lockedReason) || save.gems < inspected.priceGems}
                          onClick={() => runEconomyAction(inspected.onBuyGems!, inspected.title)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Gem className="w-3.5 h-3.5" />
                          {inspected.priceGems.toLocaleString('es-ES')} G
                        </button>
                      )}
                      {!inspected.onBuyCoins && !inspected.onBuyGems && (
                        <div className="w-full py-2 rounded-xl bg-slate-800 text-slate-300 text-xs text-center flex items-center justify-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-amber-400" />
                          Se desbloquea mediante misiones o Pase de Corredor
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  Backpack,
  Box,
  Check,
  History,
  ShieldAlert,
  Sparkles,
  Ticket,
  User,
  Zap,
} from 'lucide-react';
import { audioEngine } from '../game/audio';
import {
  CHARACTERS,
  COSMETICS,
  getCharacterById,
  SKILL_TREE,
} from '../game/data';
import { purchaseCharacter, purchaseOrEquipCosmetic } from '../game/economy';
import { ExtraGlbId } from '../game/gltfAssets';
import { CosmeticSlot, PlayerSaveData } from '../game/types';
import { ModelPreview3D, ModelPreview3DProps } from './ModelPreview3D';

type InventoryTab = 'specials' | 'characters' | 'cosmetics' | 'upgrades' | 'relics';

interface InventoryViewProps {
  save: PlayerSaveData;
  onUpdateSave: (next: PlayerSaveData) => void;
  onGoToShop: () => void;
}

const SLOT_LABELS: Record<CosmeticSlot, string> = {
  jacket: 'Chaquetas',
  visor: 'Visores',
  sneakers: 'Calzado',
  backpack: 'Mochilas',
  hair: 'Estilos / Cascos',
  trail: 'Estelas Neón',
};

const GLB_RELICS: { id: ExtraGlbId; name: string; role: string; accent: string }[] = [
  { id: 'fox', name: 'Zorro Cyber (.GLB)', role: 'Compañero en pista y mascota táctica', accent: '#f97316' },
  { id: 'helmet', name: 'Casco Battle-Damaged (.GLB)', role: 'Artefacto coleccionable PBR', accent: '#22d3ee' },
  { id: 'ion_drive', name: 'Propulsor Iónico (.GLB)', role: 'Motor cuántico de impulso aéreo', accent: '#a855f7' },
  { id: 'milk_truck', name: 'Transporte Urbano (.GLB)', role: 'Vehículo de tráfico urbano en ciudad', accent: '#eab308' },
];

export const InventoryView: React.FC<InventoryViewProps> = ({
  save,
  onUpdateSave,
  onGoToShop,
}) => {
  const [subTab, setSubTab] = useState<InventoryTab>('specials');
  const [inspected, setInspected] = useState<ModelPreview3DProps>({
    kind: 'special',
    itemId: 'talisman_1',
    specialKind: 'talisman',
    title: 'Talismán de Autorrevivir',
    subtitle: `${save.talismans} disponibles`,
    accentColor: '#f59e0b',
  });

  const ownedCosmetics = COSMETICS.filter((c) =>
    save.ownedCosmetics.includes(c.id),
  );
  const ownedCharacters = CHARACTERS.filter((ch) =>
    save.unlockedCharacters.includes(ch.id),
  );

  const switchTab = (next: InventoryTab) => {
    audioEngine.playUiClick();
    setSubTab(next);
    if (next === 'specials') {
      setInspected({
        kind: 'special',
        itemId: 'talisman_1',
        specialKind: 'talisman',
        title: 'Talismán de Autorrevivir',
        subtitle: `${save.talismans} disponibles`,
        accentColor: '#f59e0b',
      });
    } else if (next === 'characters') {
      const active = getCharacterById(save.selectedCharacterId);
      setInspected({
        kind: 'character',
        itemId: active.id,
        characterId: active.id,
        title: active.name,
        subtitle: active.title,
        accentColor: active.colors.accent,
      });
    } else if (next === 'cosmetics') {
      const first = ownedCosmetics[0] ?? COSMETICS[0];
      setInspected({
        kind: 'cosmetic',
        itemId: first.id,
        title: first.name,
        subtitle: `${SLOT_LABELS[first.slot]} · ${first.rarity}`,
        accentColor: first.color,
      });
    } else if (next === 'upgrades') {
      const s = SKILL_TREE[0];
      setInspected({
        kind: 'skill',
        itemId: s.id,
        title: s.name,
        subtitle: s.effectPerLevel,
        accentColor: '#22d3ee',
      });
    } else {
      const r = GLB_RELICS[0];
      setInspected({
        kind: 'relic',
        itemId: r.id,
        extraGlbId: r.id,
        title: r.name,
        subtitle: r.role,
        accentColor: r.accent,
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-3.5">
        <div>
          <div className="text-[11px] font-bold tracking-wider text-cyan-400">
            Taquilla Táctica del Corredor
          </div>
          <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
            <Backpack className="w-5 h-5 text-cyan-400" />
            Inventario Personal 3D
          </h2>
        </div>

        <button
          onClick={() => {
            audioEngine.playUiClick();
            onGoToShop();
          }}
          className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-xs cursor-pointer"
        >
          Ir a la Tienda
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['specials', 'Objetos Especiales'],
            ['characters', `Personajes (${ownedCharacters.length})`],
            ['cosmetics', `Trajes y Aspectos (${ownedCosmetics.length})`],
            ['upgrades', 'Tiques y Mejoras'],
            ['relics', 'Modelos .GLB (4)'],
          ] as [InventoryTab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => switchTab(id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
              subTab === id
                ? 'bg-cyan-400 text-slate-950 border-cyan-400'
                : 'bg-[#0b1224] text-slate-300 border-white/10 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5 items-start">
        <div>
          {/* 1. SPECIAL OBJECTS */}
          {subTab === 'specials' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() =>
                  setInspected({
                    kind: 'special',
                    itemId: 'revive_token_1',
                    specialKind: 'revive',
                    title: 'Tokens de Revivir',
                    subtitle: `${save.reviveTokens} en inventario`,
                    accentColor: '#10b981',
                  })
                }
                className="p-5 rounded-xl bg-[#0b1224] border border-emerald-400/35 hover:border-emerald-300 text-left space-y-2.5 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" /> Tokens de Revivir
                  </span>
                  <span className="font-mono-num text-2xl font-bold text-white">
                    {save.reviveTokens}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Permiten continuar instantáneamente en caso de colisión o caída durante la carrera. Coste progresivo dentro de cada intento: 1, 2, 4, 8...
                </p>
              </button>

              <button
                onClick={() =>
                  setInspected({
                    kind: 'special',
                    itemId: 'talisman_1',
                    specialKind: 'talisman',
                    title: 'Talismanes de Autorrevivir',
                    subtitle: `${save.talismans} en inventario`,
                    accentColor: '#f59e0b',
                  })
                }
                className="p-5 rounded-xl bg-[#0b1224] border border-amber-400/45 hover:border-amber-300 text-left space-y-2.5 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> Talismanes
                  </span>
                  <span className="font-mono-num text-2xl font-bold text-white">
                    {save.talismans}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Reliquia automática: se consume 1 al recibir un golpe letal, despeja obstáculos en 20m, te impulsa en el aire y activa escudo de 3.0s.
                </p>
              </button>

              <button
                onClick={() =>
                  setInspected({
                    kind: 'special',
                    itemId: 'ticket_pack_3',
                    specialKind: 'tickets',
                    title: 'Tiques de Mejora',
                    subtitle: `${save.tickets} disponibles`,
                    accentColor: '#22d3ee',
                  })
                }
                className="p-5 rounded-xl bg-[#0b1224] border border-cyan-400/35 hover:border-cyan-300 text-left space-y-2.5 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <Ticket className="w-4 h-4" /> Tiques de Mejora
                  </span>
                  <span className="font-mono-num text-2xl font-bold text-white">
                    {save.tickets}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Úsalos en el Garaje 3D para mejorar tus vehículos o en la Tienda para potenciar tus habilidades pasivas sin gastar monedas.
                </p>
              </button>
            </div>
          )}

          {/* 2. OWNED CHARACTERS */}
          {subTab === 'characters' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {ownedCharacters.map((ch) => {
                const active = save.selectedCharacterId === ch.id;
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
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 cursor-pointer ${
                      active
                        ? 'bg-[#0e1a33] border-cyan-400'
                        : 'bg-[#0b1224] border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1">
                          <User className="w-3.5 h-3.5" /> {ch.origin}
                        </span>
                        <span
                          className="w-4 h-4 rounded-full border border-white/30"
                          style={{ backgroundColor: ch.colors.jacket }}
                        />
                      </div>
                      <div className="font-display text-lg font-bold text-white">
                        {ch.name} · {ch.title}
                      </div>
                      <div className="text-xs text-fuchsia-300">{ch.abilityName}</div>
                      {ch.passiveName && (
                        <div className="text-[11px] text-emerald-300">
                          Pasiva: {ch.passiveName}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const res = purchaseCharacter(save, ch.id);
                        if (res.ok) {
                          audioEngine.playUiClick(true);
                          onUpdateSave(res.nextSave);
                        }
                      }}
                      className={`w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                        active
                          ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-200'
                          : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                      }`}
                    >
                      {active ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Activo en Lobby
                        </>
                      ) : (
                        'Seleccionar Corredor'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* 3. OWNED COSMETICS */}
          {subTab === 'cosmetics' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {(Object.keys(SLOT_LABELS) as CosmeticSlot[]).map((slot) => {
                  const eqId = save.equippedCosmetics[slot];
                  const eqItem = COSMETICS.find((c) => c.id === eqId);
                  return (
                    <div
                      key={slot}
                      className="p-3 rounded-xl bg-[#0b1224] border border-cyan-500/30 space-y-1"
                    >
                      <div className="text-[11px] text-cyan-300 font-semibold">
                        {SLOT_LABELS[slot]}
                      </div>
                      <div className="text-xs font-bold text-white truncate">
                        {eqItem?.name ?? 'Base'}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ownedCosmetics.map((item) => {
                  const equipped = save.equippedCosmetics[item.slot] === item.id;
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
                      className="p-3.5 rounded-xl bg-[#0b1224] border border-white/10 hover:border-cyan-400/50 flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="w-5 h-5 rounded-full border border-white/30 shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {SLOT_LABELS[item.slot]} · {item.rarity}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const res = purchaseOrEquipCosmetic(save, item.id);
                          if (res.ok) {
                            audioEngine.playUiClick(true);
                            onUpdateSave(res.nextSave);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer shrink-0 ${
                          equipped
                            ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-200'
                            : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                        }`}
                      >
                        {equipped ? 'Equipado' : 'Equipar'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. TICKETS, SKILL LEVELS & UPGRADE HISTORY */}
          {subTab === 'upgrades' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SKILL_TREE.map((s) => {
                  const lvl = save.skillLevels[s.id] ?? 0;
                  return (
                    <button
                      key={s.id}
                      onClick={() =>
                        setInspected({
                          kind: 'skill',
                          itemId: s.id,
                          title: s.name,
                          subtitle: `Nv. ${lvl}/${s.maxLevel} · ${s.effectPerLevel}`,
                          accentColor: '#22d3ee',
                        })
                      }
                      className="p-4 rounded-xl bg-[#0b1224] border border-white/10 hover:border-cyan-400/50 text-left space-y-2 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-cyan-400" />
                          {s.name}
                        </span>
                        <span className="font-mono-num text-xs text-cyan-300 font-bold">
                          Nv. {lvl}/{s.maxLevel}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">{s.effectPerLevel}</div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl bg-[#0b1224] border border-white/10 p-4 space-y-2.5">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <History className="w-4 h-4 text-cyan-400" />
                  Historial de Mejoras Realizadas
                </div>
                {save.upgradeHistory.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Aún no has registrado mejoras. Visita el Garaje 3D o la pestaña Tiques y Mejoras en la Tienda.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {save.upgradeHistory.slice(0, 8).map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#070b17] border border-white/5"
                      >
                        <span className="text-white font-semibold truncate pr-2">
                          {u.targetName} (Nv. {u.newLevel})
                        </span>
                        <span className="font-mono-num text-cyan-300 shrink-0">
                          {u.costText}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. REAL GLB RELICS */}
          {subTab === 'relics' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {GLB_RELICS.map((rel) => (
                <button
                  key={rel.id}
                  onClick={() => {
                    audioEngine.playUiClick();
                    setInspected({
                      kind: 'relic',
                      itemId: rel.id,
                      extraGlbId: rel.id,
                      title: rel.name,
                      subtitle: rel.role,
                      accentColor: rel.accent,
                    });
                  }}
                  className="p-4 rounded-xl bg-[#0b1224] border border-white/10 hover:border-cyan-400/60 text-left space-y-1.5 cursor-pointer"
                >
                  <div className="flex items-center gap-2 font-display font-bold text-sm text-white">
                    <Box className="w-4 h-4 text-cyan-400" />
                    {rel.name}
                  </div>
                  <div className="text-xs text-slate-300">{rel.role}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sticky 3D Inspector */}
        <div className="xl:sticky xl:top-0">
          <ModelPreview3D {...inspected} save={save} heightClass="h-72" />
        </div>
      </div>
    </div>
  );
};

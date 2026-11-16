import React, { useState } from 'react';
import { Car, Check, Lock, Palette, Plane, Shield, Ticket, Zap } from 'lucide-react';
import { audioEngine } from '../game/audio';
import { VEHICLES } from '../game/data';
import {
  checkUnlockRequirement,
  getEffectiveVehicleStats,
  getVehicleUpgradeCoinCost,
  getVehicleUpgradeTicketCost,
  purchaseOrSelectVehicle,
  setVehiclePaint,
  upgradeVehicle,
} from '../game/economy';
import { PlayerSaveData, VehicleId } from '../game/types';
import { ModelPreview3D } from './ModelPreview3D';

interface GarageViewProps {
  save: PlayerSaveData;
  onUpdateSave: (next: PlayerSaveData) => void;
}

const PAINT_SWATCHES: { hex: string; name: string }[] = [
  { hex: '#22d3ee', name: 'Cian Neón' },
  { hex: '#ec4899', name: 'Magenta Plasma' },
  { hex: '#f97316', name: 'Naranja Nitro' },
  { hex: '#a855f7', name: 'Violeta Cuántico' },
  { hex: '#10b981', name: 'Esmeralda Cyber' },
  { hex: '#facc15', name: 'Oro Imperial' },
  { hex: '#f8fafc', name: 'Titanio Blanco' },
];

export const GarageView: React.FC<GarageViewProps> = ({ save, onUpdateSave }) => {
  const [inspectedId, setInspectedId] = useState<VehicleId>(
    save.selectedVehicleId ?? 'hover_bike',
  );
  const [notice, setNotice] = useState<string | null>(null);

  const activeVehicle = VEHICLES.find((v) => v.id === inspectedId) ?? VEHICLES[0];
  const activeId: VehicleId = activeVehicle.id;
  const owned = save.ownedVehicles.includes(activeId);
  const equipped = save.selectedVehicleId === activeId;
  const upgLevel = save.vehicleUpgrades[activeId] ?? 0;
  const maxed = upgLevel >= activeVehicle.maxUpgradeLevel;
  const stats = getEffectiveVehicleStats(activeId, upgLevel);
  const activePaint = save.vehiclePaints[activeId] || activeVehicle.defaultPaint;
  const reqCheck = checkUnlockRequirement(save, activeVehicle.unlockRequirement);

  const coinCost = getVehicleUpgradeCoinCost(activeId, upgLevel);
  const ticketCost = getVehicleUpgradeTicketCost(upgLevel);

  return (
    <div className="flex flex-col lg:flex-row justify-between gap-4 w-full h-full pointer-events-none">
      {/* Left Dock: Vehicle Fleet Selector */}
      <div className="pointer-events-auto w-full lg:w-[410px] bg-[#070b17]/95 border border-white/15 rounded-xl p-4 flex flex-col gap-3 max-h-full overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div>
            <div className="text-[11px] font-bold tracking-wider text-cyan-400">
              Plataforma Giratoria 3D ({VEHICLES.length} Unidades)
            </div>
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-cyan-400" />
              Garaje de Vehículos
            </h2>
          </div>
          <div className="text-right text-xs font-mono-num">
            <div className="text-amber-400 font-bold">
              {save.coins.toLocaleString('es-ES')} M
            </div>
            <div className="text-cyan-300 font-bold">{save.tickets} Tiques</div>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Inspecciona cualquier vehículo 3D. Las naves aéreas permiten doble salto; los vehículos terrestres bloquean el doble salto y habilidades a pie.
        </p>

        <div className="space-y-2.5">
          {VEHICLES.map((v) => {
            const vOwned = save.ownedVehicles.includes(v.id);
            const vEquipped = save.selectedVehicleId === v.id;
            const vInspected = activeId === v.id;
            const vLvl = save.vehicleUpgrades[v.id] ?? 0;

            return (
              <button
                key={v.id}
                onClick={() => {
                  setInspectedId(v.id);
                  setNotice(null);
                  if (vOwned) {
                    const res = purchaseOrSelectVehicle(save, v.id);
                    if (res.ok) {
                      audioEngine.playUiClick(true);
                      onUpdateSave(res.nextSave);
                      return;
                    }
                  }
                  audioEngine.playUiClick();
                }}
                className={`w-full p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                  vEquipped
                    ? 'bg-cyan-500/20 border-cyan-400 text-white'
                    : vInspected
                      ? 'bg-[#101932] border-fuchsia-400/70 text-white'
                      : 'bg-[#0b1224] border-white/10 text-slate-200 hover:border-white/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] text-cyan-300 font-semibold flex items-center gap-1.5">
                      <span>{v.category}</span>
                      <span className="text-slate-500">·</span>
                      <span className={v.isShip ? 'text-fuchsia-300' : 'text-slate-400'}>
                        {v.isShip ? 'Nave Aérea' : 'Terrestre'}
                      </span>
                    </div>
                    <div className="font-display font-bold text-base text-white">
                      {v.name}
                    </div>
                  </div>
                  {vEquipped ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-300 whitespace-nowrap">
                      <Check className="w-4 h-4" /> Equipado
                    </span>
                  ) : vOwned ? (
                    <span className="font-mono-num text-xs text-slate-300 whitespace-nowrap">
                      Nv. {vLvl}/{v.maxUpgradeLevel}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-mono-num font-bold text-amber-300 whitespace-nowrap">
                      <Lock className="w-3.5 h-3.5" />
                      {v.unlockCostCoins.toLocaleString('es-ES')} M
                      {v.unlockCostGems > 0 ? ` + ${v.unlockCostGems} G` : ''}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">{v.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Dock: Interactive 360 Inspector + Vehicle Specs, Paint & Upgrades */}
      <div className="pointer-events-auto lg:self-end w-full lg:w-[410px] bg-[#070b17]/95 border border-cyan-500/40 rounded-xl p-4 space-y-3.5 max-h-full overflow-y-auto">
        <ModelPreview3D
          kind="vehicle"
          itemId={activeId}
          vehiclePaint={activePaint}
          save={save}
          title={activeVehicle.name}
          subtitle={`${activeVehicle.category} · Nivel ${upgLevel}/${activeVehicle.maxUpgradeLevel}`}
          accentColor={activePaint}
          heightClass="h-48"
        />

        {/* Flight / Ground rule pill (non-decorative technical clarity) */}
        <div
          className={`px-3 py-2 rounded-lg border text-[11px] font-semibold flex items-center justify-between ${
            activeVehicle.isShip
              ? 'bg-fuchsia-950/35 border-fuchsia-400/45 text-fuchsia-200'
              : 'bg-[#0b1224] border-white/10 text-slate-300'
          }`}
        >
          <span className="flex items-center gap-1.5">
            {activeVehicle.isShip ? (
              <Plane className="w-3.5 h-3.5 text-fuchsia-300" />
            ) : (
              <Car className="w-3.5 h-3.5 text-cyan-300" />
            )}
            {activeVehicle.isShip
              ? 'NAVE AÉREA · Doble salto propulsado activo'
              : 'VEHÍCULO TERRESTRE · Doble salto bloqueado'}
          </span>
          <span className="font-mono-num text-cyan-300">
            Sprint/Slow-Mo OFF en vehículo
          </span>
        </div>

        {/* Performance Bars */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          {(
            [
              ['Velocidad', stats.speed, 13, 'bg-cyan-400'],
              ['Maniobra', stats.handling, 13, 'bg-emerald-400'],
              ['Blindaje', stats.shield, 13, 'bg-amber-400'],
              ['Duración', stats.boostDuration, 18, 'bg-fuchsia-400'],
            ] as [string, number, number, string][]
          ).map(([lbl, val, max, barColor]) => (
            <div key={lbl} className="space-y-1">
              <div className="flex justify-between text-slate-300">
                <span>{lbl}</span>
                <span className="font-mono-num font-bold text-white">
                  {lbl === 'Duración' ? `${val}s` : `${val.toFixed(1)}`}
                </span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded overflow-hidden">
                <div
                  className={`h-full ${barColor}`}
                  style={{ width: `${Math.min(100, (val / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Unlock requirement banner if locked */}
        {!owned && activeVehicle.unlockRequirement && (
          <div
            className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${
              reqCheck.met
                ? 'bg-emerald-950/35 border-emerald-400/45 text-emerald-200'
                : 'bg-amber-950/35 border-amber-400/45 text-amber-200'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>{activeVehicle.unlockRequirement.label}</span>
            </span>
            <span className="font-mono-num font-bold shrink-0">
              {Math.min(reqCheck.current, reqCheck.target)}/{reqCheck.target}
            </span>
          </div>
        )}

        {/* Paint Selector */}
        {owned && (
          <div className="space-y-2 border-t border-white/10 pt-2.5">
            <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-cyan-400" />
              Pintura y Acabado Metálico
            </div>
            <div className="flex flex-wrap gap-2">
              {PAINT_SWATCHES.map((sw) => {
                const selected = activePaint.toLowerCase() === sw.hex.toLowerCase();
                return (
                  <button
                    key={sw.hex}
                    title={sw.name}
                    onClick={() => {
                      audioEngine.playUiClick();
                      onUpdateSave(setVehiclePaint(save, activeId, sw.hex));
                    }}
                    className={`w-7 h-7 rounded-lg border-2 cursor-pointer transition-transform ${
                      selected
                        ? 'border-white scale-110'
                        : 'border-white/25 hover:scale-105'
                    }`}
                    style={{ backgroundColor: sw.hex }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {notice && (
          <div className="text-xs font-semibold text-amber-300">{notice}</div>
        )}

        {/* Upgrade / Unlock Controls */}
        <div className="border-t border-white/10 pt-2.5 space-y-2">
          {!owned ? (
            <button
              disabled={
                !reqCheck.met ||
                save.coins < activeVehicle.unlockCostCoins ||
                save.gems < activeVehicle.unlockCostGems
              }
              onClick={() => {
                const res = purchaseOrSelectVehicle(save, activeId);
                if (res.ok) {
                  audioEngine.playPurchaseConfirm();
                  onUpdateSave(res.nextSave);
                  setNotice(null);
                } else {
                  setNotice(res.reason ?? 'No se pudo desbloquear.');
                }
              }}
              className="w-full py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-display font-bold text-xs cursor-pointer disabled:cursor-not-allowed"
            >
              {!reqCheck.met
                ? `Bloqueado (${Math.min(reqCheck.current, reqCheck.target)}/${reqCheck.target})`
                : `Desbloquear Vehículo (${activeVehicle.unlockCostCoins.toLocaleString('es-ES')} M${
                    activeVehicle.unlockCostGems > 0
                      ? ` + ${activeVehicle.unlockCostGems} G`
                      : ''
                  })`}
            </button>
          ) : (
            <>
              {!equipped && (
                <button
                  onClick={() => {
                    const res = purchaseOrSelectVehicle(save, activeId);
                    if (res.ok) {
                      audioEngine.playUiClick(true);
                      onUpdateSave(res.nextSave);
                    }
                  }}
                  className="w-full py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-xs cursor-pointer"
                >
                  Equipar {activeVehicle.name}
                </button>
              )}
              {maxed ? (
                <div className="py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-xs font-bold text-center flex items-center justify-center gap-1.5">
                  <Shield className="w-4 h-4" /> Vehículo al Máximo
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    disabled={save.coins < coinCost}
                    onClick={() => {
                      const res = upgradeVehicle(save, activeId, 'coins');
                      if (res.ok) {
                        audioEngine.playPurchaseConfirm();
                        onUpdateSave(res.nextSave);
                      }
                    }}
                    className="flex-1 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold font-mono-num flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Zap className="w-3.5 h-3.5" /> Mejorar · {coinCost} M
                  </button>
                  <button
                    disabled={save.tickets < ticketCost}
                    onClick={() => {
                      const res = upgradeVehicle(save, activeId, 'tickets');
                      if (res.ok) {
                        audioEngine.playPurchaseConfirm();
                        onUpdateSave(res.nextSave);
                      }
                    }}
                    className="flex-1 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold font-mono-num flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Ticket className="w-3.5 h-3.5" /> {ticketCost}{' '}
                    {ticketCost === 1 ? 'Tique' : 'Tiques'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

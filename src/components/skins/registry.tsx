// AEGIS — Skin registry: skin'ler AİLELERE gruplanır.
// Her aile = bir tasarım dili; altında 4 "ferdi" (skin/layout).
// App render'ı ve Ayarlar seçici buradan beslenir.

import type React from "react";
import type {SkinProps} from "./HologramSkin";
import HologramSkin from "./HologramSkin";
import MinimalSkin from "./MinimalSkin";
import TerminalSkin from "./TerminalSkin";
import DashboardSkin from "./DashboardSkin";
import {NebulaAura, NebulaChat, NebulaBoard, NebulaZen} from "./NebulaFamily";
import {CodexDoc, CodexSplit, CodexGrid, CodexLog} from "./CodexFamily";
import {RetroCRT, RetroBoot, RetroPanel, RetroWave} from "./RetroFamily";

export interface SkinDef {
    id: string;
    label: string;
    sub: string;
    icon: string;
    Comp: React.FC<SkinProps>;
}

export interface SkinFamily {
    id: string;
    label: string;
    sub: string;
    skins: SkinDef[];
}

export const SKIN_FAMILIES: SkinFamily[] = [
    {
        id: "aegis", label: "Aegis HUD", sub: "Sci-fi · keskin · glow",
        skins: [
            {id: "hologram",  label: "Hologram",  sub: "3D küre · HUD",   icon: "◎", Comp: HologramSkin},
            {id: "minimal",   label: "Minimal",   sub: "Sade · metin",    icon: "—", Comp: MinimalSkin},
            {id: "terminal",  label: "Terminal",  sub: "CLI emülatörü",   icon: ">", Comp: TerminalSkin},
            {id: "dashboard", label: "Dashboard", sub: "Widget grid",     icon: "▦", Comp: DashboardSkin},
        ],
    },
    {
        id: "nebula", label: "Nebula", sub: "Yumuşak · yuvarlak · bubble",
        skins: [
            {id: "nebula-aura",  label: "Aura",  sub: "Nefes alan küre", icon: "◌", Comp: NebulaAura},
            {id: "nebula-chat",  label: "Chat",  sub: "Modern mesajlaşma", icon: "◍", Comp: NebulaChat},
            {id: "nebula-board", label: "Board", sub: "Yuvarlak kartlar", icon: "◰", Comp: NebulaBoard},
            {id: "nebula-zen",   label: "Zen",   sub: "Ultra-minimal",    icon: "○", Comp: NebulaZen},
        ],
    },
    {
        id: "codex", label: "Codex", sub: "Düz · editöryel · mono",
        skins: [
            {id: "codex-doc",   label: "Doc",   sub: "Tek kolon döküman", icon: "▤", Comp: CodexDoc},
            {id: "codex-split", label: "Split", sub: "Yan panel + feed",  icon: "◫", Comp: CodexSplit},
            {id: "codex-grid",  label: "Grid",  sub: "Bordürlü hücreler", icon: "▥", Comp: CodexGrid},
            {id: "codex-log",   label: "Log",   sub: "Kayıt akışı",       icon: "≡", Comp: CodexLog},
        ],
    },
    {
        id: "retro", label: "Retro", sub: "CRT · beveled · scanline",
        skins: [
            {id: "retro-crt",   label: "CRT",   sub: "Tüp ekran",        icon: "▣", Comp: RetroCRT},
            {id: "retro-boot",  label: "Boot",  sub: "BIOS açılış",      icon: "▤", Comp: RetroBoot},
            {id: "retro-panel", label: "Panel", sub: "Çentikli paneller", icon: "◫", Comp: RetroPanel},
            {id: "retro-wave",  label: "Wave",  sub: "Synthwave ızgara", icon: "◢", Comp: RetroWave},
        ],
    },
];

const ALL_SKINS: SkinDef[] = SKIN_FAMILIES.flatMap((f) => f.skins);

export function getSkinComp(id: string): React.FC<SkinProps> {
    return ALL_SKINS.find((s) => s.id === id)?.Comp ?? HologramSkin;
}

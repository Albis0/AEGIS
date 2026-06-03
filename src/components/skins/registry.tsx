// AEGIS — Skin registry: skin'ler AİLELERE gruplanır.
// Her aile = bir tasarım dili; altında 4 "ferdi" (skin/layout).
// App render'ı ve Ayarlar seçici buradan beslenir.

import type React from "react";
import type {SkinProps} from "./HologramSkin";
import HologramSkin from "./HologramSkin";
import MinimalSkin from "./MinimalSkin";
import TerminalSkin from "./TerminalSkin";
import DashboardSkin from "./DashboardSkin";
import {NbPoster, NbStack, NbSwitch, NbGrid} from "./NeoBrutalismFamily";
import {SkDesk, SkJournal, SkWalkman, SkCockpit} from "./SkeuomorphismFamily";
import {ClOrb, ClPillow, ClPebble, ClTiles} from "./ClaymorphismFamily";

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
        id: "skeuomorphism", label: "Skeuomorphism", sub: "Deri · pirinç · bevel · doku",
        skins: [
            {id: "sk-desk",    label: "Desk",    sub: "Ahşap masa · notepad",   icon: "◫", Comp: SkDesk},
            {id: "sk-journal", label: "Journal", sub: "Deri defter · dikiş",    icon: "▤", Comp: SkJournal},
            {id: "sk-walkman", label: "Walkman", sub: "Retro cihaz · LCD",      icon: "◎", Comp: SkWalkman},
            {id: "sk-cockpit", label: "Cockpit", sub: "Analog kadran · metal",  icon: "◉", Comp: SkCockpit},
        ],
    },
    {
        id: "claymorphism", label: "Claymorphism", sub: "Pastel · kabarık · 3D yuvarlak",
        skins: [
            {id: "cl-orb",    label: "Orb",    sub: "Nefes alan küre · hero",  icon: "◉", Comp: ClOrb},
            {id: "cl-pillow", label: "Pillow", sub: "Yastık kartlar · sohbet", icon: "◌", Comp: ClPillow},
            {id: "cl-pebble", label: "Pebble", sub: "Çakıl nav · kompakt",     icon: "●", Comp: ClPebble},
            {id: "cl-tiles",  label: "Tiles",  sub: "Kil fayanslar · pano",    icon: "◫", Comp: ClTiles},
        ],
    },
    {
        id: "neobrutalism", label: "Neo-brutalism", sub: "Koyu · kalın · sert gölge",
        skins: [
            {id: "nb-poster", label: "Poster", sub: "Dev tipografi · afiş", icon: "▮", Comp: NbPoster},
            {id: "nb-stack",  label: "Stack",  sub: "Sticker kartlar",      icon: "◈", Comp: NbStack},
            {id: "nb-switch", label: "Switch", sub: "Ham kontrol paneli",   icon: "◫", Comp: NbSwitch},
            {id: "nb-grid",   label: "Grid",   sub: "Telemetri ızgarası",   icon: "▤", Comp: NbGrid},
        ],
    },
];

const ALL_SKINS: SkinDef[] = SKIN_FAMILIES.flatMap((f) => f.skins);

export function getSkinComp(id: string): React.FC<SkinProps> {
    return ALL_SKINS.find((s) => s.id === id)?.Comp ?? HologramSkin;
}

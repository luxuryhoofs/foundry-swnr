import { SWNRBaseItem } from "./base-item";
import { SWNRStats } from "./actor-types";
import { SWNRWeapon } from "./items/weapon";
import { SWNRShipClass } from "./actor-types";

type MetaItemTypes = "class" | "power" | "focus" | "skill";
type RealItemTypes = "armor" | "weapon" | "item" ;
type ShipItemTypes = "shipWeapon" | "shipFitting" | "shipDefense";
type ItemTypes = RealItemTypes | MetaItemTypes | ShipItemTypes;

declare type ItemsWithCustomClasses = SWNRWeapon;
declare type ItemTypesMissingCustomClasses = Exclude<
  ItemTypes,
  ItemsWithCustomClasses["type"]
>;
type BaseItemIfNeeded = ItemTypesMissingCustomClasses extends never
  ? never
  : SWNRBaseItem<ItemTypesMissingCustomClasses>;
declare type AllItemClasses = ItemsWithCustomClasses | BaseItemIfNeeded;

declare interface SWNRDescData {
  description: string;
}

declare interface SWNRBaseItemData {
  encumbrance: number;
  cost: number;
  tl: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  location: "readied" | "stowed" | "other";
  quality: "stock" | "masterwork" | "makeshift";
}

declare interface SWNRBaseVehicleItemData {
  cost: number;
  power: number;
  mass: number;
  costMultiplier: boolean;
  powerMultiplier: boolean;
  massMultiplier: boolean;
  minClass: SWNRShipClass;
  broken: boolean;
  destroyed: boolean;
  quantity: number
}

type SWNRClassItemBaseData = SWNRDescData;

type SWNRArmorTypes = "powered" | "combat" | "street" | "primitive";
declare interface SWNRArmor extends SWNRBaseItemData, SWNRDescData {
  ac: number;
  type: SWNRArmorTypes;
  shield: boolean;
  use: boolean;
}

type SWNRWeaponAmmoTypes =
  | "none"
  | "typeAPower"
  | "typeBPower"
  | "ammo"
  | "missile"
  | "special";


interface SWNRWeaponData extends SWNRBaseItemData, SWNRDescData {
  stat: SWNRStats;
  secondStat: "none" | SWNRStats;
  skill: string;
  skillBoostsDamage: boolean;
  shock: {
    dmg: number;
    ac: number;
  };
  ab: number;
  ammo: {
    longReload: boolean;
    suppress: boolean;
    type: SWNRWeaponAmmoTypes;
    max: number;
    value: number;
    burst: boolean;
  };
  range: {
    normal: number;
    max: number;
  };
  damage: string;
}

declare interface SWNRShipWeaponData extends SWNRBaseVehicleItemData, SWNRDescData{
  damage: string;
  hardpoint: number;
  tl:  4 | 5 | 6;
  qualities: string;
  ammo: {
    type: SWNRWeaponAmmoTypes;
    max: number;
    value: number;
  };
}

declare interface SWNRShipDefenseData extends SWNRBaseVehicleItemData, SWNRDescData{
  effect: string;
}

declare interface SWNRShipFittingData extends SWNRBaseVehicleItemData, SWNRDescData{
  effect: string;
}

declare interface SWNRArmorData extends SWNRBaseItemData {
  ac: number;
  shield: boolean;
  use: boolean;
}

declare interface SWNRPowerData extends SWNRDescData {
  source: string;
  level: number;
}

declare interface SWNRItemData extends SWNRBaseItemData {
  quantity: number;
  bundle: {
    bundled: boolean;
    amount: number;
  };
}

declare interface SWNRFocusData extends SWNRDescData {
  level1: string;
  level2: string;
}

declare interface SWNRSkillData extends SWNRDescData {
  pool: "ask" | "2d6" | "3d6kh2" | "4d6kh2";
  rank: -1 | 0 | 1 | 2 | 3 | 4;
  defaultStat: "ask" | SWNRStats;
  source: string;
}

declare type SWNRInventoryItemData =
  | SWNRBaseItemData
  | SWNRWeaponData
  | SWNRArmorData;

declare global {
  interface DataConfig {
    Item:
      | { type: "class"; data: SWNRDescData }
      | { type: "armor"; data: SWNRArmorData }
      | { type: "weapon"; data: SWNRWeaponData }
      | { type: "power"; data: SWNRPowerData }
      | { type: "item"; data: SWNRItemData }
      | { type: "focus"; data: SWNRFocusData }
      | { type: "skill"; data: SWNRSkillData }
      | { type: "shipWeapon"; data: SWNRShipWeaponData}
      | { type: "shipDefense"; data: SWNRShipDefenseData}
      | { type: "shipFitting"; data: SWNRShipFittingData}
      ;
  }

  interface SourceConfig {
    Item:
      | { type: "class"; data: SWNRDescData }
      | { type: "armor"; data: SWNRArmorData }
      | { type: "weapon"; data: SWNRWeaponData }
      | { type: "power"; data: SWNRPowerData }
      | { type: "item"; data: SWNRItemData }
      | { type: "focus"; data: SWNRFocusData }
      | { type: "skill"; data: SWNRSkillData }
      | { type: "shipWeapon"; data: SWNRShipWeaponData }
      | { type: "shipDefense"; data: SWNRShipDefenseData}
      | { type: "shipFitting"; data: SWNRShipFittingData};
  }
}

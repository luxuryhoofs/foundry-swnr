import { SWNRShipActor } from "./ship";
import { calculateStats, initSkills, limitConcurrency } from "../utils";
import { ValidatedDialog } from "../ValidatedDialog";
import { SWNRBaseItem } from "../base-item";
import { SWNRStats, SWNRStatBase, SWNRStatComputed } from "../actor-types";
import { AllItemClasses } from "../item-types";
import { SWNRBaseActor } from "../base-actor";
import { SWNRNPCActor } from "./npc";
import { SWNRCharacterActor } from "./character";
import { SysToFail } from "./ship";

interface ShipActorSheetData extends ActorSheet.Data {
  shipWeapons?: Item[];
  crewMembers?: string[]; // ActorIds
  itemTypes: SWNRShipActor["itemTypes"];
}

export class ShipActorSheet extends ActorSheet<
  ActorSheet.Options,
  ShipActorSheetData> {
  popUpDialog?: Dialog;
  object: SWNRShipActor;

  get actor(): SWNRShipActor {
    if (super.actor.type != "ship") throw Error;
    return super.actor;
  }

  _injectHTML(html: JQuery<HTMLElement>): void {
    html
      .find(".window-content")
      .addClass(["cq", "overflow-y-scroll", "relative"]);
    super._injectHTML(html);
  }

  async getData(
    options?: Application.RenderOptions
  ): Promise<ShipActorSheetData> {
    let data = super.getData(options);
    if (data instanceof Promise) data = await data;

    let crewArray: Array<SWNRCharacterActor | SWNRNPCActor> = [];
    if (this.actor.data.data.crewMembers) {
      for (var i in this.actor.data.data.crewMembers) {
        let cId = this.actor.data.data.crewMembers[i];
        let crewMember = game.actors?.get(cId);
        if (crewMember && (crewMember.type == "character" || crewMember.type == "npc")) {
          crewArray.push(crewMember);
          //console.log(crewArray);
        }
      }
      //console.log("CA", crewArray);
    } else {
      //console.log("no crewmembers");
    }

    return mergeObject(data, {
      itemTypes: this.actor.itemTypes,
      abilities: this.actor.items.filter(
        (i: SWNRBaseItem) => ["power", "focus"].indexOf(i.data.type) !== -1
      ),
      equipment: this.actor.items.filter(
        (i: SWNRBaseItem) =>
          ["armor", "item", "weapon"].indexOf(i.data.type) !== -1
      ),
      crewArray: crewArray,
    });
  }
  static get defaultOptions(): ActorSheet.Options {
    return mergeObject(super.defaultOptions, {
      classes: ["swnr", "sheet", "actor", "ship"],
      template: "systems/swnr/templates/actors/ship-sheet.html",
      width: 800,
      height: 600,
      tabs: [
        {
          navSelector: ".pc-sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "mods",
        },
      ],
    });
  }

  activateListeners(html: JQuery): void {
    super.activateListeners(html);
    html.find(".item-edit").on("click", this._onItemEdit.bind(this));
    html.find(".item-delete").on("click", this._onItemDelete.bind(this));
    html.find(".crew-delete").on("click", this._onCrewDelete.bind(this));
    html.find(".item-reload").on("click", this._onItemReload.bind(this));

    html.find(".item-toggle-broken").on("click", this._onItemBreakToggle.bind(this));
    html.find(".item-toggle-destroy").on("click", this._onItemDestroyToggle.bind(this));

    html.find(".item-click").on("click", this._onItemClick.bind(this));
    html.find(".travel-button").on("click", this._onTravel.bind(this));
    html.find(".spike-button").on("click", this._onSpike.bind(this));
    html.find(".refuel-button").on("click", this._onRefuel.bind(this));
    html.find(".crisis-button").on("click", this._onCrisis.bind(this));
    html.find(".failure-button").on("click", this._onSysFailure.bind(this));
    html.find(".calc-cost").on("click", this._onCalcCost.bind(this));
    html.find(".make-payment").on("click", this._onPayment.bind(this));
    html.find(".pay-maintenance").on("click", this._onMaintenance.bind(this));

    html.find("[name='data.shipHullType']").on("change", this._onHullChange.bind(this));

    // Drag events for macros.
    if (this.actor.isOwner) {
      let handler = ev => this._onDragStart(ev);
      // Find all items on the character sheet.
      html.find('.item').each((i, li) => {
        // Ignore for the header row.
        if (li.classList.contains("item-header")) return;
        // Add draggable attribute and dragstart listener.
        li.setAttribute("draggable", "true");
        li.addEventListener("dragstart", handler, false);
      });

      html.find('.click-button').each((i, elem)=> {
        elem.setAttribute("draggable", "true");
        elem.addEventListener("dragstart", handler, false);
      });
    }
  }

  _onPayment(event: JQuery.ClickEvent) {
    return this._onPay(event, "payment");
  }

  _onMaintenance(event: JQuery.ClickEvent) {
    return this._onPay(event, "maintenance");
  }

  _onPay(event: JQuery.ClickEvent, paymentType: "payment" | "maintenance"): void {
    // if a new payment type is added this function needs to be refactored
    let shipPool = this.actor.data.data.creditPool;
    let paymentAmount = (paymentType == "payment") ? this.actor.data.data.paymentAmount : this.actor.data.data.maintenanceCost;
    //Assume its payment and change if maintenance

    let lastPayDate = (paymentType == "payment") ? this.actor.data.data.lastPayment : this.actor.data.data.lastMaintenance;
    let monthSchedule = (paymentType == "payment") ? this.actor.data.data.paymentMonths : this.actor.data.data.maintenanceMonths;

    if (paymentAmount > shipPool){      
      ui.notifications?.error(`Not enough money in the pool for paying ${paymentAmount} for ${paymentType}`);
      return;
    }
    shipPool-=paymentAmount;
    let dateObject = new Date(lastPayDate.year, lastPayDate.month-1, lastPayDate.day);
    dateObject.setMonth(dateObject.getMonth()+monthSchedule);
    if (paymentType == "payment") {
      this.actor.update({
        data:{
          "creditPool": shipPool,
          lastPayment: {
            "year": dateObject.getFullYear(),
            "month": dateObject.getMonth()+1,
            "day": dateObject.getDate()
          }
        }
      });
    } else {
      this.actor.update({
        data:{
          "creditPool": shipPool,
          lastMaintenance: {
            "year": dateObject.getFullYear(),
            "month": dateObject.getMonth()+1,
            "day": dateObject.getDate()
          }
        }
      });
    }
  }
  _onHullChange(event: JQuery.ClickEvent): void {
    let targetHull = event.target?.value;

    if (targetHull) {
      let d = new Dialog({
        title: "Apply Default Stats",
        content: `<p>Do you want to apply the default stats for a ${targetHull}?</p><b>This will change your current and max values for HP, cost, armor, AC, mass, power, hardpoints, hull type, speed, life support (60*max crew), and crew.</b>`,
        buttons: {
          yes: {
            icon: '<i class="fas fa-check"></i>',
            label: "Yes",
            callback: () => this.actor.applyDefaulStats(targetHull)
          },
          no: {
            icon: '<i class="fas fa-times"></i>',
            label: "No",
            callback: () => { console.log("Doing nothing") }
          }
        },
        default: "no",
      });
      d.render(true);
    }
  }
  _onTravel(event: JQuery.ClickEvent): void {
    if (this.actor.data.data.spikeDrive.value <= 0) {
      ui.notifications?.error("Drive disabled.");
      return;
    }
    //TODO localize
    new Dialog({
      title: 'Travel Days (Use life support)',
      content: `
          <form>
            <div class="form-group">
              <label>Days of Travel</label>
              <input type='text' name='inputField'></input>
            </div>
          </form>`,
      buttons: {
        yes: {
          icon: "<i class='fas fa-check'></i>",
          label: `Travel`
        }
      },
      default: 'yes',
      close: html => {
        const form = <HTMLFormElement>html[0].querySelector("form");
        const days = (<HTMLInputElement>form.querySelector('[name="inputField"]'))?.value;
        if (days && days != "") {
          let nDays = Number(days);
          if (nDays) {
            this.actor.useDaysOfLifeSupport(nDays);
          } else {
            ui.notifications?.error(days + " is not a number");
          }
        }
      }
    }).render(true);

  }

  async _onSpike(event: JQuery.ClickEvent): Promise<void> {
    if (this.actor.data.data.fuel.value <= 0) {
      ui.notifications?.error("Out of fuel.");
      return;
    }
    if (this.actor.data.data.spikeDrive.value <= 0) {
      ui.notifications?.error("Drive disabled.");
      return;
    }
    let defaultPilotId: string | null = this.actor.data.data.roles.bridge;
    let defaultPilot: SWNRCharacterActor | SWNRNPCActor | null = null;
    if (defaultPilotId) {
      let _temp = game.actors?.get(defaultPilotId);
      if (_temp && (_temp.type == "character" || _temp.type == "npc")) {
        defaultPilot = _temp;
      }
    }
    let crewArray: Array<SWNRCharacterActor | SWNRNPCActor> = [];
    if (this.actor.data.data.crewMembers) {
      for (var i in this.actor.data.data.crewMembers) {
        let cId = this.actor.data.data.crewMembers[i];
        let crewMember = game.actors?.get(cId);
        if (crewMember && (crewMember.type == "character" || crewMember.type == "npc")) {
          crewArray.push(crewMember);
        }
      }
    }

    const title = game.i18n.format("swnr.dialog.spikeRoll", {
      actorName: this.actor?.name,
    });

    if (defaultPilot == null && crewArray.length > 0) {
      //There is no pilot. Use first crew as default
      defaultPilot = crewArray[0];
      defaultPilotId = crewArray[0].id;
    }
    if (defaultPilot?.type == "npc" && crewArray.length > 0) {
      //See if we have a non NPC to set as pilot to get skills and attr
      for (let char of crewArray) {
        if (char.type == "character") {
          defaultPilot = char;
          defaultPilotId = char.id;
          break;
        }
      }
    }

    const dialogData = {
      actor: this.actor.data,
      defaultSkill1: "Pilot",
      defaultSkill2: "Navigation",
      defaultStat: "int",
      pilot: defaultPilot,
      pilotId: defaultPilotId,
      crewArray: crewArray,
      baseDifficulty: 7,
    };

    const template = "systems/swnr/templates/dialogs/roll-spike.html";
    const html = renderTemplate(template, dialogData);

    const _rollForm = async (html: HTMLFormElement) => {
      const form = <HTMLFormElement>html[0].querySelector("form");
      const mod = parseInt(
        (<HTMLInputElement>form.querySelector('[name="modifier"]'))?.value
      );
      const pilotId = (<HTMLInputElement>form.querySelector('[name="pilotId"]'))?.value
      const pilot = pilotId ? game.actors?.get(pilotId) : null;
      const dice = (<HTMLSelectElement>form.querySelector('[name="dicepool"]'))
        .value;
      const skillName =
        (<HTMLSelectElement>form.querySelector('[name="skill"]'))?.value;
      const statName =
        (<HTMLSelectElement>form.querySelector('[name="stat"]'))?.value;
      const difficulty = parseInt(
        (<HTMLInputElement>form.querySelector('[name="difficulty"]'))?.value
      );
      const travelDays = parseInt(
        (<HTMLInputElement>form.querySelector('[name="travelDays"]'))?.value
      );
      let skillMod = 0;
      let statMod = 0;
      let pilotName: string | null = "";
      if (pilot) {
        if (skillName) {
          // We need to look up by name
          for (let skill of pilot.itemTypes.skill) {
            if (skillName == skill.data.name) {
              skillMod = skill.data.data["rank"] < 0 ? -1 : skill.data.data["rank"];
            }
          }
        }//end skill
        if (statName) {
          let sm = pilot.data.data["stats"]?.[statName].mod;
          if (sm) {
            console.log("setting stat mod", sm);
            statMod = sm;
          }
        }
        pilotName = pilot.name;
      }
      this.actor.rollSpike(pilotId, pilotName, skillMod, statMod, mod, dice, difficulty, travelDays);
    }

    this.popUpDialog?.close();
    this.popUpDialog = new ValidatedDialog(
      {
        title: title,
        content: await html,
        default: "roll",
        buttons: {
          roll: {
            label: game.i18n.localize("swnr.chat.roll"),
            callback: _rollForm,
          },
        },
      },
      {
        classes: ["swnr"],
      }
    );
    const s = this.popUpDialog.render(true);
  }

  _onRefuel(event: JQuery.ClickEvent): void {
    const data = this.actor.data.data;
    this.actor.update(
      {
        "data.lifeSupportDays.value": data.lifeSupportDays.max,
        "data.fuel.value": data.fuel.max,
      });
    ui.notifications?.info("Refuelled");
  }
  _onCrisis(event: JQuery.ClickEvent): void {
    this.actor.rollCrisis();
  }

  async _onSysFailure(event: JQuery.ClickEvent): Promise<void> {
    const title = game.i18n.format("swnr.dialog.sysFailure", {
      actorName: this.actor?.name,
    });
    const dialogData = {};
    const template = "systems/swnr/templates/dialogs/roll-ship-failure.html";
    const html = renderTemplate(template, dialogData);

    const _rollForm = async (html: HTMLFormElement) => {
      const form = <HTMLFormElement>html[0].querySelector("form");
      const incDrive = (<HTMLInputElement>(
        form.querySelector('[name="inc-drive"]')
      ))?.checked ? true : false;
      const incWpn = (<HTMLInputElement>(
        form.querySelector('[name="inc-wpn"]')
      ))?.checked ? true : false;
      const incFit = (<HTMLInputElement>(
        form.querySelector('[name="inc-fit"]')
      ))?.checked ? true : false;
      const incDef = (<HTMLInputElement>(
        form.querySelector('[name="inc-def"]')
      ))?.checked ? true : false;
      const whatToRoll =
        (<HTMLSelectElement>form.querySelector('[name="what"]'))?.value;

      let sysToInclude: SysToFail[] = [];
      if (incDrive) {
        sysToInclude.push("drive");
      }
      if (incWpn) {
        sysToInclude.push("wpn");
      }
      if (incFit) {
        sysToInclude.push("fit");
      }
      if (incDef) {
        sysToInclude.push("def");
      }
      this.actor.rollSystemFailure(sysToInclude, whatToRoll);
    }

    this.popUpDialog?.close();
    this.popUpDialog = new ValidatedDialog(
      {
        title: title,
        content: await html,
        default: "roll",
        buttons: {
          roll: {
            label: game.i18n.localize("swnr.chat.roll"),
            callback: _rollForm,
          },
        },
      },
      {
        classes: ["swnr"],
      }
    );
    const s = this.popUpDialog.render(true);

  }


  _onCalcCost(event: JQuery.ClickEvent): void {
    const hullType = this.actor.data.data.shipHullType;
    let d = new Dialog({
      title: "Calc Costs",
      content: `Do you want to calculate the cost based on your fittings and the hull ${hullType}`,
      buttons: {
        yesnomaint: {
          icon: '<i class="fas fa-check"></i>',
          label: "Yes, but leave maintenance alone",
          callback: () => { this.actor.calcCost(false) }
        },
        yes: {
          icon: '<i class="fas fa-times"></i>',
          label: "Yes, and calculate maintence costs as 5%",
          callback: () => { this.actor.calcCost(true) }
        },
        no: {
          icon: '<i class="fas fa-times"></i>',
          label: "No",
          callback: () => { console.log("Doing nothing") }
        }
      },
      default: "no",
    });
    d.render(true);
    
  }

  // Clickable title/name or icon. Invoke Item.roll()
  _onItemClick(event: JQuery.ClickEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const itemId = event.currentTarget.parentElement.dataset.itemId;
    const item = <SWNRBaseItem>(
      this.actor.getEmbeddedDocument("Item", itemId)
    );
    //const wrapper = $(event.currentTarget).parents(".item");
    //const item = this.actor.getEmbeddedDocument("Item", wrapper.data("itemId"));
    if (!item) return;
    item.roll();
  }

  _onItemReload(event: JQuery.ClickEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const li = $(event.currentTarget).parents(".item");
    const item = this.actor.getEmbeddedDocument("Item", li.data("itemId"));
    if (!item) return;
    let ammo_max = item.data.data.ammo?.max;
    if (ammo_max != null) {
      if (item.data.data.ammo.value < ammo_max){
        console.log("Reloading", item);
        item.update({"data.ammo.value": ammo_max})
        let content = `<p> Reloaded ${item.name} </p>`
        ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: content
        });
      } else {
        ui.notifications?.info("Trying to reload a full item");
      }
    } else {
      console.log("Unable to find ammo in item ", item.data.data);
    }
  }

  _onItemBreakToggle(event: JQuery.ClickEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const wrapper = $(event.currentTarget).parents(".item");
    const item = this.actor.getEmbeddedDocument("Item", wrapper.data("itemId"));
    const new_break_status = !item?.data.data.broken;
    if (item instanceof Item) item?.update({ "data.broken": new_break_status });
  }

  _onItemDestroyToggle(event: JQuery.ClickEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const wrapper = $(event.currentTarget).parents(".item");
    const item = this.actor.getEmbeddedDocument("Item", wrapper.data("itemId"));
    const new_destroy_status = !item?.data.data.destroyed;
    if (item instanceof Item) item?.update({ "data.destroyed": new_destroy_status });
  }

  _onItemEdit(event: JQuery.ClickEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const wrapper = $(event.currentTarget).parents(".item");
    const item = this.actor.getEmbeddedDocument("Item", wrapper.data("itemId"));
    if (item instanceof Item) item.sheet?.render(true);
  }

  async _onCrewDelete(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const li = $(event.currentTarget).parents(".item");
    console.log("id", li.data("crewId"), li.data("crewName"));
    const performDelete: boolean = await new Promise((resolve) => {
      Dialog.confirm({
        title: game.i18n.format("swnr.deleteCrew", { name: li.data("crewName") }),
        yes: () => resolve(true),
        no: () => resolve(false),
        content: game.i18n.format("swnr.deleteCrew", {
          name: li.data("crewName"),
          actor: this.actor.name,
        }),
      });
    });
    if (!performDelete) return;
    li.slideUp(200, () => {
      requestAnimationFrame(() => {
        this.actor.removeCrew(li.data("crewId"));
      });
    });
  }

  async _onItemDelete(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const li = $(event.currentTarget).parents(".item");
    const item = this.actor.getEmbeddedDocument("Item", li.data("itemId"));
    if (!item) return;
    const performDelete: boolean = await new Promise((resolve) => {
      Dialog.confirm({
        title: game.i18n.format("swnr.deleteTitle", { name: item.name }),
        yes: () => resolve(true),
        no: () => resolve(false),
        content: game.i18n.format("swnr.deleteContent", {
          name: item.name,
          actor: this.actor.name,
        }),
      });
    });
    if (!performDelete) return;
    li.slideUp(200, () => {
      requestAnimationFrame(() => {
        this.actor.deleteEmbeddedDocuments("Item", [li.data("itemId")]);
      });
    });
  }
}

Hooks.on(
  "dropActorSheetData",
  (actor: Actor, actorSheet: ActorSheet, data) => {
    if (actor.type == "ship" && data.type == "Actor") {
      const shipActor = actor as unknown as SWNRShipActor;
      shipActor.addCrew(data["id"]);
    }
  }
);
export const sheet = ShipActorSheet;
export const types = ["ship"];

import tsyringe = require("tsyringe");

import { SaveServer } from "@spt-aki/servers/SaveServer";
import { HttpResponseUtil } from "@spt-aki/utils/HttpResponseUtil";

import type { IPreAkiLoadMod } from "@spt-aki/models/external/IPreAkiLoadMod";
import type { IPostDBLoadMod } from "@spt-aki/models/external/IPostDBLoadMod";
import type { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import type { DynamicRouterModService } from "@spt-aki/services/mod/dynamicRouter/DynamicRouterModService";
import type { StaticRouterModService } from "@spt-aki/services/mod/staticRouter/StaticRouterModService";

import { DatabaseServer } from "@spt-aki/servers/DatabaseServer";

import { SITCustomTraders } from "./Traders/SITCustomTraders";

@tsyringe.injectable()
export class PaulovsSITCoopMod implements IPreAkiLoadMod, IPostDBLoadMod
{
    public static Instance: PaulovsSITCoopMod;
    private static container: tsyringe.DependencyContainer;
    public traders: any[] = [];

    preAkiLoad(container: tsyringe.DependencyContainer): void {

        PaulovsSITCoopMod.Instance = this;

        this.traders.push(new SITCustomTraders());
        for(const t of this.traders) {
            t.preAkiLoad(container);
        }

    }

    postDBLoad(container: tsyringe.DependencyContainer): void {

        for(const t of this.traders) {
            t.postDBLoad(container);
        }



    }



 
}
module.exports = {mod: new PaulovsSITCoopMod()}

import { DependencyContainer } from "tsyringe";

// SPT types
import { PreAkiModLoader } from "@spt-aki/loaders/PreAkiModLoader";
import { ConfigTypes } from "@spt-aki/models/enums/ConfigTypes";
import { IPostDBLoadMod } from "@spt-aki/models/external/IPostDBLoadMod";
import { IPreAkiLoadMod } from "@spt-aki/models/external/IPreAkiLoadMod";
import { ITraderConfig } from "@spt-aki/models/spt/config/ITraderConfig";
import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { ImageRouter } from "@spt-aki/routers/ImageRouter";
import { ConfigServer } from "@spt-aki/servers/ConfigServer";
import { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import { JsonUtil } from "@spt-aki/utils/JsonUtil";

// New trader settings
import { ItemHelper } from "@spt-aki/helpers/ItemHelper";
import { Money } from "@spt-aki/models/enums/Money";
import { HashUtil } from "@spt-aki/utils/HashUtil";
import fs from "fs";
import path from "path";
import * as baseJson from "./db/CoopGroupTraderBase.json"
import { FluentAssortConstructor } from "./FluentTraderAssortCreator";
import { TraderHelper } from "./traderHelpers";
import { Item } from "@spt-aki/models/eft/common/tables/IItem";

export class CoopGroupTrader implements IPreAkiLoadMod, IPostDBLoadMod
{
    private mod: string
    private logger: ILogger
    private traderHelper: TraderHelper
    private fluentTraderAssortHelper: FluentAssortConstructor;
    private traderId = "coopTrader";
    itemHelper: ItemHelper;

    constructor() {
        this.mod = "PaulovsSITCoop"; // Set name of mod so we can log it to console later
    }

    /**
     * Some work needs to be done prior to SPT code being loaded, registering the profile image + setting trader update time inside the trader config json
     * @param container Dependency container
     */
    public preAkiLoad(container: DependencyContainer): void
    {
        // Get a logger
        this.logger = container.resolve<ILogger>("WinstonLogger");

        // Get SPT code/data we need later
        const preAkiModLoader: PreAkiModLoader = container.resolve<PreAkiModLoader>("PreAkiModLoader");
        const imageRouter: ImageRouter = container.resolve<ImageRouter>("ImageRouter");
        const configServer = container.resolve<ConfigServer>("ConfigServer");
        const traderConfig: ITraderConfig = configServer.getConfig<ITraderConfig>(ConfigTypes.TRADER);
        const hashUtil: HashUtil = container.resolve<HashUtil>("HashUtil");
        
        this.itemHelper = container.resolve<ItemHelper>("ItemHelper");

        // Create helper class and use it to register our traders image/icon + set its stock refresh time
        this.traderHelper = new TraderHelper();
        this.fluentTraderAssortHelper = new FluentAssortConstructor(hashUtil, this.logger);
        this.traderHelper.registerProfileImage(baseJson, this.mod, preAkiModLoader, imageRouter, "coop.jpg");
        this.traderHelper.setTraderUpdateTime(traderConfig, baseJson, 3600);


    }
    
    /**
     * Majority of trader-related work occurs after the aki database has been loaded but prior to SPT code being run
     * @param container Dependency container
     */
    public postDBLoad(container: DependencyContainer): void
    {
        // Resolve SPT classes we'll use
        const databaseServer: DatabaseServer = container.resolve<DatabaseServer>("DatabaseServer");
        const configServer: ConfigServer = container.resolve<ConfigServer>("ConfigServer");
        const jsonUtil: JsonUtil = container.resolve<JsonUtil>("JsonUtil");

        // Get a reference to the database tables
        const tables = databaseServer.getTables();

        // Add new trader to the trader dictionary in DatabaseServer - has no assorts (items) yet
        this.traderHelper.addTraderToDb(baseJson, tables, jsonUtil);

        // const MILK_ID = "575146b724597720a27126d5"; // Can find item ids in `database\templates\items.json` or with https://db.sp-tarkov.com/search
        // this.fluentTraderAssortHelper.createSingleAssortItem(MILK_ID)
        //                             .addStackCount(200)
        //                             .addBuyRestriction(10)
        //                             .addMoneyCost(Money.ROUBLES, 2000)
        //                             .addLoyaltyLevel(1)
        //                             .export(tables.traders[baseJson._id]);

        this.createAssort(databaseServer.getTables());
        // this.fluentTraderAssortHelper.createComplexAssortItem()

        // Add more complex items to trader (items with sub-items, e.g. guns)
        // this.traderHelper.addComplexItemsToTrader(tables, baseJson._id, jsonUtil);

        // Add trader to locale file, ensures trader text shows properly on screen
        // WARNING: adds the same text to ALL locales (e.g. chinese/french/english)
        this.traderHelper.addTraderToLocales(baseJson, tables, baseJson.nickname, "Coop Trader", baseJson.nickname, baseJson.location, "");

    }

    public createAssort(databaseServerTables:any): void {

        // -------------------------------------------
        // Get Dynamic Assort Path
        // const traderDbPath = path.join( __dirname, this.traderId);
        const traderDbPath = path.join( process.cwd(), "user", "cache", "PaulovsSITCoop", this.traderId);
        if(!fs.existsSync(traderDbPath))
            fs.mkdirSync(traderDbPath, { recursive: true });

        // Create dynamic assort file
        const dynamicAssortFilePath = path.join(traderDbPath, "dynamicAssort.json");
        if(!fs.existsSync(dynamicAssortFilePath)) {
            const defaultFile = JSON.stringify([], null, 4);
            fs.writeFileSync(dynamicAssortFilePath, defaultFile);
        }
        // -------------------------------------------

        // --------------------------------------------------------
        // Empty out the tables!
        databaseServerTables.traders[baseJson._id].assort.barter_scheme = {};
        databaseServerTables.traders[baseJson._id].assort.items = [];
        databaseServerTables.traders[baseJson._id].assort.loyal_level_items = {};
        
        const currentAssort:[any] = JSON.parse(fs.readFileSync(dynamicAssortFilePath).toString());
        for(const item of currentAssort) {
            
            if (item.length !== undefined) {
                // is a preset or grouped item
                if(item.length == 0)
                    continue;

                let totalPrice = 0;
                for(const innerItem of item) {
                    totalPrice += this.itemHelper.getItemPrice(innerItem["_tpl"])
                }

                this.fluentTraderAssortHelper.createComplexAssortItem(item)
                .addStackCount(1)
                .addMoneyCost(Money.ROUBLES, totalPrice)
                .addLoyaltyLevel(1)
                .export(databaseServerTables.traders[baseJson._id]);

            }
            else {
                this.fluentTraderAssortHelper.createSingleAssortItem(item["tpl"])
                .addStackCount(item["count"])
                .addMoneyCost(Money.ROUBLES, this.itemHelper.getItemPrice(item["tpl"]))
                .addLoyaltyLevel(1)
                .export(databaseServerTables.traders[baseJson._id]);
            }
        }
    }

     /**
     * Create a weapon from scratch, ready to be added to trader
     * @returns Item[]
     */
     public createGlock(): Item[]
     {
         // Create an array ready to hold weapon + all mods
         const glock: Item[] = [];
 
         // Add the base first
         glock.push({ // Add the base weapon first
             _id: "glockBase", // Ids dont matter, as long as they are unique (can use hashUtil.generate() if you dont want to type every id by hand)
             _tpl: "5a7ae0c351dfba0017554310" // This is the weapons tpl, found on: https://db.sp-tarkov.com/search
         });
 
         // Add barrel
         glock.push({
             _id: "glockbarrel",
             _tpl: "5a6b60158dc32e000a31138b",
             parentId: "glockBase", // This is a sub item, you need to define its parent its attached to / inserted into
             slotId: "mod_barrel" // Required for mods, you need to define what 'role' they have
         });
 
         // Add reciever
         glock.push({
             _id: "glockReciever",
             _tpl:"5a9685b1a2750c0032157104",
             parentId: "glockBase",
             slotId: "mod_reciever"
         });
 
          // Add compensator
          glock.push({
             _id: "glockCompensator",
             _tpl:"5a7b32a2e899ef00135e345a",
             parentId: "glockReciever", // The parent of this mod is the reciever NOT weapon, be careful to get the correct parent
             slotId: "mod_muzzle"
         });
 
         // Add Pistol grip
         glock.push({
             _id: "glockPistolGrip",
             _tpl:"5a7b4960e899ef197b331a2d",
             parentId: "glockBase",
             slotId: "mod_pistol_grip"
         });
 
         // Add front sight
         glock.push({
             _id: "glockRearSight",
             _tpl: "5a6f5d528dc32e00094b97d9",
             parentId: "glockReciever",
             slotId: "mod_sight_rear"
         });
 
         // Add rear sight
         glock.push({
             _id: "glockFrontSight",
             _tpl: "5a6f58f68dc32e000a311390",
             parentId: "glockReciever",
             slotId: "mod_sight_front"
         });
 
         // Add magazine
         glock.push({
             _id: "glockMagazine",
             _tpl: "630769c4962d0247b029dc60",
             parentId: "glockBase",
             slotId: "mod_magazine"
         });
 
         return glock;
     }
 
}
"use client";
import ComandaFinal from "./ComandaFinal";
import ComandaDashboardChrome from "./ComandaDashboardChrome";
import ComandaMenuLayer from "./ComandaMenuLayer";
import ComandaNavigationGuard from "./ComandaNavigationGuard";
import ComandaSessionUX from "./ComandaSessionUX";
import ComandaKitchenKDS from "./ComandaKitchenKDS";
import ComandaWaiterCash from "./ComandaWaiterCash";
import ComandaSectorPlanner from "./ComandaSectorPlanner";

export default function ComandaApp(){
  return <ComandaDashboardChrome><ComandaNavigationGuard/><ComandaSessionUX/><ComandaKitchenKDS/><ComandaWaiterCash/><ComandaSectorPlanner/><ComandaMenuLayer><ComandaFinal/></ComandaMenuLayer></ComandaDashboardChrome>;
}

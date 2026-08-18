"use client";
import ComandaFinal from "./ComandaFinal";
import ComandaDashboardChrome from "./ComandaDashboardChrome";
import ComandaMenuLayer from "./ComandaMenuLayer";
import ComandaNavigationGuard from "./ComandaNavigationGuard";
import ComandaSessionUX from "./ComandaSessionUX";
import ComandaKitchenKDS from "./ComandaKitchenKDS";
import ComandaWaiterCash from "./ComandaWaiterCash";

export default function ComandaApp(){
  return <ComandaDashboardChrome><ComandaNavigationGuard/><ComandaSessionUX/><ComandaKitchenKDS/><ComandaWaiterCash/><ComandaMenuLayer><ComandaFinal/></ComandaMenuLayer></ComandaDashboardChrome>;
}

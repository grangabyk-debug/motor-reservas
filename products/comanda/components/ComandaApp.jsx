"use client";
import ComandaFinal from "./ComandaFinal";
import ComandaDashboardChrome from "./ComandaDashboardChrome";
import ComandaMenuLayer from "./ComandaMenuLayer";
import ComandaNavigationGuard from "./ComandaNavigationGuard";
import ComandaSessionUX from "./ComandaSessionUX";
import ComandaKitchenKDS from "./ComandaKitchenKDS";

export default function ComandaApp(){
  return <ComandaDashboardChrome><ComandaNavigationGuard/><ComandaSessionUX/><ComandaKitchenKDS/><ComandaMenuLayer><ComandaFinal/></ComandaMenuLayer></ComandaDashboardChrome>;
}

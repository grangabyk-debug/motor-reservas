"use client";
import ComandaFinal from "./ComandaFinal";
import ComandaDashboardChrome from "./ComandaDashboardChrome";
import ComandaMenuLayer from "./ComandaMenuLayer";
import ComandaNavigationGuard from "./ComandaNavigationGuard";
import ComandaSessionUX from "./ComandaSessionUX";

export default function ComandaApp(){
  return <ComandaDashboardChrome><ComandaNavigationGuard/><ComandaSessionUX/><ComandaMenuLayer><ComandaFinal/></ComandaMenuLayer></ComandaDashboardChrome>;
}

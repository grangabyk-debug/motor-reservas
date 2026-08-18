"use client";
import ComandaFinal from "./ComandaFinal";
import ComandaDashboardChrome from "./ComandaDashboardChrome";
import ComandaMenuLayer from "./ComandaMenuLayer";

export default function ComandaApp(){
  return <ComandaDashboardChrome><ComandaMenuLayer><ComandaFinal/></ComandaMenuLayer></ComandaDashboardChrome>;
}

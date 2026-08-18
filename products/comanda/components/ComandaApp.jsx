"use client";
import ComandaFinal from "./ComandaFinal";
import ComandaDashboardChrome from "./ComandaDashboardChrome";
import ComandaMenuLayer from "./ComandaMenuLayer";
import ComandaNavigationGuard from "./ComandaNavigationGuard";
import ComandaSessionUX from "./ComandaSessionUX";
import ComandaKitchenKDS from "./ComandaKitchenKDS";
import ComandaWaiterCash from "./ComandaWaiterCash";
import ComandaSectorPlanner from "./ComandaSectorPlanner";
import ComandaRoleGuard from "./ComandaRoleGuard";
import ComandaAccessGate from "./ComandaAccessGate";
import ComandaStaffManager from "./ComandaStaffManager";
import ComandaWorkstationManager from "./ComandaWorkstationManager";
import ComandaPrincipalHome from "./ComandaPrincipalHome";

export default function ComandaApp(){
  return <ComandaAccessGate><ComandaDashboardChrome><ComandaNavigationGuard/><ComandaSessionUX/><ComandaRoleGuard/><ComandaPrincipalHome/><ComandaKitchenKDS/><ComandaWaiterCash/><ComandaSectorPlanner/><ComandaStaffManager/><ComandaWorkstationManager/><ComandaMenuLayer><ComandaFinal/></ComandaMenuLayer></ComandaDashboardChrome></ComandaAccessGate>;
}

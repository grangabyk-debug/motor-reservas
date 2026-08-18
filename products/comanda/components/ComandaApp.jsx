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
import ComandaUserManager from "./ComandaUserManager";
import ComandaWorkstationManager from "./ComandaWorkstationManager";
import ComandaPrinterManager from "./ComandaPrinterManager";
import ComandaPrincipalHome from "./ComandaPrincipalHome";
import ComandaReportsHub from "./ComandaReportsHub";

export default function ComandaApp(){
  return <ComandaAccessGate><ComandaDashboardChrome><ComandaNavigationGuard/><ComandaSessionUX/><ComandaRoleGuard/><ComandaPrincipalHome/><ComandaReportsHub/><ComandaKitchenKDS/><ComandaWaiterCash/><ComandaSectorPlanner/><ComandaUserManager/><ComandaStaffManager/><ComandaWorkstationManager/><ComandaPrinterManager/><ComandaMenuLayer><ComandaFinal/></ComandaMenuLayer></ComandaDashboardChrome></ComandaAccessGate>;
}

export const DEFAULT_PRICE_TAX_MODE="tax_excluded"

export function normalizePriceTaxMode(value){return value==="tax_included"?"tax_included":"tax_excluded"}
export function normalizeTaxSettings(value={}){return{enabled:value?.enabled!==false,vat_rate:Math.max(0,Number(value?.vat_rate??21)||0),price_tax_mode:normalizePriceTaxMode(value?.price_tax_mode)}}
export function roundPrice(value){return Math.round((Number(value)||0)*100)/100}
export function commercialPriceFromNet(value,taxes={}){const net=Math.max(0,Number(value)||0),config=normalizeTaxSettings(taxes);return config.enabled&&config.price_tax_mode==="tax_included"?roundPrice(net*(1+config.vat_rate/100)):roundPrice(net)}
export function netPriceFromCommercial(value,taxes={}){const entered=Math.max(0,Number(value)||0),config=normalizeTaxSettings(taxes);return config.enabled&&config.price_tax_mode==="tax_included"?roundPrice(entered/(1+config.vat_rate/100)):roundPrice(entered)}
export function finalPriceFromNet(value,taxes={}){const net=Math.max(0,Number(value)||0),config=normalizeTaxSettings(taxes);return config.enabled?roundPrice(net*(1+config.vat_rate/100)):roundPrice(net)}
export function priceTaxCaption(taxes={}){const config=normalizeTaxSettings(taxes);if(!config.enabled)return"Precio final · impuestos desactivados";return config.price_tax_mode==="tax_included"?`Precio final · IVA ${config.vat_rate}% incluido`:`Precio neto · + IVA ${config.vat_rate}%`}
export function priceTaxShortLabel(taxes={}){const config=normalizeTaxSettings(taxes);if(!config.enabled)return"Precio final";return config.price_tax_mode==="tax_included"?"IVA incluido":`+ IVA ${config.vat_rate}%`}
export function taxBreakdownFromNet(value,taxes={}){const net=roundPrice(Math.max(0,Number(value)||0)),config=normalizeTaxSettings(taxes),tax=config.enabled?roundPrice(net*config.vat_rate/100):0;return{net,tax,final:roundPrice(net+tax),rate:config.vat_rate,mode:config.price_tax_mode,enabled:config.enabled}}

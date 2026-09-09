import fs from"node:fs"

const navigationPath="app/pms-next/core/navigation.js"
const appPath="app/pms-next/PmsNextApp.jsx"
const sitemapPath="docs/pms-next/sitemap.md"

const navigation=fs.readFileSync(navigationPath,"utf8")
const app=fs.readFileSync(appPath,"utf8")
const sitemap=fs.readFileSync(sitemapPath,"utf8")
const violations=[]

function collect(source,re){return[...source.matchAll(re)].map(match=>match[1])}
function duplicates(values){const seen=new Set(),dupes=new Set();for(const value of values){if(seen.has(value))dupes.add(value);seen.add(value)}return[...dupes]}

const navIds=collect(navigation,/\{id:"([^"]+)",label:"[^"]+"/g)
const paneIds=collect(app,/pane\("([^"]+)"/g)
const sitemapIds=collect(sitemap,/<!--\s*view:([a-zA-Z0-9_-]+)\s*-->/g)

const descriptionsBlock=navigation.match(/export const VIEW_DESCRIPTIONS=\{([\s\S]*?)\}\nexport const ALL_VIEWS=/)?.[1]||""
const descriptionIds=collect(descriptionsBlock,/(?:^|,)([a-zA-Z0-9_]+):"/g)

const rolesBlock=navigation.match(/export const ROLE_VIEWS=\{([\s\S]*?)\}\nexport function getAllowedViews/)?.[1]||""
const roleIds=collect(rolesBlock,/"([^"]+)"/g)

for(const id of duplicates(navIds))violations.push(`duplicate navigation id: ${id}`)
for(const id of duplicates(paneIds))violations.push(`duplicate workspace pane: ${id}`)
for(const id of duplicates(sitemapIds))violations.push(`duplicate sitemap marker: ${id}`)

const navSet=new Set(navIds),paneSet=new Set(paneIds),sitemapSet=new Set(sitemapIds),descriptionSet=new Set(descriptionIds)

for(const id of navIds){
  if(!paneSet.has(id))violations.push(`navigation view has no mounted workspace: ${id}`)
  if(!descriptionSet.has(id))violations.push(`navigation view has no VIEW_DESCRIPTIONS entry: ${id}`)
  if(!sitemapSet.has(id))violations.push(`navigation view is missing from sitemap: ${id}`)
}

for(const id of paneIds)if(!navSet.has(id))violations.push(`mounted workspace has no navigation contract: ${id}`)
for(const id of sitemapIds)if(!navSet.has(id))violations.push(`sitemap contains stale/unknown view: ${id}`)
for(const id of roleIds)if(!navSet.has(id))violations.push(`ROLE_VIEWS references unknown view: ${id}`)

if(!navIds.length)violations.push("could not parse navigation ids")
if(!paneIds.length)violations.push("could not parse workspace panes")
if(!sitemapIds.length)violations.push("could not parse sitemap markers")
if(!descriptionsBlock)violations.push("could not parse VIEW_DESCRIPTIONS")
if(!rolesBlock)violations.push("could not parse ROLE_VIEWS")

if(violations.length){
  console.error("PMS Next sitemap/navigation guard failed:\n- "+violations.join("\n- "))
  process.exit(1)
}

console.log(`PMS Next sitemap guard OK: ${navIds.length} views have workspace, description, role-safe ids and sitemap entry`)
